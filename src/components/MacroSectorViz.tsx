import { MIcon } from "./MIcon";

export function MacroSectorViz() {
  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      {/* 페이지 헤더 */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            매크로 섹터 민감도
          </h1>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", marginTop: 4 }}>
            거시경제 변수 변화에 따른 섹터별 민감도 분석
          </p>
        </div>
        <a
          href="/macro_sector_viz.html"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 20, flexShrink: 0,
            background: "var(--bg-secondary)", border: "1px solid var(--border-primary)",
            color: "var(--text-secondary)", fontSize: "var(--text-sm)", textDecoration: "none",
          }}
        >
          <MIcon name="open_in_new" size={15} />
          새 탭으로 열기
        </a>
      </div>

      {/* 설명 카드 */}
      <div style={{
        background: "var(--bg-secondary)", borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-primary)", padding: "16px 20px",
        marginBottom: 20, lineHeight: 1.9,
        fontSize: "var(--text-sm)", color: "var(--text-secondary)",
      }}>
        <p style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, fontSize: "var(--text-base)" }}>도구 안내</p>
        <p>• <strong>금리 · 달러 · 유가 · 원자재</strong> 등 거시경제 변수별 섹터 민감도를 인터랙티브하게 탐색</p>
        <p>• 반도체 · 자동차 · 금융 · 에너지 · 소비재 등 주요 섹터의 매크로 노출도를 한눈에 파악</p>
        <p>• 매크로 국면 전환 시 섹터 로테이션 전략 수립에 활용</p>
      </div>

      {/* iframe 영역 */}
      <div style={{
        borderRadius: "var(--radius-md)", overflow: "hidden",
        border: "1px solid var(--border-primary)",
        height: "calc(86.957vh - 295px)",
        minHeight: 440,
      }}>
        <iframe
          src="/macro_sector_viz.html"
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          title="매크로 섹터 민감도 분석"
        />
      </div>
    </div>
  );
}
