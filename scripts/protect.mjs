// 사이트 비밀번호 잠금 — 빌드된 HTML 을 비밀번호로 암호화하고, 비밀번호 입력 화면만 남겨요
//   SITE_PASSWORD=… node scripts/protect.mjs dist
//   (GitHub Pages 배포 때 .github/workflows/pages.yml 이 저장소 secret SITE_PASSWORD 로 실행해요)
//
// - dist 안의 .html 파일(라이브러리 · 사용 가이드 · 조립 페이지)을 AES-GCM 으로 암호화해 같은 자리에 둬요
//   열면 비밀번호 입력 → 브라우저(WebCrypto)에서 풀어서 원래 페이지를 그대로 보여줘요 (주소·#hero-editor 그대로)
// - 키는 비밀번호 + 고정 salt 로 만들어요(PBKDF2) → 한 번 맞히면 그 브라우저에서는 다시 묻지 않고,
//   다시 배포해도 비밀번호가 같으면 그대로 열려요. 비밀번호를 바꾸면 다시 물어요
// - 이미지·영상 같은 파일은 암호화하지 않아요 (공개 저장소에 이미 있는 파일이에요)
// - 비밀번호는 코드·저장소에 쓰지 않아요. 저장소 secret 에만 둬요
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const dir = path.resolve(process.argv[2] || 'dist');
const password = process.env.SITE_PASSWORD || '';
if (!password) { console.error('✗ SITE_PASSWORD 가 비어 있어요 — 잠그지 않은 사이트는 배포하지 않아요'); process.exit(1); }
if (!fs.existsSync(path.join(dir, 'index.html'))) { console.error(`✗ ${dir}/index.html 이 없어요 — 먼저 npm run build`); process.exit(1); }

const ITER = 310000;
const SALT = crypto.createHash('sha256').update('product-page-templates · site gate').digest(); // 고정 salt (배포마다 같아야 다시 안 물어요)
const KEY = crypto.pbkdf2Sync(password, SALT, ITER, 32, 'sha256');

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const data = Buffer.concat([c.update(text, 'utf8'), c.final(), c.getAuthTag()]); // WebCrypto 는 암호문 뒤에 태그를 붙인 형태를 받아요
  return { iv: iv.toString('base64'), data: data.toString('base64') };
}

function gate(payload) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>상품페이지 템플릿</title>
<style>
:root { --paper: #f5f5f7; --panel: #fff; --ink: #17181b; --ink-3: #868a93; --rule: #e2e3e7; --accent: #3a50c9; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root { --paper: #111214; --panel: #1a1b1e; --ink: #ececef; --ink-3: #7c7f88; --rule: #2b2d32; --accent: #93a3ff; color-scheme: dark; } }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; background: var(--paper); color: var(--ink);
  font: 14px/1.6 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', system-ui, sans-serif; }
form { width: 100%; max-width: 340px; padding: 28px 24px; border: 1px solid var(--rule); border-radius: 16px; background: var(--panel); display: flex; flex-direction: column; gap: 12px; }
h1 { margin: 0; font-size: 18px; letter-spacing: -0.3px; }
p { margin: 0; color: var(--ink-3); font-size: 13px; }
input { font: inherit; font-size: 15px; padding: 10px 12px; border: 1px solid var(--rule); border-radius: 10px; background: var(--panel); color: var(--ink); }
input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
button { font: inherit; font-weight: 700; padding: 10px; border: 0; border-radius: 10px; background: var(--accent); color: #fff; cursor: pointer; }
button:disabled { opacity: .6; cursor: wait; }
.err { color: #e5484d; font-size: 13px; min-height: 1.6em; }
</style>
</head>
<body>
<form id="gate" autocomplete="off">
  <h1>상품페이지 템플릿</h1>
  <p>비밀번호를 넣으면 열려요. 한 번 열면 이 브라우저에서는 다시 묻지 않아요.</p>
  <input id="pw" type="password" aria-label="비밀번호" placeholder="비밀번호" autofocus required>
  <button id="go" type="submit">열기</button>
  <div class="err" id="err" role="alert"></div>
</form>
<script>
(function () {
  var P = ${JSON.stringify({ ...payload, salt: SALT.toString('base64'), iter: ITER })};
  var STORE = 'tpl-site-gate';
  var b64 = function (s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); };
  var toB64 = function (u) { var s = ''; for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); };
  function derive(pw) {
    return crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits'])
      .then(function (base) { return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: b64(P.salt), iterations: P.iter, hash: 'SHA-256' }, base, 256); })
      .then(function (bits) { return new Uint8Array(bits); });
  }
  function open(raw) {
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt'])
      .then(function (key) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(P.iv) }, key, b64(P.data)); })
      .then(function (buf) { return new TextDecoder().decode(buf); });
  }
  function show(html) { document.open(); document.write(html); document.close(); }
  var form = document.getElementById('gate'), err = document.getElementById('err'), go = document.getElementById('go');
  var saved = null;
  try { saved = localStorage.getItem(STORE); } catch (e) {}
  if (saved) {
    form.hidden = true;
    open(b64(saved)).then(show, function () { try { localStorage.removeItem(STORE); } catch (e) {} form.hidden = false; });
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    err.textContent = ''; go.disabled = true; go.textContent = '여는 중…';
    var raw;
    derive(document.getElementById('pw').value)
      .then(function (r) { raw = r; return open(r); })
      .then(function (html) { try { localStorage.setItem(STORE, toB64(raw)); } catch (e) {} show(html); },
        function () { err.textContent = '비밀번호가 맞지 않아요'; go.disabled = false; go.textContent = '열기'; });
  });
})();
</script>
</body>
</html>
`;
}

const files = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (e.name.endsWith('.html')) files.push(f);
  }
};
walk(dir);
for (const f of files) fs.writeFileSync(f, gate(encrypt(fs.readFileSync(f, 'utf8'))));
console.log(`✓ HTML ${files.length}개를 비밀번호로 잠갔어요 (${files.map((f) => path.relative(dir, f)).join(', ')})`);
