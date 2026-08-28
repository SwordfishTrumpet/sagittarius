/**
 * Proxy failure-mode test for server.js (issue #8): when the configured JMAP
 * backend is unreachable, the proxy must answer with the unified 502 JSON
 * shape ({ error: 'JMAP backend unavailable' }) — the same shape server.cjs
 * and the Vite dev proxy produce — instead of a divergent body or a hanging
 * request. The client maps 502 → ServerUnreachableError regardless of body,
 * but operators debugging the wire traffic must see one consistent shape.
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

describe('server.js proxy failure mode (issue #8)', () => {
  it(
    'answers a dead backend with the unified 502 JSON shape',
    async () => {
      // Port 1 is privileged and closed everywhere: DNS resolves (127.0.0.1)
      // but the TCP connect fails, exercising the proxy error handler.
      const { child, portPromise } = bootServer({ JMAP_SERVER: 'http://127.0.0.1:1' });
      try {
        const port = await portPromise;
        const response = await fetch(`http://127.0.0.1:${port}/jmap/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ using: ['urn:ietf:params:jmap:core'] }),
        });
        expect(response.status).toBe(502);
        expect(response.headers.get('content-type')).toContain('application/json');
        await expect(response.json()).resolves.toEqual({ error: 'JMAP backend unavailable' });
      } finally {
        await stopServer(child);
      }
    },
    20000,
  );
});
