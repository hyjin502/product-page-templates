---
name: add-section-variant
description: Figma 섹션 템플릿(컴포넌트 variant)을 코드 레지스트리(sections/)에 새 variant로 등록한다. "concern persona 코드로 등록해줘", "이 피그마 섹션 템플릿에 추가해줘", "코드 준비 중인 섹션 만들어줘" 같은 요청에 사용.
---

# add-section-variant — Figma variant → sections/<section>/<layout>/

결과물은 한 variant 폴더의 파일 4개다. 이 폴더만 만들면 라이브러리 사이트, 조합기, `figma-to-page` 가 모두 자동으로 인식한다.
```
sections/<section>/<layout>/
  meta.json      id · figma 노드 · body · slots (슬롯 계약)
  template.njk   Nunjucks 템플릿 — 텍스트/이미지/버튼은 전부 슬롯 변수
  style.css      PC → TB → MO 순서
  sample.json    Figma 기본 텍스트 그대로의 샘플 내용
```

## 입력
- 섹션 키 (`sections/sections.json` 의 key) 와 layout(+style)
- Figma PC / MO 컴포넌트 노드 ID. 모르면 `get_metadata` 로 `sections.json` 의 `figmaSet` 을 열어 `device=pc, layout=…` 이름의 symbol 을 찾는다.

## 절차
1. **참고 읽기**: `tokens/base.css`(토큰·`.btn`·`.sec-head`·브레이크포인트), 같은 섹션의 `_shared.css` 와 기존 variant, `sections/_partials/ui.njk`(`ctas`, `media` 매크로).
2. **디자인 읽기**: `figma:figma-design-to-code` 스킬을 로드하고, PC·MO 노드 각각 `get_design_context` + `get_screenshot` 을 가져온다.
3. **meta.json**
   - `id` = `${section}-${layout}[-${style}]`, `order` = 피그마에서 위→아래 순서
   - `figma: { pc, mo, tb: null }`, `body` = PC Body 프레임 폭 (740/860/980/1200)
   - `slots`: 사람이 바꾸는 값만 넣는다. 텍스트 레이어 → `text`(한 줄) / `richtext`(줄바꿈 있음). 반복 카드·버튼 → `list` + `item` 스키마 + `max`. 이미지 → `image`.
   - **MO 전용 대체 배치**(`layout=card-compact`, `style=default-compact` 처럼 MO에만 있는 variant)와 **mode=dark/light** 는 별도 variant가 아니라 `options` 로 넣는다:
     `"options": { "compact": { "label": "MO compact · 좌우로 넘기기", "class": "concern--compact", "moOnly": true, "figma": { "mo": "<노드>" } } }`
     빌드는 page.json 의 `"options": ["compact"]` 를 보고 루트에 class 를 붙인다. CSS는 그 class 로 MO 규칙만 바꾼다. 기본 모드가 아닌 쪽(예: sticky-cta dark)도 같은 방식으로 한다.
   - 섹션 제목(heading-pc/heading-mo 인스턴스)이 있으면 슬롯 이름을 `eyebrow`, `title`, `subtitle` 로 하고 템플릿에서 `secHead(eyebrow, title, subtitle, "sec-head--center")` 매크로를 쓴다.
   - **슬롯 매핑 문법** (추출기 `scripts/figma-extract.mjs` 가 이대로 읽는다 — 최상위 슬롯과 list 의 item 필드 모두 같은 형식)
     | 키 | 뜻 |
     |---|---|
     | `figmaLayer` / `aliases` | 레이어 이름. `*` 는 이름 무관(타입으로 찾음). 이름에 `/` 가 들어간 레이어면 `literalNames: true` |
     | `figmaPath` | 조상 이름을 순서대로 적은 경로(중간 프레임은 건너뜀). 문자열 또는 배열. 예 `["heading-pc/title","heading-mo/title"]`, `"Frame 42/*"` |
     | `nth` | 같은 조건 후보 중 n번째(0부터, `-1` = 마지막). 같은 이름 텍스트가 여러 개일 때 |
     | `scope` | `{ "figmaLayer": [...], "nth": k }` — 이 이름의 컨테이너 중 k번째 안에서만 찾음 (두 열이 모두 `The-Problem` 일 때) |
     | `figmaProp` | 인스턴스 속성 값 (`type`, `text-name`…). `$main` = 메인 컴포넌트 이름(아이콘 교체 → enum 으로 느슨하게 맞춤) |
     | list `figmaLayer` | 반복 항목 이름. 바깥 항목 기준이고, 그 안에 같은 이름이 2개 이상이면 안쪽을 항목으로 봄. `figmaPath` 는 항목 경로 또는 컨테이너 경로 |
     | list `split: true` | 텍스트 한 개를 줄 단위로 나눠 항목으로 (앞의 •·- 제거) |
     | `extract: false` | 아직 추출할 수 없는 구조 → sample 값 유지, 보고서에 표시 |
     | meta `extractFrom: "pc"` | MO 레이어가 PC와 너무 달라 MO를 읽지 않음 (PC 값 사용) |
     | 항목 필드 `device` (enum pc/mo) | PC·MO 카드 구성이 다를 때 — 추출기가 합집합을 만들고 한쪽에만 있는 카드에 device 표시 |
     | meta `pager` | 카드형이면 필수. **Figma 오토레이아웃을 읽어서** 정한다: 카드 트랙이 가로(HORIZONTAL) + 카드 채우기(FILL) → `mode: fill` (per = 한 줄 최대 카드 수, 적으면 균등 확장·넘치면 페이지), GRID + 채우기 → `mode: grid` (per = 열 수, rows = 한 페이지 줄 수), 세로 쌓기·고정 폭 스크롤 → `none`/per 0. 형식 `{ "slot": "cards", "mode": {"pc":"fill","tb":"fill","mo":"none"}, "per": {"pc":4,"tb":3,"mo":0}, "rows"?: {...} }`. 템플릿은 카드 트랙에 `data-pager-track`, 바로 뒤에 `{{ pagerDots() }}` (Figma 장식 점은 그리지 않음). list 슬롯 `max` 는 24 |
     figmaLayer/figmaProp 가 없는 슬롯(href, alt, action, deadline 등)은 Figma 에 없는 값으로 보고 sample 값을 기본값으로 쓴다.
   - `figmaLayer` 는 Figma 레이어 이름 그대로 쓴다. 같은 이름이 여러 번 나오면 `figmaPath`(인스턴스 기준 부모/…/레이어)로 구분한다. 의미 없는 이름(`Group 51`, `Frame 2147…`)은 `aliases` 에 넣고, 표준 이름(`eyebrow`, `title`, `description`, `note`, `cta`, `image`, `item`)으로 바꿔 달라고 디자이너에게 보고한다.
