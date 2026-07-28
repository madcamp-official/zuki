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

자동 생성 카드는 `is_auto: true`와 함께 **`evidence`** 를 돌려줍니다 — 문구의 근거가 된 실제 게시물입니다.

```json
"evidence": [
  { "title": "편의점 3사, 이달 신제품으로...", "excerpt": "...",
    "link": "https://...", "date": "2026-07-25", "corpus": "news" }
]
```

상세 화면에 "관련 기사" 같은 섹션으로 링크를 걸어주면, 사장님이 원문을 직접 확인할 수 있습니다.

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

## 인증 (Supabase Auth)

`/api/users/*` 는 전부 로그인이 필요합니다. **`x-user-id` 임시 인증은 제거됐습니다.**

```
Authorization: Bearer <Supabase access token>
```

### 프론트엔드 연동

```bash
npm install @supabase/supabase-js
```

```ts
// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
```

```ts
// 회원가입
const { data, error } = await supabase.auth.signUp({ email, password });

// 로그인
const { data, error } = await supabase.auth.signInWithPassword({ email, password });

// 로그아웃
await supabase.auth.signOut();

// 현재 세션 (토큰은 supabase-js가 localStorage에 보관하고 자동 갱신함)
const { data: { session } } = await supabase.auth.getSession();
```

```ts
// API 호출 시 토큰 첨부 — lib/api.ts의 apiFetch에 추가
const { data: { session } } = await supabase.auth.getSession();

const res = await fetch(`${API_URL}${path}`, {
  headers: {
    "Content-Type": "application/json",
    ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
  },
});
```

`.env.local`에 넣을 값:

