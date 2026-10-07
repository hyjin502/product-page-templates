// Figma 링크 다시 맞추기 — 디자이너가 페이지를 복사해 노드 ID 가 모두 바뀌었을 때
//   1) Claude 가 use_figma 로 아래 DUMP 스크립트를 새 페이지에서 실행해 결과를 pages/_verify/figma-page.json 에 저장
//   2) node scripts/figma-relink.mjs pages/_verify/figma-page.json --dry   바뀔 내용만 보기
//   3) node scripts/figma-relink.mjs pages/_verify/figma-page.json         meta.json · sections.json 고치기
//
// 맞추는 규칙
//   - 섹션 = 같은 이름의 프레임(컴포넌트 세트). 이름이 같은 프레임이 여럿이면 심볼이 가장 많은 것
//   - variant = 심볼 이름 "device=…, layout=…[, style=…][, mode=…]" 이 meta 의 layout(feature 는 style)과 같은 것
//     layout 이 없는 심볼(logo-wall, metrics)과 mode=light(faq, notice, sticky-cta)는 layout "default" 로 봐요
//   - 옵션: compact → "<layout>-compact"(feature 는 style), dark → mode=dark
//   - 이름으로 못 찾는 섹션(hero 처럼 이름이 모두 center-inline)은 "줄" 로 맞춰요:
//     PC 왼쪽 열 심볼(가로 1280 이상, 가장 왼쪽 x)을 위→아래 순서로 meta.order 에 대응,
//     MO 는 같은 줄(세로 위치가 가장 가까운) 가로 375 심볼 — 이름의 device 값이 틀려도 폭으로 판단해요
//
// DUMP (use_figma, 읽기 전용) — PAGE_ID 를 새 페이지 ID 로 바꿔 실행
//   const page = await figma.getNodeByIdAsync('PAGE_ID'); await figma.setCurrentPageAsync(page);
//   const frames = [];
//   for (const f of page.children) { if (!('children' in f)) continue;
//     const symbols = f.children.filter((c) => c.type === 'COMPONENT').map((c) => ({ id: c.id, name: c.name, x: Math.round(c.x), y: Math.round(c.y), w: Math.round(c.width), h: Math.round(c.height) }));
//     if (symbols.length) frames.push({ id: f.id, name: f.name, type: f.type, symbols }); }
//   return { page: { id: page.id, name: page.name }, frames };
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadRegistry } from './lib.mjs';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const dumpPath = args.find((a) => !a.startsWith('--'));
if (!dumpPath) { console.error('사용법: node scripts/figma-relink.mjs <figma-page.json> [--dry]'); process.exit(1); }
const dump = JSON.parse(fs.readFileSync(path.resolve(dumpPath), 'utf8'));
const reg = loadRegistry();

const props = (name) => Object.fromEntries(String(name).split(',').map((s) => s.trim().split('=')).filter((p) => p.length === 2));
const frameOf = (key) => dump.frames.filter((f) => f.name === key).sort((a, b) => b.symbols.length - a.symbols.length)[0];

/** 심볼 하나가 (device, 이름 키)에 맞는지 */
function nameMatch(sym, device, key, isFeature) {
  const p = props(sym.name);
  if (p.device !== device) return false;
  const k = isFeature ? p.style : (p.layout || (p.mode === 'light' || !p.mode ? 'default' : p.mode));
  return k === key;
}

const changes = []; // { file, old, new, what }
const unmatched = [];

