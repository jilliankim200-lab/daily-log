import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAppContext } from "../App";
import * as echarts from "echarts";
import { MIcon } from "./MIcon";
import { kvGet, kvSet } from "../api";

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

// ── ECharts helpers ──────────────────────────────────────────────────────────

function getCSSVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function useDarkMode() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

function BarCompareChart({
  data,
  showPieChart,
  onTogglePie,
}: {
  data: { name: string; "현재 비중": number; "목표 비중": number }[];
  showPieChart: boolean;
  onTogglePie: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const isDark = useDarkMode();

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: 'svg' });
    chartRef.current = chart;
    return () => chart.dispose();
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || data.length === 0) return;
    const accentBlue = getCSSVar('--accent-blue') || '#89DDFF';
    const textPrimary = getCSSVar('--text-primary') || '#C0C2CC';
    const textTertiary = getCSSVar('--text-tertiary') || '#525460';
    const bgSecondary = getCSSVar('--bg-secondary') || '#22222E';
    const borderPrimary = getCSSVar('--border-primary') || '#333';

    chart.setOption({
      backgroundColor: 'transparent',
      grid: { top: 10, right: 24, bottom: 36, left: 70, containLabel: false },
      legend: {
        bottom: 0,
        textStyle: { color: textPrimary, fontSize: 'var(--text-xs)' },
        itemWidth: 12, itemHeight: 12,
      },
      xAxis: {
        type: 'value',
        axisLabel: { formatter: (v: number) => `${v}%`, color: textTertiary, fontSize: 'var(--text-xs)' },
        splitLine: { lineStyle: { color: borderPrimary, opacity: 0.5 } },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'category',
        data: data.map(d => d.name),
        axisLabel: { color: textPrimary, fontSize: 'var(--text-xs)' },
        axisLine: { show: false },
        axisTick: { show: false },
        inverse: false,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: echarts.TooltipComponentFormatterCallbackParams) => {
          const p = params as { name: string; seriesName: string; value: number }[];
          const name = p[0]?.name || '';
          return `<div style="font-size:13px;font-weight:600;margin-bottom:6px">${name}</div>` +
            p.map(item => `<div>${item.seriesName} : <b>${item.value}%</b></div>`).join('');
        },
        backgroundColor: bgSecondary,
        borderColor: borderPrimary,
        textStyle: { color: textPrimary },
        borderRadius: 8,
      },
      series: [
        {
          name: '현재 비중',
          type: 'bar',
          data: data.map(d => d['현재 비중']),
          barMaxWidth: 14,
          itemStyle: { color: accentBlue, borderRadius: [0, 4, 4, 0] },
          label: { show: false },
        },
        {
          name: '목표 비중',
          type: 'bar',
          data: data.map(d => d['목표 비중']),
          barMaxWidth: 14,
          itemStyle: { color: accentBlue, opacity: 0.35, borderRadius: [0, 4, 4, 0] },
          label: { show: false },
        },
      ],
    });
  }, [data, isDark]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const observer = new ResizeObserver(() => chart.resize());
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="toss-card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>현재 vs 목표 비중</h2>
        <button className="toss-btn-ghost" style={{ fontSize: 'var(--text-xs)', padding: '4px 8px' }} onClick={onTogglePie}>
          {showPieChart ? '파이차트 숨기기' : '파이차트 보기'}
        </button>
      </div>
      <div ref={ref} style={{ width: '100%', height: 280 }} />
    </div>
  );
}

