// monthly-x-program — 순서대로 강조: 시간표 줄을 위에서부터 1.5초마다 하나씩 .is-on (끝나면 처음으로).
// 월간휴넷 세미나 페이지(hrd.hunet.co.kr MontlyHunetSeminar)의 「순차 포커스」와 같은 효과. 편집기에서 섹션을 다시 그려도 계속되게 매번 줄을 다시 찾아요.
(function () {
  if (window.__mxProgramCycle) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  var step = 0;
  window.__mxProgramCycle = setInterval(function () {
    if (reduce && reduce.matches) return;
    document.querySelectorAll('.mx-program[data-cycle]').forEach(function (root) {
      var rows = root.querySelectorAll('.mx-program__row');
      if (!rows.length) return;
      var i = step % rows.length;
      rows.forEach(function (r, k) { r.classList.toggle('is-on', k === i); });
    });
    step++;
  }, 1500);
})();
