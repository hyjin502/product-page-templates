/* 렌더 공통 — 빌드(scripts/lib.mjs)와 히어로 편집기(브라우저)가 같은 코드를 써요.
   같은 content 면 빌드 결과와 편집기 미리보기가 글자 하나까지 같아야 해서 한 파일에 둬요.
   Node 에서는 require, 브라우저에서는 window.RenderCore 예요. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RenderCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** 줄 나누기 — 앞뒤 공백을 지우고 빈 줄은 버려요 (글자 수 검사·편집기 입력칸도 이 기준) */
  function lines(s) {
    return String(s).replace(/\r\n?|\u2028/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
  }
  /** 글자 수 — 띄어쓰기 포함, 한글·이모지 한 글자를 1로 세요 */
  const charCount = (s) => [...String(s)].length;

  function flatten(s) {
    const ls = lines(s);
    const breaks = new Set();
    let pos = 0;
    ls.forEach((l, i) => { pos += l.length; if (i < ls.length - 1) { breaks.add(pos); pos += 1; } });
    return { flat: ls.join(' '), breaks };
  }

  /* richtext — 값은 문자열("줄1\n줄2") 또는 { pc, mo }.
     pc·mo 글자가 같고 줄바꿈 위치만 다르면 <br class="only-pc|only-mo"> 로 합쳐요.
     글자가 다르면 <span class="only-pc"> / <span class="only-mo"> 두 벌로 내보내요. */
  function richtext(value) {
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

  /** 줄 목록 — { pc, mo } 면 기기(dev)에 맞는 쪽, 한쪽만 있으면 그쪽 (편집기·줄 단위 템플릿용) */
  function textLines(value, dev) {
    if (value == null || value === '') return [];
    if (typeof value === 'object') return lines((dev === 'mo' ? (value.mo ?? value.pc) : (value.pc ?? value.mo)) ?? '');
    return lines(value);
  }

  /** HDS 토큰 조회 — tokens/hds.json */
  function hdsIndex(hds) {
    return {
      colors: Object.fromEntries((hds.colors || []).map((c) => [c.key, c])),
      radius: Object.fromEntries((hds.radius || []).map((r) => [r.key, r])),
    };
  }

  /** 템플릿 필터 — Node·브라우저 env 에 똑같이 등록해요. icon(name) 은 SVG 문자열을 돌려주는 함수 */
  function addFilters(env, { safe, hds, icon }) {
    const idx = hdsIndex(hds);
    env.addFilter('rt', (v) => safe(richtext(v)));
    env.addFilter('lines', (v, dev) => textLines(v, dev));
    env.addFilter('icon', (name) => safe(icon(name)));
    env.addFilter('hdsColor', (k) => (idx.colors[k] ? idx.colors[k].hex : ''));
    env.addFilter('hdsOn', (k) => (idx.colors[k] ? idx.colors[k].on : ''));
    env.addFilter('hdsRadius', (k) => (idx.radius[k] ? idx.radius[k].px + 'px' : ''));
    env.addFilter('hdsToken', (k, kind) => { const t = (kind === 'radius' ? idx.radius : idx.colors)[k]; return t ? t.token : ''; });
    return env;
  }

  /** 슬롯 스펙 정규화 — 예전 축약형("text", ["a","b"])도 받아요 */
  function specOf(t) {
    if (Array.isArray(t)) return { type: 'enum', values: t, optional: true };
    if (typeof t === 'string') return { type: t, optional: t !== 'text' };
    return t || {};
  }

  /** 템플릿에 넘길 값 — 빈 슬롯은 null(목록은 []), 스펙의 default 를 채워요 (목록 항목 안도) */
  function contextFor(slots, content) {
    const fill = (fields, obj) => {
      const out = {};
      for (const [k, raw] of Object.entries(fields || {})) {
        const s = specOf(raw);
        let v = obj ? obj[k] : undefined;
        if (v == null || v === '') v = s.type === 'list' ? [] : (s.default ?? null);
        if (s.type === 'list' && Array.isArray(v) && s.item) v = v.map((it) => ({ ...it, ...fill(s.item, it) }));
        out[k] = v;
      }
      return out;
    };
    return fill(slots, content);
  }

  /** 렌더 결과 정리 — 빈 줄을 줄이고 앞뒤 공백을 지워요 */
  const finalize = (html) => html.replace(/\n{2,}/g, '\n').trim();

  return { esc, lines, charCount, richtext, textLines, hdsIndex, addFilters, specOf, contextFor, finalize };
});
