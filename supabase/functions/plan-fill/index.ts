// 기획서(PPT · Figma) → 페이지 템플릿 칸 채우기 (Supabase Edge Function · Deno)
//
// 사이트(site/app.js 「기획서에서 새 회차」)가 부르는 서버 함수예요. 비밀 값은 여기(서버)에만 있어요.
//   Supabase 대시보드 → Edge Functions → Secrets
//     ANTHROPIC_API_KEY  Claude API 키 (필수)
//     FIGMA_TOKEN        Figma 개인 액세스 토큰 (Figma 기획서를 읽을 때 · 그 계정이 볼 수 있는 파일만)
//     ALLOWED_ORIGINS    (선택) 부를 수 있는 사이트 주소, 쉼표로 — 기본 github.io 사이트 + localhost
//   함수 설정에서 「Enforce JWT verification」은 끄세요(사이트는 공개 키만 보내요).
//
// 요청 POST JSON
//   { template: { key, title, rows: [{ key, label, ids, defaultOff }], variants: [{ id, label, when, slots, sample }] },
//     source: { kind: "ppt", file, slides: [...] } | { kind: "figma", url } }
// 응답 JSON
//   { plan: { pick: {자리 키: variant}, off: [...], point, sections: { variant: 부분 내용 }, flags: [...] },
//     source: { kind, title, texts } }
// 규칙은 .claude/skills/ppt-to-issue/SKILL.md 와 같아요 — 기획서에 없는 문구는 지어내지 않아요.

import Anthropic from "npm:@anthropic-ai/sdk";

const MODEL = "claude-opus-5-5";
const DEFAULT_ORIGINS = ["https://hyjin502.github.io", "http://localhost:4173", "http://127.0.0.1:4173"];

function cors(origin: string | null) {
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const list = allowed.length ? allowed : DEFAULT_ORIGINS;
  const ok = !!origin && list.includes(origin);
  return {
    ok,
    headers: {
      "Access-Control-Allow-Origin": ok ? origin! : list[0],
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    },
  };
}

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });

/* ---------- Figma 기획서 읽기 — 보이는 글자를 위 → 아래, 왼쪽 → 오른쪽으로 */
type FigNode = {
  id: string; name: string; type: string; visible?: boolean; characters?: string;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  style?: { fontSize?: number; fontWeight?: number };
  fills?: { type: string; visible?: boolean; color?: { r: number; g: number; b: number } }[];
  children?: FigNode[];
};

function parseFigmaUrl(url: string) {
  const m = /figma\.com\/(?:design|file|proto)\/([A-Za-z0-9]+)(?:\/branch\/([A-Za-z0-9]+))?/.exec(url);
  if (!m) throw new Error("Figma 링크가 아니에요");
  const key = m[2] || m[1];
  const node = new URL(url).searchParams.get("node-id");
  return { key, node: node ? node.replace("-", ":") : null };
}

