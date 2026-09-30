# 상품페이지 템플릿 시스템 — Claude 작업 가이드

디자이너가 매번 같은 구성으로 만드는 상품페이지를 **Figma 섹션 템플릿 + HTML 템플릿**으로 통합한다. 한 사이트(라이브러리·조합기)에서 Figma로 이동하고 코드를 가져간다. 디자이너가 Figma에서 조합한 페이지는 스킬로 HTML이 되어 프론트에 전달된다.

**핵심 원칙: AI는 Figma에서 "내용"만 뽑고(page.json), HTML은 `sections/` 템플릿이 결정적으로 조립한다.** 스킬이 HTML을 즉석에서 쓰지 않는다. 같은 입력이면 항상 같은 HTML이 나온다.

## Figma 원본
- `[UI] 커피 정수기` 파일 **Page 18** (fileKey `S3cLqJIqHJbX2eREe4iGXr`, page `6187:23`) — `sections/sections.json` 에 있다.
- 원본 파일을 옮기거나 공식 템플릿 파일로 바꾸면 `sections/sections.json` 의 `figma.fileKey` 와 각 `meta.json` 의 `figma.pc/mo`·`options.*.figma` 노드 ID 를 새 파일 기준으로 바꾼다.
- 예전 아티팩트가 가리키던 `상품페이지 템플릿 시스템`(dxhWk…) 파일은 권한이 없던 파일이다. 참고용일 뿐이다.
- Figma MCP(claude.ai Figma 커넥터 또는 figma MCP)가 연결돼 있어야 한다. `use_figma` 전에는 `figma:figma-use` 스킬, `get_design_context` 전에는 `figma:figma-design-to-code` 스킬을 로드한다.
- **원격 Figma 플러그인 환경에는 Pretendard 폰트가 없다.** 그래서 인스턴스를 만들거나 텍스트를 쓰는 작업은 실패한다(읽기는 가능). 실제 조합 프레임 테스트는 디자이너가 프레임을 만들어 URL 을 준다.

## 반드시 지킬 규칙
- **샘플 문구·이미지는 Page 18 원문 그대로.** 지어낸 문구(예: 제품 카피)를 넣지 않는다. 사용자가 명시적으로 지적한 사항이다.
- 반응형 3단 — **MO ≤767 / TB 768–1279 / PC ≥1280** (정의는 `tokens/base.css` 상단 한 곳). Figma 에 TB 프레임이 없어서 TB 값은 코드에서 정한 기본값이다.
- 버튼 클래스는 Figma button `type` 값 그대로: `.btn--neutral` = 진한 회색, `.btn--subtle` = 연한 회색 (예전 아티팩트는 반대였다).
- 색·자간은 `tokens/base.css` 토큰만 쓴다. 섹션 CSS 는 섹션 루트 클래스로 한정(BEM)하고 PC → TB → MO 순서로 쓴다.
- 카드형 섹션의 배치는 **Figma 오토레이아웃을 읽어서** 정한다 (`meta.pager`):
  - `fill` — 가로 한 줄 + 채우기: 카드가 적으면 넓어지고, 한 줄 최대를 넘으면 페이지 넘김과 점
  - `grid` — 열 고정 그리드: 줄이 늘고, 페이지 줄 수를 넘으면 넘김
  - `none` — MO 세로 쌓기, 고정 폭 스크롤 등 섹션 기본 배치
  - 동작 코드는 `tokens/pager.js`
- MO 에만 있는 대체 배치(`*-compact`)와 `mode=dark` 는 별도 variant 가 아니라 `meta.options` 로 둔다.
- Figma 파일은 **읽기만** 한다. 수정이 필요하면 디자이너에게 요청 목록으로 전달한다.

## 구조
```
tokens/base.css, tokens/pager.js        공통 토큰·컴포넌트·브레이크포인트, 카드 페이지 넘김 런타임
sections/sections.json                  섹션 카탈로그(기본 순서·Figma 섹션 노드)
sections/<section>/<layout>/            variant = meta.json · template.njk · style.css · sample.json (+ script.js)
sections/<section>/_shared.css          섹션 공통 CSS
sections/_partials/ui.njk               ctas · media · secHead · pagerDots 매크로
pages/*.page.json                       조립할 페이지 → dist/pages/<name>/
pages/_verify/                          Page 18 추출 검증 결과
site/                                   라이브러리·조합기 사이트 셸 (build 가 dist/index.html 로 합침)
scripts/                                build · validate · preview · shot · serve · pack · figma-extract · lib
.claude/skills/                         add-section-variant · figma-to-page
```

## 명령
| 명령 | 용도 |
|---|---|
| `npm run build` | 라이브러리(`dist/index.html`) + `pages/*.page.json` 조립 |
| `npm run dev` | 변경 감지 재빌드 |
| `npm run validate` | page.json · sample.json 슬롯 검증 |
| `npm run preview -- --section <key>` | variant 단독 미리보기 (`dist/preview/`) |
| `npm run shot [-- <대상>]` | **결과 확인**: PC 1920 · TB 1024 · MO 375 캡처 → `dist/shots/` (대상: 생략=라이브러리, 페이지 이름, `preview/<id>`) |
| `npm run serve [-- --base /templates/]` | dist 를 http 로 서빙 (사내 호스팅 흉내) |
| `npm run pack` | 전달용 zip 2개 → `release/` |
| `node scripts/figma-extract.mjs …` | Figma → page.json (scan → extract → finalize), 검증 `--verify` + `report` |

## 작업 흐름
- **새 섹션/variant** → `add-section-variant` 스킬 (슬롯 매핑 문법·pager 판단 규칙 포함)
- **디자이너가 조합한 Figma 페이지 → HTML** → `figma-to-page` 스킬
- **매핑이 Page 18 원문을 그대로 뽑는지 확인** → `figma-extract.mjs scan-components … --verify` → use_figma 실행 → `report` (현재 98건 중 92건 일치)
- **UI·섹션을 바꾼 뒤에는 반드시 `npm run shot` 으로 결과를 보고** Figma `get_screenshot` 과 비교한다. 사용자는 결과물 확인을 가장 중요하게 여긴다.
- 라이브러리 사이트는 결과물(미리보기)이 먼저 보이도록 컴팩트하게 유지한다. 설명 문구를 늘리지 않는다.

## 알려진 과제 (다음에 할 일 후보)
- 추출 검증에서 차이가 난 6건(설명 가능한 차이): feature compact 옵션 문구, detail-slide 슬라이드 수, faq·notice 유의사항 줄바꿈(Figma 원문 수정 필요)
- 추출하지 않는 슬롯(sample 유지): compare-vs-spec 행(Figma 가 열 단위 구조), inquiry 폼 그룹, plan-comparison 셀 태그. pricing-receipt·sticky-cta·inquiry 는 MO 를 추출하지 않음(`extractFrom: "pc"`)
- 디자이너 레이어 이름 정리 요청: 문구가 레이어 이름인 곳, 같은 이름이 겹치는 곳, `Frame 2147…`·`Group 51` 같은 의미 없는 이름. 정리되면 meta 의 `*`/`nth` 우회 규칙을 표준 이름으로 바꾼다
- Figma 오타: countdown `MUNUTES`. 빈 레이어: awards-stats `Group 14`
- compare 2종·pricing plan-comparison 의 TB/MO 배치는 Figma 에 없어서 제안안이다
- 실제 디자이너 조합 프레임으로 `figma-to-page` E2E (인스턴스 덮어쓰기·이미지 교체 반영 확인)
