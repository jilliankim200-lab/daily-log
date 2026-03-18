// 네이버 금융 API를 통한 시장 지표 조회

export interface MarketIndexData {
  name: string;
  code: string;
  price: number;
  change: number;
  changeRate: number;
  direction: 'RISING' | 'FALLING' | 'FLAT';
}

const CACHE_KEY = 'market_index_cache';
const CACHE_TTL = 60 * 1000; // 1분 캐시

interface MarketCache {
  data: MarketIndexData[];
  timestamp: number;
}

function getCache(): MarketCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache: MarketCache = JSON.parse(raw);
    if (Date.now() - cache.timestamp > CACHE_TTL) return null;
    return cache;
  } catch { return null; }
}

function setCache(data: MarketIndexData[]) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
}

// 한국 시장 시간: 09:00~15:30 KST
function isKoreanMarketHours(): boolean {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const t = h * 60 + m;
  return t >= 540 && t <= 930; // 09:00 ~ 15:30
}

export async function fetchMarketData(): Promise<MarketIndexData[]> {
  const cache = getCache();
  if (cache) return cache.data;

  const results: MarketIndexData[] = [];

  // 1. 환율 (USD/KRW)
  try {
    const res = await fetch('/api/exchange/FX_USDKRW');
    if (res.ok) {
      const data = await res.json();
      const info = data.exchangeInfo;
      if (info) {
        const price = parseFloat(info.closePrice.replace(/,/g, ''));
        const change = parseFloat(info.fluctuations?.replace(/,/g, '') || '0');
        const rate = parseFloat(info.fluctuationsRatio || '0');
        const dir = info.fluctuationsType?.name || (rate > 0 ? 'RISING' : rate < 0 ? 'FALLING' : 'FLAT');
        results.push({
          name: '달러 환율',
          code: 'FX_USDKRW',
          price,
          change,
          changeRate: rate,
          direction: dir === 'RISING' ? 'RISING' : dir === 'FALLING' ? 'FALLING' : 'FLAT',
        });
      }
    }
  } catch { /* skip */ }

  // 2. 국내 지수 (KOSPI, KOSDAQ)
  try {
    const res = await fetch('/api/index/KOSPI,KOSDAQ');
    if (res.ok) {
      const data = await res.json();
      for (const item of data.datas || []) {
        const price = parseFloat(item.closePriceRaw || '0');
        const change = parseFloat(item.compareToPreviousClosePriceRaw || '0');
        const rate = parseFloat(item.fluctuationsRatioRaw || '0');
        const dir = item.compareToPreviousPrice?.name;
        results.push({
          name: item.stockName,
          code: item.itemCode,
          price,
          change: dir === 'FALLING' ? -Math.abs(change) : change,
          changeRate: dir === 'FALLING' ? -Math.abs(rate) : rate,
          direction: dir === 'RISING' ? 'RISING' : dir === 'FALLING' ? 'FALLING' : 'FLAT',
        });
      }
    }
  } catch { /* skip */ }

  // 3. 해외 지수 (S&P 500, NASDAQ)
  try {
    const res = await fetch('/api/worldindex/SPI@SPX,NAS@IXIC');
    if (res.ok) {
      const data = await res.json();
      for (const item of data.datas || []) {
        const price = parseFloat(item.closePriceRaw || '0');
        const change = parseFloat(item.compareToPreviousClosePriceRaw || '0');
        const rate = parseFloat(item.fluctuationsRatioRaw || '0');
        const dir = item.compareToPreviousPrice?.name;
        results.push({
          name: item.stockName === 'S&P 500' ? 'S&P 500' : item.stockName,
          code: item.itemCode,
          price,
          change: dir === 'FALLING' ? -Math.abs(change) : change,
          changeRate: dir === 'FALLING' ? -Math.abs(rate) : rate,
          direction: dir === 'RISING' ? 'RISING' : dir === 'FALLING' ? 'FALLING' : 'FLAT',
        });
      }
    }
  } catch { /* skip */ }

  if (results.length > 0) {
    setCache(results);
  }

  return results;
}

// 시간대에 따라 보여줄 지수 선택
export function selectMarketItems(data: MarketIndexData[]): MarketIndexData[] {
  const exchange = data.find(d => d.code === 'FX_USDKRW');
  const kospi = data.find(d => d.code === 'KOSPI');
  const kosdaq = data.find(d => d.code === 'KOSDAQ');
  const sp500 = data.find(d => d.code === 'SPI@SPX');
  const nasdaq = data.find(d => d.code === 'NAS@IXIC');

  // 항상 5개 모두 표시: 달러환율, 코스피, 코스닥, S&P500, 나스닥
  const items: MarketIndexData[] = [];
  if (exchange) items.push(exchange);
  if (kospi) items.push(kospi);
  if (kosdaq) items.push(kosdaq);
  if (sp500) items.push(sp500);
  if (nasdaq) items.push(nasdaq);

  return items;
}
