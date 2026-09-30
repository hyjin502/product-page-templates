// concern-persona — 좌우 스크롤 진행 막대(TB 좁은 폭 · MO compact)와 PC 페이지 점
// 페이지에 이 섹션이 여러 개 있어도 각각 따로 동작해요. 한 번만 실행되도록 표시를 남겨요.
document.querySelectorAll('.concern--persona').forEach(function (sec) {
  if (sec.dataset.personaReady) return;
  sec.dataset.personaReady = '1';
  var track = sec.querySelector('.concern-persona__track');
  var bar = sec.querySelector('.concern-persona__bar');
  var thumb = sec.querySelector('.concern-persona__thumb');
  var dots = Array.prototype.slice.call(sec.querySelectorAll('.concern-persona__dots i'));
  if (!track) return;

  function sync() {
    var max = track.scrollWidth - track.clientWidth;
    if (bar) bar.classList.toggle('is-scrollable', max > 1);
    if (bar && thumb && bar.clientWidth) {
      var w = bar.clientWidth;
      var tw = Math.min(w, Math.max(40, w * track.clientWidth / track.scrollWidth));
      thumb.style.width = tw + 'px';
      thumb.style.transform = 'translateX(' + (max > 0 ? (w - tw) * track.scrollLeft / max : 0) + 'px)';
    }
    if (dots.length && track.clientWidth) {
      var page = Math.min(dots.length - 1, Math.round(track.scrollLeft / track.clientWidth));
      dots.forEach(function (d, i) { d.classList.toggle('is-active', i === page); });
    }
  }
  dots.forEach(function (d, i) {
    d.addEventListener('click', function () { track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' }); });
  });
  track.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('resize', sync);
  // 라이브러리에서 compact 옵션 class 를 켜고 끌 때도 다시 계산
  new MutationObserver(sync).observe(sec, { attributes: true, attributeFilter: ['class'] });
  sync();
});
