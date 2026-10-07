# 상품페이지 템플릿 시스템 — Claude 작업 가이드

디자이너가 매번 같은 구성으로 만드는 상품페이지를 **Figma 섹션 템플릿 + HTML 템플릿**으로 통합한다. 한 사이트(라이브러리·조합기·히어로 편집기)에서 Figma로 이동하고 코드를 가져간다. 디자이너가 Figma에서 조합한 페이지는 스킬로 HTML이 되어 프론트에 전달된다. 기획자·마케터는 **히어로 편집기**에서 문구·배경·버튼을 직접 바꿔 시안을 보고 page.json 으로 받는다.

**핵심 원칙: AI는 Figma에서 "내용"만 뽑고(page.json), HTML은 `sections/` 템플릿이 결정적으로 조립한다.** 스킬이 HTML을 즉석에서 쓰지 않는다. 같은 입력이면 항상 같은 HTML이 나온다.

## 저장소
- GitHub **https://github.com/hyjin502/product-page-templates** (공개). 브랜치는 `main` 하나.
- 커밋 작성자는 **hyjin502** (`user.email 270540887+hyjin502@users.noreply.github.com`, 저장소 로컬 설정). 전역 git 설정의 다른 이름으로 커밋하지 않는다. 새 PC 면 README 「GitHub 로 관리하기」대로 먼저 설정한다.
- 공개 저장소다 → 비밀값·개인 정보·비공개 사내 문서를 넣지 않는다. 커밋·푸시는 사용자가 요청할 때만 한다.
- CI: `.github/workflows/ci.yml` 이 푸시·PR 마다 validate · build 를 돌리고 `dist/` 를 site 아티팩트로 남긴다.
- **GitHub Pages**: `.github/workflows/pages.yml` 이 main 푸시마다 build → validate → `scripts/protect.mjs`(비밀번호 잠금) → 배포한다. 주소 https://hyjin502.github.io/product-page-templates/
  - 비밀번호는 저장소 secret `SITE_PASSWORD` 에만 있다. **비밀번호 값을 코드·문서·커밋·메모리에 절대 쓰지 않는다.**
  - 잠금은 사이트 입구만 막는다(저장소는 공개). 비밀번호가 같으면 다시 배포해도 브라우저가 다시 묻지 않는다(고정 salt PBKDF2 → AES-GCM).

