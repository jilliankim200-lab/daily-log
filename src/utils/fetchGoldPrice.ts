// 네이버 금시세에서 금 1g 가격(KRW) 조회
// 1돈 = 3.75g

const GOLD_CACHE_KEY = 'gold_price_cache';
const GOLD_CACHE_TTL = 30 * 60 * 1000; // 30분 캐시

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
    const res = await fetch('/api/gold');
    if (!res.ok) return null;
    const html = await res.text();

    // 첫 번째 <td class="num">xxx,xxx.xx 가 금 1g 가격
    const match = html.match(/<td class="num">([\d,]+\.\d+)/);
    if (!match) return null;

    const pricePerGram = parseFloat(match[1].replace(/,/g, ''));
    const pricePerDon = Math.round(pricePerGram * 3.75);

    localStorage.setItem(GOLD_CACHE_KEY, JSON.stringify({
      pricePerDon,
      timestamp: Date.now(),
    }));

    return pricePerDon;
  } catch {
    return null;
  }
}
