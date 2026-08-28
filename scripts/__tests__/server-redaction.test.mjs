/**
 * End-to-end log-redaction test (issue #2): spawns the real production
 * server, makes EventSource + WebSocket requests whose URLs carry
 * `access_token=<base64 credentials>`, and asserts that the server's log
 * output (which is what gets redirected into server.log) never contains the
 * token — only [REDACTED]. Also performs the grep-based nginx config
 * verification from the issue's Definition of Done.
 */
import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_JS = path.join(__dirname, '..', '..', 'server.js');
const NGINX_CONF = path.join(__dirname, '..', '..', 'nginx-webmail.conf');

const LEAK = 'access_token=dGVzdDpzZWNyZXQ='; // base64 of "test:secret"

function bootServer() {
  const child = spawn(process.execPath, [SERVER_JS], {
    env: { ...process.env, PORT: '0', PROXY_PORT: '0', JMAP_SERVER: 'http://127.0.0.1:1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const portPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server did not boot. Output:\n${output}`)), 15000);
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

function wsUpgradeRequest(port) {
  return new Promise((resolve) => {
    const sock = net.connect(port, '127.0.0.1', () => {
      sock.write(
        `GET /jmap/ws?${LEAK} HTTP/1.1\r\n`
        + 'Host: localhost\r\n'
        + 'Upgrade: websocket\r\n'
        + 'Connection: Upgrade\r\n'
        + 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n'
        + 'Sec-WebSocket-Version: 13\r\n\r\n',
      );
    });
    sock.on('data', () => { sock.destroy(); resolve(); });
    sock.on('close', () => resolve());
    sock.on('error', () => resolve());
  });
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

describe('server.js log redaction (issue #2)', () => {
  it(
    'never writes access_token to the log output during EventSource + WebSocket sessions',
    async () => {
      const { child, portPromise, getOutput } = bootServer();
      try {
        const port = await portPromise;

        // EventSource-style request via the SSE-direct handler
        const esResponse = await fetch(`http://127.0.0.1:${port}/jmap/eventsource?${LEAK}&types=*`);
        expect([200, 502]).toContain(esResponse.status);

        // Regular proxied request (express proxy path, [proxy] log lines)
        await fetch(`http://127.0.0.1:${port}/jmap/session?${LEAK}`, { method: 'POST' }).catch(() => undefined);

        // WebSocket upgrade (raw socket; [ws-upgrade] log lines)
        await wsUpgradeRequest(port);

        // Give the async log writes a moment to flush
        await new Promise((resolve) => setTimeout(resolve, 500));

        const output = getOutput();
        // The token must never appear; redaction must actually kick in.
        // (Brackets are percent-encoded by the URL parser: %5B/%5D.)
        expect(output).not.toContain(LEAK);
        expect(output).not.toContain('access_token=dGVzdDpzZWNyZXQ');
        expect(output).toContain('access_token=%5BREDACTED%5D');
      } finally {
        await stopServer(child);
      }
    },
    20000,
  );
});

describe('nginx config (issue #2)', () => {
  it('disables access logging on /jmap and /jmap/ws (no query-string persistence)', () => {
    const conf = fs.readFileSync(NGINX_CONF, 'utf8');
    // Each /jmap location must opt out of access logging.
    expect(conf).toMatch(/location \/jmap\/ws\s*\{\s*access_log off;/);
    expect(conf).toMatch(/location \/jmap\s*\{\s*# SECURITY[\s\S]*?access_log off;/);
    // No log line may reference $request (which includes the query string);
    // the documented http-level format uses $request_method/$uri only.
    expect(conf).not.toMatch(/\$request(?!_)/);
  });
});
