import { type SellConfig, DEFAULT_SELL_CONFIG } from './sellConfig';

export interface SellInput {
  currentReturn: number | null;  // 소수점 (0.25 = +25%). calcReturn() / 100 으로 변환해서 전달
  currentPrice: number;
  ma20: number;
  ma60: number;
}

export type SellAction = 'hold' | 'sell_half' | 'sell_all';
export type SellUrgency = 'none' | 'medium' | 'high' | 'critical';

export interface SellDecision {
  action: SellAction;
  reason: string;
  urgency: SellUrgency;
}

export function getSellDecision(
  input: SellInput,
  config: SellConfig = DEFAULT_SELL_CONFIG,
): SellDecision {
  const { currentReturn, currentPrice, ma20, ma60 } = input;

  // 매도 보류: 상승추세 — 주가가 MA20 위이면 무조건 홀딩
  if (currentPrice > ma20) {
    return { action: 'hold', reason: '상승추세 (주가 > MA20)', urgency: 'none' };
  }

  // 시나리오 1: 추세 붕괴 전량 매도 — 주가 < MA20 AND MA20 < MA60
  if (ma20 < ma60) {
    return { action: 'sell_all', reason: '추세 붕괴 (MA20 < MA60)', urgency: 'high' };
  }

  // 시나리오 3: 긴급 손절 (수익 실현보다 먼저 체크 — 손실 우선)
  if (currentReturn !== null && currentReturn <= config.stopLoss) {
    return {
      action: 'sell_all',
      reason: `손절 기준 도달 (${(currentReturn * 100).toFixed(1)}%)`,
      urgency: 'critical',
    };
  }

  // 시나리오 2: 수익 실현 부분 매도 — 주가 < MA20 + 목표 수익 달성
  if (currentReturn !== null && currentReturn >= config.targetReturn) {
    return {
      action: 'sell_half',
      reason: `목표 수익 달성 + 추세 꺾임 (${(currentReturn * 100).toFixed(1)}%)`,
      urgency: 'medium',
    };
  }

  return { action: 'hold', reason: '매도 조건 미충족', urgency: 'none' };
}
