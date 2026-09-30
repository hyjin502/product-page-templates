// Figma 조합 페이지 → page.json (figma-to-page 스킬이 쓰는 결정적 추출기)
//
// 1) node scripts/figma-extract.mjs scan <pcFrameId> [moFrameId]
//      → use_figma 에 넣을 "스캔" 플러그인 코드를 출력. 결과 JSON 을 pages/<name>.scan.json 에 저장
// 2) node scripts/figma-extract.mjs extract pages/<name>.scan.json
//      → 인스턴스를 variant/옵션으로 매핑하고, 쓰는 variant 의 슬롯 스펙을 넣은 "추출" 플러그인 코드를
//        dist/extract/<name>.js 로 저장. 매핑 실패가 있으면 목록을 출력하고 실패로 끝나요
// 3) use_figma 로 그 코드를 실행 → 결과 JSON 을 pages/<name>.raw.json 에 저장
// 4) node scripts/figma-extract.mjs finalize pages/<name>.raw.json
//      → PC·MO 병합, Figma 에 없는 값(href 등)과 덮어쓰지 않은 이미지는 sample.json 기본값으로 채워
//        pages/<name>.page.json 작성. 새 이미지 목록은 pages/<name>.images.json
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadRegistry, specOf } from './lib.mjs';

const [cmd, ...rest] = process.argv.slice(2);
const reg = loadRegistry();
const nameOf = (file) => path.basename(file).replace(/\.(scan|raw)(\.\d+)?\.json$/, '');

/* ---------------------------------------------------------------- 1. scan */

const SCAN = (frames) => `const FRAMES = ${JSON.stringify(frames)};
const out = { frames: {} };
for (const [device, id] of Object.entries(FRAMES)) {
  if (!id) continue;
  const frame = await figma.getNodeByIdAsync(id);
  if (!frame) { out.frames[device] = { error: 'not found: ' + id }; continue; }
  if (frame.parent && frame.parent.type === 'PAGE') await figma.setCurrentPageAsync(frame.parent);
  const items = [];
  for (const n of [...frame.children].sort((a, b) => a.y - b.y)) {
    const row = { id: n.id, name: n.name, type: n.type, visible: n.visible, y: Math.round(n.y) };
    if (n.type === 'INSTANCE') {
      const main = await n.getMainComponentAsync();
      row.mainId = main && main.id;
      row.mainName = main && main.name;
      row.setName = main && main.parent && main.parent.type === 'COMPONENT_SET' ? main.parent.name : (main && main.name);
      row.props = Object.fromEntries(Object.entries(n.componentProperties).filter(([, v]) => v.type === 'VARIANT').map(([k, v]) => [k, v.value]));
    }
    items.push(row);
  }
  out.frames[device] = { id, name: frame.name, width: Math.round(frame.width), items };
}
return out;`;

/** 테스트용: 조합 프레임 대신 컴포넌트 노드 목록을 "페이지"로 간주해요 (Page 18 원문 그대로 추출 검증) */
const SCAN_COMPONENTS = (lists) => `const LISTS = ${JSON.stringify(lists)};
const out = { frames: {} };
let switched = false;
for (const [device, ids] of Object.entries(LISTS)) {
  if (!ids || !ids.length) continue;
  const items = [];
  for (const id of ids) {
    const n = await figma.getNodeByIdAsync(id);
    if (!n) { items.push({ id, name: 'not found', type: 'NONE', visible: false }); continue; }
    if (!switched) { let p = n; while (p && p.type !== 'PAGE') p = p.parent; if (p) await figma.setCurrentPageAsync(p); switched = true; }
    const set = n.parent && n.parent.type === 'COMPONENT_SET' ? n.parent : null;
    items.push({ id: n.id, name: n.name, type: 'INSTANCE', visible: true, mainId: n.id, mainName: n.name, setName: set ? set.name : n.name,
      props: Object.fromEntries(n.name.split(',').map((kv) => kv.split('=').map((s) => s.trim())).filter((a) => a.length === 2)) });
  }
  out.frames[device] = { id: 'components', name: 'components-' + device, items };
}
return out;`;

/* ---------------------------------------------------------------- 2. resolve + extract */

function nodeIndex() {
  const idx = {};
  for (const v of reg.variants) {
    for (const d of ['pc', 'tb', 'mo']) if (v.figma?.[d]) idx[v.figma[d]] = { variant: v.id, options: [] };
    for (const [k, o] of Object.entries(v.options || {})) {
      for (const d of ['pc', 'tb', 'mo']) if (o.figma?.[d]) idx[o.figma[d]] = { variant: v.id, options: [k] };
    }
  }
  return idx;
}

