import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useAppContext } from '../App';
import { MIcon } from './MIcon';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://asset-dashboard-api.jilliankim200.workers.dev';

interface ChartPoint {
  date: string;
  price: number;
  ma5: number | null;
  ma20: number | null;
  ma60: number | null;
}

function calcMA(prices: number[], period: number): (number | null)[] {
  return prices.map((_, i) => {
    if (i < period - 1) return null;
    const slice = prices.slice(i - period + 1, i + 1);
    return Math.round(slice.reduce((s, p) => s + p, 0) / period);
  });
}

function fmtPrice(n: number): string {
  return n.toLocaleString('ko-KR') + '원';
}

const PERIOD_OPTIONS = [
  { label: '1개월', days: 30 },
  { label: '3개월', days: 90 },
  { label: '6개월', days: 180 },
];

const MA_OPTIONS = [
  { key: 'ma5',  label: 'MA5',  color: 'var(--chart-ma5)',  period: 5 },
  { key: 'ma20', label: 'MA20', color: 'var(--chart-ma20)', period: 20 },
  { key: 'ma60', label: 'MA60', color: 'var(--chart-ma60)', period: 60 },
];

// 커스텀 툴팁
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
      borderRadius: 10, padding: '10px 14px', fontSize: 'var(--text-xs)', minWidth: 160,
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    }}>
      <div style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        p.value != null && (
          <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: p.color, marginBottom: 2 }}>
            <span>{p.name}</span>
            <span style={{ fontWeight: 600 }}>{p.value.toLocaleString('ko-KR')}원</span>
          </div>
        )
      ))}
    </div>
  );
}

