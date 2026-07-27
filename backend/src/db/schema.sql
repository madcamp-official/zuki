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
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- Supabase 사용 시 auth.users(id) 참조로 교체
    email           VARCHAR(255) NOT NULL UNIQUE,
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
CREATE TABLE keywords (
    id          BIGSERIAL PRIMARY KEY,
    trend_id    BIGINT REFERENCES trends(id) ON DELETE SET NULL,
    keyword     VARCHAR(50) NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_keywords_trend ON keywords(trend_id);

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

-- =====================================================================
-- 초기 시드 데이터 (카테고리)
-- 빵류(베이커리 메뉴)는 별도 카테고리를 만들지 않고 '디저트'에 포함
-- =====================================================================
INSERT INTO categories (name, slug, sort_order) VALUES
    ('디저트', 'dessert', 1),
    ('음료', 'beverage', 2),
    ('마케팅', 'marketing', 3);
