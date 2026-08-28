/**
 * /health backend-probe tests (issue #7): the health endpoint must probe the
 * configured JMAP backend and fail the overall check (503 + status
 * "degraded") when the backend is unreachable, so deploy gates (Docker
 * healthcheck, deploy.sh) fail exactly when mail is broken. A live in-test
 * backend must produce 200 + "ok".
 */
import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_JS = path.join(__dirname, '..', '..', 'server.js');
const SERVER_CJS = path.join(__dirname, '..', '..', 'server.cjs');

function bootServer(env) {
  const child = spawn(process.execPath, [SERVER_JS], {
    env: { ...process.env, PORT: '0', PROXY_PORT: '0', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const portPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server did not boot in time. Output:\n${output}`)), 15000);
    const onData = (chunk) => {
      output += String(chunk);
      const match = output.match(/listening on 0\.0\.0\.0:(\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited early (code ${code}). Output:\n${output}`));
    });
  });
  return { child, portPromise };
}

async function stopServer(child) {
  child.kill('SIGTERM');
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve(null);
    }, 3000);
    child.on('exit', () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

/** Tiny in-test HTTP "backend" so the health probe has something to reach. */
function startFakeBackend() {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sessionState: 'test' }));
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

describe('server.js /health backend probe (issue #7)', () => {
  it(
    'reports the backend as down (503 + degraded) when JMAP_SERVER is unreachable',
    async () => {
      // Port 1: DNS resolves but the TCP connect fails deterministically.
      const { child, portPromise } = bootServer({ JMAP_SERVER: 'http://127.0.0.1:1' });
      try {
        const port = await portPromise;
        const response = await fetch(`http://127.0.0.1:${port}/health`);
        expect(response.status).toBe(503);

        const health = await response.json();
        expect(health.status).toBe('degraded');
        expect(health.backend.host).toBe('127.0.0.1');
        expect(health.backend.resolved).toBe(true);
        expect(health.backend.reachable).toBe(false);
        expect(health.backend.consecutiveFailures).toBeGreaterThanOrEqual(1);
      } finally {
        await stopServer(child);
      }
    },
    20000,
  );

  it(
    'reports ok when the backend answers the connection probe',
    async () => {
      const fakeBackend = await startFakeBackend();
      try {
        const { child, portPromise } = bootServer({ JMAP_SERVER: `http://127.0.0.1:${fakeBackend.port}` });
        try {
          const port = await portPromise;
          const response = await fetch(`http://127.0.0.1:${port}/health`);
          expect(response.status).toBe(200);

          const health = await response.json();
          expect(health.status).toBe('ok');
          expect(health.backend.reachable).toBe(true);
          expect(health.backend.resolved).toBe(true);
          expect(health.backend.consecutiveFailures).toBe(0);
        } finally {
          await stopServer(child);
        }
      } finally {
        fakeBackend.server.close();
      }
    },
    20000,
  );
});

/** Pick a free TCP port (closed right after, small race, standard test pattern). */
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

describe('server.cjs /health parity (issue #7)', () => {
  it(
    'fails the check when the backend is unreachable',
    async () => {
      const port = await getFreePort();
      const child = spawn(process.execPath, [SERVER_CJS], {
        env: { ...process.env, PORT: String(port), JMAP_SERVER: 'http://127.0.0.1:1' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let output = '';
      const booted = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`server.cjs did not boot. Output:\n${output}`)), 15000);
        const onData = (chunk) => {
          output += String(chunk);
          if (output.includes('running on http://0.0.0.0:')) {
            clearTimeout(timer);
            resolve();
          }
        };
        child.stdout.on('data', onData);
        child.stderr.on('data', onData);
        child.on('exit', (code) => {
          clearTimeout(timer);
          reject(new Error(`server.cjs exited early (code ${code}). Output:\n${output}`));
        });
      });
      try {
        await booted;
        const response = await fetch(`http://127.0.0.1:${port}/health`);
        expect(response.status).toBe(503);
        const health = await response.json();
        expect(health.status).toBe('degraded');
        expect(health.backend.reachable).toBe(false);
        expect(health.backend.consecutiveFailures).toBeGreaterThanOrEqual(1);
      } finally {
        child.kill('SIGTERM');
        await new Promise((resolve) => {
          const timer = setTimeout(() => {
            child.kill('SIGKILL');
            resolve(null);
          }, 3000);
          child.on('exit', () => {
            clearTimeout(timer);
            resolve(null);
          });
        });
      }
    },
    20000,
  );
});
