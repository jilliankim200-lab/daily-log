import { MIcon } from "./MIcon";

export function QuantDashboard() {
  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      {/* 페이지 헤더 */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            퀀트 분석 대시보드
          </h1>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", marginTop: 4 }}>
            듀얼 모멘텀 전략 백테스트 · ETF 모멘텀 · 리스크/리턴 분석
          </p>
        </div>
        <a
          href="/quant_dashboard.html"
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
        <p>• <strong>Gary Antonacci 듀얼 모멘텀</strong> — 절대 + 상대 모멘텀 결합, 6개월 룩백, 월간 리밸런싱</p>
        <p>• 나스닥100·S&P500·코스피200·코스닥150·반도체 대상 <strong>상대 모멘텀</strong>으로 Top-1 선택</p>
        <p>• 선택 자산 6M 수익률 &lt; 0 시 <strong>단기채권(안전자산)</strong>으로 자동 전환</p>
        <p>• <strong>43개 보유 ETF</strong> 모멘텀 순위 · 리스크/리턴 산포도 · 연도별 수익률 포함</p>
      </div>

      {/* iframe 영역 */}
      <div style={{
        borderRadius: "var(--radius-md)", overflow: "hidden",
        border: "1px solid var(--border-primary)",
        height: "calc(86.957vh - 295px)",
        minHeight: 520,
      }}>
        <iframe
          src="/quant_dashboard.html"
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          title="퀀트 분석 대시보드"
        />
      </div>
    </div>
  );
}
