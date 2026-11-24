#!/usr/bin/env node
/* 칸에 맞춘 내용(plan) → 사이트 회차(Supabase issues 표, 「작성 중」)
   node scripts/ppt-to-issue.mjs <plan.json> [--dry | --share | --update <회차 id>]

   plan.json (기획서 PPT 를 ppt-read.mjs 로 읽고, ppt-to-issue 스킬이 템플릿 칸에 맞춰 만든 파일 — 사내 문서라 저장소 밖에 두세요)
   {
     "template": "monthly-hunet", "period": "2026-11", "title": "월간휴넷(PPT 테스트)", "by": "Claude · PPT 자동",
     "pick": { "<자리 키>": "<variant id>" },      // 자리 키 = 그 자리 variant id 를 | 로 이은 것
     "off": ["<자리 키>"],                          // 뺄 자리
     "point": "violet/700",                         // 페이지 포인트 컬러(선택 · HDS 700번)
     "sections": { "<variant id>": { …칸: 값 } },   // 샘플 위에 덮어써요(적지 않은 칸 = 샘플 그대로)
     "flags": [ "확인할 것 …" ]                      // 보고용(저장하지 않아요)
   }
   값 안의 그림 주소가 "local:<파일 경로>" 면 Storage(issues 파일함)에 올리고 그 주소로 바꿔요.
   검사(글자 수 · 줄 수 · 목록 개수)를 통과해야 저장해요. --dry 는 검사와 결과 요약만.
   --update <id> = 이미 만든 회차를 이 plan 으로 다시 써요(편집기에서 고친 내용은 덮여요).
   --share = 저장소 없이 공유 링크(#share-…)만 만들어요(로컬 파일 그림은 못 담아요). 저장에 실패해도 공유 링크를 함께 보여 줘요. */
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { createRequire } from 'node:module';
import { loadRegistry, validateContent, RENDER_CORE_PATH, ROOT } from './lib.mjs';

