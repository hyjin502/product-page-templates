/* 상품페이지 템플릿 → Figma (플러그인 본체)
   이 파일은 scripts/figma-plugin.mjs 가 DATA(섹션 스펙·컴포넌트 키·HDS 색)와 합쳐 figma-plugin/code.js 로 만들어요.
   직접 고치지 말고 이 파일(src/main.js)을 고친 뒤 npm run build 하세요.

   흐름: 조합기 「Figma용으로 받기」 파일(또는 page.json) → UI 가 이미지를 모아 보냄 → 섹션마다
     1) 원본 컴포넌트 인스턴스 만들기 (같은 파일이면 노드 ID, 아니면 라이브러리 key)
     2) plan(): 슬롯 값 → 바꿀 목록(ops) — 레이어 찾기는 figma-extract 와 같은 규칙(이름·경로·nth·scope)
     3) run(): ops 적용 (글꼴 불러오기 → 문구, 버튼 속성, 색·라인·모서리, 이미지) */

const LS = String.fromCharCode(8232);
const norm = (s) => String(s).split(LS).join('\n').split('\r\n').join('\n').split('\r').join(' ');
const clean = (t) => String(t).replace(/[\u0000-\u001f]/g, '').trim();
const names = (s) => s.names || [];
const nameOk = (ns, n) => ns.includes(clean(n.name)) || ns.includes('*');
let TOP = null;
let ALL = false; // true 면 숨긴 레이어도 찾아요 (목록 항목 다시 보이기)
const kids = (n) => ('children' in n ? n.children.filter((c) => ALL || c.visible) : []);
function findAll(root, pred, stop) { const out = []; (function walk(n) { for (const c of kids(n)) { if (pred(c)) { out.push(c); if (stop) continue; } walk(c); } })(root); return out; }
function scoped(root, s) { if (!s.scope) return root; const c = findAll(root, (n) => s.scope.names.includes(clean(n.name)), true); return c[s.scope.nth] || null; }
function pathMatch(node, p) {
  const segs = p.split('/');
  const chain = []; let x = node; while (x && x !== TOP) { chain.unshift(clean(x.name)); x = x.parent; } chain.unshift(clean(TOP.name));
  if (segs[segs.length - 1] !== '*' && chain[chain.length - 1] !== segs[segs.length - 1]) return false;
  let i = 0;
  for (const name of chain.slice(0, -1)) if (i < segs.length - 1 && name === segs[i]) i++;
  return i === segs.length - 1;
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
  return (type && pick((n) => n.type === type && nameOk(ns, n))) || (ns.includes('*') ? null : pick((n) => nameOk(ns, n)));
}
function listItems(root, s) {
  const ns = names(s);
  const base = scoped(root, s);
  if (!base || !ns.length) return [];
  const isItem = (n) => ns.includes(clean(n.name));
  const collect = (r) => findAll(r, isItem, true).flatMap((n) => (findAll(n, isItem, true).length >= 2 ? collect(n) : [n]));
  let items = collect(base);
  const inPath = (n, p) => { if (pathMatch(n, p)) return true; const segs = p.split('/'); const chain = []; let x = n.parent; while (x && x !== TOP) { chain.unshift(clean(x.name)); x = x.parent; } let i = 0; for (const nm of chain) if (i < segs.length && nm === segs[i]) i++; return i === segs.length; };
  if (s.paths) items = items.filter((n) => s.paths.some((p) => inPath(n, p)));
  return items;
}
const hasImg = (n) => 'fills' in n && Array.isArray(n.fills) && n.fills.some((f) => (f.type === 'IMAGE' || f.type === 'VIDEO') && f.visible !== false);
/** 사진 채우기 위에 겹친 그라데이션 채우기들(= 그늘) — 없으면 null */
function overlayOf(x) {
  const f = 'fills' in x && Array.isArray(x.fills) ? x.fills : null;
  if (!f) return null;
  let li = -1;
  f.forEach((p, i) => { if (p.visible !== false && (p.type === 'IMAGE' || p.type === 'VIDEO')) li = i; });
  if (li < 0) return null;
  const top = f.slice(li + 1).filter((p) => p.visible !== false && /^GRADIENT/.test(p.type));
  return top.length ? top : null;
}
/** 채우기를 꺼 둔 이미지 자리도 (Figma 에서 사진 채우기 눈을 끈 곳 — 월간휴넷 아젠다 MO 세션 2) */
const hasImgAny = (n) => 'fills' in n && Array.isArray(n.fills) && n.fills.some((f) => f.type === 'IMAGE' || f.type === 'VIDEO');
const textOf = (n) => (n && n.type === 'TEXT' ? n : n && findAll(n, (x) => x.type === 'TEXT')[0]) || null;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ---------- HDS 값 */
const HDS = DATA.hds;
const colorOf = (key) => { const k = HDS.aliases[key] || key; return HDS.colors.find((c) => c.key === k) || null; };
const lineOf = (key) => HDS.line.find((c) => c.key === key) || null;
const textColorOf = (key) => HDS.text.find((c) => c.key === key) || null;
const radiusOf = (key) => { const r = HDS.radius.find((x) => x.key === key); return r ? r.px : null; };
function paint(css) {
  if (!css || css === 'transparent' || css === 'inherit') return null;
  let m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(css);
  if (m) { const n = parseInt(m[1], 16); return { type: 'SOLID', color: { r: (n >> 16 & 255) / 255, g: (n >> 8 & 255) / 255, b: (n & 255) / 255 }, opacity: m[2] ? parseInt(m[2], 16) / 255 : 1 }; }
  m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)$/i.exec(css);
  if (m) return { type: 'SOLID', color: { r: m[1] / 255, g: m[2] / 255, b: m[3] / 255 }, opacity: m[4] == null ? 1 : +m[4] };
  return null;
}

