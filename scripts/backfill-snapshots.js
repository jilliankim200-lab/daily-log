// 과거 2주 스냅샷 소급 계산 스크립트
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gvalfmtmslnykmwegwfi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2YWxmbXRtc2xueWttd2Vnd2ZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NTc2MTQsImV4cCI6MjA3ODQzMzYxNH0.kLOgm2ag31ZW3qD-AmVsp-yK2aCZcvIeU-Xn6D-wElw';
const TABLE = 'kv_store_cee564ea';

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

// Naver 일별 종가 조회 (XML)
async function fetchHistoricalPrices(ticker, days = 20) {
  try {
    const url = `https://fchart.stock.naver.com/sise.nhn?symbol=${ticker}&timeframe=day&count=${days}&requestType=0`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return {};
    const text = await res.text();
    // XML 파싱: <item data="20260409|open|high|low|close|volume"/>
    const matches = [...text.matchAll(/data="(\d{8})\|[^|]+\|[^|]+\|[^|]+\|([^|]+)\|/g)];
    const prices = {};
    for (const [, dateStr, closeStr] of matches) {
      const date = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
      prices[date] = parseInt(closeStr, 10);
    }
    return prices;
  } catch { return {}; }
}

function holdingValue(h, price) {
  if (h.isFund) return h.amount || 0;
  if (price) return price * h.quantity;
  return h.avgPrice * h.quantity;
}

function calcTotal(accounts, pricesByTicker, otherAssets) {
  const accountsTotal = accounts.reduce((s, a) =>
    s + (a.cash || 0) + a.holdings.reduce((ss, h) => ss + holdingValue(h, pricesByTicker[h.ticker]), 0), 0);
  const othersTotal = (otherAssets || []).reduce((s, a) => s + (a.amount || 0), 0);
  return accountsTotal + othersTotal;
}

async function main() {
  console.log('[backfill] 시작');

  const accounts = await kvGet('accounts');
  const otherAssets = (await kvGet('otherAssets')) || [];
  const snapshots = (await kvGet('snapshots')) || [];

  if (!accounts || accounts.length === 0) {
    console.log('[backfill] 계좌 없음');
    return;
  }

  // 과거 14일 날짜 목록 (오늘 제외)
  const dates = [];
  for (let i = 1; i <= 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  console.log('[backfill] 소급 대상:', dates.join(', '));

  // 모든 티커 수집
  const tickers = [...new Set(
    accounts.flatMap(a => a.holdings.map(h => h.ticker).filter(t => t && /^\d{6}$/.test(t)))
  )];
  console.log(`[backfill] 티커 ${tickers.length}개: ${tickers.join(', ')}`);

  // 티커별 날짜별 종가 수집
  const priceMap = {}; // { ticker: { date: price } }
  for (const ticker of tickers) {
    const prices = await fetchHistoricalPrices(ticker, 30);
    priceMap[ticker] = prices;
    const found = Object.keys(prices).length;
    if (found > 0) console.log(`  ${ticker}: ${found}일치 데이터`);
    await new Promise(r => setTimeout(r, 100)); // rate limit
  }

  const wifeAccounts = accounts.filter(a => a.owner === 'wife');
  const husbandAccounts = accounts.filter(a => a.owner === 'husband');
  const wifeOther = otherAssets.filter(a => a.owner === 'wife');
  const husbandOther = otherAssets.filter(a => a.owner === 'husband');

  // 날짜별 스냅샷 계산
  const newSnaps = [];
  for (const date of dates) {
    // 해당 날짜 티커별 가격 맵
    const dayPrices = {};
    for (const ticker of tickers) {
      if (priceMap[ticker][date]) dayPrices[ticker] = priceMap[ticker][date];
    }

    const pricesAvail = Object.keys(dayPrices).length;
    if (pricesAvail === 0) {
      console.log(`  ${date}: 주가 없음 (주말/공휴일), 건너뜀`);
      continue;
    }

    const wifeTotal = calcTotal(wifeAccounts, dayPrices, wifeOther);
    const husbandTotal = calcTotal(husbandAccounts, dayPrices, husbandOther);
    const totalAsset = wifeTotal + husbandTotal + otherAssets.filter(a => !a.owner || (a.owner !== 'wife' && a.owner !== 'husband')).reduce((s, a) => s + a.amount, 0);

    newSnaps.push({ date, totalAsset, wifeAsset: wifeTotal, husbandAsset: husbandTotal });
    console.log(`  ${date}: 총자산 ${Math.round(totalAsset).toLocaleString()}원 (주가 ${pricesAvail}/${tickers.length}개)`);
  }

  if (newSnaps.length === 0) {
    console.log('[backfill] 저장할 데이터 없음');
    return;
  }

  // 기존 스냅샷에 병합 (날짜가 겹치면 새 값으로 덮어씀, assetChange/changeRate는 재계산)
  const merged = [...snapshots];
  for (const snap of newSnaps) {
    const idx = merged.findIndex(s => s.date === snap.date);
    if (idx >= 0) merged[idx] = { ...merged[idx], ...snap };
    else merged.push(snap);
  }

  // 날짜 내림차순 정렬
  merged.sort((a, b) => b.date.localeCompare(a.date));

  // assetChange / changeRate 재계산
  for (let i = 0; i < merged.length; i++) {
    const prev = merged[i + 1];
    if (prev) {
      merged[i].assetChange = merged[i].totalAsset - prev.totalAsset;
      merged[i].changeRate = prev.totalAsset > 0 ? (merged[i].assetChange / prev.totalAsset) * 100 : 0;
    } else {
      merged[i].assetChange = merged[i].assetChange || 0;
      merged[i].changeRate = merged[i].changeRate || 0;
    }
  }

  await kvSet('snapshots', merged.slice(0, 365));
  console.log(`[backfill] 완료: ${newSnaps.length}개 날짜 저장`);
}

main().catch(err => {
  console.error('[backfill] 오류:', err);
  process.exit(1);
});
