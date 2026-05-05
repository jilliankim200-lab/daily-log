import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    Chart: any;
  }
}

// ── Data ────────────────────────────────────────────────────────────────────
const SECTORS = ['에너지','소재','산업재','경기소비재','필수소비재','헬스케어','금융','IT','커뮤니케이션','유틸리티','부동산'];

function sensColor(v: number): string {
  if (v >= 2) return '#166534';
  if (v === 1) return '#16A34A';
  if (v === 0) return '#9CA3AF';
  if (v === -1) return '#DC2626';
  return '#991B1B';
}
function makeColors(arr: number[]): string[] { return arr.map(v => sensColor(v)); }

// ── Styles ───────────────────────────────────────────────────────────────────
const S = {
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 12,
    padding: '20px 24px',
    marginBottom: 16,
  } as React.CSSProperties,
  cardTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: '2px solid color-mix(in srgb, var(--accent-blue) 15%, transparent)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  } as React.CSSProperties,
  secNum: {
    background: 'var(--accent-blue)',
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: 20,
    letterSpacing: '0.04em',
    flexShrink: 0,
    marginTop: 4,
  } as React.CSSProperties,
  secTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
    margin: 0,
  } as React.CSSProperties,
  secSub: {
    fontSize: 13,
    color: 'var(--text-tertiary)',
    marginTop: 4,
    margin: 0,
  } as React.CSSProperties,
  takeaway: {
    background: 'color-mix(in srgb, var(--accent-blue) 8%, transparent)',
    border: '1px solid color-mix(in srgb, var(--accent-blue) 25%, transparent)',
    borderLeft: '4px solid var(--accent-blue)',
    borderRadius: '0 10px 10px 0',
    padding: '16px 20px',
    marginTop: 16,
  } as React.CSSProperties,
  takeawayLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--accent-blue)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    marginBottom: 8,
  },
  takeawayItem: {
    padding: '3px 0',
    fontSize: 13.5,
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
  } as React.CSSProperties,
  chartBox: {
    position: 'relative' as const,
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
  } as React.CSSProperties,
  scenarioBar: {
    background: 'linear-gradient(90deg, #1E3A5F, var(--accent-blue))',
    color: '#fff',
    borderRadius: 10,
    padding: '14px 20px',
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  } as React.CSSProperties,
};

// ── Sub-components ───────────────────────────────────────────────────────────
function SectionHeader({ num, total, title, sub }: { num: string; total: string; title: string; sub: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
      <span style={S.secNum}>{num} / {total}</span>
      <div>
        <h2 style={S.secTitle}>{title}</h2>
        <p style={S.secSub}>{sub}</p>
      </div>
    </div>
  );
}

function CardTitle({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div style={S.cardTitle}>
      <span style={{
        width: 28, height: 28, background: 'color-mix(in srgb, var(--accent-blue) 12%, transparent)',
        borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
      }}>{icon}</span>
      {children}
    </div>
  );
}

