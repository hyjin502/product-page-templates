# 상품페이지 템플릿

Figma 섹션 템플릿(`[UI] 커피 정수기` Page 18)과 같은 규칙의 HTML 템플릿을 한곳에서 관리해요.
**AI는 Figma에서 내용만 뽑고(page.json), HTML은 템플릿으로 정해진 대로 조립해요.**

```
Figma 인스턴스 ──figma-to-page──▶ pages/<name>.page.json ──npm run build──▶ dist/pages/<name>/index.html
                                     ▲
sections/<section>/<layout>/  (meta.json · template.njk · style.css · sample.json)
                                     ▼
                              dist/index.html  (라이브러리 사이트 · 조합기 · 히어로 편집기)
```

**히어로 편집기** (`dist/index.html#hero-editor`) — 기획자·마케터가 히어로 스타일 7종 중 하나를 고르고 문구·배경(PC·MO 따로, 이미지 또는 mp4)·버튼(HDS 색·radius)을 바꿔 PC/TB/MO 결과를 바로 봐요. `page.json 받기` → `pages/` 에 배경 파일과 같이 넣고 `npm run build` 하면 같은 화면의 HTML 이 나와요.

> 개발자가 아니라면 **`GUIDE.html`**(쉬운 사용 가이드)을 먼저 열어 보세요. 빌드 후에는 라이브러리 상단 `사용 가이드` 링크로도 열려요.

## 처음 받았을 때
1. **Node.js 18 이상**을 설치해요 (`node -v` 로 확인)
2. 소스 zip 을 풀고 그 폴더에서:
   ```bash
   npm install
   npm run build
   ```
3. `dist/index.html` 을 브라우저로 열면 라이브러리예요. 조립된 페이지는 `dist/pages/<이름>/index.html` 이에요.
4. Claude Code 로 이어서 작업하면 `CLAUDE.md`(규칙·결정 사항·다음 할 일)를 먼저 읽고 시작해요. Figma 작업에는 Figma MCP 연결이 필요해요 (claude.ai Figma 커넥터 또는 figma MCP).

zip 안에 git 이력(`.git`)도 들어 있어요. 회사 GitHub/GitLab 에 올릴 때는 원격만 연결하면 돼요:
```bash
git remote add origin <회사 저장소 주소>
git push -u origin main
```

## 명령
| | |
|---|---|
| `npm install` | 처음 한 번 (의존성: nunjucks 하나) |
| `npm run build` | 라이브러리 + `pages/*.page.json` 전부 빌드 |
| `npm run dev` | 파일이 바뀌면 다시 빌드 |
| `npm run validate` | page.json · sample.json 슬롯 검증 |
| `npm run preview -- --section hero` | variant 단독 미리보기 (`dist/preview/`, MO 375 하네스 포함) |
| `npm run shot` | **결과 확인** — PC 1920 · TB 1024 · MO 375 캡처 → `dist/shots/` (`-- all-templates` 처럼 페이지 이름, `-- preview/hero-media-badge` 도 가능) |
| `npm run serve` | `dist/` 를 http://localhost:4173 으로 서빙 (`-- --base /templates/` 로 하위 경로 흉내) |
| `npm run pack` | 전달용 zip 2개 → `release/` (소스 / 사이트) |
| `node scripts/figma-extract.mjs …` | Figma → page.json 추출 (scan → extract → finalize, 검증은 `--verify` + `report`) |

`npm run shot` 은 로컬 Chrome(없으면 Edge)을 자동으로 찾아요. 못 찾으면 `CHROME_PATH` 환경변수에 실행 파일 경로를 넣어요.

## 개발 이어가기
- **섹션 추가·수정** → `sections/<section>/<layout>/` 파일 4개. Claude Code 에서는 `add-section-variant` 스킬
- **디자이너가 조합한 Figma 페이지 → HTML** → `figma-to-page` 스킬 (결과: `pages/<name>.page.json` → `dist/pages/<name>/`)
- 바꾼 뒤에는 `npm run build && npm run shot` 으로 PC·TB·MO 결과를 확인해요
- 변경 내역은 `CHANGELOG.md` 에 한 줄씩, 전달할 때는 `package.json` 의 `version` 을 올리고 `npm run pack`

## 사내 배포 (정적 호스팅)
`dist/` 는 모두 상대 경로라서 **아무 웹서버·하위 경로에 그대로 올리면** 동작해요 (서버 코드·DB 없음).

1. `npm run pack` → `release/product-page-templates-site-<버전>-<날짜>.zip`
2. 사내 웹서버의 원하는 경로(예: `https://intra.example.com/templates/`)에 zip 을 풀어서 올려요. `index.html` 이 라이브러리예요.
3. 올리기 전 점검: `npm run serve -- --base /templates/` → http://localhost:4173/templates/
4. 갱신: 수정 → `npm run pack` → 같은 경로에 덮어쓰기

