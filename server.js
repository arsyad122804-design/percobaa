const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.resolve(__dirname);
const INDEX_HTML = path.join(ROOT_DIR, 'index.html');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.pdf': 'application/pdf',
};

function startServer(port) {
  const server = http.createServer((req, res) => {
    let safeUrl = decodeURIComponent(req.url.split('?')[0]);

    // Handle root, index, and repo path prefixes (e.g. /percobaa, /percobaa/index.html)
    const isRootOrIndex = safeUrl === '/' || 
                          safeUrl === '/index.html' || 
                          safeUrl === '/index.htm' ||
                          safeUrl === '/percobaa' || 
                          safeUrl === '/percobaa/' || 
                          safeUrl === '/percobaa/index.html';

    if (isRootOrIndex) {
      console.log(`[200 OK] ${req.method} ${safeUrl} -> index.html`);
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=UTF-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      });
      return fs.createReadStream(INDEX_HTML).pipe(res);
    }

    // Strip optional /percobaa prefix if requested
    if (safeUrl.startsWith('/percobaa/')) {
      safeUrl = safeUrl.replace('/percobaa', '');
    }

    const relativeUrl = safeUrl.replace(/^[/\\]+/, '');
    const filePath = path.resolve(ROOT_DIR, relativeUrl);

    // Prevent directory traversal (case-insensitive for Windows filesystem)
    if (!filePath.toLowerCase().startsWith(ROOT_DIR.toLowerCase())) {
      console.warn(`[403 FORBIDDEN] ${req.method} ${safeUrl}`);
      res.writeHead(403, { 
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // If an HTML route or directory without extension is requested, fallback to index.html
        if (!path.extname(filePath) || path.extname(filePath).toLowerCase() === '.html') {
          console.log(`[FALLBACK] ${req.method} ${safeUrl} -> index.html`);
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=UTF-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Access-Control-Allow-Origin': '*'
          });
          return fs.createReadStream(INDEX_HTML).pipe(res);
        }

        console.warn(`[404 NOT FOUND] ${req.method} ${safeUrl} (${err ? err.code : 'not a file'})`);
        res.writeHead(404, { 
          'Content-Type': 'text/html; charset=UTF-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(`<h2>404 Not Found</h2><p>Halaman atau file <code>${safeUrl}</code> tidak ditemukan.</p>`);
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      // Support Range requests for smooth video playback/streaming
      if (req.headers.range && (ext === '.mp4' || ext === '.webm')) {
        const range = req.headers.range;
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
        const chunksize = (end - start) + 1;
        console.log(`[206 PARTIAL] ${req.method} ${safeUrl} (bytes ${start}-${end}/${stats.size})`);
        const file = fs.createReadStream(filePath, { start, end });
        const head = {
          'Content-Range': `bytes ${start}-${end}/${stats.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
        };
        res.writeHead(206, head);
        file.pipe(res);
        return;
      }

      console.log(`[200 OK] ${req.method} ${safeUrl} (${stats.size} bytes)`);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stats.size,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      });

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} sedang digunakan, mencoba port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });

  server.listen(port, () => {
    console.log('\n==================================================');
    console.log('  🚀 Thursina IIBS Website Dev Server Berjalan!');
    console.log(`  🔗 Local:   http://localhost:${port}`);
    console.log(`  🌐 Network: http://127.0.0.1:${port}`);
    console.log('==================================================\n');
  });
}

startServer(PORT);
