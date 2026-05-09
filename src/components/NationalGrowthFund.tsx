import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAppContext } from '../App';
import { MIcon } from './MIcon';
import { fetchCurrentPricesWithChange } from '../utils/fetchPrices';
import { calcMA } from '../utils/calcUtils';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://asset-dashboard-api.jilliankim200.workers.dev';

type PriceMap = Record<string, { price: number; changeRate: number }>;

type NgfEtf = {
  ticker: string;
  name: string;
  sector: string;
  label: string;
};

interface ChartPoint {
  date: string;
  price: number;
  ma5: number | null;
  ma20: number | null;
}

const SECTOR_COLORS: Record<string, string> = {
  A: '#4FC3F7',
  B: '#81C784',
  C: '#FFB74D',
  D: '#E57373',
  E: '#BA68C8',
  F: '#4DB6AC',
  G: '#F06292',
  H: '#FF8A65',
};

const DEFAULT_ETFS: NgfEtf[] = [
  { ticker: '455850', name: 'SOL AI반도체소부장',       sector: 'A', label: 'AI·반도체' },
  { ticker: '261070', name: 'TIGER 코스닥150바이오테크', sector: 'B', label: '바이오' },
  { ticker: '475050', name: 'ACE KPOP포커스',           sector: 'C', label: '콘텐츠' },
  { ticker: '421320', name: 'PLUS 우주항공&UAM',        sector: 'D', label: '방산·우주' },
  { ticker: '455860', name: 'SOL 2차전지소부장Fn',      sector: 'E', label: '이차전지' },
  { ticker: '445290', name: 'KODEX 로봇액티브',         sector: 'F', label: '로봇' },
  { ticker: '0163Y0', name: 'KoAct 코스닥액티브',       sector: 'G', label: '코스닥액티브' },
  { ticker: '0162Y0', name: 'TIME 코스닥액티브',         sector: 'H', label: '코스닥액티브' },
];

const LS_KEY = 'ngf_etf_list_v5';
const LS_BUY_CHECKS = 'ngf_buy_checks';

type MaPoint = { ma5: number | null; ma20: number | null };
type MaData = Record<string, MaPoint>;
type BuyChecks = Record<string, { c1: boolean; c2: boolean; c3: boolean }>;

function loadBuyChecks(): BuyChecks {
  try {
    const raw = localStorage.getItem(LS_BUY_CHECKS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveBuyChecks(checks: BuyChecks) {
  localStorage.setItem(LS_BUY_CHECKS, JSON.stringify(checks));
}

function getBuyStage(price: number | null, ma5: number | null, ma20: number | null): '1차' | '2차' | '3차' | null {
  if (price === null || ma5 === null || ma20 === null) return null;
  if (price <= ma20) return '3차';
  if (price <= ma5) return '2차';
  return '1차';
}

const STAGE_CONFIG = {
  '1차': { emoji: '🟡', label: '1차 매수 가능', bg: '#f59e0b22', color: '#f59e0b' },
  '2차': { emoji: '🟠', label: '2차 매수 신호', bg: '#f9731622', color: '#f97316' },
  '3차': { emoji: '🔴', label: '3차 매수 신호', bg: '#ef444422', color: '#ef4444' },
} as const;

function nextRefreshMs(): number {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const h = kstNow.getUTCHours();
  const m = kstNow.getUTCMinutes();
  const s = kstNow.getUTCSeconds();
  const nowMins = h * 60 + m + s / 60;
  for (const target of [600, 840]) {
    if (nowMins < target) return (target - nowMins) * 60 * 1000;
  }
  return (1440 - nowMins + 600) * 60 * 1000;
}

async function fetchAllMaData(tickers: string[]): Promise<MaData> {
  const settled = await Promise.allSettled(
    tickers.map(ticker =>
      fetch(`${WORKER_URL}/stock-chart/${ticker}?days=30`)
        .then(r => r.json())
        .then((data: { date: string; price: number }[]) => {
          if (!Array.isArray(data) || data.length < 5) return { ticker, ma5: null as null, ma20: null as null };
          const px = data.map(d => d.price);
          const ma5arr = calcMA(px, 5);
          const ma20arr = calcMA(px, 20);
          const last = data.length - 1;
          return { ticker, ma5: ma5arr[last], ma20: ma20arr[last] };
        })
        .catch(() => ({ ticker, ma5: null as null, ma20: null as null }))
    )
  );
  const out: MaData = {};
  for (const r of settled) {
    if (r.status === 'fulfilled') {
      const { ticker, ma5, ma20 } = r.value;
      out[ticker] = { ma5, ma20 };
    }
  }
  return out;
}

const NEWS_LINKS = [
  { label: '국민성장펀드 최신 뉴스',   query: '국민성장펀드' },
  { label: '국민참여형 펀드 가입',      query: '국민참여형 국민성장펀드' },
  { label: '반도체 소부장 동향',        query: '반도체 소부장 ETF' },
  { label: '바이오 기술특례 뉴스',      query: '바이오 기술특례 코스닥' },
  { label: '우주·방산 소형주',          query: '우주항공 UAM 주식' },
  { label: '로봇 부품 산업',            query: '로봇 부품 중소형주' },
];

const PERIOD_OPTIONS = [
  { label: '1개월', days: 30 },
  { label: '3개월', days: 90 },
  { label: '6개월', days: 180 },
];

function naverNewsUrl(query: string) {
  return `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(query)}`;
}

function loadEtfs(): NgfEtf[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const saved: NgfEtf[] = JSON.parse(raw);
      const defaultTickers = new Set(DEFAULT_ETFS.map(e => e.ticker));
      const additions = saved.filter(e => !defaultTickers.has(e.ticker));
      return [...DEFAULT_ETFS, ...additions];
    }
  } catch {}
  return DEFAULT_ETFS;
}

function saveEtfs(list: NgfEtf[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
      borderRadius: 10, padding: '10px 14px', fontSize: 'var(--text-xs)', minWidth: 150,
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    }}>
      <div style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) =>
        p.value != null && (
          <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: p.color, marginBottom: 2 }}>
            <span>{p.name}</span>
            <span style={{ fontWeight: 600 }}>{p.value.toLocaleString('ko-KR')}원</span>
          </div>
        )
      )}
    </div>
  );
}

