# TrendPick 백엔드 API 스펙

로컬 개발 기준 base URL: `http://localhost:4000`
(배포되면 이 문서 상단에 배포 URL 추가 예정)

응답은 전부 JSON. 에러는 `{ "error": "메시지" }` 형태로 옵니다.

> **데모 페이지**: 서버 실행 후 `http://localhost:4000/demo.html` 에 접속하면 아래 API를 전부 브라우저에서 직접 호출해볼 수 있습니다.
> (`backend/public/demo.html` — 백엔드 단독 시연·수동 테스트용. curl/Postman 대신 사용하면 편합니다.)

---

## 공통

### GET /health

서버 살아있는지 확인용. DB 연결 없이도 항상 200.

```json
{ "status": "ok", "service": "trendpick-backend", "time": "2026-07-27T..." }
```

---

## 카테고리

### GET /api/categories

디저트/음료/마케팅 목록.

```json
{
  "categories": [
    { "id": 1, "name": "디저트", "slug": "dessert", "sort_order": 1 },
    { "id": 2, "name": "음료", "slug": "beverage", "sort_order": 2 },
    { "id": 3, "name": "마케팅", "slug": "marketing", "sort_order": 3 }
  ]
}
```

---

## 트렌드

### GET /api/trends

홈 브리핑 / 카테고리 탐색용 목록. 발행된(`is_published=true`) 트렌드만 나옵니다.

쿼리 파라미터 (전부 선택):
- `category` — 카테고리 slug (`dessert` | `beverage` | `marketing`)
- `status` — `emerging` | `rising` | `peak` | `declining`
- `limit` — 기본 20, 최대 100
- `sort` — `latest`(기본, 최신순) | `score`(점수 높은 순). **랭킹 화면은 `sort=score`를 쓰면 됩니다.**
  전체를 받아서 프론트에서 정렬할 필요가 없어집니다.

예: `GET /api/trends?category=dessert&status=peak&limit=10&sort=score`

```json
{
  "trends": [
    {
      "id": 13,
      "title": "두바이초콜릿",
      "summary": "피스타치오 크림 가득한 두바이초콜릿...",
      "status": "peak",
      "score": "88.00",
      "image_url": null,
      "region_scope": "nationwide",
      "created_at": "2026-07-27T...",
      "category_name": "디저트",
      "category_slug": "dessert",

      "search_growth_rate": 24.5,
      "mention_growth_rate": 12.1,
      "search_index": "90.39",
      "youtube_video_count": "956205.00",
      "youtube_view_count": "11680.00",
      "score_history": [
        { "score": 62, "status": "rising", "recorded_date": "2026-07-21" },
        { "score": 88, "status": "peak",   "recorded_date": "2026-07-27" }
      ]
    }
  ]
}
```

**수집 지표 필드 설명** (아래 5개는 2026-07-28 추가, 기존 필드는 그대로라 하위 호환됩니다)

| 필드 | 의미 |
|---|---|
| `search_growth_rate` | 네이버 검색지수 증감률(%). 최근 7일 내 가장 오래된 값 대비 |
| `mention_growth_rate` | 유튜브 영상 수 증감률(%). 계산 방식 동일 |
| `search_index` | 네이버 검색어트렌드 지수 최신값 (0~100 상대지수) |
| `youtube_video_count` | 키워드 검색 결과 영상 수 |
| `youtube_view_count` | 최근 영상 10개의 조회수 합 |
| `score_history` | 최근 14일 스코어 추이 (오래된 날짜 → 최신 순). 데이터 없으면 `[]` |

> **증감률이 `null`인 경우**: 비교할 과거 데이터가 아직 없다는 뜻입니다. 수집 배치가 최소 2일 이상 돌아야 값이 생깁니다. 키워드가 연결되지 않은 트렌드도 전부 `null`입니다.
>
> `score_history`가 목록에도 들어가므로, 카드에 미니 그래프를 그릴 때 상세 API를 따로 부르지 않아도 됩니다.

### GET /api/trends/:id

트렌드 상세 + 스코어 추이(그래프용).

