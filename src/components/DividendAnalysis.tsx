import React, { useState, useEffect, useMemo } from 'react';
import { kvGet } from '../api';
import { useAppContext } from '../App';
import { MIcon } from './MIcon';

interface HoldingAnalysis {
  ticker: string;
  name: string;
  totalQty: number;
  riskLevel: 'high' | 'medium' | 'low';
  summary: string;
  action: string;
  defenseRate?: number;
}

interface Issue {
  level: 'red' | 'yellow' | 'green';
  title: string;
  detail: string;
}

interface Recommendation {
  rank: number;
  ticker: string;
  name: string;
  monthlyRate: number;
  annualYield: number;
  defenseRate?: number;
  reason: string;
}

interface DividendAnalysisData {
  updatedAt: string;
  holdingsAnalysis: HoldingAnalysis[];
  issues: Issue[];
  recommendations: Recommendation[];
  improvementPlan: string;
}

const CC_KEYWORDS = ['커버드콜', '커버드 콜'];

const RISK_COLOR: Record<string, string> = {
  high: '#f07178',
  medium: '#f0a500',
  low: '#3ddc97',
};
const ISSUE_COLOR: Record<string, string> = {
  red: '#f07178',
  yellow: '#f0a500',
  green: '#3ddc97',
};

export function DividendAnalysis() {
  const { accounts, isMobile } = useAppContext();
  const [analysis, setAnalysis] = useState<DividendAnalysisData | null>(null);
  const [etfRanking, setEtfRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      kvGet<DividendAnalysisData>('dividend_analysis'),
      kvGet<{ data: any[]; updatedAt: string }>('etf_ranking'),
    ]).then(([analysisData, rankingData]) => {
      if (analysisData) setAnalysis(analysisData);
      if (rankingData?.data) setEtfRanking(rankingData.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // 보유 커버드콜 종목 수집
  const ccHoldings = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; accs: string[] }>();
    for (const acc of accounts) {
      for (const h of acc.holdings) {
        if (!CC_KEYWORDS.some(kw => (h.name || '').includes(kw))) continue;
        const key = h.ticker || h.name;
        if (!map.has(key)) map.set(key, { name: h.name, qty: 0, accs: [] });
        const entry = map.get(key)!;
        if (!h.isFund) entry.qty += h.quantity || 0;
        const label = `${acc.ownerName}·${acc.alias || acc.institution}`;
        if (!entry.accs.includes(label)) entry.accs.push(label);
      }
    }
    return Array.from(map.entries())
      .map(([ticker, v]) => ({ ticker, ...v }))
      .sort((a, b) => b.qty - a.qty);
  }, [accounts]);

  const etfByTicker = useMemo(() => {
    const m: Record<string, any> = {};
    for (const e of etfRanking) m[e.ticker] = e;
    return m;
  }, [etfRanking]);

  const totalCcQty = ccHoldings.reduce((s, h) => s + h.qty, 0);

  const col = (n: number) => isMobile ? '1fr' : `repeat(${n}, 1fr)`;

  return (
    <div style={{ padding: isMobile ? '16px' : '24px' }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>배당 분석</h1>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
            {analysis?.updatedAt
              ? `분석 기준: ${analysis.updatedAt}`
              : '매주 토요일 자동 갱신'}
            {' · '}커버드콜 종목 중심 분석
          </p>
        </div>
        <div style={{
          padding: '6px 12px', borderRadius: 8, flexShrink: 0,
          background: 'var(--bg-secondary)', fontSize: 13, color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <MIcon name="schedule" size={14} />
          매주 토요일
        </div>
      </div>

      {/* 로딩 */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 14 }}>
          분석 데이터를 불러오는 중...
        </div>
      )}

      {/* 데이터 없음 안내 */}
      {!loading && !analysis && (
        <div style={{
          padding: '32px 24px', textAlign: 'center', borderRadius: 12,
          background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
          marginBottom: 24,
        }}>
          <MIcon name="analytics" size={32} style={{ color: 'var(--text-tertiary)', display: 'block', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 14, lineHeight: 1.7 }}>
            분석 데이터가 아직 없습니다.<br />
            GitHub Actions → <strong>Update Dividend Analysis</strong> → <strong>Run workflow</strong> 를 실행하세요.
          </p>
        </div>
      )}

      {/* ── 보유 커버드콜 현황 (라이브 데이터) ── */}
      {ccHoldings.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{
            fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
            marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            보유 커버드콜 현황
            <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)' }}>
              {ccHoldings.length}종목 · 총 {totalCcQty.toLocaleString()}주
            </span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: col(2), gap: 12 }}>
            {ccHoldings.map(h => {
              const etf = etfByTicker[h.ticker];
              const ai = analysis?.holdingsAnalysis?.find(a => a.ticker === h.ticker);
              const risk = ai?.riskLevel || 'medium';
              const riskColor = RISK_COLOR[risk];
              const pct = totalCcQty > 0 ? (h.qty / totalCcQty * 100) : 0;
              return (
                <div key={h.ticker} style={{
                  padding: 16, borderRadius: 12,
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-primary)',
                }}>
                  {/* 종목명 + 수량 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ flex: 1, paddingRight: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>{h.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>{h.ticker}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {h.qty.toLocaleString()}주
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{pct.toFixed(1)}%</div>
                    </div>
                  </div>

                  {/* 비중 바 */}
                  <div style={{ height: 3, background: 'var(--bg-tertiary)', borderRadius: 2, marginBottom: 8 }}>
                    <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: 'var(--accent-blue)', borderRadius: 2 }} />
                  </div>

                  {/* 배당률 + 방어력 */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                    {etf?.annualYield > 0 && (
                      <span style={{ fontSize: 13, color: '#3ddc97', fontWeight: 600 }}>
                        연 {etf.annualYield.toFixed(1)}% · 월 {(etf.singleDividendRate || etf.annualYield / 12).toFixed(2)}%
                      </span>
                    )}
                    {ai?.defenseRate != null && (
                      <span style={{
                        fontSize: 13, fontWeight: 600,
                        color: ai.defenseRate >= 0 ? '#3ddc97' : ai.defenseRate >= -5 ? '#f0a500' : '#f07178',
                        padding: '1px 6px', borderRadius: 4,
                        background: 'var(--bg-primary)',
                      }}>
                        30일 {ai.defenseRate >= 0 ? '+' : ''}{ai.defenseRate.toFixed(1)}%
                      </span>
                    )}
                  </div>

                  {/* 계좌 목록 */}
                  <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: ai ? 8 : 0 }}>
                    {h.accs.join(' · ')}
                  </div>

                  {/* AI 분석 요약 */}
                  {ai && (
                    <>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.5 }}>
                        {ai.summary}
                      </div>
                      <div style={{
                        display: 'inline-block', fontSize: 13, fontWeight: 600,
                        color: riskColor, padding: '2px 8px', borderRadius: 6,
                        background: 'var(--bg-primary)',
                      }}>
                        {ai.action}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── AI 분석 결과 ── */}
      {analysis && (
        <>
          {/* 전체 문제점 */}
          {analysis.issues?.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>전체 문제점</h2>
              <div style={{
                borderRadius: 12, background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)', overflow: 'hidden',
              }}>
                {analysis.issues.map((issue, i) => (
                  <div key={i} style={{
                    padding: '12px 16px',
                    borderBottom: i < analysis.issues.length - 1 ? '1px solid var(--border-secondary)' : 'none',
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: ISSUE_COLOR[issue.level] || '#888',
                      marginTop: 5, flexShrink: 0,
                    }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
                        {issue.title}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {issue.detail}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 추천 종목 */}
          {analysis.recommendations?.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>추천 종목</h2>
              <div style={{ display: 'grid', gridTemplateColumns: col(2), gap: 12 }}>
                {analysis.recommendations.map(rec => (
                  <div key={rec.ticker} style={{
                    padding: 16, borderRadius: 12,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-primary)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: 6,
                        background: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, color: 'var(--accent-blue-fg)', flexShrink: 0,
                      }}>
                        {rec.rank}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#3ddc97' }}>
                          월 {rec.monthlyRate?.toFixed(2)}%
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                          연 {rec.annualYield?.toFixed(1)}%
                        </div>
                        {rec.defenseRate != null && (
                          <div style={{
                            fontSize: 13, fontWeight: 600, marginTop: 2,
                            color: rec.defenseRate >= 0 ? '#3ddc97' : rec.defenseRate >= -5 ? '#f0a500' : '#f07178',
                          }}>
                            방어 {rec.defenseRate >= 0 ? '+' : ''}{rec.defenseRate.toFixed(1)}%
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {rec.name}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>{rec.ticker}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{rec.reason}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 개선 시나리오 */}
          {analysis.improvementPlan && (
            <section style={{
              padding: 20, borderRadius: 12,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
            }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>
                개선 시나리오
              </h2>
              <p style={{
                fontSize: 13, color: 'var(--text-secondary)',
                lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap',
              }}>
                {analysis.improvementPlan}
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
