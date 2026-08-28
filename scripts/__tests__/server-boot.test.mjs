/**
 * End-to-end boot test for server.js (issue #1): spawns the real production
 * server with ephemeral ports and verifies the /api/server-fingerprint
 * endpoint answers with the expected shape. Also guards the server against
 * regressions in its boot sequence (it must start cleanly).
 */
import { describe, it, expect, vi } from 'vitest';
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

/** Spawn the server expecting it to exit on its own; resolves with { code, output }. */
function bootServerExpectingExit(env, { timeoutMs = 15000 } = {}) {
  const child = spawn(process.execPath, [SERVER_JS], {
    env: { ...process.env, PORT: '0', PROXY_PORT: '0', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const exitPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Server did not exit in time. Output:\n${output}`));
    }, timeoutMs);
    const onData = (chunk) => {
      output += String(chunk);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ code, output });
    });
  });
  return { child, exitPromise };
}

describe('server.js boot + /api/server-fingerprint', () => {
  it(
    'starts cleanly, logs the configured backend host, and serves the fingerprint endpoint',
    async () => {
      const { child, portPromise, getOutput } = bootServer({ JMAP_SERVER: 'http://localhost:1' });
      try {
        const port = await portPromise;

        // Issue #9: the configured backend host must appear in boot logs.
        await vi.waitFor(() => {
          expect(getOutput()).toContain('JMAP backend: http://localhost:1');
          expect(getOutput()).toContain('host: localhost');
        }, { timeout: 8000, interval: 100 });

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

  it(
    'boots with a prominent warning when the backend host does not resolve (issue #9)',
    async () => {
      // bad_host..name parses as a URL but deterministically fails DNS
      // (EBADNAME, no network) on every resolver — no wildcard surprises.
      const { child, portPromise, getOutput } = bootServer({ JMAP_SERVER: 'http://bad_host..name:8080' });
      try {
        const port = await portPromise;
        expect(port).toBeGreaterThan(0);
        await vi.waitFor(() => {
          const output = getOutput();
          expect(output).toContain('did not resolve');
          expect(output).toMatch(/WARNING/i);
          expect(output).toContain('bad_host..name');
        }, { timeout: 8000, interval: 100 });
      } finally {
        await stopServer(child);
      }
    },
    20000,
  );

  it(
    'fails fast at boot when JMAP_FAIL_FAST_ON_UNRESOLVED is set (issue #9)',
    async () => {
      const { exitPromise } = bootServerExpectingExit({
        JMAP_SERVER: 'http://bad_host..name:8080',
        JMAP_FAIL_FAST_ON_UNRESOLVED: '1',
      });
      const { code, output } = await exitPromise;
      expect(code).not.toBe(0);
      expect(output).toContain('did not resolve');
      expect(output).toContain('bad_host..name');
    },
    20000,
  );
});
