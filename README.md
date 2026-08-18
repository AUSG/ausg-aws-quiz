# AUSG × AWSKRUG 퀴즈

대학생 행사 **부스용** 커뮤니티 퀴즈. AUSG와 AWSKRUG의 정체성·활동·참여 방법,
AUSGCON 2026을 다룬다. 기본은 한 명당 3문제이며 관리자가 3~5문제로 조정할 수 있다.
문제를 모두 푼 참가자는 점수와 관계없이 굿즈 룰렛을 한 번 돌린다.

2026년 8월 16일 [Codex Community Hackathon - Seoul for Students](https://codex-community-korea.skysplit.chatgpt.site/hackathon/seoul-2026)
부스에서 사용한다. 첫 화면과 힌트에는 이 퀴즈가 Codex로 만들어졌음을 표시한다.

**운영 주소:** https://ausg-aws-quiz.pages.dev

**경품 관리:** https://ausg-aws-quiz.pages.dev/admin (부스용 비밀번호 `2018`)

- 프런트엔드는 Cloudflare Pages, API는 Pages Functions, 재고와 당첨 기록은 D1을 쓴다.
- PWA가 정적 퀴즈 자산을 캐시한다. 네트워크가 끊겨도 문제 풀이는 가능하지만,
  **룰렛은 D1 연결이 필요하므로 온라인이어야 한다.**
- 이름·전화번호 같은 개인정보는 수집하지 않는다. D1에는 무작위 시도 ID, 점수,
  소요 시간, 당첨 상품, 당첨 시각만 기록한다.

## 설계 전제

부스는 공부 도구가 아니다. 모르는 사람이 지나가다 태블릿을 집어 들고 1분을 쓰고 떠난다.

- **제출 버튼이 없다.** 보기를 누르면 즉시 채점된다. 문항당 탭 3회 → 2회.
- **난이도 오름차순으로 출제된다.** 첫 문제에서 틀린 방문자는 태블릿을 내려놓기 때문이다.
- **첫 카테고리는 고정하지 않는다.** 6개 카테고리를 매번 섞고, 설정한 3~5개의
  서로 다른 카테고리에서 한 문제씩 뽑는다.
- **60초 무입력 시 자동으로 초기화된다.** 다음 방문자가 앞사람 점수를 보지 않도록.
- **룰렛 결과는 서버가 정한다.** 지급이 켜져 있고 재고가 있는 상품을 관리자가 정한
  상대 가중치로 뽑고, 브라우저의 룰렛은 서버 결과에 맞춰 멈춘다.
- **유한 재고는 D1 재고 슬롯으로 보호한다.** 텀블러·클리너·노트는 각 20개이며,
  전부 소진되면 사용 가능한 상품이 스티커 하나만 남아 항상 스티커가 당첨된다.
- **룰렛 그림과 당첨 후보는 분리한다.** 지급이 켜진 상품은 소진되어도 반복 조각으로
  계속 보이지만 서버 당첨 후보에서는 제외된다. 지급을 끈 상품은 룰렛에서도 숨긴다.
  참가자 API에는 재고 숫자·가중치·지급 상태를 보내지 않는다.
- **`/admin`에서 부스 설정을 바꾼다.** 경품 추가·수량·가중치·지급 여부와 퀴즈 문항
  수를 조정한다. 수량을 줄여도 이미 기록된 당첨은 삭제하지 않는다.

각 결정의 자세한 근거는 해당 소스 파일 주석에 있다.

## 현장 튜닝

URL 파라미터로 바꾼다. 재배포가 필요 없다.

| 파라미터 | 기본값 | 설명 |
|---|---|---|
| `?n=` | 관리자 설정(초기 3) | 문항 수 (3~5), 관리자 설정을 임시로 덮어씀 |
| `?prize=` | 현재 문항 수 | 높은 점수 결과 배너 기준 (룰렛 참여에는 영향 없음) |
| `?idle=` | 60 | 자동 초기화 초. `0`이면 끔 |
| `?hint=` | 700 | 힌트 공개 지연 밀리초(0~3000). `0`이면 즉시 |
| `?kiosk=` | 1 | `0`이면 키오스크 모드 해제 |

`?prize=2`로 바꾸면 2점 참가자에게도 높은 점수 축하 배너를 보여준다. 룰렛은 이 값과
관계없이 모든 참가자에게 열린다.

```
https://ausg-aws-quiz.pages.dev/?prize=2
https://ausg-aws-quiz.pages.dev/?idle=0     ← 시연 등 자동 초기화가 방해될 때
https://ausg-aws-quiz.pages.dev/?hint=0     ← 대기줄이 길어 0.7초도 아까울 때
```

## 개발

```bash
nvm use                  # Node 22
npm install
npm run dev              # 정적 UI만 빠르게 개발
npm run dev:pages        # 빌드 + 로컬 D1 + Pages Functions, localhost:5173
npm test                 # 프런트 테스트
npm run test:worker      # 실제 Workers 런타임의 D1/API 테스트
npm run build
```

푸시 전에 `npm run build`가 로컬에서 통과해야 한다. 여기서 깨지면 배포도 깨진다.

## 문제 추가하기

`src/data/questions.ts`에 추가한다. `src/data/validateBank.ts`가 길이 제한과
정답 위치 분포, 카테고리별 난이도 커버리지를 강제하고 `npm test`가 실제 문제 은행을 검증한다.

문제 은행은 총 38문항이다. `AUSG 기본`은 8문항이고, `AUSG 활동`, `AWSKRUG 기본`,
`AWSKRUG 활동`, `함께하기`, `AUSGCON 2026`은 각각 6문항이다. `AUSG 기본`에는
입문용 난이도 1 문항을 4개 두고, 나머지는 카테고리별·난이도별 2문항씩 둔다.

모든 문항의 `sourceUrl`에는 AUSG·AWSKRUG 공식 홈페이지, 공식 Meetup 또는
AUSGCON 공식 GitHub 저장소의 근거를 남긴다. `validateBank`는 출처가 없거나 HTTPS가
아닌 문항을 거부한다. AUSGCON 2026 블록은 행사 전용이므로 행사 종료 뒤 기본 출제에서 뺀다.

힌트는 **Codex 힌트** 버튼으로 열린다. 각 문항의 `hint` 필드에 미리 적어둔 문장이며
실행 중에 무언가를 생성하거나 호출하지 않는다. 그래서 네트워크가 끊겨도 퀴즈와 힌트는
작동한다. 단, 재고 정합성이 필요한 룰렛은 온라인에서만 동작한다.

길이 제한(문제 60자 / 보기 24자 / 해설 70자)은 콘텐츠 규칙이 아니라 **레이아웃 규칙**이다.
넘기면 폰에서 스크롤이 생기고, 부스에서 스크롤은 곧 이탈이다.

한글 폰트는 실제로 쓰는 글자만 남긴 서브셋이다. 새 글자가 들어가면
`fontCoverage` 테스트가 실패하며, `python3 scripts/build-fonts.py`로 재생성하면 된다.

## 룰렛 재고와 기록

초기 재고는 `migrations/0001_prize_inventory.sql`에서 만들고,
`migrations/0002_dynamic_prizes.sql`에서 운영 중 경품 추가와 수량 수정을 지원한다.
`migrations/0003_booth_settings_and_prize_distribution.sql`은 퀴즈 문항 수와 경품별
지급 여부·상대 가중치를 추가한다.

| 상품 | 초기 수량 | 소진 뒤 |
|---|---:|---|
| 스티커 | 무제한 | 계속 당첨 가능 |
| 텀블러 | 20 | 당첨 후보에서 제외, 룰렛 그림에는 유지 |
| 클리너 | 20 | 당첨 후보에서 제외, 룰렛 그림에는 유지 |
| 노트 | 20 | 당첨 후보에서 제외, 룰렛 그림에는 유지 |

같은 `attempt_id` 요청은 한 번만 기록된다. 응답이 끊겨 다시 눌러도 기존 당첨 결과를
돌려주므로 재고가 두 번 줄지 않는다. 유한 상품에는 1~20번 재고 슬롯이 있고,
DB 고유 제약이 같은 슬롯의 중복 당첨을 막아 마지막 한 개 아래로 내려가지 않는다.

`/admin`은 이벤트 부스용으로 클라이언트에 하드코딩된 비밀번호 `2018`을 확인한다.
같은 값의 API 헤더도 오입력 방지용으로 확인하지만, 공개 번들에서 볼 수 있으므로 강한
인증 수단은 아니다. 운영자는 퀴즈를 3~5문제로 바꾸고, 상품명·시작 수량·룰렛 색을
등록하며 유한 상품의 남은 수량을 0~999 사이에서 수정할 수 있다. 각 상품은 지급을
켜거나 끌 수 있고 1~100의 상대 가중치를 갖는다. 예를 들어 가중치가 1과 3인 두 상품만
지급 가능하면 실제 당첨 비율은 약 25%와 75%다. 룰렛 조각 수는 이 확률과 무관하다.

운영 중 현재 재고와 최근 당첨 기록은 다음처럼 읽는다.

```bash
npx wrangler d1 execute DB --remote --command \
  "SELECT code, enabled, weight, initial_quantity, remaining FROM prize_inventory_status ORDER BY code"
npx wrangler d1 execute DB --remote --command \
  "SELECT question_count, updated_at FROM booth_settings WHERE id = 1"
npx wrangler d1 execute DB --remote --command \
  "SELECT prize_code, quiz_score, quiz_total, elapsed_ms, created_at FROM prize_wins ORDER BY created_at DESC LIMIT 50"
```

## Cloudflare 배포

최초 한 번 D1을 만들고 마이그레이션한다.

```bash
npx wrangler login
npx wrangler d1 create ausg-quiz-prizes --location=apac --binding=DB --update-config
npm run db:migrate:remote
```

그 뒤 Pages 프로젝트에 배포한다. `functions/api/*`도 함께 업로드된다.

```bash
npm run deploy:pages
```

## 라이선스

[MIT](./LICENSE)
