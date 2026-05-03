// 네이버 금시세에서 금 1돈 가격(KRW) 조회 — Worker 경유 (로컬/프로덕션 동일)
// 1돈 = 3.75g

const GOLD_CACHE_KEY = 'gold_price_cache';
const GOLD_CACHE_TTL = 30 * 60 * 1000; // 30분 캐시

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://asset-dashboard-api.jilliankim200.workers.dev';

interface GoldCache {
  pricePerDon: number;
  timestamp: number;
}

function getCache(): GoldCache | null {
  try {
    const raw = localStorage.getItem(GOLD_CACHE_KEY);
    if (!raw) return null;
    const cache: GoldCache = JSON.parse(raw);
    if (Date.now() - cache.timestamp > GOLD_CACHE_TTL) return null;
    return cache;
  } catch { return null; }
}

export async function fetchGoldPricePerDon(): Promise<number | null> {
  const cache = getCache();
  if (cache) return cache.pricePerDon;

  try {
    const res = await fetch(`${WORKER_URL}/api/gold`);
    if (!res.ok) return null;
    const data: any = await res.json();
    if (!data.pricePerDon) return null;
    const pricePerDon = data.pricePerDon as number;

    localStorage.setItem(GOLD_CACHE_KEY, JSON.stringify({
      pricePerDon,
      timestamp: Date.now(),
    }));

    return pricePerDon;
  } catch {
    return null;
  }
}
