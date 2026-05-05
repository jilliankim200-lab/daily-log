import { useEffect, useRef, useState } from "react";
import { kvGet } from "../api";

const S: Record<string, React.CSSProperties> = {
  wrap:    { display: "flex", gap: 0, minHeight: "100%", position: "relative" },
  toc:     { width: 180, flexShrink: 0, position: "sticky", top: 0, height: "calc(100vh - 60px)",
             overflowY: "auto", padding: "28px 12px", borderRight: "1px solid var(--border-primary)" },
  tocTitle:{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.08em",
             textTransform: "uppercase" as const, marginBottom: 10 },
  tocSep:  { height: 1, background: "var(--border-primary)", margin: "8px 0" },
  content: { flex: 1, padding: "36px 44px 60px", maxWidth: 860, overflowY: "auto" },
  secLabel:{ fontSize: 10, fontWeight: 700, color: "#3b82f6", letterSpacing: "0.1em",
             textTransform: "uppercase" as const, marginBottom: 6 },
  secTitle:{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", letterSpacing: -0.5, marginBottom: 4 },
  secSub:  { fontSize: 13, color: "var(--text-tertiary)", marginBottom: 20 },
  divider: { height: 1, background: "var(--border-primary)", marginBottom: 20 },
  card:    { background: "var(--bg-secondary)", border: "1px solid var(--border-primary)",
             borderRadius: 10, padding: "18px 20px", marginBottom: 12 },
  hl:      { background: "rgba(59,130,246,.07)", border: "1px solid rgba(59,130,246,.2)",
             borderLeft: "4px solid #3b82f6", borderRadius: "0 8px 8px 0",
             padding: "14px 18px", marginBottom: 16 },
  quote:   { background: "var(--bg-secondary)", borderLeft: "4px solid #8b5cf6",
             borderRadius: "0 8px 8px 0", padding: "14px 18px",
             fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8, margin: "16px 0" },
};

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ background: "var(--bg-secondary)", color: "var(--text-tertiary)", fontSize: 11,
    fontWeight: 600, letterSpacing: "0.04em", padding: "9px 12px", textAlign: "left",
    borderBottom: "1px solid var(--border-primary)" }}>{children}</th>;
}
function Td({ children, color }: { children: React.ReactNode; color?: string }) {
  return <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-primary)",
    color: color ?? "var(--text-secondary)", fontSize: 13, verticalAlign: "top" }}>{children}</td>;
}
function Table({ children }: { children: React.ReactNode }) {
  return <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>{children}</table>;
}

function FlowItem({ num, title, desc, tag, tagColor, last }:
  { num: number; title: string; desc: React.ReactNode; tag: string; tagColor: string; last?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#3b82f6",
          color: "#fff", fontSize: 13, fontWeight: 800,
          display: "flex", alignItems: "center", justifyContent: "center" }}>{num}</div>
        {!last && <div style={{ width: 2, height: 28, background: "var(--border-primary)", margin: "3px 0" }} />}
      </div>
      <div style={{ paddingBottom: last ? 0 : 20, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.75 }}>{desc}</div>
        <span style={{ display: "inline-block", fontSize: 11, padding: "2px 8px", borderRadius: 4,
          marginTop: 6, fontWeight: 600, background: tagColor + "22", color: tagColor }}>{tag}</span>
      </div>
    </div>
  );
}

function FactorCard({ name, kor, color, rows, strength, maxStr }:
  { name: string; kor: string; color: string; rows: [string, string, string?][]; strength: number; maxStr?: string }) {
  return (
    <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)",
      borderTop: `3px solid ${color}`, borderRadius: 10, padding: "16px 18px" }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", marginBottom: 2 }}>{name}</div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 12 }}>{kor}</div>
      {rows.map(([label, val, valColor]) => (
        <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)", flexShrink: 0 }}>{label}</span>
          <span style={{ fontSize: 12, color: valColor ?? "var(--text-secondary)", textAlign: "right" }}>{val}</span>
        </div>
      ))}
      <div style={{ display: "flex", gap: 3, marginTop: 10, alignItems: "center" }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{ width: 8, height: 8, borderRadius: 2,
            background: i < strength ? color : "var(--border-primary)" }} />
        ))}
        {maxStr && <span style={{ fontSize: 10, color: "var(--text-tertiary)", marginLeft: 4 }}>{maxStr}</span>}
      </div>
    </div>
  );
}

function TrapCard({ num, title, desc, fix }: { num: number; title: string; desc: React.ReactNode; fix: string }) {
  return (
    <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)",
      borderRadius: 10, padding: "18px 20px", display: "flex", gap: 14, marginBottom: 12 }}>
      <div style={{ width: 34, height: 34, borderRadius: 8, background: "#ef4444", color: "#fff",
        fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{num}</div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 5 }}>{title}</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.75, marginBottom: 8 }}>{desc}</div>
        <div style={{ fontSize: 12.5, color: "#22c55e" }}>
          <strong>✓ 해결 </strong>{fix}
        </div>
      </div>
    </div>
  );
}

function FitDots({ n }: { n: number }) {
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {[...Array(5)].map((_, i) => (
        <div key={i} style={{ width: 8, height: 8, borderRadius: 2,
          background: i < n ? "#f97316" : "var(--border-primary)" }} />
      ))}
    </div>
  );
}