/** 다른 파일·라이브러리 게시본에서 쓴 경우: 세트 이름 + variant 속성으로 매핑 */
function byName(row) {
  const sec = reg.sectionByKey[row.setName];
  if (!sec) return null;
  const p = row.props || {};
  const opts = [];
  let layout = p.layout || 'default';
  let style = p.style || null;
  if (/-compact$/.test(style || '')) { style = style.replace(/-compact$/, ''); opts.push('compact'); }
  else if (/-compact$/.test(layout) && !style) { layout = layout.replace(/-compact$/, ''); opts.push('compact'); }
  const id = [sec.key, layout, style].filter(Boolean).join('-');
  const v = reg.byId[id];
  if (!v) return null;
  if (p.mode && v.options?.[p.mode]) opts.push(p.mode);
  return { variant: id, options: opts.filter((o) => v.options?.[o]) };
}

/** 플러그인에 넣을 슬롯 스펙 — 라벨·설명은 빼고 매핑에 필요한 것만 */
function slimSpec(fields) {
  const out = {};
  for (const [k, raw] of Object.entries(fields || {})) {
    const s = specOf(raw);
    const o = { type: s.type };
    if (s.extract === false) { if (s.type === 'list') o.skip = true; out[k] = o; continue; }
    // 이름과 경로를 나눠요: "heading-mo/title" 같은 별칭은 경로로도, 이름 전체로도 봐요 (레이어 이름 자체에 / 가 있는 경우)
    const refs = [s.figmaLayer, ...(s.aliases || [])].filter(Boolean);
    const paths = [...[].concat(s.figmaPath || []), ...refs.filter((r) => r.includes('/') && !s.literalNames)];
    const ns = [...new Set([...refs, ...refs.map((r) => r.split('/').at(-1)), ...paths.map((p) => p.split('/').at(-1))])];
    if (s.split) o.split = true;
    if (ns.length) o.names = ns;
    if (paths.length) o.paths = paths;
    if (s.figmaProp) o.figmaProp = s.figmaProp;
    if (s.nth != null) o.nth = s.nth;
    if (s.scope) o.scope = { names: [].concat(s.scope.figmaLayer || []), nth: s.scope.nth || 0 };
    if (s.figmaLayer || s.figmaPath || (s.aliases || []).length) o.figmaLayer = true;
    if (s.type === 'list') o.item = slimSpec(s.item);
    out[k] = o;
  }
  return out;
}

