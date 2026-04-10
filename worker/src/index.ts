interface Env {
  KV: KVNamespace;
  RESEND_API_KEY?: string;
  NOTIFICATION_EMAIL?: string;
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

// ── 최적가이드 타이밍 신호 (프론트엔드와 동일 로직) ──
interface StockDetail {
  currentPrice: number;
  ma20: number;
  ma60: number;
  high: number;
  low: number;
  position: number;
}

interface SignalLabels { sell: string; buy: string; }
type SignalSnapshot = Record<string, SignalLabels>;

interface SignalChangeItem {
  ticker: string;
  name: string;
  accounts: string[];
  prevSell: string; newSell: string;
  prevBuy: string;  newBuy: string;
  sellChanged: boolean; buyChanged: boolean;
}

function getSignalTrend(s: StockDetail): 'up' | 'sideways' | 'down' {
  if (s.currentPrice >= s.ma20 && s.currentPrice >= s.ma60) return 'up';
  if (s.currentPrice < s.ma20 && s.currentPrice < s.ma60) return 'down';
  return 'sideways';
}

function computeSellLabel(s: StockDetail): string {
  const trend = getSignalTrend(s);
  const pos = s.position;
  if (trend === 'up' && pos >= 0.7) return '매도 적합';
  if (trend === 'up') return '매도 가능';
  if (trend === 'sideways' && pos >= 0.5) return '매도 가능';
  if (trend === 'sideways') return '반등 대기';
  if (trend === 'down' && pos <= 0.3) return '저점 매도';
  return '반등 후 매도';
}

function computeBuyLabel(s: StockDetail): string {
  const trend = getSignalTrend(s);
  const pos = s.position;
  if (trend === 'down') return '반등 대기';
  if (trend === 'sideways' && pos <= 0.4) return '매수 적합';
  if (trend === 'sideways') return '분할 매수';
  if (trend === 'up' && pos >= 0.8) return '조정 대기';
  if (trend === 'up' && pos >= 0.6) return '분할 매수';
  return '매수 가능';
}

async function fetchStockDetail(ticker: string): Promise<StockDetail | null> {
  const histPrices = await fetchHistoricalPrices(ticker, 70);
  const priceArr = Object.entries(histPrices)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, p]) => p)
    .filter(p => p > 0);
  if (priceArr.length < 5) return null;
  const cur = priceArr[priceArr.length - 1];
  const slice20 = priceArr.slice(-20);
  const slice60 = priceArr.slice(-60);
  const ma20 = Math.round(slice20.reduce((s, p) => s + p, 0) / slice20.length);
  const ma60 = slice60.length >= 5 ? Math.round(slice60.reduce((s, p) => s + p, 0) / slice60.length) : ma20;
  const high = Math.max(...priceArr);
  const low = Math.min(...priceArr);
  const position = high > low ? Math.round((cur - low) / (high - low) * 100) / 100 : 0.5;
  return { currentPrice: cur, ma20, ma60, high, low, position };
}

function collectSignalChanges(
  accounts: any[],
  currentSignals: SignalSnapshot,
  prevSignals: SignalSnapshot
): SignalChangeItem[] {
  const tickerMap: Record<string, { name: string; accs: string[] }> = {};
  for (const acc of accounts) {
    for (const h of acc.holdings) {
      if (!h.ticker || h.isFund || !/^[0-9A-Z]{6}$/i.test(h.ticker)) continue;
      if (!tickerMap[h.ticker]) tickerMap[h.ticker] = { name: h.name, accs: [] };
      const label = `${acc.ownerName} · ${acc.alias || acc.institution}`;
      if (!tickerMap[h.ticker].accs.includes(label)) tickerMap[h.ticker].accs.push(label);
    }
  }
  const changes: SignalChangeItem[] = [];
  for (const [ticker, cur] of Object.entries(currentSignals)) {
    const prev = prevSignals[ticker];
    if (!prev) continue;
    const sellChanged = prev.sell !== cur.sell;
    const buyChanged = prev.buy !== cur.buy;
    if (!sellChanged && !buyChanged) continue;
    const info = tickerMap[ticker];
    if (!info) continue;
    changes.push({ ticker, name: info.name, accounts: info.accs, prevSell: prev.sell, newSell: cur.sell, prevBuy: prev.buy, newBuy: cur.buy, sellChanged, buyChanged });
  }
  return changes;
}