function DonutChart({
  data,
  isAmountHidden,
}: {
  data: { name: string; value: number; pct: number }[];
  isAmountHidden: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const isDark = useDarkMode();

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: 'svg' });
    chartRef.current = chart;
    return () => chart.dispose();
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || data.length === 0) return;
    const textPrimary = getCSSVar('--text-primary') || '#C0C2CC';
    const textTertiary = getCSSVar('--text-tertiary') || '#525460';
    const bgSecondary = getCSSVar('--bg-secondary') || '#22222E';
    const borderPrimary = getCSSVar('--border-primary') || '#333';

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (params: echarts.TooltipComponentFormatterCallbackParams) => {
          const p = params as { name: string; value: number; percent: number };
          const amt = isAmountHidden ? '••••' : Math.round(p.value).toLocaleString('ko-KR') + '원';
          return `<b>${p.name}</b><br/>${p.percent}% · ${amt}`;
        },
        backgroundColor: bgSecondary,
        borderColor: borderPrimary,
        textStyle: { color: textPrimary },
        borderRadius: 8,
      },
      series: [{
        type: 'pie',
        radius: ['42%', '70%'],
        center: ['50%', '52%'],
        padAngle: 2,
        itemStyle: { borderRadius: 4 },
        label: {
          show: true,
          formatter: (p: { name: string; percent: number }) => `${p.name} ${p.percent}%`,
          color: textTertiary,
          fontSize: 'var(--text-xs)',
        },
        labelLine: { lineStyle: { color: textTertiary } },
        data: data.map(d => ({
          name: d.name,
          value: d.value,
          itemStyle: { color: ASSET_CLASS_COLORS[d.name as AssetClass] },
        })),
      }],
    });
  }, [data, isAmountHidden, isDark]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const observer = new ResizeObserver(() => chart.resize());
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="toss-card" style={{ padding: 20 }}>
      <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0, marginBottom: 16 }}>현재 자산 배분</h2>
      <div ref={ref} style={{ width: '100%', height: 280 }} />
    </div>
  );
}

