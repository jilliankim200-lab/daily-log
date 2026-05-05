import { useEffect, useRef, useState, useCallback } from "react";

declare global {
  interface Window {
    Chart: any;
  }
}

// ── Chart instance refs type ──
type ChartRef = React.RefObject<HTMLCanvasElement | null>;

const gridOpts = { color: "rgba(0,0,0,0.06)", drawBorder: false };
const tickOpts = { color: "#8B95A1" };

export function DeepResearchViz() {
  const [activeTab, setActiveTab] = useState<"t1" | "t2" | "t3" | "t4">("t1");
  const [chartReady, setChartReady] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  // Canvas refs for all 8 charts
  const c1 = useRef<HTMLCanvasElement>(null);
  const c2 = useRef<HTMLCanvasElement>(null);
  const c3 = useRef<HTMLCanvasElement>(null);
  const c4 = useRef<HTMLCanvasElement>(null);
  const c5 = useRef<HTMLCanvasElement>(null);
  const c6 = useRef<HTMLCanvasElement>(null);
  const c7 = useRef<HTMLCanvasElement>(null);
  const c8 = useRef<HTMLCanvasElement>(null);

  // Keep chart instances for cleanup
  const chartInstances = useRef<any[]>([]);

  // Section refs for scroll-to
  const p1Ref = useRef<HTMLDivElement>(null);
  const p2Ref = useRef<HTMLDivElement>(null);
  const p3Ref = useRef<HTMLDivElement>(null);
  const p4Ref = useRef<HTMLDivElement>(null);

  // ── Load Chart.js dynamically ──
  useEffect(() => {
    if (window.Chart) {
      setChartReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";
    script.onload = () => setChartReady(true);
    document.head.appendChild(script);
  }, []);

  // ── Initialize all charts once chartReady ──
  useEffect(() => {
    if (!chartReady) return;

    const Chart = window.Chart;
    Chart.defaults.color = "#8B95A1";
    Chart.defaults.borderColor = "rgba(0,0,0,0.06)";
    Chart.defaults.font.family = "'Pretendard','Malgun Gothic','Noto Sans KR',sans-serif";
    Chart.defaults.font.size = 11;

    const instances: any[] = [];

    // ── C1: 어닝콜 감성 → 알파 ──
    if (c1.current) {
      instances.push(new Chart(c1.current, {
        type: "bar",
        data: {
          labels: ["하위 10%\n(소극적)", "하위 25%", "중간", "상위 25%", "상위 10%\n(적극적)"],
          datasets: [{
            label: "다음 달 초과수익 (bps)",
            data: [-256, -110, 0, 130, 247],
            backgroundColor: (v: any) => v.raw >= 0 ? "rgba(0,196,113,.75)" : "rgba(240,68,82,.75)",
            borderRadius: 6,
          }],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: gridOpts, ticks: tickOpts },
            y: {
              grid: gridOpts, ticks: tickOpts,
              title: { display: true, text: "bps", color: "#8B95A1" },
            },
          },
        },
      }));
    }

    // ── C2: PEAD 드리프트 ──
    if (c2.current) {
      const months = Array.from({ length: 12 }, (_, i) => `${i + 1}개월`);
      const pead = [0.8, 1.5, 2.3, 3.1, 3.8, 4.5, 5.1, 5.8, 6.4, 7.0, 7.5, 8.01];
      const bench = [0.2, 0.4, 0.7, 0.9, 1.1, 1.3, 1.5, 1.7, 1.8, 1.9, 2.0, 2.1];
      instances.push(new Chart(c2.current, {
        type: "line",
        data: {
          labels: months,
          datasets: [
            { label: "SUE.txt 전략", data: pead, borderColor: "rgba(49,130,246,1)", backgroundColor: "rgba(49,130,246,.08)", fill: true, tension: 0.4, borderWidth: 2 },
            { label: "벤치마크", data: bench, borderColor: "rgba(139,149,161,.7)", borderDash: [4, 4], tension: 0.4, borderWidth: 1.5, fill: false },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { position: "top", labels: { usePointStyle: true, boxWidth: 8 } } },
          scales: {
            x: { grid: gridOpts, ticks: tickOpts },
            y: {
              grid: gridOpts, ticks: tickOpts,
              title: { display: true, text: "누적 수익률 (%)", color: "#8B95A1" },
            },
          },
        },
      }));
    }

    // ── C3: 섹터 로테이션 성과 ──
    if (c3.current) {
      instances.push(new Chart(c3.current, {
        type: "bar",
        data: {
          labels: ["S&P500\nBuy&Hold", "AI 섹터 로테이션\n(하한)", "AI 섹터 로테이션\n(상한)"],
          datasets: [{
            label: "연간 수익률 (%)",
            data: [10.2, 11.8, 14.3],
            backgroundColor: ["rgba(139,149,161,.55)", "rgba(0,196,113,.7)", "rgba(49,130,246,.7)"],
            borderRadius: 8,
          }],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: gridOpts, ticks: tickOpts },
            y: {
              grid: gridOpts, ticks: tickOpts, min: 8,
              title: { display: true, text: "연수익률 (%)", color: "#8B95A1" },
            },
          },
        },
      }));
    }

    // ── C4: 경기 국면별 섹터 상대 수익 ──
    if (c4.current) {
      instances.push(new Chart(c4.current, {
        type: "bar",
        data: {
          labels: ["금융\n(초기확장)", "에너지\n(후기확장)", "헬스케어\n(둔화)", "필수소비재\n(침체)", "기술\n(후기확장)"],
          datasets: [{
            label: "S&P500 대비 초과수익 (%)",
            data: [4.2, 5.8, 3.1, 2.9, 6.3],
            backgroundColor: [
              "rgba(49,130,246,.7)", "rgba(255,149,0,.7)", "rgba(0,196,113,.7)",
              "rgba(138,63,252,.7)", "rgba(49,130,246,.7)",
            ],
            borderRadius: 6,
          }],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: gridOpts, ticks: tickOpts },
            y: {
              grid: gridOpts, ticks: tickOpts,
              title: { display: true, text: "초과수익 (%)", color: "#8B95A1" },
            },
          },
        },
      }));
    }

    // ── C5: 2024 AI 테마 수익 ──
    if (c5.current) {
      instances.push(new Chart(c5.current, {
        type: "bar",
        data: {
          labels: ["Nvidia\n(AI칩)", "S&P500\n전체", "반도체\n섹터", "에너지\n섹터", "유틸리티"],
          datasets: [{
            label: "2024년 수익률 (%)",
            data: [173, 24, 67, 8, 19],
            backgroundColor: (v: any) => v.raw > 50 ? "rgba(138,63,252,.75)" : v.raw > 20 ? "rgba(49,130,246,.7)" : "rgba(139,149,161,.55)",
            borderRadius: 8,
          }],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: gridOpts, ticks: tickOpts },
            y: {
              grid: gridOpts, ticks: tickOpts,
              title: { display: true, text: "수익률 (%)", color: "#8B95A1" },
            },
          },
        },
      }));
    }

    // ── C6: MarketSenseAI ──
    if (c6.current) {
      const mmonths = ["2023.01", "04", "07", "10", "2024.01", "04", "07", "10", "2024.12"];
      instances.push(new Chart(c6.current, {
        type: "line",
        data: {
          labels: mmonths,
          datasets: [
            { label: "MarketSenseAI", data: [0, 8, 19, 28, 42, 61, 83, 105, 125.9], borderColor: "rgba(0,196,113,1)", backgroundColor: "rgba(0,196,113,.07)", fill: true, tension: 0.4, borderWidth: 2.5 },
            { label: "S&P100 지수", data: [0, 5, 12, 17, 25, 38, 50, 62, 73.5], borderColor: "rgba(139,149,161,.7)", borderDash: [4, 4], fill: false, tension: 0.4, borderWidth: 1.5 },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { position: "top", labels: { usePointStyle: true, boxWidth: 8 } } },
          scales: {
            x: { grid: gridOpts, ticks: tickOpts },
            y: {
              grid: gridOpts, ticks: tickOpts,
              title: { display: true, text: "누적 수익률 (%)", color: "#8B95A1" },
            },
          },
        },
      }));
    }

    // ── C7: 멀티 에셋 CAGR ──
    if (c7.current) {
      instances.push(new Chart(c7.current, {
        type: "bar",
        data: {
          labels: ["KOSPI", "S&P500", "Bitcoin"],
          datasets: [
            { label: "전략 CAGR", data: [9.34, 7.41, 42.45], backgroundColor: ["rgba(49,130,246,.8)", "rgba(0,196,113,.8)", "rgba(255,149,0,.8)"], borderRadius: 8 },
            { label: "B&H CAGR", data: [13.22, 13.43, 43.03], backgroundColor: ["rgba(49,130,246,.25)", "rgba(0,196,113,.25)", "rgba(255,149,0,.25)"], borderRadius: 8 },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { position: "top", labels: { usePointStyle: true, boxWidth: 8 } } },
          scales: {
            x: { grid: gridOpts, ticks: tickOpts },
            y: {
              grid: gridOpts, ticks: tickOpts,
              title: { display: true, text: "CAGR (%)", color: "#8B95A1" },
            },
          },
        },
      }));
    }

    // ── C8: 레이더 ──
    if (c8.current) {
      instances.push(new Chart(c8.current, {
        type: "radar",
        data: {
          labels: ["속도", "분석 정밀도", "실시간성", "비용 효율", "코드 연동", "커버리지"],
          datasets: [
            { label: "Perplexity", data: [95, 72, 90, 95, 40, 88], borderColor: "rgba(0,196,113,.9)", backgroundColor: "rgba(0,196,113,.07)", borderWidth: 2, pointRadius: 4 },
            { label: "Claude", data: [70, 95, 75, 80, 98, 82], borderColor: "rgba(49,130,246,.9)", backgroundColor: "rgba(49,130,246,.07)", borderWidth: 2, pointRadius: 4 },
            { label: "AskEdgar", data: [80, 88, 85, 70, 30, 65], borderColor: "rgba(255,149,0,.9)", backgroundColor: "rgba(255,149,0,.07)", borderWidth: 2, pointRadius: 4 },
            { label: "LSEG+Claude", data: [65, 96, 95, 40, 90, 95], borderColor: "rgba(138,63,252,.9)", backgroundColor: "rgba(138,63,252,.07)", borderWidth: 2, pointRadius: 4 },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { position: "right", labels: { usePointStyle: true, boxWidth: 8, padding: 16 } } },
          scales: {
            r: {
              grid: { color: "rgba(0,0,0,0.08)" },
              angleLines: { color: "rgba(0,0,0,0.08)" },
              pointLabels: { color: "#4E5968", font: { size: 12 } },
              ticks: { display: false, stepSize: 20 },
              min: 0, max: 100,
            },
          },
        },
      }));
    }

    chartInstances.current = instances;

    return () => {
      instances.forEach((inst) => { try { inst.destroy(); } catch (_) {} });
      chartInstances.current = [];
    };
  }, [chartReady, activeTab]);

  // ── Copy prompt ──
  const copyPrompt = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setToastMsg("복사 완료!");
      setTimeout(() => setToastMsg(""), 2000);
    });
  }, []);

  // ── Scroll to prompt section ──
  const goPrompt = useCallback((ref: React.RefObject<HTMLDivElement | null>) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
      const el = ref.current;
      el.style.transition = "outline 0.1s";
      el.style.outline = "2px solid rgba(49,130,246,0.5)";
      el.style.borderRadius = "12px";
      setTimeout(() => { el.style.outline = "none"; }, 1500);
    }
  }, []);

  // ── Shared styles ──
  const sectionCard = {
    background: "var(--bg-card)",
    border: "1px solid var(--border-primary)",
    borderRadius: 12,
    padding: 20,
  };

  const chartCard = {
    background: "var(--bg-card)",
    border: "1px solid var(--border-primary)",
    borderRadius: 12,
    padding: 20,
  };

  const sectionHeaderTag: React.CSSProperties = {
    display: "inline-block",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "1.5px",
    padding: "4px 12px",
    borderRadius: 20,
    marginBottom: 10,
    background: "#EDF4FF",
    color: "#3182F6",
  };

  // ── Prompt texts ──
  const prompt1 = `[회사명]의 최근 3년 재무제표를 분석하고 다음을 순서대로 검토하라:

① 수익-현금흐름 乖離: 당기순이익 증가 시 영업현금흐름이 함께 증가하는가?
② 미수금 이상: 매출 성장률 대비 미수금 증가율 비교 (공격적 인식 징후)
③ 재고자산 변화: 급격한 증감, 평가방법 변경 여부
④ 회계정책 변경: 최근 3년 내 수익 인식 기준 변경 여부
⑤ 관련회사 거래: 비시장 조건 의심 거래, 순환 출자 구조
⑥ 단기 차입금 급증: 전년 대비 50% 이상 증가 시 사유 분석
⑦ 이자보상배율 추이: 영업이익으로 이자를 감당할 수 있는가?

각 항목에 대해 실제 수치를 인용하고, 위험도를 [정상/주의/위험]으로 분류하라.`;

  const prompt2 = `[회사명] 최근 어닝콜 트랜스크립트를 분석하라:

① CEO 전반 톤: 긍정/중립/부정 + 확신 수준 (1~10)
② 적극성 지표: 구체적 수치 제시 빈도 vs 모호한 표현 빈도
③ 주제 집중도: 핵심 사업 이슈에 집중하는가, 화제를 돌리는가?
④ 포워드 가이던스: 구체적 숫자를 제시하는가, 회피하는가?
⑤ 리스크 언급 빈도: 위험 요소를 선제적으로 언급하는가?
⑥ Q&A 방어적 태도: 날카로운 질문에 어떻게 반응하는가?

최종: 감성 점수(-5 ~ +5) + 어닝 서프라이즈 방향 예측 (상회/부합/하회)`;

  const prompt3 = `[회사명]의 공급망과 경쟁 환경을 분석하라:

[공급망 리스크]
① 주요 공급업체 Top 5와 매출 의존도 (%)
② 단일 공급업체 집중도 리스크 (50% 이상이면 위험 신호)
③ 지정학적 리스크 (중국 의존도, 미·중 갈등 노출)
④ 공급 차질 시 예상 영업이익 감소 시나리오 (금액 추정)

[경쟁 환경]
⑤ 시장 점유율 변화 추이 (최근 3년)
⑥ 신규 진입자 위협 (기술 장벽, 특허 만료 시점)
⑦ 가격 결정력 평가 (가격 인상 시 수요 탄력성)
⑧ 경쟁사 대비 원가 구조 우위/열위

결론: 공급망 탄력성 점수 (1~10) + 경쟁적 해자(Moat) 강도 평가`;

  const prompt4 = `현재 거시경제 지표(GDP, 인플레이션, 기준금리, ISM 제조업지수, 실업률)를
종합 분석하라:

① 현재 경기 사이클 단계 판별 (초기 확장 / 후기 확장 / 둔화 / 침체)
② 단계 판별 근거: 각 지표의 현황과 방향성을 수치로 제시
③ 최적 섹터 Top 3: 선택 이유와 과거 유사 국면 성과 데이터
④ 회피 섹터: 이유와 구체적 리스크 시나리오
⑤ 로테이션 타이밍 신호: 어떤 지표가 바뀌면 포지션을 전환해야 하는가?
⑥ 주요 테일 리스크: 예상 외 인플레이션 재가속, 지정학 충격 등

결론: 현재 추천 섹터 배분 (%) + 리밸런싱 트리거 조건`;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      {/* ── Page Header ── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
          딥리서치 투자 가이드
        </h1>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", marginTop: 4 }}>
          AI 딥리서치 기반 주식 투자 전략 가이드
        </p>
      </div>

      {/* ══════════════════════════════════
           QUICK START
      ══════════════════════════════════ */}
      <div style={{
        background: "linear-gradient(135deg,#1a1f35 0%,#1e3a5f 60%,#1a2744 100%)",
        borderRadius: 16,
        padding: 32,
        marginBottom: 32,
        border: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{
          fontSize: 13, fontWeight: 800, color: "#60A5FA",
          letterSpacing: "0.08em", textTransform: "uppercase",
          marginBottom: 20, display: "flex", alignItems: "center", gap: 8,
        }}>
          ⚡ Quick Start — 지금 바로 시작하기
        </div>

        {/* 4 Buttons */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 12,
          marginBottom: 24,
        }}>
          {[
            { icon: "🔍", label: "PROMPT 01 · 필수", title: "종목 재무 리스크 스캔", desc: "DART 사업보고서를 Claude에 붙여넣고 실행. 이상 징후 7가지를 자동 진단.", time: "⏱ 약 5분", ref: p1Ref },
            { icon: "📞", label: "PROMPT 02 · 필수", title: "어닝콜 감성 분석", desc: "IR 트랜스크립트 복사 후 실행. -5~+5 감성 점수와 서프라이즈 방향 예측.", time: "⏱ 약 3분", ref: p2Ref },
            { icon: "🔗", label: "PROMPT 03 · 심화", title: "공급망·경쟁 환경 분석", desc: "공급업체 집중도·지정학 노출·해자 강도를 1~10점으로 정량화.", time: "⏱ 약 8분", ref: p3Ref },
            { icon: "🌐", label: "PROMPT 04 · 매크로", title: "경기 국면 → 섹터 배분", desc: "현재 GDP·ISM·금리 데이터 입력 → 최적 섹터 Top 3 + 리밸런싱 트리거 도출.", time: "⏱ 약 5분", ref: p4Ref },
          ].map((btn) => (
            <button
              key={btn.label}
              onClick={() => goPrompt(btn.ref)}
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 12,
                padding: "18px 16px",
                cursor: "pointer",
                textAlign: "left",
                color: "#fff",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                const t = e.currentTarget;
                t.style.background = "rgba(255,255,255,0.13)";
                t.style.borderColor = "rgba(96,165,250,0.5)";
                t.style.transform = "translateY(-2px)";
                t.style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)";
              }}
              onMouseLeave={(e) => {
                const t = e.currentTarget;
                t.style.background = "rgba(255,255,255,0.07)";
                t.style.borderColor = "rgba(255,255,255,0.12)";
                t.style.transform = "none";
                t.style.boxShadow = "none";
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 10 }}>{btn.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#93C5FD", letterSpacing: "0.04em", marginBottom: 4 }}>{btn.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9", marginBottom: 6 }}>{btn.title}</div>
              <div style={{ fontSize: 11.5, color: "#94A3B8", lineHeight: 1.5 }}>{btn.desc}</div>
              <span style={{
                display: "inline-block", marginTop: 10,
                fontSize: 10.5, fontWeight: 600, color: "#60A5FA",
                background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.2)",
                padding: "2px 8px", borderRadius: 20,
              }}>{btn.time}</span>
            </button>
          ))}
        </div>

        {/* Flow steps */}
        <div style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 12,
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 0,
        }}>
          {[
            "분석 목적 선택 (위 4개 중 하나)",
            "프롬프트 복사 → Claude / Perplexity 실행",
            "결과 점수화 → Python 팩터로 변환",
            "매크로 섹터 대시보드와 교차 검증",
          ].map((step, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", fontSize: 12.5, color: "#CBD5E1", fontWeight: 500 }}>
                <span style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: "rgba(96,165,250,0.2)", color: "#60A5FA",
                  fontSize: 11, fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>{i + 1}</span>
                <span>{step}</span>
              </div>
              {i < 3 && <span style={{ color: "#475569", fontSize: 16 }}>→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ── SECTION 1: 4대 주제 ── */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ marginBottom: 28 }}>
          <div style={sectionHeaderTag}>OVERVIEW</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px", color: "var(--text-primary)", letterSpacing: "-0.3px" }}>
            딥리서치 활용 4대 주제
          </h2>
          <p style={{ color: "var(--text-tertiary)", fontSize: 14, margin: 0 }}>
            필수 2가지 + 추가 2가지 — 각 주제를 클릭해 상세 내용 확인
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 20 }}>
          {[
            {
              num: "TOPIC 01 · 필수",
              title: "🔍 기업 가치 & 숨겨진 리스크",
              desc: "재무제표 이상 탐지, 회계 조작 징후, 숨겨진 부채, 관련회사 거래를 AI로 자동 스캐닝합니다.",
              chips: ["재무제표 분석", "이상 탐지", "SEC/DART", "흑자도산 경보"],
              barColor: "linear-gradient(90deg,#3182F6,#8A3FFC)",
            },
            {
              num: "TOPIC 02 · 필수",
              title: "📰 시장 흐름 & 뉴스 모니터링",
              desc: "어닝콜 감성 분석, PEAD 포착, 어닝 서프라이즈 예측으로 정보 우위를 확보합니다.",
              chips: ["감성 분석", "어닝콜", "PEAD", "NLP 알파"],
              barColor: "linear-gradient(90deg,#00C471,#3182F6)",
            },
            {
              num: "TOPIC 03 · 추가",
              title: "🌐 공급망 & 경쟁 환경 분석",
              desc: "공급망 집중도 리스크, 경쟁사 전략 변화, 시장 점유율 이동을 실시간으로 포착합니다.",
              chips: ["공급망 리스크", "경쟁 분석", "지정학적 리스크", "Moat 평가"],
              barColor: "linear-gradient(90deg,#FF9500,#F04452)",
            },
            {
              num: "TOPIC 04 · 추가",
              title: "📊 매크로 & 섹터 로테이션",
              desc: "경기 사이클 판별 + AI 섹터 배분으로 연 1.8~4.1%p 초과수익을 목표로 합니다.",
              chips: ["경기 사이클", "섹터 로테이션", "거시경제", "알파 생성"],
              barColor: "linear-gradient(90deg,#8A3FFC,#F04452)",
            },
          ].map((card) => (
            <div
              key={card.num}
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-primary)",
                borderRadius: 14,
                padding: 28,
                position: "relative",
                overflow: "hidden",
                cursor: "pointer",
                transition: "box-shadow 0.2s, transform 0.2s",
              }}
              onMouseEnter={(e) => {
                const t = e.currentTarget;
                t.style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)";
                t.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                const t = e.currentTarget;
                t.style.boxShadow = "none";
                t.style.transform = "none";
              }}
            >
              {/* top color bar */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: card.barColor }} />
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "var(--text-tertiary)", marginBottom: 8 }}>{card.num}</div>
              <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 10, color: "var(--text-primary)" }}>{card.title}</h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, marginBottom: 16 }}>{card.desc}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {card.chips.map((chip) => (
                  <span key={chip} style={{
                    fontSize: 11, padding: "3px 10px", borderRadius: 20,
                    background: "var(--bg-tertiary)", color: "var(--text-tertiary)",
                    border: "1px solid var(--border-primary)",
                  }}>{chip}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SECTION 2: 성과 데이터 ── */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ marginBottom: 28 }}>
          <div style={sectionHeaderTag}>EVIDENCE</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px", color: "var(--text-primary)", letterSpacing: "-0.3px" }}>
            실증 성과 데이터
          </h2>
          <p style={{ color: "var(--text-tertiary)", fontSize: 14, margin: 0 }}>
            학술 논문 & 업계 연구 기반 — AI 딥리서치의 실제 알파 생성 근거
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border-primary)", marginBottom: 28 }}>
          {(["t1", "t2", "t3", "t4"] as const).map((tab, i) => {
            const labels = ["어닝콜 감성", "섹터 로테이션", "AI 전략 vs B&H", "리스크 감지 정확도"];
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: "none",
                  border: "none",
                  borderBottom: isActive ? "2px solid #3182F6" : "2px solid transparent",
                  color: isActive ? "#3182F6" : "var(--text-tertiary)",
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "12px 20px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {labels[i]}
              </button>
            );
          })}
        </div>

        {/* Tab Panel T1 */}
        {activeTab === "t1" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 20, marginBottom: 20 }}>
              <div style={chartCard}>
                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>어닝콜 CEO 톤 → 다음 달 알파</h4>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 16 }}>적극적 & 주제 집중 vs 소극적 & 주제 이탈 (bps)</p>
                <canvas ref={c1} height={220} />
              </div>
              <div style={chartCard}>
                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>텍스트 기반 PEAD 누적 수익률</h4>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 16 }}>SUE.txt 기반 어닝 서프라이즈 포착 — 1년 누적 (Philadelphia Fed 연구)</p>
                <canvas ref={c2} height={220} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
              {[
                { val: "+247 bps", color: "#00C471", lbl: "높은 감성 (상위 10%)", sub: "다음 달 초과수익" },
                { val: "-256 bps", color: "#F04452", lbl: "낮은 감성 (하위 10%)", sub: "다음 달 언더퍼폼" },
                { val: "+8.01%", color: "#3182F6", lbl: "텍스트 SUE 1년 수익", sub: "PEAD 드리프트" },
                { val: "503 bps", color: "#8A3FFC", lbl: "감성 스프레드", sub: "롱숏 알파 기회" },
              ].map((m) => (
                <div key={m.lbl} style={{
                  background: "var(--bg-card)", border: "1px solid var(--border-primary)",
                  borderRadius: 14, padding: "20px 24px", flex: 1, minWidth: 160,
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 30, fontWeight: 900, color: m.color }}>{m.val}</div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>{m.lbl}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{m.sub}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Panel T2 */}
        {activeTab === "t2" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, marginBottom: 20 }}>
            <div style={chartCard}>
              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>AI 섹터 로테이션 vs B&H 연수익률</h4>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 16 }}>Fidelity & S&P Global 연구 (1962~2024)</p>
              <canvas ref={c3} height={220} />
            </div>
            <div style={chartCard}>
              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>경기 국면별 최적 섹터 성과 (상대 수익)</h4>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 16 }}>각 국면에서 해당 섹터의 S&P 500 대비 초과수익 평균</p>
              <canvas ref={c4} height={220} />
            </div>
            <div style={chartCard}>
              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>2024~2025 AI 테마 선도 섹터</h4>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 16 }}>Nvidia 기준 AI 섹터 수익률 (2024 기준)</p>
              <canvas ref={c5} height={220} />
            </div>
          </div>
        )}

        {/* Tab Panel T3 */}
        {activeTab === "t3" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 20, marginBottom: 20 }}>
            <div style={chartCard}>
              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>MarketSenseAI vs S&P 100 누적 수익</h4>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 16 }}>RAG + LLM 에이전트 전략 (2023~2024)</p>
              <canvas ref={c6} height={220} />
            </div>
            <div style={chartCard}>
              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>돈치안 전략 — KOSPI vs S&P500 vs Bitcoin</h4>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 16 }}>전략 CAGR vs B&H CAGR (이번 세션 백테스트)</p>
              <canvas ref={c7} height={220} />
            </div>
          </div>
        )}

        {/* Tab Panel T4 */}
        {activeTab === "t4" && (
          <div style={{ overflowX: "auto" }}>
            <table style={{
              width: "100%", borderCollapse: "collapse",
              background: "var(--bg-card)", borderRadius: 14,
              overflow: "hidden", border: "1px solid var(--border-primary)",
              fontSize: 13, marginBottom: 20,
            }}>
              <thead>
                <tr>
                  {["탐지 항목", "AI 정확도", "대표 시그널", "주의사항"].map((th) => (
                    <th key={th} style={{
                      background: "var(--bg-tertiary)", color: "var(--text-tertiary)",
                      padding: "10px 16px", textAlign: "left",
                      fontSize: 11, fontWeight: 700, letterSpacing: "0.5px",
                    }}>{th}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { item: "수익-현금흐름 불일치", level: "높음", levelColor: "#D1FAE5", levelText: "#065F46", signal: "영업이익↑ & OCF 정체", note: "수치 직접 재확인 필수" },
                  { item: "미수금 이상 증가", level: "높음", levelColor: "#D1FAE5", levelText: "#065F46", signal: "매출 성장률 < 미수금 증가율", note: "업종 특성 고려" },
                  { item: "회계정책 빈번 변경", level: "높음", levelColor: "#D1FAE5", levelText: "#065F46", signal: "주석 내 정책 변경 탐지", note: "연도별 주석 비교" },
                  { item: "관련회사 거래", level: "중간", levelColor: "#FEF3C7", levelText: "#92400E", signal: "비시장 조건 내부 거래", note: "지식 그래프 도구 병용" },
                  { item: "단기 차입금 급증", level: "중간", levelColor: "#FEF3C7", levelText: "#92400E", signal: "전년 대비 50%+ 증가", note: "사유 설명 필요" },
                  { item: "숨겨진 부채", level: "낮음", levelColor: "#FEE2E2", levelText: "#991B1B", signal: "비공개 계약·구두 합의", note: "공개 정보 한계" },
                ].map((row, i) => (
                  <tr key={i}>
                    <td style={{ padding: "11px 16px", borderTop: "1px solid var(--border-primary)", color: "var(--text-primary)" }}>{row.item}</td>
                    <td style={{ padding: "11px 16px", borderTop: "1px solid var(--border-primary)" }}>
                      <span style={{
                        display: "inline-block", fontSize: 11, fontWeight: 700,
                        padding: "2px 10px", borderRadius: 20,
                        background: row.levelColor, color: row.levelText,
                      }}>{row.level}</span>
                    </td>
                    <td style={{ padding: "11px 16px", borderTop: "1px solid var(--border-primary)", color: "var(--text-primary)" }}>{row.signal}</td>
                    <td style={{ padding: "11px 16px", borderTop: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}>{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── SECTION 3: 통합 워크플로우 ── */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ marginBottom: 28 }}>
          <div style={sectionHeaderTag}>WORKFLOW</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px", color: "var(--text-primary)", letterSpacing: "-0.3px" }}>
            실전 4단계 통합 워크플로우
          </h2>
          <p style={{ color: "var(--text-tertiary)", fontSize: 14, margin: 0 }}>
            퀀트 투자팀이 실제 운용에 적용할 수 있는 AI 딥리서치 프로세스
          </p>
        </div>

        {/* Workflow steps */}
        <div style={{
          display: "flex", alignItems: "stretch", background: "var(--bg-card)",
          border: "1px solid var(--border-primary)", borderRadius: 12,
          overflow: "hidden", marginBottom: 20,
        }}>
          {[
            {
              num: "1", numBg: "#EDF4FF", numColor: "#3182F6",
              title: "유니버스 스크리닝",
              desc: "산업 트렌드 & 뉴스 모니터링\n이상 공시 & 어닝 서프라이즈 후보 식별\n공급망 리스크 초기 스캔",
              tool: "Perplexity Deep Research",
            },
            {
              num: "2", numBg: "#ECFDF5", numColor: "#059669",
              title: "개별 기업 심층 분석",
              desc: "재무제표 이상 탐지 프롬프트\n공급망·경쟁 환경 평가\n어닝콜 텍스트 감성 분석",
              tool: "Claude + DART/SEC",
            },
            {
              num: "3", numBg: "#FFFBEB", numColor: "#B45309",
              title: "신호 정량화",
              desc: "어닝콜 감성 점수 → PEAD 포착\n재무 건전성 스코어 산출\n섹터 로테이션 신호 생성",
              tool: "Python + fin_analyzer",
            },
            {
              num: "4", numBg: "#F5F3FF", numColor: "#6D28D9",
              title: "포지션 결정",
              desc: "섹터 배분 + 개별 기업 점수 결합\n리스크 관리 (Stop-loss 설계)\n포트폴리오 사이징",
              tool: "인간 최종 판단",
            },
          ].map((step, i) => (
            <div key={step.num} style={{
              flex: 1,
              padding: "20px 16px",
              borderRight: i < 3 ? "1px solid var(--border-primary)" : "none",
              position: "relative",
            }}>
              {i < 3 && (
                <span style={{
                  position: "absolute", right: -12, top: "50%", transform: "translateY(-50%)",
                  color: "var(--text-tertiary)", fontSize: 18, zIndex: 1,
                }}>→</span>
              )}
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 800, marginBottom: 10,
                background: step.numBg, color: step.numColor,
              }}>{step.num}</div>
              <h4 style={{ fontSize: 13, fontWeight: 800, marginBottom: 6, color: "var(--text-primary)" }}>{step.title}</h4>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-line" }}>{step.desc}</p>
              <span style={{
                display: "inline-block", fontSize: 10, marginTop: 8,
                padding: "2px 8px", borderRadius: 12,
                background: "var(--bg-tertiary)", color: "var(--text-tertiary)",
                border: "1px solid var(--border-primary)",
              }}>{step.tool}</span>
            </div>
          ))}
        </div>

        {/* 경기 사이클 섹터 매핑 */}
        <div style={{ ...chartCard, marginBottom: 20 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>경기 사이클 × 섹터 로테이션 매핑</h4>
          <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 16 }}>딥리서치로 현재 국면을 판별한 후 아래 매트릭스로 섹터 배분 결정</p>
          <div style={{ overflowX: "auto" }}>
            <table style={{
              width: "100%", borderCollapse: "collapse",
              background: "var(--bg-card)", borderRadius: 10,
              border: "1px solid var(--border-primary)", fontSize: 13,
            }}>
              <thead>
                <tr>
                  {["경기 국면", "최적 섹터 ↑", "회피 섹터 ↓", "핵심 지표"].map((th) => (
                    <th key={th} style={{
                      background: "var(--bg-tertiary)", color: "var(--text-tertiary)",
                      padding: "10px 16px", textAlign: "left",
                      fontSize: 11, fontWeight: 700, letterSpacing: "0.5px",
                    }}>{th}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { phase: "초기 확장", phaseColor: "#DBEAFE", phaseText: "#1E40AF", opt: "금융, 소재, 산업재", avoid: "유틸리티, 필수소비재", indicator: "ISM 제조업↑, 실업률↓" },
                  { phase: "후기 확장", phaseColor: "#D1FAE5", phaseText: "#065F46", opt: "에너지, 기술, 소비재량", avoid: "채권, 유틸리티", indicator: "인플레이션↑, 금리↑ 시작" },
                  { phase: "경기 둔화", phaseColor: "#FEF3C7", phaseText: "#92400E", opt: "헬스케어, 유틸리티", avoid: "소비재량, 기술", indicator: "GDP 성장 둔화, PMI < 50" },
                  { phase: "침체", phaseColor: "#FEE2E2", phaseText: "#991B1B", opt: "필수소비재, 채권, 금", avoid: "에너지, 금융, 소재", indicator: "실업률↑, 수익률 곡선 역전" },
                ].map((row, i) => (
                  <tr key={i}>
                    <td style={{ padding: "11px 16px", borderTop: "1px solid var(--border-primary)" }}>
                      <span style={{
                        display: "inline-block", fontSize: 11, fontWeight: 700,
                        padding: "2px 10px", borderRadius: 20,
                        background: row.phaseColor, color: row.phaseText,
                      }}>{row.phase}</span>
                    </td>
                    <td style={{ padding: "11px 16px", borderTop: "1px solid var(--border-primary)", color: "var(--text-primary)" }}>{row.opt}</td>
                    <td style={{ padding: "11px 16px", borderTop: "1px solid var(--border-primary)", color: "var(--text-primary)" }}>{row.avoid}</td>
                    <td style={{ padding: "11px 16px", borderTop: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}>{row.indicator}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── SECTION 4: 프롬프트 ── */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ marginBottom: 28 }}>
          <div style={sectionHeaderTag}>PROMPTS</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px", color: "var(--text-primary)", letterSpacing: "-0.3px" }}>
            실전 프롬프트 4종
          </h2>
          <p style={{ color: "var(--text-tertiary)", fontSize: 14, margin: 0 }}>
            복사 후 바로 사용 — 각 주제별 최적화된 딥리서치 프롬프트
          </p>
        </div>

        {/* Prompt 1 */}
        <div ref={p1Ref} style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#EDF4FF", color: "#3182F6" }}>PROMPT 01</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#ECFDF5", color: "#059669" }}>필수</span>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>⏱ 약 5분 · Claude 권장</span>
            </div>
          </div>
          <div style={{
            background: "var(--bg-secondary)", border: "1px solid var(--border-primary)",
            borderRadius: 8, padding: "10px 14px", marginBottom: 12,
            fontSize: 12, color: "var(--text-secondary)",
            display: "flex", alignItems: "flex-start", gap: 8,
          }}>
            <strong style={{ color: "var(--text-primary)", fontWeight: 700, flexShrink: 0 }}>📤 예상 아웃풋:</strong>
            7개 항목별 [정상/주의/위험] 판정 + 실제 수치 인용. 흑자도산 경보·회계 조작 징후 자동 탐지.
          </div>
          <PromptBox label="① 기업 가치 & 리스크 분석 프롬프트" text={prompt1} onCopy={copyPrompt} />
        </div>

        {/* Prompt 2 */}
        <div ref={p2Ref} style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#EDF4FF", color: "#3182F6" }}>PROMPT 02</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#ECFDF5", color: "#059669" }}>필수</span>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>⏱ 약 3분 · Claude / FinBERT 권장</span>
            </div>
          </div>
          <div style={{
            background: "var(--bg-secondary)", border: "1px solid var(--border-primary)",
            borderRadius: 8, padding: "10px 14px", marginBottom: 12,
            fontSize: 12, color: "var(--text-secondary)",
            display: "flex", alignItems: "flex-start", gap: 8,
          }}>
            <strong style={{ color: "var(--text-primary)", fontWeight: 700, flexShrink: 0 }}>📤 예상 아웃풋:</strong>
            감성 점수 (-5~+5) + 어닝 서프라이즈 방향 예측 (상회/부합/하회). 팩터 시그널로 직접 변환 가능.
          </div>
          <PromptBox label="② 어닝콜 감성 분석 프롬프트" text={prompt2} onCopy={copyPrompt} />
        </div>

        {/* Prompt 3 */}
        <div ref={p3Ref} style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#FFF7ED", color: "#C2410C" }}>PROMPT 03</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#FFF7ED", color: "#C2410C" }}>심화</span>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>⏱ 약 8분 · Perplexity Deep Research 권장</span>
            </div>
          </div>
          <div style={{
            background: "var(--bg-secondary)", border: "1px solid var(--border-primary)",
            borderRadius: 8, padding: "10px 14px", marginBottom: 12,
            fontSize: 12, color: "var(--text-secondary)",
            display: "flex", alignItems: "flex-start", gap: 8,
          }}>
            <strong style={{ color: "var(--text-primary)", fontWeight: 700, flexShrink: 0 }}>📤 예상 아웃풋:</strong>
            공급망 탄력성 점수 (1~10) + 경쟁적 해자 강도 평가. 지정학 노출도·단일 공급업체 집중 리스크 정량화.
          </div>
          <PromptBox label="③ 공급망 & 경쟁 환경 분석 프롬프트" text={prompt3} onCopy={copyPrompt} />
        </div>

        {/* Prompt 4 */}
        <div ref={p4Ref} style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#F5F3FF", color: "#6D28D9" }}>PROMPT 04</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#F5F3FF", color: "#6D28D9" }}>매크로</span>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>⏱ 약 5분 · FRED + Claude 권장</span>
            </div>
          </div>
          <div style={{
            background: "var(--bg-secondary)", border: "1px solid var(--border-primary)",
            borderRadius: 8, padding: "10px 14px", marginBottom: 12,
            fontSize: 12, color: "var(--text-secondary)",
            display: "flex", alignItems: "flex-start", gap: 8,
          }}>
            <strong style={{ color: "var(--text-primary)", fontWeight: 700, flexShrink: 0 }}>📤 예상 아웃풋:</strong>
            현재 경기 국면 + 추천 섹터 배분 (%) + 리밸런싱 트리거 조건. 매크로 섹터 대시보드와 교차 검증용.
          </div>
          <PromptBox label="④ 매크로 & 섹터 로테이션 프롬프트" text={prompt4} onCopy={copyPrompt} />
        </div>
      </div>

      {/* ── SECTION 5: 도구 비교 ── */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ marginBottom: 28 }}>
          <div style={sectionHeaderTag}>TOOLS</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px", color: "var(--text-primary)", letterSpacing: "-0.3px" }}>
            AI 딥리서치 도구 비교
          </h2>
          <p style={{ color: "var(--text-tertiary)", fontSize: 14, margin: 0 }}>
            용도별 최적 도구 선택 가이드
          </p>
        </div>

        {/* Tool grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20 }}>
          {[
            { name: "🔍 Perplexity Deep Research", desc: "2~4분 내 수십 개 소스 자동 종합. 실시간 웹 검색 기반. 속도 대비 인사이트 비율 최고.", price: "$20/월", priceColor: "#047857", priceBorder: "rgba(0,196,113,.25)" },
            { name: "🤖 Claude (Deep Research)", desc: "재무 문서 분석 정밀도 최고. MCP로 LSEG·S&P Global 데이터 직접 연동. 코드 생성 병행.", price: "API 종량", priceColor: "#1D4ED8", priceBorder: "rgba(49,130,246,.25)" },
            { name: "📄 AskEdgar / Intelligize", desc: "SEC 파일링 전용. RAG 방식으로 10-K 동시 분석. 중대 조건 변화 알림 제공.", price: "별도 계약", priceColor: "#B45309", priceBorder: "rgba(255,149,0,.25)" },
            { name: "📊 FinBERT / GPT-4", desc: "금융 감성 분석에 특화. 어닝콜 스코어 자동화. FinBERT는 금융 도메인 사전 학습.", price: "API 종량", priceColor: "#1D4ED8", priceBorder: "rgba(49,130,246,.25)" },
            { name: "🏦 LSEG + Claude MCP", desc: "실시간 시장 데이터 + Claude AI 결합. 어닝 분석·리스크 평가에 최적. 기관 투자자용.", price: "기관 계약", priceColor: "#991B1B", priceBorder: "rgba(240,68,82,.25)" },
            { name: "📡 FRED + Claude", desc: "연준 경제 데이터(무료) + Claude 해석. 경기 사이클 판별, 섹터 로테이션 신호 생성.", price: "무료 + API", priceColor: "#047857", priceBorder: "rgba(0,196,113,.25)" },
          ].map((tool) => (
            <div key={tool.name} style={{
              background: "var(--bg-card)", border: "1px solid var(--border-primary)",
              borderRadius: 14, padding: 18,
              transition: "box-shadow 0.2s, transform 0.2s",
            }}
              onMouseEnter={(e) => {
                const t = e.currentTarget;
                t.style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)";
                t.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                const t = e.currentTarget;
                t.style.boxShadow = "none";
                t.style.transform = "none";
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6, color: "var(--text-primary)" }}>{tool.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10, lineHeight: 1.55 }}>{tool.desc}</div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                display: "inline-block", background: "var(--bg-tertiary)",
                border: `1px solid ${tool.priceBorder}`, color: tool.priceColor,
              }}>{tool.price}</span>
            </div>
          ))}
        </div>

        {/* Radar chart */}
        <div style={chartCard}>
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>도구별 역량 레이더</h4>
          <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 16 }}>속도·정밀도·실시간성·비용 효율·코드 연동 5개 축 비교</p>
          <canvas ref={c8} height={320} />
        </div>
      </div>

      {/* ── SECTION 6: 리스크 ── */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ marginBottom: 28 }}>
          <div style={sectionHeaderTag}>RISK</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px", color: "var(--text-primary)", letterSpacing: "-0.3px" }}>
            한계 & 반드시 인지할 리스크
          </h2>
          <p style={{ color: "var(--text-tertiary)", fontSize: 14, margin: 0 }}>
            AI 딥리서치는 강력하지만, 이 5가지를 모르면 오히려 위험합니다.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, marginBottom: 20 }}>
          {[
            { icon: "🌀", title: "환각 (Hallucination)", desc: "AI가 존재하지 않는 수치나 사실을 생성할 수 있습니다. 모든 정량 데이터는 원본 소스에서 반드시 재확인하세요." },
            { icon: "⏱️", title: "데이터 컷오프", desc: "LLM 학습 데이터에는 시간 제한이 있습니다. 실시간 웹 검색 기능이 있는 도구를 사용하거나 최신 공시를 직접 제공하세요." },
            { icon: "🔒", title: "비공개 정보 한계", desc: "내부 계약, 구두 합의, 비공개 협상은 탐지 불가합니다. 공개 정보 기반 분석의 구조적 한계입니다." },
            { icon: "📉", title: "소형주 취약", desc: "공개 정보가 적은 소형주일수록 AI 분석의 신뢰도가 낮아집니다. 직접 IR 접촉과 병행이 필수입니다." },
            { icon: "🧠", title: "과신 편향", desc: "AI의 자신감 있는 어조가 정확성을 보장하지 않습니다. AI는 \"분석가 10명의 1차 작업\"을 대체하지, 최종 판단을 대체하지 않습니다." },
            { icon: "⚖️", title: "법적·규제 리스크", desc: "AI 분석 기반 투자 결정의 책임은 투자자에게 있습니다. AI를 내부 도구로 사용하더라도 규제 준수 여부를 확인하세요." },
          ].map((risk) => (
            <div key={risk.title} style={{
              background: "rgba(248,113,113,0.05)",
              border: "1px solid rgba(240,68,82,.15)",
              borderRadius: 10, padding: 16,
              display: "flex", gap: 12,
            }}>
              <div style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{risk.icon}</div>
              <div>
                <h5 style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: "#D93240" }}>{risk.title}</h5>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>{risk.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 핵심 원칙 */}
        <div style={{
          background: "linear-gradient(135deg,#EDF4FF,#F5F0FF)",
          border: "1px solid rgba(49,130,246,.15)",
          borderRadius: 14, padding: "24px 28px",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#3182F6", marginBottom: 10 }}>💡 핵심 원칙</div>
          <p style={{ fontSize: 14, lineHeight: 1.75, color: "#4E5968", margin: 0 }}>
            딥리서치는 <strong style={{ color: "#191F28" }}>"분석가 10명의 1차 작업"</strong>을 대체하지만,{" "}
            <strong style={{ color: "#191F28" }}>"펀드매니저의 최종 판단"</strong>은 대체하지 못합니다.
            속도와 커버리지를 극대화하되, 최종 결정은{" "}
            <strong style={{ color: "#191F28" }}>데이터 기반 인간 판단</strong>으로 유지하는 것이 현재 최선의 활용법입니다.
          </p>
        </div>
      </div>

      {/* ── Footer note ── */}
      <div style={{
        borderTop: "1px solid var(--border-primary)",
        paddingTop: 24,
        textAlign: "center",
        color: "var(--text-tertiary)",
        fontSize: 12,
        lineHeight: 1.8,
      }}>
        딥리서치 × 주식 투자 가이드 · 2026-05-05 · 20개 이상 학술 논문·업계 보고서 종합<br />
        Philadelphia Fed · ACL · Deloitte · BlackRock · MarketSenseAI · Fidelity & S&P Global 연구 기반
      </div>

      {/* ── Toast ── */}
      {toastMsg && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "#191F28", color: "#FFFFFF",
          padding: "10px 24px", borderRadius: 20, fontSize: 13,
          boxShadow: "0 4px 20px rgba(0,0,0,.18)",
          zIndex: 999, pointerEvents: "none",
        }}>
          {toastMsg}
        </div>
      )}
    </div>
  );
}

