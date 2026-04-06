// 매일 자산 스냅샷 저장 (GitHub Actions용)
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const TABLE = 'kv_store_cee564ea';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('SUPABASE_URL, SUPABASE_KEY 환경변수가 필요합니다.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function kvGet(key) {
  const { data, error } = await supabase.from(TABLE).select('value').eq('key', key).maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}

async function kvSet(key, value) {
  const { error } = await supabase.from(TABLE).upsert({ key, value });
  if (error) throw error;
}

async function fetchStockPrice(ticker) {
  try {
    const res = await fetch(
      `https://polling.finance.naver.com/api/realtime/domestic/stock/${ticker}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const item = data.datas?.[0];
    return item?.closePriceRaw ? parseInt(item.closePriceRaw, 10) : null;
  } catch { return null; }
}

function holdingValue(h, prices) {
  if (h.isFund) return h.amount || 0;
  if (h.ticker && prices[h.ticker]) return prices[h.ticker] * h.quantity;
  return h.avgPrice * h.quantity;
}

function calcHoldings(accs, prices) {
  return accs.reduce((s, a) =>
    s + (a.cash || 0) + a.holdings.reduce((ss, h) => ss + holdingValue(h, prices), 0), 0);
}

async function main() {
  console.log('[daily-snapshot] 시작');

  const accounts = await kvGet('accounts');
  if (!accounts || accounts.length === 0) {
    console.log('[daily-snapshot] 계좌 없음, 종료');
    return;
  }

  const otherAssets = (await kvGet('otherAssets')) || [];

  // 주가 조회
  const tickers = [...new Set(
    accounts.flatMap(a => a.holdings.map(h => h.ticker).filter(t => t && /^[0-9A-Z]{6}$/i.test(t)))
  )];
  const prices = {};
  for (let i = 0; i < tickers.length; i += 10) {
    const batch = tickers.slice(i, i + 10);
    await Promise.all(batch.map(async (ticker) => {
      const price = await fetchStockPrice(ticker);
      if (price) prices[ticker] = price;
    }));
  }
  console.log(`[daily-snapshot] 주가 조회: ${Object.keys(prices).length}/${tickers.length}개`);

  // 총자산 계산
  const wifeAccounts = accounts.filter(a => a.owner === 'wife');
  const husbandAccounts = accounts.filter(a => a.owner === 'husband');
  const totalAsset = calcHoldings(accounts, prices) + otherAssets.reduce((s, a) => s + a.amount, 0);
  const wifeTotal = calcHoldings(wifeAccounts, prices) + otherAssets.filter(a => a.owner === 'wife').reduce((s, a) => s + a.amount, 0);
  const husbandTotal = calcHoldings(husbandAccounts, prices) + otherAssets.filter(a => a.owner === 'husband').reduce((s, a) => s + a.amount, 0);

  // 스냅샷 저장
  const snapshots = (await kvGet('snapshots')) || [];
  const today = new Date().toISOString().slice(0, 10);
  const prevSnap = snapshots.find(s => s.date < today);
  const change = prevSnap ? totalAsset - prevSnap.totalAsset : 0;
  const rate = prevSnap && prevSnap.totalAsset > 0 ? (change / prevSnap.totalAsset) * 100 : 0;

  const snap = { date: today, totalAsset, wifeAsset: wifeTotal, husbandAsset: husbandTotal, assetChange: change, changeRate: rate };

  const existing = snapshots.filter(s => s && s.date);
  const idx = existing.findIndex(s => s.date === today);
  if (idx >= 0) existing[idx] = snap;
  else existing.push(snap);
  const sorted = existing.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 365);

  await kvSet('snapshots', sorted);
  console.log(`[daily-snapshot] 완료: ${today} | 총자산 ${Math.round(totalAsset).toLocaleString()}원 | 증감 ${change >= 0 ? '+' : ''}${Math.round(change).toLocaleString()}원`);
}

main().catch(err => {
  console.error('[daily-snapshot] 오류:', err);
  process.exit(1);
});
