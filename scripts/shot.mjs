// 결과물 캡처 — 로컬 Chrome/Edge 헤드리스로 PC 1920 · TB 1024 · MO 375 를 찍어 dist/shots/ 에 저장해요
//   npm run shot                         라이브러리 (dist/index.html)
//   npm run shot -- all-templates        조립 페이지 (dist/pages/all-templates/)
//   npm run shot -- preview/hero-media-badge   variant 단독 미리보기 (먼저 npm run preview -- hero-media-badge)
//   npm run shot -- <대상> --height 6000   캡처 높이 (기본 3000)
//   npm run shot -- <대상> --url http://localhost:4173/templates/   서빙 중인 주소를 찍기
// Chrome 경로는 자동으로 찾고, 못 찾으면 CHROME_PATH 환경변수로 지정하세요.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ROOT } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); if (i < 0) return def; const v = args[i + 1]; args.splice(i, 2); return v; };
const height = Number(opt('--height', 3000));
const url = opt('--url', null);
const target = args[0] || 'library';

function findChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const cands = process.platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Chromium.app/Contents/MacOS/Chromium']
    : process.platform === 'win32'
      ? [`${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`, `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
         `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`, `${process.env['PROGRAMFILES(X86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
         `${process.env.PROGRAMFILES}\\Microsoft\\Edge\\Application\\msedge.exe`]
      : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'];
  return cands.find((p) => p && fs.existsSync(p));
}

const chrome = findChrome();
if (!chrome) { console.error('✗ Chrome/Edge 를 찾지 못했어요. CHROME_PATH 에 실행 파일 경로를 지정하세요.'); process.exit(1); }

let pageUrl;
if (url) pageUrl = url;
else {
  const file = target === 'library' ? path.join(ROOT, 'dist/index.html')
    : target.startsWith('preview/') ? path.join(ROOT, 'dist', `${target}.html`)
    : fs.existsSync(path.resolve(target)) ? path.resolve(target)
    : path.join(ROOT, 'dist/pages', target, 'index.html');
  if (!fs.existsSync(file)) { console.error(`✗ ${path.relative(ROOT, file)} 이 없어요 — 먼저 npm run build (또는 npm run preview)`); process.exit(1); }
  pageUrl = pathToFileURL(file).href;
}

const out = path.join(ROOT, 'dist/shots');
fs.mkdirSync(out, { recursive: true });
const name = target.replace(/[\\/:]+/g, '_');

function snap(pngPath, pageToOpen, width, h) {
  execFileSync(chrome, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
    `--screenshot=${pngPath}`, `--window-size=${width},${h}`, '--virtual-time-budget=8000', pageToOpen,
  ], { stdio: 'ignore' });
}

// 헤드리스 창은 약 500px 보다 좁아지지 않아서, 375·1024 는 실제 폭 iframe 하네스로 찍어요
for (const [label, w] of [['pc', 1920], ['tb', 1024], ['mo', 375]]) {
  const png = path.join(out, `${name}-${label}.png`);
  if (w >= 1280) snap(png, pageUrl, w, height);
  else {
    const harness = path.join(out, `_harness-${label}.html`);
    fs.writeFileSync(harness, `<!doctype html><body style="margin:0;background:#fff"><iframe src="${pageUrl}" style="display:block;width:${w}px;height:${height}px;border:0"></iframe></body>`);
    snap(png, pathToFileURL(harness).href, w + 20, height);
  }
  console.log(`✓ ${path.relative(ROOT, png)}`);
}
