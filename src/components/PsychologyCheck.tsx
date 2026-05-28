import { MIcon } from './MIcon';
import { useAppContext } from '../App';

const PRINCIPLES = [
  {
    icon: 'quiz',
    title: '매수 전 질문',
    body: '이유가 명확하지 않으면, 매수는 단지 감정의 반응일 뿐입니다.',
    quotes: [
      '"왜 지금, 왜 이 가격에 사려는가?"',
      '"무엇이 변하거나 틀리면 바로 팔 것인가?"',
    ],
    color: '#3182F6',
    bg: '#EDF3FF',
  },
  {
    icon: 'manage_search',
    title: '반대 근거 찾기',
    body: '확신보다 의심이 투자를 지킵니다.',
    quotes: ['"내 생각보다 논리를 무너뜨릴 데이터는 무엇인가?"'],
    color: '#6366F1',
    bg: '#EEEEFF',
  },
  {
    icon: 'link_off',
    title: '앵커 제거',
    body: '과거의 가격을 잊고, 현재의 가치와 미래의 현금흐름으로 재평가합니다.',
    quotes: ['"본전"이라는 단어를 마음에서 지우는 순간, 비로소 현실이 보입니다.'],
    color: '#FF6B35',
    bg: '#FFF3EE',
  },
  {
    icon: 'block',
    title: 'FOMO 차단',
    body: '남들의 수익보다 나의 원칙이 중요합니다. 목표 투자금과 현금 비율, 산업 비중, 개별 종목 한도를 미리 정하십시오.',
    quotes: ['계획이 있으면, 조급함은 줄어듭니다.'],
    color: '#FF9500',
    bg: '#FFF4E5',
  },
  {
    icon: 'price_check',
    title: '매도 규칙',
    body: '감정이 아니라 근거로 행동하십시오.',
    quotes: [
      '"나는 왜 팔려고 하는가?"',
      '"지금 처음 투자한다면 이 가격에 살까?"',
    ],
    color: '#F04452',
    bg: '#FFF0F1',
  },
  {
    icon: 'gavel',
    title: '원칙 행동',
    body: '시장은 감정을 시험하지만, 원칙은 감정을 다스립니다. 판단과 행동의 기준을 늘 "계획"에 두십시오.',
    quotes: ['결과보다 과정이 더 중요합니다.'],
    color: '#30C85E',
    bg: '#EDFBF2',
  },
  {
    icon: 'psychology',
    title: '소유 감정 억제',
    body: '보유의 이유가 감정이라면, 그것은 투자보다 집착에 가깝습니다. 좋은 기업이 반드시 좋은 투자로 이어지는 것은 아닙니다.',
    quotes: ['"이 주식을 여전히 들고 있을 이유가 있는가?"'],
    color: '#8B5CF6',
    bg: '#F3F0FF',
  },
  {
    icon: 'autorenew',
    title: '손실 대응',
    body: '손실은 피할 수 없습니다. 다만 손실을 대하는 태도는 선택할 수 있습니다. 잃은 자리에서 배울 것을 기록하고, 다음 투자 대상을 찾아두십시오.',
    quotes: ['투자는 후회가 아니라 회복의 기술입니다.'],
    color: '#0EA5E9',
    bg: '#E0F4FF',
  },
];

export function PsychologyCheck() {
  const { isMobile } = useAppContext();

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg-page)' }}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: isMobile ? '20px 14px 40px' : '28px 24px 56px' }}>

        {/* 헤더 */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#3182F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MIcon name="self_improvement" size={20} style={{ color: '#fff' }} />
            </div>
            <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, color: 'var(--text-primary)' }}>
              심리 점검
            </h1>
          </div>
          <div style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', border: '1px solid var(--border-primary)' }}>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 8 }}>
              투자는 마음의 싸움입니다. 심리적 편향을 이겨내려면, 감정이 아닌 원칙으로 스스로를 붙잡아야 합니다.
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              아래의 질문과 행동 원칙은 시장이 흔들릴 때마다 다시 돌아올 기준입니다. 결국 투자를 지켜주는 것은 정보가 아니라, <b style={{ color: 'var(--text-primary)' }}>나 자신</b>입니다.
            </p>
          </div>
        </div>

        {/* 원칙 카드 목록 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {PRINCIPLES.map((p, i) => (
            <div key={p.title} style={{
              background: '#fff',
              borderRadius: 16,
              padding: isMobile ? '16px 16px' : '20px 24px',
              border: '1px solid var(--border-primary)',
            }}>
              {/* 카드 헤더 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: p.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MIcon name={p.icon} size={18} style={{ color: p.color }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: p.color, background: p.bg, padding: '2px 8px', borderRadius: 20 }}>
                    0{i + 1}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{p.title}</span>
                </div>
              </div>

              {/* 본문 */}
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: p.quotes.length ? 12 : 0 }}>
                {p.body}
              </p>

              {/* 핵심 질문 */}
              {p.quotes.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {p.quotes.map(q => (
                    <div key={q} style={{
                      background: p.bg,
                      borderRadius: 10,
                      padding: '10px 14px',
                      fontSize: 13,
                      fontWeight: 600,
                      color: p.color,
                      lineHeight: 1.6,
                    }}>
                      {q}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 출처 */}
        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.8 }}>
            <MIcon name="menu_book" size={14} style={{ verticalAlign: 'middle', marginRight: 4, opacity: 0.5 }} />
            《진보를 위한 주식투자》, 이광수 — 밀리의 서재
          </p>
        </div>

      </div>
    </div>
  );
}
