// monthly-x-summary — 2번 아이콘 카드가 3개를 넘으면 PC 에서 3개씩 옆으로 넘기고, 점이 지금 페이지를 따라가요(점을 누르면 그 페이지로).
// 편집기에서 섹션을 다시 그려도 되게 문서 전체의 스크롤(capture)·클릭을 봐요.
(function () {
  if (window.__mxSummaryCards) return;
  window.__mxSummaryCards = true;
  function parts(el) {
    var root = el.closest && el.closest('[data-mx-cards]');
    if (!root) return null;
    return { track: root.querySelector('.mx-summary__cards-track'), dots: root.querySelectorAll('.mx-summary__dots span') };
  }
  document.addEventListener('scroll', function (e) {
    var t = e.target;
    if (!t.classList || !t.classList.contains('mx-summary__cards-track')) return;
    var p = parts(t);
    if (!p || !p.dots.length) return;
    var i = Math.round(t.scrollLeft / (t.clientWidth + 24));
    p.dots.forEach(function (d, k) { d.classList.toggle('is-on', k === i); });
  }, true);
  document.addEventListener('click', function (e) {
    var d = e.target.closest && e.target.closest('.mx-summary__dots span');
    if (!d) return;
    var p = parts(d);
    var i = Array.prototype.indexOf.call(p.dots, d);
    p.track.scrollTo({ left: i * (p.track.clientWidth + 24), behavior: 'smooth' });
  });
})();
