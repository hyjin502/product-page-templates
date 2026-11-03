// monthly-hunet-card-grid — MO 카드 넘기기 진행 막대: 보이는 폭 비율(--mh-cards-w)과 스크롤 위치(--mh-cards-x 0~1)를 막대에 적어요.
// 편집기에서 섹션을 다시 그려도 되게 문서 전체의 스크롤(capture)·창 크기·DOM 변화를 보고 매번 다시 찾아요.
(function () {
  if (window.__mhCardsBar) return;
  window.__mhCardsBar = true;
  function set(track) {
    var bar = track.parentNode && track.parentNode.querySelector('.mh-cards__bar');
    if (!bar) return;
    var max = track.scrollWidth - track.clientWidth;
    bar.style.setProperty('--mh-cards-w', track.scrollWidth ? Math.min(1, track.clientWidth / track.scrollWidth).toFixed(4) : 1);
    bar.style.setProperty('--mh-cards-x', max > 0 ? (track.scrollLeft / max).toFixed(4) : 0);
    bar.style.visibility = max > 0 ? '' : 'hidden';
  }
  function all() { document.querySelectorAll('[data-mh-cards]').forEach(set); }
  document.addEventListener('scroll', function (e) { if (e.target && e.target.matches && e.target.matches('[data-mh-cards]')) set(e.target); }, true);
  window.addEventListener('resize', all);
  if (window.MutationObserver) new MutationObserver(function () { requestAnimationFrame(all); }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', all); else all();
})();
