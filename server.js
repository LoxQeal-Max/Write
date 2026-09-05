const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = 5500;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*' });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 15e6) reject(new Error('Request body too large'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch (error) { reject(error); }
    });
    req.on('error', reject);
  });
}

async function proxy(req, res, type) {
  try {
    const input = await readJson(req);
    const base = String(input.base || '').replace(/\/$/, '');
    const key = String(input.key || '');
    if (!base || !key) return send(res, 400, 'Missing API base or key');
    const url = type === 'models' ? `${base}/models` : `${base}/chat/completions`;
    const response = await fetch(url, {
      method: type === 'models' ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: type === 'models' ? undefined : JSON.stringify(input.payload || {})
    });
    const text = await response.text();
    res.writeHead(response.status, {
      'Content-Type': response.headers.get('content-type') || 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(text);
  } catch (error) {
    send(res, 502, JSON.stringify({ error: error.message }), 'application/json');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }
  if (url.pathname === '/api/chat' && req.method === 'POST') return proxy(req, res, 'chat');
  if (url.pathname === '/api/models' && req.method === 'POST') return proxy(req, res, 'models');
  const requested = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const file = path.resolve(ROOT, requested);
  if (!file.startsWith(ROOT)) return send(res, 403, 'Forbidden');
  fs.readFile(file, (error, data) => {
    if (error) return send(res, 404, 'Not found');
    send(res, 200, data, MIME[path.extname(file)] || 'application/octet-stream');
  });
});

server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`端口 ${PORT} 已被占用，请关闭旧的 Node 服务后重试。`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});

server.listen(PORT, () => console.log(`Moyu running at http://localhost:${PORT}/index.html`));