## Figma 원본
- `[UI] 커피 정수기` 파일 **Page 19** (fileKey `S3cLqJIqHJbX2eREe4iGXr`, page `6249:34928`) — `sections/sections.json` 에 있다.
  - 사용자는 권한이 없는 원본 페이지를 복사해서 쓴다. **최신화할 때마다 페이지가 새로 복사돼 노드 ID 가 전부 바뀐다**(Page 18 `6187:*` → `6233:*` → Page 19 `6249:*`). 사용자도 알고 있고 어쩔 수 없는 일이다.
  - 바뀌면 `scripts/figma-relink.mjs` 로 다시 맞춘다. 스크립트 머리말의 DUMP 를 use_figma 로 새 페이지에서 실행해 `pages/_verify/figma-page.json` 에 저장 → `--dry` 로 확인 → 적용. 이름으로 맞추고, hero 는 줄(PC 왼쪽 열 위→아래 = meta.order, MO = 같은 줄의 375 폭)로 맞춘다.
  - hero 는 프레임 `6249:35086` 의 7종이다. PC·MO 짝은 이렇다.
    | variant | PC | MO |
    |---|---|---|
    | media-badge | 35187 | 35346 |
    | media-title | 35205 | 35395 |
    | light-badge | 35223 | 35357 |
    | dark-gradient | 35243 | 35260 |
    | gradient-text | 35326 | 35289 |
    | visual-bottom | 35087 | 35368 |
    | product-shot | 35306 | 35379 |
    - 35260·35289 는 이름이 `device=pc` 로 잘못 붙어 있다. 35274 는 작업 중인 MO 초안이라 쓰지 않는다.
    - 같은 프레임의 split 3종은 범위 밖이다. 다른 프레임 `6249:34929`("hero", 예전 3종)는 쓰지 않는다.
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
- **히어로 편집기 규칙** (사용자 결정)
  - 글자 수는 **줄마다, 띄어쓰기 포함**으로 센다 (`maxChars`). 타이틀은 최대 2줄 · 줄마다 17자, 서브타이틀은 1~2줄 · 줄마다 20자.
  - hero 7종의 MO 는 Page 19 MO 시안대로 구현했다.
    - 한 화면 812: media-badge · light-badge · dark-gradient 는 문구 위·버튼 아래, media-title · gradient-text 는 가운데.
    - 위아래로 쌓기: visual-bottom · product-shot.
    - MO 버튼은 패딩 20/32 · 글자 20 · 전체 폭이고 화살표가 없다.
  - **MO 문구는 따로 쓸 수 있다**: 타이틀·서브타이틀은 `{ pc, mo }`. 디자이너가 MO 에서 문구를 줄여 쓴다(예: "비즈니스 성과로 바꾸다" → "비즈니스 성과로"). 편집기는 "MO 문구 따로 쓰기"로 받는다.
  - 글자 수 한도(줄마다):
    - PC 타이틀: 80px 17자 · 100px 14자 · 120px 11자.
    - PC 서브: media-badge 20 · media-title 45 · light-badge·dark-gradient·gradient-text·product-shot 40 · visual-bottom 35.
    - MO 는 슬롯의 `mo` 한도: 타이틀 6~10자, 서브 3줄 20~27자.
  - Figma MO 와 일부러 다르게 둔 것 (디자이너 확인 요청):
    - 버튼 색은 PC·MO 공통으로 편집기에서 고른 색이다. Figma MO 는 media-badge 버튼이 회색, dark-gradient 가 파랑이다.
    - 버튼 문구도 공통이다. Figma visual-bottom MO 는 "지금 무료로 경험하기".
    - product-shot MO: Figma 는 버튼 1개, 서브 문구가 visual-bottom 문구(복사된 듯), 버튼과 제품 화면 사이 812 공백이다. 코드는 버튼을 모두 보여 주고 공백을 48 로 줄였다. 서브 문구는 Figma 원문대로 넣었다.
  - 버튼 배경색·radius 는 HDS 토큰(`tokens/hds.json`)에서만 고른다. 글자색은 색마다 정해 둔 `on` 값이다.
  - 배경은 PC·MO 따로 이미지 또는 mp4. MO 를 비우면 PC 것을 쓴다.
  - 샘플은 Figma 원문 그대로 두되, 규칙을 넘는 원문(29729 서브타이틀 33자)은 같은 문구를 줄로 나눠 맞춘다.
  - 버튼 색은 HDS 에서만 → product-shot 두 번째 버튼의 Figma 색 `#272840`(토큰 아님)은 가장 가까운 `gray/1400` 으로 뒀다.
  - 뱃지 모양(흰 바탕 · 파란 바탕 · 빨간 테두리)과 타이틀 그라디언트는 시안 고정이고, 문구만 바꾼다.
- Figma 파일은 **읽기만** 한다. 수정이 필요하면 디자이너에게 요청 목록으로 전달한다.

