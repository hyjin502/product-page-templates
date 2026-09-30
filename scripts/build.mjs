// 레지스트리 → dist/index.html (라이브러리 사이트) + dist/pages/<name>/index.html (조립된 상품페이지)
//   node scripts/build.mjs            전체 빌드
//   node scripts/build.mjs --watch    파일이 바뀌면 다시 빌드
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ROOT, BASE_CSS_PATH, PAGER_JS_PATH, FONT_LINK, pagerOf, loadRegistry, createEnv, renderVariant, cssFor, figmaUrl,
  validateContent, validatePage,
} from './lib.mjs';

const DIST = path.join(ROOT, 'dist');
const PAGES_DIR = path.join(ROOT, 'pages');

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, e.name), d = path.join(to, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

/* ---------------------------------------------------------------- library */

function buildLibrary(reg, env, baseCss) {
  const { catalog } = reg;
  const data = {
    figmaFile: figmaUrl(catalog, null),
    baseCss,
    pagerJs: fs.readFileSync(PAGER_JS_PATH, 'utf8'),
    fontLink: FONT_LINK,
    sections: catalog.sections.map((s) => ({
      key: s.key, role: s.role, order: s.order, variants: s.variants,
      figmaSet: figmaUrl(catalog, s.figmaSet), figmaSetDev: figmaUrl(catalog, s.figmaSet, true),
    })),
    variants: reg.variants.map((v) => ({
      id: v.id, section: v.section, layout: v.layout, when: v.when, body: v.body || 980,
      figma: Object.fromEntries(['pc', 'tb', 'mo'].map((d) => [d, v.figma?.[d] ? { url: figmaUrl(catalog, v.figma[d]), dev: figmaUrl(catalog, v.figma[d], true), node: v.figma[d] } : null])),
      slots: v.slots,
      options: Object.fromEntries(Object.entries(v.options || {}).map(([k, o]) => [k, {
        label: o.label, class: o.class, moOnly: !!o.moOnly,
        figma: Object.fromEntries(['pc', 'tb', 'mo'].map((d) => [d, o.figma?.[d] ? { url: figmaUrl(catalog, o.figma[d]), dev: figmaUrl(catalog, o.figma[d], true), node: o.figma[d] } : null])),
      }])),
      stage: v.stage || null,
      pager: pagerOf(v),
      html: renderVariant(env, v, v.sample),
      css: cssFor(reg, [v.id]),
      js: v.js,
      template: v.template,
      sample: v.sample,
    })),
  };
  const shell = fs.readFileSync(path.join(ROOT, 'site/shell.html'), 'utf8');
  const out = shell
    .replace('/*APP_CSS*/', () => fs.readFileSync(path.join(ROOT, 'site/app.css'), 'utf8'))
    .replace('/*APP_DATA*/', () => `window.REG = ${JSON.stringify(data).replace(/</g, '\\u003c')};`)
    .replace('/*APP_JS*/', () => fs.readFileSync(path.join(ROOT, 'site/app.js'), 'utf8'));
  fs.writeFileSync(path.join(DIST, 'index.html'), out);
  // 지난 빌드의 남은 파일(이름이 바뀐 이미지 등)이 섞이지 않게 비우고 다시 복사해요
  fs.rmSync(path.join(DIST, 'assets'), { recursive: true, force: true });
  copyDir(path.join(ROOT, 'assets'), path.join(DIST, 'assets'));
}

/* ---------------------------------------------------------------- pages */

/** 렌더된 HTML의 로컬 src 를 페이지 폴더 assets/ 로 복사하고 경로를 맞춰요 */
function collectAssets(html, pageFile, outDir) {
  return html.replace(/\bsrc="([^"]+)"/g, (m, src) => {
    if (/^(https?:|data:|\/\/)/.test(src)) return m;
    const candidates = [path.resolve(path.dirname(pageFile), src), path.resolve(ROOT, src)];
    const file = candidates.find((f) => fs.existsSync(f));
    if (!file) throw new Error(`${path.relative(ROOT, pageFile)}: 이미지 파일을 찾을 수 없어요 — ${src}`);
    const rel = path.relative(ROOT, file);
    const target = rel.startsWith('assets' + path.sep) ? rel : path.join('assets', 'img', path.basename(file));
    fs.mkdirSync(path.join(outDir, path.dirname(target)), { recursive: true });
    fs.copyFileSync(file, path.join(outDir, target));
    return `src="${target.split(path.sep).join('/')}"`;
  });
}

