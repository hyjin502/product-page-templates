# 변경 내역

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
