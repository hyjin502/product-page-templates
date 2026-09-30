// variant 하나(또는 섹션 전체)를 sample.json 으로 렌더해 단독 미리보기 파일을 만들어요 — 스크린샷 비교용
//   node scripts/preview.mjs --section concern          concern 의 모든 variant
//   node scripts/preview.mjs hero-split problem-quote   지정한 variant
// 결과: dist/preview/<id>.html, 옵션마다 <id>--<option>.html, MO 375 확인용 <id>.mo.html(375px iframe)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, BASE_CSS_PATH, PAGER_JS_PATH, FONT_LINK, loadRegistry, createEnv, renderVariant, cssFor, validateContent } from './lib.mjs';

const args = process.argv.slice(2);
const reg = loadRegistry();
const env = createEnv();
const baseCss = fs.readFileSync(BASE_CSS_PATH, 'utf8');
const out = path.join(ROOT, 'dist/preview');
fs.mkdirSync(out, { recursive: true });
fs.cpSync(path.join(ROOT, 'assets'), path.join(ROOT, 'dist/assets'), { recursive: true });

let ids = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--section') ids.push(...(reg.sectionByKey[args[++i]]?.variants || []));
  else ids.push(args[i]);
}
const mine = reg.loadErrors.filter((e) => ids.length === 0 || args.some((a) => e.includes(`sections/${a}/`) || e.includes(a.replace(/-/, '/'))));
if (mine.length) { console.error('✗ ' + mine.join('\n✗ ')); process.exit(1); }
if (!ids.length) { console.error('variant id 또는 --section <key> 를 주세요'); process.exit(1); }

const STAGE = { sticky: 'body{min-height:180px;display:flex;flex-direction:column;justify-content:flex-end;background:#e7e8eb}' };
let failed = false;
for (const id of ids) {
  const v = reg.byId[id];
  if (!v) { console.error(`✗ 없는 variant: ${id}`); failed = true; continue; }
  const errors = validateContent(v, v.sample, `${id}/sample.json`);
  if (errors.length) { console.error('✗ ' + errors.join('\n✗ ')); failed = true; continue; }
  const combos = [[], ...Object.keys(v.options || {}).map((o) => [o])];
  for (const opts of combos) {
    let html;
    try { html = renderVariant(env, v, v.sample, { options: opts }); } catch (e) { console.error(`✗ ${id} 렌더 실패: ${e.message}`); failed = true; continue; }
    const name = id + (opts.length ? `--${opts[0]}` : '');
    const doc = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<base href="../">${FONT_LINK}<style>${baseCss}\n${cssFor(reg, [id])}\n${STAGE[v.stage] || ''}</style></head>
<body>${html}${v.pager ? `<script>${fs.readFileSync(PAGER_JS_PATH, 'utf8')}</script>` : ''}${v.js ? `<script>${v.js}</script>` : ''}</body></html>`;
    fs.writeFileSync(path.join(out, `${name}.html`), doc);
    fs.writeFileSync(path.join(out, `${name}.mo.html`), `<!doctype html><body style="margin:0;background:#888"><iframe src="${name}.html" style="display:block;width:375px;height:4000px;border:0;background:#fff"></iframe></body>`);
    console.log(`✓ dist/preview/${name}.html`);
  }
}
if (failed) process.exit(1);
