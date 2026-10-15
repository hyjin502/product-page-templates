// hero CSS 배경 프리셋의 정지 화면 — Figma 플러그인이 CSS 배경 대신 넣는 이미지 (assets/hero/bgfx/<key>.jpg, 1920×1080)
// 프리셋(sections/hero/backgrounds.json · _backgrounds.css)을 더하거나 바꾸면 다시 실행하고 커밋하세요:  node scripts/bgfx-stills.mjs
// 움직임은 6초 지점에서 멈춘 화면이에요(animation-delay -6s + paused — 브라우저와 상관없이 같은 장면). 로컬 Chrome/Edge 헤드리스로 찍어요. Chrome 이 없는 macOS 는 WKWebView(scripts/webshot.swift, Safari 엔진)로 찍어요.
// JPG 변환·자르기는 macOS sips 를 써요.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ROOT } from './lib.mjs';

const chrome = process.env.CHROME_PATH || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/usr/bin/google-chrome', '/usr/bin/chromium']
  .find((p) => fs.existsSync(p));
const mac = process.platform === 'darwin';
if (!chrome && !mac) { console.error('✗ Chrome/Edge 를 찾지 못했어요. CHROME_PATH 를 지정하세요.'); process.exit(1); }
const { presets } = JSON.parse(fs.readFileSync(path.join(ROOT, 'sections/hero/backgrounds.json'), 'utf8'));
const css = fs.readFileSync(path.join(ROOT, 'sections/hero/_backgrounds.css'), 'utf8');
const out = path.join(ROOT, 'assets/hero/bgfx');
const tmp = path.join(ROOT, 'dist/bgfx-tmp');
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(tmp, { recursive: true });
let sips = true;
for (const p of presets) {
  const html = path.join(tmp, `${p.key}.html`);
  // 이미지를 쓰는 프리셋(x-pattern)은 매크로와 같은 마크업 — 이미지는 임시 폴더에 복사해 상대 경로로
  let inner = '<span></span><span></span><span></span><span></span>';
  if (p.image) {
    const name = path.basename(p.image);
    fs.copyFileSync(path.join(ROOT, p.image), path.join(tmp, name));
    inner = `<div class="hero-bgfx__flow"><img src="${name}" alt=""><img src="${name}" alt=""></div>`;
  }
  fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>${css}\nhtml,body{margin:0;overflow:hidden}
.hero-bgfx,.hero-bgfx>span,.hero-bgfx__flow{animation-delay:-6s!important;animation-play-state:paused!important}</style>
<div style="position:relative;width:1920px;height:1080px;overflow:hidden"><div class="hero-bgfx hero-bgfx--${p.key}">${inner}</div></div>`);
  const png = path.join(tmp, `${p.key}.png`);
  if (chrome) execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--screenshot=${png}`, '--window-size=1920,1080', pathToFileURL(html).href], { stdio: 'ignore' });
  else { // Chrome 이 없는 macOS — WKWebView(scripts/webshot.swift)로 찍고(레티나 2배) 1920×1080 으로 줄여요
    execFileSync('swift', [path.join(ROOT, 'scripts/webshot.swift'), html, png, '1920', '1080'], { stdio: 'ignore' });
    execFileSync('sips', ['-z', '1080', '1920', png], { stdio: 'ignore' });
  }
  const jpg = path.join(out, `${p.key}.jpg`);
  try { if (!sips) throw 0; execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', png, '--out', jpg], { stdio: 'ignore' }); }
  catch { sips = false; fs.copyFileSync(png, jpg.replace(/\.jpg$/, '.png')); }
  console.log(`✓ assets/hero/bgfx/${p.key}.${sips ? 'jpg' : 'png'}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
