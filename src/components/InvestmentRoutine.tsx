import { useState, useEffect, useCallback, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { MIcon } from './MIcon';
import { useAppContext } from '../App';
import { fetchSnapshots } from '../api';
import { fetchCurrentPricesWithChange } from '../utils/fetchPrices';
import type { DailySnapshot } from '../types';

const WORKER_URL = (import.meta as any).env?.VITE_WORKER_URL || 'https://asset-dashboard-api.jilliankim200.workers.dev';

// ── 차트 모달 ──
interface ChartConfig { title: string; endpoint: string; color: string; unit: string; decimals: number; }

function ChartModal({ config, onClose }: { config: ChartConfig; onClose: () => void }) {
  const [data, setData] = useState<{ date: string; price: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${WORKER_URL}/${config.endpoint}`)
      .then(r => r.json())
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [config.endpoint]);

  const latest = data[data.length - 1];
  const first = data[0];
  const totalChange = latest && first ? latest.price - first.price : 0;
  const min = data.length ? Math.min(...data.map(d => d.price)) : 0;
  const max = data.length ? Math.max(...data.map(d => d.price)) : 0;
  const pad = (max - min) * 0.12;
  const isUp = totalChange >= 0;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '22px 20px 20px', width: '100%', maxWidth: 460, boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{config.title}</div>
            {latest && (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
                현재 <strong>{latest.price.toFixed(config.decimals)}{config.unit}</strong>
                <span style={{ marginLeft: 8, color: isUp ? '#F04452' : '#3182F6', fontWeight: 700 }}>
                  {isUp ? '+' : ''}{totalChange.toFixed(config.decimals)}{config.unit} <span style={{ fontSize: 11, fontWeight: 400 }}>30일 누적</span>
                </span>
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border-primary)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MIcon name="close" size={17} />
          </button>
        </div>

        {loading ? (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>차트 로딩 중...</div>
        ) : data.length === 0 ? (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>데이터를 불러오지 못했습니다</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
              <YAxis domain={[min - pad, max + pad]} tickFormatter={(v: number) => v.toFixed(config.decimals)} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} width={48} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(config.decimals)}${config.unit}`, '']} labelStyle={{ fontSize: 12 }} contentStyle={{ borderRadius: 10, border: '1px solid var(--border-primary)', fontSize: 12 }} />
              <Line type="monotone" dataKey="price" stroke={config.color} strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}

        {data.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
            <span>30일 최저 {min.toFixed(config.decimals)}{config.unit}</span>
            <span>30일 최고 {max.toFixed(config.decimals)}{config.unit}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 종목 링크 ──
// ── 인사이트 팝업 ──────────────────────────────────────────────

function fmtKrwInsight(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억`;
  if (abs >= 10_000) return `${Math.round(n / 10_000)}만`;
  return n.toLocaleString() + '원';
}

function hValInsight(h: { isFund?: boolean; amount?: number; ticker?: string; avgPrice: number; quantity: number }, prices: Record<string, number>, pd: Record<string, { price: number; changeRate: number }>): number {
  if (h.isFund) return h.amount || 0;
  const p = (h.ticker && (pd[h.ticker]?.price || prices[h.ticker])) || h.avgPrice;
  return p * h.quantity;
}

function classifyInsight(name: string): string {
  if (['커버드콜'].some(k => name.includes(k))) return '커버드콜';
  if (['국채', '채권', '단기채', '액티브', '국공채'].some(k => name.includes(k))) return '채권';
  if (['금현물', 'KRX금', '골드'].some(k => name.includes(k))) return '금';
  return '주식';
}

function WeeklyReturnContent() {
  const { accounts } = useAppContext();
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [pd, setPd] = useState<Record<string, { price: number; changeRate: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tickers = [...new Set(
      accounts.flatMap(acc => acc.holdings.filter(h => !h.isFund && h.ticker).map(h => h.ticker!))
    )];
    Promise.all([
      fetchSnapshots(),
      tickers.length > 0 ? fetchCurrentPricesWithChange(tickers) : Promise.resolve({} as Record<string, { price: number; changeRate: number }>),
    ]).then(([snaps, priceData]) => {
      setSnapshots((snaps as DailySnapshot[]).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date)));
      setPd(priceData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // 스냅샷 ↔ 스냅샷 비교 (재계산 없음)
  const latestSnap = snapshots[0];
  const prevSnap = snapshots[1]; // 전일

  const weekAgoDate = latestSnap
    ? new Date(new Date(latestSnap.date + 'T00:00:00').getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : '';
  const weekAgoSnap = weekAgoDate ? snapshots.find(s => s.date <= weekAgoDate) : undefined;

  const weeklyChange = latestSnap && weekAgoSnap ? latestSnap.totalAsset - weekAgoSnap.totalAsset : null;
  const weeklyRate = weeklyChange != null && weekAgoSnap && weekAgoSnap.totalAsset > 0
    ? (weeklyChange / weekAgoSnap.totalAsset * 100) : null;

  const dailyChange = latestSnap && prevSnap ? latestSnap.totalAsset - prevSnap.totalAsset : null;
  const dailyRate = dailyChange != null && prevSnap && prevSnap.totalAsset > 0
    ? (dailyChange / prevSnap.totalAsset * 100) : null;

  // 종목별 기여 — ticker 기준 합산 (중복 계좌 제거)
  const tickerMap = new Map<string, { name: string; value: number; rate: number; contrib: number }>();
  for (const acc of accounts) {
    for (const h of acc.holdings) {
      if (h.isFund || !h.ticker || h.quantity <= 0) continue;
      const p = pd[h.ticker]?.price || h.avgPrice;
      const rate = pd[h.ticker]?.changeRate ?? 0;
      const value = p * h.quantity;
      const contrib = value * rate / 100;
      const existing = tickerMap.get(h.ticker);
      if (existing) {
        existing.value += value;
        existing.contrib += contrib;
      } else {
        tickerMap.set(h.ticker, { name: h.name, value, rate, contrib });
      }
    }
  }
  const contributions = [...tickerMap.values()]
    .sort((a, b) => Math.abs(b.contrib) - Math.abs(a.contrib));

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>데이터 불러오는 중...</div>;

  return (
    <div>
      {/* 주간/일간 요약 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          { label: '이번 주 수익', change: weeklyChange, rate: weeklyRate, base: weekAgoSnap?.totalAsset, sub: weekAgoSnap ? `${weekAgoSnap.date} ~ ${latestSnap?.date}` : '스냅샷 없음' },
          { label: '전일 대비', change: dailyChange, rate: dailyRate, base: prevSnap?.totalAsset, sub: prevSnap ? `${prevSnap.date} → ${latestSnap?.date}` : '스냅샷 없음' },
        ].map(card => (
          <div key={card.label} style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6, fontWeight: 600 }}>{card.label}</div>
            {card.change != null ? (
              <>
                <div style={{ fontSize: 20, fontWeight: 800, color: card.change >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                  {card.change >= 0 ? '+' : ''}{fmtKrwInsight(card.change)}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: card.change >= 0 ? 'var(--color-profit)' : 'var(--color-loss)', marginTop: 2 }}>
                  {card.rate! >= 0 ? '+' : ''}{card.rate!.toFixed(2)}%
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>데이터 없음</div>
            )}
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* 총 자산 */}
      {latestSnap && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>총 자산 ({latestSnap.date})</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{fmtKrwInsight(latestSnap.totalAsset)}</span>
        </div>
      )}

      {/* 오늘 등락 기여 종목 */}
      {contributions.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 8, letterSpacing: '0.04em' }}>오늘 기준 종목별 등락 기여</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {contributions.slice(0, 6).map(c => (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-secondary)', borderRadius: 10, padding: '9px 12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>평가액 {fmtKrwInsight(c.value)}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.contrib >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                    {c.contrib >= 0 ? '+' : ''}{fmtKrwInsight(c.contrib)}
                  </div>
                  <div style={{ fontSize: 11, color: c.rate >= 0 ? 'var(--color-profit)' : 'var(--color-loss)', marginTop: 1, fontWeight: 600 }}>
                    {c.rate >= 0 ? '+' : ''}{c.rate.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8, textAlign: 'center' }}>* 오늘 시세 기준 — 주간 개별 종목 기여도 근사치</div>
        </>
      )}
    </div>
  );
}

function HoldingsWeightContent() {
  const { accounts, prices } = useAppContext();

  const holdings = accounts.flatMap(acc =>
    acc.holdings.filter(h => h.quantity > 0 || h.isFund).map(h => ({
      name: h.name,
      value: hValInsight(h, prices, {}),
      cls: classifyInsight(h.name),
    }))
  );
  const cash = accounts.reduce((s, acc) => s + (acc.cash || 0), 0);
  const total = holdings.reduce((s, h) => s + h.value, 0) + cash;

  const byClass: Record<string, number> = {};
  holdings.forEach(h => { byClass[h.cls] = (byClass[h.cls] || 0) + h.value; });
  if (cash > 0) byClass['현금'] = cash;

  const classColors: Record<string, string> = {
    '주식': 'var(--accent-blue)', '채권': 'var(--color-profit)', '커버드콜': '#a855f7',
    '금': '#f59e0b', '현금': 'var(--text-tertiary)',
  };

  const sortedHoldings = [...holdings].sort((a, b) => b.value - a.value);
  const maxVal = sortedHoldings[0]?.value || 1;

  return (
    <div>
      {/* 클래스별 비중 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 10, letterSpacing: '0.04em' }}>자산 클래스별 비중</div>
        {Object.entries(byClass).sort((a, b) => b[1] - a[1]).map(([cls, val]) => {
          const pct = total > 0 ? val / total * 100 : 0;
          const color = classColors[cls] || 'var(--text-secondary)';
          return (
            <div key={cls} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color }}>{cls}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fmtKrwInsight(val)} · {pct.toFixed(1)}%</span>
              </div>
              <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 99 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.4s' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* 종목별 상위 */}
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 8, letterSpacing: '0.04em' }}>종목별 비중 (상위 8)</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {sortedHoldings.slice(0, 8).map(h => {
          const pct = total > 0 ? h.value / total * 100 : 0;
          const color = classColors[h.cls] || 'var(--accent-blue)';
          return (
            <div key={h.name} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{h.name}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>{pct.toFixed(1)}%</span>
              </div>
              <div style={{ height: 4, background: 'var(--bg-tertiary)', borderRadius: 99 }}>
                <div style={{ height: '100%', width: `${(h.value / maxVal) * 100}%`, background: color, borderRadius: 99 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CashRatioContent() {
  const { accounts, prices } = useAppContext();

  const cash = accounts.reduce((s, acc) => s + (acc.cash || 0), 0);
  const investmentTotal = accounts.reduce((sum, acc) =>
    sum + acc.holdings.filter(h => h.quantity > 0 || h.isFund).reduce((s, h) => s + hValInsight(h, prices, {}), 0), 0
  );
  const total = cash + investmentTotal;
  const cashPct = total > 0 ? cash / total * 100 : 0;
  const TARGET_MIN = 5;
  const TARGET_MAX = 15;
  const status = cashPct < TARGET_MIN ? '부족' : cashPct > TARGET_MAX ? '과다' : '적정';
  const statusColor = status === '적정' ? 'var(--color-profit)' : status === '부족' ? 'var(--color-loss)' : 'var(--color-warning)';

  return (
    <div>
      {/* 현금 상태 */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, padding: '20px', marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6, fontWeight: 600 }}>현재 현금 비중</div>
        <div style={{ fontSize: 40, fontWeight: 800, color: statusColor }}>{cashPct.toFixed(1)}%</div>
        <div style={{ marginTop: 6, display: 'inline-block', padding: '3px 12px', borderRadius: 20, background: `color-mix(in srgb, ${statusColor} 15%, transparent)`, color: statusColor, fontSize: 12, fontWeight: 700 }}>
          {status}
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>목표 범위: {TARGET_MIN}~{TARGET_MAX}%</div>
      </div>

      {/* 현금 vs 투자 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          { label: '현금', value: cash, pct: cashPct, color: 'var(--text-secondary)' },
          { label: '투자 자산', value: investmentTotal, pct: 100 - cashPct, color: 'var(--accent-blue)' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, fontWeight: 600 }}>{c.label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: c.color }}>{fmtKrwInsight(c.value)}</div>
            <div style={{ fontSize: 12, color: c.color, marginTop: 2 }}>{c.pct.toFixed(1)}%</div>
          </div>
        ))}
      </div>

      {/* 비중 바 */}
      <div style={{ height: 12, borderRadius: 99, overflow: 'hidden', display: 'flex' }}>
        <div style={{ width: `${cashPct}%`, background: 'var(--text-tertiary)', transition: 'width 0.4s' }} />
        <div style={{ flex: 1, background: 'var(--accent-blue)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>현금 {cashPct.toFixed(1)}%</span>
        <span style={{ fontSize: 11, color: 'var(--accent-blue)' }}>투자 {(100 - cashPct).toFixed(1)}%</span>
      </div>

      {status !== '적정' && (
        <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: `color-mix(in srgb, ${statusColor} 10%, transparent)`, fontSize: 12, color: statusColor, lineHeight: 1.7 }}>
          {status === '부족'
            ? `현금이 목표(${TARGET_MIN}%) 미달 — 추가 매수 여력이 제한됩니다. 배당 또는 매도로 현금 확보를 검토하세요.`
            : `현금이 목표(${TARGET_MAX}%) 초과 — 분할 매수 기회를 놓치고 있을 수 있습니다. 목표 비중 대비 부족한 종목 매수를 검토하세요.`}
        </div>
      )}
    </div>
  );
}

function InsightModal({ type, onClose }: { type: string; onClose: () => void }) {
  const TITLES: Record<string, string> = {
    'weekly-return': '이번 주 수익률',
    'holdings-weight': '보유 종목 비중',
    'cash-ratio': '현금 비중',
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: 'var(--bg-elevated)', borderRadius: 18, padding: '24px',
        width: 'min(420px, calc(100vw - 32px))',
        maxHeight: 'calc(100vh - 60px)', overflowY: 'auto',
        boxShadow: '0 16px 60px rgba(0,0,0,0.3)', border: '1px solid var(--border-primary)',
        zIndex: 301,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MIcon name="bar_chart" size={18} style={{ color: 'var(--accent-blue)' }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{TITLES[type] || type}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: 4, borderRadius: 6 }}>
            <MIcon name="close" size={18} />
          </button>
        </div>
        {type === 'weekly-return' && <WeeklyReturnContent />}
        {type === 'holdings-weight' && <HoldingsWeightContent />}
        {type === 'cash-ratio' && <CashRatioContent />}
      </div>
    </>
  );
}

function getStockUrl(symbol: string): string {
  if (/^\d{6}$/.test(symbol)) return `https://finance.naver.com/item/main.nhn?code=${symbol}`;
  return `https://finance.yahoo.com/quote/${symbol}`;
}

const NEWS_LINKS = [
  { label: '네이버 시황', icon: 'article', url: 'https://finance.naver.com/news/marketflash.naver' },
  { label: '뉴욕 증시', icon: 'trending_up', url: 'https://finance.naver.com/news/news_list.naver?mode=LSS3D&section_id=101&section_id2=261&section_id3=0' },
  { label: '한국 증시', icon: 'show_chart', url: 'https://finance.naver.com/news/news_list.naver?mode=LSS3D&section_id=101&section_id2=258&section_id3=0' },
  { label: 'Bloomberg', icon: 'language', url: 'https://www.bloomberg.com/markets' },
  { label: 'Yahoo 뉴스', icon: 'feed', url: 'https://finance.yahoo.com/topic/stock-market-news/' },
];

// ── 오늘의 계획 · 마무리 기록 ──
interface DailyNote { plan: string; review: string; }
const NOTE_PREFIX = 'daily_note_';
function loadNote(date: string): DailyNote {
  try { return JSON.parse(localStorage.getItem(NOTE_PREFIX + date) || 'null') ?? { plan: '', review: '' }; }
  catch { return { plan: '', review: '' }; }
}
function saveNote(date: string, note: DailyNote) {
  localStorage.setItem(NOTE_PREFIX + date, JSON.stringify(note));
}
function getAllNoteDates(): string[] {
  const dates: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(NOTE_PREFIX)) {
      const date = k.slice(NOTE_PREFIX.length);
      const n = loadNote(date);
      if (n.plan || n.review) dates.push(date);
    }
  }
  return dates;
}
function getCalGrid(year: number, month: number) {
  return { firstDay: new Date(year, month, 1).getDay(), daysInMonth: new Date(year, month + 1, 0).getDate() };
}

