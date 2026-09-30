/* inquiry-simple — 제출 로직은 없어요(프론트엔드에서 연결). 여기서는 화면 동작만 해요.
   1) 마케팅 수신동의(전체) ↔ 수신 채널(이메일·SNS) 체크 동기화
   2) only-pc / only-mo 로 숨겨진 입력 행은 disabled — 숨은 required 칸 때문에 제출이 막히지 않게 */
(function () {
  document.querySelectorAll('.inquiry--simple').forEach(function (root) {
    if (root.dataset.inquiryReady) return; // 같은 섹션에 두 번 붙지 않게
    root.dataset.inquiryReady = '1';

    var master = root.querySelector('[data-inquiry-master]');
    var channels = Array.prototype.slice.call(root.querySelectorAll('[data-inquiry-channel]'));
    if (master && channels.length) {
      master.addEventListener('change', function () {
        channels.forEach(function (c) { c.checked = master.checked; });
      });
      channels.forEach(function (c) {
        c.addEventListener('change', function () {
          master.checked = channels.some(function (x) { return x.checked; });
        });
      });
    }

    var onlyFields = root.querySelectorAll('.inquiry__field[data-only]');
    if (!onlyFields.length) return;
    function syncHidden() {
      onlyFields.forEach(function (f) {
        var hidden = getComputedStyle(f).display === 'none';
        f.querySelectorAll('input, select, textarea').forEach(function (el) { el.disabled = hidden; });
      });
    }
    syncHidden();
    window.matchMedia('(max-width: 767px)').addEventListener('change', syncHidden);
  });
})();
