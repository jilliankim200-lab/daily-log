import { useEffect, useRef, useState } from "react";

// ─── Data ─────────────────────────────────────────────────────────────────────
const MOM = [
  {"ticker":"456600","name":"TIME 글로벌AI인공지능","value":0,"cat":"국내주식","r1m":0.0,"r3m":50.2,"r6m":68.0,"r12m":97.0},
  {"ticker":"483340","name":"ACE 구글밸류체인액티브","value":0,"cat":"국내주식","r1m":0.0,"r3m":45.0,"r6m":52.2,"r12m":113.4},
  {"ticker":"381180","name":"TIGER 미국필라델피아반","value":0,"cat":"국내주식","r1m":0.0,"r3m":41.8,"r6m":51.0,"r12m":106.6},
  {"ticker":"491010","name":"TIGER 글로벌AI전력인","value":0,"cat":"국내주식","r1m":0.0,"r3m":38.3,"r6m":67.3,"r12m":113.7},
  {"ticker":"498400","name":"KODEX 200타겟위클리","value":0,"cat":"국내주식","r1m":0.0,"r3m":36.1,"r6m":56.0,"r12m":93.8},
  {"ticker":"226490","name":"KODEX 코스피100","value":0,"cat":"국내주식","r1m":0.0,"r3m":36.0,"r6m":63.9,"r12m":126.6},
  {"ticker":"487230","name":"KODEX 미국AI전력핵심","value":0,"cat":"국내주식","r1m":0.0,"r3m":35.5,"r6m":58.7,"r12m":74.6},
  {"ticker":"469170","name":"ACE 포스코그룹포커스","value":0,"cat":"국내주식","r1m":0.0,"r3m":31.5,"r6m":54.4,"r12m":89.2},
  {"ticker":"486450","name":"SOL 미국AI전력인프라","value":0,"cat":"국내주식","r1m":0.0,"r3m":21.5,"r6m":31.3,"r12m":54.0},
  {"ticker":"465580","name":"ACE 미국빅테크TOP7 ","value":0,"cat":"국내주식","r1m":0.0,"r3m":18.2,"r6m":7.8,"r12m":37.1},
  {"ticker":"133690","name":"TIGER 미국나스닥100","value":0,"cat":"국내주식","r1m":0.0,"r3m":14.7,"r6m":10.4,"r12m":32.4},
  {"ticker":"161510","name":"PLUS 고배당주","value":0,"cat":"국내주식","r1m":0.0,"r3m":12.1,"r6m":29.9,"r12m":45.6},
  {"ticker":"491620","name":"RISE 미국테크100데일","value":0,"cat":"국내주식","r1m":0.0,"r3m":11.5,"r6m":1.6,"r12m":14.1},
  {"ticker":"229200","name":"KODEX 코스닥150","value":0,"cat":"국내주식","r1m":0.0,"r3m":11.1,"r6m":30.8,"r12m":59.5},
  {"ticker":"232080","name":"TIGER 코스닥150","value":0,"cat":"국내주식","r1m":0.0,"r3m":10.7,"r6m":30.7,"r12m":59.2},
  {"ticker":"466940","name":"TIGER 은행고배당플러스","value":0,"cat":"국내주식","r1m":0.0,"r3m":8.8,"r6m":22.6,"r12m":43.6},
  {"ticker":"360200","name":"ACE 미국S&P500","value":0,"cat":"국내주식","r1m":0.0,"r3m":8.0,"r6m":6.2,"r12m":26.2},
  {"ticker":"379800","name":"KODEX 미국S&P500","value":0,"cat":"국내주식","r1m":0.0,"r3m":7.9,"r6m":5.9,"r12m":25.0},
  {"ticker":"438100","name":"ACE 미국나스닥100채권","value":0,"cat":"국내채권","r1m":0.0,"r3m":5.0,"r6m":6.6,"r12m":18.3},
  {"ticker":"448540","name":"ACE 엔비디아채권혼합","value":0,"cat":"국내채권","r1m":0.0,"r3m":4.8,"r6m":3.2,"r12m":11.0},
  {"ticker":"453870","name":"TIGER 미국배당다우존스","value":0,"cat":"국내주식","r1m":0.0,"r3m":2.4,"r6m":-10.0,"r12m":-7.5},
  {"ticker":"453810","name":"KODEX 인도Nifty5","value":0,"cat":"국내주식","r1m":0.0,"r3m":2.2,"r6m":-10.5,"r12m":-8.1},
  {"ticker":"447770","name":"TIGER 테슬라채권혼합F","value":0,"cat":"국내채권","r1m":0.0,"r3m":1.1,"r6m":-6.5,"r12m":5.6},
  {"ticker":"489030","name":"PLUS 고배당주위클리커버","value":0,"cat":"국내주식","r1m":0.0,"r3m":0.7,"r6m":-4.3,"r12m":-19.0},
  {"ticker":"272580","name":"TIGER 단기채권액티브","value":0,"cat":"국내채권","r1m":0.0,"r3m":0.4,"r6m":1.0,"r12m":1.4},
  {"ticker":"475630","name":"TIGER CD1년금리액티","value":0,"cat":"원자재/기타","r1m":0.0,"r3m":0.3,"r6m":0.9,"r12m":1.7},
  {"ticker":"148070","name":"KIWOOM 국고채10년","value":0,"cat":"국내주식","r1m":0.0,"r3m":0.2,"r6m":-2.6,"r12m":-8.7},
  {"ticker":"475080","name":"KODEX 테슬라커버드콜채","value":0,"cat":"국내채권","r1m":0.0,"r3m":0.0,"r6m":-7.5,"r12m":-1.5},
  {"ticker":"153130","name":"KODEX 단기채권","value":0,"cat":"국내채권","r1m":0.0,"r3m":0.0,"r6m":-0.1,"r12m":-0.1},
  {"ticker":"402970","name":"ACE 미국배당다우존스","value":0,"cat":"국내주식","r1m":0.0,"r3m":-1.0,"r6m":16.7,"r12m":29.3},
  {"ticker":"481060","name":"KODEX 미국30년국채타","value":0,"cat":"국내채권","r1m":0.0,"r3m":-1.4,"r6m":-5.2,"r12m":-8.9},
  {"ticker":"453850","name":"ACE 미국30년국채액티브","value":0,"cat":"국내채권","r1m":0.0,"r3m":-1.5,"r6m":-3.1,"r12m":-3.5},
  {"ticker":"458250","name":"TIGER 미국30년국채스","value":0,"cat":"국내채권","r1m":0.0,"r3m":-2.0,"r6m":-4.1,"r12m":-3.9},
  {"ticker":"411060","name":"ACE KRX금현물","value":0,"cat":"원자재/기타","r1m":0.0,"r3m":-4.1,"r6m":4.3,"r12m":50.5},
  {"ticker":"308620","name":"KODEX 미국10년국채선","value":0,"cat":"국내채권","r1m":0.0,"r3m":-4.6,"r6m":0.7,"r12m":7.7},
  {"ticker":"305080","name":"TIGER 미국채10년선물","value":0,"cat":"국내채권","r1m":0.0,"r3m":-4.8,"r6m":0.3,"r12m":8.6},
  {"ticker":"473330","name":"SOL 미국30년국채커버드","value":0,"cat":"국내채권","r1m":0.0,"r3m":-5.2,"r6m":-2.0,"r12m":3.3},
];