const EXTRACT = (jobs, specs) => `const JOBS = ${JSON.stringify(jobs)};
const SPECS = ${JSON.stringify(specs)};
const LS = String.fromCharCode(8232);
const norm = (s) => s.split(LS).join('\\n').split('\\r\\n').join('\\n').split('\\r').join(' ');
const kids = (n) => ('children' in n ? n.children.filter((c) => c.visible) : []);
const names = (s) => s.names || [];
const clean = (t) => String(t).replace(/[\\u0000-\\u001f]/g, '').trim();
const nameOk = (ns, n) => ns.includes(clean(n.name)) || ns.includes('*');
// scope: 같은 이름 컨테이너 중 n번째 안에서만 찾아요 (예: 두 열이 모두 The-Problem)
function scoped(root, s) { if (!s.scope) return root; const c = findAll(root, (n) => s.scope.names.includes(clean(n.name)), true); return c[s.scope.nth] || null; }
function relPath(node, root) { const p = []; let x = node; while (x && x !== root) { p.unshift(x.name); x = x.parent; } return p.join('/'); }
// 경로 "a/b/c": 마지막 조각 = 노드 이름, 앞 조각들은 조상 이름에 순서대로 나타나면 돼요 (중간 프레임은 건너뜀)
function pathMatch(node, p) {
  const segs = p.split('/');
  const chain = []; let x = node; while (x && x !== TOP) { chain.unshift(clean(x.name)); x = x.parent; } chain.unshift(clean(TOP.name));
  if (segs.at(-1) !== '*' && chain.at(-1) !== segs.at(-1)) return false;
  let i = 0;
  for (const name of chain.slice(0, -1)) if (i < segs.length - 1 && name === segs[i]) i++;
  return i === segs.length - 1;
}
function findAll(root, pred, stop) { const out = []; (function walk(n) { for (const c of kids(n)) { if (pred(c)) { out.push(c); if (stop) continue; } walk(c); } })(root); return out; }
const hasImg = (n) => 'fills' in n && Array.isArray(n.fills) && n.fills.some((f) => f.type === 'IMAGE' && f.visible !== false);
const MAIN = new Map(); // 인스턴스 id → 메인 컴포넌트 이름 ("세트/variant" 또는 컴포넌트 이름)
async function loadMains(n) {
  const list = 'findAllWithCriteria' in n ? n.findAllWithCriteria({ types: ['INSTANCE'] }) : [];
  for (const i of list) {
    const m = await i.getMainComponentAsync();
    if (m) MAIN.set(i.id, m.parent && m.parent.type === 'COMPONENT_SET' ? m.parent.name + '/' + m.name : m.name);
  }
}
function prop(inst, key) {
  if (!inst || inst.type !== 'INSTANCE') return undefined;
  if (key === '$main') return MAIN.get(inst.id);
  const e = Object.entries(inst.componentProperties).find(([k]) => k.split('#')[0] === key);
  return e ? e[1].value : undefined;
}
function target(root, s, type) {
  root = scoped(root, s);
  if (!root) return null;
  const ns = names(s);
  if (!ns.length) return root;
  if (nameOk(ns, root) && !ns.includes('*') && root !== TOP && (!type || root.type === type)) return root;
  const pick = (pred) => {
    let c = findAll(root, pred);
    if (s.paths) c = c.filter((n) => s.paths.some((p) => pathMatch(n, p)));
    return (s.nth < 0 ? c[c.length + s.nth] : c[s.nth || 0]) || null;
  };
  // 같은 이름의 프레임과 텍스트가 함께 있으면(예: title 프레임 안의 title 텍스트) 원하는 타입을 먼저 찾아요
  return (type && pick((n) => n.type === type && nameOk(ns, n))) || (ns.includes('*') ? null : pick((n) => nameOk(ns, n)));
}
let TOP = null, OVR = [];
const overridden = (node, field) => OVR.some((o) => o.id === node.id && o.overriddenFields.includes(field));
function value(root, s) {
  if (s.type === 'list') {
    if (s.skip) return { $default: true };
    const ns = names(s);
    const base = scoped(root, s);
    if (!base) return [];
    // split: 텍스트 하나를 줄 단위로 나눠 목록으로 (예: 유의사항 • 줄 여러 개)
    if (s.split) {
      const t = target(base, s, 'TEXT');
      if (!t || t.type !== 'TEXT') return [];
      const key = Object.keys(s.item || { text: 1 })[0];
      return norm(t.characters).split('\\n').map((l) => l.replace(/^\\s*[•·・\\-]\\s*/, '').trim()).filter(Boolean).map((l) => ({ [key]: l }));
    }
    // 바깥 항목을 기본으로, 그 안에 같은 이름이 2개 이상이면(열 프레임 card 안의 카드 card) 안쪽으로 내려가요
    const isItem = (n) => ns.includes(clean(n.name));
    const collect = (r) => findAll(r, isItem, true).flatMap((n) => (findAll(n, isItem, true).length >= 2 ? collect(n) : [n]));
    let items = ns.length ? collect(base) : [];
    // 목록 경로는 항목 경로("a/item") 또는 컨테이너 경로("a") 둘 다 받아요
    const inPath = (n, p) => { if (pathMatch(n, p)) return true; const segs = p.split('/'); const chain = []; let x = n.parent; while (x && x !== TOP) { chain.unshift(clean(x.name)); x = x.parent; } let i = 0; for (const nm of chain) if (i < segs.length && nm === segs[i]) i++; return i === segs.length; };
    if (s.paths) items = items.filter((n) => s.paths.some((p) => inPath(n, p)));
    // 내용이 하나도 없는 항목(빈 그룹 등)은 건너뛰어요
    const filled = (o) => Object.values(o).some((v) => v != null && v !== '' && !(v && v.$default) && !(Array.isArray(v) && !v.length));
    return items.map((it) => fields(it, s.item || {})).filter(filled);
  }
  if (!s.figmaLayer && !s.figmaProp) return { $default: true };
  if (s.figmaProp) {
    const t = s.figmaLayer ? target(root, s, 'INSTANCE') : root;
    const v = prop(t && t.type === 'INSTANCE' ? t : (t && findAll(t, (n) => n.type === 'INSTANCE')[0]), s.figmaProp);
    return v === undefined ? null : (typeof v === 'string' ? norm(v) : v);
  }
  if (s.type === 'image') {
    // 디자이너가 이미지를 바꾼 경우(fills 덮어쓰기)만 새 이미지로 받고, 나머지는 sample 기본값(플레이스홀더 포함)
    const t = target(root, s);
    const img = t && (hasImg(t) ? t : findAll(t, hasImg)[0]);
    if (img && overridden(img, 'fills')) return { $image: img.id, w: Math.round(img.width), h: Math.round(img.height) };
    return { $default: true };
  }
  const t = target(root, s, 'TEXT');
  if (!t) return null;
  const txt = t.type === 'TEXT' ? t : findAll(t, (n) => n.type === 'TEXT')[0];
  return txt ? norm(txt.characters) : null;
}
function fields(root, spec) { const o = {}; for (const [k, s] of Object.entries(spec)) o[k] = value(root, s); return o; }
const EXPECT = typeof EXPECTED === 'undefined' ? null : EXPECTED;
const normT = (t) => String(t).split('\\n').map((l) => l.replace(/\\s+/g, ' ').trim()).filter(Boolean).join('\\n');
function hash(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }
// 슬롯 값을 비교용 문자열로 — 이미지·Figma 밖 값은 빼고, 텍스트는 공백·빈 줄 정리
function canon(sp, v) {
  if (v && v.$default) return '';
  if (sp.type === 'list') return '[' + (Array.isArray(v) ? v : []).map((it) => Object.entries(sp.item || {}).map(([k, f]) => canon(f, it && it[k])).join('¦')).join('‖') + ']';
  if (sp.type === 'image' || (!sp.figmaLayer && !sp.figmaProp) || v == null || (v && v.$default)) return '';
  return sp.type === 'enum' ? String(v) : normT(v);
}
const out = [];
for (const j of JOBS) {
  const n = await figma.getNodeByIdAsync(j.id);
  if (!n) { out.push({ ...j, error: 'not found' }); continue; }
  if (j.first) { let p = n; while (p && p.type !== 'PAGE') p = p.parent; if (p) await figma.setCurrentPageAsync(p); }
  TOP = n; OVR = n.type === 'INSTANCE' ? n.overrides : [];
  await loadMains(n);
  const content = fields(n, SPECS[j.variant]);
  if (EXPECT) {
    const want = EXPECT[j.frame + j.index];
    const bad = {};
    for (const [k, sp] of Object.entries(SPECS[j.variant])) if (hash(canon(sp, content[k])) !== want[k]) bad[k] = content[k];
    out.push({ frame: j.frame, index: j.index, variant: j.variant, options: j.options, bad });
  } else out.push({ frame: j.frame, index: j.index, variant: j.variant, options: j.options, content });
}
return out;`;