function NotesCalendarModal({ selectedDate, onSelectDate, onClose }: {
  selectedDate: string; onSelectDate: (d: string) => void; onClose: () => void;
}) {
  const [year, setYear] = useState(() => parseInt(selectedDate.slice(0, 4)));
  const [month, setMonth] = useState(() => parseInt(selectedDate.slice(5, 7)) - 1);
  const [previewDate, setPreviewDate] = useState<string | null>(null);
  const [noteDates, setNoteDates] = useState<Set<string>>(() => new Set(getAllNoteDates()));

  useEffect(() => {
    fetch(`${WORKER_URL}/daily-notes/list`)
      .then(r => r.json())
      .then((dates: string[]) => setNoteDates(new Set([...getAllNoteDates(), ...dates])))
      .catch(() => {});
  }, []);
  const today = new Date().toISOString().slice(0, 10);
  const { firstDay, daysInMonth } = getCalGrid(year, month);
  const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

  const prev = () => month === 0 ? (setYear(y => y - 1), setMonth(11)) : setMonth(m => m - 1);
  const next = () => month === 11 ? (setYear(y => y + 1), setMonth(0)) : setMonth(m => m + 1);

  const btnStyle = (base: boolean, active: boolean): React.CSSProperties => ({
    padding: '0 6px', minWidth: 28, height: 34, borderRadius: 8, border: 'none',
    background: active ? '#191F28' : base ? '#EDF3FF' : 'transparent',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
  });

  const previewNote = previewDate ? loadNote(previewDate) : null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 340, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button onClick={prev} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-primary)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MIcon name="chevron_left" size={18} /></button>
          <span style={{ fontSize: 15, fontWeight: 800 }}>{year}년 {month + 1}월</span>
          <button onClick={next} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-primary)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MIcon name="chevron_right" size={18} /></button>
        </div>
        {/* 요일 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
          {DAYS.map((d, i) => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, padding: '3px 0', color: i === 0 ? '#F04452' : i === 6 ? '#3182F6' : 'var(--text-tertiary)' }}>{d}</div>)}
        </div>
        {/* 날짜 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const hasNote = noteDates.has(ds);
            const isToday = ds === today;
            const isSel = ds === selectedDate;
            const dow = (firstDay + i) % 7;
            return (
              <button key={day} onClick={() => { setPreviewDate(ds); onSelectDate(ds); }}
                style={btnStyle(isToday, isSel)}>
                <span style={{ fontSize: 12, fontWeight: isToday || isSel ? 700 : 400, color: isSel ? '#fff' : dow === 0 ? '#F04452' : dow === 6 ? '#3182F6' : 'var(--text-primary)', lineHeight: 1.2 }}>{day}</span>
                {hasNote && <div style={{ width: 4, height: 4, borderRadius: '50%', background: isSel ? '#fff' : '#30C85E', marginTop: 1 }} />}
              </button>
            );
          })}
        </div>
        {/* 선택된 날짜 미리보기 */}
        {previewDate && previewNote && (previewNote.plan || previewNote.review) && (
          <div style={{ marginTop: 14, background: 'var(--bg-secondary)', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>{previewDate}</div>
            {previewNote.plan && <div style={{ fontSize: 12, marginBottom: 4 }}><span style={{ color: '#30C85E', fontWeight: 700 }}>계획 </span>{previewNote.plan}</div>}
            {previewNote.review && <div style={{ fontSize: 12 }}><span style={{ color: '#3182F6', fontWeight: 700 }}>마무리 </span>{previewNote.review}</div>}
          </div>
        )}
        {previewDate && (!previewNote || (!previewNote.plan && !previewNote.review)) && (
          <div style={{ marginTop: 14, textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', padding: '10px 0' }}>기록 없음</div>
        )}
      </div>
    </div>
  );
}

function DailyNoteSection({ isMobile }: { isMobile: boolean }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [viewDate, setViewDate] = useState(todayStr);
  const [note, setNote] = useState<DailyNote>(() => loadNote(todayStr));
  const [showCal, setShowCal] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setNote(loadNote(viewDate));
    fetch(`${WORKER_URL}/daily-note/${viewDate}`)
      .then(r => r.json())
      .then((kv: DailyNote) => {
        if (kv.plan || kv.review) {
          setNote(kv);
          saveNote(viewDate, kv);
        }
      })
      .catch(() => {});
  }, [viewDate]);

  const isToday = viewDate === todayStr;
  const displayDate = (() => {
    const d = new Date(viewDate + 'T12:00:00');
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  })();

  const update = (field: 'plan' | 'review', value: string) => {
    const next = { ...note, [field]: value };
    setNote(next);
    saveNote(viewDate, next);
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`${WORKER_URL}/daily-note/${viewDate}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      }).then(() => { setSaved(true); setTimeout(() => setSaved(false), 1200); })
        .catch(() => {});
    }, 800);
  };

  const selectDate = (date: string) => {
    setViewDate(date);
    setShowCal(false);
  };

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: isMobile ? '16px' : '20px 24px', marginBottom: 12, border: '1px solid var(--border-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: '#EDFBF2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <MIcon name="edit_note" size={17} style={{ color: '#30C85E' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>오늘의 계획 · 마무리 기록</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{displayDate}</div>
        </div>
        <button onClick={() => setShowCal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border-primary)', background: '#fff', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
          <MIcon name="calendar_month" size={13} />달력
        </button>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#30C85E', marginBottom: 5 }}>오늘의 계획 (아침)</div>
        <textarea value={note.plan} onChange={e => update('plan', e.target.value)}
          placeholder='"오늘은 매수하지 않는다" / "○○ 종목 흐름 관찰만 한다"'
          rows={2}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-primary)', fontSize: 13, fontFamily: 'inherit', color: 'var(--text-primary)', background: 'var(--bg-secondary)', resize: 'vertical', boxSizing: 'border-box', outline: 'none', lineHeight: 1.6 }} />
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#3182F6', marginBottom: 5 }}>마무리 기록 (저녁)</div>
        <textarea value={note.review} onChange={e => update('review', e.target.value)}
          placeholder='"오늘 잘 참았다" / "감정이 흔들렸다" — 매매 이유와 감정도 기록하세요'
          rows={2}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-primary)', fontSize: 13, fontFamily: 'inherit', color: 'var(--text-primary)', background: 'var(--bg-secondary)', resize: 'vertical', boxSizing: 'border-box', outline: 'none', lineHeight: 1.6 }} />
      </div>

      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: saved ? '#30C85E' : 'var(--text-tertiary)' }}>
        <MIcon name={saved ? 'cloud_done' : 'cloud_upload'} size={12} style={{ opacity: 0.7 }} />
        {saved ? '클라우드 저장됨' : `입력 후 자동 저장 · ${isToday ? '오늘' : viewDate}`}
      </div>

      {showCal && <NotesCalendarModal selectedDate={viewDate} onSelectDate={selectDate} onClose={() => setShowCal(false)} />}
    </div>
  );
}

// ── 아침 시황 위젯 ──
interface BriefItem { price: number; change?: number; changePct: number; }
interface MorningData {
  indices: { kospi: BriefItem; kosdaq: BriefItem; nasdaq: BriefItem; sp500: BriefItem };
  usdKrw: BriefItem;
  tnx: BriefItem | null;
  usStocks: Record<string, BriefItem | null>;
  krStocks: { '005930': { price: number; changePct: number } | null; '000660': { price: number; changePct: number } | null };
  lastUpdated: string;
}

function MorningBriefWidget({ isMobile }: { isMobile: boolean }) {
  const [data, setData] = useState<MorningData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState('');
  const [chartModal, setChartModal] = useState<ChartConfig | null>(null);
  const [news, setNews] = useState<{ title: string; url: string }[]>([]);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${WORKER_URL}/morning-brief`);
      if (res.ok) {
        setData(await res.json());
        setFetchedAt(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch_();
    fetch(`${WORKER_URL}/naver-finance-news`)
      .then(r => r.json())
      .then(d => Array.isArray(d) && setNews(d))
      .catch(() => {});
  }, [fetch_]);

  const upColor = '#F04452';   // 한국 증시 관행: 상승=빨강
  const dnColor = '#3182F6';   // 하락=파랑
  const pColor = (pct: number) => pct > 0 ? upColor : pct < 0 ? dnColor : 'var(--text-tertiary)';
  const pStr = (pct: number) => `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`;
  const numFmt = (n: number, digits = 0) => n.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

  const IndexChip = ({ label, item }: { label: string; item?: BriefItem }) => (
    <div style={{ flex: '1 1 0', minWidth: 0, background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 10px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 3 }}>{label}</div>
      {item ? (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{numFmt(item.price)}</div>
          <div style={{ fontSize: 11, color: pColor(item.changePct), fontWeight: 600 }}>{pStr(item.changePct)}</div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>—</div>
      )}
    </div>
  );

  const StockChip = ({ label, price, changePct, prefix = '', symbol }: { label: string; price: number; changePct: number; prefix?: string; symbol?: string }) => (
    <div onClick={symbol ? () => window.open(getStockUrl(symbol), '_blank') : undefined}
      style={{ flexShrink: 0, background: 'var(--bg-secondary)', borderRadius: 10, padding: '8px 12px', textAlign: 'center', minWidth: 72, cursor: symbol ? 'pointer' : 'default' }}>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{prefix}{numFmt(price, price < 100 ? 2 : 0)}</div>
      <div style={{ fontSize: 10, color: pColor(changePct), fontWeight: 600 }}>{pStr(changePct)}</div>
    </div>
  );

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: isMobile ? '14px 14px' : '16px 20px', marginBottom: 16, border: '1px solid var(--border-primary)' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MIcon name="bar_chart" size={16} style={{ color: '#3182F6' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>아침 시황</span>
          {fetchedAt && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>· {fetchedAt} 기준</span>}
        </div>
        <button onClick={fetch_} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border-primary)', background: '#fff', cursor: loading ? 'default' : 'pointer', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
          <MIcon name="refresh" size={14} style={{ opacity: loading ? 0.4 : 1, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? '조회 중...' : '새로고침'}
        </button>
      </div>

      {!data && !loading && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>데이터를 불러오지 못했습니다</div>
      )}

      {loading && !data && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>시황 조회 중...</div>
      )}

      {data && (
        <>
          {/* 지수 */}
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.05em' }}>지수</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <IndexChip label="KOSPI" item={data.indices.kospi} />
            <IndexChip label="KOSDAQ" item={data.indices.kosdaq} />
            <IndexChip label="NASDAQ" item={data.indices.nasdaq} />
            <IndexChip label="S&P500" item={data.indices.sp500} />
          </div>

          {/* 환율 · 금리 */}
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.05em' }}>환율 · 금리</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
            <div onClick={() => setChartModal({ title: '달러/원 환율', endpoint: 'chart/usdkrw', color: '#3182F6', unit: '원', decimals: 1 })}
              style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>달러 / 원</span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{numFmt(data.usdKrw.price, 1)}원</div>
                <div style={{ fontSize: 11, color: pColor(data.usdKrw.changePct) }}>{data.usdKrw.change !== undefined ? `${data.usdKrw.change > 0 ? '+' : ''}${data.usdKrw.change.toFixed(1)}원` : ''} ({pStr(data.usdKrw.changePct)})</div>
              </div>
            </div>
            <div onClick={() => setChartModal({ title: '미 10년물 국채 금리', endpoint: 'chart/tnx', color: '#FF9500', unit: '%', decimals: 3 })}
              style={{ flex: 1, background: data.tnx ? (data.tnx.changePct > 0 ? '#FFF4E5' : '#EDF3FF') : 'var(--bg-secondary)', borderRadius: 10, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>미 10년물 금리</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{data.tnx ? (data.tnx.changePct > 0 ? '주가 하락 압력 ↑' : '주식 매력 상승 ↑') : ''}</div>
              </div>
              {data.tnx ? (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: data.tnx.changePct > 0 ? '#FF9500' : '#3182F6' }}>{data.tnx.price.toFixed(3)}%</div>
                  <div style={{ fontSize: 11, color: pColor(data.tnx.changePct) }}>{pStr(data.tnx.changePct)}</div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>—</div>
              )}
            </div>
          </div>

          {/* 주요 종목 — 가로 스크롤 */}
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.05em' }}>주요 종목</div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {data.usStocks['NVDA'] && <StockChip label="NVDA" prefix="$" price={data.usStocks['NVDA']!.price} changePct={data.usStocks['NVDA']!.changePct} symbol="NVDA" />}
            {data.usStocks['AAPL'] && <StockChip label="AAPL" prefix="$" price={data.usStocks['AAPL']!.price} changePct={data.usStocks['AAPL']!.changePct} symbol="AAPL" />}
            {data.usStocks['MSFT'] && <StockChip label="MSFT" prefix="$" price={data.usStocks['MSFT']!.price} changePct={data.usStocks['MSFT']!.changePct} symbol="MSFT" />}
            {data.usStocks['AMZN'] && <StockChip label="AMZN" prefix="$" price={data.usStocks['AMZN']!.price} changePct={data.usStocks['AMZN']!.changePct} symbol="AMZN" />}
            {data.usStocks['GOOGL'] && <StockChip label="GOOGL" prefix="$" price={data.usStocks['GOOGL']!.price} changePct={data.usStocks['GOOGL']!.changePct} symbol="GOOGL" />}
            {data.usStocks['TSLA'] && <StockChip label="TSLA" prefix="$" price={data.usStocks['TSLA']!.price} changePct={data.usStocks['TSLA']!.changePct} symbol="TSLA" />}
            {data.usStocks['JPM'] && <StockChip label="JPM" prefix="$" price={data.usStocks['JPM']!.price} changePct={data.usStocks['JPM']!.changePct} symbol="JPM" />}
            {data.usStocks['WMT'] && <StockChip label="WMT" prefix="$" price={data.usStocks['WMT']!.price} changePct={data.usStocks['WMT']!.changePct} symbol="WMT" />}
            {data.krStocks['005930'] && <StockChip label="삼성" price={data.krStocks['005930']!.price} changePct={data.krStocks['005930']!.changePct} symbol="005930" />}
            {data.krStocks['000660'] && <StockChip label="SK하이닉" price={data.krStocks['000660']!.price} changePct={data.krStocks['000660']!.changePct} symbol="000660" />}
          </div>

          {/* 뉴스 */}
          {news.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.05em', marginTop: 12 }}>뉴스</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {news.map((item, i) => (
                  <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'block', padding: '6px 8px', borderRadius: 8, fontSize: 12, color: 'var(--text-primary)', textDecoration: 'none', lineHeight: 1.5, background: 'var(--bg-secondary)' }}>
                    {item.title}
                  </a>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {chartModal && <ChartModal config={chartModal} onClose={() => setChartModal(null)} />}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── 공통 섹션 카드 ──
interface SectionDef {
  icon: string; color: string; bg: string;
  title: string; subtitle: string;
  items: string[];
  searchLinks?: string[];
  insightKeys?: (string | null)[];
  note?: string;
}

function SectionCard({ section, si, checked, onToggle, isMobile, onInsight }: {
  section: SectionDef; si: number;
  checked: Set<string>; onToggle: (key: string) => void; isMobile: boolean;
  onInsight?: (itemIndex: number, key: string) => void;
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: isMobile ? '16px' : '20px 24px', marginBottom: 12, border: '1px solid var(--border-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: section.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <MIcon name={section.icon} size={17} style={{ color: section.color }} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{section.title}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{section.subtitle}</div>
        </div>
      </div>
      {section.note && (
        <div style={{ background: section.bg, borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 12, color: section.color, lineHeight: 1.7, fontWeight: 500 }}>
          {section.note}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {section.items.map((item, ii) => {
          const key = `${si}-${ii}`;
          const done = checked.has(key);
          const insightKey = section.insightKeys?.[ii];
          const searchQ = insightKey ? null : section.searchLinks?.[ii];
          const naverUrl = searchQ ? `https://search.naver.com/search.naver?query=${encodeURIComponent(searchQ)}` : null;
          return (
            <div key={ii} style={{ display: 'flex', borderRadius: 10, overflow: 'hidden' }}>
              <button onClick={() => onToggle(key)}
                style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 10px', border: 'none', background: done ? section.bg : 'var(--bg-secondary)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'background 0.15s' }}>
                <div style={{ width: 18, height: 18, borderRadius: 5, border: done ? 'none' : `1.5px solid ${section.color}55`, background: done ? section.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, transition: 'all 0.15s' }}>
                  {done && <MIcon name="check" size={13} style={{ color: '#fff' }} />}
                </div>
                <span style={{ fontSize: 13, color: done ? section.color : 'var(--text-primary)', fontWeight: done ? 600 : 400, textDecoration: done ? 'line-through' : 'none', lineHeight: 1.5, opacity: done ? 0.75 : 1 }}>
                  {item}
                </span>
              </button>
              {insightKey && onInsight && (
                <button
                  onClick={() => onInsight(ii, insightKey)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, flexShrink: 0, background: done ? section.bg : 'var(--bg-secondary)', color: section.color, border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                  title="내 데이터로 확인"
                >
                  <MIcon name="bar_chart" size={14} />
                </button>
              )}
              {naverUrl && (
                <a href={naverUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, flexShrink: 0, background: done ? section.bg : 'var(--bg-secondary)', color: 'var(--text-tertiary)', textDecoration: 'none', transition: 'background 0.15s' }}>
                  <MIcon name="open_in_new" size={13} />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const TABS = [
  { id: 'daily',      label: '매일',      icon: 'today' },
  { id: 'weekly',     label: '매주',      icon: 'date_range' },
  { id: 'monthly',    label: '매월',      icon: 'calendar_month' },
  { id: 'quarterly',  label: '매분기',    icon: 'event_note' },
  { id: 'yearly',     label: '매년',      icon: 'emoji_events' },
  { id: 'stockcheck', label: '신규종목체크', icon: 'manage_search' },
] as const;
type TabId = typeof TABS[number]['id'];

// ── 매일할일 체크리스트 ──
const DAILY_SECTIONS = [
  {
    icon: 'bar_chart',
    color: '#6366F1',
    bg: '#EEEEFF',
    title: '주요 기업 주가 체크',
    subtitle: '대표주의 흐름이 오늘 시장의 신호',
    items: [
      '엔비디아',
      '애플 · 마이크로소프트 · 아마존 · 구글 · 테슬라',
      'JP모건 · 월마트',
      '삼성전자 · SK하이닉스',
      '변동폭 큰 종목 이유 파악',
    ],
    searchLinks: [
      '엔비디아 주가',
      '빅테크 주가 오늘',
      'JP모건 월마트 주가',
      '삼성전자 SK하이닉스 주가',
      '오늘 주가 급등 급락 이유',
    ],
  },
  {
    icon: 'wb_sunny',
    color: '#FF9500',
    bg: '#FFF4E5',
    title: '아침 시황 확인',
    subtitle: '뉴스를 보되, 해석은 천천히. 제목에 휘둘리지 말 것',
    items: [
      '세계 시장 뉴스 가볍게 훑기 (뉴욕 증시 방향)',
      '환율 확인 — 전일 대비 변화폭',
      '미국 10년물 국채 금리 확인',
      '"삼성전자 실적 쇼크" 같은 기사는 실제 공시를 직접 확인',
    ],
    searchLinks: [
      '뉴욕 증시 오늘',
      '달러원 환율 오늘',
      '미국 10년물 국채 금리',
      '삼성전자 공시',
    ],
  },
  {
    icon: 'trending_up',
    color: '#3182F6',
    bg: '#EDF3FF',
    title: '핵심 지표 — 미 10년물 금리',
    subtitle: '모든 자산 가격이 연결된 시장의 심장박동',
    items: [
      '금리 상승 → 기업 비용 증가 → 주가 하락 압력',
      '금리 하락 → 주식 매력 상승 → 시장 자금 유입',
      '금리 급변동 시 → 시장 흔들림 예상, 섣불리 매매 자제',
    ],
    searchLinks: [
      '미국 금리 인상 주가 영향',
      '미국 금리 인하 주식 시장',
      '미국 국채 금리 급등 증시',
    ],
    note: '미 10년물 국채 금리는 전 세계 돈의 기준. "국채 4~5% 받으면 굳이 위험한 주식을?" — 이 심리가 시장을 움직인다.',
  },
];

// ── 날짜별 체크 상태 관리 ──
function todayKey() {
  return `routine_daily_${new Date().toISOString().slice(0, 10)}`;
}
function loadChecked(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(todayKey()) || '[]')); }
  catch { return new Set(); }
}
function saveChecked(s: Set<string>) {
  localStorage.setItem(todayKey(), JSON.stringify([...s]));
}

function DailyTab({ isMobile }: { isMobile: boolean }) {
  const [checked, setChecked] = useState<Set<string>>(loadChecked);

  const toggle = (key: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      saveChecked(next);
      return next;
    });
  };

  const totalItems = DAILY_SECTIONS.reduce((acc, s) => acc + s.items.length, 0);
  const doneCount = checked.size;
  const pct = Math.round((doneCount / totalItems) * 100);

  return (
    <div>
      {/* 아침 시황 위젯 */}
      <MorningBriefWidget isMobile={isMobile} />

      {/* 섹션별 카드 — 주요 기업 주가 체크가 위젯 바로 아래 */}
      {DAILY_SECTIONS.map((section, si) => (
        <SectionCard key={si} section={section} si={si} checked={checked} onToggle={toggle} isMobile={isMobile} />
      ))}

      {/* 진행률 */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', marginBottom: 16, border: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>오늘의 루틴</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? '#30C85E' : 'var(--text-tertiary)' }}>{doneCount}/{totalItems}</span>
          </div>
          <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#30C85E' : '#3182F6', borderRadius: 99, transition: 'width 0.3s' }} />
          </div>
        </div>
        {pct === 100 && (
          <div style={{ fontSize: 13, fontWeight: 700, color: '#30C85E', display: 'flex', alignItems: 'center', gap: 4 }}>
            <MIcon name="check_circle" size={18} style={{ color: '#30C85E' }} /> 완료
          </div>
        )}
      </div>

      {/* 오늘의 계획 · 마무리 기록 */}
      <DailyNoteSection isMobile={isMobile} />

      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 8 }}>
        체크 항목은 매일 자정에 초기화됩니다
      </p>
    </div>
  );
}

// ── 매주할일 ──
const WEEKLY_SECTIONS: SectionDef[] = [
  {
    icon: 'account_balance_wallet',
    color: '#3182F6',
    bg: '#EDF3FF',
    title: '포트폴리오 구조 점검',
    subtitle: '수익률이 아니라 구조를 보십시오 — 우연인가, 전략의 힘인가',
    items: [
      '이번 주 수익률 확인 → "우연인가, 구조의 힘인가?" 판단',
      '보유 종목별 비중이 계획 대비 과도하게 쏠린 곳은 없는가',
      '현금 비중이 목표 범위 안에 있는가',
    ],
    insightKeys: ['weekly-return', 'holdings-weight', 'cash-ratio'],
    searchLinks: [null, null, null],
  },
  {
    icon: 'edit_note',
    color: '#6366F1',
    bg: '#EEEEFF',
    title: '매매 이유 기록',
    subtitle: '이유가 반복되면 전략이 되고, 전략이 쌓이면 수익률을 지킨다',
    items: [
      '이번 주 매수한 종목 — 이유 한 줄 기록',
      '이번 주 매도한 종목 — 이유 한 줄 기록',
      '잘한 판단 vs 감정에 휘둘린 판단 구분',
    ],
    searchLinks: [
      '주식 매수 기록 방법',
      '주식 매도 기록 방법',
      '감정 매매 실수 방지 방법',
    ],
    note: '예) "삼성전자 매도 후 주가 상승 → 매도 타이밍 조급함" / "현금 유지 → 금리 불확실성 대응 성공"',
  },
  {
    icon: 'lightbulb',
    color: '#FF9500',
    bg: '#FFF4E5',
    title: '다음 주 계획',
    subtitle: '지난 주 이유가 다음 주 전략이 된다',
    items: [
      '반복된 실수 패턴이 있는가 → 다음 주 주의사항 한 줄',
      '관심 종목 중 다음 주 점검할 항목 정리',
      '"이유 없이 사고 싶다"는 충동이 있다면 → 1주 대기',
    ],
    searchLinks: [
      '주식 투자 실수 반복 방지',
      '관심 종목 주가 분석',
      '충동 매수 방지 투자 원칙',
    ],
  },
];

function weekKey() {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `routine_weekly_${d.getFullYear()}_${week}`;
}

function WeeklyTab({ isMobile }: { isMobile: boolean }) {
  const [checked, setChecked] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(weekKey()) || '[]')); } catch { return new Set(); }
  });
  const [insightType, setInsightType] = useState<string | null>(null);

  const toggle = (key: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      localStorage.setItem(weekKey(), JSON.stringify([...next]));
      return next;
    });
  };

  const totalItems = WEEKLY_SECTIONS.reduce((acc, s) => acc + s.items.length, 0);
  const pct = Math.round((checked.size / totalItems) * 100);

  return (
    <div>
      <div style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', marginBottom: 16, border: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>이번 주 루틴</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? '#30C85E' : 'var(--text-tertiary)' }}>{checked.size}/{totalItems}</span>
          </div>
          <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#30C85E' : '#6366F1', borderRadius: 99, transition: 'width 0.3s' }} />
          </div>
        </div>
      </div>

      {WEEKLY_SECTIONS.map((section, si) => (
        <SectionCard key={si} section={section} si={si} checked={checked} onToggle={toggle} isMobile={isMobile}
          onInsight={(_, key) => setInsightType(key)} />
      ))}
      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 8 }}>체크 항목은 매주 월요일에 초기화됩니다</p>

      {insightType && <InsightModal type={insightType} onClose={() => setInsightType(null)} />}
    </div>
  );
}