const BT_M = ["2022-01","2022-02","2022-03","2022-04","2022-05","2022-06","2022-07","2022-08","2022-09","2022-10","2022-11","2022-12","2023-01","2023-02","2023-03","2023-04","2023-05","2023-06","2023-07","2023-08","2023-09","2023-10","2023-11","2023-12","2024-01","2024-02","2024-03","2024-04","2024-05","2024-06","2024-07","2024-08","2024-09","2024-10","2024-11","2024-12","2025-01","2025-02","2025-03","2025-04","2025-05","2025-06","2025-07","2025-08","2025-09","2025-10","2025-11","2025-12","2026-01","2026-02","2026-03","2026-04","2026-05"];

const STRAT: Record<string, number[]> = {
  "듀얼모멘텀": [100.0,87.1185,85.7325,85.7698,82.5286,80.1123,80.0774,80.1548,80.8443,78.716,78.8336,74.3516,68.2809,68.5488,68.6632,75.6978,78.0127,78.5538,79.3054,86.592,85.722,79.1505,77.2405,83.0379,86.0629,81.3178,83.6299,86.8125,83.1271,84.2532,90.0635,86.2207,85.7613,85.8761,91.851,95.6125,100.3062,100.787,96.6135,89.9893,86.667,86.8394,104.4403,110.0129,108.1971,119.3049,152.4631,144.4688,159.1077,228.9283,273.5719,225.5541,321.4599],
  "나스닥100 BH": [100.0,87.1185,84.9943,93.5877,85.6834,80.2107,76.2984,85.2961,84.8462,81.754,83.4169,77.3918,69.2483,74.59,81.418,85.9624,89.4875,96.549,100.5524,100.8485,104.0376,100.2961,97.8759,105.2221,111.1845,117.5683,120.9112,125.5125,124.6241,129.9772,138.9408,133.0125,131.6401,132.3519,141.5604,147.3576,160.4556,159.254,152.6595,142.1925,139.8462,148.7415,154.8861,165.8087,166.3098,174.6298,187.3292,187.9271,185.6777,186.3155,181.1503,178.7642,202.7221],
  "코스피200 BH": [100.0,90.9205,91.8109,93.0023,89.0645,88.8889,77.4392,81.2265,80.8377,70.918,75.1568,80.449,74.2287,80.6496,80.0226,81.9915,81.8284,85.2019,85.1768,86.4811,84.2112,82.4555,76.8999,85.1643,90.7198,84.8508,89.8796,95.1843,91.9238,90.3185,96.6767,95.6233,91.0459,87.083,85.4903,81.8661,80.4113,83.8851,84.7254,84.9386,85.1141,90.6446,104.5899,110.1706,108.3521,119.4758,145.8365,139.5786,152.7339,193.8927,236.0672,189.1899,250.5769],
  "S&P500 BH": [100.0,91.9861,90.5226,98.1533,94.007,90.2091,86.0627,93.1707,93.9721,91.4983,96.8293,91.324,83.8676,86.3763,92.0906,92.23,96.3763,96.899,101.324,101.2544,104.216,101.0105,97.5958,102.5436,107.77,113.8676,117.5261,124.669,122.5784,125.8885,131.6376,130.7666,130.0697,130.2439,138.4669,145.5052,152.6481,153.3798,148.8502,141.5679,136.3415,141.0105,145.122,154.1463,156.3066,161.9164,169.1986,173.9373,172.4739,171.9512,171.1847,169.6516,182.2997],
  "코스피60/미채40": [100.0,94.042,94.2967,94.0799,91.917,91.2727,85.4885,89.0747,88.6447,82.9744,85.4725,87.0595,81.5196,85.5155,86.6376,88.2779,89.3719,90.8691,90.0357,89.5342,89.254,88.1531,83.9735,89.1195,93.6458,90.9892,93.5454,97.5537,95.6148,94.921,99.3292,99.2418,95.903,92.9045,92.6824,90.8898,91.2187,93.3115,94.815,95.4983,94.4715,96.5726,105.1873,109.5418,109.1441,116.4028,132.6683,131.2498,137.273,158.8838,180.8896,162.5272,191.7286],
};

const MET: Record<string, { cagr: number; mdd: number; sharpe: number; total: number }> = {
  "듀얼모멘텀":    { cagr: 30.26, mdd: -31.72, sharpe: 0.88, total: 221.46 },
  "나스닥100 BH":  { cagr: 17.35, mdd: -30.75, sharpe: 0.92, total: 102.72 },
  "코스피200 BH":  { cagr: 23.12, mdd: -29.08, sharpe: 0.81, total: 150.58 },
  "S&P500 BH":    { cagr: 14.56, mdd: -16.13, sharpe: 1.04, total: 82.30  },
  "코스피60/미채40":{ cagr: 15.88, mdd: -18.48, sharpe: 0.89, total: 91.73  },
};

const ANN: Record<string, Record<string, number>> = {
  "듀얼모멘텀":    { "2022": -25.6, "2023": 21.6, "2024": 11.1, "2025": 44.0, "2026": 102.0 },
  "나스닥100 BH":  { "2022": -22.6, "2023": 51.9, "2024": 32.5, "2025": 17.1, "2026": 9.2   },
  "코스피200 BH":  { "2022": -19.6, "2023": 14.7, "2024": -9.8, "2025": 73.6, "2026": 64.1  },
  "S&P500 BH":    { "2022": -8.7,  "2023": 22.3, "2024": 35.0, "2025": 13.9, "2026": 5.7   },
  "코스피60/미채40":{ "2022": -12.9, "2023": 9.3,  "2024": -2.9, "2025": 43.9, "2026": 39.7  },
};

const HOLDS = ["나스닥100","S&P500","단기채권","반도체","반도체","단기채권","단기채권","S&P500","S&P500","단기채권","S&P500","S&P500","단기채권","단기채권","코스닥150","코스닥150","코스닥150","코스닥150","반도체","코스닥150","반도체","나스닥100","나스닥100","반도체","반도체","나스닥100","나스닥100","반도체","반도체","나스닥100","나스닥100","S&P500","S&P500","나스닥100","나스닥100","S&P500","S&P500","나스닥100","나스닥100","S&P500","단기채권","반도체","코스피200","코스피200","코스피200","반도체","반도체","반도체","반도체","반도체","반도체","반도체","반도체"];

const HFREQ = [
  { asset: "반도체",  months: 17 },
  { asset: "나스닥100", months: 11 },
  { asset: "S&P500",  months: 10 },
  { asset: "단기채권", months: 7  },
  { asset: "코스닥150",months: 5  },
  { asset: "코스피200",months: 3  },
];

const CAT: Record<string, number> = { "국내주식": 0, "커버드콜": 0, "국내채권": 0, "원자재/기타": 0 };