/* ---------------------------------------------------------------- 4. finalize */

function isText(s) { return s.type === 'text' || s.type === 'richtext'; }

function merge(spec, pc, mo, sample, where, warn) {
  const s = specOf(spec);
  if (pc && typeof pc === 'object' && pc.$default) return sample === undefined ? null : sample;
  if (s.type === 'list') {
    const a = Array.isArray(pc) ? pc : [];
    const b = Array.isArray(mo) ? mo : null;
    // 항목에 device 필드가 있으면 PC·MO 카드 구성이 달라도 돼요 → 같은 카드는 한 번, 한쪽에만 있는 카드는 device 표시
    if (b && s.item?.device) {
      const key = (it) => JSON.stringify(Object.entries(s.item).filter(([k, f]) => k !== 'device' && ['text', 'richtext'].includes(specOf(f).type)).map(([k]) => String(it?.[k] ?? '').replace(/\s+/g, '')));
      const used = new Set();
      const outList = [];
      a.forEach((it, i) => {
        const j = b.findIndex((x, jj) => !used.has(jj) && key(x) === key(it));
        if (j >= 0) used.add(j);
        outList.push({ pc: it, mo: j >= 0 ? b[j] : null, device: j >= 0 ? null : 'pc', si: i });
      });
      b.forEach((it, j) => { if (!used.has(j)) outList.push({ pc: it, mo: null, device: 'mo', si: j }); });
      return outList.map(({ pc: x, mo: y, device, si }) => {
        const o = {};
        for (const [k, f] of Object.entries(s.item)) {
          if (k === 'device') continue;
          const sv = Array.isArray(sample) ? (sample[si] ?? sample[0])?.[k] : undefined;
          o[k] = merge(f, x?.[k], y?.[k], sv, `${where}[${si}].${k}`, warn);
        }
        if (device) o.device = device;
        return prune(o);
      });
    }
    if (b && b.length !== a.length) warn.push(`${where}: PC ${a.length}개 / MO ${b.length}개 — PC 기준으로 병합했어요`);
    return a.map((item, i) => {
      const o = {};
      for (const [k, f] of Object.entries(s.item || {})) {
        const sv = Array.isArray(sample) ? (sample[i] ?? sample[0])?.[k] : undefined;
        o[k] = merge(f, item?.[k], b?.[i]?.[k], sv, `${where}[${i}].${k}`, warn);
      }
      return prune(o);
    });
  }
  if (s.type === 'image') {
    if (pc && pc.$image) return pc; // finalize 에서 경로로 바꿔요
    return pc ?? null;
  }
  if (isText(s)) {
    if (pc == null && mo == null) return null;
    if (mo == null || mo === pc) return pc;
    if (pc == null) return mo;
    const flat = (t) => t.replace(/\s+/g, ' ').trim();
    return flat(pc) === flat(mo) && !pc.includes('\n') && !mo.includes('\n') ? pc : { pc, mo };
  }
  if (s.type === 'enum') {
    const raw = pc ?? mo;
    if (raw == null) return sample ?? null;
    const hit = resolveEnum(s, raw);
    if (hit == null) { warn.push(`${where}: "${raw}" 를 ${JSON.stringify(s.values)} 중 하나로 맞추지 못해 sample 값을 썼어요`); return sample ?? null; }
    return hit;
  }
  return pc ?? mo ?? null;
}

