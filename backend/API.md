# TrendPick 백엔드 API 스펙

**Base URL**

| 환경 | 주소 |
|---|---|
| 배포 | `https://zuki-l2hu.onrender.com` |
| 로컬 | `http://localhost:4000` |

프론트엔드는 `NEXT_PUBLIC_API_URL` 환경변수에 위 배포 주소를 넣으면 됩니다.

> 무료 플랜이라 15분간 요청이 없으면 인스턴스가 잠듭니다. 이때 첫 요청은 응답까지 50초 이상 걸릴 수 있고, 그 뒤로는 정상 속도입니다. 서비스가 죽은 게 아니라 깨어나는 중이니 타임아웃을 넉넉히 잡아주세요.

응답은 전부 JSON. 에러는 `{ "error": "메시지" }` 형태로 옵니다.

> **데모 페이지**: [`https://zuki-l2hu.onrender.com/demo.html`](https://zuki-l2hu.onrender.com/demo.html) (로컬은 `http://localhost:4000/demo.html`)
> 아래 API를 전부 브라우저에서 직접 호출해볼 수 있습니다.
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
| `search_index` | 네이버 검색어트렌드 지수 (0~100 상대지수, 최근 7일 평균) |
| `youtube_video_count` | 키워드 검색 결과 영상 수. YouTube의 추정치라 정밀하지 않음 |
| `youtube_view_count` | 조회수 상위 영상 10개의 조회수 합 |
| `score_history` | 최근 14일 스코어 추이 (오래된 날짜 → 최신 순). 데이터 없으면 `[]` |

> **증감률이 `null`인 경우**: 키워드가 연결되지 않았거나, 네이버 시계열이 14일치가 안 되는 경우입니다.
> 네이버가 3개월 시계열을 통째로 주기 때문에 **증감률은 첫 수집부터 나옵니다** — 이틀 기다릴 필요 없습니다.
> 다만 유튜브는 스냅샷만 주므로 `mention_growth_rate`는 수집 2일차부터 생깁니다.
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
  ],
  "searchIndexHistory": [
    { "recorded_date": "2026-07-27", "search_index": "90.39" },
    { "recorded_date": "2026-07-28", "search_index": "88.10" }
  ]
}
```

> **"검색량 추이" 그래프는 `searchIndexHistory`를 쓰세요.**
> `scoreHistory`는 랭킹 점수 이력이라 "네이버 데이터랩 기준 상대 검색지수(0~100)"라는 화면 라벨과 맞지 않습니다.

없는 id면 `404 { "error": "해당 트렌드를 찾을 수 없습니다." }`

---

## score와 status의 의미

**`status` (확산 단계)** — 수준(검색지수)과 모멘텀(증감률) 2차원으로 분류합니다.

| | 감소 (−15%↓) | 정체 | 증가 (+15%↑) |
|---|---|---|---|
| 지수 60 이상 | `declining` | `peak` | `peak` |
| 지수 30~60 | `declining` | `rising` | `rising` |
| 지수 30 미만 | `emerging` | `emerging` | `emerging` |

증감률만으로 판정하면 밑바닥에서 시작한 무명 키워드(+100%)가 전성기로, 이미 큰 트렌드(+12%)가 태동기로 뒤집힙니다. 그래서 두 축을 함께 봅니다.

**`score` (랭킹 점수, 0~100)** — "지금 주목할 가치"

```
검색지수 × 0.6  +  증감률(−100~100을 0~100으로 변환) × 0.4
```

증감률에 상한을 두는 이유는 지수 1→3으로 오른 무명 키워드가 200% 증가로 1위를 먹는 걸 막기 위해서입니다.

> `score`는 **증감률이 아닙니다.** 화면에 "검색량 +N%"로 표시하려면 `search_growth_rate`를, "언급량"은 `mention_growth_rate`를 쓰세요.

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

등록된 키워드 전체 목록 (최대 500개). `?candidate=true`면 아직 카드로 승격 안 된 후보만.

응답에 `source`(`editor`|`youtube`|`seed`)와 `last_collected_at`이 포함됩니다.

### POST /api/admin/keywords/discover

후보 키워드를 발굴해 등록합니다. 두 소스 모두 **지금 실제로 올라오고 있는 콘텐츠**에서 가져옵니다.

```json
{ "youtube": true, "naver": true }
```

| 소스 | 내용 | 비용 |
|---|---|---|
| `youtube` | 인기 급상승 영상 제목 (`chart=mostPopular`) | 4 unit |
| `naver` | 블로그·카페글 최신 포스트 제목 (`카페 신메뉴` 등 5개 쿼리 × 2개 코퍼스) | 검색 API 10회 (하루 25,000회 한도) |

응답:
```json
{
  "discovered": 87, "inserted": 74, "skipped": 13,
  "errors": [],
  "sources": {
    "youtube": { "titlesScanned": 150, "extracted": 12,
                 "attempts": [{ "target": "youtube:all", "ok": true, "count": 50 }] },
    "naver":   { "titlesScanned": 1000, "extracted": 75, "attempts": [...] }
  }
}
```

`sources.*.attempts`에 소스별 성공/실패가 전부 담깁니다. 실패해도 다른 소스는 계속 진행하되, 실패 사유는 `errors`에 남으니 확인하세요.

이미 등록된 키워드는 건드리지 않습니다(에디터가 카드에 연결해둔 키워드를 덮어쓰지 않기 위해).
여기서는 후보를 쌓기만 하고, 검색량은 다음 수집 배치가 채웁니다.

> **왜 키워드를 직접 생성하지 않나**
> 초기엔 `재료 × 형태`(흑임자 + 라떼) 조합을 자동 생성했지만 폐기했습니다. 우리가 만들어낸 말은 대부분 아무도 검색하지 않고, 진짜 유행어(두바이초콜릿 같은)는 조합으로 예측할 수 없기 때문입니다.
>
> 네이버가 급상승 키워드 목록 API를 제공하면 좋겠지만, 실시간 검색어는 2021년 폐지됐고 데이터랩 API는 "내가 준 키워드가 얼마나 뜨나"만 답합니다. 그래서 실제 콘텐츠를 읽는 방식을 택했습니다.

### GET /api/admin/keywords/rising

급상승 중인 후보 키워드 — "무엇을 트렌드 카드로 만들지" 고르는 용도.

쿼리: `limit`(기본 30, 최대 200), `minIndex`(기본 1), `includeLinked`(기본 false)

```json
{
  "keywords": [
    { "id": 42, "keyword": "흑임자라떼", "source": "youtube", "trend_id": null,
      "search_index": "34.20", "collected_date": "2026-07-28", "growth_rate": 68.4 }
  ]
}
```

`growth_rate`가 `null`이면 비교할 과거 데이터가 없다는 뜻(수집 2일차부터 값 생성).
검색량이 미미한 조합 생성물은 `minIndex`로 걸러집니다.

### POST /api/admin/collect

네이버/유튜브 수집 배치를 즉시 실행. body 없음.

`COLLECT_SECRET` 환경변수가 설정돼 있으면 `x-collect-secret` 헤더가 일치해야 합니다(불일치 시 `401`).
비어 있으면 인증 없이 호출 가능합니다. 배포 환경에서는 외부 스케줄러가 이 API를 매일 호출해 자동 수집을 수행합니다.

```json
{
  "summary": {
    "startedAt": "...", "finishedAt": "...",
    "naverProcessed": 312,
    "youtubeProcessed": 21,
    "trendsUpdated": 21,
    "failed": 0,
    "errors": []
  }
}
```

수집은 2단계로 나뉩니다 — 유튜브 할당량이 훨씬 빡빡하기 때문입니다.

| 단계 | 대상 | API | 상한 |
|---|---|---|---|
| 넓게 | 후보 포함 전체 키워드 | 네이버만 (5개씩 묶음) | `NAVER_KEYWORD_LIMIT` (기본 500) |
| 깊게 | 트렌드 카드에 연결된 키워드 | 네이버 + 유튜브 | `YOUTUBE_KEYWORD_LIMIT` (기본 80) |

---

## 참고

- 프론트에서 fetch할 땐 `Content-Type: application/json` 헤더 필수 (POST/PUT/PATCH 시)
- CORS는 전체 허용 상태라 로컬 개발(다른 포트)에서 바로 호출 가능
- 지금 DB에 더미 트렌드 21개 들어가 있음 (디저트 11 / 음료 6 / 마케팅 4), 다 발행된 상태라 `GET /api/trends` 바로 호출하면 나옴
