#!/usr/bin/env node
// Tiny static server for docs/ (what GitHub Pages serves).   node site/serve.js [port]
import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const port = Number(process.argv[2] ?? process.env.PORT ?? 8793);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  p = normalize(p).replace(/^(\.\.[/\\])+/, '');
  let file = join(root, p);
  try { if (statSync(file).isDirectory()) file = join(file, 'index.html'); statSync(file); }
  catch { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' });
  createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`docs/ at http://127.0.0.1:${port}`));
