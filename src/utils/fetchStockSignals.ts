// 종목별 기술적 신호 (MA20/MA60/70일 고저점 기반)

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://asset-dashboard-api.jilliankim200.workers.dev';
const CACHE_KEY = 'stock_signals_cache';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6시간 캐시

export interface StockSignal {
  ticker: string;
  currentPrice: number;
  changeRate: number;  // 당일 등락률 (%)
  ma20: number;
  ma60: number;
  high: number;   // 70일 고점
  low: number;    // 70일 저점
  position: number; // 0=저점 1=고점 (70일 range 내 위치)
}

// MA 대비 추세
export function getTrend(s: StockSignal): 'up' | 'sideways' | 'down' {
  const aboveMA20 = s.currentPrice >= s.ma20;
  const aboveMA60 = s.currentPrice >= s.ma60;
  if (aboveMA20 && aboveMA60) return 'up';
  if (!aboveMA20 && !aboveMA60) return 'down';
  return 'sideways';
}

type SignalResult = { label: string; color: string; desc: string; range?: [number, number] };

// 매도 타이밍 신호
export function getSellSignal(s: StockSignal): SignalResult {
  const trend = getTrend(s);
  const pos = s.position;
  const ma20Pct = ((s.currentPrice - s.ma20) / s.ma20 * 100).toFixed(1);
  const p70 = s.low + 0.7 * (s.high - s.low);

  if (trend === 'up' && pos >= 0.7)
    return { label: '매도 적합', color: 'var(--color-profit)', desc: `상승 추세 고점권 (70일 중 ${(pos*100).toFixed(0)}% 위치). 지금이 최적 매도 타이밍. 더 기다리면 고점을 지나 하락 전환 위험이 있으니 분할 매도 고려`, range: [s.currentPrice, s.high] };
  if (trend === 'up')
    return { label: '매도 가능', color: 'var(--color-profit)', desc: `상승 추세이나 고점까지 여지 있음 (현재 ${(pos*100).toFixed(0)}% / 70% 기준). 70일 고점 근처까지 기다리면 더 비싸게 매도 가능. 급하게 팔 필요 없다면 조금 더 보유 권장`, range: [s.currentPrice, p70] };
  if (trend === 'sideways' && pos >= 0.5)
    return { label: '매도 가능', color: 'var(--color-warning)', desc: `횡보 구간 중상단 (${(pos*100).toFixed(0)}%). 지금은 무난한 매도 타이밍. 횡보 구간은 고점이 제한적이므로 더 기다려도 큰 이익 기대 어려움`, range: [s.currentPrice, s.high] };
  if (trend === 'sideways')
    return { label: '반등 대기', color: 'var(--color-warning)', desc: `횡보 구간 하단 (${(pos*100).toFixed(0)}%). 지금 팔면 낮은 가격에 매도. MA20 회복 또는 중상단 반등 후 매도하면 더 유리`, range: [s.ma20, s.high] };
  if (trend === 'down' && pos <= 0.3)
    return { label: '저점 매도', color: 'var(--color-loss)', desc: `하락 추세 저점권 (${(pos*100).toFixed(0)}%). 손절 수준. 추가 하락 전 정리하거나, 단기 반등 시 MA20 근처에서 매도하는 방법도 있음`, range: [s.low, s.currentPrice] };
  return { label: '반등 후 매도', color: 'var(--color-loss)', desc: `하락 추세 진행 중 (MA20 대비 ${ma20Pct}%). 지금 팔면 낮은 가격. 단기 반등 시 MA20~MA60 구간 도달할 때 매도하면 더 유리한 가격 기대 가능`, range: [s.ma60, s.ma20] };
}

