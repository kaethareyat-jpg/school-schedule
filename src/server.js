import http from 'node:http';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';
import { buildSamplePayload, runSchedule } from './api.js';

const publicDir = path.resolve(process.cwd(), 'public');

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.ico', 'image/x-icon'],
]);

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
  });
  res.end(text);
}

function getContentType(filePath) {
  return contentTypes.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream';
}

async function serveFile(res, filePath) {
  const data = await fs.readFile(filePath);
  res.writeHead(200, {
    'Content-Type': getContentType(filePath),
    'Content-Length': data.length,
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => {
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) {
        resolve(null);
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function getLocalIpv4Addresses() {
  const addresses = [];
  const networks = os.networkInterfaces();

  for (const entries of Object.values(networks)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        addresses.push(entry.address);
      }
    }
  }

  return [...new Set(addresses)];
}

function createServer() {
  return http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url ?? '/', 'http://localhost');

    if (req.method === 'GET' && requestUrl.pathname === '/health') {
      sendJson(res, 200, {
        ok: true,
        service: 'backtracking-auto-scheduler',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/sample-data') {
      sendJson(res, 200, buildSamplePayload());
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/network-info') {
      const addresses = getLocalIpv4Addresses();
      sendJson(res, 200, {
        port,
        host,
        addresses,
        urls: addresses.map((address) => `http://${address}:${port}/`),
        localhostUrl: `http://localhost:${port}/`,
      });
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/app.js') {
      await serveFile(res, path.join(publicDir, 'app.js'));
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/form-app.js') {
      await serveFile(res, path.join(publicDir, 'form-app.js'));
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/styles.css') {
      await serveFile(res, path.join(publicDir, 'styles.css'));
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/schedule') {
      try {
        const body = await readBody(req);
        const result = runSchedule(body);
        sendJson(res, 200, result);
      } catch (error) {
        sendJson(res, 400, {
          ok: false,
          error: error instanceof Error ? error.message : 'Bad Request',
        });
      }
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/') {
      await serveFile(res, path.join(publicDir, 'index.html'));
      return;
    }

    sendText(res, 404, 'Not Found');
  });
}

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
const server = createServer();

server.listen(port, host, () => {
  const localUrls = getLocalIpv4Addresses().map((address) => `http://${address}:${port}/`);
  console.log(`Auto-scheduler API listening on http://localhost:${port}`);
  console.log(`Bound host: ${host}`);
  for (const url of localUrls) {
    console.log(`Open from another device: ${url}`);
  }
});

export { createServer };
