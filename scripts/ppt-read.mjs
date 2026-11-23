#!/usr/bin/env node
/* 기획서 PPT(.pptx) → 슬라이드별 내용 JSON (AI 가 템플릿 칸에 맞추기 전 단계 — 같은 PPT 면 늘 같은 결과)
   node scripts/ppt-read.mjs <파일.pptx> [--out 결과.json] [--media 폴더]

   슬라이드마다:
   - section : 슬라이드 제목(「월간휴넷_5.아젠다」 → { no: 5, name: "아젠다" })
   - notes   : 「Description」 표의 메모(디자이너에게 주는 말 — 내용으로 넣지 않아요)
   - texts   : 내용 글상자 { shape, x, y, size, paras: [문단 — 굵은 부분은 **굵게**] } (위 → 아래, 왼쪽 → 오른쪽)
   - images  : 그림 { shape, file, x, y, w, h } (--media 를 주면 그 폴더에 파일을 꺼내요)
   - dropped : 걸러낸 것(자리 표시 · 번호 동그라미 · 여러 슬라이드에 같은 자리로 반복되는 글자)
   외부 패키지 없이 zip 을 직접 읽어요(zlib). 기획서는 사내 문서라 저장소에 넣지 말고 결과도 저장소 밖에 두세요. */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function unzip(buf) {
  // 끝 레코드 → 가운데 목록 → 파일마다 로컬 헤더
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('zip 이 아니에요 (.pptx 인지 확인해 주세요)');
  const n = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let i = 0; i < n; i++) {
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    p += 46 + nlen + xlen + clen;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + csize);
    files.set(name, () => (method === 8 ? zlib.inflateRawSync(raw) : raw));
  }
  return files;
}

const unxml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const attr = (s, k) => { const m = s.match(new RegExp(`\\s${k}="([^"]*)"`)); return m ? m[1] : null; };
const EMU = 12700; // 1pt

/** 문단 → 글자(굵은 연속 구간은 **…**) · 가장 큰 글자 크기 */
function para(p) {
  const runs = [...p.matchAll(/<a:(r|br)\b[^>]*?(?:\/>|>([\s\S]*?)<\/a:\1>)/g)].map((m) => {
    if (m[1] === 'br') return { t: '\n', b: false };
    const rpr = (m[2].match(/<a:rPr\b[^>]*>/) || [''])[0];
    return { t: unxml((m[2].match(/<a:t>([\s\S]*?)<\/a:t>/) || [, ''])[1]), b: attr(rpr, 'b') === '1', sz: +attr(rpr, 'sz') || 0 };
  });
  const text = runs.map((r) => r.t).join('');
  if (!text.trim()) return null;
  // 문단 전체가 굵으면 표시하지 않고 bold: true (제목 등) — 일부만 굵으면 **…**
  const vis = runs.filter((r) => r.t.trim());
  const allBold = vis.length && vis.every((r) => r.b);
  let out = '';
  if (allBold) out = text;
  else {
    let open = false;
    for (const r of runs) {
      if (r.b && r.t.trim() && !open) { out += '**'; open = true; }
      if (!r.b && r.t.trim() && open) { out = out.replace(/(\s*)$/, '**$1'); open = false; }
      out += r.t;
    }
    if (open) out = out.replace(/(\s*)$/, '**$1');
  }
  return { text: out.replace(/[ \t]+$/g, '').replace(/^[ \t]+/, ''), bold: !!allBold, size: Math.max(0, ...runs.map((r) => r.sz || 0)) / 100 || null };
}

function shapes(xml) {
  const out = [];
  // 묶음(grpSp)은 안의 도형을 따로 봐요 — 다만 표처럼 쓰인 묶음(Description · 화면 ID)은 이름표로 구분
  const re = /<p:(sp|pic|graphicFrame)>([\s\S]*?)<\/p:\1>/g;
  for (const m of xml.matchAll(re)) {
    const body = m[2];
    const nv = body.match(/<p:cNvPr\b[^>]*>/);
    const name = nv ? unxml(attr(nv[0], 'name') || '') : '';
    const off = body.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/);
    const ext = body.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
    const geom = (body.match(/<a:prstGeom prst="([^"]+)"/) || [, ''])[1];
    const paras = [...body.matchAll(/<a:p>([\s\S]*?)<\/a:p>|<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)].map((pm) => para(pm[1] ?? pm[2])).filter(Boolean);
    const embed = (body.match(/r:embed="([^"]+)"/) || [, null])[1];
    out.push({ kind: m[1], name, geom, x: off ? Math.round(+off[1] / EMU) : 0, y: off ? Math.round(+off[2] / EMU) : 0, w: ext ? Math.round(+ext[1] / EMU) : 0, h: ext ? Math.round(+ext[2] / EMU) : 0, paras, embed });
  }
  return out;
}

