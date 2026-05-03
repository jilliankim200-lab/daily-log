import React, { useMemo } from 'react';
import { useAppContext } from '../App';
import { MIcon } from './MIcon';
import type { Account, Holding } from '../types';

type AssetClass = '주식' | '채권' | '커버드콜' | '금' | '기타';
type RiskLevel = '매우높음' | '높음' | '보통' | '낮음';

function classify(name: string): AssetClass {
  if (['커버드콜'].some(k => name.includes(k))) return '커버드콜';
  if (['국채', '채권', '단기채', '액티브', '국공채'].some(k => name.includes(k)) && !name.includes('커버드콜')) return '채권';
  if (['금현물', 'KRX금', '골드'].some(k => name.includes(k))) return '금';
  if (['나스닥', 'S&P', '코스닥', '코스피', '반도체', 'AI', '인도', '배당',
       '고배당', '밸류체인', '미국', '글로벌', '빅테크', '차이나', '휴머노이드',
       '로봇', '포스코', '삼성', '코드'].some(k => name.includes(k))) return '주식';
  return '기타';
}

function hVal(h: Holding, prices: Record<string, number>): number {
  if (h.isFund) return h.amount || 0;
  const p = (h.ticker && prices[h.ticker]) ? prices[h.ticker] : (h.avgPrice || 0);
  return p * (h.quantity || 0);
}

