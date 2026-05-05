import { useState, useCallback } from 'react';
import { getSellDecision } from '../utils/sellEngine';
import { DEFAULT_SELL_CONFIG } from '../utils/sellConfig';
import { getTrend, getSellSignal, getBuySignal, type StockSignal } from '../utils/fetchStockSignals';
import { calcMA, calcReturnPct, calcChangeRate, calcPosition } from '../utils/calcUtils';
import { MIcon } from './MIcon';

type TR = { name: string; inputStr: string; expectedStr: string; actualStr: string; passed: boolean };
type Results = Record<string, TR[]>;

function sig(currentPrice: number, ma20: number, ma60: number, high: number, low: number, position: number): StockSignal {
  return { ticker: 'TEST', currentPrice, changeRate: 0, ma20, ma60, high, low, position };
}

function isCautious(label: string): boolean {
  return label.includes('조정 대기') || label.includes('반등 대기');
}

function runSection(id: string): TR[] {
  switch (id) {
    case 'engine': return [
      { input: { currentReturn: -0.05, currentPrice: 28000, ma20: 27000, ma60: 26000 }, ea: 'hold',      eu: 'none',     name: '① Veto — 주가 > MA20' },
      { input: { currentReturn:  0.05, currentPrice: 25000, ma20: 26000, ma60: 27000 }, ea: 'sell_all',  eu: 'high',     name: '② 추세붕괴 — MA20 < MA60' },
      { input: { currentReturn: -0.15, currentPrice: 24000, ma20: 26000, ma60: 25000 }, ea: 'sell_all',  eu: 'critical', name: '③ 손절 — return ≤ stopLoss' },
      { input: { currentReturn:  0.25, currentPrice: 24000, ma20: 26000, ma60: 25000 }, ea: 'sell_half', eu: 'medium',   name: '④ 수익실현 — return ≥ targetReturn + price < MA20' },
      { input: { currentReturn:  0.05, currentPrice: 24000, ma20: 26000, ma60: 25000 }, ea: 'hold',      eu: 'none',     name: '⑤ 조건 미충족 — hold' },
      { input: { currentReturn:  0.25, currentPrice: 22000, ma20: 24000, ma60: 26000 }, ea: 'sell_all',  eu: 'high',     name: '⑥ 추세붕괴 우선 (+25% 수익 있어도)' },
    ].map(t => {
      const r = getSellDecision(t.input, DEFAULT_SELL_CONFIG);
      const passed = r.action === t.ea && r.urgency === t.eu;
      const ret = t.input.currentReturn;
      return {
        name: t.name,
        inputStr: `return=${ret !== null ? (ret * 100).toFixed(0) + '%' : 'null'} price=${t.input.currentPrice.toLocaleString()} MA20=${t.input.ma20.toLocaleString()} MA60=${t.input.ma60.toLocaleString()}`,
        expectedStr: `${t.ea} / ${t.eu}`,
        actualStr: `${r.action} / ${r.urgency}`,
        passed,
      };
    });

    case 'trend': return [
      { s: sig(30000, 28000, 26000, 30000, 20000, 0.9), expected: 'up',       name: '상승추세 — 주가 MA20·MA60 모두 위' },
      { s: sig(22000, 26000, 28000, 30000, 20000, 0.2), expected: 'down',     name: '하락추세 — 주가 MA20·MA60 모두 아래' },
      { s: sig(27000, 26000, 28000, 30000, 20000, 0.7), expected: 'sideways', name: '횡보 — 주가 > MA20 but < MA60' },
      { s: sig(25000, 26000, 24000, 30000, 20000, 0.5), expected: 'sideways', name: '횡보 — 주가 < MA20 but > MA60' },
      { s: sig(26000, 26000, 24000, 30000, 20000, 0.6), expected: 'up',       name: '경계값 — 주가 = MA20 (>= 이므로 up)' },
    ].map(t => {
      const r = getTrend(t.s);
      return {
        name: t.name,
        inputStr: `price=${t.s.currentPrice.toLocaleString()} MA20=${t.s.ma20.toLocaleString()} MA60=${t.s.ma60.toLocaleString()}`,
        expectedStr: t.expected,
        actualStr: r,
        passed: r === t.expected,
      };
    });

    case 'sell-sig': return [
      { s: sig(29000, 27000, 25000, 30000, 20000, 0.9), expected: '매도 적합',   name: '매도 적합 — 상승 + position 90%' },
      { s: sig(26000, 24000, 22000, 30000, 20000, 0.6), expected: '매도 가능',   name: '매도 가능 — 상승 + position 60%' },
      { s: sig(26000, 24000, 28000, 30000, 20000, 0.6), expected: '매도 가능',   name: '매도 가능 — 횡보 + position 60%' },
      { s: sig(24000, 26000, 22000, 30000, 20000, 0.4), expected: '반등 대기',   name: '반등 대기 — 횡보 + position 40%' },
      { s: sig(22000, 26000, 28000, 30000, 20000, 0.2), expected: '저점 매도',   name: '저점 매도 — 하락 + position 20%' },
      { s: sig(22000, 26000, 28000, 30000, 20000, 0.5), expected: '반등 후 매도', name: '반등 후 매도 — 하락 + position 50%' },
    ].map(t => {
      const r = getSellSignal(t.s);
      return {
        name: t.name,
        inputStr: `price=${t.s.currentPrice.toLocaleString()} MA20=${t.s.ma20.toLocaleString()} MA60=${t.s.ma60.toLocaleString()} pos=${(t.s.position * 100).toFixed(0)}%`,
        expectedStr: t.expected,
        actualStr: r.label,
        passed: r.label === t.expected,
      };
    });

    case 'buy-sig': return [
      { s: sig(22000, 26000, 28000, 30000, 20000, 0.1), el: '반등 대기', ec: true,  name: '반등 대기 (분할) — 하락 + position 10%' },
      { s: sig(22000, 26000, 28000, 30000, 20000, 0.5), el: '반등 대기', ec: true,  name: '반등 대기 (분할) — 하락 + position 50%' },
      { s: sig(23000, 26000, 21000, 30000, 20000, 0.3), el: '매수 적합', ec: false, name: '매수 적합 — 횡보 + position 30%' },
      { s: sig(26000, 24000, 28000, 30000, 20000, 0.6), el: '분할 매수', ec: false, name: '분할 매수 — 횡보 + position 60%' },
      { s: sig(29000, 27000, 25000, 30000, 20000, 0.9), el: '조정 대기', ec: true,  name: '조정 대기 (분할) — 상승 + position 90%' },
      { s: sig(27000, 25000, 23000, 30000, 20000, 0.7), el: '분할 매수', ec: false, name: '분할 매수 — 상승 + position 70%' },
      { s: sig(24000, 22000, 20000, 30000, 20000, 0.4), el: '매수 가능', ec: false, name: '매수 가능 — 상승 + position 40%' },
    ].map(t => {
      const r = getBuySignal(t.s);
      const ac = isCautious(r.label);
      const passed = r.label === t.el && ac === t.ec;
      return {
        name: t.name,
        inputStr: `price=${t.s.currentPrice.toLocaleString()} MA20=${t.s.ma20.toLocaleString()} MA60=${t.s.ma60.toLocaleString()} pos=${(t.s.position * 100).toFixed(0)}%`,
        expectedStr: `${t.el} / 분할:${t.ec ? '✓' : '–'}`,
        actualStr: `${r.label} / 분할:${ac ? '✓' : '–'}`,
        passed,
      };
    });

    case 'position': return [
      { price: 20000, low: 20000, high: 30000, expected: 0.00, name: '저점 = currentPrice → 0' },
      { price: 30000, low: 20000, high: 30000, expected: 1.00, name: '고점 = currentPrice → 1' },
      { price: 25000, low: 20000, high: 30000, expected: 0.50, name: '정중간 → 0.5' },
      { price: 24200, low: 20000, high: 30000, expected: 0.42, name: '42% 위치' },
      { price: 25000, low: 25000, high: 25000, expected: 0.00, name: '고저점 같음 → 0 (division guard)' },
    ].map(t => {
      const r = calcPosition(t.price, t.low, t.high);
      const passed = Math.abs(r - t.expected) < 0.001;
      return {
        name: t.name,
        inputStr: `price=${t.price.toLocaleString()} low=${t.low.toLocaleString()} high=${t.high.toLocaleString()}`,
        expectedStr: t.expected.toFixed(2),
        actualStr: r.toFixed(2),
        passed,
      };
    });

    case 'change': return [
      { last: 26175, prev: 25000, expected:   4.70, name: '가격 상승 +4.7%' },
      { last: 26175, prev: 26247, expected:  -0.27, name: '가격 하락 -0.27%' },
      { last: 26000, prev: 26000, expected:   0.00, name: '변동 없음 0%' },
      { last:  5000, prev: 10000, expected: -50.00, name: '반토막 -50%' },
      { last: 20000, prev: 10000, expected: 100.00, name: '2배 +100%' },
    ].map(t => {
      const r = calcChangeRate(t.last, t.prev);
      const passed = Math.abs(r - t.expected) < 0.01;
      return {
        name: t.name,
        inputStr: `last=${t.last.toLocaleString()} prev=${t.prev.toLocaleString()}`,
        expectedStr: t.expected.toFixed(2) + '%',
        actualStr: r.toFixed(2) + '%',
        passed,
      };
    });

    case 'ma': return [
      { prices: [10, 20, 30, 40, 50],       period: 3,  expectedLast: Math.round((30+40+50)/3),              name: 'MA3, 데이터 5개' },
      { prices: [10, 20, 30, 40, 50],       period: 5,  expectedLast: Math.round((10+20+30+40+50)/5),        name: 'MA5, 데이터 정확히 5개' },
      { prices: [10, 20, 30, 40],           period: 5,  expectedLast: null,                                  name: 'MA5, 데이터 4개 → null' },
      { prices: Array(25).fill(100),        period: 20, expectedLast: 100,                                   name: 'MA20, 균등 100가격' },
    ].map(t => {
      const arr = calcMA(t.prices, t.period);
      const r = arr[arr.length - 1];
      const passed = r === t.expectedLast;
      return {
        name: t.name,
        inputStr: `prices=[${t.prices.slice(0, 4).join(',')}${t.prices.length > 4 ? ',...' : ''}] period=${t.period}`,
        expectedStr: t.expectedLast === null ? 'null' : String(t.expectedLast),
        actualStr: r === null ? 'null' : String(r),
        passed,
      };
    });

    case 'return': return [
      { price: 25000, avgCost: 20000, expected: 25,                                                             name: '+25% 수익' },
      { price: 18000, avgCost: 20000, expected: -10,                                                            name: '-10% 손실' },
      { price: 20000, avgCost: 20000, expected: 0,                                                              name: '원금 동일 0%' },
      { price: 26175, avgCost: 18750, expected: parseFloat(((26175 - 18750) / 18750 * 100).toFixed(4)),         name: '+39.6% (TIGER 케이스)' },
    ].map(t => {
      const r = calcReturnPct(t.price, t.avgCost);
      const passed = Math.abs(r - t.expected) < 0.01;
      return {
        name: t.name,
        inputStr: `price=${t.price.toLocaleString()} avgCost=${t.avgCost.toLocaleString()}`,
        expectedStr: t.expected.toFixed(2) + '%',
        actualStr: r.toFixed(2) + '%',
        passed,
      };
    });

    default: return [];
  }
}