for (const sec of reg.catalog.sections) {
  const frame = frameOf(sec.key);
  if (!frame) { unmatched.push(`${sec.key}: 같은 이름의 프레임이 없어요`); continue; }
  changes.push({ file: 'sections/sections.json', old: sec.figmaSet, new: frame.id, what: `${sec.key} 섹션 프레임` });
  const metas = reg.variants.filter((v) => v.section === sec.key);
  const isFeature = sec.key === 'feature';
  const keyOf = (v) => (isFeature ? v.id.slice(`${sec.key}-grid-`.length) : v.layout);

  // 줄 맞추기 준비 (이름으로 못 찾는 variant 용)
  const pcCol = frame.symbols.filter((s) => s.w >= 1280);
  const minX = Math.min(...pcCol.map((s) => s.x));
  const rows = pcCol.filter((s) => s.x === minX).sort((a, b) => a.y - b.y);
  const mos = frame.symbols.filter((s) => s.w <= 430);
  const rowMo = (pc) => mos.map((s) => [Math.abs(s.y - pc.y), s]).filter(([dy]) => dy < 400).sort((a, b) => a[0] - b[0] || a[1].x - b[1].x)[0]?.[1];
  const sortedMetas = [...metas].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

  for (const v of metas) {
    const file = path.relative(ROOT, path.join(v.dir, 'meta.json'));
    const key = keyOf(v);
    for (const d of ['pc', 'mo']) {
      let sym = frame.symbols.find((s) => nameMatch(s, d, key, isFeature));
      let how = '이름';
      if (!sym) {
        const pc = rows[sortedMetas.indexOf(v)];
        sym = d === 'pc' ? pc : pc && rowMo(pc);
        how = '줄';
      }
      const old = v.figma?.[d] || null;
      if (sym) changes.push({ file, old, new: sym.id, what: `${v.id} ${d.toUpperCase()} (${how}: ${sym.name}${how === '줄' ? ` @y${sym.y}` : ''})`, field: [v.id, d] });
      else if (old || d === 'pc') unmatched.push(`${v.id} ${d}: 못 찾았어요 (지금 ${old})`);
    }
    for (const [ok, o] of Object.entries(v.options || {})) {
      for (const d of Object.keys(o.figma || {})) {
        const okey = ok === 'dark' ? 'dark' : `${key}-compact`;
        const sym = frame.symbols.find((s) => nameMatch(s, d, okey, isFeature));
        if (sym) changes.push({ file, old: o.figma[d], new: sym.id, what: `${v.id} 옵션 ${ok} ${d.toUpperCase()} (${sym.name})`, field: [v.id, d, ok] });
        else unmatched.push(`${v.id} 옵션 ${ok} ${d}: 못 찾았어요`);
      }
    }
  }
}

// 보고
for (const c of changes) console.log(`${c.old === c.new ? '=' : '→'} ${c.what}: ${c.old ?? '없음'} → ${c.new}`);
if (unmatched.length) console.log('\n✗ 못 맞춘 것\n  ' + unmatched.join('\n  '));
const changed = changes.filter((c) => c.old !== c.new);
console.log(`\n${changed.length}건 바뀜 · 페이지 ${dump.page.name} (${dump.page.id})`);
if (dry) process.exit(0);

// 쓰기 — 서식을 그대로 두려고 meta 는 JSON 을 다시 쓰지 않고 해당 값만 바꿔요
const byFile = {};
for (const c of changed) (byFile[c.file] ||= []).push(c);
for (const [file, list] of Object.entries(byFile)) {
  const abs = path.join(ROOT, file);
  let text = fs.readFileSync(abs, 'utf8');
  if (file === 'sections/sections.json') {
    for (const c of list) text = text.replace(`"figmaSet": "${c.old}"`, `"figmaSet": "${c.new}"`);
  } else {
    const meta = JSON.parse(text);
    for (const c of list) {
      const [, d, opt] = c.field;
      if (opt) meta.options[opt].figma[d] = c.new; else meta.figma[d] = c.new;
      // 값이 있던 자리는 문자열만 바꾸고, null 이던 자리는 null 을 바꿔요
      if (c.old) text = text.replace(`"${c.old}"`, `"${c.new}"`);
      else text = text.replace(new RegExp(`("figma":\\s*\\{[^}]*"${d}":\\s*)null`), `$1"${c.new}"`);
    }
    if (JSON.stringify(JSON.parse(text)) !== JSON.stringify(meta)) { console.error(`✗ ${file}: 값 바꾸기가 어긋났어요 — 손으로 확인하세요`); process.exit(1); }
  }
  fs.writeFileSync(abs, text);
}
const sj = path.join(ROOT, 'sections/sections.json');
fs.writeFileSync(sj, fs.readFileSync(sj, 'utf8').replace(/"page": "[^"]*"/, `"page": "${dump.page.id}"`));
console.log(`✓ meta ${Object.keys(byFile).length}개 파일 · sections.json page = ${dump.page.id}`);
