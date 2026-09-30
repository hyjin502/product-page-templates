// dist/ 를 http 로 서빙해요 — 사내 정적 호스팅에 올리기 전 같은 환경(http, 하위 경로)에서 점검용
//   npm run serve                      http://localhost:4173/
//   npm run serve -- --base /templates/  http://localhost:4173/templates/  (하위 경로 배포 흉내)
//   npm run serve -- --dir <폴더> --port 8080
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib.mjs';

const arg = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : def; };
const dir = path.resolve(arg('--dir', path.join(ROOT, 'dist')));
const port = Number(arg('--port', 4173));
let base = arg('--base', '/');
if (!base.startsWith('/')) base = '/' + base;
if (!base.endsWith('/')) base += '/';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

if (!fs.existsSync(path.join(dir, 'index.html'))) {
  console.error(`✗ ${dir}/index.html 이 없어요 — 먼저 npm run build`);
  process.exit(1);
}

http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!url.startsWith(base)) { res.writeHead(302, { Location: base }); return res.end(); }
  let file = path.join(dir, url.slice(base.length));
  if (!file.startsWith(dir)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404 ' + url); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`▶ http://localhost:${port}${base}   (${path.relative(ROOT, dir) || dir})`);
  console.log('  종료: Ctrl+C');
});