const RC = createRequire(import.meta.url)(RENDER_CORE_PATH);
// 사이트와 같은 공개 키(웹 페이지용, site/app.js SUPA) — secret 키는 쓰지 않아요
const APP = fs.readFileSync(path.join(ROOT, 'site/app.js'), 'utf8');
const SUPA = { url: APP.match(/const SUPA = \{ url: '([^']+)'/)[1], key: APP.match(/const SUPA = \{[^}]*key: '([^']+)'/)[1], bucket: 'issues' };

const blank = (x) => (x == null ? '' : x);
/** site/app.js editFrom 과 같아요 — content → 편집기 값 */
function editFrom(v, content) {
  const e = {};
  const ctx = RC.contextFor(v.slots, content);
  for (const [k, raw] of Object.entries(v.slots)) {
    const s = RC.specOf(raw);
    const val = s.point ? (content || {})[k] : ctx[k]; // 포인트 칸은 비면 비운 채로(페이지 포인트 컬러)
    if (s.type === 'richtext') {
      e[k] = RC.textLines(val, 'pc');
      const mo = RC.textLines(val, 'mo');
      if (s.mo && mo.join('\n') !== e[k].join('\n')) (e['@mo'] ||= {})[k] = mo;
    } else if (s.type === 'list') e[k] = (val || []).map((it, i) => Object.fromEntries(Object.entries(it).map(([kk, vv]) => [kk, blank(s.item && RC.specOf(s.item[kk]).point ? (((content || {})[k] || [])[i] || {})[kk] : vv)])));
    else if (s.type === 'media') {
      e[k] = { pc: (val && val.pc) || null, mo: (val && val.mo) || null, moSame: !(val && val.mo) };
      if (s.focus && val && val.pos) { e[k].pos = JSON.parse(JSON.stringify(val.pos)); if (e[k].pos.mo) e[k].pos.moOwn = true; }
    } else if (s.type === 'toggle') e[k] = !!val;
    else e[k] = val && typeof val === 'object' ? blank(val.pc) : blank(val);
  }
  return e;
}

async function upload(file) {
  const buf = fs.readFileSync(file);
  const ext = path.extname(file).slice(1).toLowerCase();
  const type = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', mp4: 'video/mp4' }[ext];
  if (!type) throw new Error(`올릴 수 없는 파일 형식: ${file}`);
  const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const r = await fetch(`${SUPA.url}/storage/v1/object/${SUPA.bucket}/${name}`, { method: 'POST', headers: { apikey: SUPA.key, 'Content-Type': type }, body: buf });
  if (!r.ok) throw new Error(`파일 올리기 실패 ${r.status}: ${await r.text()}`);
  return `${SUPA.url}/storage/v1/object/public/${SUPA.bucket}/${name}`;
}
async function resolveLocal(x, dir, dry) {
  if (Array.isArray(x)) { for (let i = 0; i < x.length; i++) x[i] = await resolveLocal(x[i], dir, dry); return x; }
  if (x && typeof x === 'object') { for (const k of Object.keys(x)) x[k] = await resolveLocal(x[k], dir, dry); return x; }
  if (typeof x === 'string' && x.startsWith('local:')) {
    const f = path.resolve(dir, x.slice(6));
    if (!fs.existsSync(f)) throw new Error(`파일이 없어요: ${f}`);
    return dry ? `(올릴 파일) ${path.basename(f)}` : await upload(f);
  }
  return x;
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const dry = args.includes('--dry');
  if (!file) { console.error('사용법: node scripts/ppt-to-issue.mjs <plan.json> [--dry]'); process.exit(1); }
  const plan = JSON.parse(fs.readFileSync(file, 'utf8'));
  const reg = loadRegistry();
  const t = reg.templates.find((x) => x.key === plan.template);
  if (!t) throw new Error(`없는 템플릿: ${plan.template}`);
  const rowKey = (r) => (r.extra ? 'extra:' + r.extra.join('|') : r.ids.join('|'));
  const rowKeys = t.rows.map(rowKey);
  for (const k of [...Object.keys(plan.pick || {}), ...(plan.off || [])]) if (!rowKeys.includes(k)) throw new Error(`없는 자리 키: ${k}\n  가능: ${rowKeys.join(', ')}`);

  const errors = [];
  const edits = {};
  const summary = [];
  for (const [id, part] of Object.entries(plan.sections || {})) {
    const v = reg.byId[id];
    if (!v || v.section !== t.key) { errors.push(`없는 섹션: ${id}`); continue; }
    await resolveLocal(part, path.dirname(path.resolve(file)), dry);
    const content = { ...JSON.parse(JSON.stringify(v.sample)), ...part };
    errors.push(...validateContent(v, content, id));
    const e = editFrom(v, content);
    const fresh = editFrom(v, v.sample);
    // 편집기가 「손대지 않은 샘플 사진」으로 보고 되돌리지 않게 — 기준(@base)과 샘플 판(@sv)을 함께 적어요
    e['@base'] = Object.fromEntries(Object.entries(v.slots).filter(([, raw]) => RC.specOf(raw).type === 'media').map(([k]) => [k, JSON.stringify(fresh[k] || null)]));
    if (v.sampleVersion) e['@sv'] = v.sampleVersion;
    // 포인트 칸 정리(site/app.js fixStaleAssets 의 PT_VER 와 같게) — 샘플에 남은 시안 색(= pointFallback)은 비워서 페이지 포인트 컬러를 따라가게.
    // plan 에 직접 적은 색만 남겨요
    const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
    for (const [k, raw] of Object.entries(v.slots)) {
      const s = RC.specOf(raw);
      if (s.point && !(k in part) && s.pointFallback && same(e[k], s.pointFallback)) e[k] = '';
      if (s.type === 'list' && s.item && Array.isArray(e[k]) && !(k in part)) {
        for (const [kk, rr] of Object.entries(s.item)) {
          const ss = RC.specOf(rr);
          if (ss.point && ss.pointFallback) e[k].forEach((it) => { if (same(it[kk], ss.pointFallback)) it[kk] = ''; });
        }
      }
    }
    e['@pt'] = 3; // 위 정리를 이미 한 값 (site/app.js PT_VER 와 같게)
    const changed = Object.keys(part).filter((k) => JSON.stringify(e[k]) !== JSON.stringify(fresh[k]));
    if (!changed.length) { summary.push(`  = ${v.label || id} — 샘플과 같아요`); continue; }
    edits[id] = e;
    summary.push(`  ✎ ${v.label || id} — ${changed.join(', ')}`);
  }
  const visible = t.rows.filter((r) => !r.extra && !(plan.off || []).includes(rowKey(r))).map((r) => (plan.pick || {})[rowKey(r)] || r.ids[0]);
  console.log(`템플릿 ${t.title} · ${plan.period} · ${plan.title}`);
  console.log(`보이는 섹션 ${visible.length}개: ${visible.map((id) => reg.byId[id].label || id).join(' → ')}`);
  console.log(summary.join('\n'));
  if (errors.length) { console.error('\n✗ 검사 실패\n  ' + errors.join('\n  ')); process.exit(1); }
  console.log('✓ 검사 통과 (글자 수 · 줄 수 · 목록 개수)');
  if (plan.flags?.length) console.log('\n확인할 것\n' + plan.flags.map((f, i) => `  ${i + 1}. ${f}`).join('\n'));
  if (dry) return;

  const data = { v: 1, edits, pick: plan.pick || {}, off: plan.off || [], extras: {}, order: [], point: plan.point || '' }; // point = 페이지 포인트 컬러(HDS 700번 키, 비우면 시안대로)
  // 공유 링크 — site/app.js zip() 과 같은 형식(deflate-raw + base64url, 앞에 z)
  const share = (base) => `${base}#share-${t.key}=z${zlib.deflateRawSync(Buffer.from(JSON.stringify(data))).toString('base64url')}`;
  const showShare = () => {
    console.log(`\n공유 링크 (저장소 없이 열려요 · 받은 쪽 브라우저에서 편집 — 회차 목록에는 안 남아요)`);
    console.log(`  로컬: ${share('http://localhost:4173/index.html')}`);
    console.log(`  사이트: ${share('https://hyjin502.github.io/product-page-templates/')}`);
  };
  if (args.includes('--share')) return showShare();
  const by = plan.by || 'PPT 자동';
  const upd = args.includes('--update') ? args[args.indexOf('--update') + 1] : null;
  if (upd) { // 이미 만든 회차를 같은 plan 으로 고쳐요 (덮어쓰기 방지 rev 를 올려요)
    const H = { apikey: SUPA.key, 'Content-Type': 'application/json', Prefer: 'return=representation' };
    const [cur] = await (await fetch(`${SUPA.url}/rest/v1/issues?id=eq.${upd}&select=id,rev,template`, { headers: H })).json();
    if (!cur || cur.template !== t.key) { console.error(`✗ 고칠 회차가 없어요: ${upd}`); process.exit(1); }
    const rr = await fetch(`${SUPA.url}/rest/v1/issues?id=eq.${upd}&rev=eq.${cur.rev}`, { method: 'PATCH', headers: H, body: JSON.stringify({ period: plan.period, title: plan.title, data, updated_by: by, rev: cur.rev + 1 }) });
    const rows = rr.ok ? await rr.json() : [];
    if (!rows.length) { console.error(`✗ 회차 고치기 실패 ${rr.status} — 그사이 누가 저장했으면 다시 실행해 주세요`); process.exit(2); }
    console.log(`\n✓ 회차를 고쳤어요 — id ${upd}\n  링크: https://hyjin502.github.io/product-page-templates/#i-${upd}\n  로컬: http://localhost:4173/index.html#i-${upd}`);
    return;
  }
  let r;
  try { r = await fetch(`${SUPA.url}/rest/v1/issues`, {
    method: 'POST',
    headers: { apikey: SUPA.key, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ template: t.key, period: plan.period, title: plan.title, status: 'draft', data, info: {}, created_by: by, updated_by: by }),
  }); } catch (e) { console.error(`\n✗ 저장소에 연결하지 못했어요 — ${(e.cause && e.cause.code) || e.message} (Supabase 프로젝트가 일시 정지됐는지 확인해 주세요)`); showShare(); process.exit(2); }
  if (!r.ok) { console.error(`\n✗ 회차 저장 실패 ${r.status}${r.status >= 520 ? " (저장소가 아직 깨어나는 중이에요 — 잠시 뒤 다시)" : ""}: ${(await r.text()).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 200)}`); showShare(); process.exit(2); }
  const [row] = await r.json();
  console.log(`\n✓ 회차를 만들었어요 — id ${row.id}`);
  console.log(`  링크: https://hyjin502.github.io/product-page-templates/#i-${row.id}`);
  console.log(`  로컬: http://localhost:4173/index.html#i-${row.id}`);
}
main().catch((e) => { console.error('✗ ' + (e.message || e)); process.exit(1); });
