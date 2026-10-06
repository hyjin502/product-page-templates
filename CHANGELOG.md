# 변경 내역

## 0.2.0 — 2026-10-06
히어로 리뉴얼 1단계 — 기획자·마케터용 **히어로 편집기**와 샘플 히어로 1종.

- **hero 교체**
  - 예전 hero 3종(center-inline · center-bottom · split)을 지웠어요.
  - Figma 새 시안 7종을 모두 추가했어요:
    - `media-badge`(29729): 배경 + 흰 뱃지 + 버튼
    - `media-title`(29747): 배경 + 어둡게 + 큰 한 줄
    - `light-badge`(29765): 밝은 바탕 + 파란 뱃지 + 버튼 2
    - `dark-gradient`(29785): 그라디언트 + 버튼 2
    - `gradient-text`(29822): 빨간 테두리 뱃지 + 줄마다 그라디언트 타이틀
    - `visual-bottom`(29629): 큰 브랜드명 + 하단 비주얼
    - `product-shot`(29802): 메시지 + 제품 화면
  - 버튼은 채움·테두리와 화살표를 고를 수 있고, 배경 어둡게와 하단 비주얼·제품 화면(이미지·mp4)도 바꿀 수 있어요.
  - MO 는 Figma 에 없어서 기존 MO 히어로 규칙으로 정한 임시 제안값이에요. 히어로별 MO 디자인을 받으면 다시 맞춰요.
- **히어로 편집기** (`index.html#hero-editor`, 상단 세 번째 탭)
  - 문구는 줄마다 입력하고 글자 수를 보여 줘요(띄어쓰기 포함).
  - 배경은 PC·MO 따로, 이미지 또는 mp4 를 넣을 수 있어요.
  - 스타일은 썸네일로 고르고, 스타일마다 입력이 따로 남아요.
  - 버튼은 최대 2개이고 HDS 색·radius 를 골라요.
  - 기기별로 줄 넘김을 경고해요.
  - 입력은 브라우저에 저장되고 page.json 으로 받아요(올린 파일 포함).
  - 미리보기는 빌드와 같은 템플릿을 브라우저에서 렌더해요(`site/render-core.cjs` + 미리 컴파일한 Nunjucks).
- **슬롯 규칙**
  - `maxLines` · `minLines` · `maxChars` 를 추가했어요.
  - 새 타입 `color` · `radius` · `media` · `toggle` 을 추가했어요. HDS 토큰은 `tokens/hds.json` 에 있어요.
  - enum 칩 표시 이름(`labels`)과 조건부 숨김(`hideWhen`)을 추가했어요.
  - 빌드할 때 `srcset` · `poster` 파일도 복사해요.
- **Figma 링크 재연결**: Page 18 이 새로 만들어져(`6233:26985`) 깨졌던 노드 100개를 모두 새 ID 로 옮겼어요.

## 0.1.0 — 2026-10-01
처음 묶은 버전. Figma `[UI] 커피 정수기` Page 18 기준.

- **섹션 템플릿**: 16개 섹션 · 42개 variant (hero 3 · concern 4 · problem 8 · feature 5 · benefit 5 · compare 2 · metrics · awards 2 · logo-wall · pricing 3 · countdown 2 · faq · notice · inquiry · utility 2 · sticky-cta)
  - 샘플은 모두 Page 18 원문
  - MO compact · 다크 등 옵션 11개
- **반응형**: MO ≤767 / TB 768–1279 / PC ≥1280. TB 는 코드 기본값
- **카드 배치**: Figma 오토레이아웃 기준 fill / grid / none
  - 카드가 적으면 넓어지고, 한 줄 최대를 넘으면 페이지 넘김과 점
- **라이브러리 사이트**
  - 섹션별 미리보기: PC/TB/MO, 라이트/다크, body 폭, 옵션, 카드 수
  - Figma 메뉴, 개발자 보기(HTML·CSS·슬롯·템플릿)
- **조합기**: 섹션 순서·variant·옵션·카드 수를 고르고 page.json 받기
- **빌드**: page.json → 단독 HTML + assets (사용한 섹션 CSS·JS 만 포함)
- **Figma 추출기** (`scripts/figma-extract.mjs`)
  - scan → extract → finalize
  - 슬롯 매핑 문법: `figmaLayer` · `figmaPath` · `nth` · `scope` · `figmaProp`(`$main`) · `split` · `extract:false` · `extractFrom` · `device`
  - Page 18 전체 검증 98건 중 92건 일치 (차이 6건은 원인 확인됨 — `CLAUDE.md`)
- **스킬**: `add-section-variant`, `figma-to-page`
- **도구**: `npm run shot`(결과 캡처) · `serve`(http 점검) · `pack`(전달용 zip)
