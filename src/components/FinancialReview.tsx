import React, { useState } from 'react';
import { useAppContext } from '../App';

const fmt = (v: number) =>
  v < 0
    ? `-₩${Math.abs(v).toLocaleString()}`
    : `₩${v.toLocaleString()}`;

const fmtDelta = (v: number) =>
  v > 0 ? `+₩${v.toLocaleString()}` : v < 0 ? `-₩${Math.abs(v).toLocaleString()}` : `₩0`;

function deltaColor(v: number) {
  return v > 0 ? 'var(--color-profit)' : v < 0 ? 'var(--color-loss)' : 'var(--text-tertiary)';
}

// ── 2024 연금+ISA 테이블 데이터 ──────────────────────────────
const PENSION_2024 = [
  { name: '퇴직연금 IRP',    prev: 27000000, deposit: 3000000,  plan: 30000000, actual: 34735619, },
  { name: 'ISA',             prev: 0,         deposit: 18800000, plan: 18800000, actual: 18219580, },
  { name: '펀슈 (세제)',     prev: 42000000, deposit: 6000000,  plan: 48000000, actual: 53884340, },
  { name: '한투',            prev: 0,         deposit: 9000000,  plan: 9000000,  actual: 9950376,  },
  { name: 'KB퇴직연금 IRP', prev: 0,         deposit: 3000000,  plan: 3000000,  actual: 4227286,  },
  { name: '퇴직연금IRP',    prev: 12700000,  deposit: 3000000,  plan: 15700000, actual: 17545387, },
  { name: 'ISA 미래',       prev: 0,         deposit: 19000000, plan: 19000000, actual: 0,        },
  { name: '펀슈',            prev: 48200000,  deposit: 4400000,  plan: 52600000, actual: 61180917, },
  { name: '미래에셋연금',   prev: 0,         deposit: 9000000,  plan: 9000000,  actual: 33501364, },
];

// ── 섹션 헤더 ────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)',
      margin: '0 0 12px 0', paddingBottom: 8, borderBottom: '2px solid var(--accent-blue)',
      display: 'inline-block',
    }}>{children}</h3>
  );
}