/* 색·모서리 슬롯이 꾸미는 레이어 — 문구 슬롯을 기준으로 찾아요 (hero 공통 이름) */
const DECOR = {
  titleColor: { slot: 'title', what: 'textColor' },
  descColor: { slot: 'description', what: 'textColor' },
  badgeColor: { slot: 'eyebrow', what: 'boxColor' },
  badgeLine: { slot: 'eyebrow', what: 'boxLine' },
  badgeRadius: { slot: 'eyebrow', what: 'boxRadius' },
};
/** 뱃지 상자 = 뱃지 글자를 감싼 가장 가까운 프레임 (섹션 맨 위는 아님) */
function boxOf(t) { let x = t && t.parent; while (x && x !== TOP && !(x.type === 'FRAME' || x.type === 'INSTANCE' || x.type === 'COMPONENT')) x = x.parent; return x && x !== TOP ? x : null; }

/* ---------- 미디어 값 → 이미지 이름 */
function mediaSrc(val, dev) {
  if (!val) return null;
  if (val.src != null && val.kind == null) return { kind: 'image', src: val.src }; // image 슬롯 { src, alt }
  const ref = (dev === 'mo' && val.mo) || val.pc || val.mo;
  if (!ref) return null;
  if (ref.kind === 'css') return { kind: 'image', src: 'assets/hero/bgfx/' + ref.preset + '.jpg', css: ref.preset };
  if (ref.kind === 'video') return ref.poster ? { kind: 'image', src: ref.poster } : { kind: 'video', src: ref.src };
  return ref.src ? { kind: 'image', src: ref.src } : null;
}
/** UI 가 받아 와야 할 이미지 목록 (UI 가 묻고 본체가 답해요) */
function neededImages(page, devices) {
  const out = new Set();
  for (const sec of page.sections || []) {
    const v = DATA.variants[sec.variant];
    if (!v) continue;
    const walk = (spec, kinds, content, sample) => {
      for (const [k, s] of Object.entries(spec)) {
        const kind = kinds[k] || {};
        const val = content && content[k];
        if (kind.type === 'list' && Array.isArray(val)) val.forEach((it, i) => walk(s.item || {}, kind.item || {}, it, sample && sample[k] && sample[k][i]));
        if ((kind.type === 'media' || kind.type === 'image') && val && (s.fig || !same(val, sample && sample[k]))) {
          for (const d of devices) { const m = mediaSrc(val, d); if (m) out.add(m.src); }
        }
      }
    };
    walk(v.spec, v.kinds, sec.content || {}, v.sample);
  }
  return [...out];
}

/* ---------- fig: 자리로 찾기 — 레이어 이름이 문구라서 바뀌는 페이지 템플릿(월간휴넷)용. meta 슬롯의 "fig"
   at: 이 이름의 레이어 안에서(atNth 번째) · layer: 이 이름의 레이어(nth 번째) · text: 그 안 n 번째 글자 레이어(기본 0)
   like: 이름이 이 글자로 시작하는 글자 레이어만 · first: 그 안 첫 번째로 보이는 레이어 · lines: 줄마다 글자 레이어 하나씩(남는 레이어는 숨김) · self: 목록 항목 자신이 글자 레이어
   items: 이 이름 레이어의 바로 아래 자식 = 목록 항목("." = 섹션 자신 · itemsNth · from: 앞에서 n 개 건너뜀 · deep: 손자 · item: 그중 이 이름만 · reverse: 거꾸로 · tail: 뒤쪽 값부터) · img: n 번째 이미지(-1 = 마지막, 위에 그려진 것) · row: [칸 이름들] 사진 줄을 오른쪽부터 채움 · fill: 그 레이어 자체를 이미지로 채움(안은 숨김)
   append: { size, style, lh, gap } — 칸이 없는 문구를 마지막 글자 레이어 뒤 새 문단으로 · bg · paint · tint · map: 색 슬롯(figColor) · accent: **굵게** 칠할 색을 이 칸 값으로 · format: "{live} ({channel})" · "{headingMo|heading}"(앞이 비면 뒤) · pc / mo: 기기마다 덮어쓰기 · skip: 그 기기엔 없음 */
