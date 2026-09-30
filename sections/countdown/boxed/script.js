/* countdown — data-deadline(ISO 8601)까지 남은 일·시·분·초를 1초마다 갱신해요.
   한 페이지에 여러 개(다른 variant 포함) 있어도 각각 따로 동작하고, 같은 요소를 두 번 초기화하지 않아요.
   deadline 이 없거나 잘못된 값이면 서버에서 렌더한 초기 숫자를 그대로 둬요. */
(function () {
  var pad = function (n) { return n < 10 ? '0' + n : String(n); };
  document.querySelectorAll('.countdown[data-deadline]').forEach(function (root) {
    if (root.dataset.countdownReady) return;
    var end = Date.parse(root.dataset.deadline);
    if (isNaN(end)) return;
    root.dataset.countdownReady = '1';
    var cells = {};
    root.querySelectorAll('[data-unit]').forEach(function (el) { cells[el.dataset.unit] = el; });
    var timer;
    var tick = function () {
      var left = Math.max(0, Math.floor((end - Date.now()) / 1000));
      var v = {
        days: Math.floor(left / 86400),
        hours: Math.floor((left % 86400) / 3600),
        minutes: Math.floor((left % 3600) / 60),
        seconds: left % 60,
      };
      Object.keys(v).forEach(function (k) { if (cells[k]) cells[k].textContent = pad(v[k]); });
      if (left === 0) { clearInterval(timer); root.classList.add('is-ended'); }
    };
    tick();
    timer = setInterval(tick, 1000);
  });
})();
