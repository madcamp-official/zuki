-- =====================================================================
-- TrendPick DB 스키마 (PostgreSQL / Supabase 기준)
-- 기획서 12번 초안을 구체화. 매장 맞춤 추천/적용가이드 기능은 제외하고
-- "유행 정보 제공"까지만 서비스 범위로 한정 (반영 여부는 사장님 재량)
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid() 사용

-- ---------------------------------------------------------------------
-- ENUM 타입
-- ---------------------------------------------------------------------
CREATE TYPE trend_status AS ENUM ('emerging', 'rising', 'peak', 'declining');
-- 태동기 / 상승기 / 전성기 / 하락기

CREATE TYPE data_source AS ENUM ('naver', 'youtube', 'editor');
-- 스코어링 3대 소스 (기획서 5, 11-4)

CREATE TYPE user_role AS ENUM ('owner', 'editor', 'admin');
-- owner: 카페 사장님(일반 사용자), editor: 큐레이션 담당자, admin: 관리자

-- ---------------------------------------------------------------------
-- 1. categories : 카테고리 마스터 (디저트/음료/마케팅)
-- 카페·베이커리로 타겟 좁히면서 인테리어·소품/매장운영 카테고리는 제외,
-- 빵류는 별도 카테고리 없이 디저트에 포함. 코드에 하드코딩하지 않고
-- 테이블로 분리해 카테고리 추가/수정에 대응 (기획서 4-3)
-- ---------------------------------------------------------------------
CREATE TABLE categories (
    id          SMALLSERIAL PRIMARY KEY,
    name        VARCHAR(30) NOT NULL UNIQUE,   -- 예: '디저트'
    slug        VARCHAR(30) NOT NULL UNIQUE,   -- 예: 'dessert' (URL/코드용)
    sort_order  SMALLINT NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------
-- 2. users : 카페 사장님 계정
-- Supabase Auth 사용 시 id는 auth.users.id를 그대로 FK로 참조 (1:1)
-- ---------------------------------------------------------------------
-- 서비스 프로필만 담는다. 계정(비밀번호·이메일 인증·소셜 로그인)은 auth.users가 관리하며
-- 두 테이블은 같은 id를 공유한다. 프로필 행은 인증된 첫 요청 때 백엔드가 자동 생성한다.
CREATE TABLE users (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    -- 전화번호 가입·소셜 로그인 등 이메일이 없는 계정도 있어 nullable
    email           VARCHAR(255) UNIQUE,
    store_name      VARCHAR(100),
    region_si       VARCHAR(30),                -- 시/도 (예: 서울특별시) — 지역별 확산 속도 차이 파악용 (기획서 9, 16)
    region_gu       VARCHAR(30),                -- 시/군/구 (예: 강남구)
    role            user_role NOT NULL DEFAULT 'owner',
    notif_enabled   BOOLEAN NOT NULL DEFAULT true,  -- 하루 1회 아침 브리핑 알림 (기획서 4-6)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2-1. user_category_interests : 사용자 관심 카테고리 (N:M)
CREATE TABLE user_category_interests (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id SMALLINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, category_id)
);

-- ---------------------------------------------------------------------
-- 3. trends : 트렌드 카드 (가공·서빙 결과물, 기획서 4-1, 12)
-- 프론트는 이 테이블만 조회하고 외부 API를 직접 호출하지 않음
-- ---------------------------------------------------------------------
CREATE TABLE trends (
    id                  BIGSERIAL PRIMARY KEY,
    title               VARCHAR(100) NOT NULL,
    summary             VARCHAR(300),           -- 3줄 이내 요약 (기획서 4-1)
    category_id         SMALLINT NOT NULL REFERENCES categories(id),
    status              trend_status NOT NULL DEFAULT 'emerging',
    score               NUMERIC(6,2) NOT NULL DEFAULT 0,  -- 11-5 스코어링 공식 결과
    reason              TEXT,                   -- "왜 뜨는지" 배경 설명 (기획서 4-2)
    image_url           TEXT,
    banner_image_url    TEXT,                   -- 홈 히어로 배너 전용 이미지 (1위일 때만 생성, 카드 image_url과 별도)
    region_scope        VARCHAR(30) NOT NULL DEFAULT 'nationwide',  -- 이 트렌드가 주로 확산 중인 지역 (지역별 유행 속도 차이 반영, 기획서 9/16)
    primary_source      data_source NOT NULL DEFAULT 'editor',
    is_published        BOOLEAN NOT NULL DEFAULT false,
    created_by          UUID REFERENCES users(id),  -- 담당 에디터
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trends_category_status ON trends(category_id, status);
CREATE INDEX idx_trends_published_created ON trends(is_published, created_at DESC);

-- ---------------------------------------------------------------------
-- 4. keywords : 트렌드 후보/연결 키워드
-- 후보 발굴 단계에서는 trend_id가 비어 있을 수 있음 (아직 카드로 승격 전)
-- ---------------------------------------------------------------------
-- trend_id가 NULL이면 아직 카드로 승격되지 않은 "후보 키워드".
-- 후보는 네이버 검색량만 감시하고(저렴), 카드로 승격된 것만 유튜브까지 수집한다.
CREATE TABLE keywords (
    id                BIGSERIAL PRIMARY KEY,
    trend_id          BIGINT REFERENCES trends(id) ON DELETE SET NULL,
    keyword           VARCHAR(50) NOT NULL UNIQUE,
    -- 어디서 발굴됐는지 (대표 소스 1개). 하위 호환용이며 실제 판단은 sources를 쓴다
    source            VARCHAR(20) NOT NULL DEFAULT 'editor',
    -- 발굴된 모든 소스: 'blog' | 'cafe' | 'youtube'
    --
    -- 교차 검증용. 어떤 소스도 편향이 있어서(블로그는 체험단·협찬이 많고,
    -- 카페는 연령대가 갈리고, 유튜브는 채널 구독자층이 다름) 한 곳에서만
    -- 잡힌 키워드는 그 소스의 편향일 수 있다. 개인 카페·빵집 이름이 대개
    -- 블로그 한 곳에서만 나온다는 점에서 노이즈 필터 역할도 한다.
    sources           TEXT[] NOT NULL DEFAULT '{}',
    -- 소스별 언급 횟수 {"blog": 12, "cafe": 3}
    mention_by_source JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- 발굴 시 최근 글 제목에서 몇 번 언급됐는지.
    -- "최근 글에 자주 나오는데 검색량은 아직 낮다"가 태동기의 신호라서,
    -- 검색지수만으로는 스테디셀러와 신흥 트렌드를 구분할 수 없다.
    mention_count       INTEGER NOT NULL DEFAULT 0,
    -- 언급 추이 측정 시 확보한 기간(일). 14 미만이면 증가율 신뢰도가 낮다
    mention_window_days INTEGER,
    -- 계절성 반복 여부. 7월의 팥빙수처럼 매년 이맘때 오르는 것은 트렌드가 아니다.
    -- 작년 같은 달과 비교해 판별한다 (데이터랩 timeUnit=month, 24개월)
    is_seasonal         BOOLEAN NOT NULL DEFAULT false,
    yoy_growth_rate     NUMERIC(10,2),
    discovered_at     TIMESTAMPTZ,
    last_collected_at TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_keywords_trend ON keywords(trend_id);
CREATE INDEX idx_keywords_candidates ON keywords(source) WHERE trend_id IS NULL;
CREATE INDEX idx_keywords_mention ON keywords(mention_count DESC) WHERE trend_id IS NULL;
CREATE INDEX idx_keywords_sources ON keywords USING GIN (sources) WHERE trend_id IS NULL;

-- ---------------------------------------------------------------------
-- 5. keyword_metrics : 네이버/유튜브 API 원시 수집 데이터 (일별)
-- 기획서 11-4 배치가 매일 적재. 스코어링(11-5)의 입력값
-- ---------------------------------------------------------------------
CREATE TABLE keyword_metrics (
    id              BIGSERIAL PRIMARY KEY,
    keyword_id      BIGINT NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
    source_type     data_source NOT NULL,        -- 'naver' | 'youtube'
    metric_type     VARCHAR(30) NOT NULL,        -- 'search_index' | 'video_count' | 'view_count'
    value           NUMERIC(14,2) NOT NULL,
    collected_date  DATE NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (keyword_id, source_type, metric_type, collected_date)
);

CREATE INDEX idx_keyword_metrics_lookup ON keyword_metrics(keyword_id, collected_date);

-- ---------------------------------------------------------------------
-- 6. trend_score_history : 트렌드별 일별 스코어 추이
-- 트렌드 상세 화면의 "검색량 추이 그래프"(기획서 13) 데이터 소스
-- ---------------------------------------------------------------------
CREATE TABLE trend_score_history (
    id              BIGSERIAL PRIMARY KEY,
    trend_id        BIGINT NOT NULL REFERENCES trends(id) ON DELETE CASCADE,
    score           NUMERIC(6,2) NOT NULL,
    status          trend_status NOT NULL,
    recorded_date   DATE NOT NULL,
    UNIQUE (trend_id, recorded_date)
);

CREATE INDEX idx_trend_score_history_trend ON trend_score_history(trend_id, recorded_date);

-- ---------------------------------------------------------------------
-- 7. bookmarks : 즐겨찾기 (기획서 4-5)
-- ---------------------------------------------------------------------
CREATE TABLE bookmarks (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trend_id    BIGINT NOT NULL REFERENCES trends(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, trend_id)
);

-- ---------------------------------------------------------------------
-- 8. trend_feedback : 사용자 제보/투표 (기획서 5. "우리 동네에서도 이거 뜨나요?")
-- 2단계 이후 활용, MVP에서는 테이블만 만들어두고 기능은 보류해도 무방
-- ---------------------------------------------------------------------
CREATE TABLE trend_feedback (
    id          BIGSERIAL PRIMARY KEY,
    trend_id    BIGINT NOT NULL REFERENCES trends(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_relevant BOOLEAN NOT NULL,      -- 우리 동네에도 확산 중인지 여부
    comment     VARCHAR(200),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (trend_id, user_id)
);

-- ---------------------------------------------------------------------
-- 9. collection_batches : 배치 실행 로그 (선택, 운영 모니터링용)
-- node-cron/GitHub Actions 배치(기획서 11-4)의 성공/실패, API 호출량 추적
-- ---------------------------------------------------------------------
CREATE TABLE collection_batches (
    id              BIGSERIAL PRIMARY KEY,
    source_type     data_source NOT NULL,
    status          VARCHAR(20) NOT NULL,   -- 'success' | 'failed' | 'partial'
    api_calls_used  INT,                    -- 유튜브 일일 unit 한도(10,000) 추적용
    error_message   TEXT,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at     TIMESTAMPTZ
);

-- ---------------------------------------------------------------------
-- pipeline_runs: 발굴→수집→카드갱신 파이프라인 실행 이력
--
-- 실행 상태를 프로세스 메모리에만 두면, 재배포나 Render 슬립으로 프로세스가
-- 내려갈 때 "방금 뭐가 돌았는지"가 통째로 사라진다. 실행은 정상이었는데
-- 화면에는 null이 떠서 실패로 오인하게 된다. 그래서 DB에도 남긴다.
-- ---------------------------------------------------------------------
CREATE TABLE pipeline_runs (
    id           BIGSERIAL PRIMARY KEY,
    -- 'api' | 'cron:discover-light' | 'cron:discover-youtube' | 'cron:full'
    trigger      VARCHAR(40) NOT NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'running', -- running|success|partial|failed
    stage        VARCHAR(20),                            -- 진행 중인 단계. 끝나면 NULL
    started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at  TIMESTAMPTZ,
    -- 단계별 요약과 오류 목록. 구조가 자주 바뀌어 컬럼으로 못 박지 않는다
    summary      JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 최신 실행 1건 조회가 대부분의 접근 패턴이다
CREATE INDEX idx_pipeline_runs_started ON pipeline_runs (started_at DESC);

-- =====================================================================
-- 초기 시드 데이터 (카테고리)
-- 빵류(베이커리 메뉴)는 별도 카테고리를 만들지 않고 '디저트'에 포함
-- =====================================================================
INSERT INTO categories (name, slug, sort_order) VALUES
    ('디저트', 'dessert', 1),
    ('음료', 'beverage', 2),
    ('마케팅', 'marketing', 3);