```json
{
  "trend": {
    "id": 13,
    "title": "두바이초콜릿",
    "summary": "...",
    "reason": "작년 말 UAE발 틱톡 챌린지로 시작해...",
    "status": "peak",
    "score": "88.00",
    "image_url": null,
    "region_scope": "nationwide",
    "created_at": "2026-07-27T...",
    "category_name": "디저트",
    "category_slug": "dessert"
  },
  "scoreHistory": [
    { "score": "62.00", "status": "rising", "recorded_date": "2026-07-21" },
    { "score": "88.00", "status": "peak", "recorded_date": "2026-07-27" }
  ]
}
```

없는 id면 `404 { "error": "해당 트렌드를 찾을 수 없습니다." }`

---

## 사용자 (즐겨찾기 / 관심 카테고리)

> 인증이 아직 없어서 임시로 **모든 요청에 `x-user-id` 헤더**가 필요합니다.
> 값은 아무 UUID나 써도 되지만, 같은 사용자면 항상 같은 값을 보내야 그 사람 데이터로 취급됩니다.
> 나중에 Supabase Auth 붙으면 이 헤더는 없어지고 로그인 토큰 기반으로 바뀔 예정.

### GET /api/users/me/bookmarks

즐겨찾기 목록.

```json
{ "bookmarks": [ { "id": 13, "title": "두바이초콜릿", "summary": "...", "status": "peak", "image_url": null, "bookmarked_at": "..." } ] }
```

### POST /api/users/me/bookmarks/:trendId

즐겨찾기 추가. body 없음. `201 { "ok": true }`

### DELETE /api/users/me/bookmarks/:trendId

즐겨찾기 해제. `204` (본문 없음)

### PUT /api/users/me/category-interests

관심 카테고리 설정 (기존 설정 덮어씀).

요청 body:
```json
{ "categoryIds": [1, 3] }
```

응답: `{ "ok": true, "categoryIds": [1, 3] }`

---

## 관리자 (에디터용, 별도 관리자 화면 나오기 전까지 이 API로 직접 등록)

### POST /api/admin/trends

트렌드 카드 생성. 생성 직후엔 `is_published=false`(초안) 상태.

요청 body:
```json
{
  "title": "크로플",
  "categoryId": 1,
  "summary": "선택",
  "reason": "선택",
  "imageUrl": "선택",
  "regionScope": "선택, 기본값 nationwide",
  "createdBy": "선택, 에디터 user id"
}
```

`title`, `categoryId`는 필수. 없으면 `400`.

### PATCH /api/admin/trends/:id/publish

초안 → 발행 전환. 이거 해야 `GET /api/trends`에 나타남.

### POST /api/admin/keywords

키워드 등록/트렌드에 연결 (네이버·유튜브 수집 대상).

```json
{ "keyword": "크로플", "trendId": 12 }
```

`trendId`는 선택 — 없이 등록하면 아직 카드로 안 만들어진 "후보 키워드".

### GET /api/admin/keywords

등록된 키워드 전체 목록.

### POST /api/admin/collect

네이버/유튜브 수집 배치를 즉시 실행. body 없음.

`COLLECT_SECRET` 환경변수가 설정돼 있으면 `x-collect-secret` 헤더가 일치해야 합니다(불일치 시 `401`).
비어 있으면 인증 없이 호출 가능합니다. 배포 환경에서는 외부 스케줄러가 이 API를 매일 호출해 자동 수집을 수행합니다.

```json
{
  "summary": {
    "startedAt": "...", "finishedAt": "...",
    "totalKeywords": 3, "processed": 3, "failed": 0, "errors": []
  }
}
```

---

## 참고

- 프론트에서 fetch할 땐 `Content-Type: application/json` 헤더 필수 (POST/PUT/PATCH 시)
- CORS는 전체 허용 상태라 로컬 개발(다른 포트)에서 바로 호출 가능
- 지금 DB에 더미 트렌드 21개 들어가 있음 (디저트 11 / 음료 6 / 마케팅 4), 다 발행된 상태라 `GET /api/trends` 바로 호출하면 나옴