type PortfolioType = 'aggressive' | 'balanced' | 'safe';

const PORTFOLIO_SECTORS: Record<PortfolioType, string[]> = {
  aggressive: ['A', 'D', 'B'],
  balanced:   ['A', 'D', 'B', 'F'],
  safe:       ['A', 'G', 'H'],
};

const PORTFOLIO_LABELS: Record<PortfolioType, string> = {
  aggressive: '공격형',
  balanced:   '균형형',
  safe:       '안전형',
};

export function NationalGrowthFund() {
  const { isMobile } = useAppContext();
  const [etfs, setEtfs] = useState<NgfEtf[]>(loadEtfs);
  const [prices, setPrices] = useState<PriceMap>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [portfolioFilter, setPortfolioFilter] = useState<PortfolioType | null>(null);

  const [selectedTicker, setSelectedTicker] = useState(() => loadEtfs()[0]?.ticker ?? '');
  const [days, setDays] = useState(90);
  const [rawData, setRawData] = useState<{ date: string; price: number }[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [maData, setMaData] = useState<MaData>({});
  const [buyChecks, setBuyChecks] = useState<BuyChecks>(loadBuyChecks);
  const [savedFlash, setSavedFlash] = useState(false);
  const saveFlashTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const tickers = etfs.map(e => e.ticker);
    if (tickers.length === 0) return;
    fetchCurrentPricesWithChange(tickers).then(setPrices);
  }, [etfs.map(e => e.ticker).join(',')]);

  useEffect(() => {
    if (!selectedTicker) return;
    setChartLoading(true);
    fetch(`${WORKER_URL}/stock-chart/${selectedTicker}?days=${days}`)
      .then(r => r.json())
      .then((data: { date: string; price: number }[]) => {
        if (Array.isArray(data) && data.length > 0) setRawData(data);
        else setRawData([]);
      })
      .catch(() => setRawData([]))
      .finally(() => setChartLoading(false));
  }, [selectedTicker, days]);

  useEffect(() => {
    const tickers = etfs.map(e => e.ticker);
    if (tickers.length === 0) return;
    let timerId: ReturnType<typeof setTimeout>;
    function doFetch() { fetchAllMaData(tickers).then(setMaData); }
    function scheduleNext() {
      timerId = setTimeout(() => { doFetch(); scheduleNext(); }, nextRefreshMs());
    }
    doFetch();
    scheduleNext();
    return () => clearTimeout(timerId);
  }, [etfs.map(e => e.ticker).join(',')]);

  const chartData: ChartPoint[] = useMemo(() => {
    if (rawData.length === 0) return [];
    const px = rawData.map(d => d.price);
    const ma5  = calcMA(px, 5);
    const ma20 = calcMA(px, 20);
    return rawData.map((d, i) => ({
      date: d.date.slice(5),
      price: d.price,
      ma5: ma5[i],
      ma20: ma20[i],
    }));
  }, [rawData]);

  const selectedEtf = etfs.find(e => e.ticker === selectedTicker);
  const selectedPrice = prices[selectedTicker];
  const allPrices = chartData.flatMap(d => [d.price, d.ma5, d.ma20].filter(Boolean) as number[]);
  const yMin = allPrices.length > 0 ? Math.floor(Math.min(...allPrices) * 0.98) : 0;
  const yMax = allPrices.length > 0 ? Math.ceil(Math.max(...allPrices) * 1.02) : 100;
  const xInterval = chartData.length > 60 ? Math.floor(chartData.length / 8) : Math.floor(chartData.length / 6);
  const sectorColor = SECTOR_COLORS[selectedEtf?.sector ?? ''] ?? 'var(--accent-blue)';

  function handleCheckToggle(ticker: string, key: 'c1' | 'c2' | 'c3') {
    setBuyChecks(prev => {
      const curr = prev[ticker] ?? { c1: false, c2: false, c3: false };
      const next = { ...prev, [ticker]: { ...curr, [key]: !curr[key] } };
      saveBuyChecks(next);
      return next;
    });
    setSavedFlash(true);
    if (saveFlashTimer.current) clearTimeout(saveFlashTimer.current);
    saveFlashTimer.current = setTimeout(() => setSavedFlash(false), 1500);
  }

  const alarm3 = etfs.filter(e => {
    const pd = prices[e.ticker];
    const md = maData[e.ticker];
    return getBuyStage(pd?.price ?? null, md?.ma5 ?? null, md?.ma20 ?? null) === '3차';
  });
  const alarm2 = etfs.filter(e => {
    const pd = prices[e.ticker];
    const md = maData[e.ticker];
    return getBuyStage(pd?.price ?? null, md?.ma5 ?? null, md?.ma20 ?? null) === '2차';
  });

  const [showAiRec, setShowAiRec] = useState(false);
  const p = isMobile ? '16px 12px' : '24px';

  return (
    <div style={{ padding: p, maxWidth: 960, margin: '0 auto' }}>

      {showAiRec && <AiRecommendModal onClose={() => setShowAiRec(false)} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
              국민성장펀드 ETF 트래커
            </span>
            {savedFlash && (
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-profit)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <MIcon name="check_circle" size={14} />
                체크 저장됨
              </span>
            )}
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
            KDB 산업은행 5년 150조원 정책펀드 수혜 중소형 ETF
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '8px 14px', borderRadius: 'var(--radius-md)',
            background: 'var(--accent-blue)', color: 'var(--accent-blue-fg)',
            border: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 600,
            flexShrink: 0,
          }}
        >
          <MIcon name="add" size={18} />
          ETF 추가
        </button>
      </div>

      {/* 차트 */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {selectedEtf && (
                <span style={{
                  background: sectorColor + '22', color: sectorColor,
                  padding: '2px 10px', borderRadius: 12,
                  fontSize: 'var(--text-xs)', fontWeight: 700,
                }}>
                  {selectedEtf.sector} · {selectedEtf.label}
                </span>
              )}
              <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>
                {selectedEtf?.name ?? selectedTicker}
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{selectedTicker}</span>
            </div>
            {selectedPrice && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {selectedPrice.price.toLocaleString('ko-KR')}원
                </span>
                <span style={{
                  fontSize: 'var(--text-sm)', fontWeight: 600,
                  color: selectedPrice.changeRate > 0 ? 'var(--color-profit)' : selectedPrice.changeRate < 0 ? 'var(--color-loss)' : 'var(--text-tertiary)',
                }}>
                  {selectedPrice.changeRate > 0 ? '▲ +' : selectedPrice.changeRate < 0 ? '▼ ' : ''}
                  {selectedPrice.changeRate.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.days}
                onClick={() => setDays(opt.days)}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border-primary)',
                  background: days === opt.days ? 'var(--accent-blue)' : 'var(--bg-primary)',
                  color: days === opt.days ? 'var(--accent-blue-fg)' : 'var(--text-secondary)',
                  fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ height: 260, position: 'relative' }}>
          {chartLoading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
              차트 불러오는 중...
            </div>
          )}
          {!chartLoading && chartData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" opacity={0.5} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} interval={xInterval} tickLine={false} axisLine={{ stroke: 'var(--border-secondary)' }} />
                <YAxis domain={[yMin, yMax]} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={v => v.toLocaleString('ko-KR')} tickLine={false} axisLine={false} width={70} />
                <Tooltip content={<ChartTooltip />} />
                <Line dataKey="price" name="현재가" type="monotone" stroke={sectorColor} strokeWidth={2} dot={false} connectNulls />
                <Line dataKey="ma5" name="MA5" type="monotone" stroke="var(--chart-ma5)" strokeWidth={1.5} dot={false} connectNulls strokeDasharray="4 2" />
                <Line dataKey="ma20" name="MA20" type="monotone" stroke="var(--chart-ma20)" strokeWidth={1.5} dot={false} connectNulls strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          )}
          {!chartLoading && chartData.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
              차트 데이터 없음
            </div>
          )}
        </div>

        {chartData.length > 0 && (
          <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
            {[{ color: sectorColor, label: '현재가' }, { color: 'var(--chart-ma5)', label: 'MA5' }, { color: 'var(--chart-ma20)', label: 'MA20' }].map(m => (
              <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 18, height: 2, borderRadius: 1, background: m.color }} />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{m.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 매수 알람 요약 배너 */}
      {(alarm3.length > 0 || alarm2.length > 0) && (
        <div style={{
          marginBottom: 16,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 2 }}>
            <MIcon name="notifications_active" size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            매수 신호 알람
          </div>
          {alarm3.map(e => (
            <div key={e.ticker} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span>🔴</span>
              <span style={{ fontWeight: 700, color: '#ef4444' }}>3차 신호</span>
              <span style={{ color: 'var(--text-secondary)' }}>{e.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>현재가 ≤ MA20</span>
            </div>
          ))}
          {alarm2.map(e => (
            <div key={e.ticker} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span>🟠</span>
              <span style={{ fontWeight: 700, color: '#f97316' }}>2차 신호</span>
              <span style={{ color: 'var(--text-secondary)' }}>{e.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>현재가 ≤ MA5</span>
            </div>
          ))}
        </div>
      )}

      {/* 분할 매수 가이드 */}
      <div style={{
        marginBottom: 20,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 20px',
      }}>
        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <MIcon name="menu_book" size={14} />
          분할 매수 신호 기준 (이동평균 기반)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 10 }}>
          {([
            {
              stage: '1차',
              emoji: '🟡',
              color: '#f59e0b',
              bg: '#f59e0b18',
              border: '#f59e0b44',
              condition: '현재가 > MA5',
              desc: '이동평균선 위 — 진입 준비 단계',
              ratio: '계획금액의 20% 매수',
            },
            {
              stage: '2차',
              emoji: '🟠',
              color: '#f97316',
              bg: '#f9731618',
              border: '#f9731644',
              condition: 'MA20 < 현재가 ≤ MA5',
              desc: 'MA5 아래 진입 — 추가 매수 단계',
              ratio: '계획금액의 30% 매수',
            },
            {
              stage: '3차',
              emoji: '🔴',
              color: '#ef4444',
              bg: '#ef444418',
              border: '#ef444444',
              condition: '현재가 ≤ MA20',
              desc: 'MA20 아래 — 적극 매수 단계',
              ratio: '계획금액의 50% 매수',
            },
          ] as const).map(item => (
            <div key={item.stage} style={{
              background: item.bg,
              border: `1px solid ${item.border}`,
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 14 }}>{item.emoji}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.stage} 매수 신호</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3, fontFamily: 'monospace' }}>
                {item.condition}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 5, lineHeight: 1.4 }}>
                {item.desc}
              </div>
              <div style={{
                fontSize: 10, fontWeight: 700, color: item.color,
                background: item.bg, border: `1px solid ${item.border}`,
                borderRadius: 4, padding: '3px 7px', display: 'inline-block',
              }}>
                {item.ratio}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          MA5 = 5일 이동평균 · MA20 = 20일 이동평균. 각 ETF 카드의 체크박스로 매수 완료 여부를 기록하세요.
        </div>
      </div>

      {/* ETF 카드 */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-secondary)' }}>
            분야별 ETF — 카드 클릭 시 차트 표시
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              onClick={() => setShowAiRec(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 14px', borderRadius: 20, cursor: 'pointer',
                fontSize: 13, fontWeight: 700,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff', border: '2px solid transparent',
              }}
            >
              <MIcon name="auto_awesome" size={14} />
              AI 추천
            </button>
            <div style={{ width: 1, height: 20, background: 'var(--border-primary)' }} />
            {PORTFOLIOS.map(pf => {
              const isActive = portfolioFilter === pf.key;
              return (
                <button
                  key={pf.key}
                  onClick={() => setPortfolioFilter(isActive ? null : pf.key as PortfolioType)}
                  style={{
                    padding: '5px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                    border: `2px solid ${pf.color}`,
                    background: isActive ? pf.color : 'transparent',
                    color: isActive ? '#fff' : pf.color,
                    transition: 'all 0.18s',
                  }}
                >
                  {pf.type}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 14,
        }}>
          {etfs.map(etf => {
            const pd = prices[etf.ticker];
            const inFilter = portfolioFilter ? PORTFOLIO_SECTORS[portfolioFilter].includes(etf.sector) : null;
            return (
              <EtfCard
                key={etf.ticker}
                etf={etf}
                price={pd?.price ?? null}
                changeRate={pd?.changeRate ?? null}
                isSelected={etf.ticker === selectedTicker}
                onSelect={setSelectedTicker}
                highlighted={inFilter}
                ma5={maData[etf.ticker]?.ma5 ?? null}
                ma20={maData[etf.ticker]?.ma20 ?? null}
                buyCheck={buyChecks[etf.ticker] ?? { c1: false, c2: false, c3: false }}
                onCheckToggle={handleCheckToggle}
              />
            );
          })}
        </div>
      </div>

      {/* 뉴스 */}
      <div style={{ marginTop: 32 }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>관련 뉴스</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {NEWS_LINKS.map(link => (
            <a key={link.query} href={naverNewsUrl(link.query)} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--text-sm)', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
            >
              <MIcon name="open_in_new" size={16} style={{ color: 'var(--text-tertiary)' }} />
              {link.label}
            </a>
          ))}
        </div>
      </div>

      {showAddModal && (
        <AddEtfModal
          onAdd={(etf) => { const next = [...etfs, etf]; setEtfs(next); saveEtfs(next); setShowAddModal(false); }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

// ─── ETF 구성종목 데이터 (실제 확인된 것만) ───────────────────────────────
type EtfInfo = {
  fee: string;
  index: string;
  top5: { name: string; ratio: string }[];
};

const ETF_INFO: Record<string, EtfInfo> = {
  '261070': {
    fee: '연 0.40%',
    index: '코스닥150 바이오테크',
    top5: [
      { name: '알테오젠',    ratio: '13.43%' },
      { name: 'HLB',        ratio: '10.35%' },
      { name: '펨트론',     ratio: '8.36%' },
      { name: '삼천당제약', ratio: '8.23%' },
      { name: '에이비엘바이오', ratio: '7.99%' },
    ],
  },
  '421320': {
    fee: '연 0.45%',
    index: 'iSelect 우주항공&UAM',
    top5: [
      { name: '한국항공우주',           ratio: '10.64%' },
      { name: '인텔리안테크',           ratio: '10.17%' },
      { name: '한화에어로스페이스',     ratio: '10.16%' },
      { name: '스피어',                 ratio: '10.04%' },
      { name: 'LIG디펜스앤에어로스페이스', ratio: '9.98%' },
    ],
  },
  '445290': {
    fee: '연 0.81%',
    index: '액티브(자유구성)',
    top5: [
      { name: '삼성전자',      ratio: '11.23%' },
      { name: '로보티즈',      ratio: '8.53%' },
      { name: '레인보우로보틱스', ratio: '6.25%' },
      { name: '현대오토에버',  ratio: '5.99%' },
      { name: '두산로보틱스',  ratio: '5.92%' },
    ],
  },
  '455850': {
    fee: '연 0.45%',
    index: 'KRX AI반도체소부장',
    top5: [
      { name: '한미반도체',    ratio: '23.29%' },
      { name: '이수페타시스',  ratio: '10.91%' },
      { name: '리노공업',      ratio: '8.79%' },
      { name: '주성엔지니어링', ratio: '6.24%' },
      { name: '이오테크닉스',  ratio: '5.85%' },
    ],
  },
  '475050': {
    fee: '연 0.45%',
    index: 'iSelect KPOP포커스',
    top5: [
      { name: '에스엠',           ratio: '27.92%' },
      { name: 'JYP Ent.',        ratio: '26.88%' },
      { name: '하이브',           ratio: '20.73%' },
      { name: '와이지엔터테인먼트', ratio: '19.37%' },
      { name: '노머스',           ratio: '0.92%' },
    ],
  },
  '455860': {
    fee: '연 0.45%',
    index: 'FnGuide 2차전지소부장',
    top5: [
      { name: 'POSCO홀딩스',  ratio: '23.47%' },
      { name: 'LG화학',       ratio: '16.83%' },
      { name: '에코프로',     ratio: '16.15%' },
      { name: '에코프로비엠', ratio: '12.26%' },
      { name: '포스코퓨처엠', ratio: '9.43%' },
    ],
  },
  '0163Y0': {
    fee: '미확인',
    index: '액티브(코스닥)',
    top5: [
      { name: '성호전자',     ratio: '6.25%' },
      { name: '리노공업',     ratio: '5.49%' },
      { name: '에코프로비엠', ratio: '3.52%' },
      { name: '에코프로',     ratio: '3.44%' },
      { name: '파두',         ratio: '3.22%' },
    ],
  },
  '0162Y0': {
    fee: '미확인',
    index: '액티브(코스닥)',
    top5: [
      { name: '파두',         ratio: '6.63%' },
      { name: 'LS머트리얼즈', ratio: '5.29%' },
      { name: '비나텍',       ratio: '4.06%' },
      { name: '세미파이브',   ratio: '3.83%' },
      { name: '대주전자재료', ratio: '3.29%' },
    ],
  },
};

function fmtWon(n: number) { return Math.round(n).toLocaleString('ko-KR') + '원'; }

// ─── EtfCard ──────────────────────────────────────────────────────────────
type EtfCardProps = {
  etf: NgfEtf;
  price: number | null;
  changeRate: number | null;
  isSelected: boolean;
  onSelect: (ticker: string) => void;
  highlighted: boolean | null;
  ma5: number | null;
  ma20: number | null;
  buyCheck: { c1: boolean; c2: boolean; c3: boolean };
  onCheckToggle: (ticker: string, key: 'c1' | 'c2' | 'c3') => void;
};

const CARD_HEIGHT = 268;

function EtfCard({ etf, price, changeRate, isSelected, onSelect, highlighted, ma5, ma20, buyCheck, onCheckToggle }: EtfCardProps) {
  const [showInfo, setShowInfo] = useState(false);
  const isUp = changeRate !== null && changeRate > 0;
  const isDown = changeRate !== null && changeRate < 0;
  const sectorColor = SECTOR_COLORS[etf.sector] ?? '#888';
  const info = ETF_INFO[etf.ticker];
  const stage = getBuyStage(price, ma5, ma20);
  const dimmed = highlighted === false;
  const stageRanges = {
    c1: ma5 !== null ? `${fmtWon(ma5)} ~` : '',
    c2: ma5 !== null && ma20 !== null ? `${fmtWon(ma20)} ~ ${fmtWon(ma5)}` : '',
    c3: ma20 !== null ? `~ ${fmtWon(ma20)}` : '',
  };

  return (
    <div
      style={{
        height: CARD_HEIGHT, cursor: 'pointer', position: 'relative',
        background: isSelected ? 'var(--bg-secondary)' : 'var(--bg-primary)',
        border: `1px solid ${highlighted === true ? sectorColor + 'cc' : isSelected ? sectorColor + '88' : 'var(--border-primary)'}`,
        boxShadow: highlighted === true ? `0 0 0 3px ${sectorColor}44, 0 4px 16px ${sectorColor}22` : isSelected ? `0 0 0 2px ${sectorColor}33` : 'none',
        borderRadius: 'var(--radius-lg)', padding: '16px', overflow: 'hidden',
        opacity: dimmed ? 0.35 : 1, transition: 'box-shadow 0.3s, border-color 0.3s',
        boxSizing: 'border-box',
      }}
      onClick={() => onSelect(etf.ticker)}
    >
      {showInfo ? (
        /* 구성종목 뷰 */
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10, paddingRight: 22, flexWrap: 'nowrap', minWidth: 0 }}>
            <span style={{ background: sectorColor + '22', color: sectorColor, padding: '2px 8px', borderRadius: 10, fontSize: 'var(--text-xs)', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {etf.sector} · {etf.label}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {info && <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, whiteSpace: 'nowrap' }}>총보수 {info.fee}</span>}
              <button
                onClick={e => { e.stopPropagation(); setShowInfo(false); }}
                style={{ display: 'flex', alignItems: 'center', padding: 3, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', flexShrink: 0 }}
              >
                <MIcon name="arrow_back" size={15} />
              </button>
            </div>
          </div>

          {info ? (
            <>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 7, fontWeight: 600 }}>
                {info.index} · TOP 5
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {info.top5.map((h, i) => (
                  <div key={h.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', width: 12 }}>{i + 1}</span>
                    <div style={{ flex: 1, position: 'relative', height: 14, background: 'var(--border-primary)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: h.ratio, background: sectorColor + '55', borderRadius: 3 }} />
                      <span style={{ position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', fontSize: 10, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {h.name}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: sectorColor, width: 36, textAlign: 'right' }}>{h.ratio}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 6 }}>
              <MIcon name="info_outline" size={20} style={{ color: 'var(--text-tertiary)' }} />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                구성종목 미확인<br/>데이터 업데이트 예정
              </span>
            </div>
          )}
        </div>
      ) : (
        /* 기본 뷰 */
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, paddingRight: 22, flexWrap: 'nowrap' }}>
            <span style={{ background: sectorColor + '22', color: sectorColor, padding: '2px 10px', borderRadius: 12, fontSize: 'var(--text-xs)', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {etf.sector} · {etf.label}
            </span>
            <button
              onClick={e => { e.stopPropagation(); setShowInfo(true); }}
              style={{
                padding: '2px 7px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)',
                color: 'var(--text-tertiary)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              구성종목
            </button>
          </div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{etf.name}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 8 }}>{etf.ticker}</div>

          <div style={{ paddingTop: 8, borderTop: `1px solid ${sectorColor}33`, marginBottom: 8 }}>
            {stage ? (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 8px', borderRadius: 8, marginBottom: 7,
                background: STAGE_CONFIG[stage].bg, border: `1px solid ${STAGE_CONFIG[stage].color}44`,
              }}>
                <span style={{ fontSize: 12 }}>{STAGE_CONFIG[stage].emoji}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: STAGE_CONFIG[stage].color }}>
                  {STAGE_CONFIG[stage].label}
                </span>
              </div>
            ) : (
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 7 }}>MA 로딩 중...</div>
            )}
            <div style={{ display: 'flex', gap: 4 }}>
              {([
                { key: 'c1' as const, label: '1차 20%' },
                { key: 'c2' as const, label: '2차 30%' },
                { key: 'c3' as const, label: '3차 50%' },
              ]).map(({ key, label }) => {
                const done = buyCheck[key];
                const range = stageRanges[key];
                return (
                  <button
                    key={key}
                    onClick={e => { e.stopPropagation(); onCheckToggle(etf.ticker, key); }}
                    style={{
                      flex: 1, padding: '5px 3px',
                      background: done ? sectorColor + '33' : 'var(--bg-secondary)',
                      border: `1px solid ${done ? sectorColor + '88' : 'var(--border-primary)'}`,
                      borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    }}
                  >
                    {done
                      ? <MIcon name="check_circle" size={12} style={{ color: sectorColor }} />
                      : <MIcon name="radio_button_unchecked" size={12} style={{ color: 'var(--text-tertiary)' }} />
                    }
                    <span style={{ fontSize: 9, fontWeight: 700, color: done ? sectorColor : 'var(--text-tertiary)' }}>{label}</span>
                    {range && (
                      <span style={{ fontSize: 10, color: done ? sectorColor + 'cc' : 'var(--text-secondary)', lineHeight: 1.3, textAlign: 'center' }}>
                        {range}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
              {price !== null ? price.toLocaleString('ko-KR') + '원' : '—'}
            </span>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: isUp ? 'var(--color-profit)' : isDown ? 'var(--color-loss)' : 'var(--text-tertiary)' }}>
              {changeRate !== null ? (isUp ? '▲ +' : isDown ? '▼ ' : '') + changeRate.toFixed(2) + '%' : '—'}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── AiRecommendModal ─────────────────────────────────────────────────────
const SECTOR_RANKS = [
  { stars: '★★★', etf: 'A · AI반도체',  reason: '정책펀드 1순위 타겟. 소부장 직접 수혜.' },
  { stars: '★★★', etf: 'D · 방산·우주', reason: '수출 확대 + 국내 정책 수혜. 현재 가장 강한 섹터.' },
  { stars: '★★',  etf: 'B · 바이오',    reason: '코스닥 성장 대표주자. 글로벌 기술 수출 모멘텀.' },
  { stars: '★★',  etf: 'F · 로봇',      reason: '삼성·현대 투자 확대 수혜. 중장기 테마.' },
  { stars: '★',   etf: 'E · 이차전지',  reason: '단기 반등 가능하나 중국 경쟁 변수 상존.' },
  { stars: '△',   etf: 'C · KPOP',      reason: '정책펀드와 연관성 낮음. 독립 테마 투자 시 고려.' },
  { stars: '△',   etf: 'G·H 코스닥액티브', reason: '둘 중 하나만으로 충분. 광범위한 코스닥 커버.' },
];

const PORTFOLIOS = [
  { key: 'aggressive', type: '공격형', color: '#ef4444', etfs: 'A + D + B', desc: 'AI·방산·바이오 3각' },
  { key: 'balanced',   type: '균형형', color: '#f59e0b', etfs: 'A + D + B + F', desc: '로봇 추가, 4섹터 분산' },
  { key: 'safe',       type: '안전형', color: '#10b981', etfs: 'A + 코스닥액티브 1개', desc: '테마 1개 + 광범위 커버' },
];

function AiRecommendModal({ onClose }: { onClose: () => void }) {
  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '32px', width: 640, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: 12, padding: '8px 10px', display: 'flex' }}>
              <MIcon name="auto_awesome" size={24} style={{ color: '#fff' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 22, color: 'var(--text-primary)' }}>AI 포트폴리오 추천</div>
              <div style={{ fontSize: 15, color: 'var(--text-tertiary)', marginTop: 3 }}>8개 중 핵심만 선택하는 법</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}>
            <MIcon name="close" size={24} />
          </button>
        </div>

        {/* 섹터 평가 */}
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 12 }}>섹터별 추천 강도</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 24 }}>
          {SECTOR_RANKS.map(r => (
            <div key={r.etf} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '11px 16px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
              <span style={{ fontSize: 16, minWidth: 38, color: r.stars.startsWith('★★★') ? '#f59e0b' : r.stars.startsWith('★★') ? '#94a3b8' : 'var(--text-tertiary)', flexShrink: 0 }}>{r.stars}</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{r.etf}</span>
                <span style={{ fontSize: 15, color: 'var(--text-tertiary)' }}>{r.reason}</span>
              </div>
            </div>
          ))}
        </div>

        {/* disclaimer */}
        <div style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
          <div style={{ fontSize: 14, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
            ⚠️ 이 내용은 AI 분석 의견이며 투자 권유가 아닙니다. 최종 판단은 본인 책임입니다.
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── AddEtfModal ──────────────────────────────────────────────────────────
const SECTOR_OPTIONS = [
  { value: 'A', label: 'A · AI·반도체' },
  { value: 'B', label: 'B · 바이오' },
  { value: 'C', label: 'C · 콘텐츠' },
  { value: 'D', label: 'D · 방산·우주' },
  { value: 'E', label: 'E · 이차전지' },
  { value: 'F', label: 'F · 로봇' },
  { value: 'G', label: 'G · 코스닥액티브' },
  { value: 'H', label: 'H · 코스닥액티브' },
];

const SECTOR_LABELS: Record<string, string> = {
  A: 'AI·반도체', B: '바이오', C: '콘텐츠',
  D: '방산·우주', E: '이차전지', F: '로봇', G: '코스닥액티브', H: '코스닥액티브',
};

function AddEtfModal({ onAdd, onClose }: { onAdd: (etf: NgfEtf) => void; onClose: () => void }) {
  const [ticker, setTicker] = useState('');
  const [name, setName] = useState('');
  const [sector, setSector] = useState('A');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ticker.trim() || !name.trim()) return;
    onAdd({ ticker: ticker.trim(), name: name.trim(), sector, label: SECTOR_LABELS[sector] });
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px',
    border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)',
    background: 'var(--bg-secondary)', color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)', boxSizing: 'border-box', outline: 'none',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '24px', width: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 'var(--text-base)' }}>ETF 추가</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><MIcon name="close" size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', display: 'block', marginBottom: 4, fontWeight: 600 }}>티커 (6자리)</label>
            <input style={inputStyle} value={ticker} onChange={e => setTicker(e.target.value)} placeholder="예: 455850" maxLength={6} required />
          </div>
          <div>
            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', display: 'block', marginBottom: 4, fontWeight: 600 }}>ETF 이름</label>
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="예: SOL AI반도체소부장" required />
          </div>
          <div>
            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', display: 'block', marginBottom: 4, fontWeight: 600 }}>분야</label>
            <select style={inputStyle} value={sector} onChange={e => setSector(e.target.value)}>
              {SECTOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <button type="submit" style={{ padding: '10px', background: 'var(--accent-blue)', color: 'var(--accent-blue-fg)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: 'var(--text-sm)' }}>
            추가
          </button>
        </form>
      </div>
    </div>
  );
}