```
NEXT_PUBLIC_SUPABASE_URL=https://bnghhjikybnoztaxjuey.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

anon key는 `GET /api/config`로도 받을 수 있습니다(둘 다 공개용 키라 노출돼도 안전).

> **가입 직후 토큰이 안 나온다면** Supabase 대시보드 → Authentication → Providers → Email에서 "Confirm email"이 켜져 있는 것입니다. 개발 중에는 꺼두면 가입 즉시 로그인됩니다.

### 사용자 프로필

`public.users`는 서비스 프로필(매장명·지역·권한)만 담고, 계정 자체는 `auth.users`가 관리합니다. 두 테이블은 같은 `id`를 공유하며 FK로 묶여 있고, **프로필 행은 인증된 첫 요청 때 백엔드가 자동으로 만듭니다.** 별도 회원가입 API를 부를 필요가 없습니다.

### GET /api/users/me

```json
{
  "user": { "id": "...", "email": "...", "store_name": null,
            "region_si": null, "region_gu": null, "role": "owner", "created_at": "..." },
  "categoryInterests": [{ "id": 1, "name": "디저트", "slug": "dessert" }]
}
```

`role`은 `owner`(기본) | `editor` | `admin`.

### PATCH /api/users/me

```json
{ "storeName": "규민카페", "regionSi": "대전광역시", "regionGu": "유성구" }
```

셋 다 선택이며 보낸 항목만 수정됩니다. `role`은 여기서 바꿀 수 없습니다(권한 상승 방지).

---

## 사용자 (즐겨찾기 / 관심 카테고리)

아래 엔드포인트도 전부 `Authorization: Bearer` 헤더가 필요합니다.

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

## 관리자 (에디터용)

> **`/api/admin/*` 는 관리자 로그인이 필요합니다.**
> `Authorization: Bearer <access token>` 헤더가 있어야 하고, 해당 계정의 `role`이 `editor` 또는 `admin`이어야 합니다.
> 권한이 없으면 `403 { "error": "관리자 권한이 필요합니다." }`.
>
> **왜 막았나** — 이 API들은 실제 비용과 할당량을 소모합니다. `POST /trends`는 `imageUrl`을 안 넘기면 OpenAI로 이미지를 생성하고(호출당 과금), `/keywords/discover`와 `/collect`는 외부 API를 대량 호출합니다. 배포된 서버는 URL만 알면 누구나 접근할 수 있어 열어둘 수 없습니다.
>
> **예외** — `POST /collect`는 외부 스케줄러(cron-job.org)가 호출해야 해서 로그인 대신 `x-collect-secret` 헤더로 보호합니다.
>
> **로컬 개발** — `ADMIN_AUTH_DISABLED=true`로 두면 인증을 건너뜁니다. 배포 환경에서는 절대 켜지 마세요.

### 관리자 권한 부여

권한 부여를 API로 열면 "그 API는 누가 부를 수 있나"라는 순환 문제가 생기므로, DB에 직접 접근할 수 있는 사람이 스크립트로 부여합니다. 대상 계정은 **먼저 회원가입이 되어 있어야 합니다.**

```bash
cd backend
npm run grant:admin -- gyumin3789@gmail.com          # admin 부여
npm run grant:admin -- someone@example.com editor    # editor 부여
```

역할은 `owner`(기본, 사장님) | `editor`(트렌드 큐레이션) | `admin`.
이미 로그인 중이었다면 로그아웃 후 재로그인해야 새 권한이 토큰에 반영됩니다.

---


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

### POST /api/admin/trends/auto-refresh

급상승 후보 중 신호가 강한 것들을 **트렌드 카드로 자동 생성**하고, 순위에서 밀린 자동 카드는 내립니다. 항상 최신 상위 N개가 노출됩니다.

```json
{ "topN": 10, "minSignal": 40, "withImage": true }
```

| 항목 | 기본값 | 설명 |
|---|---|---|
| `topN` | 10 (최대 30) | 유지할 자동 카드 수 |
| `minSignal` | 40 | 이 점수 미만은 카드로 만들지 않음 (노이즈 배제) |
| `withImage` | true | OpenAI 이미지 생성. 카드당 과금되므로 끌 수 있음 |

```json
{
  "summary": {
    "considered": 10, "created": 6, "refreshed": 3, "retired": 2,
    "trends": [
      { "id": 41, "keyword": "씬쿠키", "signal": 68.3, "generated": true, "evidenceCount": 8 }
    ],
    "errors": []
  }
}
```

**문구는 지어내지 않습니다.**

각 키워드로 네이버 **뉴스·블로그를 검색해 실제 게시물을 읽고**, 그 안에 있는 내용과 우리가 측정한 수치만으로 요약을 씁니다.

```
X "최근 일본 디저트 유행과 맞물려"        <- 아무 자료에도 없는 창작
O "편의점 3사가 이달 신제품으로 출시했고"  <- 뉴스 기사에 실제로 있는 내용
O "최근 7일 블로그 게시량이 2배 늘었습니다" <- 우리가 측정한 값
```

게시물에 원인이 안 나오면 **추측하지 않고 지표만 서술**합니다. 근거가 된 게시물 링크는 카드의 `evidence` 필드에 저장되어 `GET /api/trends/:id`로 조회할 수 있습니다 — 사장님이 원문을 확인할 수 있어야 신뢰할 수 있는 정보가 되기 때문입니다.

**에디터가 직접 만든 카드(`is_auto=false`)의 문구는 덮어쓰지 않습니다.** 순위에서 밀린 자동 카드는 삭제가 아니라 발행 취소(`is_published=false`)되므로, 다시 순위에 들면 되살아납니다.

> OpenAI 키(`OPENAI_API_KEY`)가 없으면 LLM 대신 규칙 기반 문구로 폴백합니다(`generated: false`). 근거 링크는 그래도 저장됩니다.

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

후보 키워드를 발굴해 등록합니다. 세 소스 모두 **지금 실제로 올라오고 있는 콘텐츠**에서 가져옵니다.

```json
{ "blog": true, "cafe": true, "youtube": true }
```

| 소스 | 내용 | 비용 |
|---|---|---|
| `blog` | 네이버 블로그 최신 포스트 제목 (7개 쿼리) | 검색 API 7회 |
| `cafe` | 네이버 카페글 최신 포스트 제목 (7개 쿼리) | 검색 API 7회 |
| `youtube` | 주제 검색 + 최근 30일 영상 (4개 쿼리) | 404 unit |

네이버 검색 API는 하루 25,000회, 유튜브는 10,000 unit 한도라 여유롭습니다.

검색어에는 `카페 신메뉴`, `요즘 유행 디저트` 외에 **`편의점 신메뉴`**도 포함됩니다. 국내 디저트·음료 유행은 편의점에서 먼저 터지고 카페로 넘어오는 경우가 많아(두바이초콜릿) 선행 지표로 씁니다.

**왜 소스를 따로 부르나 — 교차 검증**

어떤 소스도 편향이 있습니다. 블로그는 체험단·협찬이 많고, 카페글은 카페별로 연령대가 갈리며, 유튜브는 채널 구독자층이 다릅니다. 한 곳에서만 잡힌 키워드는 그 소스의 편향일 수 있고, 여러 곳에서 동시에 잡히면 실제 트렌드일 확률이 높습니다.

개인 카페·빵집 이름(`천하제빵`, `미켈란젤라또`)이 대개 블로그 한 곳에서만 나온다는 점에서, 이 방식은 **가게 이름 노이즈도 함께 걸러줍니다.**

유튜브는 특정 채널을 고정하지 않습니다 — 고르는 사람의 취향이 그대로 편향이 되기 때문입니다. 대신 매번 주제 검색으로 "지금 조회수가 잘 나오는 영상"을 찾아 영향력 있는 채널이 자연스럽게 뽑히게 합니다.

응답:
```json
{
  "discovered": 87, "inserted": 74, "updated": 13,
  "multiSource": 21,
  "errors": [],
  "sources": {
    "blog":    { "titlesScanned": 700, "extracted": 62, "attempts": [...] },
    "cafe":    { "titlesScanned": 680, "extracted": 41, "attempts": [...] },
    "youtube": { "titlesScanned": 190, "extracted": 18, "attempts": [...] }
  }
}
```

`multiSource`는 2개 이상 소스에서 잡힌 키워드 수입니다. 이 값이 높을수록 발굴 품질이 좋습니다.

`sources.*.attempts`에 소스별 성공/실패가 전부 담깁니다. 실패해도 다른 소스는 계속 진행하되, 실패 사유는 `errors`에 남으니 확인하세요.

이미 등록된 키워드는 건드리지 않습니다(에디터가 카드에 연결해둔 키워드를 덮어쓰지 않기 위해).
여기서는 후보를 쌓기만 하고, 검색량은 다음 수집 배치가 채웁니다.

> **왜 키워드를 직접 생성하지 않나**
> 초기엔 `재료 × 형태`(흑임자 + 라떼) 조합을 자동 생성했지만 폐기했습니다. 우리가 만들어낸 말은 대부분 아무도 검색하지 않고, 진짜 유행어(두바이초콜릿 같은)는 조합으로 예측할 수 없기 때문입니다.
>
> 네이버가 급상승 키워드 목록 API를 제공하면 좋겠지만, 실시간 검색어는 2021년 폐지됐고 데이터랩 API는 "내가 준 키워드가 얼마나 뜨나"만 답합니다. 그래서 실제 콘텐츠를 읽는 방식을 택했습니다.

### GET /api/admin/keywords/rising

트렌드 신호가 강한 후보 키워드 — "무엇을 트렌드 카드로 만들지" 고르는 용도.

쿼리:

| 파라미터 | 기본값 | 설명 |
|---|---|---|
| `limit` | 30 (최대 200) | 개수 |
| `minIndex` | 5 | 최소 검색지수 (정렬엔 안 쓰고 하한선으로만) |
| `minMentions` | 2 | 최소 언급 횟수 |
| `minSources` | 1 | 최소 소스 수. 2로 올리면 교차 검증된 것만 |
| `includeLinked` | false | 이미 카드가 있는 키워드 포함 여부 |
| `excludeStaples` | true | 상시 메뉴 제외 |
| `stapleIndex` / `stapleGrowth` | 40 / 5 | 검색지수 40 이상인데 증감률 5% 미만이면 상시 메뉴로 간주 |
| `excludeSeasonal` | true | 계절 메뉴 제외 (작년 같은 달에도 높았던 것) |

```json
{
  "keywords": [
    { "id": 42, "keyword": "두바이와플", "trend_id": null,
      "sources": ["blog", "cafe", "youtube"], "source_count": 3,
      "mention_count": 24, "mention_by_source": { "blog": 12, "cafe": 8, "youtube": 4 },
      "mention_growth_rate": 182.5, "growth_rate": 41.2, "yoy_growth_rate": 640.7,
      "view_velocity": 38400, "search_index": "34.20",
      "is_seasonal": false, "mention_window_days": 18, "trend_signal": 78.4 }
  ]
}
```

**`trend_signal` 내림차순으로 정렬됩니다.**

```
언급 증가율(45점) + 검색 증가율(30점) + 교차검증(25점)
```

**검색지수는 정렬에 쓰지 않습니다.** 검색지수가 높다는 건 이미 자리잡았다는 뜻이라, 이걸 기준으로 정렬하면 에그타르트·밀크티 같은 스테디셀러가 상위를 차지해 트렌드 발굴이 되지 않습니다.

| 필드 | 의미 |
|---|---|
| `sources` / `source_count` | 어느 소스에서 잡혔는지. 많을수록 신뢰도 높음 |
| `mention_by_source` | 소스별 언급 횟수 |
| `mention_growth_rate` | 블로그 게시 속도 변화(%). 최근 7일 대 이전 7일 |
| `growth_rate` | 네이버 검색지수 증감률(%) |
| `yoy_growth_rate` | 작년 같은 달 대비 증감률(%). 클수록 올해 새로 뜨는 것 |
| `view_velocity` | 최근 30일 유튜브 영상들의 일평균 조회수 합 |
| `is_seasonal` | 작년 같은 달에도 비슷하게 높았으면 true (계절 메뉴) |
| `mention_window_days` | 언급 측정에 확보한 기간(일) |
| `search_index` | 현재 검색지수(0~100). 필터로만 사용 |

> **`null`이면 계산을 포기한 것입니다.** 억지로 값을 내지 않습니다.
> `mention_growth_rate`는 14일 구간을 못 덮었거나 표본이 10건 미만일 때, `yoy_growth_rate`는 작년 지수가 1 미만일 때 `null`이 됩니다. 인기 키워드는 블로그 글 1,000건(API 상한)이 며칠치밖에 안 돼 이전 7일에 도달하지 못하는데, 그때 나오는 숫자는 "무한 증가"처럼 보이지만 사실 데이터가 없는 것입니다.

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
