// 레지스트리 로딩 · 슬롯 검증 · 섹션 렌더링 — build.mjs, validate.mjs 가 함께 써요
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nunjucks from 'nunjucks';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SECTIONS_DIR = path.join(ROOT, 'sections');

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const readIf = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');

/* ---------------------------------------------------------------- registry */

export function loadRegistry() {
  const catalog = readJson(path.join(SECTIONS_DIR, 'sections.json'));
  const variants = [];
  const loadErrors = [];
  for (const sec of catalog.sections) {
    const dir = path.join(SECTIONS_DIR, sec.key);
    sec.sharedCss = readIf(path.join(dir, '_shared.css'));
    sec.variants = [];
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).sort()) {
      const vdir = path.join(dir, name);
      if (!fs.existsSync(path.join(vdir, 'meta.json'))) continue;
      try {
        const meta = readJson(path.join(vdir, 'meta.json'));
        variants.push({
          ...meta,
          dir: vdir,
          templatePath: path.relative(SECTIONS_DIR, path.join(vdir, 'template.njk')),
          template: fs.readFileSync(path.join(vdir, 'template.njk'), 'utf8'),
          css: readIf(path.join(vdir, 'style.css')),
          js: readIf(path.join(vdir, 'script.js')),
          sample: readJson(path.join(vdir, 'sample.json')),
        });
      } catch (e) {
        loadErrors.push(`${path.relative(ROOT, vdir)}: ${e.message}`);
      }
    }
    const mine = variants.filter((v) => v.section === sec.key).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    sec.variants = mine.map((v) => v.id);
  }
  variants.sort((a, b) => catalog.sections.findIndex((s) => s.key === a.section) - catalog.sections.findIndex((s) => s.key === b.section) || (a.order ?? 99) - (b.order ?? 99));
  const byId = Object.fromEntries(variants.map((v) => [v.id, v]));
  const sectionByKey = Object.fromEntries(catalog.sections.map((s) => [s.key, s]));
  return { catalog, variants, byId, sectionByKey, loadErrors };
}

/* ---------------------------------------------------------------- figma links */

export function figmaUrl(catalog, nodeId, dev = false) {
  const { fileKey, fileName } = catalog.figma;
  const base = `https://www.figma.com/design/${fileKey}/${encodeURIComponent(fileName)}`;
  if (!nodeId) return base;
  return `${base}?node-id=${nodeId.replace(':', '-')}${dev ? '&m=dev' : ''}`;
}

/* ---------------------------------------------------------------- richtext
   값은 문자열("줄1\n줄2") 또는 { pc, mo }.
   pc·mo 글자가 같고 줄바꿈 위치만 다르면 <br class="only-pc|only-mo"> 로 합쳐요.
   글자가 다르면 <span class="only-pc"> / <span class="only-mo"> 두 벌로 내보내요. */

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function lines(s) {
  return String(s).replace(/\r\n?|\u2028/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
}
function flatten(s) {
  const ls = lines(s);
  const breaks = new Set();
  let pos = 0;
  ls.forEach((l, i) => { pos += l.length; if (i < ls.length - 1) { breaks.add(pos); pos += 1; } });
  return { flat: ls.join(' '), breaks };
}

export function richtext(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return lines(value).map(esc).join('<br> ');
  const pc = value.pc ?? value.mo ?? '';
  const mo = value.mo ?? value.pc ?? '';
  const a = flatten(pc);
  const b = flatten(mo);
  if (a.flat !== b.flat) {
    return `<span class="only-pc">${richtext(pc)}</span><span class="only-mo">${richtext(mo)}</span>`;
  }
  const cuts = [...new Set([...a.breaks, ...b.breaks])].sort((x, y) => x - y);
  let out = '';
  let from = 0;
  for (const p of cuts) {
    out += esc(a.flat.slice(from, p));
    const both = a.breaks.has(p) && b.breaks.has(p);
    out += both ? '<br> ' : a.breaks.has(p) ? '<br class="only-pc"> ' : '<br class="only-mo"> ';
    from = p + 1; // 줄 사이 공백 1칸
  }
  return out + esc(a.flat.slice(from));
}

/* ---------------------------------------------------------------- validate */

const isText = (v) => typeof v === 'string' || (v && typeof v === 'object' && (typeof v.pc === 'string' || typeof v.mo === 'string'));
const empty = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0);

