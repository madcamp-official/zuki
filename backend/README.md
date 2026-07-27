# trendpick-backend

TrendPick(트렌드픽) Node.js + TypeScript + Express 백엔드.

## 시작하기

```bash
cd backend
npm install
cp ../.env.example .env   # 값 채워넣기 (아래 참고)
npm run dev                # http://localhost:4000
```

`.env` 최소 설정:

- `DATABASE_URL` — Supabase 프로젝트의 PostgreSQL 연결 문자열. 아직 Supabase 프로젝트가 없다면 이 값이 없어도 서버는 뜨고 `/health`는 응답하지만, DB를 쓰는 API(`/api/trends` 등)는 500 에러가 남.
- `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET`, `YOUTUBE_API_KEY` — 없어도 서버 구동엔 문제없음. `services/naverDataLab.ts`, `services/youtubeApi.ts`, `jobs/dailyCollect.ts`를 실제로 돌릴 때만 필요 (Day2~3 작업).

## DB 초기화

Supabase(또는 로컬 Postgres)에 `src/db/schema.sql`을 그대로 실행하면 테이블 + 카테고리 시드(디저트/음료/마케팅)까지 들어감.

```bash
psql "$DATABASE_URL" -f src/db/schema.sql
```

## 현재 구현된 것 / 안 된 것

**구현됨**

- `GET /health` — 헬스체크
- `GET /api/categories` — 카테고리 목록
- `GET /api/trends`, `GET /api/trends/:id` — 트렌드 브리핑/상세 (기획서 4-1, 4-2, 13)
- `GET/POST/DELETE /api/users/me/bookmarks`, `PUT /api/users/me/category-interests` — 즐겨찾기, 관심 카테고리 (기획서 4-4, 13)
  - 인증은 아직 미정이라 임시로 `x-user-id` 헤더로 유저를 식별함. Supabase Auth 붙이면 `usersController.ts`의 `requireUserId()`만 교체하면 됨
- `POST /api/admin/trends`, `PATCH /api/admin/trends/:id/publish` — 에디터 수동 큐레이션 입력 (기획서 11-4 ③). 별도 관리자 화면 대신 이 API를 직접 호출해도 MVP는 커버됨
- 스코어링 공식 (`services/scoring.ts`) — 기획서 11-5 그대로, 가중치는 `.env`에서 조정 가능. 데이터 없는 항목은 자동으로 가중치 재분배(사실상 에디터 점수로 폴백)

**아직 안 됨 (다음 작업)**

- `services/naverDataLab.ts`, `services/youtubeApi.ts` — 함수 골격과 API 스펙(엔드포인트/헤더/할당량)은 다 채워져 있지만, 실제 키 발급 후 응답 형식 확인 및 테스트 필요
- `jobs/dailyCollect.ts` — keyword_metrics 적재, trend_score_history 갱신, collection_batches 로깅 로직 (TODO 주석 표시해둠)
- Supabase Auth 연동 (지금은 `x-user-id` 헤더 임시 인증)
- `collection_batches`를 이용한 배치 실행 로그/유튜브 unit 사용량 추적

## 검증 상태

TypeScript 컴파일, 서버 부팅, 라우트별 응답(정상/에러 케이스 포함)까지 로컬에서 직접 실행해서 확인함. DB가 연결된 상태에서의 실제 CRUD 동작은 Supabase 프로젝트 연결 후 추가 확인 필요.
