import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../App';
import { MIcon } from './MIcon';
import type { Account, Holding } from '../types';
import { fetchStockSignals, type StockSignal } from '../utils/fetchStockSignals';
import { getSellDecision } from '../utils/sellEngine';
import { loadSellConfig } from '../utils/sellConfig';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://asset-dashboard-api.jilliankim200.workers.dev';

type CrashItem = { ticker: string; name: string; cat: string; r3m: number | null; r6m: number | null };
function crashSignal(d: CrashItem): 'green' | 'yellow' | 'red' {
  const r3 = d.r3m ?? 0; const r6 = d.r6m ?? 0;
  if (r3 < -5) return 'red';
  if (r3 < 0 && r6 < -10) return 'red';
  if (r3 > 0 && r6 > 0) return 'green';
  return 'yellow';
}
const CRASH_COLOR = { green: '#34d399', yellow: '#b45309', red: '#f87171' };

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

  const [activeTab, setActiveTab] = useState<'monthly' | 'quant'>('monthly');
  const [signals, setSignals] = useState<Record<string, StockSignal>>({});
  const [crashItems, setCrashItems] = useState<CrashItem[]>([]);
  const [crashUpdatedAt, setCrashUpdatedAt] = useState<string | null>(null);
  const [crashLoading, setCrashLoading] = useState(true);

  useEffect(() => {
    const tickers = accounts
      .flatMap(a => a.holdings.map(h => h.ticker))
      .filter((t): t is string => Boolean(t));
    if (tickers.length === 0) return;
    fetchStockSignals(tickers).then(setSignals);
  }, [accounts]);

  useEffect(() => {
    fetch(`${WORKER_URL}/kv/crash_signals`)
      .then(r => r.json())
      .then((res: { data: CrashItem[]; updatedAt: string } | null) => {
        if (res?.data?.length) { setCrashItems(res.data); setCrashUpdatedAt(res.updatedAt); }
      })
      .catch(() => {})
      .finally(() => setCrashLoading(false));
  }, []);

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
    // sellEngine 게이트: 상승추세 종목 제거
    const sellConfig = loadSellConfig();
    const filtered = list.filter(c => {
      if (!c.holding.ticker || !signals[c.holding.ticker]) return true;
      const sig = signals[c.holding.ticker];
      const avgPrice = c.holding.avgPrice || 0;
      const currentPrice = prices[c.holding.ticker] || avgPrice;
      const currentReturn = avgPrice > 0 ? (currentPrice - avgPrice) / avgPrice : null;
      const decision = getSellDecision(
        { currentReturn, currentPrice: sig.currentPrice, ma20: sig.ma20, ma60: sig.ma60 },
        sellConfig,
      );
      return decision.action !== 'hold';
    });
    return filtered.sort((a, b) => a.priority - b.priority || b.val - a.val);
  }, [accounts, prices, signals]);

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

  const pad = isMobile ? 16 : 20;

  return (
    <div style={{ padding: isMobile ? '12px' : '12px', maxWidth: 960, margin: '0 auto' }}>

      {/* 페이지 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
          2026년 5월
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
          Sell in May 전략 분석 · 듀얼 모멘텀 신호
        </p>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, borderBottom: '1px solid var(--border-primary)', paddingBottom: 12 }}>
        <button className={`toss-tab ${activeTab === 'monthly' ? 'toss-tab-active' : ''}`}
          onClick={() => setActiveTab('monthly')} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <MIcon name="calendar_today" size={14} />5월 전략
        </button>
        <button className={`toss-tab ${activeTab === 'quant' ? 'toss-tab-active' : ''}`}
          onClick={() => setActiveTab('quant')} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <MIcon name="show_chart" size={14} />퀀트투자
        </button>
      </div>

      {activeTab === 'quant' && <QuantTab isMobile={isMobile} pad={pad} />}
      {activeTab !== 'quant' && <>

      {/* 요점 */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', padding: '16px 20px', marginBottom: 20, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
        <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, fontSize: 'var(--text-base)', display: 'flex', alignItems: 'center', gap: 8 }}>
          2026년 5월 전략
          <span style={{ padding: '2px 10px', borderRadius: 20, background: 'rgba(255,71,87,0.12)', color: 'var(--color-loss)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>Sell in May</span>
        </p>
        <p style={{ margin: 0 }}>
          5월~10월은 역사적으로 주식 수익률이 낮은 시기. 고위험 종목을 선별 매도하고 안전자산 비중을 높이는 전략을 분석했습니다.<br />
          <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>※ 현금화 = 계좌 내 매도 후 단기채·MMF 이동 (계좌 외부 인출 아님)</span>
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* 현재 자산군 비중 요약 */}
      <div className="toss-card" style={{ padding: pad }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <MIcon name="donut_large" size={18} style={{ color: 'var(--accent-blue)' }} />
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>현재 자산군 비중</h2>
        </div>
        <div style={{ display: 'flex', gap: 0, height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 10 }}>
          {(['주식', '커버드콜', '채권', '금', '기타'] as AssetClass[]).map(cls => (
            <div key={cls} style={{ width: `${allocation.pct[cls]}%`, background: ALLOC_COLORS[cls], transition: 'width 0.3s' }} />
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
          {(['주식', '커버드콜', '채권', '금', '기타'] as AssetClass[]).map(cls => (
            <span key={cls} style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: ALLOC_COLORS[cls], display: 'inline-block' }} />
              {cls} <b style={{ color: 'var(--text-primary)' }}>{allocation.pct[cls]}%</b>
              <span style={{ color: 'var(--text-tertiary)' }}>({fmt(allocation.byClass[cls])})</span>
            </span>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
          총 자산 <b style={{ color: 'var(--text-primary)' }}>{fmtM(allocation.total)}</b>
          &nbsp;·&nbsp;주식 비중이 높을수록 Sell in May 영향 큼
        </div>
      </div>

      {/* 전략 요약 박스 */}
      <div className="toss-card" style={{ padding: pad, background: 'rgba(255,71,87,0.05)', border: '1px solid rgba(255,71,87,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <MIcon name="insights" size={18} style={{ color: 'var(--color-loss)' }} />
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-loss)', margin: 0 }}>5월 전략 요약</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: 10 }}>
          {[
            { label: '매도 후보 종목', value: `${candidates.length}개`, sub: '채권·금 제외' },
            { label: '예상 현금화 규모', value: fmtM(totalSellVal), sub: '고위험 전량 + 중위험 40%' },
            { label: '목표 주식 비중', value: '35~38%', sub: `현재 ${allocation.pct['주식']}%` },
          ].map(s => (
            <div key={s.label} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-secondary)' }}>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-quaternary)' }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 매도 후보 그룹별 */}
      {riskGroups.map(group => {
        if (group.items.length === 0) return null;
        const groupTotal = group.items.reduce((s, c) => s + c.val, 0);
        return (
          <div key={group.label} className="toss-card" style={{ padding: pad }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MIcon name={group.icon} size={16} style={{ color: group.color }} />
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: group.color }}>{group.label}</span>
                <span style={{ fontSize: 'var(--text-sm)', padding: '1px 7px', borderRadius: 10, background: `${group.color}20`, color: group.color, fontWeight: 700 }}>{group.items.length}종목</span>
              </div>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>합계 {fmtM(groupTotal)}</span>
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginBottom: 12 }}>{group.desc}</div>

            {group.items.map((c, i) => (
              <div key={`${c.accId}-${c.holding.id}`} style={{
                padding: '12px 0', borderTop: i > 0 ? '1px solid var(--border-primary)' : undefined,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>{c.holding.name}</span>
                      <span style={{ fontSize: 'var(--text-sm)', padding: '1px 6px', borderRadius: 10, background: `${getRiskColor(c.risk)}20`, color: getRiskColor(c.risk), fontWeight: 700, whiteSpace: 'nowrap' }}>{c.risk}</span>
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginBottom: 2 }}>
                      {c.owner} · {c.accAlias} ({c.accType})
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>{fmtM(c.val)}</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                      {c.holding.quantity ? `${c.holding.quantity}주` : ''} · 평단 {c.holding.avgPrice?.toLocaleString()}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>매도 이유: </span>{c.reason}
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, background: 'var(--bg-elevated)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 600 }}>
                  <MIcon name="arrow_forward" size={12} style={{ color: group.color }} />
                  {c.action}
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {/* 매도 후 이동 전략 */}
      <div className="toss-card" style={{ padding: pad }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <MIcon name="swap_horiz" size={18} style={{ color: 'var(--color-profit)' }} />
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>매도 후 이동 전략</h2>
        </div>
        {[
          { title: '단기채 ETF 증액', desc: 'KODEX 단기채권, TIGER 단기채권액티브 — 안전하면서 월배당', icon: 'shield', color: 'var(--asset-bond)' },
          { title: '금 비중 유지·소폭 증가', desc: 'ACE KRX금현물, TIGER KRX금현물 — 달러 약세·지정학 헤지', icon: 'diamond', color: 'var(--asset-gold)' },
          { title: '커버드콜 ETF 확대', desc: 'RISE 미국테크100, KODEX 200타겟위클리 — 하락장 방어 + 배당 수취', icon: 'attach_money', color: 'var(--asset-covered)' },
          { title: '10월 이후 재진입', desc: '나스닥·S&P500 ETF를 10월 이후 다시 확대 — 계절성 전략 완성', icon: 'event_repeat', color: 'var(--accent-blue)' },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: i > 0 ? '1px solid var(--border-primary)' : undefined }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${item.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MIcon name={item.icon} size={16} style={{ color: item.color }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', marginBottom: 2 }}>{item.title}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 종목 심층 분석 */}
      <div className="toss-card" style={{ padding: pad }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <MIcon name="manage_search" size={18} style={{ color: 'var(--accent-blue)' }} />
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>종목 심층 분석</h2>
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginBottom: 16 }}>5월 전략 관점에서 보유 종목을 개별 분석합니다.</div>

        {/* KODEX 200타겟위클리커버드콜 */}
        <div style={{ borderRadius: 10, border: '1px solid var(--border-primary)', overflow: 'hidden' }}>
          {/* 종목 헤더 */}
          <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--text-sm)', marginBottom: 2 }}>KODEX 200타겟위클리커버드콜</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>498400 · 코스피200 기반 주간 커버드콜</div>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: 'rgba(0,184,148,0.12)', color: 'var(--color-profit)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
              <MIcon name="check_circle" size={14} />5월 유지 추천
            </span>
          </div>

          {/* 보유 현황 */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-primary)' }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>보유 현황</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { owner: '지윤', acc: '펀슈(일반)', qty: 327, avg: 16241 },
                { owner: '지윤', acc: 'ISA', qty: 265, avg: 16973 },
                { owner: '오빠', acc: '미래퇴직', qty: 72, avg: 11828 },
                { owner: '오빠', acc: '미래연금', qty: 1035, avg: 10979 },
              ].map((row, i) => {
                const val = row.qty * row.avg;
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-sm)' }}>
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
              <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
                <span style={{ color: 'var(--text-secondary)' }}>합계</span>
                <span style={{ color: 'var(--text-primary)' }}>1,699주 · 약 {fmtM(1699 * 13500)}</span>
              </div>
            </div>
          </div>

          {/* 분석 */}
          <div style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>5월 전략 분석</div>
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
                <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: i > 0 ? '1px solid var(--border-primary)' : undefined }}>
                  <MIcon name={item.icon} size={15} style={{ color: item.color, flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', marginBottom: 2 }}>{item.title}</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      </div>{/* end gap-column */}

      {/* 면책 */}
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.6, padding: '16px 0 8px' }}>
        이 분석은 평단가 기준 데이터이며 현재 수익률과 다를 수 있습니다.<br />
        투자 결정은 본인 판단 하에 이루어지며, 이 페이지는 참고용입니다.
      </div>
      </>}
    </div>
  );
}

// ── 퀀트투자 탭 ──────────────────────────────────────────────────────────────

function CheckItem({ done, children }: { done?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0',
      borderBottom: '1px solid var(--border-primary)' }}>
      <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${done ? '#22c55e' : 'var(--border-primary)'}`,
        background: done ? '#22c55e18' : 'transparent', flexShrink: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        {done && <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 800 }}>✓</span>}
      </div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

function Row({ label, val, valColor, sub }: { label: string; val: string; valColor?: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '9px 0', borderBottom: '1px solid var(--border-primary)' }}>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: valColor ?? 'var(--text-primary)' }}>{val}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>{sub}</div>}
      </div>
    </div>
  );
}

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px',
      borderRadius: 4, background: `${color}18`, color, marginRight: 6, marginBottom: 4 }}>
      {children}
    </span>
  );
}

function QuantTab({ isMobile, pad }: { isMobile: boolean; pad: number }) {
  const [allocMode, setAllocMode] = useState<'top1' | 'proportional'>('top1');

  const ASSETS = [
    { rank: 1, name: '반도체',    ticker: '091160', r6m: 137.0 },
    { rank: 2, name: '코스피200', ticker: '069500', r6m: 94.1  },
    { rank: 3, name: '코스닥150', ticker: '229200', r6m: 36.6  },
    { rank: 4, name: '나스닥100', ticker: '133690', r6m: 13.1  },
    { rank: 5, name: 'S&P500',   ticker: '360750', r6m: 10.4  },
    { rank: 6, name: '금',        ticker: '411060', r6m: 9.1   },
    { rank: 7, name: '미국장기채',ticker: '305080', r6m: 0.6   },
  ];
  const totalR = ASSETS.reduce((s, a) => s + a.r6m, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* 이달 신호 요약 */}
      <div className="toss-card" style={{ padding: pad }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <MIcon name="sensors" size={18} style={{ color: '#22c55e' }} />
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>2026년 5월 듀얼 모멘텀 신호</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: isMobile ? 12 : 0 }}>
          {[
            { label: '1위 자산', val: '반도체', sub: '091160', color: '#22c55e' },
            { label: '6M 수익률', val: '+137.0%', sub: '7개 자산 중 1위', color: '#f97316' },
            { label: '시장 국면', val: '강세장', sub: '절대 모멘텀 양(+)', color: '#22c55e' },
            { label: '다음 리밸런싱', val: '5월 말', sub: '월말 수익률 재산출', color: 'var(--text-primary)' },
          ].map((s, i) => (
            <div key={s.label} style={{
              padding: isMobile ? '0' : '0 16px',
              borderLeft: (!isMobile && i > 0) ? '1px solid var(--border-primary)' : undefined,
            }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: s.color, marginBottom: 2 }}>{s.val}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 전략 vs Sell in May */}
      <div className="toss-card" style={{ padding: pad }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <MIcon name="bolt" size={18} style={{ color: 'var(--accent-blue)' }} />
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>퀀트 전략 vs Sell in May — 이달의 판단</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div style={{ background: 'rgba(239,68,68,.05)', border: '1px solid rgba(239,68,68,.2)',
            borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: '#ef4444', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
              <MIcon name="calendar_today" size={14} />5월 전략 탭 관점
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              Sell in May 계절성 — 5~10월 주식 수익률 저조<br />
              반도체는 고위험 섹터 → <strong style={{ color: '#ef4444' }}>부분 또는 전량 매도 후보</strong>
            </div>
          </div>
          <div style={{ background: 'rgba(34,197,94,.05)', border: '1px solid rgba(34,197,94,.2)',
            borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: '#22c55e', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
              <MIcon name="show_chart" size={14} />퀀트 모멘텀 관점
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              6M +137% — 7개 자산 중 압도적 1위<br />
              모멘텀 신호 살아있는 한 <strong style={{ color: '#22c55e' }}>100% 집중 보유 유지</strong>
            </div>
          </div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
          borderRadius: 8, padding: '12px 14px',
          fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <strong style={{ color: '#3b82f6' }}>이달 결론:</strong> 두 전략이 충돌합니다.
          퀀트 모멘텀 전략은 신호 기반 규칙 매매이므로 <strong style={{ color: 'var(--text-primary)' }}>크래시 신호가 뜨기 전까지 유지</strong>가 원칙.
          단, +137%는 극단 모멘텀 구간 — <strong style={{ color: '#f59e0b' }}>크래시 탐지를 평소보다 자주(주 2회 이상) 확인</strong>하는 것이 핵심입니다.
        </div>
      </div>

      {/* 이달 액션 플랜 */}
      <div className="toss-card" style={{ padding: pad }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <MIcon name="my_location" size={18} style={{ color: '#22c55e' }} />
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>5월 퀀트 액션 플랜</h2>
        </div>

        {[
          {
            num: 1, color: '#22c55e',
            title: '반도체 ETF (091160) 100% 보유 유지',
            detail: '듀얼 모멘텀 1위 자산. KODEX 반도체(091160) 또는 TIGER 반도체(091230) 중 보유 중인 것 유지.',
            tag: '즉시',
          },
          {
            num: 2, color: '#ef4444',
            title: '반도체 외 위험자산 전량 매도 → 단기채권 통합',
            detail: '코스피200, 코스닥150, 나스닥100, S&P500 ETF 보유 중이면 전량 매도. KODEX 단기채권(153130)으로 통합. 이 전략은 1위 단일 자산만 보유.',
            tag: '이달 내',
          },
          {
            num: 3, color: '#f97316',
            title: '크래시 탐지 대시보드 주 2회 이상 점검',
            detail: '퀀트 대시보드 → 모멘텀 크래시 감지 섹션. 🔴 적색(3M < -5%) 출현 시 반도체 전량 매도 → 단기채권(153130) 즉시 전환. +137% 극단 모멘텀 구간이라 평소보다 자주 확인 필요.',
            tag: '상시',
          },
          {
            num: 4, color: '#3b82f6',
            title: '5월 말 6M 수익률 재계산 → 1위 자산 교체 여부 확인',
            detail: '매월 말 7개 자산(반도체/코스피200/코스닥150/나스닥100/S&P500/금/미국장기채) 수익률 재산출. 1위가 바뀌면 다음 달 초 교체 실행.',
            tag: '5월 말',
          },
        ].map((item, i, arr) => (
          <div key={item.num} style={{ display: 'flex', gap: 12, alignItems: 'flex-start',
            paddingBottom: i < arr.length - 1 ? 14 : 0,
            borderBottom: i < arr.length - 1 ? '1px solid var(--border-primary)' : 'none',
            marginBottom: i < arr.length - 1 ? 14 : 0 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: `${item.color}22`,
              color: item.color, fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0 }}>{item.num}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{item.title}</span>
                <Tag color={item.color}>{item.tag}</Tag>
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{item.detail}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 7대 자산 현황 */}
      <div className="toss-card" style={{ padding: pad }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MIcon name="bar_chart" size={18} style={{ color: 'var(--accent-blue)' }} />
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>7대 자산 6M 수익률 순위</h2>
          </div>
          {/* 토글 */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary)', borderRadius: 20, padding: 3 }}>
            {(['top1', 'proportional'] as const).map(mode => (
              <button key={mode} onClick={() => setAllocMode(mode)} style={{
                padding: '4px 12px', borderRadius: 16, fontSize: 'var(--text-xs)', fontWeight: 600,
                cursor: 'pointer', border: 'none', transition: 'all .15s',
                background: allocMode === mode ? 'var(--accent-blue)' : 'transparent',
                color: allocMode === mode ? '#fff' : 'var(--text-tertiary)',
              }}>
                {mode === 'top1' ? '집중 투자' : '비례 배분'}
              </button>
            ))}
          </div>
        </div>

        {/* 모드 설명 */}
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 12, padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 6 }}>
          {allocMode === 'top1'
            ? '집중 투자: 6M 수익률 1위 자산에 100% 투자. 나머지는 단기채 보관. 회전율 낮고 수익 집중.'
            : '비례 배분: 6M 수익률 비례로 전 자산 분산 투자. 리스크 분산, 수익률은 Top-1보다 낮음.'}
        </div>

        {ASSETS.map((row, i) => {
          const propPct = Math.round(row.r6m / totalR * 1000) / 10;
          const isTop1 = allocMode === 'top1';
          const targetPct = isTop1 ? (row.rank === 1 ? 100 : 0) : propPct;
          const isHold = isTop1 ? row.rank === 1 : true;
          const color = isHold ? '#22c55e' : '#ef4444';
          const barWidth = isTop1 ? (row.rank === 1 ? 100 : 0) : (propPct / (137.0 / totalR * 100) * 100);

          return (
            <div key={row.ticker} style={{ padding: '10px 0', borderBottom: i < 6 ? '1px solid var(--border-primary)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                <div style={{ width: 22, fontSize: 12, fontWeight: 700, flexShrink: 0,
                  color: row.rank === 1 ? '#22c55e' : 'var(--text-tertiary)' }}>{row.rank}위</div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700,
                    color: (isHold) ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{row.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-quaternary)', marginLeft: 6 }}>{row.ticker}</span>
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', width: 56, textAlign: 'right' }}>
                  +{row.r6m}%
                </div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color, width: isMobile ? 52 : 68, textAlign: 'right' }}>
                  {targetPct}%
                </div>
              </div>
              {/* 비중 바 */}
              <div style={{ height: 4, background: 'var(--bg-secondary)', borderRadius: 2, marginLeft: 32, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  width: `${Math.min(barWidth, 100)}%`,
                  background: isHold ? '#22c55e' : 'var(--border-primary)',
                  transition: 'width .4s ease',
                }} />
              </div>
            </div>
          );
        })}

        <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8,
          fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', lineHeight: 1.7 }}>
          {allocMode === 'top1'
            ? <><strong style={{ color: '#ef4444' }}>0% 자산</strong>은 단기채권(153130)으로 보관 · 매월 말 수익률 재산출 후 1위 교체 시 리밸런싱</>
            : <>비례 배분은 매월 말 수익률 재산출 후 비중 조정 · 모든 자산 양(+) 모멘텀 확인 필요</>}
        </div>
      </div>

      {/* 리스크 경고 */}
      <div className="toss-card" style={{ padding: pad, background: 'rgba(245,158,11,.05)', border: '1px solid rgba(245,158,11,.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <MIcon name="warning" size={18} style={{ color: '#f59e0b' }} />
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: '#f59e0b', margin: 0 }}>이달 핵심 리스크</h2>
        </div>
        {[
          {
            icon: 'local_fire_department', color: '#ef4444', title: '극단 모멘텀 크래시 위험',
            desc: '반도체 6M +137%는 상위 1~2% 수준의 극단값. Barroso & Santa-Clara (2015) 연구에 따르면 이 구간에서 급격한 모멘텀 반전(크래시) 확률이 통계적으로 유의미하게 높아집니다.',
          },
          {
            icon: 'sensors', color: '#f59e0b', title: '크래시 탐지 지연 (하루 1회 갱신)',
            desc: '현재 Worker 크론이 하루 1회(UTC 03:00) 돌아 전날 데이터 기준으로 신호를 갱신합니다. 장중 급락은 당일 캐치 불가. 수동 갱신 버튼(퀀트 기초 → 액션 플랜)으로 보완 가능.',
          },
          {
            icon: 'bolt', color: '#3b82f6', title: '절대 모멘텀 음전 시 즉시 전환',
            desc: '반도체 6M 수익률이 0% 이하로 떨어지면 1위라도 단기채권(153130)으로 전환. 듀얼 모멘텀의 절대 모멘텀 필터가 이 조건.',
          },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0',
            borderTop: i > 0 ? '1px solid var(--border-primary)' : 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${item.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MIcon name={item.icon} size={16} style={{ color: item.color }} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: item.color, marginBottom: 4 }}>{item.title}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 5월 체크리스트 */}
      <div className="toss-card" style={{ padding: pad }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <MIcon name="checklist" size={18} style={{ color: '#22c55e' }} />
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>5월 퀀트 체크리스트</h2>
        </div>
        <div style={{ marginTop: 10 }}>
          <CheckItem><strong style={{ color: 'var(--text-primary)' }}>반도체(091160)</strong> 보유 확인 — 비중 100%</CheckItem>
          <CheckItem><strong style={{ color: '#ef4444' }}>반도체 외 위험자산</strong> 전량 매도 → 단기채권(153130) 통합</CheckItem>
          <CheckItem>퀀트 대시보드 <strong style={{ color: 'var(--text-primary)' }}>크래시 탐지</strong> 주 2회 이상 점검 (<span style={{ color: '#ef4444' }}>●</span> 적색 시 즉시 대응)</CheckItem>
          <CheckItem><strong style={{ color: 'var(--text-primary)' }}>수동 신호 갱신</strong> — 퀀트 기초 → 신호 갱신 버튼 주기적 클릭</CheckItem>
          <CheckItem><strong style={{ color: 'var(--text-primary)' }}>5월 말</strong> 7대 자산 6M 수익률 재계산 → 1위 자산 교체 여부 확인</CheckItem>
        </div>
      </div>

      {/* 모멘텀 크래시 감지 */}
      {(() => {
        const withSig = crashItems.map(d => ({ ...d, sig: crashSignal(d) }));
        const counts = { green: 0, yellow: 0, red: 0 };
        withSig.forEach(d => { counts[d.sig]++; });
        const fmtR = (v: number | null) => v === null ? 'N/A' : (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
        const redYellow = withSig.filter(d => d.sig === 'red' || d.sig === 'yellow')
          .sort((a, b) => (a.r3m ?? 0) - (b.r3m ?? 0)).slice(0, 8);
        return (
          <div className="toss-card" style={{ padding: pad }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MIcon name="crisis_alert" size={18} style={{ color: 'var(--color-error)' }} />
                <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>모멘텀 크래시 감지</h2>
              </div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                {crashLoading ? '로딩 중…' : (crashUpdatedAt ? `기준: ${crashUpdatedAt}` : '캐시')}
              </span>
            </div>
            {/* 신호 요약 */}
            <div style={{ display: 'flex', gap: isMobile ? 16 : 28, marginBottom: 14 }}>
              {(['green', 'yellow', 'red'] as const).map(sig => {
                const labels = { green: '상승 유지', yellow: '경고', red: '위험' };
                return (
                  <div key={sig} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: CRASH_COLOR[sig], boxShadow: `0 0 5px ${CRASH_COLOR[sig]}80` }} />
                    <span style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: CRASH_COLOR[sig], lineHeight: 1 }}>{counts[sig]}</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{labels[sig]}</span>
                  </div>
                );
              })}
            </div>
            {/* 경고·위험 종목 목록 */}
            {crashLoading ? (
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', padding: '8px 0' }}>신호 불러오는 중…</div>
            ) : redYellow.length === 0 ? (
              <div style={{ fontSize: 'var(--text-sm)', color: '#34d399', padding: '8px 0' }}>전 종목 상승 유지 — 이상 신호 없음</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 2 }}>경고·위험 종목 (3M 수익률 낮은 순)</div>
                {redYellow.map(d => (
                  <div key={d.ticker} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px', borderRadius: 8,
                    background: d.sig === 'red' ? 'rgba(248,113,113,.06)' : 'rgba(251,191,36,.06)',
                    border: `1px solid ${d.sig === 'red' ? 'rgba(248,113,113,.25)' : 'rgba(251,191,36,.25)'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: CRASH_COLOR[d.sig], flexShrink: 0 }} />
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexShrink: 0, fontSize: 'var(--text-xs)' }}>
                      <span style={{ color: (d.r3m ?? 0) >= 0 ? '#34d399' : '#f87171' }}>3M {fmtR(d.r3m)}</span>
                      <span style={{ color: (d.r6m ?? 0) >= 0 ? '#34d399' : '#f87171' }}>6M {fmtR(d.r6m)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* 성과 참고 */}
      <div className="toss-card" style={{ padding: pad }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <MIcon name="show_chart" size={18} style={{ color: 'var(--accent-blue)' }} />
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>전략 성과 참고 (역사적 백테스트)</h2>
        </div>
        <Row label="CAGR (연복리 수익률)" val="~22%" valColor="#22c55e" sub="집중 투자 Top-1 기준" />
        <Row label="MDD (최대 낙폭)" val="-30~45%" valColor="#ef4444" sub="분산 없음 — 리스크 최대" />
        <Row label="Sharpe Ratio" val="0.70~0.95" valColor="#f97316" />
        <Row label="평균 턴오버" val="~120%/년" valColor="var(--text-primary)" sub="월 1회 리밸런싱" />
        <div style={{ marginTop: 12, fontSize: 'var(--text-sm)', color: 'var(--text-quaternary)', lineHeight: 1.6 }}>
          ※ 백테스트 결과는 과거 데이터 기반이며 미래 수익을 보장하지 않습니다.<br />
          ※ 거래 비용·슬리피지·세금 미반영 기준.
        </div>
      </div>

    </div>
  );
}
