# 변경 내역

## 미배포
- **버튼 모서리(radius)를 HDS 전체로**: HDS Semantic radius 에 있던 `none`(0) · `2xl`(32) · `3xl`(40) 을 더해 9개가 됐어요(xs~xl · full 값은 그대로).
- **히어로 타이틀·서브타이틀 글자색**: 편집기에서 HDS typography 색 10개(검정 100·80·60·45·비활성, 흰색 100·80·60·45·비활성)로 바꿀 수 있어요(`titleColor`·`descColor`, `tokens/hds.json` 의 `text`). 기본값은 지금 색 그대로예요. gradient-text 는 서브타이틀 색만 바꿔요.
- **조합기·히어로 편집기 배치 되돌림**: 넓은 왼쪽 패널 + 오른쪽 미리보기 + 「패널 접고 크게 보기」 버튼으로 다시 돌렸어요(사용자 선택). 1280 미만 창에서는 위아래로 쌓여 미리보기가 전체 폭이에요. 그사이 시도한 "항상 위아래" · "패널을 라이브러리 목록 폭으로" 배치는 뺐어요.
- **좁은 창(1280 미만)에서 조합기·히어로 편집기 미리보기를 전체 폭으로**: 패널과 미리보기를 위아래로 두고, 편집기는 미리보기를 위에 붙여 둔 채 아래에서 입력해요(820 창 기준 22% → 42%, 라이브러리 40%). 예전 860 쌓기 규칙이 뒤쪽 CSS 에 덮여 동작하지 않던 것도 고쳤어요.
- **히어로 CSS 배경**: 배경을 이미지·mp4 말고 순수 HTML/CSS 프리셋으로도 고를 수 있어요(`{ kind: "css", preset }`). 움직이는 4종(선셋 글로우 · 휴넷 레드 · 브랜드 블루 · 오로라)과 정지 2종(보라 페이드 · 나이트 메쉬). 파일이 없어 가볍고, 동작 줄이기 설정이면 멈춰요. 프리셋은 `sections/hero/backgrounds.json` + `_backgrounds.css`.
- **조합기·히어로 편집기 크게 보기**: 왼쪽 위 「패널 접고 크게 보기」로 패널을 접으면 미리보기가 화면 폭에 맞게 커져요(1440 화면 PC 기준 54% → 72%). 접은 상태는 브라우저에 기억돼요. 미리보기 여백도 라이브러리와 같게 줄였어요.
- **Figma 원본 이전**: `[UI] 커피 정수기` Page 19 → `상품페이지 템플릿 시스템` 파일(`dxhWk…`) Section Design System 페이지. 섹션 프레임·variant 노드 113건을 `figma-relink.mjs` 로 다시 맞췄어요(hero 는 새 세트 `469:32313`).

## 0.3.1 — 2026-10-07
- GitHub 저장소로 이전: https://github.com/hyjin502/product-page-templates
- CI(`ci.yml`): 푸시·PR 마다 검증·빌드
- **GitHub Pages 배포**(`pages.yml`)와 사이트 비밀번호 잠금(`scripts/protect.mjs`)
  - 비밀번호는 저장소 secret 에만 둬요
  - 한 번 맞히면 그 브라우저에서는 다시 묻지 않아요

## 0.3.0 — 2026-10-07
Figma 최신화(Page 19) 반영 — hero 7종 MO 를 시안대로 구현.

- **hero MO**
  - Page 19 MO 시안대로 바꿨어요(임시 제안값은 지웠어요).
    - 한 화면 812: 문구 위·버튼 아래(media-badge · light-badge · dark-gradient), 가운데(media-title · gradient-text)
    - 위아래로 쌓기: visual-bottom · product-shot
  - MO 버튼은 전체 폭이고 화살표가 없어요.
- **MO 문구 따로 쓰기**
  - 타이틀·서브타이틀에 MO 문구를 따로 넣을 수 있어요(`{ pc, mo }`, MO 글자 수 한도 따로).
  - 샘플은 Figma PC·MO 원문 그대로예요.
- **배경 교체**
  - media-badge 는 보라, media-title 은 그라디언트로 바뀌었어요.
  - dark-gradient · gradient-text 는 MO 전용 배경을 쓰고, visual-bottom 은 MO 전용 비주얼을 써요.
- **Figma 링크 재연결 도구**: `scripts/figma-relink.mjs` 를 추가했어요. 페이지 복사로 바뀐 노드 113건을 한 번에 다시 맞췄어요(Page 19 `6249:34928`).

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