/** enum 값 맞추기: map → 정확히 일치 → 메인 컴포넌트 이름 끝부분/포함 */
function resolveEnum(s, raw) {
  if (s.map && s.map[raw] != null) return s.map[raw];
  const values = s.values || [];
  if (!values.length || values.includes(raw)) return raw;
  if (typeof raw === 'boolean') return values.find((v) => String(v) === String(raw)) ?? null;
  const low = String(raw).toLowerCase();
  const last = low.split('/').at(-1).replace(/^[^=]*=/, '');
  const str = values.filter((v) => typeof v === 'string');
  return str.find((v) => v.toLowerCase() === last)
    ?? str.find((v) => low.endsWith(v.toLowerCase()))
    ?? str.find((v) => low.includes(v.toLowerCase()))
    ?? null;
}
const prune = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null));

function finalize(rawFile) {
  const name = nameOf(rawFile);
  // <name>.raw.json 하나 또는 조각 <name>.raw.1.json, .2.json … 을 순서대로 합쳐요
  const dir = path.dirname(rawFile);
  const parts = fs.existsSync(rawFile) ? [rawFile]
    : fs.readdirSync(dir).filter((f) => new RegExp(`^${name}\\.raw\\.\\d+\\.json$`).test(f)).sort((a, b) => Number(a.split('.').at(-2)) - Number(b.split('.').at(-2))).map((f) => path.join(dir, f));
  if (!parts.length) { console.error(`✗ ${rawFile} 또는 조각 파일이 없어요`); process.exit(1); }
  const jobs = parts.flatMap((f) => { const r = JSON.parse(fs.readFileSync(f, 'utf8')); return Array.isArray(r) ? r : r.result || r; })
    .sort((a, b) => (a.frame === b.frame ? a.index - b.index : a.frame === 'pc' ? -1 : 1));
  const scanFile = path.join(path.dirname(rawFile), `${name}.scan.json`);
  const scan = fs.existsSync(scanFile) ? JSON.parse(fs.readFileSync(scanFile, 'utf8')) : null;
  const pcs = jobs.filter((j) => j.frame === 'pc');
  const mos = jobs.filter((j) => j.frame === 'mo');
  const warn = [];
  const images = [];
  const sections = pcs.map((p, i) => {
    const m = mos[i];
    if (m && m.variant !== p.variant) warn.push(`섹션 ${i + 1}: PC ${p.variant} / MO ${m.variant} — 순서나 variant 가 달라요. PC 기준으로 만들었어요`);
    const v = reg.byId[p.variant];
    const pair = m && m.variant === p.variant && v.extractFrom !== 'pc' ? m : null;
    const content = {};
    for (const [k, spec] of Object.entries(v.slots)) {
      content[k] = merge(spec, p.content?.[k], pair?.content?.[k], v.sample?.[k], `${i + 1}.${p.variant}.${k}`, warn);
    }
    // 새 이미지 → 경로 배정
    (function walk(obj, trail) {
      for (const [k, val] of Object.entries(obj)) {
        if (val && typeof val === 'object' && val.$image) {
          const file = `${name}/images/${String(i + 1).padStart(2, '0')}-${[...trail, k].join('-')}.png`;
          images.push({ node: val.$image, file: `pages/${file}`, w: val.w, h: val.h });
          obj[k] = { src: file, alt: '' };
        } else if (Array.isArray(val)) val.forEach((it, j) => it && typeof it === 'object' && walk(it, [...trail, k, j]));
      }
    })(content, []);
    const options = [...new Set([...(p.options || []), ...(pair?.options || [])])];
    return { variant: p.variant, ...(options.length ? { options } : {}), content: prune(content) };
  });
  const page = {
    title: scan?.frames?.pc?.name || name,
    theme: 'light',
    source: { fileKey: reg.catalog.figma.fileKey, pc: scan?.frames?.pc?.id, mo: scan?.frames?.mo?.id },
    sections,
  };
  const pageFile = path.join(ROOT, 'pages', `${name}.page.json`);
  fs.writeFileSync(pageFile, JSON.stringify(page, null, 2) + '\n');
  fs.writeFileSync(path.join(ROOT, 'pages', `${name}.images.json`), JSON.stringify(images, null, 2) + '\n');
  console.log(`✓ ${path.relative(ROOT, pageFile)} (섹션 ${sections.length}개)`);
  if (images.length) console.log(`• 새 이미지 ${images.length}개 → pages/${name}.images.json (get_screenshot 으로 받아 file 경로에 저장)`);
  warn.forEach((w) => console.log(`! ${w}`));
}

