// monthly-x-flow — MO 에서 단계 카드를 옆으로 넘길 때 점이 지금 카드를 따라가요(점을 누르면 그 카드로).
// 편집기에서 섹션을 다시 그려도 되게 문서 전체의 스크롤(capture)·클릭을 봐요.
(function () {
  if (window.__mxFlowDots) return;
  window.__mxFlowDots = true;
  function step(track) { var c = track.children[0]; return c ? c.getBoundingClientRect().width + 19 : 1; }
  document.addEventListener('scroll', function (e) {
    var t = e.target;
    if (!t.matches || !t.matches('[data-mx-flow]')) return;
    var dots = t.parentNode.querySelectorAll('.mx-flow__dots span');
    var i = Math.round(t.scrollLeft / step(t));
    if (t.scrollLeft + t.clientWidth >= t.scrollWidth - 2) i = dots.length - 1; // 끝까지 넘기면 마지막 점
    dots.forEach(function (d, k) { d.classList.toggle('is-on', k === i); });
  }, true);
  document.addEventListener('click', function (e) {
    var d = e.target.closest && e.target.closest('.mx-flow__dots span');
    if (!d) return;
    var root = d.closest('.mx-flow');
    var t = root && root.querySelector('[data-mx-flow]');
    if (!t) return;
    var i = Array.prototype.indexOf.call(d.parentNode.children, d);
    t.scrollTo({ left: i * step(t), behavior: 'smooth' });
  });
})();