const hex = (c?: { r: number; g: number; b: number }) =>
  c ? "#" + [c.r, c.g, c.b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("") : "";

async function readFigma(url: string) {
  const token = Deno.env.get("FIGMA_TOKEN");
  if (!token) throw new Error("서버에 FIGMA_TOKEN 이 없어요 — Supabase 함수 Secrets 에 Figma 토큰을 넣어 주세요");
  const { key, node } = parseFigmaUrl(url);
  if (!node) throw new Error("Figma 링크에 node-id 가 없어요 — 기획서 프레임을 고르고 「링크 복사」한 주소를 넣어 주세요");
  const r = await fetch(`https://api.figma.com/v1/files/${key}/nodes?ids=${encodeURIComponent(node)}`, { headers: { "X-Figma-Token": token } });
  if (!r.ok) throw new Error(`Figma 응답 ${r.status} — 토큰 계정이 이 파일을 볼 수 있는지 확인해 주세요`);
  const data = await r.json();
  const root: FigNode | undefined = data.nodes?.[node]?.document;
  if (!root) throw new Error("Figma 에서 그 프레임을 찾지 못했어요");
  const texts: { frame: string; x: number; y: number; size?: number; weight?: number; color: string; text: string }[] = [];
  const images: { frame: string; name: string; w: number; h: number }[] = [];
  // 맨 위 묶음(PC 요청 · MO 요청 · 설명 등) 이름을 frame 으로 붙여요
  const walk = (n: FigNode, frame: string, depth: number) => {
    if (n.visible === false) return; // 숨긴 레이어(와 그 안)는 빼요
    const f = depth === 1 ? n.name : frame;
    if (n.type === "TEXT" && n.characters && n.characters.trim()) {
      const b = n.absoluteBoundingBox || { x: 0, y: 0, width: 0, height: 0 };
      texts.push({ frame: f, x: Math.round(b.x), y: Math.round(b.y), size: n.style?.fontSize, weight: n.style?.fontWeight, color: hex(n.fills?.find((p) => p.type === "SOLID" && p.visible !== false)?.color), text: n.characters.replace(/\u2028/g, "\n") });
    }
    if (n.fills?.some((p) => p.type === "IMAGE" && p.visible !== false) && n.absoluteBoundingBox) {
      images.push({ frame: f, name: n.name, w: Math.round(n.absoluteBoundingBox.width), h: Math.round(n.absoluteBoundingBox.height) });
    }
    for (const c of n.children || []) walk(c, f, depth + 1);
  };
  walk(root, root.name, 0);
  texts.sort((a, b) => (a.frame === b.frame ? (Math.abs(a.y - b.y) < 6 ? a.x - b.x : a.y - b.y) : 0));
  return { title: `${data.name || ""} · ${root.name}`, texts, images };
}

/* ---------- Claude 로 칸 채우기 */
const SYSTEM = `당신은 기획서(PPT 또는 Figma)를 상품 상세페이지 「페이지 템플릿」의 입력 칸에 옮기는 편집자예요.

규칙
- 기획서에 있는 문구만 씁니다. 문구를 지어내거나 다듬지 않아요. 기획서에 없는 칸은 sections 에 적지 않아요(샘플 그대로 남아요). 꼭 필요해서 문장을 만들었다면 flags 에 「만들어 넣은 문구」로 적어요.
- 슬라이드 · 프레임 순서를 그대로 믿지 말고 내용으로 어느 섹션인지 판단해요. 섹션 이름(제목 · 써머리 · 추천대상 · 아젠다 · 프로그램 · 신청 · FAQ · 하단 플로팅 등)을 단서로 써요.
- 글자 크기 · 굵기로 제목과 설명을 가려요. □ · - · • 로 시작하는 줄은 목록 항목(기호는 빼요). 문단의 일부만 굵으면 **굵게** 로 감싸요.
- 칸의 maxLines · maxChars(줄마다, 띄어쓰기 포함)를 넘으면 의미 단위로 줄을 나눠요(줄바꿈은 \\n). 문구는 바꾸지 않아요. 그래도 넘으면 그대로 두고 flags 에 적어요.
- 칸 spec 에 mo 가 있는 richtext 는 {"pc": "...", "mo": "..."} 로 PC · MO 문구를 따로 줄 수 있어요. 기획서에 MO 버전이 따로 있으면 그 문구를 mo 에, 없으면 문자열 하나만 써요.
- 목록(list)은 통째로 바꿔요 — 항목마다 item 의 칸 이름을 그대로 쓰고, 샘플 항목에 있던 칸 중 기획서에 없는 것은 샘플 값을 유지하지 말고 비우거나 빼요(아이콘 · 색 같은 고르기 칸은 샘플 값을 써도 돼요). max 개수를 넘기지 않아요.
- enum 칸은 values 중 하나, color 칸은 그 칸의 palette 값만 써요. 모르면 적지 않아요.
- 이미지 칸: 기획서 그림은 옮길 수 없어요 — 적지 않고, 넣어야 할 그림이 있으면 flags 에 「어느 섹션 · 무슨 그림」으로 적어요. 단 PPT 에서 온 그림 목록(images)에 있는 그림을 꼭 써야 하면 값으로 "ppt:<파일 이름>" 을 써요(예: {"kind":"image","src":"ppt:image3.png"} 또는 image 칸이면 {"src":"ppt:image3.png","alt":""}).
- 자리(rows): 기획서에 없는 섹션의 자리는 off 에 자리 키를 넣어요. defaultOff 인 자리를 켜려면 "+자리 키". 여러 variant 중 고르는 자리(ids 가 2개 이상)는 내용에 맞는 variant 를 pick 에 적어요.
- point: 기획서의 강조 색이 HDS 원색 700번(gray · red · red-orange · orange · yellow · lime · green · cyan · sky · blue · violet · purple · pink)에 가까우면 "<색>/700", 검정이면 "static/black", 모르면 "".
- 날짜 · 장소 · 버튼 문구처럼 기획서에 직접 있는 값은 그대로 써요. 기획서 메모(디자이너에게 하는 말 · 팝업 · 공유 버튼 같은 동작 요청)는 내용으로 넣지 말고 flags 로.
- flags 는 한국어 한 줄씩, 사람이 확인할 것만(애매했던 곳 · 비운 칸 · 넘친 글자 · 넣지 못한 그림 · 기획서 메모).

출력: sections 는 [{ "variant": "<variant id>", "content_json": "<그 섹션의 바꿀 칸만 담은 JSON 객체 문자열>" }] 형식. 바꿀 칸이 없는 섹션은 넣지 않아요.`;

const SCHEMA = {
  type: "object",
  properties: {
    pick: { type: "array", items: { type: "object", properties: { row: { type: "string" }, variant: { type: "string" } }, required: ["row", "variant"], additionalProperties: false } },
    off: { type: "array", items: { type: "string" } },
    point: { type: "string" },
    sections: { type: "array", items: { type: "object", properties: { variant: { type: "string" }, content_json: { type: "string" } }, required: ["variant", "content_json"], additionalProperties: false } },
    flags: { type: "array", items: { type: "string" } },
  },
  required: ["pick", "off", "point", "sections", "flags"],
  additionalProperties: false,
};

type Plan = { pick: { row: string; variant: string }[]; off: string[]; point: string; sections: { variant: string; content_json: string }[]; flags: string[] };

async function fillPlan(template: unknown, source: unknown) {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("서버에 ANTHROPIC_API_KEY 가 없어요 — Supabase 함수 Secrets 에 넣어 주세요");
  const client = new Anthropic({ apiKey });
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{
      role: "user",
      content: [
        { type: "text", text: "<template>\n" + JSON.stringify(template) + "\n</template>", cache_control: { type: "ephemeral" } },
        { type: "text", text: "<plan_document>\n" + JSON.stringify(source) + "\n</plan_document>\n\n위 기획서를 템플릿 칸에 옮겨 주세요." },
      ],
    }],
  } as never);
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("Claude 가 이 기획서를 처리하지 않았어요(안전 정책) — 내용을 확인해 주세요");
  if (msg.stop_reason === "max_tokens") throw new Error("결과가 너무 길어 잘렸어요 — 기획서를 나눠 넣어 주세요");
  const text = msg.content.filter((b: { type: string }) => b.type === "text").map((b: { text?: string }) => b.text || "").join("");
  const raw = JSON.parse(text) as Plan;
  const sections: Record<string, unknown> = {};
  const flags = [...raw.flags];
  for (const s of raw.sections) {
    try { sections[s.variant] = JSON.parse(s.content_json); } catch { flags.push(`${s.variant}: 결과를 읽지 못해 넣지 않았어요`); }
  }
  return { pick: Object.fromEntries(raw.pick.map((p) => [p.row, p.variant])), off: raw.off, point: raw.point, sections, flags, usage: msg.usage };
}

Deno.serve(async (req) => {
  const { ok, headers } = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (!ok) return json({ error: "이 주소에서는 부를 수 없어요" }, 403, headers);
  if (req.method !== "POST") return json({ error: "POST 로 불러 주세요" }, 405, headers);
  try {
    const body = await req.json();
    if (!body?.template?.variants?.length) return json({ error: "template 이 없어요" }, 400, headers);
    let source = body.source;
    if (source?.kind === "figma") source = { kind: "figma", ...(await readFigma(String(source.url || ""))) };
    else if (source?.kind !== "ppt") return json({ error: "source.kind 는 ppt 또는 figma 예요" }, 400, headers);
    const plan = await fillPlan(body.template, source);
    return json({ plan, source: { kind: source.kind, title: source.title || source.file || "", texts: (source.texts || source.slides || []).length } }, 200, headers);
  } catch (e) {
    const status = e instanceof Anthropic.APIError ? 502 : 400;
    return json({ error: String((e as Error)?.message || e) }, status, headers);
  }
});
