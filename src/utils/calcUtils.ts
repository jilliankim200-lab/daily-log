// 이동평균 (단순 이동평균, Math.round)
export function calcMA(prices: number[], period: number): (number | null)[] {
  return prices.map((_, i) => {
    if (i < period - 1) return null;
    const slice = prices.slice(i - period + 1, i + 1);
    return Math.round(slice.reduce((s, p) => s + p, 0) / period);
  });
}

// 수익률 — 퍼센트 형태 (25 = +25%). OptimalGuide.tsx와 동일
export function calcReturnPct(currentPrice: number, avgCost: number): number {
  if (avgCost === 0) return 0;
  return (currentPrice - avgCost) / avgCost * 100;
}

// 등락률 — 퍼센트 형태
export function calcChangeRate(lastPrice: number, prevPrice: number): number {
  if (prevPrice === 0) return 0;
  return (lastPrice - prevPrice) / prevPrice * 100;
}

// 60일 범위 내 위치 (0 = 저점, 1 = 고점). worker/src/index.ts와 동일
export function calcPosition(currentPrice: number, low: number, high: number): number {
  if (high === low) return 0;
  return (currentPrice - low) / (high - low);
}
