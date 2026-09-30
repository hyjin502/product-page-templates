// concern-card — MO compact 숫자 페이지네이션 (2장씩)
// 섹션이 여러 개여도 각각 따로 동작하고, 두 번 실행돼도 한 번만 붙어요.
document.querySelectorAll('.concern--card').forEach(function (sec) {
  if (sec.dataset.cardReady) return;
  sec.dataset.cardReady = '1';
  var PER = 2;
  var items = Array.prototype.slice.call(sec.querySelectorAll('.concern-card__item'))
    .sort(function (a, b) { return a.dataset.i - b.dataset.i; });
  var pages = Array.prototype.slice.call(sec.querySelectorAll('.concern-card__page'));
  var prev = sec.querySelector('.concern-card__arrow[data-dir="-1"]');
  var next = sec.querySelector('.concern-card__arrow[data-dir="1"]');
  var total = Math.max(1, Math.ceil(items.length / PER));
  var cur = 0;

  function go(p) {
    cur = Math.max(0, Math.min(total - 1, p));
    items.forEach(function (el, i) { el.classList.toggle('is-current', Math.floor(i / PER) === cur); });
    pages.forEach(function (b, i) {
      b.classList.toggle('is-active', i === cur);
      if (i === cur) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (prev) prev.disabled = cur === 0;
    if (next) next.disabled = cur === total - 1;
  }
  pages.forEach(function (b, i) { b.addEventListener('click', function () { go(i); }); });
  if (prev) prev.addEventListener('click', function () { go(cur - 1); });
  if (next) next.addEventListener('click', function () { go(cur + 1); });
  sec.classList.add('is-paged');
  go(0);
});
