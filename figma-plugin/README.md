# 상품페이지 템플릿 → Figma 플러그인

조합기에서 만든 페이지를 Figma 원본 섹션 컴포넌트 **인스턴스**로 조립해요. 레이어가 그대로 살아 있어요.

## 설치 (처음 한 번)
1. 사이트 조합기 아래 **Figma 플러그인 받기** → zip 풀기 (또는 이 저장소에서 `npm run build` 후 이 폴더)
2. Figma 데스크톱 앱 → **Plugins → Development → Import plugin from manifest…** → `manifest.json`

## 쓰기
1. 조합기 **Figma용으로 받기** → `<제목>.figma.json`
2. Figma 에서 플러그인 열기 → 파일을 끌어 놓기(또는 page.json 붙여넣기) → PC·MO 고르고 **Figma 에 만들기**
3. 지금 페이지 오른쪽에 `<제목> — PC`(1920) · `<제목> — MO`(375) 프레임이 생겨요. 반영 못 한 것은 창 아래 「확인할 것」

원본 파일(상품페이지 템플릿 시스템, dxhWk)에서 열면 바로 되고, 다른 파일에서는 원본을 팀 라이브러리로 게시해야 해요.

## 구조 (개발용)
- `src/main.js` — 본체. 슬롯 값 → `plan()`(바꿀 목록, 레이어 찾기는 `figma-extract` 와 같은 규칙) → `run()`(문구·속성·색·이미지)
- `code.js` — **자동 생성**(`npm run build`, `scripts/figma-plugin.mjs`): `DATA`(섹션 스펙 `slimSpec(…, true)` · 슬롯 종류 · 샘플 · HDS · 컴포넌트 키) + `src/main.js`. git 에 넣지 않아요
- `components.json` — 원본 컴포넌트 노드 → key·크기. relink 로 노드가 바뀌면 `scripts/figma-plugin.mjs` 머리말대로 다시 받아요
- `ui.html` — 파일 받기 · 이미지 모으기(올린 파일 = 받은 파일 안 data URL, 저장소 이미지 = raw.githubusercontent.com)