// ── 요약 카드 ────────────────────────────────────────────────
function SummaryCard({
  label, value, sub, accent, profit,
}: {
  label: string; value: string; sub?: string; accent?: boolean; profit?: boolean;
}) {
  const bg = accent ? 'var(--accent-blue)' : 'var(--bg-secondary)';
  const fg = accent ? 'var(--accent-blue-fg)' : 'var(--text-primary)';
  const labelFg = accent
    ? 'color-mix(in srgb, var(--accent-blue-fg) 70%, transparent)'
    : 'var(--text-tertiary)';
  const subFg = accent
    ? 'color-mix(in srgb, var(--accent-blue-fg) 55%, transparent)'
    : 'var(--text-tertiary)';
  const valueFg = profit != null ? (profit ? 'var(--color-profit)' : 'var(--color-loss)') : fg;

  return (
    <div style={{
      background: bg, borderRadius: 'var(--radius-lg)', padding: '16px 20px',
      border: accent ? 'none' : '1px solid var(--border-primary)',
    }}>
      <p style={{ fontSize: 'var(--text-xs)', color: labelFg, fontWeight: 500, marginBottom: 6 }}>{label}</p>
      <p className="toss-number" style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: valueFg }}>{value}</p>
      {sub && <p style={{ fontSize: 'var(--text-xs)', color: subFg, marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

// ── 메모 블록 ────────────────────────────────────────────────
function MemoBlock({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

// ── 메모 카드 (배경 있는 블록) ───────────────────────────────
function MemoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '16px 20px',
      border: '1px solid var(--border-primary)',
    }}>
      <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>{title}</p>
      {children}
    </div>
  );
}

// ── 2024 페이지 ───────────────────────────────────────────────
function Review2024({ isMobile }: { isMobile: boolean }) {
  const totalPrev    = PENSION_2024.reduce((s, r) => s + r.prev, 0);
  const totalDeposit = PENSION_2024.reduce((s, r) => s + r.deposit, 0);
  const totalPlan    = PENSION_2024.reduce((s, r) => s + r.plan, 0);
  const totalActual  = PENSION_2024.reduce((s, r) => s + r.actual, 0);
  const totalDeltaPlan = totalActual - totalPlan;
  const totalDeltaPrev = totalActual - totalPrev;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* 요점 정리 */}
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-primary)', padding: '18px 22px',
        lineHeight: 1.9, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)',
      }}>
        <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, fontSize: 'var(--text-base)' }}>2024년 요점</p>
        <p>• 연금·ISA 합산 현재잔액 <strong style={{ color: 'var(--color-profit)' }}>₩233,244,869</strong> — 계획 대비 <strong style={{ color: 'var(--color-profit)' }}>+₩28,144,869</strong> 초과 달성, 연 수익률 <strong style={{ color: 'var(--color-profit)' }}>13.72%</strong></p>
        <p>• 국내외 주식·우리사주·퇴직금DC 제외 순수 자산 증가 약 <strong style={{ color: 'var(--color-profit)' }}>+₩163,944,869</strong></p>
        <p>• 대출 상환 <strong>₩49,100,000</strong> · 비상금 예적금 <strong>₩9,000,000</strong> · 노랑우산 가입 <strong>₩2,750,000</strong></p>
        <p>• 수익 요인: 금 매도 실현 / 해외지수 상승 + 배당 재투자 / 사업자 매출 ₩50,240,000 (수익 ₩6,316,000) / 부수입(앱테크·이벤트)</p>
        <p>• 미래ISA 잔액 0원 — 계획 대비 <span style={{ color: 'var(--color-loss)' }}>-₩19,000,000</span> 미달 (주의)</p>
      </div>

      {/* 1) 연금+ISA 테이블 */}
      <section>
        <SectionTitle>1) 연금 + ISA</SectionTitle>
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse', fontSize: isMobile ? 13 : 'var(--text-sm)',
            tableLayout: 'auto',
          }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                {['항목', '2023 잔액', '2024 입금액', '2024 예상액', '2024 현재잔액', '계획대비 증감', '2023대비 증가액'].map(h => (
                  <th key={h} style={{
                    padding: '10px 12px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap',
                    color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)',
                    borderBottom: '1px solid var(--border-primary)',
                  }}
                    className={h === '항목' ? 'text-left' : ''}
                  >{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PENSION_2024.map((row, i) => {
                const deltaPlan = row.actual - row.plan;
                const deltaPrev = row.actual - row.prev;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap' }}>{row.name}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }} className="toss-number">{row.prev ? fmt(row.prev) : '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }} className="toss-number">{fmt(row.deposit)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }} className="toss-number">{fmt(row.plan)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600 }} className="toss-number">{row.actual ? fmt(row.actual) : '₩0'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: deltaColor(deltaPlan), fontWeight: 600 }} className="toss-number">{fmtDelta(deltaPlan)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: deltaColor(deltaPrev), fontWeight: 600 }} className="toss-number">{deltaPrev ? fmtDelta(deltaPrev) : '—'}</td>
                  </tr>
                );
              })}
              {/* 합계 */}
              <tr style={{ background: 'var(--bg-secondary)', fontWeight: 700 }}>
                <td style={{ padding: '12px 12px', color: 'var(--text-primary)' }}>합계</td>
                <td style={{ padding: '12px 12px', textAlign: 'right', color: 'var(--text-secondary)' }} className="toss-number">{fmt(totalPrev)}</td>
                <td style={{ padding: '12px 12px', textAlign: 'right', color: 'var(--text-secondary)' }} className="toss-number">{fmt(totalDeposit)}</td>
                <td style={{ padding: '12px 12px', textAlign: 'right', color: 'var(--text-secondary)' }} className="toss-number">{fmt(totalPlan)}</td>
                <td style={{ padding: '12px 12px', textAlign: 'right', color: 'var(--accent-blue)', fontWeight: 700 }} className="toss-number">{fmt(totalActual)}</td>
                <td style={{ padding: '12px 12px', textAlign: 'right', color: deltaColor(totalDeltaPlan), fontWeight: 700 }} className="toss-number">{fmtDelta(totalDeltaPlan)}</td>
                <td style={{ padding: '12px 12px', textAlign: 'right', color: deltaColor(totalDeltaPrev), fontWeight: 700 }} className="toss-number">{fmtDelta(totalDeltaPrev)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>연 수익률</span>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-profit)' }}>13.72%</span>
        </div>
      </section>

      {/* 요약 카드 */}
      <section>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
          gap: 12,
        }}>
          <SummaryCard label="총 자산 증가" value="약 +₩163,944,869" sub="국내외주식·우리사주·퇴직금DC 제외" accent profit />
          <SummaryCard label="2) 대출 상환" value="₩49,100,000" />
          <SummaryCard label="3) 예적금 (비상금)" value="₩9,000,000" />
          <SummaryCard label="4) 노랑우산공제 가입" value="₩2,750,000" />
        </div>
      </section>

      {/* 수익의 이유 */}
      <section>
        <SectionTitle>수익의 이유</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <MemoCard title="1) 금 매도">
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>금 매도 수익 실현</p>
          </MemoCard>
          <MemoCard title="2) 해외지수 상승 + 배당 재투자">
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>좋았던 해외지수 및 배당 재투자 효과</p>
          </MemoCard>
          <MemoCard title="3) 사업자 수입">
            <MemoBlock items={[
              `매출 : ₩50,240,000`,
              `부가세 : ₩5,024,000`,
              `수익 : ₩6,316,000`,
            ]} />
          </MemoCard>
          <MemoCard title="4) 부수입 (앱테크, 이벤트 참여)">
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>생활비에 보탬</p>
          </MemoCard>
        </div>
      </section>
    </div>
  );
}