/* ---------------------------------------------------------------- main */

if (cmd === 'scan-components') {
  // scan-components pc=6187:2503,6187:2542 mo=6187:2521,6187:2562   ("all" = 레지스트리의 모든 variant 기본 노드)
  const lists = { pc: [], mo: [] };
  if (rest[0] === 'all') {
    for (const v of reg.variants) {
      if (v.figma?.pc) lists.pc.push(v.figma.pc);
      if (v.figma?.pc && v.figma?.mo) lists.mo.push(v.figma.mo);
      else if (v.figma?.pc) lists.mo.push(v.figma.pc); // MO 가 없는 variant 는 PC 노드로 짝을 맞춰요
      for (const o of Object.values(v.options || {})) {  // 옵션(compact, dark …)도 한 섹션씩
        const pc = o.figma?.pc || v.figma?.pc;
        const mo = o.figma?.mo || v.figma?.mo || pc;
        if (pc && mo) { lists.pc.push(pc); lists.mo.push(mo); }
      }
    }
  } else {
    for (const a of rest.filter((x) => x.includes('='))) { const [d, ids] = a.split('='); lists[d] = ids.split(',').map((x) => x.replace('-', ':')); }
  }
  const w = process.argv.indexOf('--write');
  if (w > 0) {
    // 컴포넌트 노드는 자기 자신이 메인 컴포넌트라 Figma 스캔 없이 scan.json 을 만들 수 있어요 (노드 존재는 extract 단계가 확인)
    const frames = {};
    for (const [d, ids] of Object.entries(lists)) {
      frames[d] = { id: 'components', name: `components-${d}`, items: ids.map((id) => ({ id, name: id, type: 'INSTANCE', visible: true, mainId: id })) };
    }
    fs.writeFileSync(process.argv[w + 1], JSON.stringify({ frames }, null, 2) + '\n');
    console.log(`✓ ${process.argv[w + 1]} (PC ${lists.pc.length} / MO ${lists.mo.length})`);
  } else process.stdout.write(SCAN_COMPONENTS(lists) + '\n');
} else if (cmd === 'scan') {
  const [pc, mo] = rest;
  if (!pc) { console.error('사용법: scan <pcFrameId> [moFrameId]'); process.exit(1); }
  process.stdout.write(SCAN({ pc: pc.replace('-', ':'), mo: mo ? mo.replace('-', ':') : null }) + '\n');
} else if (cmd === 'extract') {
  const file = rest[0];
  const name = nameOf(file);
  const scan = JSON.parse(fs.readFileSync(file, 'utf8'));
  const idx = nodeIndex();
  const jobs = [];
  const problems = [];
  let first = true;
  for (const device of ['pc', 'mo']) {
    const f = scan.frames?.[device];
    if (!f) continue;
    if (f.error) { problems.push(`${device}: ${f.error}`); continue; }
    f.items.forEach((row, i) => {
      if (!row.visible) return;
      if (row.type !== 'INSTANCE') { problems.push(`${device} #${i + 1} "${row.name}" (${row.type}) — 인스턴스가 아니에요 (분리했거나 직접 그린 레이어)`); return; }
      const hit = idx[row.mainId] || byName(row);
      if (!hit) { problems.push(`${device} #${i + 1} "${row.name}" — ${row.setName} ${JSON.stringify(row.props)} 에 맞는 코드 variant 가 없어요 (main ${row.mainId})`); return; }
      jobs.push({ frame: device, index: i, id: row.id, variant: hit.variant, options: hit.options, first });
      first = false;
    });
  }
  if (problems.length) { console.error('✗ 매핑할 수 없는 섹션\n' + problems.map((p) => '  - ' + p).join('\n')); }
  // --only a,b: 지정한 variant 만 (재검증용)
  const oi = process.argv.indexOf('--only');
  if (oi > 0) { const keep = new Set(process.argv[oi + 1].split(',')); for (let i = jobs.length - 1; i >= 0; i--) if (!keep.has(jobs[i].variant)) jobs.splice(i, 1); }
  // --chunks N: 섹션 순번 기준으로 N개로 나눠요 (결과 JSON 이 클 때). 각 조각 결과는 pages/<name>.raw.<k>.json
  const ci = process.argv.indexOf('--chunks');
  const n = ci > 0 ? Math.max(1, Number(process.argv[ci + 1])) : 1;
  const maxIndex = Math.max(0, ...jobs.map((j) => j.index)) + 1;
  const per = Math.ceil(maxIndex / n);
  fs.mkdirSync(path.join(ROOT, 'dist/extract'), { recursive: true });
  for (let k = 0; k < n; k++) {
    const part = jobs.filter((j) => Math.floor(j.index / per) === k).map((j, i) => ({ ...j, first: i === 0 }));
    if (!part.length) continue;
    const specs = Object.fromEntries([...new Set(part.map((j) => j.variant))].map((id) => [id, slimSpec(reg.byId[id].slots)]));
    const suffix = n > 1 ? `.${k + 1}` : '';
    const out = path.join(ROOT, 'dist/extract', `${name}${suffix}.js`);
    let code = EXTRACT(part, specs);
    if (process.argv.includes('--verify')) {
      // 검증 모드: 기기별로 펼친 sample 을 넣어 두고, 플러그인이 다른 곳만 돌려줘요
      const project = (v, d) => {
        if (Array.isArray(v)) return v.filter((x) => !(x && typeof x === 'object' && (x.device === 'pc' || x.device === 'mo') && x.device !== d)).map((x) => project(x, d));
        if (v && typeof v === 'object') {
          const keys = Object.keys(v);
          if (keys.length && keys.every((k) => k === 'pc' || k === 'mo')) return v[d] ?? v.pc ?? v.mo;
          return Object.fromEntries(keys.map((k) => [k, project(v[k], d)]));
        }
        return v;
      };
      const fnv = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };
      const normT = (t) => String(t).split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
      const canon = (sp, v) => {
        if (sp.skip) return '';
        if (sp.type === 'list') return '[' + (Array.isArray(v) ? v : []).map((it) => Object.entries(sp.item || {}).map(([k, f]) => canon(f, it?.[k])).join('¦')).join('‖') + ']';
        if (sp.type === 'image' || (!sp.figmaLayer && !sp.figmaProp) || v == null) return '';
        return sp.type === 'enum' ? String(v) : normT(v);
      };
      const expected = Object.fromEntries(part.map((j) => {
        const v = reg.byId[j.variant]; const smp = project(v.sample, j.frame); const sl = specs[j.variant];
        return [j.frame + j.index, Object.fromEntries(Object.entries(sl).map(([k, sp]) => [k, fnv(canon(sp, smp?.[k]))]))];
      }));
      code = `const EXPECTED = ${JSON.stringify(expected)};\n` + code;
    }
    fs.writeFileSync(out, code);
    console.log(`✓ ${path.relative(ROOT, out)} (${part.length}개 인스턴스, ${code.length.toLocaleString()}자) → 결과를 pages/${name}.raw${suffix}.json 에 저장`);
    if (code.length > 50000) console.error(`! ${path.basename(out)} 가 50,000자를 넘어요 — --chunks 를 늘리세요`);
  }
  jobs.forEach((j) => console.log(`  ${j.frame} #${j.index + 1} → ${j.variant}${j.options.length ? ' +' + j.options.join(',') : ''}`));
  if (problems.length) process.exit(2);
} else if (cmd === 'report') {
  // report pages/<name>.verify.*.json — 슬롯 해시가 다른 곳만 자세히 비교 (enum 은 느슨한 매칭으로 다시 판정)
  const rows = rest.filter((f) => f.endsWith('.json')).flatMap((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
  const pick = (v, d) => (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length && Object.keys(v).every((k) => k === 'pc' || k === 'mo') ? v[d] ?? v.pc ?? v.mo : v);
  const nt = (t) => String(t ?? '').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
  function diff(raw, got, want, d, p, out) {
    const sp = specOf(raw);
    if ((got && got.$default) || sp.extract === false) return;
    want = pick(want, d);
    if (sp.type === 'list') {
      const filled = (o) => o && Object.values(o).some((v) => v != null && v !== '' && !(v && v.$default) && !(Array.isArray(v) && !v.length));
      let g = Array.isArray(got) ? got.filter(filled) : [];
      // MO 순서만 다른 경우: 같은 항목 집합이면 sample 순서로 맞춰 비교해요
      if (d === 'mo' && Array.isArray(want)) {
        const key = (o) => JSON.stringify(Object.keys(sp.item || {}).map((k) => nt(pick(o?.[k], d) && typeof pick(o?.[k], d) === 'string' ? pick(o?.[k], d) : '')));
        const wk = want.map(key), gk = g.map(key);
        if (wk.length === gk.length && wk.join() !== gk.join() && [...wk].sort().join() === [...gk].sort().join()) { notes.push(`${p}: MO 순서가 PC와 달라요 (PC 순서 사용)`); g = wk.map((k) => g[gk.indexOf(k)]); }
      }
      let w = Array.isArray(want) ? want : [];
      if (sp.item?.device) w = w.filter((x) => !x?.device || x.device === d);
      // MO·옵션이 앞쪽 일부만 보여주는 경우(카드 9장 중 4장)는 정상으로 봐요
      if (g.length !== w.length && !(g.length < w.length && (d === 'mo' || optsOn))) out.push(`${p}: Figma ${g.length}개 | sample ${w.length}개`);
      for (let i = 0; i < Math.min(g.length, w.length); i++) for (const [k, f] of Object.entries(sp.item || {})) diff(f, g[i]?.[k], w[i]?.[k], d, `${p}[${i}].${k}`, out);
      return;
    }
    const mapped = sp.figmaLayer || sp.figmaProp || sp.figmaPath || (sp.aliases || []).length;
    if (sp.type === 'image' || !mapped || (got && got.$default)) return;
    if (sp.type === 'enum') { if (got == null && want == null) return; if (resolveEnum(sp, got) !== want) out.push(`${p}: Figma ${JSON.stringify(got)} → ${JSON.stringify(resolveEnum(sp, got))} | sample ${JSON.stringify(want)}`); return; }
    if (got == null && want != null && d === 'mo') { notes.push(`${p}: MO 프레임에 없음 (PC 값 사용)`); return; }
    if (nt(String(got ?? '').replace(/\r\n/g, '\n').replace(/\r/g, ' ')) !== nt(want)) out.push(`${p}: Figma ${JSON.stringify(got ?? null).slice(0, 70)} | sample ${JSON.stringify(want ?? null).slice(0, 70)}`);
  }
  let ok = 0, bad = 0; const lines = []; let optsOn = false; let notes = [];
  for (const r of rows.sort((a, b) => a.index - b.index || (a.frame < b.frame ? -1 : 1))) {
    const v = reg.byId[r.variant];
    const out = [];
    optsOn = !!r.options?.length; notes = [];
    if (r.frame === 'mo' && v.extractFrom === 'pc') { ok++; lines.push(`✓ MO ${r.variant}${optsOn ? ' +' + r.options.join(',') : ''}  △ MO는 추출하지 않음 (PC 값 사용 — Figma MO 레이어 정리 필요)`); continue; }
    for (const [k, got] of Object.entries(r.bad || {})) diff(v.slots[k], got, v.sample?.[k], r.frame, k, out);
    const label = `${r.frame.toUpperCase()} ${r.variant}${r.options?.length ? ' +' + r.options.join(',') : ''}`;
    const skipped = Object.entries(v.slots).filter(([, f]) => specOf(f).extract === false).map(([k]) => k);
    const extra = [...notes, ...(skipped.length ? [`추출 안 함(sample 유지): ${skipped.join(', ')}`] : [])];
    if (!out.length) { ok++; lines.push(`✓ ${label}${extra.length ? '  △ ' + extra.join(' / ') : ''}`); continue; }
    bad++; lines.push(`✗ ${label} — ${out.length}건`); out.slice(0, 8).forEach((l) => lines.push('    ' + l)); if (out.length > 8) lines.push(`    … ${out.length - 8}건 더`);
  }
  console.log(lines.join('\n')); console.log(`\n일치 ${ok} / 차이 ${bad} (총 ${rows.length})`);
} else if (cmd === 'finalize') {
  finalize(rest[0]);
} else {
  console.error('사용법: scan <pc> [mo] | extract <name.scan.json> | finalize <name.raw.json>');
  process.exit(1);
}
