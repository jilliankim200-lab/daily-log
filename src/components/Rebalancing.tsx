import React, { useState, useEffect, useMemo } from "react";
import { useAppContext } from "../App";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  RefreshCw,
  Settings,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
} from "lucide-react";

type AssetClass = "주식" | "채권" | "금" | "커버드콜" | "기타";

interface ClassifiedHolding {
  id: string;
  name: string;
  ticker: string;
  market: string;
  avgPrice: number;
  quantity: number;
  assetClass: AssetClass;
  totalValue: number;
  owner?: string;
  ownerName?: string;
}

interface TargetAllocation {
  주식: number;
  채권: number;
  금: number;
  커버드콜: number;
  기타: number;
}

const DEFAULT_TARGETS: TargetAllocation = {
  주식: 50,
  채권: 20,
  금: 10,
  커버드콜: 15,
  기타: 5,
};

const ASSET_CLASS_COLORS: Record<AssetClass, string> = {
  주식: "#3182f6",
  채권: "#00b894",
  금: "#fdcb6e",
  커버드콜: "#a29bfe",
  기타: "#b2bec3",
};

const STORAGE_KEY = "rebalancing_targets";

function categorizeHolding(name: string): AssetClass {
  const stockKeywords = [
    "나스닥",
    "S&P",
    "코스닥",
    "코스피",
    "반도체",
    "AI",
    "인도",
    "배당",
    "고배당",
    "밸류체인",
    "휴머노이드",
  ];
  const bondKeywords = ["국채", "채권", "단기채"];
  const goldKeywords = ["금현물", "KRX금"];
  const coveredCallKeywords = ["커버드콜"];

  // Covered call check first (some may also contain 배당)
  if (coveredCallKeywords.some((kw) => name.includes(kw))) return "커버드콜";
  if (bondKeywords.some((kw) => name.includes(kw))) return "채권";
  if (goldKeywords.some((kw) => name.includes(kw))) return "금";
  if (stockKeywords.some((kw) => name.includes(kw))) return "주식";
  return "기타";
}

function loadTargets(): TargetAllocation {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_TARGETS, ...parsed };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_TARGETS };
}

function saveTargets(targets: TargetAllocation) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(targets));
}

