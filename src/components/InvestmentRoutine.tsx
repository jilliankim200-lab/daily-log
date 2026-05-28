import { useState, useEffect } from 'react';
import { MIcon } from './MIcon';
import { useAppContext } from '../App';

const TABS = [
  { id: 'daily',     label: '매일',  icon: 'today' },
  { id: 'weekly',    label: '매주',  icon: 'date_range' },
  { id: 'monthly',   label: '매월',  icon: 'calendar_month' },
  { id: 'quarterly', label: '매분기', icon: 'event_note' },
  { id: 'yearly',    label: '매년',  icon: 'emoji_events' },
] as const;
type TabId = typeof TABS[number]['id'];

// ── 매일할일 체크리스트 ──
const DAILY_SECTIONS = [
  {
    icon: 'wb_sunny',
    color: '#FF9500',
    bg: '#FFF4E5',
    title: '아침 시황 확인',
    subtitle: '뉴스를 보되, 해석은 천천히. 제목에 휘둘리지 말 것',
    items: [
      '세계 시장 뉴스 가볍게 훑기 (뉴욕 증시 방향)',
      '환율 확인 — 전일 대비 변화폭',
      '미국 10년물 국채 금리 확인',
      '"삼성전자 실적 쇼크" 같은 기사는 실제 공시를 직접 확인',
    ],
  },
  {
    icon: 'trending_up',
    color: '#3182F6',
    bg: '#EDF3FF',
    title: '핵심 지표 — 미 10년물 금리',
    subtitle: '모든 자산 가격이 연결된 시장의 심장박동',
    items: [
      '금리 상승 → 기업 비용 증가 → 주가 하락 압력',
      '금리 하락 → 주식 매력 상승 → 시장 자금 유입',
      '금리 급변동 시 → 시장 흔들림 예상, 섣불리 매매 자제',
    ],
    note: '미 10년물 국채 금리는 전 세계 돈의 기준. "국채 4~5% 받으면 굳이 위험한 주식을?" — 이 심리가 시장을 움직인다.',
  },
  {
    icon: 'bar_chart',
    color: '#6366F1',
    bg: '#EEEEFF',
    title: '주요 기업 주가 체크',
    subtitle: '대표주의 흐름이 오늘 시장의 신호',
    items: [
      'NVDA — AI 시대 온도계, 기술주 흐름의 출발점',
      'AAPL · MSFT · AMZN · GOOGL · TSLA — 빅테크 5총사',
      'JPM (금융/금리 민감도) · WMT (소비 흐름)',
      '삼성전자 · SK하이닉스 — 코스피의 핵심 축',
      '변동폭이 컸던 종목 이유 한 줄 파악',
    ],
  },
  {
    icon: 'edit_note',
    color: '#30C85E',
    bg: '#EDFBF2',
    title: '오늘의 계획 · 마무리 기록',
    subtitle: '짧은 한 줄이 하루를, 하루가 돈을 지킨다',
    items: [
      '오늘의 계획 한 줄 기록 ("오늘은 매수하지 않는다" / "○○ 종목 흐름 관찰")',
      '장 마감 후 — "오늘 잘 참았다" 또는 "감정이 흔들렸다" 기록',
      '실제 매매가 있었다면 이유와 감정 상태 메모',
    ],
  },
];

// ── 날짜별 체크 상태 관리 ──
function todayKey() {
  return `routine_daily_${new Date().toISOString().slice(0, 10)}`;
}
function loadChecked(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(todayKey()) || '[]')); }
  catch { return new Set(); }
}
function saveChecked(s: Set<string>) {
  localStorage.setItem(todayKey(), JSON.stringify([...s]));
}

