// 레지스트리 로딩 · 슬롯 검증 · 섹션 렌더링 — build.mjs, validate.mjs 가 함께 써요
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import nunjucks from 'nunjucks';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SECTIONS_DIR = path.join(ROOT, 'sections');
/** 페이지 템플릿(월간휴넷 등) — templates/<key>/template.json + 섹션 폴더(variant 와 같은 4개 파일) */
export const TEMPLATES_DIR = path.join(ROOT, 'templates');

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

/** 렌더 공통 코드 — 히어로 편집기(브라우저)도 같은 파일을 써요 */
export const RENDER_CORE_PATH = path.join(ROOT, 'site/render-core.cjs');
const core = createRequire(import.meta.url)(RENDER_CORE_PATH);

/** HDS 토큰 (버튼 색 · radius) — tokens/hds.json */
export const HDS_PATH = path.join(ROOT, 'tokens/hds.json');
export const HDS = readJson(HDS_PATH);
const HDS_IDX = core.hdsIndex(HDS);

/** hero CSS 배경 프리셋 — sections/hero/backgrounds.json (모양은 sections/hero/_backgrounds.css) */
export const BG_PRESETS_PATH = path.join(ROOT, 'sections/hero/backgrounds.json');
export const BG_PRESETS = fs.existsSync(BG_PRESETS_PATH) ? readJson(BG_PRESETS_PATH).presets : [];
const readIf = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');

/* ---------------------------------------------------------------- registry */

function loadVariant(vdir, root, variants, loadErrors) {
  if (!fs.existsSync(path.join(vdir, 'meta.json'))) return;
  try {
    const meta = readJson(path.join(vdir, 'meta.json'));
    variants.push({
      ...meta,
      dir: vdir,
      templatePath: path.relative(root, path.join(vdir, 'template.njk')),
      template: fs.readFileSync(path.join(vdir, 'template.njk'), 'utf8'),
      css: readIf(path.join(vdir, 'style.css')),
      js: readIf(path.join(vdir, 'script.js')),
      sample: readJson(path.join(vdir, 'sample.json')),
    });
  } catch (e) {
    loadErrors.push(`${path.relative(ROOT, vdir)}: ${e.message}`);
  }
}

export function loadRegistry() {
  const catalog = readJson(path.join(SECTIONS_DIR, 'sections.json'));
  const variants = [];
  const loadErrors = [];
  for (const sec of catalog.sections) {
    const dir = path.join(SECTIONS_DIR, sec.key);
    sec.sharedCss = [readIf(path.join(dir, '_shared.css')), readIf(path.join(dir, '_backgrounds.css'))].filter(Boolean).join('\n');
    sec.variants = [];
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).sort()) loadVariant(path.join(dir, name), SECTIONS_DIR, variants, loadErrors);
    const mine = variants.filter((v) => v.section === sec.key).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    sec.variants = mine.map((v) => v.id);
  }
  variants.sort((a, b) => catalog.sections.findIndex((s) => s.key === a.section) - catalog.sections.findIndex((s) => s.key === b.section) || (a.order ?? 99) - (b.order ?? 99));
  // 페이지 템플릿 — 라이브러리·조합기 목록(catalog.sections)에는 넣지 않고, 렌더·검증·CSS 는 섹션과 같이 써요
  const templates = [];
  if (fs.existsSync(TEMPLATES_DIR)) {
    for (const key of fs.readdirSync(TEMPLATES_DIR).sort()) {
      const dir = path.join(TEMPLATES_DIR, key);
      if (!fs.existsSync(path.join(dir, 'template.json'))) continue;
      const t = readJson(path.join(dir, 'template.json'));
      const before = variants.length;
      for (const name of fs.readdirSync(dir).sort()) loadVariant(path.join(dir, name), TEMPLATES_DIR, variants, loadErrors);
      const mine = variants.slice(before);
      for (const v of mine) if (v.section !== t.key) loadErrors.push(`templates/${key}/${v.layout}: meta.section 은 "${t.key}" 여야 해요`);
      // order 에 있는 섹션만, 그 순서로 (아직 만들지 않은 섹션은 건너뛰어요)
      // 항목이 { label, pick: [layout…] } 면 그중 하나를 고르는 자리 — rows[i].ids, 기본은 첫 번째
      const idOf = (l) => mine.find((v) => v.layout === l)?.id;
      // { label, extra: [layout…], max } 면 그 섹션을 0~max 개 넣는 자리 — rows[i].extra (샘플 페이지에는 넣지 않아요)
      t.rows = (t.order || []).map((o) => (typeof o === 'string' ? { ids: [idOf(o)] }
        : o.extra ? { label: o.label, ids: [], extra: o.extra.map(idOf).filter(Boolean), max: o.max ?? 3 }
          : { label: o.label, ids: (o.pick || []).map(idOf) }))
        .map((r, i) => ({ ...r, ids: r.ids.filter(Boolean), ...(typeof t.order[i] === 'object' && t.order[i].movable ? { movable: true } : {}) })).filter((r) => r.ids.length || (r.extra && r.extra.length));
      t.variants = t.rows.flatMap((r) => [...r.ids, ...(r.extra || [])]);
      t.defaults = t.rows.map((r) => r.ids[0]).filter(Boolean); // 샘플 페이지 = 자리마다 첫 번째
      t.sharedCss = readIf(path.join(dir, '_shared.css'));
      t.template = true;
      templates.push(t);
    }
  }
  const byId = Object.fromEntries(variants.map((v) => [v.id, v]));
  const sectionByKey = Object.fromEntries([...catalog.sections, ...templates].map((s) => [s.key, s]));
  return { catalog, variants, byId, sectionByKey, templates, loadErrors };
}

