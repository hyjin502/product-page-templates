// page.json 검증 — 빌드 전에 슬롯 누락·개수 초과·없는 variant 를 잡아요
//   node scripts/validate.mjs                    pages/*.page.json 과 모든 sample.json
//   node scripts/validate.mjs pages/foo.page.json
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadRegistry, validateContent, validatePage } from './lib.mjs';

const reg = loadRegistry();
const args = process.argv.slice(2);
const files = args.length
  ? args.map((a) => path.resolve(a))
  : fs.readdirSync(path.join(ROOT, 'pages')).filter((n) => n.endsWith('.page.json')).map((n) => path.join(ROOT, 'pages', n));

const errors = args.length ? [] : [...reg.loadErrors, ... reg.variants.flatMap((v) => validateContent(v, v.sample, `${v.id}/sample.json`))];
for (const f of files) {
  const rel = path.relative(ROOT, f);
  try {
    errors.push(...validatePage(reg, JSON.parse(fs.readFileSync(f, 'utf8')), rel));
  } catch (e) {
    errors.push(`${rel}: ${e.message}`);
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length}건\n` + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
console.log(`✓ 통과 (page ${files.length}개, variant ${reg.variants.length}개)`);