export function Rebalancing() {
  const { accounts, isAmountHidden } = useAppContext();
  const [targets, setTargets] = useState<TargetAllocation>(loadTargets);
  const [editingTargets, setEditingTargets] = useState(false);
  const [tempTargets, setTempTargets] = useState<TargetAllocation>({
    ...targets,
  });
  const [selectedOwner, setSelectedOwner] = useState<string>("all");
  const [showPieChart, setShowPieChart] = useState(true);

  useEffect(() => {
    saveTargets(targets);
  }, [targets]);

  // Classify all holdings
  const classifiedHoldings = useMemo<ClassifiedHolding[]>(() => {
    const result: ClassifiedHolding[] = [];
    for (const account of accounts) {
      for (const holding of account.holdings || []) {
        result.push({
          id: holding.id,
          name: holding.name,
          ticker: holding.ticker,
          market: holding.market,
          avgPrice: holding.avgPrice,
          quantity: holding.quantity,
          assetClass: categorizeHolding(holding.name),
          totalValue: holding.avgPrice * holding.quantity,
          owner: account.owner,
          ownerName: account.ownerName,
        });
      }
    }
    return result;
  }, [accounts]);

  // Get unique owners
  const owners = useMemo(() => {
    const ownerMap = new Map<string, string>();
    for (const h of classifiedHoldings) {
      if (h.owner && h.ownerName) {
        ownerMap.set(h.owner, h.ownerName);
      }
    }
    return Array.from(ownerMap.entries()).map(([id, name]) => ({ id, name }));
  }, [classifiedHoldings]);

  // Filter by selected owner
  const filteredHoldings = useMemo(() => {
    if (selectedOwner === "all") return classifiedHoldings;
    return classifiedHoldings.filter((h) => h.owner === selectedOwner);
  }, [classifiedHoldings, selectedOwner]);

  // Aggregate by asset class
  const classSummary = useMemo(() => {
    const summary: Record<AssetClass, number> = {
      주식: 0,
      채권: 0,
      금: 0,
      커버드콜: 0,
      기타: 0,
    };
    for (const h of filteredHoldings) {
      summary[h.assetClass] += h.totalValue;
    }
    return summary;
  }, [filteredHoldings]);

  const totalValue = useMemo(
    () => Object.values(classSummary).reduce((a, b) => a + b, 0),
    [classSummary]
  );

  const assetClasses: AssetClass[] = ["주식", "채권", "금", "커버드콜", "기타"];

  // Comparison data
  const comparisonData = useMemo(() => {
    return assetClasses.map((cls) => {
      const currentAmount = classSummary[cls];
      const currentPct = totalValue > 0 ? (currentAmount / totalValue) * 100 : 0;
      const targetPct = targets[cls];
      const diffPct = currentPct - targetPct;
      const targetAmount = totalValue * (targetPct / 100);
      const tradeAmount = targetAmount - currentAmount;

      return {
        name: cls,
        currentAmount,
        currentPct: Math.round(currentPct * 100) / 100,
        targetPct,
        diffPct: Math.round(diffPct * 100) / 100,
        action: diffPct > 0.5 ? "매도" : diffPct < -0.5 ? "매수" : "-",
        tradeAmount: Math.abs(Math.round(tradeAmount)),
        tradeAmountSigned: Math.round(tradeAmount),
      };
    });
  }, [classSummary, targets, totalValue]);

  // Chart data
  const barChartData = useMemo(() => {
    return comparisonData.map((d) => ({
      name: d.name,
      "현재 비중": d.currentPct,
      "목표 비중": d.targetPct,
    }));
  }, [comparisonData]);

  const pieChartData = useMemo(() => {
    return comparisonData
      .filter((d) => d.currentAmount > 0)
      .map((d) => ({
        name: d.name,
        value: d.currentAmount,
        pct: d.currentPct,
      }));
  }, [comparisonData]);

  const formatAmount = (amount: number) => {
    if (isAmountHidden) return "••••";
    return Math.round(amount).toLocaleString("ko-KR");
  };

  const totalTargetPct = Object.values(tempTargets).reduce((a, b) => a + b, 0);

  const handleSaveTargets = () => {
    setTargets({ ...tempTargets });
    setEditingTargets(false);
  };

  const handleCancelTargets = () => {
    setTempTargets({ ...targets });
    setEditingTargets(false);
  };

  return (
    <div
      style={{
        padding: 24,
        color: "var(--text-primary)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <RefreshCw size={24} style={{ color: "var(--accent-blue)" }} />
          <h1
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: "var(--font-bold)",
              margin: 0,
            }}
          >
            리밸런싱
          </h1>
        </div>

        {/* Owner toggle */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className={
              selectedOwner === "all" ? "toss-btn-primary" : "toss-btn-secondary"
            }
            style={{ fontSize: "var(--text-sm)", padding: "6px 16px" }}
            onClick={() => setSelectedOwner("all")}
          >
            전체
          </button>
          {owners.map((owner) => (
            <button
              key={owner.id}
              className={
                selectedOwner === owner.id
                  ? "toss-btn-primary"
                  : "toss-btn-secondary"
              }
              style={{ fontSize: "var(--text-sm)", padding: "6px 16px" }}
              onClick={() => setSelectedOwner(owner.id)}
            >
              {owner.name}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {assetClasses.map((cls) => {
          const data = comparisonData.find((d) => d.name === cls)!;
          return (
            <div
              key={cls}
              style={{
                padding: 16,
                borderRadius: 12,
                background: `${ASSET_CLASS_COLORS[cls]}18`,
                border: `1px solid ${ASSET_CLASS_COLORS[cls]}30`,
              }}
            >
              <div
                style={{
                  fontSize: "var(--text-sm)",
                  color: ASSET_CLASS_COLORS[cls],
                  marginBottom: 4,
                  fontWeight: "var(--font-semibold)",
                }}
              >
                {cls}
              </div>
              <div
                className="toss-number"
                style={{
                  fontSize: "var(--text-lg)",
                  fontWeight: "var(--font-bold)",
                  color: "var(--text-primary)",
                }}
              >
                {formatAmount(data.currentAmount)}
                {!isAmountHidden && (
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--text-tertiary)",
                      marginLeft: 2,
                    }}
                  >
                    원
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--text-tertiary)",
                  marginTop: 4,
                }}
              >
                {data.currentPct}% → 목표 {data.targetPct}%
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Section */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: showPieChart ? "1fr 1fr" : "1fr",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Bar Chart: Current vs Target */}
        <div className="toss-card" style={{ padding: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <h2
              style={{
                fontSize: "var(--text-lg)",
                fontWeight: "var(--font-semibold)",
                margin: 0,
              }}
            >
              현재 vs 목표 비중
            </h2>
            <button
              className="toss-btn-ghost"
              style={{ fontSize: "var(--text-xs)", padding: "4px 8px" }}
              onClick={() => setShowPieChart(!showPieChart)}
            >
              {showPieChart ? "파이차트 숨기기" : "파이차트 보기"}
            </button>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={barChartData}
              layout="vertical"
              margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
            >
              <XAxis
                type="number"
                domain={[0, "auto"]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={70}
                tick={{ fill: "var(--text-primary)", fontSize: 13 }}
              />
              <Tooltip
                formatter={(value: number) => `${value}%`}
                contentStyle={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-primary)",
                  borderRadius: 8,
                  color: "var(--text-primary)",
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }}
              />
              <Bar
                dataKey="현재 비중"
                fill="var(--accent-blue)"
                radius={[0, 4, 4, 0]}
                barSize={14}
              />
              <Bar
                dataKey="목표 비중"
                fill="var(--accent-blue)"
                fillOpacity={0.3}
                radius={[0, 4, 4, 0]}
                barSize={14}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        {showPieChart && (
          <div className="toss-card" style={{ padding: 20 }}>
            <h2
              style={{
                fontSize: "var(--text-lg)",
                fontWeight: "var(--font-semibold)",
                margin: 0,
                marginBottom: 16,
              }}
            >
              현재 자산 배분
            </h2>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, pct }: { name: string; pct: number }) =>
                    `${name} ${pct}%`
                  }
                  labelLine={true}
                >
                  {pieChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={ASSET_CLASS_COLORS[entry.name as AssetClass]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) =>
                    isAmountHidden ? "••••" : `${Math.round(value).toLocaleString("ko-KR")}원`
                  }
                  contentStyle={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-primary)",
                    borderRadius: 8,
                    color: "var(--text-primary)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Target Allocation Editor */}
      <div className="toss-card" style={{ padding: 20, marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Settings size={18} style={{ color: "var(--text-secondary)" }} />
            <h2
              style={{
                fontSize: "var(--text-lg)",
                fontWeight: "var(--font-semibold)",
                margin: 0,
              }}
            >
              목표 비중 설정
            </h2>
          </div>
          {!editingTargets ? (
            <button
              className="toss-btn-secondary"
              style={{ fontSize: "var(--text-sm)", padding: "6px 14px" }}
              onClick={() => {
                setTempTargets({ ...targets });
                setEditingTargets(true);
              }}
            >
              수정
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="toss-btn-ghost"
                style={{ fontSize: "var(--text-sm)", padding: "6px 14px" }}
                onClick={handleCancelTargets}
              >
                취소
              </button>
              <button
                className="toss-btn-primary"
                style={{ fontSize: "var(--text-sm)", padding: "6px 14px" }}
                onClick={handleSaveTargets}
                disabled={Math.abs(totalTargetPct - 100) > 0.01}
              >
                저장
              </button>
            </div>
          )}
        </div>

        {editingTargets ? (
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 12,
                marginBottom: 12,
              }}
            >
              {assetClasses.map((cls) => (
                <div key={cls} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--text-secondary)",
                      fontWeight: "var(--font-medium)",
                    }}
                  >
                    {cls}
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input
                      className="toss-input"
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={tempTargets[cls]}
                      onChange={(e) =>
                        setTempTargets({
                          ...tempTargets,
                          [cls]: Number(e.target.value) || 0,
                        })
                      }
                      style={{
                        width: "100%",
                        textAlign: "right",
                        fontSize: "var(--text-base)",
                      }}
                    />
                    <span
                      style={{
                        fontSize: "var(--text-sm)",
                        color: "var(--text-tertiary)",
                        flexShrink: 0,
                      }}
                    >
                      %
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  color:
                    Math.abs(totalTargetPct - 100) > 0.01
                      ? "var(--color-profit)"
                      : "var(--text-tertiary)",
                  fontWeight: "var(--font-medium)",
                }}
              >
                합계: {totalTargetPct}%
                {Math.abs(totalTargetPct - 100) > 0.01 && " (100%가 되어야 합니다)"}
              </span>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            {assetClasses.map((cls) => (
              <div
                key={cls}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: ASSET_CLASS_COLORS[cls],
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                  {cls}
                </span>
                <span
                  className="toss-number"
                  style={{
                    fontSize: "var(--text-sm)",
                    fontWeight: "var(--font-semibold)",
                  }}
                >
                  {targets[cls]}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rebalancing Guide Table */}
      <div className="toss-card" style={{ padding: 20, marginBottom: 24 }}>
        <h2
          style={{
            fontSize: "var(--text-lg)",
            fontWeight: "var(--font-semibold)",
            margin: 0,
            marginBottom: 16,
          }}
        >
          리밸런싱 가이드
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table className="toss-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    fontSize: "var(--text-sm)",
                    color: "var(--text-tertiary)",
                    fontWeight: "var(--font-medium)",
                    borderBottom: "1px solid var(--border-primary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  자산군
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "10px 12px",
                    fontSize: "var(--text-sm)",
                    color: "var(--text-tertiary)",
                    fontWeight: "var(--font-medium)",
                    borderBottom: "1px solid var(--border-primary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  현재 금액
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "10px 12px",
                    fontSize: "var(--text-sm)",
                    color: "var(--text-tertiary)",
                    fontWeight: "var(--font-medium)",
                    borderBottom: "1px solid var(--border-primary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  현재 %
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "10px 12px",
                    fontSize: "var(--text-sm)",
                    color: "var(--text-tertiary)",
                    fontWeight: "var(--font-medium)",
                    borderBottom: "1px solid var(--border-primary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  목표 %
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "10px 12px",
                    fontSize: "var(--text-sm)",
                    color: "var(--text-tertiary)",
                    fontWeight: "var(--font-medium)",
                    borderBottom: "1px solid var(--border-primary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  차이
                </th>
                <th
                  style={{
                    textAlign: "center",
                    padding: "10px 12px",
                    fontSize: "var(--text-sm)",
                    color: "var(--text-tertiary)",
                    fontWeight: "var(--font-medium)",
                    borderBottom: "1px solid var(--border-primary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  액션
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "10px 12px",
                    fontSize: "var(--text-sm)",
                    color: "var(--text-tertiary)",
                    fontWeight: "var(--font-medium)",
                    borderBottom: "1px solid var(--border-primary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  거래 금액
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((row) => (
                <tr key={row.name}>
                  <td
                    style={{
                      padding: "12px",
                      borderBottom: "1px solid var(--border-primary)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: ASSET_CLASS_COLORS[row.name as AssetClass],
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: "var(--text-sm)",
                          fontWeight: "var(--font-medium)",
                        }}
                      >
                        {row.name}
                      </span>
                    </div>
                  </td>
                  <td
                    className="toss-number"
                    style={{
                      textAlign: "right",
                      padding: "12px",
                      borderBottom: "1px solid var(--border-primary)",
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    {formatAmount(row.currentAmount)}
                    {!isAmountHidden && (
                      <span style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)" }}>
                        원
                      </span>
                    )}
                  </td>
                  <td
                    className="toss-number"
                    style={{
                      textAlign: "right",
                      padding: "12px",
                      borderBottom: "1px solid var(--border-primary)",
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    {row.currentPct}%
                  </td>
                  <td
                    className="toss-number"
                    style={{
                      textAlign: "right",
                      padding: "12px",
                      borderBottom: "1px solid var(--border-primary)",
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    {row.targetPct}%
                  </td>
                  <td
                    className="toss-number"
                    style={{
                      textAlign: "right",
                      padding: "12px",
                      borderBottom: "1px solid var(--border-primary)",
                      fontSize: "var(--text-sm)",
                      color:
                        row.diffPct > 0.5
                          ? "var(--color-profit)"
                          : row.diffPct < -0.5
                          ? "var(--color-loss)"
                          : "var(--text-tertiary)",
                      fontWeight: "var(--font-medium)",
                    }}
                  >
                    {row.diffPct > 0 ? "+" : ""}
                    {row.diffPct}%
                  </td>
                  <td
                    style={{
                      textAlign: "center",
                      padding: "12px",
                      borderBottom: "1px solid var(--border-primary)",
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    {row.action === "매도" ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          color: "var(--color-profit)",
                          fontWeight: "var(--font-medium)",
                          background: "rgba(255, 77, 77, 0.08)",
                          padding: "2px 10px",
                          borderRadius: 12,
                          fontSize: "var(--text-xs)",
                        }}
                      >
                        <TrendingDown size={12} />
                        매도
                      </span>
                    ) : row.action === "매수" ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          color: "var(--color-loss)",
                          fontWeight: "var(--font-medium)",
                          background: "rgba(54, 121, 255, 0.08)",
                          padding: "2px 10px",
                          borderRadius: 12,
                          fontSize: "var(--text-xs)",
                        }}
                      >
                        <TrendingUp size={12} />
                        매수
                      </span>
                    ) : (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          color: "var(--text-tertiary)",
                        }}
                      >
                        <Minus size={12} />
                      </span>
                    )}
                  </td>
                  <td
                    className="toss-number"
                    style={{
                      textAlign: "right",
                      padding: "12px",
                      borderBottom: "1px solid var(--border-primary)",
                      fontSize: "var(--text-sm)",
                      fontWeight: "var(--font-medium)",
                      color:
                        row.action === "매도"
                          ? "var(--color-profit)"
                          : row.action === "매수"
                          ? "var(--color-loss)"
                          : "var(--text-tertiary)",
                    }}
                  >
                    {row.action !== "-" ? (
                      <>
                        {formatAmount(row.tradeAmount)}
                        {!isAmountHidden && (
                          <span
                            style={{
                              color: "var(--text-tertiary)",
                              fontSize: "var(--text-xs)",
                            }}
                          >
                            원
                          </span>
                        )}
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td
                  style={{
                    padding: "12px",
                    fontWeight: "var(--font-semibold)",
                    fontSize: "var(--text-sm)",
                  }}
                >
                  합계
                </td>
                <td
                  className="toss-number"
                  style={{
                    textAlign: "right",
                    padding: "12px",
                    fontWeight: "var(--font-semibold)",
                    fontSize: "var(--text-sm)",
                  }}
                >
                  {formatAmount(totalValue)}
                  {!isAmountHidden && (
                    <span style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)" }}>
                      원
                    </span>
                  )}
                </td>
                <td
                  className="toss-number"
                  style={{
                    textAlign: "right",
                    padding: "12px",
                    fontWeight: "var(--font-semibold)",
                    fontSize: "var(--text-sm)",
                  }}
                >
                  100%
                </td>
                <td
                  className="toss-number"
                  style={{
                    textAlign: "right",
                    padding: "12px",
                    fontWeight: "var(--font-semibold)",
                    fontSize: "var(--text-sm)",
                  }}
                >
                  {Object.values(targets).reduce((a, b) => a + b, 0)}%
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Per-holding breakdown */}
      <div className="toss-card" style={{ padding: 20 }}>
        <h2
          style={{
            fontSize: "var(--text-lg)",
            fontWeight: "var(--font-semibold)",
            margin: 0,
            marginBottom: 16,
          }}
        >
          보유 종목별 분류
        </h2>
        {assetClasses.map((cls) => {
          const holdings = filteredHoldings.filter((h) => h.assetClass === cls);
          if (holdings.length === 0) return null;
          return (
            <div key={cls} style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: ASSET_CLASS_COLORS[cls],
                  }}
                />
                <span
                  style={{
                    fontSize: "var(--text-base)",
                    fontWeight: "var(--font-semibold)",
                  }}
                >
                  {cls}
                </span>
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-tertiary)",
                  }}
                >
                  ({holdings.length}종목)
                </span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: 8,
                }}
              >
                {holdings.map((h) => (
                  <div
                    key={h.id + h.owner}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      background: "var(--bg-secondary)",
                      borderRadius: 8,
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontWeight: "var(--font-medium)" }}>
                        {h.name}
                      </span>
                      {selectedOwner === "all" && h.ownerName && (
                        <span
                          style={{
                            fontSize: "var(--text-xs)",
                            color: "var(--text-tertiary)",
                          }}
                        >
                          {h.ownerName}
                        </span>
                      )}
                    </div>
                    <span
                      className="toss-number"
                      style={{ fontWeight: "var(--font-medium)", whiteSpace: "nowrap" }}
                    >
                      {formatAmount(h.totalValue)}
                      {!isAmountHidden && (
                        <span
                          style={{
                            fontSize: "var(--text-xs)",
                            color: "var(--text-tertiary)",
                            marginLeft: 1,
                          }}
                        >
                          원
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {filteredHoldings.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              color: "var(--text-tertiary)",
              fontSize: "var(--text-sm)",
            }}
          >
            보유 종목이 없습니다.
          </div>
        )}
      </div>

      {/* Info footer */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          marginTop: 16,
          padding: "12px 16px",
          background: "var(--bg-secondary)",
          borderRadius: 8,
          fontSize: "var(--text-xs)",
          color: "var(--text-tertiary)",
          lineHeight: 1.6,
        }}
      >
        <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          리밸런싱 가이드는 현재 보유 금액과 목표 비중을 기반으로 산출된 참고 자료입니다.
          실제 거래 시 시장 상황, 수수료, 세금 등을 고려하여 판단하시기 바랍니다.
        </span>
      </div>
    </div>
  );
}