function PeriodGuideModal({ onClose }: { onClose: () => void }) {
  const combos = [
    {
      title: '3개월 + MA20',
      tag: '기본 추천',
      tagColor: 'var(--color-profit)',
      period: '3개월',
      mas: ['MA20'],
      maColors: ['var(--chart-ma20)'],
      goal: '지금 추세 파악',
      desc: '상승 중인지, 횡보인지, 하락인지 가장 빠르게 파악할 수 있습니다. 현재가가 MA20 위에 있으면 상승 추세, 아래면 하락 추세. 최적 가이드의 매수·매도 신호도 이 조합을 기준으로 계산됩니다.',
    },
    {
      title: '6개월 + MA20 + MA60',
      tag: '크로스 확인',
      tagColor: 'var(--accent-blue)',
      period: '6개월',
      mas: ['MA20', 'MA60'],
      maColors: ['var(--chart-ma20)', 'var(--chart-ma60)'],
      goal: '중기 방향 전환 포착',
      desc: 'MA20이 MA60을 위로 뚫고 올라가면 골든크로스 → 매수 신호. 아래로 꺾이면 데드크로스 → 매도 신호. 6개월은 봐야 MA60 선이 충분히 완성됩니다.',
    },
    {
      title: '3개월 + MA5 + MA20',
      tag: '단기 전환',
      tagColor: 'var(--color-warning)',
      period: '3개월',
      mas: ['MA5', 'MA20'],
      maColors: ['var(--chart-ma5)', 'var(--chart-ma20)'],
      goal: '단기 방향 전환 포착',
      desc: 'MA5(5일선)가 MA20을 위로 뚫으면 단기 반등 시작 신호, 아래로 꺾이면 단기 조정 신호. MA5는 잡음이 많으므로 MA20과 교차점만 의미 있게 읽으세요.',
    },
    {
      title: '1개월 + MA5',
      tag: '변동성 확인',
      tagColor: 'var(--text-tertiary)',
      period: '1개월',
      mas: ['MA5'],
      maColors: ['var(--chart-ma5)'],
      goal: '단기 출렁임 파악',
      desc: '지금 이 종목이 얼마나 빠르게 움직이는지 확인할 때. 매수·매도 판단보다는 변동성 체감용. MA20·MA60은 1개월 구간에선 앞부분이 잘려 참고 불가.',
    },
  ];

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-elevated)', borderRadius: 14,
        border: '1px solid var(--border-primary)', width: '100%', maxWidth: 520,
        maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: '1px solid var(--border-secondary)', flexShrink: 0 }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>기간 · MA 조합 가이드</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-tertiary)', fontSize: 'var(--text-lg)', lineHeight: 1, padding: '2px 4px' }}>✕</button>
        </div>

        {/* MA 설명 한줄 */}
        <div style={{ padding: '10px 18px 8px', flexShrink: 0, display: 'flex', gap: 14, flexWrap: 'wrap',
          borderBottom: '1px solid var(--border-secondary)', background: 'var(--bg-secondary)' }}>
          {[
            { label: 'MA5', color: 'var(--chart-ma5)', desc: '5일 평균 — 단기 잡음' },
            { label: 'MA20', color: 'var(--chart-ma20)', desc: '20일 평균 — 단기 추세 기준선' },
            { label: 'MA60', color: 'var(--chart-ma60)', desc: '60일 평균 — 중기 추세 기준선' },
          ].map(m => (
            <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 20, height: 2, borderRadius: 1, background: m.color, flexShrink: 0 }} />
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: m.color }}>{m.label}</span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{m.desc}</span>
            </div>
          ))}
        </div>

        {/* 조합 목록 */}
        <div style={{ overflowY: 'auto', padding: '12px 18px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {combos.map(c => (
            <div key={c.title} style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '12px 14px',
              border: `1px solid color-mix(in srgb, ${c.tagColor} 20%, var(--border-secondary))` }}>
              {/* 타이틀 행 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{c.title}</span>
                <span style={{ fontSize: 'var(--text-xs)', padding: '1px 7px', borderRadius: 5, fontWeight: 600,
                  background: `color-mix(in srgb, ${c.tagColor} 15%, transparent)`, color: c.tagColor }}>
                  {c.tag}
                </span>
              </div>
              {/* 목적 */}
              <div style={{ fontSize: 'var(--text-xs)', color: c.tagColor, fontWeight: 600, marginBottom: 5 }}>→ {c.goal}</div>
              {/* 설명 */}
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.75 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChartPage() {
  const { accounts, isMobile, navigateTo } = useAppContext();
  const [selectedTicker, setSelectedTicker] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [days, setDays] = useState(90);
  const [showMA, setShowMA] = useState<Record<string, boolean>>({ ma5: true, ma20: true, ma60: true });
  const [rawData, setRawData] = useState<{ date: string; price: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [fromPage, setFromPage] = useState<string | null>(null);
  const [fromTicker, setFromTicker] = useState<string | null>(null);

  // 전체 고유 종목 목록 (6자리 티커)
  const allHoldings = useMemo(() => {
    const seen = new Set<string>();
    const result: { ticker: string; name: string; owners: string[] }[] = [];
    for (const acc of accounts) {
      for (const h of acc.holdings) {
        if (!h.ticker || !/^[0-9A-Z]{6}$/i.test(h.ticker) || h.isFund) continue;
        if (seen.has(h.ticker)) {
          const existing = result.find(r => r.ticker === h.ticker);
          if (existing && !existing.owners.includes(acc.ownerName)) existing.owners.push(acc.ownerName);
        } else {
          seen.add(h.ticker);
          result.push({ ticker: h.ticker, name: h.name, owners: [acc.ownerName] });
        }
      }
    }
    return result;
  }, [accounts]);

  // sessionStorage에서 진입 컨텍스트 읽기
  useEffect(() => {
    const navTicker = sessionStorage.getItem('chart_nav_ticker');
    const navFrom   = sessionStorage.getItem('chart_nav_from');
    if (navTicker) {
      setFromPage(navFrom);
      setFromTicker(navTicker);
      sessionStorage.removeItem('chart_nav_ticker');
      sessionStorage.removeItem('chart_nav_from');
    }
  }, []);

  // 첫 종목 자동 선택 (또는 nav 컨텍스트 종목)
  useEffect(() => {
    if (allHoldings.length === 0) return;
    if (fromTicker) {
      const target = allHoldings.find(h => h.ticker === fromTicker);
      if (target) {
        setSelectedTicker(target.ticker);
        setSelectedName(target.name);
        setDays(90);
        setShowMA({ ma5: false, ma20: true, ma60: false });
      }
    } else if (!selectedTicker) {
      setSelectedTicker(allHoldings[0].ticker);
      setSelectedName(allHoldings[0].name);
    }
  }, [allHoldings, fromTicker]);

  // 차트 데이터 fetch
  useEffect(() => {
    if (!selectedTicker) return;
    setLoading(true);
    setError('');
    fetch(`${WORKER_URL}/stock-chart/${selectedTicker}?days=${days}`)
      .then(r => r.json())
      .then((data: { date: string; price: number }[]) => {
        if (!Array.isArray(data) || data.length === 0) throw new Error('no data');
        setRawData(data);
        setLoading(false);
      })
      .catch(() => {
        setError('데이터를 불러올 수 없습니다.');
        setLoading(false);
      });
  }, [selectedTicker, days]);

  // MA 계산
  const chartData: ChartPoint[] = useMemo(() => {
    if (rawData.length === 0) return [];
    const prices = rawData.map(d => d.price);
    const ma5  = calcMA(prices, 5);
    const ma20 = calcMA(prices, 20);
    const ma60 = calcMA(prices, 60);
    return rawData.map((d, i) => ({
      date: d.date.slice(5), // MM-DD
      price: d.price,
      ma5:  ma5[i],
      ma20: ma20[i],
      ma60: ma60[i],
    }));
  }, [rawData]);

  // 현재가 / 변동률
  const lastPrice = rawData[rawData.length - 1]?.price ?? 0;
  const prevPrice = rawData[rawData.length - 2]?.price ?? lastPrice;
  const changeRate = prevPrice > 0 ? ((lastPrice - prevPrice) / prevPrice) * 100 : 0;
  const changeColor = changeRate >= 0 ? 'var(--color-profit)' : 'var(--color-loss)';

  // Y축 범위 (약간 여유)
  const allPrices = chartData.flatMap(d => [d.price, d.ma5, d.ma20, d.ma60].filter(Boolean) as number[]);
  const yMin = allPrices.length > 0 ? Math.floor(Math.min(...allPrices) * 0.98) : 0;
  const yMax = allPrices.length > 0 ? Math.ceil(Math.max(...allPrices) * 1.02) : 100;

  const p = isMobile ? '16px 12px' : '24px';

  // X축 라벨 간격 (데이터 많으면 듬성듬성)
  const xInterval = chartData.length > 60 ? Math.floor(chartData.length / 8) : Math.floor(chartData.length / 6);

  return (
    <div style={{ padding: p }}>
      {showGuide && <PeriodGuideModal onClose={() => setShowGuide(false)} />}

      {/* 헤더 */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>차트</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>보유 종목의 주가와 이동평균선을 확인합니다.</div>
        </div>
        {fromPage && (
          <button
            onClick={() => {
              if (fromTicker) sessionStorage.setItem('chart_return_ticker', fromTicker);
              navigateTo(fromPage);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
              border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)',
              fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}
          >
            <MIcon name="arrow_back" size={16} />
            돌아가기
          </button>
        )}
      </div>

      {/* 컨트롤 바 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        {/* 종목 선택 */}
        <select
          value={selectedTicker}
          onChange={e => {
            const h = allHoldings.find(h => h.ticker === e.target.value);
            setSelectedTicker(e.target.value);
            setSelectedName(h?.name || '');
          }}
          style={{
            background: 'var(--bg-secondary)', color: 'var(--text-primary)',
            border: '1px solid var(--border-primary)', borderRadius: 8,
            padding: '7px 12px', fontSize: 'var(--text-sm)', cursor: 'pointer', minWidth: 200,
          }}
        >
          {allHoldings.map(h => (
            <option key={h.ticker} value={h.ticker}>
              {h.name} ({h.ticker})
            </option>
          ))}
        </select>

        {/* 기간 선택 */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {PERIOD_OPTIONS.map(opt => (
            <button key={opt.days} onClick={() => {
              setDays(opt.days);
              if (opt.days === 30)  setShowMA({ ma5: true,  ma20: false, ma60: false });
              if (opt.days === 90)  setShowMA({ ma5: false, ma20: true,  ma60: false });
              if (opt.days === 180) setShowMA({ ma5: false, ma20: true,  ma60: true  });
            }} style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', border: 'none',
              background: days === opt.days ? 'var(--accent-blue)' : 'var(--bg-secondary)',
              color: days === opt.days ? 'var(--accent-blue-fg)' : 'var(--text-secondary)',
            }}>{opt.label}</button>
          ))}
          <button onClick={() => setShowGuide(true)} style={{
            padding: '5px 10px', borderRadius: 8, fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer',
            background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)',
            border: '1px solid var(--border-primary)',
          }}>가이드</button>
        </div>

        {/* MA 토글 */}
        <div style={{ display: 'flex', gap: 4 }}>
          {MA_OPTIONS.map(ma => (
            <button key={ma.key} onClick={() => setShowMA(prev => ({ ...prev, [ma.key]: !prev[ma.key] }))} style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', border: 'none',
              background: showMA[ma.key] ? `color-mix(in srgb, ${ma.color} 20%, var(--bg-secondary))` : 'var(--bg-secondary)',
              color: showMA[ma.key] ? ma.color : 'var(--text-tertiary)',
              outline: showMA[ma.key] ? `1px solid ${ma.color}` : '1px solid transparent',
            }}>{ma.label}</button>
          ))}
        </div>
      </div>

      {/* 종목 정보 */}
      {selectedName && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedName}</span>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>{selectedTicker}</span>
          {lastPrice > 0 && (
            <>
              <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>{fmtPrice(lastPrice)}</span>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: changeColor }}>
                {changeRate >= 0 ? '+' : ''}{changeRate.toFixed(2)}%
              </span>
            </>
          )}
        </div>
      )}

      {/* 차트 */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, padding: isMobile ? '12px 4px' : '20px 16px', minHeight: 340 }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, gap: 8, color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
            <MIcon name="sync" size={18} style={{ color: 'var(--text-tertiary)' }} />
            데이터 로딩 중...
          </div>
        )}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--color-loss)', fontSize: 'var(--text-sm)' }}>
            {error}
          </div>
        )}
        {!loading && !error && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={isMobile ? 260 : 360}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" opacity={0.5} />
              <XAxis
                dataKey="date"
                tick={{ fill: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}
                interval={xInterval}
                tickLine={false}
                axisLine={{ stroke: 'var(--border-secondary)' }}
              />
              <YAxis
                domain={[yMin, yMax]}
                tick={{ fill: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => v >= 10000 ? `${(v / 10000).toFixed(0)}만` : v.toLocaleString()}
                width={isMobile ? 42 : 58}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 'var(--text-xs)', paddingTop: 12 }}
                formatter={(value) => <span style={{ color: 'var(--text-secondary)' }}>{value}</span>}
              />

              {/* 현재가 기준선 */}
              {lastPrice > 0 && (
                <ReferenceLine y={lastPrice} stroke="var(--text-tertiary)" strokeDasharray="4 4" opacity={0.4} />
              )}

              {/* 종가 */}
              <Line
                type="monotone" dataKey="price" name="종가"
                stroke="var(--text-primary)" strokeWidth={2}
                dot={false} activeDot={{ r: 4, fill: 'var(--text-primary)' }}
              />

              {/* MA 라인 */}
              {MA_OPTIONS.map(ma => showMA[ma.key] && (
                <Line
                  key={ma.key}
                  type="monotone" dataKey={ma.key} name={ma.label}
                  stroke={ma.color} strokeWidth={1.5}
                  dot={false} activeDot={{ r: 3 }}
                  connectNulls={false}
                  opacity={0.85}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* MA 현재값 요약 */}
      {!loading && chartData.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          {MA_OPTIONS.map(ma => {
            const last = [...chartData].reverse().find(d => d[ma.key as keyof ChartPoint] != null);
            const val = last ? last[ma.key as keyof ChartPoint] as number : null;
            const diff = val && lastPrice ? ((lastPrice - val) / val * 100) : null;
            return (
              <div key={ma.key} style={{
                background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 14px',
                opacity: showMA[ma.key] ? 1 : 0.4,
                border: `1px solid ${showMA[ma.key] ? `color-mix(in srgb, ${ma.color} 30%, transparent)` : 'transparent'}`,
              }}>
                <div style={{ fontSize: 'var(--text-xs)', color: ma.color, fontWeight: 700, marginBottom: 2 }}>{ma.label} ({ma.period}일)</div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {val ? val.toLocaleString('ko-KR') + '원' : '—'}
                </div>
                {diff != null && (
                  <div style={{ fontSize: 'var(--text-xs)', color: diff >= 0 ? 'var(--color-profit)' : 'var(--color-loss)', marginTop: 2 }}>
                    현재가 {diff >= 0 ? '+' : ''}{diff.toFixed(1)}%
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
