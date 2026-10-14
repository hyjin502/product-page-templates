// Figma 플러그인 만들기 — figma-plugin/src/main.js 에 DATA(섹션 스펙·Figma 컴포넌트 키·HDS 색)를 붙여 figma-plugin/code.js 로 써요.
// npm run build 가 함께 돌려요. 디자이너는 Figma 「Plugins → Development → Import plugin from manifest」로 figma-plugin/manifest.json 을 열어요.
//
// 컴포넌트 키(figma-plugin/components.json)는 relink 로 노드가 바뀌면 다시 받아요 — use_figma(dxhWk) 로 아래 KEYS 를 실행:
//   const IDS = [...meta.json 의 figma.pc·mo 노드];
//   const out = {}; for (const id of IDS) { const n = await figma.getNodeByIdAsync(id); if (n && n.type === 'COMPONENT') out[id] = [n.key, Math.round(n.width), Math.round(n.height)]; }
//   return out;
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { ROOT, loadRegistry, specOf, slimSpec } from './lib.mjs';

const RAW = 'https://raw.githubusercontent.com/hyjin502/product-page-templates/main/';
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

/** 슬롯 종류만 (plan 이 값을 해석할 때 씀) */
function kinds(fields) {
  const out = {};
  for (const [k, raw] of Object.entries(fields || {})) {
    const s = specOf(raw);
    const o = { type: s.type };
    for (const f of ['optional', 'default', 'noneValue', 'palette']) if (s[f] != null) o[f] = s[f];
    if (s.type === 'list') o.item = kinds(s.item);
    out[k] = o;
  }
  return out;
}

export function buildFigmaPlugin(reg = loadRegistry()) {
  const comps = readJson('figma-plugin/components.json').components;
  const hds = readJson('tokens/hds.json');
  const variants = {};
  const missing = [];
  for (const v of reg.variants) {
    const figma = { pc: v.figma?.pc || null, mo: v.figma?.mo || null };
    // figmaFrame: 컴포넌트가 아닌 프레임 시안 — 원본 파일에서만 복제(clone)해요
    for (const d of ['pc', 'mo']) if (figma[d] && !comps[figma[d]]) { if (v.figmaFrame) comps[figma[d]] = { frame: true }; else { missing.push(`${v.id} ${d} ${figma[d]}`); figma[d] = null; } }
    variants[v.id] = { figma, spec: slimSpec(v.slots, true), kinds: kinds(v.slots), sample: v.sample };
  }
  const data = {
    raw: RAW,
    hds: { colors: hds.colors, aliases: hds.aliases, radius: hds.radius, text: hds.text, line: hds.line },
    components: comps,
    variants,
  };
  const main = fs.readFileSync(path.join(ROOT, 'figma-plugin/src/main.js'), 'utf8');
  const code = `// 자동 생성 — scripts/figma-plugin.mjs (고치려면 figma-plugin/src/main.js)\nconst DATA = ${JSON.stringify(data)};\n${main}`;
  fs.writeFileSync(path.join(ROOT, 'figma-plugin/code.js'), code);
  return { variants: Object.keys(variants).length, missing };
}

/** 사이트에서 받을 수 있게 dist/figma-plugin.zip 으로 묶어요 (폴더 하나: manifest.json · code.js · ui.html).
 *  zip 은 mac/Windows 내장 tar(bsdtar), Linux 는 zip 명령 — 실패해도 빌드는 계속해요 */
export function packFigmaPlugin(dist) {
  const dir = path.join(dist, 'figma-plugin');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const f of ['manifest.json', 'code.js', 'ui.html']) fs.copyFileSync(path.join(ROOT, 'figma-plugin', f), path.join(dir, f));
  const out = path.join(dist, 'figma-plugin.zip');
  fs.rmSync(out, { force: true });
  const r = process.platform === 'linux'
    ? spawnSync('zip', ['-r', '-q', out, 'figma-plugin'], { cwd: dist })
    : spawnSync('tar', ['-a', '-c', '-f', out, 'figma-plugin'], { cwd: dist });
  fs.rmSync(dir, { recursive: true, force: true }); // 폴더는 남기지 않아요 (protect 가 ui.html 을 잠그지 않게)
  return r.status === 0 && fs.existsSync(out);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const r = buildFigmaPlugin();
  console.log(`✓ figma-plugin/code.js (variant ${r.variants}개)`);
  for (const m of r.missing) console.warn(`  △ 컴포넌트 키 없음: ${m}`);
}