/** 슬롯 스펙 정규화 — 예전 축약형("text", ["a","b"])도 받아요 */
export function specOf(t) {
  if (Array.isArray(t)) return { type: 'enum', values: t, optional: true };
  if (typeof t === 'string') return { type: t, optional: t !== 'text' };
  return t || {};
}

function validateFields(fields, obj, where, errors) {
  for (const key of Object.keys(obj || {})) {
    if (!fields[key]) errors.push(`${where}: 알 수 없는 슬롯 "${key}" (가능: ${Object.keys(fields).join(', ')})`);
  }
  for (const [key, raw] of Object.entries(fields)) validateValue(specOf(raw), obj?.[key], `${where}.${key}`, errors);
}

function validateValue(s, v, where, errors) {
  if (empty(v)) {
    const required = !s.optional && (s.type === 'list' ? (s.min ?? 0) > 0 : ['text', 'richtext'].includes(s.type));
    if (required) errors.push(`${where}: 필수 슬롯이 비어 있어요`);
    return;
  }
  switch (s.type) {
    case 'text': case 'richtext':
      if (!isText(v)) errors.push(`${where}: 문자열 또는 { pc, mo } 여야 해요`);
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
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(SECTIONS_DIR, { noCache: true }), {
    autoescape: true, trimBlocks: true, lstripBlocks: true,
  });
  env.addFilter('rt', (v) => new nunjucks.runtime.SafeString(richtext(v)));
  env.addFilter('icon', (name) => {
    const svg = fs.readFileSync(path.join(ROOT, 'assets/icons', `${name}.svg`), 'utf8').trim();
    return new nunjucks.runtime.SafeString(svg);
  });
  return env;
}

/** 루트 요소(템플릿의 첫 태그)에 클래스·속성을 붙여요 */
function decorateRoot(html, classes, attrs) {
  return html.replace(/^<([a-z][\w-]*)([^>]*)>/, (m, tag, rest) => {
    let r = rest;
    if (classes.length) r = /\bclass="/.test(r) ? r.replace(/\bclass="([^"]*)"/, (x, c) => `class="${c} ${classes.join(' ')}"`) : `${r} class="${classes.join(' ')}"`;
    return `<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}${r}>`;
  });
}

/** opts.body: PC 콘텐츠 폭 덮어쓰기(740/860/980/1200), opts.theme: 섹션만 다크로,
    opts.options: meta.options 키 목록 — 각 옵션의 class 를 루트에 붙여요 (예: MO compact, mode=dark) */
export function renderVariant(env, variant, content, opts = {}) {
  const ctx = {};
  for (const k of Object.keys(variant.slots || {})) ctx[k] = content?.[k] ?? (variant.slots[k].type === 'list' ? [] : null);
  let html = env.render(variant.templatePath, ctx).replace(/\n{2,}/g, '\n').trim();
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
  if (opts.theme === 'dark') attrs.push('data-theme="dark"');
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
    const sec = reg.sectionByKey[v.section];
    if (sec?.sharedCss && !seenSec.has(sec.key)) { parts.push(`/* ${sec.key} — 공통 */\n${sec.sharedCss.trim()}`); seenSec.add(sec.key); }
    parts.push(`/* ${v.id} */\n${v.css.trim()}`);
    seenVar.add(id);
  }
  return parts.join('\n\n');
}

export const BASE_CSS_PATH = path.join(ROOT, 'tokens/base.css');
export const PAGER_JS_PATH = path.join(ROOT, 'tokens/pager.js');
export const FONT_LINK = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/pretendard.min.css">';