// ── PromptBox sub-component ──
function PromptBox({ label, text, onCopy }: { label: string; text: string; onCopy: (t: string) => void }) {
  return (
    <div style={{
      background: "var(--bg-tertiary)",
      border: "1px solid var(--border-primary)",
      borderRadius: 12,
      padding: "16px 20px",
      marginBottom: 16,
      position: "relative",
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 1,
        color: "#3182F6", marginBottom: 10,
      }}>{label}</div>
      <button
        onClick={() => onCopy(text)}
        style={{
          position: "absolute", top: 14, right: 14,
          background: "var(--bg-card)", border: "1px solid var(--border-primary)",
          color: "var(--text-tertiary)", fontSize: 11, padding: "4px 10px",
          borderRadius: 6, cursor: "pointer", transition: "all .15s",
        }}
        onMouseEnter={(e) => {
          const t = e.currentTarget;
          t.style.borderColor = "#3182F6";
          t.style.color = "#3182F6";
        }}
        onMouseLeave={(e) => {
          const t = e.currentTarget;
          t.style.borderColor = "var(--border-primary)";
          t.style.color = "var(--text-tertiary)";
        }}
      >복사</button>
      <pre style={{
        fontFamily: "'Consolas','Courier New',monospace",
        fontSize: 12, color: "var(--text-secondary)",
        whiteSpace: "pre-wrap", lineHeight: 1.7, margin: 0,
      }}>{text}</pre>
    </div>
  );
}
