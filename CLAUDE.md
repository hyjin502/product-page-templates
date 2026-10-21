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
- **`상품페이지 템플릿 시스템` 파일 · Section Design System 페이지** (fileKey `dxhWkGXnev5U2Q1nLISR3h`, page `0:1`) — `sections/sections.json` 에 있다. 2026-10-13 사용자가 이 파일을 공식 원본으로 정했다(이 계정으로 읽기 가능).
  - 예전 원본 `[UI] 커피 정수기`(S3cLq…, Page 18 → Page 19 `6249:*`)는 더 쓰지 않는다. 이 계정은 그 파일 권한이 없다.
  - 섹션 프레임·심볼 구성이 바뀌면 `scripts/figma-relink.mjs` 로 다시 맞춘다. 스크립트 머리말의 DUMP 를 use_figma 로 `0:1` 에서 실행해 `pages/_verify/figma-page.json` 에 저장 → `--dry` 로 확인 → 적용. 이름으로 맞추고, hero 는 줄(PC 왼쪽 열 위→아래 = meta.order, MO = 같은 줄의 375 폭)로 맞춘다.
  - hero 는 세트 `469:32313` 의 11종이다(예전 세트 `1:1710` 은 2026-10-15 `_hero-old (사용 안 함)` 으로 이름을 바꿔 게시에서 뺐다). PC·MO 짝은 이렇다.
    | variant | PC | MO |
    |---|---|---|
    | media-badge | 469:32452 | 476:32991 |
    | media-title | 471:32967 | 476:33045 |
    | light-badge | 469:32558 | 476:33069 |
    | dark-gradient | 469:32681 | 479:33142 |
    | gradient-text | 469:32833 | 479:33359 |
    | visual-bottom | 469:32373 | 479:33278 |
    | product-shot | 471:32914 | 479:33325 |
    | split-stats | 469:32635 | (없음) |
    | split-photo | 469:32762 | (없음) |
    | media-left | 469:32412 | (없음) |
    | media-left-bottom | 517:33408 | 550:41490 |
    | monthly-x (월간X) | 580:6029 | 580:6030 |
    - **variant 이름 = 저장소 layout** (2026-10-15 사용자 요청으로 Claude 가 Figma 이름만 고침): `device=pc|mo, layout=<meta.layout>` (예 `device=pc, layout=media-badge`). 예전엔 대부분 `layout=center-inline` 으로 겹쳐 세트 오류 → 라이브러리 게시에서 빠졌었다(Invalid assets). 479:33142·479:33359 의 잘못된 `device=pc` 도 `mo` 로 고쳤다. 노드 ID·key 는 그대로.
    - 아래쪽 4종 중 split-stats · split-photo · media-left 는 **MO 시안이 없다**(media-left-bottom 은 2026-10-14 MO 550:41490 추가 — 검정+큐브 20% 배경 `media-left-bottom-bg-mo.jpg`, 문구 묶음 아래쪽 · 버튼은 글자 폭) → MO·TB 는 코드 기본값(`_shared.css` 의 `.hero--left` 규칙: 문구 → 비주얼 순서로 쌓기, 왼쪽 정렬). 517:33408 은 x 가 108 로 8px 어긋나 있다(relink 는 40px 까지 같은 열로 본다).
    - 4종은 `.hero--left` + `.hero__split`(왼쪽 `.hero__content` · 오른쪽 `.hero__visual`) 공통 틀을 쓰고 variant 는 변수만 정한다. split-stats 의 수치는 `stats` 목록(value · unit · label, 추출 안 함 — Figma 레이어 이름이 숫자·문구라서). split-photo·media-left-bottom 은 Figma 문구 묶음이 768 프레임을 넘쳐서(846 · 829) 위아래 여백을 줄여 768 에 맞췄다(타이틀·버튼 위치는 Figma 그대로).
    - media-left-bottom 배경은 Figma 의 검정 + 큐브 이미지 20% 를 한 장(`media-left-bottom-bg.jpg`)으로 구웠다.
    - **monthly-live(월간휴넷 LIVE)** 는 2026-10-19 사용자 요청으로 hero·히어로 편집기에서 빼서 **월간휴넷 페이지 템플릿**(`templates/monthly-hunet/hero`, 아래 「페이지 템플릿」)으로 옮겼다. 아래 설명(띠·그리드·PC/MO 차이)은 그 hero 에 그대로 해당한다. hero 세트의 580:6017/6028 은 이제 코드와 연결되지 않는다.
    - **monthly-live(월간휴넷 LIVE)** · **monthly-x(월간X)** 는 2026-10-15 디자이너가 **컴포넌트**로 바꿔 hero 세트(469:32313, 이제 23개)에 넣었다(이름 `device=pc|mo, layout=monthly-live|monthly-x`). 예전 프레임 노드(537:36633 등)는 없어졌다. relink 는 이름(layout)으로 맞춘다. (meta `figmaFrame` · `figmaStandalone` 은 세트 밖 시안용으로 남겨 둔 기능) 위쪽 어두운 띠만 배경이고 아래는 흰 바탕. 띠는 고정 높이가 아니라 그리드 줄로 비주얼에 묶여 비주얼 아래 `--overlap`(PC 206 · TB 160 · MO 32) 위에서 끝난다(= Figma 628 · 437). `.hero__body` 는 `display: contents`, MO 는 `.hero__stage` 도 contents. 배경 띠 기본값은 CSS 프리셋 `live-glow`(사용자 요청, Figma 배경 이미지 색을 참고 — 이미지 `monthly-hunet-bg*.jpg` 는 남겨 둠). 메인 비주얼·연사 사진은 Figma 렌더를 구웠다(`assets/hero/monthly-hunet-*`). 로고(`monthly-hunet-logo.svg`, 두 SVG 합침)·공유 아이콘(`assets/icons/share.svg`)·YouTube 로고는 Figma 에셋.
      - PC·MO 가 다르다: 상단 문구·버튼은 MO 에만(PC 에선 숨김), 연사 사진·YouTube 로고는 PC 에만. 일정은 PC 비주얼 위 왼쪽 아래(흰 글자), MO 는 비주얼 아래(검정 글자, 채널은 괄호). 상단 문구 PC 비움 = `{ pc: "", mo }` (편집기도 PC 를 비우고 MO 만 쓰면 이렇게 낸다). 연사 사진은 `speaker1~3`(`pcOnly`, 최대 3장 · 오른쪽 정렬 · 미리보기 클릭 교체 `[data-pick]`). 메인 비주얼 샘플은 사용자 요청으로 PC·MO 모두 Figma PC 비주얼(`monthly-hunet-visual.jpg`, 렌더 1배 980 — 2배 원본이 오면 바꾼다). Figma MO 의 노트북 크롭 사진은 쓰지 않는다. 프레임 채우기가 꺼져 있어(Figma 화면의 회색은 캔버스색) 아래 바탕은 흰색으로 뒀다.
    - **monthly-x(월간X)**: 2026-10-19 사용자 요청으로 히어로 편집기에서 빼서 **월간X 페이지 템플릿**(`templates/monthly-x/hero`, 사이트 「월간X」 탭 `#tpl-monthly-x`)으로 옮겼다 — 월간휴넷처럼 히어로부터 시작해 섹션을 늘린다. 아래 설명은 그 hero 에 그대로 해당. Figma 원본은 「월간X」 세트 643:3323(hero = layout=monthly-x 643:3360/643:3324 · summary 643:5115/643:5122). summary(2026-10-19, 2026-10-20 Figma 수정 반영): 가운데 제목(MO 는 줄을 따로 — `{ pc, mo }`) · 문단(본문 780 · 18/MO 16 black-80, `**굵게**`, 문단마다 `mo` 문구 선택 — Figma MO 첫 문단이 짧음) · 실습 미션 카드 2개(`showMissions` 켜고 끄기 · blue/100 #f5f9ff · 제목 blue/700 · PC 2열 · MO 세로 · PC 글자는 Figma 643:5108 을 use_figma 로 실측 — 설명 16/1.6 · 안내 12/1.4(get_design_context 는 14 로 잘못 줌)) · 신청 버튼(`showCta` 켜고 끄기, 2026-10-20 사용자 요청). check(「고민 추천」 643:5188/648:5207, 2026-10-20): bg-page 배경(`bgColor` free) · 제목(MO 줄 따로) · 버튼(`showCta` 켜고 끄기) · 카드 목록(아바타 64 원형 — Figma 크롭대로 128 jpg `assets/monthly-x/monthly-x-check-1~4.jpg`, 4번은 좌우 반전 · 프로필 고르기 가능 / 고민 문구 bold / 대상) · 신청 버튼. program(「Program」 648:5369/648:5483, 2026-10-20): 작은 제목 · 제목(MO 줄 따로) · 일시·장소 칸(`info` 목록 icon clock|pin|none · text · sub — 🖤 HDS time/clock · marker-pin-02 line → `assets/icons/hds-clock.svg` · `hds-marker-pin-02.svg`, 선 1px non-scaling) · 시간표 `items`(time · duration · active(진한 점 + bg-faint 카드, Figma 「오프닝」) · label(세션 이름 blue) · title · points(줄마다 점 목록)) — PC 카드 = 시간 76 | 가운데 | 소요 76 그리드, 세션 카드는 가운데 묶음 431 왼쪽 정렬 · MO 카드 = 세로 가운데(시간+소요 한 줄) · 세로 줄은 `::before`. 안내 `notes`(줄마다). MO 는 Figma 대로(2026-10-20 사용자 요청): 목록은 보통 굵기(레이어 속성은 Bold 지만 Figma 렌더는 Regular — 렌더 기준) · 세션 제목은 항목 `titleMo`(비우면 PC 제목 — 샘플은 Figma MO 「미래:」「Hands-on:」). Figma 확인 요청: PC 첫 줄 「~14:00」만 오른쪽 정렬 · Session 1 줄 높이 207 고정(카드 180) · 「휴식」 첫 카드만 둥근 12. program 「순서대로 강조」 `cycle`(기본 켬, 2026-10-20 사용자 요청 — hrd.hunet.co.kr 월간휴넷 세미나 페이지의 순차 포커스와 같은 효과, 간격 1.5초 사용자 결정): `program/script.js` 가 `.mx-program[data-cycle]` 의 줄에 `.is-on` 을 한 줄씩 옮김(동작 줄이기면 멈춤). 시간표 항목 필드 이름은 `session`(list 항목에 `label` 필드가 있으면 contentFrom 이 label 빈 항목을 버튼처럼 빼서). 나머지 섹션(2026-10-20 사용자 요청 「지금 템플릿에 들어간 내용 다 넣어줘」): Figma 「월간X 템플릿」 페이지(637:4669)의 전체 PC 시안 프레임 「월간X_PC」(643:4283)에서 — (러닝메이커 643:4447 은 2026-10-20 사용자 요청으로 뺐다) register(643:4647 검정 신청서 · 입력칸 2열 · 동의 · 알약 버튼 — 미리보기용 정적 폼) · faq(643:4691 `<details>` · 항목 q/a/open) · about(643:4741 · 로고는 hero 로고 svg 재사용) · history(07_Replay 643:4750 · 썸네일 5장 Figma 렌더 410x218 `monthly-x-history-1~5.png`) · sticky-cta(수강신청플로팅 643:4893 신청 중 / 643:4894 마감 → `state` open|closed, meta stage sticky). 이 섹션들은 세트 컴포넌트가 아니라 프레임이라 Figma 플러그인 key 가 없고(빌드 경고), MO 시안이 없어 MO·TB 는 제안값. FAQ 답변 줄 앞 공백은 richtext 가 지워 들여쓰기가 빠진다. 디자이너 요청: 이 섹션들을 「월간X」 세트(643:3323)에 device=pc|mo 컴포넌트로 · MO 시안. 신청 버튼은 공통 `templates/monthly-x/_shared.css` 의 `.mx-btn`(Figma action button PC 80 · 좌우 64 · 24 bold / MO lg 56 전체 폭 16 bold). Figma 확인 요청: MO 미션 제목에 이모지 없음 · MO 두 번째 미션 안내가 첫 번째 것 복사 · check MO 3·4번 아바타가 같은 이미지(코드는 PC 사진). 검정 바탕 + Figma X 패턴(`Asset 2` 를 -90° 돌려 12% — PC 가운데 980 폭 창, MO 전체 · `monthly-x-bg(-mo).jpg` 로 구움)은 남겨 두고, 기본 배경은 CSS 프리셋 `x-pattern`(같은 패턴이 위로 흐름 — 2026-10-15 사용자 결정) · 타이틀 · 티켓 카드(사진 + 파란 #1927ec 정보 칸, 토큰 아님 — `cardColor`(버튼 색 팔레트, 비우면 시안 색)로 정보 칸·사진 위아래 그라디언트를 함께 바꾸고 글자는 그 색의 `on`). 사진 위 파란 빛(hard-light 50%)·아래 그라디언트·이음선 점선은 CSS 라 사진을 바꿔도 그대로, 이음선 양 끝 반원 홈은 mask 로 뚫어 배경이 비쳐요(PC 18 · MO 10.7). X 장식 `monthly-x-mark.svg`, 로고 `monthly-x-logo.svg`, 아이콘 `clock-16`·`map-pin-16`. 티켓 정보는 `details` 목록(icon clock|pin|none · label · value · sub).
      - Figma 확인 요청: 일정 요일이 PC (화) · MO (목)으로 다르다(2026-12-31 은 목요일). 레이어 이름이 문구라 바뀐다(상단 문구 레이어가 「AI X HRD = AI칼리지」→ 문구로 바뀜) → `eyebrow`·`title`·`date`·`live`·`channel`·`speaker` 표준 이름 요청. MO 버튼 아래 여백은 Figma 0 → 코드 40(제안값).
- 원본 파일을 옮기면 `sections/sections.json` 의 `figma.fileKey`·`fileName`·`page` 와 각 `meta.json` 의 노드 ID 를 새 파일 기준으로 바꾼다(노드는 relink, 파일 정보는 손으로).
- Figma MCP(claude.ai Figma 커넥터 또는 figma MCP)가 연결돼 있어야 한다. `use_figma` 전에는 `figma:figma-use` 스킬, `get_design_context` 전에는 `figma:figma-design-to-code` 스킬을 로드한다.
- **원격 Figma 플러그인 환경에는 Pretendard 폰트가 없다.** 그래서 인스턴스를 만들거나 텍스트를 쓰는 작업은 실패한다(읽기는 가능). 실제 조합 프레임 테스트는 디자이너가 프레임을 만들어 URL 을 준다.

## 반드시 지킬 규칙
- **샘플 문구·이미지는 Figma 원문 그대로** (지금 샘플은 예전 원본 Page 18·19 에서 뽑았다 — 새 원본과 다를 수 있어 추출 검증으로 확인할 것). 지어낸 문구(예: 제품 카피)를 넣지 않는다. 사용자가 명시적으로 지적한 사항이다.
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
    - MO 버튼은 패딩 20/32 · 글자 20 · 전체 폭. 오른쪽 아이콘은 PC 와 같이 고른 대로 보인다(사용자 결정 — Figma MO 시안은 아이콘 없음).
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
  - 버튼 색은 HDS 에서만 → product-shot 두 번째 버튼의 Figma 색 `#272840`(토큰 아님)은 가장 가까운 `interaction/button-neutral`(#292a2d) 로 뒀다.
  - 뱃지 모양(흰 바탕 · 파란 바탕 · 빨간 테두리)과 타이틀 그라디언트는 시안 고정이고, 문구만 바꾼다.
- Figma 파일은 **읽기만** 한다. 수정이 필요하면 디자이너에게 요청 목록으로 전달한다. (예외: 사용자가 직접 요청한 경우만 — 2026-10-15 컴포넌트 이름 정리)

## 구조
```
tokens/base.css, tokens/pager.js        공통 토큰·컴포넌트·브레이크포인트, 카드 페이지 넘김 런타임
tokens/hds.json                         HDS 버튼 색·radius (편집기 선택지 + 템플릿 필터 hdsColor·hdsOn·hdsRadius·hdsToken)
sections/sections.json                  섹션 카탈로그(기본 순서·Figma 섹션 노드)
sections/<section>/<layout>/            variant = meta.json · template.njk · style.css · sample.json (+ script.js)
sections/<section>/_shared.css          섹션 공통 CSS
sections/_partials/ui.njk               ctas · media · secHead · pagerDots 매크로
sections/hero/_macros.njk               hero 공통: bgMedia(배경) · visualMedia(섹션 안 비주얼) · lineSpans(줄 단위) · btns(HDS 버튼: 채움/테두리·오른쪽 아이콘 btnIcon)
sections/hero/_shared.css               hero 공통 레이아웃 — variant 는 기기마다 변수(--hero-title, --hero-pad-y …)만 정한다
assets/hero/                            hero 배경·비주얼, thumbs/(편집기 스타일 썸네일)
pages/*.page.json                       조립할 페이지 → dist/pages/<name>/
pages/_verify/                          추출 검증 결과(Page 18 기준 scan · verify.final) · figma-page.json(링크 재연결용 페이지 덤프)
site/                                   라이브러리·조합기·히어로 편집기 사이트 셸 (build 가 dist/index.html 로 합침)
site/render-core.cjs                    렌더 공통(richtext·HDS 필터·기본값 채우기) — 빌드와 편집기(브라우저)가 같은 코드를 쓴다
templates/<key>/                        페이지 템플릿(월간휴넷 monthly-hunet · 월간X monthly-x) — template.json(제목·Figma 세트·섹션 순서) + 섹션 폴더(variant 와 같은 4개 파일) → dist/templates/<key>/
figma-plugin/                           조합기 결과 → Figma 인스턴스 조립 플러그인 (src/main.js · ui.html · manifest · components.json, code.js 는 빌드가 만듦)
scripts/                                build · validate · preview · shot · serve · pack · protect · figma-extract · figma-relink · figma-plugin · bgfx-stills · lib
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
| `node scripts/bgfx-stills.mjs` | hero CSS 배경 프리셋 정지 화면 → `assets/hero/bgfx/<key>.jpg` (프리셋을 바꾸면 다시 실행·커밋. Chrome 이 없으면 macOS `scripts/webshot.swift`) |
| `node scripts/figma-relink.mjs pages/_verify/figma-page.json [--dry]` | 페이지가 다시 복사돼 노드 ID 가 바뀌었을 때 meta·sections.json 의 Figma 링크를 다시 맞춤 |

## 히어로 편집기 구조
- 편집기에 나오는 variant 는 `meta.json` 에 `"editor": true`. 입력 폼은 `meta.slots` 로 자동으로 만든다 → 새 hero 는 meta·template·style·sample 만 더하면 된다.
- 슬롯 제약·타입 (검증은 `scripts/lib.mjs`, 폼은 `site/app.js`)
  - `text`/`richtext`: `maxLines` · `minLines` · `maxChars`(줄마다, 띄어쓰기 포함). 문구 안의 `**굵게**` 는 `<b>` 로 나간다(render-core `richtext`, 2026-10-19 — 월간X 서머리처럼 문단 중간 굵은 글씨). richtext + maxLines 는 줄마다 입력칸.
  - richtext 의 `mo: { maxLines, maxChars }` = MO 문구를 따로 받는다(값 `{ pc, mo }`, MO 는 이 한도로 검사). 템플릿 `lineSpans` 는 PC·MO 줄이 다르면 `.hero__lines.only-pc` / `.only-mo` 두 묶음을 낸다.
  - `color`: `tokens/hds.json` 색 키(`"blue/700"`), `radius`: HDS Semantic radius 9개 `none(0)|xs(4)|sm(8)|md(12)|lg(16)|xl(20)|2xl(32)|3xl(40)|full(900)`, 둘 다 `default` 로 기본값.
    - `color`(palette 없음) = 버튼 배경 20색: HDS Theme `static/white`·`static/black`, `interaction/button-neutral`·`button-subtle`·`selected_fill`·`overlay-bg`·`overlay-outline`, Atomic 각 색 `/700`(gray·red·red-orange·orange·yellow·lime·green·cyan·sky·blue·violet·purple·pink). 그리고 HDS 토큰이 아닌 `transparent`(투명 바탕, 글자는 hero 글자색 · `.hero-btn--clear` · 라인과 함께 쓴다). `on` = 그 위 글자색(밝기 0.4 미만이면 흰색). 예전 키 `white`·`gray/1000`·`gray/1400` 은 `aliases` 로 같은 값의 새 키를 가리킨다.
    - `color` + `"palette": "line"` = HDS Theme line 4색(`line-layout`·`line-outline`·`line-strong`·`line-heavy`, 라이트 값) + `static/white`(#ffffff, 어두운 배경 위 흰 라인). hero 버튼 항목의 `line`(선택, 비우면 라인 없음) — 채움형은 1px outline, 테두리형은 그 테두리 색(`--outline-line`).
    - `color` + `"palette": "700"` = 원색 700번 13색(버튼 팔레트에서 `/700` 만 — gray·red·red-orange·orange·yellow·lime·green·cyan·sky·blue·violet·purple·pink). 월간휴넷 아젠다 `labelColor`(세션 이름 색, 기본 blue/700 = 시안 #0066ff), 템플릿은 `hdsColor`.
    - `color` + `"palette": "cta"` = `static/white`·`static/black` + 700번 13색(2026-10-20 사용자 요청). 월간X 소개 글·고민 추천 버튼 `ctaColor`(기본 blue/700) — `.mx-btn` 의 `--btn-bg`·`--btn-fg`(hdsOn), 흰색이면 `.mx-btn--light`(line-outline 1px, 제안값).
    - `color` + `"palette": "bg"` = 섹션 배경색 8개(HDS Theme background `bg-surface`·`bg-page`·`bg-ghost`·`bg-faint` 라이트 값 + 원색 `red`·`green`·`blue`·`violet/200`, `tokens/hds.json` 의 `bg`, 템플릿 필터 `hdsBg`). `free: true` 를 더하면 칩 대신 **자유 색 고르기**(Figma 색 패널처럼 채도·밝기 사각형 · 색상 · 불투명도 · 스포이드(EyeDropper 되는 브라우저) · HEX·%) — 값 `#rrggbb` 또는 `#rrggbbaa`, `hdsBg` 는 #hex 를 그대로 낸다. 월간휴넷 추천 대상(check · persona)은 제목 색 `titleColor`(enum black|white, `.mh-h--white`)과 `bgColor` 가 있고, `bgColor` 가 free — 기본값 #F7F7F8(HDS bg-page, 사용자 결정 · Figma 는 흰 바탕 · 「기본」 칩 = 이 색), 흰색이 아닌 색이면 항목·카드를 흰 바탕으로(제안값).
    - `color` + `"palette": "text"` = HDS Theme 의 typography 글자색 10개(`black-100`~`black-disabled`, `white-100`~`white-disabled`, 라이트 값 · `tokens/hds.json` 의 `text`). hero 의 `titleColor`·`descColor` 슬롯이 쓰고, 기본값은 variant 의 원래 글자색이다(그래서 샘플 화면은 그대로). 템플릿은 `hdsText` 필터 → 타이틀은 `color`, 서브는 `--hero-desc-color`. gradient-text 는 타이틀이 그라디언트 고정이라 `descColor` 만 있다.
  - **뱃지 꾸미기** `badgeColor`(color, 버튼 팔레트) · `badgeLine`(color palette line, `noneValue: "none"` = 테두리 빼기) · `badgeRadius`(radius): 모두 optional·기본값 없음 → 비우면 variant 시안 그대로(편집기 「기본」 칩). 템플릿은 `badge()` 매크로가 고른 값만 인라인으로 덮어쓴다. 글자형 뱃지(split-stats·media-left-bottom)는 색·테두리가 있으면 `.hero__badge--custom` 으로 여백 8/20.
  - `media`: `{ pc: { kind: "image"|"video", src, alt?, poster? } | { kind: "css", preset }, mo? }`. `hint` 는 편집기 안내 문구.
    - **CSS 배경 프리셋**(`kind: "css"`): 슬롯에 `"cssPresets": true` 가 있어야 쓸 수 있다(hero 배경 6종). 목록은 `sections/hero/backgrounds.json`(key · label · motion · swatch), 모양은 `sections/hero/_backgrounds.css` 의 `.hero-bgfx--<key>`(span 4개를 프리셋마다 따로 꾸미고 `@keyframes` 로 움직임 — 11종 모두 움직이고 동작 줄이기면 멈춤 — `live-glow` 는 월간휴넷 배경 색을, `x-pattern`(「X 패턴 흐름」)은 Figma X 패턴 이미지(`assets/hero/bgfx/x-pattern-strip.png`)를 두 장 이어 위로 흘린다 — 이미지가 있는 유일한 프리셋이라 `_macros.njk` 의 `mediaEl` 이 `<img>` 마크업을 따로 내고(조립 페이지 복사 때문), backgrounds.json 에 `image` 가 있다. 정지 배경은 이미지로 넣는다). 새 프리셋 = 두 파일에 한 항목씩. hero 의 `_backgrounds.css` 는 `_shared.css` 와 함께 섹션 공통 CSS 로 들어간다.
  - hero 버튼 항목의 `icon`(enum, 기본 none) = 글자 오른쪽 HDS 아이콘 `arrows/chevron-right` · `arrows/arrow-right` · `general/plus`(🖤 HDS 라이브러리 line 24 → `assets/icons/hds-*.svg`). 예전 `arrow: true` 는 chevron-right 로 읽고(검증도 통과), 편집기 저장값은 icon 으로 옮긴다. MO 도 고른 아이콘이 보인다(20px, monthly-live 는 16px). 편집기 칩은 글자 대신 아이콘 그림으로 보여요(`iconPrefix: "hds-"`, 2026-10-21 사용자 요청 — 「없음」만 글자).
  - enum 에 `iconPrefix`(+ `iconDefault` = 값 "default" 의 아이콘)가 있으면 아이콘 고르기 — 칩에 아이콘을 보여 주고, build 가 값마다 `assets/icons/<prefix><값>.svg` 를 편집기에 넣는다(템플릿의 동적 아이콘 이름은 정규식으로 못 찾아서). 월간휴넷 check 의 `icon`(🖤 HDS general/check · check-circle · check-square · check-done-02 · check-verified-02 의 line·solid → `assets/icons/hds-check*.svg`, 기본 check-circle (solid) — HDS 가 아닌 「시안」(problem-check-circle)은 2026-10-21 사용자 요청으로 뺐고, 예전 값 default 도 check-circle (solid) 로 그려요) + `iconColor`(palette 700, 기본 red/700).
  - `enum` 은 칩으로 고른다(`labels` 로 표시 이름), `toggle` 은 체크박스(true/false). 항목 필드의 `hideWhen: { style: "outline" }` 은 그 조건일 때 입력칸을 숨긴다.
  - meta `thumb` = 편집기 스타일 썸네일(`assets/hero/thumbs/<layout>.jpg`, Figma 렌더를 가로 480 으로).
- 렌더: build 가 편집기 섹션의 `.njk` 를 `nunjucks.precompile` 해서 `nunjucks-slim` 과 함께 `dist/index.html` 에 넣는다. 편집기 미리보기 = `npm run build` 결과 (동일성 확인함).
- 저장: 문구·선택값은 localStorage(`tpl-site` 의 `hero`), 올린 파일은 IndexedDB(`tpl-hero-editor`). 내보내기는 page.json + 올린 파일(`hero-bg-pc.<확장자>` 이름으로)을 함께 내려받는다.
- **하단 이미지 크기 `visualFit`**(enum, 기본은 시안 그대로): visual-bottom `crop`(높이 고정·아래 기준 잘림) | `auto`(`.hero--visual-auto`, 세로 = 이미지 비율), product-shot `fit`(가로 1280) | `natural`(`.hero--visual-natural`, 원본 크기·최대 1280). 둘 다 세로는 이미지에 따라 정해진다(crop 만 고정).
- **자주 쓰는 프로필 사진**: `assets/profiles/profiles.json`(12명 — 2026-10-21 Figma 에서 지워진 손송민 637:4315 를 뺌 · 300×300 jpg · Figma 원본 dxhWk Profile 633:3341 의 「비율=정사각」 — 처음 받은 마케팅 템플릿 파일은 잘못된 링크였음). 사진 칸 spec 에 `profiles: true`(media 슬롯 · 목록 항목 image 모두)면 편집기에 「프로필 사진에서 고르기」가 나온다 — 지금은 월간휴넷 히어로 연사 1~3 · 아젠다 세션 사진. 아젠다는 이름 칸이 비었거나 「이름 직급」이면 이름도 채운다. 「비율=상반신」 6장은 아직 안 넣었다. 실존 인물 사진·이름 — 2026-10-19 사용자가 공개 저장소에 올리기로 확인함.
- **이미지 위치·크기 (`focus: true` media 슬롯)**: 편집기 미리보기에서 이미지를 3px 넘게 끌면 이미지가 마우스를 1:1 로 따라 움직이고(그냥 클릭은 파일 선택), 패널의 확대 막대(100~300%)·「가운데로」로 크기를 맞춘다. 기본은 PC 에서 맞춘 값을 MO 도 그대로 쓰고(MO 화면에서 끌어도 PC 값이 바뀜), 「MO 위치 따로 맞추기」를 켜면(편집 값 `pos.moOwn`) 그때부터 MO 값을 따로 둔다(켤 때 PC 값을 복사). 값은 content `visual.pos = { pc: { dx, dy, z }, mo? }`(mo 는 따로 맞출 때만)(dx·dy = 칸 크기 대비 이동 % -100~100, z 1~3, 제자리면 안 냄) — 템플릿은 `focusVars(slot)` 로 감싼 요소에 `--px/--py/--pz(-mo)` 와 `data-focus="슬롯"`, 모양은 `sections/hero/_shared.css` 의 `[data-focus]`(translate + scale). 처음엔 object-position 방식이었는데, 칸과 비율이 같은 이미지는 움직이지 않고 브라우저 기본 이미지 끌기가 끌기를 끊어서 2026-10-19 바꿨다(dragstart 막음 · pointer capture · 한 프레임에 한 번 그리기). 새 파일을 고르면 그 기기 위치는 제자리로. 지금은 월간휴넷 히어로 메인 비주얼만.
- **미리보기에서 이미지 바꾸기 (목록 항목)**: 템플릿이 사진을 감싼 요소에 `data-pick-item="목록:번호:필드"`(예 `cards:{{ loop.index0 }}:image`)를 붙이면 미리보기에서 마우스를 올려 클릭해 그 항목 이미지를 바꾼다(월간휴넷 persona · agenda · benefits · replay). `<img>` 에는 ::before 가 안 붙어서 span 으로 감싼다. 안내 말풍선은 `::before`(`::after` 는 그라데이션 등이 씀).
- **미리보기에서 이미지 바꾸기**: `PICK_AREAS`(`visual` → `.hero__visual`)를 편집기 iframe 에서 클릭하면 그 슬롯의 파일 선택이 열린다(MO 보기 + MO 따로면 mo). 새 hero 의 섹션 안 비주얼도 `.hero__visual` 을 쓰면 그대로 된다.
- **테마**: 조합기 페이지 테마(`state.compose.theme` → page.json `theme`)와 행 테마(`row.theme` → 섹션 `theme: light|dark`, hero 제외). 빌드는 섹션 루트에 `data-theme` 을 붙이고, `tokens/base.css` 의 `[data-theme="light"]` 블록이 다크 페이지 안 라이트 섹션을 되돌린다. 바탕이 없는 섹션은 `:where(section[data-theme])` 가 `--bg-surface`·`--t-100` 을 준다.
- **조합기 연결**: 조합기 행 `src`(`sample`|`editor`, 없으면 편집 값이 있을 때 editor). editor 행은 `state.hero.edits[variant]` 를 편집기와 같은 렌더러(`heroHtmlOrError`)로 그리고, page.json 은 `contentFrom(…, true)` + 올린 파일(`downloadMedia`)을 함께 낸다. 편집기 「조합기에서 보기」(`to-compose`) = 같은 섹션 행을 지금 variant + `src: editor` 로(없으면 맨 위에 추가).
- 바로가기: `index.html#hero-editor`. 줄 넘김 경고는 지금 기기 폭의 iframe 에서 `.hero__badge` · `.hero__title` · `.hero__desc` 의 줄 수를 잰다 (hero variant 는 이 클래스를 함께 쓴다).

## 페이지 템플릿 (templates/ — 월간휴넷)
- 2026-10-19 사용자 결정: 월간휴넷은 섹션 라이브러리와 따로 **전용 폴더** `templates/monthly-hunet/` 에 두고, 사이트 「월간휴넷」 탭(`#tpl-monthly-hunet`)에서 **모든 섹션의 모든 문구를 편집**한다. PC 먼저 만들고 MO 는 나중에.
- Figma 원본: 「월간휴넷 템플릿」 페이지(637:3389)의 세트 `637:3394`(「월간휴넷」) · 프로필 637:4284 — 2026-10-19 디자이너가 이 페이지로 옮김(예전 세트 599:7138 은 더 쓰지 않음, 노드는 모두 새 ID 로 바꿈). variant 이름 `device=pc|mo, layout=<폴더 이름>`(2026-10-19 사용자 요청으로 Claude 가 정리 — 쓰이지 않는 `D-day` boolean 속성은 두 번 지웠다(sticky 를 복사하면 다시 생김): hero · summary · check · persona · persona-2col(629:2900, 이름이 persona 와 겹쳐 2026-10-19 Claude 가 고침) · agenda · register · benefits · replay · sticky-cta. MO 시안은 hero · summary · check · persona · agenda 만). 정리하면서 세트의 `D-day#624:0` boolean 속성을 지웠다(원본 sticky-cta 는 MO 만 그 속성을 쓴다 — 필요하면 다시 만든다).
- 구조: `template.json`(`key` · `title` · `figmaSet` · `order` = 섹션 폴더 이름 순서, 아직 없는 섹션은 건너뜀) + `<layout>/`(meta · template.njk · style.css · sample.json, `meta.section` = 템플릿 key, `id` = `<key>-<layout>`, `label` = 편집기 표시 이름) + 선택 `_shared.css`.
  - `meta.uses: ["hero"]` = 다른 섹션의 공통 CSS(`sections/hero/_shared.css` 등)를 함께 쓴다. 템플릿은 `{% from "hero/_macros.njk" … %}` 처럼 sections 매크로를 그대로 import 한다(nunjucks 로더가 sections/ · templates/ 둘 다 본다).
  - 레지스트리(`loadRegistry`)는 템플릿 variant 를 `byId` 에 넣지만 `catalog.sections` 에는 넣지 않는다 → 라이브러리·조합기 목록에 안 나오고, 렌더·검증·Figma 플러그인(components.json 에 키 있음)은 섹션과 같다.
- **지금 섹션 맞추기**(2026-10-20 사용자 요청): 미리보기 섹션 클릭 → 왼쪽 그 칸으로 이동 + `.tpl-sec.is-current`(옅은 accent 배경, `tplCur` · `markTplCur`). 왼쪽 섹션 펼치기 · 그 칸 입력칸 focus → `previewTo(id)` 가 미리보기(창 스크롤)를 그 섹션으로 옮기고 1.4초 테두리, 하단 고정 바는 `.tpl-dock` 을 깜빡임.
- **하단 고정 바 미리보기**: 편집기 iframe 은 페이지 전체 높이로 그려서 sticky 가 끝에만 보인다 → 하단 고정 바(meta `stage: "sticky"`)는 본문 iframe 에서 빼고 `stickyDock()`(site/app.js)이 바깥 문서에 `position: fixed` 로 띄운 작은 iframe(`.tpl-dock`)에 그린다. 미리보기가 화면 아래까지 이어지는 동안 위치가 고정이라 스크롤해도 끊기지 않고, 배율·창 크기·페이지 끝(미리보기 아래 끝에 붙음)만 다시 맞춘다. 처음엔 iframe 안의 바를 스크롤마다 옮겼는데 끊겨서 바꿨다. 편집은 `set()` 으로 바 내용만 바꾸고, 바를 누르면 그 입력칸이 열린다. 지금은 페이지 템플릿 편집기만.
- **자리 고르기·넣고 빼기**(2026-10-19 사용자 요청): `order` 항목을 `{ "label": "추천 대상", "pick": ["check", "persona"] }` 로 쓰면 그중 하나를 고르는 자리(기본 첫 번째). 편집기는 자리마다 체크박스로 넣기·빼기, pick 자리는 칩으로 고른다(`state.tpl[key].pick` · `off`, 자리 키 = variant id 를 `|` 로 이은 것). 뺀 자리·고르지 않은 섹션은 미리보기·page.json·Figma용 파일에서 빠지고, 입력한 내용은 남는다. 레지스트리는 `t.rows`(자리) · `t.defaults`(자리마다 첫 번째 = 샘플 페이지).
- **자리 순서 바꾸기**: `order` 항목에 `"movable": true` 인 자리끼리(지금은 추천 대상 · 추가 섹션) 편집기에서 ↑↓ 로 순서를 바꾼다(이웃이 movable 일 때만, `state.tpl[key].order` = 자리 키 목록). 나머지 섹션 위치는 고정.
- **추가 섹션 자리**(2026-10-19 사용자 결정): 추천 대상 ↔ 아젠다 사이에 달마다 새 디자인이 1~2개 들어간다 → `order` 에 `{ "label": "추가 섹션", "extra": ["image-block"], "max": 3 }`. 편집기에서 0~3개를 「+ 추가」 · ↑↓ · ✕ 로 넣고(`state.tpl[key].extras`), 같은 variant 를 여러 번 쓰려고 byId 에 복제본(`<variant>~<uid>`, `base` · `pre = layout-번호`)을 만들어 편집 값을 따로 둔다. page.json 에는 원래 variant 이름으로, 파일 이름은 `image-block-1-image-pc.png` 처럼 나간다. 샘플 페이지에는 넣지 않는다.
  - `image-block` 샘플(새로 넣을 때 기본값): 제목 「타이틀을 입력하세요」 + 서브타이틀 「서브타이틀을 입력하세요」 + 버튼 2개 「버튼 문구」(blue/700 채움 + 테두리) — Figma 시안이 없어 자리 문구다(사용자 요청 2026-10-19). 지우면 제목·버튼 없이 쓸 수 있다.
  - agenda 샘플 사진 = 자주 쓰는 프로필 1~3번(조영탁 · 임선예 · 홍정민, 이름 칸도 같이 · 사용자 요청 2026-10-19). 예전 샘플 사진 `agenda-1~3.png`(Q&A 그림 포함)은 지웠고, meta `formerImages`·`formerTexts`(「이름 직급」)로 예전 편집 값의 그 사진·자리 문구만 새 샘플로 바꾼다.
  - meta `renamedItemFields`(예 월간X 프로그램 `{ "items": { "label": "session" } }`): 목록 항목 필드 이름을 바꾸면 편집기가 예전 편집 값의 필드를 새 이름으로 옮겨요(fixStaleAssets). 나중에 생긴 항목 필드는 제목(title)이 같은 샘플 항목의 값으로, 없으면 빈 칸으로 채워요.
  - meta `sampleVersion`(image-block = 3 · agenda = 3): 샘플 기본값을 바꾸면 올려요 — 편집기가 예전 편집 값의 빈 칸(제목·서브·버튼 등)을 한 번만 새 기본값으로 채우고(`@sv` 기록), 그 뒤 사용자가 지운 칸은 그대로 둔다.
  - `image-block` 버튼 `ctas`(0~2개, 삭제 가능): HDS button size=lg(56) — 높이 56 · 좌우 24 · 16 medium · 아이콘 간격 4 · 모서리 md(12) · 채움(기본 blue/700 = primary) / 테두리(line-outline). 이미지 아래 가운데 · 이미지↔버튼 40(MO 24, 버튼이 칸을 나눠 채움) · 「여백 없음」이어도 버튼 아래 60(MO 40). 클래스 `.mh-hbtn`, 아이콘은 hero 의 `btnIcon`.
  - `image-block`(이미지 섹션): 제목(선택 · 왼쪽 정렬 · 최대 2줄 · 본문 860 칸 · 32/MO 24) + 서브타이틀(선택 · 18 regular · 최대 3줄 · 제목↔서브 12, MO 16 · 8) — 제목 묶음↔이미지 PC 60 · MO 32, 제목이 있고 「여백 없음」이면 위 120/MO 40) + Figma 에서 만든 새 디자인을 PC·MO 이미지(또는 mp4)로 · 대체 텍스트 · 링크 · 폭(본문 860 기본/화면 가득) · 위아래 여백(없음/120) · 배경색(free). 비어 있으면 자리 표시(ph-visual). 미리보기 클릭으로 바꾸기(`PICK_AREAS.image`). 다음 단계 후보: 라이브러리 섹션(sections/)도 이 자리에 넣기(사용자에게 ① 로 제안함).
- 빌드: `dist/templates/<key>/index.html`(샘플로 조립) · 결과 확인 `npm run shot -- templates/monthly-hunet`.
- 편집기: `site/app.js` 「페이지 템플릿 편집기」 — 섹션마다 펼침 폼(히어로 편집기와 같은 `heroForm` · `bindEditorForm`), 미리보기는 전체 페이지(섹션 루트에 `data-tpl-sec`, 바뀐 섹션만 다시 그림). 저장 `state.tpl[key].edits[variant]`. 내보내는 파일 이름 앞에는 layout(`hero-bg-pc.jpg`). 줄 넘김 경고(`MEASURE`)는 아직 히어로 편집기만.
- 문구는 전부 슬롯으로 만든다(템플릿에 하드코딩 문구 0개 — 전체 편집이 목적). pager 섹션은 아직 편집기 미리보기에 `--per-*` 를 붙이지 않는다(필요하면 `withPager`).
- 섹션(PC, 2026-10-19 · 노드는 637:* 로 옮겨짐): hero · summary · check · persona(3열) · persona-2col( 2열 · 본문 860(사용자 요청, Figma 는 980) — persona 템플릿을 include 하고 `cols = 2`, 카드 CSS 는 `_shared.css`) · agenda(600:7963) · register(624:8146) · benefits(624:8208) · replay(624:10250) · sticky-cta(624:10289). 클래스는 `mh-<layout>__*`, 공통(`_shared.css`)은 섹션 제목 `.mh-h` · 알약 버튼 `.mh-btn` · persona 카드.
  - **MO**(2026-10-19): Figma MO — summary 600:7665 · check 600:7695 · persona 600:7911(2열 · 아바타 위, 2col 버전도 같은 MO) · agenda 600:8061(세션 이름 흰 알약 + 옆 시간 · 사진 80 + 이름 옆) · benefits 633:3313 · replay 633:3314(2열) · sticky-cta 633:3339(남은 날 회색 칸 `ddayMo` + 빨간 버튼 하나 — PC 첫 버튼은 숨김). **register 는 MO 에서 숨김**(사용자 결정). 문구는 PC·MO 같은 값을 쓴다 — Figma MO 문구가 PC 와 다른 곳은 디자이너 확인 목록(아래). TB 는 제안값(패딩 줄이고 2열 칸을 유동 폭으로).
  - Figma MO 문구가 PC 와 다른 곳(확인 요청): summary 제목 「업무는」 빠짐 · check 제목이 다름(「실제 교육 담당자들은 이런 고민을…」) · agenda 시간(14:00~14:40) · Session 2 소제목이 Session 1 과 같음(복사 실수로 보임) · 연사 이름(PC 는 「회사명 팀명/이름 직급」) · Session 3 「Q&A」 · benefits 설명·카드 제목 짧게 · replay 목록이 PC 와 다른 4개 · sticky 「109월 월간휴넷]」 오타 · 버튼 문구 「무료 신청하기」.
  - 이미지(`assets/monthly-hunet/`)는 Figma 렌더 1배(아바타 144 · 연사 150 · 썸네일 410)라 2배 원본이 오면 바꾼다. 혜택 이미지는 회색 칸(#e9ecef, Figma 값) 가운데에 놓는다(Figma 는 약간 왼쪽).
  - 굵은 일부 문구(신청서·혜택 설명 뒤)는 `highlight` 슬롯으로 따로 받는다(richtext 에 굵게 표기가 없어서).
  - 텍스트 매핑(figmaLayer)은 아직 없다 → Figma 플러그인으로 보내면 문구가 샘플 그대로다.
- **시안 저장 (Supabase)**(2026-10-20 테스트, 사용자 결정): 페이지 템플릿 편집기 「저장해서 링크 만들기 / 저장하고 링크 복사」 → 링크 `#d-<시안 번호>`. Supabase 프로젝트 `product-page-templates-kr`(서울 ap-northeast-2, 조직 hunet · 사용자 계정) — 주소·공개 키(publishable, 웹 페이지용)는 site/app.js `SUPA`. secret/service_role 키·DB 비밀번호는 코드·문서·메모리에 쓰지 않는다. 처음 만든 뭄바이 테스트 프로젝트는 2026-10-20 사용자가 지웠다.
  - 서버 쪽(SQL Editor 로 사용자가 실행): 표 `drafts`(id · template · title · data jsonb · edit_key · 시각, RLS 켜고 정책 없음) + 창구 함수 `draft_save(p_id, p_key, p_template, p_title, p_data)`(번호 없으면 새로, 번호+열쇠가 맞으면 덮어씀) · `draft_get(p_id)`(번호를 알아야 읽음 · 목록 없음), anon 실행 권한. Storage 공개 버킷 `drafts`(50MB · png/jpeg/gif/webp/mp4, anon 업로드 허용 — 테스트 단계 한계, 운영은 회사 이메일 로그인 제안).
  - 편집기: `saveDraft` = 올린 파일을 버킷에 올려 편집 값의 `{ file, name }` 에 `url` 을 적고(다시 안 올림) 샘플과 다른 섹션만 저장. 수정 열쇠는 `state.myDrafts[번호]`(저장한 브라우저만) → 다른 사람이 연 시안을 저장하면 새 번호로 복사. `openDraft` = url 에서 파일을 받아 같은 file 키로 IndexedDB 에 넣어 Figma용 받기·page.json 받기가 그대로 동작. 지금 편집하던 다른 내용은 `tplBackup`.
- **회차 · 히스토리 (Supabase `issues` 표)**(2026-10-20, 사용자 결정 — 테스트라 로그인 없이): 한 회차(월간휴넷 2026년 11월호) = 한 줄 — template · period(YYYY-MM) · title · status(draft 작성 중 · review 디자이너 전달 · done 완료 — 완료는 기획자·디자이너 둘 다) · data · info(행사일 eventDate · 신청 마감일 deadline · 게시 주소 liveUrl) · final(완료 때 보관한 화면 HTML · page.json · Figma용 파일 주소) · rev(덮어쓰기 방지) · created_by/updated_by/done_by(편집기에 입력한 이름 `state.me`). 파일함 `issues`(공개 읽기). 정책은 테스트용 anon 읽기·만들기·고치기(지우기 없음) — 공개 키라 누구나 목록을 볼 수 있어 **운영 전 회사 이메일 로그인 + 사내 계정 정책으로 바꿔야 한다**(사용자가 붙이기로 함, SQL 초안은 대화 기록). 회차 안 버전 기록은 나중에.
  - 회차를 연 편집 화면 왼쪽은 두 단락(2026-10-21 사용자 요청): 위 `.tpl-head`(템플릿 제목 + 회차 칸) — 구분선 — 아래 `.tpl-edit-head`(「섹션 편집 N개 · 모두 접기 · 모두 펴기」) + 섹션 목록. 히어로 편집기 · 페이지 템플릿 편집기의 설명 문구(「스타일을 고르고…」 · 스타일 설명 · 「섹션을 펼쳐…」)는 뺐어요.
  - **상태 표시 뺌**(2026-10-21 사용자 요청 — 더 간단하게): 편집기 화면에서 작성 중 · 디자이너 전달 · 완료(고르기 · 목록 배지 · 완료 잠금 · 결과물 보관 · 다시 열기)를 모두 뺐어요. 회차는 언제든 고쳐 저장해요(`issueLocked` 는 항상 false). 표의 status · final 칸과 `finalFiles` 는 남아 있어 다시 붙일 수 있어요. 회차 칸 = 한 줄 ▾ 연월 · 이름 · 정보 · ← 회차 목록 (저장 시각 · 사람은 화면에서 뺌, 표에는 기록).
  - **자동 저장**(2026-10-21 사용자 결정): 회차를 연 동안 로컬 `save()` 가 `autoSaveTick` 을 불러 회차 지문(`issueSig` = 편집 값 · 자리 · 이름 · 연월)이 마지막 저장과 다르면 2초 뒤 `saveIssue(auto)`. 회차 칸 머리에 「저장 중…」(끝나면 아무것도 안 보임 · 사용자 요청) · 「저장 안 됨 · 다시 시도」, 그사이 다른 사람이 저장했으면 묻지 않고 「○○님이 고쳤어요 · 새로 불러오기 · 내 내용으로 덮기」. 아래 버튼은 「링크 복사」(먼저 `autoFlush`), 「← 목록보기」도 먼저 저장. 창을 닫을 때 저장이 남아 있으면 브라우저가 물어요.
  - **회차 지우기 = 숨기기(휴지통)**(2026-10-21 사용자 결정): 표 `deleted_at timestamptz`(사용자가 SQL 로 추가) — 목록 줄 「삭제」(확인 후 deleted_at = 지금) → 목록에서 빠지고, 목록 아래 「지운 회차 (N)」에서 「되살리기」(deleted_at = null). 「지운 회차」 줄의 「영구삭제」(2026-10-21 사용자 요청) = DELETE `id&deleted_at=not.is.null` — 정책 "test delete trashed"(deleted_at 이 있는 줄만, anon · 사용자가 SQL 실행). 로그인을 붙이면 관리자만으로 바꿀 것. 올린 파일은 파일함에 남김(다른 회차가 같은 파일을 쓸 수 있어서). deleted_at 칸이 없으면 삭제 버튼을 숨기고 예전처럼(`TRASH.ok`).
  - **목록 → 미리보기**(2026-10-21 사용자 요청): 처음 화면 목록의 줄(이름)을 누르면 편집으로 가지 않고 오른쪽 미리보기만 그 회차로(`ts.homeSel` → `latestPreview`, 고른 줄 `.is-sel`), 줄 오른쪽 「수정」(`data-iss-open`)이 편집을 열어요. 처음엔 가장 최근에 저장한 회차가 골라져 있고(`homeShown`), 미리보기 위 줄은 「연월 이름 · 시각 저장 · 사람 · 수정」.
  - **처음 화면 = 회차 목록**(2026-10-21 사용자 요청): 페이지 템플릿 탭에 들어올 때마다(새로고침 · 탭 이동, `tplToHome`) 열려 있던 회차를 닫고 — 저장 안 한 수정(`ts.dirty`)이 있으면 그대로 열어 둠 · 회차 링크 `#i-` 로 오면 바로 편집 — `issueHome`(제목 · 「+ 새 회차」 · 회차 목록 — 누르면 열기 · 링크 · 복사)만 보이고 섹션 편집 칸 · 아래 버튼 · 오른쪽 미리보기는 **가장 최근에 저장한 회차**(updated_at)를 보기 전용으로 보여요(`latestPreview` — 편집 값을 잠깐 바꿔 렌더하고 되돌림 · 올린 파일은 저장된 주소 그대로 · 위쪽 「최근 수정 연월 이름 · 시각 · 사람 · 이 회차 열기」, 2026-10-21 사용자 요청) (`#tpl-editor.is-home`). 회차를 열거나 만들면 편집 칸이 나오고, 회차 칸의 「← 목록보기」으로 돌아가요(저장 안 한 수정 `ts.dirty` 가 있으면 물어봐요). 그래서 편집은 항상 회차 안에서 해요(새 회차 시작 내용 「이 브라우저에 남은 편집 내용」으로 예전 로컬 편집을 가져올 수 있어요).
  - 편집기(site/app.js 「회차」): 섹션 목록 위 회차 칸(`issueBar`, 2026-10-20 사용자 요청으로 두 줄로 간결하게 (접기 ▾ 는 2026-10-21 뺐음 — 정보 · 목록보기가 늘 보임) · 지난 회차 목록 머리 「지난 회차 N · 접기 ▴」) — ① 연월 · 이름 · 상태 고르기(select, 바꾸면 바로 저장 · 디자이너 전달은 링크 복사 · 완료는 결과물 보관) ② 저장 시각 · 사람 + 작은 글자 버튼 「정보」(연월 · 이름 · 내 이름 — 행사일 · 마감일 · 게시 주소 칸은 2026-10-21 사용자 요청으로 뺐고 info 칸은 표에 남음) · 「지난 회차」(한 줄씩: 연월 이름(누르면 열기) · 상태 · 링크 · 복사) · 「닫기」. 완료면 「🔒 완료 · 화면 보기 · page.json · Figma용 · 다시 열기」 한 줄. 회차 없음이면 한 줄 + 「지난 회차」·「+ 새 회차」(연월 · 이름 · 시작 내용: 지난 회차 복사(기본) / 지금 편집 내용 / 샘플). 아래 버튼 「회차로 저장」/「저장하고 링크 복사」(`issueSaveBtn`). 저장 = PATCH `id&rev=eq.N` → 0줄이면 그사이 누가 저장한 것 → 덮어쓸지 · 그 내용을 불러올지(내 내용은 tplBackup). 링크 `#i-<id>`(`openIssue`). 완료 = 저장 → `finalFiles`(srcdoc 화면 · page.json(올린 사진은 저장된 주소로) · figmaBundle) 를 파일함에 올리고 status done → `#tpl-editor.is-locked`(입력칸 잠금) · 「다시 열기」= status draft. 파일함은 html 을 text/plain 으로 줘서 「화면 보기」는 받아서 blob 으로 열어요.
- **공유 링크**(2026-10-20 테스트 — 기획자·마케터가 파일 없이 디자이너에게 전달): 페이지 템플릿 편집기 「공유 링크 복사」 = `state.tpl[key]`(샘플과 다른 섹션만 · pick · off · extras · order)를 deflate-raw 압축 + base64url 로 주소 `#share-<key>=…` 에 담는다(`shareLink` · `openShare`, site/app.js). 직접 올린 파일(IndexedDB)은 담지 못해 샘플 값으로 바꾸고 개수를 알린다. 받은 쪽은 지금 편집 값을 `state.tplBackup[key]` 에 두고 받은 내용으로 연다(되돌리기 UI 는 아직 없음). 다음 단계 = 저장소(사내 서버 또는 외부 서비스 — 사용자 결정 대기)를 붙여 이미지까지 · Figma 플러그인 코드 입력.
- 편집기 폼 확장(히어로 편집기도 같이 씀): 목록 항목의 `richtext` = 여러 줄 입력칸(textarea), `image` = 썸네일 · 파일 선택 · 지우기 · 되돌리기(내보내기 이름 `<layout>-<목록>-<n>.<확장자>`). 미디어 칸은 샘플과 다르면 「되돌리기」. 미디어 슬롯 `single: true` = PC·MO 같은 파일 하나(로고).

## 조합기 → Figma (플러그인)
- 조합기 「Figma용으로 받기」 = `.figma.json`(`format: tpl-figma/1`, page.json + `files`: 히어로 편집기에서 올린 파일 data URL, 이름 `upload/<variant>/hero-bg-pc.jpg`).
- `figma-plugin/` 플러그인이 섹션마다 원본 컴포넌트 인스턴스를 만들고(같은 파일 = 노드 ID, 아니면 `components.json` 의 key → 팀 라이브러리 게시 필요) `plan()` → `run()` 으로 값을 넣는다. 레이어 찾기는 `slimSpec(slots, true)`(`scripts/lib.mjs`, figma-extract 와 공통 — `extract: false` 슬롯도 레이어 이름을 넣음).
  - 색·모서리 슬롯은 `DECOR`(titleColor·descColor → 문구 글자색, badge* → 뱃지 글자를 감싼 프레임)와 버튼 항목 `itemDecor`(color·line·radius·style outline·icon ≠ none = `right-icon` 속성 켜기 — 모양은 Figma 버튼 기본 아이콘). 기본값과 같으면 손대지 않는다.
  - 이미지: 샘플과 같으면 Figma 원본을 둔다. 숨긴 레이어도 찾아 보이게 하고, `background` 레이어가 없으면 섹션 자체 채우기. 그림(그라디언트 원)으로 된 bg 프레임은 안을 숨기고 이미지로 채운다. CSS 프리셋 = `assets/hero/bgfx/<key>.jpg`.
  - 아직 안 하는 것: 섹션 options·theme, Figma 에 없는 목록 항목 추가, split-stats 수치, TB. 2단계(나머지 섹션)에서 카드 수(pager)·options(Figma variant 속성) 매핑을 더한다.
- Claude 는 원격 환경에 Pretendard 가 없어 플러그인을 직접 돌려 볼 수 없다 → 바꾼 뒤엔 `plan()` 만 use_figma 로 원본 컴포넌트에 **읽기 전용**으로 돌려 레이어를 찾는지 확인한다(쓰기 금지).

## 작업 흐름
- **새 섹션/variant** → `add-section-variant` 스킬 (슬롯 매핑 문법·pager 판단 규칙 포함)
- **디자이너가 조합한 Figma 페이지 → HTML** → `figma-to-page` 스킬
- **매핑이 Page 18 원문을 그대로 뽑는지 확인** → `figma-extract.mjs scan-components … --verify` → use_figma 실행 → `report` (현재 98건 중 92건 일치)
- **UI·섹션을 바꾼 뒤에는 반드시 `npm run shot` 으로 결과를 보고** Figma `get_screenshot` 과 비교한다. 사용자는 결과물 확인을 가장 중요하게 여긴다.
- 라이브러리 사이트는 결과물(미리보기)이 먼저 보이도록 컴팩트하게 유지한다. 설명 문구를 늘리지 않는다.
- **라이브러리 목록 한글 이름**(2026-10-21 사용자 요청 — 영어 코드만으로는 구분이 어려워서, 히어로부터): sections.json 섹션 `name`(hero = 히어로) · variant meta `label`(히어로 11종: 배경 + 뱃지 · 배경 + 큰 제목 · 밝은 배경 + 뱃지 · 어두운 그라디언트 · 그라디언트 글자 · 아래 큰 비주얼 · 제품 화면 · 좌우 나눔 · 수치 · 좌우 나눔 · 사진 · 배경 + 왼쪽 정렬 · 배경 + 왼쪽 아래) → 목록은 한글 이름만 한 줄(영어 코드 · PC/MO 표시는 사용자 요청으로 뺌 — 코드는 마우스를 올리면 title 로). 2026-10-21 나머지 15개 섹션 · 40종도 한글 이름을 붙였다(sections.json `name` · meta `label`, 각 meta 의 when 설명을 바탕으로 Claude 가 지음 — 사용자가 바꿀 수 있음). 새 섹션 · variant 를 더할 때도 name · label 을 함께 넣는다(없으면 코드가 보임). 조합기도 같은 이름(행 머리 · 스타일 썸네일 이름 · 추가 고르기 · 준비 중 목록 — app.js `vlabel` · `slabel`).
- **편집기는 한글만**(2026-10-21 사용자 요청): 히어로 편집기 스타일 이름 = meta label · 색 이름은 hds.json label 에서 영어 괄호를 뺀 것(`koLabel`) · 모서리는 px(원형) · 버튼 아이콘 칩 이름 꺾쇠 화살표 · 화살표 · 더하기 · 시안 샘플 파일은 「기본 이미지」 · 「또는 그려진 배경」. PC · TB · MO · page.json · Figma 는 그대로.
- **위쪽 화면 탭은 두 묶음**(2026-10-21 사용자 요청): 「섹션 템플릿」(라이브러리 · 조합기 · 히어로 편집기 — 같은 패키지) | 「페이지 템플릿」(월간휴넷 · 월간X — `.seg--pages`, 템플릿 탭은 app.js 가 여기에 넣음). site/shell.html `.modes`(묶음 이름 글자는 사용자 요청으로 빼고 틀만 나눔 · aria-label 로만 남김).
- **왼쪽 패널 스타일**(2026-10-21 사용자 요청 — 사내 「휴넷 배너즈」 bannerz-iota.vercel.app 참고): 라이브러리 목록(.side) · 조합기 · 히어로 편집기 · 페이지 템플릿 편집기(.compose__side)는 회색 바탕(--pane-bg #F7F7F8) 위 흰 카드(둥근 12 · 옅은 그림자 · 안쪽 24) · 그룹은 상자 대신 1px 구분선(#EAEBEC) · 제목 16 bold · 입력칸 둥근 8(테두리 #E1E2E4) · 버튼 40(아래 버튼 칸은 36) · 주 버튼 파랑 #0066FF(패널 안에서만 --accent 를 --pane-accent 로). site/app.css 맨 끝 블록. 글꼴은 사이트 전체 Pretendard(site/shell.html 에서 jsdelivr pretendard@1.3.9 를 불러옴 · `--font-mono` 도 Pretendard, 코드 pre/code 만 `--font-code` 고정폭).

## 알려진 과제 (다음에 할 일 후보)
- 원본을 상품페이지 템플릿 시스템(dxhWk)으로 옮겼다(2026-10-13, 노드 113건 relink). 샘플·이미지는 아직 예전 원본 기준이라 새 원본과 문구·이미지 차이를 추출 검증으로 확인해야 한다. 예전 히어로 세트 `1:1710` 의 `459:32173` 에 Claude 가 넣은 `bg-media` 레이어(모션 GIF)는 정리 대상.
- 새 hero 7종은 아직 추출 검증 전이다 (`pages/_verify/` 의 hero 결과는 예전 3종·예전 노드 기록). gradient-text 타이틀은 Figma 에서 줄마다 `title` 레이어가 따로 있어(2개) 추출 매핑을 따로 맞춰야 한다. 버튼 화살표는 Figma `right-icon` 속성으로 읽을 수 있다.
- 추출 검증에서 차이가 난 6건(설명 가능한 차이): feature compact 옵션 문구, detail-slide 슬라이드 수, faq·notice 유의사항 줄바꿈(Figma 원문 수정 필요)
- 추출하지 않는 슬롯(sample 유지): compare-vs-spec 행(Figma 가 열 단위 구조), inquiry 폼 그룹, plan-comparison 셀 태그. pricing-receipt·sticky-cta·inquiry 는 MO 를 추출하지 않음(`extractFrom: "pc"`)
- 디자이너 레이어 이름 정리 요청: 문구가 레이어 이름인 곳, 같은 이름이 겹치는 곳, `Frame 2147…`·`Group 51` 같은 의미 없는 이름. 정리되면 meta 의 `*`/`nth` 우회 규칙을 표준 이름으로 바꾼다
- Figma 오타: countdown `MUNUTES`. 빈 레이어: awards-stats `Group 14`. problem `check` 의 MO(537:41167) 이름은 `device=mo, layout=check` 로 고쳤다(2026-10-15). check 의 PC 타이틀·항목 텍스트 레이어 이름이 다른 문구(「오직 월간휴넷에서만 공개합니다」·「마이크로소프트의 <업무동향지표 202…」) → `title`·`text` 로 정리 요청
- compare 2종·pricing plan-comparison 의 TB/MO 배치는 Figma 에 없어서 제안안이다
- 실제 디자이너 조합 프레임으로 `figma-to-page` E2E (인스턴스 덮어쓰기·이미지 교체 반영 확인)
