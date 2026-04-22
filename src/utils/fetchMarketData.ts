// Worker `/market-indices` 기반 시장 지표 조회 (dev/prod 공통)

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://asset-dashboard-api.jilliankim200.workers.dev';

export interface MarketIndexData {
  name: string;
  code: string;
  price: number;
  change: number;
  changeRate: number;
  direction: 'RISING' | 'FALLING' | 'FLAT';
}

interface WorkerIndexItem {
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  direction?: 'RISING' | 'FALLING' | 'FLAT';
  error?: string;
}

interface WorkerMarketIndicesResponse {
  kospi?: WorkerIndexItem;
  kosdaq?: WorkerIndexItem;
  nasdaq?: WorkerIndexItem;
  sp500?: WorkerIndexItem;
  fx_usdkrw?: WorkerIndexItem;
  lastUpdated?: string;
}

const CACHE_KEY = 'market_index_cache';
const CACHE_TTL = 60 * 1000;

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

function toItem(src: WorkerIndexItem | undefined, name: string, code: string): MarketIndexData | null {
  if (!src || src.error || !src.currentPrice) return null;
  const dir = src.direction ?? (src.changePercent > 0 ? 'RISING' : src.changePercent < 0 ? 'FALLING' : 'FLAT');
  return {
    name,
    code,
    price: src.currentPrice,
    change: src.change,
    changeRate: src.changePercent,
    direction: dir,
  };
}

export async function fetchMarketData(): Promise<MarketIndexData[]> {
  const cache = getCache();
  if (cache) return cache.data;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${WORKER_URL}/market-indices`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return [];

    const data: WorkerMarketIndicesResponse = await res.json();
    const results: MarketIndexData[] = [];

    const fx = toItem(data.fx_usdkrw, '달러 환율', 'FX_USDKRW');
    if (fx) results.push(fx);
    const kospi = toItem(data.kospi, 'KOSPI', 'KOSPI');
    if (kospi) results.push(kospi);
    const kosdaq = toItem(data.kosdaq, 'KOSDAQ', 'KOSDAQ');
    if (kosdaq) results.push(kosdaq);
    const sp500 = toItem(data.sp500, 'S&P 500', 'SPI@SPX');
    if (sp500) results.push(sp500);
    const nasdaq = toItem(data.nasdaq, 'NASDAQ', 'NAS@IXIC');
    if (nasdaq) results.push(nasdaq);

    if (results.length > 0) setCache(results);
    return results;
  } catch {
    return [];
  }
}

export function selectMarketItems(data: MarketIndexData[]): MarketIndexData[] {
  const exchange = data.find(d => d.code === 'FX_USDKRW');
  const kospi = data.find(d => d.code === 'KOSPI');
  const kosdaq = data.find(d => d.code === 'KOSDAQ');
  const sp500 = data.find(d => d.code === 'SPI@SPX');
  const nasdaq = data.find(d => d.code === 'NAS@IXIC');

  const items: MarketIndexData[] = [];
  if (exchange) items.push(exchange);
  if (kospi) items.push(kospi);
  if (kosdaq) items.push(kosdaq);
  if (sp500) items.push(sp500);
  if (nasdaq) items.push(nasdaq);

  return items;
}
