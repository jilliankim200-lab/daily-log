import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAppContext } from "../App";
import { MIcon } from './MIcon';
import { kvGet, kvSet } from '../api';
import { fetchCurrentPricesWithChange } from '../utils/fetchPrices';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://asset-dashboard-api.jilliankim200.workers.dev';

// ─── 타입 ───
// KV에 저장되는 단위: 티커별 배당률 정보만 (수량/소유자는 계좌에서)
interface DividendRate {
  ticker: string;
  name: string;
  dividendPerShare: number;
  frequency: "monthly" | "quarterly" | "yearly" | "weekly";
  exDividendDay: number;
  paymentDay: number;
}

// 런타임 계산: accounts + rates 조합
interface EffectiveDividendStock {
  key: string;
  ticker: string;
  name: string;
  quantity: number;
  owner: "wife" | "husband";
  accLabel: string;
  dividendPerShare: number;
  frequency: "monthly" | "quarterly" | "yearly" | "weekly";
  exDividendDay: number;
  paymentDay: number;
  isUSD: boolean;
}

interface RankingETF {
  rank: number;
  name: string;
  ticker: string;
  price: number;
  recentDividend: number;
  annualYield: number;
  category: string;
  recentDivDate?: string;
  issuer?: string;
  netAsset?: number;
  priceChange?: number;
  priceChangeRate?: number;
}

// ─── 유틸 ───
function categorizeETF(name: string): string {
  if (name.includes('커버드콜') && (name.includes('S&P') || name.includes('500'))) return "S&P500 커버드콜";
  if (name.includes('커버드콜') && (name.includes('나스닥') || name.includes('테크'))) return "나스닥 커버드콜";
  if (name.includes('커버드콜') && name.includes('국채')) return "채권 프리미엄";
  if (name.includes('커버드콜') && (name.includes('배당') || name.includes('고배당'))) return "배당 커버드콜";
  if (name.includes('커버드콜')) return "커버드콜";
  if (name.includes('배당') && name.includes('다우존스')) return "배당 다우존스";
  if (name.includes('리츠') || name.includes('부동산') || name.includes('인프라')) return "리츠";
  if (name.includes('국채') || name.includes('채권') || name.includes('금리')) return "채권";
  if (name.includes('고배당') || name.includes('배당')) return "국내 고배당";
  return "기타";
}

function isUSDTicker(ticker: string): boolean {
  return /^[A-Z]{2,5}$/.test(ticker.replace(/_H$/, '').toUpperCase());
}

function divAmount(stock: EffectiveDividendStock, exchangeRate: number): number {
  const base = stock.dividendPerShare * stock.quantity;
  return stock.isUSD ? base * 0.85 * exchangeRate : base;
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("ko-KR");
}

function getNextExDividendDate(exDay: number, frequency?: string): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (frequency === "weekly") {
    // YieldMax weekly ex-div: every Thursday (day 4)
    const target = new Date(now);
    const dow = target.getDay();
    const daysToThursday = (4 - dow + 7) % 7 || 7; // 0 means today is Thu → next Thu
    target.setDate(target.getDate() + daysToThursday);
    return target;
  }
  const year = now.getFullYear();
  const month = now.getMonth();
  if (exDay === 0) {
    let last = new Date(year, month + 1, 0);
    while (last.getDay() === 0 || last.getDay() === 6) last.setDate(last.getDate() - 1);
    if (now > last) {
      last = new Date(year, month + 2, 0);
      while (last.getDay() === 0 || last.getDay() === 6) last.setDate(last.getDate() - 1);
    }
    return last;
  }
  let target = new Date(year, month, exDay);
  if (now > target) target = new Date(year, month + 1, exDay);
  return target;
}

function formatDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function daysUntil(d: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// localStorage dividend_stocks → DividendRate[] 마이그레이션
function migrateFromLocalStorage(): DividendRate[] {
  try {
    const raw = localStorage.getItem('dividend_stocks');
    if (!raw) return [];
    const stocks: any[] = JSON.parse(raw);
    const rateMap = new Map<string, DividendRate>();
    for (const s of stocks) {
      const baseTicker = s.ticker.replace(/_H$/, '');
      if (!rateMap.has(baseTicker) && s.dividendPerShare > 0) {
        rateMap.set(baseTicker, {
          ticker: baseTicker,
          name: s.name,
          dividendPerShare: s.dividendPerShare,
          frequency: s.frequency || 'monthly',
          exDividendDay: s.exDividendDay || 0,
          paymentDay: s.paymentDay || 5,
        });
      }
    }
    return [...rateMap.values()];
  } catch { return []; }
}

const CATEGORY_COLORS: Record<string, string> = {
  "S&P500 커버드콜": "#3182f6", "나스닥 커버드콜": "#7c3aed",
  "배당 다우존스": "#00b894", "테마 프리미엄": "#e17055",
  "채권 프리미엄": "#fdcb6e", "채권": "#fdcb6e", "달러 채권": "#0984e3",
  "국내 고배당": "#d63031", "국내 배당": "#d63031", "리츠": "#00cec9",
};

export function Dividend() {
  const { isAmountHidden, accounts, isMobile } = useAppContext();
  const [activeTab, setActiveTab] = useState<"ranking" | "my" | "apr2026" | "etf14" | "us2026" | "yieldmax" | "aiopinion">("my");
  const [showCalendar, setShowCalendar] = useState(false);
  const [showDistribution, setShowDistribution] = useState(false);

  // KV에서 배당률 로드
  const [rates, setRates] = useState<DividendRate[]>([]);
  const [ratesLoaded, setRatesLoaded] = useState(false);

  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<DividendRate>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRate, setNewRate] = useState<Partial<DividendRate>>({
    ticker: '', name: '', dividendPerShare: 0, frequency: 'monthly', exDividendDay: 0, paymentDay: 5,
  });
  const [targetMonthly, setTargetMonthly] = useState(() => {
    const migrated = localStorage.getItem("dividend_target_migrated_v1");
    if (!migrated) {
      localStorage.setItem("dividend_target_monthly", "7000000");
      localStorage.setItem("dividend_target_migrated_v1", "1");
      return 7000000;
    }
    const saved = localStorage.getItem("dividend_target_monthly");
    return saved ? Number(saved) : 7000000;
  });
  const [rankingData, setRankingData] = useState<RankingETF[]>([]);
  const [rankingLoading, setRankingLoading] = useState(true);
  const [rankingUpdatedAt, setRankingUpdatedAt] = useState<string>("");
  const [exchangeRate, setExchangeRate] = useState(1450);

  // KV 로드 + 마이그레이션
  useEffect(() => {
    kvGet<DividendRate[]>('dividend_rates').then(val => {
      if (val && val.length > 0) {
        setRates(val);
      } else {
        // localStorage에서 마이그레이션
        const migrated = migrateFromLocalStorage();
        setRates(migrated);
        if (migrated.length > 0) kvSet('dividend_rates', migrated).catch(() => {});
      }
      setRatesLoaded(true);
    }).catch(() => {
      const migrated = migrateFromLocalStorage();
      setRates(migrated);
      setRatesLoaded(true);
    });
  }, []);

  // rates 변경 시 KV 저장
  useEffect(() => {
    if (!ratesLoaded) return;
    kvSet('dividend_rates', rates).catch(() => {});
    // OptimalGuide용 localStorage 동기화 (coveredCallMonthlyDiv 계산용)
    const legacyStocks = rates.map(r => ({
      ticker: r.ticker, dividendPerShare: r.dividendPerShare, quantity: 1,
    }));
    localStorage.setItem('dividend_rates_sync', JSON.stringify(legacyStocks));
  }, [rates, ratesLoaded]);

  // 환율
  useEffect(() => {
    fetch(`${WORKER_URL}/exchange-rates`)
      .then(r => r.json())
      .then((d: { USD?: number }) => { if (d.USD) setExchangeRate(d.USD); })
      .catch(() => {});
  }, []);

  // ETF 순위 로드
  useEffect(() => {
    (async () => {
      setRankingLoading(true);
      try {
        const value = await fetch(`${WORKER_URL}/kv/etf_ranking`).then(r => r.json());
        if (value?.data) {
          const etfs = value.data.map((e: any, idx: number) => ({
            rank: idx + 1, name: e.name, ticker: e.ticker,
            price: e.price, recentDividend: e.recentDividend, prevMonthDiv: 0,
            annualYield: e.annualYield, category: categorizeETF(e.name),
            recentDivDate: e.actualDividendDate || e.recentDivDate || '',
            issuer: e.issuer || '',
            netAsset: e.netAsset || 0, priceChange: e.priceChange || 0, priceChangeRate: e.priceChangeRate || 0,
          }));
          setRankingData(etfs);
          if (value.updatedAt) setRankingUpdatedAt(value.updatedAt);
        }
      } catch {}
      setRankingLoading(false);
    })();
  }, []);

  // ETF 순위 로드 후 → 계좌 보유 종목 중 rate 없는 것 자동 등록
  useEffect(() => {
    if (rankingData.length === 0 || accounts.length === 0 || !ratesLoaded) return;
    const rankingMap = new Map(rankingData.map(r => [r.ticker, r]));
    const existingTickers = new Set(rates.map(r => r.ticker));
    const newRates: DividendRate[] = [];
    for (const acc of accounts) {
      for (const h of acc.holdings) {
        if (!h.ticker || h.isFund || existingTickers.has(h.ticker)) continue;
        const etf = rankingMap.get(h.ticker);
        if (etf && etf.recentDividend > 0) {
          newRates.push({
            ticker: h.ticker, name: h.name,
            dividendPerShare: etf.recentDividend,
            frequency: 'monthly', exDividendDay: 0, paymentDay: 5,
          });
          existingTickers.add(h.ticker);
        }
      }
    }
    if (newRates.length > 0) setRates(prev => [...prev, ...newRates]);
  }, [rankingData, accounts, ratesLoaded]);

  useEffect(() => { localStorage.setItem("dividend_target_monthly", String(targetMonthly)); }, [targetMonthly]);

  // accounts + rates → 실제 배당 계산용 리스트
  const effectiveStocks = useMemo((): EffectiveDividendStock[] => {
    const rateMap = new Map(rates.map(r => [r.ticker, r]));
    const result: EffectiveDividendStock[] = [];
    for (const acc of accounts) {
      for (const h of acc.holdings) {
        if (!h.ticker || h.isFund || !h.quantity || h.quantity <= 0) continue;
        const rate = rateMap.get(h.ticker);
        if (!rate) continue;
        result.push({
          key: `${acc.id}_${h.ticker}`,
          ticker: h.ticker, name: h.name,
          quantity: h.quantity,
          owner: acc.owner as 'wife' | 'husband',
          accLabel: acc.alias || acc.institution,
          dividendPerShare: rate.dividendPerShare,
          frequency: rate.frequency,
          exDividendDay: rate.exDividendDay,
          paymentDay: rate.paymentDay,
          isUSD: isUSDTicker(h.ticker),
        });
      }
    }
    return result;
  }, [accounts, rates]);

  const monthlyDividendData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const m = (now.getMonth() + i) % 12;
      const y = now.getFullYear() + Math.floor((now.getMonth() + i) / 12);
      const monthLabel = `${y}.${String(m + 1).padStart(2, "0")}`;
      let total = 0;
      const details: { name: string; amount: number }[] = [];
      for (const s of effectiveStocks) {
        let amount = 0;
        if (s.frequency === "weekly") amount = divAmount(s, exchangeRate) * 4.33;
        else if (s.frequency === "monthly") amount = divAmount(s, exchangeRate);
        else if (s.frequency === "quarterly" && m % 3 === 2) amount = divAmount(s, exchangeRate);
        else if (s.frequency === "yearly" && m === 11) amount = divAmount(s, exchangeRate);
        if (amount > 0) { details.push({ name: s.name, amount }); total += amount; }
      }
      return { month: monthLabel, total, details };
    });
  }, [effectiveStocks, exchangeRate]);

  const totalMonthlyEstimate = useMemo(() => effectiveStocks.reduce((sum, s) => {
    if (s.frequency === "weekly") return sum + divAmount(s, exchangeRate) * 4.33;
    if (s.frequency === "monthly") return sum + divAmount(s, exchangeRate);
    if (s.frequency === "quarterly") return sum + divAmount(s, exchangeRate) / 3;
    if (s.frequency === "yearly") return sum + divAmount(s, exchangeRate) / 12;
    return sum;
  }, 0), [effectiveStocks, exchangeRate]);

  const wifeMonthly = useMemo(() => effectiveStocks.filter(s => s.owner === 'wife').reduce((t, s) => {
    if (s.frequency === "weekly") return t + divAmount(s, exchangeRate) * 4.33;
    if (s.frequency === "monthly") return t + divAmount(s, exchangeRate);
    if (s.frequency === "quarterly") return t + divAmount(s, exchangeRate) / 3;
    return t + divAmount(s, exchangeRate) / 12;
  }, 0), [effectiveStocks, exchangeRate]);
  const husbandMonthly = totalMonthlyEstimate - wifeMonthly;

  const totalYearlyEstimate = totalMonthlyEstimate * 12;
  const achievementRate = targetMonthly > 0 ? Math.min((totalMonthlyEstimate / targetMonthly) * 100, 100) : 0;

  // 월 추정 배당금을 monthly_dividend_estimates에 날짜별로 저장
  useEffect(() => {
    if (totalMonthlyEstimate > 0) {
      const stored = JSON.parse(localStorage.getItem('monthly_dividend_estimates') || '{}');
      const month = new Date().toISOString().slice(0, 7);
      stored[month] = Math.round(totalMonthlyEstimate);
      localStorage.setItem('monthly_dividend_estimates', JSON.stringify(stored));
    }
  }, [totalMonthlyEstimate]);

  const hide = (s: string) => isAmountHidden ? "••••" : s;

  const handleSaveEdit = (ticker: string) => {
    setRates(prev => prev.map(r => r.ticker === ticker ? { ...r, ...editForm } : r));
    setEditingTicker(null);
  };
  const handleDelete = (ticker: string) => setRates(prev => prev.filter(r => r.ticker !== ticker));
  const handleAdd = () => {
    if (!newRate.ticker) return;
    const ticker = newRate.ticker.toUpperCase();
    if (rates.find(r => r.ticker === ticker)) return;
    setRates(prev => [...prev, {
      ticker, name: newRate.name || ticker,
      dividendPerShare: newRate.dividendPerShare || 0,
      frequency: newRate.frequency || 'monthly',
      exDividendDay: newRate.exDividendDay || 0,
      paymentDay: newRate.paymentDay || 5,
    }]);
    setNewRate({ ticker: '', name: '', dividendPerShare: 0, frequency: 'monthly', exDividendDay: 0, paymentDay: 5 });
    setShowAddForm(false);
  };

  const addFromRanking = (etf: RankingETF) => {
    if (rates.find(r => r.ticker === etf.ticker)) return;
    setRates(prev => [...prev, {
      ticker: etf.ticker, name: etf.name,
      dividendPerShare: etf.recentDividend,
      frequency: 'monthly', exDividendDay: 0, paymentDay: 5,
    }]);
  };

  // 내 종목 탭: 계좌에 있는 종목은 effectiveStocks 기준, 계좌에 없는 수동 등록 rates 도 표시
  const accountTickers = useMemo(() => new Set(accounts.flatMap(a => a.holdings.map(h => h.ticker))), [accounts]);
  const manualRates = useMemo(() => rates.filter(r => !accountTickers.has(r.ticker)), [rates, accountTickers]);

  // 티커별 계좌 목록 (툴팁용)
  const tickerAccountMap = useMemo(() => {
    const map = new Map<string, { owner: string; accLabel: string; quantity: number }[]>();
    for (const s of effectiveStocks) {
      if (!map.has(s.ticker)) map.set(s.ticker, []);
      map.get(s.ticker)!.push({ owner: s.owner === 'wife' ? '지윤' : '오빠', accLabel: s.accLabel, quantity: s.quantity });
    }
    return map;
  }, [effectiveStocks]);

  // 중복 티커 합산 (티커 기준 1행)
  const mergedStocks = useMemo(() => {
    const map = new Map<string, EffectiveDividendStock>();
    for (const s of effectiveStocks) {
      if (map.has(s.ticker)) {
        map.get(s.ticker)!.quantity += s.quantity;
      } else {
        map.set(s.ticker, { ...s });
      }
    }
    return Array.from(map.values());
  }, [effectiveStocks]);

  const [tooltip, setTooltip] = useState<{ ticker: string; x: number; y: number } | null>(null);

  return (
    <div style={{ padding: isMobile ? '12px' : '12px', maxWidth: 960, margin: '0 auto', '--text-xs': '15px', '--text-sm': '15px' } as React.CSSProperties}>
      {/* 툴팁 — fixed 포지션으로 overflow 무관하게 렌더 */}
      {tooltip && (() => {
        const accs = tickerAccountMap.get(tooltip.ticker) || [];
        const total = accs.reduce((s, a) => s + a.quantity, 0);
        const TOOLTIP_W = 200;
        const left = Math.min(tooltip.x + 8, window.innerWidth - TOOLTIP_W - 8);
        const top = tooltip.y - 8;
        return (
          <div style={{
            position: 'fixed', left, top, zIndex: 9999,
            background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
            borderRadius: 10, padding: '10px 14px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            minWidth: TOOLTIP_W, whiteSpace: 'nowrap',
            fontSize: 'var(--text-xs)', color: 'var(--text-secondary)',
            pointerEvents: 'none',
            transform: 'translateY(-100%)',
          }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, fontSize: 'var(--text-sm)' }}>보유 계좌</div>
            {accs.map((a, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-tertiary)' }}>{a.owner} · {a.accLabel}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(a.quantity)}</span>
              </div>
            ))}
            {accs.length > 1 && (
              <div style={{ borderTop: '1px solid var(--border-primary)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                <span style={{ color: 'var(--text-tertiary)' }}>합계</span>
                <span style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>{fmt(total)}</span>
              </div>
            )}
          </div>
        );
      })()}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: 0 }}>배당</h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginTop: 4 }}>월배당 순위와 내 배당 종목을 관리합니다</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className={`toss-tab ${activeTab === 'my' ? 'toss-tab-active' : ''}`} onClick={() => setActiveTab('my')}>내 배당종목</button>
        <button className={`toss-tab ${activeTab === 'ranking' ? 'toss-tab-active' : ''}`} onClick={() => setActiveTab('ranking')}>월배당 순위</button>
        <button className={`toss-tab ${activeTab === 'etf14' ? 'toss-tab-active' : ''}`} onClick={() => setActiveTab('etf14')}>월배당 ETF 전체</button>
        <button className={`toss-tab ${activeTab === 'apr2026' ? 'toss-tab-active' : ''}`} onClick={() => setActiveTab('apr2026')}>4월 ETF 성과</button>
        <button className={`toss-tab ${activeTab === 'us2026' ? 'toss-tab-active' : ''}`} onClick={() => setActiveTab('us2026')}>미국형 커버드콜</button>
        <button className={`toss-tab ${activeTab === 'yieldmax' ? 'toss-tab-active' : ''}`} onClick={() => setActiveTab('yieldmax')}>일드맥스 수익률</button>
        <button className={`toss-tab ${activeTab === 'aiopinion' ? 'toss-tab-active' : ''}`} onClick={() => setActiveTab('aiopinion')}>AI 의견</button>
      </div>

      {/* ═══ 탭1: 월배당 순위 ═══ */}
      {activeTab === "ranking" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "10px 14px",
            background: "var(--bg-secondary)", borderRadius: 8, fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
            <MIcon name="info" size={14} style={{ flexShrink: 0 }} />
            <span>연 분배율 기준 상위 {rankingData.length}개 월배당 ETF{rankingUpdatedAt && ` · ${rankingUpdatedAt} 업데이트`}</span>
          </div>
          <div className="toss-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="toss-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-primary)", background: "var(--bg-secondary)" }}>
                    {["#", "종목명", "분류", "현재가", "최근 분배금", "배당일", "연 분배율", ""].map((h, i) => (
                      <th key={i} style={{ padding: "12px 10px", textAlign: i <= 2 ? "left" : "right",
                        color: "var(--text-tertiary)", fontWeight: "var(--font-semibold)", fontSize: "var(--text-xs)", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rankingLoading ? (
                    <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>로딩 중...</td></tr>
                  ) : rankingData.map((etf) => {
                    const alreadyAdded = rates.some(r => r.ticker === etf.ticker);
                    const catColor = CATEGORY_COLORS[etf.category] || "var(--text-tertiary)";
                    return (
                      <tr key={etf.ticker} style={{ borderBottom: "1px solid var(--border-primary)" }}
                        onMouseEnter={e => e.currentTarget.style.background = "var(--bg-secondary)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "10px", textAlign: "center", color: "var(--text-quaternary)", fontWeight: "var(--font-bold)", fontSize: "var(--text-sm)", width: 36 }}>
                          {etf.rank <= 3 ? (etf.rank === 1 ? "🥇" : etf.rank === 2 ? "🥈" : "🥉") : etf.rank}
                        </td>
                        <td style={{ padding: "10px" }}>
                          <a href={`https://www.tossinvest.com/stocks/A${etf.ticker}/order`} target="_blank" rel="noopener noreferrer"
                            style={{ color: "var(--text-primary)", textDecoration: "none", fontWeight: "var(--font-medium)", display: "flex", alignItems: "center", gap: 4 }}>
                            {etf.name}<MIcon name="open_in_new" size={12} style={{ opacity: 0.4, flexShrink: 0 }} />
                          </a>
                          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-quaternary)", marginTop: 2 }}>
                            {etf.ticker}{etf.issuer ? ` · ${etf.issuer}` : ''}
                          </div>
                        </td>
                        <td style={{ padding: "10px" }}>
                          <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 'var(--text-xs)', fontWeight: 600, background: `${catColor}18`, color: catColor }}>{etf.category}</span>
                        </td>
                        <td className="toss-number" style={{ padding: "10px", textAlign: "right" }}>
                          <div style={{ color: "var(--text-primary)", fontWeight: "var(--font-medium)" }}>{fmt(etf.price)}원</div>
                          {etf.priceChange != null && etf.priceChange !== 0 && (
                            <div style={{ fontSize: "var(--text-xs)", marginTop: 1, color: etf.priceChange > 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                              {etf.priceChange > 0 ? '▲' : '▼'}{fmt(Math.abs(etf.priceChange))} ({(etf.priceChangeRate || 0).toFixed(2)}%)
                            </div>
                          )}
                        </td>
                        <td className="toss-number" style={{ padding: "10px", textAlign: "right" }}>
                          <div style={{ color: "var(--accent-blue)", fontWeight: "var(--font-bold)" }}>{fmt(etf.recentDividend)}원</div>
                        </td>
                        <td className="toss-number" style={{ padding: "10px", textAlign: "right", color: "var(--text-secondary)", fontSize: "var(--text-xs)" }}>{etf.recentDivDate || '-'}</td>
                        <td className="toss-number" style={{ padding: "10px", textAlign: "right", fontWeight: "var(--font-bold)",
                          color: etf.annualYield >= 10 ? "var(--color-loss)" : etf.annualYield >= 5 ? "#fdcb6e" : "var(--text-primary)" }}>
                          {etf.annualYield.toFixed(1)}%
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "right" }}>
                          <button onClick={() => addFromRanking(etf)} disabled={alreadyAdded}
                            style={{ padding: "4px 10px", borderRadius: 6, border: "none", cursor: alreadyAdded ? "default" : "pointer",
                              fontSize: 'var(--text-xs)', fontWeight: 600,
                              background: alreadyAdded ? "var(--bg-tertiary)" : "rgba(49,130,246,0.1)",
                              color: alreadyAdded ? "var(--text-quaternary)" : "var(--accent-blue)" }}>
                            {alreadyAdded ? "추가됨" : "+ 담기"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ═══ 탭2: 내 배당종목 ═══ */}
      {activeTab === "my" && (
        <>
          {/* Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? '1fr' : "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
            <div className="toss-card" style={{ padding: 20 }}>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: 8 }}>월 예상 배당 (합산)</div>
              <div className="toss-number" style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)", color: "var(--accent-blue)" }}>
                {hide(`${fmt(totalMonthlyEstimate)}원`)}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: "var(--text-xs)" }}>
                <span style={{ color: 'var(--accent-blue)' }}>지윤 {hide(`${fmt(wifeMonthly)}원`)}</span>
                <span style={{ color: 'var(--color-profit)' }}>오빠 {hide(`${fmt(husbandMonthly)}원`)}</span>
              </div>
            </div>
            <div className="toss-card" style={{ padding: 20, cursor: 'pointer', position: 'relative' }} onClick={() => setShowCalendar(true)}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>연 예상 배당 (합산)</div>
                <MIcon name="calendar_month" size={16} style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <div className="toss-number" style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)", color: "var(--color-profit)" }}>
                {hide(`${fmt(totalYearlyEstimate)}원`)}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: "var(--text-xs)" }}>
                <span style={{ color: 'var(--accent-blue)' }}>지윤 {hide(`${fmt(wifeMonthly * 12)}원`)}</span>
                <span style={{ color: 'var(--color-profit)' }}>오빠 {hide(`${fmt(husbandMonthly * 12)}원`)}</span>
              </div>
            </div>
            <div className="toss-card" style={{ padding: 20 }}>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: 8 }}>
                목표 달성률 <span style={{ fontSize: "var(--text-xs)", color: "var(--text-quaternary)", marginLeft: 4 }}>(목표: {hide(`${fmt(targetMonthly)}원/월`)})</span>
              </div>
              <div className="toss-number" style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)", color: achievementRate >= 100 ? "var(--color-profit)" : "var(--text-primary)" }}>
                {hide(`${achievementRate.toFixed(1)}%`)}
              </div>
              <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: "var(--bg-tertiary)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(achievementRate, 100)}%`, borderRadius: 3, background: achievementRate >= 100 ? "var(--color-profit)" : "var(--accent-blue)", transition: "width 0.3s" }} />
              </div>
            </div>
          </div>

          {/* 목표 설정 */}
          {!isMobile && <div className="toss-card" style={{ padding: 20, marginBottom: 24 }}>
            {(() => {
              const gap = targetMonthly - totalMonthlyEstimate;
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontWeight: "var(--font-medium)" }}>월 목표 배당금</span>
                  <input className="toss-input" type="text" value={targetMonthly.toLocaleString('ko-KR')}
                    onChange={e => setTargetMonthly(Number(e.target.value.replace(/,/g, '')) || 0)}
                    style={{ width: 160, textAlign: "right", fontSize: "var(--text-sm)" }} />
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>원</span>
                  {gap > 0 && (
                    <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: 'var(--color-loss)' }}>
                      월 {fmt(gap)}원 부족
                    </span>
                  )}
                  {gap <= 0 && (
                    <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: 'var(--color-profit)' }}>
                      {fmt(Math.abs(gap))}원 초과 달성
                    </span>
                  )}
                </div>
              );
            })()}
            {(() => {
              const gap = targetMonthly - totalMonthlyEstimate;
              if (gap <= 0) return (
                <div style={{ padding: 14, borderRadius: 10, background: 'rgba(0,184,148,0.08)', border: '1px solid rgba(0,184,148,0.2)' }}>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: 'var(--color-profit)', marginBottom: 4 }}>목표 달성!</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                    월 목표 배당금을 <strong>{fmt(Math.abs(gap))}원</strong> 초과 달성 중입니다. 현재 월 {fmt(totalMonthlyEstimate)}원 / 목표 {fmt(targetMonthly)}원
                  </div>
                </div>
              );
              const ownedTickers = new Set(effectiveStocks.map(s => s.ticker));
              const allCandidates = rankingData
                .filter(r => !ownedTickers.has(r.ticker) && r.recentDividend > 0 && !r.name.includes('혼합'))
                .sort((a, b) => b.annualYield - a.annualYield);
              // 분산: 카테고리당 최대 2개, 총 7개
              const MIX_TARGET = 7;
              const MAX_PER_CAT = 2;
              const catCount = new Map<string, number>();
              const mixPicks: typeof allCandidates = [];
              for (const c of allCandidates) {
                if (mixPicks.length >= MIX_TARGET) break;
                const n = catCount.get(c.category) ?? 0;
                if (n >= MAX_PER_CAT) continue;
                catCount.set(c.category, n + 1);
                mixPicks.push(c);
              }
              // 티커별 추천 계좌: 보유 계좌 우선, 없으면 절세 순 + ISA 한도(1억) 체크
              const ISA_LIMIT = 100_000_000;
              // avgPrice가 0이면 rankingData 현재가로 보완해 ISA 잔여 한도 추정
              const rankingPriceMap = new Map(rankingData.map(r => [r.ticker, r.price]));
              const accValue = (acc: typeof accounts[0]) =>
                acc.holdings.reduce((s, h) => {
                  if (h.isFund) return s + (h.amount || 0);
                  const price = h.avgPrice > 0 ? h.avgPrice : (rankingPriceMap.get(h.ticker) ?? 0);
                  return s + price * h.quantity;
                }, 0);
              const taxOrder = (t: string) => t === 'ISA' ? 0 : (t === 'IRP' || t === '연금저축') ? 1 : 2;

              // 추천 진행 중 ISA에 누적 배정된 비용 추적 (순차 배정으로 1억 초과 방지)
              const isaRunning = new Map<string, number>(
                accounts.filter(a => a.accountType === 'ISA').map(a => [a.id, accValue(a)])
              );

              const getRecommendedAccounts = (ticker: string, purchaseCost: number) => {
                const holding = accounts.filter(a => a.holdings.some(h => h.ticker === ticker));
                if (holding.length > 0) {
                  return { type: 'holding' as const, accounts: holding.map(a => ({ label: `${a.ownerName} ${a.alias}`, type: a.accountType })) };
                }
                // ISA: 누적 배정액 + 이번 매수비용이 1억 이하인 계좌만 허용
                const available = [...accounts].filter(a => {
                  if (a.accountType === 'ISA') return (isaRunning.get(a.id) ?? 0) + purchaseCost <= ISA_LIMIT;
                  return true;
                }).sort((a, b) => taxOrder(a.accountType) - taxOrder(b.accountType));

                // 가능한 계좌가 없으면 한도 상관없이 순위 첫번째 반환
                const pool = available.length > 0 ? available : [...accounts].sort((a, b) => taxOrder(a.accountType) - taxOrder(b.accountType));
                const best = pool[0];
                // ISA에 배정됐으면 누적액 갱신
                if (best && best.accountType === 'ISA') {
                  isaRunning.set(best.id, (isaRunning.get(best.id) ?? 0) + purchaseCost);
                }
                return { type: 'suggest' as const, accounts: [{ label: `${best.ownerName} ${best.alias}`, type: best.accountType }] };
              };
              const mixSuggestions = mixPicks.map(c => {
                const qty = Math.ceil(gap / MIX_TARGET / c.recentDividend);
                const cost = qty * c.price;
                return { name: c.name, ticker: c.ticker, qty, cost, monthlyDiv: qty * c.recentDividend, yield: c.annualYield, category: c.category, changeRate: c.priceChangeRate ?? 0, recAccounts: getRecommendedAccounts(c.ticker, cost) };
              });
              const mixTotalCost = mixSuggestions.reduce((s, m) => s + m.cost, 0);
              const mixTotalDiv = mixSuggestions.reduce((s, m) => s + m.monthlyDiv, 0);
              return (
                <div style={{ padding: 14, borderRadius: 10, background: 'rgba(49,130,246,0.06)', border: '1px solid rgba(49,130,246,0.15)' }}>
                  {mixSuggestions.length >= 2 && (
                    <div>
                      {mixSuggestions.map(m => (
                        <div key={m.ticker} style={{ fontSize: 'var(--text-xs)', padding: '8px 0', borderBottom: '1px solid var(--border-secondary)' }}>
                          {/* 종목명 행 */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{m.name}</span>
                              <span style={{ color: 'var(--text-quaternary)', fontSize: '10px', flexShrink: 0 }}>[{m.category}]</span>
                              {m.changeRate !== 0 && (
                                <span style={{ flexShrink: 0, fontWeight: 700, color: m.changeRate > 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                                  {m.changeRate > 0 ? '▲' : '▼'}{Math.abs(m.changeRate).toFixed(2)}%
                                </span>
                              )}
                            </div>
                            <span style={{ whiteSpace: 'nowrap', marginLeft: 8 }}>
                              <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{m.qty}주</span>
                              <span style={{ color: 'var(--text-quaternary)', marginLeft: 4 }}>({fmt(m.cost)}원, 월 {fmt(m.monthlyDiv)}원)</span>
                            </span>
                          </div>
                          {/* 추천 계좌 행 */}
                          {m.recAccounts && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <MIcon name={m.recAccounts.type === 'holding' ? 'account_balance_wallet' : 'recommend'} size={11} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
                              <span style={{ color: 'var(--text-tertiary)' }}>
                                {m.recAccounts.type === 'holding' ? '이미 보유' : '추천 계좌'}:
                              </span>
                              {m.recAccounts.accounts.map((a, i) => (
                                <span key={i} style={{ padding: '1px 6px', borderRadius: 8, fontWeight: 600,
                                  background: 'rgba(49,130,246,0.1)', color: 'var(--accent-blue)' }}>
                                  {a.label}
                                </span>
                              ))}
                              <button
                                onClick={() => {
                                  localStorage.setItem('chart_new_tab_ticker', m.ticker);
                                  window.open(window.location.href, '_blank');
                                }}
                                title="3개월 차트 보기"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', lineHeight: 1 }}
                              >
                                <MIcon name="show_chart" size={13} style={{ color: 'var(--accent-blue)' }} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                      <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, background: 'rgba(49,130,246,0.08)', fontSize: 'var(--text-xs)', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>합계</span>
                        <span><span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>투자 {fmt(mixTotalCost)}원</span><span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>→ 월 +{fmt(mixTotalDiv)}원</span></span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>}

          {/* 분산 현황 팝업 */}
          {showDistribution && (() => {
            // 카테고리별 집계
            const CAT_COLORS: Record<string, string> = {
              '나스닥 커버드콜': '#6366f1',
              'S&P500 커버드콜': '#3b82f6',
              '배당 커버드콜': '#0ea5e9',
              '채권 프리미엄': '#14b8a6',
              '커버드콜': '#8b5cf6',
              '국내 고배당': '#f59e0b',
              '배당 다우존스': '#f97316',
              '리츠': '#ec4899',
              '채권': '#10b981',
              '기타': '#94a3b8',
            };
            const catMap = new Map<string, { monthlyDiv: number; stocks: string[] }>();
            for (const s of effectiveStocks) {
              const cat = categorizeETF(s.name);
              const monthly = s.frequency === 'weekly' ? divAmount(s, exchangeRate) * 4.33
                : s.frequency === 'monthly' ? divAmount(s, exchangeRate)
                : s.frequency === 'quarterly' ? divAmount(s, exchangeRate) / 3
                : divAmount(s, exchangeRate) / 12;
              const cur = catMap.get(cat) ?? { monthlyDiv: 0, stocks: [] };
              if (!cur.stocks.includes(s.name)) cur.stocks.push(s.name);
              catMap.set(cat, { monthlyDiv: cur.monthlyDiv + monthly, stocks: cur.stocks });
            }
            const catList = [...catMap.entries()]
              .map(([cat, v]) => ({ cat, ...v }))
              .sort((a, b) => b.monthlyDiv - a.monthlyDiv);
            const totalDiv = catList.reduce((s, c) => s + c.monthlyDiv, 0);

            return (
              <div onClick={() => setShowDistribution(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-primary)', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                  {/* 헤더 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div>
                      <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>종목 유형별 분산</h2>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>{mergedStocks.length}종목 · 월 {hide(`${fmt(totalDiv)}원`)}</p>
                    </div>
                    <button onClick={() => setShowDistribution(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><MIcon name="close" size={20} /></button>
                  </div>

                  {/* 누적 바 */}
                  <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', marginBottom: 16 }}>
                    {catList.map(c => (
                      <div key={c.cat} style={{ width: `${totalDiv > 0 ? c.monthlyDiv / totalDiv * 100 : 0}%`, background: CAT_COLORS[c.cat] ?? '#94a3b8', transition: 'width 0.3s' }} />
                    ))}
                  </div>

                  {/* 카테고리별 행 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {catList.map(c => {
                      const pct = totalDiv > 0 ? c.monthlyDiv / totalDiv * 100 : 0;
                      const color = CAT_COLORS[c.cat] ?? '#94a3b8';
                      return (
                        <div key={c.cat} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '12px 14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{c.cat}</span>
                              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{c.stocks.length}종목</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color }}>{pct.toFixed(1)}%</span>
                              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginLeft: 6 }}>{hide(`${fmt(c.monthlyDiv)}원/월`)}</span>
                            </div>
                          </div>
                          {/* 비율 바 */}
                          <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-elevated)', overflow: 'hidden', marginBottom: 8 }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
                          </div>
                          {/* 종목 뱃지 */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {c.stocks.map((name, j) => (
                              <span key={j} style={{ fontSize: 'var(--text-xs)', padding: '2px 7px', borderRadius: 10, background: 'var(--bg-primary)', border: `1px solid ${color}40`, color: 'var(--text-secondary)' }}>{name}</span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 월별 배당 캘린더 팝업 */}
          {showCalendar && (
            <div onClick={() => setShowCalendar(false)} style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
            }}>
              <div onClick={e => e.stopPropagation()} style={{
                background: 'var(--bg-primary)', borderRadius: 16, width: '100%', maxWidth: 600,
                maxHeight: '85vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", color: "var(--text-primary)", margin: 0 }}>월별 예상 배당금 (12개월)</h2>
                  <button onClick={() => setShowCalendar(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
                    <MIcon name="close" size={20} />
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
                  {monthlyDividendData.map((m) => (
                    <div key={m.month} style={{ padding: 12, borderRadius: 10, textAlign: "center",
                      background: m.total > 0 ? "rgba(49,130,246,0.08)" : "var(--bg-secondary)",
                      border: m.total > 0 ? "1px solid rgba(49,130,246,0.2)" : "1px solid var(--border-secondary)" }}>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginBottom: 4 }}>{m.month}</div>
                      <div className="toss-number" style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-bold)", color: m.total > 0 ? "var(--accent-blue)" : "var(--text-quaternary)" }}>
                        {m.total > 0 ? hide(`${fmt(m.total)}원`) : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 배당 종목 리스트 (계좌 보유 기준) */}
          <div className="toss-card" style={{ padding: 20, marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", color: "var(--text-primary)", margin: 0 }}>
                  내 배당 종목 ({mergedStocks.length}종목)
                </h2>
                <button onClick={() => setShowDistribution(true)}
                  style={{ background: 'none', border: '1px solid var(--border-secondary)', borderRadius: 8, padding: '3px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  <MIcon name="pie_chart" size={13} /> 분산 현황
                </button>
              </div>
              <button className="toss-btn-primary" style={{ fontSize: "var(--text-sm)", padding: "6px 14px", display: "flex", alignItems: "center", gap: 4 }}
                onClick={() => setShowAddForm(!showAddForm)}>
                <MIcon name="add" size={14} /> 배당율 추가
              </button>
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 16 }}>
              수량은 계좌종목등록에서 자동으로 가져옵니다. 주당 배당금만 수정하세요.
            </div>

            {showAddForm && (
              <div style={{ padding: 16, marginBottom: 16, background: "var(--bg-secondary)", borderRadius: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                <div><label style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>티커</label>
                  <input className="toss-input" value={newRate.ticker} onChange={e => setNewRate({ ...newRate, ticker: e.target.value.toUpperCase() })} style={{ width: "100%", fontSize: "var(--text-sm)" }} /></div>
                <div><label style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>종목명</label>
                  <input className="toss-input" value={newRate.name} onChange={e => setNewRate({ ...newRate, name: e.target.value })} style={{ width: "100%", fontSize: "var(--text-sm)" }} /></div>
                <div><label style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>주당 배당금(월)</label>
                  <input className="toss-input" type="number" value={newRate.dividendPerShare} onChange={e => setNewRate({ ...newRate, dividendPerShare: Number(e.target.value) })} style={{ width: "100%", fontSize: "var(--text-sm)", textAlign: "right" }} /></div>
                <div><label style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>배당주기</label>
                  <select className="toss-input" value={newRate.frequency} onChange={e => setNewRate({ ...newRate, frequency: e.target.value as any })} style={{ width: "100%", fontSize: "var(--text-sm)" }}>
                    <option value="monthly">월배당</option><option value="quarterly">분기배당</option><option value="yearly">연배당</option>
                  </select></div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
                  <button className="toss-btn-primary" style={{ fontSize: "var(--text-sm)", padding: "8px 16px" }} onClick={handleAdd}>추가</button>
                  <button className="toss-btn-ghost" style={{ fontSize: "var(--text-sm)", padding: "8px 12px" }} onClick={() => setShowAddForm(false)}>취소</button>
                </div>
              </div>
            )}

            {isMobile ? (
              /* 모바일: 카드 리스트 */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {mergedStocks.map((stock) => {
                  const rawAmount = divAmount(stock, exchangeRate);
                  const monthlyAmount = stock.frequency === "weekly" ? rawAmount * 4.33 : stock.frequency === "monthly" ? rawAmount : stock.frequency === "quarterly" ? rawAmount / 3 : rawAmount / 12;
                  const nextEx = getNextExDividendDate(stock.exDividendDay, stock.frequency);
                  const dLeft = daysUntil(nextEx);
                  const isEditing = editingTicker === stock.ticker;
                  const accs = tickerAccountMap.get(stock.ticker) || [];
                  return (
                    <div key={stock.key} style={{ padding: '12px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-secondary)' }}>
                      {/* 상단: 종목명 + 월배당금 + 편집 */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>{stock.name}</span>
                            <span style={{ fontSize: 'var(--text-xs)', padding: '1px 6px', borderRadius: 8,
                              background: stock.frequency === "monthly" ? "rgba(49,130,246,0.1)" : "rgba(0,184,148,0.1)",
                              color: stock.frequency === "monthly" ? "var(--accent-blue)" : "#00b894", flexShrink: 0 }}>
                              {stock.frequency === "weekly" ? "주배당" : stock.frequency === "monthly" ? "월배당" : stock.frequency === "quarterly" ? "분기배당" : "연배당"}
                            </span>
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-quaternary)', marginTop: 2 }}>
                            {stock.ticker}{accs.length === 1 ? ` · ${accs[0].owner} ${accs[0].accLabel}` : accs.length > 1 ? ` · ${accs.length}개 계좌` : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                          <span style={{ fontWeight: 700, color: 'var(--accent-blue)', fontSize: 'var(--text-base)', whiteSpace: 'nowrap' }}>
                            {monthlyAmount > 0 ? hide(`${fmt(monthlyAmount)}원`) : "—"}
                          </span>
                          {isEditing ? (
                            <>
                              <button onClick={() => handleSaveEdit(stock.ticker)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-profit)", padding: 4 }}><MIcon name="check" size={16} /></button>
                              <button onClick={() => setEditingTicker(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 4 }}><MIcon name="close" size={16} /></button>
                            </>
                          ) : (
                            <button onClick={() => { setEditingTicker(stock.ticker); setEditForm({ dividendPerShare: stock.dividendPerShare }); }}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 4 }}>
                              <MIcon name="edit" size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      {/* 편집 인풋 */}
                      {isEditing && (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>주당배당(월)</span>
                          <input className="toss-input" type="number" value={editForm.dividendPerShare ?? stock.dividendPerShare}
                            onChange={e => setEditForm({ ...editForm, dividendPerShare: Number(e.target.value) })}
                            style={{ width: 100, textAlign: "right", fontSize: "var(--text-sm)" }} />
                        </div>
                      )}
                      {/* 하단 세부 */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 8, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                        <span>보유 <strong style={{ color: 'var(--text-secondary)' }}>{fmt(stock.quantity)}주</strong></span>
                        <span>주당 <strong style={{ color: 'var(--text-secondary)' }}>{stock.isUSD ? `$${stock.dividendPerShare}` : `${fmt(stock.dividendPerShare)}원`}</strong></span>
                        <span style={{ color: dLeft <= 3 ? "var(--color-loss)" : dLeft <= 7 ? "#fdcb6e" : "var(--text-quaternary)" }}>
                          배당락 {formatDate(nextEx)} ({dLeft === 0 ? "오늘" : `D-${dLeft}`})
                        </span>
                      </div>
                    </div>
                  );
                })}
                {effectiveStocks.length === 0 && (
                  <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
                    계좌 보유 종목 중 배당율이 등록된 종목이 없습니다.<br/>ETF 순위 탭에서 "+ 담기"로 추가하거나 위 "배당율 추가" 버튼을 사용하세요.
                  </div>
                )}
              </div>
            ) : (
              /* 데스크탑: 테이블 */
              <div style={{ overflowX: "auto" }}>
                <table className="toss-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
                      {["종목명", "계좌", "보유수량", "주당배당(월)", "월배당금", "배당주기", "다음 배당락", ""].map((h, i) => (
                        <th key={i} style={{ padding: "10px 12px", textAlign: i <= 1 ? "left" : "right", color: "var(--text-tertiary)", fontWeight: "var(--font-medium)", fontSize: "var(--text-xs)", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mergedStocks.map((stock) => {
                      const rawAmount = divAmount(stock, exchangeRate);
                      const monthlyAmount = stock.frequency === "weekly" ? rawAmount * 4.33 : stock.frequency === "monthly" ? rawAmount : stock.frequency === "quarterly" ? rawAmount / 3 : rawAmount / 12;
                      const nextEx = getNextExDividendDate(stock.exDividendDay, stock.frequency);
                      const dLeft = daysUntil(nextEx);
                      const isEditing = editingTicker === stock.ticker;
                      return (
                        <tr key={stock.key} style={{ borderBottom: "1px solid var(--border-primary)" }}>
                          <td style={{ padding: "10px 12px" }}>
                            <div style={{ fontWeight: "var(--font-medium)", color: "var(--text-primary)" }}>{stock.name}</div>
                            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-quaternary)", marginTop: 2 }}>{stock.ticker}</div>
                          </td>
                          <td style={{ padding: "10px 12px", fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                            {(() => {
                              const accs = tickerAccountMap.get(stock.ticker) || [];
                              const owners = [...new Set(accs.map(a => a.owner))];
                              if (accs.length === 1) {
                                return <>
                                  <div>{accs[0].owner}</div>
                                  <div style={{ color: 'var(--text-quaternary)' }}>{accs[0].accLabel}</div>
                                </>;
                              }
                              return <>
                                <div>{owners.join('·')}</div>
                                <div style={{ color: 'var(--text-quaternary)' }}>{accs.length}개 계좌</div>
                              </>;
                            })()}
                          </td>
                          <td className="toss-number" style={{ padding: "10px 12px", textAlign: "right", color: "var(--text-secondary)" }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              {fmt(stock.quantity)}
                              <span
                                onMouseEnter={(e) => {
                                  const r = e.currentTarget.getBoundingClientRect();
                                  setTooltip({ ticker: stock.ticker, x: r.right, y: r.top });
                                }}
                                onMouseLeave={() => setTooltip(null)}
                                style={{ display: 'inline-flex', alignItems: 'center', cursor: 'default' }}
                              >
                                <MIcon name="info" size={13} style={{ color: 'var(--text-quaternary)', verticalAlign: 'middle' }} />
                              </span>
                            </div>
                          </td>
                          <td className="toss-number" style={{ padding: "10px 12px", textAlign: "right" }}>
                            {isEditing ? (
                              <input className="toss-input" type="number" value={editForm.dividendPerShare ?? stock.dividendPerShare}
                                onChange={e => setEditForm({ ...editForm, dividendPerShare: Number(e.target.value) })}
                                style={{ width: 80, textAlign: "right", fontSize: "var(--text-sm)" }} />
                            ) : stock.isUSD ? hide(`$${stock.dividendPerShare}`) : hide(`${fmt(stock.dividendPerShare)}원`)}
                          </td>
                          <td className="toss-number" style={{ padding: "10px 12px", textAlign: "right", color: "var(--accent-blue)", fontWeight: "var(--font-semibold)" }}>
                            {monthlyAmount > 0 ? hide(`${fmt(monthlyAmount)}원`) : "—"}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right" }}>
                            <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: "var(--text-xs)", fontWeight: "var(--font-medium)",
                              background: stock.frequency === "monthly" ? "rgba(49,130,246,0.1)" : "rgba(0,184,148,0.1)",
                              color: stock.frequency === "monthly" ? "var(--accent-blue)" : "#00b894" }}>
                              {stock.frequency === "weekly" ? "주" : stock.frequency === "monthly" ? "월" : stock.frequency === "quarterly" ? "분기" : "연"}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                            <div>
                              <span style={{ color: "var(--text-primary)", fontWeight: "var(--font-medium)" }}>{formatDate(nextEx)}</span>
                              <span style={{ marginLeft: 6, fontSize: "var(--text-xs)", color: dLeft <= 3 ? "var(--color-loss)" : dLeft <= 7 ? "#fdcb6e" : "var(--text-quaternary)" }}>
                                {dLeft === 0 ? "오늘" : `${dLeft}일 후`}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: "10px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                            {isEditing ? (
                              <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                                <button onClick={() => handleSaveEdit(stock.ticker)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-profit)", padding: 4 }}><MIcon name="check" size={16} /></button>
                                <button onClick={() => setEditingTicker(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 4 }}><MIcon name="close" size={16} /></button>
                              </div>
                            ) : (
                              <button onClick={() => { setEditingTicker(stock.ticker); setEditForm({ dividendPerShare: stock.dividendPerShare }); }}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 4 }}>
                                <MIcon name="edit" size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {effectiveStocks.length === 0 && (
                      <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
                        계좌 보유 종목 중 배당율이 등록된 종목이 없습니다.<br/>ETF 순위 탭에서 "+ 담기"로 추가하거나 위 "배당율 추가" 버튼을 사용하세요.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 계좌에 없는 수동 등록 종목 */}
          {manualRates.length > 0 && (
            <div className="toss-card" style={{ padding: 20, marginBottom: 24 }}>
              <h2 style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-semibold)", color: "var(--text-secondary)", margin: "0 0 12px 0" }}>
                수동 등록 배당율 ({manualRates.length}개) — 계좌에 없는 종목
              </h2>
              <div style={{ overflowX: "auto" }}>
                <table className="toss-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
                  <tbody>
                    {manualRates.map(r => (
                      <tr key={r.ticker} style={{ borderBottom: "1px solid var(--border-primary)" }}>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ fontWeight: "var(--font-medium)", color: "var(--text-primary)" }}>{r.name}</div>
                          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-quaternary)" }}>{r.ticker}</div>
                        </td>
                        <td className="toss-number" style={{ padding: "10px 12px", textAlign: "right", color: "var(--text-tertiary)" }}>
                          {isUSDTicker(r.ticker) ? `$${r.dividendPerShare}` : `${fmt(r.dividendPerShare)}원`} / 주
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "right" }}>
                          <button onClick={() => handleDelete(r.ticker)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 4 }}>
                            <MIcon name="delete" size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "12px 16px", background: "var(--bg-secondary)", borderRadius: 8, fontSize: "var(--text-xs)", color: "var(--text-tertiary)", lineHeight: 1.6 }}>
            <MIcon name="info" size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>수량은 계좌종목등록 페이지에서 자동으로 반영됩니다. 주당 배당금은 최근 분배금 기준이며 실제와 다를 수 있습니다.</span>
          </div>
        </>
      )}

      {/* ═══ 탭3: 14개 ETF ═══ */}
      {activeTab === "etf14" && <Etf14Tab />}

      {/* ═══ 탭4: 4월 ETF 성과 ═══ */}
      {activeTab === "apr2026" && <Apr2026Tab />}

      {/* ═══ 탭5: 미국주식형 커버드콜 ═══ */}
      {activeTab === "us2026" && <Us2026Tab />}

      {/* ═══ 탭6: 일드맥스 수익률 분석 ═══ */}
      {activeTab === "yieldmax" && <YieldMaxAnalysisTab />}

      {/* ═══ 탭7: AI 의견 ═══ */}
      {activeTab === "aiopinion" && <AiOpinionTab />}
    </div>
  );
}

// ─── 월배당 ETF 전체 탭 데이터 ────────────────────────────────────────────
type EtfRow = { ticker: string; name: string; distRate: number | null; m1: number | null; m3: number | null; m6: number | null; m12: number | null };

const CAT_CASH_KR: EtfRow[] = [
  { ticker: '—',      name: 'SOL CD금리&아히머캣액티브',              distRate: 0.29, m1:  0.25, m3:  0.78, m6:  1.56, m12:  3.03 },
  { ticker: '—',      name: 'KODEX CD1년금리액티브스탁액션(합성)',     distRate: 0.23, m1:  0.23, m3:  0.70, m6:  1.42, m12:  2.75 },
  { ticker: '—',      name: 'TIGER CD금리플러스액티브(합성)',           distRate: 0.23, m1:  0.23, m3:  0.70, m6:  1.40, m12:  2.74 },
  { ticker: '458580', name: 'KODEX CD금리액티브(합성)',                 distRate: 0.22, m1:  0.22, m3:  0.68, m6:  1.38, m12:  2.69 },
  { ticker: '423160', name: 'KODEX KOFR금리액티브(합성)',               distRate: 0.21, m1:  0.64, m3:  0.41, m6:  1.29, m12:  2.61 },
];
const CAT_CASH_USD: EtfRow[] = [
  { ticker: '—', name: 'KODEX 미국머니마켓액티브',             distRate: 0.33, m1: -2.12, m3:  2.89, m6:  4.83, m12: null  },
  { ticker: '—', name: 'KODEX 미국달러SOFR금리액티브(합성)',   distRate: 0.29, m1: -2.05, m3:  2.96, m6:  4.63, m12:  6.63 },
];
const CAT_DOMESTIC: EtfRow[] = [
  { ticker: '211900', name: 'KODEX 코리아배당성장',               distRate: 1.43, m1:  8.03, m3: 23.83, m6: 49.13, m12: 101.60 },
  { ticker: '—',      name: 'PLUS 자사주매입&배당주',             distRate: 0.52, m1:  4.71, m3: 14.01, m6: 32.78, m12:   null },
  { ticker: '—',      name: 'TIME Korea올플러스리배당액티브',     distRate: 0.50, m1: 15.92, m3: 34.06, m6: 69.78, m12: 167.10 },
  { ticker: '—',      name: 'KODEX 금융&국채TOP10',               distRate: 0.48, m1:  4.93, m3: 16.49, m6: 30.33, m12:   null },
  { ticker: '—',      name: 'SOL 코리아고배당',                   distRate: 0.43, m1:  4.82, m3: 16.17, m6: 36.60, m12:   null },
];
const CAT_SCHD: EtfRow[] = [
  { ticker: '—', name: 'TIME 미국배당다우존스액티브',   distRate: 0.48, m1:  5.73, m3: 12.48, m6: 13.80, m12:   null },
  { ticker: '—', name: 'ACE 미국배당다우존스',          distRate: 0.30, m1: -0.91, m3:  9.94, m6: 19.97, m12:  28.00 },
  { ticker: '—', name: 'SOL 미국배당다우존스2호',       distRate: 0.28, m1: -0.84, m3:  9.70, m6: 20.02, m12:  27.67 },
  { ticker: '—', name: 'KODEX 미국배당다우존스',        distRate: 0.26, m1: -0.86, m3:  9.76, m6: 19.95, m12:  28.10 },
  { ticker: '—', name: 'SOL 미국배당다우존스(H)',       distRate: 0.23, m1: -1.48, m3:  7.36, m6: 15.59, m12:  22.17 },
];
const CAT_REITS: EtfRow[] = [
  { ticker: '329200', name: 'TIGER 리츠부동산인프라',              distRate: 0.67, m1:  7.48, m3: 10.32, m6: 17.20, m12: 25.82 },
  { ticker: '476800', name: 'KODEX 한국부동산리츠인프라',          distRate: 0.59, m1:  5.46, m3:  5.69, m6: 10.37, m12: 16.08 },
  { ticker: '—',      name: 'KODEX 일본부동산리츠(H)',             distRate: 0.54, m1: -1.35, m3: -3.18, m6: -2.31, m12: 15.40 },
  { ticker: '—',      name: 'ACE 리츠부동산인프라액티브',          distRate: 0.48, m1:  5.56, m3: 10.35, m6:  0.00, m12:  0.00 },
  { ticker: '—',      name: 'TIGER 리츠부동산인프라TOP10액티브',   distRate: 0.46, m1:  8.54, m3: 12.07, m6: 14.99, m12:   null },
];
const DIST_TOP5: EtfRow[] = [
  { ticker: '211900', name: 'KODEX 코리아배당성장',                        distRate: 1.43, m1:  8.03, m3: 23.83, m6: 43.13, m12: 101.60 },
  { ticker: '329200', name: 'TIGER 리츠부동산인프라',                      distRate: 0.67, m1:  7.48, m3: 10.32, m6: 17.20, m12:  25.82 },
  { ticker: '010460', name: 'ACE 코프리덥인TOP10',                         distRate: 0.60, m1:  2.14, m3:  2.63, m6:  6.99, m12:  18.21 },
  { ticker: '468380', name: 'KODEX iShares미국국채iB듀레이션액티브',       distRate: 0.60, m1: -0.25, m3:  2.33, m6:  4.72, m12:  10.39 },
  { ticker: '476800', name: 'KODEX 한국부동산리츠인프라',                   distRate: 0.59, m1:  5.46, m3:  5.69, m6: 10.37, m12:  16.08 },
];
const RET1M_TOP5 = [
  { ticker: '448100', name: 'WON 200',                  ret: 23.46, distRate: 0.06, m1: 23.46, m3: 33.99, m6:  77.48, m12: 201.36 },
  { ticker: '495230', name: 'KoAct 코리아밸류업액티브', ret: 22.87, distRate: 0.20, m1: 22.87, m3: 35.79, m6:  82.51, m12: 206.80 },
  { ticker: '495850', name: 'KODEX 코리아밸류업펀드',   ret: 22.43, distRate: 0.08, m1: 22.43, m3: 36.78, m6:  84.71, m12: 204.47 },
  { ticker: '495040', name: 'PLUS 코리아밸류업펀드',    ret: 22.30, distRate: 0.07, m1: 22.30, m3: 36.06, m6:  83.34, m12: 203.42 },
  { ticker: '496080', name: 'TIGER 코리아밸류업펀드',   ret: 22.20, distRate: 0.09, m1: 22.20, m3: 36.32, m6:  84.04, m12: 203.47 },
];
const RET12M_TOP5 = [
  { ticker: '495230', name: 'KoAct 코리아밸류업액티브', ret: 206.80, distRate: 0.20, m1: 22.87, m3: 35.79, m6:  82.51, m12: 206.80 },
  { ticker: '495850', name: 'KODEX 코리아밸류업펀드',   ret: 204.47, distRate: 0.08, m1: 22.43, m3: 36.78, m6:  84.71, m12: 204.47 },
  { ticker: '495050', name: 'RISE 코리아밸류업펀드',    ret: 203.95, distRate: 0.09, m1: 21.80, m3: 36.42, m6:  83.37, m12: 203.95 },
  { ticker: '496080', name: 'TIGER 코리아밸류업펀드',   ret: 203.47, distRate: 0.09, m1: 22.20, m3: 36.32, m6:  84.04, m12: 203.47 },
  { ticker: '495040', name: 'PLUS 코리아밸류업펀드',    ret: 203.26, distRate: 0.07, m1: 22.30, m3: 36.06, m6:  83.34, m12: 203.26 },
];
const AUM_TOP10 = [
  { ticker: '458580', name: 'KODEX CD금리액티브(합성)',               aum: '43,834,916만', distRate: 0.22, m1:  0.22, m3:  0.68, m6:  1.38, m12:  2.69 },
  { ticker: '423160', name: 'KODEX KOFR금리액티브(합성)',             aum: '43,814,136만', distRate: 0.22, m1:  0.21, m3:  0.64, m6:  1.29, m12:  2.61 },
  { ticker: '—',      name: 'TIGER 미국배당다우존스',                 aum: '—',            distRate: 0.30, m1: -0.61, m3:  9.81, m6: 20.12, m12: 28.10 },
  { ticker: '461050', name: 'KODEX CD1년금리액티브스탁액션(합성)',     aum: '2,837,140만',  distRate: 0.23, m1:  0.23, m3:  0.70, m6:  1.42, m12:  2.75 },
  { ticker: '161510', name: 'PLUS 자사주매입&배당주',                 aum: '2,283,355만',  distRate: 0.31, m1:  5.25, m3: 16.21, m6: 37.42, m12: 87.71 },
  { ticker: '214980', name: 'KODEX 단기채권PLUS',                     aum: '2,813,195만',  distRate: 0.23, m1:  0.23, m3:  0.68, m6:  1.07, m12:  2.06 },
  { ticker: '453850', name: 'ACE 미국30년국채액티브(H)',               aum: '1,868,939만',  distRate: 0.35, m1:  0.67, m3:-12.44, m6: -4.10, m12:  0.73 },
  { ticker: '329200', name: 'TIGER 리츠부동산인프라',                  aum: '1,871,209만',  distRate: 0.67, m1:  7.48, m3: 10.32, m6: 17.20, m12: 25.82 },
  { ticker: '284430', name: 'KODEX 200국채혼합',                       aum: '1,863,434만',  distRate: 0.10, m1:  8.74, m3: 15.31, m6: 21.91, m12: 62.36 },
  { ticker: '448330', name: 'KODEX 삼성전자채권혼합블룸버그',          aum: '1,811,749만',  distRate: 0.19, m1:  8.11, m3: 11.36, m6: 21.09, m12: 43.09 },
];
const SIM_DATA = [
  { label: '현금성\n(달러)', rate: 0.31, monthly: 31 },
  { label: '현금성\n(국내)', rate: 0.24, monthly: 24 },
  { label: '채권',          rate: 0.34, monthly: 34 },
  { label: '인컴',          rate: 0.21, monthly: 21 },
  { label: '배당주식',      rate: 0.25, monthly: 25 },
  { label: '리츠',          rate: 0.19, monthly: 19 },
  { label: '국내주식',      rate: 0.43, monthly: 43 },
  { label: 'SCHD',          rate: 0.33, monthly: 33 },
  { label: '커버드콜',      rate: 0.28, monthly: 28 },
];

function Etf14Tab() {
  const [cat, setCat] = useState<'dist'|'cash_kr'|'cash_usd'|'domestic'|'schd'|'reits'|'aum'|'ret1m'|'ret12m'|'sim'>('dist');
  const p = (v: number | null) => v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
  const pc = (v: number | null) => v == null ? 'var(--text-tertiary)' : v > 0 ? 'var(--color-profit)' : v < 0 ? 'var(--color-loss)' : 'var(--text-secondary)';

  const CATS = [
    { key: 'dist',     label: '분배율 TOP5' },
    { key: 'cash_kr',  label: '현금성(국내)' },
    { key: 'cash_usd', label: '현금성(달러)' },
    { key: 'domestic', label: '국내주식' },
    { key: 'schd',     label: '한국형SCHD' },
    { key: 'reits',    label: '리츠' },
    { key: 'aum',      label: '시가총액 TOP10' },
    { key: 'ret1m',    label: '1개월 수익률' },
    { key: 'ret12m',   label: '1년 수익률' },
    { key: 'sim',      label: '1억 시뮬레이션' },
  ] as const;

  function EtfTable({ rows }: { rows: EtfRow[] }) {
    return (
      <div className="toss-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="toss-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-secondary)' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left',  color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>종목명</th>
                <th style={{ padding: '8px 8px',  textAlign: 'right', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600, whiteSpace: 'nowrap' }}>분배율</th>
                <th style={{ padding: '8px 8px',  textAlign: 'right', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600, whiteSpace: 'nowrap' }}>1개월</th>
                <th style={{ padding: '8px 8px',  textAlign: 'right', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600, whiteSpace: 'nowrap' }}>3개월</th>
                <th style={{ padding: '8px 8px',  textAlign: 'right', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600, whiteSpace: 'nowrap' }}>6개월</th>
                <th style={{ padding: '8px 8px',  textAlign: 'right', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600, whiteSpace: 'nowrap' }}>12개월</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e, i) => (
                <tr key={e.ticker + i} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{e.name}</div>
                    {e.ticker !== '—' && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-quaternary)' }}>{e.ticker}</div>}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--color-profit)', whiteSpace: 'nowrap' }}>
                    {e.distRate != null ? `${e.distRate.toFixed(2)}%` : '—'}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: pc(e.m1),  whiteSpace: 'nowrap' }}>{p(e.m1)}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: pc(e.m3),  whiteSpace: 'nowrap' }}>{p(e.m3)}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: pc(e.m6),  whiteSpace: 'nowrap' }}>{p(e.m6)}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: pc(e.m12), whiteSpace: 'nowrap' }}>{p(e.m12)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 헤더 */}
      <div style={{ marginBottom: 16, padding: '12px 16px',
        background: 'linear-gradient(135deg, #0d9488, #059669)', borderRadius: 10, color: '#fff' }}>
        <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 2 }}>2026년 04월 28일 기준</div>
        <div style={{ fontSize: 16, fontWeight: 800 }}>월배당 ETF 4월말 성과분석</div>
        <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>분배금 및 분배율 그리고 총수익률 · 115개 (커버드콜 제외)</div>
      </div>

      {/* 카테고리 탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {CATS.map(c => (
          <button key={c.key}
            onClick={() => setCat(c.key)}
            style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${cat === c.key ? '#0d9488' : 'var(--border-primary)'}`,
              background: cat === c.key ? '#0d9488' : 'var(--bg-secondary)',
              color: cat === c.key ? '#fff' : 'var(--text-secondary)',
            }}
          >{c.label}</button>
        ))}
      </div>

      {/* 분배율 TOP5 (전체) */}
      {cat === 'dist' && (
        <>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 10 }}>
            커버드콜 제외 115개 중 월 분배율 상위 5개
          </div>
          <EtfTable rows={DIST_TOP5} />
        </>
      )}

      {cat === 'cash_kr'  && <><div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 10 }}>현금성자산 국내 월 분배율 TOP5</div><EtfTable rows={CAT_CASH_KR} /></>}
      {cat === 'cash_usd' && <><div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 10 }}>현금성자산 달러 월 분배율 TOP2</div><EtfTable rows={CAT_CASH_USD} /></>}
      {cat === 'domestic' && <><div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 10 }}>국내주식 월 분배율 TOP5</div><EtfTable rows={CAT_DOMESTIC} /></>}
      {cat === 'schd'     && <><div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 10 }}>한국형SCHD 월 분배율 TOP5</div><EtfTable rows={CAT_SCHD} /></>}
      {cat === 'reits'    && <><div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 10 }}>리츠 월 분배율 TOP5 (3월말 기준)</div><EtfTable rows={CAT_REITS} /></>}

      {/* 시가총액 TOP10 */}
      {cat === 'aum' && (
        <>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 10 }}>시가총액 순위 TOP10</div>
          <div className="toss-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="toss-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-secondary)' }}>
                    <th style={{ padding: '8px 6px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600, width: 28 }}>#</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left',  color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>종목명</th>
                    <th style={{ padding: '8px 8px',  textAlign: 'right', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600, whiteSpace: 'nowrap' }}>시가총액</th>
                    <th style={{ padding: '8px 8px',  textAlign: 'right', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600, whiteSpace: 'nowrap' }}>분배율</th>
                    <th style={{ padding: '8px 8px',  textAlign: 'right', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600, whiteSpace: 'nowrap' }}>1개월</th>
                    <th style={{ padding: '8px 8px',  textAlign: 'right', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600, whiteSpace: 'nowrap' }}>12개월</th>
                  </tr>
                </thead>
                <tbody>
                  {AUM_TOP10.map((e, i) => (
                    <tr key={e.ticker + i} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                      <td style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 700, fontSize: 'var(--text-xs)',
                        color: i < 3 ? ['#f59e0b','#94a3b8','#cd7f32'][i] : 'var(--text-tertiary)' }}>{i + 1}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{e.name}</div>
                        {e.ticker !== '—' && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-quaternary)' }}>{e.ticker}</div>}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: 'var(--text-xs)' }}>{e.aum}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--color-profit)', whiteSpace: 'nowrap' }}>{e.distRate.toFixed(2)}%</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: pc(e.m1),  whiteSpace: 'nowrap' }}>{p(e.m1)}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: pc(e.m12), whiteSpace: 'nowrap' }}>{p(e.m12)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 1개월 수익률 TOP5 */}
      {cat === 'ret1m' && (
        <>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 10 }}>1개월 총수익률 TOP5 — 밸류업 ETF 강세</div>
          <div className="toss-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="toss-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-secondary)' }}>
                    <th style={{ padding: '8px 6px',  textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600, width: 28 }}>#</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left',   color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>종목명</th>
                    <th style={{ padding: '8px 8px',  textAlign: 'right',  color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600, whiteSpace: 'nowrap' }}>1개월 수익률</th>
                    <th style={{ padding: '8px 8px',  textAlign: 'right',  color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600, whiteSpace: 'nowrap' }}>분배율</th>
                    <th style={{ padding: '8px 8px',  textAlign: 'right',  color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600, whiteSpace: 'nowrap' }}>12개월</th>
                  </tr>
                </thead>
                <tbody>
                  {RET1M_TOP5.map((e, i) => (
                    <tr key={e.ticker} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                      <td style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 700, fontSize: 'var(--text-xs)',
                        color: i < 3 ? ['#f59e0b','#94a3b8','#cd7f32'][i] : 'var(--text-tertiary)' }}>{i + 1}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{e.name}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-quaternary)' }}>{e.ticker}</div>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, color: 'var(--color-profit)', whiteSpace: 'nowrap', fontSize: 'var(--text-base)' }}>+{e.ret.toFixed(2)}%</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{e.distRate.toFixed(2)}%</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: pc(e.m12), whiteSpace: 'nowrap' }}>{p(e.m12)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 1년 수익률 TOP5 */}
      {cat === 'ret12m' && (
        <>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 6 }}>1년 총수익률 TOP5 — 코리아밸류업 ETF 석권</div>
          <div style={{ padding: '8px 12px', background: '#0d948818', border: '1px solid #0d948844', borderRadius: 8, fontSize: 'var(--text-xs)', color: '#0d9488', marginBottom: 10 }}>
            💬 밸류업이란? PBR·ROE·배당수익률 등에서 코스피200 대비 우수한 상장기업 100개로 구성
          </div>
          <div className="toss-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="toss-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-secondary)' }}>
                    <th style={{ padding: '8px 6px',  textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600, width: 28 }}>#</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left',   color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>종목명</th>
                    <th style={{ padding: '8px 8px',  textAlign: 'right',  color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600, whiteSpace: 'nowrap' }}>1년 수익률</th>
                    <th style={{ padding: '8px 8px',  textAlign: 'right',  color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600, whiteSpace: 'nowrap' }}>분배율</th>
                    <th style={{ padding: '8px 8px',  textAlign: 'right',  color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600, whiteSpace: 'nowrap' }}>1개월</th>
                  </tr>
                </thead>
                <tbody>
                  {RET12M_TOP5.map((e, i) => (
                    <tr key={e.ticker} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                      <td style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 700, fontSize: 'var(--text-xs)',
                        color: i < 3 ? ['#f59e0b','#94a3b8','#cd7f32'][i] : 'var(--text-tertiary)' }}>{i + 1}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{e.name}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-quaternary)' }}>{e.ticker}</div>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, color: 'var(--color-profit)', whiteSpace: 'nowrap', fontSize: 'var(--text-base)' }}>+{e.ret.toFixed(2)}%</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{e.distRate.toFixed(2)}%</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: pc(e.m1), whiteSpace: 'nowrap' }}>{p(e.m1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 1억 시뮬레이션 */}
      {cat === 'sim' && (
        <>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 10 }}>
            각 기초자산별 동일비중으로 1억원 매수 시 월 평균 분배금 비교
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 8, marginBottom: 16 }}>
            {SIM_DATA.map(s => (
              <div key={s.label} className="toss-card" style={{ padding: '12px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4, whiteSpace: 'pre-line', lineHeight: 1.3 }}>{s.label}</div>
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 800, color: 'var(--color-profit)', marginBottom: 2 }}>월 {s.monthly}만</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>분배율 {s.rate.toFixed(2)}%</div>
              </div>
            ))}
          </div>
          <div style={{ padding: '14px 18px', background: 'linear-gradient(135deg, #0d9488, #059669)', borderRadius: 10, textAlign: 'center', color: '#fff' }}>
            <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>전 카테고리 평균 월 배당금</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>월 286,667원 예상</div>
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>1억원 동일비중 투자 기준</div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── 미국주식형 커버드콜 탭 ───────────────────────────────────────────────
const US_AUM_TOP5 = [
  { rank: 1, ticker: '441640', exDay: '월중', name: 'KODEX 미국배당프리미엄액티브',               aum: '1,255,460만' },
  { rank: 2, ticker: '486290', exDay: '월말', name: 'TIGER 미국나스닥100타겟데일리커버드콜',      aum: '1,244,258만' },
  { rank: 3, ticker: '494300', exDay: '월말', name: 'TIGER 미국나스닥100커버드콜OTM',             aum: '8,014억' },
  { rank: 4, ticker: '483280', exDay: '월말', name: 'KODEX 미국S&P500TOP10타겟커버드콜',          aum: '5,922억' },
  { rank: 5, ticker: '482730', exDay: '월말', name: 'TIGER 미국S&P500타겟위클리커버드콜',         aum: '5,721억' },
];
const US_RET12_TOP5 = [
  { rank: 1, ticker: '480040', exDay: '월중', name: 'ACE 미국빅테크7+채권혼합리츠커버드콜(합성)', ret: 152.79 },
  { rank: 2, ticker: '490590', exDay: '월말', name: 'RISE 미국AI빅테크균형인컴리츠정커버드콜',   ret: 101.79 },
  { rank: 3, ticker: '493810', exDay: '월중', name: 'TIGER 미국AI시대핵심30+타겟데일리커버드콜', ret:  60.25 },
  { rank: 4, ticker: '480020', exDay: '월중', name: 'ACE 미국빅테크7+데일리리츠커버드콜(합성)',  ret:  59.61 },
  { rank: 5, ticker: '483280', exDay: '월말', name: 'KODEX 미국S&P500TOP10타겟커버드콜',         ret:  59.08 },
];
const US_RET1M_TOP5 = [
  { rank: 1, ticker: '480040', exDay: '월중', name: 'ACE 미국빅테크7+채권혼합리츠커버드콜(합성)', ret: 27.26 },
  { rank: 2, ticker: '490590', exDay: '월말', name: 'RISE 미국AI빅테크균형인컴리츠정커버드콜',   ret: 21.90 },
  { rank: 3, ticker: '483280', exDay: '월말', name: 'KODEX 미국S&P500TOP10타겟커버드콜',         ret: 14.51 },
  { rank: 4, ticker: '493810', exDay: '월중', name: 'TIGER 미국AI시대핵심30+타겟데일리커버드콜', ret: 13.64 },
  { rank: 5, ticker: '491620', exDay: '월말', name: 'RISE 미국테크100타겟데일리고정커버드콜',    ret: 11.82 },
];

function Us2026Tab() {
  const rankColor = (r: number) => r === 1 ? '#f59e0b' : r === 2 ? '#94a3b8' : r === 3 ? '#cd7f32' : 'var(--text-tertiary)';
  const sectionStyle: React.CSSProperties = { marginBottom: 28 };
  const headStyle: React.CSSProperties = { fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 };
  const badge = (label: string) => (
    <span style={{ background: '#1d4ed822', color: '#1d4ed8', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{label}</span>
  );
  const insightBox = (text: string) => (
    <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 10 }}>{text}</div>
  );

  return (
    <div>
      {/* 헤더 */}
      <div style={{ marginBottom: 24, padding: '16px 18px', background: 'linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%)', borderRadius: 12, color: '#fff' }}>
        <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 4 }}>월배당 ETF 성과분석 — 미국주식형 커버드콜 4월 분배금</div>
        <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.3, marginBottom: 4 }}>2026년 04월 상승국면</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#fde68a', lineHeight: 1.4 }}>미국주식형 커버드콜 ETF<br />성과 및 투자전략</div>
      </div>

      {/* 02 시가총액 TOP5 */}
      <div style={sectionStyle}>
        <div style={headStyle}>{badge('02')} 4월 미국 주식형 커버드콜 ETF 시가총액 TOP5</div>
        {insightBox('💡 종목을 혼합하면 한달에 두번 받는 배당 포트폴리오 구성 가능')}
        <div className="toss-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="toss-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-secondary)' }}>
                  <th style={{ padding: '8px 8px',  textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600, width: 28 }}>#</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left',   color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>종목명</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right',  color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600, whiteSpace: 'nowrap' }}>시가총액</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600, whiteSpace: 'nowrap' }}>배당기준일</th>
                </tr>
              </thead>
              <tbody>
                {US_AUM_TOP5.map(e => (
                  <tr key={e.ticker} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, fontSize: 'var(--text-xs)', color: rankColor(e.rank) }}>{e.rank}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{e.name}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-quaternary)' }}>{e.ticker}</div>
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{e.aum}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{e.exDay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 03 1년 총수익률 TOP5 */}
      <div style={sectionStyle}>
        <div style={headStyle}>{badge('03')} 미국 주식형 커버드콜 성과 : 1년 총수익률 비교</div>
        {insightBox('📈 상승장에서는 옵션 매도비중을 낮추고, 프리미엄을 크게 수취하는 전략이 총수익률 관점에서 유리')}
        <div className="toss-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="toss-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-secondary)' }}>
                  <th style={{ padding: '8px 8px',  textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600, width: 28 }}>#</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left',   color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>종목명</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right',  color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600, whiteSpace: 'nowrap' }}>1년 수익률</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600, whiteSpace: 'nowrap' }}>배당기준일</th>
                </tr>
              </thead>
              <tbody>
                {US_RET12_TOP5.map(e => (
                  <tr key={e.ticker} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, fontSize: 'var(--text-xs)', color: rankColor(e.rank) }}>{e.rank}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{e.name}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-quaternary)' }}>{e.ticker}</div>
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 800, color: 'var(--color-profit)', fontSize: 'var(--text-base)', whiteSpace: 'nowrap' }}>+{e.ret.toFixed(2)}%</td>
                    <td style={{ padding: '10px 10px', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{e.exDay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 04 1개월 수익률 TOP5 */}
      <div style={sectionStyle}>
        <div style={headStyle}>{badge('04')} 미국 주식형 커버드콜 성과 : 1개월 수익률 비교</div>
        {insightBox('⚡ 강세장에서는 옵션 매도 비중이 낮거나 만기가 짧은 데일리·위클리 옵션 커버드콜이 상승 참여에 유리')}
        <div className="toss-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="toss-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-secondary)' }}>
                  <th style={{ padding: '8px 8px',  textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600, width: 28 }}>#</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left',   color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>종목명</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right',  color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600, whiteSpace: 'nowrap' }}>1개월 수익률</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600, whiteSpace: 'nowrap' }}>배당기준일</th>
                </tr>
              </thead>
              <tbody>
                {US_RET1M_TOP5.map(e => (
                  <tr key={e.ticker} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, fontSize: 'var(--text-xs)', color: rankColor(e.rank) }}>{e.rank}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{e.name}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-quaternary)' }}>{e.ticker}</div>
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 800, color: 'var(--color-profit)', fontSize: 'var(--text-base)', whiteSpace: 'nowrap' }}>+{e.ret.toFixed(2)}%</td>
                    <td style={{ padding: '10px 10px', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{e.exDay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 오늘의 원픽 */}
      <div style={sectionStyle}>
        <div style={headStyle}>
          <span style={{ background: '#f59e0b22', color: '#f59e0b', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>PICK</span>
          오늘의 원픽 — 해외주식형 커버드콜 ETF
        </div>
        <div className="toss-card" style={{ padding: '18px 20px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: 'var(--text-base)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
            ACE 미국반도체데일리타겟커버드콜(합성)
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
            1개월 수익률 상위권 · 미국 반도체 섹터 기반 데일리 커버드콜 전략
          </div>
        </div>
      </div>

      {/* 인사이트 */}
      <div style={sectionStyle}>
        <div style={headStyle}>
          <span style={{ background: '#7c3aed22', color: '#7c3aed', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>인사이트</span>
          포트폴리오 구성 & 세금
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* 자산 배분 */}
          <div className="toss-card" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>다양한 기초자산의 혼합</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 12 }}>안전자산 + 시장대표지수 + 커버드콜 혼합이 좋다</div>
            {[
              { label: '안전자산',          ratio: 30, color: '#10b981' },
              { label: '시장 대표지수',      ratio: 35, color: '#1d4ed8' },
              { label: '시장 대표지수 커버드콜', ratio: 35, color: '#7c3aed' },
            ].map(item => (
              <div key={item.label} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{item.label}</span>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: item.color }}>{item.ratio}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--border-primary)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${item.ratio}%`, background: item.color, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
          {/* 세금 */}
          <div className="toss-card" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>국내상장 해외ETF 커버드콜 세금</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 12 }}>💡 절세계좌에서 매수하는 것이 유리</div>
            {[
              { label: '매매차익',    desc: 'Min(매매차익, 과표증분) × 15.4%',   color: '#f97316' },
              { label: '주식배당',    desc: 'Min(현금분배금, 과표증분) × 15.4%', color: '#1d4ed8' },
              { label: '옵션프리미엄', desc: '국내주식형과 다름, 별도 확인 필요',  color: '#7c3aed' },
            ].map(item => (
              <div key={item.label} style={{ padding: '8px 10px', marginBottom: 6, background: 'var(--bg-secondary)', borderRadius: 6, borderLeft: `3px solid ${item.color}` }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: item.color, marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
        <MIcon name="info" size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
        본 자료는 투자 권유가 아니며 참고 목적으로만 활용하시기 바랍니다. 수익률은 과거 기준으로 미래 수익을 보장하지 않습니다.
      </div>
    </div>
  );
}

// ─── 4월 ETF 성과 탭 ─────────────────────────────────────────────────────
function Apr2026Tab() {
  const pct = (v: number | null | undefined) => v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
  const pc = (v: number | null | undefined) => v == null ? 'var(--text-tertiary)' : v > 0 ? 'var(--color-profit)' : v < 0 ? 'var(--color-loss)' : 'var(--text-secondary)';

  type Row = { rank: number; ticker: string; name: string; val: string; m1: number; m3: number | null; m6: number | null; m12: number | null };

  const dist5: Row[] = [
    { rank: 1, ticker: '475720', name: 'TIGER 배당커버드콜액티브',            val: '2.56%', m1: 24.04, m3: 35.32, m6: 71.21, m12: 150.57 },
    { rank: 2, ticker: '0094M0', name: 'RISE 코리아밸류업위클리고정커버드콜', val: '2.05%', m1: 18.70, m3: 28.42, m6: 63.96, m12: null },
    { rank: 3, ticker: '498030', name: 'RISE 200위클리커버드콜',              val: '1.73%', m1: 17.26, m3: 17.57, m6: 40.11, m12: 106.29 },
    { rank: 4, ticker: '489030', name: 'PLUS 고배당주위클리커버드콜',         val: '1.51%', m1: -1.48, m3: -0.21, m6: 4.67,  m12: 12.05 },
    { rank: 5, ticker: '498400', name: 'KODEX 200타겟위클리커버드콜',         val: '1.49%', m1: 22.12, m3: 31.09, m6: 65.21, m12: 156.49 },
  ];
  const aum5: Row[] = [
    { rank: 1, ticker: '498400', name: 'KODEX 200타겟위클리커버드콜',                    val: '4,436,719만', m1: 22.12, m3: 31.09, m6: 65.21, m12: 156.49 },
    { rank: 2, ticker: '472150', name: 'TIGER 배당커버드콜액티브',                       val: '1,531,969만', m1: 24.04, m3: 35.32, m6: 71.21, m12: 150.57 },
    { rank: 3, ticker: '475720', name: 'RISE 200위클리커버드콜',                         val: '9,015만',     m1: 17.26, m3: 17.57, m6: 40.11, m12: 106.29 },
    { rank: 4, ticker: '498410', name: 'KODEX 금융우대TOP10이자위클리커버드콜',           val: '7,405만',     m1: 2.16,  m3: 8.93,  m6: 15.83, m12: 55.58 },
    { rank: 5, ticker: '016780', name: 'SOL 200타겟위클리커버드콜',                      val: '3,977만',     m1: 22.81, m3: null,  m6: null,  m12: null },
  ];
  const ret12_5: Row[] = [
    { rank: 1, ticker: '498400', name: 'KODEX 200타겟위클리커버드콜',         val: '156.49%', m1: 22.12, m3: 31.09, m6: 65.21, m12: 156.49 },
    { rank: 2, ticker: '472150', name: 'TIGER 배당커버드콜액티브',            val: '150.57%', m1: 24.04, m3: 35.32, m6: 71.21, m12: 150.57 },
    { rank: 3, ticker: '475720', name: 'RISE 200위클리커버드콜',              val: '106.29%', m1: 17.26, m3: 17.57, m6: 40.11, m12: 106.29 },
    { rank: 4, ticker: '166400', name: 'KODEX 200프리미엄OTM',               val: '88.55%',  m1: 16.62, m3: 22.55, m6: 38.65, m12: 88.55 },
    { rank: 5, ticker: '498410', name: 'KODEX 금융우대TOP10이자위클리커버드콜', val: '55.58%', m1: 2.16,  m3: 8.93,  m6: 15.83, m12: 55.58 },
  ];
  const ret1m_5: Row[] = [
    { rank: 1, ticker: '472150', name: 'TIGER 배당커버드콜액티브',            val: '24.04%', m1: 24.04, m3: 35.32, m6: 71.21, m12: 150.57 },
    { rank: 2, ticker: '0104N0', name: 'KODEX 200타겟위클리커버드콜 (신)',    val: '23.48%', m1: 23.48, m3: 33.48, m6: 33.74, m12: 74.02 },
    { rank: 3, ticker: '016780', name: 'SOL 200타겟위클리커버드콜',           val: '22.81%', m1: 22.81, m3: null,  m6: null,  m12: null },
    { rank: 4, ticker: '498400', name: 'KODEX 200타겟위클리커버드콜',         val: '22.12%', m1: 22.12, m3: 31.09, m6: 65.21, m12: 156.49 },
    { rank: 5, ticker: '0094M0', name: 'RISE 코리아밸류업위클리고정커버드콜', val: '18.70%', m1: 18.70, m3: 28.42, m6: 63.96, m12: null },
  ];

  function Top5Table({ rows, valLabel }: { rows: Row[]; valLabel: string }) {
    return (
      <div style={{ overflowX: 'auto' }}>
        <table className="toss-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-secondary)' }}>
              <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', width: 32 }}>#</th>
              <th style={{ padding: '8px 12px', textAlign: 'left',   fontWeight: 600, color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>종목명</th>
              <th style={{ padding: '8px 10px', textAlign: 'right',  fontWeight: 600, color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>{valLabel}</th>
              <th style={{ padding: '8px 10px', textAlign: 'right',  fontWeight: 600, color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>1개월</th>
              <th style={{ padding: '8px 10px', textAlign: 'right',  fontWeight: 600, color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>3개월</th>
              <th style={{ padding: '8px 10px', textAlign: 'right',  fontWeight: 600, color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>6개월</th>
              <th style={{ padding: '8px 10px', textAlign: 'right',  fontWeight: 600, color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>12개월</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.ticker + r.rank} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                <td style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 700,
                  color: r.rank === 1 ? '#f59e0b' : r.rank === 2 ? '#94a3b8' : r.rank === 3 ? '#cd7f32' : 'var(--text-tertiary)',
                  fontSize: 'var(--text-sm)' }}>{r.rank}</td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>{r.name}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-quaternary)' }}>{r.ticker}</div>
                </td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--color-profit)', whiteSpace: 'nowrap' }}>{r.val}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600, color: pc(r.m1),  whiteSpace: 'nowrap' }}>{pct(r.m1)}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600, color: pc(r.m3),  whiteSpace: 'nowrap' }}>{pct(r.m3)}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600, color: pc(r.m6),  whiteSpace: 'nowrap' }}>{pct(r.m6)}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600, color: pc(r.m12), whiteSpace: 'nowrap' }}>{pct(r.m12)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const sectionStyle: React.CSSProperties = { marginBottom: 28 };
  const headStyle: React.CSSProperties = {
    fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-secondary)',
    marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
  };
  const insightStyle: React.CSSProperties = {
    padding: '10px 14px', background: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)', borderRadius: 8,
    fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.7,
    marginBottom: 10,
  };

  return (
    <div>
      {/* 헤더 */}
      <div style={{ marginBottom: 24, padding: '16px 18px',
        background: 'linear-gradient(135deg, #0d9488 0%, #059669 100%)',
        borderRadius: 12, color: '#fff' }}>
        <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, marginBottom: 4 }}>
          월배당 ETF 성과분석 — 국내주식형 커버드콜 4월 분배금
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.3, marginBottom: 4 }}>
          2026년 04월 상승국면
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4, color: '#fde68a' }}>
          국내주식형 커버드콜 월배당ETF<br />성과 및 투자전략
        </div>
        <div style={{ marginTop: 10, fontSize: 11, opacity: 0.75 }}>
          26년 4월말 기준 · 국내 주식형 커버드콜 ETF 14개
        </div>
      </div>

      {/* 01 분배율 TOP5 */}
      <div style={sectionStyle}>
        <div style={headStyle}>
          <span style={{ background: '#0d948822', color: '#0d9488', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>01</span>
          4월 국내 주식형 커버드콜 ETF 분배율 TOP5
        </div>
        <div style={insightStyle}>
          🏆 분배율 1위 — TIGER 배당커버드콜액티브 (2.56%)
        </div>
        <div className="toss-card" style={{ padding: 0, overflow: 'hidden' }}>
          <Top5Table rows={dist5} valLabel="분배율" />
        </div>
      </div>

      {/* 02 시가총액 TOP5 */}
      <div style={sectionStyle}>
        <div style={headStyle}>
          <span style={{ background: '#0d948822', color: '#0d9488', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>02</span>
          4월 국내 주식형 커버드콜 ETF 시가총액 TOP5
        </div>
        <div style={insightStyle}>
          💡 종목을 겸할하면 한달에 두번 받는 배당 포트폴리오 구성 가능
        </div>
        <div className="toss-card" style={{ padding: 0, overflow: 'hidden' }}>
          <Top5Table rows={aum5} valLabel="시가총액" />
        </div>
      </div>

      {/* 03 1년 총수익률 TOP5 */}
      <div style={sectionStyle}>
        <div style={headStyle}>
          <span style={{ background: '#0d948822', color: '#0d9488', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>03</span>
          1년 총수익률 TOP5
        </div>
        <div style={insightStyle}>
          📈 상승장에서는 옵션 매도비중을 낮추고, 프리미엄을 크게 수취하는 전략이 총수익률 관점에서 유리
        </div>
        <div className="toss-card" style={{ padding: 0, overflow: 'hidden' }}>
          <Top5Table rows={ret12_5} valLabel="1년 수익률" />
        </div>
      </div>

      {/* 04 1개월 수익률 TOP5 */}
      <div style={sectionStyle}>
        <div style={headStyle}>
          <span style={{ background: '#0d948822', color: '#0d9488', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>04</span>
          1개월 수익률 TOP5
        </div>
        <div style={insightStyle}>
          ⚡ 강세장에서는 옵션 매도 비중이 낮거나 만기가 짧은 데일리·위클리 옵션 커버드콜이 상승 참여에 유리
        </div>
        <div className="toss-card" style={{ padding: 0, overflow: 'hidden' }}>
          <Top5Table rows={ret1m_5} valLabel="1개월 수익률" />
        </div>
      </div>

      {/* 오늘의 원픽 */}
      <div style={sectionStyle}>
        <div style={headStyle}>
          <span style={{ background: '#f59e0b22', color: '#f59e0b', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>PICK</span>
          오늘의 원픽 — TIGER 배당커버드콜액티브
        </div>
        <div className="toss-card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>
            🔍 TIGER 배당커버드콜액티브 ETF 알아보기
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', marginBottom: 14, fontSize: 'var(--text-sm)' }}>
            <span style={{ fontWeight: 700, color: 'var(--color-warning)', whiteSpace: 'nowrap' }}>운용전략</span>
            <span style={{ color: 'var(--text-secondary)' }}>배당성장주 투자와 액티브 커버드콜 전략으로 자산의 안정적 우상향 추구</span>
            <span style={{ fontWeight: 700, color: 'var(--color-warning)', whiteSpace: 'nowrap' }}>향후 운용계획</span>
            <span style={{ color: 'var(--text-secondary)' }}>중시 상승 추세는 유효해 보이나, 단기 변동성에 유의하며 운용할 계획</span>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 8 }}>🎯 투자포인트</div>
          {[
            '배당과 자사주 매입 등 주주환원을 확대하는 배당성장주에 선별적으로 투자',
            '주식 시장 대비 낮은 변동성과 높은 배당 수익률 추구',
            '시장 상황에 맞는 액티브한 커버드콜 전략으로 안정적인 현금 흐름 추구',
          ].map((pt, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              <span style={{ color: '#0d9488', fontWeight: 700, flexShrink: 0 }}>▪</span>
              <span>{pt}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 투자 인사이트 */}
      <div style={sectionStyle}>
        <div style={headStyle}>
          <span style={{ background: '#6366f122', color: '#6366f1', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>인사이트</span>
          포트폴리오 구성 & 세금
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* 자산 배분 */}
          <div className="toss-card" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>다양한 기초자산의 혼합</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 12 }}>안전자산 + 시장대표지수 + 커버드콜 혼합이 좋다</div>
            {[
              { label: '안전자산', ratio: 30, color: '#10b981' },
              { label: '시장 대표지수', ratio: 35, color: '#3b82f6' },
              { label: '시장 대표지수 커버드콜', ratio: 35, color: '#0d9488' },
            ].map(item => (
              <div key={item.label} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{item.label}</span>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: item.color }}>{item.ratio}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--border-primary)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${item.ratio}%`, background: item.color, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
          {/* 세금 */}
          <div className="toss-card" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>커버드콜 ETF와 세금</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 12 }}>국내주식형 커버드콜 ETF 세금 구조</div>
            {[
              { label: '매매차익', desc: 'Min(매매차익, 과표증분) × 15.4%', color: '#f97316' },
              { label: '주식배당', desc: 'Min(현금분배금, 과표증분) × 15.4%', color: '#3b82f6' },
              { label: '옵션프리미엄', desc: '비과세', color: '#10b981' },
            ].map(item => (
              <div key={item.label} style={{ padding: '8px 10px', marginBottom: 6, background: 'var(--bg-secondary)', borderRadius: 6, borderLeft: `3px solid ${item.color}` }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: item.color, marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8,
        fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
        <MIcon name="info" size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
        본 자료는 투자 권유가 아니며 참고 목적으로만 활용하시기 바랍니다. 수익률은 과거 기준으로 미래 수익을 보장하지 않습니다.
      </div>
    </div>
  );
}

// ─── 일드맥스 수익률 분석 탭 ───────────────────────────────────────────────
function YieldMaxAnalysisTab() {
  const EX_RATE = 1380;
  const TAX = 0.85;

  type YmPos = {
    name: string; ticker: string; qty: number;
    avgPrice: number; currentPrice: number;
    totalDivPerShare: number;
    holdLabel: string; divBasis: string;
  };

  const jyPos: YmPos[] = [
    { name: 'TSLY', ticker: 'TSLY', qty: 30,  avgPrice: 31.96,  currentPrice: 31.34, totalDivPerShare: 27.91,   holdLabel: '~1년',   divBasis: '연배당 89% 기준' },
    { name: 'NVDY', ticker: 'NVDY', qty: 70,  avgPrice: 14.66,  currentPrice: 14.08, totalDivPerShare: 9.59,    holdLabel: '~1년',   divBasis: '연배당 68% 기준' },
    { name: 'CONY', ticker: 'CONY', qty: 40,  avgPrice: 43.00,  currentPrice: 27.19, totalDivPerShare: 181.02,  holdLabel: '23개월', divBasis: 'Jun-24 이력 합산' },
    { name: 'MSTY', ticker: 'MSTY', qty: 10,  avgPrice: 109.21, currentPrice: 26.75, totalDivPerShare: 131.997, holdLabel: '18개월', divBasis: 'Nov-24 이력 합산' },
    { name: 'PLTY', ticker: 'PLTY', qty: 15,  avgPrice: 52.30,  currentPrice: 34.70, totalDivPerShare: 43.95,   holdLabel: '~1년',   divBasis: '연배당 127% 기준' },
    { name: 'ULTY', ticker: 'ULTY', qty: 15,  avgPrice: 62.42,  currentPrice: 32.03, totalDivPerShare: 37.09,   holdLabel: '~1년',   divBasis: '연배당 116% 기준' },
  ];

  const obPos: YmPos[] = [
    { name: 'TSLY', ticker: 'TSLY', qty: 108, avgPrice: 29.70,  currentPrice: 31.34, totalDivPerShare: 27.91,   holdLabel: '~1년',   divBasis: '연배당 89% 기준' },
    { name: 'NVDY', ticker: 'NVDY', qty: 114, avgPrice: 13.41,  currentPrice: 14.08, totalDivPerShare: 9.59,    holdLabel: '~1년',   divBasis: '연배당 68% 기준' },
    { name: 'CONY', ticker: 'CONY', qty: 37,  avgPrice: 26.67,  currentPrice: 27.19, totalDivPerShare: 10.04,   holdLabel: '5개월',  divBasis: 'Dec-25 이력 합산' },
    { name: 'MSTY', ticker: 'MSTY', qty: 29,  avgPrice: 26.21,  currentPrice: 26.75, totalDivPerShare: 7.27,    holdLabel: '4개월',  divBasis: 'Jan-26 이력 합산' },
    { name: 'PLTY', ticker: 'PLTY', qty: 12,  avgPrice: 35.98,  currentPrice: 34.70, totalDivPerShare: 43.95,   holdLabel: '~1년',   divBasis: '연배당 127% 기준' },
  ];

  function calc(p: YmPos) {
    const invested = p.avgPrice * p.qty;
    const capitalPnL = (p.currentPrice - p.avgPrice) * p.qty;
    const netDiv = p.totalDivPerShare * p.qty * TAX;
    const totalPnL = capitalPnL + netDiv;
    const ret = (totalPnL / invested) * 100;
    const navPct = ((p.currentPrice - p.avgPrice) / p.avgPrice) * 100;
    return { invested, capitalPnL, netDiv, totalPnL, ret, navPct };
  }

  function sumCalc(positions: YmPos[]) {
    return positions.reduce((acc, p) => {
      const c = calc(p);
      return {
        invested: acc.invested + c.invested,
        capitalPnL: acc.capitalPnL + c.capitalPnL,
        netDiv: acc.netDiv + c.netDiv,
        totalPnL: acc.totalPnL + c.totalPnL,
      };
    }, { invested: 0, capitalPnL: 0, netDiv: 0, totalPnL: 0 });
  }

  const fUSD = (n: number, showSign = true) => {
    const abs = Math.abs(n);
    const sign = showSign ? (n >= 0 ? '+' : '-') : '';
    if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  };
  const fKRW = (usd: number) => {
    const krw = usd * EX_RATE;
    const abs = Math.abs(krw);
    const sign = krw >= 0 ? '+' : '-';
    if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(1)}억`;
    if (abs >= 10_000) return `${sign}${Math.round(abs / 10_000)}만`;
    return `${sign}${Math.round(abs).toLocaleString('ko-KR')}원`;
  };
  const fPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
  const col = (n: number) => n >= 0 ? 'var(--color-profit)' : 'var(--color-loss)';

  const jySum = sumCalc(jyPos);
  const obSum = sumCalc(obPos);
  const totalInvested = jySum.invested + obSum.invested;
  const totalNetDiv   = jySum.netDiv    + obSum.netDiv;
  const totalCapPnL   = jySum.capitalPnL + obSum.capitalPnL;
  const totalPnL      = jySum.totalPnL  + obSum.totalPnL;
  const totalRet      = (totalPnL / totalInvested) * 100;
  const jyRet = (jySum.totalPnL / jySum.invested) * 100;
  const obRet = (obSum.totalPnL / obSum.invested) * 100;

  const thSt: React.CSSProperties = {
    padding: '8px 10px', color: 'var(--text-tertiary)',
    fontWeight: 600, fontSize: 'var(--text-xs)', whiteSpace: 'nowrap',
  };

  function PosTable({ label, positions, accent }: { label: string; positions: YmPos[]; accent: string }) {
    const s = sumCalc(positions);
    const sRet = (s.totalPnL / s.invested) * 100;
    return (
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-secondary)',
          marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ background: accent + '22', color: accent, borderRadius: 4,
            padding: '2px 9px', fontSize: 'var(--text-base)', fontWeight: 700 }}>{label}</span>
          <span style={{ color: col(sRet), fontWeight: 800, fontSize: 'var(--text-lg)' }}>{fPct(sRet)}</span>
        </div>
        <div className="toss-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-secondary)' }}>
                  <th style={{ ...thSt, textAlign: 'left' }}>ETF</th>
                  <th style={{ ...thSt, textAlign: 'right' }}>매입→현재</th>
                  <th style={{ ...thSt, textAlign: 'right' }}>자본손익</th>
                  <th style={{ ...thSt, textAlign: 'right' }}>세후 배당</th>
                  <th style={{ ...thSt, textAlign: 'right' }}>총 P&amp;L</th>
                  <th style={{ ...thSt, textAlign: 'right' }}>수익률</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => {
                  const c = calc(p);
                  return (
                    <tr key={p.ticker + String(p.qty)} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                      <td style={{ padding: '10px 10px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>{p.name}</div>
                        <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-quaternary)' }}>{p.qty}주 · {p.holdLabel}</div>
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-base)' }}>${p.avgPrice.toFixed(2)}</div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>${p.currentPrice.toFixed(2)}</div>
                        <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: col(c.navPct) }}>{fPct(c.navPct)}</div>
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', whiteSpace: 'nowrap',
                        color: col(c.capitalPnL), fontWeight: 600 }}>
                        {fUSD(c.capitalPnL)}
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ color: 'var(--color-profit)', fontWeight: 700 }}>{fUSD(c.netDiv)}</div>
                        <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-quaternary)' }}>{p.divBasis}</div>
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ color: col(c.totalPnL), fontWeight: 700 }}>{fUSD(c.totalPnL)}</div>
                        <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-quaternary)' }}>{fKRW(c.totalPnL)}</div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap',
                        fontWeight: 800, fontSize: 'var(--text-base)', color: col(c.ret) }}>
                        {fPct(c.ret)}
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border-primary)' }}>
                  <td colSpan={2} style={{ padding: '10px 10px', fontWeight: 700,
                    color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>합계</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', whiteSpace: 'nowrap',
                    color: col(s.capitalPnL), fontWeight: 700 }}>{fUSD(s.capitalPnL)}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', whiteSpace: 'nowrap',
                    color: 'var(--color-profit)', fontWeight: 700 }}>{fUSD(s.netDiv)}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ color: col(s.totalPnL), fontWeight: 800 }}>{fUSD(s.totalPnL)}</div>
                    <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-quaternary)' }}>{fKRW(s.totalPnL)}</div>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap',
                    fontWeight: 800, fontSize: 'var(--text-base)', color: col(sRet) }}>{fPct(sRet)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  const insightList = [
    { icon: '🚀', color: '#10b981', title: '지윤 CONY — 슈퍼사이클 타이밍의 힘 (+321%)',
      body: '2024년 Coinbase(COIN)이 $50→$300+ 폭등하며 옵션 변동성이 극단적으로 상승. 이 기간 CONY는 월 $16~28/주 분배 — 매입가 $43의 37~65%를 한 달에 현금 수령. NAV -37% 하락했지만 23개월 누적 배당 $181/주가 이를 압도.' },
    { icon: '⚠️', color: '#ef4444', title: 'ULTY — 유일한 경고등 (+2%)',
      body: 'NAV -49% 훼손이 배당을 거의 상쇄 → 1년 기준 총수익 +2%에 불과. ULTY는 복수 YieldMax ETF 중첩 구조로 장기 NAV 감소 속도가 가장 빠름. 추가 보유보다 교체 검토가 필요한 시점.' },
    { icon: '📊', color: '#3182f6', title: '"NAV 하락 = 손실"은 틀린 프레임',
      body: '지윤 NAV 손실 합계 -$2,236(-34%)이지만 배당 포함 총수익은 +113%. 이미 받은 배당은 확정이지만 향후 동일 분배율은 보장 없음. 기초자산(TSLA·NVDA·COIN·MSTR)의 내재변동성이 핵심 변수.' },
    { icon: '💡', color: '#f59e0b', title: '오빠 포지션이 리스크-대비-수익 우수',
      body: '낮은 매입가 덕분에 자본손익이 대부분 플러스. TSLY +85%, PLTY +100%, NVDY +66%. 지윤은 고점 매수(CONY $43, MSTY $109)로 NAV 훼손이 컸지만, CONY의 압도적 배당으로 전체 수익률은 오히려 더 높음.' },
  ];

  return (
    <div>
      {/* 헤더 */}
      <div style={{ marginBottom: 24, padding: '16px 18px',
        background: 'linear-gradient(135deg, #7c3aed 0%, #1d4ed8 100%)',
        borderRadius: 12, color: '#fff' }}>
        <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, opacity: 0.85, marginBottom: 4 }}>
          YieldMax ETF 수익률 분석 · 배당금 + 주가손익 합산
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.3, marginBottom: 4 }}>
          일드맥스 총수익률
        </div>
        <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: '#fde68a', lineHeight: 1.5 }}>
          NAV가 빠져도 배당 포함 실제 수익은?
        </div>
        <div style={{ marginTop: 10, fontSize: 'var(--text-base)', opacity: 0.75 }}>
          2026.05.09 기준 · 환율 1,380원 · 미국 원천세 15% 적용
        </div>
      </div>

      {/* 면책 고지 */}
      <div style={{ padding: '10px 14px', background: '#7c3aed11',
        border: '1px solid #7c3aed33', borderRadius: 8,
        fontSize: 'var(--text-xs)', color: 'var(--text-secondary)',
        lineHeight: 1.7, marginBottom: 20 }}>
        ⚠️ <strong>추정 기반 계산:</strong> 구입 시점은 평균매입가를 실제 배당 이력과 대조해 역산한 추정치입니다.
        CONY·MSTY는 전체 배당 이력을 합산하고, TSLY·NVDY·PLTY·ULTY는 연간 배당수익률 × 보유기간 적용.
        실제 수익률과 차이가 있을 수 있습니다.
      </div>

      {/* 양가 합산 요약 */}
      <div className="toss-card" style={{ padding: '18px 18px', marginBottom: 28 }}>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)',
          fontWeight: 600, marginBottom: 14 }}>양가 합산 · YieldMax 총수익</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
          {[
            { label: '총 투자원금',   val: fUSD(totalInvested, false), sub: fKRW(totalInvested).replace('+',''), c: 'var(--text-primary)' },
            { label: '세후 배당 수령', val: fUSD(totalNetDiv),          sub: fKRW(totalNetDiv),                   c: 'var(--color-profit)' },
            { label: '총수익률',      val: fPct(totalRet),             sub: `P&L ${fUSD(totalPnL)}`,             c: col(totalRet) },
          ].map(item => (
            <div key={item.label} style={{ textAlign: 'center',
              padding: '10px 6px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
              <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: item.c }}>{item.val}</div>
              <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-quaternary)', marginTop: 2 }}>{item.sub}</div>
            </div>
          ))}
        </div>
        {/* 개인별 수익률 바 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { name: '지윤', ret: jyRet, pnl: jySum.totalPnL, color: '#7c3aed' },
            { name: '오빠', ret: obRet, pnl: obSum.totalPnL, color: '#1d4ed8' },
          ].map(p => (
            <div key={p.name} style={{ padding: '10px 12px', borderRadius: 8,
              border: `1px solid ${p.color}44`, background: p.color + '0a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: p.color }}>{p.name}</span>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 800, color: col(p.ret) }}>{fPct(p.ret)}</span>
              </div>
              <div style={{ height: 5, background: 'var(--border-primary)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, Math.abs(p.ret))}%`,
                  background: p.color, borderRadius: 3 }} />
              </div>
              <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', marginTop: 4, textAlign: 'right' }}>
                P&L {fUSD(p.pnl)} ({fKRW(p.pnl)})
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 지윤 포지션 */}
      <PosTable label="지윤 (6개 포지션)" positions={jyPos} accent="#7c3aed" />

      {/* 오빠 포지션 */}
      <PosTable label="오빠 (5개 포지션)" positions={obPos} accent="#1d4ed8" />

      {/* 수익 구조 분해 */}
      <div className="toss-card" style={{ padding: '16px 18px', marginBottom: 24 }}>
        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700,
          color: 'var(--text-secondary)', marginBottom: 12 }}>수익 구조 분해 (양가 합산)</div>
        {[
          { label: 'NAV 자본손익', val: totalCapPnL, pct: (totalCapPnL / totalInvested) * 100, color: '#ef4444' },
          { label: '세후 배당 수령', val: totalNetDiv, pct: (totalNetDiv / totalInvested) * 100, color: '#10b981' },
          { label: '최종 총수익',   val: totalPnL,    pct: totalRet,                             color: '#3182f6' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', padding: '8px 0',
            borderBottom: '1px solid var(--border-primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%',
                background: item.color, flexShrink: 0 }} />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{item.label}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: col(item.val) }}>
                {fUSD(item.val)}
              </span>
              <span style={{ fontSize: 'var(--text-base)', color: col(item.pct), marginLeft: 6 }}>
                ({fPct(item.pct)})
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 인사이트 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700,
          color: 'var(--text-tertiary)', marginBottom: 10 }}>핵심 인사이트</div>
        {insightList.map(item => (
          <div key={item.title} className="toss-card" style={{ padding: '14px 16px', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 'var(--text-base)' }}>{item.icon}</span>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: item.color }}>{item.title}</span>
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{item.body}</div>
          </div>
        ))}
      </div>

      {/* 면책 */}
      <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8,
        fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
        <MIcon name="info" size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
        본 자료는 투자 권유가 아닙니다. 구입 시점 추정 기반이며 실제 수익률과 다를 수 있습니다.
        한국 해외금융계좌·종합소득세 신고는 별도 확인이 필요합니다.
      </div>
    </div>
  );
}

