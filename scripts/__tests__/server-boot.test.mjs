/**
 * End-to-end boot test for server.js (issue #1): spawns the real production
 * server with ephemeral ports and verifies the /api/server-fingerprint
 * endpoint answers with the expected shape. Also guards the server against
 * regressions in its boot sequence (it must start cleanly).
 */
import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_JS = path.join(__dirname, '..', '..', 'server.js');

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
  return { child, portPromise, getOutput: () => output };
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

describe('server.js boot + /api/server-fingerprint', () => {
  it(
    'starts cleanly and serves the fingerprint endpoint',
    async () => {
      const { child, portPromise } = bootServer({ JMAP_SERVER: 'http://localhost:1' });
      try {
        const port = await portPromise;

        const response = await fetch(`http://127.0.0.1:${port}/api/server-fingerprint`);
        expect(response.status).toBe(200);
        const fp = await response.json();

        expect(fp.host).toBe('localhost');
        expect(fp.scheme).toBe('http');
        expect(fp.resolved).toBe(true);
        expect(Array.isArray(fp.addresses)).toBe(true);
        expect(fp.addresses).toContain('127.0.0.1');
        expect(fp.certFingerprint).toBeNull();
        expect(typeof fp.trusted).toBe('boolean');
      } finally {
        await stopServer(child);
      }
    },
    20000,
  );

  it(
    'answers with a well-formed fingerprint for any backend state',
    async () => {
      // NOTE: the unresolvable-host path is covered deterministically in
      // serverUtils.test.mjs (injected DNS). This environment's resolver
      // wildcards .invalid names, so here we only assert the endpoint shape.
      const { child, portPromise } = bootServer({ JMAP_SERVER: 'https://no-such-host.invalid' });
      try {
        const port = await portPromise;

        const response = await fetch(`http://127.0.0.1:${port}/api/server-fingerprint`);
        expect(response.status).toBe(200);
        const fp = await response.json();

        expect(typeof fp.host).toBe('string');
        expect(fp.scheme).toBe('https');
        expect(typeof fp.resolved).toBe('boolean');
        expect(Array.isArray(fp.addresses)).toBe(true);
        expect(typeof fp.trusted).toBe('boolean');
        expect(fp.certFingerprint === null || typeof fp.certFingerprint === 'string').toBe(true);
      } finally {
        await stopServer(child);
      }
    },
    20000,
  );
});
