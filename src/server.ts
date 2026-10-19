import http from 'node:http';
import { URL } from 'node:url';
import { buildSamplePayload, runSchedule } from './api.js';

function sendJson(res: http.ServerResponse, statusCode: number, data: unknown): void {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res: http.ServerResponse, statusCode: number, text: string): void {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
  });
  res.end(text);
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
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
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

export function createServer(): http.Server {
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
      sendJson(res, 200, {
        name: 'Backtracking Auto-Scheduler API',
        routes: ['/health', '/sample-data', 'POST /schedule'],
      });
      return;
    }

    sendText(res, 404, 'Not Found');
  });
}

const port = Number(process.env.PORT ?? 3000);
const server = createServer();

server.listen(port, () => {
  console.log(`Auto-scheduler API listening on http://localhost:${port}`);
});
