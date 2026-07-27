/**
 * 트렌드 스코어링 로직 (기획서 11-5)
 *
 * 트렌드지수 = (네이버 검색지수 증감률 × 0.5)
 *            + (유튜브 영상수·조회수 증감률 × 0.3)
 *            + (에디터 가중치 × 0.2)
 *
 * 통계·ML 모델 대신 단순 가중합을 유지하기로 결정 (기획서 11-5 비고).
 * - 초기엔 데이터가 적어 복잡한 모델일수록 오히려 부정확해지기 쉬움
 * - 시니어 타겟 특성상 "왜 이 등급인지" 설명 가능해야 신뢰를 얻을 수 있음
 * - 데이터가 아예 없는 신규 키워드는 에디터 가중치 100%로 폴백
 *
 * 가중치는 하드코딩하지 않고 .env(SCORE_WEIGHT_*)로 조정 가능하게 뺀다.
 */

export type TrendStatus = 'emerging' | 'rising' | 'peak' | 'declining';

export interface ScoringInput {
  naverChangeRate: number | null; // 네이버 검색지수 증감률 (%), 데이터 없으면 null
  youtubeChangeRate: number | null; // 유튜브 영상수·조회수 증감률 (%), 데이터 없으면 null
  editorScore: number; // 에디터가 매긴 점수 (0~100)
}

export interface ScoringWeights {
  naver: number;
  youtube: number;
  editor: number;
}

function getWeightsFromEnv(): ScoringWeights {
  return {
    naver: Number(process.env.SCORE_WEIGHT_NAVER ?? 0.5),
    youtube: Number(process.env.SCORE_WEIGHT_YOUTUBE ?? 0.3),
    editor: Number(process.env.SCORE_WEIGHT_EDITOR ?? 0.2),
  };
}

/**
 * 네이버/유튜브 데이터가 없는 신규 키워드는 에디터 가중치 100%로 폴백한다.
 * 데이터가 하나만 있는 경우엔 있는 값들의 가중치만 정규화(재분배)해서 계산한다.
 */
export function calculateScore(input: ScoringInput, weights: ScoringWeights = getWeightsFromEnv()): number {
  const parts: { value: number; weight: number }[] = [];

  if (input.naverChangeRate !== null) parts.push({ value: input.naverChangeRate, weight: weights.naver });
  if (input.youtubeChangeRate !== null) parts.push({ value: input.youtubeChangeRate, weight: weights.youtube });
  parts.push({ value: input.editorScore, weight: weights.editor });

  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  if (totalWeight === 0) return 0;

  const weightedSum = parts.reduce((sum, p) => sum + p.value * p.weight, 0);
  return Math.round((weightedSum / totalWeight) * 100) / 100;
}

/**
 * 점수 구간 -> 확산 단계 라벨 (기획서 11-5 표)
 * 구간 기준은 초기엔 팀 판단으로 임의 설정, 데이터 축적 후 보정 예정
 */
export function scoreToStatus(score: number): TrendStatus {
  if (score >= 70) return 'peak';
  if (score >= 40) return 'rising';
  if (score >= 0) return 'emerging';
  return 'declining'; // 음수 = 하락 전환
}
