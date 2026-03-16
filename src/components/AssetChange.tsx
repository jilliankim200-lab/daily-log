import React, { useState, useEffect, useMemo } from "react";
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
import { TrendingUp, TrendingDown, Calendar, ArrowUpDown } from "lucide-react";

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
  const today = new Date();
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

export function AssetChange() {
  const { accounts, isAmountHidden } = useAppContext();
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [period, setPeriod] = useState<PeriodKey>("1m");
  const [sortNewest, setSortNewest] = useState(true);

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

  const filteredSnapshots = useMemo(() => {
    const sorted = [...snapshots].sort((a, b) => b.date.localeCompare(a.date));
    // 연도 필터
    if (period === "2025" || period === "2026") {
      return sorted.filter((s) => s.date.startsWith(period));
    }
    const tab = PERIOD_TABS.find((t) => t.key === period);
    if (!tab || tab.days === null) return sorted;
    return sorted.slice(0, tab.days);
  }, [snapshots, period]);

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
      return {
        date: month,
        totalAsset: last.totalAsset,
        assetChange: changeAmount,
        changeRate,
        lastDividend: last.dividend || 0,
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
    <div
      style={{
        padding: 24,
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
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
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
              <TrendingUp size={20} style={{ color: "var(--color-profit)" }} />
            ) : (
              <TrendingDown size={20} style={{ color: "var(--color-loss)" }} />
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
            <Calendar size={20} style={{ color: "var(--accent-blue)" }} />
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
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        {PERIOD_TABS.map((tab) => (
          <button
            key={tab.key}
            className={period === tab.key ? "toss-tab active" : "toss-tab"}
            onClick={() => setPeriod(tab.key)}
            style={{
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
                period === tab.key ? "#fff" : "var(--text-secondary)",
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
                  fontSize: 12,
                  fill: "var(--text-tertiary)",
                }}
                tickLine={false}
                axisLine={{ stroke: "var(--border-primary)" }}
              />
              <YAxis
                tick={{
                  fontSize: 12,
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
            <ArrowUpDown size={14} />
            {sortNewest ? '최신순' : '오래된순'}
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table
            className="toss-table"
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "var(--text-sm)",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--border-primary)",
                }}
              >
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    color: "var(--text-tertiary)",
                    fontWeight: "var(--font-medium)",
                    fontSize: "var(--text-xs)",
                    whiteSpace: "nowrap",
                  }}
                >
                  날짜
                </th>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "right",
                    color: "var(--text-tertiary)",
                    fontWeight: "var(--font-medium)",
                    fontSize: "var(--text-xs)",
                    whiteSpace: "nowrap",
                  }}
                >
                  총 자산
                </th>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "right",
                    color: "var(--text-tertiary)",
                    fontWeight: "var(--font-medium)",
                    fontSize: "var(--text-xs)",
                    whiteSpace: "nowrap",
                  }}
                >
                  증감액
                </th>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "right",
                    color: "var(--text-tertiary)",
                    fontWeight: "var(--font-medium)",
                    fontSize: "var(--text-xs)",
                    whiteSpace: "nowrap",
                  }}
                >
                  수익률
                </th>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "right",
                    color: "var(--text-tertiary)",
                    fontWeight: "var(--font-medium)",
                    fontSize: "var(--text-xs)",
                    whiteSpace: "nowrap",
                  }}
                >
                  배당금
                </th>
              </tr>
            </thead>
            <tbody>
              {isYearFilter ? (
                (sortNewest ? monthlySummary : [...monthlySummary].reverse()).map((row, idx) => (
                  <tr
                    key={row.date}
                    style={{
                      borderBottom: "1px solid var(--border-primary)",
                      background: idx % 2 === 0 ? "transparent" : "var(--bg-secondary)",
                    }}
                  >
                    <td style={{ padding: "10px 12px", color: "var(--text-primary)", whiteSpace: "nowrap", fontWeight: "var(--font-medium)" }}>
                      {row.date.replace('-', '년 ')}월
                    </td>
                    <td className="toss-number" style={{ padding: "10px 12px", textAlign: "right", color: "var(--text-primary)", fontWeight: "var(--font-medium)" }}>
                      {formatAmount(row.totalAsset, isAmountHidden)}원
                    </td>
                    <td className="toss-number" style={{ padding: "10px 12px", textAlign: "right", color: getChangeColor(row.assetChange), fontWeight: "var(--font-medium)" }}>
                      {row.assetChange > 0 ? "+" : ""}{formatAmount(row.assetChange, isAmountHidden)}원
                    </td>
                    <td className="toss-number" style={{ padding: "10px 12px", textAlign: "right", color: getChangeColor(row.changeRate), fontWeight: "var(--font-medium)" }}>
                      {formatRate(row.changeRate, isAmountHidden)}
                    </td>
                    <td className="toss-number" style={{ padding: "10px 12px", textAlign: "right", color: row.lastDividend ? "var(--accent-blue)" : "var(--text-quaternary)", fontWeight: "var(--font-medium)" }}>
                      {row.lastDividend ? formatAmount(row.lastDividend, isAmountHidden) + "원" : "—"}
                    </td>
                  </tr>
                ))
              ) : (
                (sortNewest ? [...filteredSnapshots].reverse() : [...filteredSnapshots]).map((snapshot, idx) => (
                  <tr
                    key={snapshot.date}
                    style={{
                      borderBottom: "1px solid var(--border-primary)",
                      background: idx % 2 === 0 ? "transparent" : "var(--bg-secondary)",
                    }}
                  >
                    <td style={{ padding: "10px 12px", color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                      {snapshot.date}
                    </td>
                    <td className="toss-number" style={{ padding: "10px 12px", textAlign: "right", color: "var(--text-primary)", fontWeight: "var(--font-medium)" }}>
                      {formatAmount(snapshot.totalAsset, isAmountHidden)}원
                    </td>
                    <td className="toss-number" style={{ padding: "10px 12px", textAlign: "right", color: getChangeColor(snapshot.assetChange), fontWeight: "var(--font-medium)" }}>
                      {snapshot.assetChange > 0 ? "+" : ""}{formatAmount(snapshot.assetChange, isAmountHidden)}원
                    </td>
                    <td className="toss-number" style={{ padding: "10px 12px", textAlign: "right", color: getChangeColor(snapshot.changeRate), fontWeight: "var(--font-medium)" }}>
                      {formatRate(snapshot.changeRate, isAmountHidden)}
                    </td>
                    <td className="toss-number" style={{ padding: "10px 12px", textAlign: "right", color: snapshot.dividend ? "var(--accent-blue)" : "var(--text-quaternary)", fontWeight: "var(--font-medium)" }}>
                      {snapshot.dividend ? formatAmount(snapshot.dividend, isAmountHidden) + "원" : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