// ── 매도 신호 체크 (수익률 10% 이상) ──
interface SellItem {
  ownerName: string;
  accountAlias: string;
  name: string;
  ticker: string;
  avgPrice: number;
  currentPrice: number;
  changeRate: number;
  quantity: number;
}

function collectSellSignals(accounts: any[], prices: Record<string, number>): SellItem[] {
  const result: SellItem[] = [];
  for (const account of accounts) {
    for (const h of account.holdings) {
      if (h.isFund || !h.ticker) continue;
      const currentPrice = prices[h.ticker];
      if (!currentPrice || currentPrice <= 0) continue;
      const changeRate = ((currentPrice - h.avgPrice) / h.avgPrice) * 100;
      if (changeRate >= 10) {
        result.push({
          ownerName: account.ownerName,
          accountAlias: account.alias,
          name: h.name,
          ticker: h.ticker,
          avgPrice: h.avgPrice,
          currentPrice,
          changeRate,
          quantity: h.quantity,
        });
      }
    }
  }
  return result.sort((a, b) => b.changeRate - a.changeRate);
}

// ── 이메일 HTML 생성 ──
function buildEmailHtml(items: SellItem[], signalChanges: SignalChangeItem[], today: string): string {
  const fmt = (n: number) => n.toLocaleString('ko-KR');
  const rows = items.map(item => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;color:#555;white-space:nowrap;">${item.ownerName} · ${item.accountAlias}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-weight:600;white-space:nowrap;">${item.name}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:right;white-space:nowrap;">${fmt(item.avgPrice)}원</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;white-space:nowrap;">${fmt(item.currentPrice)}원</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:right;color:#f07178;font-weight:700;white-space:nowrap;">+${item.changeRate.toFixed(1)}%</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:right;color:#888;white-space:nowrap;">${fmt(item.quantity)}주</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:680px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

    <!-- 헤더 -->
    <div style="background:#1A2B4A;padding:28px 32px;">
      <p style="margin:0 0 6px;color:rgba(255,255,255,0.8);font-size:13px;">${today} 장 마감 기준</p>
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">📊 자산 알림</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:15px;">수익률 알림 <strong>${items.length}개</strong> · 신호 변화 <strong>${signalChanges.length}개</strong></p>
    </div>

    ${items.length > 0 ? `
    <!-- 매도 알림 섹션 -->
    <div style="padding:20px 24px 8px;">
      <h2 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#333;">📈 수익률 10% 이상 종목</h2>
    </div>
    <div style="padding:0 0 8px;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#fafafa;">
            <th style="padding:8px 14px;text-align:left;font-size:12px;color:#999;font-weight:500;border-bottom:1px solid #eee;">계좌</th>
            <th style="padding:8px 14px;text-align:left;font-size:12px;color:#999;font-weight:500;border-bottom:1px solid #eee;">종목</th>
            <th style="padding:8px 14px;text-align:right;font-size:12px;color:#999;font-weight:500;border-bottom:1px solid #eee;">평균단가</th>
            <th style="padding:8px 14px;text-align:right;font-size:12px;color:#999;font-weight:500;border-bottom:1px solid #eee;">현재가</th>
            <th style="padding:8px 14px;text-align:right;font-size:12px;color:#999;font-weight:500;border-bottom:1px solid #eee;">수익률</th>
            <th style="padding:8px 14px;text-align:right;font-size:12px;color:#999;font-weight:500;border-bottom:1px solid #eee;">수량</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>` : ''}

    ${signalChanges.length > 0 ? `
    <!-- 신호 변화 섹션 -->
    <div style="padding:20px 24px 8px;${items.length > 0 ? 'border-top:1px solid #f0f0f0;' : ''}">
      <h2 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#333;">🔔 최적가이드 신호 변화</h2>
    </div>
    <div style="padding:0 24px 16px;">
      ${signalChanges.map(c => `
        <div style="background:#fafafa;border-radius:10px;padding:12px 14px;margin-bottom:8px;">
          <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
            <span style="font-size:14px;font-weight:700;color:#191F28;">${c.name}</span>
            <span style="font-size:11px;color:#999;">${c.ticker}</span>
            <span style="font-size:11px;color:#aaa;">${c.accounts.join(', ')}</span>
          </div>
          ${c.sellChanged ? `
          <div style="margin-bottom:4px;">
            <span style="font-size:11px;color:#888;margin-right:6px;">매도</span>
            <span style="font-size:12px;color:#aaa;text-decoration:line-through;">${c.prevSell}</span>
            <span style="font-size:12px;color:#888;margin:0 4px;">→</span>
            <span style="font-size:12px;font-weight:700;color:#f07178;">${c.newSell}</span>
          </div>` : ''}
          ${c.buyChanged ? `
          <div>
            <span style="font-size:11px;color:#888;margin-right:6px;">매수</span>
            <span style="font-size:12px;color:#aaa;text-decoration:line-through;">${c.prevBuy}</span>
            <span style="font-size:12px;color:#888;margin:0 4px;">→</span>
            <span style="font-size:12px;font-weight:700;color:#3182F6;">${c.newBuy}</span>
          </div>` : ''}
        </div>
      `).join('')}
    </div>` : ''}

    ${items.length === 0 && signalChanges.length === 0 ? `
    <div style="padding:32px 24px;text-align:center;color:#bbb;font-size:13px;">
      오늘은 특별한 알림이 없습니다.
    </div>` : ''}

    <!-- 푸터 -->
    <div style="padding:20px 32px;background:#fafafa;border-top:1px solid #f0f0f0;">
      <p style="margin:0;font-size:12px;color:#bbb;">Asset Dashboard · 매일 KST 12:00 정오 자동 발송</p>
    </div>
  </div>
</body>
</html>`;
}

// ── Resend 이메일 발송 ──
async function sendDailyAlert(env: Env, items: SellItem[], signalChanges: SignalChangeItem[], today: string): Promise<void> {
  if (!env.RESEND_API_KEY || !env.NOTIFICATION_EMAIL) return;
  if (items.length === 0 && signalChanges.length === 0) return;

  const parts: string[] = [];
  if (items.length > 0) parts.push(`수익률 알림 ${items.length}개`);
  if (signalChanges.length > 0) parts.push(`신호변화 ${signalChanges.length}개`);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Asset Dashboard <onboarding@resend.dev>',
      to: env.NOTIFICATION_EMAIL,
      subject: `📊 자산 알림 · ${parts.join(' · ')} (${today})`,
      html: buildEmailHtml(items, signalChanges, today),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Resend error:', err);
  }
}

// ── 일일 스냅샷 저장 + 매도 알림 ──
async function runDailySnapshot(env: Env) {
  const kv = env.KV;
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

  const today = new Date().toISOString().slice(0, 10);

  // 타이밍 신호 계산 (3개씩 배치)
  const currentSignals: SignalSnapshot = {};
  for (let i = 0; i < tickers.length; i += 3) {
    const batch = tickers.slice(i, i + 3);
    await Promise.all(batch.map(async (ticker) => {
      const detail = await fetchStockDetail(ticker);
      if (detail) {
        currentSignals[ticker] = {
          sell: computeSellLabel(detail),
          buy: computeBuyLabel(detail),
        };
      }
    }));
  }

  // 전날 신호와 비교
  const prevSignalsRaw = await env.KV.get('signal_snapshot');
  const prevSignals: SignalSnapshot = prevSignalsRaw ? JSON.parse(prevSignalsRaw) : {};
  const signalChanges = collectSignalChanges(accounts, currentSignals, prevSignals);

  // 매도 신호 체크 및 이메일 발송 (스냅샷과 병렬 실행)
  const sellItems = collectSellSignals(accounts, prices);
  const emailPromise = sendDailyAlert(env, sellItems, signalChanges, today);

  const wifeAccounts = accounts.filter((a: any) => a.owner === 'wife');
  const husbandAccounts = accounts.filter((a: any) => a.owner === 'husband');
  const totalAsset = calcHoldings(accounts, prices) + otherAssets.reduce((s: number, a: any) => s + a.amount, 0);
  const wifeTotal = calcHoldings(wifeAccounts, prices) + otherAssets.filter((a: any) => a.owner === 'wife').reduce((s: number, a: any) => s + a.amount, 0);
  const husbandTotal = calcHoldings(husbandAccounts, prices) + otherAssets.filter((a: any) => a.owner === 'husband').reduce((s: number, a: any) => s + a.amount, 0);

  const existing: any[] = JSON.parse(await kv.get('snapshots') || '[]');
  const prevSnap = existing.find((s: any) => s.date < today);
  const change = prevSnap ? totalAsset - prevSnap.totalAsset : 0;
  const rate = prevSnap && prevSnap.totalAsset > 0 ? (change / prevSnap.totalAsset) * 100 : 0;

  const snap = { date: today, totalAsset, wifeAsset: wifeTotal, husbandAsset: husbandTotal, assetChange: change, changeRate: rate };
  const idx = existing.findIndex((s: any) => s.date === today);
  if (idx >= 0) existing[idx] = snap;
  else existing.push(snap);
  const sorted = existing.filter((s: any) => s && s.date).sort((a: any, b: any) => b.date.localeCompare(a.date)).slice(0, 365);

  await Promise.all([
    kv.put('snapshots', JSON.stringify(sorted)),
    kv.put('signal_snapshot', JSON.stringify(currentSignals)),
    emailPromise,
  ]);

  return `saved: ${today} | ${Math.round(totalAsset).toLocaleString()}원 | 매도신호: ${sellItems.length}종목 | 신호변화: ${signalChanges.length}종목`;
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
      const result = await runDailySnapshot(env);
      return json({ ok: true, result });
    }

    // GET /exchange-rates
    if (request.method === 'GET' && url.pathname === '/exchange-rates') {
      try {
        const [usdRes, jpyRes] = await Promise.all([
          fetch('https://api.stock.naver.com/marketindex/exchange/FX_USDKRW', { headers: { 'User-Agent': 'Mozilla/5.0' } }),
          fetch('https://api.stock.naver.com/marketindex/exchange/FX_JPYKRW', { headers: { 'User-Agent': 'Mozilla/5.0' } }),
        ]);
        const [usdData, jpyData]: any[] = await Promise.all([usdRes.json(), jpyRes.json()]);
        return json({
          usd: parseFloat(usdData.closePrice?.replace(/,/g, '') || '0'),
          jpy: parseFloat(jpyData.closePrice?.replace(/,/g, '') || '0'),
        });
      } catch {
        return json({ usd: 0, jpy: 0 });
      }
    }

    // GET /market-indices
    if (request.method === 'GET' && url.pathname === '/market-indices') {
      try {
        const [kospiRes, kosdaqRes, nasdaqRes, sp500Res] = await Promise.all([
          fetch('https://polling.finance.naver.com/api/realtime/domestic/index/KOSPI', { headers: { 'User-Agent': 'Mozilla/5.0' } }),
          fetch('https://polling.finance.naver.com/api/realtime/domestic/index/KOSDAQ', { headers: { 'User-Agent': 'Mozilla/5.0' } }),
          fetch('https://polling.finance.naver.com/api/realtime/worldstock/index/.IXIC', { headers: { 'User-Agent': 'Mozilla/5.0' } }),
          fetch('https://polling.finance.naver.com/api/realtime/worldstock/index/.INX', { headers: { 'User-Agent': 'Mozilla/5.0' } }),
        ]);
        const parseIndex = async (res: Response, name: string) => {
          try {
            const d: any = await res.json();
            const item = d.datas?.[0] ?? d;
            const cp = parseFloat(String(item.closePrice ?? item.currentValue ?? 0).replace(/,/g, ''));
            const ch = parseFloat(String(item.compareToPreviousClosePrice ?? item.change ?? 0).replace(/,/g, ''));
            const pct = parseFloat(String(item.fluctuationsRatio ?? item.changePercent ?? 0).replace(/,/g, ''));
            return { name, currentPrice: cp, change: ch, changePercent: pct };
          } catch { return { name, currentPrice: 0, change: 0, changePercent: 0, error: 'fetch failed' }; }
        };
        const [kospi, kosdaq, nasdaq, sp500] = await Promise.all([
          parseIndex(kospiRes, 'KOSPI'),
          parseIndex(kosdaqRes, 'KOSDAQ'),
          parseIndex(nasdaqRes, 'NASDAQ'),
          parseIndex(sp500Res, 'S&P500'),
        ]);
        return json({ kospi, kosdaq, nasdaq, sp500, lastUpdated: new Date().toISOString() });
      } catch {
        return json({ lastUpdated: new Date().toISOString() });
      }
    }

    // GET /stock-chart/:ticker?days=90 — 일별 종가 배열
    if (request.method === 'GET' && url.pathname.startsWith('/stock-chart/')) {
      const ticker = url.pathname.slice('/stock-chart/'.length).split('?')[0];
      const days = Math.min(parseInt(url.searchParams.get('days') || '90'), 250);
      if (!/^[0-9A-Z]{6}$/i.test(ticker)) return json({ error: 'invalid ticker' }, 400);

      const hist = await fetchHistoricalPrices(ticker, days);
      const sorted = Object.entries(hist)
        .filter(([, p]) => p > 0)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, price]) => ({ date, price }));

      return json(sorted);
    }

    // GET /stock-price/:ticker — 현재가 + 등락률 (프론트엔드 실시간 시세용)
    if (request.method === 'GET' && url.pathname.startsWith('/stock-price/')) {
      const ticker = url.pathname.slice('/stock-price/'.length).split('?')[0];
      if (!/^[0-9A-Z]{6}$/i.test(ticker)) return json({ error: 'invalid ticker' }, 400);
      const price = await fetchCurrentPrice(ticker);
      if (price === null) return json({ error: 'no data' }, 404);
      return json({ ticker, currentPrice: price });
    }

    // GET /stock-prices?tickers=005930,069500,... — 복수 현재가 일괄 조회
    if (request.method === 'GET' && url.pathname === '/stock-prices') {
      const raw = url.searchParams.get('tickers') || '';
      const tickers = raw.split(',').map(t => t.trim()).filter(t => /^[0-9A-Z]{6}$/i.test(t));
      if (tickers.length === 0) return json({});
      const entries = await Promise.all(
        tickers.map(async t => [t, await fetchCurrentPrice(t)] as [string, number | null])
      );
      const result: Record<string, number> = {};
      for (const [t, p] of entries) { if (p !== null) result[t] = p; }
      return json(result);
    }

    // GET /stock-detail/:ticker — MA20, MA60, 70일 고저점
    if (request.method === 'GET' && url.pathname.startsWith('/stock-detail/')) {
      const ticker = url.pathname.slice('/stock-detail/'.length).split('?')[0];
      if (!/^[0-9A-Z]{6}$/i.test(ticker)) return json({ error: 'invalid ticker' }, 400);

      const histPrices = await fetchHistoricalPrices(ticker, 70);
      const priceArr = Object.entries(histPrices)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, p]) => p)
        .filter(p => p > 0);

      if (priceArr.length < 5) return json({ error: 'no data' }, 404);

      const cur = priceArr[priceArr.length - 1];
      const slice20 = priceArr.slice(-20);
      const slice60 = priceArr.slice(-60);
      const ma20 = Math.round(slice20.reduce((s, p) => s + p, 0) / slice20.length);
      const ma60 = Math.round(slice60.reduce((s, p) => s + p, 0) / slice60.length);
      const high = Math.max(...priceArr);
      const low = Math.min(...priceArr);
      const position = high > low ? (cur - low) / (high - low) : 0.5; // 0=저점 1=고점

      return json({ ticker, currentPrice: cur, ma20, ma60, high, low, position: Math.round(position * 100) / 100 });
    }

    return json({ error: 'not found' }, 404);
  },

  // ── Cron 트리거 (매일 UTC 07:00 = KST 16:00) ──
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runDailySnapshot(env));
  },
};