// ── 매월할일 ──
const MONTHLY_SECTIONS: SectionDef[] = [
  {
    icon: 'public',
    color: '#3182F6',
    bg: '#EDF3FF',
    title: '거시 지표 월간 변화 확인',
    subtitle: '숫자 하나가 아니라, 방향과 속도를 읽는 것이 핵심',
    items: [
      '미 10년물 금리 — 전월 대비 방향과 변화폭 확인',
      '원/달러 환율 — 외국인 자금 흐름의 신호',
      '코스피 흐름 — 단순 반등인가, 새로운 추세의 시작인가',
    ],
    searchLinks: [
      '미국 10년물 국채 금리 월간 추이',
      '달러원 환율 월간 흐름',
      '코스피 월간 흐름',
    ],
    note: '예) 금리 3.8%→4.3% 상승이면 단순 수치가 아닌 기류 변화. 환율 1,350→1,400이면 외국인 이탈 신호.',
  },
  {
    icon: 'account_tree',
    color: '#6366F1',
    bg: '#EEEEFF',
    title: '섹터·자산 흐름 파악',
    subtitle: '어떤 종목이 올랐는가보다 어떤 흐름이 만들어지는가',
    items: [
      '강한 섹터 / 약한 섹터 확인 → 시장 관심 이동 방향 파악',
      '성장주 vs 가치주 흐름 — 어디로 돈이 움직이는가',
      '내 포트폴리오가 이 흐름과 맞닿아 있는가',
    ],
    searchLinks: [
      '강한 섹터 약한 섹터 분석',
      '성장주 가치주 흐름 비교',
      '포트폴리오 섹터 배분',
    ],
  },
  {
    icon: 'tune',
    color: '#FF9500',
    bg: '#FFF4E5',
    title: '포트폴리오 비중 점검',
    subtitle: '한 달 전 세운 구성이 지금도 유효한가',
    items: [
      '주식 / 채권 / 현금 비율이 목표 대비 어긋난 곳은 없는가',
      'ETF 비중 조정이 필요한가',
      '특정 섹터 과집중 여부 확인',
    ],
    searchLinks: [
      '주식 채권 현금 비율 조정',
      'ETF 리밸런싱 방법',
      '섹터 분산 투자 방법',
    ],
  },
  {
    icon: 'self_improvement',
    color: '#30C85E',
    bg: '#EDFBF2',
    title: '원칙 준수 자기 점검',
    subtitle: '투자는 결국 자신과의 대화입니다',
    items: [
      '"하락장에서도 분할 매수 원칙을 지켰는가?"',
      '"단기 뉴스에 흔들려 감정적으로 매도하지 않았는가?"',
      '"싼 종목이 아니라 가치 있는 종목을 샀는가?"',
    ],
    searchLinks: [
      '하락장 분할 매수 전략',
      '감정적 매도 방지 투자 원칙',
      '저평가 가치 투자 방법',
    ],
  },
];

