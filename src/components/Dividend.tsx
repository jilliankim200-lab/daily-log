import React, { useState, useEffect, useMemo } from "react";
import { useAppContext } from "../App";
import { DollarSign, Plus, Trash2, Edit3, Check, X, Info, Trophy, Briefcase, ExternalLink, RefreshCw } from "lucide-react";
import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const supabase = createClient(`https://${projectId}.supabase.co`, publicAnonKey);
const KV_TABLE = 'kv_store_cee564ea';

// ─── 타입 ───
interface DividendStock {
  id: string;
  name: string;
  ticker: string;
  quantity: number;
  dividendPerShare: number;
  exDividendDay: number;
  paymentDay: number;
  frequency: "monthly" | "quarterly" | "yearly";
  owner: "wife" | "husband";
}

interface RankingETF {
  rank: number;
  name: string;
  ticker: string;
  price: number;           // 현재가 (원)
  recentDividend: number;  // 최근 월 분배금 (원)
  annualYield: number;     // 연 분배율 (%)
  category: string;        // 분류
  prevMonthDiv: number;    // 전월 분배금
  recentDivDate?: string;  // 최근 배당일
  issuer?: string;         // 발행사
  netAsset?: number;       // 순자산 (억)
}

// ─── 카테고리 자동 분류 ───
function categorizeETF(name: string): string {
  if (name.includes('커버드콜') && (name.includes('S&P') || name.includes('500'))) return "S&P500 커버드콜";
  if (name.includes('커버드콜') && (name.includes('나스닥') || name.includes('테크'))) return "나스닥 커버드콜";
  if (name.includes('커버드콜') && name.includes('국채')) return "채권 프리미엄";
  if (name.includes('커버드콜') && (name.includes('배당') || name.includes('고배당'))) return "배당 커버드콜";
  if (name.includes('커버드콜')) return "커버드콜";
  if (name.includes('배당') && name.includes('다우존스')) return "배당 다우존스";
  if (name.includes('리츠') || name.includes('부동산') || name.includes('인프라')) return "리츠";
  if (name.includes('국채') || name.includes('채권') || name.includes('금리') || name.includes('KOFR') || name.includes('CD')) return "채권";
  if (name.includes('고배당') || name.includes('배당')) return "국내 고배당";
  return "기타";
}

// ─── Supabase에서 ETF 순위 로드 ───
async function fetchETFRanking(): Promise<RankingETF[] | null> {
  try {
    const { data, error } = await supabase
      .from(KV_TABLE)
      .select('value')
      .eq('key', 'etf_ranking')
      .maybeSingle();
    if (error || !data?.value?.data) return null;
    return data.value.data.map((e: any) => ({
      rank: e.rank,
      name: e.name,
      ticker: e.ticker,
      price: e.price,
      recentDividend: e.recentDividend,
      prevMonthDiv: 0,
      annualYield: e.annualYield,
      category: categorizeETF(e.name),
      recentDivDate: e.recentDivDate || '',
      issuer: e.issuer || '',
      netAsset: e.netAsset || 0,
    }));
  } catch {
    return null;
  }
}

// ─── 내 배당종목 기본 데이터 ───
const STORAGE_KEY = "dividend_stocks";
const DEFAULT_STOCKS: DividendStock[] = [
  { id: "d1", name: "TIGER 미국배당+7%프리미엄다우존스",  ticker: "458730", quantity: 0, dividendPerShare: 80,  exDividendDay: 0, paymentDay: 5, frequency: "monthly", owner: "wife" },
  { id: "d2", name: "KODEX 미국배당+10%프리미엄다우존스", ticker: "489250", quantity: 0, dividendPerShare: 100, exDividendDay: 0, paymentDay: 5, frequency: "monthly", owner: "wife" },
  { id: "d3", name: "ACE 미국배당다우존스",                ticker: "402970", quantity: 0, dividendPerShare: 38,  exDividendDay: 0, paymentDay: 5, frequency: "monthly", owner: "wife" },
  { id: "d4", name: "TIGER 은행고배당플러스TOP10",         ticker: "466940", quantity: 0, dividendPerShare: 50,  exDividendDay: 0, paymentDay: 5, frequency: "monthly", owner: "wife" },
  { id: "d5", name: "PLUS 고배당주",                       ticker: "161510", quantity: 0, dividendPerShare: 40,  exDividendDay: 0, paymentDay: 5, frequency: "monthly", owner: "husband" },
];