/* ---------------------------------------------------------------- figma links */

export function figmaUrl(catalog, nodeId, dev = false) {
  const { fileKey, fileName } = catalog.figma;
  const base = `https://www.figma.com/design/${fileKey}/${encodeURIComponent(fileName)}`;
  if (!nodeId) return base;
  return `${base}?node-id=${nodeId.replace(':', '-')}${dev ? '&m=dev' : ''}`;
}

/* ---------------------------------------------------------------- richtext
   값은 문자열("줄1\n줄2") 또는 { pc, mo } — 구현은 site/render-core.cjs */

export const { richtext, specOf } = core;

/* ---------------------------------------------------------------- validate */

const isText = (v) => typeof v === 'string' || (v && typeof v === 'object' && (typeof v.pc === 'string' || typeof v.mo === 'string'));
const empty = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0);
const isMediaEmpty = (v) => v && typeof v === 'object' && !Array.isArray(v) && !v.pc && !v.mo;

/** 줄 수 · 줄마다 글자 수(띄어쓰기 포함) — maxLines · minLines · maxChars */
function checkLines(s, v, where, errors) {
  if (s.maxLines == null && s.minLines == null && s.maxChars == null && !s.mo) return;
  const devices = typeof v === 'string' ? [['', v, s]] : Object.entries(v).filter(([d]) => d === 'pc' || d === 'mo').map(([d, t]) => [` (${d.toUpperCase()})`, t, d === 'mo' && s.mo ? { ...s, ...s.mo } : s]);
  for (const [dev, text, s] of devices) { // MO 문구는 spec.mo 의 한도(maxLines·maxChars)로 검사해요
    const ls = core.lines(text);
    if (s.maxLines != null && ls.length > s.maxLines) errors.push(`${where}${dev}: 최대 ${s.maxLines}줄이에요 (현재 ${ls.length}줄)`);
    if (s.minLines != null && ls.length < s.minLines) errors.push(`${where}${dev}: 최소 ${s.minLines}줄이에요 (현재 ${ls.length}줄)`);
    if (s.maxChars != null) {
      ls.forEach((l, i) => {
        const n = core.charCount(l);
        if (n > s.maxChars) errors.push(`${where}${dev}${ls.length > 1 ? ` ${i + 1}번째 줄` : ''}: 최대 ${s.maxChars}자예요 (현재 ${n}자, 띄어쓰기 포함) — "${l}"`);
      });
    }
  }
}

function checkMediaItem(m, where, errors, s = {}) {
  if (m == null) return;
  if (m && m.kind === 'css') {
    // CSS 배경 프리셋 — { kind: "css", preset } · 슬롯에 cssPresets: true 가 있어야 써요
    if (!s.cssPresets) errors.push(`${where}: 이 슬롯은 CSS 배경을 쓸 수 없어요 (이미지·mp4)`);
    else if (!BG_PRESETS.some((p) => p.key === m.preset)) errors.push(`${where}.preset: CSS 배경 프리셋 키예요 (가능: ${BG_PRESETS.map((p) => p.key).join(', ')} / 현재 "${m.preset}")`);
    return;
  }
  if (typeof m !== 'object' || typeof m.src !== 'string' || !m.src) { errors.push(`${where}: { kind, src } 여야 해요`); return; }
  if (!['image', 'video'].includes(m.kind)) errors.push(`${where}.kind: image | video 중 하나예요 (현재 "${m.kind}")`);
}

