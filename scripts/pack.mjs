// 회사·팀 전달용 zip 만들기
//   npm run pack
//   → release/product-page-templates-src-<버전>-<날짜>.zip   소스 전체(.git 이력 포함, node_modules·dist 제외)
//   → release/product-page-templates-site-<버전>-<날짜>.zip  빌드된 사이트(dist/) — 사내 웹서버에 그대로 업로드
// zip 은 mac/Windows 내장 tar(bsdtar), Linux 는 zip 명령을 써요.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { ROOT } from './lib.mjs';

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const now = new Date();
const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`; // 로컬 날짜
const rel = path.join(ROOT, 'release');
fs.mkdirSync(rel, { recursive: true });

function run(cmd, argv, opts = {}) {
  const r = spawnSync(cmd, argv, { cwd: ROOT, stdio: 'inherit', ...opts });
  if (r.status !== 0) { console.error(`✗ ${cmd} ${argv.join(' ')} 실패`); process.exit(1); }
}

// 1) 빌드 · 검증
run(process.execPath, ['scripts/build.mjs']);
run(process.execPath, ['scripts/validate.mjs']);

// 2) 커밋 안 된 변경 알림 (소스 zip 에는 작업 폴더 그대로 들어가요)
try {
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (dirty) console.log('! 커밋하지 않은 변경이 있어요 — zip 에는 현재 파일 그대로 들어가요. 이력에 남기려면 먼저 커밋하세요.');
} catch { console.log('! git 저장소가 아니에요 — 소스 zip 에 이력이 없어요.'); }

function zip(outFile, cwd, excludes) {
  if (fs.existsSync(outFile)) fs.rmSync(outFile);
  if (process.platform === 'linux') {
    run('zip', ['-r', '-q', outFile, '.', ...excludes.flatMap((e) => ['-x', `${e}/*`, '-x', e])], { cwd });
  } else {
    run('tar', ['-a', '-c', '-f', outFile, ...excludes.flatMap((e) => ['--exclude', e]), '.'], { cwd });
  }
}

const base = `${pkg.name}`;
const src = path.join(rel, `${base}-src-${pkg.version}-${date}.zip`);
const site = path.join(rel, `${base}-site-${pkg.version}-${date}.zip`);
zip(src, ROOT, ['./node_modules', './dist', './release', '.DS_Store', 'node_modules', 'dist', 'release']);
zip(site, path.join(ROOT, 'dist'), ['./shots', './preview', './extract', 'shots', 'preview', 'extract', '.DS_Store']);

const mb = (f) => (fs.statSync(f).size / 1024 / 1024).toFixed(1) + 'MB';
console.log(`\n✓ ${path.relative(ROOT, src)} (${mb(src)})  — 회사에서 풀고: npm install && npm run build`);
console.log(`✓ ${path.relative(ROOT, site)} (${mb(site)})  — 사내 웹서버에 풀어서 올리면 끝 (index.html 이 라이브러리)`);