// ── 2025 페이지 ───────────────────────────────────────────────
function Review2025({ isMobile }: { isMobile: boolean }) {
  const close2024    = 396021131;
  const close2025    = 567929068;
  const increase     = 174661135;  // 실제 사용자 제공값 (567929068-396021131=171907937 이나 원문 그대로)
  const deposit      = 95000000;
  const profitNoDeposit = 79661135;

  const income = [
    { label: '지윤 급여',   value: 66620296 },
    { label: '오빠 급여',   value: 65674960 },
    { label: '사업자 소득', value: 12650000 },
    { label: '공모주 수익', value: 3100000  },
  ];
  const totalIncome = income.reduce((s, r) => s + r.value, 0);
  const spending = 53045256;
  const fixedSpending = 38358516;
  const varSpending = 14686740;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* 요점 정리 */}
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-primary)', padding: '18px 22px',
        lineHeight: 1.9, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)',
      }}>
        <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, fontSize: 'var(--text-base)' }}>2025년 요점</p>
        <p>• 마감잔액 <strong style={{ color: 'var(--accent-blue)' }}>₩567,929,068</strong> — 전년 대비 <strong style={{ color: 'var(--color-profit)' }}>+₩174,661,135</strong> 증가 (입금 포함 <strong style={{ color: 'var(--color-profit)' }}>+43.41%</strong> / 입금 제외 <strong style={{ color: 'var(--color-profit)' }}>+20.12%</strong>)</p>
        <p>• 입금액 <strong>₩95,000,000</strong> · 입금 제외 순수 수익 <strong style={{ color: 'var(--color-profit)' }}>+₩79,661,135</strong></p>
        <p>• 추정 수입 <strong>₩148,045,256 이상</strong> (지윤급여 ₩66,620,296 + 오빠급여 ₩65,674,960 + 사업자 ₩12,650,000 + 공모주 ₩3,100,000)</p>
        <p>• 추정 소비 <strong style={{ color: 'var(--color-loss)' }}>₩53,045,256 이상</strong> — 고정 ₩38,358,516 + 비정기 ₩14,686,740 (월 평균 ₩1,223,895 → 목표 80만원)</p>
        <p>• 대출 상환 <strong>₩9,000,000</strong> / 현잔액 ₩59,000,000 · 노랑우산 <strong>₩3,000,000</strong> · 비상금 없음</p>
        <p>• 아쉬운 점: 코스닥 비중 과다 / 커버드콜→지수투자 전환 손실 / 비트코인 고점 물림 → 2026년 조정 계획</p>
        <p>• 의료실비 2026년 인상 예정 — 고정비 증가 요인</p>
      </div>

      {/* 자산 요약 */}
      <section>
        <SectionTitle>자산 현황</SectionTitle>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
          gap: 12, marginBottom: 12,
        }}>
          <SummaryCard label="2024년 마감잔액" value={fmt(close2024)} />
          <SummaryCard label="2025년 마감잔액" value={fmt(close2025)} accent />
          <SummaryCard label="2025년 증가액"   value={fmtDelta(increase)} profit />
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
          gap: 12,
        }}>
          <SummaryCard label="2025년 입금액"        value={fmt(deposit)} />
          <SummaryCard label="입금 제외 수익액"     value={fmtDelta(profitNoDeposit)} profit />
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: '16px 20px',
            border: '1px solid var(--border-primary)',
          }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 500, marginBottom: 4 }}>수익률</p>
            <p className="toss-number" style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-profit)' }}>
              입금 포함 <span style={{ fontSize: 'var(--text-lg)' }}>+43.41%</span>
            </p>
            <p className="toss-number" style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-profit)', marginTop: 4 }}>
              입금 제외 <span style={{ fontSize: 'var(--text-lg)' }}>+20.12%</span>
            </p>
          </div>
        </div>
      </section>

      {/* 수입 / 소비 */}
      <section>
        <SectionTitle>수입 및 소비</SectionTitle>
        <div style={{
          display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12,
        }}>
          {/* 수입 */}
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '16px 20px',
            border: '1px solid var(--border-primary)',
          }}>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>2025년 수입</p>
            {income.map(r => (
              <div key={r.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 0', borderBottom: '1px solid var(--border-secondary)',
              }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{r.label}</span>
                <span className="toss-number" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 600 }}>{fmt(r.value)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>합계 (추정)</span>
              <span className="toss-number" style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-profit)' }}>{fmt(totalIncome)} 이상</span>
            </div>
          </div>

          {/* 소비 */}
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '16px 20px',
            border: '1px solid var(--border-primary)',
          }}>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>2025년 소비</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-secondary)' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>고정 소비 (용돈·보험·대출·노랑우산)</span>
              <span className="toss-number" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 600 }}>{fmt(fixedSpending)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-secondary)' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>비정기 소비 (월 평균 ₩1,223,895)</span>
              <span className="toss-number" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 600 }}>{fmt(varSpending)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>합계 (추정)</span>
              <span className="toss-number" style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-loss)' }}>{fmt(spending)} 이상</span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
              🎯 월 비정기 소비 80만원까지 줄이기 목표
            </p>
          </div>
        </div>
      </section>

      {/* 기타 항목 */}
      <section>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
          gap: 12,
        }}>
          <SummaryCard label="2) 대출 상환" value="₩9,000,000" sub="현잔액 ₩59,000,000" />
          <SummaryCard label="3) 예적금 (비상금)" value="없음" />
          <SummaryCard label="4) 노랑우산공제" value="₩3,000,000" sub="월 25만 × 12" />
        </div>
        <p style={{ marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
          ※ 의료실비가 2026년 오를 예정이므로 고정비용 증가 예상
        </p>
      </section>

      {/* 수익 이유 */}
      <section>
        <SectionTitle>수익의 이유</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <MemoCard title="1) 한국 증시 투자 시작 (2025년~)">
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>한국 증시에 2025년부터 신규 투자</p>
          </MemoCard>
          <MemoCard title="2) 미국 증시 양호">
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>미국 증시도 비교적 좋은 흐름 유지</p>
          </MemoCard>
          <MemoCard title="3) 사업자 수입">
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>사업자 소득 ₩12,650,000</p>
          </MemoCard>
        </div>
      </section>

      {/* 반성 및 계획 */}
      <section>
        <SectionTitle>아쉬운 점 / 반성 / 계획</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <MemoCard title="1) 코스닥 비중 과다">
            <MemoBlock items={[
              '코스닥을 코스피 대비 많이 투자함.',
              '2026년엔 한국장 비중 15~20% 수준으로 조정, 코스피 5000선 목표.',
            ]} />
          </MemoCard>
          <MemoCard title="2) 포트폴리오 전환 손실">
            <MemoBlock items={[
              '커버드콜 → 지수투자 전환 과정에서 손실 발생.',
              '자산증식도 중요하나 하락장 방어를 위해 지수투자 ↔ 커버드콜 교체, 국채 매입 등 기계적 자산배분 수행 예정.',
            ]} />
          </MemoCard>
          <MemoCard title="3) 비트코인 고점 매입">
            <MemoBlock items={[
              '비트코인 고점 물림.',
              '금 : 비트코인 비중 3:7 조정 계획.',
            ]} />
          </MemoCard>
          <MemoCard title="4) 생활비 절감">
            <MemoBlock items={[
              '외식 자제, 술·고기 줄이기, 운동 열심히.',
              '골프도 열심히.',
              '비정기 소비 월 80만원 이하 목표.',
            ]} />
          </MemoCard>
        </div>
      </section>
    </div>
  );
}

