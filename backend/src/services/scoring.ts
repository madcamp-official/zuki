/**
 * 트렌드 스코어링 로직 (기획서 11-5)
 *
 * === 왜 2차원인가 ===
 *
 * 초기 구현은 증감률만으로 확산 단계를 정했는데, 그러면 분류가 거꾸로 나온다:
 *   - 검색지수 5 -> 10 인 무명 키워드   : 증감률 100% -> "전성기"
 *   - 검색지수 80 -> 90 인 성숙 트렌드  : 증감률  12% -> "태동기"
 *
 * 전성기는 원래 "이미 높은 수준에서 정체"라 증감률이 0에 가깝고,
 * 태동기는 "밑바닥에서 시작"이라 증감률이 폭발적이다.
 * 즉 증감률은 방향(momentum)만 알려주고 크기(level)를 알려주지 못한다.
 *
 * 그래서 두 축을 함께 본다:
 *   - level    : 현재 네이버 검색지수 (0~100). 얼마나 큰 트렌드인가
 *   - momentum : 증감률 (%).                   어느 방향으로 가는가
 *
 * === 점수와 단계는 별개 ===
 *
 * scoreToStatus(score) 처럼 점수 하나로 단계를 유도하지 않는다.
 *   - 확산 단계 : level + momentum 조합으로 결정 (classifyStatus)
 *   - 랭킹 점수 : "지금 주목할 가치" = level 0.6 + 제한된 momentum 0.4
 * 용도가 다르기 때문에 각각 계산한다.
 *
 * 통계·ML 모델 대신 단순 규칙을 유지하는 이유(기획서 11-5 비고):
 * 초기엔 데이터가 적어 복잡한 모델일수록 부정확해지기 쉽고,
 * 사장님 대상 서비스라 "왜 이 등급인지" 설명 가능해야 신뢰를 얻는다.
 */

export type TrendStatus = 'emerging' | 'rising' | 'peak' | 'declining';

/** 확산 단계 판정 기준값 — 데이터가 쌓이면 보정 예정 */
export const STATUS_THRESHOLDS = {
  /** 이 이상이면 "큰 트렌드"로 간주 */
  highLevel: 60,
  /** 이 미만이면 아직 미미한 수준 */
  lowLevel: 30,
  /** 이 이상 오르면 상승 중 */
  risingMomentum: 15,
  /** 이 이하로 떨어지면 하락 중 */
  decliningMomentum: -15,
};

export interface TrendSignals {
  /** 네이버 검색지수 최신값 (0~100). 없으면 null */
  searchLevel: number | null;
  /** 네이버 검색지수 증감률 (%). 비교할 과거 데이터가 없으면 null */
  searchMomentum: number | null;
  /** 유튜브 영상 수 증감률 (%). 없으면 null */
  youtubeMomentum: number | null;
  /** 에디터가 매긴 점수 (0~100). 입력 UI가 없어 현재는 중립값 50 */
  editorScore: number;
}

/**
 * 확산 단계 분류 — 수준(level)과 모멘텀(momentum) 2차원
 *
 *                감소(-15%↓)   정체      증가(+15%↑)
 *   높음(60+)      하락기      전성기      전성기
 *   중간(30~60)    하락기      상승기      상승기
 *   낮음(~30)      태동기      태동기      태동기
 *
 * level을 모르면(수집 전) momentum만으로 임시 판정한다.
 */
export function classifyStatus(signals: TrendSignals): TrendStatus {
  const { searchLevel, searchMomentum, youtubeMomentum } = signals;

  // 네이버가 주 신호. 없으면 유튜브 모멘텀으로 대체
  const momentum = searchMomentum ?? youtubeMomentum;
  const { highLevel, lowLevel, risingMomentum, decliningMomentum } = STATUS_THRESHOLDS;

  // 수준을 모르는 단계(첫 수집 전)에는 모멘텀만으로 임시 판정
  if (searchLevel === null) {
    if (momentum === null) return 'emerging';
    if (momentum <= decliningMomentum) return 'declining';
    if (momentum >= risingMomentum) return 'rising';
    return 'emerging';
  }

  // 아직 검색량 자체가 미미하면 무조건 태동기
  // (밑바닥에서의 증감률 폭등은 통계적으로 의미가 약하다)
  if (searchLevel < lowLevel) return 'emerging';

  // 수준이 있는데 뚜렷이 꺾이면 하락기
  if (momentum !== null && momentum <= decliningMomentum) return 'declining';

  // 큰 트렌드는 정체든 상승이든 전성기
  if (searchLevel >= highLevel) return 'peak';

  // 중간 수준 = 올라가는 중
  return 'rising';
}

/**
 * 랭킹 점수 (0~100) — "지금 이 트렌드를 주목할 가치"
 *
 *   level 0.6 + clamp(momentum, -100, 100) 정규화 0.4
 *
 * momentum에 상한을 두는 이유: 검색지수 1 -> 3 으로 오른 무명 키워드가
 * 증감률 200%로 1위를 차지하는 것을 막기 위함.
 * level을 더 무겁게 두는 이유: 사장님이 알고 싶은 건 "실제로 큰 유행"이지
 * "비율상 많이 오른 것"이 아니기 때문.
 */
export function calculateScore(signals: TrendSignals): number {
  const level = signals.searchLevel;
  const momentum = signals.searchMomentum ?? signals.youtubeMomentum;

  // 아무 데이터도 없으면 에디터 판단에 전적으로 의존
  if (level === null && momentum === null) {
    return round2(signals.editorScore);
  }

  // 모멘텀을 -100~100으로 자른 뒤 0~100 스케일로 변환 (0% 변화 = 50점)
  const clamped = momentum === null ? 0 : Math.max(-100, Math.min(100, momentum));
  const momentumScore = (clamped + 100) / 2;

  // 수준을 모르면 모멘텀만으로
  if (level === null) return round2(momentumScore);

  return round2(level * 0.6 + momentumScore * 0.4);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * @deprecated 점수만으로 단계를 유도하면 태동기와 전성기가 뒤집힌다.
 * classifyStatus(signals)를 쓸 것. 기존 호출부 호환을 위해 남겨둔다.
 */
export function scoreToStatus(score: number): TrendStatus {
  if (score >= 70) return 'peak';
  if (score >= 40) return 'rising';
  if (score >= 0) return 'emerging';
  return 'declining';
}
