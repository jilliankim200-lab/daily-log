import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAppContext } from "../App";
import { fetchSnapshots } from "../api";
import type { DailySnapshot } from "../types";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { MIcon } from "./MIcon";

type PeriodKey = "1w" | "1m" | "3m" | "6m" | "1y" | "all" | "2025" | "2026";

const PERIOD_TABS: { key: PeriodKey; label: string; days: number | null }[] = [
  { key: "1w", label: "1주", days: 7 },
  { key: "1m", label: "1개월", days: 30 },
  { key: "3m", label: "3개월", days: 90 },
  { key: "6m", label: "6개월", days: 180 },
  { key: "1y", label: "1년", days: 365 },
  { key: "all", label: "전체", days: null },
  { key: "2025", label: "2025", days: null },
  { key: "2026", label: "2026", days: null },
];

function generateMockSnapshots(totalAsset: number): DailySnapshot[] {
  const snapshots: DailySnapshot[] = [];
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000); // KST 기준
  const days = 90;
  let currentTotal = totalAsset * 0.85;

  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];

    const dailyChange = currentTotal * (Math.random() * 0.04 - 0.015);
    const prevTotal = currentTotal;
    currentTotal = i === 0 ? totalAsset : currentTotal + dailyChange;

    const wifeRatio = 0.45 + Math.random() * 0.1;
    const wifeAsset = Math.round(currentTotal * wifeRatio);
    const husbandAsset = Math.round(currentTotal * (1 - wifeRatio));
    const assetChange = Math.round(currentTotal - prevTotal);
    const changeRate =
      prevTotal !== 0
        ? Math.round(((currentTotal - prevTotal) / prevTotal) * 10000) / 100
        : 0;

    snapshots.push({
      date: dateStr,
      totalAsset: Math.round(currentTotal),
      wifeAsset,
      husbandAsset,
      assetChange,
      changeRate,
    });
  }

  return snapshots;
}

function formatAmount(value: number, hidden: boolean): string {
  if (hidden) return "••••";
  return Math.round(value).toLocaleString("ko-KR");
}