## 구조
```
tokens/base.css, tokens/pager.js        공통 토큰·컴포넌트·브레이크포인트, 카드 페이지 넘김 런타임
tokens/hds.json                         HDS 버튼 색·radius (편집기 선택지 + 템플릿 필터 hdsColor·hdsOn·hdsRadius·hdsToken)
sections/sections.json                  섹션 카탈로그(기본 순서·Figma 섹션 노드)
sections/<section>/<layout>/            variant = meta.json · template.njk · style.css · sample.json (+ script.js)
sections/<section>/_shared.css          섹션 공통 CSS
sections/_partials/ui.njk               ctas · media · secHead · pagerDots 매크로
sections/hero/_macros.njk               hero 공통: bgMedia(배경) · visualMedia(섹션 안 비주얼) · lineSpans(줄 단위) · btns(HDS 버튼: 채움/테두리·화살표)
sections/hero/_shared.css               hero 공통 레이아웃 — variant 는 기기마다 변수(--hero-title, --hero-pad-y …)만 정한다
assets/hero/                            hero 배경·비주얼, thumbs/(편집기 스타일 썸네일)
pages/*.page.json                       조립할 페이지 → dist/pages/<name>/
pages/_verify/                          추출 검증 결과(Page 18 기준 scan · verify.final) · figma-page.json(링크 재연결용 페이지 덤프)
site/                                   라이브러리·조합기·히어로 편집기 사이트 셸 (build 가 dist/index.html 로 합침)
site/render-core.cjs                    렌더 공통(richtext·HDS 필터·기본값 채우기) — 빌드와 편집기(브라우저)가 같은 코드를 쓴다
scripts/                                build · validate · preview · shot · serve · pack · protect · figma-extract · figma-relink · lib
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
| `node scripts/figma-relink.mjs pages/_verify/figma-page.json [--dry]` | 페이지가 다시 복사돼 노드 ID 가 바뀌었을 때 meta·sections.json 의 Figma 링크를 다시 맞춤 |

## 히어로 편집기 구조
- 편집기에 나오는 variant 는 `meta.json` 에 `"editor": true`. 입력 폼은 `meta.slots` 로 자동으로 만든다 → 새 hero 는 meta·template·style·sample 만 더하면 된다.
- 슬롯 제약·타입 (검증은 `scripts/lib.mjs`, 폼은 `site/app.js`)
  - `text`/`richtext`: `maxLines` · `minLines` · `maxChars`(줄마다, 띄어쓰기 포함). richtext + maxLines 는 줄마다 입력칸.
  - richtext 의 `mo: { maxLines, maxChars }` = MO 문구를 따로 받는다(값 `{ pc, mo }`, MO 는 이 한도로 검사). 템플릿 `lineSpans` 는 PC·MO 줄이 다르면 `.hero__lines.only-pc` / `.only-mo` 두 묶음을 낸다.
  - `color`: `tokens/hds.json` 색 키(`"blue/700"`), `radius`: `xs|sm|md|lg|xl|full`, 둘 다 `default` 로 기본값.
  - `media`: `{ pc: { kind: "image"|"video", src, alt?, poster? }, mo? }`. `hint` 는 편집기 안내 문구.
  - `enum` 은 칩으로 고른다(`labels` 로 표시 이름), `toggle` 은 체크박스(true/false). 항목 필드의 `hideWhen: { style: "outline" }` 은 그 조건일 때 입력칸을 숨긴다.
  - meta `thumb` = 편집기 스타일 썸네일(`assets/hero/thumbs/<layout>.jpg`, Figma 렌더를 가로 480 으로).
- 렌더: build 가 편집기 섹션의 `.njk` 를 `nunjucks.precompile` 해서 `nunjucks-slim` 과 함께 `dist/index.html` 에 넣는다. 편집기 미리보기 = `npm run build` 결과 (동일성 확인함).
- 저장: 문구·선택값은 localStorage(`tpl-site` 의 `hero`), 올린 파일은 IndexedDB(`tpl-hero-editor`). 내보내기는 page.json + 올린 파일(`hero-bg-pc.<확장자>` 이름으로)을 함께 내려받는다.
- 바로가기: `index.html#hero-editor`. 줄 넘김 경고는 지금 기기 폭의 iframe 에서 `.hero__badge` · `.hero__title` · `.hero__desc` 의 줄 수를 잰다 (hero variant 는 이 클래스를 함께 쓴다).

## 작업 흐름
- **새 섹션/variant** → `add-section-variant` 스킬 (슬롯 매핑 문법·pager 판단 규칙 포함)
- **디자이너가 조합한 Figma 페이지 → HTML** → `figma-to-page` 스킬
- **매핑이 Page 18 원문을 그대로 뽑는지 확인** → `figma-extract.mjs scan-components … --verify` → use_figma 실행 → `report` (현재 98건 중 92건 일치)
- **UI·섹션을 바꾼 뒤에는 반드시 `npm run shot` 으로 결과를 보고** Figma `get_screenshot` 과 비교한다. 사용자는 결과물 확인을 가장 중요하게 여긴다.
- 라이브러리 사이트는 결과물(미리보기)이 먼저 보이도록 컴팩트하게 유지한다. 설명 문구를 늘리지 않는다.

## 알려진 과제 (다음에 할 일 후보)
- 새 hero 7종은 아직 추출 검증 전이다 (`pages/_verify/` 의 hero 결과는 예전 3종·예전 노드 기록). gradient-text 타이틀은 Figma 에서 줄마다 `title` 레이어가 따로 있어(2개) 추출 매핑을 따로 맞춰야 한다. 버튼 화살표는 Figma `right-icon` 속성으로 읽을 수 있다.
- 추출 검증에서 차이가 난 6건(설명 가능한 차이): feature compact 옵션 문구, detail-slide 슬라이드 수, faq·notice 유의사항 줄바꿈(Figma 원문 수정 필요)
- 추출하지 않는 슬롯(sample 유지): compare-vs-spec 행(Figma 가 열 단위 구조), inquiry 폼 그룹, plan-comparison 셀 태그. pricing-receipt·sticky-cta·inquiry 는 MO 를 추출하지 않음(`extractFrom: "pc"`)
- 디자이너 레이어 이름 정리 요청: 문구가 레이어 이름인 곳, 같은 이름이 겹치는 곳, `Frame 2147…`·`Group 51` 같은 의미 없는 이름. 정리되면 meta 의 `*`/`nth` 우회 규칙을 표준 이름으로 바꾼다
- Figma 오타: countdown `MUNUTES`. 빈 레이어: awards-stats `Group 14`
- compare 2종·pricing plan-comparison 의 TB/MO 배치는 Figma 에 없어서 제안안이다
- 실제 디자이너 조합 프레임으로 `figma-to-page` E2E (인스턴스 덮어쓰기·이미지 교체 반영 확인)