function validateFields(fields, obj, where, errors) {
  for (const key of Object.keys(obj || {})) {
    if (key === 'arrow' && fields.icon) continue; // 예전 버튼 화살표 — 템플릿이 chevron-right 로 읽어요(icon 으로 바뀜)
    if (!fields[key]) errors.push(`${where}: 알 수 없는 슬롯 "${key}" (가능: ${Object.keys(fields).join(', ')})`);
  }
  for (const [key, raw] of Object.entries(fields)) validateValue(specOf(raw), obj?.[key], `${where}.${key}`, errors);
}

function validateValue(s, v, where, errors) {
  if (empty(v) || (s.type === 'media' && isMediaEmpty(v))) {
    const required = !s.optional && (s.type === 'list' ? (s.min ?? 0) > 0 : ['text', 'richtext'].includes(s.type));
    if (required) errors.push(`${where}: 필수 슬롯이 비어 있어요`);
    return;
  }
  switch (s.type) {
    case 'text': case 'richtext':
      if (!isText(v)) { errors.push(`${where}: 문자열 또는 { pc, mo } 여야 해요`); break; }
      checkLines(s, v, where, errors);
      break;
    case 'toggle':
      if (typeof v !== 'boolean') errors.push(`${where}: true 또는 false 예요 (현재 ${JSON.stringify(v)})`);
      break;
    case 'color': {
      // palette: "text" = HDS typography 글자색(tokens/hds.json text), 없으면 버튼 색(colors)
      // palette: "line" = HDS line 색(tokens/hds.json line). 버튼 색은 예전 키(aliases)도 받아요
      const pal = s.palette === 'text' ? HDS_IDX.text : s.palette === 'line' ? HDS_IDX.line : s.palette === 'bg' ? HDS_IDX.bg
        : s.palette === '700' ? Object.fromEntries(HDS.colors.filter((c) => c.key.endsWith('/700')).map((c) => [c.key, c]))
        : s.palette === 'cta' ? Object.fromEntries(HDS.colors.filter((c) => c.key.endsWith('/700') || c.key.startsWith('static/')).map((c) => [c.key, c])) : HDS_IDX.colors;
      const shown = s.palette ? Object.keys(pal) : HDS.colors.map((c) => c.key);
      if (s.noneValue && v === s.noneValue) break; // 예: 뱃지 테두리 "none" = 빼기
      if (s.free && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(String(v))) break; // 자유 색 — #rrggbb(aa)
      if (!pal[v]) errors.push(`${where}: HDS ${s.palette === 'text' ? '글자색' : s.palette === 'line' ? '선 색' : s.palette === 'bg' ? '배경색' : '색'} 키예요 (가능: ${shown.join(', ')} / 현재 "${v}")`);
      break;
    }
    case 'radius':
      if (!HDS_IDX.radius[v]) errors.push(`${where}: HDS radius 키예요 (가능: ${Object.keys(HDS_IDX.radius).join(', ')} / 현재 "${v}")`);
      break;
    case 'media':
      // 배경 — { pc: { kind, src, alt?, poster? } | { kind: "css", preset }, mo?: 같은 모양 } · mo 가 없으면 PC 것을 써요
      if (typeof v !== 'object' || Array.isArray(v)) { errors.push(`${where}: { pc, mo } 여야 해요`); break; }
      for (const k of Object.keys(v)) if (!['pc', 'mo', 'pos'].includes(k)) errors.push(`${where}: 알 수 없는 키 "${k}" (pc, mo, pos)`);
      // pos = 이미지 위치·크기 { pc: { dx, dy, z }, mo? } — dx·dy -100~100(칸 대비 이동 %), z 1~3 (슬롯 focus: true)
      if (v.pos != null) {
        if (!s.focus) errors.push(`${where}.pos: 이 슬롯은 위치 조정을 쓰지 않아요`);
        for (const [d, q] of Object.entries(v.pos || {})) {
          const ok = ['pc', 'mo'].includes(d) && q && [q.dx, q.dy].every((n) => typeof n === 'number' && n >= -100 && n <= 100) && (q.z == null || (typeof q.z === 'number' && q.z >= 1 && q.z <= 3));
          if (!ok) errors.push(`${where}.pos.${d}: { dx: -100~100, dy: -100~100, z: 1~3 } 이어야 해요`);
        }
      }
      checkMediaItem(v.pc, `${where}.pc`, errors, s);
      checkMediaItem(v.mo, `${where}.mo`, errors, s);
      break;
    case 'url':
      if (typeof v !== 'string') errors.push(`${where}: 문자열(URL) 이어야 해요`);
      break;
    case 'enum':
      if (s.values && !s.values.includes(v)) errors.push(`${where}: ${s.values.join(' | ')} 중 하나예요 (현재 "${v}")`);
      break;
    case 'image':
      if (typeof v !== 'object' || typeof v.src !== 'string') errors.push(`${where}: { src, alt } 여야 해요`);
      break;
    case 'list':
      if (!Array.isArray(v)) { errors.push(`${where}: 배열이어야 해요`); break; }
      if (s.max != null && v.length > s.max) errors.push(`${where}: 최대 ${s.max}개예요 (현재 ${v.length}개)`);
      if (s.min != null && v.length < s.min) errors.push(`${where}: 최소 ${s.min}개예요 (현재 ${v.length}개)`);
      if (s.item) v.forEach((item, i) => validateFields(s.item, item, `${where}[${i}]`, errors));
      break;
    default:
      // 알 수 없는 타입(예: datetime, number)은 값이 있으면 통과
      break;
  }
}

