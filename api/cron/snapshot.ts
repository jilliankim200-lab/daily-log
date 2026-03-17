import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gvalfmtmslnykmwegwfi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2YWxmbXRtc2xueWttd2Vnd2ZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NTc2MTQsImV4cCI6MjA3ODQzMzYxNH0.kLOgm2ag31ZW3qD-AmVsp-yK2aCZcvIeU-Xn6D-wElw';
const TABLE = 'kv_store_cee564ea';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function kvGet<T>(key: string): Promise<T | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}

async function kvSet(key: string, value: unknown): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .upsert({ key, value });
  if (error) throw error;
}

interface Holding {
  name: string;
  ticker: string;
  avgPrice: number;
  quantity: number;
  isFund?: boolean;
  amount?: number;
}

interface Account {
  owner: string;
  holdings: Holding[];
  cash?: number;
}

interface DailySnapshot {
  date: string;
  totalAsset: number;
  wifeAsset: number;
  husbandAsset: number;
  assetChange: number;
  changeRate: number;
}

interface OtherAsset {
  owner: string;
  amount: number;
}

async function fetchStockPrice(ticker: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://polling.finance.naver.com/api/realtime/domestic/stock/${ticker}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const item = data.datas?.[0];
    if (item?.closePriceRaw) return parseInt(item.closePriceRaw, 10);
    return null;
  } catch { return null; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // 1. Fetch accounts
    const accounts = await kvGet<Account[]>('accounts');
    if (!accounts || accounts.length === 0) {
      return res.status(200).json({ message: 'No accounts found, skipping' });
    }

    // 2. Fetch other assets
    const otherAssets = (await kvGet<OtherAsset[]>('otherAssets')) || [];

    // 3. Fetch current prices for all tickers
    const tickers = [...new Set(
      accounts.flatMap(a => a.holdings.map(h => h.ticker).filter(Boolean).filter(t => /^[0-9A-Z]{6}$/i.test(t)))
    )];
    const prices: Record<string, number> = {};
    const batchSize = 10;
    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      await Promise.all(batch.map(async (ticker) => {
        const price = await fetchStockPrice(ticker);
        if (price) prices[ticker] = price;
      }));
    }

    // 4. Calculate totals
    function holdingValue(h: Holding): number {
      if (h.isFund) return h.amount || 0;
      if (h.ticker && prices[h.ticker]) return prices[h.ticker] * h.quantity;
      return h.avgPrice * h.quantity;
    }

    function calcHoldings(accs: Account[]): number {
      return accs.reduce((s, a) => s + (a.cash || 0) + a.holdings.reduce((ss, h) => ss + holdingValue(h), 0), 0);
    }

    const wifeAccounts = accounts.filter(a => a.owner === 'wife');
    const husbandAccounts = accounts.filter(a => a.owner === 'husband');
    const wifeHoldings = calcHoldings(wifeAccounts);
    const husbandHoldings = calcHoldings(husbandAccounts);
    const wifeOther = otherAssets.filter(a => a.owner === 'wife').reduce((s, a) => s + a.amount, 0);
    const husbandOther = otherAssets.filter(a => a.owner === 'husband').reduce((s, a) => s + a.amount, 0);
    const otherTotal = otherAssets.reduce((s, a) => s + a.amount, 0);
    const totalAsset = calcHoldings(accounts) + otherTotal;
    const wifeTotal = wifeHoldings + wifeOther;
    const husbandTotal = husbandHoldings + husbandOther;

    // 5. Get existing snapshots
    const snapshots = (await kvGet<DailySnapshot[]>('snapshots')) || [];
    const today = new Date().toISOString().slice(0, 10);

    // Find previous day snapshot for change calculation
    const prevSnap = snapshots.find(s => s.date < today);
    const change = prevSnap ? totalAsset - prevSnap.totalAsset : 0;
    const rate = prevSnap && prevSnap.totalAsset > 0 ? (change / prevSnap.totalAsset) * 100 : 0;

    // 6. Create today's snapshot
    const snap: DailySnapshot = {
      date: today,
      totalAsset,
      wifeAsset: wifeTotal,
      husbandAsset: husbandTotal,
      assetChange: change,
      changeRate: rate,
    };

    // 7. Upsert into snapshots
    const existing = snapshots.filter(s => s && s.date);
    const idx = existing.findIndex(s => s.date === today);
    if (idx >= 0) existing[idx] = snap;
    else existing.push(snap);
    const sorted = existing.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 365);

    await kvSet('snapshots', sorted);

    res.status(200).json({
      message: `Snapshot saved for ${today}`,
      totalAsset,
      pricesLoaded: Object.keys(prices).length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Cron snapshot failed' });
  }
}