function Takeaway({ label, items }: { label: string; items: string[] }) {
  return (
    <div style={S.takeaway}>
      <div style={S.takeawayLabel}>🔑 {label}</div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((item, i) => (
          <li key={i} style={S.takeawayItem}>
            <span style={{ color: 'var(--accent-blue)', fontSize: 10, marginTop: 4, flexShrink: 0 }}>▶</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MatrixCell({ cls, text }: { cls: 'pp' | 'p' | 'n0' | 'm' | 'mm'; text: string }) {
  const styles: Record<string, React.CSSProperties> = {
    pp: { background: 'rgba(34,197,94,0.18)', color: 'var(--color-profit)', fontWeight: 800 },
    p:  { background: 'rgba(34,197,94,0.10)', color: 'var(--color-profit)', fontWeight: 700 },
    n0: { background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', fontWeight: 600 },
    m:  { background: 'rgba(248,113,113,0.15)', color: 'var(--color-loss)', fontWeight: 700 },
    mm: { background: 'rgba(248,113,113,0.28)', color: 'var(--color-loss)', fontWeight: 800 },
  };
  return (
    <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border-primary)', fontSize: 13.5, ...styles[cls] }}>
      {text}
    </td>
  );
}

function Tag({ type, children }: { type: 'buy' | 'sell' | 'hold'; children: React.ReactNode }) {
  const styles: Record<string, React.CSSProperties> = {
    buy:  { background: 'rgba(34,197,94,0.12)', color: 'var(--color-profit)' },
    sell: { background: 'rgba(248,113,113,0.12)', color: 'var(--color-loss)' },
    hold: { background: 'rgba(234,179,8,0.12)', color: '#ca8a04' },
  };
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 700,
      padding: '2px 8px', borderRadius: 12, margin: '2px 2px 2px 0',
      ...styles[type],
    }}>{children}</span>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export function MacroSectorViz() {
  const [chartReady, setChartReady] = useState(false);
  const chartInstances = useRef<any[]>([]);

  // Canvas refs
  const radarChartRef = useRef<HTMLCanvasElement>(null);
  const sectorScoreChartRef = useRef<HTMLCanvasElement>(null);
  const rateUpChartRef = useRef<HTMLCanvasElement>(null);
  const rateDownChartRef = useRef<HTMLCanvasElement>(null);
  const usdUpChartRef = useRef<HTMLCanvasElement>(null);
  const usdDownChartRef = useRef<HTMLCanvasElement>(null);
  const commUpChartRef = useRef<HTMLCanvasElement>(null);
  const commDownChartRef = useRef<HTMLCanvasElement>(null);
  const growthUpChartRef = useRef<HTMLCanvasElement>(null);
  const growthDownChartRef = useRef<HTMLCanvasElement>(null);
  const inflUpChartRef = useRef<HTMLCanvasElement>(null);
  const pricingPowerChartRef = useRef<HTMLCanvasElement>(null);
  const cycleChartRef = useRef<HTMLCanvasElement>(null);
  const steepChartRef = useRef<HTMLCanvasElement>(null);
  const flatChartRef = useRef<HTMLCanvasElement>(null);
  const geoRiskChartRef = useRef<HTMLCanvasElement>(null);
  const geoStableChartRef = useRef<HTMLCanvasElement>(null);
  const currentMacroChartRef = useRef<HTMLCanvasElement>(null);
  const allocationChartRef = useRef<HTMLCanvasElement>(null);

  // Load Chart.js dynamically
  useEffect(() => {
    if (window.Chart) {
      setChartReady(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js';
    script.async = true;
    script.onload = () => setChartReady(true);
    document.head.appendChild(script);
  }, []);

  // Initialize all charts
  useEffect(() => {
    if (!chartReady || !window.Chart) return;

    const Chart = window.Chart;
    const instances: any[] = [];

    const DEFAULTS = {
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: any) => {
              const v = ctx.raw;
              const map: Record<string, string> = { '2': '매우 유리(++)', '1': '유리(+)', '0': '중립(0)', '-1': '불리(-)', '-2': '매우 불리(--)' };
              return ` ${map[String(v)] || v}`;
            }
          }
        }
      },
      scales: {
        x: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 12 } } },
        y: {
          min: -2.5, max: 2.5,
          ticks: {
            font: { size: 11 },
            callback: (v: number) => ({ 2: '++', 1: '+', 0: '0', '-1': '-', '-2': '--' }[v as 2|1|0|-1|-2] ?? '')
          },
          grid: { color: '#E2E8F0' }
        }
      }
    };

    function barChart(ref: React.RefObject<HTMLCanvasElement | null>, data: number[], label: string) {
      if (!ref.current) return;
      const c = new Chart(ref.current, {
        type: 'bar',
        data: {
          labels: SECTORS,
          datasets: [{ label, data, backgroundColor: makeColors(data), borderRadius: 6, borderSkipped: false }]
        },
        options: {
          ...DEFAULTS,
          responsive: true,
          maintainAspectRatio: false,
          plugins: { ...DEFAULTS.plugins, title: { display: false } }
        }
      });
      instances.push(c);
    }

    // ── 금리 ──
    barChart(rateUpChartRef,   [1, 0, -2, -2, -1, 0, 2, -2, -1, -2, -2], '금리 상승');
    barChart(rateDownChartRef, [-1, 1, 1, 2, 1, 0, -2, 2, 1, 2, 2],       '금리 하락');

    // ── 달러 ──
    barChart(usdUpChartRef,   [-1, -2, -1, 0, 1, 1, 0, -1, 0, 0, 0], '달러 강세');
    barChart(usdDownChartRef, [1, 2, 1, 0, -1, -1, 0, 1, 0, 0, 0],   '달러 약세');

    // ── 원자재 ──
    barChart(commUpChartRef,   [2, 2, -1, -1, -1, 0, 0, -1, 0, -1, 0], '원자재 상승');
    barChart(commDownChartRef, [-2, -2, 1, 1, 1, 0, 0, 1, 0, 1, 0],    '원자재 하락');

    // ── 경기 확장/수축 ──
    barChart(growthUpChartRef,   [1, 1, 2, 2, 0, 0, 1, 1, 1, -1, 1], '경기 확장');
    barChart(growthDownChartRef, [-1, -1, -2, -2, 1, 1, -1, -1, -1, 1, -1], '경기 수축');

    // ── 인플레이션 ──
    barChart(inflUpChartRef, [2, 1, 0, -1, 1, 0, 1, -1, -1, -1, 1], '고인플레이션');

    // ── 수익률곡선 ──
    barChart(steepChartRef, [0, 1, 1, 1, 0, 0, 2, -1, 0, -1, 0], '스티프닝');
    barChart(flatChartRef,  [0, -1, -1, -1, 1, 1, -2, 1, 0, 1, 0], '플래트닝/역전');

    // ── 지정학 ──
    barChart(geoRiskChartRef,   [2, 1, -1, -2, 1, 1, -2, -1, -1, 1, -1], '지정학 리스크 상승');
    barChart(geoStableChartRef, [-1, -1, 1, 2, -1, -1, 2, 1, 1, -1, 1],  '지정학 안정화');

    // ── 가격 전가력 ──
    if (pricingPowerChartRef.current) {
      const pricingData = [2, 1, 0, -1, 2, 1, 1, -1, 0, 0, -1];
      instances.push(new Chart(pricingPowerChartRef.current, {
        type: 'bar',
        data: {
          labels: SECTORS,
          datasets: [{
            label: '가격 전가력 점수',
            data: pricingData,
            backgroundColor: makeColors(pricingData),
            borderRadius: 6,
            borderSkipped: false
          }]
        },
        options: { ...DEFAULTS, responsive: true, maintainAspectRatio: false }
      }));
    }

    // ── 경기 사이클 4국면 레이더 ──
    if (cycleChartRef.current) {
      instances.push(new Chart(cycleChartRef.current, {
        type: 'radar',
        data: {
          labels: SECTORS,
          datasets: [
            { label: '경기 확장 초기', data: [1,1,2,2,0,0,1,1,1,-1,1], backgroundColor: 'rgba(37,99,235,0.15)', borderColor: '#2563EB', borderWidth: 2, pointBackgroundColor: '#2563EB' },
            { label: '경기 후기(과열)', data: [2,2,1,1,-1,0,1,0,0,-1,0], backgroundColor: 'rgba(234,88,12,0.12)', borderColor: '#EA580C', borderWidth: 2, pointBackgroundColor: '#EA580C' },
            { label: '침체/수축', data: [-1,-1,-2,-2,1,1,-1,-1,-1,1,-1], backgroundColor: 'rgba(220,38,38,0.12)', borderColor: '#DC2626', borderWidth: 2, pointBackgroundColor: '#DC2626' },
            { label: '회복 초기', data: [0,0,1,1,1,0,0,1,1,1,1], backgroundColor: 'rgba(22,163,74,0.12)', borderColor: '#16A34A', borderWidth: 2, pointBackgroundColor: '#16A34A' }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { font: { size: 12 }, padding: 16 } } },
          scales: { r: { min: -2.5, max: 2.5, ticks: { font: { size: 10 }, stepSize: 1, callback: (v: number) => ({ 2:'++',1:'+',0:'0','-1':'-','-2':'--' }[v as 2|1|0|-1|-2] ?? '') }, grid: { color: '#E2E8F0' }, pointLabels: { font: { size: 11 } } } }
        }
      }));
    }

    // ── 섹터별 종합 매크로 내성 점수 ──
    if (sectorScoreChartRef.current) {
      const raw = [
        [1,-1,2,1,2,0,2],    // 에너지
        [0,-2,2,1,1,1,1],    // 소재
        [-1,-1,-1,2,0,1,-1], // 산업재
        [-2,0,-1,2,-1,1,-2], // 경기소비재
        [-1,1,-1,0,1,0,1],   // 필수소비재
        [0,1,0,0,0,0,1],     // 헬스케어
        [2,0,0,1,1,2,-2],    // 금융
        [-2,-1,-1,1,-1,-1,-1],// IT
        [-1,0,0,1,-1,0,-1],  // 커뮤니케이션
        [-2,0,-1,-1,-1,-1,1], // 유틸리티
        [-2,0,0,1,1,0,-1],   // 부동산
      ];
      const scores = raw.map(r => r.reduce((a, b) => a + b, 0));
      instances.push(new Chart(sectorScoreChartRef.current, {
        type: 'bar',
        data: {
          labels: SECTORS,
          datasets: [{
            label: '매크로 종합 점수 (7개 변수 합산)',
            data: scores,
            backgroundColor: scores.map(v => v > 0 ? '#16A34A' : v === 0 ? '#9CA3AF' : '#DC2626'),
            borderRadius: 6,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx: any) => ` 합산 점수: ${ctx.raw}점 (범위 -14 ~ +14)` } }
          },
          scales: {
            x: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 12 } } },
            y: { ticks: { font: { size: 11 } }, grid: { color: '#E2E8F0' } }
          }
        }
      }));
    }

    // ── 레이더 차트 (매크로 변수별 섹터 점수) ──
    if (radarChartRef.current) {
      instances.push(new Chart(radarChartRef.current, {
        type: 'radar',
        data: {
          labels: ['금리 상승','달러 강세','원자재 상승','경기 확장','인플레이션','곡선 스티프닝','지정학 리스크'],
          datasets: [
            { label: '에너지', data: [1,-1,2,1,2,0,2], backgroundColor: 'rgba(234,88,12,0.15)', borderColor: '#EA580C', borderWidth: 2, pointBackgroundColor: '#EA580C' },
            { label: '금융',   data: [2,0,0,1,1,2,-2], backgroundColor: 'rgba(37,99,235,0.15)', borderColor: '#2563EB', borderWidth: 2, pointBackgroundColor: '#2563EB' },
            { label: 'IT',    data: [-2,-1,-1,1,-1,-1,-1], backgroundColor: 'rgba(220,38,38,0.12)', borderColor: '#DC2626', borderWidth: 2, pointBackgroundColor: '#DC2626' },
            { label: '필수소비재', data: [-1,1,-1,0,1,0,1], backgroundColor: 'rgba(22,163,74,0.12)', borderColor: '#16A34A', borderWidth: 2, pointBackgroundColor: '#16A34A' }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { font: { size: 12 }, padding: 14 } } },
          scales: { r: { min: -2.5, max: 2.5, ticks: { font: { size: 10 }, stepSize: 1, callback: (v: number) => ({ 2:'++',1:'+',0:'0','-1':'-','-2':'--' }[v as 2|1|0|-1|-2] ?? '') }, grid: { color: '#E2E8F0' }, pointLabels: { font: { size: 12 } } } }
        }
      }));
    }

    // ── 2026 현재 매크로 환경 ──
    if (currentMacroChartRef.current) {
      instances.push(new Chart(currentMacroChartRef.current, {
        type: 'bar',
        data: {
          labels: ['금리','달러','원자재','경기','인플레이션','수익률곡선','지정학리스크'],
          datasets: [{
            label: '현재 매크로 강도 (2026.05 기준)',
            data: [3, 2, 1, 0, 2, 1, 2],
            backgroundColor: ['#DC2626','#EA580C','#F59E0B','#9CA3AF','#EA580C','#F59E0B','#EA580C'],
            borderRadius: 8,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx: any) => {
                  const labels = ['금리 고원 유지(3.5~4.5%)','달러 강세 지속(DXY 100+)','원자재 중립','경기 성장 둔화 우려','인플레 여전히 목표 상회','곡선 정상화 진행중','중동+우크라 지정학 고조'];
                  return ` ${labels[ctx.dataIndex]}`;
                }
              }
            }
          },
          scales: {
            x: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 12 } } },
            y: {
              min: 0, max: 4,
              ticks: { callback: (v: number) => (['','낮음','중립','주의','높음'])[v] || '' },
              grid: { color: '#E2E8F0' }
            }
          }
        }
      }));
    }

    // ── 2026 권장 배분 도넛 ──
    if (allocationChartRef.current) {
      instances.push(new Chart(allocationChartRef.current, {
        type: 'doughnut',
        data: {
          labels: ['에너지 (지정학 헤지)','금융 (금리 고원 수혜)','IT (AI인프라 차별화)','헬스케어 (방어)','필수소비재 (방어)','산업재 (밸류업)','기타 섹터'],
          datasets: [{
            data: [15, 18, 22, 12, 10, 11, 12],
            backgroundColor: ['#EA580C','#2563EB','#7C3AED','#16A34A','#059669','#D97706','#9CA3AF'],
            borderWidth: 2,
            borderColor: 'var(--bg-card)',
            hoverOffset: 8
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right', labels: { font: { size: 12 }, padding: 12 } },
            tooltip: { callbacks: { label: (ctx: any) => ` ${ctx.label}: ${ctx.raw}%` } }
          },
          cutout: '55%'
        }
      }));
    }

    chartInstances.current = instances;

    return () => {
      instances.forEach(c => { try { c.destroy(); } catch (_) {} });
      chartInstances.current = [];
    };
  }, [chartReady]);

  // ── Table helper styles ──────────────────────────────────────────────────
  const thStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    color: 'var(--text-secondary)',
    fontWeight: 700,
    fontSize: 12,
    padding: '10px 12px',
    textAlign: 'left' as const,
    borderBottom: '2px solid var(--border-primary)',
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap',
  };
  const thCenter: React.CSSProperties = { ...thStyle, textAlign: 'center' };
  const tdStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderBottom: '1px solid var(--border-primary)',
    verticalAlign: 'top',
    fontSize: 13,
    color: 'var(--text-secondary)',
  };
  const tdSectorName: React.CSSProperties = {
    ...tdStyle,
    textAlign: 'left',
    fontWeight: 600,
    color: 'var(--text-primary)',
    background: 'var(--bg-secondary)',
    whiteSpace: 'nowrap',
    fontSize: 13,
    borderRight: '1px solid var(--border-primary)',
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          매크로 섹터 민감도
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginTop: 4 }}>
          매크로 변수별 GICS 11 섹터 민감도 분석 — Quant Research Dashboard · 2026.05.05 기준
        </p>
        {/* Badge row */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {['GICS 11 Sectors','7 Macro Factors','15 Charts','2026.05.05 기준'].map(b => (
            <span key={b} style={{
              background: 'color-mix(in srgb, var(--accent-blue) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-blue) 25%, transparent)',
              color: 'var(--accent-blue)', fontSize: 11, fontWeight: 600,
              padding: '3px 12px', borderRadius: 20,
            }}>{b}</span>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
           SECTION 01 — 개요
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ marginBottom: 48 }} id="s01">
        <SectionHeader num="01" total="10" title="분석 개요" sub="GICS 11개 섹터와 7개 핵심 매크로 변수의 관계를 체계적으로 정리" />

        {/* GICS 11 섹터 */}
        <div style={S.card}>
          <CardTitle icon="🏭">GICS 11 섹터</CardTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 4 }}>
            {[
              { icon: '⛽', name: '에너지', eng: 'Energy' },
              { icon: '⚗️', name: '소재', eng: 'Materials' },
              { icon: '🏗️', name: '산업재', eng: 'Industrials' },
              { icon: '🛍️', name: '경기소비재', eng: 'Consumer Disc.' },
              { icon: '🛒', name: '필수소비재', eng: 'Consumer Staples' },
              { icon: '💊', name: '헬스케어', eng: 'Health Care' },
              { icon: '🏦', name: '금융', eng: 'Financials' },
              { icon: '💻', name: 'IT', eng: 'Information Tech.' },
              { icon: '📡', name: '커뮤니케이션', eng: 'Comm. Services' },
              { icon: '⚡', name: '유틸리티', eng: 'Utilities' },
              { icon: '🏢', name: '부동산', eng: 'Real Estate' },
            ].map(s => (
              <div key={s.name} style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
                borderRadius: 10, padding: '14px 12px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 26, marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{s.eng}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 7대 매크로 변수 */}
        <div style={S.card}>
          <CardTitle icon="📈">7대 매크로 변수</CardTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
            {[
              { icon: '📊', name: '금리', eng: 'Interest Rate' },
              { icon: '💵', name: '달러', eng: 'USD Strength' },
              { icon: '🛢️', name: '원자재', eng: 'Commodities' },
              { icon: '📉', name: '경기', eng: 'Growth Cycle' },
              { icon: '🔥', name: '인플레이션', eng: 'Inflation' },
              { icon: '📐', name: '수익률곡선', eng: 'Yield Curve' },
              { icon: '⚔️', name: '지정학', eng: 'Geopolitics' },
            ].map(m => (
              <div key={m.name} style={{
                background: 'color-mix(in srgb, var(--accent-blue) 6%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent-blue) 18%, transparent)',
                borderRadius: 10, padding: '14px 12px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{m.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{m.name}</div>
                <div style={{ fontSize: 11, color: 'var(--accent-blue)' }}>{m.eng}</div>
              </div>
            ))}
          </div>
        </div>

        <Takeaway label="KEY TAKEAWAY — 01 개요" items={[
          '7개 매크로 변수 각각의 방향성 변화가 GICS 11섹터에 미치는 수익률 영향을 ++ / + / 0 / - / -- 5단계로 정량화',
          '단순 방향 예측이 아닌, 어떤 섹터를 Over/Underweight할지 결정하는 로테이션 전략의 기초 자료로 활용',
          '매크로 복합 시나리오(예: 금리 상승 + 달러 강세)는 개별 민감도를 합산하여 추정 — 상관관계 주의',
        ]} />
      </section>

      <hr style={{ border: 'none', borderTop: '2px dashed var(--border-primary)', margin: '0 0 48px' }} />

      {/* ══════════════════════════════════════════════════════════════════
           SECTION 02 — 민감도 매트릭스
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ marginBottom: 48 }} id="s02">
        <SectionHeader num="02" total="10" title="민감도 매트릭스 (Heat Map)" sub="매크로 변수 상승 시나리오 기준 — 각 섹터의 수익률 방향 영향" />

        {/* Matrix table */}
        <div style={S.card}>
          <CardTitle icon="🗺️">GICS 11 × 매크로 7 — 종합 민감도 테이블</CardTitle>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16, fontSize: 13, alignItems: 'center' }}>
            <strong style={{ color: 'var(--text-primary)', fontSize: 13 }}>범례:</strong>
            {[
              { label: '매우 유리', style: { background: 'rgba(34,197,94,0.18)', color: 'var(--color-profit)', fontWeight: 800 }, text: '++' },
              { label: '유리', style: { background: 'rgba(34,197,94,0.10)', color: 'var(--color-profit)', fontWeight: 700 }, text: '+' },
              { label: '중립', style: { background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }, text: '0' },
              { label: '불리', style: { background: 'rgba(248,113,113,0.15)', color: 'var(--color-loss)', fontWeight: 700 }, text: '-' },
              { label: '매우 불리', style: { background: 'rgba(248,113,113,0.28)', color: 'var(--color-loss)', fontWeight: 800 }, text: '--' },
            ].map(leg => (
              <span key={leg.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--text-secondary)' }}>
                <span style={{ width: 32, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, ...leg.style }}>{leg.text}</span>
                {leg.label}
              </span>
            ))}
            <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>(상승 시나리오 기준)</span>
          </div>

          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13, minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left', minWidth: 140 }}>섹터</th>
                  <th style={thCenter}>금리 상승</th>
                  <th style={thCenter}>달러 강세</th>
                  <th style={thCenter}>원자재 상승</th>
                  <th style={thCenter}>경기 확장</th>
                  <th style={thCenter}>인플레이션</th>
                  <th style={thCenter}>곡선 스티프닝</th>
                  <th style={thCenter}>지정학 리스크</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: '⛽ 에너지',     cells: ['p','m','pp','p','pp','n0','pp'] },
                  { name: '⚗️ 소재',       cells: ['n0','mm','pp','p','p','p','p'] },
                  { name: '🏗️ 산업재',     cells: ['m','m','m','pp','n0','p','m'] },
                  { name: '🛍️ 경기소비재', cells: ['mm','n0','m','pp','m','p','mm'] },
                  { name: '🛒 필수소비재', cells: ['m','p','m','n0','p','n0','p'] },
                  { name: '💊 헬스케어',   cells: ['n0','p','n0','n0','n0','n0','p'] },
                  { name: '🏦 금융',       cells: ['pp','n0','n0','p','p','pp','mm'] },
                  { name: '💻 IT',         cells: ['mm','m','m','p','m','m','m'] },
                  { name: '📡 커뮤니케이션', cells: ['m','n0','n0','p','m','n0','m'] },
                  { name: '⚡ 유틸리티',   cells: ['mm','n0','m','m','m','m','p'] },
                  { name: '🏢 부동산',     cells: ['mm','n0','n0','p','p','n0','m'] },
                ].map(row => {
                  const textMap: Record<string, string> = { pp: '++', p: '+', n0: '0', m: '-', mm: '--' };
                  return (
                    <tr key={row.name}>
                      <td style={tdSectorName}>{row.name}</td>
                      {row.cells.map((cls, i) => (
                        <MatrixCell key={i} cls={cls as 'pp'|'p'|'n0'|'m'|'mm'} text={textMap[cls]} />
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Radar chart */}
        <div style={S.card}>
          <CardTitle icon="📊">매크로 변수별 섹터 종합 점수 (레이더 차트)</CardTitle>
          <div style={{ ...S.chartBox, height: 360 }}>
            <canvas ref={radarChartRef} />
          </div>
        </div>

        {/* Bar chart */}
        <div style={S.card}>
          <CardTitle icon="📊">섹터별 매크로 종합 내성 점수 (막대)</CardTitle>
          <div style={{ ...S.chartBox, height: 340 }}>
            <canvas ref={sectorScoreChartRef} />
          </div>
        </div>

        <Takeaway label="KEY TAKEAWAY — 02 민감도 매트릭스" items={[
          '금융(++/++)은 금리 상승 + 곡선 스티프닝 환경에서 가장 강한 수혜 — 긴축 사이클 초기 핵심 Long',
          'IT·부동산·유틸리티는 금리 상승 시 공통적으로 --로 매크로 역풍 집중 — 금리 인하 기대 전까지 Underweight',
          '에너지는 원자재·인플레·지정학 3중 수혜 — 스태그플레이션 헤지 수단',
          '경기소비재는 경기 확장(++) 외 모든 변수에서 취약 — 경기 모멘텀 확인 전 신중',
        ]} />
      </section>

      <hr style={{ border: 'none', borderTop: '2px dashed var(--border-primary)', margin: '0 0 48px' }} />

      {/* ══════════════════════════════════════════════════════════════════
           SECTION 03 — 금리 민감도
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ marginBottom: 48 }} id="s03">
        <SectionHeader num="03" total="10" title="금리 민감도 분석" sub="Interest Rate Sensitivity — 기준금리 상승 / 하락 시나리오별 섹터 영향" />

        <div style={S.scenarioBar}>
          <span style={{ fontSize: 26, flexShrink: 0 }}>📊</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>금리 상승(긴축) 시나리오</div>
            <div style={{ fontSize: 12.5, color: '#BFDBFE', marginTop: 2 }}>Fed/한은 기준금리 인상 사이클 — 시중금리 전반 상승, 할인율 확대, 신용 비용 증가</div>
          </div>
          <span style={{ fontSize: 20, color: '#93C5FD', flexShrink: 0 }}>▲</span>
        </div>

        <div style={S.grid2}>
          <div style={S.card}>
            <CardTitle icon="📊">금리 상승 시 섹터 수익률 영향</CardTitle>
            <div style={{ ...S.chartBox, height: 340 }}>
              <canvas ref={rateUpChartRef} />
            </div>
          </div>
          <div style={S.card}>
            <CardTitle icon="📊">금리 하락 시 섹터 수익률 영향</CardTitle>
            <div style={{ ...S.chartBox, height: 340 }}>
              <canvas ref={rateDownChartRef} />
            </div>
          </div>
        </div>

        {/* Mechanism table */}
        <div style={S.card}>
          <CardTitle icon="💡">금리 변화 메커니즘 — 섹터별 전달 경로</CardTitle>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr>
                  <th style={thStyle}>섹터</th>
                  <th style={thStyle}>금리 상승 영향 메커니즘</th>
                  <th style={thStyle}>주요 리스크/기회</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['🏦 금융 (++)', 'NIM(순이자마진) 확대, 대출-예금 스프레드 개선', '부실채권 증가 리스크 상쇄 필요'],
                  ['⛽ 에너지 (+)', '인플레 연동 자산 — 금리 상승 시 실물 에너지 수요 유지', '달러 강세 동반 시 상쇄 가능'],
                  ['💻 IT (--)', '성장주 DCF 할인율 상승 → 미래 현금흐름 가치 급감', 'PER 멀티플 압축 — 실적 성장으로 방어 가능'],
                  ['🏢 부동산 (--)', 'Cap Rate 상승 → 부동산 가치 직접 하락, 리파이낸싱 비용 급등', 'REITs 금리 민감도 최고 수준'],
                  ['⚡ 유틸리티 (--)', '고배당 방어주 — 금리 상승 시 채권 대비 매력도 급감', '부채 비중 높아 이자 비용 직접 부담'],
                  ['🛍️ 경기소비재 (--)', '모기지·소비 신용 비용 상승 → 실소비 위축', '내구재 소비 선행 지표 악화'],
                ].map(([sector, mech, risk]) => (
                  <tr key={sector}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{sector}</td>
                    <td style={tdStyle}>{mech}</td>
                    <td style={tdStyle}>{risk}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Takeaway label="KEY TAKEAWAY — 03 금리" items={[
          '금리 상승기: 금융 OW, IT·부동산·유틸리티 UW — 가장 명확한 섹터 로테이션 신호',
          '금리 하락기: IT·부동산·유틸리티 반등 — 피벗 기대감 선반영이 핵심 (실제 인하 전 3-6개월 포지셔닝)',
          '한국 특이점: 가계부채 비율 높아 금리 민감도가 글로벌 대비 강함 — 경기소비재 더 취약',
        ]} />
      </section>

      <hr style={{ border: 'none', borderTop: '2px dashed var(--border-primary)', margin: '0 0 48px' }} />

      {/* ══════════════════════════════════════════════════════════════════
           SECTION 04 — 달러 민감도
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ marginBottom: 48 }} id="s04">
        <SectionHeader num="04" total="10" title="달러 민감도 분석" sub="USD Strength Sensitivity — 달러 강세/약세 시나리오별 섹터 영향" />

        <div style={S.grid2}>
          <div style={S.card}>
            <CardTitle icon="📊">달러 강세 시 섹터 영향</CardTitle>
            <div style={{ ...S.chartBox, height: 340 }}>
              <canvas ref={usdUpChartRef} />
            </div>
          </div>
          <div style={S.card}>
            <CardTitle icon="📊">달러 약세 시 섹터 영향</CardTitle>
            <div style={{ ...S.chartBox, height: 340 }}>
              <canvas ref={usdDownChartRef} />
            </div>
          </div>
        </div>

        <Takeaway label="KEY TAKEAWAY — 04 달러" items={[
          '달러 강세: 소재(--) 직격 — 달러 표시 원자재 가격 하락으로 이중 타격',
          '달러 강세: 해외 매출 비중 높은 미국 빅테크(IT)에 역풍 — 환산 손실',
          '달러 약세: 신흥국 자본 유입 → 한국 외국인 수급 개선, 소재·산업재 수혜',
          '필수소비재는 달러 강세 시 수입 원가 하락으로 마진 소폭 개선 (+)',
        ]} />
      </section>

      <hr style={{ border: 'none', borderTop: '2px dashed var(--border-primary)', margin: '0 0 48px' }} />

      {/* ══════════════════════════════════════════════════════════════════
           SECTION 05 — 원자재 민감도
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ marginBottom: 48 }} id="s05">
        <SectionHeader num="05" total="10" title="원자재 민감도 분석" sub="Commodities Sensitivity — 원유/금속 등 원자재 가격 상승/하락 시나리오" />

        <div style={S.grid2}>
          <div style={S.card}>
            <CardTitle icon="📊">원자재 상승 시 섹터 영향</CardTitle>
            <div style={{ ...S.chartBox, height: 340 }}>
              <canvas ref={commUpChartRef} />
            </div>
          </div>
          <div style={S.card}>
            <CardTitle icon="📊">원자재 하락 시 섹터 영향</CardTitle>
            <div style={{ ...S.chartBox, height: 340 }}>
              <canvas ref={commDownChartRef} />
            </div>
          </div>
        </div>

        <Takeaway label="KEY TAKEAWAY — 05 원자재" items={[
          '원자재 상승: 에너지(++) + 소재(++) 동반 수혜 — 원자재 슈퍼사이클 시 두 섹터 동시 OW',
          '원자재 하락: IT·필수소비재 수혜 — 원가 절감으로 마진 개선',
          '한국 특이점: 에너지·원자재 수입 의존도 높아 원자재 상승 시 무역수지 악화 → 원화 약세 연쇄 효과',
          'POSCO홀딩스·고려아연 등 소재주는 원자재 가격 직결 — 글로벌 사이클 모니터링 필수',
        ]} />
      </section>

      <hr style={{ border: 'none', borderTop: '2px dashed var(--border-primary)', margin: '0 0 48px' }} />

      {/* ══════════════════════════════════════════════════════════════════
           SECTION 06 — 경기 민감도
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ marginBottom: 48 }} id="s06">
        <SectionHeader num="06" total="10" title="경기 사이클 민감도 분석" sub="Economic Growth Sensitivity — 경기 확장/수축 국면별 섹터 로테이션" />

        <div style={S.card}>
          <CardTitle icon="📊">경기 사이클 4국면별 섹터 선호도</CardTitle>
          <div style={{ ...S.chartBox, height: 360 }}>
            <canvas ref={cycleChartRef} />
          </div>
        </div>

        <div style={S.grid2}>
          <div style={S.card}>
            <CardTitle icon="📊">경기 확장 시 섹터 영향</CardTitle>
            <div style={{ ...S.chartBox, height: 340 }}>
              <canvas ref={growthUpChartRef} />
            </div>
          </div>
          <div style={S.card}>
            <CardTitle icon="📊">경기 수축/침체 시 섹터 영향</CardTitle>
            <div style={{ ...S.chartBox, height: 340 }}>
              <canvas ref={growthDownChartRef} />
            </div>
          </div>
        </div>

        <Takeaway label="KEY TAKEAWAY — 06 경기" items={[
          '경기 확장 초기: 경기소비재(++) + 산업재(++) — 가장 강한 경기 베타 보유',
          '경기 수축기: 필수소비재·헬스케어·유틸리티로 방어 — 저베타 섹터 피난처',
          '경기 후기(과열): 에너지·소재 고점 수혜 이후 조정 대비 필요',
          '한국 수출 사이클: ISM제조업지수·중국 PMI가 한국 산업재·IT 선행 지표로 중요',
        ]} />
      </section>

      <hr style={{ border: 'none', borderTop: '2px dashed var(--border-primary)', margin: '0 0 48px' }} />

      {/* ══════════════════════════════════════════════════════════════════
           SECTION 07 — 인플레이션 민감도
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ marginBottom: 48 }} id="s07">
        <SectionHeader num="07" total="10" title="인플레이션 민감도 분석" sub="Inflation Sensitivity — CPI/PPI 상승 환경에서의 섹터별 가격 전가력" />

        <div style={S.grid2}>
          <div style={S.card}>
            <CardTitle icon="📊">고인플레이션 시 섹터 영향</CardTitle>
            <div style={{ ...S.chartBox, height: 340 }}>
              <canvas ref={inflUpChartRef} />
            </div>
          </div>
          <div style={S.card}>
            <CardTitle icon="💡">가격 전가력 (Pricing Power) 랭킹</CardTitle>
            <div style={{ ...S.chartBox, height: 340 }}>
              <canvas ref={pricingPowerChartRef} />
            </div>
          </div>
        </div>

        <Takeaway label="KEY TAKEAWAY — 07 인플레이션" items={[
          '인플레 수혜: 에너지(++) — 원자재 자체가 인플레 구성 요소, 필수소비재(+) — 브랜드 가격 전가력',
          '인플레 피해: IT(--) — 실질 성장률 할인 + 원가 상승 이중 타격',
          '스태그플레이션(저성장+고인플레): 에너지 + 필수소비재 조합 — 역사적으로 가장 안전',
          '가격 전가력 없는 섹터(IT, 커뮤니케이션)는 인플레기 마진 압박 심화',
        ]} />
      </section>

      <hr style={{ border: 'none', borderTop: '2px dashed var(--border-primary)', margin: '0 0 48px' }} />

      {/* ══════════════════════════════════════════════════════════════════
           SECTION 08 — 수익률곡선 민감도
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ marginBottom: 48 }} id="s08">
        <SectionHeader num="08" total="10" title="수익률곡선 민감도 분석" sub="Yield Curve Sensitivity — 스티프닝(경사 급등) vs 플래트닝(역전) 시나리오" />

        <div style={S.grid2}>
          <div style={S.card}>
            <CardTitle icon="📊">곡선 스티프닝 시 섹터 영향</CardTitle>
            <div style={{ ...S.chartBox, height: 340 }}>
              <canvas ref={steepChartRef} />
            </div>
          </div>
          <div style={S.card}>
            <CardTitle icon="📊">곡선 플래트닝/역전 시 섹터 영향</CardTitle>
            <div style={{ ...S.chartBox, height: 340 }}>
              <canvas ref={flatChartRef} />
            </div>
          </div>
        </div>

        <Takeaway label="KEY TAKEAWAY — 08 수익률곡선" items={[
          '스티프닝: 금융(++) 최대 수혜 — 단기 조달·장기 대출 스프레드(NIM) 극대화',
          '역전(플래트닝): 경기침체 선행 신호 — 방어 섹터(필수소비재·헬스케어·유틸리티) 선제 이동',
          '2023-2024년 역전곡선 해소 → 금융 섹터 NIM 회복 국면 진입 확인',
          '곡선 역전 깊이(10Y-2Y 스프레드) -100bp 이하 구간은 역사적 경기침체 선행 12-18개월',
        ]} />
      </section>

      <hr style={{ border: 'none', borderTop: '2px dashed var(--border-primary)', margin: '0 0 48px' }} />

      {/* ══════════════════════════════════════════════════════════════════
           SECTION 09 — 지정학 민감도
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ marginBottom: 48 }} id="s09">
        <SectionHeader num="09" total="10" title="지정학 리스크 민감도 분석" sub="Geopolitical Risk Sensitivity — 분쟁·제재·공급망 충격 시나리오" />

        <div style={S.grid2}>
          <div style={S.card}>
            <CardTitle icon="📊">지정학 리스크 상승 시 섹터 영향</CardTitle>
            <div style={{ ...S.chartBox, height: 340 }}>
              <canvas ref={geoRiskChartRef} />
            </div>
          </div>
          <div style={S.card}>
            <CardTitle icon="📊">지정학 안정화 시 섹터 영향</CardTitle>
            <div style={{ ...S.chartBox, height: 340 }}>
              <canvas ref={geoStableChartRef} />
            </div>
          </div>
        </div>

        <Takeaway label="KEY TAKEAWAY — 09 지정학" items={[
          '지정학 쇼크: 에너지(++) 최대 수혜 — 공급 차질로 유가 급등. 방산·에너지 복합주 관심',
          '금융(--): 신용 경색·자본 이탈 우려. 경기소비재(--): 소비 심리 위축',
          '한국 특이점: 북한 리스크는 구조적 상수 — 이벤트 시 코리아 디스카운트 일시 확대 → 역발상 매수 기회',
          '지정학 안정화: 글로벌 공급망 정상화 → 산업재·경기소비재 반등, 에너지 차익 실현',
        ]} />
      </section>

      <hr style={{ border: 'none', borderTop: '2px dashed var(--border-primary)', margin: '0 0 48px' }} />

      {/* ══════════════════════════════════════════════════════════════════
           SECTION 10 — 전략 시사점
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ marginBottom: 48 }} id="s10">
        <SectionHeader num="10" total="10" title="전략적 시사점 및 로테이션 가이드" sub="Strategic Implications — 매크로 복합 시나리오별 최적 섹터 배분" />

        {/* Strategy matrix table */}
        <div style={S.card}>
          <CardTitle icon="🗺️">매크로 복합 시나리오 × 섹터 전략 매트릭스</CardTitle>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr>
                  <th style={thStyle}>시나리오</th>
                  <th style={thStyle}>매크로 환경</th>
                  <th style={thStyle}>OW (Overweight)</th>
                  <th style={thStyle}>UW (Underweight)</th>
                  <th style={thStyle}>비고</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    scenario: '골디락스', sub: '저금리+경기확장',
                    env: '금리 하락, 성장 확대, 인플레 안정',
                    ow: [['buy','경기소비재'],['buy','IT'],['buy','산업재']] as ['buy'|'sell'|'hold', string][],
                    uw: [['sell','에너지'],['sell','유틸리티']] as ['buy'|'sell'|'hold', string][],
                    note: '성장주 멀티플 확장 극대화',
                  },
                  {
                    scenario: '리플레이션', sub: '경기회복+인플레 상승',
                    env: '금리 상승, 성장 확대, 원자재 상승',
                    ow: [['buy','에너지'],['buy','소재'],['buy','금융']] as ['buy'|'sell'|'hold', string][],
                    uw: [['sell','IT'],['sell','부동산']] as ['buy'|'sell'|'hold', string][],
                    note: '가치주·원자재 슈퍼사이클',
                  },
                  {
                    scenario: '스태그플레이션', sub: '저성장+고인플레',
                    env: '금리 상승, 성장 둔화, 인플레이션 급등',
                    ow: [['buy','에너지'],['buy','필수소비재']] as ['buy'|'sell'|'hold', string][],
                    uw: [['sell','IT'],['sell','경기소비재'],['sell','부동산']] as ['buy'|'sell'|'hold', string][],
                    note: '최악의 환경 — 방어 최소화',
                  },
                  {
                    scenario: '디플레이션/침체', sub: '저성장+저인플레',
                    env: '금리 하락, 성장 둔화, 원자재 하락',
                    ow: [['buy','헬스케어'],['buy','필수소비재'],['buy','유틸리티']] as ['buy'|'sell'|'hold', string][],
                    uw: [['sell','에너지'],['sell','소재'],['sell','금융']] as ['buy'|'sell'|'hold', string][],
                    note: '방어주 + 장기채 혼합',
                  },
                  {
                    scenario: '지정학 쇼크', sub: '공급 차질+불확실성',
                    env: '유가 급등, 성장 불확실, 달러 강세',
                    ow: [['buy','에너지'],['buy','방산'],['buy','헬스케어']] as ['buy'|'sell'|'hold', string][],
                    uw: [['sell','금융'],['sell','경기소비재']] as ['buy'|'sell'|'hold', string][],
                    note: '단기 이벤트 — 역발상 준비',
                  },
                  {
                    scenario: '금리 피벗 기대', sub: '금리 인하 선반영',
                    env: '금리 인하 기대, 성장 회복',
                    ow: [['buy','IT'],['buy','부동산'],['buy','유틸리티']] as ['buy'|'sell'|'hold', string][],
                    uw: [['sell','에너지'],['sell','금융']] as ['buy'|'sell'|'hold', string][],
                    note: '실제 인하 3-6개월 전 선진입',
                  },
                ].map(row => (
                  <tr key={row.scenario}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      <strong>{row.scenario}</strong><br />
                      <small style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>{row.sub}</small>
                    </td>
                    <td style={tdStyle}>{row.env}</td>
                    <td style={tdStyle}>{row.ow.map(([t, label]) => <Tag key={label} type={t}>{label}</Tag>)}</td>
                    <td style={tdStyle}>{row.uw.map(([t, label]) => <Tag key={label} type={t}>{label}</Tag>)}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-tertiary)', fontSize: 12 }}>{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Current macro chart */}
        <div style={S.card}>
          <CardTitle icon="📊">2026 현재 매크로 환경 — 시나리오 위치</CardTitle>
          <div style={{ ...S.chartBox, height: 360 }}>
            <canvas ref={currentMacroChartRef} />
          </div>
        </div>

        {/* Allocation chart */}
        <div style={S.card}>
          <CardTitle icon="📊">2026년 기준 권장 섹터 배분 (예시)</CardTitle>
          <div style={{ ...S.chartBox, height: 350 }}>
            <canvas ref={allocationChartRef} />
          </div>
        </div>

        <Takeaway label="KEY TAKEAWAY — 10 전략 시사점" items={[
          '2026년 현재(2026.05): 금리 고원 + 경기 둔화 우려 + AI 인프라 투자 지속 — 복합 국면',
          '금리 인하 피벗 기대 시 IT·부동산 선행 매수 / 에너지는 지정학 프리미엄 유지 OW',
          '한국 밸류업 프로그램 수혜: 저PBR 금융·산업재 섹터의 구조적 리레이팅 가능성 주목',
          'HBM·AI 반도체 사이클: 삼성전자·SK하이닉스 등 IT 섹터 내 차별화 필수 — 섹터 전체 매수 지양',
          '포트폴리오 다각화: 단일 매크로 베팅보다 시나리오별 헤지 구조(에너지 ↔ IT 역상관) 활용',
        ]} />
      </section>

    </div>
  );
}
