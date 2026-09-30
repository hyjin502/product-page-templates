/* pager — 카드형 섹션 공통 페이지 넘김 (tokens/base.css 의 [data-pager] 규칙과 함께 동작)
   · 루트 [data-pager] 안의 [data-pager-track] 자식이 카드, [data-pager-dots] 가 점 자리예요.
   · CSS 변수 --per(한 화면 열 수) · --rows(줄 수)를 읽어 카드 수가 넘치면 .is-paged 를 붙이고
     페이지 단위로 카드를 배치(행 우선 순서 유지)한 뒤 점을 만들어요. 기기 폭이 바뀌면 다시 계산해요.
   · MO compact 옵션(루트 class *--compact)이 켜져 있으면 MO 에서는 compact 동작을 우선해요.
   · 한 페이지에 여러 섹션이 있어도 섹션마다 한 번만 연결돼요. */
(function () {
  var MO = window.matchMedia('(max-width: 767px)');
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');
  function num(v, d) { var n = parseFloat(v); return isNaN(n) ? d : n; }

  function setup(root) {
    if (root.__pager) { root.__pager(); return; }
    var track = root.querySelector('[data-pager-track]');
    if (!track) return;
    var dots = root.querySelector('[data-pager-dots]');
    var pages = 1;
    var busy = false;

    function visible() {
      return Array.prototype.filter.call(track.children, function (el) { return getComputedStyle(el).display !== 'none'; });
    }
    function gap() { return num(track.style.getPropertyValue('--pager-gap'), 24); }
    function pageW() { return track.clientWidth + gap(); }
    function current() { return Math.max(0, Math.min(pages - 1, Math.round(track.scrollLeft / pageW()))); }

    function sync() {
      if (!dots) return;
      var i = current();
      Array.prototype.forEach.call(dots.children, function (b, k) { b.setAttribute('aria-current', String(k === i)); });
    }
    function go(i) {
      i = Math.max(0, Math.min(pages - 1, i));
      track.scrollTo({ left: i * pageW(), behavior: REDUCED.matches ? 'auto' : 'smooth' });
    }

    function update() {
      if (busy) return;
      busy = true;
      Array.prototype.forEach.call(track.children, function (el) { el.style.gridRow = ''; el.style.gridColumn = ''; el.removeAttribute('data-pager-start'); });
      root.classList.remove('is-paged', 'is-fill');
      track.removeAttribute('tabindex');
      var cs = getComputedStyle(root);
      var per = Math.round(num(cs.getPropertyValue('--per'), 0));
      var mode = (cs.getPropertyValue('--pmode') || 'fill').trim();
      var rows = mode === 'fill' ? 1 : Math.max(1, Math.round(num(cs.getPropertyValue('--rows'), 1)));
      if (mode === 'none' || (MO.matches && /--compact(\s|$)/.test(root.className))) per = 0;
      var list = visible();
      var size = per * rows;
      if (per > 0 && list.length <= size) {
        // 한 화면 안 — fill 은 카드 수만큼 열(줄을 균등하게 채움), grid 는 --per 열 고정
        track.style.setProperty('--fcols', String(mode === 'fill' ? Math.max(1, list.length) : per));
        root.classList.add('is-fill');
        pages = 1;
        if (dots) dots.innerHTML = '';
      } else if (per > 0) {
        track.style.setProperty('--pager-gap', num(getComputedStyle(track).columnGap, 24) + 'px');
        pages = Math.ceil(list.length / size);
        list.forEach(function (el, i) {
          var p = Math.floor(i / size), j = i % size;
          el.style.gridRow = String(Math.floor(j / per) + 1);
          el.style.gridColumn = String(p * per + (j % per) + 1);
          if (j === 0) el.setAttribute('data-pager-start', '');
        });
        track.style.setProperty('--cols', String(pages * per));
        root.classList.add('is-paged');
        track.setAttribute('tabindex', '0');
        if (dots) {
          dots.innerHTML = '';
          for (var k = 0; k < pages; k++) {
            var b = document.createElement('button');
            b.type = 'button';
            b.setAttribute('aria-label', (k + 1) + ' / ' + pages + ' 페이지');
            b.addEventListener('click', go.bind(null, k));
            dots.appendChild(b);
          }
        }
        sync();
      } else {
        pages = 1;
        if (dots) dots.innerHTML = '';
      }
      busy = false;
    }

    track.addEventListener('scroll', sync, { passive: true });
    track.addEventListener('keydown', function (e) {
      if (!root.classList.contains('is-paged')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(current() + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(current() - 1); }
    });
    var w = 0;
    if (window.ResizeObserver) new ResizeObserver(function () { if (root.clientWidth !== w) { w = root.clientWidth; update(); } }).observe(root);
    else window.addEventListener('resize', update);
    root.__pager = update;
    update();
  }

  function init() { document.querySelectorAll('[data-pager]').forEach(setup); }
  window.pagerRefresh = init;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