const STOCKS_VERSION_KEY = "dividend_stocks_version";
const CURRENT_VERSION = "v3_tabs";

function loadStocks(): DividendStock[] {
  try {
    const ver = localStorage.getItem(STOCKS_VERSION_KEY);
    if (ver === CURRENT_VERSION) {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    }
    localStorage.setItem(STOCKS_VERSION_KEY, CURRENT_VERSION);
  } catch {}
  return DEFAULT_STOCKS;
}

function saveStocks(stocks: DividendStock[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stocks));
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("ko-KR");
}

function getNextExDividendDate(exDay: number): Date {
  const now = new Date();
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

// ─── 카테고리 색상 ───
const CATEGORY_COLORS: Record<string, string> = {
  "S&P500 커버드콜": "#3182f6",
  "나스닥 커버드콜": "#7c3aed",
  "배당 다우존스": "#00b894",
  "테마 프리미엄": "#e17055",
  "테마": "#e17055",
  "채권 프리미엄": "#fdcb6e",
  "채권": "#fdcb6e",
  "달러 채권": "#0984e3",
  "멀티에셋": "#6c5ce7",
  "국내 고배당": "#d63031",
  "국내 배당": "#d63031",
  "국내": "#d63031",
  "리츠": "#00cec9",
};

// ═══════════════════════════════════════════
// 메인 컴포넌트
// ═══════════════════════════════════════════
export function Dividend() {
  const { isAmountHidden } = useAppContext();
  const [activeTab, setActiveTab] = useState<"ranking" | "my">("ranking");
  const [stocks, setStocks] = useState<DividendStock[]>(loadStocks);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<DividendStock>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStock, setNewStock] = useState<Partial<DividendStock>>({
    name: "", ticker: "", quantity: 0, dividendPerShare: 0,
    exDividendDay: 0, paymentDay: 5, frequency: "monthly", owner: "wife",
  });
  const [targetMonthly, setTargetMonthly] = useState(() => {
    const saved = localStorage.getItem("dividend_target_monthly");
    return saved ? Number(saved) : 1000000;
  });
  const [rankingData, setRankingData] = useState<RankingETF[]>([]);
  const [rankingLoading, setRankingLoading] = useState(true);
  const [rankingUpdatedAt, setRankingUpdatedAt] = useState<string>("");

  useEffect(() => {
    (async () => {
      setRankingLoading(true);
      try {
        const { data } = await supabase
          .from(KV_TABLE)
          .select('value')
          .eq('key', 'etf_ranking')
          .maybeSingle();
        if (data?.value?.data) {
          const etfs = data.value.data.map((e: any, idx: number) => ({
            rank: idx + 1,
            name: e.name,
            ticker: e.ticker,
            price: e.price,
            recentDividend: e.recentDividend,
            prevMonthDiv: 0,
            annualYield: e.annualYield,
            category: categorizeETF(e.name),
            recentDivDate: e.recentDivDate || '',
            issuer: e.issuer || '',
            netAsset: e.netAsset || 0,
          }));
          setRankingData(etfs);
          if (data.value.updatedAt) {
            setRankingUpdatedAt(new Date(data.value.updatedAt).toLocaleDateString('ko-KR'));
          }
        }
      } catch (err) {
        console.error('ETF 순위 로드 실패:', err);
      }
      setRankingLoading(false);
    })();
  }, []);

  useEffect(() => { saveStocks(stocks); }, [stocks]);
  useEffect(() => { localStorage.setItem("dividend_target_monthly", String(targetMonthly)); }, [targetMonthly]);

  const hide = (s: string) => isAmountHidden ? "••••" : s;

  const activeStocks = useMemo(() => stocks.filter(s => s.quantity > 0), [stocks]);

  const monthlyDividendData = useMemo(() => {
    const months: { month: string; total: number; details: { name: string; amount: number }[] }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const m = (now.getMonth() + i) % 12;
      const y = now.getFullYear() + Math.floor((now.getMonth() + i) / 12);
      const monthLabel = `${y}.${String(m + 1).padStart(2, "0")}`;
      const details: { name: string; amount: number }[] = [];
      let total = 0;
      for (const s of activeStocks) {
        let amount = 0;
        if (s.frequency === "monthly") amount = s.dividendPerShare * s.quantity;
        else if (s.frequency === "quarterly" && (m % 3 === 2)) amount = s.dividendPerShare * s.quantity;
        else if (s.frequency === "yearly" && m === 11) amount = s.dividendPerShare * s.quantity;
        if (amount > 0) { details.push({ name: s.name, amount }); total += amount; }
      }
      months.push({ month: monthLabel, total, details });
    }
    return months;
  }, [activeStocks]);

  const totalMonthlyEstimate = useMemo(() => {
    return activeStocks.reduce((sum, s) => {
      if (s.frequency === "monthly") return sum + s.dividendPerShare * s.quantity;
      if (s.frequency === "quarterly") return sum + (s.dividendPerShare * s.quantity) / 3;
      if (s.frequency === "yearly") return sum + (s.dividendPerShare * s.quantity) / 12;
      return sum;
    }, 0);
  }, [activeStocks]);

  const totalYearlyEstimate = totalMonthlyEstimate * 12;
  const achievementRate = targetMonthly > 0 ? Math.min((totalMonthlyEstimate / targetMonthly) * 100, 100) : 0;

  const handleStartEdit = (stock: DividendStock) => {
    setEditingId(stock.id);
    setEditForm({ quantity: stock.quantity, dividendPerShare: stock.dividendPerShare });
  };
  const handleSaveEdit = (id: string) => {
    setStocks(prev => prev.map(s => s.id === id ? { ...s, ...editForm } : s));
    setEditingId(null);
  };
  const handleDelete = (id: string) => { setStocks(prev => prev.filter(s => s.id !== id)); };
  const handleAdd = () => {
    if (!newStock.name) return;
    setStocks(prev => [...prev, {
      id: `d_${Date.now()}`, name: newStock.name || "", ticker: newStock.ticker || "",
      quantity: newStock.quantity || 0, dividendPerShare: newStock.dividendPerShare || 0,
      exDividendDay: newStock.exDividendDay || 0, paymentDay: newStock.paymentDay || 5,
      frequency: newStock.frequency || "monthly", owner: newStock.owner || "wife",
    }]);
    setNewStock({ name: "", ticker: "", quantity: 0, dividendPerShare: 0, exDividendDay: 0, paymentDay: 5, frequency: "monthly", owner: "wife" });
    setShowAddForm(false);
  };

  // 순위 → 내 종목으로 추가
  const addFromRanking = (etf: RankingETF) => {
    const exists = stocks.find(s => s.ticker === etf.ticker);
    if (exists) return;
    setStocks(prev => [...prev, {
      id: `d_${Date.now()}`, name: etf.name, ticker: etf.ticker,
      quantity: 0, dividendPerShare: etf.recentDividend,
      exDividendDay: 0, paymentDay: 5, frequency: "monthly", owner: "wife",
    }]);
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "10px 20px", border: "none", cursor: "pointer",
    fontSize: "var(--text-sm)", fontWeight: active ? 700 : 500,
    color: active ? "var(--accent-blue)" : "var(--text-tertiary)",
    background: "transparent",
    borderBottom: active ? "2px solid var(--accent-blue)" : "2px solid transparent",
    transition: "all 0.15s",
    display: "flex", alignItems: "center", gap: 6,
  });

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <DollarSign size={24} style={{ color: "var(--accent-blue)" }} />
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)", color: "var(--text-primary)", margin: 0 }}>배당</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border-primary)", marginBottom: 24 }}>
        <button style={tabStyle(activeTab === "ranking")} onClick={() => setActiveTab("ranking")}>
          <Trophy size={16} /> 월배당 순위
        </button>
        <button style={tabStyle(activeTab === "my")} onClick={() => setActiveTab("my")}>
          <Briefcase size={16} /> 내 배당종목
        </button>
      </div>

      {/* ═══ 탭1: 월배당 순위 ═══ */}
      {activeTab === "ranking" && (
        <>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
            padding: "10px 14px", background: "var(--bg-secondary)", borderRadius: 8,
            fontSize: "var(--text-xs)", color: "var(--text-tertiary)",
          }}>
            <Info size={14} style={{ flexShrink: 0 }} />
            <span>연 분배율 기준 상위 {rankingData.length}개 월배당 ETF (ETF CHECK 기준){rankingUpdatedAt && ` · ${rankingUpdatedAt} 업데이트`}</span>
          </div>

          <div className="toss-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="toss-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-primary)", background: "var(--bg-secondary)" }}>
                    {["#", "종목명", "분류", "현재가", "최근 분배금", "배당일", "연 분배율", ""].map((h, i) => (
                      <th key={i} style={{
                        padding: "12px 10px",
                        textAlign: i <= 2 ? "left" : "right",
                        color: "var(--text-tertiary)",
                        fontWeight: "var(--font-semibold)",
                        fontSize: "var(--text-xs)",
                        whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rankingLoading ? (
                    <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>로딩 중...</td></tr>
                  ) : rankingData.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>데이터가 없습니다</td></tr>
                  ) : rankingData.map((etf) => {
                    const alreadyAdded = stocks.some(s => s.ticker === etf.ticker);
                    const catColor = CATEGORY_COLORS[etf.category] || "var(--text-tertiary)";
                    return (
                      <tr key={etf.ticker} style={{ borderBottom: "1px solid var(--border-primary)" }}
                        onMouseEnter={e => e.currentTarget.style.background = "var(--bg-secondary)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "10px", textAlign: "center", color: "var(--text-quaternary)", fontWeight: "var(--font-bold)", fontSize: "var(--text-sm)", width: 36 }}>
                          {etf.rank <= 3 ? (
                            <span style={{ color: etf.rank === 1 ? "#ffd700" : etf.rank === 2 ? "#c0c0c0" : "#cd7f32", fontSize: "var(--text-base)" }}>
                              {etf.rank === 1 ? "🥇" : etf.rank === 2 ? "🥈" : "🥉"}
                            </span>
                          ) : etf.rank}
                        </td>
                        <td style={{ padding: "10px 10px" }}>
                          <a href={`https://www.tossinvest.com/stocks/A${etf.ticker}/order`}
                            target="_blank" rel="noopener noreferrer"
                            style={{ color: "var(--text-primary)", textDecoration: "none", fontWeight: "var(--font-medium)", display: "flex", alignItems: "center", gap: 4 }}>
                            {etf.name}
                            <ExternalLink size={12} style={{ opacity: 0.4, flexShrink: 0 }} />
                          </a>
                          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-quaternary)", marginTop: 2 }}>
                            {etf.ticker}{etf.issuer ? ` · ${etf.issuer}` : ''}
                          </div>
                        </td>
                        <td style={{ padding: "10px 10px" }}>
                          <span style={{
                            padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600,
                            background: `${catColor}18`, color: catColor,
                          }}>
                            {etf.category}
                          </span>
                        </td>
                        <td className="toss-number" style={{ padding: "10px 10px", textAlign: "right", color: "var(--text-primary)" }}>
                          {fmt(etf.price)}원
                        </td>
                        <td className="toss-number" style={{ padding: "10px 10px", textAlign: "right" }}>
                          <div style={{ color: "var(--accent-blue)", fontWeight: "var(--font-bold)" }}>
                            {fmt(etf.recentDividend)}원
                          </div>
                        </td>
                        <td className="toss-number" style={{ padding: "10px 10px", textAlign: "right", color: "var(--text-secondary)", fontSize: "var(--text-xs)" }}>
                          {etf.recentDivDate || '-'}
                        </td>
                        <td className="toss-number" style={{
                          padding: "10px 10px", textAlign: "right", fontWeight: "var(--font-bold)",
                          color: etf.annualYield >= 10 ? "var(--color-loss)" : etf.annualYield >= 5 ? "#fdcb6e" : "var(--text-primary)",
                        }}>
                          {etf.annualYield.toFixed(1)}%
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "right" }}>
                          <button
                            onClick={() => addFromRanking(etf)}
                            disabled={alreadyAdded}
                            style={{
                              padding: "4px 10px", borderRadius: 6, border: "none", cursor: alreadyAdded ? "default" : "pointer",
                              fontSize: 11, fontWeight: 600,
                              background: alreadyAdded ? "var(--bg-tertiary)" : "rgba(49,130,246,0.1)",
                              color: alreadyAdded ? "var(--text-quaternary)" : "var(--accent-blue)",
                              transition: "background 0.15s",
                            }}
                          >
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
            <div className="toss-card" style={{ padding: 20 }}>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: 8 }}>월 예상 배당</div>
              <div className="toss-number" style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)", color: "var(--accent-blue)" }}>
                {hide(`${fmt(totalMonthlyEstimate)}원`)}
              </div>
            </div>
            <div className="toss-card" style={{ padding: 20 }}>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: 8 }}>연 예상 배당</div>
              <div className="toss-number" style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)", color: "var(--color-profit)" }}>
                {hide(`${fmt(totalYearlyEstimate)}원`)}
              </div>
            </div>
            <div className="toss-card" style={{ padding: 20 }}>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: 8 }}>
                목표 달성률
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-quaternary)", marginLeft: 6 }}>
                  (목표: {hide(`${fmt(targetMonthly)}원/월`)})
                </span>
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
          <div className="toss-card" style={{ padding: 16, marginBottom: 24, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontWeight: "var(--font-medium)" }}>월 목표 배당금</span>
            <input className="toss-input" type="number" value={targetMonthly}
              onChange={e => setTargetMonthly(Number(e.target.value) || 0)}
              style={{ width: 160, textAlign: "right", fontSize: "var(--text-sm)" }} />
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>원</span>
          </div>

          {/* 월별 배당 캘린더 */}
          <div className="toss-card" style={{ padding: 20, marginBottom: 24 }}>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", color: "var(--text-primary)", margin: "0 0 16px 0" }}>
              월별 예상 배당금 (12개월)
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
              {monthlyDividendData.map((m) => (
                <div key={m.month} style={{
                  padding: 12, borderRadius: 10,
                  background: m.total > 0 ? "rgba(49,130,246,0.08)" : "var(--bg-secondary)",
                  border: m.total > 0 ? "1px solid rgba(49,130,246,0.2)" : "1px solid var(--border-secondary)",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginBottom: 4 }}>{m.month}</div>
                  <div className="toss-number" style={{
                    fontSize: "var(--text-sm)", fontWeight: "var(--font-bold)",
                    color: m.total > 0 ? "var(--accent-blue)" : "var(--text-quaternary)",
                  }}>
                    {m.total > 0 ? hide(`${fmt(m.total)}원`) : "—"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 배당 종목 리스트 */}
          <div className="toss-card" style={{ padding: 20, marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", color: "var(--text-primary)", margin: 0 }}>
                내 배당 종목 ({stocks.length})
              </h2>
              <button className="toss-btn-primary" style={{ fontSize: "var(--text-sm)", padding: "6px 14px", display: "flex", alignItems: "center", gap: 4 }}
                onClick={() => setShowAddForm(!showAddForm)}>
                <Plus size={14} /> 종목 추가
              </button>
            </div>

            {/* 추가 폼 */}
            {showAddForm && (
              <div style={{ padding: 16, marginBottom: 16, background: "var(--bg-secondary)", borderRadius: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                <div>
                  <label style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>종목명</label>
                  <input className="toss-input" value={newStock.name} onChange={e => setNewStock({ ...newStock, name: e.target.value })} style={{ width: "100%", fontSize: "var(--text-sm)" }} />
                </div>
                <div>
                  <label style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>티커</label>
                  <input className="toss-input" value={newStock.ticker} onChange={e => setNewStock({ ...newStock, ticker: e.target.value })} style={{ width: "100%", fontSize: "var(--text-sm)" }} />
                </div>
                <div>
                  <label style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>보유수량</label>
                  <input className="toss-input" type="number" value={newStock.quantity} onChange={e => setNewStock({ ...newStock, quantity: Number(e.target.value) })} style={{ width: "100%", fontSize: "var(--text-sm)", textAlign: "right" }} />
                </div>
                <div>
                  <label style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>주당 배당금(월)</label>
                  <input className="toss-input" type="number" value={newStock.dividendPerShare} onChange={e => setNewStock({ ...newStock, dividendPerShare: Number(e.target.value) })} style={{ width: "100%", fontSize: "var(--text-sm)", textAlign: "right" }} />
                </div>
                <div>
                  <label style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>배당주기</label>
                  <select className="toss-input" value={newStock.frequency} onChange={e => setNewStock({ ...newStock, frequency: e.target.value as any })} style={{ width: "100%", fontSize: "var(--text-sm)" }}>
                    <option value="monthly">월배당</option>
                    <option value="quarterly">분기배당</option>
                    <option value="yearly">연배당</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>소유자</label>
                  <select className="toss-input" value={newStock.owner} onChange={e => setNewStock({ ...newStock, owner: e.target.value as any })} style={{ width: "100%", fontSize: "var(--text-sm)" }}>
                    <option value="wife">지윤</option>
                    <option value="husband">오빠</option>
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
                  <button className="toss-btn-primary" style={{ fontSize: "var(--text-sm)", padding: "8px 16px" }} onClick={handleAdd}>추가</button>
                  <button className="toss-btn-ghost" style={{ fontSize: "var(--text-sm)", padding: "8px 12px" }} onClick={() => setShowAddForm(false)}>취소</button>
                </div>
              </div>
            )}

            {/* 종목 테이블 */}
            <div style={{ overflowX: "auto" }}>
              <table className="toss-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
                    {["종목명", "보유수량", "주당배당(월)", "월배당금", "배당주기", "다음 배당락", ""].map((h, i) => (
                      <th key={i} style={{
                        padding: "10px 12px", textAlign: i === 0 ? "left" : "right",
                        color: "var(--text-tertiary)", fontWeight: "var(--font-medium)",
                        fontSize: "var(--text-xs)", whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((stock) => {
                    const monthlyAmount = stock.frequency === "monthly"
                      ? stock.dividendPerShare * stock.quantity
                      : stock.frequency === "quarterly"
                      ? (stock.dividendPerShare * stock.quantity) / 3
                      : (stock.dividendPerShare * stock.quantity) / 12;
                    const nextEx = getNextExDividendDate(stock.exDividendDay);
                    const dLeft = daysUntil(nextEx);
                    const isEditing = editingId === stock.id;

                    return (
                      <tr key={stock.id} style={{
                        borderBottom: "1px solid var(--border-primary)",
                        opacity: stock.quantity === 0 ? 0.5 : 1,
                      }}>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ fontWeight: "var(--font-medium)", color: "var(--text-primary)" }}>
                            {stock.ticker ? (
                              <a href={`https://www.tossinvest.com/stocks/A${stock.ticker}/order`} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
                                {stock.name}
                              </a>
                            ) : stock.name}
                          </div>
                          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-quaternary)", marginTop: 2 }}>
                            {stock.ticker} · {stock.owner === "wife" ? "지윤" : "오빠"}
                          </div>
                        </td>
                        <td className="toss-number" style={{ padding: "10px 12px", textAlign: "right" }}>
                          {isEditing ? (
                            <input className="toss-input" type="number" value={editForm.quantity ?? stock.quantity}
                              onChange={e => setEditForm({ ...editForm, quantity: Number(e.target.value) })}
                              style={{ width: 80, textAlign: "right", fontSize: "var(--text-sm)" }} />
                          ) : fmt(stock.quantity)}
                        </td>
                        <td className="toss-number" style={{ padding: "10px 12px", textAlign: "right" }}>
                          {isEditing ? (
                            <input className="toss-input" type="number" value={editForm.dividendPerShare ?? stock.dividendPerShare}
                              onChange={e => setEditForm({ ...editForm, dividendPerShare: Number(e.target.value) })}
                              style={{ width: 80, textAlign: "right", fontSize: "var(--text-sm)" }} />
                          ) : hide(`${fmt(stock.dividendPerShare)}원`)}
                        </td>
                        <td className="toss-number" style={{
                          padding: "10px 12px", textAlign: "right",
                          color: monthlyAmount > 0 ? "var(--accent-blue)" : "var(--text-quaternary)",
                          fontWeight: "var(--font-semibold)",
                        }}>
                          {monthlyAmount > 0 ? hide(`${fmt(monthlyAmount)}원`) : "—"}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right" }}>
                          <span style={{
                            padding: "2px 8px", borderRadius: 10, fontSize: "var(--text-xs)", fontWeight: "var(--font-medium)",
                            background: stock.frequency === "monthly" ? "rgba(49,130,246,0.1)" : stock.frequency === "quarterly" ? "rgba(0,184,148,0.1)" : "rgba(253,203,110,0.1)",
                            color: stock.frequency === "monthly" ? "var(--accent-blue)" : stock.frequency === "quarterly" ? "#00b894" : "#fdcb6e",
                          }}>
                            {stock.frequency === "monthly" ? "월" : stock.frequency === "quarterly" ? "분기" : "연"}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                          {stock.quantity > 0 && (
                            <div>
                              <span style={{ color: "var(--text-primary)", fontWeight: "var(--font-medium)" }}>{formatDate(nextEx)}</span>
                              <span style={{
                                marginLeft: 6, fontSize: "var(--text-xs)",
                                color: dLeft <= 3 ? "var(--color-loss)" : dLeft <= 7 ? "#fdcb6e" : "var(--text-quaternary)",
                              }}>
                                {dLeft === 0 ? "오늘" : `${dLeft}일 후`}
                              </span>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                          {isEditing ? (
                            <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                              <button onClick={() => handleSaveEdit(stock.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-profit)", padding: 4 }}><Check size={16} /></button>
                              <button onClick={() => setEditingId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 4 }}><X size={16} /></button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                              <button onClick={() => handleStartEdit(stock)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 4 }}><Edit3 size={14} /></button>
                              <button onClick={() => handleDelete(stock.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 4 }}><Trash2 size={14} /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Info */}
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 8,
            padding: "12px 16px", background: "var(--bg-secondary)", borderRadius: 8,
            fontSize: "var(--text-xs)", color: "var(--text-tertiary)", lineHeight: 1.6,
          }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              배당금은 예상치이며 실제와 다를 수 있습니다. 주당 배당금은 최근 분배금 기준입니다.
              배당락일은 매월 마지막 영업일 기준이며, 실제 배당락일은 ETF별로 다를 수 있습니다.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