const SECTION_META: { id: string; title: string; badge: string; iconColor: string; formula: string[]; source: string }[] = [
  {
    id: 'engine', title: 'sellEngine · getSellDecision()', badge: '4조건 AND', iconColor: 'var(--color-loss)',
    formula: [
      '① Veto: currentPrice > MA20  →  hold',
      '② 추세붕괴: MA20 < MA60  →  sell_all (urgency: high)',
      '③ 손절: currentReturn ≤ stopLoss(-10%)  →  sell_all (urgency: critical)',
      '④ 수익실현: currentReturn ≥ targetReturn(+20%) + price < MA20  →  sell_half',
    ],
    source: 'src/utils/sellEngine.ts — getSellDecision()',
  },
  {
    id: 'trend', title: 'getTrend() — 추세 판단', badge: 'MA20 vs MA60', iconColor: 'var(--accent-blue)',
    formula: [
      'price >= MA20 AND price >= MA60  →  up',
      'price < MA20  AND price < MA60  →  down',
      '그 외 (한쪽만)                  →  sideways',
    ],
    source: 'src/utils/fetchStockSignals.ts — getTrend()',
  },
  {
    id: 'sell-sig', title: 'getSellSignal() — 매도 타이밍', badge: '6가지 신호', iconColor: 'var(--color-loss)',
    formula: [
      'up   + pos ≥ 70%  →  매도 적합',
      'up   + pos < 70%  →  매도 가능',
      'side + pos ≥ 50%  →  매도 가능',
      'side + pos < 50%  →  반등 대기',
      'down + pos ≤ 30%  →  저점 매도',
      'down + pos > 30%  →  반등 후 매도',
    ],
    source: 'src/utils/fetchStockSignals.ts — getSellSignal()',
  },
  {
    id: 'buy-sig', title: 'getBuySignal() — 매수 타이밍', badge: '7가지 신호', iconColor: 'var(--color-profit)',
    formula: [
      'down + pos ≤ 20%       →  반등 대기 (분할)',
      'down + pos > 20%       →  반등 대기 (분할)',
      'side + pos ≤ 40%       →  매수 적합',
      'side + pos > 40%       →  분할 매수',
      'up   + pos ≥ 80%       →  조정 대기 (분할)',
      'up   + 60% ≤ pos < 80% →  분할 매수',
      'up   + pos < 60%       →  매수 가능',
      '분할권장 = label.includes("조정 대기") || label.includes("반등 대기")',
    ],
    source: 'src/utils/fetchStockSignals.ts — getBuySignal()',
  },
  {
    id: 'position', title: 'calcPosition() — 60일 범위 위치', badge: '0 ~ 1', iconColor: 'var(--color-warning)',
    formula: ['position = (currentPrice - low60) / (high60 - low60)', '0 = 저점, 1 = 고점'],
    source: 'src/utils/calcUtils.ts — calcPosition() ← worker/src/index.ts와 동일',
  },
  {
    id: 'change', title: 'calcChangeRate() — 등락률', badge: '퍼센트', iconColor: '#7c3aed',
    formula: ['changeRate = (lastPrice - prevPrice) / prevPrice × 100'],
    source: 'src/utils/calcUtils.ts — calcChangeRate()',
  },
  {
    id: 'ma', title: 'calcMA() — 이동평균', badge: '단순 이동평균', iconColor: 'var(--accent-blue)',
    formula: [
      'calcMA(prices, period) → prices.map((_, i) => {',
      '  if (i < period - 1) return null;',
      '  return Math.round( sum(prices[i-period+1..i]) / period );',
      '})',
    ],
    source: 'src/utils/calcUtils.ts — calcMA() ← ChartPage.tsx도 동일 함수 사용',
  },
  {
    id: 'return', title: 'calcReturnPct() — 수익률', badge: '퍼센트 (25 = +25%)', iconColor: 'var(--color-profit)',
    formula: [
      'calcReturnPct = (currentPrice - avgCost) / avgCost × 100   ← 퍼센트 (25 = +25%)',
      'sellEngine 전달 시: calcReturnPct / 100  (OptimalGuide.tsx L1720)',
    ],
    source: 'src/utils/calcUtils.ts — calcReturnPct() ← OptimalGuide.tsx calcReturn()과 동일 산식',
  },
];

