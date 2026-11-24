# plan-fill — 기획서(PPT · Figma) → 페이지 템플릿 칸 채우기

사이트 페이지 템플릿 편집기 「+ 새 회차 → 시작 내용: 기획서에서 (PPT · Figma)」가 부르는 Supabase 서버 함수예요.
PPT 는 브라우저가 읽어서 글자 · 그림 목록을 보내고, Figma 링크는 이 함수가 Figma API 로 읽어요. 칸 나누기는 Claude(claude-opus-5-5)가 해요.

## 처음 한 번 — 올리기 (Supabase 대시보드)

1. 프로젝트 `product-page-templates-kr` → **Edge Functions → Deploy a new function → Via Editor**
2. 함수 이름 `plan-fill`, 코드 칸에 이 폴더의 `index.ts` 전체를 붙여 넣고 Deploy
3. 함수 설정(⚙️ Details)에서 **Enforce JWT verification 끄기** — 사이트는 공개 키(publishable)만 보내요
4. **Edge Functions → Secrets** 에 추가
   | 이름 | 값 |
   |---|---|
   | `ANTHROPIC_API_KEY` | Anthropic Console 에서 만든 API 키 |
   | `FIGMA_TOKEN` | Figma → Settings → Security → Personal access tokens (File content: Read) — 이 토큰 계정이 볼 수 있는 기획서 파일만 읽혀요 |
   | `ALLOWED_ORIGINS` (선택) | 부를 수 있는 사이트 주소, 쉼표로. 비우면 `https://hyjin502.github.io`, `http://localhost:4173` |

키 · 토큰은 저장소 · 사이트 코드에 넣지 않아요(공개 저장소). 이 함수의 Secrets 에만 둬요.

CLI 를 쓰면: `supabase functions deploy plan-fill --no-verify-jwt` · `supabase secrets set ANTHROPIC_API_KEY=… FIGMA_TOKEN=…`

## 쓰기

편집기 처음 화면 「+ 새 회차」 → 시작 내용 「기획서에서 (PPT · Figma)」 → PPT 를 고르거나 Figma 기획서 프레임 링크(node-id 포함)를 넣고 「만들기」.
1~3분 뒤 새 회차가 열리고, 회차 칸 위에 「확인할 것」(애매했던 곳 · 비운 칸 · 넣지 못한 그림 · 기획서 메모)이 보여요. 이 목록은 회차 info.flags 에 남아요.

## 알아 둘 것

- 비용: 한 번에 Claude 요청 1회(입력 = 템플릿 칸 정보 약 3만 자 + 기획서 글자). 같은 템플릿을 연달아 넣으면 칸 정보는 캐시돼요.
- 시간 제한: Supabase 함수는 요청 하나에 150초(무료) · 400초(유료)까지예요. 기획서가 아주 길어 시간이 넘으면 나눠 넣거나, `index.ts` 의 `MODEL` 을 `claude-sonnet-5-5` 로 바꾸면 빨라져요.
- 보안: 사이트 주소(Origin)로만 받지만, 주소를 흉내 내면 누구나 부를 수 있어요 — 테스트 단계 한계. 운영 전에는 회사 로그인(Supabase Auth)을 붙이고 함수에서 사용자 토큰을 확인하세요.
- Figma 그림은 아직 옮기지 않아요(「확인할 것」에 적혀요). PPT 그림은 AI 가 골라 쓰면 issues 파일함에 올라가요.
