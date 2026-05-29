interface Env {
  KV: KVNamespace;
  RESEND_API_KEY?: string;
  NOTIFICATION_EMAIL?: string;
  ANTHROPIC_API_KEY?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

async function fetchCurrentPriceWithChange(ticker: string): Promise<{ price: number; changeRate: number } | null> {
  try {
    const res = await fetch(
      `https://polling.finance.naver.com/api/realtime/domestic/stock/${ticker}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    const item = data.datas?.[0];
    if (!item?.closePriceRaw) return null;
    const price = parseInt(item.closePriceRaw, 10);
    const changeRate = parseFloat(String(item.fluctuationsRatio ?? item.fluctuationsRatioRaw ?? 0).replace(/,/g, ''));
    return { price, changeRate };
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
  const range = slice60.length >= 5 ? slice60 : priceArr;
  const high = Math.max(...range);
  const low = Math.min(...range);
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

// ── 주간 ETF 랭킹 업데이트 ──
async function fetchAndStoreEtfRanking(env: Env): Promise<string> {
  try {
    const allData: any[] = [];
    let page = 1;
    const limit = 50;

    // 전체 데이터 페이징 (최대 200개)
    while (allData.length < 200) {
      const res = await fetch(
        `https://search-etf.com/backend/api/v2/get_monthly_etf.php?page=${page}&limit=${limit}&sortBy=dividend_rate&sortOrder=desc`,
        { headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'ko-KR,ko;q=0.9',
          'Referer': 'https://search-etf.com/month_dividend.php',
          'Origin': 'https://search-etf.com',
        }}
      );
      if (!res.ok) break;
      const body: any = await res.json();
      const items: any[] = body.data || [];
      if (items.length === 0) break;

      for (const e of items) {
        allData.push({
          rank: allData.length + 1,
          name: e.stock_name,
          ticker: e.stock_code,
          price: e.current_price ?? e.price ?? 0,
          priceChange: e.price_change ?? e.prdy_vrss ?? 0,
          priceChangeRate: e.price_change_rate ?? 0,
          recentDividend: e.latest_dividend ?? 0,
          annualYield: e.dividend_rate_1year ?? e.dividend_rate ?? 0,
          singleDividendRate: e.single_dividend_rate ?? 0,
          actualDividendDate: e.actual_dividend_date ?? '',
          dividendTiming: e.dividend_timing ?? '',
          retirementOk: e.retirement_pension_investment_limit === '100%',
          personalPension: e.personal_pension_verification === 'true',
        });
      }

      if (!body.pagination?.has_more) break;
      page++;
    }

    const updatedAt = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    await env.KV.put('etf_ranking', JSON.stringify({ data: allData, updatedAt }));
    return `etf_ranking updated: ${allData.length}개, ${updatedAt}`;
  } catch (err) {
    console.error('fetchAndStoreEtfRanking error:', err);
    return `etf_ranking error: ${String(err)}`;
  }
}

// ── 37개 ETF 모멘텀 크래시 신호 계산 & KV 저장 ──
async function updateCrashSignals(env: Env): Promise<string> {
  const ETFS = [
    { ticker: '456600', name: 'TIME 글로벌AI인공지능', cat: '국내주식' },
    { ticker: '483340', name: 'ACE 구글밸류체인액티브', cat: '국내주식' },
    { ticker: '381180', name: 'TIGER 미국필라델피아반', cat: '국내주식' },
    { ticker: '491010', name: 'TIGER 글로벌AI전력인', cat: '국내주식' },
    { ticker: '498400', name: 'KODEX 200타겟위클리', cat: '국내주식' },
    { ticker: '226490', name: 'KODEX 코스피100', cat: '국내주식' },
    { ticker: '487230', name: 'KODEX 미국AI전력핵심', cat: '국내주식' },
    { ticker: '469170', name: 'ACE 포스코그룹포커스', cat: '국내주식' },
    { ticker: '486450', name: 'SOL 미국AI전력인프라', cat: '국내주식' },
    { ticker: '465580', name: 'ACE 미국빅테크TOP7', cat: '국내주식' },
    { ticker: '133690', name: 'TIGER 미국나스닥100', cat: '국내주식' },
    { ticker: '161510', name: 'PLUS 고배당주', cat: '국내주식' },
    { ticker: '491620', name: 'RISE 미국테크100데일', cat: '국내주식' },
    { ticker: '229200', name: 'KODEX 코스닥150', cat: '국내주식' },
    { ticker: '232080', name: 'TIGER 코스닥150', cat: '국내주식' },
    { ticker: '466940', name: 'TIGER 은행고배당플러스', cat: '국내주식' },
    { ticker: '360200', name: 'ACE 미국S&P500', cat: '국내주식' },
    { ticker: '379800', name: 'KODEX 미국S&P500', cat: '국내주식' },
    { ticker: '438100', name: 'ACE 미국나스닥100채권', cat: '국내채권' },
    { ticker: '448540', name: 'ACE 엔비디아채권혼합', cat: '국내채권' },
    { ticker: '453870', name: 'TIGER 미국배당다우존스', cat: '국내주식' },
    { ticker: '453810', name: 'KODEX 인도Nifty5', cat: '국내주식' },
    { ticker: '447770', name: 'TIGER 테슬라채권혼합F', cat: '국내채권' },
    { ticker: '489030', name: 'PLUS 고배당주위클리커버', cat: '국내주식' },
    { ticker: '272580', name: 'TIGER 단기채권액티브', cat: '국내채권' },
    { ticker: '475630', name: 'TIGER CD1년금리액티', cat: '원자재/기타' },
    { ticker: '148070', name: 'KIWOOM 국고채10년', cat: '국내주식' },
    { ticker: '475080', name: 'KODEX 테슬라커버드콜채', cat: '국내채권' },
    { ticker: '153130', name: 'KODEX 단기채권', cat: '국내채권' },
    { ticker: '402970', name: 'ACE 미국배당다우존스', cat: '국내주식' },
    { ticker: '481060', name: 'KODEX 미국30년국채타', cat: '국내채권' },
    { ticker: '453850', name: 'ACE 미국30년국채액티브', cat: '국내채권' },
    { ticker: '458250', name: 'TIGER 미국30년국채스', cat: '국내채권' },
    { ticker: '411060', name: 'ACE KRX금현물', cat: '원자재/기타' },
    { ticker: '308620', name: 'KODEX 미국10년국채선', cat: '국내채권' },
    { ticker: '305080', name: 'TIGER 미국채10년선물', cat: '국내채권' },
    { ticker: '473330', name: 'SOL 미국30년국채커버드', cat: '국내채권' },
  ];

  const results: { ticker: string; name: string; cat: string; r1m: number | null; r3m: number | null; r6m: number | null; r12m: number | null }[] = [];
  const BATCH = 5;

  for (let i = 0; i < ETFS.length; i += BATCH) {
    const batch = ETFS.slice(i, i + BATCH);
    const batchResults = await Promise.all(batch.map(async etf => {
      const prices = await fetchHistoricalPrices(etf.ticker, 270);
      const dates = Object.keys(prices).sort();
      if (dates.length < 10) return { ...etf, r1m: null, r3m: null, r6m: null, r12m: null };
      const latest = prices[dates[dates.length - 1]];
      const calc = (offset: number) => {
        const idx = Math.max(0, dates.length - offset);
        const past = prices[dates[idx]];
        return past > 0 ? Math.round(((latest / past) - 1) * 1000) / 10 : null;
      };
      return { ...etf, r1m: calc(23), r3m: calc(66), r6m: calc(131), r12m: calc(262) };
    }));
    results.push(...batchResults);
  }

  const updatedAt = new Date().toISOString().slice(0, 10);
  await env.KV.put('crash_signals', JSON.stringify({ data: results, updatedAt }));
  const greenCount = results.filter(r => r.r3m !== null && r.r6m !== null && r.r3m > 0 && r.r6m > 0).length;
  return `crash_signals updated: ${results.length} ETFs, GREEN=${greenCount}, ${updatedAt}`;
}