4. **template.njk**
   - 루트는 `<section class="<section> <section>--<layout>">` 하나. 섹션 클래스는 BEM(`.hero__title`)으로 쓴다.
   - 텍스트는 `{{ slot | rt }}`, 버튼은 `ctas()` 매크로, 이미지는 `media()` 매크로. 선택 슬롯은 `{% if %}` 로 감싼다.
   - 하드코딩 텍스트는 0개여야 한다 (접근성용 고정 라벨 제외).
5. **style.css**
   - `tokens/base.css` 는 수정하지 않는다. 필요한 토큰이 없으면 `var(--새이름, #값)` 처럼 기본값을 함께 쓰고 보고에 적는다.
   - 색·자간은 `tokens/base.css` 변수만 쓴다 (`var(--t-80)`, `var(--bg-ghost)`, `var(--tracking-tighter)` …). Figma 변수 이름 → 토큰 대응: `typography/black-80` → `--t-80`, `background/bg-ghost` → `--bg-ghost`, `interaction/button-subtle` → `--btn-subtle`.
   - 콘텐츠 폭은 `width: var(--body, <기본값>px); max-width: 100%`.
   - 순서: PC 규칙 → `@media (min-width: 768px) and (max-width: 1279px)` TB → `@media (max-width: 767px)` MO. TB는 Figma에 프레임이 없으면 PC 구조에서 패딩 약 80%, 큰 타이틀은 PC와 MO의 중간값으로 정하고, 2단 레이아웃은 1024px 미만에서 세로로 쌓는다.
   - 섹션 안 여러 variant가 공유하는 규칙은 `sections/<section>/_shared.css` 로 올린다.
   - Tailwind 클래스, 절대 위치 좌표를 그대로 옮기지 않는다. flex/grid로 다시 쓴다.
6. **sample.json**: **Page 18 컴포넌트의 텍스트·이미지를 글자 하나 바꾸지 않고 그대로** 넣는다. 다른 파일·기존 코드의 문구를 가져오거나 새로 지어내지 않는다. `use_figma` 읽기 스크립트로 `characters` 를 그대로 읽는다(`\u2028` 은 `\n` 으로). PC·MO 텍스트가 다르면 `{ "pc", "mo" }`. 이미지가 있으면 Figma에서 받은 파일을 `assets/<section>/` 에 두고 `{ "src": "assets/<section>/…", "alt": "" }`.
7. **에셋**: 아이콘은 `assets/icons/<name>.svg`(선 색 `currentColor`)로 두고 템플릿에서 `{{ 'name' | icon }}` 로 쓴다. 그 외 고정 이미지는 `assets/` 에 둔다. Figma 임시 URL을 코드에 남기지 않는다.
8. **검증**
   ```bash
   npm run build          # sample.json 이 슬롯 스키마와 맞지 않으면 실패
   ```
   `dist/index.html` 에서 PC 1920 / TB 1024 / MO 375, 라이트/다크를 확인한다.
   **추출 검증(필수)**: 새 variant 의 매핑이 Page 18 원문을 그대로 뽑는지 확인한다.
   ```bash
   node scripts/figma-extract.mjs scan-components pc=<PC노드> mo=<MO노드> --write pages/_verify/<id>.scan.json
   node scripts/figma-extract.mjs extract pages/_verify/<id>.scan.json --verify   # → dist/extract/<id>.js
   # use_figma 로 실행 → 결과를 pages/_verify/<id>.verify.json 에 저장
   node scripts/figma-extract.mjs report pages/_verify/<id>.verify.json          # ✓ 이어야 함
   ``` PC·MO는 `get_screenshot` 결과와 나란히 비교해서 간격·타이포·정렬 차이를 고친다.
9. **보고**: 추가한 파일, 슬롯 목록, 디자이너에게 요청할 레이어 이름 정리, TB에서 임의로 정한 값.
