import React, { useState, useMemo } from "react";
import { useAppContext } from "../App";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { MIcon } from "./MIcon";

function formatKRW(value: number, hidden: boolean): string {
  if (hidden) return "••••";
  if (Math.abs(value) >= 1_0000_0000) {
    const eok = value / 1_0000_0000;
    return `${eok.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억원`;
  }
  if (Math.abs(value) >= 1_0000) {
    const man = Math.round(value / 1_0000);
    return `${man.toLocaleString("ko-KR")}만원`;
  }
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function formatAxisKRW(value: number): string {
  if (Math.abs(value) >= 1_0000_0000) {
    return `${(value / 1_0000_0000).toFixed(1)}억`;
  }
  if (Math.abs(value) >= 1_0000) {
    return `${(value / 1_0000).toFixed(0)}만`;
  }
  return Math.round(value).toLocaleString("ko-KR");
}

export function RetirementCalc() {
  const { accounts, isAmountHidden } = useAppContext();

  const totalCurrentAssets = useMemo(() => {
    let sum = 0;
    for (const account of accounts) {
      if (account.holdings) {
        for (const h of account.holdings) {
          sum += (h.avgPrice ?? 0) * (h.quantity ?? 0);
        }
      }
    }
    return sum;
  }, [accounts]);

  const [currentAge, setCurrentAge] = useState(35);
  const [retirementAge, setRetirementAge] = useState(55);
  const [currentAssets, setCurrentAssets] = useState<number | null>(null);
  const [monthlySavings, setMonthlySavings] = useState(3_000_000);
  const [annualReturn, setAnnualReturn] = useState(7);
  const [monthlyExpense, setMonthlyExpense] = useState(4_000_000);
  const [lifeExpectancy, setLifeExpectancy] = useState(85);
  const [inflationRate, setInflationRate] = useState(2.5);

  const effectiveAssets = currentAssets ?? totalCurrentAssets;

  const results = useMemo(() => {
    const yearsToRetire = retirementAge - currentAge;
    const yearsInRetirement = lifeExpectancy - retirementAge;

    if (yearsToRetire <= 0 || yearsInRetirement <= 0) {
      return null;
    }

    const monthlyReturn = annualReturn / 100 / 12;
    const monthlyInflation = inflationRate / 100 / 12;

    // Accumulation phase: compound growth + monthly contributions
    const chartData: { age: number; assets: number; phase: string }[] = [];
    let assets = effectiveAssets;

    for (let year = 0; year <= yearsToRetire; year++) {
      chartData.push({
        age: currentAge + year,
        assets: Math.round(assets),
        phase: "accumulation",
      });
      if (year < yearsToRetire) {
        for (let m = 0; m < 12; m++) {
          assets = assets * (1 + monthlyReturn) + monthlySavings;
        }
      }
    }

    const assetsAtRetirement = assets;

    // Drawdown phase: inflation-adjusted withdrawals
    let depletionAge: number | null = null;
    let yearsFromRetirement = 0;

    for (let year = 1; year <= yearsInRetirement; year++) {
      for (let m = 0; m < 12; m++) {
        yearsFromRetirement = year - 1 + m / 12;
        const monthsElapsed = (year - 1) * 12 + m;
        const inflationAdjustedExpense =
          monthlyExpense * Math.pow(1 + monthlyInflation, monthsElapsed);
        assets = assets * (1 + monthlyReturn) - inflationAdjustedExpense;
        if (assets <= 0 && depletionAge === null) {
          depletionAge = retirementAge + year - 1 + m / 12;
          assets = 0;
        }
      }
      chartData.push({
        age: retirementAge + year,
        assets: Math.max(0, Math.round(assets)),
        phase: "drawdown",
      });
    }

    const assetsAtEnd = Math.max(0, Math.round(assets));

    // Total needed: sum of inflation-adjusted monthly expenses over retirement
    let totalNeeded = 0;
    for (let m = 0; m < yearsInRetirement * 12; m++) {
      totalNeeded +=
        monthlyExpense * Math.pow(1 + monthlyInflation, m) /
        Math.pow(1 + monthlyReturn, m + 1);
    }
    // Present value at retirement of total withdrawals
    const pvNeeded = totalNeeded;

    const shortfall = pvNeeded - assetsAtRetirement;
    const isGoalMet = shortfall <= 0;

    return {
      assetsAtRetirement,
      depletionAge,
      assetsAtEnd,
      shortfall: Math.max(0, shortfall),
      isGoalMet,
      chartData,
      yearsToRetire,
      yearsInRetirement,
    };
  }, [
    currentAge,
    retirementAge,
    effectiveAssets,
    monthlySavings,
    annualReturn,
    monthlyExpense,
    lifeExpectancy,
    inflationRate,
  ]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-primary)",
            borderRadius: 12,
            padding: "10px 14px",
            fontSize: "var(--text-sm)",
          }}
        >
          <div style={{ color: "var(--text-secondary)", marginBottom: 4 }}>
            {label}세
          </div>
          <div style={{ color: "var(--text-primary)", fontWeight: "var(--font-semibold)" }}>
            {formatKRW(data.assets, isAmountHidden)}
          </div>
          <div
            style={{
              color:
                data.phase === "accumulation"
                  ? "var(--accent-blue)"
                  : "var(--color-profit)",
              fontSize: "var(--text-xs)",
              marginTop: 2,
            }}
          >
            {data.phase === "accumulation" ? "자산 축적기" : "자산 인출기"}
          </div>
        </div>
      );
    }
    return null;
  };

  const sliderStyle: React.CSSProperties = {
    width: "100%",
    height: 6,
    borderRadius: 3,
    appearance: "none" as const,
    background: "var(--bg-tertiary)",
    outline: "none",
    marginTop: 8,
    cursor: "pointer",
  };

  const sliderCSS = `
    .retirement-slider::-webkit-slider-thumb {
      appearance: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--accent-blue);
      cursor: pointer;
      border: 2px solid white;
      box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    }
    .retirement-slider::-moz-range-thumb {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--accent-blue);
      cursor: pointer;
      border: 2px solid white;
      box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    }
    .retirement-slider::-webkit-slider-runnable-track {
      height: 6px;
      border-radius: 3px;
      background: linear-gradient(to right, var(--accent-blue) 0%, var(--accent-blue) var(--progress), var(--bg-tertiary) var(--progress), var(--bg-tertiary) 100%);
    }
    .retirement-calc-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    @media (max-width: 700px) {
      .retirement-calc-grid {
        grid-template-columns: 1fr;
      }
    }
    .retirement-summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    @media (max-width: 900px) {
      .retirement-summary-grid {
        grid-template-columns: 1fr;
      }
    }
    .retirement-main-grid {
      display: grid;
      grid-template-columns: 380px 1fr;
      gap: 20px;
    }
    @media (max-width: 900px) {
      .retirement-main-grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  const inputGroupStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "var(--text-sm)",
    color: "var(--text-secondary)",
    fontWeight: "var(--font-medium)",
  };

  return (
    <div style={{ padding: 24 }}>
      <style>{sliderCSS}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 6,
          }}
        >
          <MIcon name="calculate" size={24} style={{ color: "var(--accent-blue)" }} />
          <h1
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: "var(--font-bold)",
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            은퇴 계산기
          </h1>
        </div>
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-tertiary)",
            margin: 0,
          }}
        >
          현재 자산과 저축 계획을 기반으로 은퇴 준비 상태를 시뮬레이션합니다
        </p>
      </div>

      {/* Summary Cards */}
      {results && (
        <div className="retirement-summary-grid" style={{ marginBottom: 20 }}>
          <div className="toss-card" style={{ padding: 20 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <MIcon name="trending_up" size={18} style={{ color: "var(--accent-blue)" }} />
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                은퇴 시점 예상 자산
              </span>
            </div>
            <div
              className="toss-number"
              style={{
                fontSize: "var(--text-xl)",
                fontWeight: "var(--font-bold)",
                color: "var(--accent-blue)",
              }}
            >
              {formatKRW(results.assetsAtRetirement, isAmountHidden)}
            </div>
            <div
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--text-tertiary)",
                marginTop: 4,
              }}
            >
              {retirementAge}세 기준
            </div>
          </div>

          <div className="toss-card" style={{ padding: 20 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <MIcon name="calendar_today" size={18} style={{ color: results.depletionAge ? "var(--color-profit)" : "var(--color-loss)" }} />
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                자산 소진 시점
              </span>
            </div>
            <div
              className="toss-number"
              style={{
                fontSize: "var(--text-xl)",
                fontWeight: "var(--font-bold)",
                color: results.depletionAge
                  ? "var(--color-profit)"
                  : "var(--color-loss)",
              }}
            >
              {results.depletionAge
                ? `${Math.floor(results.depletionAge)}세`
                : "소진되지 않음"}
            </div>
            <div
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--text-tertiary)",
                marginTop: 4,
              }}
            >
              {results.depletionAge
                ? `기대 수명 대비 ${Math.floor(lifeExpectancy - results.depletionAge)}년 부족`
                : `${lifeExpectancy}세까지 유지 가능`}
            </div>
          </div>

          <div className="toss-card" style={{ padding: 20 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
              }}
            >
              {results.isGoalMet ? (
                <MIcon name="check_circle" size={18} style={{ color: "var(--color-loss)" }} />
              ) : (
                <MIcon name="warning" size={18} style={{ color: "var(--color-profit)" }} />
              )}
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                목표 달성 여부
              </span>
            </div>
            <div
              className="toss-number"
              style={{
                fontSize: "var(--text-xl)",
                fontWeight: "var(--font-bold)",
                color: results.isGoalMet
                  ? "var(--color-loss)"
                  : "var(--color-profit)",
              }}
            >
              {results.isGoalMet ? "달성 가능" : "부족"}
            </div>
            <div
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--text-tertiary)",
                marginTop: 4,
              }}
            >
              {results.isGoalMet
                ? `은퇴 후 잔여 자산 ${formatKRW(results.assetsAtEnd, isAmountHidden)}`
                : `부족액 ${formatKRW(results.shortfall, isAmountHidden)}`}
            </div>
          </div>
        </div>
      )}

      {/* Main Layout: Inputs + Chart */}
      <div className="retirement-main-grid">
        {/* Input Section */}
        <div className="toss-card" style={{ padding: 20, alignSelf: "start" }}>
          <h2
            style={{
              fontSize: "var(--text-lg)",
              fontWeight: "var(--font-semibold)",
              color: "var(--text-primary)",
              margin: "0 0 18px 0",
            }}
          >
            시뮬레이션 설정
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Age inputs */}
            <div className="retirement-calc-grid">
              <div style={inputGroupStyle}>
                <label style={labelStyle}>현재 나이</label>
                <input
                  className="toss-input"
                  type="number"
                  value={currentAge}
                  min={18}
                  max={80}
                  onChange={(e) => setCurrentAge(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>목표 은퇴 나이</label>
                <input
                  className="toss-input"
                  type="number"
                  value={retirementAge}
                  min={currentAge + 1}
                  max={80}
                  onChange={(e) => setRetirementAge(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            {/* Current assets */}
            <div style={inputGroupStyle}>
              <label style={labelStyle}>
                <MIcon name="account_balance_wallet" size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                현재 총 자산 (원)
              </label>
              <input
                className="toss-input"
                type="number"
                value={effectiveAssets}
                onChange={(e) => setCurrentAssets(Number(e.target.value))}
                style={{ width: "100%" }}
              />
              {currentAssets === null && totalCurrentAssets > 0 && (
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                  계좌 데이터에서 자동 계산됨
                </span>
              )}
            </div>

            {/* Monthly savings with slider */}
            <div style={inputGroupStyle}>
              <label style={labelStyle}>월 저축액 (원)</label>
              <input
                className="toss-input"
                type="number"
                value={monthlySavings}
                min={0}
                step={100000}
                onChange={(e) => setMonthlySavings(Number(e.target.value))}
                style={{ width: "100%" }}
              />
              <input
                className="retirement-slider"
                type="range"
                min={0}
                max={20_000_000}
                step={100_000}
                value={monthlySavings}
                onChange={(e) => setMonthlySavings(Number(e.target.value))}
                style={{
                  ...sliderStyle,
                  "--progress": `${(monthlySavings / 20_000_000) * 100}%`,
                } as React.CSSProperties}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "var(--text-xs)",
                  color: "var(--text-tertiary)",
                }}
              >
                <span>0</span>
                <span>2,000만</span>
              </div>
            </div>

            {/* Annual return with slider */}
            <div style={inputGroupStyle}>
              <label style={labelStyle}>
                <MIcon name="trending_up" size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                예상 연 수익률 (%)
              </label>
              <input
                className="toss-input"
                type="number"
                value={annualReturn}
                min={0}
                max={30}
                step={0.5}
                onChange={(e) => setAnnualReturn(Number(e.target.value))}
                style={{ width: "100%" }}
              />
              <input
                className="retirement-slider"
                type="range"
                min={0}
                max={30}
                step={0.5}
                value={annualReturn}
                onChange={(e) => setAnnualReturn(Number(e.target.value))}
                style={{
                  ...sliderStyle,
                  "--progress": `${(annualReturn / 30) * 100}%`,
                } as React.CSSProperties}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "var(--text-xs)",
                  color: "var(--text-tertiary)",
                }}
              >
                <span>0%</span>
                <span>30%</span>
              </div>
            </div>

            {/* Monthly expense with slider */}
            <div style={inputGroupStyle}>
              <label style={labelStyle}>
                <MIcon name="trending_down" size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                은퇴 후 월 생활비 (원)
              </label>
              <input
                className="toss-input"
                type="number"
                value={monthlyExpense}
                min={0}
                step={100000}
                onChange={(e) => setMonthlyExpense(Number(e.target.value))}
                style={{ width: "100%" }}
              />
              <input
                className="retirement-slider"
                type="range"
                min={0}
                max={15_000_000}
                step={100_000}
                value={monthlyExpense}
                onChange={(e) => setMonthlyExpense(Number(e.target.value))}
                style={{
                  ...sliderStyle,
                  "--progress": `${(monthlyExpense / 15_000_000) * 100}%`,
                } as React.CSSProperties}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "var(--text-xs)",
                  color: "var(--text-tertiary)",
                }}
              >
                <span>0</span>
                <span>1,500만</span>
              </div>
            </div>

            {/* Life expectancy & inflation */}
            <div className="retirement-calc-grid">
              <div style={inputGroupStyle}>
                <label style={labelStyle}>기대 수명</label>
                <input
                  className="toss-input"
                  type="number"
                  value={lifeExpectancy}
                  min={retirementAge + 1}
                  max={120}
                  onChange={(e) => setLifeExpectancy(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>물가상승률 (%)</label>
                <input
                  className="toss-input"
                  type="number"
                  value={inflationRate}
                  min={0}
                  max={10}
                  step={0.1}
                  onChange={(e) => setInflationRate(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Chart Section */}
        <div className="toss-card" style={{ padding: 20 }}>
          <h2
            style={{
              fontSize: "var(--text-lg)",
              fontWeight: "var(--font-semibold)",
              color: "var(--text-primary)",
              margin: "0 0 18px 0",
            }}
          >
            자산 변화 시뮬레이션
          </h2>

          {results && results.chartData.length > 0 ? (
            <div style={{ width: "100%", height: 420 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={results.chartData}
                  margin={{ top: 10, right: 20, left: 20, bottom: 10 }}
                >
                  <defs>
                    <linearGradient
                      id="accumulationGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#3182f6" stopOpacity={0.4} />
                      <stop
                        offset="100%"
                        stopColor="#3182f6"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                    <linearGradient
                      id="drawdownGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#f04452" stopOpacity={0.4} />
                      <stop
                        offset="100%"
                        stopColor="#f04452"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border-primary)"
                    opacity={0.5}
                  />
                  <XAxis
                    dataKey="age"
                    tick={{
                      fontSize: 'var(--text-xs)',
                      fill: "var(--text-tertiary)",
                    }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border-primary)" }}
                    label={{
                      value: "나이 (세)",
                      position: "insideBottomRight",
                      offset: -5,
                      style: {
                        fontSize: 'var(--text-xs)',
                        fill: "var(--text-tertiary)",
                      },
                    }}
                  />
                  <YAxis
                    tickFormatter={formatAxisKRW}
                    tick={{
                      fontSize: 'var(--text-xs)',
                      fill: "var(--text-tertiary)",
                    }}
                    tickLine={false}
                    axisLine={false}
                    width={60}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine
                    x={retirementAge}
                    stroke="var(--accent-blue)"
                    strokeDasharray="6 4"
                    strokeWidth={2}
                    label={{
                      value: `은퇴 (${retirementAge}세)`,
                      position: "top",
                      style: {
                        fontSize: 'var(--text-xs)',
                        fill: "var(--accent-blue)",
                        fontWeight: 600,
                      },
                    }}
                  />
                  {results.depletionAge && (
                    <ReferenceLine
                      x={Math.floor(results.depletionAge)}
                      stroke="var(--color-profit)"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: `소진 (${Math.floor(results.depletionAge)}세)`,
                        position: "top",
                        style: {
                          fontSize: 'var(--text-xs)',
                          fill: "var(--color-profit)",
                          fontWeight: 600,
                        },
                      }}
                    />
                  )}
                  {/* Split data into two areas for different colors */}
                  <Area
                    type="monotone"
                    dataKey={(d: any) =>
                      d.phase === "accumulation" || d.age === retirementAge
                        ? d.assets
                        : undefined
                    }
                    stroke="#3182f6"
                    strokeWidth={2.5}
                    fill="url(#accumulationGrad)"
                    connectNulls={false}
                    name="축적기"
                    dot={false}
                    activeDot={{ r: 4, fill: "#3182f6" }}
                  />
                  <Area
                    type="monotone"
                    dataKey={(d: any) =>
                      d.phase === "drawdown" || d.age === retirementAge
                        ? d.assets
                        : undefined
                    }
                    stroke="#f04452"
                    strokeWidth={2.5}
                    fill="url(#drawdownGrad)"
                    connectNulls={false}
                    name="인출기"
                    dot={false}
                    activeDot={{ r: 4, fill: "#f04452" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div
              style={{
                height: 420,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-tertiary)",
                fontSize: "var(--text-sm)",
              }}
            >
              유효한 설정값을 입력해 주세요
            </div>
          )}

          {/* Chart legend */}
          {results && (
            <div
              style={{
                display: "flex",
                gap: 20,
                justifyContent: "center",
                marginTop: 12,
                fontSize: "var(--text-xs)",
                color: "var(--text-tertiary)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background:
                      "linear-gradient(135deg, #3182f6 0%, rgba(49,130,246,0.3) 100%)",
                  }}
                />
                <span>자산 축적기 ({currentAge}~{retirementAge}세)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background:
                      "linear-gradient(135deg, #f04452 0%, rgba(240,68,82,0.3) 100%)",
                  }}
                />
                <span>자산 인출기 ({retirementAge}~{lifeExpectancy}세)</span>
              </div>
            </div>
          )}

          {/* Detailed breakdown */}
          {results && (
            <div
              style={{
                marginTop: 20,
                padding: 16,
                background: "var(--bg-tertiary)",
                borderRadius: 12,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px 24px",
                fontSize: "var(--text-sm)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ color: "var(--text-secondary)" }}>축적 기간</span>
                <span
                  style={{
                    color: "var(--text-primary)",
                    fontWeight: "var(--font-medium)",
                  }}
                >
                  {results.yearsToRetire}년
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ color: "var(--text-secondary)" }}>은퇴 기간</span>
                <span
                  style={{
                    color: "var(--text-primary)",
                    fontWeight: "var(--font-medium)",
                  }}
                >
                  {results.yearsInRetirement}년
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ color: "var(--text-secondary)" }}>총 저축 예정</span>
                <span
                  className="toss-number"
                  style={{
                    color: "var(--text-primary)",
                    fontWeight: "var(--font-medium)",
                  }}
                >
                  {formatKRW(
                    monthlySavings * 12 * results.yearsToRetire,
                    isAmountHidden
                  )}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ color: "var(--text-secondary)" }}>
                  {lifeExpectancy}세 잔여 자산
                </span>
                <span
                  className="toss-number"
                  style={{
                    color:
                      results.assetsAtEnd > 0
                        ? "var(--color-loss)"
                        : "var(--color-profit)",
                    fontWeight: "var(--font-medium)",
                  }}
                >
                  {formatKRW(results.assetsAtEnd, isAmountHidden)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