// ── 듀얼 모멘텀 신호 계산 & KV 저장 ──
async function updateMomentumSignal(env: Env): Promise<string> {
  const ASSETS = [
    { name: '반도체',    ticker: '091160' },
    { name: '코스피200', ticker: '069500' },
    { name: '코스닥150', ticker: '229200' },
    { name: '나스닥100', ticker: '133690' },
    { name: 'S&P500',    ticker: '360750' },
    { name: '금',        ticker: '411060' },
    { name: '미국장기채', ticker: '305080' },
  ];
  const SAFE = { name: '단기채권', ticker: '153130' };

  // 자산별 6M 수익률 계산
  const results: { name: string; ticker: string; r6m: number | null }[] = [];
  for (const asset of ASSETS) {
    const prices = await fetchHistoricalPrices(asset.ticker, 140);
    const dates = Object.keys(prices).sort();
    if (dates.length < 20) { results.push({ ...asset, r6m: null }); continue; }
    const latest = prices[dates[dates.length - 1]];
    const idx6m  = Math.max(0, dates.length - 131);   // ~6개월 전
    const past   = prices[dates[idx6m]];
    const r6m    = past > 0 ? Math.round(((latest / past) - 1) * 1000) / 10 : null;
    results.push({ ...asset, r6m });
  }

  // 상대 모멘텀: 6M 수익률 1위 선택
  const valid = results.filter(a => a.r6m !== null) as { name: string; ticker: string; r6m: number }[];
  valid.sort((a, b) => b.r6m - a.r6m);
  const top = valid[0];

  // 절대 모멘텀: 1위 자산의 6M > 0 이면 보유, 아니면 단기채권
  const isSafe     = !top || top.r6m <= 0;
  const signalName = isSafe ? SAFE.name   : top.name;
  const signalTick = isSafe ? SAFE.ticker : top.ticker;
  const signalR6m  = isSafe ? 0           : top.r6m;

  // 시장 국면 판단
  const positiveCount = valid.filter(a => a.r6m > 0).length;
  const marketPhase = isSafe ? '약세장'
    : positiveCount >= 5 ? '강세장'
    : positiveCount >= 3 ? '상승장' : '혼조';

  // 다음 리밸런싱 월 — 이번 달 말 (월 1회 리밸런싱 원칙: 당월 말에 실행)
  const now = new Date();
  const nextRebalancing = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const data = {
    updatedAt: now.toISOString().slice(0, 10),
    marketPhase,
    topAsset: signalName,
    topTicker: signalTick,
    topR6m: signalR6m,
    isSafe,
    assets: results,
    nextRebalancing,
  };

  // 자산 교체 감지 → 리밸런싱 이력 저장
  const prevRaw = await env.KV.get('momentum_signal');
  if (prevRaw) {
    const prev = JSON.parse(prevRaw);
    const prevAsset = prev.isSafe ? '단기채권' : prev.topAsset;
    const newAsset  = data.isSafe  ? '단기채권' : data.topAsset;
    if (prevAsset !== newAsset) {
      const history: any[] = JSON.parse(await env.KV.get('rebalancing_history') || '[]');
      history.unshift({
        date:        data.updatedAt,
        from:        prevAsset,
        fromTicker:  prev.isSafe ? '153130' : prev.topTicker,
        fromR6m:     prev.topR6m,
        to:          newAsset,
        toTicker:    data.isSafe ? '153130' : data.topTicker,
        toR6m:       data.topR6m,
        marketPhase: data.marketPhase,
      });
      await env.KV.put('rebalancing_history', JSON.stringify(history.slice(0, 36)));
    }
  }

  await env.KV.put('momentum_signal', JSON.stringify(data));
  return `momentum_signal updated: ${signalName} r6m=${signalR6m}% (${marketPhase})`;
}

// ── 일일 보고서 생성 ──
function parseKV<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw.replace(/^﻿/, '')); } catch { return fallback; }
}

async function generateDailyReport(env: Env, date: string, snapshotsOverride?: any[]): Promise<string> {
  const snapshots: any[] = snapshotsOverride ?? parseKV(await env.KV.get('snapshots'), []);

  const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');
  const fmtSigned = (n: number) => {
    const abs = Math.round(Math.abs(n)).toLocaleString('ko-KR');
    return (n >= 0 ? '+' : '-') + abs;
  };
  const fmtRate = (r: number) => (r >= 0 ? '+' : '-') + Math.abs(r).toFixed(2) + '%';

  const sorted = snapshots.filter((s: any) => s && s.date).sort((a: any, b: any) => b.date.localeCompare(a.date));
  const enriched = sorted.map((s: any, i: number) => {
    const prev = sorted[i + 1];
    const change = prev ? s.totalAsset - prev.totalAsset : 0;
    const rate = prev && prev.totalAsset > 0 ? (change / prev.totalAsset) * 100 : 0;
    return { ...s, assetChange: change, changeRate: rate };
  });

  // 해당 날짜 이하의 스냅샷만 사용 (과거 날짜 보고서 재생성 시 미래 데이터 혼입 방지)
  const relevant = enriched.filter((s: any) => s.date <= date);
  const snap = relevant[0];
  if (!snap) return `[${date}] 저장된 데이터 없음`;

  const recent14 = relevant.slice(0, 14);

  let txt = '';
  txt += '================================================================\n';
  txt += '  자산 일일 보고서\n';
  txt += `  날짜: ${snap.date}\n`;
  txt += '================================================================\n\n';

  txt += '[자산 요약]\n';
  txt += `  부부 합산   : ${fmt(snap.totalAsset)}원\n`;
  txt += `  전일 대비   : ${fmtSigned(snap.assetChange)}원 (${fmtRate(snap.changeRate)})\n`;
  txt += `  지 윤       : ${fmt(snap.wifeAsset)}원\n`;
  txt += `  오 빠       : ${fmt(snap.husbandAsset)}원\n\n`;

  txt += '[자산 증감 내역 (최근 14일)]\n';
  txt += '  날짜                       총 자산          자산 증감      증감률\n';
  txt += '  ----------------------------------------------------------\n';
  for (const s of recent14) {
    txt += `  ${s.date}       ${fmt(s.totalAsset).padStart(15)}원    ${fmtSigned(s.assetChange).padStart(12)}원   ${fmtRate(s.changeRate).padStart(7)}\n`;
  }
  txt += '\n';

  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  txt += '================================================================\n';
  txt += `  생성 시각: ${kstNow.toISOString().slice(0, 10)} ${kstNow.toISOString().slice(11, 16)} KST\n`;
  txt += '================================================================\n';

  return txt;
}

async function saveDailyReport(env: Env, date: string, content: string): Promise<void> {
  await env.KV.put(`daily_report:${date}`, content);
  const existing: string[] = JSON.parse(await env.KV.get('daily_report_dates') || '[]');
  if (!existing.includes(date)) {
    existing.unshift(date);
    existing.sort((a, b) => b.localeCompare(a));
    await env.KV.put('daily_report_dates', JSON.stringify(existing.slice(0, 365)));
  }
}

// ── Cron 실행 로그 저장 ──
async function saveCronLog(env: Env, results: string[]): Promise<void> {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const entry = {
    ts: kstNow.toISOString().slice(0, 19).replace('T', ' ') + ' KST',
    results,
  };
  const existing: any[] = JSON.parse(await env.KV.get('cron_log') || '[]');
  existing.unshift(entry);
  await env.KV.put('cron_log', JSON.stringify(existing.slice(0, 30)));
}

