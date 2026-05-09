import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useAppContext } from '../App';
import { MIcon } from './MIcon';
import { calcMA } from '../utils/calcUtils';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://asset-dashboard-api.jilliankim200.workers.dev';

interface ChartPoint {
  date: string;
  price: number;
  ma5: number | null;
  ma20: number | null;
  ma60: number | null;
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

// 기간 선택 시 자동 적용되는 MA 프리셋
const MA_PRESETS: Record<number, Record<string, boolean>> = {
  30:  { ma5: true,  ma20: false, ma60: false },
  90:  { ma5: false, ma20: true,  ma60: false },
  180: { ma5: false, ma20: true,  ma60: true  },
};

// 가이드 모달 조합 목록 (컴포넌트 밖 상수 — 렌더마다 재생성 방지)
const GUIDE_COMBOS = [
  {
    title: '3개월 + MA20',
    tag: '기본 추천',
    tagColor: 'var(--color-profit)',
    goal: '지금 추세 파악',
    desc: '상승 중인지, 횡보인지, 하락인지 가장 빠르게 파악할 수 있습니다. 현재가가 MA20 위에 있으면 상승 추세, 아래면 하락 추세. 최적 가이드의 매수·매도 신호도 이 조합을 기준으로 계산됩니다.',
  },
  {
    title: '6개월 + MA20 + MA60',
    tag: '크로스 확인',
    tagColor: 'var(--accent-blue)',
    goal: '중기 방향 전환 포착',
    desc: 'MA20이 MA60을 위로 뚫고 올라가면 골든크로스 → 매수 신호. 아래로 꺾이면 데드크로스 → 매도 신호. MA값은 어느 기간을 선택해도 항상 완성된 거래일 기준으로 계산됩니다.',
  },
  {
    title: '3개월 + MA5 + MA20',
    tag: '단기 전환',
    tagColor: 'var(--color-warning)',
    goal: '단기 방향 전환 포착',
    desc: 'MA5(5일선)가 MA20을 위로 뚫으면 단기 반등 시작 신호, 아래로 꺾이면 단기 조정 신호. MA5는 잡음이 많으므로 MA20과 교차점만 의미 있게 읽으세요.',
  },
  {
    title: '1개월 + MA5',
    tag: '변동성 확인',
    tagColor: 'var(--text-tertiary)',
    goal: '단기 출렁임 파악',
    desc: '지금 이 종목이 얼마나 빠르게 움직이는지 확인할 때. 매수·매도 판단보다는 변동성 체감용. MA20·MA60은 화면 밖 데이터까지 포함해 계산하므로 1개월 선택 시에도 정확한 값이 표시됩니다.',
  },
];

// 상태별 AI 의견 데이터
const AI_OPINIONS: Record<string, {
  color: string;
  question: string;
  holding: { condition: string; action: string }[];
  entry: { condition: string; action: string }[];
  quant: string[];
  conclusion: string;
}> = {
  '상승 추세': {
    color: 'var(--color-profit)',
    question: '이 상승이 얼마나 남았는가?',
    holding: [
      { condition: '60일 위치 < 70%', action: '보유 유지. MA20이 지지선. MA20 이탈 시 재검토.' },
      { condition: '60일 위치 ≥ 80%', action: '고점 근처. 분할 익절 고려. 전량 매도는 서두르지 않음.' },
    ],
    entry: [
      { condition: '60일 위치 < 60%', action: '상승 추세 초입. 분할 진입 가능. 손절: MA60 이탈.' },
      { condition: '60일 위치 ≥ 80%', action: '고점 매수 위험. 5~10% 조정 후 MA20 근처에서 진입 대기.' },
    ],
    quant: [
      'RSI > 70 → 단기 과매수. 조정 가능성 존재.',
      '거래량 증가 동반 상승 → 신뢰도 높음.',
      '거래량 감소 속 상승 → 상승 피로. 주의.',
    ],
    conclusion: '상승 중에는 매도를 보류하는 구간. 추세가 꺾이기 전까지는 보유가 원칙. 단, 고점 근처(60일 80% 이상)라면 분할 익절로 리스크 관리.',
  },
  '추세 꺾임': {
    color: 'var(--color-warning)',
    question: '일시적 조정인가, 추세 전환의 시작인가?',
    holding: [
      { condition: 'MA20 이격 -1~3% 이내', action: '관망. 정상 조정 범위.' },
      { condition: 'MA20 이격 -5% 이상', action: '단기 약세 심화. 분할 축소 검토.' },
      { condition: '거래량 감소 속 하락', action: '매도 압력 낮음. 반등 가능성 높음. 보유 유지.' },
      { condition: '거래량 증가 속 하락', action: '실제 매도 우위. 경계 필요.' },
    ],
    entry: [
      { condition: 'MA20 재돌파 확인 후', action: '진입. Pullback-to-MA20 패턴. 손절: MA60 이탈.' },
      { condition: 'MA20 돌파 전 선진입', action: '추가 하락 리스크 있음. 분할의 절반만 먼저.' },
    ],
    quant: [
      'RSI < 40 → 단기 과매도. 반등 신뢰도 보완.',
      '60일 위치 < 50% → 아직 범위 중간. 손절 서두르지 않아도 됨.',
      'MA20 회복 실패 반복 → MA60 이탈 전 선제 축소.',
    ],
    conclusion: '즉각 매도 신호가 아님. 골든크로스(MA20 > MA60)가 유지되는 동안 "추세 내 조정"으로 보고 MA20 회복 여부를 관망. 회복 실패 시 MA60 이탈 전 축소.',
  },
  '추세 붕괴': {
    color: 'var(--color-loss)',
    question: '지금 버티는 게 맞는가, 정리하는 게 맞는가?',
    holding: [
      { condition: '수익 중인 종목', action: '반등 시 MA20 근처(저항)에서 분할 정리. 추가 하락 리스크가 큼.' },
      { condition: '손실 중인 종목', action: '손절 기준 재검토. 추가 하락 가능성 vs 회복 가능성 냉정하게 판단.' },
    ],
    entry: [
      { condition: '진입 관심 중', action: '진입 자제. 바닥이 어디인지 아직 모름.' },
      { condition: '반드시 진입해야 한다면', action: 'MA20 돌파 + 거래량 확인 후 소량만. 손절: MA60 재이탈.' },
    ],
    quant: [
      '반등 시 MA60이 저항선. 돌파 여부가 추세 전환 확인 포인트.',
      '거래량 급증 + MA20 돌파 동시 → 추세 전환 신호.',
      '거래량 없는 반등 → 기술적 반등. 지속성 낮음.',
    ],
    conclusion: '구조적 약세 구간. 최적 가이드 필터 ON 기준 전량 매도 조건. 반등을 이용한 분할 정리가 원칙. 섣불리 저점 매수하면 손실 확대 위험.',
  },
  '반등 시도': {
    color: 'var(--accent-blue)',
    question: '이 반등이 추세 전환인가, 일시적 기술적 반등인가?',
    holding: [
      { condition: 'MA60 돌파 성공 시', action: '추세 전환 가능성. 보유 유지 + 추가 확인.' },
      { condition: 'MA60 저항으로 눌릴 시', action: '기술적 반등 가능성 높음. 부분 익절로 리스크 관리.' },
    ],
    entry: [
      { condition: 'MA60 돌파 + 거래량 확인 후', action: '진입. 골든크로스(MA20 > MA60) 형성까지 대기하면 더 안전.' },
      { condition: 'MA60 돌파 전 선진입', action: '리스크 높음. 데드크로스 유지 중. 소량만.' },
    ],
    quant: [
      '거래량 동반 여부가 핵심. 거래량 없는 반등은 신뢰도 낮음.',
      'MA20과 MA60의 간격이 좁아지는지 확인 → 골든크로스 임박 신호.',
      'RSI 50 돌파 여부 → 모멘텀 전환 확인.',
    ],
    conclusion: '섣불리 "추세 전환"으로 단정 금물. MA60 돌파 + 거래량 확인이 완료될 때까지 관망. 추세 전환 확인 전 진입은 소량 분할로 제한.',
  },
};

// AI 의견 팝업 모달
function AiOpinionModal({
  status, stockName, onClose,
}: {
  status: { mainLabel: string; mainColor: string; range60: number | null };
  stockName: string;
  onClose: () => void;
}) {
  const opinion = AI_OPINIONS[status.mainLabel];
  if (!opinion) return null;

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-tertiary)',
      letterSpacing: '0.05em', marginBottom: 6 }}>{children}</div>
  );

  const rows = (items: { condition: string; action: string }[]) => items.map((item, i) => (
    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8,
      padding: '7px 10px', borderRadius: 7,
      background: i % 2 === 0 ? 'var(--bg-tertiary)' : 'transparent' }}>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{item.condition}</div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.action}</div>
    </div>
  ));

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-elevated)', borderRadius: 16,
        border: '1px solid var(--border-primary)', width: '100%', maxWidth: 540,
        maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 40px rgba(0,0,0,0.35)' }}>

        {/* 헤더 */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 800, color: opinion.color,
              background: `color-mix(in srgb, ${opinion.color} 15%, transparent)`,
              borderRadius: 6, padding: '2px 9px' }}>{status.mainLabel}</span>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{stockName}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-tertiary)', fontSize: 'var(--text-lg)', lineHeight: 1, padding: '2px 4px' }}>✕</button>
        </div>

        {/* 핵심 질문 */}
        <div style={{ padding: '12px 18px 10px', borderBottom: '1px solid var(--border-secondary)',
          background: `color-mix(in srgb, ${opinion.color} 7%, var(--bg-secondary))`, flexShrink: 0 }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>핵심 판단 질문</div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: opinion.color }}>
            {opinion.question}
          </div>
        </div>

        {/* 본문 */}
        <div style={{ overflowY: 'auto', padding: '14px 18px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* 보유 중 대응 */}
          <div>
            <SectionTitle>보유 중일 때</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {rows(opinion.holding)}
            </div>
          </div>

          {/* 신규 진입 */}
          <div>
            <SectionTitle>신규 진입 검토</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {rows(opinion.entry)}
            </div>
          </div>

          {/* 퀀트 체크포인트 */}
          <div>
            <SectionTitle>퀀트 체크포인트</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {opinion.quant.map((q, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: opinion.color, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>▸</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.65 }}>{q}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 결론 */}
          <div style={{ borderRadius: 10, padding: '10px 14px',
            background: `color-mix(in srgb, ${opinion.color} 10%, var(--bg-secondary))`,
            border: `1px solid color-mix(in srgb, ${opinion.color} 25%, transparent)` }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: opinion.color, marginBottom: 5 }}>결론</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{opinion.conclusion}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

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

        {/* 조합 목록 + 현재 상태 */}
        <div style={{ overflowY: 'auto', padding: '12px 18px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {GUIDE_COMBOS.map(c => (
            <div key={c.title} style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '12px 14px',
              border: `1px solid color-mix(in srgb, ${c.tagColor} 20%, var(--border-secondary))` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{c.title}</span>
                <span style={{ fontSize: 'var(--text-xs)', padding: '1px 7px', borderRadius: 5, fontWeight: 600,
                  background: `color-mix(in srgb, ${c.tagColor} 15%, transparent)`, color: c.tagColor }}>
                  {c.tag}
                </span>
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: c.tagColor, fontWeight: 600, marginBottom: 5 }}>→ {c.goal}</div>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.75 }}>{c.desc}</p>
            </div>
          ))}

          {/* 현재 상태 판단 기준 */}
          <div style={{ borderTop: '1px solid var(--border-secondary)', paddingTop: 12, marginTop: 2 }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
              현재 상태 판단 기준
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                {
                  label: '상승 추세',
                  color: 'var(--color-profit)',
                  condition: '현재가 > MA20 AND MA20 > MA60',
                  desc: '단기·중기 모두 상승 중. 최적 가이드에서 매도를 보류하는 조건 — 주가가 MA20 위에 있으면 다른 조건과 무관하게 홀딩.',
                },
                {
                  label: '추세 꺾임',
                  color: 'var(--color-warning)',
                  condition: '현재가 < MA20, MA20 > MA60',
                  desc: '단기 추세가 하락 전환됐으나 중기 구조(골든크로스)는 유지. 최적 가이드의 "추세 꺾임" 신호와 동일.',
                },
                {
                  label: '추세 붕괴',
                  color: 'var(--color-loss)',
                  condition: '현재가 < MA20 AND MA20 < MA60',
                  desc: '단기·중기 모두 하락 중. 최적 가이드의 필터 ON 매도 조건 (MA20 < MA60 → 전량 매도).',
                },
                {
                  label: '반등 시도',
                  color: 'var(--accent-blue)',
                  condition: '현재가 > MA20, MA20 < MA60',
                  desc: '중기 구조(데드크로스)는 약세지만 단기적으로 MA20을 회복한 상태. 추세 전환 여부를 관망.',
                },
              ].map(row => (
                <div key={row.label} style={{
                  display: 'flex', flexDirection: 'column', gap: 3,
                  background: 'var(--bg-secondary)', borderRadius: 10, padding: '9px 12px',
                  border: `1px solid color-mix(in srgb, ${row.color} 20%, var(--border-secondary))`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 800, color: row.color,
                      background: `color-mix(in srgb, ${row.color} 15%, transparent)`,
                      borderRadius: 5, padding: '1px 7px' }}>{row.label}</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{row.condition}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{row.desc}</p>
                </div>
              ))}
            </div>
          </div>
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
  const [showAiOpinion, setShowAiOpinion] = useState(false);
  const [fromPage, setFromPage] = useState<string | null>(null);
  const [fromTicker, setFromTicker] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState('');
  const fromTickerApplied = useRef(false);

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

  const isCustomTicker = selectedTicker && !allHoldings.find(h => h.ticker === selectedTicker);

  // sessionStorage(같은 탭) 또는 localStorage(새 탭) 진입 컨텍스트 읽기
  useEffect(() => {
    const lsTicker = localStorage.getItem('chart_new_tab_ticker');
    if (lsTicker) {
      localStorage.removeItem('chart_new_tab_ticker');
      setFromTicker(lsTicker);
      setDays(90);
      return;
    }
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
  // fromTickerApplied ref로 allHoldings 갱신 시 재실행 방지
  useEffect(() => {
    if (allHoldings.length === 0) return;
    if (fromTicker && !fromTickerApplied.current) {
      fromTickerApplied.current = true;
      const target = allHoldings.find(h => h.ticker === fromTicker);
      if (target) {
        setSelectedTicker(target.ticker);
        setSelectedName(target.name);
      } else {
        // 보유 종목 목록에 없는 커스텀 티커도 그대로 로드
        setSelectedTicker(fromTicker);
        setSelectedName(fromTicker);
      }
      setDays(90);
      setShowMA({ ma5: false, ma20: true, ma60: false });
    } else if (!fromTicker && !selectedTicker) {
      setSelectedTicker(allHoldings[0].ticker);
      setSelectedName(allHoldings[0].name);
    }
  }, [allHoldings, fromTicker]);

  // 차트 데이터 fetch
  // - 거래일 기준: days + 65 조회 (MA60 계산용 60 거래일 + 5일 여유)
  // - AbortController로 종목/기간 빠른 전환 시 이전 응답 무시
  useEffect(() => {
    if (!selectedTicker) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetch(`${WORKER_URL}/stock-chart/${selectedTicker}?days=${days + 65}`, { signal: controller.signal })
      .then(r => r.json())
      .then((data: { date: string; price: number }[]) => {
        if (!Array.isArray(data) || data.length === 0) throw new Error('no data');
        setRawData(data);
        setLoading(false);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setError('데이터를 불러올 수 없습니다.');
        setLoading(false);
      });
    return () => controller.abort();
  }, [selectedTicker, days]);

  // MA 계산 — 전체 rawData 기준으로 MA 계산 후, 표시 기간(days)만큼 잘라서 반환
  // 이렇게 하면 1개월 선택 시에도 MA60이 올바르게 계산됨
  const chartData: ChartPoint[] = useMemo(() => {
    if (rawData.length === 0) return [];
    const prices = rawData.map(d => d.price);
    const ma5  = calcMA(prices, 5);
    const ma20 = calcMA(prices, 20);
    const ma60 = calcMA(prices, 60);
    const all = rawData.map((d, i) => ({
      date: d.date.slice(5), // MM-DD
      price: d.price,
      ma5:  ma5[i],
      ma20: ma20[i],
      ma60: ma60[i],
    }));
    return all.slice(-days);
  }, [rawData, days]);

  // 현재가 / 변동률
  const lastPrice = rawData[rawData.length - 1]?.price ?? 0;
  const prevPrice = rawData[rawData.length - 2]?.price ?? lastPrice;
  const changeRate = prevPrice > 0 ? ((lastPrice - prevPrice) / prevPrice) * 100 : 0;
  const changeColor = changeRate >= 0 ? 'var(--color-profit)' : 'var(--color-loss)';

  // Y축 범위 (약간 여유)
  const allPrices = chartData.flatMap(d => [d.price, d.ma5, d.ma20, d.ma60].filter(v => v != null) as number[]);
  const yMin = allPrices.length > 0 ? Math.floor(Math.min(...allPrices) * 0.98) : 0;
  const yMax = allPrices.length > 0 ? Math.ceil(Math.max(...allPrices) * 1.02) : 100;

  function handleCustomSearch() {
    const t = customInput.trim().toUpperCase();
    if (!/^[0-9A-Z]{4,6}$/.test(t)) return;
    setSelectedTicker(t);
    setSelectedName(t);
    setCustomInput('');
  }

  const p = isMobile ? '16px 12px' : '24px';

  // X축 라벨 간격 (데이터 많으면 듬성듬성)
  const xInterval = chartData.length > 60 ? Math.floor(chartData.length / 8) : Math.floor(chartData.length / 6);

  // 현재 MA 값
  const currentMa20 = useMemo(
    () => [...chartData].reverse().find(d => d.ma20 != null)?.ma20 ?? null,
    [chartData]
  );
  const currentMa60 = useMemo(
    () => [...chartData].reverse().find(d => d.ma60 != null)?.ma60 ?? null,
    [chartData]
  );

  // 추세 상태 신호
  const statusSignals = useMemo(() => {
    if (!currentMa20 || !currentMa60 || !lastPrice) return null;
    const aboveMa20 = lastPrice > currentMa20;
    const ma20AboveMa60 = currentMa20 > currentMa60;
    let mainLabel: string, mainColor: string;
    if (aboveMa20 && ma20AboveMa60)        { mainLabel = '상승 추세'; mainColor = 'var(--color-profit)'; }
    else if (!aboveMa20 && !ma20AboveMa60) { mainLabel = '추세 붕괴'; mainColor = 'var(--color-loss)'; }
    else if (!aboveMa20 && ma20AboveMa60)  { mainLabel = '추세 꺾임'; mainColor = 'var(--color-warning)'; }
    else                                   { mainLabel = '반등 시도'; mainColor = 'var(--accent-blue)'; }
    const prices = rawData.slice(-60).map(d => d.price).filter(p => p > 0);
    const high60 = prices.length > 0 ? Math.max(...prices) : 0;
    const low60  = prices.length > 0 ? Math.min(...prices) : 0;
    const range60 = high60 > low60 ? (lastPrice - low60) / (high60 - low60) : null;
    return { mainLabel, mainColor, aboveMa20, ma20AboveMa60, range60 };
  }, [currentMa20, currentMa60, lastPrice, rawData]);

  return (
    <div style={{ padding: p, maxWidth: 960, margin: '0 auto' }}>
      {showGuide && <PeriodGuideModal onClose={() => setShowGuide(false)} />}
      {showAiOpinion && statusSignals && (
        <AiOpinionModal
          status={statusSignals}
          stockName={selectedName || selectedTicker}
          onClose={() => setShowAiOpinion(false)}
        />
      )}

      {/* 헤더 */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>차트</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>보유 종목 또는 티커를 직접 입력해 주가와 이동평균선을 확인합니다.</div>
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
          value={isCustomTicker ? '' : selectedTicker}
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
          {isCustomTicker && <option value="">— 보유 종목 선택 —</option>}
          {allHoldings.map(h => (
            <option key={h.ticker} value={h.ticker}>
              {h.name} ({h.ticker})
            </option>
          ))}
        </select>

        {/* 티커 직접 입력 */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            value={customInput}
            onChange={e => setCustomInput(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter') handleCustomSearch(); }}
            placeholder="티커 직접 입력"
            maxLength={6}
            style={{
              background: 'var(--bg-secondary)', color: 'var(--text-primary)',
              border: '1px solid var(--border-primary)', borderRadius: 8,
              padding: '7px 12px', fontSize: 'var(--text-sm)', width: 130,
              outline: 'none',
            }}
          />
          <button
            onClick={handleCustomSearch}
            style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
              borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
              color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
            }}
          >
            <MIcon name="search" size={16} />
          </button>
        </div>

        {/* 기간 선택 */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {PERIOD_OPTIONS.map(opt => (
            <button key={opt.days} onClick={() => {
              setDays(opt.days);
              if (MA_PRESETS[opt.days]) setShowMA(MA_PRESETS[opt.days]);
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

      {/* 차트 + 상태 패널 */}
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: 14,
        padding: isMobile ? '12px 4px' : '20px 16px', minHeight: 340,
        display: 'flex', flexDirection: isMobile ? 'column' : 'row',
        alignItems: 'stretch', gap: 0,
      }}>
        {/* 차트 영역 */}
        <div style={{ flex: 1, minWidth: 0 }}>
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

        {/* 현재 상태 패널 */}
        {!loading && !error && chartData.length > 0 && statusSignals && (
          <div style={{
            ...(isMobile
              ? { borderTop: '1px solid var(--border-secondary)', paddingTop: 10, marginTop: 6, display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-start', alignItems: 'center' }
              : { width: 128, flexShrink: 0, borderLeft: '1px solid var(--border-secondary)', paddingLeft: 14, marginLeft: 4, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }
            ),
          }}>
            {/* 제목 (데스크톱) */}
            {!isMobile && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 700, letterSpacing: '0.03em' }}>현재 상태</div>
            )}

            {/* 종합 신호 */}
            <div style={{
              padding: isMobile ? '3px 10px' : '7px 10px',
              borderRadius: 8, textAlign: 'center',
              background: `color-mix(in srgb, ${statusSignals.mainColor} 15%, transparent)`,
              border: `1px solid color-mix(in srgb, ${statusSignals.mainColor} 35%, transparent)`,
              color: statusSignals.mainColor,
              fontSize: isMobile ? 'var(--text-xs)' : 'var(--text-sm)', fontWeight: 800,
            }}>
              {statusSignals.mainLabel}
            </div>

            {/* 현재가 vs MA20 */}
            <div style={{
              padding: isMobile ? '3px 10px' : '6px 10px',
              borderRadius: 8, background: 'var(--bg-tertiary)',
              display: 'flex', flexDirection: 'column', gap: 1,
            }}>
              <div style={{ fontSize: 'var(--text-xs)', color: statusSignals.aboveMa20 ? 'var(--color-profit)' : 'var(--color-loss)', fontWeight: 700 }}>
                {statusSignals.aboveMa20 ? '↑ MA20 위' : '↓ MA20 아래'}
              </div>
              {!isMobile && (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                  {statusSignals.aboveMa20 ? '단기 상승세' : '단기 약세'}
                </div>
              )}
            </div>

            {/* MA20 vs MA60 크로스 */}
            <div style={{
              padding: isMobile ? '3px 10px' : '6px 10px',
              borderRadius: 8, background: 'var(--bg-tertiary)',
              display: 'flex', flexDirection: 'column', gap: 1,
            }}>
              <div style={{ fontSize: 'var(--text-xs)', color: statusSignals.ma20AboveMa60 ? 'var(--color-profit)' : 'var(--color-warning)', fontWeight: 700 }}>
                {statusSignals.ma20AboveMa60 ? '골든크로스' : '데드크로스'}
              </div>
              {!isMobile && (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                  {statusSignals.ma20AboveMa60 ? '중기 상승 국면' : '중기 추세 붕괴'}
                </div>
              )}
            </div>

            {/* 60일 범위 위치 */}
            {statusSignals.range60 != null && (
              <div style={{
                padding: isMobile ? '3px 10px' : '6px 10px',
                borderRadius: 8, background: 'var(--bg-tertiary)',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                {!isMobile && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>60일 범위</div>
                )}
                <div style={{ position: 'relative', height: 4, borderRadius: 2, background: 'var(--border-secondary)', minWidth: 60 }}>
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: `${Math.min(100, Math.round(statusSignals.range60 * 100))}%`,
                    borderRadius: 2,
                    background: statusSignals.range60 >= 0.8
                      ? 'var(--color-loss)'
                      : statusSignals.range60 <= 0.2
                        ? 'var(--color-profit)'
                        : 'var(--accent-blue)',
                  }} />
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                  {statusSignals.range60 >= 0.8 ? '고점 근처' : statusSignals.range60 <= 0.2 ? '저점 근처' : `${Math.round(statusSignals.range60 * 100)}%`}
                </div>
              </div>
            )}

            {/* AI 의견 버튼 */}
            {AI_OPINIONS[statusSignals.mainLabel] && (
              <button
                onClick={() => setShowAiOpinion(true)}
                style={{
                  padding: isMobile ? '3px 10px' : '6px 10px',
                  borderRadius: 8, cursor: 'pointer', border: 'none',
                  background: `color-mix(in srgb, ${statusSignals.mainColor} 15%, var(--bg-tertiary))`,
                  color: statusSignals.mainColor,
                  fontSize: 'var(--text-xs)', fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center',
                  width: isMobile ? 'auto' : '100%',
                }}
              >
                <span style={{ fontSize: 11 }}>✦</span> AI 의견
              </button>
            )}
          </div>
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