export function Rebalancing() {
  const { accounts, isAmountHidden, isMobile, navigateTo } = useAppContext();
  const [targets, setTargets] = useState<TargetAllocation>(loadTargets);
  const [editingTargets, setEditingTargets] = useState(false);
  const [tempTargets, setTempTargets] = useState<TargetAllocation>({
    ...targets,
  });
  const [selectedOwner, setSelectedOwner] = useState<string>("all");
  const [showPieChart, setShowPieChart] = useState(true);
  const [selectedClass, setSelectedClass] = useState<AssetClass | null>(null);
  const [holdingViewMode, setHoldingViewMode] = useState<'byClass' | 'byAccount'>('byClass');

  // KV에서 targets 로드 (마운트 시 1회)
  useEffect(() => {
    kvGet<TargetAllocation>('rebalancing_targets').then(val => {
      if (val) {
        setTargets(val);
        setTempTargets(val);
        saveTargets(val); // localStorage 동기화
      }
    }).catch(() => {});
  }, []);

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
    // 이전 값 백업 후 저장
    kvSet('rebalancing_targets_prev', targets).catch(() => {});
    setTargets({ ...tempTargets });
    saveTargets(tempTargets);
    kvSet('rebalancing_targets', tempTargets).catch(() => {});
    setEditingTargets(false);
  };

  const handleCancelTargets = () => {
    setTempTargets({ ...targets });
    setEditingTargets(false);
  };

  const isDark = document.documentElement.classList.contains('dark');

  return (
    <div
      style={{
        padding: isMobile ? '16px' : '24px',
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
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: 0 }}>
          리밸런싱
        </h1>

        {/* Owner toggle */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            className={`toss-tab ${selectedOwner === "all" ? "toss-tab-active" : ""}`}
            onClick={() => setSelectedOwner("all")}
          >
            전체
          </button>
          {owners.map((owner) => (
            <button
              key={owner.id}
              className={`toss-tab ${selectedOwner === owner.id ? "toss-tab-active" : ""}`}
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
          gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fit, minmax(180px, 1fr))",
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
                padding: isMobile ? '12px 14px' : 16,
                borderRadius: 12,
                background: isDark ? 'var(--bg-primary)' : `${ASSET_CLASS_COLORS[cls]}18`,
                border: isDark ? '1px solid var(--border-primary)' : `1px solid ${ASSET_CLASS_COLORS[cls]}30`,
              }}
            >
              <div style={{ fontSize: 'var(--text-xs)', color: ASSET_CLASS_COLORS[cls], marginBottom: 6, fontWeight: 'var(--font-semibold)' }}>
                {cls}
              </div>
              <div className="toss-number" style={{ fontSize: isMobile ? 'var(--text-base)' : 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                {formatAmount(data.currentAmount)}{!isAmountHidden && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginLeft: 2 }}>원</span>}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 5, whiteSpace: 'nowrap' }}>
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
          gridTemplateColumns: (showPieChart && !isMobile) ? "1fr 1fr" : "1fr",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Bar Chart: Current vs Target */}
        <BarCompareChart
          data={barChartData}
          showPieChart={showPieChart}
          onTogglePie={() => setShowPieChart(!showPieChart)}
        />

        {/* Donut Chart */}
        {showPieChart && (
          <DonutChart data={pieChartData} isAmountHidden={isAmountHidden} />
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
            <MIcon name="tune" size={18} style={{ color: "var(--text-secondary)" }} />
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              style={{ fontSize: 'var(--text-xs)', padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
                border: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)',
                color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}
              onClick={() => {
                if (editingTargets && Math.abs(totalTargetPct - 100) <= 0.01) {
                  handleSaveTargets();
                }
                navigateTo('optimal-guide');
              }}
            >
              <MIcon name="stars" size={13} style={{ color: 'var(--accent-blue)' }} />
              최적 가이드에 반영
            </button>
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
        </div>

        {editingTargets ? (
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fit, minmax(160px, 1fr))",
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
                          background: "color-mix(in srgb, var(--color-profit) 12%, transparent)",
                          padding: "2px 10px",
                          borderRadius: 12,
                          fontSize: "var(--text-xs)",
                        }}
                      >
                        <MIcon name="trending_down" size={12} />
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
                          background: "color-mix(in srgb, var(--color-loss) 12%, transparent)",
                          padding: "2px 10px",
                          borderRadius: 12,
                          fontSize: "var(--text-xs)",
                        }}
                      >
                        <MIcon name="trending_up" size={12} />
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
                        <MIcon name="remove" size={12} />
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
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: isMobile ? 10 : 0, marginBottom: 16 }}>
          {/* 탭 */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className={`toss-tab ${holdingViewMode === 'byClass' ? 'toss-tab-active' : ''}`}
              onClick={() => setHoldingViewMode('byClass')}
            >자산군별</button>
            <button
              className={`toss-tab ${holdingViewMode === 'byAccount' ? 'toss-tab-active' : ''}`}
              onClick={() => setHoldingViewMode('byAccount')}
            >계좌별</button>
          </div>
          {/* 카테고리 필터 */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* 전체 버튼 */}
            <button
              onClick={() => setSelectedClass(null)}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 'var(--text-xs)', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
                border: `1px solid ${selectedClass === null ? 'var(--accent-blue)' : 'var(--border-primary)'}`,
                background: selectedClass === null ? 'color-mix(in srgb, var(--accent-blue) 15%, transparent)' : 'var(--bg-tertiary)',
                color: selectedClass === null ? 'var(--accent-blue)' : 'var(--text-secondary)',
              }}
            >
              전체
            </button>
            {assetClasses.map((cls) => {
              const isActive = selectedClass === cls;
              const color = ASSET_CLASS_COLORS[cls];
              return (
                <button
                  key={cls}
                  onClick={() => setSelectedClass(isActive ? null : cls)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '4px 12px', borderRadius: 20, fontSize: 'var(--text-xs)', fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.15s',
                    border: `1px solid ${isActive ? color : 'var(--border-primary)'}`,
                    background: isActive ? `${color}22` : 'var(--bg-tertiary)',
                    color: isActive ? color : 'var(--text-secondary)',
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                  {cls}
                </button>
              );
            })}
          </div>
        </div>
        {/* ── 자산군별 뷰 ── */}
        {holdingViewMode === 'byClass' && (<>
          {assetClasses.map((cls) => {
            const holdings = filteredHoldings.filter((h) => h.assetClass === cls);
            if (holdings.length === 0) return null;
            const isSelected = selectedClass === cls;
            const isDimmed = selectedClass !== null && !isSelected;
            const color = ASSET_CLASS_COLORS[cls];
            return (
              <div key={cls} style={{
                marginBottom: 20,
                borderRadius: isSelected ? 12 : 0,
                padding: isSelected ? 12 : 0,
                background: isSelected ? `${color}12` : 'transparent',
                border: isSelected ? `1px solid ${color}30` : 'none',
                opacity: isDimmed ? 0.35 : 1,
                transition: 'all 0.2s',
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
                  <span style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-semibold)" }}>{cls}</span>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>({holdings.length}종목)</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
                  {holdings.map((h) => (
                    <div key={h.id + h.owner} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      gap: 8, padding: "8px 12px", overflow: 'hidden',
                      background: isSelected ? `${color}18` : "var(--bg-secondary)",
                      border: isSelected ? `1px solid ${color}25` : 'none',
                      borderRadius: 8, fontSize: "var(--text-sm)",
                    }}>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                        <span style={{ fontWeight: "var(--font-medium)", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.name}</span>
                        {selectedOwner === "all" && h.ownerName && (
                          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{h.ownerName}</span>
                        )}
                      </div>
                      <span className="toss-number" style={{ fontWeight: "var(--font-medium)", whiteSpace: "nowrap", flexShrink: 0 }}>
                        {formatAmount(h.totalValue)}{!isAmountHidden && <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginLeft: 1 }}>원</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {filteredHoldings.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
              보유 종목이 없습니다.
            </div>
          )}
        </>)}

        {/* ── 계좌별 뷰 ── */}
        {holdingViewMode === 'byAccount' && (() => {
          const filteredAccounts = accounts.filter(acc =>
            selectedOwner === 'all' || acc.owner === selectedOwner
          );
          const ownerGroups = [
            { owner: 'wife', label: '지윤', accounts: filteredAccounts.filter(a => a.owner === 'wife') },
            { owner: 'husband', label: '오빠', accounts: filteredAccounts.filter(a => a.owner === 'husband') },
          ].filter(g => g.accounts.length > 0);

          return ownerGroups.map(group => (
            <div key={group.owner} style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{group.owner === 'wife' ? '👩' : '👨'}</span> {group.label}
              </div>
              {group.accounts.map(acc => {
                const accHoldings = (acc.holdings || []).filter(h => {
                  const cls = categorizeHolding(h.name);
                  return selectedClass === null || cls === selectedClass;
                });
                const allAccHoldings = (acc.holdings || []);
                if (allAccHoldings.length === 0) return null;
                const isDimmedAcc = selectedClass !== null && accHoldings.length === 0;
                return (
                  <div key={acc.id} style={{ marginBottom: 16, opacity: isDimmedAcc ? 0.3 : 1, transition: 'opacity 0.2s' }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, paddingLeft: 4 }}>
                      {acc.name}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(260px, 1fr))", gap: 6 }}>
                      {allAccHoldings.map((h, hi) => {
                        const cls = categorizeHolding(h.name);
                        const color = ASSET_CLASS_COLORS[cls];
                        const isHighlighted = selectedClass === cls;
                        const isDimmedItem = selectedClass !== null && !isHighlighted;
                        const val = h.avgPrice * h.quantity;
                        return (
                          <div key={hi} style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            gap: 8, padding: "8px 12px", borderRadius: 8, fontSize: "var(--text-sm)",
                            overflow: 'hidden',
                            background: isHighlighted ? `${color}18` : "var(--bg-secondary)",
                            borderLeft: `3px solid ${color}`,
                            opacity: isDimmedItem ? 0.35 : 1,
                            transition: 'all 0.15s',
                          }}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                              <span style={{ fontWeight: "var(--font-medium)", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.name}</span>
                              <span style={{ fontSize: 'var(--text-xs)', color, fontWeight: 600 }}>{cls}</span>
                            </div>
                            <span className="toss-number" style={{ fontWeight: "var(--font-medium)", whiteSpace: "nowrap", flexShrink: 0 }}>
                              {formatAmount(val)}{!isAmountHidden && <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginLeft: 1 }}>원</span>}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ));
        })()}
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
        <MIcon name="info" size={14} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          리밸런싱 가이드는 현재 보유 금액과 목표 비중을 기반으로 산출된 참고 자료입니다.
          실제 거래 시 시장 상황, 수수료, 세금 등을 고려하여 판단하시기 바랍니다.
        </span>
      </div>
    </div>
  );
}
