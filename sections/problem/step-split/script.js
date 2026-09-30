// problem step-split — 화면 가운데에 온 단계를 진행 중(is-active)으로 표시하고, PC 단계 표시(순서플로팅)도 같이 바꿔요.
// 단계 표시를 누르면 그 단계로 스크롤해요. 섹션마다 한 번만 연결돼요(data-problem-steps).
(function () {
  document.querySelectorAll('.problem--step-split').forEach(function (sec) {
    if (sec.dataset.problemSteps) return;
    sec.dataset.problemSteps = '1';
    var steps = Array.prototype.slice.call(sec.querySelectorAll('.problem__step'));
    var navItems = Array.prototype.slice.call(sec.querySelectorAll('.problem__nav-item'));
    var nav = sec.querySelector('.problem__nav');
    if (!steps.length) return;
    function activate(i) {
      steps.forEach(function (s, j) { s.classList.toggle('is-active', j === i); });
      navItems.forEach(function (n, j) { n.classList.toggle('is-active', j === i); });
    }
    navItems.forEach(function (n, i) {
      var btn = n.querySelector('.problem__nav-btn');
      if (!btn || !steps[i]) return;
      btn.addEventListener('click', function () {
        var offset = nav && nav.offsetParent !== null ? nav.offsetHeight + 24 : 24;
        window.scrollTo({ top: steps[i].getBoundingClientRect().top + window.pageYOffset - offset, behavior: 'smooth' });
      });
    });
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) activate(steps.indexOf(e.target)); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    steps.forEach(function (s) { io.observe(s); });
  });
})();