function monthKey() {
  const d = new Date();
  return `routine_monthly_${d.getFullYear()}_${d.getMonth() + 1}`;
}

function MonthlyTab({ isMobile }: { isMobile: boolean }) {
  const [checked, setChecked] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(monthKey()) || '[]')); } catch { return new Set(); }
  });

  const toggle = (key: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      localStorage.setItem(monthKey(), JSON.stringify([...next]));
      return next;
    });
  };

  const totalItems = MONTHLY_SECTIONS.reduce((acc, s) => acc + s.items.length, 0);
  const pct = Math.round((checked.size / totalItems) * 100);

  return (
    <div>
      <div style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', marginBottom: 16, border: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>이번 달 루틴</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? '#30C85E' : 'var(--text-tertiary)' }}>{checked.size}/{totalItems}</span>
          </div>
          <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#30C85E' : '#FF9500', borderRadius: 99, transition: 'width 0.3s' }} />
          </div>
        </div>
      </div>

      {MONTHLY_SECTIONS.map((section, si) => (
        <SectionCard key={si} section={section} si={si} checked={checked} onToggle={toggle} isMobile={isMobile} />
      ))}
      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 8 }}>체크 항목은 매월 1일에 초기화됩니다</p>
    </div>
  );
}

// ── 매분기할일 ──
const QUARTERLY_SECTIONS: SectionDef[] = [
  {
    icon: 'trending_up',
    color: '#3182F6',
    bg: '#EDF3FF',
    title: '매출 — 시장 지배력과 성장성',
    subtitle: '증가 이유까지 파악해야 진짜 점검',
    items: [
      '전분기 대비 매출 방향 확인 (증가 / 감소)',
      '매출 변화 이유 한 줄 기록 (신제품 출시 / 환율 효과 / 가격 상승 등)',
      '시장점유율이 늘었는가, 단순 가격 상승인가 구분',
    ],
    searchLinks: [
      '분기 실적 매출 분석',
      '매출 증가 원인 분석',
      '시장점유율 분석 방법',
    ],
  },
  {
    icon: 'fitness_center',
    color: '#6366F1',
    bg: '#EEEEFF',
    title: '영업이익 — 기업의 체력',
    subtitle: '매출이 늘었는데 이익이 줄었다면 비용 구조를 확인',
    items: [
      '영업이익률 전분기 대비 방향 확인',
      '이익 감소 시 → 원자재 / 판관비 / 인건비 중 원인 파악',
      '손익계산서 직접 확인 (IR 자료 or 공시)',
    ],
    searchLinks: [
      '영업이익률 분기 분석',
      '기업 비용 구조 원자재 인건비',
      '기업 손익계산서 읽는 법',
    ],
    note: '매출 ↑ + 영업이익 ↓ = 비용 문제. 매출 ↓ + 영업이익 ↑ = 구조 개선.',
  },
  {
    icon: 'water_drop',
    color: '#0EA5E9',
    bg: '#E0F4FF',
    title: 'FCF (잉여현금흐름) — 진짜 돈이 남는가',
    subtitle: '이익이 있어도 현금이 빠지면 기업은 숨이 차다',
    items: [
      'FCF가 플러스인가 마이너스인가 확인',
      'FCF 마이너스 시 → 신규 투자 확대인가, 운영 문제인가 구분',
      '순이익과 FCF의 괴리가 크면 이유 파악',
    ],
    searchLinks: [
      'FCF 잉여현금흐름 분석',
      'FCF 마이너스 원인 설비 투자',
      '순이익 FCF 차이 이유',
    ],
    note: '순이익 1,000억 + FCF 마이너스 = 현금이 설비·재고에 묶인 상태.',
  },
  {
    icon: 'percent',
    color: '#30C85E',
    bg: '#EDFBF2',
    title: 'ROE (자기자본이익률) — 자본 효율성',
    subtitle: '내 돈으로 얼마나 잘 버는가',
    items: [
      'ROE 전분기 대비 방향 확인',
      'ROE 지속 하락 시 → 경쟁력 약화 경고 신호',
      '"실적 개선됐는가? 전망이 유지되는가?" 두 질문으로 마무리',
    ],
    searchLinks: [
      'ROE 자기자본이익률 분석',
      'ROE 하락 기업 경쟁력 약화',
      '기업 분기 실적 점검 방법',
    ],
    note: '이 네 가지(매출 · 영업이익 · FCF · ROE)를 분기마다 기록하면 기업 점검표가 완성된다.',
  },
];

