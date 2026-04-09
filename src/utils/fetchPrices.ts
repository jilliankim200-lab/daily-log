// 네이버 증권 API를 통해 현재가 조회 (Vite proxy 경유)

export interface StockPrice {
  ticker: string;
  currentPrice: number;
  name: string;
}

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

// 6자리 한국 주식/ETF 티커 (숫자 또는 영문+숫자 혼합)
function isValidKrTicker(ticker: string): boolean {
  return /^[0-9A-Z]{6}$/i.test(ticker);
}

export async function fetchCurrentPrices(tickers: string[]): Promise<Record<string, number>> {
  const validTickers = [...new Set(tickers.filter(isValidKrTicker))];
  if (validTickers.length === 0) return {};

  // 캐시 체크
  const cache = getCache();
  if (cache) {
    const allCached = validTickers.every(t => t in cache.prices);
    if (allCached) return cache.prices;
  }

  const result: Record<string, number> = cache?.prices || {};

  // 개별 요청 (병렬, 최대 10개씩 배치)
  const batchSize = 10;
  for (let i = 0; i < validTickers.length; i += batchSize) {
    const batch = validTickers.slice(i, i + batchSize);
    const promises = batch.map(async (ticker) => {
      try {
        const res = await fetch(`/api/stock/${ticker}`);
        if (!res.ok) return;
        const data = await res.json();
        const item = data.datas?.[0];
        if (item?.closePriceRaw) {
          result[ticker] = parseInt(item.closePriceRaw, 10);
          const rawRate = parseFloat(item.fluctuationsRatioRaw || '0');
          const isFalling = item.compareToPreviousPrice?.name === 'FALLING';
          result[`${ticker}_rate`] = isFalling ? -Math.abs(rawRate) : rawRate;
        }
      } catch { /* skip */ }
    });
    await Promise.all(promises);
  }

  setCache(result);
  return result;
}
