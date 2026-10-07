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
const state = { mode: 'library', view: 'designer', device: 'pc', cat: 'hero', open: null, compose: null, hero: null };
try {
  const s = JSON.parse(localStorage.getItem('tpl-site') || '{}');
  if (['library', 'compose', 'hero'].includes(s.mode)) state.mode = s.mode;
  if (['designer', 'dev'].includes(s.view)) state.view = s.view;
  if (DEVICE_W[s.device]) state.device = s.device;
  if (secByKey[s.cat]) state.cat = s.cat;
  if (Array.isArray(s.open)) state.open = s.open.filter((k) => secByKey[k]);
  if (s.compose && Array.isArray(s.compose.rows)) state.compose = s.compose;
  if (s.hero && typeof s.hero === 'object' && s.hero.edits) state.hero = s.hero;
} catch (e) {}
if (!state.compose) state.compose = { title: '새 상품페이지', rows: defaultRows() };
state.compose.rows = state.compose.rows.filter((r) => byId[r.variant]);
function save() { try { localStorage.setItem('tpl-site', JSON.stringify(state)); } catch (e) {} }

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
function mountPreview(stage, frame, iframe, scaleTag, onLoad) {
  function fit() {
    const w = DEVICE_W[state.device];
    const pad = parseFloat(getComputedStyle(stage).paddingLeft) * 2;
    const s = Math.min(1, Math.max(200, stage.clientWidth - pad) / w);
    iframe.style.width = w + 'px';
    let h = 400;
    try { const b = iframe.contentDocument && iframe.contentDocument.body; if (b) h = Math.ceil(b.scrollHeight) || h; } catch (e) {}
    iframe.style.height = h + 'px';
    iframe.style.transform = `scale(${s})`;
    frame.style.width = Math.floor(w * s) + 'px';
    frame.style.height = Math.ceil(h * s) + 'px';
    if (scaleTag) scaleTag.textContent = `${DEVICE_LABEL[state.device]} ${w}px · ${Math.round(s * 100)}%`;
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
  composeEl.innerHTML = `<aside class="compose__side">
  <div class="compose__scroll">
  <div><h2>페이지 조합기</h2><p>섹션 순서와 variant를 고르면 전체 페이지를 미리 봐요. 결과는 <code>page.json</code>으로 받아 내용을 채운 뒤 빌드하세요.</p></div>
  <label class="field">페이지 제목<input type="text" data-title value="${esc(c.title)}"></label>
  <ol class="rows">${c.rows.map((r, i) => {
    const v = byId[r.variant];
    const sec = secByKey[v.section];
    return `<li data-row="${i}"><div class="rows__main"><span class="rows__sec">${v.section}</span>
      <select data-variant aria-label="${v.section} variant">${sec.variants.map((id) => `<option value="${id}"${id === r.variant ? ' selected' : ''}>${vname(byId[id])}</option>`).join('')}</select>
      ${Object.entries(v.options).map(([k, o]) => `<label class="rows__opt"><input type="checkbox" data-row-opt="${k}"${(r.options || []).includes(k) ? ' checked' : ''}> ${esc(o.label || k)}</label>`).join('')}
      ${v.pager ? `<div class="rows__pg">${pagerControls(v, rowPager(r))}</div>` : ''}</div>
      <div class="rows__btns"><button type="button" class="icon-btn" data-move="-1" aria-label="위로"${i === 0 ? ' disabled' : ''}>↑</button><button type="button" class="icon-btn" data-move="1" aria-label="아래로"${i === c.rows.length - 1 ? ' disabled' : ''}>↓</button><button type="button" class="icon-btn" data-remove aria-label="빼기">✕</button></div></li>`;
  }).join('')}</ol>
  <div class="add"><select data-add aria-label="추가할 섹션">${avail.map((s) => `<option value="${s.variants[0]}">${s.key} — ${esc(s.role)}</option>`).join('')}</select><button type="button" class="btn-ui" data-add-btn>추가</button></div>
  ${soon.length ? `<p>코드 준비 중: ${soon.join(', ')}</p>` : ''}
  </div>
  <div class="compose__foot">
  <div class="compose__actions">
    <button type="button" class="btn-ui btn-ui--primary" data-download>page.json 받기</button>
    <button type="button" class="btn-ui" data-copy-json>page.json 복사</button>
    <button type="button" class="btn-ui" data-reset>기본 순서로</button>
  </div>
  <p class="compose__hint"><code>pages/이름.page.json</code>으로 저장 → 내용 수정 → <code>npm run build</code> → <code>dist/pages/이름/index.html</code></p>
  </div>
</aside>
<div class="compose__stage">${c.rows.length ? '<div class="v__frame"><iframe title="조합 미리보기"></iframe><span class="v__scale"></span></div>' : '<p class="compose__empty">섹션을 추가하세요</p>'}</div>`;
  composeEl.querySelector('.compose__scroll').scrollTop = keepScroll;
  if (!c.rows.length) return;
  const ids = c.rows.map((r) => r.variant);
  const css = [...new Set(ids)].map((id) => byId[id].css).join('\n\n'); // 같은 섹션 공통 CSS가 겹쳐도 미리보기에선 무해해요
  const html = c.rows.map((r) => withPager(byId[r.variant], withOptions(byId[r.variant], r.options), byId[r.variant].pager ? rowPager(r) : null)).join('\n');
  const js = [...new Set(ids)].map((id) => byId[id].js).filter(Boolean).join('\n');
  const stage = ids.every((id) => byId[id].stage === 'sticky') ? 'sticky' : null;
  const iframe = composeEl.querySelector('iframe');
  composeFit = mountPreview(composeEl.querySelector('.compose__stage'), composeEl.querySelector('.v__frame'), iframe, composeEl.querySelector('.v__scale'));
  iframe.srcdoc = srcdoc(html, css, js, stage);
}
let composeFit = null;
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

function pageJson() {
  return JSON.stringify({
    title: state.compose.title,
    theme: 'light',
    sections: state.compose.rows.map((r) => {
      const v = byId[r.variant];
      const pg = v.pager ? rowPager(r) : null;
      const perChanged = pg && ['pc', 'tb', 'mo'].some((d) => pg.per[d] !== v.pager.per[d]);
      return {
        variant: r.variant,
        ...(r.options && r.options.length ? { options: r.options } : {}),
        ...(perChanged ? { pager: pg.per } : {}),
        content: pg ? contentFor(v, pg.count) : v.sample,
      };
    }),
  }, null, 2) + '\n';
}

composeEl.addEventListener('click', (e) => {
  const rows = state.compose.rows;
  const li = e.target.closest('[data-row]');
  const i = li ? +li.dataset.row : -1;
  const mv = e.target.closest('[data-move]');
  if (mv) { const j = i + +mv.dataset.move; [rows[i], rows[j]] = [rows[j], rows[i]]; return commitCompose(); }
  if (e.target.closest('[data-remove]')) { rows.splice(i, 1); return commitCompose(); }
  const pc = e.target.closest('[data-pg-count]');
  if (pc && li) { const r = rows[i]; r.count = Math.max(1, rowPager(r).count + +pc.dataset.pgCount); return commitCompose(); }
  if (e.target.closest('[data-add-btn]')) { rows.push({ variant: composeEl.querySelector('[data-add]').value }); return commitCompose(); }
  if (e.target.closest('[data-reset]')) { state.compose.rows = defaultRows(); return commitCompose(); }
  const cj = e.target.closest('[data-copy-json]');
  if (cj) return copyText(pageJson(), cj);
  if (e.target.closest('[data-download]')) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([pageJson()], { type: 'application/json' }));
    a.download = (state.compose.title.trim().replace(/[\\/:*?"<>|\s]+/g, '-') || 'page') + '.page.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
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
  return hs.edits[v.id];
}
const extOf = (ref) => { const m = /\.([a-z0-9]+)$/i.exec(ref.name || ''); return (m ? m[1] : ref.kind === 'video' ? 'mp4' : 'jpg').toLowerCase(); };
const exportName = (slot, dev, ref) => `hero-${slot === 'background' ? 'bg' : slot}-${dev}.${extOf(ref)}`;
const blobUrls = {};
/** 미디어 참조 → content 값. 미리보기는 blob: 주소, 내보내기는 page.json 옆에 둘 파일 이름 */
function mediaOut(ref, slot, dev, forExport) {
  if (!ref) return null;
  if (ref.file) {
    if (forExport) return { kind: ref.kind, src: exportName(slot, dev, ref) };
    return blobUrls[ref.file] ? { kind: ref.kind, src: blobUrls[ref.file] } : null;
  }
  return ref.src ? { kind: ref.kind, src: ref.src } : null;
}
function contentFrom(v, e, forExport) {
  const c = {};
  for (const [k, raw] of Object.entries(v.slots)) {
    const s = RC.specOf(raw);
    const val = e[k];
    if (s.type === 'richtext') {
      const join = (ls) => (ls || []).map((l) => String(l).trim()).filter(Boolean).join('\n');
      const t = join(val);
      const m = e['@mo'] && e['@mo'][k] ? join(e['@mo'][k]) : '';
      if (m && m !== t) c[k] = t ? { pc: t, mo: m } : { mo: m };
      else if (t) c[k] = t;
    } else if (s.type === 'list') {
      // 문구가 빈 버튼은 빼요
      const items = (val || []).filter((it) => !(s.item && s.item.label) || String(it.label || '').trim())
        .map((it) => Object.fromEntries(Object.entries(it).filter(([, vv]) => vv !== '' && vv != null).map(([kk, vv]) => [kk, typeof vv === 'string' ? vv.trim() : vv])));
      if (items.length) c[k] = items;
    } else if (s.type === 'media') {
      const pc = mediaOut(val.pc, k, 'pc', forExport);
      const mo = val.moSame ? null : mediaOut(val.mo, k, 'mo', forExport);
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
function swatches(path, cur, label) {
  return `<div class="hed-sw" role="group" aria-label="${esc(label)}">${REG.hds.colors.map((c) => `<button type="button" class="hed-sw__b" ${attrs({ ...path, 'data-val': c.key, style: `--c:${c.hex}`, title: `${c.label} · ${c.token}`, 'aria-label': `${c.label} (${c.token})`, 'aria-pressed': String(c.key === cur) })}></button>`).join('')}</div>`;
}
function radiusChips(path, cur, label) {
  return `<div class="hed-rad" role="group" aria-label="${esc(label)}">${REG.hds.radius.map((r) => `<button type="button" class="chip" ${attrs({ ...path, 'data-val': r.key, title: r.token, 'aria-pressed': String(r.key === cur) })}><span class="hed-rad__ico" style="border-top-left-radius:${Math.min(r.px, 10)}px"></span>${r.key} <span class="hed-rad__px">${r.px === 900 ? '' : r.px}</span></button>`).join('')}</div>`;
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
function itemField(k, i, kk, s, val, n, item) {
  const path = { 'data-f': k, 'data-i': i, 'data-k': kk };
  const label = `${n} ${s.label || kk}`;
  if (hiddenBy(s, item)) return '';
  if (s.type === 'toggle') return `<div class="hed-sub">${toggleBox(path, s, val)}</div>`;
  if (s.type === 'color') {
    const c = HDS_COLOR[val];
    return `<div class="hed-sub"><span class="hed-sub__label">${esc(s.label || kk)} <code>${c ? esc(c.token) : ''}</code></span>${swatches(path, val, label)}</div>`;
  }
  if (s.type === 'radius') {
    const r = HDS_RADIUS[val];
    return `<div class="hed-sub"><span class="hed-sub__label">${esc(s.label || kk)} <code>${r ? esc(r.token) : ''}</code></span>${radiusChips(path, val, label)}</div>`;
  }
  if (s.type === 'enum') return `<div class="hed-sub"><span class="hed-sub__label">${esc(s.label || kk)}</span>${enumChips(path, s, val, label)}</div>`;
  const ph = s.type === 'url' ? 'https://… (비우면 #)' : '';
  return `<div class="hed-sub"><span class="hed-sub__label">${esc(s.label || kk)}</span><div class="hed-in"><input type="${s.type === 'url' ? 'url' : 'text'}" ${attrs({ ...path, value: val, maxlength: s.maxChars || null, placeholder: ph || null, 'aria-label': label })}>${s.type === 'url' ? '' : cnt(val, s.maxChars)}</div></div>`;
}
function listField(k, s, items) {
  const max = s.max ?? 99;
  const one = s.label || '항목';
  return `<div class="hed-f">${fieldHead(s, `최대 ${max}개`)}
  ${items.map((it, i) => `<div class="hed-item"><div class="hed-item__head"><b>${esc(one)} ${i + 1}</b>${items.length > (s.min ?? 0) ? `<button type="button" class="icon-btn" data-act="del-item" data-f="${k}" data-i="${i}" aria-label="${esc(one)} ${i + 1} 빼기">✕</button>` : ''}</div>
    ${Object.entries(s.item || {}).map(([kk, raw]) => itemField(k, i, kk, RC.specOf(raw), it[kk], `${one} ${i + 1}`, it)).join('')}
    ${s.item && s.item.label && !String(it.label || '').trim() ? '<p class="hed-hint">문구를 넣으면 버튼이 보여요</p>' : ''}
  </div>`).join('')}
  ${items.length < max ? `<button type="button" class="hed-add" data-act="add-item" data-f="${k}">+ ${esc(one)} 추가</button>` : ''}
</div>`;
}
function mediaThumb(ref) {
  if (!ref) return '<span class="hed-media__none">없음</span>';
  const src = ref.file ? blobUrls[ref.file] : ref.src;
  if (!src) return '<span class="hed-media__none">파일을 다시<br>골라 주세요</span>';
  return ref.kind === 'video' ? `<video src="${esc(src)}" muted loop autoplay playsinline></video>` : `<img src="${esc(src)}" alt="">`;
}
function mediaName(ref) {
  if (!ref) return '없음';
  if (ref.file) return `${ref.name || '올린 파일'}${blobUrls[ref.file] ? '' : ' (다시 골라 주세요)'}`;
  return ref.src;
}
function mediaBox(k, dev, ref, title) {
  return `<div class="hed-media">
  <div class="hed-media__thumb">${mediaThumb(ref)}</div>
  <div class="hed-media__info">
    <b>${title}${ref ? ` <span class="hed-media__kind">${ref.kind === 'video' ? '영상' : '이미지'}</span>` : ''}</b>
    <span class="hed-media__name" title="${esc(mediaName(ref))}">${esc(mediaName(ref))}</span>
    <div class="hed-media__btns"><button type="button" class="btn-ui" data-act="pick" data-f="${k}" data-dev="${dev}">파일 선택</button>${ref ? `<button type="button" class="btn-ui" data-act="clear" data-f="${k}" data-dev="${dev}">지우기</button>` : ''}</div>
    <input type="url" class="hed-media__url" ${attrs({ 'data-f': k, 'data-dev': dev, 'data-k': 'url', placeholder: '또는 이미지·mp4 주소 붙여넣기', 'aria-label': `${title} 주소` })}>
  </div>
</div>`;
}
function mediaField(k, s, m) {
  return `<div class="hed-f">${fieldHead(s, s.hint || '이미지 또는 mp4 · PC 것은 TB 에도 쓰여요')}
  ${mediaBox(k, 'pc', m.pc, 'PC · TB')}
  <label class="hed-check"><input type="checkbox" data-f="${k}" data-k="moSame"${m.moSame ? ' checked' : ''}> MO 도 PC ${esc(s.label || '')} 그대로 쓰기</label>
  ${m.moSame ? '' : mediaBox(k, 'mo', m.mo, 'MO')}
</div>`;
}
function heroForm(v, e) {
  return Object.entries(v.slots).map(([k, raw]) => {
    const s = RC.specOf(raw);
    if (s.type === 'richtext') return linesField(k, s, e[k], e['@mo'] && e['@mo'][k]);
    if (s.type === 'list') return listField(k, s, e[k]);
    if (s.type === 'media') return mediaField(k, s, e[k]);
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
  heroEl.innerHTML = `<aside class="compose__side">
  <div class="compose__scroll">
  <div class="hed-intro"><h2>히어로 편집기</h2><p>스타일을 고르고 문구·배경·버튼을 바꿔 보세요. 오른쪽이 실제 결과예요 (기기는 위쪽 PC·TB·MO).</p></div>
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
  </div>
  <p class="compose__hint">받은 page.json 과 배경 파일을 <code>pages/</code> 에 같이 넣고 <code>npm run build</code> → <code>dist/pages/이름/</code></p>
  </div>
  <input type="file" accept="image/*,video/mp4" hidden data-hed-file>
</aside>
<div class="compose__stage">
  <div class="hed-warn" data-hed-warn role="status" aria-live="polite"></div>
  <div class="v__frame"><iframe title="히어로 미리보기"></iframe><span class="v__scale"></span></div>
</div>`;
  heroEl.querySelector('.compose__scroll').scrollTop = keep;
  const iframe = heroEl.querySelector('iframe');
  heroLoaded = false;
  heroFit = mountPreview(heroEl.querySelector('.compose__stage'), heroEl.querySelector('.v__frame'), iframe, heroEl.querySelector('.v__scale'), () => {
    heroLoaded = true;
    try { const d = iframe.contentDocument; (d.fonts ? d.fonts.ready : Promise.resolve()).then(measureSoon); } catch (err) {}
    measureSoon();
  });
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

/* ---------- page.json */
function heroPage() {
  const v = byId[heroState().variant];
  return { title: `${vname(v)} 히어로 시안`, theme: 'light', sections: [{ variant: v.id, content: contentFrom(v, heroEdit(v), true) }] };
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

/* ---------- 이벤트 */
let pickTarget = null;
const at = (el) => ({ f: el.dataset.f, i: el.dataset.i != null ? +el.dataset.i : null, k: el.dataset.k, line: el.dataset.line != null ? +el.dataset.line : null, dev: el.dataset.dev });
heroEl.addEventListener('input', (ev) => {
  const t = ev.target;
  if (!t.matches('input[type="text"][data-f], input[type="url"][data-f][data-i]')) return;
  const v = byId[heroState().variant];
  const e = heroEdit(v);
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
  heroUpdate();
});
heroEl.addEventListener('change', (ev) => {
  const t = ev.target;
  const v = byId[heroState().variant];
  const e = heroEdit(v);
  if (t.matches('[data-k="moSame"]')) { e[t.dataset.f].moSame = t.checked; redrawForm(); heroUpdate(); return; }
  if (t.matches('[data-mo-sep]')) {
    const k = t.dataset.moSep;
    if (t.checked) (e['@mo'] ||= {})[k] = [...(e[k] || [])];
    else if (e['@mo']) delete e['@mo'][k];
    redrawForm(); heroUpdate(); return;
  }
  if (t.matches('[data-toggle]')) { const p = at(t); if (p.i != null) e[p.f][p.i][p.k] = t.checked; else e[p.f] = t.checked; heroUpdate(); return; }
  if (t.matches('select[data-f][data-i]')) { const p = at(t); e[p.f][p.i][p.k] = t.value; heroUpdate(); return; }
  if (t.matches('.hed-media__url')) {
    const url = t.value.trim();
    if (!url) return;
    const p = at(t);
    e[p.f][p.dev] = { kind: /\.(mp4|webm|mov)(\?|#|$)/i.test(url) ? 'video' : 'image', src: url };
    redrawForm(); heroUpdate(); return;
  }
  if (t.matches('[data-hed-file]') && t.files && t.files[0] && pickTarget) {
    const file = t.files[0];
    const { f, dev } = pickTarget;
    const key = `${v.id}:${f}:${dev}`;
    if (blobUrls[key]) URL.revokeObjectURL(blobUrls[key]);
    files[key] = file;
    blobUrls[key] = URL.createObjectURL(file);
    idb.put(key, file);
    e[f][dev] = { kind: file.type.startsWith('video/') ? 'video' : 'image', file: key, name: file.name };
    t.value = '';
    redrawForm(); heroUpdate();
  }
});
heroEl.addEventListener('click', (ev) => {
  const v = byId[heroState().variant];
  const e = heroEdit(v);
  const sv = ev.target.closest('[data-hed-variant]');
  if (sv) { heroState().variant = sv.dataset.hedVariant; save(); renderHero(); return; }
  const val = ev.target.closest('[data-val]');
  if (val) { const p = at(val); if (p.i != null) e[p.f][p.i][p.k] = val.dataset.val; else e[p.f] = val.dataset.val; redrawForm(); heroUpdate(); return; }
  const act = ev.target.closest('[data-act]');
  if (act) {
    const p = at(act);
    const s = RC.specOf(v.slots[p.f]);
    switch (act.dataset.act) {
      case 'add-line': { const ls = p.dev === 'mo' ? e['@mo'][p.f] : e[p.f]; if (ls.length === 0) ls.push(''); ls.push(''); break; }
      case 'del-line': (p.dev === 'mo' ? e['@mo'][p.f] : e[p.f]).splice(p.line, 1); break;
      case 'add-item': e[p.f].push(Object.fromEntries(Object.entries(RC.contextFor(s.item, {})).map(([kk, vv]) => [kk, blank(vv)]))); break;
      case 'del-item': e[p.f].splice(p.i, 1); break;
      case 'clear': e[p.f][p.dev] = null; break;
      case 'pick': pickTarget = p; heroEl.querySelector('[data-hed-file]').click(); return;
      default: return;
    }
    redrawForm(); heroUpdate(); return;
  }
  const ha = ev.target.closest('[data-hed-act]');
  if (!ha) return;
  const json = JSON.stringify(heroPage(), null, 2) + '\n';
  if (ha.dataset.hedAct === 'copy') return copyText(json, ha);
  if (ha.dataset.hedAct === 'download') {
    download(`hero-${vname(v)}.page.json`, new Blob([json], { type: 'application/json' }));
    // 올린 배경 파일도 page.json 이 가리키는 이름으로 함께 받아요
    for (const [k, raw] of Object.entries(v.slots)) {
      if (RC.specOf(raw).type !== 'media') continue;
      for (const dev of ['pc', 'mo']) {
        const ref = e[k][dev];
        if (dev === 'mo' && e[k].moSame) continue;
        if (ref && ref.file && files[ref.file]) download(exportName(k, dev, ref), files[ref.file]);
      }
    }
    return;
  }
  if (ha.dataset.hedAct === 'reset' && confirm('입력한 내용을 지우고 Figma 샘플로 되돌릴까요?')) {
    heroState().edits[v.id] = editFrom(v, v.sample);
    save(); renderHero();
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
  const m = e.target.closest('[data-mode]');
  if (m) { state.mode = m.dataset.mode; applyAll(); return; }
  const oe = e.target.closest('[data-open-editor]');
  if (oe) { heroState().variant = oe.dataset.openEditor; state.mode = 'hero'; applyAll(); window.scrollTo(0, 0); return; }
  const vw = e.target.closest('[data-view]');
  if (vw) { state.view = vw.dataset.view; applyGlobal(); cards.forEach((c) => c.links()); save(); if (state.mode === 'library') renderCat(); return; }
  const dv = e.target.closest('[data-device]');
  if (dv) { state.device = dv.dataset.device; applyGlobal(); cards.forEach((c) => { c.apply(); c.fit(); }); composeFit && composeFit(); heroFit && heroFit(); if (state.mode === 'hero') measureSoon(); save(); }
});

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
  const top = document.getElementById('top');
  document.documentElement.style.setProperty('--top-h', top.offsetHeight + 'px');
}

function applyAll() {
  applyGlobal();
  if (state.mode === 'library') { renderSide(); renderCat(); } else if (state.mode === 'compose') { renderCompose(); } else { renderHero(); }
  // 히어로 편집기는 #hero-editor 주소로 바로 열려요 (기획자에게 링크 전달용)
  if (state.mode === 'hero') history.replaceState(null, '', '#hero-editor');
  else if (location.hash === '#hero-editor') history.replaceState(null, '', '#' + state.cat);
  save();
}

// #hero 또는 #hero-media-badge 로 바로 열기, #hero-editor 는 히어로 편집기
const h = decodeURIComponent(location.hash.slice(1));
let jumpTo = null;
if (h === 'hero-editor') state.mode = 'hero';
else if (secByKey[h]) state.cat = h;
else if (byId[h]) { state.cat = byId[h].section; state.mode = 'library'; jumpTo = h; }
if (!isOpen(state.cat)) state.open.push(state.cat);
applyAll();
if (jumpTo) setTimeout(() => document.getElementById(jumpTo)?.scrollIntoView({ block: 'start' }), 300);
})();