function quarterKey() {
  const d = new Date();
  const q = Math.ceil((d.getMonth() + 1) / 3);
  return `routine_quarterly_${d.getFullYear()}_Q${q}`;
}

function QuarterlyTab({ isMobile }: { isMobile: boolean }) {
  const [checked, setChecked] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(quarterKey()) || '[]')); } catch { return new Set(); }
  });

  const toggle = (key: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      localStorage.setItem(quarterKey(), JSON.stringify([...next]));
      return next;
    });
  };

  const totalItems = QUARTERLY_SECTIONS.reduce((acc, s) => acc + s.items.length, 0);
  const pct = Math.round((checked.size / totalItems) * 100);

  return (
    <div>
      <div style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', marginBottom: 16, border: '1px solid var(--border-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>이번 분기 루틴</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? '#30C85E' : 'var(--text-tertiary)' }}>{checked.size}/{totalItems}</span>
        </div>
        <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#30C85E' : '#0EA5E9', borderRadius: 99, transition: 'width 0.3s' }} />
        </div>
      </div>

      {QUARTERLY_SECTIONS.map((section, si) => (
        <SectionCard key={si} section={section} si={si} checked={checked} onToggle={toggle} isMobile={isMobile} />
      ))}
      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 8 }}>체크 항목은 분기마다 초기화됩니다</p>
    </div>
  );
}

// ── 매년할일 ──
const YEARLY_SECTIONS: SectionDef[] = [
  {
    icon: 'verified_user',
    color: '#3182F6',
    bg: '#EDF3FF',
    title: '원칙 준수 자기평가',
    subtitle: '수익률보다 먼저 올해의 나를 들여다보는 시간',
    items: [
      '"올해 세운 투자 원칙을 실제로 지켰는가?" 솔직하게 점검',
      '급락장에서 원칙대로 매수했는가, 아니면 뉴스에 흔들려 매도했는가',
      '지킨 하루는 신념으로, 흔들린 하루는 교훈으로 기록',
    ],
    searchLinks: [
      '투자 원칙 점검 방법',
      '급락장 공포 극복 매수 전략',
      '투자 원칙 기록 일기 방법',
    ],
    note: '"3월 급락장에서 공포를 이기고 매수했는가, 아니면 뉴스에 흔들려 매도 버튼을 눌렀는가?"',
  },
  {
    icon: 'psychology_alt',
    color: '#F04452',
    bg: '#FFF0F1',
    title: '판단을 흔든 요인 기록',
    subtitle: '이 기록은 내년의 실수를 막는 방패입니다',
    items: [
      '친구 추천 / 유튜브 낙관론 / 추격 매수 등 외부 요인에 흔들린 사례 기록',
      '그 순간의 감정(조급함 · 불안 · 탐욕)을 구체적으로 적기',
      '"왜 그 판단을 했는가?" — 감정이 아닌 이유를 역추적',
    ],
    searchLinks: [
      '추격 매수 실패 주식 심리',
      '투자 심리 조급함 탐욕 관리',
      '매매 이유 역추적 방법',
    ],
  },
  {
    icon: 'trending_up',
    color: '#30C85E',
    bg: '#EDFBF2',
    title: '태도의 성장 점검',
    subtitle: '돈이 아니라 태도의 성장이 진짜 수익률',
    items: [
      '작년 대비 시세 확인 빈도가 줄었는가 (매일→주 1회 등)',
      '손실에 반응하는 방식이 바뀌었는가 (분노→분석→기록)',
      '내년의 루틴·원칙 한 가지 개선사항 기록',
    ],
    searchLinks: [
      '주식 시세 확인 빈도 줄이기',
      '투자 손실 대응 방식 개선',
      '투자 루틴 개선 방법',
    ],
    note: '수익보다 더 큰 자산은 바로 이 "태도의 변화"입니다. 태도의 변화가 없으면, 다음 해의 수익도 없습니다.',
  },
  {
    icon: 'repeat',
    color: '#8B5CF6',
    bg: '#F3F0FF',
    title: '루틴의 힘 — 꾸준함으로 마무리',
    subtitle: '단조로움이 마음을 단단하게 만든다',
    items: [
      '버핏처럼: 같은 시간 · 같은 원칙 · 같은 방식으로 한 해를 마무리',
      '"시장의 싸움, 정보의 싸움, 자신과의 싸움" — 셋 중 가장 중요한 싸움은?',
      '한 해의 마지막 날, 그래프보다 일기를 먼저 열기',
    ],
    searchLinks: [
      '워런 버핏 투자 루틴 원칙',
      '투자 정보 시장 마음 관리',
      '투자 일기 쓰는 법',
    ],
    note: '"Process becomes routine." 과정이 습관이 되고, 습관이 결과를 만든다.',
  },
];

