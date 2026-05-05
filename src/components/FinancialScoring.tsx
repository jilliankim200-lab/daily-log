import React, { useState } from "react";
import { MIcon } from "./MIcon";

export function FinancialScoring() {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      {/* 페이지 헤더 */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            재무제표 스코어링
          </h1>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", marginTop: 4 }}>
            DART OpenAPI 기반 팩터 스코어링 분석
          </p>
        </div>
        <a
          href="http://localhost:8501"
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
        <p>• <strong>5개 팩터 그룹</strong> 기반 Z-score 평가 — 수익성 · 성장성 · 재무건전성 · 현금흐름 · 주주환원</p>
        <p>• <strong>DART OpenAPI</strong> 연결재무제표 우선 수집, 없으면 별도재무제표 자동 폴백</p>
        <p>• 앱이 실행 중이 아닌 경우 터미널에서 아래 명령어를 실행하세요.</p>
        <code style={{
          display: "inline-block", marginTop: 6,
          fontSize: "var(--text-xs)", padding: "5px 10px", borderRadius: 6,
          background: "var(--bg-tertiary)", color: "var(--text-primary)",
          border: "1px solid var(--border-primary)",
        }}>
          streamlit run C:\workspace\daily-log\stock_app.py
        </code>
      </div>

      {/* iframe 영역 */}
      <div style={{
        position: "relative",
        borderRadius: "var(--radius-md)", overflow: "hidden",
        border: "1px solid var(--border-primary)",
        height: "calc(86.957vh - 310px)",
        minHeight: 440,
      }}>
        {!loaded && !error && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 12, color: "var(--text-tertiary)", background: "var(--bg-secondary)",
          }}>
            <MIcon name="hourglass_top" size={32} style={{ opacity: 0.4 }} />
            <p style={{ fontSize: "var(--text-sm)", margin: 0 }}>스코어링 앱 로딩 중...</p>
          </div>
        )}
        {error && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 14, color: "var(--text-tertiary)", background: "var(--bg-secondary)",
          }}>
            <MIcon name="wifi_off" size={36} style={{ opacity: 0.35 }} />
            <p style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text-secondary)", margin: 0 }}>앱에 연결할 수 없습니다</p>
            <p style={{ fontSize: "var(--text-sm)", margin: 0 }}>localhost:8501 에서 Streamlit 앱이 실행 중인지 확인하세요</p>
            <button
              onClick={() => { setError(false); setLoaded(false); }}
              style={{
                padding: "8px 20px", borderRadius: 20, border: "none", cursor: "pointer",
                background: "var(--accent-blue)", color: "var(--accent-blue-fg)",
                fontSize: "var(--text-sm)", fontWeight: 600,
              }}
            >
              다시 시도
            </button>
          </div>
        )}
        <iframe
          src="http://localhost:8501"
          style={{
            width: "100%", height: "100%", border: "none",
            display: loaded ? "block" : "none",
          }}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          title="재무제표 스코어링"
          allow="same-origin"
        />
      </div>
    </div>
  );
}
