import { MIcon } from "./MIcon";

export function DeepResearchViz() {
  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      {/* 페이지 헤더 */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            딥리서치 투자 가이드
          </h1>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", marginTop: 4 }}>
            AI 딥리서치 기반 주식 투자 전략 가이드
          </p>
        </div>
        <a
          href="/deepresearch_viz.html"
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
        <p>• AI 딥리서치로 수집·정리한 <strong>주식 투자 전략 · 팩터 분석 · 시장 구조</strong> 인터랙티브 가이드</p>
        <p>• 개별 주제를 클릭해 세부 분석 자료 탐색 가능</p>
        <p>• 퀀트 전략 설계 및 알파 아이디어 발굴에 참고 자료로 활용</p>
      </div>

      {/* iframe 영역 */}
      <div style={{
        borderRadius: "var(--radius-md)", overflow: "hidden",
        border: "1px solid var(--border-primary)",
        height: "calc(86.957vh - 295px)",
        minHeight: 440,
      }}>
        <iframe
          src="/deepresearch_viz.html"
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          title="딥리서치 × 주식 투자 가이드"
        />
      </div>
    </div>
  );
}