export function readPpt(file, { media } = {}) {
  const z = unzip(fs.readFileSync(file));
  const read = (n) => (z.get(n) ? z.get(n)().toString('utf8') : '');
  const order = [...read('ppt/presentation.xml').matchAll(/<p:sldId\b[^>]*r:id="([^"]+)"/g)].map((m) => m[1]);
  const prels = Object.fromEntries([...read('ppt/_rels/presentation.xml.rels').matchAll(/<Relationship\b[^>]*>/g)].map((m) => [attr(m[0], 'Id'), attr(m[0], 'Target')]));
  const slideFiles = order.map((id) => 'ppt/' + prels[id].replace(/^\/?ppt\//, ''));
  if (media) fs.mkdirSync(media, { recursive: true });

  const slides = slideFiles.map((sf, i) => {
    const xml = read(sf);
    const rels = Object.fromEntries([...read(sf.replace('slides/', 'slides/_rels/') + '.rels').matchAll(/<Relationship\b[^>]*>/g)].map((m) => [attr(m[0], 'Id'), attr(m[0], 'Target')]));
    const all = shapes(xml);
    const s = { no: i + 1, section: null, notes: [], meta: [], texts: [], images: [], dropped: [] };
    // 표처럼 쓰인 묶음 — 「Description」 · 「화면 ID」 · 「요청자」 표는 글자를 한 줄씩 모아요
    const grp = [...xml.matchAll(/<p:grpSp>([\s\S]*?)<\/p:grpSp>/g)].map((g) => g[1]);
    const inGroup = new Set();
    for (const g of grp) {
      const gs = shapes(g);
      const txt = gs.flatMap((x) => x.paras.map((p) => p.text));
      if (txt[0] === 'Description') { s.notes.push(...txt.slice(1).filter((t) => !/^(\*|\d+)$/.test(t.trim()))); gs.forEach((x) => inGroup.add(`${x.name}@${x.x},${x.y}`)); }
      else if (/^(화면 ID|요청자|업무 구분)$/.test(txt[0] || '')) { s.meta.push(txt.join(' · ')); gs.forEach((x) => inGroup.add(`${x.name}@${x.x},${x.y}`)); }
    }
    for (const x of all) {
      if (inGroup.has(`${x.name}@${x.x},${x.y}`)) continue;
      if (x.kind === 'pic' || (x.embed && !x.paras.length)) {
        const target = rels[x.embed];
        if (!target) continue;
        const src = path.posix.normalize(path.posix.join(path.posix.dirname(sf), target));
        const file = path.basename(src);
        if (media && z.get(src)) fs.writeFileSync(path.join(media, file), z.get(src)());
        s.images.push({ shape: x.name, file, x: x.x, y: x.y, w: x.w, h: x.h });
        continue;
      }
      if (!x.paras.length) continue;
      // 표 하나로 된 「Description」(디자이너 메모) · 「화면 ID」 · 「요청자」 표
      const head = x.paras[0].text.trim();
      if (head === 'Description') { s.notes.push(...x.paras.slice(1).map((p) => p.text.trim()).filter((t) => t && !/^(\*|\d+|.)$/.test(t))); continue; }
      if (/^(화면 ID|요청자|업무 구분)$/.test(head)) { s.meta.push(x.paras.map((p) => p.text).join(' · ')); continue; }
      const joined = x.paras.map((p) => p.text).join(' ').trim();
      // 슬라이드 제목 「월간휴넷_5.아젠다」
      const t = x.name.startsWith('제목') || /^Title/i.test(x.name) ? joined.replace(/\s+/g, '') : null;
      const sec = t && t.match(/^(.+?)_(\d+)\.(.+)$/);
      if (sec) { s.section = { page: sec[1], no: +sec[2], name: sec[3] }; continue; }
      if (t && !s.section) { s.section = { page: null, no: null, name: joined }; continue; }
      // 자리 표시 · 번호 동그라미
      if (/^(이미지|이미지 영역|image|img)$/i.test(joined)) { s.dropped.push({ why: '자리 표시', text: joined }); continue; }
      if (x.geom === 'ellipse' && /^\d{1,2}$/.test(joined)) { s.dropped.push({ why: '번호 표시', text: joined }); continue; }
      s.texts.push({ shape: x.name, x: x.x, y: x.y, w: x.w, size: Math.max(0, ...x.paras.map((p) => p.size || 0)) || null, paras: x.paras.map((p) => (p.bold ? { text: p.text, bold: true } : { text: p.text })) });
    }
    return s;
  });

  // 여러 슬라이드(3장 이상)에 같은 자리 · 같은 글자로 반복되는 글상자 = 양식 찌꺼기(예: 「너무」)
  const seen = new Map();
  for (const s of slides) for (const t of s.texts) { const k = t.paras.map((p) => p.text).join('|'); seen.set(k, (seen.get(k) || 0) + 1); }
  for (const s of slides) {
    s.texts = s.texts.filter((t) => {
      const k = t.paras.map((p) => p.text).join('|');
      if (seen.get(k) >= 3 && k.length <= 10) { s.dropped.push({ why: '여러 슬라이드에 반복', text: k }); return false; }
      return true;
    });
    s.texts.sort((a, b) => (Math.abs(a.y - b.y) < 8 ? a.x - b.x : a.y - b.y));
    s.images.sort((a, b) => a.y - b.y || a.x - b.x);
  }
  return { file: path.basename(file), slides };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--out' && args[args.indexOf(a) - 1] !== '--media');
  if (!file) { console.error('사용법: node scripts/ppt-read.mjs <파일.pptx> [--out 결과.json] [--media 폴더]'); process.exit(1); }
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const res = readPpt(file, { media: opt('--media') });
  const json = JSON.stringify(res, null, 2);
  if (opt('--out')) { fs.writeFileSync(opt('--out'), json); console.log(`✓ ${res.slides.length}장 → ${opt('--out')}`); }
  else console.log(json);
}