export function renderPage(reg, env, baseCss, page) {
  const ids = page.sections.map((s) => s.variant);
  const body = page.sections
    .map((s) => `<!-- section: ${s.variant} -->\n${renderVariant(env, reg.byId[s.variant], s.content || {}, { body: s.body, theme: s.theme, options: s.options, pager: s.pager })}`)
    .join('\n\n');
  const usesPager = ids.some((id) => reg.byId[id].pager);
  const js = [...(usesPager ? [fs.readFileSync(PAGER_JS_PATH, 'utf8')] : []), ...[...new Set(ids)].map((id) => reg.byId[id].js).filter(Boolean)].join('\n');
  return `<!doctype html>
<html lang="ko"${page.theme === 'dark' ? ' data-theme="dark"' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${String(page.title || '상품페이지').replace(/</g, '&lt;')}</title>
${FONT_LINK}
<style>
${baseCss.trim()}

${cssFor(reg, ids)}
</style>
</head>
<body>
${body}
${js ? `<script>\n${js}\n</script>\n` : ''}</body>
</html>
`;
}

function buildPages(reg, env, baseCss) {
  if (!fs.existsSync(PAGES_DIR)) return [];
  fs.rmSync(path.join(DIST, 'pages'), { recursive: true, force: true }); // 지운 page.json 의 결과물도 남지 않게
  const built = [];
  for (const f of fs.readdirSync(PAGES_DIR).filter((n) => n.endsWith('.page.json')).sort()) {
    const file = path.join(PAGES_DIR, f);
    const page = JSON.parse(fs.readFileSync(file, 'utf8'));
    const errors = validatePage(reg, page, f);
    if (errors.length) throw new Error(errors.join('\n'));
    const name = f.replace(/\.page\.json$/, '');
    const outDir = path.join(DIST, 'pages', name);
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    const html = collectAssets(renderPage(reg, env, baseCss, page), file, outDir);
    fs.writeFileSync(path.join(outDir, 'index.html'), html);
    fs.copyFileSync(file, path.join(outDir, 'page.json'));
    built.push(path.relative(ROOT, path.join(outDir, 'index.html')));
  }
  return built;
}

/* ---------------------------------------------------------------- main */

export function build() {
  const reg = loadRegistry();
  if (reg.loadErrors.length) throw new Error(reg.loadErrors.join('\n'));
  const errors = reg.variants.flatMap((v) => validateContent(v, v.sample, `${v.id}/sample.json`));
  if (errors.length) throw new Error(errors.join('\n'));
  const env = createEnv();
  const baseCss = fs.readFileSync(BASE_CSS_PATH, 'utf8');
  fs.mkdirSync(DIST, { recursive: true });
  buildLibrary(reg, env, baseCss);
  fs.copyFileSync(path.join(ROOT, 'GUIDE.html'), path.join(DIST, 'guide.html')); // 비개발자용 사용 가이드
  fs.writeFileSync(path.join(DIST, '.nojekyll'), ''); // GitHub Pages 가 _ 로 시작하는 파일을 숨기지 않게
  const pages = buildPages(reg, env, baseCss);
  return { variants: reg.variants.length, pages };
}

function run() {
  try {
    const r = build();
    console.log(`✓ 라이브러리 dist/index.html (variant ${r.variants}개)`);
    r.pages.forEach((p) => console.log(`✓ 페이지 ${p}`));
    return true;
  } catch (e) {
    console.error(`✗ 빌드 실패\n${e.message}`);
    return false;
  }
}

// 직접 실행했을 때만 (Windows 경로도 URL 로 바꿔 비교)
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const ok = run();
  if (process.argv.includes('--watch')) {
    let t;
    for (const d of ['sections', 'tokens', 'site', 'pages', 'assets']) {
      fs.watch(path.join(ROOT, d), { recursive: true }, () => { clearTimeout(t); t = setTimeout(run, 120); });
    }
    console.log('변경을 기다리는 중… (Ctrl+C 로 종료)');
  } else if (!ok) process.exit(1);
}
