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

function getBuySuggestion(name: string): string {
  if (name.includes('커버드콜') || name.includes('타겟위클리')) return '여름 횡보장 핵심 인컴 — 비중 유지 또는 소폭 증가';
  if (name.includes('단기채') || name.includes('CD금리')) return '현금성 안전자산 — 5월 매도 자금 임시 보관처';
  if (name.includes('금현물') || name.includes('KRX금')) return '달러 약세·지정학 헤지 — 7~8% 비중 유지';
  if (name.includes('배당') || name.includes('고배당')) return '배당 성장 전략 — 월배당 수취 가능';
  return '현 비중 유지';
}

interface BuyCandidate {
  name: string;
  ticker: string;
  reason: string;
  action: string;
  priority: number;
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
  priority: number;
}

export function MonthlyStrategyJun() {
  const { accounts, prices, isMobile } = useAppContext();
  const [activeTab, setActiveTab] = useState<'monthly' | 'quant'>('monthly');
  const [showGuide, setShowGuide] = useState(false);
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

  // 잔존 고위험 종목 (5월에 미처 정리 못한 것)
  const remainingRisk = useMemo<SellCandidate[]>(() => {
    const list: SellCandidate[] = [];
    for (const acc of accounts) {
      const alias = acc.alias || acc.institution;
      for (const h of acc.holdings) {
        if (h.isFund) continue;
        const val = hVal(h, prices);
        if (val < 50_000) continue;
        const cls = classify(h.name);
        if (cls === '채권' || cls === '금') continue;
        const risk = getRiskLevel(h.name, h.ticker || '');
        if (risk !== '매우높음' && risk !== '높음') continue;
        const priority = risk === '매우높음' ? 1 : 2;
        list.push({ accId: acc.id, accAlias: alias, accType: acc.accountType, owner: acc.ownerName || '', holding: h, cls, val, risk, priority });
      }
    }
    const sellConfig = loadSellConfig();
    return list.filter(c => {
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
    }).sort((a, b) => a.priority - b.priority || b.val - a.val);
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

  const ALLOC_COLORS: Record<AssetClass, string> = {
    주식: 'var(--asset-stock)', 채권: 'var(--asset-bond)', 커버드콜: 'var(--asset-covered)', 금: 'var(--asset-gold)', 기타: 'var(--asset-other)',
  };

  const pad = isMobile ? 16 : 20;

  return (
    <div style={{ padding: isMobile ? '12px' : '12px', maxWidth: 960, margin: '0 auto' }}>

      {/* 페이지 헤더 */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
            2026년 6월
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
            여름 인컴 전략 · 듀얼 모멘텀 6월 신호
          </p>
        </div>
        <button
          onClick={() => setShowGuide(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 10, border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          <MIcon name="info" size={15} />
          자세히
        </button>
      </div>

      {/* 설계 가이드 모달 */}
      {showGuide && <JunGuideModal onClose={() => setShowGuide(false)} isMobile={isMobile} />}

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, borderBottom: '1px solid var(--border-primary)', paddingBottom: 12 }}>
        <button className={`toss-tab ${activeTab === 'monthly' ? 'toss-tab-active' : ''}`}
          onClick={() => setActiveTab('monthly')} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <MIcon name="calendar_today" size={14} />6월 전략
        </button>
        <button className={`toss-tab ${activeTab === 'quant' ? 'toss-tab-active' : ''}`}
          onClick={() => setActiveTab('quant')} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <MIcon name="show_chart" size={14} />퀀트투자
        </button>
      </div>

      {activeTab === 'quant' && <QuantTabJun isMobile={isMobile} pad={pad} crashItems={crashItems} crashUpdatedAt={crashUpdatedAt} crashLoading={crashLoading} />}
      {activeTab !== 'quant' && <>

      {/* 요점 */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', padding: '16px 20px', marginBottom: 20, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
        <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, fontSize: 'var(--text-base)', display: 'flex', alignItems: 'center', gap: 8 }}>
          2026년 6월 전략
          <span style={{ padding: '2px 10px', borderRadius: 20, background: 'rgba(99,102,241,0.12)', color: '#6366f1', fontSize: 'var(--text-xs)', fontWeight: 700 }}>여름 인컴</span>
        </p>
        <p style={{ margin: 0 }}>
          5월 전략(Sell in May) 실행 후 방어적 포지션을 유지하는 시기입니다. 커버드콜·채권·금 중심으로 월배당을 수취하며 7~8월 재진입 기회를 기다립니다.<br />
          <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>※ 퀀트 모멘텀 신호가 변화할 경우 즉시 탭을 확인해 대응하세요.</span>
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
          &nbsp;·&nbsp;목표: 커버드콜+채권+금 ≥ 50%
        </div>
      </div>

      {/* 6월 전략 요약 */}
      <div className="toss-card" style={{ padding: pad, background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <MIcon name="insights" size={18} style={{ color: '#6366f1' }} />
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: '#6366f1', margin: 0 }}>6월 전략 요약</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: 10 }}>
          {[
            { label: '잔존 고위험 종목', value: `${remainingRisk.length}개`, sub: '5월 미처리 포함' },
            { label: '목표 주식 비중', value: '30~35%', sub: `현재 ${allocation.pct['주식']}%` },
            { label: '월 목표 배당', value: '~200만원', sub: '커버드콜 ETF 기준' },
          ].map(s => (
            <div key={s.label} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-secondary)' }}>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-quaternary)' }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 잔존 고위험 종목 */}
      {remainingRisk.length > 0 && (
        <div className="toss-card" style={{ padding: pad }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MIcon name="warning" size={16} style={{ color: 'var(--color-loss)' }} />
              <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-loss)' }}>5월 미처리 — 6월 우선 정리</span>
              <span style={{ fontSize: 'var(--text-sm)', padding: '1px 7px', borderRadius: 10, background: 'rgba(255,71,87,0.12)', color: 'var(--color-loss)', fontWeight: 700 }}>{remainingRisk.length}종목</span>
            </div>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>합계 {fmtM(remainingRisk.reduce((s, c) => s + c.val, 0))}</span>
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginBottom: 12 }}>5월에 처리하지 못한 고위험 종목입니다. 6월 초 우선 정리를 권장합니다.</div>
          {remainingRisk.map((c, i) => (
            <div key={`${c.accId}-${c.holding.id}`} style={{ padding: '12px 0', borderTop: i > 0 ? '1px solid var(--border-primary)' : undefined }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>{c.holding.name}</span>
                    <span style={{ fontSize: 'var(--text-sm)', padding: '1px 6px', borderRadius: 10, background: `${getRiskColor(c.risk)}20`, color: getRiskColor(c.risk), fontWeight: 700 }}>{c.risk}</span>
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>{c.owner} · {c.accAlias} ({c.accType})</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>{fmtM(c.val)}</div>
                </div>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, background: 'var(--bg-elevated)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 600 }}>
                <MIcon name="arrow_forward" size={12} style={{ color: 'var(--color-loss)' }} />
                전량 매도 → 단기채 또는 커버드콜 이동
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 6월 인컴 전략 */}
      <div className="toss-card" style={{ padding: pad }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <MIcon name="attach_money" size={18} style={{ color: 'var(--color-profit)' }} />
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>6월 인컴 전략 — 보유 유지</h2>
        </div>
        {[
          { title: '커버드콜 ETF 핵심 유지', desc: 'KODEX 200타겟위클리커버드콜(498400), TIGER 배당커버드콜액티브(472150) — 주/월 배당 수취. 횡보장에서 유리한 구조.', icon: 'shield', color: 'var(--color-profit)' },
          { title: '단기채·CD금리 현금성 유지', desc: 'KODEX 단기채권(153130), KODEX CD금리액티브(458580) — 5월 매도 대금 안전하게 보관. 금리 수취 지속.', icon: 'account_balance', color: 'var(--accent-blue)' },
          { title: '금 비중 7~8% 유지', desc: 'ACE KRX금현물(411060) — 달러 약세·지정학 리스크 헤지. 여름 변동성 장에서 포트폴리오 완충 역할.', icon: 'diamond', color: 'var(--asset-gold)' },
          { title: '10월 이후 재진입 대기', desc: '나스닥·S&P500·반도체 ETF는 10월 이후 계절성 유리 구간 진입 시 비중 확대. 현재는 모멘텀 신호 유지 여부만 모니터링.', icon: 'event_repeat', color: '#f59e0b' },
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

      {/* 6월 배당 캘린더 */}
      <div className="toss-card" style={{ padding: pad }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <MIcon name="calendar_month" size={18} style={{ color: '#6366f1' }} />
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>6월 배당 캘린더</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { period: '매월 15일', name: 'KODEX 200타겟위클리커버드콜', ticker: '498400', type: '월 배당', color: '#6366f1' },
            { period: '매월 말', name: 'TIGER 배당커버드콜액티브', ticker: '472150', type: '월 배당', color: '#6366f1' },
            { period: '매월 말', name: 'ACE 미국빅테크7+커버드콜', ticker: '480040', type: '월 배당', color: '#6366f1' },
            { period: '매월 말', name: 'KODEX S&P500TOP10커버드콜', ticker: '483280', type: '월 배당', color: '#6366f1' },
            { period: '매월 말', name: 'TIME 미국배당다우존스액티브', ticker: '0036D0', type: '월 배당', color: '#f59e0b' },
          ].map((row, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < 4 ? '1px solid var(--border-primary)' : undefined }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{row.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{row.ticker}</span>
                </div>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{row.period}</span>
              </div>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: `${row.color}18`, color: row.color, flexShrink: 0, marginLeft: 8 }}>{row.type}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
          배당 수령 후 재투자: 커버드콜 ETF 또는 단기채권으로 복리 운용
        </div>
      </div>

      {/* 월중 체크리스트 */}
      <div className="toss-card" style={{ padding: pad }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <MIcon name="checklist" size={18} style={{ color: '#22c55e' }} />
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>6월 월중 체크리스트</h2>
        </div>
        {[
          { week: '6월 초', color: '#ef4444', items: ['5월 미처리 고위험 종목 정리 완료', '포트폴리오 비중 재확인 — 주식 ≤ 35% 목표'] },
          { week: '6월 중', color: '#f59e0b', items: ['크래시 탐지 대시보드 주 2회 점검', '배당 수령 확인 및 재투자 실행', '미국 FOMC (6/17~18) 결과 확인 — 금리 방향'] },
          { week: '6월 말', color: '#3b82f6', items: ['7대 자산 6M 수익률 재산출 → 1위 교체 여부', '7월 전략 수립 — 모멘텀 신호 방향 기준', '반기 포트폴리오 리뷰 (총 수익률·배당 집계)'] },
        ].map((section, si) => (
          <div key={si} style={{ marginBottom: si < 2 ? 16 : 0 }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: section.color, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{section.week}</div>
            {section.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 0', borderBottom: '1px solid var(--border-primary)' }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid var(--border-primary)`, flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      </div>

      {/* 면책 */}
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.6, padding: '16px 0 8px' }}>
        이 분석은 평단가 기준 데이터이며 현재 수익률과 다를 수 있습니다.<br />
        투자 결정은 본인 판단 하에 이루어지며, 이 페이지는 참고용입니다.
      </div>
      </>}
    </div>
  );
}

// ── 설계 가이드 모달 ────────────────────────────────────────────────────────

function JunGuideModal({ onClose, isMobile }: { onClose: () => void; isMobile: boolean }) {
  const S = {
    overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
    sheet: { background: 'var(--bg-card, #fff)', borderRadius: 18, width: '100%', maxWidth: 680, maxHeight: '88vh', display: 'flex', flexDirection: 'column' as const, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px 14px', borderBottom: '1px solid var(--border-primary)', flexShrink: 0 },
    body: { overflowY: 'auto' as const, padding: '0 22px 22px' },
    section: { marginTop: 22 },
    h2: { fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 7 },
    p: { fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, margin: '0 0 8px 0' },
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
    th: { padding: '7px 10px', background: 'var(--bg-secondary)', color: 'var(--text-tertiary)', fontWeight: 600, textAlign: 'left' as const, borderBottom: '1px solid var(--border-primary)' },
    td: { padding: '8px 10px', borderBottom: '1px solid var(--border-primary)', color: 'var(--text-secondary)', verticalAlign: 'top' as const },
    code: { display: 'block', background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontFamily: 'monospace', color: 'var(--text-primary)', lineHeight: 1.7, margin: '8px 0', whiteSpace: 'pre' as const },
    badge: (color: string) => ({ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: `${color}18`, color, marginLeft: 6 }),
    note: { fontSize: 13, color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 14px', lineHeight: 1.7, marginTop: 8 },
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div style={S.header}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>2026년 6월 페이지 설계 근거</div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>전략의 배경·로직·모니터링 방법 전체 설명</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--bg-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MIcon name="close" size={18} style={{ color: 'var(--text-tertiary)' }} />
          </button>
        </div>

        {/* 본문 */}
        <div style={S.body}>

          {/* 1. 왜 여름 인컴 전략인가 */}
          <div style={S.section}>
            <h2 style={S.h2}>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: '#6366f118', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#6366f1', flexShrink: 0 }}>1</span>
              왜 "여름 인컴 전략"인가?
            </h2>
            <p style={S.p}>
              5월 페이지의 핵심 메시지는 <b style={{ color: 'var(--text-primary)' }}>Sell in May</b> — 고위험 자산을 정리하는 매도 전략이었습니다. 6월은 그 다음 단계로, 매도 후 방어 포지션을 유지하며 배당을 수취하는 구간입니다.
            </p>
            <div style={S.code}>{`계절성 근거 (Sell in May and Go Away)

11월~4월: 주식 수익률 높음  (S&P500 기준 약 +6~7%/기간)
5월~10월: 주식 수익률 낮음  (약 +1~2%/기간)

→ 6월은 "낮은 기대 수익" 구간의 한복판
→ 무리한 매수보다 수취(인컴) 전략이 유리`}</div>
          </div>

          {/* 2. 섹션별 설계 근거 */}
          <div style={S.section}>
            <h2 style={S.h2}>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: '#3b82f618', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#3b82f6', flexShrink: 0 }}>2</span>
              섹션별 설계 근거
            </h2>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>섹션</th>
                  <th style={S.th}>근거</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['현재 자산군 비중', '실제 accounts + prices 실시간 계산. 5월 매도 후 커버드콜+채권+금 ≥ 50% 달성 여부 확인용.'],
                  ['잔존 고위험 종목', 'sellEngine의 getSellDecision 통과 — 상승 추세 종목은 자동 제외(hold 필터). 실제로 팔아야 할 것만 표시.'],
                  ['6월 배당 캘린더', '보유 ETF별 배당 주기 정리. 498400은 매월 15일, 472150·480040·483280·0036D0은 월말 분배 구조. ("위클리"는 옵션 롤오버 주기이며 배당 주기 아님)'],
                  ['월중 체크리스트', 'FOMC 6/17~18 실제 일정 반영. 6월을 3주 단위로 나눠 시간 민감도 높은 항목 순서 정렬.'],
                ].map(([s, r], i) => (
                  <tr key={i}>
                    <td style={{ ...S.td, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{s}</td>
                    <td style={S.td}>{r}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 3. 퀀트 탭 근거 */}
          <div style={S.section}>
            <h2 style={S.h2}>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: '#22c55e18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#22c55e', flexShrink: 0 }}>3</span>
              퀀트투자 탭 — 6월 신호의 근거
            </h2>
            <p style={S.p}><b style={{ color: 'var(--text-primary)' }}>반도체 6M 수익률 +137% → +98%로 낮아진 이유</b></p>
            <div style={S.code}>{`5월 기준 6M 창: 2025년 11월 ~ 2026년 5월
6월 기준 6M 창: 2025년 12월 ~ 2026년 6월

2025년 11월이 창에서 빠지면서
→ 당시 반도체 급등 구간이 제외
→ 절대값은 낮아지지만 1위는 유지`}</div>
            <p style={{ ...S.p, marginTop: 10 }}><b style={{ color: 'var(--text-primary)' }}>전략 충돌 해소 판정</b></p>
            <p style={S.p}>
              5월은 "Sell in May(매도) vs 모멘텀(보유)" 충돌이었는데, 6월은 계절성도 "보수적 유지", 모멘텀도 "보유" — 방향이 같습니다.
              충돌이 없으면 더 단호하게 홀드할 수 있어 의사결정 혼란이 줄어듭니다.
            </p>
          </div>

          {/* 4. 모멘텀 크래시 감지 위치 */}
          <div style={S.section}>
            <h2 style={S.h2}>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: '#ef444418', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#ef4444', flexShrink: 0 }}>4</span>
              모멘텀 크래시 감지 — 사이트 내 위치
            </h2>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>위치</th>
                  <th style={S.th}>경로</th>
                  <th style={S.th}>특징</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['퀀트 대시보드', '사이드바 지표 섹션 → 퀀트 대시보드', '메인. 37개 ETF 전체 스캔. 수동 갱신 버튼 있음.'],
                  ['2026년 5월 · 6월', '해당 월 페이지 → 퀀트투자 탭', '요약본. 경고·위험 종목만 최대 8개 필터링 표시.'],
                ].map(([loc, path, feat], i) => (
                  <tr key={i}>
                    <td style={{ ...S.td, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{loc}</td>
                    <td style={S.td}>{path}</td>
                    <td style={S.td}>{feat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ ...S.p, marginTop: 12 }}><b style={{ color: 'var(--text-primary)' }}>신호 판정 로직</b></p>
            <div style={S.code}>{`green  (상승 유지): 3M > 0  이고  6M > 0
yellow (경고):      위 조건 미충족 (혼재 또는 약세)
red    (크래시):    3M < -5%,  또는  3M < 0 이고 6M < -10%`}</div>
            <div style={S.note}>
              ⚠️ <b>후행 지표 주의:</b> 3M·6M은 후행 지표입니다. 크래시 초반엔 green → yellow로만 보이다 red로 늦게 전환될 수 있습니다.<br />
              갱신 주기: Worker KV 자동 갱신 매일 KST 12:00 · 장중 급변 시 퀀트 대시보드 수동 갱신으로 보완하세요.
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── 퀀트투자 탭 ──────────────────────────────────────────────────────────────

function CheckItem({ done, children }: { done?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--border-primary)' }}>
      <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${done ? '#22c55e' : 'var(--border-primary)'}`, background: done ? '#22c55e18' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        {done && <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 800 }}>✓</span>}
      </div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

function Row({ label, val, valColor, sub }: { label: string; val: string; valColor?: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border-primary)' }}>
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
    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: `${color}18`, color, marginRight: 6, marginBottom: 4 }}>
      {children}
    </span>
  );
}

function QuantTabJun({ isMobile, pad, crashItems, crashUpdatedAt, crashLoading }: {
  isMobile: boolean; pad: number;
  crashItems: CrashItem[]; crashUpdatedAt: string | null; crashLoading: boolean;
}) {
  const { navigateTo } = useAppContext();
  const [allocMode, setAllocMode] = useState<'top1' | 'proportional'>('top1');

  // 5월 말 리밸런싱 기준 6M 수익률 (업데이트 필요 시 수동 수정)
  const ASSETS = [
    { rank: 1, name: '반도체',    ticker: '091160', r6m: 98.4  },
    { rank: 2, name: '코스피200', ticker: '069500', r6m: 71.2  },
    { rank: 3, name: '코스닥150', ticker: '229200', r6m: 28.1  },
    { rank: 4, name: '나스닥100', ticker: '133690', r6m: 15.6  },
    { rank: 5, name: 'S&P500',   ticker: '360750', r6m: 12.3  },
    { rank: 6, name: '금',        ticker: '411060', r6m: 8.7   },
    { rank: 7, name: '미국장기채',ticker: '305080', r6m: 1.2   },
  ];
  const totalR = ASSETS.reduce((s, a) => s + a.r6m, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* 6월 신호 요약 */}
      <div className="toss-card" style={{ padding: pad }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <MIcon name="sensors" size={18} style={{ color: '#22c55e' }} />
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>2026년 6월 듀얼 모멘텀 신호</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: isMobile ? 12 : 0 }}>
          {[
            { label: '1위 자산', val: '반도체', sub: '091160', color: '#22c55e' },
            { label: '6M 수익률', val: '+98.4%', sub: '5월 말 기준 재산출', color: '#f97316' },
            { label: '시장 국면', val: '강세장', sub: '절대 모멘텀 양(+)', color: '#22c55e' },
            { label: '다음 리밸런싱', val: '6월 말', sub: '월말 수익률 재산출', color: 'var(--text-primary)' },
          ].map((s, i) => (
            <div key={s.label} style={{ padding: isMobile ? '0' : '0 16px', borderLeft: (!isMobile && i > 0) ? '1px solid var(--border-primary)' : undefined }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: s.color, marginBottom: 2 }}>{s.val}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{s.sub}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(34,197,94,.06)', borderRadius: 8, border: '1px solid rgba(34,197,94,.2)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <strong style={{ color: '#22c55e' }}>5월 대비 변화:</strong> 반도체 6M 수익률이 +137% → +98%로 조정됐지만 1위 유지. 6M 창이 한 달 롤링되며 2025년 11월 급등 구간이 빠진 효과. <strong style={{ color: 'var(--text-primary)' }}>보유 유지 원칙 적용.</strong>
        </div>
      </div>

      {/* 전략 충돌 해소 */}
      <div className="toss-card" style={{ padding: pad }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <MIcon name="bolt" size={18} style={{ color: 'var(--accent-blue)' }} />
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>6월: 계절성 전략과 모멘텀의 동조</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div style={{ background: 'rgba(99,102,241,.05)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: '#6366f1', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
              <MIcon name="calendar_today" size={14} />여름 계절성 관점
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              6~9월은 거래량 감소 + 횡보 구간<br />
              커버드콜·채권 중심 방어 포지션 유지
            </div>
          </div>
          <div style={{ background: 'rgba(34,197,94,.05)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: '#22c55e', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
              <MIcon name="show_chart" size={14} />퀀트 모멘텀 관점
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              반도체 +98% — 여전히 1위<br />
              신호 유지 중 → 보유 원칙 준수
            </div>
          </div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: '12px 14px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <strong style={{ color: '#22c55e' }}>6월 결론:</strong> 5월과 달리 두 전략의 충돌이 완화됐습니다. 계절성 전략은 "보수적 유지", 모멘텀은 "반도체 보유 유지" — 방향이 같습니다. <strong style={{ color: 'var(--text-primary)' }}>크래시 신호 없으면 홀드.</strong>
        </div>
      </div>

      {/* 6월 퀀트 액션 플랜 */}
      <div className="toss-card" style={{ padding: pad }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <MIcon name="my_location" size={18} style={{ color: '#22c55e' }} />
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>6월 퀀트 액션 플랜</h2>
        </div>
        {[
          { num: 1, color: '#22c55e', title: '반도체 ETF (091160) 보유 유지', detail: '5월 말 1위 유지 확인. 크래시 신호 없는 한 홀드 원칙. 추가 매수보다 현 비중 유지.', tag: '유지' },
          { num: 2, color: '#6366f1', title: '커버드콜 ETF 월 배당 수취', detail: '498400 매월 15일, 472150·480040·483280 월말 배당 확인. 수령 후 단기채 또는 커버드콜 재투자.', tag: '매월' },
          { num: 3, color: '#f97316', title: '크래시 탐지 주 2회 이상 점검', detail: '퀀트 대시보드 → 모멘텀 크래시 감지. 반도체 3M 수익률 -5% 이하 적색 출현 시 즉시 전량 매도 → 단기채(153130).', tag: '상시' },
          { num: 4, color: '#3b82f6', title: '6월 말 7대 자산 수익률 재산출', detail: '6월 마지막 거래일 7개 자산 6M 수익률 재계산. 1위 자산 교체 여부 확인 → 7월 전략 결정.', tag: '6월 말' },
          { num: 5, color: '#f59e0b', title: '반기 리뷰 — 연초 대비 성과 집계', detail: '2026년 1~6월 총 수익률·배당 합산. 목표 대비 달성률 확인. 하반기 전략 방향 수립 근거로 활용.', tag: '6월 말' },
        ].map((item, i, arr) => (
          <div key={item.num} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: i < arr.length - 1 ? 14 : 0, borderBottom: i < arr.length - 1 ? '1px solid var(--border-primary)' : 'none', marginBottom: i < arr.length - 1 ? 14 : 0 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: `${item.color}22`, color: item.color, fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{item.num}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{item.title}</span>
                <Tag color={item.color}>{item.tag}</Tag>
                {item.num === 3 && (
                  <button
                    onClick={() => navigateTo('quant-dashboard')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(249,115,22,0.35)', background: 'rgba(249,115,22,0.08)', color: '#f97316', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    <MIcon name="open_in_new" size={12} />
                    퀀트 대시보드
                  </button>
                )}
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
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>7대 자산 6M 수익률 순위 (6월 기준)</h2>
          </div>
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary)', borderRadius: 20, padding: 3 }}>
            {(['top1', 'proportional'] as const).map(mode => (
              <button key={mode} onClick={() => setAllocMode(mode)} style={{ padding: '4px 12px', borderRadius: 16, fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all .15s', background: allocMode === mode ? 'var(--accent-blue)' : 'transparent', color: allocMode === mode ? '#fff' : 'var(--text-tertiary)' }}>
                {mode === 'top1' ? '집중 투자' : '비례 배분'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 12, padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 6 }}>
          {allocMode === 'top1' ? '집중 투자: 1위 자산 100%. 나머지 단기채 보관.' : '비례 배분: 6M 수익률 비례 분산 투자.'}
        </div>
        {ASSETS.map((row, i) => {
          const propPct = Math.round(row.r6m / totalR * 1000) / 10;
          const isTop1 = allocMode === 'top1';
          const targetPct = isTop1 ? (row.rank === 1 ? 100 : 0) : propPct;
          const isHold = isTop1 ? row.rank === 1 : true;
          const color = isHold ? '#22c55e' : '#ef4444';
          const barWidth = isTop1 ? (row.rank === 1 ? 100 : 0) : (propPct / (98.4 / totalR * 100) * 100);
          return (
            <div key={row.ticker} style={{ padding: '10px 0', borderBottom: i < 6 ? '1px solid var(--border-primary)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                <div style={{ width: 22, fontSize: 12, fontWeight: 700, flexShrink: 0, color: row.rank === 1 ? '#22c55e' : 'var(--text-tertiary)' }}>{row.rank}위</div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: isHold ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{row.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-quaternary)', marginLeft: 6 }}>{row.ticker}</span>
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', width: 56, textAlign: 'right' }}>+{row.r6m}%</div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color, width: isMobile ? 52 : 68, textAlign: 'right' }}>{targetPct}%</div>
              </div>
              <div style={{ height: 4, background: 'var(--bg-secondary)', borderRadius: 2, marginLeft: 32, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(barWidth, 100)}%`, background: isHold ? '#22c55e' : 'var(--border-primary)', transition: 'width .4s ease' }} />
              </div>
            </div>
          );
        })}
        <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', lineHeight: 1.7 }}>
          {allocMode === 'top1' ? <><strong style={{ color: '#ef4444' }}>0% 자산</strong>은 단기채권(153130)으로 보관 · 6월 말 수익률 재산출 후 교체 여부 결정</> : <>비례 배분은 6월 말 수익률 재산출 후 비중 조정</>}
        </div>
      </div>

      {/* 모멘텀 크래시 감지 */}
      {(() => {
        const withSig = crashItems.map(d => ({ ...d, sig: crashSignal(d) }));
        const counts = { green: 0, yellow: 0, red: 0 };
        withSig.forEach(d => { counts[d.sig]++; });
        const fmtR = (v: number | null) => v === null ? 'N/A' : (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
        const redYellow = withSig.filter(d => d.sig === 'red' || d.sig === 'yellow').sort((a, b) => (a.r3m ?? 0) - (b.r3m ?? 0)).slice(0, 8);
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
            {crashLoading ? (
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', padding: '8px 0' }}>신호 불러오는 중…</div>
            ) : redYellow.length === 0 ? (
              <div style={{ fontSize: 'var(--text-sm)', color: '#34d399', padding: '8px 0' }}>전 종목 상승 유지 — 이상 신호 없음</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 2 }}>경고·위험 종목 (3M 수익률 낮은 순)</div>
                {redYellow.map(d => (
                  <div key={d.ticker} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, background: d.sig === 'red' ? 'rgba(248,113,113,.06)' : 'rgba(251,191,36,.06)', border: `1px solid ${d.sig === 'red' ? 'rgba(248,113,113,.25)' : 'rgba(251,191,36,.25)'}` }}>
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

      {/* 6월 퀀트 체크리스트 */}
      <div className="toss-card" style={{ padding: pad }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <MIcon name="checklist" size={18} style={{ color: '#22c55e' }} />
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>6월 퀀트 체크리스트</h2>
        </div>
        <div style={{ marginTop: 10 }}>
          <CheckItem><strong style={{ color: 'var(--text-primary)' }}>반도체(091160)</strong> 보유 유지 — 5월 말 기준 1위 확인 완료</CheckItem>
          <CheckItem><strong style={{ color: 'var(--text-primary)' }}>크래시 탐지</strong> 주 2회 이상 점검 (<span style={{ color: '#ef4444' }}>●</span> 적색 출현 시 즉시 매도 → 단기채)</CheckItem>
          <CheckItem><strong style={{ color: '#6366f1' }}>커버드콜 ETF 배당</strong> 수령 확인 및 재투자 실행</CheckItem>
          <CheckItem><strong style={{ color: '#f59e0b' }}>FOMC (6/17~18)</strong> 금리 결정 확인 — 채권·커버드콜 비중 재검토</CheckItem>
          <CheckItem><strong style={{ color: 'var(--text-primary)' }}>6월 말</strong> 7대 자산 6M 수익률 재산출 → 7월 1위 자산 결정</CheckItem>
          <CheckItem><strong style={{ color: 'var(--text-primary)' }}>반기 리뷰</strong> 총 수익률·배당 집계 → 하반기 전략 수립</CheckItem>
        </div>
      </div>

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