// 매수(추가) 타이밍 신호
export function getBuySignal(s: StockSignal): SignalResult {
  const trend = getTrend(s);
  const pos = s.position;
  const ma20Pct = ((s.currentPrice - s.ma20) / s.ma20 * 100).toFixed(1);

  if (trend === 'down' && pos <= 0.2)
    return { label: '반등 대기', color: 'var(--color-warning)', desc: `하락 추세 + 70일 저점 근처 (${(pos*100).toFixed(0)}%). 지금 사면 더 내려갈 수 있음. MA20 회복 신호가 나올 때까지 기다렸다가 진입이 손실 최소화에 유리`, range: [s.low, s.ma20] };
  if (trend === 'down')
    return { label: '반등 대기', color: 'var(--color-warning)', desc: `하락 추세 진행 중 (MA20 대비 ${ma20Pct}%). 저점이 어디인지 아직 모름. MA20 돌파 확인 후 진입해야 '바닥에서 사는' 실수를 줄일 수 있음`, range: [s.low, s.ma20] };
  if (trend === 'sideways' && pos <= 0.4)
    return { label: '매수 적합', color: 'var(--color-profit)', desc: `횡보 구간 하단 (${(pos*100).toFixed(0)}%). 매수 리스크가 낮은 구간. 단, 횡보가 하락 전환될 수 있으니 전액보다 절반 먼저 진입 후 추이 확인 권장`, range: [s.low, s.ma20] };
  if (trend === 'sideways')
    return { label: '분할 매수', color: 'var(--color-warning)', desc: `횡보 구간 중간 (${(pos*100).toFixed(0)}%). 한 번에 사면 고점 물릴 수 있음. 2~3회 분할로 평단 분산하면 리스크를 낮출 수 있음`, range: [s.low, s.currentPrice] };
  if (trend === 'up' && pos >= 0.8)
    return { label: '조정 대기', color: 'var(--color-loss)', desc: `70일 고점 근처 (${(pos*100).toFixed(0)}%). 지금 사면 고점 매수 위험. 10~15% 조정 후 MA20~MA60 구간까지 내려올 때 진입하면 훨씬 유리한 가격`, range: [s.ma60, s.ma20] };
  if (trend === 'up' && pos >= 0.6)
    return { label: '분할 매수', color: 'var(--color-warning)', desc: `상승 추세 중상단 (${(pos*100).toFixed(0)}%). 추가 상승 여지는 있으나 조정 위험도 공존. 한 번에 사기보다 2회 분할로 리스크 분산 권장`, range: [s.ma20, s.currentPrice] };
  return { label: '매수 가능', color: 'var(--color-profit)', desc: `상승 추세 초입 (${(pos*100).toFixed(0)}%). 추가 상승 여지 충분. 단, 상승 추세가 꺾일 경우를 대비해 손절 기준(예: MA60 이탈)을 미리 정해두는 것이 좋음`, range: [s.ma20, s.currentPrice] };
}

// 캐시
interface SignalCache {
  data: Record<string, StockSignal>;
  timestamp: number;
}

function getCache(): SignalCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c: SignalCache = JSON.parse(raw);
    if (Date.now() - c.timestamp > CACHE_TTL) return null;
    return c;
  } catch { return null; }
}

function setCache(data: Record<string, StockSignal>) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
}

function isValidKrTicker(ticker: string): boolean {
  return /^[0-9A-Z]{6}$/i.test(ticker);
}

export async function fetchStockSignals(tickers: string[]): Promise<Record<string, StockSignal>> {
  const valid = [...new Set(tickers.filter(isValidKrTicker))];
  if (valid.length === 0) return {};

  const cache = getCache();
  const result: Record<string, StockSignal> = cache?.data ? { ...cache.data } : {};
  const needed = valid.filter(t => !(t in result));

  if (needed.length === 0) return result;

  // 병렬 요청 (최대 5개씩)
  const batchSize = 5;
  for (let i = 0; i < needed.length; i += batchSize) {
    const batch = needed.slice(i, i + batchSize);
    await Promise.all(batch.map(async (ticker) => {
      try {
        const res = await fetch(`${WORKER_URL}/stock-detail/${ticker}`);
        if (!res.ok) return;
        const data = await res.json() as StockSignal;
        if (data.currentPrice > 0) result[ticker] = data;
      } catch { /* skip */ }
    }));
  }

  setCache(result);
  return result;
}