// ── 2026 페이지 ───────────────────────────────────────────────
function Review2026({ isMobile }: { isMobile: boolean }) {
  const start2026    = 567929068;  // 2025 마감잔액
  const planDeposit  = 91400000;   // 2026 계획 입금 합계

  const depositPlan = [
    { label: '퇴직연금 IRP (지윤)',   value: 3000000  },
    { label: 'ISA (지윤)',           value: 20000000 },
    { label: '펀슈 세제 (지윤)',      value: 6000000  },
    { label: '한투 (지윤)',          value: 9000000  },
    { label: 'KB 퇴직연금 IRP (지윤)', value: 3000000 },
    { label: '퇴직연금 IRP (오빠)',   value: 3000000  },
    { label: 'ISA 미래 (오빠)',      value: 20000000 },
    { label: '펀슈 세제 (오빠)',      value: 4400000  },
    { label: '미래에셋연금 (오빠)',   value: 9000000  },
    { label: '기타증권',             value: 2000000  },
    { label: '대출 상환 목표',        value: 12000000 },
  ];

  const goals = [
    { title: '한국장 비중 조정', items: ['코스닥 → 코스피 중심으로 재배분', '한국 비중 15~20% 수준 유지', '코스피 5000선 대응 전략'] },
    { title: '포트폴리오 안정화', items: ['지수투자 ↔ 커버드콜 기계적 자산배분', '국채 편입으로 하락장 방어', '환노출 비중 점검'] },
    { title: '비트코인·금 비중 조정', items: ['금 : 비트코인 = 3 : 7 목표', '고점 물림 분할 평균단가 낮추기'] },
    { title: '생활비 절감', items: ['비정기 소비 월 80만원 이하 목표', '외식·술 자제, 운동 유지'] },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* 진행 중 배너 */}
      <div style={{
        background: 'color-mix(in srgb, var(--accent-blue) 8%, transparent)',
        border: '1px solid color-mix(in srgb, var(--accent-blue) 30%, transparent)',
        borderRadius: 'var(--radius-md)', padding: '12px 18px',
        display: 'flex', alignItems: 'center', gap: 10,
        fontSize: 'var(--text-sm)', color: 'var(--accent-blue)', fontWeight: 600,
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-blue)',
          animation: 'pulse 1.5s infinite',
          flexShrink: 0,
        }} />
        2026년 진행 중 — 연도 마감 후 실적 데이터로 업데이트 예정
      </div>

      {/* 시작 현황 */}
      <section>
        <SectionTitle>2026년 시작 현황</SectionTitle>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
          gap: 12,
        }}>
          <SummaryCard label="2025년 마감잔액 (시작점)" value={fmt(start2026)} accent />
          <SummaryCard label="2026 계획 입금액" value={fmt(planDeposit)} />
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: '16px 20px',
            border: '1px solid var(--border-primary)',
          }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 500, marginBottom: 4 }}>입금 포함 목표 잔액</p>
            <p className="toss-number" style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
              {fmt(start2026 + planDeposit)}
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-quaternary)', marginTop: 4 }}>수익 제외 단순 합산</p>
          </div>
        </div>
      </section>

      {/* 2026 입금 계획 */}
      <section>
        <SectionTitle>2026년 입금 계획</SectionTitle>
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-primary)', overflow: 'hidden',
        }}>
          {depositPlan.map((r, i) => (
            <div key={r.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 18px',
              borderBottom: i < depositPlan.length - 1 ? '1px solid var(--border-secondary)' : 'none',
              background: i % 2 === 0 ? 'transparent' : 'var(--bg-tertiary)',
            }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{r.label}</span>
              <span className="toss-number" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                {fmt(r.value)}
              </span>
            </div>
          ))}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 18px', background: 'var(--bg-secondary)',
            borderTop: '2px solid var(--border-primary)',
          }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>합계</span>
            <span className="toss-number" style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-profit)' }}>
              {fmt(planDeposit)}
            </span>
          </div>
        </div>
      </section>

      {/* 2026 목표 */}
      <section>
        <SectionTitle>2026년 목표 및 계획</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {goals.map(g => (
            <MemoCard key={g.title} title={g.title}>
              <MemoBlock items={g.items} />
            </MemoCard>
          ))}
        </div>
      </section>

      {/* 고정비 변동 */}
      <section>
        <SectionTitle>고정비 변동 사항</SectionTitle>
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '16px 20px',
          border: '1px solid var(--border-primary)',
          lineHeight: 1.9, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)',
        }}>
          <p>• 의료실비 보험료 인상 예정 — 고정비 증가 요인</p>
          <p>• 대출 목표 상환 <strong>₩12,000,000</strong> → 현잔액 ₩59,000,000</p>
          <p>• 노랑우산 공제 유지 (월 25만 × 12 = ₩3,000,000)</p>
        </div>
      </section>
    </div>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export function FinancialReview() {
  const { isMobile } = useAppContext();
  const [year, setYear] = useState<2024 | 2025 | 2026>(2026);

  return (
    <div style={{ padding: isMobile ? '16px' : '24px' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>재정 평가</h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginTop: 4 }}>연도별 자산 현황 및 재정 회고</p>
      </div>

      {/* 연도 탭 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {([2026, 2025, 2024] as const).map(y => (
          <button
            key={y}
            onClick={() => setYear(y)}
            className={`toss-tab ${year === y ? 'toss-tab-active' : ''}`}
            style={{ padding: '8px 20px', borderRadius: 20, fontSize: 'var(--text-sm)', border: 'none', cursor: 'pointer' }}
          >
            {y}년
          </button>
        ))}
      </div>

      {year === 2024 ? <Review2024 isMobile={isMobile} /> : year === 2025 ? <Review2025 isMobile={isMobile} /> : <Review2026 isMobile={isMobile} />}
    </div>
  );
}