function yearKey() {
  return `routine_yearly_${new Date().getFullYear()}`;
}

function YearlyTab({ isMobile }: { isMobile: boolean }) {
  const [checked, setChecked] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(yearKey()) || '[]')); } catch { return new Set(); }
  });

  const toggle = (key: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      localStorage.setItem(yearKey(), JSON.stringify([...next]));
      return next;
    });
  };

  const totalItems = YEARLY_SECTIONS.reduce((acc, s) => acc + s.items.length, 0);
  const pct = Math.round((checked.size / totalItems) * 100);

  return (
    <div>
      <div style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', marginBottom: 16, border: '1px solid var(--border-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>올해 루틴</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? '#30C85E' : 'var(--text-tertiary)' }}>{checked.size}/{totalItems}</span>
        </div>
        <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#30C85E' : '#8B5CF6', borderRadius: 99, transition: 'width 0.3s' }} />
        </div>
      </div>

      {YEARLY_SECTIONS.map((section, si) => (
        <SectionCard key={si} section={section} si={si} checked={checked} onToggle={toggle} isMobile={isMobile} />
      ))}
      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 8 }}>체크 항목은 매년 1월 1일에 초기화됩니다</p>
    </div>
  );
}

// ── 신규 종목 체크 ──
interface StockCheckResult {
  ticker: string; name: string; sector: string; industry: string; currency: string;
  price: number; marketCap: number;
  technical: {
    ma30w: number | null; maAbove: boolean | null; maTrending: boolean | null;
    rsi: number | null; volumeRatio: number | null;
    week52High: number; week52Low: number; week52Pct: number; nearHigh: boolean;
  };
  fundamentals: {
    per: number | null; pbr: number | null; roe: number | null;
    debtToEquity: number | null; industryBenchmark: number;
  };
  epsHistory: { year: string; eps: number }[];
  checks: {
    maAbove: boolean | null; maTrending: boolean | null; rsiOk: boolean | null;
    nearHigh: boolean | null; epsGrowth3y: boolean | null;
    debtOk: boolean | null; roeOk: boolean | null; newsClean: boolean | null;
  };
  news: { items: { title: string; url: string; flagged: boolean }[]; redFlagCount: number; signal: string };
}

interface SavedStock {
  ticker: string; name: string; price: number; currency: string;
  date: string; passCount: number; totalCount: number;
}

function SignalBadge({ value, good, warn, na = '—' }: { value: boolean | null; good: string; warn: string; na?: string }) {
  if (value === null) return <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{na}</span>;
  return (
    <span style={{ fontSize: 12, fontWeight: 600, color: value ? '#00875A' : '#E2483D' }}>
      {value ? '● ' : '● '}{value ? good : warn}
    </span>
  );
}

