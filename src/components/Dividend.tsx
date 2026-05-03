import React, { useState, useEffect, useMemo } from "react";
import { useAppContext } from "../App";
import { MIcon } from './MIcon';
import { kvGet, kvSet } from '../api';

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
  const [activeTab, setActiveTab] = useState<"ranking" | "my">("ranking");

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
    <div style={{ padding: isMobile ? '16px' : '24px' }}>
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

      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        <button className={`toss-tab ${activeTab === 'ranking' ? 'toss-tab-active' : ''}`} onClick={() => setActiveTab('ranking')}>월배당 순위</button>
        <button className={`toss-tab ${activeTab === 'my' ? 'toss-tab-active' : ''}`} onClick={() => setActiveTab('my')}>내 배당종목</button>
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
            <div className="toss-card" style={{ padding: 20 }}>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: 8 }}>연 예상 배당 (합산)</div>
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
          <div className="toss-card" style={{ padding: 20, marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontWeight: "var(--font-medium)" }}>월 목표 배당금</span>
              <input className="toss-input" type="text" value={targetMonthly.toLocaleString('ko-KR')}
                onChange={e => setTargetMonthly(Number(e.target.value.replace(/,/g, '')) || 0)}
                style={{ width: 160, textAlign: "right", fontSize: "var(--text-sm)" }} />
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>원</span>
            </div>
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
              const candidates = rankingData.filter(r => !ownedTickers.has(r.ticker) && r.recentDividend > 0).sort((a, b) => b.annualYield - a.annualYield).slice(0, 5);
              const suggestions = candidates.map(c => ({ ...c, qtyNeeded: Math.ceil(gap / c.recentDividend), investNeeded: Math.ceil(gap / c.recentDividend) * c.price }));
              const topMix = candidates.slice(0, 3);
              const mixSuggestions = topMix.map(c => {
                const qty = Math.ceil(gap / topMix.length / c.recentDividend);
                return { name: c.name, ticker: c.ticker, qty, cost: qty * c.price, monthlyDiv: qty * c.recentDividend, yield: c.annualYield };
              });
              const mixTotalCost = mixSuggestions.reduce((s, m) => s + m.cost, 0);
              const mixTotalDiv = mixSuggestions.reduce((s, m) => s + m.monthlyDiv, 0);
              return (
                <div style={{ padding: 14, borderRadius: 10, background: 'rgba(49,130,246,0.06)', border: '1px solid rgba(49,130,246,0.15)' }}>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 8 }}>월 {fmt(gap)}원 부족 — 추천 종목</div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>단일 종목으로 채우기</div>
                    {suggestions.map(s => (
                      <div key={s.ticker} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-secondary)', fontSize: 'var(--text-xs)' }}>
                        <div><span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{s.name}</span><span style={{ color: 'var(--text-quaternary)', marginLeft: 4 }}>({s.annualYield}%)</span></div>
                        <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{s.qtyNeeded}주</span>
                          <span style={{ color: 'var(--text-tertiary)', marginLeft: 6 }}>≈ {fmt(s.investNeeded)}원</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {mixSuggestions.length >= 2 && (
                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>분산 투자로 채우기 (추천)</div>
                      {mixSuggestions.map(m => (
                        <div key={m.ticker} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', padding: '5px 0' }}>
                          <span style={{ color: 'var(--text-primary)' }}>{m.name}</span>
                          <span style={{ whiteSpace: 'nowrap' }}><span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{m.qty}주</span><span style={{ color: 'var(--text-quaternary)', marginLeft: 4 }}>({fmt(m.cost)}원, 월 {fmt(m.monthlyDiv)}원)</span></span>
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
          </div>

          {/* 월별 배당 캘린더 */}
          <div className="toss-card" style={{ padding: 20, marginBottom: 24 }}>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", color: "var(--text-primary)", margin: "0 0 16px 0" }}>월별 예상 배당금 (12개월)</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
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

          {/* 배당 종목 리스트 (계좌 보유 기준) */}
          <div className="toss-card" style={{ padding: 20, marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", color: "var(--text-primary)", margin: 0 }}>
                내 배당 종목 ({mergedStocks.length}종목)
              </h2>
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
    </div>
  );
}