const figOf = (s, dev) => { const f = Object.assign({}, s.fig, s.fig[dev] || {}); return f.skip ? null : f; };
/** 보이는 것 먼저, 없으면 숨긴 것까지 */
function findSome(root, pred) { let r = findAll(root, pred); if (!r.length) { ALL = true; r = findAll(root, pred); ALL = false; } return r; }
/** want: 'text' | 'img' — 같은 이름이 여럿이면 그걸 가진 레이어만 봐요(그림 묶음 안의 같은 이름 프레임 건너뛰기) */
function figBase(node, f, want) {
  const has = (n) => !want || (want === 'text' ? n.type === 'TEXT' || findSome(n, (x) => x.type === 'TEXT').length : hasImgAny(n) || findSome(n, hasImgAny).length);
  let base = node;
  if (f.at) base = findSome(node, (n) => clean(n.name) === f.at && has(n))[f.atNth || 0] || null;
  if (base && f.layer) base = findSome(base, (n) => clean(n.name) === f.layer && has(n))[f.nth || 0] || null;
  if (base && f.first) base = kids(base)[0] || null;
  return base;
}
const pickDev = (val, dev) => (val && typeof val === 'object' && !Array.isArray(val) ? (dev === 'mo' ? (val.mo ?? val.pc) : (val.pc ?? val.mo)) : val);
/** 「**굵게**」 표시를 빼고 그 자리(강조 색 칠할 곳)를 기억해요 */
function rich(str) {
  const marks = []; let out = '';
  String(str).split('**').forEach((part, i) => { if (i % 2 && part) marks.push([out.length, out.length + part.length]); out += part; });
  return { value: norm(out), marks };
}
function figText(node, s, kind, val, content, dev, has, diff, label, ops, warn) {
  const f = figOf(s, dev);
  if (!f) return;
  const base = figBase(node, f, 'text');
  if (!base) { if (has && diff) warn(label + ': 레이어를 못 찾았어요'); return; }
  let str = pickDev(val, dev);
  if (f.format) str = f.format.replace(/\{([\w|]+)\}/g, (_, ks) => ks.split('|').map((k) => pickDev(content[k], dev)).find((x) => x != null && x !== '') || '').replace(/\s*\(\s*\)/g, '').replace(/\*\*\s*\*\*/g, '').trim(); // {a|b} = a, 비면 b · 빈 「**…**」·「()」는 지워요
  const ts = f.self ? (base.type === 'TEXT' ? [base] : []) : (base.type === 'TEXT' ? [base] : findSome(base, (n) => n.type === 'TEXT' && (!f.like || clean(n.name).startsWith(f.like))));
  if (f.lines) {
    if (!ts.length) { if (diff) warn(label + ': 글자 레이어를 못 찾았어요'); return; }
    const lines = str == null ? [] : String(str).split('\n');
    ts.forEach((t, i) => {
      if (i >= lines.length) { ops.push({ op: 'hide', node: t }); return; }
      const line = i === ts.length - 1 ? lines.slice(i).join('\n') : lines[i]; // 레이어보다 줄이 많으면 마지막 레이어에 이어요
      ops.push({ op: 'show', node: t }, Object.assign({ op: 'text', node: t }, rich(line)));
    });
    return;
  }
  if (f.append) { // append: Figma 에 칸이 없는 문구를 이 묶음의 마지막 글자 레이어 뒤에 새 문단으로(히어로 하단 문구)
    const last = ts[ts.length - 1];
    if (!last) { if (has && diff) warn(label + ': 붙일 글자 레이어를 못 찾았어요'); return; }
    if (str != null && str !== '') ops.push(Object.assign({ op: 'appendText', node: last, value: rich(str).value }, f.append));
    return;
  }
  const t = ts[f.text || 0];
  if (!t) { if (has && diff) warn(label + ': 글자 레이어를 못 찾았어요'); return; }
  if (str == null || str === '') { if (kind.optional) ops.push({ op: 'hide', node: t }); return; }
  ops.push({ op: 'show', node: t }, Object.assign({ op: 'text', node: t, accent: f.accent ? bgCss(pickDev(content[f.accent], dev) || '') : null }, rich(str)));
}
function figMedia(node, s, val, dev, label, ops, warn, content, key) {
  const f = figOf(s, dev);
  if (!f) return;
  const m = mediaSrc(val, dev);
  if (!m) return;
  let base;
  if (f.row) { // row: 이 이름 레이어 줄(숨긴 것 포함)을 오른쪽부터 채워요 — 사진이 있는 칸 수만큼, 남는 왼쪽 칸은 숨김(히어로 연사 1~3)
    ALL = true; const L = findAll(node, (n) => clean(n.name) === f.layer); ALL = false;
    const present = f.row.filter((k) => mediaSrc(content[k], dev));
    const start = Math.max(0, L.length - present.length);
    L.forEach((n, i) => ops.push({ op: i < start ? 'hide' : 'show', node: n }));
    base = L[start + present.indexOf(key)] || null;
  } else base = figBase(node, f, f.fill ? null : 'img');
  if (!base) { warn(label + ': 이미지 레이어를 못 찾았어요'); return; }
  let img = base;
  if (!f.fill) { let all = findSome(base, hasImg); if (!all.length) all = findSome(base, hasImgAny); img = hasImgAny(base) && !f.img ? base : all[(f.img || 0) < 0 ? all.length + f.img : f.img || 0] || null; }
  if (!img) { warn(label + ': 이미지 레이어를 못 찾았어요'); return; }
  if (!img.visible) ops.push({ op: 'show', node: img });
  if (f.fill && 'children' in img) for (const c of img.children) {
    // 사진 위에 겹친 그라데이션(그늘)만 남겨요 — 그 레이어는 그라데이션만, 그걸 감싼 묶음은 바탕 없이, 나머지는 숨김 (히어로 비주얼 아래 그늘)
    if (!c.visible) continue;
    const all = [c].concat('findAll' in c ? c.findAll((x) => x.visible) : []);
    const keep = all.filter((x) => overlayOf(x));
    if (!keep.length) { ops.push({ op: 'hide', node: c }); continue; }
    const holds = (x) => keep.some((k) => { let y = k; while (y) { if (y === x) return true; y = y.parent; } return false; });
    for (const x of all) {
      if (overlayOf(x)) ops.push({ op: 'setFills', node: x, paints: overlayOf(x) });
      else if (holds(x)) { if ('fills' in x) ops.push({ op: 'setFills', node: x, paints: [] }); }
      else if (x.parent && holds(x.parent)) ops.push({ op: 'hide', node: x });
    }
  }
  ops.push({ op: m.kind === 'video' ? 'video' : 'image', node: img, src: m.src, css: m.css });
}
/** 아이콘 모양 enum — sets: { "check-circle": "<HDS 세트 key>" }, 값 "<세트>-solid|line" · 기본값이면 Figma 원본 그대로 */
function figIcon(node, s, kind, val, dev, label, ops, warn) {
  const f = figOf(s, dev);
  if (!f || !val || val === kind.default) return;
  const m = /^(.*)-(solid|line)$/.exec(val);
  if (!m || !f.sets[m[1]]) return;
  const box = f.at || f.layer ? figBase(node, f) : node;
  if (!box) { warn(label + ': 아이콘 자리를 못 찾았어요'); return; }
  ops.push({ op: 'swap', node: box, set: f.sets[m[1]], style: m[2] === 'line' ? 'line' : 'solid' });
}
/** 색 값 → css (#hex 그대로 · HDS bg · 글자색 · 버튼 팔레트 키) */
const bgCss = (val) => (/^#/.test(val) ? val : ((HDS.bg || []).find((c) => c.key === val) || {}).value || (textColorOf(val) || {}).value || (colorOf(val) || {}).hex || null);
/** 색 슬롯 — bg: 섹션(또는 at) 바탕 + tint: 이 레이어의 자식들을 흰 바탕으로(바탕이 흰색이 아닐 때 — 사이트와 같게)
   paint: "text" | "vector" | "fill" — 그 레이어의 글자색 · 아이콘 선 · 채우기. all: 안의 것 모두(name: 이 이름만 · parent: 부모 이름이 이것만)
   map: enum 값 → 색 ({ "white": "#ffffff" }) · 값이 비면(기본) Figma 원본 그대로 */
function figColor(node, s, kind, val, dev, label, ops, warn) {
  const f = figOf(s, dev);
  if (f && f.bg && (val == null || val === '')) val = kind.default; // 바탕은 기본값도 넘겨요(사이트 기본 배경이 Figma 원본과 다를 수 있어서)
  if (!f || val == null || val === '') return;
  const css = f.map ? f.map[val] : bgCss(val);
  if (!css) return;
  const base = f.at || f.layer ? figBase(node, f) : node;
  if (!base) { warn(label + ': 색을 칠할 레이어를 못 찾았어요'); return; }
  if (f.bg) {
    ops.push({ op: 'fill', node: base, css });
    if (f.tint && !/^#ffffff(ff)?$/i.test(css)) { const box = figBase(node, { at: f.tint }); if (box && 'children' in box) for (const c of box.children) ops.push({ op: 'fill', node: c, css: '#ffffff' }); }
    return;
  }
  const ok = (n) => (!f.name || clean(n.name) === f.name) && (!f.parent || (n.parent && clean(n.parent.name) === f.parent));
  if (f.paint === 'fill') { ops.push({ op: 'fill', node: base, css }); return; }
  if (f.paint === 'vector') { ops.push({ op: 'vectorsFill', node: base, css }); return; }
  const ts = base.type === 'TEXT' ? [base] : findSome(base, (n) => n.type === 'TEXT' && ok(n));
  for (const t of f.all ? ts : ts.slice(f.text || 0, (f.text || 0) + 1)) ops.push({ op: 'textFill', node: t, css });
}

/* ---------- plan: 슬롯 값 → 바꿀 목록 */
function plan(root, v, content, dev, warn) {
  TOP = root;
  const ops = [];
  const fill = (spec, kinds, node, content, sample, where) => {
    for (const [k, s] of Object.entries(spec)) {
      const kind = kinds[k] || {};
      const has = Object.prototype.hasOwnProperty.call(content, k);
      const val = content[k];
      const label = where + k;
      const diff = !same(val, sample && sample[k]); // 샘플 그대로면 Figma 원본이 이미 맞아요 → 못 찾아도 알리지 않아요
      if (DECOR[k] && !s.fig) {
        if (val == null || val === '' || val === kind.default) continue;
        const d = DECOR[k];
        const base = target(node, spec[d.slot] || { names: [d.slot] }, 'TEXT');
        const t = textOf(base);
        if (!t) { warn(label + ': 기준 레이어(' + d.slot + ')를 못 찾았어요'); continue; }
        if (d.what === 'textColor') { const c = textColorOf(val); if (c) ops.push({ op: 'textFill', node: t, css: c.value }); continue; }
        const box = boxOf(t);
        if (!box) { warn(label + ': 뱃지 상자를 못 찾았어요'); continue; }
        if (d.what === 'boxColor') { const c = colorOf(val); if (c) ops.push({ op: 'fill', node: box, css: c.hex }, ...(c.on !== 'inherit' ? [{ op: 'textFill', node: t, css: c.on }] : [])); }
        if (d.what === 'boxLine') ops.push({ op: 'stroke', node: box, css: val === kind.noneValue ? null : (lineOf(val) || {}).value });
        if (d.what === 'boxRadius') { const px = radiusOf(val); if (px != null) ops.push({ op: 'radius', node: box, px }); }
        continue;
      }
      if (s.fig) { // 자리로 찾기
        if (kind.type === 'text' || kind.type === 'richtext') figText(node, s, kind, val, content, dev, has, diff, label, ops, warn);
        else if ((kind.type === 'media' || kind.type === 'image') && has && val) figMedia(node, s, val, dev, label, ops, warn, content, k); // 페이지 템플릿은 샘플 사진이 Figma 원본과 달라서 늘 넣어요
        else if (kind.type === 'enum' && s.fig.sets) figIcon(node, s, kind, val, dev, label, ops, warn);
        else if ((kind.type === 'color' || kind.type === 'enum') && (s.fig.bg || s.fig.paint)) figColor(node, s, kind, val, dev, label, ops, warn);
        else if (kind.type === 'list' && Array.isArray(val)) {
          const f = figOf(s, dev);
          if (!f) continue;
          const box = f.items === '.' ? node : figBase(node, { at: f.items, atNth: f.itemsNth });
          let items = box && 'children' in box ? box.children.slice(f.from || 0) : [];
          if (f.deep) items = items.flatMap((r) => ('children' in r ? r.children.slice() : []));
          if (f.item) items = items.filter((n) => clean(n.name) === f.item);
          if (f.reverse) items.reverse();
          const list = f.tail ? val.slice(-items.length) : val; // tail: Figma 칸이 적으면 뒤쪽 값부터(MO 는 마지막 버튼만)
          if (!items.length) { if (diff) warn(label + ': 목록 항목을 못 찾았어요'); continue; }
          items.forEach((it, i) => {
            if (i >= list.length) { ops.push({ op: 'hide', node: it }); return; }
            ops.push({ op: 'show', node: it });
            fill(s.item || {}, kind.item || {}, it, list[i] || {}, sample && sample[k] && sample[k][i], label + '[' + i + '].');
            if (kind.item) itemDecor(kind.item, it, list[i] || {}, ops);
          });
          if (!f.tail && val.length > items.length) warn(label + ': Figma 에 ' + items.length + '개만 있어서 ' + (val.length - items.length) + '개는 못 넣었어요');
        }
        continue;
      }
      if (kind.type === 'text' || kind.type === 'richtext') {
        if (!names(s).length && !s.figmaProp) { if (has && !same(val, sample && sample[k])) warn(label + ': Figma 레이어 연결이 없어 원본 문구 그대로예요'); continue; }
        if (s.figmaProp) { // 인스턴스 속성 (버튼 문구 등)
          const inst = s.names ? target(node, s, 'INSTANCE') : node;
          const i = inst && (inst.type === 'INSTANCE' ? inst : findAll(inst, (n) => n.type === 'INSTANCE')[0]);
          if (!i) { if (diff) warn(label + ': 인스턴스를 못 찾았어요'); continue; }
          if (val != null && val !== '') ops.push({ op: 'prop', node: i, key: s.figmaProp, value: norm(val) });
          continue;
        }
        const t = textOf(target(node, s, 'TEXT'));
        if (!t) { if (has && val && diff) warn(label + ': 문구 레이어를 못 찾았어요'); continue; }
        const str = val && typeof val === 'object' ? (dev === 'mo' ? (val.mo ?? val.pc) : (val.pc ?? val.mo)) : val;
        if (str == null || str === '') { if (kind.optional) ops.push({ op: 'hide', node: t }); continue; }
        ops.push({ op: 'show', node: t }, { op: 'text', node: t, value: norm(str) });
        continue;
      }
      if (kind.type === 'media' || kind.type === 'image') {
        if (!has || same(val, sample && sample[k])) continue; // 샘플 그대로면 Figma 원본 이미지를 둬요
        const m = mediaSrc(val, dev);
        if (!m) continue;
        // 숨겨 둔 이미지 레이어도 찾아요(보이게 바꿔요). 배경 레이어가 따로 없으면 섹션 자체 채우기가 배경이에요
        let t = target(node, s);
        if (!t) { ALL = true; t = target(node, s); ALL = false; }
        // 숨긴 그림 프레임(예: product-shot MO 의 40px bg)은 배경 자리가 아니에요 → 섹션 자체를 채워요
        if (k === 'background' && node === TOP && (!t || (!t.visible && !hasImg(t)))) t = TOP;
        let img = t && (hasImg(t) ? t : findAll(t, hasImg)[0] || ('fills' in t ? t : null));
        if (!img) { warn(label + ': 이미지 레이어를 못 찾았어요'); continue; }
        if (!img.visible) ops.push({ op: 'show', node: img });
        // 이미지가 아닌 그림(그라디언트 원 등)으로 된 배경 프레임 → 안의 그림을 숨기고 프레임을 이미지로 채워요
        if (img !== TOP && !hasImg(img) && 'children' in img) for (const c of img.children) ops.push({ op: 'hide', node: c });
        ops.push({ op: m.kind === 'video' ? 'video' : 'image', node: img, src: m.src, css: m.css });
        continue;
      }
      if (kind.type === 'list') {
        if (!Array.isArray(val) || !names(s).length) continue;
        ALL = true; const items = listItems(node, s); ALL = false;
        if (!items.length) { if (diff) warn(label + ': 목록 항목(' + names(s).join('|') + ')을 못 찾았어요'); continue; }
        items.forEach((it, i) => {
          if (i >= val.length) { ops.push({ op: 'hide', node: it }); return; }
          ops.push({ op: 'show', node: it });
          fill(s.item || {}, kind.item || {}, it, val[i] || {}, sample && sample[k] && sample[k][i], label + '[' + i + '].');
          if (kind.item) itemDecor(kind.item, it, val[i] || {}, ops);
        });
        if (val.length > items.length) warn(label + ': Figma 에 ' + items.length + '개만 있어서 ' + (val.length - items.length) + '개는 못 넣었어요');
      }
    }
  };
  fill(v.spec, v.kinds, root, content || {}, v.sample, '');
  return ops;
}
/** 버튼 항목의 color · line · radius (기본값과 다를 때만) — 항목 인스턴스 자체를 꾸며요 */
function itemDecor(kinds, it, val, ops) {
  const btn = it.type === 'INSTANCE' ? it : findAll(it, (n) => n.type === 'INSTANCE')[0] || it;
  // 오른쪽 아이콘 = Figma 버튼의 right-icon 속성(켜고 끄기만 — 모양은 Figma 버튼의 기본 아이콘)
  const ic = val.icon || (val.arrow ? 'chevron-right' : null);
  if (kinds.icon && ic && btn.type === 'INSTANCE') ops.push({ op: 'prop', node: btn, key: 'right-icon', value: ic !== 'none', soft: true });
  // 테두리형 = 바탕 없이 테두리·글자를 그 색으로 (라인을 고르면 테두리는 라인 색)
  if (kinds.style && val.style === 'outline') {
    const c = colorOf(val.color || (kinds.color && kinds.color.default));
    const l = val.line && lineOf(val.line);
    if (c) {
      ops.push({ op: 'fill', node: btn, css: null }, { op: 'stroke', node: btn, css: l ? l.value : c.hex });
      for (const t of findAll(btn, (n) => n.type === 'TEXT')) ops.push({ op: 'textFill', node: t, css: c.hex });
    }
    if (kinds.radius && val.radius && val.radius !== kinds.radius.default) { const px = radiusOf(val.radius); if (px != null) ops.push({ op: 'radius', node: btn, px }); }
    return;
  }
  if (kinds.color && val.color && val.color !== kinds.color.default) {
    const c = colorOf(val.color);
    if (c) {
      ops.push({ op: 'fill', node: btn, css: c.hex });
      if (c.on !== 'inherit') for (const t of findAll(btn, (n) => n.type === 'TEXT')) ops.push({ op: 'textFill', node: t, css: c.on });
      for (const ic of findAll(btn, (n) => n.type === 'VECTOR')) if (c.on !== 'inherit') ops.push({ op: 'vectorFill', node: ic, css: c.on });
    }
  }
  if (kinds.line && val.line) { const l = lineOf(val.line); if (l) ops.push({ op: 'stroke', node: btn, css: l.value }); }
  if (kinds.radius && val.radius && val.radius !== kinds.radius.default) { const px = radiusOf(val.radius); if (px != null) ops.push({ op: 'radius', node: btn, px }); }
}

/** 글자 길이만큼 늘어나는 글자 레이어(너비 자동)가 칸 밖으로 넘치면 → 칸 폭에 맞춰 줄바꿈(높이 자동)
    칸 = 위로 올라가며 처음 만나는, 너비가 글자에 따라 늘지 않는 레이어(고정 폭 · 또는 고정 폭 부모를 채우는 레이어)의 안쪽 오른쪽 끝
    (HUG 부모 안의 FILL 은 글자 따라 늘어나서 건너뛰어요 — 월간휴넷 아젠다 MO 제목) */
const fixedW = (a) => !a || a.type === 'PAGE' || !('layoutSizingHorizontal' in a) || a.layoutSizingHorizontal === 'FIXED' || (a.layoutSizingHorizontal === 'FILL' && fixedW(a.parent));
function wrapFit(t) {
  if (t.textAutoResize !== 'WIDTH_AND_HEIGHT') return;
  const tb = t.absoluteBoundingBox;
  if (!tb) return;
  let a = t.parent;
  while (a && a.type !== 'PAGE' && !fixedW(a)) a = a.parent;
  if (!a || !a.absoluteBoundingBox) return;
  const right = a.absoluteBoundingBox.x + a.absoluteBoundingBox.width - (a.paddingRight || 0);
  if (tb.x + tb.width <= right + 0.5) return;
  t.textAutoResize = 'HEIGHT';
  t.resize(Math.max(20, right - tb.x), t.height);
}
const iconSets = {};
async function iconSet(key) { if (!(key in iconSets)) iconSets[key] = await figma.importComponentSetByKeyAsync(key).catch(() => null); return iconSets[key]; }

/* ---------- run: 바꾸기 */
async function run(ops, images, warn) {
  for (const o of ops) {
    try {
      let n = o.node;
      if (o.op === 'hide') n.visible = false;
      else if (o.op === 'show') n.visible = true;
      else if (o.op === 'text') {
        if (n.characters === o.value && !(o.marks && o.marks.length)) continue; // 같은 문구면 덮어쓰지 않아요 (불필요한 오버라이드·시간 줄이기)
        const len = n.characters.length;
        const fonts = len ? n.getRangeAllFontNames(0, len) : [n.fontName];
        for (const f of fonts) if (f !== figma.mixed) await figma.loadFontAsync(f);
        // 원본 글자색이 두 가지(앞 · 끝)면 끝 색을 강조 색으로 봐요 — 「**굵게**」 자리에 칠해요
        const first = len ? n.getRangeFills(0, 1) : null;
        const last = len ? n.getRangeFills(len - 1, len) : null;
        n.characters = o.value;
        if (first && first !== figma.mixed && o.value.length) n.setRangeFills(0, o.value.length, first);
        const acc = o.accent ? [paint(o.accent)].filter(Boolean) : (last && last !== figma.mixed && JSON.stringify(first) !== JSON.stringify(last) ? last : null); // accent: 강조 색을 다른 칸 값으로(체크리스트 = 배경색)
        if (o.marks && acc && acc.length) for (const [a, b] of o.marks) if (b <= o.value.length) n.setRangeFills(a, b, acc);
        if (o.marks && o.marks.length && o.value.length) { // 「**굵게**」 자리는 같은 글꼴의 Bold 로 (사이트의 <b>)
          const f0 = n.getRangeFontName(0, 1);
          if (f0 !== figma.mixed) {
            const bold = { family: f0.family, style: 'Bold' };
            try { await figma.loadFontAsync(bold); for (const [a, b] of o.marks) if (b <= o.value.length) n.setRangeFontName(a, b, bold); }
            catch (e) { warn(n.name + ': 굵은 글꼴(' + f0.family + ' Bold)을 불러오지 못했어요'); }
          }
        }
        wrapFit(n);
      } else if (o.op === 'prop') {
        const key = Object.keys(n.componentProperties).find((k) => k.split('#')[0] === o.key);
        if (key && n.componentProperties[key].value === o.value) continue;
        if (key) n.setProperties({ [key]: o.value });
        else if (!o.soft) warn(n.name + ': 속성 ' + o.key + ' 이 없어요');
      } else if (o.op === 'textFill' || o.op === 'vectorFill' || o.op === 'fill') {
        const p = paint(o.css);
        n.fills = p ? [p] : [];
      } else if (o.op === 'stroke') {
        const p = paint(o.css);
        n.strokes = p ? [p] : [];
        if (p && n.type !== 'LINE' && n.type !== 'VECTOR') { n.strokeWeight = 1; n.strokeAlign = 'INSIDE'; }
      } else if (o.op === 'setFills') { n.fills = o.paints;
      } else if (o.op === 'stripImages') { n.fills = n.fills.filter((p) => p.type !== 'IMAGE' && p.type !== 'VIDEO');
      } else if (o.op === 'appendText') { // 마지막 줄 글자 레이어 뒤에 새 문단으로 이어 붙여요(인스턴스 안에는 레이어를 더할 수 없어서)
        if (!n.visible) { const vis = n.parent.children.filter((c) => c.type === 'TEXT' && c.visible); n = vis[vis.length - 1] || n; } // 제목이 한 줄이라 마지막 줄 레이어를 숨겼으면 보이는 마지막 줄에
        const len = n.characters.length;
        const fonts = len ? n.getRangeAllFontNames(0, len) : [n.fontName];
        for (const f of fonts) if (f !== figma.mixed) await figma.loadFontAsync(f);
        const fam = (fonts.find((f) => f !== figma.mixed) || {}).family;
        const font = { family: fam, style: o.style || 'Medium' };
        await figma.loadFontAsync(font);
        n.insertCharacters(len, '\n' + o.value, 'BEFORE');
        const a = len + 1, b = n.characters.length;
        n.setRangeFontName(a, b, font);
        if (o.size) n.setRangeFontSize(a, b, o.size);
        if (o.lh) n.setRangeLineHeight(a, b, { unit: 'PERCENT', value: o.lh });
        if (o.gap != null) n.paragraphSpacing = o.gap;
        wrapFit(n);
      } else if (o.op === 'vectorsFill') { // 아이콘 색 — 그 안의 그림 선·면 (아이콘을 바꾼 뒤라도 지금 있는 것)
        const p = paint(o.css);
        for (const v of n.findAll((x) => x.type === 'VECTOR' || x.type === 'BOOLEAN_OPERATION' || x.type === 'LINE')) { if (v.type === 'LINE') v.strokes = p ? [p] : []; else v.fills = p ? [p] : []; }
      } else if (o.op === 'swap') { // 아이콘 모양 — HDS 아이콘 세트에서 style 을 골라 작은 인스턴스(32 이하)를 바꿔요
        const set = await iconSet(o.set);
        const comp = set && set.children.find((c) => c.name === 'style=' + o.style);
        if (!comp) { warn('아이콘(' + o.style + ')을 HDS 라이브러리에서 불러오지 못했어요 — 이 파일에서 🖤 HDS 라이브러리를 켜 주세요'); continue; }
        for (const i of n.findAll((x) => x.type === 'INSTANCE' && x.width <= 32 && x.height <= 32)) i.swapComponent(comp);
      } else if (o.op === 'radius') n.cornerRadius = o.px;
      else if (o.op === 'image' || o.op === 'video') {
        const bytes = images[o.src];
        if (!bytes) { warn('이미지를 못 받았어요: ' + o.src); continue; }
        if (o.op === 'video') {
          try { const vid = await figma.createVideoAsync(bytes); n.fills = [{ type: 'VIDEO', videoHash: vid.hash, scaleMode: 'FILL' }]; }
          catch (e) { warn('영상은 이 Figma 요금제에서 넣을 수 없어 건너뛰었어요: ' + o.src); }
          continue;
        }
        const img = figma.createImage(bytes);
        n.fills = [{ type: 'IMAGE', imageHash: img.hash, scaleMode: 'FILL' }];
        if (o.css) warn('움직이는 CSS 배경(' + o.css + ')은 정지 화면 한 장으로 넣었어요');
      }
    } catch (e) { warn((o.node && o.node.name) + ' — ' + o.op + ' 실패: ' + (e && e.message || e)); }
  }
}

/* ---------- 컴포넌트 */
async function componentOf(id) {
  const c = DATA.components[id];
  if (!c) throw new Error('컴포넌트 정보가 없어요: ' + id);
  const local = await figma.getNodeByIdAsync(id).catch(() => null);
  if (c.frame) { // 컴포넌트가 아닌 프레임 시안 → 원본 파일에서 복제해요 (다른 파일에서는 불러올 수 없어요)
    if (local && local.type === 'FRAME') return { createInstance: () => local.clone() };
    throw new Error('이 시안(' + id + ')은 컴포넌트가 아닌 프레임이라 원본 파일(상품페이지 템플릿 시스템)에서만 만들 수 있어요.');
  }
  if (local && local.type === 'COMPONENT' && local.key === c.key) return local;
  try { return await figma.importComponentByKeyAsync(c.key); }
  catch (e) { throw new Error('라이브러리에서 불러오지 못했어요(' + id + ' · ' + String(e && e.message || e).slice(0, 80) + ') — 원본이 팀 라이브러리로 게시됐는지, 이 파일에서 라이브러리를 켰는지 확인해 주세요'); }
}

/* ---------- 글꼴 — 인스턴스 안 글자가 쓰는 글꼴을 미리 불러와요(문구 바꾸기·배치 전에) */
const loadedFonts = new Set();
async function loadFonts(node, warn) {
  const want = new Map();
  for (const t of node.findAllWithCriteria({ types: ['TEXT'] })) {
    let fonts;
    try { fonts = t.characters.length ? t.getRangeAllFontNames(0, t.characters.length) : [t.fontName]; } catch (e) { continue; }
    for (const f of fonts) if (f && f !== figma.mixed) want.set(f.family + '|' + f.style, f);
  }
  for (const [k, f] of want) {
    if (loadedFonts.has(k)) continue;
    try { await figma.loadFontAsync(f); loadedFonts.add(k); }
    catch (e) { loadedFonts.add(k); warn('글꼴 ' + f.family + ' ' + f.style + ' 이(가) 이 컴퓨터에 없어 그 글자는 바꾸지 못할 수 있어요'); }
  }
}

/* ---------- 테마 — 인스턴스 안에서 쓰는 색 변수로 HDS 「Theme」 컬렉션을 찾아 그 모드(light/dark)로 고정해요 */
let themeColl = null;
async function findThemeCollection(node) {
  if (themeColl) return themeColl;
  const nodes = node.findAll((x) => 'fills' in x && Array.isArray(x.fills));
  nodes.unshift(node);
  for (const x of nodes) {
    for (const prop of ['fills', 'strokes']) {
      if (!(prop in x) || !Array.isArray(x[prop])) continue;
      for (const p of x[prop]) {
        const b = p.boundVariables && p.boundVariables.color;
        if (!b) continue;
        const v = await figma.variables.getVariableByIdAsync(b.id).catch(() => null);
        if (!v) continue;
        const c = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId).catch(() => null);
        if (c && c.modes.some((m) => /dark/i.test(m.name)) && c.modes.some((m) => /light/i.test(m.name))) { themeColl = c; return c; }
      }
    }
  }
  return null;
}
async function setThemeMode(inst, mode, warn) {
  const c = await findThemeCollection(inst);
  if (!c) { if (mode === 'dark') warn('색이 Theme 변수에 묶여 있지 않아 다크로 바꾸지 못했어요'); return; }
  const m = c.modes.find((x) => x.name.toLowerCase() === mode) || c.modes.find((x) => new RegExp(mode, 'i').test(x.name));
  if (!m) return;
  try { inst.setExplicitVariableModeForCollection(c, m.modeId); }
  catch (e) { warn('테마(' + mode + ')를 바꾸지 못했어요: ' + String(e && e.message || e).slice(0, 60)); }
}

/* ---------- 페이지 만들기 */
const progress = (text) => { if (typeof __html__ !== 'undefined') figma.ui.postMessage({ type: 'progress', text }); };
async function build(page, images, devices) {
  const warns = [];
  const made = [];
  let failed = 0;
  let x = Math.max(0, ...figma.currentPage.children.map((n) => n.x + n.width)) + 200;
  const y = figma.currentPage.children.length ? Math.min(...figma.currentPage.children.map((n) => n.y)) : 0;
  const pageTheme = page.theme === 'dark' ? 'dark' : 'light';
  for (const dev of devices) {
    const frame = figma.createFrame();
    frame.name = (page.title || '상품페이지') + ' — ' + dev.toUpperCase();
    // 오토레이아웃 프레임에 넣으면 Figma 가 글꼴을 다시 재요 — 다른 파일에선 글꼴이 안 불러와져 있어 실패해서,
    // 일반 프레임에 위→아래로 직접 쌓아요(섹션 인스턴스 안의 오토레이아웃은 그대로)
    const W = dev === 'pc' ? 1920 : 375;
    let yCursor = 0;
    frame.resize(W, 100);
    // 다크 페이지면 바탕도 어둡게(사이트 bg-surface 다크 #1b1c1e)
    frame.fills = [{ type: 'SOLID', color: pageTheme === 'dark' ? { r: 27 / 255, g: 28 / 255, b: 30 / 255 } : { r: 1, g: 1, b: 1 } }];
    frame.x = x; frame.y = y;
    figma.currentPage.appendChild(frame);
    let count = 0;
    for (const [i, sec] of (page.sections || []).entries()) {
      const tag = (i + 1) + '. ' + sec.variant + ' ' + dev.toUpperCase();
      progress(dev.toUpperCase() + ' ' + (i + 1) + '/' + page.sections.length + ' · ' + sec.variant);
      await new Promise((r) => setTimeout(r, 0)); // 창에 진행 상황이 보이게 한 번 쉬어요
      const v = DATA.variants[sec.variant];
      if (!v) { warns.push(tag + ': 모르는 variant 예요'); continue; }
      const id = v.figma[dev];
      if (!id) { warns.push(tag + ': Figma 에 ' + dev.toUpperCase() + ' 시안이 없어서 건너뛰었어요'); continue; }
      let comp;
      try { comp = await componentOf(id); }
      catch (e) { warns.push(tag + ': ' + (e && e.message || e)); failed++; continue; } // 한 섹션이 안 돼도 나머지는 계속 만들어요
      const inst = comp.createInstance();
      inst.name = sec.variant;
      // 프레임 밖에서 값을 다 넣고 마지막에 넣어요 — 큰 오토레이아웃 프레임이 글자 하나 바뀔 때마다 다시 계산되지 않게
      inst.x = x; inst.y = y - inst.height - 400;
      const warn = (m) => warns.push(tag + ' · ' + m);
      if (sec.options && sec.options.length) warn('옵션(' + sec.options.join(', ') + ')은 아직 Figma 에 반영하지 않아요');
      // 테마 — 섹션 색이 HDS Theme 변수(light/dark)에 묶여 있어서 인스턴스의 변수 모드만 바꿔요.
      // hero 는 시안 고정 색이라 늘 light, 나머지는 섹션 테마 → 없으면 페이지 테마
      const mode = sec.variant.startsWith('hero-') ? 'light' : (sec.theme || pageTheme);
      if (mode === 'dark' || pageTheme === 'dark') await setThemeMode(inst, mode, warn);
      await loadFonts(inst, warn);
      // MO 레이어 구조가 PC 와 달라 매핑을 PC 로만 맞춘 섹션(extractFrom: pc)은 MO 문구를 건드리지 않아요
      const moSkip = dev === 'mo' && v.extractFrom === 'pc';
      if (moSkip && !same(sec.content || v.sample, v.sample)) warn('MO 는 레이어 구조가 PC 와 달라 문구를 바꾸지 않았어요(Figma 원본 그대로)');
      // 값 넣기에서 오류가 나도 섹션은 프레임에 넣고 다음 섹션을 계속 만들어요(오류 내용은 경고로)
      try {
        const ops = moSkip ? [] : plan(inst, v, sec.content || v.sample, dev, warn);
        await run(ops, images, warn);
      } catch (e) { warn('값을 넣다 멈췄어요 — ' + String(e && e.message || e).slice(0, 160)); }
      // 세로 오토레이아웃인데 높이가 고정이면 내용 높이로(문구가 줄면 아래 빈 공간이 남지 않게 — 월간휴넷 소개 글 PC 655 고정)
      try { if (inst.layoutMode === 'VERTICAL' && inst.primaryAxisSizingMode === 'FIXED' && inst.children.some((c) => c.visible && c.layoutPositioning !== 'ABSOLUTE')) inst.primaryAxisSizingMode = 'AUTO'; /* 안이 모두 절대 위치면(체크리스트 리본형) 그대로 */ } catch (e) { /* 바꿀 수 없으면 그대로 */ }
      frame.appendChild(inst);
      inst.x = Math.round((W - inst.width) / 2);
      inst.y = yCursor;
      yCursor += inst.height;
      frame.resize(W, Math.max(100, yCursor));
      count++;
    }
    made.push(frame);
    x += frame.width + 200;
    if (!count) frame.remove();
  }
  const live = made.filter((f) => !f.removed);
  if (live.length) { figma.currentPage.selection = live; figma.viewport.scrollAndZoomIntoView(live); }
  if (!live.length && failed) throw new Error('원본 컴포넌트를 하나도 불러오지 못했어요. 원본 파일(상품페이지 템플릿 시스템)에서 실행하거나, 원본을 팀 라이브러리로 게시한 뒤 이 파일의 Assets → 📖 에서 라이브러리를 켜 주세요.\n' + warns.slice(0, 3).join('\n'));
  return { frames: live.map((f) => f.name), warns };
}

/* ---------- UI 연결 (use_figma 점검에서는 figma.ui 가 없어서 건너뛰어요) */
if (typeof __html__ !== 'undefined') {
  figma.showUI(__html__, { width: 380, height: 520, themeColors: true });
  figma.ui.onmessage = async (msg) => {
    try {
      if (msg.type === 'need') figma.ui.postMessage({ type: 'need', list: neededImages(msg.page, msg.devices), raw: DATA.raw });
      if (msg.type === 'build') {
        const r = await build(msg.page, msg.images || {}, msg.devices);
        figma.ui.postMessage({ type: 'done', frames: r.frames, warns: r.warns.concat(msg.warns || []) });
      }
    } catch (e) { figma.ui.postMessage({ type: 'error', message: String(e && e.message || e) }); }
  };
}
