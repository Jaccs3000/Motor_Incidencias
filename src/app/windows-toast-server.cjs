const http = require('http');
const path = require('path');
const { notify } = require('node-notifier');

const port = 3000;
const host = '127.0.0.1';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  res.end('');
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || host}`);
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (req.method === 'POST' && pathname === '/notify') {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      let title = 'Nueva notificación';
      let message = 'Sin mensaje';

      try {
        const parsed = JSON.parse(body);
        title = parsed.title || title;
        message = parsed.message || parsed.text || body || message;
      } catch {
        message = body || message;
      }

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      notify({
        title,
        message,
        wait: false,
        sound: true,
      }, (err) => {
        if (err) {
          console.error('Error al mostrar la notificación:', err);
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: String(err) }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true }));
      });
    });

    return;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const urlPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(__dirname, urlPath);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Acceso denegado');
    return;
  }

  sendFile(res, filePath);
});

server.listen(port, host, () => {
  console.log(`Servidor de notificaciones activo en http://${host}:${port}`);
});
