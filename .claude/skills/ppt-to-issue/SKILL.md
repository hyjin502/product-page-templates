---
name: ppt-to-issue
description: 기획서 PPT(.pptx)를 읽어 페이지 템플릿(월간휴넷 · 월간X)의 칸에 맞춰 넣고, 사이트에 「작성 중」 회차(또는 공유 링크)를 만든다. "이 기획서로 회차 만들어줘", "PPT 넣어줘", .pptx 경로와 함께 템플릿 자동 입력 요청이 오면 사용.
---

# ppt-to-issue — 기획서 PPT → 사이트 회차

원칙: **읽기는 코드(결정적), 칸 맞추기는 Claude, 화면은 템플릿.** 기획서에 없는 문구는 지어내지 않는다(사이트 규칙 — 예외는 아래 「만들어 넣은 문구」로 꼭 표시).

기획서는 사내 문서다 → **PPT · 읽은 결과 · plan.json 은 저장소에 넣지 않는다.** 모두 스크래치 폴더에 둔다.

## 1. 읽기
```bash
node scripts/ppt-read.mjs "<파일.pptx>" --out <scratch>/read.json --media <scratch>/media
```
슬라이드마다 `section`(제목 「월간휴넷_5.아젠다」 → no · name) · `texts`(위→아래, 문단, 일부 굵게는 `**…**`, 문단 전체 굵게는 `bold: true`, 글자 크기) · `images` · `notes`(「Description」 표 = 디자이너 메모) · `dropped`(자리 표시 「이미지」 · 번호 동그라미 · 여러 슬라이드에 반복되는 짧은 글자)가 나온다. 그림은 `--media` 폴더에서 눈으로 확인한다(대부분 지난 페이지 캡처 = 참고용).

## 2. 칸 맞추기 → plan.json
`templates/<key>/template.json`(자리 순서 · pick · 자리 키) 과 각 섹션 `meta.json`(slots · maxLines · maxChars · list max) · `sample.json` 을 읽고 칸을 정한다.
- 슬라이드 이름 → 섹션: 상단=hero · 써머리=summary(또는 체크리스트) · 추천대상=check/persona · 아젠다=agenda · 이벤트=benefits · 다시보기=replay · 하단 플로팅=sticky-cta. 슬라이드 순서대로 믿지 말고 내용으로 판단한다(예: 체크리스트 결과 카드가 추천대상 슬라이드에 있었음).
- 글자 크기 · 굵기로 제목/설명을 가른다. `□` · `-` · `•` 줄은 목록 항목(기호는 뺀다). 문단 일부 굵게는 `**…**` 그대로(richtext 가 `<b>` 로).
- 한도를 넘으면 의미 단위로 줄을 나눈다(문구는 바꾸지 않음). 그래도 넘으면 줄이지 말고 표시.
- 연사 사진: `assets/profiles/profiles.json` 에 이름이 있으면 그 사진(`assets/profiles/pNN.jpg`)을 고른다.
- PPT 에 없는 섹션은 `off`, 없는 칸은 샘플 그대로 두고 flags 에 적는다. PPT 메모(notes)의 동작 요청(팝업 · 공유 버튼)도 flags 로.
- 실제로 쓸 PPT 그림만 `"src": "local:media/imageN.png"` (저장 때 issues 파일함에 올라간다).

형식은 `scripts/ppt-to-issue.mjs` 머리말. `sections` 는 샘플 위에 덮어쓰는 부분 값(목록은 통째로).

## 3. 검사 → 회차
```bash
node scripts/ppt-to-issue.mjs <scratch>/plan.json --dry     # 글자 수 · 줄 수 · 목록 개수 검사 + 바뀐 칸 요약
node scripts/ppt-to-issue.mjs <scratch>/plan.json           # Supabase issues 에 「작성 중」 회차 → #i-<id> 링크
node scripts/ppt-to-issue.mjs <scratch>/plan.json --share   # 저장소 없이 공유 링크(#share-…)만
```
저장소에 연결하지 못하면(프로젝트 일시 정지 등) 자동으로 공유 링크를 보여 준다. 회차는 공유 DB 라 다른 사람 목록에도 보인다 — 사용자가 회차 만들기를 요청했을 때만 저장한다.

## 4. 확인 · 보고
- 로컬 사이트(`npm run build` → `npm run serve`)에서 링크를 열어 미리보기를 확인한다(브라우저 패널).
- 보고: 섹션별로 넣은 것 · flags(애매했던 곳 · 비운 칸 · 만들어 넣은 문구 · 넣지 않은 그림 · PPT 메모) · 링크.