// ── 모멘텀 신호 히스토리 저장 (최근 90일) ──
async function saveMomentumHistory(env: Env): Promise<void> {
  const current = await env.KV.get('momentum_signal');
  if (!current) return;
  const data = JSON.parse(current);
  const history: any[] = JSON.parse(await env.KV.get('momentum_signal_history') || '[]');
  const filtered = history.filter((h: any) => h.updatedAt !== data.updatedAt);
  filtered.unshift({
    updatedAt: data.updatedAt,
    topAsset: data.topAsset,
    topTicker: data.topTicker,
    topR6m: data.topR6m,
    isSafe: data.isSafe,
    marketPhase: data.marketPhase,
  });
  await env.KV.put('momentum_signal_history', JSON.stringify(filtered.slice(0, 90)));
}

// ── 일일 스냅샷 저장 + 매도 알림 ──
async function runDailySnapshot(env: Env, dateOverride?: string) {
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

  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  // dateOverride: cron에서 "전날 날짜"를 명시적으로 전달 (새벽 2시 실행 = 전일 장 마감 데이터)
  const today = dateOverride ?? kstNow.toISOString().slice(0, 10);

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

  // 스냅샷 저장 먼저 — 이메일/신호 실패가 스냅샷을 날리지 않도록 분리
  await kv.put('snapshots', JSON.stringify(sorted));

  // 기타 자산 일별 스냅샷 저장
  const existingOtherSnaps: any[] = JSON.parse(await kv.get('other_asset_snapshots') || '[]');
  const otherSnap = { date: today, assets: otherAssets.map((a: any) => ({ id: a.id, name: a.name, owner: a.owner, amount: a.amount })) };
  const otherIdx = existingOtherSnaps.findIndex((s: any) => s.date === today);
  if (otherIdx >= 0) existingOtherSnaps[otherIdx] = otherSnap;
  else existingOtherSnaps.push(otherSnap);
  const sortedOtherSnaps = existingOtherSnaps
    .filter((s: any) => s && s.date)
    .sort((a: any, b: any) => b.date.localeCompare(a.date))
    .slice(0, 365);
  await kv.put('other_asset_snapshots', JSON.stringify(sortedOtherSnaps));

  // 이메일·신호 저장은 실패해도 스냅샷에 영향 없음
  const sellItems = collectSellSignals(accounts, prices);
  await Promise.allSettled([
    kv.put('signal_snapshot', JSON.stringify(currentSignals)),
    sendDailyAlert(env, sellItems, signalChanges, today).catch(e => console.error('email failed:', e)),
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
      if (value === null) return new Response('null', { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
      return new Response(value, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    // PUT /kv/:key
    if (request.method === 'PUT' && url.pathname.startsWith('/kv/')) {
      const key = url.pathname.slice(4);
      const body = await request.text();
      await env.KV.put(key, body);
      return json({ ok: true });
    }

    // POST /ai-chart-opinion — Anthropic API로 차트 데이터 분석
    if (request.method === 'POST' && url.pathname === '/ai-chart-opinion') {
      if (!env.ANTHROPIC_API_KEY) return json({ error: 'API key not configured' }, 500);
      try {
        const body: {
          name: string; ticker: string;
          currentPrice: number; changeRate: number;
          ma5: number | null; ma20: number | null; ma60: number | null;
          high60: number; low60: number; range60: number | null;
          mainLabel: string;
          recentPrices: number[];
        } = await request.json();

        const fmt = (n: number) => n.toLocaleString('ko-KR');
        const diff = (a: number, b: number | null) => b ? ((a - b) / b * 100).toFixed(1) : '—';
        const rangePct = body.range60 != null ? Math.round(body.range60 * 100) : null;

        const recentChange = body.recentPrices.length >= 2
          ? ((body.recentPrices[body.recentPrices.length - 1] - body.recentPrices[0]) / body.recentPrices[0] * 100).toFixed(1)
          : null;

        const prompt = `한국 주식/ETF 차트 분석가로서 아래 데이터를 바탕으로 현재 상황을 2~3문장으로 분석해줘.
수치를 직접 언급하고 구체적으로 말해줘. 마크다운 없이 순수 텍스트로.

종목: ${body.name} (${body.ticker})
현재가: ${fmt(body.currentPrice)}원 (전일 대비 ${body.changeRate > 0 ? '+' : ''}${body.changeRate.toFixed(2)}%)
MA5: ${body.ma5 ? fmt(body.ma5) + '원 (현재가 대비 ' + diff(body.currentPrice, body.ma5) + '%)' : '—'}
MA20: ${body.ma20 ? fmt(body.ma20) + '원 (현재가 대비 ' + diff(body.currentPrice, body.ma20) + '%)' : '—'}
MA60: ${body.ma60 ? fmt(body.ma60) + '원 (현재가 대비 ' + diff(body.currentPrice, body.ma60) + '%)' : '—'}
60일 고점: ${fmt(body.high60)}원 / 저점: ${fmt(body.low60)}원 / 현재 위치: ${rangePct != null ? rangePct + '%' : '—'}
추세 상태: ${body.mainLabel}
최근 5일 가격 변화율: ${recentChange != null ? recentChange + '%' : '—'}`;

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 250,
            messages: [{ role: 'user', content: prompt }],
          }),
        });
        if (!res.ok) return json({ error: 'Anthropic API error' }, 500);
        const data: any = await res.json();
        const opinion = data.content?.[0]?.text ?? '';
        return json({ opinion });
      } catch (e) {
        return json({ error: String(e) }, 500);
      }
    }

    // GET /api/daily-reports — 저장된 보고서 날짜 목록
    if (request.method === 'GET' && url.pathname === '/api/daily-reports') {
      const dates = JSON.parse(await env.KV.get('daily_report_dates') || '[]');
      return json(dates);
    }

    // GET /api/daily-reports/:date — TXT 파일 다운로드
    if (request.method === 'GET' && url.pathname.startsWith('/api/daily-reports/')) {
      const date = url.pathname.slice('/api/daily-reports/'.length);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'invalid date' }, 400);
      const content = await env.KV.get(`daily_report:${date}`);
      if (!content) return json({ error: 'not found' }, 404);
      return new Response(content, {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="report_${date}.txt"`,
        },
      });
    }

    // POST /api/daily-reports/generate — 수동 보고서 생성
    if (request.method === 'POST' && url.pathname === '/api/daily-reports/generate') {
      try {
        const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
        const today = kstNow.toISOString().slice(0, 10);
        const body = await request.json().catch(() => ({})) as { snapshots?: any[]; date?: string };
        const targetDate = body.date || today;
        const content = await generateDailyReport(env, targetDate, body.snapshots);
        await saveDailyReport(env, targetDate, content);
        // 프론트에서 보낸 live 스냅샷으로 KV도 동기화 (TXT와 KV 값 일치)
        if (body.snapshots && body.snapshots.length > 0) {
          const liveSnap = body.snapshots.find((s: any) => s.date === targetDate);
          if (liveSnap) {
            const existing: any[] = JSON.parse(await env.KV.get('snapshots') || '[]');
            const idx = existing.findIndex((s: any) => s.date === targetDate);
            if (idx >= 0) existing[idx] = liveSnap;
            else existing.push(liveSnap);
            const sorted = existing
              .filter((s: any) => s && s.date)
              .sort((a: any, b: any) => b.date.localeCompare(a.date))
              .slice(0, 365);
            await env.KV.put('snapshots', JSON.stringify(sorted));
          }
        }
        return json({ ok: true, date: targetDate });
      } catch (e) {
        return json({ error: String(e) }, 500);
      }
    }

    // POST /ai-chat — 대화형 챗봇 (Anthropic 멀티턴)
    if (request.method === 'POST' && url.pathname === '/ai-chat') {
      if (!env.ANTHROPIC_API_KEY) return json({ error: 'API key not configured' }, 500);
      try {
        const body: { messages: { role: 'user' | 'assistant'; content: string }[] } = await request.json();
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 600,
            system: '당신은 개인 자산관리 앱의 AI 어시스턴트입니다. 주식, ETF, 자산배분, 투자 전략에 대해 간결하고 실용적으로 답변해주세요. 마크다운 없이 순수 텍스트로 답변하고, 2~4문장 이내로 답변하세요.',
            messages: body.messages,
          }),
        });
        if (!res.ok) return json({ error: 'Anthropic API error' }, 500);
        const data: any = await res.json();
        const reply = data.content?.[0]?.text ?? '';
        return json({ reply });
      } catch (e) {
        return json({ error: String(e) }, 500);
      }
    }

    // POST /snapshot (수동 트리거)
    if (request.method === 'POST' && url.pathname === '/snapshot') {
      const result = await runDailySnapshot(env);
      return json({ ok: true, result });
    }

    // POST /api/snapshots/backfill — 과거 종가로 누락 날짜 스냅샷 생성
    if (request.method === 'POST' && url.pathname === '/api/snapshots/backfill') {
      try {
        const accounts: any[] = parseKV(await env.KV.get('accounts'), []);
        const otherAssets: any[] = parseKV(await env.KV.get('otherAssets'), []);
        if (!accounts.length) return json({ error: 'no accounts' }, 400);

        const tickers = [...new Set(
          accounts.flatMap((a: any) =>
            a.holdings.map((h: any) => h.ticker).filter((t: string) => t && /^[0-9A-Z]{6,}$/i.test(t))
          )
        )] as string[];

        // 각 종목 최근 30일 종가 수집
        const historicalPrices: Record<string, Record<string, number>> = {};
        await Promise.all(tickers.map(async (ticker) => {
          historicalPrices[ticker] = await fetchHistoricalPrices(ticker, 30);
        }));

        // 기존 snapshots 로드
        const existing: any[] = parseKV(await env.KV.get('snapshots'), []);
        const existingDates = new Set(existing.map((s: any) => s.date));

        // 최근 14일 중 누락 날짜 파악
        const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
        const candidateDates: string[] = [];
        for (let i = 1; i <= 14; i++) {
          const d = new Date(kstNow.getTime() - i * 24 * 60 * 60 * 1000);
          const dateStr = d.toISOString().slice(0, 10);
          if (!existingDates.has(dateStr)) candidateDates.push(dateStr);
        }

        const filled: { date: string; totalAsset: number }[] = [];
        const allSnaps = [...existing].sort((a: any, b: any) => b.date.localeCompare(a.date));
        for (const date of candidateDates) {
          // 해당 날짜 종가 맵 구성
          const prices: Record<string, number> = {};
          for (const ticker of tickers) {
            const p = historicalPrices[ticker]?.[date];
            if (p) prices[ticker] = p;
          }

          let totalAsset: number, wifeTotal: number, husbandTotal: number;
          if (Object.keys(prices).length === 0) {
            // 주말/공휴일 — 직전 거래일 스냅샷 복사
            const prev = allSnaps.find((s: any) => s.date < date);
            if (!prev) continue;
            totalAsset = prev.totalAsset;
            wifeTotal = prev.wifeAsset;
            husbandTotal = prev.husbandAsset;
          } else {
            const wifeAccounts = accounts.filter((a: any) => a.owner === 'wife');
            const husbandAccounts = accounts.filter((a: any) => a.owner === 'husband');
            totalAsset = calcHoldings(accounts, prices) + otherAssets.reduce((s: number, a: any) => s + a.amount, 0);
            wifeTotal = calcHoldings(wifeAccounts, prices) + otherAssets.filter((a: any) => a.owner === 'wife').reduce((s: number, a: any) => s + a.amount, 0);
            husbandTotal = calcHoldings(husbandAccounts, prices) + otherAssets.filter((a: any) => a.owner === 'husband').reduce((s: number, a: any) => s + a.amount, 0);
          }

          existing.push({ date, totalAsset, wifeAsset: wifeTotal, husbandAsset: husbandTotal, assetChange: 0, changeRate: 0 });
          allSnaps.push({ date, totalAsset, wifeAsset: wifeTotal, husbandAsset: husbandTotal });
          allSnaps.sort((a: any, b: any) => b.date.localeCompare(a.date));
          filled.push({ date, totalAsset: Math.round(totalAsset) });
        }

        if (filled.length > 0) {
          const sorted = existing
            .filter((s: any) => s && s.date)
            .sort((a: any, b: any) => b.date.localeCompare(a.date))
            .slice(0, 365);
          await env.KV.put('snapshots', JSON.stringify(sorted));

          // 채워진 날짜 + 기존 누락 보고서 모두 재생성
          const allSnapshots = sorted;
          for (const { date } of filled) {
            const content = await generateDailyReport(env, date, allSnapshots);
            await saveDailyReport(env, date, content);
          }
        }

        return json({ ok: true, filled });
      } catch (e) {
        return json({ error: String(e) }, 500);
      }
    }

    // POST /etf-ranking/refresh (수동 ETF 랭킹 업데이트)
    if (request.method === 'POST' && url.pathname === '/etf-ranking/refresh') {
      const result = await fetchAndStoreEtfRanking(env);
      return json({ ok: true, result });
    }

    // POST /momentum-signal/refresh (수동 모멘텀 신호 갱신)
    if (request.method === 'POST' && url.pathname === '/momentum-signal/refresh') {
      const result = await updateMomentumSignal(env);
      return json({ ok: true, result });
    }

    // POST /crash-signals/refresh (수동 크래시 신호 갱신)
    if (request.method === 'POST' && url.pathname === '/crash-signals/refresh') {
      const result = await updateCrashSignals(env);
      return json({ ok: true, result });
    }

    // GET /api/gold — 금 1돈 시세 (KRW)
    if (request.method === 'GET' && url.pathname === '/api/gold') {
      try {
        const res = await fetch('https://finance.naver.com/marketindex/goldDailyQuote.naver', {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        if (!res.ok) return json({ error: 'fetch failed' }, 500);
        const html = await res.text();
        const match = html.match(/<td class="num">([\d,]+\.\d+)/);
        if (!match) return json({ error: 'parse failed' }, 500);
        const pricePerGram = parseFloat(match[1].replace(/,/g, ''));
        const pricePerDon = Math.round(pricePerGram * 3.75);
        return json({ pricePerDon });
      } catch {
        return json({ error: 'error' }, 500);
      }
    }

    // GET /exchange-rates
    if (request.method === 'GET' && url.pathname === '/exchange-rates') {
      try {
        const [usdRes, jpyRes, wtiRes] = await Promise.all([
          fetch('https://api.stock.naver.com/marketindex/exchange/FX_USDKRW', { headers: { 'User-Agent': 'Mozilla/5.0' } }),
          fetch('https://api.stock.naver.com/marketindex/exchange/FX_JPYKRW', { headers: { 'User-Agent': 'Mozilla/5.0' } }),
          fetch('https://query1.finance.yahoo.com/v8/finance/chart/CL=F?interval=1d&range=1d', { headers: { 'User-Agent': 'Mozilla/5.0' } }),
        ]);
        const [usdData, jpyData, wtiData]: any[] = await Promise.all([usdRes.json(), jpyRes.json(), wtiRes.json()]);

        const parseFxField = (d: any, field: string) => {
          const info = d.exchangeInfo ?? d;
          return parseFloat((info[field] ?? '0').toString().replace(/,/g, '')) || 0;
        };

        const wtiMeta = wtiData.chart?.result?.[0]?.meta ?? {};
        const wtiPrice = wtiMeta.regularMarketPrice ?? 0;
        const wtiPrev  = wtiMeta.chartPreviousClose ?? wtiPrice;
        const wtiChange = wtiPrice - wtiPrev;
        const wtiChangeRate = wtiPrev > 0 ? (wtiChange / wtiPrev) * 100 : 0;

        return json({
          usd: parseFxField(usdData, 'closePrice'),
          usdChange: parseFxField(usdData, 'fluctuations'),
          usdChangeRate: parseFxField(usdData, 'fluctuationsRatio'),
          jpy: parseFxField(jpyData, 'closePrice'),
          jpyChange: parseFxField(jpyData, 'fluctuations'),
          jpyChangeRate: parseFxField(jpyData, 'fluctuationsRatio'),
          wti: parseFloat(wtiPrice.toFixed(2)),
          wtiChange: parseFloat(wtiChange.toFixed(2)),
          wtiChangeRate: parseFloat(wtiChangeRate.toFixed(2)),
        });
      } catch {
        return json({ usd: 0, usdChange: 0, usdChangeRate: 0, jpy: 0, jpyChange: 0, jpyChangeRate: 0, wti: 0, wtiChange: 0, wtiChangeRate: 0 });
      }
    }

    // GET /market-indices
    if (request.method === 'GET' && url.pathname === '/market-indices') {
      try {
        const [kospiRes, kosdaqRes, nasdaqRes, sp500Res, usdKrwRes] = await Promise.all([
          fetch('https://polling.finance.naver.com/api/realtime/domestic/index/KOSPI', { headers: { 'User-Agent': 'Mozilla/5.0' } }),
          fetch('https://polling.finance.naver.com/api/realtime/domestic/index/KOSDAQ', { headers: { 'User-Agent': 'Mozilla/5.0' } }),
          fetch('https://polling.finance.naver.com/api/realtime/worldstock/index/.IXIC', { headers: { 'User-Agent': 'Mozilla/5.0' } }),
          fetch('https://polling.finance.naver.com/api/realtime/worldstock/index/.INX', { headers: { 'User-Agent': 'Mozilla/5.0' } }),
          fetch('https://api.stock.naver.com/marketindex/exchange/FX_USDKRW', { headers: { 'User-Agent': 'Mozilla/5.0' } }),
        ]);
        const parseIndex = async (res: Response, name: string) => {
          try {
            const d: any = await res.json();
            const item = d.datas?.[0] ?? d;
            const cp = parseFloat(String(item.closePrice ?? item.currentValue ?? 0).replace(/,/g, ''));
            const ch = parseFloat(String(item.compareToPreviousClosePrice ?? item.change ?? 0).replace(/,/g, ''));
            const pct = parseFloat(String(item.fluctuationsRatio ?? item.changePercent ?? 0).replace(/,/g, ''));
            const dir = item.compareToPreviousPrice?.name ?? (pct > 0 ? 'RISING' : pct < 0 ? 'FALLING' : 'FLAT');
            const signedCh = dir === 'FALLING' ? -Math.abs(ch) : ch;
            const signedPct = dir === 'FALLING' ? -Math.abs(pct) : pct;
            return { name, currentPrice: cp, change: signedCh, changePercent: signedPct, direction: dir };
          } catch { return { name, currentPrice: 0, change: 0, changePercent: 0, direction: 'FLAT', error: 'fetch failed' }; }
        };
        const parseFx = async (res: Response) => {
          try {
            const d: any = await res.json();
            const cp = parseFloat(String(d.closePrice ?? 0).replace(/,/g, ''));
            const ch = parseFloat(String(d.fluctuations ?? 0).replace(/,/g, ''));
            const pct = parseFloat(String(d.fluctuationsRatio ?? 0).replace(/,/g, ''));
            const dir = d.fluctuationsType?.name ?? (pct > 0 ? 'RISING' : pct < 0 ? 'FALLING' : 'FLAT');
            const signedCh = dir === 'FALLING' ? -Math.abs(ch) : ch;
            const signedPct = dir === 'FALLING' ? -Math.abs(pct) : pct;
            return { name: '달러 환율', currentPrice: cp, change: signedCh, changePercent: signedPct, direction: dir };
          } catch { return { name: '달러 환율', currentPrice: 0, change: 0, changePercent: 0, direction: 'FLAT', error: 'fetch failed' }; }
        };
        const [kospi, kosdaq, nasdaq, sp500, fx_usdkrw] = await Promise.all([
          parseIndex(kospiRes, 'KOSPI'),
          parseIndex(kosdaqRes, 'KOSDAQ'),
          parseIndex(nasdaqRes, 'NASDAQ'),
          parseIndex(sp500Res, 'S&P500'),
          parseFx(usdKrwRes),
        ]);
        return json({ kospi, kosdaq, nasdaq, sp500, fx_usdkrw, lastUpdated: new Date().toISOString() });
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

    // GET /stock-prices-with-change?tickers=... — 현재가 + 당일 등락률 일괄 조회
    if (request.method === 'GET' && url.pathname === '/stock-prices-with-change') {
      const raw = url.searchParams.get('tickers') || '';
      const tickers = raw.split(',').map(t => t.trim()).filter(t => /^[0-9A-Z]{6}$/i.test(t));
      if (tickers.length === 0) return json({});
      const entries = await Promise.all(
        tickers.map(async t => [t, await fetchCurrentPriceWithChange(t)] as [string, { price: number; changeRate: number } | null])
      );
      const result: Record<string, { price: number; changeRate: number }> = {};
      for (const [t, d] of entries) { if (d !== null) result[t] = d; }
      return json(result);
    }

    // GET /stock-detail/:ticker — MA20, MA60, 60일 고저점
    if (request.method === 'GET' && url.pathname.startsWith('/stock-detail/')) {
      const ticker = url.pathname.slice('/stock-detail/'.length).split('?')[0];
      if (!/^[0-9A-Z]{6}$/i.test(ticker)) return json({ error: 'invalid ticker' }, 400);

      const histPrices = await fetchHistoricalPrices(ticker, 70);
      const priceArr = Object.entries(histPrices)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, p]) => p)
        .filter(p => p > 0);

      if (priceArr.length < 5) return json({ error: 'no data' }, 404);

      const live = await fetchCurrentPriceWithChange(ticker);
      const cur = live?.price ?? priceArr[priceArr.length - 1];
      const changeRate = live?.changeRate ?? 0;
      const slice20 = priceArr.slice(-20);
      const slice60 = priceArr.slice(-60);
      const ma20 = Math.round(slice20.reduce((s, p) => s + p, 0) / slice20.length);
      const ma60 = Math.round(slice60.reduce((s, p) => s + p, 0) / slice60.length);
      const range = slice60.length >= 5 ? slice60 : priceArr;
      const high = Math.max(...range);
      const low = Math.min(...range);
      const position = high > low ? (cur - low) / (high - low) : 0.5;

      return json({ ticker, currentPrice: cur, changeRate, ma20, ma60, high, low, position: Math.round(position * 100) / 100 });
    }

    // GET /chart/usdkrw — 달러/원 30일 추이 (Yahoo Finance USDKRW=X)
    if (request.method === 'GET' && url.pathname === '/chart/usdkrw') {
      try {
        const range = url.searchParams.get('range') || '1mo';
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/USDKRW%3DX?interval=1d&range=${range}`,
          { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
        );
        if (!res.ok) return json({ error: 'fetch failed' }, 500);
        const data: any = await res.json();
        const result = data.chart?.result?.[0];
        if (!result) return json([]);
        const timestamps: number[] = result.timestamp ?? [];
        const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];
        const rows = timestamps.map((ts, i) => ({
          date: new Date(ts * 1000).toISOString().slice(0, 10),
          price: closes[i] ? parseFloat(closes[i].toFixed(1)) : null,
        })).filter((r: any) => r.price !== null && r.price > 0);
        return json(rows);
      } catch (e) { return json({ error: String(e) }, 500); }
    }

    // GET /chart/tnx — 미 10년물 금리 30일 추이
    if (request.method === 'GET' && url.pathname === '/chart/tnx') {
      try {
        const range = url.searchParams.get('range') || '1mo';
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/%5ETNX?interval=1d&range=${range}`,
          { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
        );
        if (!res.ok) return json({ error: 'fetch failed' }, 500);
        const data: any = await res.json();
        const result = data.chart?.result?.[0];
        if (!result) return json([]);
        const timestamps: number[] = result.timestamp ?? [];
        const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];
        const rows = timestamps.map((ts, i) => ({
          date: new Date(ts * 1000).toISOString().slice(0, 10),
          price: closes[i] ? parseFloat(closes[i].toFixed(3)) : null,
        })).filter((r: any) => r.price !== null && r.price > 0);
        return json(rows);
      } catch (e) { return json({ error: String(e) }, 500); }
    }

    // GET /daily-note/:date — 일일 노트 조회
    if (request.method === 'GET' && /^\/daily-note\/\d{4}-\d{2}-\d{2}$/.test(url.pathname)) {
      const date = url.pathname.slice('/daily-note/'.length);
      const val = await env.KV.get(`daily_note_${date}`);
      if (!val) return json({ plan: '', review: '' });
      return json(JSON.parse(val));
    }

    // PUT /daily-note/:date — 일일 노트 저장
    if (request.method === 'PUT' && /^\/daily-note\/\d{4}-\d{2}-\d{2}$/.test(url.pathname)) {
      const date = url.pathname.slice('/daily-note/'.length);
      const body = await request.json() as { plan: string; review: string };
      const isEmpty = !body.plan && !body.review;
      if (isEmpty) {
        await env.KV.delete(`daily_note_${date}`);
      } else {
        await env.KV.put(`daily_note_${date}`, JSON.stringify(body));
      }
      return json({ ok: true });
    }

    // GET /daily-notes/list — 노트가 있는 날짜 목록
    if (request.method === 'GET' && url.pathname === '/daily-notes/list') {
      const list = await env.KV.list({ prefix: 'daily_note_' });
      const dates = list.keys.map(k => k.name.slice('daily_note_'.length));
      return json(dates);
    }

    // GET /stock-check?ticker=NVDA — 신규 종목 조건 검사
    if (request.method === 'GET' && url.pathname === '/stock-check') {
      const raw = (url.searchParams.get('ticker') || '').toUpperCase().trim();
      if (!raw) return json({ error: 'ticker required' }, 400);

      // 6자리 숫자 = 한국 종목 → 검색 API로 올바른 시장(.KS/.KQ) 자동 감지
      let ticker = raw;
      let krName = '';
      if (/^\d{6}$/.test(raw)) {
        const ua2 = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
        const [krSearchRes, krNameRes] = await Promise.all([
          fetch(`https://query1.finance.yahoo.com/v1/finance/search?q=${raw}&quotesCount=5&newsCount=0`, { headers: { 'User-Agent': ua2 } }),
          fetch(`https://m.stock.naver.com/api/stock/${raw}/basic`, { headers: { 'User-Agent': ua2 } }),
        ]);
        const krSearchData: any = await krSearchRes.json();
        const krQuote = (krSearchData.quotes || []).find((q: any) => q.symbol?.startsWith(raw));
        if (krQuote?.symbol) {
          ticker = krQuote.symbol;
        } else {
          ticker = `${raw}.KS`;
        }
        try {
          const krBasic: any = await krNameRes.json();
          krName = krBasic.stockName || '';
        } catch { /* 영문명 폴백 */ }
      }

      const SECTOR_DEBT_BENCHMARKS: Record<string, number> = {
        'Technology': 80, 'Healthcare': 120, 'Financial Services': 400,
        'Consumer Cyclical': 180, 'Consumer Defensive': 150, 'Energy': 200,
        'Industrials': 160, 'Basic Materials': 150, 'Real Estate': 300,
        'Utilities': 350, 'Communication Services': 150,
      };

      function calcRSI(closes: number[], period = 14): number {
        if (closes.length < period + 1) return 50;
        const changes = closes.slice(1).map((c, i) => c - closes[i]);
        const recent = changes.slice(-period);
        const gains = recent.filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
        const losses = Math.abs(recent.filter(c => c < 0).reduce((a, b) => a + b, 0)) / period;
        if (losses === 0) return 100;
        return Math.round(100 - (100 / (1 + gains / losses)));
      }

      function lastVal(arr: any[]): number | null {
        if (!Array.isArray(arr) || arr.length === 0) return null;
        const v = arr[arr.length - 1];
        return v?.reportedValue?.raw ?? null;
      }

      try {
        const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
        const p1 = '1451606400', p2 = '1893456000';
        const [chartWeeklyRes, chartDailyRes, searchRes, tsRes, newsRes] = await Promise.all([
          fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1wk&range=2y`, { headers: { 'User-Agent': ua } }),
          fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=3mo`, { headers: { 'User-Agent': ua } }),
          fetch(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&quotesCount=1&newsCount=0`, { headers: { 'User-Agent': ua } }),
          fetch(`https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(ticker)}?type=annualDilutedEPS,annualTotalDebt,annualStockholdersEquity,annualNetIncome,annualPriceToBook&period1=${p1}&period2=${p2}`, { headers: { 'User-Agent': ua } }),
          fetch(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&newsCount=20&quotesCount=0`, { headers: { 'User-Agent': ua } }),
        ]);

        if (!chartDailyRes.ok) return json({ error: `종목을 찾을 수 없습니다: ${ticker}` }, 404);

        const [chartWeekly, chartDaily, searchJson, tsJson, newsJson] = await Promise.all([
          chartWeeklyRes.json() as Promise<any>,
          chartDailyRes.json() as Promise<any>,
          searchRes.json() as Promise<any>,
          tsRes.json() as Promise<any>,
          newsRes.json() as Promise<any>,
        ]);

        // 기본 정보 (v8 chart meta + search)
        const meta = chartDaily.chart?.result?.[0]?.meta || {};
        if (!meta.symbol) return json({ error: `데이터 없음: ${ticker}` }, 404);

        const searchQuote = (searchJson.quotes || []).find((q: any) => q.symbol?.toUpperCase() === ticker) || searchJson.quotes?.[0] || {};
        const rawName = meta.longName || meta.shortName || '';
        const cleanedMetaName = rawName.includes(',') ? '' : rawName;
        const name = krName || cleanedMetaName || searchQuote.longname || searchQuote.shortname || ticker;
        const sector = searchQuote.sector || 'Unknown';
        const industry = searchQuote.industry || '';
        const currency = meta.currency || 'USD';
        const currentPrice = meta.regularMarketPrice || 0;
        const marketCap = meta.marketCap || 0;

        // 52주
        const week52High = meta.fiftyTwoWeekHigh || 0;
        const week52Low = meta.fiftyTwoWeekLow || 0;
        const week52Pct = week52High > week52Low
          ? Math.round(((currentPrice - week52Low) / (week52High - week52Low)) * 100)
          : 0;
        const nearHigh = week52High > 0 && ((week52High - currentPrice) / week52High) <= 0.25;

        // 펀더멘털 (timeseries)
        const tsResult: any[] = tsJson.timeseries?.result || [];
        const tsMap: Record<string, any[]> = {};
        for (const t of tsResult) {
          for (const key of ['annualDilutedEPS','annualTotalDebt','annualStockholdersEquity','annualNetIncome','annualPriceToBook']) {
            if (Array.isArray(t[key])) tsMap[key] = t[key];
          }
        }

        const epsArr = (tsMap['annualDilutedEPS'] || []).slice(-4);
        const epsHistory = epsArr.map((v: any) => ({ year: (v.asOfDate || '').slice(0, 4), eps: v.reportedValue?.raw ?? null })).filter((e: any) => e.eps != null);
        const epsGrowth3y = epsHistory.length >= 3
          ? epsHistory[epsHistory.length-1].eps > epsHistory[epsHistory.length-2].eps && epsHistory[epsHistory.length-2].eps > epsHistory[epsHistory.length-3].eps
          : null;

        const latestDebt = lastVal(tsMap['annualTotalDebt'] || []);
        const latestEquity = lastVal(tsMap['annualStockholdersEquity'] || []);
        const latestNetIncome = lastVal(tsMap['annualNetIncome'] || []);
        const latestPbr = lastVal(tsMap['annualPriceToBook'] || []);

        const debtToEquity = latestDebt != null && latestEquity != null && latestEquity > 0
          ? Math.round((latestDebt / latestEquity) * 1000) / 10
          : null;
        const roe = latestNetIncome != null && latestEquity != null && latestEquity > 0
          ? Math.round((latestNetIncome / latestEquity) * 1000) / 10
          : null;
        const pbr = latestPbr != null ? Math.round(latestPbr * 10) / 10 : null;

        const latestEps = epsHistory.length > 0 ? epsHistory[epsHistory.length-1].eps : null;
        const per = latestEps != null && latestEps > 0 && currentPrice > 0
          ? Math.round((currentPrice / latestEps) * 10) / 10
          : null;

        const industryBenchmark = SECTOR_DEBT_BENCHMARKS[sector] ?? 150;
        const debtOk = debtToEquity != null ? debtToEquity < industryBenchmark : null;

        // 30주 이평선
        const weeklyQ = chartWeekly.chart?.result?.[0]?.indicators?.quote?.[0];
        const weeklyCloses = ((weeklyQ?.close || []) as (number | null)[]).filter((c): c is number => c != null);
        const ma30w = weeklyCloses.length >= 30 ? weeklyCloses.slice(-30).reduce((a, b) => a + b, 0) / 30 : null;
        const ma30wPrev = weeklyCloses.length >= 34 ? weeklyCloses.slice(-34, -4).reduce((a, b) => a + b, 0) / 30 : null;
        const maAbove = ma30w != null ? currentPrice > ma30w : null;
        const maTrending = ma30w != null && ma30wPrev != null ? ma30w > ma30wPrev : null;

        // RSI (14일)
        const dailyQ = chartDaily.chart?.result?.[0]?.indicators?.quote?.[0];
        const dailyCloses = ((dailyQ?.close || []) as (number | null)[]).filter((c): c is number => c != null);
        const rsi = dailyCloses.length >= 15 ? calcRSI(dailyCloses) : null;

        // 거래량 비율 (5일 / 20일 평균)
        const dailyVols = ((dailyQ?.volume || []) as (number | null)[]).filter((v): v is number => v != null && v > 0);
        const vol20 = dailyVols.length >= 20 ? dailyVols.slice(-20).reduce((a, b) => a + b, 0) / 20 : null;
        const vol5 = dailyVols.length >= 5 ? dailyVols.slice(-5).reduce((a, b) => a + b, 0) / 5 : null;
        const volumeRatio = vol20 && vol5 ? Math.round((vol5 / vol20) * 100) / 100 : null;

        // 뉴스 — 한국 종목은 네이버 금융 종목뉴스, 해외 종목은 Yahoo Finance
        const RED_KEYWORDS = ['특징주', '급등', '대박', '역대급', '테마주', 'unusual', 'skyrocket', 'surging', 'meme'];
        const isKrStock = ticker.endsWith('.KS') || ticker.endsWith('.KQ');
        const krCode = isKrStock ? ticker.replace(/\.(KS|KQ)$/, '') : '';
        let newsItems: { title: string; url: string; flagged: boolean }[] = [];

        if (isKrStock && krCode) {
          try {
            const naverNewsRes = await fetch(
              `https://finance.naver.com/item/news_news.naver?code=${krCode}`,
              { headers: { 'User-Agent': ua, 'Referer': 'https://finance.naver.com/' } }
            );
            const buf = await naverNewsRes.arrayBuffer();
            const html = new TextDecoder('euc-kr').decode(buf);
            const cleanHtml = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&[a-z]+;|&#\d+;/g, ' ').replace(/\s+/g, ' ').trim();
            const titRe = /<a[^>]+href="(\/item\/news_read\.naver\?[^"]+)"[^>]*class="tit"[^>]*>([\s\S]*?)<\/a>|<a[^>]*class="tit"[^>]+href="(\/item\/news_read\.naver\?[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
            for (const m of html.matchAll(titRe)) {
              const href = (m[1] || m[3] || '').replace(/&amp;/g, '&');
              const raw = m[2] || m[4] || '';
              const title = cleanHtml(raw);
              if (title.length >= 4) {
                const fullUrl = `https://finance.naver.com${href}`;
                newsItems.push({ title, url: fullUrl, flagged: RED_KEYWORDS.some(kw => title.includes(kw)) });
              }
              if (newsItems.length >= 10) break;
            }
          } catch { /* 뉴스 없어도 계속 */ }
        } else {
          newsItems = ((newsJson.news || []) as any[]).slice(0, 10).map(n => {
            const title = n.title || '';
            return { title, url: n.link || '', flagged: RED_KEYWORDS.some(kw => title.toLowerCase().includes(kw.toLowerCase())) };
          });
        }

        const redFlagCount = newsItems.filter(n => n.flagged).length;
        const newsSignal = redFlagCount >= 3 ? 'danger' : redFlagCount >= 1 ? 'caution' : 'clean';

        return json({
          ticker, name, sector, industry, currency,
          price: currentPrice, marketCap,
          technical: {
            ma30w: ma30w != null ? Math.round(ma30w * 100) / 100 : null,
            maAbove, maTrending, rsi, volumeRatio,
            week52High, week52Low, week52Pct, nearHigh,
          },
          fundamentals: { per, pbr, roe, debtToEquity, industryBenchmark },
          epsHistory,
          checks: {
            maAbove, maTrending,
            rsiOk: rsi != null ? rsi < 70 : null,
            nearHigh,
            epsGrowth3y,
            roeOk: roe != null ? roe >= 15 : null,
            debtOk,
            newsClean: newsSignal === 'clean',
          },
          news: { items: newsItems.slice(0, 10), redFlagCount, signal: newsSignal },
        });
      } catch (e) { return json({ error: String(e) }, 500); }
    }

    // GET /naver-finance-news — 네이버 금융 주요 뉴스 파싱
    if (request.method === 'GET' && url.pathname === '/naver-finance-news') {
      try {
        const res = await fetch('https://finance.naver.com/news/mainnews.naver', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'ko-KR,ko;q=0.9',
            'Referer': 'https://finance.naver.com/',
          }
        });
        if (!res.ok) return json({ error: 'fetch failed' }, 500);
        const buf = await res.arrayBuffer();
        const html = new TextDecoder('euc-kr').decode(buf);
        const items: { title: string; url: string }[] = [];
        const seen = new Set<string>();
        const cleanTitle = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"').replace(/&hellip;/g, '…').replace(/&lsquo;|&rsquo;/g, "'")
          .replace(/&ldquo;|&rdquo;/g, '"').replace(/&#\d+;/g, '').replace(/[\s·.]+$/, '').trim();

        // mode=mainnews 링크만 추출 — 썸네일 <a>는 innerText가 없어서 자동 필터됨
        const re = /<a\b[^>]*href="(\/news\/news_read\.naver\?[^"]*mode=mainnews[^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
        for (const m of html.matchAll(re)) {
          const href = m[1].replace(/&amp;/g, '&');
          const title = cleanTitle(m[2]);
          const fullUrl = `https://finance.naver.com${href}`;
          if (!seen.has(fullUrl) && title.length >= 5) {
            seen.add(fullUrl);
            items.push({ title, url: fullUrl });
            if (items.length >= 10) break;
          }
        }
        return json(items);
      } catch (e) { return json({ error: String(e) }, 500); }
    }

    // GET /morning-brief — 아침 시황 위젯 (지수·환율·금리·주요 종목)
    if (request.method === 'GET' && url.pathname === '/morning-brief') {
      try {
        const parseYahoo = async (symbol: string) => {
          try {
            const r = await fetch(
              `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`,
              { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
            );
            if (!r.ok) return null;
            const d: any = await r.json();
            const meta = d.chart?.result?.[0]?.meta;
            if (!meta) return null;
            const price = meta.regularMarketPrice ?? 0;
            const prev = meta.chartPreviousClose ?? meta.previousClose ?? price;
            const change = price - prev;
            const changePct = prev > 0 ? (change / prev * 100) : 0;
            return { price: parseFloat(price.toFixed(2)), change: parseFloat(change.toFixed(2)), changePct: parseFloat(changePct.toFixed(2)) };
          } catch { return null; }
        };

        const parseNaverIdx = async (r: Response) => {
          try {
            const d: any = await r.json();
            const item = d.datas?.[0] ?? d;
            const cp = parseFloat(String(item.closePrice ?? item.currentValue ?? 0).replace(/,/g, ''));
            const pct = parseFloat(String(item.fluctuationsRatio ?? 0).replace(/,/g, ''));
            const dir = item.compareToPreviousPrice?.name ?? (pct > 0 ? 'RISING' : pct < 0 ? 'FALLING' : 'FLAT');
            return { price: cp, changePct: dir === 'FALLING' ? -Math.abs(pct) : pct };
          } catch { return { price: 0, changePct: 0 }; }
        };

        const US_STOCKS = ['NVDA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'TSLA', 'JPM', 'WMT'];

        const [
          kospiR, kosdaqR, nasdaqR, sp500R, usdKrwR,
          tnx, samsung, skHynix,
          ...usArr
        ] = await Promise.all([
          fetch('https://polling.finance.naver.com/api/realtime/domestic/index/KOSPI', { headers: { 'User-Agent': 'Mozilla/5.0' } }),
          fetch('https://polling.finance.naver.com/api/realtime/domestic/index/KOSDAQ', { headers: { 'User-Agent': 'Mozilla/5.0' } }),
          fetch('https://polling.finance.naver.com/api/realtime/worldstock/index/.IXIC', { headers: { 'User-Agent': 'Mozilla/5.0' } }),
          fetch('https://polling.finance.naver.com/api/realtime/worldstock/index/.INX', { headers: { 'User-Agent': 'Mozilla/5.0' } }),
          fetch('https://api.stock.naver.com/marketindex/exchange/FX_USDKRW', { headers: { 'User-Agent': 'Mozilla/5.0' } }),
          parseYahoo('^TNX'),
          fetchCurrentPriceWithChange('005930'),
          fetchCurrentPriceWithChange('000660'),
          ...US_STOCKS.map(s => parseYahoo(s)),
        ] as const);

        const [kospi, kosdaq, nasdaq, sp500] = await Promise.all([
          parseNaverIdx(kospiR as Response),
          parseNaverIdx(kosdaqR as Response),
          parseNaverIdx(nasdaqR as Response),
          parseNaverIdx(sp500R as Response),
        ]);

        const usdKrw = await (async () => {
          try {
            const raw: any = await (usdKrwR as Response).json();
            const d = raw.exchangeInfo ?? raw;
            const cp = parseFloat(String(d.closePrice ?? 0).replace(/,/g, ''));
            const ch = parseFloat(String(d.fluctuations ?? 0).replace(/,/g, ''));
            const pct = parseFloat(String(d.fluctuationsRatio ?? 0).replace(/,/g, ''));
            const dir = (d.fluctuationsType?.name ?? d.compareToPreviousPrice?.name) ?? (pct > 0 ? 'RISING' : pct < 0 ? 'FALLING' : 'FLAT');
            return { price: cp, change: dir === 'FALLING' ? -Math.abs(ch) : ch, changePct: dir === 'FALLING' ? -Math.abs(pct) : pct };
          } catch { return { price: 0, change: 0, changePct: 0 }; }
        })();

        const usStocks: Record<string, { price: number; change: number; changePct: number } | null> = {};
        US_STOCKS.forEach((sym, i) => { usStocks[sym] = (usArr as any[])[i] ?? null; });

        return json({
          indices: { kospi, kosdaq, nasdaq, sp500 },
          usdKrw,
          tnx,
          usStocks,
          krStocks: {
            '005930': samsung ? { price: samsung.price, changePct: samsung.changeRate } : null,
            '000660': skHynix ? { price: skHynix.price, changePct: skHynix.changeRate } : null,
          },
          lastUpdated: new Date().toISOString(),
        });
      } catch (e) {
        return json({ error: String(e) }, 500);
      }
    }

    // GET /worldcup — 월드컵 대시보드 데이터
    if (request.method === 'GET' && url.pathname === '/worldcup') {
      const raw = await env.KV.get('worldcup_data');
      if (!raw) return json({ error: 'no data' }, 404);
      return new Response(raw, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    // POST /worldcup/update — 월드컵 데이터 저장 (CLI 전용)
    if (request.method === 'POST' && url.pathname === '/worldcup/update') {
      const body = await request.text();
      await env.KV.put('worldcup_data', body);
      return json({ ok: true });
    }

    // GET /stock-watchlist
    if (request.method === 'GET' && url.pathname === '/stock-watchlist') {
      const raw = await env.KV.get('stock_watchlist');
      return json(JSON.parse(raw || '[]'));
    }

    // POST /stock-watchlist — upsert
    if (request.method === 'POST' && url.pathname === '/stock-watchlist') {
      const item = await request.json() as any;
      if (!item?.ticker) return json({ error: 'ticker required' }, 400);
      const raw = await env.KV.get('stock_watchlist');
      const list: any[] = JSON.parse(raw || '[]');
      const updated = [item, ...list.filter((s: any) => s.ticker !== item.ticker)].slice(0, 50);
      await env.KV.put('stock_watchlist', JSON.stringify(updated));
      return json({ ok: true });
    }

    // DELETE /stock-watchlist — remove one
    if (request.method === 'DELETE' && url.pathname === '/stock-watchlist') {
      const { ticker } = await request.json() as any;
      if (!ticker) return json({ error: 'ticker required' }, 400);
      const raw = await env.KV.get('stock_watchlist');
      const list: any[] = JSON.parse(raw || '[]');
      await env.KV.put('stock_watchlist', JSON.stringify(list.filter((s: any) => s.ticker !== ticker)));
      return json({ ok: true });
    }

    return json({ error: 'not found' }, 404);
  },

  // ── Cron 트리거 ──
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);

      // UTC 09:00 = KST 18:00 — 장 마감 스냅샷 저장 + 일일 보고서 생성
      if (event.cron === '0 9 * * *') {
        const today = kstNow.toISOString().slice(0, 10);
        const snapResult = await runDailySnapshot(env, today).catch((e: unknown) => `snapshot error: ${String(e)}`);
        const content = await generateDailyReport(env, today);
        await saveDailyReport(env, today, content);
        await saveCronLog(env, [snapResult, `daily_report saved: ${today}`]);
        return;
      }

      // UTC 17:00 = KST 02:00 — 전일 종가 스냅샷 (18:00 크론이 이미 저장한 경우 스킵)
      const yesterday = new Date(kstNow.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const existingSnaps: any[] = JSON.parse(await env.KV.get('snapshots') || '[]');
      const yesterdayExists = existingSnaps.some((s: any) => s.date === yesterday);
      const [snapshotResult, signalResult, crashResult] = await Promise.all([
        yesterdayExists
          ? Promise.resolve(`snapshot skipped: ${yesterday} already exists`)
          : runDailySnapshot(env, yesterday).catch((e: unknown) => `snapshot error: ${String(e)}`),
        updateMomentumSignal(env).catch((e: unknown) => `signal error: ${String(e)}`),
        updateCrashSignals(env).catch((e: unknown) => `crash error: ${String(e)}`),
      ]);
      await Promise.all([
        saveCronLog(env, [snapshotResult, signalResult, crashResult]),
        saveMomentumHistory(env),
      ]);
    })());
  },
};