회사 저장소에 CI 로 자동 배포하려면 (예시 — 파일은 저장소에 없어요):

<details><summary>GitLab Pages (.gitlab-ci.yml)</summary>

```yaml
pages:
  image: node:20
  script:
    - npm ci
    - npm run build
    - rm -rf public && cp -r dist public
  artifacts:
    paths: [public]
  only: [main]
```
</details>

<details><summary>GitHub Pages (.github/workflows/pages.yml)</summary>

```yaml
name: pages
on: { push: { branches: [main] } }
permissions: { contents: read, pages: write, id-token: write }
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: github-pages
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci && npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
      - uses: actions/deploy-pages@v4
```
</details>

## 폴더
- `tokens/base.css` — 토큰, 버튼·뱃지, **브레이크포인트 정의** (MO ≤767 / TB 768–1279 / PC ≥1280), 카드 페이지 넘김 CSS
- `tokens/pager.js` — 카드 페이지 넘김 런타임 (페이지에 자동 포함)
- `tokens/hds.json` — HDS 버튼 색·radius (히어로 편집기 선택지, 템플릿 필터)
- `sections/sections.json` — 섹션 카탈로그(기본 순서, Figma 섹션 노드)
- `sections/<section>/_shared.css` — 섹션 안 variant 공통 CSS
- `sections/<section>/<layout>/` — variant 하나 = 파일 4개 (+ 필요하면 script.js)
- `sections/_partials/ui.njk` — 버튼 목록 `ctas()`, 이미지 `media()`, 섹션 제목 `secHead()`, 점 `pagerDots()` 매크로
- `sections/hero/_macros.njk` — hero 배경 `bgMedia()`, 줄 단위 `lineSpans()`, HDS 버튼 `btns()`
- `pages/*.page.json` — 조립할 페이지 (sections[] = { variant, content, options?, pager?, body?, theme? })
- `pages/all-templates.page.json` — 46개 variant 전체 (Page 18 원문) → `dist/pages/all-templates/`
- `pages/pager-example.page.json` — 카드 수에 따른 배치 예시
- `pages/_verify/` — Page 18 추출 검증 결과 (`report` 로 확인)
- `site/` — 라이브러리·조합기·히어로 편집기 사이트 셸. `site/render-core.cjs` 는 빌드와 편집기가 함께 쓰는 렌더 코드
- `.claude/skills/figma-to-page` — Figma 조합 페이지 → page.json → 빌드
- `.claude/skills/add-section-variant` — Figma variant → sections/ 등록
- `CLAUDE.md` — Claude Code 작업 가이드 (규칙·결정 사항·알려진 과제)

## page.json 내용 규칙
- `richtext`: 줄바꿈은 `\n`. PC와 MO 줄바꿈이 다르면 `{ "pc": "…", "mo": "…" }` — 글자가 같으면 `<br class="only-mo">` 로 합쳐져요.
- 버튼 `style` 은 Figma button `type` 값 그대로: `neutral`(진한 회색) / `subtle`(연한 회색).
- hero 버튼은 `{ label, href, color, radius }` — `color` 는 `tokens/hds.json` 색 키(`white`, `blue/700` …), `radius` 는 `xs`·`sm`·`md`·`lg`·`xl`·`full`.
- hero 타이틀·서브타이틀은 줄마다 글자 수 제한이 있어요 (띄어쓰기 포함, 예: 타이틀 2줄 · 줄마다 17자). 넘으면 `npm run validate` 가 알려줘요.
- hero 배경 `{ "pc": { "kind": "image" | "video", "src": "…" }, "mo": {…} }` — `mo` 를 빼면 PC 것을 써요.
- 이미지 `{ "src": "<page.json 기준 경로>", "alt": "" }` — 비우면 Figma 플레이스홀더.
- 카드형 섹션(persona, problem 5종, feature 4종)은 Figma 오토레이아웃처럼 동작해요 — PC·TB는 가로 한 줄 채우기(fill): 카드가 적으면 넓어지고(2장이면 반씩), 한 줄 최대 개수를 넘으면 좌우로 넘기고 하단 점이 생겨요. icon-grid 는 2열 그리드(grid). MO 는 Figma대로 세로 쌓기·고정 폭 스크롤(none). 섹션에 `"pager": { "pc": 4, "tb": 3, "mo": 0 }` 로 한 줄 최대(grid 는 열 수)를 바꿀 수 있고, 조합기에서 카드 수와 함께 미리 볼 수 있어요.

## 디자이너 규칙 (코드 변환 조건)
1. 섹션은 라이브러리의 **컴포넌트 인스턴스**로 넣어요. 분리(detach)하면 변환되지 않아요.
2. 페이지 프레임 바로 아래에 섹션 인스턴스를 위→아래 순서로 둬요. MO 프레임도 같은 순서로요.
3. 슬롯 레이어 이름(`eyebrow`, `title`, `description`, `cta`, `image`)은 바꾸지 않아요.