// ─── Constants ────────────────────────────────────────────────────────────────
const STRAT_NAMES = Object.keys(STRAT);
const STRAT_COLORS = ["#38bdf8", "#818cf8", "#34d399", "#fb923c", "#a78bfa"];

function getCSSVar(n: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || undefined;
}

function getPlotLayout(extra?: object) {
  return {
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
    font: {
      color: getCSSVar("--text-tertiary") || "#94a3b8",
      family: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      size: 12,
    },
    margin: { t: 10, r: 10, b: 40, l: 50 },
    ...extra,
  };
}

function getGridColor() { return getCSSVar("--border-primary") || "#E5E8EB"; }

const ASSET_COLORS: Record<string, string> = {
  "나스닥100":  "#818cf8",
  "S&P500":    "#a78bfa",
  "코스피200":  "#38bdf8",
  "코스닥150":  "#22d3ee",
  "반도체":     "#fb923c",
  "미국채10년": "#34d399",
  "금":         "#b45309",
  "단기채권":   "#94a3b8",
};

const CAT_COLORS: Record<string, string> = {
  "국내주식":   "#38bdf8",
  "미국주식":   "#818cf8",
  "커버드콜":   "#fb923c",
  "국내채권":   "#34d399",
  "미국채권":   "#a78bfa",
  "원자재/기타":"#b45309",
};

const CAT_SHORT: Record<string, string> = {
  "국내주식":   "국내주",
  "커버드콜":   "커버드",
  "국내채권":   "채권",
  "원자재/기타":"원자재",
};

const SIGNAL_LABEL: Record<string, string> = { green: "상승 유지", yellow: "경고", red: "크래시 위험" };
const SIGNAL_COLOR: Record<string, string> = { green: "#34d399", yellow: "#b45309", red: "#f87171" };

const WORKER_URL = import.meta.env.VITE_WORKER_URL || "https://asset-dashboard-api.jilliankim200.workers.dev";

type CrashItem = { ticker: string; name: string; cat: string; r1m: number | null; r3m: number | null; r6m: number | null; r12m: number | null; value?: number };

// ─── Signal helpers ───────────────────────────────────────────────────────────
function getMomentumSignal(d: { r3m: number | null; r6m: number | null }): "green" | "yellow" | "red" {
  const r3m = d.r3m ?? 0;
  const r6m = d.r6m ?? 0;
  if (r3m < -5) return "red";
  if (r3m < 0 && r6m < -10) return "red";
  if (r3m > 0 && r6m > 0) return "green";
  return "yellow";
}