export function validateContent(variant, content, where = variant.id) {
  const errors = [];
  validateFields(variant.slots || {}, content || {}, where, errors);
  return errors;
}

export function validatePage(reg, page, where = 'page') {
  const errors = [];
  if (!Array.isArray(page.sections) || !page.sections.length) return [`${where}: sections 배열이 비어 있어요`];
  page.sections.forEach((s, i) => {
    const v = reg.byId[s.variant];
    if (!v) errors.push(`${where}.sections[${i}]: 없는 variant "${s.variant}" (가능: ${Object.keys(reg.byId).join(', ')})`);
    else {
      errors.push(...validateContent(v, s.content || {}, `${where}.sections[${i}] ${s.variant}`));
      if (s.pager != null) {
        if (!v.pager) errors.push(`${where}.sections[${i}] ${s.variant}: 이 variant 는 pager 를 지원하지 않아요`);
        else for (const [d, n] of Object.entries(s.pager.per ?? s.pager)) {
          if (d === 'rows') continue;
          if (!['pc', 'tb', 'mo'].includes(d) || !Number.isInteger(n) || n < 0 || n > 8) errors.push(`${where}.sections[${i}] ${s.variant}: pager.${d} 는 0~8 정수예요 (0 = 넘기지 않음)`);
        }
      }
      for (const o of s.options || []) {
        if (!v.options?.[o]) errors.push(`${where}.sections[${i}] ${s.variant}: 없는 옵션 "${o}" (가능: ${Object.keys(v.options || {}).join(', ') || '없음'})`);
      }
    }
  });
  return errors;
}

/* ---------------------------------------------------------------- render */

export function createEnv() {
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader([SECTIONS_DIR, TEMPLATES_DIR], { noCache: true }), {
    autoescape: true, trimBlocks: true, lstripBlocks: true,
  });
  return core.addFilters(env, {
    safe: (v) => new nunjucks.runtime.SafeString(v),
    hds: HDS,
    icon: (name) => fs.readFileSync(path.join(ROOT, 'assets/icons', `${name}.svg`), 'utf8').trim(),
  });
}