// ─── AI 의견 탭 ────────────────────────────────────────────────────────────
function AiOpinionTab() {
  const [livePrice, setLivePrice] = useState<Record<string, { price: number; changeRate: number }>>({});
  const [priceLoading, setPriceLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const PORTFOLIO_TICKERS = ['498400', '472150', '475720', '211900', '0036D0', '329200', '480040', '483280', '486290', '458580'];

  const loadLivePrices = useCallback(async () => {
    setPriceLoading(true);
    try {
      const data = await fetchCurrentPricesWithChange(PORTFOLIO_TICKERS);
      setLivePrice(data);
      setLastUpdated(new Date());
    } catch { /* silent */ } finally { setPriceLoading(false); }
  }, []);

  useEffect(() => { loadLivePrices(); }, [loadLivePrices]);

  const curMonthly = 130;  // 현재 월 배당 추산 (만원)
  const target = 700;      // 목표 (만원)
  const cashExtra = 131;   // 유휴현금 전환 시 추가 배당 (만원)
  const afterCash = curMonthly + cashExtra; // 261만원

  const gap = target - afterCash; // 439만원
  // 1.5%/월 블렌드 기준 필요 추가 원금
  const addCapNeeded = Math.round(gap / 0.015 / 100) * 100; // 2.9억

  const bd = (label: string, color: string) => (
    <span style={{ background: color + '22', color, borderRadius: 4,
      padding: '2px 8px', fontSize: 'var(--text-base)', fontWeight: 700 }}>{label}</span>
  );

  const entryBadge = (status: 'good' | 'caution' | 'wait') => {
    const map = {
      good:    { label: '✅ 진입 가능',  color: '#059669', bg: '#05966918' },
      caution: { label: '⚠️ 신중 검토', color: '#d97706', bg: '#d9770618' },
      wait:    { label: '🔴 조정 대기', color: '#dc2626', bg: '#dc262618' },
    };
    const m = map[status];
    return (
      <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: m.color,
        background: m.bg, padding: '2px 7px', borderRadius: 4, whiteSpace: 'nowrap' }}>
        {m.label}
      </span>
    );
  };

  const buckets: {
    label: string; ratio: number; color: string; desc: string; entryTiming: string;
    etfs: { name: string; ticker: string; monthly: string; ret1m: string; ret1y: string;
            note: string; entry: 'good' | 'caution' | 'wait'; entryNote: string; }[];
  }[] = [
    {
      label: '핵심 인컴', ratio: 55, color: '#0d9488',
      desc: '국내주식형 커버드콜 ETF · 월 분배 주력',
      entryTiming: 'KOSPI200이 52주 레인지 하위 40% 이하이거나, 최근 1개월 수익이 +5% 미만일 때가 최적. 급등 직후에는 NAV 고점 위험 — 분배율이 높아도 일시적 조정 가능.',
      etfs: [
        { name: 'KODEX 200타겟위클리커버드콜', ticker: '498400', monthly: '1.49%', ret1m: '+22.1%', ret1y: '+156%', note: 'AUM 4.4조 1위 · 주간분배',   entry: 'wait',    entryNote: '4월 급등 +22% → 5~10% 조정 후 분할 매수' },
        { name: 'TIGER 배당커버드콜액티브',    ticker: '472150', monthly: '2.56%', ret1m: '+24.0%', ret1y: '+151%', note: '분배율 1위 · 월중 배당기준일', entry: 'wait',    entryNote: '4월 급등 +24% → 분배락 후 하락 시 진입' },
        { name: 'RISE 200위클리커버드콜',      ticker: '498030', monthly: '1.73%', ret1m: '+17.3%', ret1y: '+106%', note: '분배율+수익 균형 · 위클리',    entry: 'caution', entryNote: '4월 +17% → 20일 이평 근처에서 신중 분할' },
      ],
    },
    {
      label: '배당 성장', ratio: 25, color: '#3182f6',
      desc: '배당+성장 균형 · 장기 원금 보전',
      entryTiming: '분배율이 역사적 평균 이상이거나 기초자산 조정 후 반등 초입이 최적. 장기 보유 목적이므로 시기에 관계없이 분할 매수 전략이 유효.',
      etfs: [
        { name: 'KODEX 코리아배당성장', ticker: '211900', monthly: '1.43%', ret1m: '+8.0%',  ret1y: '+102%', note: '성장+분배 동시 · 코스피 배당주',  entry: 'caution', entryNote: '4월 +8% → KOSPI 조정 시 우선 진입' },
        { name: 'TIME 미국배당다우존스액티브', ticker: '0036D0', monthly: '0.48%', ret1m: '+5.73%', ret1y: '신규',  note: 'SCHD형 액티브 · 분배율 0.48%/월 · 총보수 연 0.80%',  entry: 'caution', entryNote: '4월 +5.73%(월배당 1위) → 단기 급등, 소폭 조정 후 분할 진입 권장' },
        { name: 'TIGER 리츠부동산인프라', ticker: '329200', monthly: '0.67%', ret1m: '+7.5%', ret1y: '+26%', note: '월배당 부동산 인컴 · 국내 리츠', entry: 'caution', entryNote: '4월 +7.5% → 금리 인하 기대 국면에 유리' },
      ],
    },
    {
      label: '인컴 부스터', ratio: 15, color: '#7c3aed',
      desc: '미국형 커버드콜 (국내상장) · 비중 15% 이하',
      entryTiming: '나스닥/S&P500 조정 후 반등 초입이 최적. 기술주 급등 후에는 옵션 프리미엄 수취 폭이 축소되어 분배율 하락. 15% 한도 내 분할 편입.',
      etfs: [
        { name: 'ACE 미국빅테크7+채권혼합리츠커버드콜(합성)', ticker: '480040', monthly: '~1.2%', ret1m: '+27.3%', ret1y: '+153%', note: '1년 수익 1위 · M7+채권+리츠 혼합', entry: 'wait',    entryNote: '4월 급등 +27% → 10% 이상 조정 후 진입' },
        { name: 'KODEX 미국S&P500TOP10타겟커버드콜',          ticker: '483280', monthly: '~0.9%', ret1m: '+14.5%', ret1y: '+59%',  note: 'AUM 4위 · S&P500 TOP10 집중',    entry: 'caution', entryNote: '4월 +14.5% → 나스닥 안정 확인 후 분할' },
        { name: 'TIGER 미국나스닥100타겟데일리커버드콜',      ticker: '486290', monthly: '~1.5%', ret1m: '—',      ret1y: '—',     note: 'AUM 2위 · 데일리 옵션 매도',    entry: 'caution', entryNote: '나스닥 조정 구간에서 우선 편입' },
      ],
    },
    {
      label: '방어/현금성', ratio: 5, color: '#94a3b8',
      desc: '단기채권·금 · 변동성 완충',
      entryTiming: '상시 편입 가능. 파킹 목적으로 언제든 진입. 시장 급락 시 방어 역할 + 추가 매수 재원 확보.',
      etfs: [
        { name: 'KODEX CD금리액티브(합성)', ticker: '458580', monthly: '0.22%', ret1m: '+0.2%', ret1y: '+2.7%', note: 'AUM 4.4조 · CD금리 추종 · 파킹형', entry: 'good', entryNote: '상시 진입 가능 · 원금 보존' },
        { name: 'ACE KRX금현물',            ticker: '—',      monthly: '—',     ret1m: '—',     ret1y: '—',     note: '금 현물 · 인플레·위기 헤지',     entry: 'good', entryNote: '5% 이내 상시 보유 · 분산 목적' },
      ],
    },
  ];

  const roadmap = [
    {
      step: 1, period: '즉시 실행', color: '#10b981', goal: '~261만원/월',
      delta: '+131만원',
      actions: [
        'ISA 현금 3,881만 → TIGER 배당커버드콜액티브(472150) 2,000만 + KODEX 200타겟위클리커버드콜(498400) 1,881만 → +79만/월',
        '연금저축 현금 845만 → KODEX 200타겟위클리커버드콜(498400) 500만 + 코리아배당성장(211900) 345만 → +12만/월',
        '퇴직연금 현금 1,210만 → 위험 70%(KODEX 200타겟위클리커버드콜) + 안전 30%(CD금리(458580)) → +13만/월',
      ],
      note: '신규 자금 없이 유휴 현금만 활용',
    },
    {
      step: 2, period: '3~6개월', color: '#3182f6', goal: '~350만원/월',
      delta: '+90만원',
      actions: [
        '기업DC 성장형 일부 → KODEX 200타겟위클리커버드콜(498400) 전환',
        '월 100~200만원 정기 적립 시작 (TIGER 배당커버드콜액티브(472150) 우선)',
        'ULTY 전량 매도 → TIGER 배당커버드콜액티브(472150) 교체 → 월 +9만원 개선',
      ],
      note: '포트폴리오 리밸런싱 중심',
    },
    {
      step: 3, period: '1~2년', color: '#7c3aed', goal: '~500만원/월',
      delta: '+150만원',
      actions: [
        '배당 재투자 복리 본격화 (월 배당금 전액 같은 ETF 재매수)',
        '추가 자금 1~1.5억 → 핵심인컴(KODEX 200타겟위클리커버드콜·TIGER 배당커버드콜액티브) 집중',
        'ISA 연 납입한도(4,000만) 최대 활용 · 비과세 혜택 극대화',
      ],
      note: '1~1.5억 추가 자금 필요',
    },
    {
      step: 4, period: '3~5년', color: '#f59e0b', goal: '700만원/월',
      delta: '+200만원',
      actions: [
        '총 인컴 자산 8~10억원 규모 달성',
        '핵심인컴 55% + 배당성장 25% + 인컴부스터 15% + 방어 5%',
        '연금저축·퇴직연금 개시 병행 시 달성 현실화',
      ],
      note: '총 추가 자금 2.5~3억 누적 필요',
    },
  ];

  const accStrategy = [
    { label: 'ISA (지윤)', balance: '현금 3,881만', color: '#10b981',
      tip: '비과세 혜택으로 분배금 전액 수령. TIGER 배당커버드콜액티브(472150) 2,000만 → +51만/월, KODEX 200타겟위클리커버드콜(498400) 1,881만 → +28만/월. 합산 즉시 +79만/월 추가.' },
    { label: '연금저축 (오빠)', balance: '현금 845만', color: '#3182f6',
      tip: '연 400만 납입 → 세액공제 최대 66만원 환급. KODEX 200타겟위클리커버드콜(498400) 500만 → +7.5만/월, 코리아배당성장(211900) 345만 → +4.9만/월. 분배금 과세이연으로 복리 극대화.' },
    { label: '퇴직연금 DC/IRP', balance: '현금 1,523만', color: '#7c3aed',
      tip: 'DC·IRP 안전자산 30% 의무 → KODEX CD금리액티브(합성)(458580) 충당. 나머지 70% → KODEX 200타겟위클리커버드콜(498400). ISA·연금 소진 후 잉여 자금은 인컴부스터(480040) 편입.' },
    { label: '일반 계좌', balance: '–', color: '#f59e0b',
      tip: '분배금 15.4% 원천징수. 손익통산으로 양도손실 상계 활용. 절세 계좌 한도 소진 후 ACE 미국빅테크7+커버드콜(합성)(480040) 또는 RISE 200위클리커버드콜(498030) 추가 편입.' },
  ];

  const risks = [
    { icon: '📉', label: 'ULTY 교체 우선순위', desc: '연 수익률 +2%로 가장 낮음. TIGER 배당커버드콜액티브(472150) 또는 KODEX 200타겟위클리커버드콜(498400)로 교체 시 월 +약 9만원 개선. 즉시 실행 권장.' },
    { icon: '🔄', label: 'KOSPI200 커버드콜 집중도 분산', desc: '현 보유 KODEX 200타겟위클리커버드콜(498400) 1,699주 집중. KOSPI200 하락 시 분배율 급락 가능. TIGER 배당커버드콜액티브(472150)·RISE 200위클리커버드콜(498030) 분산 병행 권장.' },
    { icon: '💱', label: '국내상장 미국ETF 환율 노출', desc: '인컴부스터 편입 미국형 ETF(480040·483280 등)는 원화 NAV 변동. 환헤지(H) 여부 반드시 확인. 달러 약세 국면에서 비헤지 상품 분배금 원화 감소.' },
    { icon: '📅', label: '월중·월말 분배일 혼합 전략', desc: '월중 배당(TIGER 배당커버드콜액티브(472150)·ACE 계열)과 월말 배당(KODEX 200타겟위클리커버드콜(498400)·RISE 계열) 혼합 시 한 달에 두 번 현금 유입 → 생활비 흐름 개선.' },
  ];

  return (
    <div>
      {/* 헤더 */}
      <div style={{ marginBottom: 24, padding: '16px 18px',
        background: 'linear-gradient(135deg, #059669 0%, #0d9488 50%, #0369a1 100%)',
        borderRadius: 12, color: '#fff' }}>
        <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, opacity: 0.85, marginBottom: 4 }}>
          월 700만원 배당 달성 전략 · AI 분석
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.3, marginBottom: 4 }}>
          어떻게 투자하면 좋을까?
        </div>
        <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: '#fde68a', lineHeight: 1.5 }}>
          4월 ETF 성과 + 보유 종목 분석 기반<br />포트폴리오 구성 AI 제안
        </div>
        <div style={{ marginTop: 10, fontSize: 'var(--text-base)', opacity: 0.75 }}>
          2026.05.09 기준 · 투자 권유 아님 · 참고 목적
        </div>
      </div>

      {/* 현황 진단 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700,
          color: 'var(--text-secondary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          {bd('현황 진단', '#059669')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
          {[
            { label: '현재 월 배당', val: `${curMonthly}만원`, sub: '배당/인컴 자산 기준', c: 'var(--text-primary)' },
            { label: '목표 월 배당', val: `${target}만원`, sub: '연 8,400만원', c: '#f59e0b' },
            { label: '갭', val: `-${target - curMonthly}만원`, sub: '추가 필요 배당', c: 'var(--color-loss)' },
          ].map(item => (
            <div key={item.label} style={{ textAlign: 'center',
              padding: '12px 8px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
              <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: item.c }}>{item.val}</div>
              <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-quaternary)', marginTop: 2 }}>{item.sub}</div>
            </div>
          ))}
        </div>
        {/* 진행도 바 */}
        <div style={{ padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)' }}>현재 달성률</span>
            <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: '#059669' }}>{Math.round((curMonthly / target) * 100)}%</span>
          </div>
          <div style={{ height: 8, background: 'var(--border-primary)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
            <div style={{ height: '100%', width: `${(curMonthly / target) * 100}%`,
              background: 'linear-gradient(90deg, #059669, #0d9488)', borderRadius: 4 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-quaternary)' }}>0원</span>
            <span style={{ fontSize: 'var(--text-base)', color: '#f59e0b', fontWeight: 700 }}>목표 700만원</span>
          </div>
        </div>
      </div>

      {/* 즉시 실행 가능 액션 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700,
          color: 'var(--text-secondary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          {bd('즉시 실행', '#10b981')}
          <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)' }}>신규 투자 없이 유휴 현금만 활용</span>
        </div>
        <div style={{ padding: '12px 14px', background: '#10b98111',
          border: '1px solid #10b98133', borderRadius: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: '#10b981', marginBottom: 8 }}>
            💡 현재 유휴 현금 합계 약 7,145만원 → 배당형 ETF 전환 시
          </div>
          {[
            { acc: 'ISA (지윤)', cash: '3,881만원', target2: 'TIGER 배당커버드콜액티브(472150)', rate: '2.56%/월', add: '+99만원/월', color: '#10b981' },
            { acc: '오빠 연금저축', cash: '845만원', target2: 'KODEX 200타겟위클리커버드콜(498400)', rate: '1.49%/월', add: '+13만원/월', color: '#3182f6' },
            { acc: '퇴직연금 합산', cash: '~1,210만원', target2: 'KODEX 200타겟위클리커버드콜(498400)', rate: '~1.5%/월', add: '+18만원/월', color: '#7c3aed' },
            { acc: '기타 현금', cash: '~1,209만원', target2: 'CD금리(458580) → TIGER 배당커버드콜액티브(472150)', rate: '~1.0%/월', add: '+12만원/월', color: '#f59e0b' },
          ].map(row => (
            <div key={row.acc} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 0', borderBottom: '1px solid var(--border-primary)' }}>
              <div>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>{row.acc}</span>
                <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', marginLeft: 6 }}>{row.cash} → {row.target2}({row.rate})</span>
              </div>
              <span style={{ fontSize: 'var(--text-base)', fontWeight: 800, color: row.color }}>{row.add}</span>
            </div>
          ))}
          <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--bg-secondary)',
            borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-secondary)' }}>
              현재 {curMonthly}만원 + 유휴현금 전환 {cashExtra}만원
            </span>
            <span style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: '#10b981' }}>
              = {afterCash}만원/월
            </span>
          </div>
        </div>
        <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8,
          fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          이후 700만원까지 남은 갭 <strong>{gap}만원/월</strong> → 평균 1.5%/월 ETF 기준
          추가 투자금 <strong>약 {addCapNeeded}만원</strong> 필요
        </div>
      </div>

      {/* 추천 포트폴리오 버킷 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700,
          color: 'var(--text-secondary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          {bd('추천 포트폴리오', '#0369a1')}
          <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)' }}>
            4 버킷 · {priceLoading ? '가격 조회 중...' : lastUpdated ? `실시간가 ${lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 갱신` : '4월 기준'}
          </span>
          <button
            onClick={loadLivePrices}
            disabled={priceLoading}
            style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--border-primary)',
              borderRadius: 6, padding: '3px 10px', fontSize: 'var(--text-base)', color: 'var(--text-secondary)',
              cursor: priceLoading ? 'not-allowed' : 'pointer', opacity: priceLoading ? 0.5 : 1 }}>
            {priceLoading ? '...' : '🔄 새로고침'}
          </button>
        </div>

        {/* 비율 바 범례 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          {buckets.map(b => (
            <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: b.color }} />
              <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)' }}>{b.label} {b.ratio}%</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 18 }}>
          {buckets.map(b => (
            <div key={b.label} style={{ width: `${b.ratio}%`, background: b.color }} />
          ))}
        </div>

        {/* 진입 판단 범례 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {(['good', 'caution', 'wait'] as const).map(s => (
            <span key={s}>{entryBadge(s)}</span>
          ))}
          <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', alignSelf: 'center' }}>
            · 4월 수익 기준 / {lastUpdated ? '현재가 실시간 · 목표가 자동계산' : '가격 조회 후 목표가 표시'}
          </span>
        </div>

        {/* 버킷별 카드 (전체 폭) */}
        {buckets.map(b => (
          <div key={b.label} className="toss-card" style={{ padding: '14px 16px', marginBottom: 12 }}>
            {/* 버킷 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: b.color, flexShrink: 0 }} />
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--text-primary)' }}>{b.label}</span>
              <span style={{ fontSize: 'var(--text-base)', fontWeight: 800, color: b.color }}>{b.ratio}%</span>
              <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', marginLeft: 4 }}>· {b.desc}</span>
            </div>
            {/* 진입 타이밍 */}
            <div style={{ padding: '7px 10px', background: b.color + '0d', border: `1px solid ${b.color}33`,
              borderRadius: 6, fontSize: 'var(--text-base)', color: 'var(--text-secondary)',
              lineHeight: 1.6, marginBottom: 10 }}>
              📌 <strong>최적 진입 시점:</strong> {b.entryTiming}
            </div>
            {/* ETF 테이블 */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-base)' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)' }}>
                    <th style={{ padding: '7px 10px', textAlign: 'left',   fontWeight: 600, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>종목명 (티커)</th>
                    <th style={{ padding: '7px 8px',  textAlign: 'right',  fontWeight: 600, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>월분배</th>
                    <th style={{ padding: '7px 8px',  textAlign: 'right',  fontWeight: 600, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>1개월</th>
                    <th style={{ padding: '7px 8px',  textAlign: 'right',  fontWeight: 600, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>1년</th>
                    <th style={{ padding: '7px 10px', textAlign: 'left',   fontWeight: 600, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>현재 진입 판단</th>
                  </tr>
                </thead>
                <tbody>
                  {b.etfs.map((e, i) => (
                    <tr key={e.ticker + i} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                      <td style={{ padding: '10px 10px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{e.name}</div>
                        <div style={{ color: 'var(--text-quaternary)', marginTop: 2 }}>
                          {e.ticker !== '—' ? `${e.ticker} · ` : ''}{e.note}
                        </div>
                        {e.ticker !== '—' && livePrice[e.ticker] && (() => {
                          const lp = livePrice[e.ticker];
                          const cr = lp.changeRate;
                          const p5  = Math.round(lp.price * 0.95).toLocaleString('ko-KR');
                          const p10 = Math.round(lp.price * 0.90).toLocaleString('ko-KR');
                          return (
                            <div style={{ marginTop: 5, display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                {lp.price.toLocaleString('ko-KR')}원
                              </span>
                              <span style={{ fontWeight: 600, color: cr >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                                {cr >= 0 ? '▲' : '▼'}{Math.abs(cr).toFixed(2)}%
                              </span>
                              {(e.entry === 'wait' || e.entry === 'caution') && (
                                <span style={{ color: 'var(--text-tertiary)' }}>
                                  · 목표 ①{p5} ②{p10}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--color-profit)', whiteSpace: 'nowrap' }}>{e.monthly}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600,
                        color: e.ret1m.startsWith('-') ? 'var(--color-loss)' : e.ret1m === '—' ? 'var(--text-tertiary)' : 'var(--color-profit)',
                        whiteSpace: 'nowrap' }}>{e.ret1m}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600,
                        color: e.ret1y === '—' ? 'var(--text-tertiary)' : 'var(--color-profit)',
                        whiteSpace: 'nowrap' }}>{e.ret1y}</td>
                      <td style={{ padding: '10px 10px' }}>
                        <div style={{ marginBottom: 4 }}>{entryBadge(e.entry)}</div>
                        <div style={{ color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{e.entryNote}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* 블렌드 요약 */}
        <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8,
          fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          📊 <strong>블렌드 기준 월 분배율 추산:</strong>{' '}
          핵심인컴(55%×1.8%) + 배당성장(25%×0.45%) + 부스터(15%×2.5%) + 방어(5%×0.2%)
          = <strong>약 1.51%/월 (연 18.1%)</strong>
        </div>

        {/* 진입 판단 방법론 */}
        <div className="toss-card" style={{ padding: '14px 16px', marginTop: 12 }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
            📋 진입 시점 자가 체크리스트
          </div>
          {[
            { q: '① 최근 1개월 수익이 +15% 미만인가?',         pass: '✅ 과열 아님 → 진입 가능', fail: '🔴 급등 후 → 조정 대기' },
            { q: '② 기초지수(KOSPI200·나스닥)가 52주 중간값 이하인가?', pass: '✅ 저점 구간 → 적극 매수', fail: '⚠️ 고점 구간 → 분할 매수' },
            { q: '③ 최근 3개월 분배율이 하락하지 않았는가?',    pass: '✅ 분배 안정 → 진입 검토', fail: '🔴 분배 감소 → 원인 파악 후' },
            { q: '④ 현재가가 60일 이평선 대비 ±15% 이내인가?', pass: '✅ 이평 근처 → 정상 범위',  fail: '⚠️ 이격 과다 → 회귀 대기' },
          ].map((item, i) => (
            <div key={i} style={{ padding: '8px 0', borderTop: i > 0 ? '1px solid var(--border-secondary)' : 'none' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{item.q}</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ color: '#059669' }}>{item.pass}</span>
                <span style={{ color: '#d97706' }}>{item.fail}</span>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--bg-secondary)',
            borderRadius: 6, fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
            📍 <strong>데이터 확인:</strong> 네이버금융 → 종목검색 → 차트(이동평균) + 분배금 탭 /
            KRX 정보데이터시스템(data.krx.co.kr) → 52주 고저 확인
          </div>
        </div>
      </div>

      {/* 단계별 로드맵 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700,
          color: 'var(--text-secondary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          {bd('달성 로드맵', '#f59e0b')}
        </div>
        {roadmap.map((r) => (
          <div key={r.step} style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            {/* 타임라인 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: r.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 800, fontSize: 'var(--text-base)', flexShrink: 0 }}>{r.step}</div>
              {r.step < 4 && <div style={{ width: 2, flex: 1, background: 'var(--border-primary)', margin: '4px 0' }} />}
            </div>
            {/* 내용 */}
            <div style={{ flex: 1, paddingBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: r.color }}>{r.period}</span>
                <span style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--text-primary)' }}>{r.goal}</span>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-profit)', marginLeft: 'auto' }}>{r.delta}</span>
              </div>
              <div style={{ padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 6,
                fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                {r.actions.map((a, i) => (
                  <div key={i} style={{ marginBottom: i < r.actions.length - 1 ? 4 : 0 }}>▸ {a}</div>
                ))}
                <div style={{ marginTop: 6, color: r.color, fontWeight: 600, fontSize: 'var(--text-base)' }}>
                  💬 {r.note}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 계좌별 전략 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700,
          color: 'var(--text-secondary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          {bd('계좌별 전략', '#7c3aed')}
        </div>
        {accStrategy.map(a => (
          <div key={a.label} style={{ display: 'flex', gap: 10, padding: '10px 12px', marginBottom: 8,
            background: 'var(--bg-secondary)', borderRadius: 8, borderLeft: `3px solid ${a.color}` }}>
            <div style={{ minWidth: 90 }}>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: a.color }}>{a.label}</div>
              <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)' }}>{a.balance}</div>
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{a.tip}</div>
          </div>
        ))}
      </div>

      {/* 리스크 체크 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700,
          color: 'var(--text-secondary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          {bd('리스크 체크포인트', '#ef4444')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {risks.map(r => (
            <div key={r.label} style={{ padding: '10px 12px', background: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)', borderRadius: 8 }}>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                {r.icon} {r.label}
              </div>
              <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>{r.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 면책 */}
      <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8,
        fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
        <MIcon name="info" size={15} style={{ verticalAlign: 'middle', marginRight: 4 }} />
        본 내용은 AI 분석 의견이며 투자 권유가 아닙니다. 실제 분배율은 시장 상황에 따라 변동되며,
        과거 수익률이 미래를 보장하지 않습니다. 투자 전 충분한 검토 후 결정하시기 바랍니다.
      </div>
    </div>
  );
}
