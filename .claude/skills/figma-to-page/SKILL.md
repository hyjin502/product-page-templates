---
name: figma-to-page
description: 디자이너가 Figma에서 섹션 템플릿 인스턴스로 조합한 상품페이지 프레임을 page.json 으로 추출하고 HTML로 빌드한다. "이 피그마 페이지 코드로 만들어줘", "상품페이지 HTML 뽑아줘", figma.com 페이지 프레임 URL과 함께 페이지/HTML 생성 요청이 오면 사용.
---

# figma-to-page — Figma 조합 페이지 → page.json → HTML

**원칙: 이 스킬은 HTML도, 내용도 직접 쓰지 않는다.** 매핑과 추출은 `scripts/figma-extract.mjs` 가 만든 플러그인 코드가 하고, 렌더링은 `npm run build` 가 `sections/` 템플릿으로 한다. 에이전트는 코드를 실행하고 결과 JSON을 파일로 옮기기만 한다. 그래서 같은 Figma 입력이면 항상 같은 HTML이 나온다.

## 입력
- PC 페이지 프레임 URL (필수). 예: `https://www.figma.com/design/<fileKey>/…?node-id=123-456` → 노드 `123:456`
- MO 페이지 프레임 URL (선택). 없으면 PC 텍스트만 쓴다.
- 페이지 이름 (영문 kebab-case, 예: `coffee-purifier`). 없으면 프레임 이름으로 제안하고 확인받는다.

## 준비
- `figma:figma-use` 스킬을 로드한다 (use_figma 전 필수).
- ToolSearch `select:mcp__figma__use_figma,mcp__figma__get_screenshot`
- 모든 use_figma 호출은 **읽기 전용**이다. Figma 파일을 수정하지 않는다.

## 절차 (`<name>` = 페이지 이름)

1. **스캔 코드 생성 → 실행**
   ```bash
   node scripts/figma-extract.mjs scan <pcNode> [moNode]
   ```
   출력된 코드를 그대로 `use_figma` 로 실행한다. 반환 JSON을 **그대로** `pages/<name>.scan.json` 에 저장한다.

2. **매핑 + 추출 코드 생성**
   ```bash
   node scripts/figma-extract.mjs extract pages/<name>.scan.json
   ```
   - 인스턴스마다 `메인 컴포넌트 노드 → meta.json 의 figma/options 노드` 로 variant·옵션을 정한다. 라이브러리 게시본처럼 노드가 다르면 `세트 이름 + layout/style/mode 속성`으로 정한다.
   - 매핑 실패(분리된 인스턴스, 코드가 없는 섹션)가 있으면 목록이 출력되고 종료 코드 2로 끝난다. **추측해서 고치지 말고** 사용자에게 보고한다. 나머지 섹션만 진행할지 묻는다.
   - 결과: `dist/extract/<name>.js`. 50,000자를 넘는다고 나오면 scan.json 을 PC용·MO용으로 나눠 두 번 실행한다.

3. **추출 실행**: `dist/extract/<name>.js` 를 읽어 그대로 `use_figma` 로 실행한다. 반환 JSON 배열을 **그대로** `pages/<name>.raw.json` 에 저장한다.

4. **page.json 확정**
   ```bash
   node scripts/figma-extract.mjs finalize pages/<name>.raw.json
   ```
   - PC·MO 텍스트를 합친다 (같으면 문자열, 줄바꿈이 다르면 `{ "pc", "mo" }`).
   - Figma 에 없는 값(`href`, `alt`, form `action`, countdown `deadline` 등)과 **덮어쓰지 않은 이미지**는 그 variant 의 `sample.json` 값으로 채운다.
   - 디자이너가 바꾼 이미지는 `pages/<name>.images.json` 에 목록으로 나온다 → 각 항목마다 `get_screenshot(nodeId, maxDimension = max(w,h)×2)` 의 URL을 `curl -L -o <file>` 로 받는다.
   - `!` 로 시작하는 경고(PC/MO 순서 불일치, 항목 수 차이)는 보고에 그대로 옮긴다.

5. **검증 · 빌드**
   ```bash
   node scripts/validate.mjs pages/<name>.page.json
   npm run build        # → dist/pages/<name>/index.html (+ assets/)
   ```

6. **확인**: `get_screenshot`(PC 프레임, MO 프레임)과 `dist/pages/<name>/index.html` 을 1920 / 375 폭으로 캡처한 것을 나란히 비교한다. 375 캡처는 헤드리스 창 최소 폭 때문에 375px iframe 하네스를 쓴다(`scripts/preview.mjs` 가 만드는 `.mo.html` 과 같은 방식).

7. **보고**
   - 만든 파일: `pages/<name>.page.json`, `dist/pages/<name>/index.html`
   - 섹션 순서 → variant(+옵션) 목록
   - 매핑 실패 섹션 (Figma 노드 ID 포함). 이 섹션은 HTML에 **빠져 있다**고 분명히 적는다
   - 채워야 할 값: 링크(`href` 가 `#` 인 곳), 이미지 `alt`
   - finalize 경고

## 하지 말 것
- 추출 JSON을 손으로 고치거나 문구를 다듬지 않는다. 바꿔야 하면 Figma에서 고치고 다시 추출한다.
- 레지스트리에 없는 섹션의 HTML을 즉석에서 만들지 않는다. `add-section-variant` 스킬로 먼저 등록하자고 제안한다.
- `sections/` 템플릿·CSS를 이 스킬에서 수정하지 않는다.

## 테스트 모드
조합 프레임 없이 Page 18 컴포넌트 자체를 페이지로 보고 추출할 수 있다 (원문 그대로 → sample 렌더와 같은 HTML이 나와야 정상).
```bash
node scripts/figma-extract.mjs scan-components all          # 레지스트리의 모든 variant 기본 노드
node scripts/figma-extract.mjs scan-components pc=6187:2503 mo=6187:2521
```
이후 2~5단계는 같다. 결과 JSON을 옮기지 않고 확인만 할 때는 검증 모드를 쓴다:
```bash
node scripts/figma-extract.mjs scan-components all --write pages/_verify/all.scan.json
node scripts/figma-extract.mjs extract pages/_verify/all.scan.json --verify --chunks 2   # 슬롯별 해시만 넣은 코드
# 각 조각을 use_figma 로 실행 → pages/_verify/all.verify.<k>.json
node scripts/figma-extract.mjs report pages/_verify/all.verify.*.json
```
`--only a,b` 로 일부 variant 만 다시 검증할 수 있다. 보고서의 `△` 는 정상(예상된 차이), `✗` 는 매핑 수정이 필요한 곳이다.
