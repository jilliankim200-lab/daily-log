// Cloudflare Worker를 통해 현재가 조회 (프로덕션/개발 모두 동일)

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://asset-dashboard-api.jilliankim200.workers.dev';

const CACHE_KEY = 'stock_prices_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5분 캐시

interface CacheEntry {
  prices: Record<string, number>;
  timestamp: number;
}

function getCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache: CacheEntry = JSON.parse(raw);
    if (Date.now() - cache.timestamp > CACHE_TTL) return null;
    return cache;
  } catch { return null; }
}

function setCache(prices: Record<string, number>) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ prices, timestamp: Date.now() }));
}

function isKrTicker(ticker: string): boolean {
  // 6자리 영숫자 (0005A0, 0177N0 등 ETF 포함)
  return /^[0-9A-Z]{6}$/i.test(ticker) && /\d/.test(ticker);
}

function isUsTicker(ticker: string): boolean {
  // 순수 영문자 1~6자 (숫자 없음) — TSLA, MO, IETC 등
  return /^[A-Z]{1,6}(\.[A-Z]{1,3})?$/.test(ticker) && !/\d/.test(ticker);
}

export function detectCurrency(ticker: string): 'KRW' | 'USD' {
  return isKrTicker(ticker) ? 'KRW' : 'USD';
}

export async function fetchCurrentPricesWithChange(tickers: string[]): Promise<Record<string, { price: number; changeRate: number }>> {
  const krTickers = [...new Set(tickers.filter(isKrTicker))];
  const usTickers = [...new Set(tickers.filter(isUsTicker))];
  const result: Record<string, { price: number; changeRate: number }> = {};

  await Promise.all([
    // 국내 — Naver
    (async () => {
      if (krTickers.length === 0) return;
      try {
        for (let i = 0; i < krTickers.length; i += 50) {
          const batch = krTickers.slice(i, i + 50);
          const res = await fetch(`${WORKER_URL}/stock-prices-with-change?tickers=${batch.join(',')}`);
          if (!res.ok) continue;
          const data: Record<string, { price: number; changeRate: number }> = await res.json();
          Object.assign(result, data);
        }
      } catch { /* skip */ }
    })(),
    // 해외 — Yahoo Finance (USD)
    (async () => {
      if (usTickers.length === 0) return;
      try {
        for (let i = 0; i < usTickers.length; i += 20) {
          const batch = usTickers.slice(i, i + 20);
          const res = await fetch(`${WORKER_URL}/stock-prices-foreign?tickers=${batch.join(',')}`);
          if (!res.ok) continue;
          const data: Record<string, { price: number; changeRate: number }> = await res.json();
          Object.assign(result, data);
        }
      } catch { /* skip */ }
    })(),
  ]);
  return result;
}

export async function fetchCurrentPrices(tickers: string[]): Promise<Record<string, number>> {
  const validTickers = [...new Set(tickers.filter(isKrTicker))];
  if (validTickers.length === 0) return {};

  // 캐시 체크
  const cache = getCache();
  if (cache) {
    const allCached = validTickers.every(t => t in cache.prices);
    if (allCached) return cache.prices;
  }

  const result: Record<string, number> = cache?.prices || {};

  try {
    // Worker의 일괄 조회 엔드포인트 사용 (배치 50개씩)
    const batchSize = 50;
    for (let i = 0; i < validTickers.length; i += batchSize) {
      const batch = validTickers.slice(i, i + batchSize);
      const res = await fetch(`${WORKER_URL}/stock-prices?tickers=${batch.join(',')}`);
      if (!res.ok) continue;
      const data: Record<string, number> = await res.json();
      Object.assign(result, data);
    }
  } catch { /* skip */ }

  setCache(result);
  return result;
}
