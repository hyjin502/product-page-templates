// problem compact 진행 막대 — 보이는 비율만큼 길이, 스크롤한 만큼 이동해요.
// card-grid · card-list 가 같은 코드를 써요. 한 페이지에 여러 번 들어가도 섹션마다 한 번만 연결돼요(data-problem-bar).
(function () {
  document.querySelectorAll('.problem').forEach(function (sec) {
    if (sec.dataset.problemBar) return;
    var track = sec.querySelector('.problem__track');
    var bar = sec.querySelector('.problem__bar');
    var thumb = bar && bar.querySelector('.problem__thumb');
    if (!track || !thumb) return;
    sec.dataset.problemBar = '1';
    function sync() {
      var w = bar.clientWidth;
      if (!w) return; // compact 가 아니거나 MO 가 아니면 막대가 숨어 있어요
      var max = track.scrollWidth - track.clientWidth;
      var tw = Math.max(40, Math.min(w, w * track.clientWidth / track.scrollWidth));
      thumb.style.width = tw + 'px';
      thumb.style.transform = 'translateX(' + (max > 0 ? (w - tw) * track.scrollLeft / max : 0) + 'px)';
    }
    track.addEventListener('scroll', sync, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(sync).observe(bar);
    else window.addEventListener('resize', sync);
    sync();
  });
})();
