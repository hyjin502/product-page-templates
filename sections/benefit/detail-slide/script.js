// benefit-detail-slide — 이전/다음 버튼 · 점 · 키보드(←/→/Home/End)로 넘기는 슬라이더. 한 페이지에 여러 개 있어도 각각 동작해요.
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('.benefit--detail-slide').forEach(function (root) {
    if (root.dataset.sliderReady) return;
    root.dataset.sliderReady = '1';
    var track = root.querySelector('.benefit__slides');
    var slides = Array.prototype.slice.call(root.querySelectorAll('.benefit__slide'));
    var dots = Array.prototype.slice.call(root.querySelectorAll('.benefit__dot-btn'));
    var prev = root.querySelector('.benefit__arrow--prev');
    var next = root.querySelector('.benefit__arrow--next');
    if (!track || slides.length < 2) return;
    var current = 0;

    function update(i) {
      current = i;
      dots.forEach(function (d, k) { if (k === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
      slides.forEach(function (s, k) {
        // 화면 밖 슬라이드는 탭 이동·스크린리더에서 빼요
        if (k === i) { s.removeAttribute('aria-hidden'); s.inert = false; }
        else { s.setAttribute('aria-hidden', 'true'); s.inert = true; }
      });
      if (prev) prev.disabled = i === 0;
      if (next) next.disabled = i === slides.length - 1;
    }
    function go(i) {
      i = Math.max(0, Math.min(slides.length - 1, i));
      track.scrollTo({ left: slides[i].offsetLeft - slides[0].offsetLeft, behavior: reduce && reduce.matches ? 'auto' : 'smooth' });
      update(i);
    }

    // 스와이프로 넘긴 경우 — 스크롤이 멈춘 뒤에만 현재 번호를 맞춰요 (버튼으로 넘기는 중간값에 흔들리지 않게)
    var settle = 0;
    track.addEventListener('scroll', function () {
      clearTimeout(settle);
      settle = setTimeout(function () {
        var i = Math.round(track.scrollLeft / (track.clientWidth || 1));
        if (i !== current) update(Math.max(0, Math.min(slides.length - 1, i)));
      }, 120);
    }, { passive: true });
    track.addEventListener('keydown', function (e) {
      var map = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: slides.length - 1 };
      if (e.key in map) { e.preventDefault(); go(map[e.key]); }
    });
    if (prev) prev.addEventListener('click', function () { go(current - 1); });
    if (next) next.addEventListener('click', function () { go(current + 1); });
    dots.forEach(function (d, k) { d.addEventListener('click', function () { go(k); }); });
    // 창 크기가 바뀌면 현재 슬라이드 위치를 다시 맞춰요
    window.addEventListener('resize', function () { track.scrollTo({ left: slides[current].offsetLeft - slides[0].offsetLeft, behavior: 'auto' }); });
    update(0);
  });
})();