function fmt(n: number): string {
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억`;
  if (n >= 10_000) return `${Math.round(n / 10_000)}만`;
  return n.toLocaleString();
}

function fmtM(n: number): string {
  return `${Math.round(n / 10_000).toLocaleString()}만원`;
}

function getRiskLevel(name: string, ticker: string): RiskLevel {
  const yieldmaxTickers = ['TSLY','NVDY','CONY','MSTY','PLTY','ULTY','AMZY','GOOGY','NFLY'];
  if (yieldmaxTickers.includes(ticker?.toUpperCase())) return '매우높음';
  if (['차이나', '휴머노이드', '로봇', '레버리지'].some(k => name.includes(k))) return '매우높음';
  if (['반도체선물', '빅테크TOP7', '섹터리더', '포스코그룹', 'TIME', '단일'].some(k => name.includes(k))) return '높음';
  if (['나스닥100', 'S&P500', '코스닥150', '코스닥100', '인도Nifty'].some(k => name.includes(k))) return '보통';
  return '낮음';
}

function getRiskColor(level: RiskLevel): string {
  if (level === '매우높음') return 'var(--color-loss)';
  if (level === '높음') return '#f59e0b';
  if (level === '보통') return 'var(--accent-blue)';
  return 'var(--color-profit)';
}

function getSellReason(name: string, ticker: string): string {
  const yieldmaxTickers = ['TSLY','NVDY','CONY','MSTY','PLTY','ULTY'];
  if (yieldmaxTickers.includes(ticker?.toUpperCase())) return '원금 감소형 구조 — 시장 하락기 낙폭 가장 큼';
  if (name.includes('차이나') || name.includes('휴머노이드')) return '중국 테마 지정학 리스크 + 여름 변동성';
  if (name.includes('빅테크TOP7')) return '빅테크 집중 고평가 부담 — 분산 필요';
  if (name.includes('반도체선물') || name.includes('섹터리더')) return '선물 기반 레버리지성 — Sell in May 직격';
  if (name.includes('포스코그룹')) return '철강 업황 부진 + 단일 그룹 집중 리스크';
  if (name.includes('TIME') || name.includes('글로벌AI')) return '중소 운용사 AI 테마 — 유동성 리스크';
  if (name.includes('나스닥100') || name.includes('S&P500')) return '대형 포지션 일부 차익실현 — 전량 매도 아님';
  if (name.includes('코스닥')) return '국내 소형주 변동성 — 여름 거래 감소기';
  if (name.includes('인도Nifty')) return '신흥국 환율·변동성 리스크';
  return '포트폴리오 비중 조정';
}

function getSellAction(name: string, ticker: string, val: number): string {
  const yieldmaxTickers = ['TSLY','NVDY','CONY','MSTY','PLTY','ULTY'];
  if (yieldmaxTickers.includes(ticker?.toUpperCase())) return '전량 매도 → 계좌 내 달러 현금 보유';
  if (name.includes('차이나') || name.includes('휴머노이드')) return '전량 매도 → 단기채 또는 현금';
  if (name.includes('빅테크TOP7') || name.includes('포스코그룹') || name.includes('TIME')) return '전량 매도 → 단기채 이동';
  if (val > 10_000_000) return '30~50% 부분 매도 → 단기채·금 분산';
  return '50% 매도 → 단기채 이동';
}

interface SellCandidate {
  accId: string;
  accAlias: string;
  accType: string;
  owner: string;
  holding: Holding;
  cls: AssetClass;
  val: number;
  risk: RiskLevel;
  reason: string;
  action: string;
  priority: number;
}

export function MonthlyStrategy() {
  const { accounts, prices, isMobile } = useAppContext();

  const candidates = useMemo<SellCandidate[]>(() => {
    const list: SellCandidate[] = [];
    for (const acc of accounts) {
      const alias = acc.alias || acc.institution;
      for (const h of acc.holdings) {
        if (h.isFund) continue;
        const val = hVal(h, prices);
        if (val < 50_000) continue;
        const cls = classify(h.name);
        if (cls === '채권' || cls === '금') continue; // 채권·금은 안전자산 — 유지
        const risk = getRiskLevel(h.name, h.ticker || '');
        if (risk === '낮음') continue;
        const priority = risk === '매우높음' ? 1 : risk === '높음' ? 2 : 3;
        list.push({
          accId: acc.id,
          accAlias: alias,
          accType: acc.accountType,
          owner: acc.ownerName || '',
          holding: h,
          cls,
          val,
          risk,
          reason: getSellReason(h.name, h.ticker || ''),
          action: getSellAction(h.name, h.ticker || '', val),
          priority,
        });
      }
    }
    return list.sort((a, b) => a.priority - b.priority || b.val - a.val);
  }, [accounts, prices]);

  const allocation = useMemo(() => {
    const byClass: Record<AssetClass, number> = { 주식: 0, 채권: 0, 커버드콜: 0, 금: 0, 기타: 0 };
    let total = 0;
    for (const acc of accounts) {
      total += acc.cash || 0;
      for (const h of acc.holdings) {
        const v = hVal(h, prices);
        byClass[classify(h.name)] += v;
        total += v;
      }
    }
    const pct: Record<AssetClass, number> = { 주식: 0, 채권: 0, 커버드콜: 0, 금: 0, 기타: 0 };
    if (total > 0) {
      for (const c of Object.keys(byClass) as AssetClass[]) pct[c] = Math.round(byClass[c] / total * 1000) / 10;
    }
    return { byClass, pct, total };
  }, [accounts, prices]);

  const totalSellVal = candidates.reduce((s, c) => {
    if (c.risk === '매우높음') return s + c.val;
    if (c.risk === '높음') return s + c.val;
    return s + c.val * 0.4; // 보통 위험은 40%만
  }, 0);

  const riskGroups: { label: string; color: string; icon: string; desc: string; items: SellCandidate[] }[] = [
    {
      label: '즉시 매도 검토',
      color: 'var(--color-loss)',
      icon: 'warning',
      desc: '원금 손실 구조 또는 지정학 리스크 — 하락장 낙폭 가장 큼',
      items: candidates.filter(c => c.risk === '매우높음'),
    },
    {
      label: '우선 매도 후보',
      color: '#f59e0b',
      icon: 'sell',
      desc: '테마 집중 또는 섹터 리스크 — 전량 또는 50% 이상 매도',
      items: candidates.filter(c => c.risk === '높음'),
    },
    {
      label: '부분 차익실현',
      color: 'var(--accent-blue)',
      icon: 'trending_down',
      desc: '대형 안정 ETF지만 비중 과다 — 30~50% 부분 매도 후 채권·금으로 이동',
      items: candidates.filter(c => c.risk === '보통'),
    },
  ];

  const ALLOC_COLORS: Record<AssetClass, string> = {
    주식: 'var(--asset-stock)', 채권: 'var(--asset-bond)', 커버드콜: 'var(--asset-covered)', 금: 'var(--asset-gold)', 기타: 'var(--asset-other)',
  };

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)', borderRadius: 12,
    border: '1px solid var(--border-secondary)', padding: isMobile ? 16 : 20, marginBottom: 16,
  };

  return (
    <div style={{ padding: isMobile ? '16px 16px 80px' : '24px 24px 80px', maxWidth: 720, margin: '0 auto' }}>

      {/* 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>2026년 5월 전략</span>
          <span style={{ padding: '2px 10px', borderRadius: 20, background: 'rgba(255,71,87,0.12)', color: 'var(--color-loss)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>Sell in May</span>
        </div>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          5월~10월은 역사적으로 주식 수익률이 낮은 시기입니다. 고위험 종목을 선별 매도하고 안전자산 비중을 높이는 전략을 분석했습니다.<br />
          <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>※ 현금화 = 계좌 내 매도 후 단기채·MMF 이동 (계좌 외부 인출 아님)</span>
        </p>
      </div>

      {/* 현재 자산군 비중 요약 */}
      <div style={cardStyle}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>현재 자산군 비중</div>
        <div style={{ display: 'flex', gap: 0, height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 10 }}>
          {(['주식', '커버드콜', '채권', '금', '기타'] as AssetClass[]).map(cls => (
            <div key={cls} style={{ width: `${allocation.pct[cls]}%`, background: ALLOC_COLORS[cls], transition: 'width 0.3s' }} />
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
          {(['주식', '커버드콜', '채권', '금', '기타'] as AssetClass[]).map(cls => (
            <span key={cls} style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: ALLOC_COLORS[cls], display: 'inline-block' }} />
              {cls} <b style={{ color: 'var(--text-primary)' }}>{allocation.pct[cls]}%</b>
              <span style={{ color: 'var(--text-tertiary)' }}>({fmt(allocation.byClass[cls])})</span>
            </span>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
          총 자산 <b style={{ color: 'var(--text-primary)' }}>{fmtM(allocation.total)}</b>
          &nbsp;·&nbsp;주식 비중이 높을수록 Sell in May 영향 큼
        </div>
      </div>

      {/* 전략 요약 박스 */}
      <div style={{ ...cardStyle, background: 'rgba(255,71,87,0.05)', border: '1px solid rgba(255,71,87,0.2)' }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-loss)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <MIcon name="insights" size={16} /> 5월 전략 요약
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: 10 }}>
          {[
            { label: '매도 후보 종목', value: `${candidates.length}개`, sub: '채권·금 제외' },
            { label: '예상 현금화 규모', value: fmtM(totalSellVal), sub: '고위험 전량 + 중위험 40%' },
            { label: '목표 주식 비중', value: '35~38%', sub: `현재 ${allocation.pct['주식']}%` },
          ].map(s => (
            <div key={s.label} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-secondary)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-quaternary)' }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 매도 후보 그룹별 */}
      {riskGroups.map(group => {
        if (group.items.length === 0) return null;
        const groupTotal = group.items.reduce((s, c) => s + c.val, 0);
        return (
          <div key={group.label} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MIcon name={group.icon} size={16} style={{ color: group.color }} />
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: group.color }}>{group.label}</span>
                <span style={{ fontSize: 'var(--text-xs)', padding: '1px 7px', borderRadius: 10, background: `${group.color}20`, color: group.color, fontWeight: 700 }}>{group.items.length}종목</span>
              </div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>합계 {fmtM(groupTotal)}</span>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: 12 }}>{group.desc}</div>

            {group.items.map((c, i) => (
              <div key={`${c.accId}-${c.holding.id}`} style={{
                padding: '12px 0', borderTop: i > 0 ? '1px solid var(--border-secondary)' : undefined,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>{c.holding.name}</span>
                      <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: 10, background: `${getRiskColor(c.risk)}20`, color: getRiskColor(c.risk), fontWeight: 700, whiteSpace: 'nowrap' }}>{c.risk}</span>
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 2 }}>
                      {c.owner} · {c.accAlias} ({c.accType})
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>{fmtM(c.val)}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                      {c.holding.quantity ? `${c.holding.quantity}주` : ''} · 평단 {c.holding.avgPrice?.toLocaleString()}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>매도 이유: </span>{c.reason}
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, background: 'var(--bg-elevated)', fontSize: 'var(--text-xs)', color: 'var(--text-primary)', fontWeight: 600 }}>
                  <MIcon name="arrow_forward" size={12} style={{ color: group.color }} />
                  {c.action}
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {/* 매도 후 이동 전략 */}
      <div style={cardStyle}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <MIcon name="swap_horiz" size={16} style={{ color: 'var(--color-profit)' }} />
          매도 후 이동 전략
        </div>
        {[
          { title: '단기채 ETF 증액', desc: 'KODEX 단기채권, TIGER 단기채권액티브 — 안전하면서 월배당', icon: 'shield', color: 'var(--asset-bond)' },
          { title: '금 비중 유지·소폭 증가', desc: 'ACE KRX금현물, TIGER KRX금현물 — 달러 약세·지정학 헤지', icon: 'diamond', color: 'var(--asset-gold)' },
          { title: '커버드콜 ETF 확대', desc: 'RISE 미국테크100, KODEX 200타겟위클리 — 하락장 방어 + 배당 수취', icon: 'attach_money', color: 'var(--asset-covered)' },
          { title: '10월 이후 재진입', desc: '나스닥·S&P500 ETF를 10월 이후 다시 확대 — 계절성 전략 완성', icon: 'event_repeat', color: 'var(--accent-blue)' },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: i > 0 ? '1px solid var(--border-secondary)' : undefined }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${item.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MIcon name={item.icon} size={16} style={{ color: item.color }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', marginBottom: 2 }}>{item.title}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 종목 심층 분석 */}
      <div style={cardStyle}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <MIcon name="search" size={16} style={{ color: 'var(--accent-blue)' }} />
          종목 심층 분석
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 16 }}>5월 전략 관점에서 보유 종목을 개별 분석합니다.</div>

        {/* KODEX 200타겟위클리커버드콜 */}
        <div style={{ borderRadius: 10, border: '1px solid var(--border-secondary)', overflow: 'hidden' }}>
          {/* 종목 헤더 */}
          <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--text-sm)', marginBottom: 2 }}>KODEX 200타겟위클리커버드콜</div>
              <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>498400 · 코스피200 기반 주간 커버드콜</div>
            </div>
            <span style={{ padding: '3px 10px', borderRadius: 20, background: 'rgba(0,184,148,0.12)', color: 'var(--color-profit)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>
              ✓ 5월 유지 추천
            </span>
          </div>

          {/* 보유 현황 */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-secondary)' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>보유 현황</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { owner: '지윤', acc: '펀슈(일반)', qty: 327, avg: 16241 },
                { owner: '지윤', acc: 'ISA', qty: 265, avg: 16973 },
                { owner: '오빠', acc: '미래퇴직', qty: 72, avg: 11828 },
                { owner: '오빠', acc: '미래연금', qty: 1035, avg: 10979 },
              ].map((row, i) => {
                const val = row.qty * row.avg;
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-xs)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      <b style={{ color: 'var(--text-primary)' }}>{row.owner}</b> · {row.acc}
                    </span>
                    <span style={{ display: 'flex', gap: 12, color: 'var(--text-tertiary)' }}>
                      <span>{row.qty}주 · 평단 {row.avg.toLocaleString()}원</span>
                      <b style={{ color: 'var(--text-primary)' }}>{fmtM(val)}</b>
                    </span>
                  </div>
                );
              })}
              <div style={{ borderTop: '1px solid var(--border-secondary)', paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', fontWeight: 700 }}>
                <span style={{ color: 'var(--text-secondary)' }}>합계</span>
                <span style={{ color: 'var(--text-primary)' }}>1,699주 · 약 {fmtM(1699 * 13500)}</span>
              </div>
            </div>
          </div>

          {/* 분석 */}
          <div style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>5월 전략 분석</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                {
                  icon: 'thumb_up', color: 'var(--color-profit)',
                  title: '5월~10월 횡보장에 유리한 구조',
                  desc: '커버드콜은 코스피200이 횡보하거나 소폭 하락해도 매주 옵션 프리미엄을 배당으로 수취. 여름 지지부진 시즌에 최적.',
                },
                {
                  icon: 'thumb_up', color: 'var(--color-profit)',
                  title: '오빠 미래연금 평단 10,979원 — 수익 구간',
                  desc: '현재가 대비 평단이 낮아 이미 수익 중. 커버드콜 구조상 추가 상승 제한은 있지만, 배당 수취하며 안정적 보유 가능.',
                },
                {
                  icon: 'info', color: 'var(--accent-blue)',
                  title: '매도 자금의 이동처로도 적합',
                  desc: '고위험 종목 매도 후 현금을 단기채 외에 이 ETF로 일부 이동하면 주간 배당 + 어느 정도의 주가 참여 가능.',
                },
                {
                  icon: 'warning', color: '#f59e0b',
                  title: '급락장에선 방어 한계',
                  desc: '코스피200이 10% 이상 급락하면 커버드콜 프리미엄으로 방어가 어려움. 지윤 ISA·펀슈 평단(16,000원대)은 현재가에 따라 손실 가능성 확인 필요.',
                },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: i > 0 ? '1px solid var(--border-secondary)' : undefined }}>
                  <MIcon name={item.icon} size={15} style={{ color: item.color, flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)', color: 'var(--text-primary)', marginBottom: 2 }}>{item.title}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 면책 */}
      <div style={{ fontSize: '10px', color: 'var(--text-quaternary)', textAlign: 'center', lineHeight: 1.6, padding: '8px 0' }}>
        이 분석은 평단가 기준 데이터이며 현재 수익률과 다를 수 있습니다.<br />
        투자 결정은 본인 판단 하에 이루어지며, 이 페이지는 참고용입니다.
      </div>
    </div>
  );
}