function DailyTab({ isMobile }: { isMobile: boolean }) {
  const [checked, setChecked] = useState<Set<string>>(loadChecked);

  const toggle = (key: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      saveChecked(next);
      return next;
    });
  };

  const totalItems = DAILY_SECTIONS.reduce((acc, s) => acc + s.items.length, 0);
  const doneCount = checked.size;
  const pct = Math.round((doneCount / totalItems) * 100);

  return (
    <div>
      {/* 진행률 */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', marginBottom: 16, border: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>오늘의 루틴</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? '#30C85E' : 'var(--text-tertiary)' }}>{doneCount}/{totalItems}</span>
          </div>
          <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#30C85E' : '#3182F6', borderRadius: 99, transition: 'width 0.3s' }} />
          </div>
        </div>
        {pct === 100 && (
          <div style={{ fontSize: 13, fontWeight: 700, color: '#30C85E', display: 'flex', alignItems: 'center', gap: 4 }}>
            <MIcon name="check_circle" size={18} style={{ color: '#30C85E' }} /> 완료
          </div>
        )}
      </div>

      {/* 섹션별 카드 */}
      {DAILY_SECTIONS.map((section, si) => (
        <div key={si} style={{ background: '#fff', borderRadius: 16, padding: isMobile ? '16px' : '20px 24px', marginBottom: 12, border: '1px solid var(--border-primary)' }}>
          {/* 섹션 헤더 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: section.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MIcon name={section.icon} size={17} style={{ color: section.color }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{section.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{section.subtitle}</div>
            </div>
          </div>

          {/* 인사이트 박스 */}
          {'note' in section && section.note && (
            <div style={{ background: section.bg, borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 12, color: section.color, lineHeight: 1.7, fontWeight: 500 }}>
              {section.note}
            </div>
          )}

          {/* 체크 항목 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {section.items.map((item, ii) => {
              const key = `${si}-${ii}`;
              const done = checked.has(key);
              return (
                <button key={ii} onClick={() => toggle(key)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 10px', borderRadius: 10, border: 'none', background: done ? section.bg : 'var(--bg-secondary)', cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit', transition: 'background 0.15s' }}>
                  <div style={{ width: 18, height: 18, borderRadius: 5, border: done ? 'none' : `1.5px solid ${section.color}55`, background: done ? section.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, transition: 'all 0.15s' }}>
                    {done && <MIcon name="check" size={13} style={{ color: '#fff' }} />}
                  </div>
                  <span style={{ fontSize: 13, color: done ? section.color : 'var(--text-primary)', fontWeight: done ? 600 : 400, textDecoration: done ? 'line-through' : 'none', lineHeight: 1.5, opacity: done ? 0.75 : 1 }}>
                    {item}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 8 }}>
        체크 항목은 매일 자정에 초기화됩니다
      </p>
    </div>
  );
}

// ── 매주할일 ──
const WEEKLY_SECTIONS = [
  {
    icon: 'account_balance_wallet',
    color: '#3182F6',
    bg: '#EDF3FF',
    title: '포트폴리오 구조 점검',
    subtitle: '수익률이 아니라 구조를 보십시오 — 우연인가, 전략의 힘인가',
    items: [
      '이번 주 수익률 확인 → "우연인가, 구조의 힘인가?" 판단',
      '보유 종목별 비중이 계획 대비 과도하게 쏠린 곳은 없는가',
      '현금 비중이 목표 범위 안에 있는가',
    ],
  },
  {
    icon: 'edit_note',
    color: '#6366F1',
    bg: '#EEEEFF',
    title: '매매 이유 기록',
    subtitle: '이유가 반복되면 전략이 되고, 전략이 쌓이면 수익률을 지킨다',
    items: [
      '이번 주 매수한 종목 — 이유 한 줄 기록',
      '이번 주 매도한 종목 — 이유 한 줄 기록',
      '잘한 판단 vs 감정에 휘둘린 판단 구분',
    ],
    note: '예) "삼성전자 매도 후 주가 상승 → 매도 타이밍 조급함" / "현금 유지 → 금리 불확실성 대응 성공"',
  },
  {
    icon: 'lightbulb',
    color: '#FF9500',
    bg: '#FFF4E5',
    title: '다음 주 계획',
    subtitle: '지난 주 이유가 다음 주 전략이 된다',
    items: [
      '반복된 실수 패턴이 있는가 → 다음 주 주의사항 한 줄',
      '관심 종목 중 다음 주 점검할 항목 정리',
      '"이유 없이 사고 싶다"는 충동이 있다면 → 1주 대기',
    ],
  },
];

function weekKey() {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `routine_weekly_${d.getFullYear()}_${week}`;
}

function WeeklyTab({ isMobile }: { isMobile: boolean }) {
  const [checked, setChecked] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(weekKey()) || '[]')); } catch { return new Set(); }
  });

  const toggle = (key: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      localStorage.setItem(weekKey(), JSON.stringify([...next]));
      return next;
    });
  };

  const totalItems = WEEKLY_SECTIONS.reduce((acc, s) => acc + s.items.length, 0);
  const pct = Math.round((checked.size / totalItems) * 100);

  return (
    <div>
      <div style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', marginBottom: 16, border: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>이번 주 루틴</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? '#30C85E' : 'var(--text-tertiary)' }}>{checked.size}/{totalItems}</span>
          </div>
          <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#30C85E' : '#6366F1', borderRadius: 99, transition: 'width 0.3s' }} />
          </div>
        </div>
      </div>

      {WEEKLY_SECTIONS.map((section, si) => (
        <div key={si} style={{ background: '#fff', borderRadius: 16, padding: isMobile ? '16px' : '20px 24px', marginBottom: 12, border: '1px solid var(--border-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: section.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MIcon name={section.icon} size={17} style={{ color: section.color }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{section.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{section.subtitle}</div>
            </div>
          </div>
          {'note' in section && section.note && (
            <div style={{ background: section.bg, borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 12, color: section.color, lineHeight: 1.7, fontWeight: 500 }}>
              {section.note}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {section.items.map((item, ii) => {
              const key = `${si}-${ii}`;
              const done = checked.has(key);
              return (
                <button key={ii} onClick={() => toggle(key)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 10px', borderRadius: 10, border: 'none', background: done ? section.bg : 'var(--bg-secondary)', cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit', transition: 'background 0.15s' }}>
                  <div style={{ width: 18, height: 18, borderRadius: 5, border: done ? 'none' : `1.5px solid ${section.color}55`, background: done ? section.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    {done && <MIcon name="check" size={13} style={{ color: '#fff' }} />}
                  </div>
                  <span style={{ fontSize: 13, color: done ? section.color : 'var(--text-primary)', fontWeight: done ? 600 : 400, textDecoration: done ? 'line-through' : 'none', lineHeight: 1.5, opacity: done ? 0.75 : 1 }}>
                    {item}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 8 }}>체크 항목은 매주 월요일에 초기화됩니다</p>
    </div>
  );
}

// ── 매월할일 ──
const MONTHLY_SECTIONS = [
  {
    icon: 'public',
    color: '#3182F6',
    bg: '#EDF3FF',
    title: '거시 지표 월간 변화 확인',
    subtitle: '숫자 하나가 아니라, 방향과 속도를 읽는 것이 핵심',
    items: [
      '미 10년물 금리 — 전월 대비 방향과 변화폭 확인',
      '원/달러 환율 — 외국인 자금 흐름의 신호',
      '코스피 흐름 — 단순 반등인가, 새로운 추세의 시작인가',
    ],
    note: '예) 금리 3.8%→4.3% 상승이면 단순 수치가 아닌 기류 변화. 환율 1,350→1,400이면 외국인 이탈 신호.',
  },
  {
    icon: 'account_tree',
    color: '#6366F1',
    bg: '#EEEEFF',
    title: '섹터·자산 흐름 파악',
    subtitle: '어떤 종목이 올랐는가보다 어떤 흐름이 만들어지는가',
    items: [
      '강한 섹터 / 약한 섹터 확인 → 시장 관심 이동 방향 파악',
      '성장주 vs 가치주 흐름 — 어디로 돈이 움직이는가',
      '내 포트폴리오가 이 흐름과 맞닿아 있는가',
    ],
  },
  {
    icon: 'tune',
    color: '#FF9500',
    bg: '#FFF4E5',
    title: '포트폴리오 비중 점검',
    subtitle: '한 달 전 세운 구성이 지금도 유효한가',
    items: [
      '주식 / 채권 / 현금 비율이 목표 대비 어긋난 곳은 없는가',
      'ETF 비중 조정이 필요한가',
      '특정 섹터 과집중 여부 확인',
    ],
  },
  {
    icon: 'self_improvement',
    color: '#30C85E',
    bg: '#EDFBF2',
    title: '원칙 준수 자기 점검',
    subtitle: '투자는 결국 자신과의 대화입니다',
    items: [
      '"하락장에서도 분할 매수 원칙을 지켰는가?"',
      '"단기 뉴스에 흔들려 감정적으로 매도하지 않았는가?"',
      '"싼 종목이 아니라 가치 있는 종목을 샀는가?"',
    ],
  },
];

function monthKey() {
  const d = new Date();
  return `routine_monthly_${d.getFullYear()}_${d.getMonth() + 1}`;
}

function MonthlyTab({ isMobile }: { isMobile: boolean }) {
  const [checked, setChecked] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(monthKey()) || '[]')); } catch { return new Set(); }
  });

  const toggle = (key: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      localStorage.setItem(monthKey(), JSON.stringify([...next]));
      return next;
    });
  };

  const totalItems = MONTHLY_SECTIONS.reduce((acc, s) => acc + s.items.length, 0);
  const pct = Math.round((checked.size / totalItems) * 100);

  return (
    <div>
      <div style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', marginBottom: 16, border: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>이번 달 루틴</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? '#30C85E' : 'var(--text-tertiary)' }}>{checked.size}/{totalItems}</span>
          </div>
          <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#30C85E' : '#FF9500', borderRadius: 99, transition: 'width 0.3s' }} />
          </div>
        </div>
      </div>

      {MONTHLY_SECTIONS.map((section, si) => (
        <div key={si} style={{ background: '#fff', borderRadius: 16, padding: isMobile ? '16px' : '20px 24px', marginBottom: 12, border: '1px solid var(--border-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: section.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MIcon name={section.icon} size={17} style={{ color: section.color }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{section.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{section.subtitle}</div>
            </div>
          </div>
          {'note' in section && section.note && (
            <div style={{ background: section.bg, borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 12, color: section.color, lineHeight: 1.7, fontWeight: 500 }}>
              {section.note}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {section.items.map((item, ii) => {
              const key = `${si}-${ii}`;
              const done = checked.has(key);
              return (
                <button key={ii} onClick={() => toggle(key)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 10px', borderRadius: 10, border: 'none', background: done ? section.bg : 'var(--bg-secondary)', cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit', transition: 'background 0.15s' }}>
                  <div style={{ width: 18, height: 18, borderRadius: 5, border: done ? 'none' : `1.5px solid ${section.color}55`, background: done ? section.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    {done && <MIcon name="check" size={13} style={{ color: '#fff' }} />}
                  </div>
                  <span style={{ fontSize: 13, color: done ? section.color : 'var(--text-primary)', fontWeight: done ? 600 : 400, textDecoration: done ? 'line-through' : 'none', lineHeight: 1.5, opacity: done ? 0.75 : 1 }}>
                    {item}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 8 }}>체크 항목은 매월 1일에 초기화됩니다</p>
    </div>
  );
}

// ── 매분기할일 ──
const QUARTERLY_SECTIONS = [
  {
    icon: 'trending_up',
    color: '#3182F6',
    bg: '#EDF3FF',
    title: '매출 — 시장 지배력과 성장성',
    subtitle: '증가 이유까지 파악해야 진짜 점검',
    items: [
      '전분기 대비 매출 방향 확인 (증가 / 감소)',
      '매출 변화 이유 한 줄 기록 (신제품 출시 / 환율 효과 / 가격 상승 등)',
      '시장점유율이 늘었는가, 단순 가격 상승인가 구분',
    ],
  },
  {
    icon: 'fitness_center',
    color: '#6366F1',
    bg: '#EEEEFF',
    title: '영업이익 — 기업의 체력',
    subtitle: '매출이 늘었는데 이익이 줄었다면 비용 구조를 확인',
    items: [
      '영업이익률 전분기 대비 방향 확인',
      '이익 감소 시 → 원자재 / 판관비 / 인건비 중 원인 파악',
      '손익계산서 직접 확인 (IR 자료 or 공시)',
    ],
    note: '매출 ↑ + 영업이익 ↓ = 비용 문제. 매출 ↓ + 영업이익 ↑ = 구조 개선.',
  },
  {
    icon: 'water_drop',
    color: '#0EA5E9',
    bg: '#E0F4FF',
    title: 'FCF (잉여현금흐름) — 진짜 돈이 남는가',
    subtitle: '이익이 있어도 현금이 빠지면 기업은 숨이 차다',
    items: [
      'FCF가 플러스인가 마이너스인가 확인',
      'FCF 마이너스 시 → 신규 투자 확대인가, 운영 문제인가 구분',
      '순이익과 FCF의 괴리가 크면 이유 파악',
    ],
    note: '순이익 1,000억 + FCF 마이너스 = 현금이 설비·재고에 묶인 상태.',
  },
  {
    icon: 'percent',
    color: '#30C85E',
    bg: '#EDFBF2',
    title: 'ROE (자기자본이익률) — 자본 효율성',
    subtitle: '내 돈으로 얼마나 잘 버는가',
    items: [
      'ROE 전분기 대비 방향 확인',
      'ROE 지속 하락 시 → 경쟁력 약화 경고 신호',
      '"실적 개선됐는가? 전망이 유지되는가?" 두 질문으로 마무리',
    ],
    note: '이 네 가지(매출 · 영업이익 · FCF · ROE)를 분기마다 기록하면 기업 점검표가 완성된다.',
  },
];

function quarterKey() {
  const d = new Date();
  const q = Math.ceil((d.getMonth() + 1) / 3);
  return `routine_quarterly_${d.getFullYear()}_Q${q}`;
}

function QuarterlyTab({ isMobile }: { isMobile: boolean }) {
  const [checked, setChecked] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(quarterKey()) || '[]')); } catch { return new Set(); }
  });

  const toggle = (key: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      localStorage.setItem(quarterKey(), JSON.stringify([...next]));
      return next;
    });
  };

  const totalItems = QUARTERLY_SECTIONS.reduce((acc, s) => acc + s.items.length, 0);
  const pct = Math.round((checked.size / totalItems) * 100);

  return (
    <div>
      <div style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', marginBottom: 16, border: '1px solid var(--border-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>이번 분기 루틴</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? '#30C85E' : 'var(--text-tertiary)' }}>{checked.size}/{totalItems}</span>
        </div>
        <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#30C85E' : '#0EA5E9', borderRadius: 99, transition: 'width 0.3s' }} />
        </div>
      </div>

      {QUARTERLY_SECTIONS.map((section, si) => (
        <div key={si} style={{ background: '#fff', borderRadius: 16, padding: isMobile ? '16px' : '20px 24px', marginBottom: 12, border: '1px solid var(--border-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: section.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MIcon name={section.icon} size={17} style={{ color: section.color }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{section.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{section.subtitle}</div>
            </div>
          </div>
          {'note' in section && section.note && (
            <div style={{ background: section.bg, borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 12, color: section.color, lineHeight: 1.7, fontWeight: 500 }}>
              {section.note}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {section.items.map((item, ii) => {
              const key = `${si}-${ii}`;
              const done = checked.has(key);
              return (
                <button key={ii} onClick={() => toggle(key)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 10px', borderRadius: 10, border: 'none', background: done ? section.bg : 'var(--bg-secondary)', cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit', transition: 'background 0.15s' }}>
                  <div style={{ width: 18, height: 18, borderRadius: 5, border: done ? 'none' : `1.5px solid ${section.color}55`, background: done ? section.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    {done && <MIcon name="check" size={13} style={{ color: '#fff' }} />}
                  </div>
                  <span style={{ fontSize: 13, color: done ? section.color : 'var(--text-primary)', fontWeight: done ? 600 : 400, textDecoration: done ? 'line-through' : 'none', lineHeight: 1.5, opacity: done ? 0.75 : 1 }}>
                    {item}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 8 }}>체크 항목은 분기마다 초기화됩니다</p>
    </div>
  );
}

// ── 매년할일 ──
const YEARLY_SECTIONS = [
  {
    icon: 'verified_user',
    color: '#3182F6',
    bg: '#EDF3FF',
    title: '원칙 준수 자기평가',
    subtitle: '수익률보다 먼저 올해의 나를 들여다보는 시간',
    items: [
      '"올해 세운 투자 원칙을 실제로 지켰는가?" 솔직하게 점검',
      '급락장에서 원칙대로 매수했는가, 아니면 뉴스에 흔들려 매도했는가',
      '지킨 하루는 신념으로, 흔들린 하루는 교훈으로 기록',
    ],
    note: '"3월 급락장에서 공포를 이기고 매수했는가, 아니면 뉴스에 흔들려 매도 버튼을 눌렀는가?"',
  },
  {
    icon: 'psychology_alt',
    color: '#F04452',
    bg: '#FFF0F1',
    title: '판단을 흔든 요인 기록',
    subtitle: '이 기록은 내년의 실수를 막는 방패입니다',
    items: [
      '친구 추천 / 유튜브 낙관론 / 추격 매수 등 외부 요인에 흔들린 사례 기록',
      '그 순간의 감정(조급함 · 불안 · 탐욕)을 구체적으로 적기',
      '"왜 그 판단을 했는가?" — 감정이 아닌 이유를 역추적',
    ],
  },
  {
    icon: 'trending_up',
    color: '#30C85E',
    bg: '#EDFBF2',
    title: '태도의 성장 점검',
    subtitle: '돈이 아니라 태도의 성장이 진짜 수익률',
    items: [
      '작년 대비 시세 확인 빈도가 줄었는가 (매일→주 1회 등)',
      '손실에 반응하는 방식이 바뀌었는가 (분노→분석→기록)',
      '내년의 루틴·원칙 한 가지 개선사항 기록',
    ],
    note: '수익보다 더 큰 자산은 바로 이 "태도의 변화"입니다. 태도의 변화가 없으면, 다음 해의 수익도 없습니다.',
  },
  {
    icon: 'repeat',
    color: '#8B5CF6',
    bg: '#F3F0FF',
    title: '루틴의 힘 — 꾸준함으로 마무리',
    subtitle: '단조로움이 마음을 단단하게 만든다',
    items: [
      '버핏처럼: 같은 시간 · 같은 원칙 · 같은 방식으로 한 해를 마무리',
      '"시장의 싸움, 정보의 싸움, 자신과의 싸움" — 셋 중 가장 중요한 싸움은?',
      '한 해의 마지막 날, 그래프보다 일기를 먼저 열기',
    ],
    note: '"Process becomes routine." 과정이 습관이 되고, 습관이 결과를 만든다.',
  },
];

function yearKey() {
  return `routine_yearly_${new Date().getFullYear()}`;
}

function YearlyTab({ isMobile }: { isMobile: boolean }) {
  const [checked, setChecked] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(yearKey()) || '[]')); } catch { return new Set(); }
  });

  const toggle = (key: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      localStorage.setItem(yearKey(), JSON.stringify([...next]));
      return next;
    });
  };

  const totalItems = YEARLY_SECTIONS.reduce((acc, s) => acc + s.items.length, 0);
  const pct = Math.round((checked.size / totalItems) * 100);

  return (
    <div>
      <div style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', marginBottom: 16, border: '1px solid var(--border-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>올해 루틴</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? '#30C85E' : 'var(--text-tertiary)' }}>{checked.size}/{totalItems}</span>
        </div>
        <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#30C85E' : '#8B5CF6', borderRadius: 99, transition: 'width 0.3s' }} />
        </div>
      </div>

      {YEARLY_SECTIONS.map((section, si) => (
        <div key={si} style={{ background: '#fff', borderRadius: 16, padding: isMobile ? '16px' : '20px 24px', marginBottom: 12, border: '1px solid var(--border-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: section.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MIcon name={section.icon} size={17} style={{ color: section.color }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{section.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{section.subtitle}</div>
            </div>
          </div>
          {'note' in section && section.note && (
            <div style={{ background: section.bg, borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 12, color: section.color, lineHeight: 1.7, fontWeight: 500 }}>
              {section.note}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {section.items.map((item, ii) => {
              const key = `${si}-${ii}`;
              const done = checked.has(key);
              return (
                <button key={ii} onClick={() => toggle(key)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 10px', borderRadius: 10, border: 'none', background: done ? section.bg : 'var(--bg-secondary)', cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit', transition: 'background 0.15s' }}>
                  <div style={{ width: 18, height: 18, borderRadius: 5, border: done ? 'none' : `1.5px solid ${section.color}55`, background: done ? section.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    {done && <MIcon name="check" size={13} style={{ color: '#fff' }} />}
                  </div>
                  <span style={{ fontSize: 13, color: done ? section.color : 'var(--text-primary)', fontWeight: done ? 600 : 400, textDecoration: done ? 'line-through' : 'none', lineHeight: 1.5, opacity: done ? 0.75 : 1 }}>
                    {item}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 8 }}>체크 항목은 매년 1월 1일에 초기화됩니다</p>
    </div>
  );
}

export function InvestmentRoutine() {
  const { isMobile } = useAppContext();
  const [activeTab, setActiveTab] = useState<TabId>('daily');

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg-page)' }}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: isMobile ? '20px 14px 40px' : '28px 24px 56px' }}>

        {/* 헤더 */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#30C85E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MIcon name="checklist" size={20} style={{ color: '#fff' }} />
            </div>
            <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, color: 'var(--text-primary)' }}>투자 루틴</h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginLeft: 46 }}>원칙을 습관으로 만드는 투자 체크리스트</p>
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 20, border: activeTab === tab.id ? 'none' : '1px solid var(--border-primary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, background: activeTab === tab.id ? '#191F28' : '#fff', color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)', transition: 'all 0.15s' }}>
              <MIcon name={tab.icon} size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        {activeTab === 'daily' && <DailyTab isMobile={isMobile} />}
        {activeTab === 'weekly' && <WeeklyTab isMobile={isMobile} />}
        {activeTab === 'monthly' && <MonthlyTab isMobile={isMobile} />}
        {activeTab === 'quarterly' && <QuarterlyTab isMobile={isMobile} />}
        {activeTab === 'yearly' && <YearlyTab isMobile={isMobile} />}

      </div>
    </div>
  );
}