function formatRate(value: number, hidden: boolean): string {
  if (hidden) return "••••";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function getChangeColor(value: number): string {
  if (value > 0) return "var(--color-profit)";
  if (value < 0) return "var(--color-loss)";
  return "var(--text-secondary)";
}

function MonthlyReportModal({
  row, accounts, prices, isAmountHidden, onClose,
}: {
  row: {
    date: string; totalAsset: number; assetChange: number; changeRate: number;
    lastDividend: number; wifeChange: number; husbandChange: number;
    wifeTotal: number; husbandTotal: number; startTotal: number;
  };
  accounts: import('../types').Account[];
  prices: Record<string, number>;
  isAmountHidden: boolean;
  onClose: () => void;
}) {
  const fmt = (v: number) => isAmountHidden ? '••••' : Math.round(Math.abs(v)).toLocaleString('ko-KR');
  const fmtSigned = (v: number) => {
    if (isAmountHidden) return '••••';
    return `${v >= 0 ? '+' : '-'}${Math.round(Math.abs(v)).toLocaleString('ko-KR')}`;
  };
  const sign = (v: number) => v >= 0 ? 'var(--color-profit)' : 'var(--color-loss)';

  // 보유종목 손익 분석 (현재 시세 기준)
  const holdingAnalysis = React.useMemo(() => {
    const items: {
      ticker: string; name: string; account: string; owner: string;
      pnl: number; pnlRate: number; currentPrice: number; avgPrice: number; quantity: number;
    }[] = [];
    for (const acc of accounts) {
      for (const h of acc.holdings) {
        if (h.isFund) continue;
        const cp = prices[h.ticker] || h.avgPrice;
        const pnl = (cp - h.avgPrice) * h.quantity;
        const pnlRate = h.avgPrice ? (cp - h.avgPrice) / h.avgPrice * 100 : 0;
        items.push({
          ticker: h.ticker,
          name: h.name || h.ticker,
          account: acc.alias,
          owner: acc.owner,
          pnl, pnlRate,
          currentPrice: cp,
          avgPrice: h.avgPrice,
          quantity: h.quantity,
        });
      }
    }
    return items.sort((a, b) => a.pnl - b.pnl);
  }, [accounts, prices]);

  const losers = holdingAnalysis.filter(h => h.pnl < 0).slice(0, 5);
  const gainers = holdingAnalysis.filter(h => h.pnl > 0).slice(-5).reverse();

  // 주요 원인 텍스트 자동 생성
  const mainCause = () => {
    const wifePct = row.assetChange !== 0 ? Math.abs(row.wifeChange / row.assetChange * 100) : 50;
    const dominant = Math.abs(row.wifeChange) > Math.abs(row.husbandChange) ? '지윤' : '오빠';
    const dominantAmt = Math.abs(row.wifeChange) > Math.abs(row.husbandChange) ? row.wifeChange : row.husbandChange;
    if (row.assetChange >= 0) {
      return `이 기간 총 자산이 ${fmt(row.assetChange)}원 증가했습니다. ${dominant} 계좌가 ${fmt(dominantAmt)}원으로 주요 상승을 이끌었습니다.`;
    } else {
      const biggestLoser = losers[0];
      const causeStr = biggestLoser
        ? ` 현재 기준 손실이 가장 큰 종목은 ${biggestLoser.account}의 ${biggestLoser.name}(${fmtSigned(biggestLoser.pnl)}원)입니다.`
        : '';
      return `이 기간 총 자산이 ${fmt(row.assetChange)}원 감소했습니다. ${dominant} 계좌에서 ${fmt(dominantAmt)}원의 손실이 발생했습니다.${causeStr}`;
    }
  };

  const [year, month] = row.date.split('-');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
          borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '85vh',
          overflowY: 'auto', padding: 24,
        }}
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 2 }}>월간 증감 리포트</div>
            <h2 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
              {year}년 {month}월
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 'var(--text-xl)', lineHeight: 1 }}>✕</button>
        </div>

        {/* 총 증감 요약 */}
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: 12, padding: '16px 20px', marginBottom: 16,
        }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 6 }}>총 증감</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: sign(row.assetChange), fontVariantNumeric: 'tabular-nums' }}>
              {fmtSigned(row.assetChange)}원
            </span>
            <span style={{ fontSize: 'var(--text-sm)', color: sign(row.changeRate), fontWeight: 600 }}>
              {row.changeRate >= 0 ? '+' : ''}{row.changeRate.toFixed(2)}%
            </span>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 4 }}>
            기말 총 자산 {fmt(row.totalAsset)}원 (기초 {fmt(row.startTotal)}원)
          </div>
        </div>

        {/* 소유자별 기여 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { label: '지윤', change: row.wifeChange, total: row.wifeTotal },
            { label: '오빠', change: row.husbandChange, total: row.husbandTotal },
          ].map(({ label, change, total }) => (
            <div key={label} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: sign(change), fontVariantNumeric: 'tabular-nums' }}>
                {fmtSigned(change)}원
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                기말 {fmt(total)}원
              </div>
            </div>
          ))}
        </div>

        {/* 자동 분석 텍스트 */}
        <div style={{
          background: 'var(--accent-blue-bg)', borderRadius: 10, padding: '12px 14px', marginBottom: 16,
          fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 1.6,
        }}>
          💬 {mainCause()}
        </div>

        {/* 현재 기준 손실 종목 */}
        {losers.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              📉 현재 손실 상위 종목 <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(현재 시세 기준)</span>
            </div>
            {losers.map(h => (
              <div key={`${h.account}-${h.ticker}`} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 0', borderBottom: '1px solid var(--border-secondary)',
              }}>
                <div>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{h.name}</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginLeft: 6 }}>{h.account}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-loss)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtSigned(h.pnl)}원
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-loss)' }}>
                    {h.pnlRate.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 현재 기준 수익 종목 */}
        {gainers.length > 0 && (
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              📈 현재 수익 상위 종목 <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(현재 시세 기준)</span>
            </div>
            {gainers.map(h => (
              <div key={`${h.account}-${h.ticker}`} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 0', borderBottom: '1px solid var(--border-secondary)',
              }}>
                <div>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{h.name}</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginLeft: 6 }}>{h.account}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-profit)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtSigned(h.pnl)}원
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-profit)' }}>
                    +{h.pnlRate.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {row.lastDividend > 0 && (
          <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 10, fontSize: 'var(--text-sm)', color: 'var(--accent-blue)' }}>
            💰 이 달 수령 배당금: {fmt(row.lastDividend)}원
          </div>
        )}

        <div style={{ marginTop: 16, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          ※ 종목 손익은 현재 시세 기준이며, 과거 월의 실제 원인과 다를 수 있습니다.
        </div>
      </div>
    </div>
  );
}