function MetricBox({ label, value, unit = '', highlight }: { label: string; value: number | null; unit?: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 14px', background: highlight ? 'color-mix(in srgb, #6366F1 8%, transparent)' : 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border-primary)', minWidth: 70 }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: highlight ? '#6366F1' : 'var(--text-primary)' }}>
        {value != null ? `${value}${unit}` : '—'}
      </div>
    </div>
  );
}

function StockCheckTab({ isMobile }: { isMobile: boolean }) {
  const [ticker, setTicker] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StockCheckResult | null>(null);
  const [error, setError] = useState('');
  const [manualChecks, setManualChecks] = useState<Record<string, boolean>>({});
  const [savedStocks, setSavedStocks] = useState<SavedStock[]>([]);

  useEffect(() => {
    fetch(`${WORKER_URL}/stock-watchlist`)
      .then(r => r.json())
      .then((data: SavedStock[]) => setSavedStocks(data))
      .catch(() => {});
  }, []);

  const runCheck = async (overrideTicker?: string) => {
    const raw2 = (overrideTicker || ticker).trim();
    const t = /[^\x00-\x7F]/.test(raw2) ? raw2 : raw2.toUpperCase();
    if (!t) return;
    if (overrideTicker) setTicker(overrideTicker);
    setLoading(true); setError(''); setResult(null); setManualChecks({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      const res = await fetch(`${WORKER_URL}/stock-check?ticker=${encodeURIComponent(t)}`);
      const data = await res.json() as any;
      if (data.error) { setError(data.error); } else { setResult(data); }
    } catch { setError('네트워크 오류. 잠시 후 다시 시도해주세요.'); }
    finally { setLoading(false); }
  };

  const autoPassCount = (r: StockCheckResult) =>
    Object.values(r.checks).filter(v => v === true).length;
  const autoTotalCount = (r: StockCheckResult) =>
    Object.values(r.checks).filter(v => v !== null).length;

  const MUST_KEYS: (keyof StockCheckResult['checks'])[] = ['maAbove', 'maTrending', 'debtOk'];
  const getVerdict = (r: StockCheckResult) => {
    if (MUST_KEYS.some(k => r.checks[k] === false)) return 'danger' as const;
    if (Object.values(r.checks).some(v => v === false)) return 'caution' as const;
    return 'safe' as const;
  };

  const saveStock = async () => {
    if (!result) return;
    const entry: SavedStock = {
      ticker: result.ticker, name: result.name,
      price: result.price, currency: result.currency,
      date: new Date().toISOString().slice(0, 10),
      passCount: autoPassCount(result) + Object.values(manualChecks).filter(Boolean).length,
      totalCount: autoTotalCount(result) + Object.keys(manualChecks).length,
    };
    await fetch(`${WORKER_URL}/stock-watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    setSavedStocks(p => [entry, ...p.filter(s => s.ticker !== entry.ticker)].slice(0, 50));
  };

  const removeSaved = async (t: string) => {
    await fetch(`${WORKER_URL}/stock-watchlist`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker: t }),
    });
    setSavedStocks(p => p.filter(s => s.ticker !== t));
  };

  const fmtPrice = (p: number, currency: string) =>
    currency === 'USD' ? `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `${p.toLocaleString('ko-KR')}원`;

  const fmtCap = (cap: number, currency: string) => {
    if (!cap) return null;
    if (currency === 'KRW') {
      const uk = Math.round(cap / 1e8);
      return uk >= 10000 ? `${(uk / 10000).toFixed(1)}조원` : `${uk.toLocaleString('ko-KR')}억원`;
    }
    if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}T`;
    if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`;
    return `$${(cap / 1e6).toFixed(0)}M`;
  };

  const rsiColor = (v: number | null) => {
    if (v == null) return 'var(--text-tertiary)';
    if (v >= 70) return '#E2483D';
    if (v <= 30) return '#3182F6';
    return '#00875A';
  };

  const rsiLabel = (v: number | null) => {
    if (v == null) return '—';
    if (v >= 80) return `${v} 극과열 — 매도 적극 고려`;
    if (v >= 70) return `${v} 과열 — 추격 매수 금지`;
    if (v <= 20) return `${v} 극과매도 — 반등 가능성 높음`;
    if (v <= 30) return `${v} 과매도 — 단기 반등 고려 가능`;
    if (v >= 50) return `${v} 중립 (강세)`;
    return `${v} 중립 (약세)`;
  };

  const MANUAL_ITEMS = [
    { id: 'understand', label: '이 기업의 사업 내용을 이해하는가?' },
    { id: 'earnings',   label: '최근 분기 실적이 컨센서스를 충족했는가?' },
    { id: 'stoploss',   label: '매수 후 손절가를 미리 정해두었는가?' },
  ];

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-card, #fff)',
    borderRadius: 14,
    border: '1px solid var(--border-primary)',
    padding: '16px 18px',
    marginBottom: 12,
  };

  return (
    <div>
      {/* 검색 */}
      <div style={{ ...cardStyle, display: 'flex', gap: 8, alignItems: 'center' }}>
        <MIcon name="manage_search" size={20} style={{ color: '#6366F1', flexShrink: 0 }} />
        <input
          value={ticker}
          onChange={e => {
            const v = e.target.value;
            setTicker(/[^\x00-\x7F]/.test(v) ? v : v.toUpperCase());
          }}
          onKeyDown={e => e.key === 'Enter' && runCheck()}
          placeholder="티커 또는 종목명 (예: NVDA, SK하이닉스, 005930.KS)"
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, fontWeight: 600, fontFamily: 'inherit', background: 'transparent', color: 'var(--text-primary)' }}
        />
        <button
          onClick={runCheck}
          disabled={loading || !ticker.trim()}
          style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: '#6366F1', color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: loading ? 'wait' : 'pointer', opacity: (!ticker.trim()) ? 0.5 : 1 }}
        >
          {loading ? '조회 중...' : '조회'}
        </button>
      </div>

      {/* 에러 */}
      {error && (
        <div style={{ ...cardStyle, background: 'color-mix(in srgb, #E2483D 8%, transparent)', color: '#E2483D', fontWeight: 600, fontSize: 14 }}>
          <MIcon name="error_outline" size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />{error}
        </div>
      )}

      {/* 결과 */}
      {result && (
        <>
          {/* 종목 헤더 */}
          <div style={{ ...cardStyle, background: '#191F28', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800 }}>{result.name}</div>
                <div style={{ fontSize: 13, opacity: 0.6, marginTop: 2 }}>{result.ticker} · {result.sector}{result.industry ? ` · ${result.industry}` : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{fmtPrice(result.price, result.currency)}</div>
                {fmtCap(result.marketCap, result.currency) && (
                  <div style={{ fontSize: 14, opacity: 0.5, marginTop: 2 }}>시가총액 {fmtCap(result.marketCap, result.currency)}</div>
                )}
              </div>
            </div>
            {/* 패스율 */}
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14, opacity: 0.7 }}>
                <span>자동 체크 통과</span>
                <span>{autoPassCount(result)} / {autoTotalCount(result)}</span>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${autoTotalCount(result) > 0 ? (autoPassCount(result) / autoTotalCount(result)) * 100 : 0}%`, background: getVerdict(result) === 'danger' ? '#E2483D' : getVerdict(result) === 'caution' ? '#F59E0B' : '#30C85E', borderRadius: 99, transition: 'width 0.4s' }} />
              </div>
            </div>
          </div>

          {/* 종합 판정 */}
          {(() => {
            const verdict = getVerdict(result);
            const mustFailLabels: Record<string, string> = { maAbove: '30주 이평선 아래', maTrending: '30주 이평선 하락', debtOk: '부채비율 초과' };
            const mustFails = MUST_KEYS.filter(k => result.checks[k] === false);
            const bg = verdict === 'danger' ? 'color-mix(in srgb, #E2483D 10%, transparent)' : verdict === 'caution' ? 'color-mix(in srgb, #F59E0B 10%, transparent)' : 'color-mix(in srgb, #30C85E 10%, transparent)';
            const bd = verdict === 'danger' ? 'color-mix(in srgb, #E2483D 35%, transparent)' : verdict === 'caution' ? 'color-mix(in srgb, #F59E0B 35%, transparent)' : 'color-mix(in srgb, #30C85E 35%, transparent)';
            const mc = verdict === 'danger' ? '#E2483D' : verdict === 'caution' ? '#D97706' : '#00875A';
            return (
              <div style={{ ...cardStyle, background: bg, border: `1px solid ${bd}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <MIcon name={verdict === 'danger' ? 'block' : verdict === 'caution' ? 'pause_circle' : 'check_circle'} size={26} style={{ color: mc, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: mc, lineHeight: 1 }}>
                      {verdict === 'danger' ? '매수 금지' : verdict === 'caution' ? '매수 대기' : '매수 가능'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 3 }}>
                      {autoPassCount(result)} / {autoTotalCount(result)} 항목 통과
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  {verdict === 'danger' ? (
                    <>필수 조건 실패 — <strong style={{ color: '#E2483D' }}>{mustFails.map(k => mustFailLabels[k]).join(' · ')}</strong><br />
                    이 조건이 깨진 종목은 다른 지표가 아무리 좋아도 매수 대상에서 제외해야 합니다. 추세가 돌아올 때까지 관심 목록에만 담아두세요.</>
                  ) : verdict === 'caution' ? (
                    <>필수 조건(이평선·부채비율)은 통과했으나 일부 참고 지표가 미충족입니다.<br />
                    RSI·52주 위치 등 타이밍 지표를 고려해 비중을 줄이거나 진입 시점을 조율하세요.</>
                  ) : (
                    <>8개 항목 모두 통과. 현재 매수 기준을 충족한 종목입니다.<br />
                    손절가를 미리 설정하고, 분할 매수로 리스크를 분산하세요.</>
                  )}
                </div>
              </div>
            );
          })()}

          {/* 기술적 신호 */}
          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 14, letterSpacing: '0.05em' }}>기술적 신호</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* 30주 이평선 */}
              {(() => {
                const { ma30w, maAbove, maTrending } = result.technical;
                const distPct = ma30w && result.price ? ((result.price - ma30w) / ma30w * 100) : null;
                const reason = maAbove && maTrending
                  ? `MA 대비 +${distPct?.toFixed(1)}% 위치 · 선 우상향 → 추세 유효, 매수 구간`
                  : !maAbove && maTrending
                  ? `MA 대비 ${distPct?.toFixed(1)}% 아래 · 선은 우상향 → 눌림목 구간, 반등 주시`
                  : maAbove && !maTrending
                  ? `MA 위이나 선이 꺾임 → 추세 전환 경고, 비중 축소 고려`
                  : `MA 아래 + 선 하락 → 하락 추세, 매수 금지`;
                return (
                  <div style={{ paddingBottom: 12, borderBottom: '1px solid var(--border-primary)', marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>30주 이동평균선</span>
                      <div style={{ textAlign: 'right' }}>
                        <SignalBadge
                          value={maAbove}
                          good={`현재가 이평선(${ma30w?.toFixed(0)}) 위 +${distPct?.toFixed(1)}%`}
                          warn={`현재가 이평선(${ma30w?.toFixed(0)}) 아래 ${distPct?.toFixed(1)}%`}
                        />
                        {maTrending != null && <span style={{ fontSize: 13, color: maTrending ? '#00875A' : '#E2483D', marginLeft: 6 }}>· 이평선 {maTrending ? '▲ 상승 중' : '▼ 하락 중'}</span>}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>6개월 추세 기준선.</span> 주가가 위에 있고 선이 우상향일 때만 매수.<br />
                      <span style={{ color: maAbove && maTrending ? '#00875A' : '#E2483D', fontWeight: 600 }}>→ {reason}</span>
                    </div>
                  </div>
                );
              })()}
              {/* RSI */}
              {(() => {
                const v = result.technical.rsi;
                const reason = v == null ? '' : v >= 70 ? '과열 구간 — 추격 매수 금지. 기존 보유자는 익절 고려'
                  : v <= 30 ? '과매도 구간 — 단기 반등 가능성. 단, 하락 추세 지속 여부 추가 확인 필요'
                  : v >= 50 ? '중립~강세 구간 — 정상 상승 중, 추격보다 눌림목 대기'
                  : '중립~약세 구간 — 모멘텀 약함, 매수 서두르지 말 것';
                return (
                  <div style={{ paddingBottom: 12, borderBottom: '1px solid var(--border-primary)', marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>RSI (14일)</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: rsiColor(v) }}>{rsiLabel(v)}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>14일 상대강도지수.</span> 70 이상 과열 · 30 이하 과매도 · 50 중립.<br />
                      {reason && <span style={{ color: v != null && (v >= 70 || v <= 30) ? (v >= 70 ? '#E2483D' : '#3182F6') : 'var(--text-secondary)', fontWeight: 600 }}>→ {reason}</span>}
                    </div>
                  </div>
                );
              })()}
              {/* 거래량 */}
              {(() => {
                const vr = result.technical.volumeRatio;
                const reason = vr == null ? '' : vr >= 1.5 ? '거래량 급증 — 강한 매수세 확인. 추세 신뢰도 높음'
                  : vr >= 1.2 ? '평균 이상 거래량 — 추세를 뒷받침하는 건전한 거래량'
                  : vr >= 0.8 ? '평균 수준 거래량 — 특이사항 없음'
                  : '거래량 부족 — 상승해도 신뢰도 낮음, 세력 없는 움직임 주의';
                return (
                  <div style={{ paddingBottom: 12, borderBottom: '1px solid var(--border-primary)', marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>거래량 비율</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: vr != null && vr >= 1.2 ? '#00875A' : 'var(--text-secondary)' }}>{vr != null ? `${vr}x` : '—'} <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)' }}>(5일/20일 평균)</span></span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>최근 5일 평균 거래량 ÷ 20일 평균.</span> 1.2배 이상이면 거래량 동반 상승.<br />
                      {reason && <span style={{ color: vr != null && vr >= 1.2 ? '#00875A' : 'var(--text-secondary)', fontWeight: 600 }}>→ {reason}</span>}
                    </div>
                  </div>
                );
              })()}
              {/* 52주 */}
              {(() => {
                const { week52Pct, week52High, week52Low, nearHigh } = result.technical;
                const reason = week52Pct >= 75 ? '고점 근접 — 상대강도 강함. 신고가 돌파 시 강력 매수 신호'
                  : week52Pct >= 50 ? '중간 구간 — 회복 중. 고점 돌파 전까지는 관망'
                  : week52Pct >= 25 ? '하단 구간 — 하락세 지속 중. 바닥 확인 후 접근'
                  : '52주 최저가 근처 — 강한 하락 추세, 매수 금지';
                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>52주 고점 대비 위치</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 72, height: 6, borderRadius: 99, background: 'var(--border-primary)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${week52Pct}%`, background: nearHigh ? '#30C85E' : '#F59E0B', borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: nearHigh ? '#00875A' : 'var(--text-secondary)' }}>{week52Pct}%{nearHigh ? ' ✓' : ''}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>52주 범위 내 현재 위치 (저가={fmtPrice(week52Low, result.currency)} / 고가={fmtPrice(week52High, result.currency)}).</span> 75% 이상이면 상대강도 강한 종목.<br />
                      <span style={{ color: nearHigh ? '#00875A' : 'var(--text-secondary)', fontWeight: 600 }}>→ {reason}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* 재무 지표 */}
          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 14, letterSpacing: '0.05em' }}>재무 지표</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* PER / PBR / ROE */}
              <div style={{ paddingBottom: 12, borderBottom: '1px solid var(--border-primary)', marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  <MetricBox label="PER" value={result.fundamentals.per} />
                  <MetricBox label="PBR" value={result.fundamentals.pbr} />
                  <MetricBox label="ROE" value={result.fundamentals.roe} unit="%" highlight={result.fundamentals.roe != null && result.fundamentals.roe >= 15} />
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
                  <b style={{ color: 'var(--text-secondary)' }}>PER</b> 주가÷주당순이익. 낮을수록 저평가이나 성장주는 높게 형성됨. 업종 평균과 비교 필요.<br />
                  <b style={{ color: 'var(--text-secondary)' }}>PBR</b> 주가÷순자산. 1 미만이면 청산가치 이하 (저평가 신호).<br />
                  <b style={{ color: 'var(--text-secondary)' }}>ROE</b> 자기자본이익률. <span style={{ color: result.fundamentals.roe != null && result.fundamentals.roe >= 15 ? '#00875A' : result.fundamentals.roe != null ? '#E2483D' : 'inherit', fontWeight: 600 }}>
                    {result.fundamentals.roe != null ? (result.fundamentals.roe >= 15 ? `${result.fundamentals.roe}% → 15% 이상 우량 기준 충족` : `${result.fundamentals.roe}% → 15% 미만 (기준 미달)`) : '데이터 없음'}
                  </span>
                </div>
              </div>
              {/* 부채비율 */}
              {result.fundamentals.debtToEquity != null && (() => {
                const { debtToEquity, industryBenchmark } = result.fundamentals;
                const ok = debtToEquity < industryBenchmark;
                const reason = ok
                  ? `업종 평균(${industryBenchmark}%) 대비 낮음 → 재무 건전, 위기 시 생존력 양호`
                  : `업종 평균(${industryBenchmark}%) 초과 → 부채 부담 있음, 급락장 취약`;
                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                      <span>부채비율</span>
                      <span style={{ color: ok ? '#00875A' : '#E2483D' }}>{debtToEquity}% <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)' }}>/ 업종 평균 {industryBenchmark}%</span></span>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, background: 'var(--border-primary)', overflow: 'hidden', marginBottom: 6 }}>
                      <div style={{ height: '100%', width: `${Math.min(100, (debtToEquity / (industryBenchmark * 1.5)) * 100)}%`, background: ok ? '#30C85E' : '#E2483D', borderRadius: 99 }} />
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                      총부채 ÷ 자기자본. 업종 평균 이하이면 재무 건전 기준 통과.<br />
                      <span style={{ color: ok ? '#00875A' : '#E2483D', fontWeight: 600 }}>→ {reason}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* EPS 히스토리 */}
          {result.epsHistory.length > 0 && (
            <div style={cardStyle}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 4, letterSpacing: '0.05em' }}>EPS (주당순이익) 연도별 추이</div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 12, lineHeight: 1.5 }}>
                기업이 1주당 벌어들인 순이익. 3~5년 연속 우상향이면 성장성 입증.
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 10 }}>
                {[...result.epsHistory].reverse().map((e, i, arr) => {
                  const prev = arr[i - 1];
                  const isUp = prev ? e.eps > prev.eps : true;
                  const growthPct = prev && prev.eps > 0 ? ((e.eps - prev.eps) / Math.abs(prev.eps) * 100) : null;
                  const maxEps = Math.max(...arr.map(x => Math.abs(x.eps)));
                  const barH = maxEps > 0 ? Math.max(8, Math.round((Math.abs(e.eps) / maxEps) * 60)) : 8;
                  const sym = result.currency === 'KRW' ? '' : '$';
                  return (
                    <div key={e.year} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      {growthPct != null && (
                        <div style={{ fontSize: 10, fontWeight: 700, color: isUp ? '#00875A' : '#E2483D' }}>
                          {isUp ? '▲' : '▼'}{Math.abs(growthPct).toFixed(0)}%
                        </div>
                      )}
                      <div style={{ fontSize: 13, fontWeight: 700, color: isUp && i > 0 ? '#00875A' : i > 0 ? '#E2483D' : 'var(--text-secondary)' }}>
                        {e.eps > 0 ? `${sym}${e.eps.toFixed(2)}` : `-${sym}${Math.abs(e.eps).toFixed(2)}`}
                      </div>
                      <div style={{ width: '100%', height: barH, borderRadius: 4, background: e.eps >= 0 ? (isUp && i > 0 ? '#30C85E' : '#6366F1') : '#E2483D' }} />
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{e.year}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                <SignalBadge value={result.checks.epsGrowth3y} good="3년 연속 성장 확인 → 펀더멘털 핵심 기준 통과" warn="3년 연속 성장 미충족 → 이익 방어력 불확실, 진입 신중" />
              </div>
            </div>
          )}

          {/* 자동 체크리스트 */}
          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 8, letterSpacing: '0.05em' }}>자동 체크리스트</div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6, marginBottom: 16, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-secondary)' }}>
              이 목록은 수익을 보장하는 조건이 아니라, <strong style={{ color: 'var(--text-primary)' }}>급락·작전주·기업 부실 같은 최악의 상황을 피하기 위한 안전장치</strong>입니다.<br />
              붉은 ✗가 하나라도 떠 있으면 매수하지 않는 것이 원칙입니다.
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: '#E2483D', letterSpacing: '0.07em', marginBottom: 8 }}>
              <MIcon name="block" size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />필수 조건 — 하나라도 실패하면 매수 금지 (타협 불가)
            </div>
            {[
              { key: 'maAbove',    label: '30주 이평선 위',          passReason: '6개월 추세가 살아있음. 하락장 진입 방지 핵심 필터', failReason: '현재 하락 추세. 이 기준 하나만으로도 매수 금지 조건' },
              { key: 'maTrending', label: '30주 이평선 우상향',      passReason: '추세선 자체가 상승 중. 주가가 일시 조정받아도 방향성 유효', failReason: '추세선 꺾임. 상승 동력 소진 신호, 기존 보유자도 주의' },
              { key: 'debtOk',     label: '부채비율 업종 평균 이하', passReason: '재무 건전. 급락장에서도 생존 가능성 높은 기업 구조', failReason: '부채 과다. 금리 인상·경기 침체 시 취약, 진입 전 부채 내용 확인' },
            ].map(item => {
              const val = result.checks[item.key as keyof typeof result.checks];
              if (val === null) return null;
              return (
                <div key={item.key} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-primary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <MIcon name={val ? 'check_circle' : 'cancel'} size={16} style={{ color: val ? '#30C85E' : '#E2483D', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</span>
                    {!val && <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: '#E2483D', borderRadius: 4, padding: '1px 6px', flexShrink: 0 }}>매수 금지</span>}
                  </div>
                  <div style={{ fontSize: 13, color: val ? '#00875A' : '#E2483D', marginLeft: 24, lineHeight: 1.5 }}>
                    {val ? item.passReason : item.failReason}
                  </div>
                </div>
              );
            })}

            <div style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B', letterSpacing: '0.07em', marginTop: 18, marginBottom: 8 }}>
              <MIcon name="tune" size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />참고 지표 — 타이밍·비중 조절 도구 (상황에 따라 유연하게)
            </div>
            {[
              { key: 'rsiOk',       label: 'RSI 70 미만',           passReason: '과열 없음. 추격 매수 리스크 없이 진입 가능한 구간', failReason: 'RSI 과열. 단기 조정 가능성 높음, 진입 서두르지 말 것' },
              { key: 'nearHigh',    label: '52주 고점 75% 이상',    passReason: '상대강도 강한 종목. 신고가 돌파 시 추가 상승 여력 있음', failReason: '고점에서 크게 하락. 반등인지 추세 전환인지 확인 필요' },
              { key: 'epsGrowth3y', label: 'EPS 3년 연속 성장',     passReason: '이익 창출 능력이 꾸준히 개선됨. 성장 기업 핵심 조건', failReason: '이익 성장세 꺾임. 기업 실적 방어력 불확실' },
              { key: 'roeOk',       label: 'ROE 15% 이상',          passReason: '자본 효율성 우수. 경영진이 주주 자본을 잘 활용하는 기업', failReason: 'ROE 낮음. 자본 대비 수익성 미흡, 동종업체와 비교 필요' },
              { key: 'newsClean',   label: '특징주·급등 뉴스 없음', passReason: '인위적 주가 부양 징후 없음. 정상적인 시장 가격 형성 중', failReason: '급등·특징주 뉴스 감지. 세력의 물량 떠넘기기 가능성 확인 필요' },
            ].map(item => {
              const val = result.checks[item.key as keyof typeof result.checks];
              if (val === null) return null;
              return (
                <div key={item.key} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-primary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <MIcon name={val ? 'check_circle' : 'cancel'} size={16} style={{ color: val ? '#30C85E' : '#E2483D', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</span>
                  </div>
                  <div style={{ fontSize: 13, color: val ? '#00875A' : '#E2483D', marginLeft: 24, lineHeight: 1.5 }}>
                    {val ? item.passReason : item.failReason}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 수동 체크리스트 */}
          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 12, letterSpacing: '0.05em' }}>수동 체크리스트</div>
            {MANUAL_ITEMS.map(item => (
              <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid var(--border-primary)' }}>
                <div
                  onClick={() => setManualChecks(p => ({ ...p, [item.id]: !p[item.id] }))}
                  style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${manualChecks[item.id] ? '#6366F1' : 'var(--border-primary)'}`, background: manualChecks[item.id] ? '#6366F1' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
                  {manualChecks[item.id] && <MIcon name="check" size={13} style={{ color: '#fff' }} />}
                </div>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{item.label}</span>
              </label>
            ))}
          </div>

          {/* 뉴스 */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>최근 뉴스</div>
              {result.news.signal !== 'clean' && (
                <span style={{ fontSize: 13, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: result.news.signal === 'danger' ? 'color-mix(in srgb, #E2483D 15%, transparent)' : 'color-mix(in srgb, #F59E0B 15%, transparent)', color: result.news.signal === 'danger' ? '#E2483D' : '#D97706' }}>
                  <MIcon name="warning" size={12} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                  키워드 {result.news.redFlagCount}건 감지
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {result.news.items.map((n, i) => (
                <a key={i} href={n.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', padding: '6px 10px', borderRadius: 8, fontSize: 14, color: n.flagged ? '#E2483D' : 'var(--text-primary)', textDecoration: 'none', background: n.flagged ? 'color-mix(in srgb, #E2483D 6%, transparent)' : 'var(--bg-secondary)', lineHeight: 1.5, border: n.flagged ? '1px solid color-mix(in srgb, #E2483D 20%, transparent)' : '1px solid transparent' }}>
                  {n.flagged && <MIcon name="flag" size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />}
                  {n.title}
                </a>
              ))}
            </div>
          </div>

          {/* 저장 버튼 */}
          <button
            onClick={saveStock}
            style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: '#191F28', color: '#fff', fontWeight: 700, fontSize: 15, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
            <MIcon name="bookmark_add" size={18} style={{ color: '#fff' }} />
            이 종목 저장
          </button>
        </>
      )}

      {/* 저장된 종목 */}
      {savedStocks.length > 0 && (
        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 12, letterSpacing: '0.05em' }}>저장된 종목</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {savedStocks.map(s => (
              <div key={s.ticker} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 10, background: 'var(--bg-secondary)' }}>
                <div
                  onClick={() => runCheck(s.ticker)}
                  style={{ flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <MIcon name="refresh" size={14} style={{ color: '#6366F1', flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{s.ticker}</span>
                  <span style={{ fontSize: 14, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name.length > 20 ? s.name.slice(0, 20) + '…' : s.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{s.date}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: s.passCount / (s.totalCount || 1) >= 0.7 ? '#00875A' : '#F59E0B' }}>
                    {s.passCount}/{s.totalCount}
                  </span>
                  <button
                    onClick={() => removeSaved(s.ticker)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}>
                    <MIcon name="close" size={14} style={{ color: 'var(--text-tertiary)' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function InvestmentRoutine() {
  const { isMobile } = useAppContext();
  const [activeTab, setActiveTab] = useState<TabId>('daily');

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg-page)' }}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: isMobile ? '20px 14px 40px' : '28px 24px 56px' }}>

        {/* 헤더 */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#30C85E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MIcon name="checklist" size={20} style={{ color: '#fff' }} />
            </div>
            <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, color: 'var(--text-primary)' }}>투자 루틴</h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginLeft: 46 }}>원칙을 습관으로 만드는 투자 체크리스트</p>
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 20, border: activeTab === tab.id ? 'none' : '1px solid var(--border-primary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, background: activeTab === tab.id ? '#191F28' : '#fff', color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)', transition: 'all 0.15s' }}>
              <MIcon name={tab.icon} size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        {activeTab === 'daily' && <DailyTab isMobile={isMobile} />}
        {activeTab === 'weekly' && <WeeklyTab isMobile={isMobile} />}
        {activeTab === 'monthly' && <MonthlyTab isMobile={isMobile} />}
        {activeTab === 'quarterly' && <QuarterlyTab isMobile={isMobile} />}
        {activeTab === 'yearly' && <YearlyTab isMobile={isMobile} />}
        {activeTab === 'stockcheck' && <StockCheckTab isMobile={isMobile} />}

      </div>
    </div>
  );
}

export function StockCheckPage() {
  const { isMobile } = useAppContext();
  return (
    <div style={{ minHeight: '100%', background: 'var(--bg-page)' }}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: isMobile ? '20px 14px 40px' : '28px 24px 56px' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MIcon name="manage_search" size={20} style={{ color: '#fff' }} />
            </div>
            <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, color: 'var(--text-primary)' }}>신규 종목 체크</h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginLeft: 46 }}>나만의 필터를 통과한 종목만 남기는 제거 과정</p>
        </div>
        <StockCheckTab isMobile={isMobile} />
      </div>
    </div>
  );
}