function Badge({ passed }: { passed: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 700,
      background: passed ? 'color-mix(in srgb, var(--color-profit) 15%, transparent)' : 'color-mix(in srgb, var(--color-loss) 15%, transparent)',
      color: passed ? 'var(--color-profit)' : 'var(--color-loss)',
    }}>
      {passed ? '✓ 통과' : '✗ 실패'}
    </span>
  );
}

export function CalcChecklist() {
  const [results, setResults] = useState<Results>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const handleRun = useCallback((id: string) => {
    setResults(prev => ({ ...prev, [id]: runSection(id) }));
    setCollapsed(prev => ({ ...prev, [id]: false }));
  }, []);

  const handleRunAll = useCallback(() => {
    const next: Results = {};
    for (const s of SECTION_META) next[s.id] = runSection(s.id);
    setResults(next);
    setCollapsed({});
  }, []);

  const totalPass  = Object.values(results).flat().filter(r => r.passed).length;
  const totalFail  = Object.values(results).flat().filter(r => !r.passed).length;
  const totalAll   = totalPass + totalFail;

  const th: React.CSSProperties = {
    background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)',
    fontSize: 10, fontWeight: 700, padding: '6px 12px',
    textAlign: 'left', letterSpacing: 0.5, textTransform: 'uppercase',
  };
  const td: React.CSSProperties = {
    padding: '8px 12px', borderTop: '1px solid var(--border-secondary)', fontSize: 12, verticalAlign: 'middle',
  };

  return (
    <div style={{ padding: '20px', maxWidth: 960, margin: '0 auto', overflowY: 'auto', height: '100%' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>계산식 체크리스트</h1>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>실제 소스 함수를 직접 import하여 검증합니다 — 소스 변경 시 자동 반영됩니다.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {totalAll > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { label: '통과', val: totalPass, color: 'var(--color-profit)' },
                { label: '실패', val: totalFail, color: 'var(--color-loss)' },
                { label: '전체', val: totalAll,  color: 'var(--accent-blue)' },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: '6px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={handleRunAll}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: 'var(--accent-blue)', color: '#fff' }}
          >
            <MIcon name="play_arrow" size={16} /> 모두 실행
          </button>
        </div>
      </div>

      {/* 섹션들 */}
      {SECTION_META.map(meta => {
        const sectionResults = results[meta.id];
        const pass = sectionResults?.filter(r => r.passed).length ?? 0;
        const total = sectionResults?.length ?? 0;
        const isCollapsed = collapsed[meta.id];

        return (
          <div key={meta.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
            {/* 섹션 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: sectionResults && !isCollapsed ? '1px solid var(--border-secondary)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{meta.title}</span>
                <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, fontWeight: 600, background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>{meta.badge}</span>
                {sectionResults && (
                  <span style={{ fontSize: 11, color: pass === total ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                    ({pass}/{total})
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {sectionResults && (
                  <button
                    onClick={() => setCollapsed(prev => ({ ...prev, [meta.id]: !isCollapsed }))}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-primary)', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                  >
                    <MIcon name={isCollapsed ? 'expand_more' : 'expand_less'} size={14} />
                    {isCollapsed ? '펼치기' : '접기'}
                  </button>
                )}
                <button
                  onClick={() => handleRun(meta.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-primary)', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                >
                  <MIcon name="play_arrow" size={14} /> 실행
                </button>
              </div>
            </div>

            {/* 상세 (접힘 제어) */}
            {!isCollapsed && (
              <>
                {/* 출처 */}
                <div style={{ padding: '8px 16px', background: '#fffbeb', borderBottom: '1px solid #fde68a', fontSize: 11, color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MIcon name="insert_drive_file" size={13} style={{ color: '#7c3aed' }} />
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#7c3aed' }}>{meta.source}</span>
                </div>

                {/* 계산식 */}
                <div style={{ margin: '12px 16px', padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: 8, borderLeft: '3px solid var(--accent-blue)' }}>
                  {meta.formula.map((f, i) => (
                    <code key={i} style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--accent-blue)', display: 'block', lineHeight: 1.9 }}>{f}</code>
                  ))}
                </div>

                {/* 결과 테이블 */}
                {sectionResults && (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={th}>케이스</th>
                        <th style={th}>입력값</th>
                        <th style={{ ...th, color: '#d97706' }}>예상</th>
                        <th style={th}>실제</th>
                        <th style={{ ...th, width: 70, textAlign: 'center' }}>판정</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectionResults.map((r, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--bg-tertiary) 40%, transparent)' }}>
                          <td style={td}>{r.name}</td>
                          <td style={{ ...td, fontFamily: 'monospace', fontSize: 11, color: 'var(--text-secondary)', maxWidth: 280 }}>{r.inputStr}</td>
                          <td style={{ ...td, fontWeight: 600, color: '#d97706' }}>{r.expectedStr}</td>
                          <td style={{ ...td, fontWeight: 600, color: r.passed ? 'var(--color-profit)' : 'var(--color-loss)' }}>{r.actualStr}</td>
                          <td style={{ ...td, textAlign: 'center' }}><Badge passed={r.passed} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
