interface Env {
  KV: KVNamespace;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// ── Naver 일별 종가 조회 ──
async function fetchHistoricalPrices(ticker: string, days = 30): Promise<Record<string, number>> {
  try {
    const url = `https://fchart.stock.naver.com/sise.nhn?symbol=${ticker}&timeframe=day&count=${days}&requestType=0`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return {};
    const text = await res.text();
    const matches = [...text.matchAll(/data="(\d{8})\|[^|]+\|[^|]+\|[^|]+\|([^|]+)\|/g)];
    const prices: Record<string, number> = {};
    for (const [, dateStr, closeStr] of matches) {
      const date = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
      prices[date] = parseInt(closeStr, 10);
    }
    return prices;
  } catch {
    return {};
  }
}

async function fetchCurrentPrice(ticker: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://polling.finance.naver.com/api/realtime/domestic/stock/${ticker}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    const item = data.datas?.[0];
    return item?.closePriceRaw ? parseInt(item.closePriceRaw, 10) : null;
  } catch {
    return null;
  }
}

function holdingValue(h: any, price?: number): number {
  if (h.isFund) return h.amount || 0;
  if (price) return price * h.quantity;
  return h.avgPrice * h.quantity;
}

function calcHoldings(accounts: any[], prices: Record<string, number>): number {
  return accounts.reduce((s: number, a: any) =>
    s + (a.cash || 0) + a.holdings.reduce((ss: number, h: any) => ss + holdingValue(h, prices[h.ticker]), 0), 0);
}

// ── 일일 스냅샷 저장 ──
async function runDailySnapshot(kv: KVNamespace) {
  const accounts: any[] = JSON.parse(await kv.get('accounts') || '[]');
  if (!accounts.length) return 'no accounts';

  const otherAssets: any[] = JSON.parse(await kv.get('otherAssets') || '[]');

  // 티커 수집
  const tickers = [...new Set(
    accounts.flatMap((a: any) => a.holdings.map((h: any) => h.ticker).filter((t: string) => t && /^[0-9A-Z]{6}$/i.test(t)))
  )] as string[];

  // 현재가 조회
  const prices: Record<string, number> = {};
  for (let i = 0; i < tickers.length; i += 10) {
    const batch = tickers.slice(i, i + 10);
    await Promise.all(batch.map(async (ticker) => {
      const price = await fetchCurrentPrice(ticker);
      if (price) prices[ticker] = price;
    }));
  }

  const wifeAccounts = accounts.filter((a: any) => a.owner === 'wife');
  const husbandAccounts = accounts.filter((a: any) => a.owner === 'husband');
  const totalAsset = calcHoldings(accounts, prices) + otherAssets.reduce((s: number, a: any) => s + a.amount, 0);
  const wifeTotal = calcHoldings(wifeAccounts, prices) + otherAssets.filter((a: any) => a.owner === 'wife').reduce((s: number, a: any) => s + a.amount, 0);
  const husbandTotal = calcHoldings(husbandAccounts, prices) + otherAssets.filter((a: any) => a.owner === 'husband').reduce((s: number, a: any) => s + a.amount, 0);

  const today = new Date().toISOString().slice(0, 10);
  const existing: any[] = JSON.parse(await kv.get('snapshots') || '[]');
  const prevSnap = existing.find((s: any) => s.date < today);
  const change = prevSnap ? totalAsset - prevSnap.totalAsset : 0;
  const rate = prevSnap && prevSnap.totalAsset > 0 ? (change / prevSnap.totalAsset) * 100 : 0;

  const snap = { date: today, totalAsset, wifeAsset: wifeTotal, husbandAsset: husbandTotal, assetChange: change, changeRate: rate };
  const idx = existing.findIndex((s: any) => s.date === today);
  if (idx >= 0) existing[idx] = snap;
  else existing.push(snap);
  const sorted = existing.filter((s: any) => s && s.date).sort((a: any, b: any) => b.date.localeCompare(a.date)).slice(0, 365);

  await kv.put('snapshots', JSON.stringify(sorted));
  return `saved: ${today} | ${Math.round(totalAsset).toLocaleString()}원`;
}

export default {
  // ── HTTP 요청 처리 ──
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // GET /kv/:key
    if (request.method === 'GET' && url.pathname.startsWith('/kv/')) {
      const key = url.pathname.slice(4);
      const value = await env.KV.get(key);
      if (value === null) return json(null);
      return json(JSON.parse(value));
    }

    // PUT /kv/:key
    if (request.method === 'PUT' && url.pathname.startsWith('/kv/')) {
      const key = url.pathname.slice(4);
      const body = await request.text();
      await env.KV.put(key, body);
      return json({ ok: true });
    }

    // POST /snapshot (수동 트리거)
    if (request.method === 'POST' && url.pathname === '/snapshot') {
      const result = await runDailySnapshot(env.KV);
      return json({ ok: true, result });
    }

    return json({ error: 'not found' }, 404);
  },

  // ── Cron 트리거 (매일 UTC 07:30 = KST 16:30) ──
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runDailySnapshot(env.KV));
  },
};