function StratCard({ color, name, fit, fitLabel, summary, when, now, signals, caution }:{
  color: string; name: string; fit: number; fitLabel: string;
  summary: string; when: string; now: string;
  signals: { method: string; freq: string; detail: string }[];
  caution: string;
}) {
  return (
    <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)",
      borderLeft: `4px solid ${color}`, borderRadius: "0 10px 10px 0", padding: "18px 20px", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>{name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FitDots n={fit} />
          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
            background: fit >= 4 ? "#22c55e22" : fit >= 3 ? "#f59e0b22" : "#ef444422",
            color: fit >= 4 ? "#22c55e" : fit >= 3 ? "#f59e0b" : "#ef4444" }}>{fitLabel}</span>
        </div>
      </div>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.75, marginBottom: 12 }}>{summary}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        <div style={{ background: "var(--bg-primary)", borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>언제 쓰나</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>{when}</div>
        </div>
        <div style={{ background: "var(--bg-primary)", borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>현재 시장 (2026-05)</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>{now}</div>
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.06em",
        textTransform: "uppercase" as const, marginBottom: 8 }}>📡 신호 수신법</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {signals.map(s => (
          <div key={s.method} style={{ background: "var(--bg-primary)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: color }}>{s.method}</span>
              <span style={{ fontSize: 10, color: "var(--text-tertiary)", background: "var(--bg-secondary)",
                padding: "1px 6px", borderRadius: 4 }}>{s.freq}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>{s.detail}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: "#f59e0b", background: "rgba(245,158,11,.08)",
        border: "1px solid rgba(245,158,11,.2)", borderRadius: 8, padding: "8px 12px" }}>
        ⚠️ {caution}
      </div>
    </div>
  );
}

const ASSET_ETF_MAP: Record<string, { ticker: string; name: string }[]> = {
  "반도체": [
    { ticker: "091160", name: "KODEX 반도체" },
    { ticker: "091230", name: "TIGER 반도체" },
    { ticker: "266410", name: "KODEX AI반도체핵심장비" },
  ],
  "코스피200": [
    { ticker: "069500", name: "KODEX 200" },
    { ticker: "102110", name: "TIGER 200" },
    { ticker: "229200", name: "KODEX 코스닥150" },
  ],
  "코스닥150": [
    { ticker: "229200", name: "KODEX 코스닥150" },
    { ticker: "232080", name: "TIGER 코스닥150" },
  ],
  "나스닥100": [
    { ticker: "133690", name: "TIGER 미국나스닥100" },
    { ticker: "379800", name: "KODEX 미국나스닥100TR" },
    { ticker: "367380", name: "KBSTAR 미국나스닥100" },
  ],
  "S&P500": [
    { ticker: "360750", name: "TIGER 미국S&P500" },
    { ticker: "379800", name: "KODEX 미국S&P500TR" },
    { ticker: "458730", name: "ACE 미국S&P500" },
  ],
  "금": [
    { ticker: "411060", name: "ACE KRX금현물" },
    { ticker: "132030", name: "KODEX 골드선물(H)" },
    { ticker: "319640", name: "TIGER 골드선물(H)" },
  ],
  "미국장기채": [
    { ticker: "305080", name: "TIGER 미국채10년선물" },
    { ticker: "304660", name: "KODEX 미국채10년선물" },
    { ticker: "453850", name: "ACE 미국30년국채액티브(H)" },
  ],
  "단기채권": [
    { ticker: "153130", name: "KODEX 단기채권PLUS" },
    { ticker: "157450", name: "TIGER 단기채권액티브" },
    { ticker: "432320", name: "KODEX CD금리액티브(합성)" },
  ],
};

const WORKER_URL = "https://asset-dashboard-api.jilliankim200.workers.dev";

function RefreshButton() {
  const [state, setState] = useState<"idle" | "loading" | "ok" | "err">("idle");

  const handleClick = async () => {
    setState("loading");
    try {
      const res = await fetch(`${WORKER_URL}/momentum-signal/refresh`, { method: "POST" });
      if (res.ok) {
        setState("ok");
        setTimeout(() => { setState("idle"); window.location.reload(); }, 1200);
      } else {
        setState("err");
        setTimeout(() => setState("idle"), 2500);
      }
    } catch {
      setState("err");
      setTimeout(() => setState("idle"), 2500);
    }
  };

  const label = state === "loading" ? "갱신 중…" : state === "ok" ? "✓ 완료" : state === "err" ? "✕ 오류" : "🔄 신호 갱신";
  const color = state === "ok" ? "#22c55e" : state === "err" ? "#ef4444" : "#3b82f6";

  return (
    <button onClick={handleClick} disabled={state === "loading"} style={{
      fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6, cursor: state === "loading" ? "default" : "pointer",
      border: `1px solid ${color}40`, background: `${color}12`, color,
      transition: "all .15s", opacity: state === "loading" ? 0.7 : 1,
    }}>{label}</button>
  );
}

function AssetLabel({ name, isTop }: { name: string; isTop?: boolean }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [tipPos, setTipPos] = useState<{ top: number; left: number } | null>(null);
  const etfs = ASSET_ETF_MAP[name] ?? [];

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tipPos) { setTipPos(null); return; }
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setTipPos({ top: rect.bottom + 6, left: rect.left });
  };

  useEffect(() => {
    if (!tipPos) return;
    const close = () => setTipPos(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [tipPos]);

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, position: "relative" }}>
      <strong style={{ color: isTop ? "#22c55e" : "var(--text-primary)" }}>{name}</strong>
      {etfs.length > 0 && (
        <>
          <button ref={btnRef} onClick={handleClick} style={{
            fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, cursor: "pointer",
            border: "1px solid rgba(59,130,246,.4)", background: "rgba(59,130,246,.1)",
            color: "#3b82f6", lineHeight: 1.4, letterSpacing: "0.04em",
          }}>ETF</button>
          {tipPos && (
            <div onClick={e => e.stopPropagation()} style={{
              position: "fixed", top: tipPos.top, left: tipPos.left, zIndex: 9999,
              background: "var(--bg-secondary)", border: "1px solid var(--border-primary)",
              borderRadius: 8, padding: "10px 12px", minWidth: 220, boxShadow: "0 8px 24px rgba(0,0,0,.2)",
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)",
                letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 6 }}>
                {name} ETF 목록
              </div>
              {etfs.map(e => (
                <div key={e.ticker} style={{ display: "flex", justifyContent: "space-between",
                  gap: 10, padding: "4px 0", borderBottom: "1px solid var(--border-primary)",
                  fontSize: 12, color: "var(--text-secondary)" }}>
                  <span>{e.name}</span>
                  <span style={{ fontWeight: 700, color: "var(--text-primary)", fontFamily: "monospace" }}>{e.ticker}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </span>
  );
}

const NAV = [
  { header: "실전 적용" },
  { href: "action",     label: "리밸런싱 액션 플랜" },
  { href: "port-opt",   label: "포트폴리오 최적화" },
  { href: "etf-pick",   label: "ETF 선택 기준" },
  { href: "traps",      label: "주의사항" },
  { sep: true },
  { header: "이론 & 배경" },
  { href: "def",        label: "퀀트 투자란" },
  { href: "why",        label: "왜 작동하는가" },
  { href: "process",    label: "투자 프로세스" },
  { href: "factors",    label: "5대 팩터" },
  { href: "strategies", label: "전략 유형 & 신호" },
  { href: "backtest",   label: "백테스팅 방법론" },
  { sep: true },
  { href: "summary",    label: "핵심 요약" },
];

interface RebalEvent {
  date: string;
  from: string; fromTicker: string; fromR6m: number;
  to: string;   toTicker: string;   toR6m: number;
  marketPhase: string;
}

interface MomentumSignal {
  updatedAt: string;
  marketPhase: string;
  topAsset: string;
  topTicker: string;
  topR6m: number;
  isSafe: boolean;
  assets: { name: string; ticker: string; r6m: number | null }[];
  nextRebalancing: string;
}

const FALLBACK: MomentumSignal = {
  updatedAt: "2026-05-06",
  marketPhase: "강세장",
  topAsset: "반도체",
  topTicker: "091160",
  topR6m: 117.3,
  isSafe: false,
  assets: [],
  nextRebalancing: "2026-05",
};

function numFmt(n: number) { return Math.round(n).toLocaleString("ko-KR"); }

function RebalCalc({ signal }: { signal: MomentumSignal }) {
  const [totalStr, setTotalStr] = useState("");
  const [holdingStr, setHoldingStr] = useState("");
  const [otherStr, setOtherStr] = useState("");

  const parse = (s: string) => parseFloat(s.replace(/,/g, "")) || 0;
  const fmt = (s: string, set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/[^0-9]/g, "");
    set(v ? Number(v).toLocaleString() : "");
    void s;
  };

  const total = parse(totalStr);
  const alreadyHolding = parse(holdingStr);
  const otherSell = parse(otherStr);
  const target = signal.isSafe
    ? { name: "단기채권", ticker: "153130" }
    : { name: signal.topAsset, ticker: signal.topTicker };

  const toBuy = Math.max(0, total - alreadyHolding);
  const netCash = otherSell - toBuy;

  const inputStyle: React.CSSProperties = {
    flex: 1, minWidth: 140, padding: "7px 10px", borderRadius: 7,
    border: "1px solid var(--border-primary)", background: "var(--bg-primary)",
    color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", flexShrink: 0, width: 160,
  };

  return (
    <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: 10, padding: "18px 20px" }}>
      {/* 입력 필드 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={labelStyle}>총 투자금액 (원)</span>
          <input type="text" value={totalStr} onChange={fmt(totalStr, setTotalStr)} placeholder="예: 10,000,000" style={inputStyle} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={labelStyle}>{target.name} 기보유 금액</span>
          <input type="text" value={holdingStr} onChange={fmt(holdingStr, setHoldingStr)} placeholder="이미 보유 중이면 입력 (없으면 0)" style={inputStyle} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={labelStyle}>기타 자산 매도 예정</span>
          <input type="text" value={otherStr} onChange={fmt(otherStr, setOtherStr)} placeholder="매도할 다른 ETF 평가금액" style={inputStyle} />
        </div>
      </div>

      {total > 0 && (
        <>
          {/* 결과 카드 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
            <div style={{ background: "rgba(34,197,94,.07)", border: "1px solid rgba(34,197,94,.2)", borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: "#22c55e", fontWeight: 700, marginBottom: 4 }}>📈 매수 — {target.name}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>{numFmt(toBuy)}원</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 3 }}>ETF {target.ticker}</div>
            </div>
            <div style={{ background: "rgba(239,68,68,.07)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: "#ef4444", fontWeight: 700, marginBottom: 4 }}>📉 매도 — 기타</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>{otherSell > 0 ? `${numFmt(otherSell)}원` : "전량"}</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 3 }}>{target.ticker} 외 전량 정리</div>
            </div>
            <div style={{ background: netCash >= 0 ? "rgba(59,130,246,.07)" : "rgba(245,158,11,.07)",
              border: `1px solid ${netCash >= 0 ? "rgba(59,130,246,.2)" : "rgba(245,158,11,.2)"}`, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: netCash >= 0 ? "#3b82f6" : "#f59e0b", fontWeight: 700, marginBottom: 4 }}>
                {netCash >= 0 ? "💰 잔여 현금" : "⚠️ 추가 필요"}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>{numFmt(Math.abs(netCash))}원</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 3 }}>
                {netCash >= 0 ? "매도 후 남는 현금" : "현금 추가 필요"}
              </div>
            </div>
          </div>

          {/* 요약 텍스트 */}
          <div style={{ background: "var(--bg-primary)", borderRadius: 8, padding: "10px 14px",
            fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.9 }}>
            <strong style={{ color: "var(--text-primary)" }}>실행 순서:</strong><br />
            {otherSell > 0 && <>① 기타 자산 {numFmt(otherSell)}원 매도<br /></>}
            {alreadyHolding > 0 && <>② {target.name}({target.ticker}) {numFmt(alreadyHolding)}원 기보유 확인<br /></>}
            {toBuy > 0 && <>③ {target.name}({target.ticker}) <strong style={{ color: "#22c55e" }}>{numFmt(toBuy)}원 추가 매수</strong><br /></>}
            {toBuy === 0 && <><strong style={{ color: "#22c55e" }}>추가 매수 불필요</strong> — 이미 목표 비중 충족<br /></>}
            ※ 거래세·수수료 약 0.015~0.3% 별도 감안
          </div>
        </>
      )}
    </div>
  );
}

type StrategyKey = "equal" | "momentum" | "concentrated";

interface WeightRow { name: string; ticker: string; weight: number; r6m: number | null; isSafe?: boolean }

const STRAT_META: Record<StrategyKey, { label: string; color: string; desc: string; pro: string; con: string }> = {
  equal: {
    label: "균등 배분 (1/N)",
    color: "#3b82f6",
    desc: "5개 자산에 각 20%씩 균등 배분. 예측 없이 최대 분산. 모멘텀 신호를 무시합니다.",
    pro: "낮은 턴오버 · 최대 분산 효과",
    con: "약한 자산에도 동일 배분 → 모멘텀 팩터 미활용",
  },
  momentum: {
    label: "모멘텀 비례 배분",
    color: "#22c55e",
    desc: "6개월 수익률 양(+)인 자산에만, 수익률에 비례해 배분. 음수 자산은 0%로 제외합니다.",
    pro: "모멘텀 팩터 반영 + 적정 분산 동시 달성",
    con: "고모멘텀 자산 과집중 가능 · 매월 리밸런싱 필요",
  },
  concentrated: {
    label: "집중 투자 (Top-1)",
    color: "#f97316",
    desc: "6개월 모멘텀 1위 자산에 100% 집중. 현재 대시보드 듀얼 모멘텀 전략과 동일.",
    pro: "최대 모멘텀 포착 · 결정 단순",
    con: "분산 없음 → MDD 리스크 최대",
  },
};

const FALLBACK_ASSETS: { name: string; ticker: string; r6m: number | null }[] = [
  { name: "반도체",    ticker: "091160", r6m: null },
  { name: "코스피200", ticker: "069500", r6m: null },
  { name: "코스닥150", ticker: "229200", r6m: null },
  { name: "나스닥100", ticker: "133690", r6m: null },
  { name: "S&P500",   ticker: "360750", r6m: null },
  { name: "금",       ticker: "411060", r6m: null },
  { name: "미국장기채",ticker: "305080", r6m: null },
];
const SAFE_ASSET = { name: "단기채권", ticker: "153130" };

function computeWeights(strategy: StrategyKey, signal: MomentumSignal): WeightRow[] {
  const assets = signal.assets.length >= 5 ? signal.assets : FALLBACK_ASSETS;
  if (strategy === "equal") {
    return assets.map(a => ({ ...a, weight: 1 / assets.length }));
  }
  if (strategy === "concentrated") {
    if (signal.isSafe) {
      return [
        ...assets.map(a => ({ ...a, weight: 0 })),
        { name: SAFE_ASSET.name, ticker: SAFE_ASSET.ticker, r6m: 0, weight: 1, isSafe: true },
      ];
    }
    return assets.map(a => ({ ...a, weight: a.ticker === signal.topTicker ? 1 : 0 }));
  }
  // momentum proportional
  const pos = assets.filter(a => a.r6m !== null && a.r6m > 0);
  if (pos.length === 0) {
    return [
      ...assets.map(a => ({ ...a, weight: 0 })),
      { name: SAFE_ASSET.name, ticker: SAFE_ASSET.ticker, r6m: 0, weight: 1, isSafe: true },
    ];
  }
  const sumPos = pos.reduce((s, a) => s + (a.r6m as number), 0);
  return assets.map(a => ({
    ...a,
    weight: a.r6m !== null && a.r6m > 0 ? (a.r6m / sumPos) : 0,
  }));
}

function WeightBar({ row, maxW, total }: { row: WeightRow; maxW: number; total: number }) {
  const pct = row.weight * 100;
  const color = row.isSafe ? "#94a3b8" : row.weight > 0.4 ? "#f97316" : row.weight > 0.25 ? "#22c55e" : "#3b82f6";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <div style={{ width: 72, fontSize: 12, color: "var(--text-secondary)", fontWeight: row.weight > 0 ? 700 : 400,
        flexShrink: 0, opacity: row.weight === 0 ? 0.45 : 1 }}>{row.name}</div>
      <div style={{ flex: 1, background: "var(--bg-primary)", borderRadius: 4, height: 16, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${maxW > 0 ? (row.weight / maxW) * 100 : 0}%`,
          background: color, borderRadius: 4, transition: "width 0.35s ease", opacity: row.weight === 0 ? 0.3 : 1 }} />
      </div>
      <div style={{ width: 44, fontSize: 12, fontWeight: 700, color: row.weight > 0 ? color : "var(--text-tertiary)",
        textAlign: "right", flexShrink: 0 }}>{pct.toFixed(1)}%</div>
      <div style={{ width: 60, fontSize: 11, color: "var(--text-tertiary)", textAlign: "right", flexShrink: 0 }}>
        {row.r6m !== null ? `${row.r6m > 0 ? "+" : ""}${row.r6m.toFixed(1)}%` : "—"}
      </div>
      {total > 0 && row.weight > 0 && (
        <div style={{ width: 90, fontSize: 11, color: "var(--text-secondary)", textAlign: "right", flexShrink: 0 }}>
          {numFmt(Math.round(total * row.weight))}원
        </div>
      )}
    </div>
  );
}

function PortfolioOptimizer({ signal }: { signal: MomentumSignal }) {
  const [strategy, setStrategy] = useState<StrategyKey>("momentum");
  const [totalStr, setTotalStr] = useState("");

  const total = parseFloat(totalStr.replace(/,/g, "")) || 0;
  const weights = computeWeights(strategy, signal);
  const maxW = Math.max(...weights.map(w => w.weight));
  const meta = STRAT_META[strategy];

  const expectedR6m = weights.reduce((acc, w) => acc + w.weight * (w.r6m ?? 0), 0);
  const activeCount = weights.filter(w => w.weight > 0).length;

  const STRAT_STATS: Record<StrategyKey, { cagr: string; mdd: string; sharpe: string; turn: string }> = {
    equal:       { cagr: "~12%", mdd: "-20~28%", sharpe: "0.65~0.85", turn: "낮음 (~20%/년)" },
    momentum:    { cagr: "~18%", mdd: "-18~35%", sharpe: "0.75~1.00", turn: "중간 (~80%/년)" },
    concentrated:{ cagr: "~22%", mdd: "-30~45%", sharpe: "0.70~0.95", turn: "높음 (~120%/년)" },
  };
  const stats = STRAT_STATS[strategy];

  return (
    <div>
      {/* Strategy selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" as const }}>
        {(["equal", "momentum", "concentrated"] as const).map(s => {
          const m = STRAT_META[s];
          return (
            <button key={s} onClick={() => setStrategy(s)} style={{
              padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: `1px solid ${strategy === s ? m.color : "var(--border-primary)"}`,
              background: strategy === s ? m.color + "18" : "var(--bg-secondary)",
              color: strategy === s ? m.color : "var(--text-secondary)", transition: "all .15s",
            }}>{m.label}</button>
          );
        })}
      </div>

      {/* Description + stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, marginBottom: 18, alignItems: "start" }}>
        <div style={{ background: "var(--bg-secondary)", border: `1px solid var(--border-primary)`,
          borderLeft: `4px solid ${meta.color}`, borderRadius: "0 10px 10px 0", padding: "14px 16px" }}>
          <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.75, marginBottom: 8 }}>{meta.desc}</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" as const }}>
            <span style={{ fontSize: 11.5, color: "#22c55e" }}>✓ {meta.pro}</span>
            <span style={{ fontSize: 11.5, color: "#f59e0b" }}>⚠ {meta.con}</span>
          </div>
        </div>
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)",
          borderRadius: 10, padding: "14px 16px", minWidth: 148 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.06em",
            textTransform: "uppercase" as const, marginBottom: 8 }}>예상 성과 (역사적)</div>
          {([
            ["CAGR",   stats.cagr],
            ["MDD",    stats.mdd],
            ["Sharpe", stats.sharpe],
            ["턴오버",  stats.turn],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{k}</span>
              <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Weight visualization */}
      <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)",
        borderRadius: 10, padding: "16px 18px", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)",
            textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>자산 배분 비중</div>
          <div style={{ display: "flex", gap: 12 }}>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              편입 자산 <strong style={{ color: "var(--text-primary)" }}>{activeCount}개</strong>
            </span>
            {signal.assets.length > 0 && (
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                가중 6M <strong style={{ color: expectedR6m >= 0 ? "#22c55e" : "#ef4444" }}>
                  {expectedR6m >= 0 ? "+" : ""}{expectedR6m.toFixed(1)}%
                </strong>
              </span>
            )}
          </div>
        </div>
        <div style={{ fontSize: 10, color: "var(--text-tertiary)", display: "flex", gap: 10,
          marginBottom: 10, paddingLeft: 82 }}>
          <span style={{ flex: 1 }}>비중 바</span>
          <span style={{ width: 44, textAlign: "right" }}>비중</span>
          <span style={{ width: 60, textAlign: "right" }}>6M 수익</span>
          {total > 0 && <span style={{ width: 90, textAlign: "right" }}>금액</span>}
        </div>
        {weights.map(w => (
          <WeightBar key={w.ticker} row={w} maxW={maxW} total={total} />
        ))}
      </div>

      {/* Investment calculator */}
      <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)",
        borderRadius: 10, padding: "16px 18px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)",
          textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 10 }}>
          투자금액 계산기
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", flexShrink: 0 }}>
            총 투자금액 (원)
          </span>
          <input
            type="text"
            value={totalStr}
            onChange={e => {
              const v = e.target.value.replace(/[^0-9]/g, "");
              setTotalStr(v ? Number(v).toLocaleString() : "");
            }}
            placeholder="예: 10,000,000"
            style={{ flex: 1, padding: "7px 10px", borderRadius: 7,
              border: "1px solid var(--border-primary)", background: "var(--bg-primary)",
              color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }}
          />
        </div>
        {total > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {weights.filter(w => w.weight > 0).map(w => (
              <div key={w.ticker} style={{ display: "flex", alignItems: "center", gap: 10,
                background: "var(--bg-primary)", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{w.name}</span>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: 6 }}>{w.ticker}</span>
                </div>
                <span style={{ fontSize: 12, color: "var(--text-tertiary)", width: 44, textAlign: "right" }}>
                  {(w.weight * 100).toFixed(1)}%
                </span>
                <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", width: 120, textAlign: "right" }}>
                  {numFmt(Math.round(total * w.weight))}원
                </span>
              </div>
            ))}
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
              ※ 거래세·수수료(약 0.015~0.3%) 미포함. ETF 1주 단위로 반올림 필요.
            </div>
          </div>
        )}
      </div>

      {/* Comparison table */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.06em",
          textTransform: "uppercase" as const, marginBottom: 10 }}>3가지 전략 비교</div>
        <Table>
          <thead>
            <tr>
              <Th>전략</Th><Th>CAGR</Th><Th>MDD</Th><Th>Sharpe</Th><Th>턴오버</Th><Th>적합 대상</Th>
            </tr>
          </thead>
          <tbody>
            {([
              ["균등 배분 (1/N)",   "~12%", "-20~28%", "0.65~0.85", "낮음",   "장기 분산, 저비용 선호", "#3b82f6"],
              ["모멘텀 비례",       "~18%", "-18~35%", "0.75~1.00", "중간",   "모멘텀+분산 균형", "#22c55e"],
              ["집중 투자 (Top-1)", "~22%", "-30~45%", "0.70~0.95", "높음",   "최대 알파 추구, 변동성 감내", "#f97316"],
            ] as [string, string, string, string, string, string, string][]).map(([name, cagr, mdd, sh, turn, fit, c]) => (
              <tr key={name}>
                <Td><strong style={{ color: c }}>{name}</strong></Td>
                <Td color="#22c55e">{cagr}</Td>
                <Td color="#ef4444">{mdd}</Td>
                <Td>{sh}</Td>
                <Td color={turn === "높음" ? "#f59e0b" : "var(--text-secondary)"}>{turn}</Td>
                <Td>{fit}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", lineHeight: 1.8 }}>
          ※ 성과 추정치는 2022.01~2026.05 듀얼 모멘텀 백테스트 기준의 방향성 참고값입니다. 미래 수익을 보장하지 않습니다.
          모멘텀 비례 및 집중 투자는 매월 1회 리밸런싱이 필요합니다.
        </div>
      </div>
    </div>
  );
}

export function QuantBasics() {
  const [active, setActive] = useState("def");
  const contentRef = useRef<HTMLDivElement>(null);
  const [signal, setSignal] = useState<MomentumSignal>(FALLBACK);
  const [signalLoading, setSignalLoading] = useState(true);
  const [rebalHistory, setRebalHistory] = useState<RebalEvent[]>([]);

  useEffect(() => {
    kvGet<MomentumSignal>("momentum_signal")
      .then(data => { if (data) setSignal(data); })
      .catch(() => {})
      .finally(() => setSignalLoading(false));
    kvGet<RebalEvent[]>("rebalancing_history")
      .then(data => { if (data) setRebalHistory(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const sections = el.querySelectorAll("[data-sec]");
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setActive((e.target as HTMLElement).dataset.sec!); });
    }, { root: el, threshold: 0.3 });
    sections.forEach(s => obs.observe(s));
    return () => obs.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const el = contentRef.current?.querySelector(`[data-sec="${id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const tocLink = (href: string, label: string) => (
    <button key={href} onClick={() => scrollTo(href)} style={{
      display: "block", width: "100%", textAlign: "left", fontSize: 12,
      color: active === href ? "#3b82f6" : "var(--text-tertiary)",
      background: active === href ? "rgba(59,130,246,.08)" : "transparent",
      border: "none", cursor: "pointer", padding: "5px 8px", borderRadius: 6,
      marginBottom: 2, fontWeight: active === href ? 600 : 400, transition: "all .15s",
    }}>{label}</button>
  );

  return (
    <div style={{ display: "flex", height: "calc(100vh - 60px)", overflow: "hidden" }}>
      {/* TOC */}
      <nav style={S.toc}>
        <div style={S.tocTitle}>목차</div>
        {NAV.map((n, i) =>
          "header" in n
            ? <div key={i} style={{ fontSize: 9, fontWeight: 800, color: "var(--text-tertiary)",
                letterSpacing: "0.1em", textTransform: "uppercase" as const,
                padding: i === 0 ? "2px 8px 4px" : "10px 8px 4px" }}>
                {(n as { header: string }).header}
              </div>
            : "sep" in n
              ? <div key={i} style={S.tocSep} />
              : tocLink(n.href!, n.label!)
        )}
      </nav>

      {/* Content */}
      <div ref={contentRef} style={{ flex: 1, overflowY: "auto", padding: "36px 44px 60px" }}>
        <div style={{ maxWidth: 820 }}>

          {/* ── 6. 리밸런싱 액션 플랜 ── */}
          <section data-sec="action" style={{ marginBottom: 52, scrollMarginTop: 24 }}>
            <div style={{ ...S.secLabel, color: "#22c55e" }}>실전 1</div>
            <div style={S.secTitle}>리밸런싱 액션 플랜</div>
            <div style={S.secSub}>현재 듀얼 모멘텀 신호 기반 — 이번 달 해야 할 구체적 액션</div>
            <div style={S.divider} />

            {/* 현재 신호 요약 */}
            <div style={{ background: "rgba(59,130,246,.07)", border: "1px solid rgba(59,130,246,.2)",
              borderRadius: 10, padding: "16px 20px", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#3b82f6" }}>
                  📡 현재 신호 — {signal.updatedAt} 업데이트
                </div>
                <RefreshButton />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[
                  { label: "보유 대상", val: signal.isSafe ? "단기채권(153130)" : `${signal.topAsset}(${signal.topTicker})`, color: signal.isSafe ? "#94a3b8" : "#22c55e" },
                  { label: `${signal.topAsset} 6M`, val: `${signal.topR6m >= 0 ? "+" : ""}${signal.topR6m}%`, color: "#f97316" },
                  { label: "다음 리밸런싱", val: `${signal.nextRebalancing}월 말`, color: "var(--text-primary)" },
                ].map(({ label, val, color }) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 5자산 현황 테이블 */}
            {signal.assets.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)",
                  letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 8 }}>
                  {signal.assets.length}대 자산 6M 수익률 순위
                </div>
                <Table>
                  <thead>
                    <tr>
                      <Th>순위</Th><Th>자산명</Th><Th>ETF 코드</Th><Th>6M 수익률</Th>
                      <Th>이번 달 액션 <span style={{ fontWeight: 400, opacity: 0.6 }}>①만 보유</span></Th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...signal.assets]
                      .sort((a, b) => (b.r6m ?? -999) - (a.r6m ?? -999))
                      .map((asset, i) => (
                        <tr key={asset.ticker}>
                          <Td><strong style={{ color: i === 0 ? "#22c55e" : "var(--text-tertiary)" }}>{i + 1}위</strong></Td>
                          <Td><AssetLabel name={asset.name} isTop={i === 0} /></Td>
                          <Td>{asset.ticker}</Td>
                          <Td color={asset.r6m === null ? "var(--text-tertiary)" : asset.r6m >= 0 ? "#22c55e" : "#ef4444"}>
                            {asset.r6m === null ? "—" : `${asset.r6m >= 0 ? "+" : ""}${asset.r6m.toFixed(1)}%`}
                          </Td>
                          <Td color={i === 0 && !signal.isSafe ? "#22c55e" : "#ef4444"}>
                            {i === 0 && !signal.isSafe ? "✓ 보유 유지" : "✕ 보유 금지 → 매도"}
                          </Td>
                        </tr>
                      ))}
                  </tbody>
                </Table>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.7,
                  background: "rgba(239,68,68,.05)", border: "1px solid rgba(239,68,68,.15)",
                  borderRadius: 8, padding: "8px 12px" }}>
                  <strong style={{ color: "#ef4444" }}>✕ 보유 금지</strong>란?
                  &nbsp;이 전략은 <strong style={{ color: "var(--text-primary)" }}>1위 자산 단일 집중 보유</strong>입니다.
                  &nbsp;현재 보유 중인 자산이 1위가 아니라면 <strong style={{ color: "#ef4444" }}>전량 매도</strong>하고
                  &nbsp;<strong style={{ color: "#22c55e" }}>{signal.isSafe ? "단기채권(153130)" : `${signal.topAsset}(${signal.topTicker})`}</strong>으로 통합하세요.
                </div>
              </div>
            )}

            {/* 체크리스트 */}
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)",
              letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 10 }}>
              이번 달 리밸런싱 체크리스트
            </div>
            <div style={S.card}>
              {([
                {
                  label: `${signal.isSafe ? "단기채권(153130)" : `${signal.topAsset}(${signal.topTicker})`} 보유 확인`,
                  detail: signal.isSafe
                    ? "절대 모멘텀 음수 → 단기채권 전환 완료 여부 확인"
                    : `듀얼 모멘텀 1위 자산. 비중 100% 유지.`,
                  color: "#22c55e",
                },
                {
                  label: "다른 위험자산 보유 시 → 전량 매도",
                  detail: `${signal.topTicker} 외 다른 ETF·주식 보유 중이면 매도 후 ${signal.isSafe ? "153130" : signal.topTicker}으로 통합`,
                  color: "#ef4444",
                },
                {
                  label: "월말 6M 수익률 재계산",
                  detail: `매월 말 7자산 6M 수익률 재산출 → 1위 자산 교체 여부 확인. 교체 시 다음 달 초 실행`,
                  color: "#3b82f6",
                },
                {
                  label: "모멘텀 크래시 주 1회 점검",
                  detail: "퀀트 대시보드 > 모멘텀 크래시 탐지 섹션 확인. 🔴 적색 신호 출현 시 즉시 단기채권 전환",
                  color: "#8b5cf6",
                },
              ] as { label: string; detail: string; color: string }[]).map(({ label, detail, color }, i, arr) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start",
                  paddingBottom: i < arr.length - 1 ? 14 : 0,
                  borderBottom: i < arr.length - 1 ? "1px solid var(--border-primary)" : "none",
                  marginBottom: i < arr.length - 1 ? 14 : 0 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: color + "22",
                    color, fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center",
                    justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>{detail}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* 매수금액 계산기 */}
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)",
              letterSpacing: "0.06em", textTransform: "uppercase" as const, margin: "20px 0 10px" }}>
              매수금액 계산기
            </div>
            <RebalCalc signal={signal} />

            {/* 리밸런싱 이력 */}
            {rebalHistory.length > 0 && (<>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)",
                letterSpacing: "0.06em", textTransform: "uppercase" as const, margin: "24px 0 10px" }}>
                리밸런싱 이력 — 자산 교체 기록
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {rebalHistory.map((ev, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#3b82f6", marginTop: 5 }} />
                      {i < rebalHistory.length - 1 && <div style={{ width: 2, flexGrow: 1, background: "var(--border-primary)", minHeight: 28 }} />}
                    </div>
                    <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)",
                      borderRadius: 8, padding: "10px 14px", marginBottom: 8, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{ev.date}</span>
                        <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4,
                          background: ev.marketPhase === "강세장" ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.15)",
                          color: ev.marketPhase === "강세장" ? "#22c55e" : "#ef4444" }}>{ev.marketPhase}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                        <span style={{ color: "#ef4444", fontWeight: 600 }}>{ev.from}</span>
                        <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
                          {ev.fromR6m >= 0 ? "+" : ""}{ev.fromR6m}%
                        </span>
                        <span style={{ color: "var(--text-tertiary)" }}>→</span>
                        <span style={{ color: "#22c55e", fontWeight: 700 }}>{ev.to}</span>
                        <span style={{ color: "#22c55e", fontSize: 11 }}>
                          {ev.toR6m >= 0 ? "+" : ""}{ev.toR6m}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>)}
          </section>

          {/* ── 10. 포트폴리오 최적화 ── */}
          <section data-sec="port-opt" style={{ marginBottom: 52, scrollMarginTop: 24 }}>
            <div style={{ ...S.secLabel, color: "#22c55e" }}>실전 2</div>
            <div style={S.secTitle}>포트폴리오 최적화 계산기</div>
            <div style={S.secSub}>동일한 7자산으로 3가지 비중 전략을 비교하고 투자금액별 매수 수량을 계산합니다</div>
            <div style={S.divider} />
            <div style={S.hl}>
              <p style={{ fontSize: 13.5, color: "var(--text-primary)", lineHeight: 1.8, margin: 0 }}>
                <strong>핵심 질문:</strong> "같은 5개 자산으로도 비중 배분 방법에 따라 수익·리스크 프로파일이 달라집니다."<br />
                균등 배분(1/N)은 분산을 극대화하고, 모멘텀 비례는 강한 자산에 더 집중하며,
                집중 투자(Top-1)는 현재 전략 그대로 최대 알파를 추구합니다.
                현재 KV 신호 기준으로 각 전략의 비중과 투자금액을 실시간 계산합니다.
              </p>
            </div>
            {signalLoading
              ? <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>신호 로딩 중...</div>
              : <PortfolioOptimizer signal={signal} />
            }
          </section>

          {/* ── 9. ETF 선택 기준 ── */}
          <section data-sec="etf-pick" style={{ marginBottom: 52, scrollMarginTop: 24 }}>
            <div style={{ ...S.secLabel, color: "#22c55e" }}>실전 3</div>
            <div style={S.secTitle}>ETF 선택 기준</div>
            <div style={S.secSub}>듀얼 모멘텀 전략에 적합한 ETF를 고르는 6가지 체크리스트</div>
            <div style={S.divider} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              {([
                { icon: "💰", color: "#22c55e", title: "순자산(AUM) 1,000억 이상",
                  desc: "소규모 ETF는 유동성 부족으로 슬리피지가 커집니다. 국내 ETF 기준 순자산 1,000억 이상, 일평균 거래대금 10억 이상이 기준.",
                  check: "KODEX·TIGER·ACE 대형 ETF 우선" },
                { icon: "📊", color: "#3b82f6", title: "추적오차(Tracking Error) 최소화",
                  desc: "ETF가 기초지수를 잘 추종하는지 확인. 연간 추적오차 0.5% 이하면 우수. 합성 ETF는 상대방 위험(counterparty risk)이 추가됩니다.",
                  check: "실물 복제 > 합성 복제 ETF 선호" },
                { icon: "🔄", color: "#f97316", title: "총비용(TER) 낮을수록 유리",
                  desc: "운용보수 + 기타 비용 포함 총비용률(TER). 국내 ETF 평균 0.1~0.3%/년. 같은 지수를 추종한다면 TER이 낮은 상품 선택.",
                  check: "미국 S&P500 ETF 기준: 0.05~0.07%/년 가능" },
                { icon: "🏦", color: "#8b5cf6", title: "연금 계좌 투자 가능 여부",
                  desc: "IRP·DC형 퇴직연금에서는 위험자산 비중 70% 제한. 연금 저축에서는 국내 ETF만 가능. 계좌 성격에 맞는 ETF 선택 필요.",
                  check: "퇴직연금: 위험자산 70%·안전자산 30% 비율 유지" },
                { icon: "📈", color: "#eab308", title: "기초지수 성격 이해",
                  desc: "같은 '나스닥100'도 환헤지(H) 여부, 레버리지, 인버스에 따라 성격이 완전히 다릅니다. 듀얼 모멘텀은 무레버리지·무환헤지 기본형이 원칙.",
                  check: "환헤지 ETF: 달러 강세 시 수익 감소 — 헤지 여부 필수 확인" },
                { icon: "🌏", color: "#06b6d4", title: "분산 효과 (자산군 상관관계)",
                  desc: "5개 자산 중 국내주식·미국주식·안전자산이 포함되어야 분산 효과가 있습니다. 같은 섹터 ETF를 여러 개 넣으면 상관관계가 높아 분산이 줄어듭니다.",
                  check: "자산간 상관계수 < 0.7 권장. 반도체·나스닥·S&P500은 상관 높음 주의" },
              ] as { icon: string; color: string; title: string; desc: string; check: string }[]).map(({ icon, color, title, desc, check }) => (
                <div key={title} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)",
                  borderTop: `3px solid ${color}`, borderRadius: 10, padding: "16px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }}>{icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{title}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.75, marginBottom: 8 }}>{desc}</div>
                  <div style={{ fontSize: 11.5, color, fontWeight: 600 }}>✓ {check}</div>
                </div>
              ))}
            </div>

            {/* 현재 7자산 구성 이유 */}
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.06em",
              textTransform: "uppercase" as const, marginBottom: 10 }}>현재 7자산 선택 이유</div>
            <Table>
              <thead><tr><Th>자산</Th><Th>ETF 코드</Th><Th>선택 이유</Th><Th>주의사항</Th></tr></thead>
              <tbody>
                {[
                  ["반도체", "091160", "AI 사이클에서 가장 강한 모멘텀 팩터. 국내 최대 AUM.", "사이클 민감 — 하락 시 낙폭 큼"],
                  ["코스피200", "069500", "국내 시장 대표 지수. 낮은 TER(0.05%).", "달러 강세 시 상대적 약세"],
                  ["코스닥150", "229200", "국내 중소형·바이오·IT 노출. 코스피200과 분산.", "변동성 높음"],
                  ["나스닥100", "133690", "미국 빅테크 노출. 글로벌 성장 프리미엄.", "환헤지 없음 — 달러 변동 노출"],
                  ["S&P500", "360750", "미국 시장 광범위 분산. 모멘텀 부재 시 안정적.", "나스닥100과 상관 0.85 이상 — 분산 효과 제한"],
                  ["금", "411060", "주식과 낮은 상관. 인플레·지정학 위기 헤지. ACE KRX금현물(실물 복제).", "달러 강세 시 원화 기준 수익 감소 가능"],
                  ["미국장기채", "305080", "경기침체·디플레 구간에서 주식과 역방향. 포트폴리오 분산 효과 최대. TIGER 미국채10년선물.", "금리 상승기(인플레)에서 큰 손실 — 금리 방향 주시 필요"],
                  ["단기채권(안전)", "153130", "절대 모멘텀 실패 시 현금 대용. 낮은 변동성.", "인플레 구간에서 실질 수익 마이너스"],
                ].map(([asset, ticker, reason, caution]) => (
                  <tr key={ticker as string}>
                    <Td><strong style={{ color: "var(--text-primary)" }}>{asset as string}</strong></Td>
                    <Td>{ticker as string}</Td>
                    <Td>{reason as string}</Td>
                    <Td color="#f59e0b">{caution as string}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </section>

          {/* ── 7. 함정 ── */}
          <section data-sec="traps" style={{ marginBottom: 52, scrollMarginTop: 24 }}>
            <div style={{ ...S.secLabel, color: "#22c55e" }}>실전 4</div>
            <div style={S.secTitle}>퀀트의 3대 함정</div>
            <div style={S.secSub}>백테스트가 좋아도 실전에서 실패하는 이유</div>
            <div style={S.divider} />
            <TrapCard num={1} title="과적합 (Overfitting)"
              desc={<>백테스트가 좋은 이유가 <strong>"진짜 알파"</strong>가 아닌 <strong>"과거에 맞춰서"</strong>일 수 있습니다.<br />
                파라미터를 많이 조정할수록 과거에는 완벽하게 맞지만 미래에는 무너집니다.<br />
                룰의 복잡도 ↑ = 과적합 위험 ↑. 단순한 규칙이 종종 더 강건합니다.</>}
              fix="파라미터 최소화, Out-of-sample 검증 필수, Walk-forward test 적용" />
            <TrapCard num={2} title="데이터 마이닝 편향 (Data Mining Bias)"
              desc={<>수백 가지 가설을 테스트하면 <strong>우연히 좋아 보이는 결과</strong>가 반드시 나옵니다.<br />
                이것은 알파가 아니라 <strong>통계적 우연</strong>입니다.<br />
                "이 파라미터가 제일 좋더라" 식의 후향적 최적화가 대표적 함정입니다.</>}
              fix="가설을 먼저 세우고 테스트, p-value Bonferroni 보정, 테스트 횟수 기록" />
            <TrapCard num={3} title="팩터 붕괴 (Factor Decay)"
              desc={<>알파가 <strong>학계나 시장에 알려지면</strong> 차익거래로 수익이 사라집니다.<br />
                단, 행동 편향 기반 팩터(모멘텀, 퀄리티)는 인간의 심리가 바뀌지 않는 한 붕괴 속도가 느립니다.<br />
                순수 통계적 이례현상은 알려진 후 빠르게 사라집니다.</>}
              fix="행동 편향 기반 팩터 선호, 성과 지속 모니터링, 붕괴 감지 시 전략 교체" />
          </section>

          {/* ── 1. 정의 ── */}
          <section data-sec="def" style={{ marginBottom: 52, scrollMarginTop: 24 }}>
            <div style={S.secLabel}>이론 1</div>
            <div style={S.secTitle}>퀀트 투자란 무엇인가</div>
            <div style={S.secSub}>감이나 직관 대신 데이터와 수학으로 투자 의사결정을 내리는 체계적 접근법</div>
            <div style={S.divider} />
            <div style={S.hl}>
              <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.8 }}>
                <strong>"데이터와 수학으로 만든 규칙이 사람 대신 투자 결정을 내린다"</strong><br />
                모든 매매 신호는 사전에 정의된 알고리즘에서 나오며, 실행 단계에서는 감정이 개입하지 않습니다.
              </p>
            </div>
            <Table>
              <thead><tr><Th>구분</Th><Th>전통적 투자</Th><Th>퀀트 투자</Th></tr></thead>
              <tbody>
                {[
                  ["의사결정 근거", "애널리스트 보고서, 감", "데이터, 통계 모델"],
                  ["분석 방식", "종목 스토리 중심", "팩터(변수) 중심"],
                  ["일관성", "판단이 상황마다 다름", "규칙이 항상 동일하게 실행"],
                  ["종목 수", "소수 집중", "다수 분산으로 통계적 우위 확보"],
                  ["감정 개입", "공포·탐욕에 흔들림", "신호대로만 기계적 실행"],
                  ["검증 방식", "사후 해석", "백테스트로 사전 검증"],
                ].map(([g, a, b]) => (
                  <tr key={g}>
                    <Td><strong style={{ color: "var(--text-primary)" }}>{g}</strong></Td>
                    <Td color="#ef4444">{a}</Td>
                    <Td color="#22c55e">{b}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div style={S.quote}>
              "If you can't describe what you are doing as a process, you don't know what you're doing."
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>— W. Edwards Deming</div>
            </div>
          </section>

          {/* ── 2. 왜 작동하는가 ── */}
          <section data-sec="why" style={{ marginBottom: 52, scrollMarginTop: 24 }}>
            <div style={S.secLabel}>이론 2</div>
            <div style={S.secTitle}>왜 퀀트가 작동하는가</div>
            <div style={S.secSub}>시장은 완전히 효율적이지 않다 — 두 가지 구조적 비효율이 꾸준히 존재한다</div>
            <div style={S.divider} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div style={S.card}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>🧠 행동 편향</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
                  인간은 <strong>시스템적으로 잘못된 판단</strong>을 반복합니다.<br />
                  • 오르는 종목을 너무 늦게 쫓아감 → <span style={{ color: "#3b82f6" }}>모멘텀 프리미엄</span><br />
                  • 싼 종목을 이유 없이 외면 → <span style={{ color: "#3b82f6" }}>밸류 프리미엄</span><br />
                  • 손실을 인정 못하고 버팀 → 과잉반응 후 반전<br />
                  • 최근 정보에 과도하게 반응 → 뉴스 모멘텀
                </div>
              </div>
              <div style={S.card}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>🏛️ 구조적 제약</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
                  기관은 <strong>규정·운용 규모</strong> 때문에 못 하는 것들이 있습니다.<br />
                  • 소형주 매수 불가 → <span style={{ color: "#3b82f6" }}>소형주 프리미엄</span><br />
                  • 레버리지 제한 → <span style={{ color: "#3b82f6" }}>저베타 자산 위험 대비 수익 우위</span><br />
                  • 분기 실적 압박 → 장기 팩터 활용 못함<br />
                  • 벤치마크 제약 → 지수 이탈 종목 강제 매도
                </div>
              </div>
            </div>
            <div style={S.hl}>
              <p style={{ fontSize: 13.5, color: "var(--text-primary)", lineHeight: 1.8 }}>
                핵심: 이 두 비효율은 <strong>행동 편향이 사라지지 않는 한</strong> 구조적으로 지속됩니다.
                사람이 감정적 판단을 멈추지 않는 한 퀀트 알파는 계속 존재합니다.
              </p>
            </div>
          </section>

          {/* ── 3. 프로세스 ── */}
          <section data-sec="process" style={{ marginBottom: 52, scrollMarginTop: 24 }}>
            <div style={S.secLabel}>이론 3</div>
            <div style={S.secTitle}>퀀트 투자 프로세스</div>
            <div style={S.secSub}>알파 발굴부터 실전 운용까지 — 7단계 순환 구조</div>
            <div style={S.divider} />
            <div style={S.card}>
              <FlowItem num={1} title="가설 설정" tag="Research" tagColor="#3b82f6"
                desc={<>투자 아이디어를 <strong>검증 가능한 명제</strong>로 변환합니다.<br />예: "6개월 많이 오른 자산이 다음 달도 오를 것이다" → 모멘텀 가설</>} />
              <FlowItem num={2} title="팩터 정의 & 데이터 수집" tag="Data Engineering" tagColor="#3b82f6"
                desc={<>가설을 <strong>수치 변수(팩터)</strong>로 정의하고 데이터를 확보합니다.<br />6개월 수익률, PBR, ROE 등 — 데이터 품질이 알파의 품질을 결정합니다.</>} />
              <FlowItem num={3} title="백테스트" tag="Backtesting" tagColor="#3b82f6"
                desc={<>과거 데이터로 전략의 성과를 검증합니다.<br /><strong>CAGR / MDD / Sharpe / 턴오버</strong> 4가지 지표를 반드시 확인합니다.</>} />
              <FlowItem num={4} title="과적합 검증 (가장 중요)" tag="Critical Step" tagColor="#f59e0b"
                desc={<>백테스트가 좋은 이유가 "과거에 맞춰서"인지 "진짜 알파"인지 검증합니다.<br /><strong>학습 기간(in-sample)</strong>과 <strong>검증 기간(out-of-sample)</strong>을 분리하고,<br />Walk-forward test로 미래 강건성을 확인합니다.</>} />
              <FlowItem num={5} title="비용 현실화" tag="Cost Analysis" tagColor="#8b5cf6"
                desc={<>수수료 · 슬리피지 · 세금 반영 후에도 알파가 남는지 확인합니다.<br />비용 반영 전후 CAGR 차이가 1%p 이내여야 실전 적용 가능합니다.</>} />
              <FlowItem num={6} title="실전 실행" tag="Execution" tagColor="#3b82f6"
                desc={<>신호대로만 <strong>기계적으로 매매</strong>합니다.<br />감정이 개입하는 순간 퀀트 전략의 의미가 사라집니다. 규칙을 신뢰하세요.</>} />
              <FlowItem num={7} title="모니터링 & 붕괴 감지" tag="Monitoring" tagColor="#f59e0b" last
                desc={<>팩터가 여전히 작동하는지 지속 점검합니다.<br />알파는 알려지면 차익거래로 사라집니다. 성과 저하 시 원인 분석 후 1번으로 돌아갑니다.</>} />
            </div>
          </section>

          {/* ── 4. 5대 팩터 ── */}
          <section data-sec="factors" style={{ marginBottom: 52, scrollMarginTop: 24 }}>
            <div style={S.secLabel}>이론 4</div>
            <div style={S.secTitle}>5대 팩터</div>
            <div style={S.secSub}>학계에서 수십 년간 검증된 초과수익의 원천 — Fama-French 5-Factor Model</div>
            <div style={S.divider} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <FactorCard name="Momentum" kor="모멘텀 (추세 팩터)" color="#f97316" strength={5}
                maxStr="가장 강력한 팩터"
                rows={[
                  ["원리", "최근 3~12개월 많이 오른 자산이 계속 오른다"],
                  ["대표 지표", "3M / 6M / 12M 수익률"],
                  ["왜 작동하나", "정보 확산 속도 차이, 투자자의 과소반응"],
                  ["붕괴 조건", "시장 급반전 구간 (2009.3, 2020.3)", "#ef4444"],
                  ["학술 근거", "Jegadeesh & Titman (1993)"],
                ]} />
              <FactorCard name="Value" kor="밸류 (가치 팩터)" color="#22c55e" strength={4}
                rows={[
                  ["원리", "PBR·PER 낮은 저평가 자산이 장기 우위"],
                  ["대표 지표", "PBR, PER, EV/EBITDA"],
                  ["왜 작동하나", "투자자의 과잉반응 후 평균 회귀"],
                  ["붕괴 조건", "성장주 강세장 장기화 (2010~2020)", "#ef4444"],
                  ["학술 근거", "Fama & French (1992)"],
                ]} />
              <FactorCard name="Quality" kor="퀄리티 (우량 팩터)" color="#3b82f6" strength={5}
                maxStr="가장 안정적"
                rows={[
                  ["원리", "ROE·ROIC 높고 부채 낮은 기업이 꾸준히 우위"],
                  ["대표 지표", "ROE, ROIC, 부채비율, FCF 마진"],
                  ["왜 작동하나", "재무 건전성이 장기 생존과 직결"],
                  ["특징", "경기 사이클 타지 않아 가장 안정적", "#22c55e"],
                  ["학술 근거", "Novy-Marx (2013), Asness et al. (2019)"],
                ]} />
              <FactorCard name="Low Volatility" kor="저변동성 (방어 팩터)" color="#8b5cf6" strength={3}
                maxStr="MDD 관리에 유리"
                rows={[
                  ["원리", "덜 흔들리는 자산이 장기 위험조정수익 우위"],
                  ["대표 지표", "표준편차, 베타, MDD"],
                  ["왜 작동하나", "기관 레버리지 제한으로 고베타 자산 과대평가"],
                  ["특징", "CAPM 예측과 반대로 작동하는 이례현상", "#22c55e"],
                  ["학술 근거", "Black (1972), Baker et al. (2011)"],
                ]} />
            </div>
            <FactorCard name="Size" kor="사이즈 팩터 — 소형주 효과" color="#eab308" strength={2}
              maxStr="최근 약화됨"
              rows={[
                ["원리", "소형주가 대형주보다 장기 초과수익"],
                ["대표 지표", "시가총액"],
                ["약화 이유", "ETF 대중화로 소형주 프리미엄 압축", "#f59e0b"],
                ["학술 근거", "Fama & French (1993)"],
              ]} />
          </section>

          {/* ── 5. 전략 유형 ── */}
          <section data-sec="strategies" style={{ marginBottom: 52, scrollMarginTop: 24 }}>
            <div style={S.secLabel}>이론 5</div>
            <div style={S.secTitle}>전략 유형</div>
            <div style={S.secSub}>퀀트 전략은 크게 다섯 가지 접근법으로 분류된다 — 현재 시장 적합도·신호 수신법 포함</div>
            <div style={S.divider} />

            {/* 5-A. 현재 시장 진단 */}
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 10 }}>
              현재 시장 진단 — 2026년 5월
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
              {[
                {
                  label: "시장 국면",
                  val: signalLoading ? "…" : signal.marketPhase,
                  sub: signalLoading ? "" : `업데이트: ${signal.updatedAt}`,
                  color: signal.marketPhase === "강세장" ? "#22c55e" : signal.marketPhase === "약세장" ? "#ef4444" : "#f59e0b",
                },
                {
                  label: `${signal.topAsset} 6M 수익률`,
                  val: signalLoading ? "…" : `${signal.topR6m >= 0 ? "+" : ""}${signal.topR6m}%`,
                  sub: signal.isSafe ? "절대모멘텀 음수 → 안전자산" : "듀얼 모멘텀 1위",
                  color: "#f97316",
                },
                {
                  label: "현재 보유 신호",
                  val: signalLoading ? "…" : signal.topAsset,
                  sub: `다음 리밸런싱: ${signal.nextRebalancing}`,
                  color: signal.isSafe ? "#94a3b8" : "#3b82f6",
                },
              ].map(({ label, val, sub, color }) => (
                <div key={label} style={{ background: "var(--bg-secondary)", border: `1px solid var(--border-primary)`,
                  borderTop: `3px solid ${color}`, borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color }}>{val}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 3 }}>{sub}</div>
                </div>
              ))}
            </div>
            <div style={{ background: "rgba(251,191,36,.07)", border: "1px solid rgba(251,191,36,.25)",
              borderLeft: "4px solid #f59e0b", borderRadius: "0 8px 8px 0", padding: "12px 16px", marginBottom: 24 }}>
              <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.8 }}>
                <strong>⚠️ 현재 국면 주의:</strong> AI·반도체 강세가 이미 6개월 이상 지속됐습니다.
                추세 추종은 지금도 유효하지만, <strong>모멘텀 크래시(급격한 추세 반전)</strong> 가능성이 높아지는 구간입니다.
                신호가 꺾이는 순간 즉시 전환할 준비를 유지해야 합니다.
              </p>
            </div>

            {/* 5-B. 전략별 상세 */}
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 12 }}>
              전략별 상세 — 신호 수신법
            </div>

            {/* 추세 추종 */}
            <StratCard
              color="#f97316" name="추세 추종 (Trend Following)" fit={5} fitLabel="현재 최적"
              summary="오르는 방향을 따라간다. 추세가 형성되면 관성이 지속된다는 행동 편향 활용"
              when="트렌드가 명확한 강세장 · 하락장. 횡보 구간에서는 손실 발생"
              now="AI·반도체 상승 추세 지속 중. 지금 이 전략이 가장 강력한 알파를 생성하는 시기"
              signals={[
                { method: "6개월 수익률 랭킹 (듀얼 모멘텀)", freq: "월 1회", detail: "매월 말 자산별 6M 수익률 계산 → 1위를 매수. 현재: 반도체 ETF +117.3% 1위 유지" },
                { method: "이동평균 교차 (MA Cross)", freq: "주 1회", detail: "20일선이 60일선을 상향 돌파 → 매수 신호. 하향 돌파 → 매도 또는 현금 전환" },
                { method: "52주 신고가 돌파", freq: "일 1회", detail: "52주 최고가 경신 종목은 모멘텀 강도가 가장 강한 상태. 편입 우선 후보" },
              ]}
              caution="모멘텀 크래시: 시장 급반전 시 단기간에 수익이 크게 사라질 수 있음. 모멘텀 신호(3M 수익률)가 음전하면 즉시 단기채권으로 전환"
            />

            {/* 평균 회귀 */}
            <StratCard
              color="#22c55e" name="평균 회귀 (Mean Reversion)" fit={1} fitLabel="현재 비적합"
              summary="과도하게 벗어나면 평균으로 돌아온다. 과매수·과매도 구간에서 역방향 포지션"
              when="횡보·박스권 시장. 변동성이 크지만 방향성이 없는 구간에서 유리"
              now="강한 추세 구간에서는 역방향 신호를 믿으면 손실. '너무 올랐으니 팔아야 해'가 계속 틀리는 시기"
              signals={[
                { method: "RSI (상대강도지수)", freq: "일 1회", detail: "RSI < 30 → 과매도, 반등 매수 신호. RSI > 70 → 과매수, 매도 신호. 단, 강한 추세에서는 RSI 70 이상이 오래 지속됨" },
                { method: "볼린저 밴드 이탈", freq: "일 1회", detail: "가격이 상단 밴드 이탈 → 단기 과매수. 하단 밴드 이탈 → 단기 과매도. 2σ 기준이 표준" },
                { method: "페어 트레이딩", freq: "일 1회", detail: "상관관계 높은 두 자산의 가격 차이(스프레드)가 과도하게 벌어지면 차이가 좁혀질 것으로 베팅. 예: KODEX 나스닥100 vs ACE 나스닥100" },
              ]}
              caution="지금처럼 강한 추세 구간에서는 역방향 포지션이 연속 손실을 낳습니다. 추세 전환(모멘텀 신호 붕괴) 확인 후 활용"
            />

            {/* 팩터 투자 */}
            <StratCard
              color="#3b82f6" name="팩터 투자 (Factor Investing)" fit={4} fitLabel="보조 전략"
              summary="검증된 팩터(변수)로 종목을 선별해 초과수익을 추구. 스마트베타 ETF가 대표적"
              when="장기 모든 시장 환경. 단일 팩터보다 모멘텀+퀄리티 결합이 효과적"
              now="모멘텀 팩터가 압도적 우위. 퀄리티 팩터를 결합해 모멘텀 크래시 시 하방 완충"
              signals={[
                { method: "모멘텀 + 퀄리티 결합 스코어", freq: "월 1회", detail: "6M 수익률(모멘텀) 순위 × ROE(퀄리티) 순위 결합 → 두 팩터 모두 상위 종목 선택. 단일 모멘텀보다 MDD 개선" },
                { method: "DART 재무데이터 업데이트", freq: "분기 1회", detail: "분기 보고서 발표 후 ROE, ROIC, 부채비율 갱신 → 퀄리티 스코어 재계산. DART OpenAPI로 자동화 가능" },
                { method: "스마트베타 ETF 모니터링", freq: "월 1회", detail: "KODEX 모멘텀, TIGER 퀄리티로우볼 등 국내 스마트베타 ETF의 팩터 노출도와 수익률 비교" },
              ]}
              caution="팩터는 장기적으로 작동하지만 단기 언더퍼폼 구간이 존재. 모멘텀 팩터는 현재 최강이지만 퀄리티 팩터로 하방을 보완해야 한다"
            />

            {/* 차익거래 */}
            <StratCard
              color="#8b5cf6" name="차익거래 (Arbitrage)" fit={3} fitLabel="보조 활용"
              summary="같은 자산의 가격 차이를 수확. 시장의 일시적 비효율을 이용"
              when="시장 환경 무관. 단, 기회가 발생하는 빈도와 규모가 항상 가변적"
              now="ETF-NAV 괴리나 선물-현물 베이시스는 항상 존재. 개인이 접근 가능한 수준은 제한적"
              signals={[
                { method: "ETF vs NAV 괴리율", freq: "일 1회", detail: "ETF 시장가격이 기초자산 NAV보다 낮으면 저평가 매수 기회. 괴리율 = (ETF 가격 - NAV) / NAV × 100. ±0.5% 이상이면 유의미" },
                { method: "선물-현물 베이시스", freq: "일 1회", detail: "선물 가격이 현물보다 비싸면(콘탱고) 매수 현물 + 매도 선물 페어. 수렴 시 차익 실현. 코스피200 선물 활용" },
                { method: "환율 재정거래", freq: "일 1회", detail: "국내 상장 미국 ETF와 미국 원본 ETF의 원화 환산 가격 차이. 환율 변동과 결합한 복합 전략" },
              ]}
              caution="순수 차익거래는 기관·HFT가 거의 즉시 소거. 개인은 ETF-NAV 괴리 확인 후 매수 타이밍 최적화에 활용하는 수준이 현실적"
            />

            {/* 머신러닝 */}
            <StratCard
              color="#eab308" name="머신러닝 (ML / AI)" fit={2} fitLabel="보조 도구"
              summary="패턴을 모델이 직접 학습. 인간이 발견하지 못한 비선형 관계를 포착"
              when="데이터가 충분하고 피처 엔지니어링이 잘 됐을 때. 단독 의존은 과적합 위험"
              now="뉴스 감성 분석이나 공시 텍스트 분석을 추세 추종의 보조 신호로 활용하는 것이 현실적"
              signals={[
                { method: "뉴스 감성 분석 (Sentiment)", freq: "일 1회", detail: "뉴스 제목·본문의 긍정/부정 점수 집계 → 섹터별 감성 지수. 감성 급락 구간이 모멘텀 크래시 선행 신호가 될 수 있음" },
                { method: "DART 공시 텍스트 분석", freq: "공시 발생 시", detail: "실적 발표·유상증자·자사주 취득 공시 텍스트를 NLP로 분류 → 매수/매도 신호. DART OpenAPI + KoBERT 활용" },
                { method: "앙상블 모델 (Stacking)", freq: "월 1회", detail: "모멘텀·퀄리티·감성 점수를 결합해 최종 매수 확률 예측. XGBoost 또는 LightGBM이 금융 데이터에서 자주 우수한 성과" },
              ]}
              caution="ML 모델은 금융 데이터의 낮은 S/N ratio로 과적합이 매우 쉽게 발생. 백테스트 성과가 좋아도 실전에서 무너지는 경우가 많음. 반드시 기존 규칙 기반 전략의 보조로만 활용"
            />

            {/* 5-C. 앞으로의 투자 방향 */}
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.06em",
              textTransform: "uppercase" as const, margin: "28px 0 12px" }}>
              앞으로의 투자 방향 — 3단계 로드맵
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                {
                  phase: "Phase 1", period: "현재 ~ 3개월", color: "#22c55e",
                  title: "추세 추종 유지",
                  items: [
                    `${signal.topAsset} ETF (${signal.topTicker}) 보유 유지 — 듀얼 모멘텀 6M ${signal.topR6m >= 0 ? "+" : ""}${signal.topR6m}% 1위 신호 유효`,
                    "매월 말 6M 수익률 재계산 → 1위 자산 확인 (바뀌면 교체)",
                    "모멘텀 크래시 감지 대시보드 주 1회 점검 — 🔴 신호 출현 시 즉시 대응",
                  ],
                  signal: "신호: 6M 수익률이 0% 미만으로 전환 시 → 단기채권 전환",
                },
                {
                  phase: "Phase 2", period: "모멘텀 크래시 신호 시", color: "#f59e0b",
                  title: "방어 전환",
                  items: [
                    "3M 수익률 음전 or 20일선이 60일선 하향 돌파 → 단기채권(153130) 50% 이상 전환",
                    "금(411060) 비중 유지 — 매크로 환경상 OW 판정 지속",
                    "추세 회복 확인 전까지 위험자산 신규 매수 중단",
                  ],
                  signal: "신호: RSI 60 이하 + 20일MA < 60일MA 동시 충족 시 방어 발동",
                },
                {
                  phase: "Phase 3", period: "장기 (6개월 이후)", color: "#3b82f6",
                  title: "팩터 다각화",
                  items: [
                    "모멘텀 단일 전략 → 모멘텀 + 퀄리티 결합 스코어링으로 업그레이드",
                    "DART 재무데이터 기반 ROE·ROIC 퀄리티 팩터 추가",
                    "스마트베타 ETF(퀄리티로우볼) 일부 편입 검토 — 모멘텀 크래시 완충",
                  ],
                  signal: "신호: 분기마다 팩터 스코어 재계산 → 모멘텀 + 퀄리티 상위 20% 유지",
                },
              ].map(({ phase, period, color, title, items, signal }) => (
                <div key={phase} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)",
                  borderLeft: `4px solid ${color}`, borderRadius: "0 10px 10px 0", padding: "16px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                      background: color + "22", color }}>{phase}</span>
                    <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{period}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginLeft: 4 }}>{title}</span>
                  </div>
                  <ul style={{ paddingLeft: 16, margin: "0 0 10px" }}>
                    {items.map(it => (
                      <li key={it} style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8, marginBottom: 2 }}>{it}</li>
                    ))}
                  </ul>
                  <div style={{ fontSize: 12, color, fontWeight: 600 }}>📡 {signal}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── 8. 백테스팅 방법론 ── */}
          <section data-sec="backtest" style={{ marginBottom: 52, scrollMarginTop: 24 }}>
            <div style={S.secLabel}>이론 6</div>
            <div style={S.secTitle}>백테스팅 방법론</div>
            <div style={S.secSub}>과거 데이터로 전략을 검증하는 과학 — 신뢰할 수 있는 결과를 얻는 5가지 원칙</div>
            <div style={S.divider} />

            <div style={S.hl}>
              <p style={{ fontSize: 13.5, color: "var(--text-primary)", lineHeight: 1.8 }}>
                <strong>핵심 원칙:</strong> 백테스트는 "미래를 예측"하는 게 아니라 "<strong>전략의 논리가 과거에 작동했는가</strong>"를 검증하는 도구입니다.
                좋은 백테스트는 현실적인 가정, 철저한 과적합 방지, 그리고 비용 반영이 전제되어야 합니다.
              </p>
            </div>

            {/* 5원칙 */}
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.06em",
              textTransform: "uppercase" as const, marginBottom: 12 }}>5가지 핵심 원칙</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              {([
                { num: 1, color: "#3b82f6", title: "In-Sample / Out-of-Sample 분리",
                  desc: "전체 데이터를 학습 기간(IS)과 검증 기간(OOS)으로 반드시 분리. IS로 파라미터 최적화, OOS로 성과 검증. OOS 성과가 IS 대비 50% 이상 유지되면 신뢰 가능.",
                  rule: "관행: IS 70% / OOS 30% 분리, 또는 Walk-Forward Test" },
                { num: 2, color: "#22c55e", title: "Look-Ahead Bias 제거",
                  desc: "신호 계산 시점에 '아직 공개되지 않은 미래 데이터'를 사용하면 결과가 왜곡됩니다. 특히 분기 재무 데이터는 공시 시점 기준으로 사용해야 합니다.",
                  rule: "예: 3월 말 재무제표는 5월 이후 공시 → 3월 말 신호에 미사용" },
                { num: 3, color: "#f97316", title: "현실적 비용 반영",
                  desc: "거래 수수료(0.015~0.3%) + 슬리피지(0.1~0.5%) + 세금(주식 양도세 0.18%)을 반드시 포함. 비용 미반영 vs 반영 CAGR 차이가 1%p 이상이면 실전 불가.",
                  rule: "ETF 월 리밸런싱 기준: 총 비용 약 0.5~1.0%/년 가정" },
                { num: 4, color: "#8b5cf6", title: "생존 편향(Survivorship Bias) 제거",
                  desc: "현재 존재하는 종목만으로 백테스트하면 '망한 종목'이 제외되어 성과가 과대평가됩니다. ETF 전략은 이 편향이 적지만 개별주 전략은 주의.",
                  rule: "ETF 백테스트는 상장폐지된 ETF 데이터 포함 여부 확인" },
                { num: 5, color: "#eab308", title: "Monte Carlo & Bootstrap 검증",
                  desc: "단일 백테스트 경로에 의존하지 않고, 무작위 복원 추출(bootstrap)로 1,000회 이상 시뮬레이션하여 결과의 분포와 신뢰 구간을 확인합니다.",
                  rule: "5th percentile CAGR > 0% 이면 통계적으로 신뢰 가능한 전략" },
              ] as { num: number; color: string; title: string; desc: string; rule: string }[]).map(({ num, color, title, desc, rule }) => (
                <div key={num} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)",
                  borderLeft: `4px solid ${color}`, borderRadius: "0 10px 10px 0", padding: "14px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 6, background: color + "22", color,
                      fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{num}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{title}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.75, marginBottom: 6 }}>{desc}</div>
                  <div style={{ fontSize: 11.5, color, fontWeight: 600 }}>📐 {rule}</div>
                </div>
              ))}
            </div>

            {/* 듀얼 모멘텀 실제 백테스트 결과 */}
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.06em",
              textTransform: "uppercase" as const, marginBottom: 10 }}>실제 백테스트 결과 — 듀얼 모멘텀 (2022.01~2026.05)</div>
            <Table>
              <thead><tr><Th>전략</Th><Th>누적 수익률</Th><Th>CAGR</Th><Th>MDD</Th><Th>샤프</Th><Th>비고</Th></tr></thead>
              <tbody>
                {[
                  ["듀얼모멘텀 (7자산)", "+221.5%", "30.3%", "-31.7%", "0.88", "✓ 채택", "#22c55e"],
                  ["나스닥100 BH", "+102.7%", "17.4%", "-30.8%", "0.92", "벤치마크", "#3b82f6"],
                  ["코스피200 BH", "+150.6%", "23.1%", "-29.1%", "0.81", "벤치마크", "#3b82f6"],
                  ["S&P500 BH", "+82.3%", "14.6%", "-16.1%", "1.04", "벤치마크", "#3b82f6"],
                  ["코스피60/미채40", "+91.7%", "15.9%", "-18.5%", "0.89", "혼합", "#94a3b8"],
                ].map(([s, cum, cagr, mdd, sh, note, nc]) => (
                  <tr key={s as string}>
                    <Td><strong style={{ color: s === "듀얼모멘텀 (7자산)" ? "#22c55e" : "var(--text-primary)" }}>{s as string}</strong></Td>
                    <Td color={cum as string >= "+0" ? "#22c55e" : "#ef4444"}>{cum as string}</Td>
                    <Td color="#22c55e">{cagr as string}</Td>
                    <Td color="#ef4444">{mdd as string}</Td>
                    <Td>{sh as string}</Td>
                    <Td color={nc as string}>{note as string}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.75 }}>
              ※ 리밸런싱 비용 0.3%/회 반영, 룩백 6개월, 월 1회 리밸런싱. 백테스트 기간이 4년으로 짧아 OOS 검증 추가 필요.
            </div>
          </section>

          {/* ── 11. 요약 ── */}
          <section data-sec="summary" style={{ marginBottom: 52, scrollMarginTop: 24 }}>
            <div style={S.secLabel}>Summary</div>
            <div style={S.secTitle}>핵심 요약</div>
            <div style={S.secSub}>퀀트 투자의 본질을 세 문장으로</div>
            <div style={S.divider} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[
                { emoji: "📐", color: "#3b82f6", title: "규칙을 만든다", desc: "데이터에서 패턴을 발굴하고, 검증 가능한 규칙으로 정의한다" },
                { emoji: "🔬", color: "#22c55e", title: "엄격히 검증한다", desc: "백테스트 + 비용 반영 + 과적합 검증 — 세 단계를 모두 통과해야 한다" },
                { emoji: "🤖", color: "#8b5cf6", title: "기계처럼 실행한다", desc: "신호대로만 매매한다. 감정이 개입하는 순간 퀀트가 아니다" },
              ].map(({ emoji, color, title, desc }) => (
                <div key={title} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)",
                  borderTop: `3px solid ${color}`, borderRadius: 10, padding: "20px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 26, marginBottom: 8 }}>{emoji}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>{title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>{desc}</div>
                </div>
              ))}
            </div>
            <div style={S.quote}>
              "In the short run, the market is a voting machine. In the long run, it's a weighing machine."
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>— Benjamin Graham</div>
            </div>
            <div style={S.card}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-tertiary)",
                textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>퀀트 투자 핵심 성과 지표</div>
              <Table>
                <thead><tr><Th>지표</Th><Th>설명</Th><Th>좋은 기준</Th></tr></thead>
                <tbody>
                  {[
                    ["CAGR", "연복리 수익률", "시장 수익률(KOSPI 약 8%) 상회", "#22c55e"],
                    ["MDD", "최대 낙폭 — 전고점 대비 최대 하락률", "-20% 이내 (공격적 전략은 -30% 허용)", "#22c55e"],
                    ["Sharpe Ratio", "위험 단위당 초과수익 = (수익률-무위험이자율)/변동성", "1.0 이상 우수, 0.5 이상 양호", "#22c55e"],
                    ["Calmar Ratio", "CAGR / MDD — 낙폭 대비 수익 효율", "0.5 이상", "#22c55e"],
                    ["턴오버", "연간 포트폴리오 교체 비율", "낮을수록 비용 절감 — 100% 이하 권장", "#f59e0b"],
                  ].map(([k, d, v, c]) => (
                    <tr key={k as string}>
                      <Td><strong style={{ color: "var(--text-primary)" }}>{k as string}</strong></Td>
                      <Td>{d as string}</Td>
                      <Td color={c as string}>{v as string}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