export function AssetChange() {
  const { accounts, prices, isAmountHidden, isMobile, isHappyMode } = useAppContext();
  const HAPPY_AMOUNT = 1_124_565_712;
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [period, setPeriod] = useState<PeriodKey>("1m");
  const [sortNewest, setSortNewest] = useState(true);
  const [reportMonth, setReportMonth] = useState<null | {
    date: string; totalAsset: number; assetChange: number; changeRate: number;
    lastDividend: number; wifeChange: number; husbandChange: number;
    wifeTotal: number; husbandTotal: number; startTotal: number;
  }>(null);

  const totalAsset = useMemo(() => {
    return accounts.reduce((sum, account) => {
      return (
        sum +
        account.holdings.reduce((hSum, h) => {
          return hSum + h.avgPrice * h.quantity;
        }, 0)
      );
    }, 0);
  }, [accounts]);

  useEffect(() => {
    let cancelled = false;
    fetchSnapshots()
      .then((data) => {
        if (cancelled) return;
        if (data && data.length > 0) {
          setSnapshots(data);
        } else {
          setSnapshots(generateMockSnapshots(totalAsset || 100000000));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSnapshots(generateMockSnapshots(totalAsset || 100000000));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [totalAsset]);

  const effectiveSnapshots = useMemo(() =>
    isHappyMode
      ? snapshots.map((s, i, arr) => {
          const newTotal = s.totalAsset + HAPPY_AMOUNT;
          const newHusband = s.husbandAsset + HAPPY_AMOUNT;
          const prev = arr[i + 1];
          const prevTotal = prev ? prev.totalAsset + HAPPY_AMOUNT : newTotal - s.assetChange;
          const change = newTotal - prevTotal;
          const rate = prevTotal > 0 ? (change / prevTotal) * 100 : 0;
          return { ...s, totalAsset: newTotal, husbandAsset: newHusband, assetChange: change, changeRate: rate };
        })
      : snapshots,
  [snapshots, isHappyMode]);

  const filteredSnapshots = useMemo(() => {
    const sorted = [...effectiveSnapshots].sort((a, b) => b.date.localeCompare(a.date));
    // 연도 필터
    if (period === "2025" || period === "2026") {
      return sorted.filter((s) => s.date.startsWith(period));
    }
    const tab = PERIOD_TABS.find((t) => t.key === period);
    if (!tab || tab.days === null) return sorted;
    return sorted.slice(0, tab.days);
  }, [snapshots, period]);

  // assetChange/changeRate를 저장된 값 대신 인접 스냅샷 차이로 재계산
  // (첫 스냅샷 저장 시 이전 데이터 없어서 0으로 저장되는 문제 해결)
  const enrichedSnapshots = useMemo(() => {
    // filteredSnapshots은 desc 정렬(최신→과거). i+1이 전날
    return filteredSnapshots.map((s, i) => {
      const prev = filteredSnapshots[i + 1];
      if (!prev) return s;
      const assetChange = s.totalAsset - prev.totalAsset;
      const changeRate = prev.totalAsset > 0
        ? Math.round((assetChange / prev.totalAsset) * 10000) / 100
        : 0;
      return { ...s, assetChange, changeRate };
    });
  }, [filteredSnapshots]);

  const periodSummary = useMemo(() => {
    if (filteredSnapshots.length < 2)
      return { changeAmount: 0, changeRate: 0 };
    // filteredSnapshots is sorted newest-first, so oldest is last
    const oldest = filteredSnapshots[filteredSnapshots.length - 1];
    const newest = filteredSnapshots[0];
    const changeAmount = newest.totalAsset - oldest.totalAsset;
    const changeRate =
      oldest.totalAsset !== 0
        ? Math.round(
            ((newest.totalAsset - oldest.totalAsset) / oldest.totalAsset) * 10000
          ) / 100
        : 0;
    return { changeAmount, changeRate };
  }, [filteredSnapshots]);

  const isYearFilter = period === "2025" || period === "2026";

  const monthlySummary = useMemo(() => {
    if (!isYearFilter || filteredSnapshots.length === 0) return [];
    // filteredSnapshots is sorted newest-first
    const asc = [...filteredSnapshots].sort((a, b) => a.date.localeCompare(b.date));
    const monthMap = new Map<string, { first: DailySnapshot; last: DailySnapshot }>();
    for (const s of asc) {
      const month = s.date.slice(0, 7); // YYYY-MM
      const entry = monthMap.get(month);
      if (!entry) {
        monthMap.set(month, { first: s, last: s });
      } else {
        entry.last = s;
      }
    }
    return Array.from(monthMap.entries()).map(([month, { first, last }]) => {
      const changeAmount = last.totalAsset - first.totalAsset;
      const changeRate = first.totalAsset !== 0
        ? Math.round((changeAmount / first.totalAsset) * 10000) / 100
        : 0;
      // 해당 월에서 dividend가 있는 가장 최근 스냅샷 찾기
      const monthSnaps = asc.filter(s => s.date.startsWith(month));
      const lastWithDiv = [...monthSnaps].reverse().find(s => s.dividend);
      return {
        date: month,
        totalAsset: last.totalAsset,
        assetChange: changeAmount,
        changeRate,
        lastDividend: lastWithDiv?.dividend || 0,
        wifeChange: (last.wifeAsset || 0) - (first.wifeAsset || 0),
        husbandChange: (last.husbandAsset || 0) - (first.husbandAsset || 0),
        wifeTotal: last.wifeAsset || 0,
        husbandTotal: last.husbandAsset || 0,
        startTotal: first.totalAsset,
      };
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredSnapshots, isYearFilter]);

  const chartData = useMemo(() => {
    return [...filteredSnapshots].sort((a, b) => a.date.localeCompare(b.date)).map((s) => ({
      date: s.date.slice(2).replace(/-/g, '.'),
      totalAsset: s.totalAsset,
      wifeAsset: s.wifeAsset,
      husbandAsset: s.husbandAsset,
    }));
  }, [filteredSnapshots]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-primary)",
          borderRadius: 8,
          padding: "10px 14px",
          fontSize: "var(--text-sm)",
          color: "var(--text-primary)",
        }}
      >
        <div style={{ fontWeight: "var(--font-semibold)", marginBottom: 4 }}>
          {label}
        </div>
        {payload.map((entry: any, idx: number) => (
          <div key={idx} style={{ color: entry.color, marginTop: 2 }}>
            {entry.name}: {formatAmount(entry.value, isAmountHidden)}원
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
    <div
      style={{
        padding: isMobile ? '16px' : '24px',
      }}
    >
      {/* Page header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <h1
          style={{
            fontSize: "var(--text-2xl)",
            fontWeight: "var(--font-bold)",
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          자산증감
        </h1>
      </div>

      {/* Summary cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          className="toss-card"
          style={{
            padding: 20,
          }}
        >
          <div
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
              marginBottom: 8,
            }}
          >
            기간 수익률
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {periodSummary.changeRate >= 0 ? (
              <MIcon name="trending_up" size={20} style={{ color: "var(--color-profit)" }} />
            ) : (
              <MIcon name="trending_down" size={20} style={{ color: "var(--color-loss)" }} />
            )}
            <span
              className="toss-number"
              style={{
                fontSize: "var(--text-xl)",
                fontWeight: "var(--font-bold)",
                color: getChangeColor(periodSummary.changeRate),
              }}
            >
              {formatRate(periodSummary.changeRate, isAmountHidden)}
            </span>
          </div>
        </div>

        <div
          className="toss-card"
          style={{
            padding: 20,
          }}
        >
          <div
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
              marginBottom: 8,
            }}
          >
            기간 증감액
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <MIcon name="calendar_today" size={20} style={{ color: "var(--accent-blue)" }} />
            <span
              className="toss-number"
              style={{
                fontSize: "var(--text-xl)",
                fontWeight: "var(--font-bold)",
                color: getChangeColor(periodSummary.changeAmount),
              }}
            >
              {periodSummary.changeAmount > 0 ? "+" : ""}
              {formatAmount(periodSummary.changeAmount, isAmountHidden)}원
            </span>
          </div>
        </div>
      </div>

      {/* Period filter tabs */}
      <div
        className="period-scroll-row"
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 24,
          overflowX: "auto",
          flexWrap: "nowrap",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          paddingBottom: 2,
        }}
      >
        {PERIOD_TABS.map((tab) => (
          <button
            key={tab.key}
            className={period === tab.key ? "toss-tab active" : "toss-tab"}
            onClick={() => setPeriod(tab.key)}
            style={{
              flexShrink: 0,
              padding: "8px 16px",
              borderRadius: 20,
              fontSize: "var(--text-sm)",
              fontWeight: "var(--font-medium)",
              border: "none",
              cursor: "pointer",
              background:
                period === tab.key
                  ? "var(--accent-blue)"
                  : "var(--bg-tertiary)",
              color:
                period === tab.key ? "var(--accent-blue-fg)" : "var(--text-secondary)",
              transition: "all 0.15s ease",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Asset trend chart */}
      <div
        className="toss-card"
        style={{
          padding: 20,
          marginBottom: 24,
        }}
      >
        <h2
          style={{
            fontSize: "var(--text-lg)",
            fontWeight: "var(--font-semibold)",
            color: "var(--text-primary)",
            margin: "0 0 16px 0",
          }}
        >
          자산 추이
        </h2>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border-primary)"
              />
              <XAxis
                dataKey="date"
                tick={{
                  fontSize: 'var(--text-xs)',
                  fill: "var(--text-tertiary)",
                }}
                tickLine={false}
                axisLine={{ stroke: "var(--border-primary)" }}
              />
              <YAxis
                tick={{
                  fontSize: 'var(--text-xs)',
                  fill: "var(--text-tertiary)",
                }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) =>
                  isAmountHidden
                    ? "••••"
                    : `${Math.round(v / 10000).toLocaleString("ko-KR")}만`
                }
                width={80}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="totalAsset"
                name="총 자산"
                stroke="var(--accent-blue)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="wifeAsset"
                name="아내"
                stroke="var(--color-profit)"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="4 2"
                activeDot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="husbandAsset"
                name="남편"
                stroke="var(--color-loss)"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="4 2"
                activeDot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detail table */}
      <div
        className="toss-card"
        style={{
          padding: 20,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2
            style={{
              fontSize: "var(--text-lg)",
              fontWeight: "var(--font-semibold)",
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            기간 상세
          </h2>
          <button
            onClick={() => setSortNewest(prev => !prev)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 12px', borderRadius: 8,
              border: '1px solid var(--border-primary)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--font-medium)',
              cursor: 'pointer',
            }}
          >
            <MIcon name="swap_vert" size={14} />
            {sortNewest ? '최신순' : '오래된순'}
          </button>
        </div>
        {isMobile ? (
          /* ── 모바일: 카드 리스트 ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(isYearFilter
              ? (sortNewest ? monthlySummary : [...monthlySummary].reverse())
              : (sortNewest ? [...enrichedSnapshots].reverse() : [...enrichedSnapshots])
            ).map(row => {
              const date = isYearFilter ? (row as typeof monthlySummary[0]).date.replace('-', '년 ') + '월' : (row as typeof enrichedSnapshots[0]).date;
              const totalAsset = isYearFilter ? (row as typeof monthlySummary[0]).totalAsset : (row as typeof enrichedSnapshots[0]).totalAsset;
              const assetChange = isYearFilter ? (row as typeof monthlySummary[0]).assetChange : (row as typeof enrichedSnapshots[0]).assetChange;
              const changeRate = isYearFilter ? (row as typeof monthlySummary[0]).changeRate : (row as typeof enrichedSnapshots[0]).changeRate;
              const dividend = isYearFilter ? (row as typeof monthlySummary[0]).lastDividend : (row as typeof enrichedSnapshots[0]).dividend;
              const isYearRow = isYearFilter;
              return (
                <div
                  key={(row as any).date}
                  style={{
                    background: 'var(--bg-secondary)', borderRadius: 10,
                    padding: '12px 14px', border: '1px solid var(--border-primary)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {date}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="toss-number" style={{ fontSize: 'var(--text-xs)', color: getChangeColor(changeRate), fontWeight: 700 }}>
                        {formatRate(changeRate, isAmountHidden)}
                      </span>
                      {isYearRow && (
                        <button
                          onClick={() => setReportMonth(row as typeof monthlySummary[0])}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 6, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}
                        >
                          <MIcon name="description" size={15} style={{ color: 'var(--accent-blue)' }} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 2 }}>총 자산</div>
                      <div className="toss-number" style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatAmount(totalAsset, isAmountHidden)}원
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 2 }}>증감</div>
                      <div className="toss-number" style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: getChangeColor(assetChange) }}>
                        {assetChange > 0 ? '+' : ''}{formatAmount(assetChange, isAmountHidden)}원
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── PC: 기존 테이블 ── */
          <div style={{ overflowX: "auto" }}>
            <table className="toss-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
                  {['날짜', '총 자산', '증감액', '수익률', '배당금'].map((h, i) => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: i === 0 ? "left" : "right", color: "var(--text-tertiary)", fontWeight: "var(--font-medium)", fontSize: "var(--text-xs)", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isYearFilter ? (
                  (sortNewest ? monthlySummary : [...monthlySummary].reverse()).map((row, idx) => (
                    <tr key={row.date} style={{ borderBottom: "1px solid var(--border-primary)", background: idx % 2 === 0 ? "transparent" : "var(--bg-secondary)" }}>
                      <td style={{ padding: "10px 12px", color: "var(--text-primary)", whiteSpace: "nowrap", fontWeight: "var(--font-medium)" }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {row.date.replace('-', '년 ')}월
                          <button onClick={() => setReportMonth(row)} title="월간 리포트 보기" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 6, color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', lineHeight: 1, transition: 'color 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-blue)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
                            📋
                          </button>
                        </span>
                      </td>
                      <td className="toss-number" style={{ padding: "10px 12px", textAlign: "right", color: "var(--text-primary)", fontWeight: "var(--font-medium)" }}>{formatAmount(row.totalAsset, isAmountHidden)}원</td>
                      <td className="toss-number" style={{ padding: "10px 12px", textAlign: "right", color: getChangeColor(row.assetChange), fontWeight: "var(--font-medium)" }}>{row.assetChange > 0 ? "+" : ""}{formatAmount(row.assetChange, isAmountHidden)}원</td>
                      <td className="toss-number" style={{ padding: "10px 12px", textAlign: "right", color: getChangeColor(row.changeRate), fontWeight: "var(--font-medium)" }}>{formatRate(row.changeRate, isAmountHidden)}</td>
                      <td className="toss-number" style={{ padding: "10px 12px", textAlign: "right", color: row.lastDividend ? "var(--accent-blue)" : "var(--text-quaternary)", fontWeight: "var(--font-medium)" }}>{row.lastDividend ? formatAmount(row.lastDividend, isAmountHidden) + "원" : "—"}</td>
                    </tr>
                  ))
                ) : (
                  (sortNewest ? [...enrichedSnapshots].reverse() : [...enrichedSnapshots]).map((snapshot, idx) => (
                    <tr key={snapshot.date} style={{ borderBottom: "1px solid var(--border-primary)", background: idx % 2 === 0 ? "transparent" : "var(--bg-secondary)" }}>
                      <td style={{ padding: "10px 12px", color: "var(--text-primary)", whiteSpace: "nowrap" }}>{snapshot.date}</td>
                      <td className="toss-number" style={{ padding: "10px 12px", textAlign: "right", color: "var(--text-primary)", fontWeight: "var(--font-medium)" }}>{formatAmount(snapshot.totalAsset, isAmountHidden)}원</td>
                      <td className="toss-number" style={{ padding: "10px 12px", textAlign: "right", color: getChangeColor(snapshot.assetChange), fontWeight: "var(--font-medium)" }}>{snapshot.assetChange > 0 ? "+" : ""}{formatAmount(snapshot.assetChange, isAmountHidden)}원</td>
                      <td className="toss-number" style={{ padding: "10px 12px", textAlign: "right", color: getChangeColor(snapshot.changeRate), fontWeight: "var(--font-medium)" }}>{formatRate(snapshot.changeRate, isAmountHidden)}</td>
                      <td className="toss-number" style={{ padding: "10px 12px", textAlign: "right", color: snapshot.dividend ? "var(--accent-blue)" : "var(--text-quaternary)", fontWeight: "var(--font-medium)" }}>{snapshot.dividend ? formatAmount(snapshot.dividend, isAmountHidden) + "원" : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    {reportMonth && (
      <MonthlyReportModal
        row={reportMonth}
        accounts={accounts}
        prices={prices}
        isAmountHidden={isAmountHidden}
        onClose={() => setReportMonth(null)}
      />
    )}
    </>
  );
}
