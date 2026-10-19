/* 상품페이지 템플릿 — 라이브러리 + 조합기 + 히어로 편집기
   데이터는 build.mjs 가 넣어 주는 window.REG (sections/ 레지스트리에서 생성) 하나뿐이에요.
   히어로 편집기는 build.mjs 가 미리 컴파일한 템플릿(window.nunjucksPrecompiled)과 site/render-core.cjs 로 브라우저에서 렌더해요. */
(function () {
const REG = window.REG;
const byId = Object.fromEntries(REG.variants.map((v) => [v.id, v]));
const secByKey = Object.fromEntries(REG.sections.map((s) => [s.key, s]));
const DEVICE_W = { pc: 1920, tb: 1024, mo: 375 };
const DEVICE_LABEL = { pc: 'PC', tb: 'TB', mo: 'MO' };
const OPEN_MARK = '<svg class="flink__mark" viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2h6v6M10 2 3 9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const assetBase = new URL('./', document.baseURI).href;
const vname = (v) => v.id.slice(v.section.length + 1) || v.layout; // grid-default 처럼 섹션 안에서 구분되는 이름
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------------------------------------------------------- state */
const state = { mode: 'library', view: 'designer', device: 'pc', cat: 'hero', open: null, compose: null, hero: null, wide: false };
try {
  const s = JSON.parse(localStorage.getItem('tpl-site') || '{}');
  if (['library', 'compose', 'hero'].includes(s.mode) || (String(s.mode).startsWith('tpl:') && (REG.templates || []).some((t) => 'tpl:' + t.key === s.mode))) state.mode = s.mode;
  if (['designer', 'dev'].includes(s.view)) state.view = s.view;
  if (DEVICE_W[s.device]) state.device = s.device;
  if (secByKey[s.cat]) state.cat = s.cat;
  if (Array.isArray(s.open)) state.open = s.open.filter((k) => secByKey[k]);
  if (s.compose && Array.isArray(s.compose.rows)) state.compose = s.compose;
  if (s.hero && typeof s.hero === 'object' && s.hero.edits) state.hero = s.hero;
  if (s.tpl && typeof s.tpl === 'object') state.tpl = s.tpl;
  if (Number.isFinite(s.panelW)) state.panelW = s.panelW;
  if (s.zoom === 'fit' || [0.25, 0.5, 0.75, 1].includes(s.zoom)) state.zoom = s.zoom;
} catch (e) {}
if (!state.compose) state.compose = { title: '새 상품페이지', rows: defaultRows() };
state.compose.rows = state.compose.rows.filter((r) => byId[r.variant]);
function save() { try { localStorage.setItem('tpl-site', JSON.stringify(state)); } catch (e) {} }
/* 조합기·히어로 편집기 — 왼쪽 패널 폭은 경계선을 끌어 조절(더블클릭 = 기본 폭), 미리보기 배율은 위쪽 막대에서 골라요.
   패널은 접히지 않아요(예전 「패널 접고 크게 보기」는 뒤로가기처럼 보여 메뉴가 사라진 것처럼 보였어요) */
const PANEL_W = { def: 380, min: 300, previewMin: 480 };
const ZOOMS = [['fit', '폭 맞춤'], [0.25, '25%'], [0.5, '50%'], [0.75, '75%'], [1, '100%']];
const SPLIT = '<div class="split" data-split role="separator" aria-orientation="vertical" tabindex="0" aria-label="패널 폭 조절 — 끌거나 ←→ 키, 더블클릭하면 기본 폭" title="끌어서 패널 폭 조절 · 더블클릭하면 기본 폭"></div>';
/** 조합기 테마 — 라이브러리의 라이트/다크와 같아요 (<html data-theme="dark">). page.json 의 theme 로도 나가요 */
const themeBar = () => `<div class="zoom" role="group" aria-label="테마"><span class="zoom__label">테마</span>${[['light', '라이트'], ['dark', '다크']].map(([t, l]) => `<button type="button" class="chip" data-compose-theme="${t}" aria-pressed="${String((state.compose.theme || 'light') === t)}">${l}</button>`).join('')}</div>`;
function applyComposeTheme() {
  const t = state.compose.theme || 'light';
  composeEl.querySelectorAll('[data-compose-theme]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.composeTheme === t)));
  try { const d = composeEl.querySelector('.compose__stage iframe').contentDocument; d.documentElement.setAttribute('data-theme', t); } catch (e) {}
}
const zoomBar = () => `<div class="zoom" role="group" aria-label="미리보기 배율"><span class="zoom__label">보기</span>${ZOOMS.map(([z, l]) => `<button type="button" class="chip" data-zoom="${z}" aria-pressed="${String(z === (state.zoom || 'fit'))}">${l}</button>`).join('')}</div>`;
const clampPanel = (w) => Math.round(Math.max(PANEL_W.min, Math.min(w, window.innerWidth - PANEL_W.previewMin)));
function syncPanel() {
  const w = clampPanel(state.panelW || PANEL_W.def);
  [composeEl, heroEl, tplEl].forEach((el) => el.style.setProperty('--panel-w', w + 'px'));
  document.querySelectorAll('[data-split]').forEach((h) => { h.setAttribute('aria-valuenow', String(w)); h.setAttribute('aria-valuemin', String(PANEL_W.min)); h.setAttribute('aria-valuemax', String(clampPanel(9999))); });
}
function syncZoom() {
  document.querySelectorAll('[data-zoom]').forEach((b) => b.setAttribute('aria-pressed', String(String(state.zoom || 'fit') === b.dataset.zoom)));
  composeFit && composeFit(); heroFit && heroFit(); tplFit && tplFit();
}

/* 조합기 variant 썸네일 — hero 는 Figma 렌더(meta.thumb), 나머지는 샘플을 1920 폭으로 그려 가운데 1280(본문)만 줄여 보여 줘요(항상 지금 코드 그대로).
   썸네일 폭은 칸에 맞춰 늘고(16:9), 배율 --vt-s 는 칸 폭이 바뀔 때마다 다시 재요 */
function vThumb(v) {
  if (v.thumb) return `<span class="vthumb"><img src="${esc(new URL(v.thumb, assetBase).href)}" alt="" loading="lazy"></span>`;
  const doc = srcdoc(v.html, v.css + '\nhtml,body{overflow:hidden}', '', v.stage);
  return `<span class="vthumb"><iframe tabindex="-1" aria-hidden="true" loading="lazy" scrolling="no" srcdoc="${esc(doc)}"></iframe></span>`;
}
/** 행 안의 종류 고르기 — 히어로 편집기 스타일처럼 3열 썸네일 */
function rowVariants(r, sec) {
  return `<div class="rows__variants" role="group" aria-label="${esc(sec.key)} 종류">${sec.variants.map((id) => { const x = byId[id]; return `<button type="button" class="hed-style rows__variant" data-pick-variant="${id}" aria-pressed="${String(id === r.variant)}" title="${esc(x.when || '')}">${vThumb(x)}<span class="hed-style__name">${esc(vname(x))}</span></button>`; }).join('')}</div>`;
}
const vtObserver = new ResizeObserver((entries) => {
  for (const en of entries) { const w = en.contentRect.width; if (w) en.target.style.setProperty('--vt-s', String(w / 1280)); }
});

function defaultRows() {
  return REG.sections.filter((s) => s.variants.length).sort((a, b) => a.order - b.order).map((s) => ({ variant: s.variants[0] }));
}

/* ---------------------------------------------------------------- iframe preview */
const GUIDE_CSS = `.__guide{position:fixed;inset:0;pointer-events:none;z-index:9999;display:none}
html[data-guide] .__guide{display:block}
.__guide::before,.__guide::after{content:"";position:absolute;top:0;bottom:0;border-left:1px dashed #ff3b6b;left:calc(50% - var(--body,980px) / 2)}
.__guide::after{left:calc(50% + var(--body,980px) / 2)}
.__guide span{position:absolute;top:8px;left:50%;transform:translateX(-50%);background:#ff3b6b;color:#fff;font:600 12px/1 system-ui,sans-serif;padding:4px 6px;border-radius:4px}
a[href^="#"]{cursor:default}`;

const STAGE_CSS = { sticky: 'body{min-height:180px;display:flex;flex-direction:column;justify-content:flex-end;background:#e7e8eb}[data-theme="dark"] body{background:#0f0f10}' };
function srcdoc(html, css, js, stage) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="${assetBase}">
${REG.fontLink}
<style>${REG.baseCss}\n${css}\n${GUIDE_CSS}\n${STAGE_CSS[stage] || ''}</style></head>
<body>${html}<div class="__guide" aria-hidden="true"><span></span></div>
<script>document.addEventListener('click',function(e){var a=e.target.closest('a[href]');if(a)e.preventDefault();});${html.includes('data-pager') ? REG.pagerJs : ''}\n${js || ''}<\/script></body></html>`;
}

/** iframe 을 실제 기기 폭으로 렌더하고 무대 폭에 맞춰 축소해요 (@media 가 진짜 폭에서 동작) */
function mountPreview(stage, frame, iframe, scaleTag, onLoad, opts = {}) {
  function fit() {
    const w = DEVICE_W[state.device];
    const pad = parseFloat(getComputedStyle(stage).paddingLeft) * 2;
    const fitS = Math.min(1, Math.max(200, stage.clientWidth - pad) / w);
    // 배율을 고른 미리보기(조합기·편집기)는 그 배율 그대로 — 무대보다 크면 가로로 스크롤돼요
    iframe.style.width = w + 'px';
    let h = 400;
    try { const b = iframe.contentDocument && iframe.contentDocument.body; if (b) h = Math.ceil(b.scrollHeight) || h; } catch (e) {}
    // 무대 높이가 정해져 있으면(좁은 화면의 히어로 편집기 — 화면 60%) 「폭 맞춤」은 높이까지 다 보이게 줄여요
    let fitH = fitS;
    const cs = getComputedStyle(stage);
    if (cs.maxHeight !== 'none') {
      const bar = stage.querySelector('.stage-bar');
      const avail = parseFloat(cs.maxHeight) - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - (bar ? bar.offsetHeight + (parseFloat(cs.rowGap) || 0) : 0);
      if (avail > 120) fitH = Math.min(fitS, avail / h);
    }
    const s = opts.zoomable && typeof state.zoom === 'number' ? state.zoom : fitH;
    iframe.style.height = h + 'px';
    iframe.style.transform = `scale(${s})`;
    frame.style.width = Math.floor(w * s) + 'px';
    frame.style.height = Math.ceil(h * s) + 'px';
    if (scaleTag) scaleTag.textContent = `${DEVICE_LABEL[state.device]} ${w}px · ${Math.round(s * 100)}%${opts.zoomable && typeof state.zoom !== 'number' ? ' (폭 맞춤)' : ''}`;
  }
  iframe.addEventListener('load', () => {
    onLoad && onLoad();
    fit();
    try {
      const doc = iframe.contentDocument;
      doc.fonts && doc.fonts.ready.then(fit);
      new ResizeObserver(fit).observe(doc.body);
      doc.querySelectorAll('img').forEach((img) => img.complete || img.addEventListener('load', fit));
    } catch (e) {}
  });
  new ResizeObserver(fit).observe(stage);
  return fit;
}

const FIGMA_ICON = '<svg class="fig-ico" viewBox="0 0 38 57" aria-hidden="true"><path fill="#1abcfe" d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z"/><path fill="#0acf83" d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z"/><path fill="#ff7262" d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z"/><path fill="#f24e1e" d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z"/><path fill="#a259ff" d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z"/></svg>';

/** 피그마 메뉴 항목 — 기기별 컴포넌트 열기 / 섹션 전체 / 링크 복사 */
function figmaMenuItems(items, setUrl, dev) {
  const mode = dev ? ' <span class="figmenu__tag">Dev Mode</span>' : '';
  return items.map(({ label, f, note }) => (f
    ? `<a class="figmenu__item" role="menuitem" href="${dev ? f.dev : f.url}" target="_blank" rel="noopener">${FIGMA_ICON}<span class="figmenu__label">${label} 컴포넌트 열기${mode}</span><span class="figmenu__id">${f.node}</span></a>`
    : `<span class="figmenu__item is-none" role="menuitem" aria-disabled="true">${FIGMA_ICON}<span class="figmenu__label">${label} — 피그마에 없음${note ? ` <span class="figmenu__tag">${note}</span>` : ''}</span></span>`)).join('')
    + `<a class="figmenu__item" role="menuitem" href="${setUrl}" target="_blank" rel="noopener">${FIGMA_ICON}<span class="figmenu__label">섹션 전체 열기${mode}</span></a>`
    + `<hr class="figmenu__sep"><button type="button" class="figmenu__item" role="menuitem" data-copy-links><span class="figmenu__label">링크 복사</span></button>`;
}
function closeFigmaMenus(except) {
  document.querySelectorAll('[data-figmenu]').forEach((m) => {
    if (m === except) return;
    m.querySelector('[data-figmenu-list]').hidden = true;
    m.querySelector('[data-figmenu-btn]').setAttribute('aria-expanded', 'false');
  });
}

function codeBlock(label, text, note) {
  return `<div class="code">${note ? `<p class="code__note">${note}</p>` : ''}<button type="button" class="copy" data-copy>복사</button><pre aria-label="${label}"><code>${esc(text)}</code></pre></div>`;
}

function specOf(t) {
  if (Array.isArray(t)) return { type: 'enum', values: t, optional: true };
  if (typeof t === 'string') return { type: t, optional: t !== 'text' };
  return t || {};
}
function slotRows(fields, prefix, depth) {
  return Object.entries(fields).map(([k, raw]) => {
    const s = specOf(raw);
    let type = s.type || '';
    if (s.type === 'list') type += ` (${s.min ?? 0}–${s.max ?? '∞'})`;
    if (s.type === 'enum' && s.values) type += ` · ${s.values.join(' | ')}`;
    const where = [s.figmaPath || s.figmaLayer, ...(s.aliases || [])].filter(Boolean).map((n) => `<code>${esc(n)}</code>`);
    if (s.figmaProp) where.push(`<code>prop:${esc(s.figmaProp)}</code>`);
    const layer = where.length ? where.join(' ') : '<span class="slots__opt">피그마에 없음 (직접 입력)</span>';
    const name = `${prefix}${k}`;
    const row = `<tr><td style="padding-left:${10 + depth * 16}px">${esc(name)}${s.optional ? ' <span class="slots__opt">선택</span>' : ''}</td><td>${esc(s.label || '')}${s.note ? `<br><span class="slots__opt">${esc(s.note)}</span>` : ''}</td><td>${layer}</td><td>${esc(type)}</td></tr>`;
    return row + (s.type === 'list' && s.item ? slotRows(s.item, `${name}[].`, depth + 1) : '');
  }).join('');
}

function slotTable(v) {
  const rows = slotRows(v.slots, '', 0);
  return `<div class="slots slots-wrap"><p class="code__note">스킬은 피그마 레이어 이름으로 값을 찾아 이 슬롯에 채워요. <code>richtext</code>는 줄바꿈을 <code>\\n</code>으로, PC·MO 줄바꿈이 다르면 <code>{ "pc": "…", "mo": "…" }</code>로 받아요.</p>
<table><thead><tr><th>슬롯</th><th>설명</th><th>피그마 레이어</th><th>타입</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

/* ---------------------------------------------------------------- pager (카드 수 · 기기별 한 화면 개수) */
const PER_CHOICES = { pc: [1, 2, 3, 4, 5, 6], tb: [1, 2, 3, 4], mo: [0, 1, 2] };
const sampleCount = (v) => (v.pager ? (v.sample[v.pager.slot] || []).length : 0);
const pagerDefault = (v) => ({ count: sampleCount(v), per: { ...v.pager.per } });

/** 미리보기 HTML 에 카드 수(샘플 카드를 순서대로 반복)와 기기별 한 화면 개수를 적용해요 */
function withPager(v, html, cfg) {
  if (!v.pager || !cfg) return html;
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const root = tpl.content.firstElementChild;
  if (!root) return html;
  for (const d of ['pc', 'tb', 'mo']) root.style.setProperty('--per-' + d, String(cfg.per?.[d] ?? v.pager.per[d]));
  const track = root.querySelector('[data-pager-track]');
  if (track && cfg.count != null) {
    const kids = [...track.children];
    if (kids.length) {
      if (cfg.count < kids.length) kids.slice(cfg.count).forEach((k) => k.remove());
      else for (let i = kids.length; i < cfg.count; i++) track.appendChild(kids[i % kids.length].cloneNode(true));
    }
  }
  return tpl.innerHTML;
}

/** page.json 용 content — 카드 목록을 샘플 순서대로 반복해 개수를 맞춰요 */
function contentFor(v, count) {
  const c = JSON.parse(JSON.stringify(v.sample));
  if (v.pager && count != null) { const base = c[v.pager.slot] || []; if (base.length) c[v.pager.slot] = Array.from({ length: count }, (_, i) => JSON.parse(JSON.stringify(base[i % base.length]))); }
  return c;
}

function pagerControls(v, cfg) {
  const max = (v.slots[v.pager.slot] && v.slots[v.pager.slot].max) || 24;
  return `<span class="pg" data-pg>
  <span class="v__opts-label">카드</span>
  <button type="button" class="chip chip--num" data-pg-count="-1" aria-label="카드 빼기"${cfg.count <= 1 ? ' disabled' : ''}>−</button>
  <span class="pg__n" aria-live="polite">${cfg.count}장</span>
  <button type="button" class="chip chip--num" data-pg-count="1" aria-label="카드 더하기"${cfg.count >= max ? ' disabled' : ''}>+</button>
  <span class="v__opts-label pg__gap">${v.pager.mode.pc === 'grid' ? '열 수' : '한 줄 최대'}</span>
  ${['pc', 'tb', 'mo'].map((d) => `<label class="pg__per">${DEVICE_LABEL[d]}<select data-pg-per="${d}" aria-label="${DEVICE_LABEL[d]} ${v.pager.mode[d] === 'grid' ? '열 수' : '한 줄 최대 카드 수'}">${PER_CHOICES[d].map((n) => `<option value="${n}"${n === cfg.per[d] ? ' selected' : ''}>${n === 0 ? (d === 'mo' ? '기본' : '끄기') : n + (v.pager.mode[d] === 'grid' ? '열' : '장')}</option>`).join('')}</select></label>`).join('')}
  <span class="v__opts-hint">${v.pager.mode.pc === 'grid' ? '줄이 늘다가 넘치면 좌우로 넘겨요' : '적으면 카드가 넓어지고, 넘치면 좌우로 넘기고 점이 생겨요'}</span>
</span>`;
}

/* ---------------------------------------------------------------- library */
const sideEl = document.getElementById('side');
const mainEl = document.getElementById('main');
const libraryEl = document.getElementById('library');
const composeEl = document.getElementById('compose');
const cards = [];

if (!state.open) state.open = [state.cat];
const isOpen = (k) => state.open.includes(k);

function renderSide() {
  // 섹션마다 따로 펼치고 접어요 — 다른 섹션을 눌러도 이미 펼친 섹션은 그대로예요
  sideEl.innerHTML = REG.sections.map((s) => {
    const open = isOpen(s.key) && s.variants.length;
    const cur = s.key === state.cat;
    return `<div class="side__group${open ? ' is-open' : ''}${cur ? ' is-cur' : ''}${s.variants.length ? '' : ' is-empty'}">
  <button type="button" class="side__sec" data-toggle="${s.key}" aria-expanded="${open ? 'true' : 'false'}"${cur ? ' aria-current="true"' : ''}>
    <span class="side__caret" aria-hidden="true"></span><span class="side__key">${s.key}</span><span class="side__role">${s.variants.length ? s.variants.length : '준비 중'}</span>
  </button>
  ${open ? `<ul class="side__sub">${s.variants.map((id) => `<li><a href="#${id}" data-nav="${id}"><span>${vname(byId[id])}</span><span class="side__mo">${['pc', 'tb', 'mo'].filter((d) => byId[id].figma[d]).map((d) => DEVICE_LABEL[d]).join('·')}</span></a></li>`).join('')}</ul>` : ''}
</div>`;
  }).join('');
}

function renderCat() {
  const s = secByKey[state.cat];
  cards.length = 0;
  const dev = state.view === 'dev';
  mainEl.innerHTML = `<div class="cat-head"><h2>${s.key}<span>${esc(s.role)} · ${s.variants.length}종</span></h2>
  <span class="cat-head__tip" tabindex="0" title="피그마 링크로 이동 → 컴포넌트를 인스턴스로 복사(⌥ 드래그 또는 ⌘C·⌘V) → 내 페이지 프레임에 붙여넣고 텍스트·이미지만 바꾸세요. 레이어 이름(eyebrow · title · description · cta · image)을 바꾸거나 인스턴스를 분리(detach)하면 코드 변환이 안 돼요.">복사 규칙 ⓘ</span>
  <a class="cat-head__fig" href="${dev ? s.figmaSetDev : s.figmaSet}" target="_blank" rel="noopener">${FIGMA_ICON}피그마에서 ${s.key} 섹션 전체 열기</a></div>`;
  if (!s.variants.length) {
    mainEl.insertAdjacentHTML('beforeend', `<div class="empty-sec"><h3>코드 템플릿 준비 중</h3><p>피그마 템플릿은 이미 있어요. 디자인에는 바로 쓸 수 있고, 코드는 <code>add-section-variant</code> 스킬로 하나씩 등록하고 있어요.</p><a class="flink" href="${s.figmaSet}" target="_blank" rel="noopener">${OPEN_MARK}<span class="flink__label">피그마에서 ${s.key} 보기</span></a></div>`);
    return;
  }
  s.variants.forEach((id) => mainEl.appendChild(card(byId[id])));
}

function card(v) {
  const el = document.createElement('article');
  el.className = 'v';
  el.id = v.id;
  const hasPcOpts = true;
  el.innerHTML = `<header class="v__head">
  <div class="v__id"><h2 class="v__name">${vname(v)}</h2><p class="v__when" title="${esc(v.when)}">${esc(v.when)}</p></div>
  <div class="v__opts">
  <span class="v__opts-label">테마</span>
  <button type="button" class="chip" data-theme-opt="light" aria-pressed="true">라이트</button>
  <button type="button" class="chip" data-theme-opt="dark" aria-pressed="false">다크</button>
  ${hasPcOpts ? `<span class="v__opts-sep" aria-hidden="true"></span><span class="v__opts-label">body</span>
  ${[740, 860, 980, 1200].map((w) => `<button type="button" class="chip chip--num" data-body="${w}" aria-pressed="${w === v.body}">${w}</button>`).join('')}
  <button type="button" class="chip" data-guide-toggle aria-pressed="false">가이드</button>
  <span class="v__opts-hint" data-pc-hint hidden>body 폭은 PC에서만 달라져요</span>` : ''}
  ${Object.keys(v.options).length ? `<span class="v__opts-sep" aria-hidden="true"></span><span class="v__opts-label">옵션</span>
  ${Object.entries(v.options).map(([k, o]) => `<button type="button" class="chip" data-opt="${k}" aria-pressed="false" title="${esc(o.label || k)}">${esc(o.label || k)}</button>`).join('')}
  <span class="v__opts-hint" data-mo-hint hidden>MO에서만 달라져요</span>` : ''}
  ${v.pager ? `<span class="v__opts-sep" aria-hidden="true"></span><span data-pg-row>${pagerControls(v, pagerDefault(v))}</span>` : ''}
  </div>
  ${v.editor ? `<button type="button" class="v__edit" data-open-editor="${v.id}" title="문구·배경·버튼을 바꿔 보는 히어로 편집기로 열어요">편집기에서 열기</button>` : ''}
  <div class="figmenu" data-figmenu>
    <button type="button" class="figmenu__btn" data-figmenu-btn aria-haspopup="menu" aria-expanded="false" title="피그마에서 열기">${FIGMA_ICON}<span>Figma</span><span class="figmenu__caret" aria-hidden="true"></span></button>
    <div class="figmenu__list" role="menu" data-figmenu-list hidden></div>
  </div>
</header>
<div class="v__stage"><div class="v__frame"><iframe title="${v.id} 미리보기" loading="lazy"></iframe><span class="v__scale"></span></div></div>
<div class="v__dev">
  <div class="tabs" role="tablist">
    ${['html:HTML', 'css:CSS', ...(v.js ? ['js:JS'] : []), 'base:공통 CSS', 'slots:슬롯', 'tpl:템플릿', 'sample:sample.json'].map((t, i) => { const [k, l] = t.split(':'); return `<button type="button" role="tab" data-tab="${k}" aria-selected="${i === 0}">${l}</button>`; }).join('')}
  </div>
  <div class="panel" data-panel="html">${codeBlock('HTML', v.html, '샘플 내용으로 렌더한 결과예요. 실제 페이지는 page.json의 내용으로 같은 템플릿을 렌더해요. 다크 모드는 <code>&lt;html data-theme="dark"&gt;</code> 또는 섹션 루트에 붙이면 돼요.')}</div>
  <div class="panel" data-panel="css" hidden>${codeBlock('CSS', v.css, `섹션 공통 CSS + 이 variant CSS. PC 콘텐츠 폭은 <code>--body</code> (기본 ${v.body}). 순서: PC → <code>@media (768–1279)</code> TB → <code>@media (max-width: 767px)</code> MO.`)}</div>
  ${v.js ? `<div class="panel" data-panel="js" hidden>${codeBlock('JS', v.js)}</div>` : ''}
  <div class="panel" data-panel="base" hidden>${codeBlock('공통 CSS', REG.baseCss, '모든 섹션이 함께 쓰는 토큰·버튼·뱃지·섹션 제목. 페이지에 한 번만 넣어요.')}</div>
  <div class="panel" data-panel="slots" hidden>${slotTable(v)}</div>
  <div class="panel" data-panel="tpl" hidden>${codeBlock('template.njk', v.template, '빌드 스크립트가 쓰는 Nunjucks 템플릿이에요. <code>| rt</code> 는 richtext 줄바꿈 변환.')}</div>
  <div class="panel" data-panel="sample" hidden>${codeBlock('sample.json', JSON.stringify(v.sample, null, 2), 'page.json 의 sections[].content 에 이 모양 그대로 넣어요.')}</div>
</div>`;

  const iframe = el.querySelector('iframe');
  let theme = 'light', bodyW = v.body, guide = false;
  const pg = v.pager ? pagerDefault(v) : null;
  const renderFrame = () => { iframe.srcdoc = srcdoc(withPager(v, v.html, pg), v.css, v.js, v.stage); };
  const on = new Set();
  const figmaFor = (d) => { for (const k of on) { const f = v.options[k].figma[d]; if (f) return f; } return v.figma[d]; };

  function apply() {
    let doc; try { doc = iframe.contentDocument; } catch (e) {}
    if (doc && doc.documentElement) {
      const root = doc.documentElement;
      root.setAttribute('data-theme', theme);
      root.style.setProperty('--body', bodyW + 'px');
      root.toggleAttribute('data-guide', guide && state.device === 'pc');
      const tag = doc.querySelector('.__guide span'); if (tag) tag.textContent = bodyW + 'px';
      const rootEl = doc.body.firstElementChild;
      if (rootEl) Object.entries(v.options).forEach(([k, o]) => o.class && rootEl.classList.toggle(o.class, on.has(k)));
    }
    const moHint = el.querySelector('[data-mo-hint]');
    if (moHint) moHint.hidden = ![...on].some((k) => v.options[k].moOnly) || state.device === 'mo';
    const pcOnly = state.device !== 'pc';
    el.querySelectorAll('[data-body], [data-guide-toggle]').forEach((b) => { b.disabled = pcOnly; });
    const hint = el.querySelector('[data-pc-hint]'); if (hint) hint.hidden = !pcOnly;
  }
  function links() {
    const dev = state.view === 'dev';
    // MO 시안이 없는 편집기 variant 는 MO 를 코드에서 제안한 값으로 그려요
    el.querySelector('[data-figmenu-list]').innerHTML = figmaMenuItems(['pc', 'tb', 'mo'].map((d) => ({ label: DEVICE_LABEL[d], f: figmaFor(d), note: d === 'mo' && v.editor ? '코드 제안값' : '' })), dev ? secByKey[v.section].figmaSetDev : secByKey[v.section].figmaSet, dev);
  }
  const fit = mountPreview(el.querySelector('.v__stage'), el.querySelector('.v__frame'), iframe, el.querySelector('.v__scale'), apply);
  renderFrame();
  links();
  if (pg) {
    const row = el.querySelector('[data-pg-row]');
    const redraw = () => { row.innerHTML = pagerControls(v, pg); renderFrame(); };
    row.addEventListener('click', (e) => { const b = e.target.closest('[data-pg-count]'); if (b) { pg.count = Math.max(1, pg.count + +b.dataset.pgCount); redraw(); } });
    row.addEventListener('change', (e) => { const s = e.target.closest('[data-pg-per]'); if (s) { pg.per[s.dataset.pgPer] = +s.value; redraw(); } });
  }

  el.addEventListener('click', (e) => {
    const fb = e.target.closest('[data-figmenu-btn]');
    if (fb) {
      const menu = fb.closest('[data-figmenu]');
      const list = menu.querySelector('[data-figmenu-list]');
      closeFigmaMenus(menu);
      list.hidden = !list.hidden;
      fb.setAttribute('aria-expanded', String(!list.hidden));
      if (!list.hidden) list.querySelector('a, button')?.focus();
      return;
    }
    if (e.target.closest('.figmenu__item[href]')) closeFigmaMenus();
    const t = e.target.closest('[data-theme-opt]');
    if (t) { theme = t.dataset.themeOpt; el.querySelectorAll('[data-theme-opt]').forEach((b) => b.setAttribute('aria-pressed', String(b === t))); apply(); return; }
    const b = e.target.closest('[data-body]');
    if (b) { bodyW = +b.dataset.body; el.querySelectorAll('[data-body]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); apply(); fit(); return; }
    const op = e.target.closest('[data-opt]');
    if (op) { const k = op.dataset.opt; on.has(k) ? on.delete(k) : on.add(k); op.setAttribute('aria-pressed', String(on.has(k))); apply(); links(); fit(); return; }
    const g = e.target.closest('[data-guide-toggle]');
    if (g) { guide = !guide; g.setAttribute('aria-pressed', String(guide)); apply(); return; }
    const tab = e.target.closest('[data-tab]');
    if (tab) {
      el.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === tab)));
      el.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
      return;
    }
    const cl = e.target.closest('[data-copy-links]');
    if (cl) {
      const text = [`${v.id}${on.size ? ' (' + [...on].join(', ') + ')' : ''}`, ...['pc', 'tb', 'mo'].filter((d) => figmaFor(d)).map((d) => `${DEVICE_LABEL[d]}: ${figmaFor(d).url}`)].join('\n');
      copyText(text, cl.querySelector('.figmenu__label') || cl);
      setTimeout(() => closeFigmaMenus(), 900);
    }
  });
  cards.push({ el, fit, apply, links });
  return el;
}

/* ---------------------------------------------------------------- compose */
function renderCompose() {
  const c = state.compose;
  const avail = REG.sections.filter((s) => s.variants.length).sort((a, b) => a.order - b.order);
  const soon = REG.sections.filter((s) => !s.variants.length).map((s) => s.key);
  const keepScroll = composeEl.querySelector('.compose__scroll')?.scrollTop || 0;
  composeEl.innerHTML = `<aside class="compose__side">${SPLIT}
  <div class="compose__scroll">
  <div><h2>페이지 조합기</h2><p>섹션 순서와 variant를 고르면 전체 페이지를 미리 봐요. 결과는 <code>page.json</code>으로 받아 내용을 채운 뒤 빌드하세요.</p></div>
  <label class="field">페이지 제목<input type="text" data-title value="${esc(c.title)}"></label>
  <div class="rows__bar"><span>섹션 ${c.rows.length}개</span><button type="button" class="btn-ui" data-fold-all="1">모두 접기</button><button type="button" class="btn-ui" data-fold-all="0">모두 펴기</button></div>
  <ol class="rows">${c.rows.map((r, i) => {
    const v = byId[r.variant];
    const sec = secByKey[v.section];
    return `<li data-row="${i}"${r.folded ? ' class="is-folded"' : ''}><div class="rows__main"><span class="rows__sec" data-drag-handle data-fold title="눌러서 접기·펴기 · 끌어서 순서 바꾸기"><span class="rows__grip" aria-hidden="true"></span>${v.section}<span class="rows__cur">${esc(vname(v))}</span></span>
      <div class="rows__body">${r.folded ? '' : rowVariants(r, sec)}
      ${Object.entries(v.options).map(([k, o]) => `<label class="rows__opt"><input type="checkbox" data-row-opt="${k}"${(r.options || []).includes(k) ? ' checked' : ''}> ${esc(o.label || k)}</label>`).join('')}
      ${v.pager ? `<div class="rows__pg">${pagerControls(v, rowPager(r))}</div>` : ''}
      ${v.editor ? rowSrcControls(r) : rowThemeControls(r)}</div></div>
      <div class="rows__btns"><button type="button" class="icon-btn" data-fold aria-label="${r.folded ? '펴기' : '접기'}" aria-expanded="${String(!r.folded)}">${r.folded ? '▸' : '▾'}</button><button type="button" class="icon-btn" data-move="-1" aria-label="위로"${i === 0 ? ' disabled' : ''}>↑</button><button type="button" class="icon-btn" data-move="1" aria-label="아래로"${i === c.rows.length - 1 ? ' disabled' : ''}>↓</button><button type="button" class="icon-btn" data-remove aria-label="빼기">✕</button></div></li>`;
  }).join('')}</ol>
  <div class="add"><select data-add aria-label="추가할 섹션">${avail.map((s) => `<option value="${s.variants[0]}">${s.key} — ${esc(s.role)}</option>`).join('')}</select><button type="button" class="btn-ui" data-add-btn>추가</button></div>
  ${soon.length ? `<p>코드 준비 중: ${soon.join(', ')}</p>` : ''}
  </div>
  <div class="compose__foot">
  <div class="compose__actions">
    <button type="button" class="btn-ui btn-ui--primary" data-download>page.json 받기</button>
    <button type="button" class="btn-ui" data-copy-json>page.json 복사</button>
    <button type="button" class="btn-ui" data-figma title="Figma 플러그인에 넣으면 원본 섹션 컴포넌트로 조립돼요 — 올린 이미지·영상도 함께 담겨요">Figma용으로 받기</button>
    <button type="button" class="btn-ui" data-reset>기본 순서로</button>
  </div>
  <div class="compose__plugin"><button type="button" class="compose__help" data-figma-help>Figma로 가져가는 법</button><span aria-hidden="true">·</span><a href="figma-plugin.zip" download>Figma 플러그인 받기 (처음 한 번)</a></div>
  <p class="compose__hint"><code>pages/이름.page.json</code>으로 저장 → 내용 수정 → <code>npm run build</code> → <code>dist/pages/이름/index.html</code></p>
  </div>
</aside>
<div class="compose__stage">${c.rows.length ? `<div class="stage-bar">${themeBar()}${zoomBar()}</div><div class="v__frame"><iframe title="조합 미리보기"></iframe><span class="v__scale"></span></div>` : '<p class="compose__empty">섹션을 추가하세요</p>'}</div>`;
  composeEl.querySelector('.compose__scroll').scrollTop = keepScroll;
  composeEl.querySelectorAll('.rows__variant .vthumb').forEach((t) => vtObserver.observe(t));
  syncPanel();
  if (!c.rows.length) return;
  const ids = c.rows.map((r) => r.variant);
  const css = [...new Set(ids)].map((id) => byId[id].css).join('\n\n'); // 같은 섹션 공통 CSS가 겹쳐도 미리보기에선 무해해요
  const rowHtml = (r) => (rowUsesEditor(r)
    ? heroHtmlOrError(byId[r.variant], heroEditOf(r.variant))
    : withTheme(withPager(byId[r.variant], withOptions(byId[r.variant], r.options), byId[r.variant].pager ? rowPager(r) : null), r.theme));
  const js = [...new Set(ids)].map((id) => byId[id].js).filter(Boolean).join('\n');
  const stage = ids.every((id) => byId[id].stage === 'sticky') ? 'sticky' : null;
  const iframe = composeEl.querySelector('.compose__stage iframe');
  composeFit = mountPreview(composeEl.querySelector('.compose__stage'), composeEl.querySelector('.v__frame'), iframe, composeEl.querySelector('.v__scale'), applyComposeTheme, { zoomable: true });
  // 편집기 내용을 쓰는 행은 올린 배경 파일(IndexedDB)을 먼저 불러와요
  Promise.all(c.rows.filter(rowUsesEditor).flatMap((r) => mediaKeys(heroEditOf(r.variant))).map(loadBlob)).then(() => {
    if (composeFocus != null) { const i = composeFocus; iframe.addEventListener('load', () => setTimeout(() => focusComposeRow(i), 60), { once: true }); composeFocus = null; }
    iframe.srcdoc = srcdoc(c.rows.map((r, i) => markRow(rowHtml(r), i)).join('\n'), css, js, stage);
  });
}
/* 조합기 — 행에서 종류(썸네일)를 고르면 오른쪽 미리보기도 그 섹션으로 스크롤하고 잠깐 테두리를 보여줘요 */
let composeFocus = null;
const markRow = (html, i) => html.replace(/^(\s*)<([a-z][\w-]*)/, `$1<$2 data-compose-row="${i}"`);
function focusComposeRow(i) {
  const iframe = composeEl.querySelector('.compose__stage iframe');
  const doc = iframe && iframe.contentDocument;
  const el = doc && doc.querySelector(`[data-compose-row="${i}"]`);
  if (!el) return;
  if (!doc.getElementById('compose-flash')) {
    const st = doc.createElement('style');
    st.id = 'compose-flash';
    st.textContent = '[data-compose-row]{transition:outline-color .5s}[data-compose-row].is-flash{outline:4px solid #3a50c9;outline-offset:-4px}';
    doc.head.appendChild(st);
  }
  // 미리보기는 배율(transform)로 줄여 보여요 → 섹션 위치에 배율을 곱해 바깥 스크롤을 옮겨요
  const rect = iframe.getBoundingClientRect();
  const s = iframe.offsetHeight ? rect.height / iframe.offsetHeight : 1;
  const y = rect.top + el.getBoundingClientRect().top * s;
  let sc = iframe.parentElement;
  while (sc && sc !== document.body && !(sc.scrollHeight > sc.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
  if (sc && sc !== document.body) sc.scrollBy({ top: y - sc.getBoundingClientRect().top - 12, behavior: 'smooth' });
  else window.scrollBy({ top: y - (document.querySelector('.top')?.offsetHeight || 56) - 12, behavior: 'smooth' });
  el.classList.add('is-flash');
  setTimeout(() => el.classList.remove('is-flash'), 1200);
}
let composeFit = null;
/** 편집기 variant(hero) 행의 내용 — r.src 가 없으면 편집기에서 고친 적이 있을 때 편집기 내용을 써요 */
const heroEditOf = (id) => { const e = state.hero && state.hero.edits && state.hero.edits[id]; if (e && byId[id]) fixStaleAssets(byId[id], e); return e; };
function rowUsesEditor(r) {
  const v = byId[r.variant];
  if (!v || !v.editor || !heroEditOf(r.variant)) return false;
  return r.src ? r.src === 'editor' : true;
}
/** 행 테마 — 페이지 따라감 · 라이트 · 다크 (hero 는 시안 고정 색이라 없어요) */
function rowThemeControls(r) {
  const cur = r.theme || '';
  return `<div class="rows__src" role="group" aria-label="이 섹션 테마"><span class="rows__src-label" title="기본 = 페이지 테마를 따라가요">테마</span>${[['', '기본'], ['light', '라이트'], ['dark', '다크']].map(([t, l]) => `<button type="button" class="chip" data-row-theme="${t}" aria-pressed="${String(cur === t)}">${l}</button>`).join('')}</div>`;
}
const withTheme = (html, t) => (t ? html.replace(/^<([a-z][\w-]*)/, `<$1 data-theme="${t}"`) : html);
function rowSrcControls(r) {
  const has = !!heroEditOf(r.variant);
  const ed = rowUsesEditor(r);
  return `<div class="rows__src" role="group" aria-label="내용"><span class="rows__src-label">내용</span>
    <button type="button" class="chip" data-row-src="sample" aria-pressed="${!ed}">샘플</button>
    <button type="button" class="chip" data-row-src="editor" aria-pressed="${ed}"${has ? '' : ' disabled title="히어로 편집기에서 이 스타일을 아직 고치지 않았어요"'}>히어로 편집기</button>
    <button type="button" class="rows__src-open" data-row-open-editor>편집기에서 고치기</button></div>`;
}
/** 편집 값 안의 올린 파일 키 */
function mediaKeys(e) {
  const keys = [];
  for (const m of Object.values(e || {})) {
    if (Array.isArray(m)) { for (const it of m) for (const x of Object.values(it || {})) if (x && typeof x === 'object' && x.file) keys.push(x.file); } // 목록 항목 이미지
    else if (m && typeof m === 'object' && 'moSame' in m) for (const ref of [m.pc, m.mo]) if (ref && ref.file) keys.push(ref.file);
  }
  return keys;
}
function rowPager(r) {
  const v = byId[r.variant];
  const d = pagerDefault(v);
  return { count: r.count ?? d.count, per: { ...d.per, ...(r.per || {}) } };
}
function withOptions(v, opts) {
  const cls = (opts || []).map((k) => v.options[k]?.class).filter(Boolean);
  if (!cls.length) return v.html;
  return v.html.replace(/^<([a-z][\w-]*)([^>]*?)class="([^"]*)"/, (m, t, a, c) => `<${t}${a}class="${c} ${cls.join(' ')}"`);
}

/** 「Figma로 가져가는 법」 안내 창 — 처음 열 때 한 번 만들어 body 에 둬요 */
function figmaHelp() {
  let d = document.getElementById('figma-help');
  if (!d) {
    document.body.insertAdjacentHTML('beforeend', `<dialog class="fhelp" id="figma-help" aria-labelledby="figma-help-title">
  <div class="fhelp__head"><h2 id="figma-help-title">Figma로 가져가기</h2><button type="button" class="icon-btn" data-close aria-label="닫기">✕</button></div>
  <div class="fhelp__body">
    <p class="fhelp__lead">조합기에서 만든 페이지를 Figma 원본 섹션 컴포넌트 <b>인스턴스</b>로 조립해요. 레이어·오토레이아웃이 그대로 살아 있어서 이어서 다듬을 수 있어요.</p>
    <ol class="fhelp__steps">
      <li><b>플러그인 설치 — 처음 한 번</b>
        <ul>
          <li><b>Figma 데스크톱 앱</b>이 필요해요. 웹 브라우저 Figma 에서는 개발용 플러그인을 불러올 수 없어요.</li>
          <li>조합기 아래 <a href="figma-plugin.zip" download>Figma 플러그인 받기</a> → zip 을 풀어 폴더를 원하는 곳에 둬요.</li>
          <li>Figma 메뉴 <kbd>Plugins</kbd> → <kbd>Development</kbd> → <kbd>Import plugin from manifest…</kbd> → 풀린 폴더의 <code>manifest.json</code></li>
          <li>새 버전이 나오면 새 zip 의 파일 3개를 <b>같은 폴더에 덮어쓰기</b>만 하면 돼요(다시 Import 안 해도 돼요).</li>
        </ul></li>
      <li><b>파일 받기</b>
        <ul><li>페이지 전체: 조합기 <b>Figma용으로 받기</b> → <code>제목.figma.json</code></li><li>히어로 하나만: 히어로 편집기 <b>Figma용으로 받기</b> → <code>hero-스타일.figma.json</code></li><li>편집기에서 올린 이미지·영상도 이 파일에 함께 담겨요.</li></ul></li>
      <li><b>Figma 에서 만들기</b>
        <ul>
          <li>원본 파일 <b>「상품페이지 템플릿 시스템」</b>을 열어요.</li>
          <li><kbd>Plugins</kbd> → <kbd>Development</kbd> → <b>상품페이지 템플릿 → Figma</b> → 작은 창이 떠요.</li>
          <li>창에 받은 파일을 끌어 놓고(또는 page.json 붙여넣기) PC·MO 를 고른 뒤 <b>Figma 에 만들기</b>.</li>
          <li>창 아래에 「만드는 중 · PC 3/16 · …」로 진행 상황이 보여요. 끝나면 지금 페이지 오른쪽에 <code>제목 — PC</code>(1920) · <code>제목 — MO</code>(375) 프레임이 생겨요.</li>
        </ul></li>
    </ol>
    <h3>들어가는 것</h3>
    <ul>
      <li>섹션 순서대로 원본 컴포넌트 인스턴스</li>
      <li>문구(타이틀·서브·뱃지 등, MO 문구 따로 쓴 것 포함) · 글자색</li>
      <li>버튼 문구·색·라인·모서리·화살표·테두리형, 뱃지 색·테두리·모서리</li>
      <li>바꾼 배경·이미지(샘플과 같으면 Figma 원본 이미지를 그대로 둬요)</li>
    </ul>
    <h3>아직 안 되는 것</h3>
    <ul>
      <li>TB 화면 — Figma 에 TB 시안이 없어요</li>
      <li>움직이는 CSS 배경 → 멈춘 화면 한 장으로 들어가요. mp4 는 Figma 요금제에 따라 빠질 수 있어요</li>
      <li>Figma 컴포넌트보다 많은 버튼·항목, 섹션 옵션·테마, MO 시안이 없는 hero 4종의 MO</li>
      <li>hero 외 섹션은 문구·이미지가 일부만 반영돼요(다음 단계에서 다듬어요)</li>
    </ul>
    <p>반영하지 못한 것은 플러그인 창 아래 <b>확인할 것</b>에 목록으로 나와요.</p>
    <h3>안 될 때</h3>
    <ul>
      <li><b>「준비 중…」에서 멈춰요</b> → Figma 안에서 연 게 아니에요(브라우저에서 <code>ui.html</code> 을 연 경우). 위 3번처럼 Figma 메뉴에서 여세요.</li>
      <li><b>「원본 컴포넌트를 불러오지 못했어요」</b> → 원본 파일에서 실행하세요. 다른 파일에서 쓰려면 원본을 팀 라이브러리로 게시하고 그 파일에서 라이브러리를 켜야 해요.</li>
      <li><b>이미지가 빠져요</b> → 샘플 이미지는 GitHub 공개 저장소에서 받아요. 인터넷 연결과 「확인할 것」 목록을 확인하세요.</li>
      <li>그 밖의 오류 → <kbd>Plugins</kbd> → <kbd>Development</kbd> → <kbd>Show/Hide console</kbd> 의 빨간 오류를 캡처해 알려 주세요.</li>
    </ul>
  </div>
</dialog>`);
    d = document.getElementById('figma-help');
    d.addEventListener('click', (ev) => { if (ev.target === d || ev.target.closest('[data-close]')) d.close(); });
  }
  d.showModal();
}

/** Figma 플러그인용 — page.json + 히어로 편집기에서 올린 파일(data URL). 저장소 이미지는 플러그인이 GitHub 원본 주소에서 받아요 */
async function figmaBundle(page = JSON.parse(pageJson()), editorRows = state.compose.rows.map((r, i) => (rowUsesEditor(r) ? { i, variant: r.variant } : null)).filter(Boolean), editOf = heroEditOf, preOf = () => 'hero') {
  const out = {};
  const toDataUrl = (blob) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error); fr.readAsDataURL(blob); });
  for (const { i, variant } of editorRows) {
    const r = { variant };
    const v = byId[r.variant];
    const e = editOf(r.variant);
    const content = page.sections[i].content;
    for (const [k, raw] of Object.entries(v.slots)) {
      if (RC.specOf(raw).type !== 'media' || !e[k]) continue;
      for (const dev of ['pc', 'mo']) {
        const ref = e[k][dev];
        if (!ref || !ref.file || (dev === 'mo' && e[k].moSame)) continue;
        await loadBlob(ref.file);
        if (!files[ref.file]) continue;
        // 같은 이름(hero-bg-pc.jpg)이 hero 여러 행에서 겹치지 않게 variant 를 앞에 붙여요
        const name = exportName(k, dev, ref, preOf(v));
        const key = `upload/${r.variant}/${name}`;
        out[key] = await toDataUrl(files[ref.file]);
        const m = content[k] && content[k][dev];
        if (m && m.src === name) m.src = key;
      }
    }
    // 목록 항목 이미지 (월간휴넷 카드 사진 등)
    for (const { k, i, kk, ref } of listUploads(v, e)) {
      await loadBlob(ref.file);
      if (!files[ref.file]) continue;
      const name = itemImageName(preOf(v), k, i, kk, ref);
      const key = `upload/${r.variant}/${name}`;
      out[key] = await toDataUrl(files[ref.file]);
      for (const it of content[k] || []) if (it[kk] && it[kk].src === name) it[kk].src = key;
    }
  }
  return JSON.stringify({ format: 'tpl-figma/1', ...page, files: out }) + '\n';
}