/** 루트 요소(템플릿의 첫 태그)에 클래스·속성을 붙여요 */
function decorateRoot(html, classes, attrs) {
  return html.replace(/^<([a-z][\w-]*)([^>]*)>/, (m, tag, rest) => {
    let r = rest;
    if (classes.length) r = /\bclass="/.test(r) ? r.replace(/\bclass="([^"]*)"/, (x, c) => `class="${c} ${classes.join(' ')}"`) : `${r} class="${classes.join(' ')}"`;
    return `<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}${r}>`;
  });
}

/** opts.body: PC 콘텐츠 폭 덮어쓰기(740/860/980/1200), opts.theme: 섹션만 다크·라이트로(페이지 테마와 다르게),
    opts.options: meta.options 키 목록 — 각 옵션의 class 를 루트에 붙여요 (예: MO compact, mode=dark) */
export function renderVariant(env, variant, content, opts = {}) {
  let html = core.finalize(env.render(variant.templatePath, core.contextFor(variant.slots, content)));
  const classes = (opts.options || []).map((o) => variant.options?.[o]?.class).filter(Boolean);
  const attrs = [];
  const style = [];
  if (opts.body && opts.body !== variant.body) style.push(`--body: ${Number(opts.body)}px`);
  // 카드형 페이지 넘김 — meta.pager 기본값 + page.json 의 pager 덮어쓰기 → --per-pc/tb/mo, --rows-*
  const pg = pagerOf(variant, opts.pager);
  if (pg) {
    attrs.push('data-pager');
    for (const d of ['pc', 'tb', 'mo']) style.push(`--per-${d}: ${pg.per[d]}`);
    for (const d of ['pc', 'tb', 'mo']) if (pg.rows[d] !== 1) style.push(`--rows-${d}: ${pg.rows[d]}`);
    for (const d of ['pc', 'tb', 'mo']) style.push(`--mode-${d}: ${pg.mode[d]}`);
  }
  if (style.length) attrs.push(`style="${style.join('; ')}"`);
  if (opts.theme === 'dark' || opts.theme === 'light') attrs.push(`data-theme="${opts.theme}"`); // 섹션만 다크·라이트
  if (classes.length || attrs.length) html = decorateRoot(html, classes, attrs);
  return html;
}

/** meta.pager + 덮어쓰기 → { slot, per: {pc,tb,mo}, rows: {pc,tb,mo} } (pager 가 없는 variant 는 null) */
export function pagerOf(variant, over = {}) {
  const m = variant.pager;
  if (!m) return null;
  const pick = (base, o, d, def) => Number(o?.[d] ?? base?.[d] ?? def);
  const per = {}, rows = {}, mode = {};
  for (const d of ['pc', 'tb', 'mo']) {
    per[d] = pick(m.per, over?.per ?? over, d, d === 'mo' ? 0 : 3);
    rows[d] = pick(m.rows, over?.rows, d, 1);
    mode[d] = per[d] === 0 ? 'none' : (m.mode?.[d] || 'fill');
  }
  return { slot: m.slot, per, rows, mode };
}

/** 섹션 공통 CSS + variant CSS (사용한 섹션만, 중복 없이) */
export function cssFor(reg, variantIds) {
  const seenSec = new Set();
  const seenVar = new Set();
  const parts = [];
  for (const id of variantIds) {
    const v = reg.byId[id];
    if (!v || seenVar.has(id)) continue;
    // meta.uses = 함께 쓰는 섹션 공통 CSS (템플릿의 hero 가 sections/hero 의 공통 틀을 쓰는 것처럼)
    for (const key of [...(v.uses || []), v.section]) {
      const sec = reg.sectionByKey[key];
      if (sec?.sharedCss && !seenSec.has(sec.key)) { parts.push(`/* ${sec.key} — 공통 */\n${sec.sharedCss.trim()}`); seenSec.add(sec.key); }
    }
    parts.push(`/* ${v.id} */\n${v.css.trim()}`);
    seenVar.add(id);
  }
  return parts.join('\n\n');
}

export const BASE_CSS_PATH = path.join(ROOT, 'tokens/base.css');
export const PAGER_JS_PATH = path.join(ROOT, 'tokens/pager.js');
export const FONT_LINK = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/pretendard.min.css">';

/** 플러그인에 넣을 슬롯 스펙 — 라벨·설명은 빼고 매핑에 필요한 것만 (figma-extract · Figma 플러그인 공통). all = extract:false 슬롯도 레이어 이름을 넣어요(Figma 로 내보낼 때) */
export function slimSpec(fields, all = false) {
  const out = {};
  for (const [k, raw] of Object.entries(fields || {})) {
    const s = specOf(raw);
    const o = { type: s.type };
    if (s.extract === false && !all) { if (s.type === 'list') o.skip = true; out[k] = o; continue; }
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
    if (s.fig) o.fig = s.fig; // 자리로 찾기(페이지 템플릿 — figma-plugin/src/main.js 의 fig)
    if (s.type === 'list') o.item = slimSpec(s.item, all);
    out[k] = o;
  }
  return out;
}