// ─── Component ────────────────────────────────────────────────────────────────
export function QuantDashboard() {
  const [plotlyReady, setPlotlyReady] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [dmModalOpen, setDmModalOpen] = useState(false);
  const [crashFilter, setCrashFilter] = useState<"all" | "green" | "yellow" | "red">("all");
  const [crashGuideOpen, setCrashGuideOpen] = useState(false);
  const [momData, setMomData] = useState<CrashItem[]>(MOM);
  const [crashUpdatedAt, setCrashUpdatedAt] = useState<string | null>(null);
  const [crashLoading, setCrashLoading] = useState(true);

  // Chart refs
  const refNav   = useRef<HTMLDivElement>(null);
  const refMom   = useRef<HTMLDivElement>(null);
  const refRR    = useRef<HTMLDivElement>(null);
  const refAnn   = useRef<HTMLDivElement>(null);
  const refHold  = useRef<HTMLDivElement>(null);
  const refDonut = useRef<HTMLDivElement>(null);

  // Fetch real-time crash signals from Worker KV
  useEffect(() => {
    fetch(`${WORKER_URL}/kv/crash_signals`)
      .then(r => r.json())
      .then((res: { data: CrashItem[]; updatedAt: string } | null) => {
        if (res?.data?.length) {
          setMomData(res.data);
          setCrashUpdatedAt(res.updatedAt);
        }
      })
      .catch(() => {})
      .finally(() => setCrashLoading(false));
  }, []);

  // Track dark mode changes
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    obs.observe(document.documentElement, { attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  // Load Plotly
  useEffect(() => {
    if ((window as any).Plotly) { setPlotlyReady(true); return; }
    const script = document.createElement("script");
    script.src = "https://cdn.plot.ly/plotly-2.32.0.min.js";
    script.charset = "utf-8";
    script.onload = () => setPlotlyReady(true);
    document.head.appendChild(script);
  }, []);

  // Escape key closes modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setDmModalOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Initialize all charts — re-renders on dark/light switch
  useEffect(() => {
    if (!plotlyReady) return;
    const Plotly = (window as any).Plotly;
    const layout = getPlotLayout();
    const gridColor = getGridColor();

    // Chart 1: Cumulative Return (NAV)
    if (refNav.current) {
      const navTraces = STRAT_NAMES.map((name, ci) => ({
        x: BT_M,
        y: STRAT[name],
        name,
        type: "scatter",
        mode: "lines",
        line: {
          color: STRAT_COLORS[ci],
          width: ci === 0 ? 2.5 : 1.5,
          dash: ci === 0 ? "solid" : ci === 1 ? "solid" : "dot",
        },
        hovertemplate: "%{x}<br>" + name + ": <b>%{y:.1f}</b><extra></extra>",
      }));
      Plotly.newPlot(refNav.current, navTraces, {
        ...layout,
        margin: { t: 10, r: 20, b: 50, l: 55 },
        xaxis: { gridcolor: gridColor, tickformat: "%Y-%m", nticks: 12 },
        yaxis: { gridcolor: gridColor, ticksuffix: "" },
        legend: { orientation: "h", y: -0.2, x: 0.5, xanchor: "center", font: { size: 11 } },
        hovermode: "x unified",
      }, { responsive: true, displayModeBar: false });
    }

    // Chart 2: ETF Momentum Bar
    if (refMom.current) {
      const displayMom = MOM.slice(0, 35);
      const momY = displayMom.map(d => d.ticker + " " + (d.name || ""));
      const momX = displayMom.map(d => d.r3m);
      const momColors = displayMom.map(d => d.r3m >= 0 ? "#34d399" : "#f87171");
      const momOpacity = displayMom.map(d => Math.min(0.4 + Math.abs(d.r3m) / 30, 1.0));
      const fontColor = getCSSVar("--text-tertiary") || "#94a3b8";
      Plotly.newPlot(refMom.current, [{
        type: "bar",
        orientation: "h",
        x: momX,
        y: momY,
        marker: { color: momColors, opacity: momOpacity, line: { color: momColors, width: 0.5 } },
        hovertemplate: "<b>%{y}</b><br>3M: %{x:.1f}%<extra></extra>",
        text: displayMom.map(d => d.r3m >= 0 ? "+" + d.r3m + "%" : d.r3m + "%"),
        textposition: "outside",
        textfont: { size: 10, color: fontColor },
        cliponaxis: false,
      }], {
        ...layout,
        margin: { t: 10, r: 60, b: 40, l: 160 },
        xaxis: { gridcolor: gridColor, zeroline: true, zerolinecolor: gridColor, ticksuffix: "%" },
        yaxis: { gridcolor: "transparent", automargin: true, tickfont: { size: 11 } },
        bargap: 0.25,
      }, { responsive: true, displayModeBar: false });
    }

    // Chart 3: Risk/Return Scatter
    if (refRR.current) {
      const rrTraces = STRAT_NAMES.map((name, ci) => {
        const m = MET[name];
        return {
          type: "scatter",
          mode: "markers+text",
          x: [m.mdd],
          y: [m.cagr],
          name,
          text: [name],
          textposition: "top center",
          textfont: { size: 11, color: STRAT_COLORS[ci] },
          marker: {
            size: Math.max(14, m.sharpe * 14),
            color: STRAT_COLORS[ci],
            opacity: 0.8,
            line: { width: 1.5, color: STRAT_COLORS[ci] },
          },
          hovertemplate: `<b>${name}</b><br>CAGR: %{y:.2f}%<br>MDD: %{x:.2f}%<br>Sharpe: ${m.sharpe}<extra></extra>`,
        };
      });
      Plotly.newPlot(refRR.current, rrTraces, {
        ...layout,
        margin: { t: 20, r: 20, b: 45, l: 50 },
        xaxis: { gridcolor: gridColor, title: "MDD (%)", autorange: "reversed", ticksuffix: "%" },
        yaxis: { gridcolor: gridColor, title: "CAGR (%)", ticksuffix: "%" },
        showlegend: false,
      }, { responsive: true, displayModeBar: false });
    }

    // Chart 4: Annual Returns
    if (refAnn.current) {
      const allYears = Array.from(new Set(
        STRAT_NAMES.flatMap(n => Object.keys(ANN[n]))
      )).sort();
      const annTraces = STRAT_NAMES.map((name, ci) => ({
        type: "bar",
        name,
        x: allYears,
        y: allYears.map(yr => ANN[name][yr] ?? null),
        marker: { color: STRAT_COLORS[ci], opacity: 0.8 },
        hovertemplate: "%{x}: <b>%{y:.1f}%</b><extra>" + name + "</extra>",
      }));
      Plotly.newPlot(refAnn.current, annTraces, {
        ...layout,
        margin: { t: 10, r: 10, b: 50, l: 50 },
        xaxis: { gridcolor: gridColor },
        yaxis: { gridcolor: gridColor, ticksuffix: "%", zeroline: true, zerolinecolor: gridColor },
        barmode: "group",
        bargap: 0.15,
        bargroupgap: 0.05,
        legend: { orientation: "h", y: -0.25, x: 0.5, xanchor: "center", font: { size: 10 } },
      }, { responsive: true, displayModeBar: false });
    }

    // Chart 5: Holdings Timeline
    if (refHold.current) {
      const assetList = [...new Set(HOLDS)];
      const holdTraces = assetList.map(asset => ({
        type: "bar",
        name: asset,
        x: BT_M,
        y: HOLDS.map(h => (h === asset ? 1 : 0)),
        marker: { color: ASSET_COLORS[asset] || "#94a3b8", opacity: 0.85 },
        hovertemplate: "%{x}: <b>" + asset + "</b><extra></extra>",
      }));
      Plotly.newPlot(refHold.current, holdTraces, {
        ...layout,
        margin: { t: 10, r: 10, b: 50, l: 30 },
        barmode: "stack",
        xaxis: { gridcolor: gridColor, nticks: 12 },
        yaxis: { gridcolor: "transparent", showticklabels: false, range: [0, 1.1] },
        legend: { orientation: "h", y: -0.25, x: 0.5, xanchor: "center", font: { size: 11 } },
      }, { responsive: true, displayModeBar: false });
    }

    // Chart 6: Portfolio Donut
    if (refDonut.current) {
      const catLabels = Object.keys(CAT);
      const catVals = catLabels.map(k => CAT[k]);
      const catColors = catLabels.map(k => CAT_COLORS[k] || "#94a3b8");
      Plotly.newPlot(refDonut.current, [{
        type: "pie",
        labels: catLabels,
        values: catVals,
        hole: 0.52,
        marker: { colors: catColors, line: { color: "transparent", width: 2 } },
        textinfo: "label+percent",
        textfont: { size: 11 },
        hovertemplate: "<b>%{label}</b><br>%{value:,.0f}원<br>%{percent}<extra></extra>",
      }], {
        ...layout,
        margin: { t: 20, r: 10, b: 20, l: 10 },
        showlegend: false,
      }, { responsive: true, displayModeBar: false });
    }

    return () => {
      [refNav, refMom, refRR, refAnn, refHold, refDonut].forEach(ref => {
        if (ref.current) { try { Plotly.purge(ref.current); } catch (_) {} }
      });
    };
  }, [plotlyReady, isDark]);

  // ─── Crash detection data ─────────────────────────────────────────────────
  const signalData = momData.map(d => ({ ...d, signal: getMomentumSignal(d) }));
  const sigCounts = { green: 0, yellow: 0, red: 0 };
  signalData.forEach(d => { sigCounts[d.signal]++; });
  const filteredSignals = crashFilter === "all" ? signalData : signalData.filter(d => d.signal === crashFilter);

  const fmt = (v: number | null) => v === null ? "N/A" : (v >= 0 ? "+" : "") + v.toFixed(1) + "%";

  // ─── Panel style ──────────────────────────────────────────────────────────
  const panelStyle: React.CSSProperties = {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border-primary)",
    borderRadius: 10,
    padding: 16,
  };

  const panelTitleStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-tertiary)",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    marginBottom: 4,
  };

  const panelSubStyle: React.CSSProperties = {
    fontSize: 12,
    color: "var(--text-tertiary)",
    marginBottom: 12,
  };

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>

      {/* ── 듀얼 모멘텀 모달 ── */}
      {dmModalOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setDmModalOpen(false); }}
          style={{
            position: "fixed", inset: 0, zIndex: 2000,
            background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-primary)",
            borderRadius: 14,
            width: "100%", maxWidth: 680, maxHeight: "88vh", overflowY: "auto",
            boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
          }}>
            {/* Modal header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "20px 24px 16px",
              borderBottom: "1px solid var(--border-primary)",
              position: "sticky", top: 0, background: "var(--bg-elevated)", zIndex: 1,
            }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.3px", margin: 0 }}>
                  듀얼 모멘텀 전략
                </h3>
                <span style={{
                  fontSize: 11, background: "rgba(56,189,248,.15)", color: "#38bdf8",
                  border: "1px solid rgba(56,189,248,.3)", borderRadius: 20,
                  padding: "2px 10px", marginLeft: 8,
                }}>Gary Antonacci, 2014</span>
              </div>
              <button
                onClick={() => setDmModalOpen(false)}
                style={{
                  width: 28, height: 28, borderRadius: 6, border: "none",
                  background: "var(--bg-tertiary)", color: "var(--text-tertiary)", fontSize: 16, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >✕</button>
            </div>

            {/* Modal body */}
            <div style={{ padding: "20px 24px 28px" }}>
              <div style={{
                fontSize: 15, color: "var(--text-secondary)", background: "rgba(56,189,248,.08)",
                borderLeft: "3px solid #38bdf8", borderRadius: "0 8px 8px 0",
                padding: "12px 16px", marginBottom: 22, lineHeight: 1.7,
              }}>
                <strong>"오르는 자산 중 가장 많이 오른 것을 사고,<br />전부 하락 중이면 안전자산으로 피한다"</strong>
              </div>

              {/* 두 가지 모멘텀 */}
              <div style={{ marginBottom: 22 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8", letterSpacing: ".6px", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "block", width: 3, height: 14, background: "#38bdf8", borderRadius: 2 }} />
                  두 가지 모멘텀의 결합
                </h4>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {["모멘텀","역할","질문"].map(h => (
                        <th key={h} style={{ background: "var(--bg-secondary)", color: "var(--text-tertiary)", fontSize: 11, fontWeight: 600, letterSpacing: ".05em", padding: "8px 12px", textAlign: "left", borderBottom: "1px solid var(--border-primary)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}><strong style={{ color: "#38bdf8" }}>① 상대 모멘텀</strong></td>
                      <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}>위험자산 5개 중 <strong>무엇을</strong> 살지 결정</td>
                      <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}>6개월 수익률 1위는 누구인가?</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "9px 12px", color: "var(--text-secondary)" }}><strong style={{ color: "#a78bfa" }}>② 절대 모멘텀</strong></td>
                      <td style={{ padding: "9px 12px", color: "var(--text-secondary)" }}><strong>살지 말지</strong> 결정 (시장 전체 하락 시 대피)</td>
                      <td style={{ padding: "9px 12px", color: "var(--text-secondary)" }}>1위 자산의 6M 수익률 &gt; 0% 인가?</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 매월 작동 방식 */}
              <div style={{ marginBottom: 22 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8", letterSpacing: ".6px", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "block", width: 3, height: 14, background: "#38bdf8", borderRadius: 2 }} />
                  매월 작동 방식
                </h4>
                {[
                  "위험자산 5개(나스닥100·S&P500·코스피200·코스닥150·반도체)의 <strong>6개월 수익률</strong>을 계산",
                  "<strong>상대 모멘텀:</strong> 1위 자산을 선택 → 현재 반도체 +117.3%로 1위",
                  "<strong>절대 모멘텀:</strong> 1위 자산의 6M 수익률 &gt; 0% 이면 매수, 아니면 단기채권으로 전환",
                  "다음 달 말 동일 과정 반복 — <strong>월 1회 리밸런싱</strong>",
                ].map((txt, i) => (
                  <div key={i} style={{ display: "flex", gap: 14, marginBottom: 10, alignItems: "flex-start" }}>
                    <div style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", background: "#38bdf8", color: "var(--bg-primary)", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>{i + 1}</div>
                    <div style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: txt }} />
                  </div>
                ))}
              </div>

              {/* 왜 두 개인가 */}
              <div style={{ marginBottom: 22 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8", letterSpacing: ".6px", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "block", width: 3, height: 14, background: "#38bdf8", borderRadius: 2 }} />
                  왜 하나만 쓰면 안 되는가
                </h4>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {["방식","문제점"].map(h => (
                        <th key={h} style={{ background: "var(--bg-secondary)", color: "var(--text-tertiary)", fontSize: 11, fontWeight: 600, letterSpacing: ".05em", padding: "8px 12px", textAlign: "left", borderBottom: "1px solid var(--border-primary)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}>상대 모멘텀만</td>
                      <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}>전체 시장이 폭락해도 "그나마 덜 빠진 것"을 강제 매수 → 손실</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}>절대 모멘텀만</td>
                      <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}>어떤 자산을 살지 기준이 없음</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "9px 12px", color: "var(--text-secondary)" }}><strong style={{ color: "#34d399" }}>둘을 결합</strong></td>
                      <td style={{ padding: "9px 12px", color: "var(--text-secondary)" }}>상방은 최강 자산 포착, 하방은 채권으로 대피 → <strong style={{ color: "#34d399" }}>비대칭 수익 구조</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 쉬운 비유 */}
              <div style={{ marginBottom: 22 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8", letterSpacing: ".6px", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "block", width: 3, height: 14, background: "#38bdf8", borderRadius: 2 }} />
                  쉬운 비유
                </h4>
                <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: 10, padding: "14px 16px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                  육상 대회에서 선수 5명이 달리고 있습니다.<br /><br />
                  <strong style={{ color: "#b45309" }}>상대 모멘텀</strong> = "5명 중 <strong style={{ color: "#b45309" }}>1등 선수를 응원</strong>해라"<br />
                  <strong style={{ color: "#b45309" }}>절대 모멘텀</strong> = "그런데 1등 선수도 <strong style={{ color: "#b45309" }}>출발선보다 뒤로 가고 있으면</strong>(역주행), 관중석에 앉아서 기다려라"
                </div>
              </div>

              {/* 통계적 근거 */}
              <div style={{ marginBottom: 22 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8", letterSpacing: ".6px", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "block", width: 3, height: 14, background: "#38bdf8", borderRadius: 2 }} />
                  통계적 근거
                </h4>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {["연구","내용"].map(h => (
                        <th key={h} style={{ background: "var(--bg-secondary)", color: "var(--text-tertiary)", fontSize: 11, fontWeight: 600, letterSpacing: ".05em", padding: "8px 12px", textAlign: "left", borderBottom: "1px solid var(--border-primary)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Jegadeesh & Titman (1993)", "3~12개월 모멘텀이 통계적으로 유의미한 초과수익 발생을 최초 입증"],
                      ["Antonacci (2014)", "1927년 이후 데이터에서 듀얼 모멘텀이 단순 BH 대비 MDD를 줄이면서 수익 우위"],
                      ["행동재무학", "투자자 과잉반응 + 뒤늦은 추격매수 → 모멘텀 프리미엄이 지속적으로 발생"],
                    ].map(([study, desc], i, arr) => (
                      <tr key={study}>
                        <td style={{ padding: "9px 12px", borderBottom: i < arr.length - 1 ? "1px solid var(--border-primary)" : "none", color: "var(--text-secondary)" }}>{study}</td>
                        <td style={{ padding: "9px 12px", borderBottom: i < arr.length - 1 ? "1px solid var(--border-primary)" : "none", color: "var(--text-secondary)" }}>{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 적용 결과 */}
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8", letterSpacing: ".6px", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "block", width: 3, height: 14, background: "#38bdf8", borderRadius: 2 }} />
                  이 포트폴리오 적용 결과 (2021-07 ~ 2026-05)
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { label: "듀얼모멘텀 누적수익률", val: "+1,254%", valColor: "#34d399", sub: "수수료+슬리피지 0.13% 반영" },
                    { label: "S&P500 단순보유 대비",  val: "+1,136%p", valColor: "#38bdf8", sub: "S&P500 BH +118% 대비 초과수익" },
                    { label: "CAGR (연복리)",          val: "69.9%",   valColor: "#34d399", sub: "S&P500 BH 17.6% 대비 4배" },
                    { label: "MDD (최대낙폭)",          val: "-17.6%",  valColor: "#b45309", sub: "반도체 BH -43.8% 대비 절반 수준" },
                  ].map(({ label, val, valColor, sub }) => (
                    <div key={label} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: 8, padding: "12px 14px" }}>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: valColor }}>{val}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>{sub}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-tertiary)", textAlign: "right" }}>
                  ※ 현재 신호: <strong style={{ color: "#fb923c" }}>반도체 ETF (091160.KS)</strong> 보유 — 다음 리밸런싱 2026-06
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 페이지 헤더 ── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.3px", margin: 0 }}>
          퀀트 분석 대시보드{" "}
          <span style={{
            display: "inline-block", background: "var(--bg-secondary)", border: "1px solid var(--border-primary)",
            borderRadius: 12, padding: "2px 10px", fontSize: 12, color: "var(--text-tertiary)",
            marginLeft: 10, verticalAlign: "middle",
          }}>듀얼 모멘텀 전략</span>
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>
          백테스트 기간: 2022-01 ~ 2026-05 &nbsp;|&nbsp; 분석 ETF: 43종목 &nbsp;|&nbsp; 리밸런싱: 월 1회 &nbsp;|&nbsp; 룩백: 6개월
        </p>
      </div>

      {/* ── 메트릭 카드 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 20 }}>
        {STRAT_NAMES.map((name, ci) => {
          const m = MET[name];
          return (
            <div key={name} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 12, color: STRAT_COLORS[ci], marginBottom: 6, display: "flex", alignItems: "center" }}>
                {name}
                {ci === 0 && (
                  <span
                    onClick={() => setDmModalOpen(true)}
                    title="듀얼 모멘텀 전략 설명"
                    style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 16, height: 16, borderRadius: "50%",
                      background: "rgba(56,189,248,0.18)", border: "1px solid rgba(56,189,248,0.5)",
                      color: "#38bdf8", fontSize: 10, fontWeight: 700,
                      cursor: "pointer", marginLeft: 6,
                    }}
                  >i</span>
                )}
              </div>
              <div style={{ fontSize: 19, fontWeight: 700, color: m.total >= 0 ? "#34d399" : "#f87171" }}>
                {m.total >= 0 ? "+" : ""}{m.total}%
              </div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                CAGR {m.cagr >= 0 ? "+" : ""}{m.cagr}% &nbsp;|&nbsp; MDD {m.mdd}%
              </div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>샤프 {m.sharpe}</div>
            </div>
          );
        })}
      </div>

      {/* ── 모멘텀 크래시 감지 ── */}
      <div style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={panelTitleStyle}>
          모멘텀 크래시 감지{" "}
          <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
            | 기준: {crashLoading ? "로딩 중…" : (crashUpdatedAt ?? "캐시")} &nbsp;·&nbsp; 3M/6M 수익률 기반
          </span>
        </div>
        <div style={panelSubStyle}>
          상승 유지 (3M&gt;0 &amp; 6M&gt;0) &nbsp;/&nbsp; 경고 (혼재 또는 약세) &nbsp;/&nbsp; 크래시 위험 (3M&lt;-5% 또는 3M&amp;6M 동반 하락)
        </div>

        {/* 신호 기준 범례 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
          {(["green","yellow","red"] as const).map(sig => {
            const colors: Record<string, { bg: string; border: string; titleColor: string; action: string; actionBg: string }> = {
              green:  { bg: "rgba(52,211,153,.06)",  border: "rgba(52,211,153,.3)",  titleColor: "#34d399", action: "HOLD / ADD",       actionBg: "rgba(52,211,153,.15)"  },
              yellow: { bg: "rgba(251,191,36,.06)",   border: "rgba(251,191,36,.3)",  titleColor: "#b45309", action: "WATCH",            actionBg: "rgba(251,191,36,.15)"  },
              red:    { bg: "rgba(248,113,113,.06)",  border: "rgba(248,113,113,.3)", titleColor: "#f87171", action: "REDUCE / EXIT",    actionBg: "rgba(248,113,113,.15)" },
            };
            const dotColors: Record<string, string> = { green: "#34d399", yellow: "#b45309", red: "#f87171" };
            const rules: Record<string, string[]> = {
              green:  ["✓ 3개월 수익률 > 0%", "✓ 6개월 수익률 > 0%"],
              yellow: ["△ 3M>0 이지만 6M<0 (단기 반등)", "△ 3M<0 이지만 -5% 이내"],
              red:    ["✗ 3개월 수익률 < -5%", "✗ 3M<0 & 6M < -10% 동반 하락"],
            };
            const descs: Record<string, string> = {
              green:  "중기·장기 추세 모두 양수\n모멘텀 건재, 추가 매수 또는 보유",
              yellow: "혼재 신호, 추세 확인 필요\n신규 매수 자제, 포지션 축소 검토",
              red:    "모멘텀 붕괴 신호\n손절·비중 축소 적극 검토",
            };
            const c = colors[sig];
            return (
              <div key={sig} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: dotColors[sig], boxShadow: `0 0 6px ${dotColors[sig]}80`, flexShrink: 0 }} />
                  <span style={{ color: c.titleColor }}>{SIGNAL_LABEL[sig]}</span>
                </div>
                {rules[sig].map(r => (
                  <div key={r} style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.6 }}>{r}</div>
                ))}
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.6, marginBottom: 4, whiteSpace: "pre-line" }}>{descs[sig]}</div>
                <span style={{ fontSize: 11, fontWeight: 600, marginTop: 6, padding: "3px 8px", borderRadius: 4, display: "inline-block", background: c.actionBg, color: dotColors[sig] }}>{c.action}</span>
              </div>
            );
          })}
        </div>

        {/* 요약 + 필터 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {(["green","yellow","red"] as const).map(sig => (
              <div key={sig} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: SIGNAL_COLOR[sig], boxShadow: `0 0 6px ${SIGNAL_COLOR[sig]}80`, flexShrink: 0 }} />
                <span style={{ color: SIGNAL_COLOR[sig], fontWeight: 800, fontSize: 22, lineHeight: 1 }}>{sigCounts[sig]}</span>
                <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>{SIGNAL_LABEL[sig]}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["all","green","yellow","red"] as const).map(f => {
              const labels: Record<string, string> = { all: "전체", green: "상승 유지", yellow: "경고", red: "위험" };
              const isActive = crashFilter === f;
              return (
                <button
                  key={f}
                  onClick={() => setCrashFilter(f)}
                  style={{
                    padding: "5px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                    border: `1px solid ${isActive ? "var(--accent-blue)" : "var(--border-primary)"}`,
                    background: isActive ? "var(--accent-blue-bg)" : "var(--bg-primary)",
                    color: isActive ? "var(--accent-blue)" : "var(--text-tertiary)",
                  }}
                >{labels[f]}</button>
              );
            })}
          </div>
        </div>

        {/* 필터별 인라인 대응 가이드 */}
        {crashFilter !== 'all' && (() => {
          const guides: Record<string, {
            color: string; bg: string; border: string;
            title: string; subtitle: string;
            items: [string, string, string][];
            extra?: React.ReactNode;
          }> = {
            red: {
              color: '#f87171', bg: 'rgba(248,113,113,.05)', border: 'rgba(248,113,113,.25)',
              title: '🔴 위험 — 즉시 대응',
              subtitle: '모멘텀이 실질적으로 붕괴된 상태입니다. 다음 리밸런싱을 기다리지 말고 즉시 대응하세요.',
              items: [
                ['1', '즉시 비중 50% 이상 축소', '다음 리밸런싱 주기 무시'],
                ['2', '전량 청산 기준', '3M < -10% 이하면 지체 없이 손절'],
                ['3', '안전자산 이동', 'KOFR ETF · 국고채 단기물로 이동'],
                ['4', '재진입 금지', '3M AND 6M 모두 플러스 복귀 전까지 진입 금지'],
                ['5', '포트폴리오 전체 점검', '하나가 위험이면 연동 하락 종목 동시 확인'],
              ],
            },
            yellow: {
              color: '#b45309', bg: 'rgba(251,191,36,.05)', border: 'rgba(251,191,36,.25)',
              title: '🟡 경고 — 점진적 위험 축소',
              subtitle: '청산 신호가 아닌 신규 베팅 중단 + 점진적 위험 축소 신호입니다.',
              items: [
                ['1', '신규 매수 즉시 중단', '경고 종목에 추가 자금 투입 금지'],
                ['2', '비중 10~20% 점진 축소', '즉각 청산 아닌 다음 월 리밸런싱 시 실행'],
                ['3', '트리거 재확인', '다음 리뷰 시 6M 마이너스 전환 여부 체크'],
                ['4', '안전자산 대기', '축소분은 MMF · 단기채로 이동, 반등 시 재진입 대기'],
              ],
            },
            green: {
              color: '#34d399', bg: 'rgba(52,211,153,.05)', border: 'rgba(52,211,153,.25)',
              title: '🟢 상승 유지 — 보유 원칙',
              subtitle: '신호가 바뀔 때까지 보유가 모멘텀 전략의 핵심 규칙입니다. 3M > 0% AND 6M > 0%인 한 계속 보유합니다.',
              items: [
                ['1', '매월 리뷰 후 보유 유지', '신호 변화 없으면 리밸런싱 불필요'],
                ['2', '추가 매수 가능', '모멘텀 강도가 높을수록 비중 유지 또는 소폭 증가'],
                ['3', 'yellow 전환 시 즉시 주의', '한 달 만에 green → yellow 전환되면 경고 가이드 적용'],
                ['4', '과도한 집중 주의', '단일 종목 비중이 30% 초과 시 분산 검토'],
              ],
              extra: (
                <div style={{ marginTop: 12, background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 8 }}>리밸런싱 주기별 특성</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 16px', fontSize: 12 }}>
                    {([['월 1회 (표준)', '#34d399', '거래비용 최소, 과최적화 방지'], ['격주', '#b45309', '빠른 대응이나 신호 노이즈 증가'], ['매주', '#f87171', '과매매 위험, 비용 구조 악화']] as const).map(([p, c, d]) => (
                      <React.Fragment key={p}>
                        <span style={{ color: c, fontWeight: 700 }}>{p}</span>
                        <span style={{ color: 'var(--text-tertiary)' }}>{d}</span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ),
            },
          };
          const g = guides[crashFilter];
          if (!g) return null;
          return (
            <div style={{ marginBottom: 14, background: g.bg, border: `1px solid ${g.border}`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: g.color, marginBottom: 5 }}>{g.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 10 }}>{g.subtitle}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {g.items.map(([n, title, desc]) => (
                  <div key={n} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: g.color, background: `${g.color}20`, borderRadius: 4, padding: '1px 7px', flexShrink: 0, marginTop: 1 }}>{n}</span>
                    <div style={{ fontSize: 12 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
                      <span style={{ color: 'var(--text-tertiary)' }}> — {desc}</span>
                    </div>
                  </div>
                ))}
              </div>
              {g.extra}
            </div>
          );
        })()}

        {/* 대응 가이드 아코디언 */}
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={() => setCrashGuideOpen(v => !v)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "rgba(56,189,248,.06)", border: "1px solid rgba(56,189,248,.2)",
              borderRadius: crashGuideOpen ? "8px 8px 0 0" : 8, padding: "10px 16px",
              cursor: "pointer", color: "#38bdf8", fontSize: 13, fontWeight: 700,
            }}
          >
            <span>신호별 대응 가이드 &amp; 상승유지 기준</span>
            <span style={{ fontSize: 16, lineHeight: 1 }}>{crashGuideOpen ? "▲" : "▼"}</span>
          </button>
          <div style={{
            overflow: "hidden", maxHeight: crashGuideOpen ? 1200 : 0,
            transition: "max-height 0.3s ease",
            background: "var(--bg-primary)", border: crashGuideOpen ? "1px solid rgba(56,189,248,.2)" : "none",
            borderTop: "none", borderRadius: "0 0 8px 8px",
          }}>
            <div style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: 16 }}>

              {/* 경고 대응 */}
              <div style={{ borderLeft: "3px solid #b45309", paddingLeft: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#b45309", marginBottom: 8 }}>경고 시 대응</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.9 }}>
                  경고는 <span style={{ color: "#b45309", fontWeight: 600 }}>청산 신호가 아닌 신규 베팅 중단 + 점진적 위험 축소</span> 신호입니다.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                  {[
                    ["1", "신규 매수 즉시 중단", "경고 종목에 추가 자금 투입 금지"],
                    ["2", "다음 월 리밸런싱 시 비중 10~20% 축소", "즉각 청산 아닌 점진적 감소"],
                    ["3", "트리거 재확인", "다음 리뷰 시점에 6M 마이너스 전환 여부 체크"],
                    ["4", "안전자산 대기", "축소분은 MMF·단기채로 이동, 반등 시 재진입 대기"],
                  ].map(([n, title, desc]) => (
                    <div key={n} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#b45309", background: "rgba(251,191,36,.15)", borderRadius: 4, padding: "1px 7px", flexShrink: 0, marginTop: 1 }}>{n}</span>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{title}</span>
                        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}> — {desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 위험 대응 */}
              <div style={{ borderLeft: "3px solid #f87171", paddingLeft: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f87171", marginBottom: 8 }}>위험 시 대응</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.9 }}>
                  모멘텀이 실질적으로 붕괴된 상태입니다. <span style={{ color: "#f87171", fontWeight: 600 }}>다음 리밸런싱을 기다리지 말고 즉시 대응</span>하세요.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                  {[
                    ["1", "즉시 비중 50% 이상 축소", "다음 리밸런싱 주기 무시"],
                    ["2", "전량 청산 기준", "3M < -10% 이하면 지체 없이 손절"],
                    ["3", "안전자산 이동", "KOFR ETF·국고채 단기물로 피신"],
                    ["4", "재진입 기준 명확히", "3M AND 6M 모두 플러스 복귀 전까지 진입 금지"],
                    ["5", "포트폴리오 전체 점검", "하나가 red이면 연동 하락 종목 동시 확인"],
                  ].map(([n, title, desc]) => (
                    <div key={n} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#f87171", background: "rgba(248,113,113,.15)", borderRadius: 4, padding: "1px 7px", flexShrink: 0, marginTop: 1 }}>{n}</span>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{title}</span>
                        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}> — {desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 상승유지 기간 */}
              <div style={{ borderLeft: "3px solid #34d399", paddingLeft: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#34d399", marginBottom: 8 }}>상승유지 — 언제까지?</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.9, marginBottom: 10 }}>
                  <span style={{ color: "#34d399", fontWeight: 600 }}>신호가 바뀔 때까지 보유</span>가 모멘텀 전략의 핵심 규칙입니다.<br />
                  3M &gt; 0% AND 6M &gt; 0%인 한, 매월 리뷰 후 계속 보유합니다.
                </div>
                <div style={{ background: "var(--bg-secondary)", borderRadius: 6, padding: "10px 14px", marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 6, fontWeight: 600 }}>리밸런싱 주기별 특성</div>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 16px", fontSize: 12 }}>
                    {[
                      ["월 1회 (표준)", "#34d399", "거래비용 최소, 과최적화 방지"],
                      ["격주", "#b45309", "빠른 대응이나 신호 노이즈 증가"],
                      ["매주", "#f87171", "과매매 위험, 비용 구조 악화"],
                    ].map(([period, color, desc]) => (
                      <>
                        <span key={period + "k"} style={{ color: color as string, fontWeight: 600 }}>{period}</span>
                        <span key={period + "v"} style={{ color: "var(--text-tertiary)" }}>{desc}</span>
                      </>
                    ))}
                  </div>
                </div>
              </div>

              {/* 퀀트 관점 */}
              <div style={{ borderLeft: "3px solid #818cf8", paddingLeft: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#818cf8", marginBottom: 8 }}>퀀트 관점 — 이 신호의 한계</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.9, marginBottom: 10 }}>
                  3M·6M 수익률은 <span style={{ color: "#818cf8", fontWeight: 600 }}>후행 지표(Lagging)</span>입니다.
                  크래시 초반에는 green → yellow로만 보이다가 너무 늦게 red로 진입할 수 있습니다.
                </div>
                <div style={{ background: "var(--bg-secondary)", borderRadius: 6, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, marginBottom: 8 }}>조기경보 보조 필터 (강화 제안)</div>
                  {[
                    ["전고점 대비 낙폭", "−20% 이상이면 red 조기 진입"],
                    ["52주 저가 근접", "현재가 < 52주 저가의 110%"],
                    ["VIX 급등", "VIX 30 이상 + 3M < 0 동시 충족 시 즉각 red"],
                  ].map(([label, desc]) => (
                    <div key={label} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, flexShrink: 0 }}>+</span>
                      <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 600 }}>{label}</span>
                      <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>— {desc}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* 시그널 카드 그리드 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12 }}>
          {filteredSignals.map(d => {
            const r3c = d.r3m >= 0 ? "#34d399" : "#f87171";
            const r6c = d.r6m >= 0 ? "#34d399" : "#f87171";
            const borderColors: Record<string, string> = { green: "#34d399", yellow: "#b45309", red: "#f87171" };
            const dotC = borderColors[d.signal];
            return (
              <div key={d.ticker} style={{
                background: "var(--bg-primary)", border: "1px solid var(--border-primary)",
                borderLeft: `4px solid ${dotC}`, borderRadius: 10,
                padding: "16px 18px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: dotC, boxShadow: `0 0 6px ${dotC}80`, flexShrink: 0 }} />
                    <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={d.name}>{d.name}</span>
                  </div>
                  <span style={{ fontSize: 10, color: "var(--text-tertiary)", background: "var(--bg-secondary)", borderRadius: 4, padding: "2px 7px", flexShrink: 0 }}>
                    {CAT_SHORT[d.cat] || d.cat}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 12 }}>{d.ticker}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div style={{ background: "var(--bg-secondary)", borderRadius: 6, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 2 }}>3개월</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: r3c }}>{fmt(d.r3m)}</div>
                  </div>
                  <div style={{ background: "var(--bg-secondary)", borderRadius: 6, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 2 }}>6개월</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: r6c }}>{fmt(d.r6m)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 누적 수익률 ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={panelStyle}>
          <div style={panelTitleStyle}>전략별 누적 수익률</div>
          <div style={panelSubStyle}>초기 자산 100 기준, 월간 리밸런싱</div>
          <div ref={refNav} style={{ width: "100%", height: 320 }} />
        </div>
      </div>

      {/* ── ETF 모멘텀 ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={panelStyle}>
          <div style={panelTitleStyle}>포트폴리오 ETF 모멘텀 (3개월 수익률 기준)</div>
          <div style={panelSubStyle}>보유 43개 종목 정렬 — 초록: 상승모멘텀 / 빨강: 하락모멘텀</div>
          <div ref={refMom} style={{ width: "100%", height: 480 }} />
        </div>
      </div>

      {/* ── 리스크/리턴 + 연도별 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={panelStyle}>
          <div style={panelTitleStyle}>리스크/리턴 비교 (연복리 vs 최대낙폭)</div>
          <div style={panelSubStyle}>버블 크기 = 샤프지수</div>
          <div ref={refRR} style={{ width: "100%", height: 300 }} />
        </div>
        <div style={panelStyle}>
          <div style={panelTitleStyle}>연도별 수익률 비교</div>
          <div style={panelSubStyle}>전략별 연간 퍼포먼스</div>
          <div ref={refAnn} style={{ width: "100%", height: 300 }} />
        </div>
      </div>

      {/* ── 보유 타임라인 + 도넛 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={panelStyle}>
          <div style={panelTitleStyle}>듀얼 모멘텀 — 월별 보유 자산</div>
          <div style={panelSubStyle}>매월 초 시그널 기준 보유 자산 전환</div>
          <div ref={refHold} style={{ width: "100%", height: 300 }} />
        </div>
        <div style={panelStyle}>
          <div style={panelTitleStyle}>포트폴리오 구성 (평가금액 기준)</div>
          <div style={panelSubStyle}>카테고리별 비중</div>
          <div ref={refDonut} style={{ width: "100%", height: 300 }} />
        </div>
      </div>

      {/* ── 자산 보유 빈도 요약 ── */}
      <div style={panelStyle}>
        <div style={panelTitleStyle}>보유 자산 빈도</div>
        <div style={panelSubStyle}>전체 {BT_M.length}개월 중 각 자산 보유 개월 수</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {HFREQ.map(({ asset, months }) => (
            <div key={asset} style={{ background: "var(--bg-primary)", border: "1px solid var(--border-primary)", borderRadius: 8, padding: "10px 14px", minWidth: 100 }}>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4 }}>{asset}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: ASSET_COLORS[asset] || "var(--text-tertiary)" }}>{months}<span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-tertiary)" }}>개월</span></div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