function pageJson() {
  return JSON.stringify({
    title: state.compose.title,
    theme: state.compose.theme || 'light',
    sections: state.compose.rows.map((r) => {
      const v = byId[r.variant];
      const pg = v.pager ? rowPager(r) : null;
      const perChanged = pg && ['pc', 'tb', 'mo'].some((d) => pg.per[d] !== v.pager.per[d]);
      return {
        variant: r.variant,
        ...(r.options && r.options.length ? { options: r.options } : {}),
        ...(perChanged ? { pager: pg.per } : {}),
        ...(r.theme && !v.editor ? { theme: r.theme } : {}),
        content: rowUsesEditor(r) ? contentFrom(v, heroEditOf(r.variant), true) : pg ? contentFor(v, pg.count) : v.sample,
      };
    }),
  }, null, 2) + '\n';
}

composeEl.addEventListener('click', (e) => {
  const rows = state.compose.rows;
  const li = e.target.closest('[data-row]');
  const i = li ? +li.dataset.row : -1;
  const fa = e.target.closest('[data-fold-all]');
  if (fa) { rows.forEach((r) => { if (fa.dataset.foldAll === '1') r.folded = true; else delete r.folded; }); return commitCompose(); }
  if (e.target.closest('[data-fold]') && li) { if (rows[i].folded) delete rows[i].folded; else rows[i].folded = true; return commitCompose(); }
  const mv = e.target.closest('[data-move]');
  if (mv) { const j = i + +mv.dataset.move; [rows[i], rows[j]] = [rows[j], rows[i]]; return commitCompose(); }
  if (e.target.closest('[data-remove]')) { rows.splice(i, 1); return commitCompose(); }
  const pc = e.target.closest('[data-pg-count]');
  if (pc && li) { const r = rows[i]; r.count = Math.max(1, rowPager(r).count + +pc.dataset.pgCount); return commitCompose(); }
  if (e.target.closest('[data-add-btn]')) { rows.push({ variant: composeEl.querySelector('[data-add]').value }); return commitCompose(); }
  if (e.target.closest('[data-reset]')) { state.compose.rows = defaultRows(); return commitCompose(); }
  const ct = e.target.closest('[data-compose-theme]');
  if (ct) { state.compose.theme = ct.dataset.composeTheme; save(); applyComposeTheme(); return; }
  const rt = e.target.closest('[data-row-theme]');
  if (rt && li) { if (rt.dataset.rowTheme) rows[i].theme = rt.dataset.rowTheme; else delete rows[i].theme; return commitCompose(); }
  const pv = e.target.closest('[data-pick-variant]');
  if (pv && li) { const r = rows[i]; if (r.variant !== pv.dataset.pickVariant) { r.variant = pv.dataset.pickVariant; r.options = []; delete r.count; delete r.per; delete r.src; composeFocus = i; commitCompose(); } else focusComposeRow(i); return; }
  const rs = e.target.closest('[data-row-src]');
  if (rs && li) { rows[i].src = rs.dataset.rowSrc; return commitCompose(); }
  if (e.target.closest('[data-row-open-editor]') && li) { heroState().variant = rows[i].variant; state.mode = 'hero'; applyAll(); window.scrollTo(0, 0); return; }
  if (e.target.closest('[data-figma-help]')) { figmaHelp(); return; }
  const fg = e.target.closest('[data-figma]');
  if (fg) {
    fg.disabled = true;
    figmaBundle().then((json) => download((state.compose.title.trim().replace(/[\\/:*?"<>|\s]+/g, '-') || 'page') + '.figma.json', new Blob([json], { type: 'application/json' })))
      .finally(() => { fg.disabled = false; });
    return;
  }
  const cj = e.target.closest('[data-copy-json]');
  if (cj) return copyText(pageJson(), cj);
  if (e.target.closest('[data-download]')) {
    download((state.compose.title.trim().replace(/[\\/:*?"<>|\s]+/g, '-') || 'page') + '.page.json', new Blob([pageJson()], { type: 'application/json' }));
    // 히어로 편집기 내용을 쓰는 행 — 올린 배경 파일도 page.json 이 가리키는 이름으로 함께 받아요
    for (const r of rows.filter(rowUsesEditor)) downloadMedia(byId[r.variant], heroEditOf(r.variant));
  }
});
/* 행 드래그 앤 드롭 — 섹션 이름 줄(⋮⋮)을 잡고 끌어 순서를 바꿔요 (↑↓ 버튼도 그대로) */
let dragFrom = -1;
const clearDrop = () => composeEl.querySelectorAll('.rows li').forEach((x) => x.classList.remove('drop-before', 'drop-after', 'is-dragging'));
composeEl.addEventListener('pointerdown', (e) => {
  const h = e.target.closest('[data-drag-handle]');
  const li = h && h.closest('[data-row]');
  if (li) li.draggable = true; // 손잡이를 잡았을 때만 끌 수 있어요 (입력칸·칩 클릭은 그대로)
});
composeEl.addEventListener('dragstart', (e) => {
  const li = e.target.closest && e.target.closest('[data-row]');
  if (!li || !li.draggable) return;
  dragFrom = +li.dataset.row;
  li.classList.add('is-dragging');
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', String(dragFrom)); } catch (err) {}
});
composeEl.addEventListener('dragover', (e) => {
  if (dragFrom < 0) return;
  const li = e.target.closest && e.target.closest('[data-row]');
  if (!li) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const r = li.getBoundingClientRect();
  const after = e.clientY > r.top + r.height / 2;
  composeEl.querySelectorAll('.rows li').forEach((x) => { if (x !== li) x.classList.remove('drop-before', 'drop-after'); });
  li.classList.toggle('drop-before', !after);
  li.classList.toggle('drop-after', after);
});
composeEl.addEventListener('drop', (e) => {
  if (dragFrom < 0) return;
  const li = e.target.closest && e.target.closest('[data-row]');
  e.preventDefault();
  if (li) {
    const to0 = +li.dataset.row + (li.classList.contains('drop-after') ? 1 : 0);
    const rows = state.compose.rows;
    const [moved] = rows.splice(dragFrom, 1);
    rows.splice(to0 > dragFrom ? to0 - 1 : to0, 0, moved);
  }
  dragFrom = -1; clearDrop(); commitCompose();
});
composeEl.addEventListener('dragend', (e) => {
  const li = e.target.closest && e.target.closest('[data-row]');
  if (li) li.draggable = false;
  dragFrom = -1; clearDrop();
});

composeEl.addEventListener('change', (e) => {
  const sel = e.target.closest('[data-variant]');
  if (sel) { const r = state.compose.rows[+sel.closest('[data-row]').dataset.row]; r.variant = sel.value; r.options = []; delete r.count; delete r.per; commitCompose(); return; }
  const pp = e.target.closest('[data-pg-per]');
  if (pp) { const r = state.compose.rows[+pp.closest('[data-row]').dataset.row]; r.per = { ...(r.per || {}), [pp.dataset.pgPer]: +pp.value }; commitCompose(); return; }
  const ro = e.target.closest('[data-row-opt]');
  if (ro) {
    const r = state.compose.rows[+ro.closest('[data-row]').dataset.row];
    const set = new Set(r.options || []); ro.checked ? set.add(ro.dataset.rowOpt) : set.delete(ro.dataset.rowOpt);
    r.options = [...set]; commitCompose();
  }
});
composeEl.addEventListener('input', (e) => {
  if (e.target.matches('[data-title]')) { state.compose.title = e.target.value; save(); }
});
function commitCompose() { save(); renderCompose(); }

/* ---------------------------------------------------------------- hero editor
   기획자·마케터용 — meta.editor 가 켜진 variant 의 슬롯(meta.slots)으로 입력 폼을 만들어요.
   미리보기는 빌드와 같은 템플릿을 브라우저에서 렌더해요 (편집기 미리보기 = npm run build 결과).
   편집 값: 문구·선택값은 localStorage(state.hero), 올린 파일은 IndexedDB 에 둬요. */
const heroEl = document.getElementById('hero-editor');
const EDITORS = REG.variants.filter((v) => v.editor);
const RC = window.RenderCore;
const HDS_COLOR = Object.fromEntries(REG.hds.colors.map((c) => [c.key, c]));
for (const [old, k] of Object.entries(REG.hds.aliases || {})) if (HDS_COLOR[k]) HDS_COLOR[old] = HDS_COLOR[k]; // 예전 키 → 새 키
/** 색 팔레트 — 슬롯 palette: text(글자) · line(선) · bg(섹션 배경) · 700(원색 700번 13색) · 없으면 버튼 색 */
const paletteList = (p) => (p === 'text' ? REG.hds.text : p === 'line' ? REG.hds.line : p === 'bg' ? REG.hds.bg : p === '700' ? REG.hds.colors.filter((c) => c.key.endsWith('/700')) : REG.hds.colors) || [];
const HDS_RADIUS = Object.fromEntries(REG.hds.radius.map((r) => [r.key, r]));
// 줄 넘김을 재는 요소 — hero variant 들이 함께 쓰는 클래스
const MEASURE = [['eyebrow', '.hero__badge'], ['title', '.hero__title'], ['description', '.hero__desc']];

let heroRender = null;
function renderHeroHtml(v, content) {
  if (!heroRender) {
    const env = new nunjucks.Environment(new nunjucks.PrecompiledLoader(window.nunjucksPrecompiled || {}), { autoescape: true, trimBlocks: true, lstripBlocks: true });
    RC.addFilters(env, { safe: (s) => new nunjucks.runtime.SafeString(s), hds: REG.hds, icon: (n) => REG.icons[n] || '' });
    heroRender = (vv, c) => RC.finalize(env.render(vv.tpl, RC.contextFor(vv.slots, c)));
  }
  return heroRender(v, content);
}

/* ---------- 편집 값 ⇄ content */
function heroState() {
  if (!state.hero || !state.hero.edits) state.hero = { variant: EDITORS[0] && EDITORS[0].id, edits: {} };
  if (!byId[state.hero.variant] || !byId[state.hero.variant].editor) state.hero.variant = EDITORS[0] && EDITORS[0].id;
  return state.hero;
}
const blank = (x) => (x == null ? '' : x);
function editFrom(v, content) {
  const e = {};
  const ctx = RC.contextFor(v.slots, content); // 빈 슬롯은 meta 의 default 로
  for (const [k, raw] of Object.entries(v.slots)) {
    const s = RC.specOf(raw);
    const val = ctx[k];
    if (s.type === 'richtext') {
      e[k] = RC.textLines(val, 'pc');
      const mo = RC.textLines(val, 'mo');
      if (s.mo && mo.join('\n') !== e[k].join('\n')) (e['@mo'] ||= {})[k] = mo;
    } else if (s.type === 'list') e[k] = (val || []).map((it) => Object.fromEntries(Object.entries(it).map(([kk, vv]) => [kk, blank(vv)])));
    else if (s.type === 'media') e[k] = { pc: (val && val.pc) || null, mo: (val && val.mo) || null, moSame: !(val && val.mo) };
    else if (s.type === 'toggle') e[k] = !!val;
    else e[k] = val && typeof val === 'object' ? blank(val.pc) : blank(val);
  }
  return e;
}
function heroEdit(v) {
  const hs = heroState();
  if (!hs.edits[v.id]) hs.edits[v.id] = editFrom(v, v.sample);
  else fixStaleAssets(v, hs.edits[v.id]);
  return hs.edits[v.id];
}
/** 미디어 칸이 "처음 받은 샘플 그대로"(손대지 않음)면 지금 샘플을 따라가요.
 *  e['@base'] = 편집값을 만들 때의 미디어 칸 값 — 지금 값과 같으면 손대지 않은 거예요.
 *  @base 가 없던 예전 편집값은 샘플 이미지(저장소 assets/…)만 쓰는 칸을 손대지 않은 것으로 봐요.
 *  직접 올린 파일 · 붙여넣은 주소 · 직접 고른 CSS 배경 · 비운 칸은 그대로 둬요 */
/* 예전 샘플 기본값 — @base 가 생기기 전(2026-10-14)에 잠깐 샘플이었던 값이면 손대지 않은 것으로 봐요 */
const FORMER_SAMPLES = { 'hero-monthly-x': { background: [JSON.stringify({ pc: { kind: 'css', preset: 'x-pattern' }, mo: null, moSame: true })] } };
function fixStaleAssets(v, e) {
  // 예전 버튼 화살표(arrow: true/false) → 오른쪽 아이콘(icon: chevron-right / none)
  if (Array.isArray(e.ctas)) for (const it of e.ctas) if (it && 'arrow' in it) { if (!it.icon || it.icon === 'none') it.icon = it.arrow === true || it.arrow === 'true' ? 'chevron-right' : 'none'; delete it.arrow; }
  const fresh = editFrom(v, v.sample);
  // 나중에 생긴 슬롯(예: 하단 그라데이션 켜기)은 샘플 값으로 채워요 — 없으면 꺼진 것처럼 보여요
  for (const k of Object.keys(v.slots)) if (!(k in e)) e[k] = fresh[k];
  const base = e['@base'];
  const next = {};
  for (const [k, raw] of Object.entries(v.slots)) {
    if (RC.specOf(raw).type !== 'media') continue;
    const cur = JSON.stringify(e[k] || null);
    const want = JSON.stringify(fresh[k] || null);
    let untouched;
    if (base) untouched = base[k] === cur;
    else {
      const refs = e[k] ? ['pc', 'mo'].map((d) => e[k][d]).filter(Boolean) : [];
      untouched = (refs.length > 0 && refs.every((r) => !r.file && r.kind !== 'css' && typeof r.src === 'string' && /^assets\//.test(r.src)))
        || ((FORMER_SAMPLES[v.id] || {})[k] || []).includes(cur);
    }
    if (untouched && cur !== want) e[k] = fresh[k];
    next[k] = untouched ? want : (base ? base[k] : want);
  }
  e['@base'] = next;
}
const extOf = (ref) => { const m = /\.([a-z0-9]+)$/i.exec(ref.name || ''); return (m ? m[1] : ref.kind === 'video' ? 'mp4' : 'jpg').toLowerCase(); };
const exportName = (slot, dev, ref, pre = 'hero') => `${pre}-${slot === 'background' ? 'bg' : slot}-${dev}.${extOf(ref)}`;
const blobUrls = {};
/** 미디어 참조 → content 값. 미리보기는 blob: 주소, 내보내기는 page.json 옆에 둘 파일 이름 */
function mediaOut(ref, slot, dev, forExport, pre) {
  if (!ref) return null;
  if (ref.kind === 'css') return ref.preset ? { kind: 'css', preset: ref.preset } : null;
  if (ref.file) {
    if (forExport) return { kind: ref.kind, src: exportName(slot, dev, ref, pre) };
    return blobUrls[ref.file] ? { kind: ref.kind, src: blobUrls[ref.file] } : null;
  }
  return ref.src ? { kind: ref.kind, src: ref.src } : null;
}
/** 목록 항목 이미지의 내보내기 파일 이름 — 예) persona-cards-2.png (항목 필드가 image 가 아니면 이름도 붙여요) */
const itemImageName = (pre = 'hero', k, i, kk, ref) => `${pre}-${k}-${i + 1}${kk === 'image' ? '' : '-' + kk}.${extOf(ref)}`;
/** 편집 값 안의 목록 항목 이미지 중 올린 파일 — [{ k, i, kk, ref }] */
function listUploads(v, e) {
  const out = [];
  for (const [k, raw] of Object.entries(v.slots)) {
    const s = RC.specOf(raw);
    if (s.type !== 'list' || !Array.isArray(e[k])) continue;
    e[k].forEach((it, i) => { for (const [kk, ref] of Object.entries(it || {})) if (ref && ref.file && RC.specOf((s.item || {})[kk]).type === 'image') out.push({ k, i, kk, ref }); });
  }
  return out;
}
function contentFrom(v, e, forExport, pre) {
  const c = {};
  for (const [k, raw] of Object.entries(v.slots)) {
    const s = RC.specOf(raw);
    const val = e[k];
    if (s.type === 'richtext') {
      const join = (ls) => (ls || []).map((l) => String(l).trim()).filter(Boolean).join('\n');
      const t = join(val);
      const m = e['@mo'] && e['@mo'][k] ? join(e['@mo'][k]) : '';
      if (m && m !== t) c[k] = { pc: t, mo: m }; // PC 를 비우고 MO 만 쓰면 PC 에는 안 보여요 (pc: '')
      else if (t) c[k] = t;
    } else if (s.type === 'list') {
      // 문구가 빈 버튼은 빼요. 항목 이미지는 올린 파일이면 미리보기 blob: 주소 · 내보내기 파일 이름으로
      const itemOut = (kk, vv, i) => {
        if (vv && typeof vv === 'object' && vv.file && RC.specOf((s.item || {})[kk]).type === 'image') {
          const src = forExport ? itemImageName(pre, k, i, kk, vv) : blobUrls[vv.file];
          return src ? { src, ...(vv.alt ? { alt: vv.alt } : {}) } : null;
        }
        return typeof vv === 'string' ? vv.trim() : vv;
      };
      const items = (val || []).map((it, i) => [it, i]).filter(([it]) => !(s.item && s.item.label) || String(it.label || '').trim())
        .map(([it, i]) => Object.fromEntries(Object.entries(it).map(([kk, vv]) => [kk, itemOut(kk, vv, i)]).filter(([, vv]) => vv !== '' && vv != null)));
      if (items.length) c[k] = items;
    } else if (s.type === 'media') {
      const pc = mediaOut(val.pc, k, 'pc', forExport, pre);
      const mo = val.moSame ? null : mediaOut(val.mo, k, 'mo', forExport, pre);
      if (pc || mo) c[k] = Object.assign({}, pc ? { pc } : {}, mo ? { mo } : {});
    } else if (s.type === 'toggle') c[k] = !!val;
    else if (String(blank(val)).trim()) c[k] = String(val).trim();
  }
  return c;
}

/* ---------- 올린 파일 (IndexedDB, 실패하면 이번 화면에서만) */
const idb = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('tpl-hero-editor', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const run = (mode, fn) => open().then((db) => new Promise((res, rej) => {
    const t = db.transaction('files', mode);
    const req = fn(t.objectStore('files'));
    t.oncomplete = () => res(req && req.result);
    t.onerror = () => rej(t.error);
  }));
  return {
    put: (k, v) => run('readwrite', (st) => st.put(v, k)).catch(() => {}),
    get: (k) => run('readonly', (st) => st.get(k)).catch(() => null),
  };
})();
const files = {}; // 이번 화면에서 올린 파일 — key → File
async function loadBlob(key) {
  if (blobUrls[key] || !key) return !!blobUrls[key];
  const f = files[key] || await idb.get(key);
  if (!f) return false;
  files[key] = f;
  blobUrls[key] = URL.createObjectURL(f);
  return true;
}

/* ---------- 폼 */
const cnt = (text, max) => {
  const n = RC.charCount(text || '');
  return max ? `<span class="hed-cnt${n > max ? ' is-over' : n === max ? ' is-full' : ''}" data-cnt="${max}">${n}/${max}</span>` : `<span class="hed-cnt" data-cnt="">${n}자</span>`;
};
const attrs = (o) => Object.entries(o).filter(([, v]) => v != null && v !== false).map(([k, v]) => (v === true ? k : `${k}="${esc(v)}"`)).join(' ');

function fieldHead(s, note) {
  return `<div class="hed-f__head"><span class="hed-f__label">${esc(s.label || '')}${s.optional ? ' <span class="hed-f__opt">선택</span>' : ''}</span><span class="hed-f__note">${esc(note || '')}</span></div>`;
}
function textInput(path, value, max, label) {
  return `<div class="hed-in"><input type="text" ${attrs({ ...path, value, maxlength: max || null, 'aria-label': label })}>${cnt(value, max)}</div>`;
}
const limitNote = (max, chars) => [max > 1 ? `최대 ${max}줄` : '', chars ? `줄마다 ${chars}자 (띄어쓰기 포함)` : ''].filter(Boolean).join(' · ');
function lineRows(k, s, ls, dev, max, chars) {
  const rows = ls.length ? ls : [''];
  const tag = dev === 'mo' ? 'MO ' : '';
  const d = dev === 'mo' ? { 'data-dev': 'mo' } : {};
  return rows.map((l, i) => `<div class="hed-in"><span class="hed-in__n">${i + 1}</span><input type="text" ${attrs({ 'data-f': k, 'data-line': i, ...d, value: l, maxlength: chars || null, 'aria-label': `${tag}${s.label} ${i + 1}번째 줄` })}>${cnt(l, chars)}${i > 0 || (rows.length > 1) ? `<button type="button" class="icon-btn" ${attrs({ 'data-act': 'del-line', 'data-f': k, 'data-line': i, ...d, 'aria-label': `${tag}${s.label} ${i + 1}번째 줄 빼기` })}>✕</button>` : '<span class="hed-in__sp"></span>'}</div>`).join('')
    + (rows.length < max ? `<button type="button" class="hed-add" ${attrs({ 'data-act': 'add-line', 'data-f': k, ...d })}>+ ${tag}줄 추가</button>` : '');
}
function linesField(k, s, ls, moLs) {
  const max = s.maxLines || 1;
  let html = `<div class="hed-f">${fieldHead(s, limitNote(max, s.maxChars))}
  ${lineRows(k, s, ls, 'pc', max, s.maxChars)}`;
  if (s.mo) {
    const mmax = s.mo.maxLines || max;
    const mchars = s.mo.maxChars || s.maxChars;
    html += `<label class="hed-check hed-check--mo"><input type="checkbox" data-mo-sep="${k}"${moLs ? ' checked' : ''}> MO 문구 따로 쓰기 <span class="hed-f__note">${esc(limitNote(mmax, mchars))}</span></label>`;
    if (moLs) html += `<div class="hed-mo">${lineRows(k, s, moLs, 'mo', mmax, mchars)}</div>`;
  }
  return html + '</div>';
}
function swatches(path, cur, label, palette, opt = {}) {
  if (!palette && REG.hds.aliases && REG.hds.aliases[cur]) cur = REG.hds.aliases[cur]; // 예전 키로 저장된 값
  // palette "text" = HDS typography 글자색(반투명 포함 → 체크무늬 위에 보여요), 없으면 버튼 색
  const list = paletteList(palette);
  // 라인처럼 비울 수 있는 색은 맨 앞에 「없음」
  // opt.base = 맨 앞 「기본」(비우면 시안 그대로), opt.noneValue = 맨 뒤 「없음」(그 값으로 빼기)
  const none = palette === 'line' && !opt.base ? `<button type="button" class="hed-sw__b hed-sw__b--none" ${attrs({ ...path, 'data-val': '', title: '없음', 'aria-label': '없음', 'aria-pressed': String(!cur) })}></button>` : '';
  const base = opt.base ? `<button type="button" class="hed-sw__b hed-sw__b--base" ${attrs({ ...path, 'data-val': '', title: '기본 (시안 그대로)', 'aria-label': '기본 (시안 그대로)', 'aria-pressed': String(!cur) })}>기본</button>` : '';
  const off = opt.noneValue ? `<button type="button" class="hed-sw__b hed-sw__b--none" ${attrs({ ...path, 'data-val': opt.noneValue, title: '없음', 'aria-label': '없음', 'aria-pressed': String(cur === opt.noneValue) })}></button>` : '';
  return `<div class="hed-sw${palette === 'text' ? ' hed-sw--text' : ''}" role="group" aria-label="${esc(label)}">${base}${none}${off}${list.map((c) => `<button type="button" class="hed-sw__b" ${attrs({ ...path, 'data-val': c.key, style: `--c:${c.value || c.hex}`, title: `${c.label} · ${c.token}`, 'aria-label': `${c.label} (${c.token})`, 'aria-pressed': String(c.key === cur) })}></button>`).join('')}</div>`;
}
/** 타이틀·서브 색 같은 최상위 색 슬롯 — 지금 고른 토큰 이름을 함께 보여요 */
/* ---------- 자유 색 고르기 (color 슬롯 free: true) — Figma 색 패널처럼 채도·밝기 사각형 · 색상 · 불투명도 · 스포이드 · HEX·% 입력
   값은 '#rrggbb'(불투명) 또는 '#rrggbbaa'. 비우면 시안 그대로(「기본」) */
const cpHex = (v) => { const m = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(String(v || '')); return m ? { hex: m[1].toLowerCase(), a: m[2] ? Math.round(parseInt(m[2], 16) / 2.55) : 100 } : null; };
const cpRgb = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
const cpToHex = (rgb) => rgb.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
function cpHsv(hex) {
  const [r, g, b] = cpRgb(hex).map((x) => x / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: mx ? d / mx : 0, v: mx };
}
function cpFromHsv({ h, s, v }) {
  const f = (n) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return cpToHex([f(5), f(3), f(1)].map((x) => x * 255));
}
const cpValue = (hex, a) => '#' + hex + (a >= 100 ? '' : Math.round(Math.max(0, a) * 2.55).toString(16).padStart(2, '0'));
const EYE_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14.5 6.5 3 3M4 20l1-4 9.5-9.5a2.1 2.1 0 0 1 3 3L8 19l-4 1Z"/><path d="m13 5 6 6"/></svg>';
function colorPicker(path, cur, label) {
  const c = cpHex(cur) || { hex: 'ffffff', a: 100 };
  const hsv = cpHsv(c.hex);
  return `<div class="cp" data-cp ${attrs({ ...path, 'data-h': Math.round(hsv.h) })} role="group" aria-label="${esc(label)}">
  <div class="cp__sv" data-cp-sv style="--h:${Math.round(hsv.h)}"><span class="cp__dot" style="left:${(hsv.s * 100).toFixed(1)}%;top:${((1 - hsv.v) * 100).toFixed(1)}%"></span></div>
  <div class="cp__row">
    ${window.EyeDropper ? `<button type="button" class="cp__eye" data-cp-eye title="스포이드 — 화면에서 색 찍기" aria-label="스포이드">${EYE_ICON}</button>` : ''}
    <div class="cp__bars">
      <div class="cp__hue" data-cp-hue><span class="cp__knob" style="left:${(hsv.h / 3.6).toFixed(1)}%"></span></div>
      <div class="cp__alpha" data-cp-alpha style="--c:#${c.hex}"><span class="cp__knob" style="left:${c.a}%"></span></div>
    </div>
  </div>
  <div class="cp__inputs"><span class="cp__mode">Hex</span><input type="text" data-cp-hex value="${c.hex.toUpperCase()}" maxlength="7" spellcheck="false" aria-label="${esc(label)} HEX"><input type="number" data-cp-a value="${c.a}" min="0" max="100" aria-label="${esc(label)} 불투명도"><span class="cp__pct">%</span></div>
</div>`;
}
function colorField(k, s, cur) {
  if (s.free) {
    const base = s.optional && s.default == null;
    const c = cpHex(cur);
    const now = c ? `<code>#${c.hex.toUpperCase()}${c.a < 100 ? ` · ${c.a}%` : ''}</code>` : base ? '기본 (시안 그대로)' : '';
    return `<div class="hed-f">${fieldHead(s, s.note)}<div class="cp-head"><span class="hed-sub__label" data-cp-now>${now}</span>${base ? `<button type="button" class="chip" data-f="${k}" data-val="" aria-pressed="${String(!c)}">기본</button>` : ''}</div>${colorPicker({ 'data-f': k }, cur, s.label)}</div>`;
  }
  const list = paletteList(s.palette);
  const c = s.palette ? list.find((x) => x.key === cur) : HDS_COLOR[cur];
  const base = s.optional && s.default == null; // 기본값이 없으면 「기본」 = 시안 그대로
  const now = c ? `<code>${esc(c.token)}</code> ${esc(c.label)}` : cur && cur === s.noneValue ? '없음' : base ? '기본 (시안 그대로)' : '';
  return `<div class="hed-f">${fieldHead(s, s.note)}<span class="hed-sub__label">${now}</span>${swatches({ 'data-f': k }, cur, s.label, s.palette, { base, noneValue: s.noneValue })}</div>`;
}
function radiusField(k, s, cur) {
  const r = HDS_RADIUS[cur];
  return `<div class="hed-f">${fieldHead(s, s.note)}<span class="hed-sub__label">${r ? `<code>${esc(r.token)}</code>` : '기본 (시안 그대로)'}</span>${radiusChips({ 'data-f': k }, cur, s.label, s.optional && s.default == null)}</div>`;
}
function radiusChips(path, cur, label, base) {
  return `<div class="hed-rad" role="group" aria-label="${esc(label)}">${base ? `<button type="button" class="chip" ${attrs({ ...path, 'data-val': '', 'aria-pressed': String(!cur) })}>기본</button>` : ''}${REG.hds.radius.map((r) => `<button type="button" class="chip" ${attrs({ ...path, 'data-val': r.key, title: r.token, 'aria-pressed': String(r.key === cur) })}><span class="hed-rad__ico" style="border-top-left-radius:${Math.min(r.px, 10)}px"></span>${r.key} <span class="hed-rad__px">${r.px === 900 ? '' : r.px}</span></button>`).join('')}</div>`;
}
/** enum — 칩 하나를 고르는 그룹. 표시 이름은 spec.labels */
function enumChips(path, s, cur, label) {
  return `<div class="hed-rad" role="group" aria-label="${esc(label)}">${(s.values || []).map((o) => `<button type="button" class="chip" ${attrs({ ...path, 'data-val': o, 'aria-pressed': String(String(o) === String(cur)) })}>${esc((s.labels && s.labels[o]) || o)}</button>`).join('')}</div>`;
}
function toggleBox(path, s, cur) {
  return `<label class="hed-check"><input type="checkbox" ${attrs({ ...path, 'data-toggle': '', checked: !!cur })}> ${esc(s.label || '')}</label>`;
}
/** hideWhen: { style: "outline" } — 같은 항목의 다른 값이 맞으면 숨겨요 (테두리형이면 배경색 숨김) */
const hiddenBy = (s, item) => !!(s.hideWhen && item && Object.entries(s.hideWhen).every(([hk, hv]) => item[hk] === hv));
/** 목록 항목 안의 이미지 — 썸네일 · 파일 선택 · 지우기 · 되돌리기(샘플과 다르면) */
function imageItem(path, s, val, label, smp) {
  const src = val ? (val.file ? blobUrls[val.file] : val.src) : '';
  const restore = smp && JSON.stringify(smp) !== JSON.stringify(val || null);
  return `<div class="hed-sub"><span class="hed-sub__label">${esc(s.label || '이미지')}${s.hint ? ` <span class="hed-f__opt">${esc(s.hint)}</span>` : ''}</span><div class="hed-img">
  <span class="hed-img__thumb">${src ? `<img src="${esc(src)}" alt="">` : val ? '파일을 다시<br>골라 주세요' : '없음'}</span>
  <div class="hed-media__btns"><button type="button" class="btn-ui" ${attrs({ ...path, 'data-act': 'pick', 'aria-label': `${label} 파일 선택` })}>파일 선택</button>${val ? `<button type="button" class="btn-ui" ${attrs({ ...path, 'data-act': 'clear' })}>지우기</button>` : ''}${restore ? `<button type="button" class="btn-ui" ${attrs({ ...path, 'data-act': 'restore', title: 'Figma 샘플로 되돌려요' })}>되돌리기</button>` : ''}</div>
</div></div>`;
}
function itemField(k, i, kk, s, val, n, item, smpItem) {
  const path = { 'data-f': k, 'data-i': i, 'data-k': kk };
  const label = `${n} ${s.label || kk}`;
  if (hiddenBy(s, item)) return '';
  if (s.type === 'image') return imageItem(path, s, val, label, smpItem && smpItem[kk]);
  if (s.type === 'richtext') {
    // 여러 줄 문구 — 엔터로 줄을 나눠요 (그대로 줄바꿈돼요)
    const t = String(val == null ? '' : val);
    return `<div class="hed-sub"><span class="hed-sub__label">${esc(s.label || kk)}${s.note ? ` <span class="hed-f__opt">${esc(s.note)}</span>` : ''}</span><div class="hed-in hed-in--area"><textarea ${attrs({ ...path, rows: Math.min(8, Math.max(2, t.split('\n').length)), 'aria-label': label })}>${esc(t)}</textarea></div></div>`;
  }
  if (s.type === 'toggle') return `<div class="hed-sub">${toggleBox(path, s, val)}</div>`;
  if (s.type === 'color') {
    const list = paletteList(s.palette);
    const c = s.palette ? list.find((x) => x.key === val) : HDS_COLOR[val];
    return `<div class="hed-sub"><span class="hed-sub__label">${esc(s.label || kk)} <code>${c ? esc(c.token) : s.palette === 'line' ? '없음' : ''}</code></span>${swatches(path, val, label, s.palette)}</div>`;
  }
  if (s.type === 'radius') {
    const r = HDS_RADIUS[val];
    return `<div class="hed-sub"><span class="hed-sub__label">${esc(s.label || kk)} <code>${r ? esc(r.token) : ''}</code></span>${radiusChips(path, val, label)}</div>`;
  }
  if (s.type === 'enum') return `<div class="hed-sub"><span class="hed-sub__label">${esc(s.label || kk)}</span>${enumChips(path, s, val, label)}</div>`;
  const ph = s.type === 'url' ? 'https://… (비우면 #)' : '';
  return `<div class="hed-sub"><span class="hed-sub__label">${esc(s.label || kk)}</span><div class="hed-in"><input type="${s.type === 'url' ? 'url' : 'text'}" ${attrs({ ...path, value: val, maxlength: s.maxChars || null, placeholder: ph || null, 'aria-label': label })}>${s.type === 'url' ? '' : cnt(val, s.maxChars)}</div></div>`;
}
function listField(k, s, items, smpItems = []) {
  const max = s.max ?? 99;
  const one = s.label || '항목';
  return `<div class="hed-f">${fieldHead(s, `최대 ${max}개`)}
  ${items.map((it, i) => `<div class="hed-item"><div class="hed-item__head"><b>${esc(one)} ${i + 1}</b>${items.length > (s.min ?? 0) ? `<button type="button" class="icon-btn" data-act="del-item" data-f="${k}" data-i="${i}" aria-label="${esc(one)} ${i + 1} 빼기">✕</button>` : ''}</div>
    ${Object.entries(s.item || {}).map(([kk, raw]) => itemField(k, i, kk, RC.specOf(raw), it[kk], `${one} ${i + 1}`, it, smpItems[i])).join('')}
    ${s.item && s.item.label && !String(it.label || '').trim() ? '<p class="hed-hint">문구를 넣으면 버튼이 보여요</p>' : ''}
  </div>`).join('')}
  ${items.length < max ? `<button type="button" class="hed-add" data-act="add-item" data-f="${k}">+ ${esc(one)} 추가</button>` : ''}
</div>`;
}
const bgPreset = (key) => (REG.bgPresets || []).find((p) => p.key === key);
function mediaThumb(ref) {
  if (!ref) return '<span class="hed-media__none">없음</span>';
  if (ref.kind === 'css') { const p = bgPreset(ref.preset); return `<span class="hed-media__swatch${p && p.motion ? ' is-motion' : ''}" style="background:${esc(p ? p.swatch : '#000')}"></span>`; }
  const src = ref.file ? blobUrls[ref.file] : ref.src;
  if (!src) return '<span class="hed-media__none">파일을 다시<br>골라 주세요</span>';
  return ref.kind === 'video' ? `<video src="${esc(src)}" muted loop autoplay playsinline></video>` : `<img src="${esc(src)}" alt="">`;
}
function mediaName(ref) {
  if (!ref) return '없음';
  if (ref.kind === 'css') { const p = bgPreset(ref.preset); return p ? `${p.label}${p.motion ? ' · 움직임' : ''}` : ref.preset; }
  if (ref.file) return `${ref.name || '올린 파일'}${blobUrls[ref.file] ? '' : ' (다시 골라 주세요)'}`;
  return ref.src;
}
/** CSS 배경 프리셋 칩 — 슬롯에 cssPresets: true 일 때만 */
function bgPresetChips(k, dev, ref) {
  return `<div class="hed-bgfx" role="group" aria-label="CSS 배경"><span class="hed-sub__label">또는 CSS 배경 <span class="hed-f__opt">이미지·영상 없이 코드로 그려요</span></span>
  <div class="hed-bgfx__list">${(REG.bgPresets || []).map((p) => `<button type="button" class="hed-bgfx__b" ${attrs({ 'data-act': 'bg-preset', 'data-f': k, 'data-dev': dev, 'data-preset': p.key, 'aria-pressed': String(!!ref && ref.kind === 'css' && ref.preset === p.key), title: p.label + (p.motion ? ' · 천천히 움직여요' : '') })}><span class="hed-bgfx__sw${p.motion ? ' is-motion' : ''}" style="background:${esc(p.swatch)}"></span><span class="hed-bgfx__name">${esc(p.label)}</span></button>`).join('')}</div></div>`;
}
/** sample = 그 칸의 샘플 값 — 지금 값과 다르면(지웠거나 바꿨으면) 「되돌리기」로 샘플로 돌려요 */
function mediaBox(k, dev, ref, title, css, sample) {
  const restore = sample && JSON.stringify(sample) !== JSON.stringify(ref || null);
  return `<div class="hed-media">
  <div class="hed-media__thumb">${mediaThumb(ref)}</div>
  <div class="hed-media__info">
    <b>${title}${ref ? ` <span class="hed-media__kind">${ref.kind === 'css' ? 'CSS 배경' : ref.kind === 'video' ? '영상' : '이미지'}</span>` : ''}</b>
    <span class="hed-media__name" title="${esc(mediaName(ref))}">${esc(mediaName(ref))}</span>
    <div class="hed-media__btns"><button type="button" class="btn-ui" data-act="pick" data-f="${k}" data-dev="${dev}">파일 선택</button>${ref ? `<button type="button" class="btn-ui" data-act="clear" data-f="${k}" data-dev="${dev}">지우기</button>` : ''}${restore ? `<button type="button" class="btn-ui" data-act="restore" data-f="${k}" data-dev="${dev}" title="Figma 샘플로 되돌려요">되돌리기</button>` : ''}</div>
    <input type="url" class="hed-media__url" ${attrs({ 'data-f': k, 'data-dev': dev, 'data-k': 'url', placeholder: '또는 이미지·mp4 주소 붙여넣기', 'aria-label': `${title} 주소` })}>
  </div>
  ${css ? bgPresetChips(k, dev, ref) : ''}
</div>`;
}
/** smp = 샘플 편집 값의 그 칸 ({ pc, mo }) — 「되돌리기」용. single = PC·MO 같은 파일 하나(MO 따로 없음) */
function mediaField(k, s, m, smp = {}) {
  const css = !!s.cssPresets;
  if (s.pcOnly) return `<div class="hed-f">${fieldHead(s, s.hint || '이미지 · PC·TB 에만 보여요')}${mediaBox(k, 'pc', m.pc, 'PC · TB', css, smp.pc)}</div>`;
  if (s.single) return `<div class="hed-f">${fieldHead(s, s.hint || '이미지 · PC·TB·MO 같은 파일')}${mediaBox(k, 'pc', m.pc, 'PC · MO', css, smp.pc)}</div>`;
  return `<div class="hed-f">${fieldHead(s, s.hint || (css ? '이미지 · mp4 · CSS 배경 · PC 것은 TB 에도 쓰여요' : '이미지 또는 mp4 · PC 것은 TB 에도 쓰여요'))}
  ${mediaBox(k, 'pc', m.pc, 'PC · TB', css, smp.pc)}
  <label class="hed-check"><input type="checkbox" data-f="${k}" data-k="moSame"${m.moSame ? ' checked' : ''}> MO 도 PC ${esc(s.label || '')} 그대로 쓰기</label>
  ${m.moSame ? '' : mediaBox(k, 'mo', m.mo, 'MO', css, smp.mo)}
</div>`;
}
function heroForm(v, e) {
  const smp = editFrom(v, v.sample);
  return Object.entries(v.slots).map(([k, raw]) => {
    const s = RC.specOf(raw);
    if (s.type === 'richtext') return linesField(k, s, e[k], e['@mo'] && e['@mo'][k]);
    if (s.type === 'list') return listField(k, s, e[k], smp[k] || []);
    if (s.type === 'media') return mediaField(k, s, e[k], smp[k] || {});
    if (s.type === 'color') return colorField(k, s, e[k]);
    if (s.type === 'radius') return radiusField(k, s, e[k]);
    if (s.type === 'enum') return `<div class="hed-f">${fieldHead(s, s.note)}${enumChips({ 'data-f': k }, s, e[k], s.label)}</div>`;
    if (s.type === 'toggle') return `<div class="hed-f">${toggleBox({ 'data-f': k }, s, e[k])}</div>`;
    const note = [s.note, s.maxChars ? `최대 ${s.maxChars}자` : ''].filter(Boolean).join(' · ');
    return `<div class="hed-f">${fieldHead(s, note)}${textInput({ 'data-f': k }, e[k], s.maxChars, s.label)}</div>`;
  }).join('');
}

/* ---------- 화면 */
let heroFit = null;
let heroLoaded = false;
function renderHero() {
  const hs = heroState();
  if (!EDITORS.length) { heroEl.innerHTML = '<p class="compose__empty">편집기용 히어로가 아직 없어요 (meta.editor)</p>'; return; }
  const v = byId[hs.variant];
  const e = heroEdit(v);
  const keep = heroEl.querySelector('.compose__scroll')?.scrollTop || 0;
  heroEl.innerHTML = `<aside class="compose__side">${SPLIT}
  <div class="compose__scroll">
  <div class="hed-intro"><h2>히어로 편집기</h2><p>스타일을 고르고 문구·배경·버튼을 바꿔 보세요. 미리보기가 실제 결과예요 (기기는 위쪽 PC·TB·MO).</p></div>
  <div class="hed-styles" role="group" aria-label="히어로 스타일">${EDITORS.map((x) => {
    const bg = x.sample.background && x.sample.background.pc;
    const src = x.thumb || (bg && bg.kind === 'image' ? bg.src : '');
    const thumb = src ? ` style="background-image:url('${esc(new URL(src, assetBase).href)}')"` : '';
    return `<button type="button" class="hed-style" data-hed-variant="${x.id}" aria-pressed="${x.id === v.id}" title="${esc(x.when)}"><span class="hed-style__thumb"${thumb}></span><span class="hed-style__name">${esc(vname(x))}</span></button>`;
  }).join('')}</div>
  <p class="hed-style__when"><b>${esc(vname(v))}</b> ${esc(v.when)}</p>
  <div class="hed-form" data-hed-form>${heroForm(v, e)}</div>
  </div>
  <div class="compose__foot">
  <div class="compose__actions">
    <button type="button" class="btn-ui btn-ui--primary" data-hed-act="download">page.json 받기</button>
    <button type="button" class="btn-ui" data-hed-act="copy">page.json 복사</button>
    <button type="button" class="btn-ui" data-hed-act="reset">샘플로 되돌리기</button>
    <button type="button" class="btn-ui" data-hed-act="to-compose">조합기에서 보기</button>
    <button type="button" class="btn-ui" data-hed-act="figma" title="이 히어로 하나를 Figma 플러그인으로 가져가요 — 올린 이미지·영상도 함께 담겨요">Figma용으로 받기</button>
  </div>
  <p class="compose__hint">받은 page.json 과 배경 파일을 <code>pages/</code> 에 같이 넣고 <code>npm run build</code> → <code>dist/pages/이름/</code></p>
  </div>
  <input type="file" accept="image/*,video/mp4" hidden data-hed-file>
</aside>
<div class="compose__stage">
  <div class="stage-bar"><div class="hed-warn" data-hed-warn role="status" aria-live="polite"></div>${zoomBar()}</div>
  <div class="v__frame"><iframe title="히어로 미리보기"></iframe><span class="v__scale"></span></div>
</div>`;
  heroEl.querySelector('.compose__scroll').scrollTop = keep;
  syncPanel();
  const iframe = heroEl.querySelector('iframe');
  heroLoaded = false;
  heroFit = mountPreview(heroEl.querySelector('.compose__stage'), heroEl.querySelector('.v__frame'), iframe, heroEl.querySelector('.v__scale'), () => {
    heroLoaded = true;
    try { attachPreviewPick(iframe.contentDocument); } catch (err) {}
    try { const d = iframe.contentDocument; (d.fonts ? d.fonts.ready : Promise.resolve()).then(measureSoon); } catch (err) {}
    measureSoon();
  }, { zoomable: true });
  // 저장해 둔 파일을 불러온 뒤 그려요
  const keys = [];
  for (const m of Object.values(e)) if (m && typeof m === 'object' && 'moSame' in m) for (const r of [m.pc, m.mo]) if (r && r.file) keys.push(r.file);
  Promise.all(keys.map(loadBlob)).then((ok) => {
    if (ok.some(Boolean)) heroEl.querySelector('[data-hed-form]').innerHTML = heroForm(v, e);
    const html = heroHtmlOrError(v, e);
    iframe.srcdoc = srcdoc(html, v.css, v.js, v.stage);
  });
}
function heroHtmlOrError(v, e) {
  try { return renderHeroHtml(v, contentFrom(v, e, false)); } catch (err) { return `<p style="padding:24px;font:14px/1.6 system-ui;color:#c00">렌더 오류: ${esc(err.message)}</p>`; }
}
function redrawForm() {
  const v = byId[heroState().variant];
  const form = heroEl.querySelector('[data-hed-form]');
  if (form) form.innerHTML = heroForm(v, heroEdit(v));
}

/** 미리보기 갱신 — iframe 을 다시 읽지 않고 바뀐 부분만 바꿔요 (배경 영상이 계속 재생돼요) */
let heroTimer = null;
function heroUpdate() {
  clearTimeout(heroTimer);
  heroTimer = setTimeout(() => {
    save();
    const v = byId[heroState().variant];
    const html = heroHtmlOrError(v, heroEdit(v));
    const iframe = heroEl.querySelector('iframe');
    let doc = null;
    try { doc = iframe.contentDocument; } catch (err) {}
    if (!heroLoaded || !doc || !doc.body) { iframe.srcdoc = srcdoc(html, v.css, v.js, v.stage); return; }
    patchRoot(doc, html);
    measureSoon();
  }, 100);
}
function patchRoot(doc, html) {
  const cur = doc.body.firstElementChild;
  const tpl = doc.createElement('template');
  tpl.innerHTML = html;
  const next = tpl.content.firstElementChild;
  if (!next) return;
  const shell = (el) => el.cloneNode(false).outerHTML;
  if (!cur || cur.classList.contains('__guide') || shell(cur) !== shell(next) || cur.children.length !== next.children.length) {
    if (cur && !cur.classList.contains('__guide')) cur.replaceWith(next); else doc.body.prepend(next);
    return;
  }
  [...next.children].forEach((n, i) => { const c = cur.children[i]; if (c.outerHTML !== n.outerHTML) c.replaceWith(n); });
}

/* ---------- 줄 넘김 경고 — 지금 기기 폭에서 실제로 잰 값 */
let measureTimer = null;
function measureSoon() { clearTimeout(measureTimer); measureTimer = setTimeout(measureHero, 60); }
function measureHero() {
  const box = heroEl.querySelector('[data-hed-warn]');
  const iframe = heroEl.querySelector('iframe');
  if (!box || !iframe) return;
  let doc = null;
  try { doc = iframe.contentDocument; } catch (err) {}
  if (!doc || !doc.body) return;
  const v = byId[heroState().variant];
  const dev = `${DEVICE_LABEL[state.device]} ${DEVICE_W[state.device]}`;
  const lineCount = (el) => {
    const r = doc.createRange();
    r.selectNodeContents(el);
    const tops = new Set();
    for (const b of r.getClientRects()) if (b.width > 1) tops.add(Math.round(b.top));
    return tops.size;
  };
  const msgs = [];
  for (const [slot, sel] of MEASURE) {
    const el = doc.querySelector(sel);
    if (!el || !v.slots[slot]) continue;
    const label = v.slots[slot].label || slot;
    const parts = [...el.querySelectorAll('.hero__line')].filter((x) => x.getClientRects().length);
    const lines = parts.length ? parts : [el];
    lines.forEach((ln, i) => {
      const n = lineCount(ln);
      const which = parts.length > 1 ? ` ${i + 1}번째 줄` : '';
      if (n > 1) msgs.push(`${label}${which}: ${n}줄로 넘어가요`);
      else if (ln.scrollWidth > ln.clientWidth + 1) msgs.push(`${label}${which}: 화면 폭을 넘어요`);
    });
  }
  const btns = doc.querySelector('.hero__btns');
  if (btns && btns.scrollWidth > btns.clientWidth + 1) msgs.push('버튼: 화면 폭을 넘어요');
  box.className = 'hed-warn' + (msgs.length ? ' is-warn' : ' is-ok');
  box.innerHTML = msgs.length
    ? `<b>${dev}</b> · ${msgs.map(esc).join(' · ')} <span class="hed-warn__tip">문구를 줄이거나 줄을 나눠 보세요</span>`
    : `<b>${dev}</b> · 줄 넘김 없음 <span class="hed-warn__tip">다른 기기는 위쪽 PC·TB·MO 로 확인</span>`;
}

/* ---------- 미리보기에서 이미지 바꾸기 — 섹션 안 비주얼(visual 슬롯)을 클릭하면 파일 선택이 열려요
   안내 말풍선은 ::before 를 써요 (::after 는 비주얼 하단 그라데이션 등이 써요) */
const PICK_AREAS = { visual: '.hero__visual', speaker1: '[data-pick="speaker1"]', speaker2: '[data-pick="speaker2"]', speaker3: '[data-pick="speaker3"]' };
function attachPreviewPick(doc, el = heroEl, variantAt = () => byId[heroState().variant], edit = heroEdit) {
  if (!doc || doc.__hedPick) return;
  doc.__hedPick = true;
  const st = doc.createElement('style');
  // 목록 항목 이미지(월간휴넷 카드 사진 등)는 템플릿이 감싼 요소에 data-pick-item="목록:번호:필드" 를 붙여요
  st.textContent = [...Object.values(PICK_AREAS), '[data-pick-item]'].map((sel) => `${sel}{position:relative;cursor:pointer}${sel}:hover{outline:3px dashed #3a50c9;outline-offset:-3px}${sel}:hover::before{content:"클릭해서 이미지·영상 바꾸기";position:absolute;top:16px;left:50%;right:auto;bottom:auto;width:auto;height:auto;transform:translateX(-50%);z-index:5;padding:6px 12px;border-radius:6px;background:#3a50c9;color:#fff;font:600 14px/1.4 system-ui,sans-serif;white-space:nowrap;pointer-events:none}`).join('')
    + '[data-pick-item]:hover::before{content:"클릭해서 바꾸기";top:8px;padding:4px 8px;font-size:12px}'; // 작은 사진(아바타 72)에도 맞게
  doc.head.appendChild(st);
  doc.addEventListener('click', (ev) => {
    const v = variantAt(ev.target);
    if (!v) return;
    const it = ev.target.closest('[data-pick-item]');
    if (it) {
      const [f, i, k] = it.dataset.pickItem.split(':');
      if (v.slots[f] && Array.isArray(edit(v)[f]) && edit(v)[f][+i]) { pickTarget = { f, i: +i, k, vid: v.id }; el.querySelector('[data-hed-file]').click(); }
      return;
    }
    for (const [f, sel] of Object.entries(PICK_AREAS)) {
      if (!ev.target.closest(sel) || !v.slots[f]) continue;
      const m = edit(v)[f];
      pickTarget = { f, vid: v.id, dev: state.device === 'mo' && m && !m.moSame && !RC.specOf(v.slots[f]).pcOnly ? 'mo' : 'pc' };
      el.querySelector('[data-hed-file]').click();
      return;
    }
  });
}

/* ---------- page.json */
function heroPage() {
  const v = byId[heroState().variant];
  return { title: `${vname(v)} 히어로 시안`, theme: 'light', sections: [{ variant: v.id, content: contentFrom(v, heroEdit(v), true) }] };
}
/** 편집 값 안의 올린 파일을 page.json 이 가리키는 이름으로 내려받아요 */
function downloadMedia(v, e, pre) {
  for (const [k, raw] of Object.entries(v.slots)) {
    if (RC.specOf(raw).type !== 'media' || !e[k]) continue;
    for (const dev of ['pc', 'mo']) {
      const ref = e[k][dev];
      if (dev === 'mo' && e[k].moSame) continue;
      if (ref && ref.file && files[ref.file]) download(exportName(k, dev, ref, pre), files[ref.file]);
    }
  }
  for (const { k, i, kk, ref } of listUploads(v, e)) if (files[ref.file]) download(itemImageName(pre, k, i, kk, ref), files[ref.file]);
}
function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- 이벤트 — 폼 입력은 히어로 편집기 · 페이지 템플릿 편집기가 함께 써요
   ctx = { el, variantOf(target) → variant, edit(v) → 편집 값, redraw(v) 폼 다시 그리기, update(v) 미리보기 갱신 } */
let pickTarget = null;
const at = (el) => ({ f: el.dataset.f, i: el.dataset.i != null ? +el.dataset.i : null, k: el.dataset.k, line: el.dataset.line != null ? +el.dataset.line : null, dev: el.dataset.dev });
function bindEditorForm(ctx) {
  const { el } = ctx;
  // 자유 색 고르기 — 끄는 동안은 폼을 다시 그리지 않고 값·점 위치만 바꿔요
  const cpSet = (cp, hex, a, hsv) => {
    const v = ctx.variantOf(cp);
    if (!v) return;
    const e = ctx.edit(v);
    const p = at(cp);
    const val = cpValue(hex, a);
    if (p.i != null) e[p.f][p.i][p.k] = val; else e[p.f] = val;
    const h = hsv ? hsv.h : cpHsv(hex).h;
    const sv = hsv || cpHsv(hex);
    cp.dataset.h = String(Math.round(h));
    cp.querySelector('[data-cp-sv]').style.setProperty('--h', String(Math.round(h)));
    Object.assign(cp.querySelector('.cp__dot').style, { left: (sv.s * 100).toFixed(1) + '%', top: ((1 - sv.v) * 100).toFixed(1) + '%' });
    cp.querySelector('[data-cp-hue] .cp__knob').style.left = (h / 3.6).toFixed(1) + '%';
    cp.querySelector('[data-cp-alpha]').style.setProperty('--c', '#' + hex);
    cp.querySelector('[data-cp-alpha] .cp__knob').style.left = a + '%';
    const hx = cp.querySelector('[data-cp-hex]'); if (document.activeElement !== hx) hx.value = hex.toUpperCase();
    const ai = cp.querySelector('[data-cp-a]'); if (document.activeElement !== ai) ai.value = String(a);
    const now = cp.closest('.hed-f') && cp.closest('.hed-f').querySelector('[data-cp-now]');
    if (now) now.innerHTML = `<code>#${hex.toUpperCase()}${a < 100 ? ` · ${a}%` : ''}</code>`;
    const bt = cp.closest('.hed-f') && cp.closest('.hed-f').querySelector('.cp-head [data-val=""]');
    if (bt) bt.setAttribute('aria-pressed', 'false');
    ctx.update(v);
  };
  const cpCur = (cp) => {
    const hx = cp.querySelector('[data-cp-hex]').value.replace('#', '');
    const c = cpHex(hx) || { hex: 'ffffff', a: 100 };
    return { hex: c.hex, a: Math.max(0, Math.min(100, +cp.querySelector('[data-cp-a]').value || 0)) };
  };
  el.addEventListener('pointerdown', (ev) => {
    const area = ev.target.closest('[data-cp-sv], [data-cp-hue], [data-cp-alpha]');
    if (!area || ev.button !== 0) return;
    ev.preventDefault();
    const cp = area.closest('[data-cp]');
    const move = (e2) => {
      const r = area.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e2.clientX - r.left) / r.width));
      const y = Math.max(0, Math.min(1, (e2.clientY - r.top) / r.height));
      const cur = cpCur(cp);
      const hsv = cpHsv(cur.hex);
      hsv.h = +cp.dataset.h || hsv.h; // 회색·흰색에서도 고른 색상을 기억해요
      if (area.matches('[data-cp-sv]')) { hsv.s = x; hsv.v = 1 - y; cpSet(cp, cpFromHsv(hsv), cur.a, hsv); }
      else if (area.matches('[data-cp-hue]')) { hsv.h = x * 360; cpSet(cp, cpFromHsv(hsv), cur.a, hsv); }
      else cpSet(cp, cur.hex, Math.round(x * 100), { ...hsv });
    };
    move(ev);
    try { area.setPointerCapture(ev.pointerId); } catch (err) {}
    const up = () => { area.removeEventListener('pointermove', move); area.removeEventListener('pointerup', up); area.removeEventListener('pointercancel', up); };
    area.addEventListener('pointermove', move); area.addEventListener('pointerup', up); area.addEventListener('pointercancel', up);
  });
  el.addEventListener('input', (ev) => {
    const t = ev.target;
    if (!t.matches('[data-cp-hex], [data-cp-a]')) return;
    const cp = t.closest('[data-cp]');
    const c = cpHex(cp.querySelector('[data-cp-hex]').value.trim().replace('#', ''));
    if (!c) return; // 6자리가 될 때까지 기다려요
    cpSet(cp, c.hex, cpCur(cp).a);
  });
  el.addEventListener('click', async (ev) => {
    const eye = ev.target.closest('[data-cp-eye]');
    if (!eye || !window.EyeDropper) return;
    try { const r = await new window.EyeDropper().open(); const c = cpHex(r.sRGBHex); const cp = eye.closest('[data-cp]'); if (c) cpSet(cp, c.hex, cpCur(cp).a); } catch (err) {} // Esc 로 취소
  });
  el.addEventListener('input', (ev) => {
    const t = ev.target;
    if (!t.matches('input[type="text"][data-f], input[type="url"][data-f][data-i], textarea[data-f][data-i]')) return;
    const v = ctx.variantOf(t);
    if (!v) return;
    const e = ctx.edit(v);
    const p = at(t);
    if (p.line != null && p.dev === 'mo') e['@mo'][p.f][p.line] = t.value;
    else if (p.line != null) e[p.f][p.line] = t.value;
    else if (p.i != null) e[p.f][p.i][p.k] = t.value;
    else e[p.f] = t.value;
    const c = t.parentElement.querySelector('[data-cnt]');
    if (c) {
      const max = +c.dataset.cnt || 0;
      const n = RC.charCount(t.value);
      c.textContent = max ? `${n}/${max}` : `${n}자`;
      c.className = 'hed-cnt' + (max && n > max ? ' is-over' : max && n === max ? ' is-full' : '');
    }
    ctx.update(v);
  });
  el.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.matches('[data-hed-file]')) {
      if (!t.files || !t.files[0] || !pickTarget) return;
      const v = byId[pickTarget.vid];
      const e = ctx.edit(v);
      const file = t.files[0];
      const { f, dev, i, k } = pickTarget;
      const key = i != null ? `${v.id}:${f}:${i}:${k}` : `${v.id}:${f}:${dev}`;
      if (blobUrls[key]) URL.revokeObjectURL(blobUrls[key]);
      files[key] = file;
      blobUrls[key] = URL.createObjectURL(file);
      idb.put(key, file);
      if (i != null) { const old = e[f][i][k]; e[f][i][k] = { file: key, name: file.name, ...(old && old.alt ? { alt: old.alt } : {}) }; } // 목록 항목 이미지
      else e[f][dev] = { kind: file.type.startsWith('video/') ? 'video' : 'image', file: key, name: file.name };
      t.value = '';
      ctx.redraw(v); ctx.update(v);
      return;
    }
    const v = ctx.variantOf(t);
    if (!v) return;
    const e = ctx.edit(v);
    if (t.matches('[data-k="moSame"]')) { e[t.dataset.f].moSame = t.checked; ctx.redraw(v); ctx.update(v); return; }
    if (t.matches('[data-mo-sep]')) {
      const k = t.dataset.moSep;
      if (t.checked) (e['@mo'] ||= {})[k] = [...(e[k] || [])];
      else if (e['@mo']) delete e['@mo'][k];
      ctx.redraw(v); ctx.update(v); return;
    }
    if (t.matches('[data-toggle]')) { const p = at(t); if (p.i != null) e[p.f][p.i][p.k] = t.checked; else e[p.f] = t.checked; ctx.update(v); return; }
    if (t.matches('select[data-f][data-i]')) { const p = at(t); e[p.f][p.i][p.k] = t.value; ctx.update(v); return; }
    if (t.matches('.hed-media__url')) {
      const url = t.value.trim();
      if (!url) return;
      const p = at(t);
      e[p.f][p.dev] = { kind: /\.(mp4|webm|mov)(\?|#|$)/i.test(url) ? 'video' : 'image', src: url };
      ctx.redraw(v); ctx.update(v);
    }
  });
  el.addEventListener('click', (ev) => {
    const hit = ev.target.closest('[data-val], [data-act]');
    if (!hit) return;
    const v = ctx.variantOf(hit);
    if (!v) return;
    const e = ctx.edit(v);
    const p = at(hit);
    if (hit.matches('[data-val]')) { if (p.i != null) e[p.f][p.i][p.k] = hit.dataset.val; else e[p.f] = hit.dataset.val; ctx.redraw(v); ctx.update(v); return; }
    const s = RC.specOf(v.slots[p.f]);
    switch (hit.dataset.act) {
      case 'add-line': { const ls = p.dev === 'mo' ? e['@mo'][p.f] : e[p.f]; if (ls.length === 0) ls.push(''); ls.push(''); break; }
      case 'del-line': (p.dev === 'mo' ? e['@mo'][p.f] : e[p.f]).splice(p.line, 1); break;
      case 'add-item': e[p.f].push(Object.fromEntries(Object.entries(RC.contextFor(s.item, {})).map(([kk, vv]) => [kk, blank(vv)]))); break;
      case 'del-item': e[p.f].splice(p.i, 1); break;
      case 'clear': if (p.i != null) e[p.f][p.i][p.k] = null; else e[p.f][p.dev] = null; break;
      case 'restore': {
        const smp = editFrom(v, v.sample)[p.f];
        if (p.i != null) e[p.f][p.i][p.k] = (smp && smp[p.i] && smp[p.i][p.k]) || null;
        else e[p.f][p.dev] = (smp || {})[p.dev] || null;
        break;
      }
      case 'bg-preset': e[p.f][p.dev] = { kind: 'css', preset: hit.dataset.preset }; break;
      case 'pick': pickTarget = { ...p, vid: v.id }; el.querySelector('[data-hed-file]').click(); return;
      default: return;
    }
    ctx.redraw(v); ctx.update(v);
  });
}
bindEditorForm({ el: heroEl, variantOf: () => byId[heroState().variant], edit: heroEdit, redraw: redrawForm, update: heroUpdate });
heroEl.addEventListener('click', (ev) => {
  const v = byId[heroState().variant];
  const e = heroEdit(v);
  const sv = ev.target.closest('[data-hed-variant]');
  if (sv) { heroState().variant = sv.dataset.hedVariant; save(); renderHero(); return; }
  const ha = ev.target.closest('[data-hed-act]');
  if (!ha) return;
  const json = JSON.stringify(heroPage(), null, 2) + '\n';
  if (ha.dataset.hedAct === 'copy') return copyText(json, ha);
  if (ha.dataset.hedAct === 'download') {
    download(`hero-${vname(v)}.page.json`, new Blob([json], { type: 'application/json' }));
    downloadMedia(v, e); // 올린 배경 파일도 page.json 이 가리키는 이름으로 함께 받아요
    return;
  }
  if (ha.dataset.hedAct === 'figma') {
    ha.disabled = true;
    figmaBundle(heroPage(), [{ i: 0, variant: v.id }])
      .then((out) => download(`hero-${vname(v)}.figma.json`, new Blob([out], { type: 'application/json' })))
      .finally(() => { ha.disabled = false; });
    return;
  }
  if (ha.dataset.hedAct === 'to-compose') {
    // 조합기의 같은 섹션 행을 이 스타일 + 편집기 내용으로 (없으면 맨 위에 넣어요) — 복사가 아니라 연결이에요
    const rows = state.compose.rows;
    const r = rows.find((x) => byId[x.variant] && byId[x.variant].section === v.section);
    if (r) { r.variant = v.id; r.src = 'editor'; r.options = []; } else rows.unshift({ variant: v.id, src: 'editor' });
    state.mode = 'compose'; applyAll(); window.scrollTo(0, 0);
    return;
  }
  if (ha.dataset.hedAct === 'reset' && confirm('입력한 내용을 지우고 Figma 샘플로 되돌릴까요?')) {
    heroState().edits[v.id] = editFrom(v, v.sample);
    save(); renderHero();
  }
});

/* ---------------------------------------------------------------- 페이지 템플릿 편집기 (templates/ — 월간휴넷 등)
   템플릿의 모든 섹션 슬롯으로 폼을 만들어 전체 문구를 편집해요. 폼·렌더·저장 방식은 히어로 편집기와 같아요.
   편집 값: state.tpl[템플릿].edits[variant] (올린 파일은 같은 IndexedDB). 내보내는 파일 이름 앞에는 섹션 이름(layout)을 붙여요 */
const TEMPLATES = REG.templates || [];
const tplByKey = Object.fromEntries(TEMPLATES.map((t) => [t.key, t]));
const tplEl = document.getElementById('tpl-editor');
const tplKey = () => (String(state.mode).startsWith('tpl:') ? state.mode.slice(4) : null);
function tplState(key) {
  state.tpl ||= {};
  const t = (state.tpl[key] ||= {});
  t.edits ||= {};
  t.open ||= [];
  t.pick ||= {};
  t.off ||= [];
  return t;
}
function tplEdit(v) {
  const ts = tplState(v.section);
  if (!ts.edits[v.id]) ts.edits[v.id] = editFrom(v, v.sample);
  else fixStaleAssets(v, ts.edits[v.id]);
  return ts.edits[v.id];
}
const tplEditOf = (id) => tplEdit(byId[id]);
const tplSecHtml = (v) => heroHtmlOrError(v, tplEdit(v)).replace(/^(\s*)<([a-z][\w-]*)/, `$1<$2 data-tpl-sec="${v.id}"`);
/* 자리(row) — 섹션 하나, 또는 여럿 중 하나를 고르는 자리(template.json 의 pick). 자리마다 넣기·빼기를 해요
   state.tpl[key].pick[자리] = 고른 variant · off = 뺀 자리 목록 (자리 키 = 그 자리 variant id 를 | 로 이은 것) */
const rowKey = (r) => r.ids.join('|');
const rowPick = (t, r) => { const p = tplState(t.key).pick[rowKey(r)]; return r.ids.includes(p) ? p : r.ids[0]; };
const rowOn = (t, r) => !tplState(t.key).off.includes(rowKey(r));
const tplRows = (t) => t.rows || t.variants.map((id) => ({ ids: [id] }));
const rowOf = (t, id) => tplRows(t).find((r) => r.ids.includes(id));
/** 페이지에 들어가는 섹션 — 넣은 자리의 고른 섹션만, 순서대로 */
const tplVisible = (t) => tplRows(t).filter((r) => rowOn(t, r)).map((r) => rowPick(t, r));
function tplBlock(t, r) {
  const id = rowPick(t, r);
  const v = byId[id];
  const on = rowOn(t, r);
  const open = on && tplState(t.key).open.includes(id);
  const key = rowKey(r);
  return `<section class="tpl-sec${open ? ' is-open' : ''}${on ? '' : ' is-off'}" data-vid="${id}" data-row="${esc(key)}">
  <div class="tpl-sec__bar">
    <label class="tpl-sec__on" title="${on ? '페이지에서 빼기' : '페이지에 넣기'}"><input type="checkbox" data-tpl-on="${esc(key)}"${on ? ' checked' : ''} aria-label="${esc(r.label || v.label || v.layout)} 넣기"></label>
    <button type="button" class="tpl-sec__head" data-tpl-toggle="${id}" aria-expanded="${open}"${on ? '' : ' disabled'}><span class="tpl-sec__caret" aria-hidden="true">${open ? '▾' : '▸'}</span><span class="tpl-sec__name">${esc(r.label || v.label || v.layout)}</span><span class="tpl-sec__layout">${on ? esc(v.layout) : '빠짐'}</span></button>
  </div>
  ${r.ids.length > 1 && on ? `<div class="tpl-sec__pick" role="group" aria-label="${esc(r.label || '')} 고르기">${r.ids.map((x) => `<button type="button" class="chip" data-tpl-pick="${esc(key)}" data-id="${x}" aria-pressed="${String(x === id)}">${esc(byId[x].label || byId[x].layout)}</button>`).join('')}</div>` : ''}
  ${open ? `<div class="hed-form" data-hed-form>${heroForm(v, tplEdit(v))}</div>` : ''}
</section>`;
}
let tplFit = null;
let tplLoaded = false;
function renderTpl() {
  const t = tplByKey[tplKey()];
  if (!t) return;
  const vs = tplVisible(t).map((id) => byId[id]);
  const rows = tplRows(t);
  const todo = (t.order || []).filter((l) => !vs.some((v) => v.layout === l));
  const keep = tplEl.querySelector('.compose__scroll')?.scrollTop || 0;
  tplEl.innerHTML = `<aside class="compose__side">${SPLIT}
  <div class="compose__scroll">
  <div class="hed-intro"><h2>${esc(t.title)}</h2><p>섹션을 펼쳐 문구·이미지를 바꿔요. 미리보기에서 섹션을 누르면 그 입력칸이 열려요.</p></div>
  <div class="rows__bar"><span>섹션 ${vs.length}/${rows.length}개</span><button type="button" class="btn-ui" data-tpl-fold="1">모두 접기</button><button type="button" class="btn-ui" data-tpl-fold="0">모두 펴기</button></div>
  <div class="tpl-secs">${rows.map((r) => tplBlock(t, r)).join('')}</div>
  ${todo.length ? `<p class="compose__hint">준비 중: ${todo.map(esc).join(' · ')}</p>` : ''}
  </div>
  <div class="compose__foot">
  <div class="compose__actions">
    <button type="button" class="btn-ui btn-ui--primary" data-tpl-act="download">page.json 받기</button>
    <button type="button" class="btn-ui" data-tpl-act="copy">page.json 복사</button>
    <button type="button" class="btn-ui" data-tpl-act="figma" title="Figma 플러그인으로 가져가요 — 올린 이미지·영상도 함께 담겨요">Figma용으로 받기</button>
    <button type="button" class="btn-ui" data-tpl-act="reset">샘플로 되돌리기</button>
  </div>
  <p class="compose__hint">받은 page.json 과 올린 파일을 <code>pages/</code> 에 같이 넣고 <code>npm run build</code> → <code>dist/pages/이름/</code> · <a href="${esc(t.figmaSet)}" target="_blank" rel="noopener">Figma 원본</a></p>
  </div>
  <input type="file" accept="image/*,video/mp4" hidden data-hed-file>
</aside>
<div class="compose__stage">
  <div class="stage-bar">${zoomBar()}</div>
  <div class="v__frame"><iframe title="${esc(t.title)} 미리보기"></iframe><span class="v__scale"></span></div>
</div>`;
  tplEl.querySelector('.compose__scroll').scrollTop = keep;
  syncPanel();
  const iframe = tplEl.querySelector('iframe');
  tplLoaded = false;
  tplFit = mountPreview(tplEl.querySelector('.compose__stage'), tplEl.querySelector('.v__frame'), iframe, tplEl.querySelector('.v__scale'), () => {
    tplLoaded = true;
    try {
      const doc = iframe.contentDocument;
      const secOf = (el) => { const sec = el.closest('[data-tpl-sec]'); return sec ? byId[sec.dataset.tplSec] : null; };
      attachPreviewPick(doc, tplEl, secOf, tplEdit);
      doc.addEventListener('click', (ev) => { const v = secOf(ev.target); if (v) tplOpen(v.id, true); });
    } catch (err) {}
  }, { zoomable: true });
  const css = [...new Set(vs.map((v) => v.css))].join('\n\n');
  const js = [...new Set(vs.map((v) => v.js).filter(Boolean))].join('\n');
  Promise.all(vs.flatMap((v) => mediaKeys(tplEdit(v))).map(loadBlob)).then(() => {
    iframe.srcdoc = srcdoc(vs.map(tplSecHtml).join('\n'), css, js, null);
  });
}
/** 섹션 입력칸 펴기·접기 (scroll = 펴고 그 칸으로 이동) */
function tplOpen(id, scroll) {
  const v = byId[id];
  const t = tplByKey[v.section];
  const r = rowOf(t, id);
  const ts = tplState(v.section);
  const open = ts.open.includes(id);
  if (scroll && open) { tplEl.querySelector(`[data-vid="${id}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
  ts.open = open ? ts.open.filter((x) => x !== id) : [...ts.open, id];
  save();
  const el = tplEl.querySelector(`[data-vid="${id}"]`);
  if (!el || !r) return;
  el.outerHTML = tplBlock(t, r);
  if (scroll) tplEl.querySelector(`[data-vid="${id}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
}
const tplTimers = {};
function tplUpdate(v) {
  clearTimeout(tplTimers[v.id]);
  tplTimers[v.id] = setTimeout(() => {
    save();
    const iframe = tplEl.querySelector('iframe');
    let doc = null;
    try { doc = iframe.contentDocument; } catch (err) {}
    const cur = tplLoaded && doc && doc.querySelector(`[data-tpl-sec="${v.id}"]`);
    if (!cur) return;
    // 바뀐 자식만 바꿔요 (배경 영상이 계속 재생돼요)
    const tpl = doc.createElement('template');
    tpl.innerHTML = tplSecHtml(v);
    const next = tpl.content.firstElementChild;
    if (!next) return;
    const shell = (el) => el.cloneNode(false).outerHTML;
    if (shell(cur) !== shell(next) || cur.children.length !== next.children.length) cur.replaceWith(next);
    else [...next.children].forEach((n, i) => { const c = cur.children[i]; if (c.outerHTML !== n.outerHTML) c.replaceWith(n); });
  }, 100);
}
function tplPage(key) {
  const t = tplByKey[key];
  return { title: t.title, theme: 'light', sections: tplVisible(t).map((id) => ({ variant: id, content: contentFrom(byId[id], tplEditOf(id), true, byId[id].layout) })) };
}
// 섹션 넣기·빼기 (체크 끄면 페이지·page.json 에서 빠져요 — 입력한 내용은 그대로 남아요)
tplEl.addEventListener('change', (ev) => {
  const cb = ev.target.closest('[data-tpl-on]');
  if (!cb) return;
  const ts = tplState(tplKey());
  const k = cb.dataset.tplOn;
  ts.off = cb.checked ? ts.off.filter((x) => x !== k) : [...new Set([...ts.off, k])];
  save(); renderTpl();
});
bindEditorForm({
  el: tplEl,
  variantOf: (t) => { const b = t.closest('[data-vid]'); return b ? byId[b.dataset.vid] : null; },
  edit: tplEdit,
  redraw: (v) => { const f = tplEl.querySelector(`[data-vid="${v.id}"] [data-hed-form]`); if (f) f.innerHTML = heroForm(v, tplEdit(v)); },
  update: tplUpdate,
});
tplEl.addEventListener('click', (ev) => {
  const key = tplKey();
  const t = tplByKey[key];
  if (!t) return;
  const tg = ev.target.closest('[data-tpl-toggle]');
  if (tg) { tplOpen(tg.dataset.tplToggle); return; }
  const fd = ev.target.closest('[data-tpl-fold]');
  if (fd) { tplState(key).open = fd.dataset.tplFold === '1' ? [] : tplVisible(t); save(); tplEl.querySelector('.tpl-secs').innerHTML = tplRows(t).map((r) => tplBlock(t, r)).join(''); return; }
  // 자리에서 섹션 고르기 (예: 추천 대상 — 체크 / 카드) → 그 섹션 입력칸을 열고 미리보기를 다시 그려요
  const pk = ev.target.closest('[data-tpl-pick]');
  if (pk) {
    const ts = tplState(key);
    ts.pick[pk.dataset.tplPick] = pk.dataset.id;
    if (!ts.open.includes(pk.dataset.id)) ts.open.push(pk.dataset.id);
    save(); renderTpl(); return;
  }
  const ta = ev.target.closest('[data-tpl-act]');
  if (!ta) return;
  const json = JSON.stringify(tplPage(key), null, 2) + '\n';
  if (ta.dataset.tplAct === 'copy') return copyText(json, ta);
  if (ta.dataset.tplAct === 'download') {
    download(`${key}.page.json`, new Blob([json], { type: 'application/json' }));
    for (const id of tplVisible(t)) downloadMedia(byId[id], tplEditOf(id), byId[id].layout);
    return;
  }
  if (ta.dataset.tplAct === 'figma') {
    ta.disabled = true;
    figmaBundle(tplPage(key), tplVisible(t).map((variant, i) => ({ i, variant })), tplEditOf, (v) => v.layout)
      .then((out) => download(`${key}.figma.json`, new Blob([out], { type: 'application/json' })))
      .finally(() => { ta.disabled = false; });
    return;
  }
  if (ta.dataset.tplAct === 'reset' && confirm(`${t.title} — 입력한 내용을 모두 지우고 Figma 샘플로 되돌릴까요?`)) {
    tplState(key).edits = {};
    save(); renderTpl();
  }
});

/* ---------------------------------------------------------------- shared */
function copyText(text, btn) {
  const done = () => { const t = btn.textContent; btn.textContent = '복사됨'; btn.classList.add('is-done'); setTimeout(() => { btn.textContent = t; btn.classList.remove('is-done'); }, 1400); };
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => {});
}

document.addEventListener('click', (e) => { if (!e.target.closest('[data-figmenu]')) closeFigmaMenus(); }, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeFigmaMenus(); });
document.addEventListener('click', (e) => {
  const cp = e.target.closest('[data-copy]');
  if (cp) { copyText(cp.parentElement.querySelector('code').textContent, cp); return; }
  const tg = e.target.closest('[data-toggle]');
  if (tg) {
    // 섹션 이름: 펼침/접힘을 그 섹션만 바꾸고, 본문은 그 섹션으로 보여줘요
    const k = tg.dataset.toggle;
    if (k === state.cat || !isOpen(k)) state.open = isOpen(k) ? state.open.filter((x) => x !== k) : [...state.open, k];
    if (k !== state.cat) { state.cat = k; history.replaceState(null, '', '#' + k); renderCat(); window.scrollTo(0, 0); }
    renderSide(); save(); return;
  }
  const nav = e.target.closest('[data-nav]');
  if (nav) {
    e.preventDefault();
    const id = nav.dataset.nav;
    if (byId[id].section !== state.cat) { state.cat = byId[id].section; renderCat(); renderSide(); save(); }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', '#' + id);
    sideEl.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('is-current', a.dataset.nav === id));
    return;
  }
  const zb = e.target.closest('[data-zoom]');
  if (zb) { const z = zb.dataset.zoom; state.zoom = z === 'fit' ? 'fit' : Number(z); syncZoom(); save(); return; }
  const m = e.target.closest('[data-mode]');
  if (m) { state.mode = m.dataset.mode; applyAll(); return; }
  const oe = e.target.closest('[data-open-editor]');
  if (oe) { heroState().variant = oe.dataset.openEditor; state.mode = 'hero'; applyAll(); window.scrollTo(0, 0); return; }
  const vw = e.target.closest('[data-view]');
  if (vw) { state.view = vw.dataset.view; applyGlobal(); cards.forEach((c) => c.links()); save(); if (state.mode === 'library') renderCat(); return; }
  const dv = e.target.closest('[data-device]');
  if (dv) { state.device = dv.dataset.device; applyGlobal(); cards.forEach((c) => { c.apply(); c.fit(); }); composeFit && composeFit(); heroFit && heroFit(); tplFit && tplFit(); if (state.mode === 'hero') measureSoon(); save(); }
});

/* 패널 폭 드래그 — 조합기·히어로 편집기 공통 (끄는 동안 미리보기 iframe 이 마우스를 가로채지 않게 막아요) */
document.addEventListener('pointerdown', (e) => {
  const h = e.target.closest('[data-split]');
  if (!h || e.button !== 0) return;
  e.preventDefault();
  const host = h.closest('.compose');
  const left = host.getBoundingClientRect().left;
  document.body.classList.add('is-resizing');
  try { h.setPointerCapture(e.pointerId); } catch (err) {}
  const move = (ev) => { state.panelW = clampPanel(ev.clientX - left); syncPanel(); };
  const up = () => {
    document.body.classList.remove('is-resizing');
    h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
    save();
  };
  h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
});
document.addEventListener('dblclick', (e) => { if (e.target.closest('[data-split]')) { state.panelW = PANEL_W.def; syncPanel(); save(); } });
document.addEventListener('keydown', (e) => {
  const h = e.target.closest && e.target.closest('[data-split]');
  if (!h || !['ArrowLeft', 'ArrowRight', 'Home'].includes(e.key)) return;
  e.preventDefault();
  const cur = clampPanel(state.panelW || PANEL_W.def);
  state.panelW = e.key === 'Home' ? PANEL_W.def : clampPanel(cur + (e.key === 'ArrowRight' ? 20 : -20));
  syncPanel(); save();
});
window.addEventListener('resize', syncPanel);

function applyGlobal() {
  document.body.classList.toggle('is-dev', state.view === 'dev');
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
  document.querySelectorAll('[data-device]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.device === state.device)));
  document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === state.mode)));
  libraryEl.hidden = state.mode !== 'library';
  // 디자이너/개발자 보기는 라이브러리에서만 의미가 있어요 (조합기는 숨김)
  document.querySelector('[data-view-seg]').hidden = state.mode !== 'library';
  composeEl.hidden = state.mode !== 'compose';
  heroEl.hidden = state.mode !== 'hero';
  tplEl.hidden = !tplKey();
  const top = document.getElementById('top');
  document.documentElement.style.setProperty('--top-h', top.offsetHeight + 'px');
}

function applyAll() {
  applyGlobal();
  if (state.mode === 'library') { renderSide(); renderCat(); } else if (state.mode === 'compose') { renderCompose(); } else if (tplKey()) { renderTpl(); } else { renderHero(); }
  // 히어로 편집기는 #hero-editor 주소로 바로 열려요 (기획자에게 링크 전달용)
  // 페이지 템플릿 편집기는 #tpl-<템플릿> (예: #tpl-monthly-hunet)
  if (state.mode === 'hero') history.replaceState(null, '', '#hero-editor');
  else if (tplKey()) history.replaceState(null, '', '#tpl-' + tplKey());
  else if (location.hash === '#hero-editor' || location.hash.startsWith('#tpl-')) history.replaceState(null, '', '#' + state.cat);
  save();
}

// 페이지 템플릿 탭 — 히어로 편집기 다음에 템플릿마다 하나씩
document.querySelector('.seg--mode').insertAdjacentHTML('beforeend', TEMPLATES.map((t) => `<button type="button" role="tab" data-mode="tpl:${esc(t.key)}" aria-selected="false">${esc(t.title)}</button>`).join(''));

// #hero 또는 #hero-media-badge 로 바로 열기, #hero-editor 는 히어로 편집기
const h = decodeURIComponent(location.hash.slice(1));
let jumpTo = null;
if (h === 'hero-editor') state.mode = 'hero';
else if (h.startsWith('tpl-') && tplByKey[h.slice(4)]) state.mode = 'tpl:' + h.slice(4);
else if (secByKey[h]) state.cat = h;
else if (byId[h]) { state.cat = byId[h].section; state.mode = 'library'; jumpTo = h; }
if (!isOpen(state.cat)) state.open.push(state.cat);
applyAll();
if (jumpTo) setTimeout(() => document.getElementById(jumpTo)?.scrollIntoView({ block: 'start' }), 300);
})();
