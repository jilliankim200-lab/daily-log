import React, { useMemo, useState, useEffect } from 'react';
import { useAppContext } from '../App';
import { kvGet, saveAccounts } from '../api';
import { MIcon } from './MIcon';
import type { Account, Holding } from '../types';
import { fetchStockSignals, getSellSignal, getBuySignal } from '../utils/fetchStockSignals';
import type { StockSignal } from '../utils/fetchStockSignals';
import { fetchCurrentPricesWithChange } from '../utils/fetchPrices';

type SignalFilter = { type: 'sell' | 'buy'; label: string } | null;

// ── 유틸 ─────────────────────────────────────────────────────
type AssetClass = '주식' | '채권' | '커버드콜' | '금' | '기타';
const ASSET_COLORS: Record<AssetClass, string> = {
  주식: 'var(--asset-stock)', 채권: 'var(--asset-bond)', 커버드콜: 'var(--asset-covered)', 금: 'var(--asset-gold)', 기타: 'var(--asset-other)',
};

function hVal(h: Holding, prices: Record<string, number>): number {
  if (h.isFund) return h.amount || 0;
  const p = (h.ticker && prices[h.ticker]) ? prices[h.ticker] : h.avgPrice;
  return p * h.quantity;
}

function fmtKrw(n: number): string {
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억`;
  if (n >= 10_000) return `${Math.round(n / 10_000)}만`;
  return n.toLocaleString();
}

function classify(name: string): AssetClass {
  if (['커버드콜'].some(k => name.includes(k))) return '커버드콜';
  if (['국채', '채권', '단기채', '액티브'].some(k => name.includes(k))) return '채권';
  if (['금현물', 'KRX금'].some(k => name.includes(k))) return '금';
  if (['나스닥', 'S&P', '코스닥', '코스피', '반도체', 'AI', '인도', '배당',
       '고배당', '밸류체인', '미국', '글로벌', '200', '500', '30년국채'].some(k => name.includes(k))) return '주식';
  return '기타';
}

function isSafeAsset(cls: AssetClass): boolean {
  return cls === '채권' || cls === '금';
}

function isRetirementAcc(acc: Account): boolean {
  const t = acc.accountType;
  const a = acc.alias || acc.institution;
  return t.includes('퇴직연금') || t.includes('IRP') ||
    a.includes('퇴직') || a.includes('DC') || a.includes('DB') || a.includes('IRP');
}

function calcReturn(h: Holding, prices: Record<string, number>): number | null {
  if (h.isFund || !h.avgPrice || h.avgPrice === 0) return null;
  const cur = (h.ticker && prices[h.ticker]) ? prices[h.ticker] : null;
  if (!cur) return null;
  return ((cur - h.avgPrice) / h.avgPrice) * 100;
}

function accPriority(acc: Account): number {
  const t = acc.accountType;
  if (t.includes('IRP')) return 5;
  if (t.includes('퇴직연금')) return 4;
  if (t.includes('연금저축')) return 3;
  if (t.includes('ISA')) return 2;
  return 1;
}

function accLabel(acc: Account): string {
  return `${acc.ownerName} · ${acc.alias || acc.institution}`;
}

// ── 계좌별 플랜 ────────────────────────────────────────────────
interface SellItem {
  h: Holding;
  val: number;
  cls: AssetClass;
  ret: number | null;
  reason: string;
  reasonDetail: string;
}

interface BuyItem {
  h: Holding;
  cls: AssetClass;
  currentVal: number;
  addAmount: number;  // 추가 매수 금액
  shares: number | null; // 추가 매수 주수 (펀드는 null)
  price: number | null;  // 현재가
}

interface AccountPlan {
  acc: Account;
  sells: SellItem[];
  keeps: { h: Holding; val: number; cls: AssetClass; ret: number | null; isHighReturn: boolean; keepReason: string }[];
  buys: BuyItem[];
  freedCash: number;       // 매도 현금 + 기존 현금
  currentSafePct: number;
  projectedSafePct: number;
  safeStatus: 'under' | 'good' | 'over' | 'na';
  safeAdjust: { action: string; amount: number } | null;
  totalVal: number;
}

// ── 타이밍 신호 (MA/고저점 기반) ────────────────────────────────
function noSignal() {
  return { label: '–', color: 'var(--text-tertiary)', desc: '시세 데이터 로딩 중...' };
}

function fmtP(n: number): string {
  if (n >= 10_000) return `${(n / 10_000).toFixed(2)}만`;
  return Math.round(n).toLocaleString();
}

function TimingBadge({ timing }: { timing: { label: string; color: string; desc: string; range?: [number, number] } }) {
  const [show, setShow] = useState(false);
  const hasRange = timing.range && timing.range[0] > 0 && timing.range[1] > 0;
  const rMin = hasRange ? Math.min(timing.range![0], timing.range![1]) : 0;
  const rMax = hasRange ? Math.max(timing.range![0], timing.range![1]) : 0;
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'default',
        background: `color-mix(in srgb, ${timing.color} var(--badge-mix), transparent)`,
        borderRadius: 5, padding: hasRange ? '2px 6px 3px' : '2px 6px' }}>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: timing.color, whiteSpace: 'nowrap' }}>
          {timing.label}
        </span>
        {hasRange && (
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: timing.color, marginTop: 1, whiteSpace: 'nowrap' }}>
            {rMin === rMax ? fmtP(rMin) : `${fmtP(rMin)}~${fmtP(rMax)}`}
          </span>
        )}
      </div>
      {show && (
        <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', right: 0, zIndex: 300,
          background: 'var(--bg-tooltip)', border: '1px solid var(--border-tooltip)',
          borderRadius: 10, padding: '9px 14px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)',
          width: 280, lineHeight: 1.55, boxShadow: 'var(--shadow-tooltip)',
          whiteSpace: 'normal', wordBreak: 'keep-all', overflowWrap: 'break-word' }}>
          {timing.desc}
        </div>
      )}
    </div>
  );
}

// ── 행 컴포넌트 ───────────────────────────────────────────────
function Row({ badge, badgeColor, name, cls, ret, amount, note, dim, extra, badgeTip, ticker, onNameClick }: {
  badge: string; badgeColor: string; name: string; cls?: AssetClass;
  ret?: number | null; amount?: number; note?: string; dim?: boolean; extra?: React.ReactNode; badgeTip?: string;
  ticker?: string; onNameClick?: (ticker: string, name: string) => void;
}) {
  const [showTip, setShowTip] = useState(false);
  const [tipAlign, setTipAlign] = useState<'left' | 'right'>('left');
  const [nameHover, setNameHover] = useState(false);
  const badgeRef = React.useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (!badgeTip) return;
    if (badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect();
      setTipAlign(rect.left + 320 > window.innerWidth ? 'right' : 'left');
    }
    setShowTip(true);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', opacity: dim ? 0.55 : 1 }}>
      <div ref={badgeRef} style={{ position: 'relative', flexShrink: 0, paddingTop: 1 }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowTip(false)}>
        <span style={{ fontSize: 'var(--text-sm)', padding: '2px 8px', borderRadius: 6, fontWeight: 600, display: 'block',
          minWidth: 44, textAlign: 'center', cursor: badgeTip ? 'help' : 'default',
          background: `color-mix(in srgb, ${badgeColor} var(--badge-mix), transparent)`, color: badgeColor }}>
          {badge}
        </span>
        {showTip && badgeTip && (
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', zIndex: 300,
            ...(tipAlign === 'right' ? { right: 0 } : { left: 0 }),
            minWidth: 240, maxWidth: 300,
            background: 'var(--bg-tooltip)', border: '1px solid var(--border-tooltip)',
            borderRadius: 8, padding: '8px 12px', fontSize: 'var(--text-xs)', color: 'var(--text-primary)',
            lineHeight: 1.7, boxShadow: 'var(--shadow-tooltip)', whiteSpace: 'pre-wrap', wordBreak: 'keep-all' }}>
            {badgeTip}
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <span
            onClick={ticker && onNameClick ? () => onNameClick(ticker, name) : undefined}
            onMouseEnter={ticker && onNameClick ? () => setNameHover(true) : undefined}
            onMouseLeave={ticker && onNameClick ? () => setNameHover(false) : undefined}
            style={{ fontSize: 'var(--text-base)', color: dim ? 'var(--text-tertiary)' : 'var(--text-primary)', fontWeight: 600,
              textDecoration: dim ? 'line-through' : 'none',
              cursor: ticker && onNameClick ? 'pointer' : 'default',
              background: nameHover && ticker && onNameClick ? 'var(--bg-tertiary)' : 'transparent',
              borderRadius: 4, padding: '1px 4px', margin: '-1px -4px',
            }}>{name}</span>
          {cls && <span style={{ fontSize: 'var(--text-xs)', padding: '1px 5px', borderRadius: 4,
            background: `color-mix(in srgb, ${ASSET_COLORS[cls]} var(--badge-mix), transparent)`, color: ASSET_COLORS[cls] }}>{cls}</span>}
        </div>
        {(ret != null || amount != null || note) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
            {ret != null && (
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700,
                color: ret >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                {ret >= 0 ? '+' : ''}{ret.toFixed(1)}%
              </span>
            )}
            {amount != null && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{fmtKrw(amount)}</span>
            )}
            {note && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{note}</span>}
          </div>
        )}
      </div>
      {extra && <div style={{ flexShrink: 0 }}>{extra}</div>}
    </div>
  );
}


// ── 계좌 세율 ──────────────────────────────────────────────────
function accTaxRate(acc: Account): number {
  const t = acc.accountType;
  if (t.includes('IRP') || t.includes('퇴직연금')) return 0.055;   // 연금소득세 5.5%
  if (t.includes('연금저축')) return 0.055;
  if (t.includes('ISA')) return 0.099;                              // 9.9%
  return 0.154;                                                     // 일반 배당소득세 15.4%
}

const WORKER_URL_OG = 'https://asset-dashboard-api.jilliankim200.workers.dev';

// ── 시뮬레이션 비교 패널 ──────────────────────────────────────────
function ComparisonPanel({ accounts, prices, plans, targets }: {
  accounts: Account[]; prices: Record<string, number>;
  plans: AccountPlan[]; targets: TargetAllocation;
}) {
  type BacktestItem = { name: string; ticker: string; cls: AssetClass; weight: number; ret: number };
  const [backtest, setBacktest] = useState<{
    loading: boolean;
    items: BacktestItem[];
    currentRet: number; targetRet: number;
    currentAmount: number; targetAmount: number;
    totalAssets: number;
  } | null>(null);

  const metrics = useMemo(() => {
    // Before: 현재 상태
    const beforeByClass: Record<AssetClass, number> = { 주식: 0, 채권: 0, 커버드콜: 0, 금: 0, 기타: 0 };
    let totalHoldings = 0;
    let totalAssets = 0;
    for (const acc of accounts) {
      totalHoldings += acc.holdings.length;
      totalAssets += (acc.cash || 0);
      for (const h of acc.holdings) {
        const v = hVal(h, prices);
        beforeByClass[classify(h.name)] += v;
        totalAssets += v;
      }
    }
    const duplicates = plans.reduce((s, p) => s + p.sells.length, 0);

    // 퇴직 안전자산 (현재)
    let beforeSafePct = 0;
    let beforeSafeCount = 0;
    for (const p of plans) {
      if (isRetirementAcc(p.acc)) { beforeSafeCount++; beforeSafePct += p.currentSafePct; }
    }
    if (beforeSafeCount > 0) beforeSafePct /= beforeSafeCount;

    // After: 가이드 실행 후
    const afterByClass: Record<AssetClass, number> = { 주식: 0, 채권: 0, 커버드콜: 0, 금: 0, 기타: 0 };
    let afterHoldings = 0;
    for (const p of plans) {
      afterHoldings += p.keeps.length;
      for (const k of p.keeps) {
        const buyAdd = p.buys.find(b => b.h.id === k.h.id)?.addAmount ?? 0;
        afterByClass[k.cls] += k.val + buyAdd;
      }
    }

    let afterSafePct = 0;
    let afterSafeCount = 0;
    for (const p of plans) {
      if (isRetirementAcc(p.acc)) { afterSafeCount++; afterSafePct += p.projectedSafePct; }
    }
    if (afterSafeCount > 0) afterSafePct /= afterSafeCount;

    // ── 1. 절세 효과 ──
    // 중복 매도 대상 종목의 배당에 대한 세율 차이 절감
    const AVG_DIVIDEND_YIELD = 0.03; // 보수적 3%
    let taxSavings = 0;
    for (const p of plans) {
      const accRate = accTaxRate(p.acc);
      for (const s of p.sells) {
        // 이 종목이 유지되는 계좌(winner)의 세율 찾기
        let winnerRate = accRate;
        for (const op of plans) {
          if (op.keeps.some(k => (k.h.ticker || k.h.name) === (s.h.ticker || s.h.name))) {
            winnerRate = accTaxRate(op.acc);
            break;
          }
        }
        if (accRate > winnerRate) {
          taxSavings += s.val * AVG_DIVIDEND_YIELD * (accRate - winnerRate);
        }
      }
    }

    // ── 2. 비중 준수율 ──
    const classes: AssetClass[] = ['주식', '채권', '커버드콜', '금', '기타'];
    const beforeDrift = classes.reduce((s, cls) => {
      const pct = totalAssets > 0 ? beforeByClass[cls] / totalAssets * 100 : 0;
      return s + Math.abs(pct - targets[cls]);
    }, 0);
    const afterTotal = Object.values(afterByClass).reduce((a, b) => a + b, 0);
    const afterDrift = classes.reduce((s, cls) => {
      const pct = afterTotal > 0 ? afterByClass[cls] / afterTotal * 100 : 0;
      return s + Math.abs(pct - targets[cls]);
    }, 0);
    // 100점 만점 (drift 0 = 100점, drift 100 = 0점)
    const beforeScore = Math.max(0, Math.round(100 - beforeDrift * 2));
    const afterScore = Math.max(0, Math.round(100 - afterDrift * 2));

    return {
      totalHoldings, afterHoldings, duplicates, totalAssets,
      beforeByClass, afterByClass, beforeSafePct, afterSafePct,
      hasSafe: beforeSafeCount > 0, taxSavings,
      beforeScore, afterScore, beforeDrift, afterDrift,
    };
  }, [accounts, prices, plans, targets]);

  // ── 3. 백테스트 (전체 보유종목) ──
  const runBacktest = async () => {
    setBacktest({ loading: true, items: [], currentRet: 0, targetRet: 0, currentAmount: 0, targetAmount: 0, totalAssets: 0 });
    try {
      // 전체 보유종목 수집 (ticker 기준 합산)
      const holdingMap = new Map<string, { name: string; ticker: string; cls: AssetClass; val: number }>();
      for (const acc of accounts) {
        for (const h of acc.holdings) {
          if (!h.ticker) continue;
          const key = h.ticker;
          const existing = holdingMap.get(key);
          if (existing) {
            existing.val += hVal(h, prices);
          } else {
            holdingMap.set(key, { name: h.name, ticker: h.ticker, cls: classify(h.name), val: hVal(h, prices) });
          }
        }
      }
      const holdings = [...holdingMap.values()];
      const totalAssets = holdings.reduce((s, h) => s + h.val, 0);
      if (totalAssets <= 0) { setBacktest(null); return; }

      // 전 종목 1년 일별 종가 fetch
      const chartData: Record<string, { date: string; price: number }[]> = {};
      const batchSize = 5;
      for (let i = 0; i < holdings.length; i += batchSize) {
        const batch = holdings.slice(i, i + batchSize);
        await Promise.all(batch.map(async h => {
          try {
            const res = await fetch(`${WORKER_URL_OG}/stock-chart/${h.ticker}?days=250`);
            if (res.ok) chartData[h.ticker] = await res.json();
          } catch {}
        }));
      }

      // 종목별 1년 수익률 계산
      const items: BacktestItem[] = [];
      const classReturns: Record<AssetClass, { totalVal: number; weightedRet: number }> = {
        주식: { totalVal: 0, weightedRet: 0 }, 채권: { totalVal: 0, weightedRet: 0 },
        커버드콜: { totalVal: 0, weightedRet: 0 }, 금: { totalVal: 0, weightedRet: 0 },
        기타: { totalVal: 0, weightedRet: 0 },
      };

      for (const h of holdings) {
        const data = chartData[h.ticker];
        let ret = 0;
        if (data && data.length >= 2) {
          const first = data[0].price;
          const last = data[data.length - 1].price;
          ret = first > 0 ? (last - first) / first : 0;
        }
        const weight = h.val / totalAssets;
        items.push({ name: h.name, ticker: h.ticker, cls: h.cls, weight, ret });
        classReturns[h.cls].totalVal += h.val;
        classReturns[h.cls].weightedRet += h.val * ret;
      }

      // 현재 비중 수익률 = 종목별 (비중 × 수익률) 합산
      const currentRet = items.reduce((s, it) => s + it.weight * it.ret, 0);

      // 목표 비중 수익률 = 클래스별 (목표비중 × 클래스 평균수익률) 합산
      const classes: AssetClass[] = ['주식', '채권', '커버드콜', '금', '기타'];
      let targetRet = 0;
      for (const cls of classes) {
        const cr = classReturns[cls];
        const clsAvgRet = cr.totalVal > 0 ? cr.weightedRet / cr.totalVal : 0;
        targetRet += (targets[cls] / 100) * clsAvgRet;
      }

      items.sort((a, b) => b.weight - a.weight);

      setBacktest({
        loading: false, items,
        currentRet: Math.round(currentRet * 1000) / 10,
        targetRet: Math.round(targetRet * 1000) / 10,
        currentAmount: Math.round(totalAssets * currentRet),
        targetAmount: Math.round(totalAssets * targetRet),
        totalAssets,
      });
    } catch (err) {
      console.error('백테스트 실패:', err);
      setBacktest(null);
    }
  };

  const m = metrics;
  const classes: AssetClass[] = ['주식', '채권', '커버드콜', '금', '기타'];

  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, padding: '16px 18px', marginBottom: 18,
      border: '1px solid var(--border-primary)' }}>
      <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
        <MIcon name="compare_arrows" size={16} style={{ color: 'var(--accent-blue)' }} />
        시뮬레이션 비교
      </div>

      {/* 종목 수 / 중복 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, marginBottom: 14, alignItems: 'center' }}>
        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 4, fontWeight: 600 }}>현재</div>
          <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>{m.totalHoldings}개 종목</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-loss)', fontWeight: 600 }}>중복 {m.duplicates}개</div>
        </div>
        <MIcon name="arrow_forward" size={20} style={{ color: 'var(--text-tertiary)' }} />
        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 4, fontWeight: 600 }}>실행 후</div>
          <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-profit)' }}>{m.afterHoldings}개 종목</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-profit)', fontWeight: 600 }}>중복 0개</div>
        </div>
      </div>

      {/* 자산 클래스 비중 비교 */}
      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>자산 클래스 비중 변화</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: '4px 12px', fontSize: 'var(--text-sm)', marginBottom: 14 }}>
        <span style={{ fontWeight: 600, color: 'var(--text-tertiary)' }}></span>
        <span style={{ fontWeight: 600, color: 'var(--text-tertiary)', textAlign: 'right' }}>현재</span>
        <span style={{ fontWeight: 600, color: 'var(--text-tertiary)', textAlign: 'right' }}>실행 후</span>
        <span style={{ fontWeight: 600, color: 'var(--text-tertiary)', textAlign: 'right' }}>목표</span>
        {classes.map(cls => {
          const bPct = m.totalAssets > 0 ? m.beforeByClass[cls] / m.totalAssets * 100 : 0;
          const aPct = m.totalAssets > 0 ? m.afterByClass[cls] / m.totalAssets * 100 : 0;
          const tPct = targets[cls];
          const improved = Math.abs(aPct - tPct) < Math.abs(bPct - tPct);
          return (
            <React.Fragment key={cls}>
              <span style={{ fontWeight: 600, color: ASSET_COLORS[cls] }}>{cls}</span>
              <span style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{bPct.toFixed(1)}%</span>
              <span style={{ textAlign: 'right', fontWeight: 600, color: improved ? 'var(--color-profit)' : 'var(--text-secondary)' }}>{aPct.toFixed(1)}%</span>
              <span style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>{tPct}%</span>
            </React.Fragment>
          );
        })}
      </div>

      {/* 퇴직 안전자산 */}
      {m.hasSafe && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center', marginBottom: 14 }}>
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>퇴직 안전자산</div>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: m.beforeSafePct < 30 ? 'var(--color-loss)' : 'var(--color-profit)' }}>{m.beforeSafePct.toFixed(1)}%</div>
          </div>
          <MIcon name="arrow_forward" size={16} style={{ color: 'var(--text-tertiary)' }} />
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>퇴직 안전자산</div>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: m.afterSafePct >= 30 && m.afterSafePct <= 35 ? 'var(--color-profit)' : 'var(--color-warning)' }}>{m.afterSafePct.toFixed(1)}%</div>
          </div>
        </div>
      )}

      {/* ── 1. 절세 효과 ── */}
      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <MIcon name="savings" size={15} style={{ color: 'var(--color-profit)' }} />
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>절세 효과</span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>배당수익률 3% 기준 추정</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: m.taxSavings > 0 ? 'var(--color-profit)' : 'var(--text-secondary)' }}>
            {m.taxSavings > 0 ? `연 ${fmtKrw(Math.round(m.taxSavings))}` : '절세 대상 없음'}
          </span>
          {m.taxSavings > 0 && (
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>절감 (세율 차이 × 중복 매도 금액)</span>
          )}
        </div>
        {m.taxSavings > 0 && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.6 }}>
            일반(15.4%) → 연금/IRP(5.5%) 이동 시 배당세 약 10%p 절감<br />
            일반(15.4%) → ISA(9.9%) 이동 시 약 5.5%p 절감
          </div>
        )}
      </div>

      {/* ── 2. 비중 준수율 ── */}
      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <MIcon name="target" size={15} style={{ color: 'var(--accent-blue)' }} />
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>목표 비중 준수율</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: m.beforeScore >= 80 ? 'var(--color-profit)' : m.beforeScore >= 60 ? 'var(--color-warning)' : 'var(--color-loss)' }}>
              {m.beforeScore}<span style={{ fontSize: 'var(--text-base)' }}>점</span>
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>현재</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>편차 {m.beforeDrift.toFixed(1)}%p</div>
          </div>
          <MIcon name="arrow_forward" size={20} style={{ color: 'var(--text-tertiary)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: m.afterScore >= 80 ? 'var(--color-profit)' : m.afterScore >= 60 ? 'var(--color-warning)' : 'var(--color-loss)' }}>
              {m.afterScore}<span style={{ fontSize: 'var(--text-base)' }}>점</span>
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>실행 후</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>편차 {m.afterDrift.toFixed(1)}%p</div>
          </div>
        </div>
        {m.afterScore > m.beforeScore && (
          <div style={{ textAlign: 'center', marginTop: 8, fontSize: 'var(--text-sm)', color: 'var(--color-profit)', fontWeight: 600 }}>
            +{m.afterScore - m.beforeScore}점 개선
          </div>
        )}
      </div>

      {/* ── 3. 백테스트 ── */}
      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <MIcon name="query_stats" size={15} style={{ color: 'var(--color-warning)' }} />
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>과거 1년 백테스트</span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>보유 종목 전체 시세 기반</span>
        </div>
        {!backtest ? (
          <div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginBottom: 8, lineHeight: 1.6 }}>
              보유 중인 <strong style={{ color: 'var(--text-secondary)' }}>모든 종목</strong>의 지난 1년 실제 시세를 가져와서,
              "지금 비중 그대로 두었을 때" vs "목표 비중대로 리밸런싱했을 때" 수익을 비교합니다.
            </div>
            <button onClick={runBacktest}
              style={{ fontSize: 'var(--text-sm)', padding: '6px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                border: '1px solid var(--accent-blue)', background: 'color-mix(in srgb, var(--accent-blue) 10%, transparent)',
                color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <MIcon name="play_arrow" size={14} style={{ color: 'var(--accent-blue)' }} />
              백테스트 실행
            </button>
          </div>
        ) : backtest.loading ? (
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <MIcon name="sync" size={14} style={{ color: 'var(--text-tertiary)' }} />
            전체 보유종목 1년 시세 분석 중...
          </div>
        ) : (
          <div>
            {/* 요약: 수익률 + 금액 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 4 }}>현재 비중 유지</div>
                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: backtest.currentRet >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                  {backtest.currentRet >= 0 ? '+' : ''}{backtest.currentRet}%
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {backtest.currentAmount >= 0 ? '+' : ''}{fmtKrw(backtest.currentAmount)}
                </div>
              </div>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', fontWeight: 600 }}>vs</span>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 4 }}>목표 비중 리밸런싱</div>
                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: backtest.targetRet >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                  {backtest.targetRet >= 0 ? '+' : ''}{backtest.targetRet}%
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {backtest.targetAmount >= 0 ? '+' : ''}{fmtKrw(backtest.targetAmount)}
                </div>
              </div>
            </div>

            {/* 해석 */}
            {(() => {
              const diff = backtest.targetAmount - backtest.currentAmount;
              const better = diff > 0 ? '목표 비중' : '현재 비중';
              const absDiff = Math.abs(diff);
              return (
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 'var(--text-sm)', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                  {diff !== 0 ? (
                    <>
                      1년 전에 총 자산 <strong>{fmtKrw(backtest.totalAssets)}</strong>을{' '}
                      <strong style={{ color: diff > 0 ? 'var(--color-profit)' : 'var(--text-primary)' }}>{better}</strong>으로 투자했다면,{' '}
                      <strong style={{ color: 'var(--color-profit)' }}>{fmtKrw(absDiff)}</strong> 더 벌었을 것입니다.
                    </>
                  ) : (
                    <>두 전략의 1년 수익이 동일합니다.</>
                  )}
                </div>
              );
            })()}

            {/* 종목별 상세 */}
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>종목별 1년 수익률</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '3px 10px', fontSize: 'var(--text-sm)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-tertiary)' }}>종목</span>
              <span style={{ fontWeight: 600, color: 'var(--text-tertiary)', textAlign: 'right' }}>비중</span>
              <span style={{ fontWeight: 600, color: 'var(--text-tertiary)', textAlign: 'right' }}>분류</span>
              <span style={{ fontWeight: 600, color: 'var(--text-tertiary)', textAlign: 'right' }}>1년 수익률</span>
              {backtest.items.map(it => (
                <React.Fragment key={it.ticker}>
                  <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
                  <span style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>{(it.weight * 100).toFixed(1)}%</span>
                  <span style={{ textAlign: 'right', color: ASSET_COLORS[it.cls], fontWeight: 600 }}>{it.cls}</span>
                  <span style={{ textAlign: 'right', fontWeight: 600, color: it.ret >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                    {it.ret >= 0 ? '+' : ''}{(it.ret * 100).toFixed(1)}%
                  </span>
                </React.Fragment>
              ))}
            </div>

            <div style={{ marginTop: 10, fontSize: 'var(--text-xs)', color: 'var(--text-quaternary)', lineHeight: 1.5 }}>
              과거 수익률이 미래를 보장하지 않습니다. 배당금·수수료·환율 미반영.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 계좌 카드 ──────────────────────────────────────────────────
function AccountCard({ plan, isMobile, signals, changeRates, signalFilter, execMode, checkedSells, checkedBuys, onToggleSell, onToggleBuy, onNameClick, expandAll, executedInCycle, executedMap, executionInputs, onExecutionInputChange }: {
  plan: AccountPlan; isMobile: boolean; signals: Record<string, StockSignal>; changeRates: Record<string, number>; signalFilter: SignalFilter;
  execMode?: boolean; checkedSells?: Set<string>; checkedBuys?: Set<string>;
  onToggleSell?: (key: string) => void; onToggleBuy?: (key: string) => void;
  onNameClick?: (ticker: string, name: string) => void;
  expandAll?: boolean | null;
  executedInCycle?: Set<string>;
  executedMap?: Record<string, ExecutionRecord>;
  executionInputs?: Record<string, number>;
  onExecutionInputChange?: (key: string, value: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const { acc, sells, keeps, buys, freedCash, projectedSafePct, safeStatus, totalVal, safeAdjust } = plan;

  useEffect(() => {
    setCollapsed(!signalFilter);
  }, [signalFilter]);

  useEffect(() => {
    if (expandAll === true) setCollapsed(false);
    else if (expandAll === false) setCollapsed(true);
  }, [expandAll]);

  // 필터 매칭 여부 확인
  const isRowMatch = (ticker: string | undefined, type: 'sell' | 'buy'): boolean => {
    if (!signalFilter) return true;
    if (signalFilter.type !== type) return type !== signalFilter.type; // 반대 타입은 true (dimming 없음)
    if (!ticker || !signals[ticker]) return false;
    const label = type === 'sell' ? getSellSignal(signals[ticker]).label : getBuySignal(signals[ticker]).label;
    return label === signalFilter.label;
  };
  const isRet = isRetirementAcc(acc);
  const hasIssue = safeStatus === 'under' || safeStatus === 'over';
  const noKeeps = keeps.length === 0 && sells.length > 0;

  const sellsCol = (
    <div style={{ padding: '10px 14px', opacity: signalFilter?.type === 'buy' ? 0.25 : 1, transition: 'opacity 0.15s',
      background: 'var(--bg-primary)' }}>
      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-loss)', marginBottom: 8, letterSpacing: '0.03em' }}>
        매도 · 총 {fmtKrw(sells.reduce((s, r) => s + r.val, 0))} 현금화
      </div>
      {sells.map((s, i) => {
        const sig = s.h.ticker ? signals[s.h.ticker] : undefined;
        const timing = sig ? getSellSignal(sig) : noSignal();
        const matched = !signalFilter || signalFilter.type !== 'sell' || isRowMatch(s.h.ticker, 'sell');
        return (
          <div key={s.h.id} style={{ borderBottom: i < sells.length - 1 ? '1px solid var(--border-secondary)' : 'none',
            opacity: matched ? 1 : 0.2, transition: 'opacity 0.15s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {execMode && (
                <button onClick={() => onToggleSell?.(`${acc.id}__${s.h.id}`)}
                  style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, cursor: 'pointer',
                    border: `2px solid ${checkedSells?.has(`${acc.id}__${s.h.id}`) ? 'var(--color-loss)' : 'var(--text-tertiary)'}`,
                    background: checkedSells?.has(`${acc.id}__${s.h.id}`) ? 'color-mix(in srgb, var(--color-loss) 20%, transparent)' : 'var(--bg-elevated)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  {checkedSells?.has(`${acc.id}__${s.h.id}`) && <MIcon name="check" size={14} style={{ color: 'var(--color-loss)' }} />}
                </button>
              )}
              {execMode && checkedSells?.has(`${acc.id}__${s.h.id}`) && (() => {
                const rk = `${acc.id}__${s.h.id}`;
                const max = s.h.isFund ? (s.h.amount || 0) : (s.h.quantity || 0);
                const val = executionInputs?.[rk] ?? max;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                    <input type="number" min={0} max={max} value={val}
                      onChange={e => onExecutionInputChange?.(rk, Math.max(0, Math.min(max, Number(e.target.value) || 0)))}
                      onClick={e => e.currentTarget.select()}
                      style={{
                        width: 56, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border-secondary)',
                        background: 'var(--bg-elevated)', color: 'var(--text-primary)',
                        fontSize: 'var(--text-xs)', textAlign: 'right',
                      }}
                      aria-label="매도 실행 수량" />
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{s.h.isFund ? '원' : '주'}</span>
                  </div>
                );
              })()}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Row badge="전량매도" badgeColor="var(--color-loss)" name={s.h.name} cls={s.cls}
                  ticker={s.h.ticker} onNameClick={onNameClick}
                  ret={s.ret} amount={s.val}
                  note={s.h.isFund ? undefined : s.h.quantity ? `${s.h.quantity}주` : undefined}
                  dim={!matched} badgeTip={s.reasonDetail || undefined}
                  extra={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {sig?.currentPrice && !s.h.isFund && (
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {sig.currentPrice.toLocaleString()}원
                        </span>
                      )}
                      {s.h.ticker && s.h.ticker in changeRates && !s.h.isFund && (() => {
                        const cr = changeRates[s.h.ticker!];
                        return (
                          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, whiteSpace: 'nowrap',
                            color: cr > 0 ? 'var(--color-profit)' : cr < 0 ? 'var(--color-loss)' : 'var(--text-tertiary)' }}>
                            {cr > 0 ? '+' : ''}{cr.toFixed(2)}%
                          </span>
                        );
                      })()}
                      <TimingBadge timing={timing} />
                    </div>
                  } />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const buysCol = (freedCash > 0 && keeps.length > 0) ? (
    <div style={{ padding: '10px 14px', opacity: signalFilter?.type === 'sell' ? 0.25 : 1, transition: 'opacity 0.15s',
      background: 'var(--bg-primary)' }}>
      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-profit)', marginBottom: 8, letterSpacing: '0.03em' }}>
        재매수 · 가용현금 {fmtKrw(freedCash)}
        {acc.cash ? <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}> (현금 {fmtKrw(acc.cash)} 포함)</span> : null}
      </div>
      {noKeeps ? (
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-warning)', lineHeight: 1.7,
          borderLeft: '2px solid var(--color-warning)', paddingLeft: 8 }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>⚠ 유지할 종목이 없습니다</div>
          <div style={{ color: 'var(--text-secondary)' }}>모든 종목이 다른 계좌에도 보유 중입니다.</div>
          <div style={{ marginTop: 4, color: 'var(--text-tertiary)' }}>
            A. 매도하지 않고 중복 유지<br />
            B. {fmtKrw(freedCash)}로 새 종목 직접 선택
          </div>
        </div>
      ) : (
        keeps.map((k, i) => {
          const rowKey = `${acc.id}__${k.h.id}`;
          const isExecuted = executedInCycle?.has(rowKey) ?? false;
          const buy = buys.find(b => b.h.id === k.h.id);
          const addBadge = !isExecuted && buy && buy.addAmount > 0 ? (
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 400, color: 'var(--color-profit)', flexShrink: 0,
              background: 'color-mix(in srgb, var(--color-profit) 10%, transparent)', borderRadius: 6, padding: '3px 8px', marginLeft: 4 }}>
              +{fmtKrw(buy.addAmount)}{buy.shares && buy.shares > 0 ? ` (약 ${buy.shares}주)` : ''}
            </span>
          ) : null;
          const execRec = executedMap?.[rowKey];
          const recQty = execRec?.isFund ? execRec.recommendedAmount : (execRec?.recommendedShares ?? 0);
          const exeQty = execRec?.isFund ? execRec.amount : (execRec?.shares ?? 0);
          const isPartial = isExecuted && recQty > 0 && exeQty > 0 && exeQty < recQty;
          const remaining = Math.max(0, recQty - exeQty);
          const unit = execRec?.isFund ? '원' : '주';
          const execBadge = isExecuted ? (
            isPartial ? (
              <span title={`실행일 ${execRec?.date} · 실행 ${exeQty.toLocaleString()}${unit} / 추천 ${recQty.toLocaleString()}${unit} · 남음 ${remaining.toLocaleString()}${unit}`}
                style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-warning)', flexShrink: 0,
                  background: 'color-mix(in srgb, var(--color-warning) 12%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-warning) 40%, transparent)',
                  borderRadius: 6, padding: '3px 8px', marginLeft: 4, whiteSpace: 'nowrap' }}>
                부분 실행 {exeQty.toLocaleString()}/{recQty.toLocaleString()}{unit} · 남음 {remaining.toLocaleString()}
              </span>
            ) : (
              <span title={`실행일: ${execRec?.date ?? ''}`}
                style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', flexShrink: 0,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-secondary)',
                  borderRadius: 6, padding: '3px 8px', marginLeft: 4, whiteSpace: 'nowrap' }}>
                이미 실행
              </span>
            )
          ) : null;
          const sig = k.h.ticker ? signals[k.h.ticker] : undefined;
          const timing = sig ? getBuySignal(sig) : noSignal();
          const hasBuy = !isExecuted && buy && buy.addAmount > 0;
          const matched = isRowMatch(k.h.ticker, 'buy');
          return (
            <div key={k.h.id} style={{ borderBottom: i < keeps.length - 1 ? '1px solid var(--border-secondary)' : 'none',
              opacity: signalFilter?.type === 'buy' && !matched ? 0.25 : 1, transition: 'opacity 0.15s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {execMode && hasBuy && (
                  <button onClick={() => onToggleBuy?.(`${acc.id}__${k.h.id}`)}
                    style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, cursor: 'pointer',
                      border: `2px solid ${checkedBuys?.has(`${acc.id}__${k.h.id}`) ? 'var(--color-profit)' : 'var(--text-tertiary)'}`,
                      background: checkedBuys?.has(`${acc.id}__${k.h.id}`) ? 'color-mix(in srgb, var(--color-profit) 20%, transparent)' : 'var(--bg-elevated)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                    {checkedBuys?.has(`${acc.id}__${k.h.id}`) && <MIcon name="check" size={14} style={{ color: 'var(--color-profit)' }} />}
                  </button>
                )}
                {execMode && hasBuy && checkedBuys?.has(`${acc.id}__${k.h.id}`) && (() => {
                  const max = k.h.isFund ? (buy?.addAmount ?? 0) : (buy?.shares ?? 0);
                  const val = executionInputs?.[rowKey] ?? max;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                      <input type="number" min={0} max={max} value={val}
                        onChange={e => onExecutionInputChange?.(rowKey, Math.max(0, Math.min(max, Number(e.target.value) || 0)))}
                        onClick={e => e.currentTarget.select()}
                        style={{
                          width: 56, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border-secondary)',
                          background: 'var(--bg-elevated)', color: 'var(--text-primary)',
                          fontSize: 'var(--text-xs)', textAlign: 'right',
                        }}
                        aria-label="매수 실행 수량" />
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{k.h.isFund ? '원' : '주'}</span>
                    </div>
                  );
                })()}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Row badge={k.isHighReturn ? '★유지' : '추가매수'} badgeColor={k.isHighReturn ? 'var(--color-gold)' : 'var(--color-profit)'}
                    name={k.h.name} cls={k.cls} ticker={k.h.ticker} onNameClick={onNameClick}
                    ret={k.ret} amount={k.val}
                    badgeTip={k.keepReason || undefined}
                    extra={
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {sig?.currentPrice && !k.h.isFund && (
                          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {sig.currentPrice.toLocaleString()}원
                          </span>
                        )}
                        {k.h.ticker && k.h.ticker in changeRates && !k.h.isFund && (() => {
                          const cr = changeRates[k.h.ticker!];
                          return (
                            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, whiteSpace: 'nowrap',
                              color: cr > 0 ? 'var(--color-profit)' : cr < 0 ? 'var(--color-loss)' : 'var(--text-tertiary)' }}>
                              {cr > 0 ? '+' : ''}{cr.toFixed(2)}%
                            </span>
                          );
                        })()}
                        {addBadge}
                        {execBadge}
                        <TimingBadge timing={timing} />
                      </div>
                    } />
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  ) : null;

  return (
    <div style={{ border: '1px solid var(--border-primary)', borderRadius: 12, marginBottom: 10, overflow: 'hidden' }}>
      {/* 헤더 */}
      <div onClick={() => setCollapsed(c => !c)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', cursor: 'pointer',
        borderBottom: collapsed ? 'none' : '1px solid var(--border-secondary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{accLabel(acc)}</span>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)', borderRadius: 5, padding: '1px 6px' }}>{acc.accountType}</span>
          {sells.length > 0
            ? <span style={{ fontSize: 'var(--text-sm)', padding: '2px 7px', borderRadius: 6, fontWeight: 600, background: 'color-mix(in srgb, var(--color-loss) 15%, transparent)', color: 'var(--color-loss)' }}>매도 {sells.length}개</span>
            : <span style={{ fontSize: 'var(--text-sm)', padding: '2px 7px', borderRadius: 6, fontWeight: 600, background: 'color-mix(in srgb, var(--color-profit) 15%, transparent)', color: 'var(--color-profit)' }}>변경 없음</span>
          }
          {isRet && hasIssue && <span style={{ fontSize: 'var(--text-sm)', padding: '2px 7px', borderRadius: 6, fontWeight: 600, background: 'color-mix(in srgb, var(--color-loss) 15%, transparent)', color: 'var(--color-loss)' }}>
            {safeStatus === 'under' ? '⚠ 안전자산 미달' : '▲ 안전자산 초과'}
          </span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-secondary)' }}>{fmtKrw(totalVal)}</span>
          <MIcon name={collapsed ? 'expand_more' : 'expand_less'} size={18} style={{ color: 'var(--text-tertiary)' }} />
        </div>
      </div>

      {!collapsed && (
        <div>
          {/* 안전자산 바 (퇴직/IRP) */}
          {isRet && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '7px 16px', borderBottom: '1px solid var(--border-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>안전자산</span>
                <div style={{ width: 72, height: 4, background: 'var(--bg-elevated)', borderRadius: 2, position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, height: 4, borderRadius: 2, width: `${Math.min(projectedSafePct, 100)}%`,
                    background: safeStatus === 'good' ? 'var(--color-profit)' : safeStatus === 'over' ? 'var(--color-warning)' : 'var(--color-loss)', transition: 'width 0.5s' }} />
                  <div style={{ position: 'absolute', left: '30%', top: -1, width: 1.5, height: 6, background: 'var(--color-profit)', borderRadius: 1 }} />
                  <div style={{ position: 'absolute', left: '35%', top: -1, width: 1.5, height: 6, background: 'var(--color-warning)', borderRadius: 1 }} />
                </div>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700,
                  color: safeStatus === 'good' ? 'var(--color-profit)' : safeStatus === 'over' ? 'var(--color-warning)' : 'var(--color-loss)' }}>
                  {projectedSafePct.toFixed(1)}% {safeStatus === 'good' ? '적정' : safeStatus === 'under' ? '⚠ 미달' : '▲ 초과'}
                </span>
              </div>
              {safeAdjust && (
                <span style={{ fontSize: 'var(--text-xs)', color: safeStatus === 'under' ? 'var(--color-loss)' : 'var(--color-warning)' }}>
                  {safeAdjust.action} {fmtKrw(safeAdjust.amount)} 필요
                </span>
              )}
            </div>
          )}

          {/* 매도 있음: 상(매도) / 하(재매수) — 수직 배열 */}
          {sells.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              rowGap: buysCol ? '1px' : '0',
              background: buysCol ? 'var(--border-secondary)' : 'transparent',
            }}>
              {sellsCol}{buysCol}
            </div>
          ) : (
            /* 변경 없음: 종목 목록만 */
            <div style={{ padding: '4px 14px 10px' }}>
              {keeps.map((k, i) => {
                const matched = isRowMatch(k.h.ticker, 'buy');
                return (
                  <div key={k.h.id} style={{ borderBottom: i < keeps.length - 1 ? '1px solid var(--border-secondary)' : 'none',
                    opacity: signalFilter?.type === 'buy' && !matched ? 0.25 : 1, transition: 'opacity 0.15s' }}>
                    <Row badge={k.isHighReturn ? '★유지' : '유지'} badgeColor={k.isHighReturn ? 'var(--color-gold)' : 'var(--color-profit)'}
                      name={k.h.name} cls={k.cls} ticker={k.h.ticker} onNameClick={onNameClick}
                      ret={k.ret} amount={k.val} badgeTip={k.keepReason || undefined} />
                  </div>
                );
              })}
              {acc.cash && acc.cash > 0 && <Row badge="유지" badgeColor="var(--color-profit)" name="현금" amount={acc.cash} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 뱃지 범위 기준 모달 ────────────────────────────────────────
const BADGE_RANGE_ROWS: { badge: string; color: string; type: '매도' | '매수'; range: string; desc: string }[] = [
  { badge: '매도 적합', color: 'var(--color-profit)', type: '매도', range: '현재가 ~ 60일 고점', desc: '상승 추세 고점 구간, 지금부터 고점까지 매도 유효' },
  { badge: '매도 가능 (상승)', color: 'var(--color-profit)', type: '매도', range: '현재가 ~ 70% 위치점', desc: '추가 상승 여지 있으나 매도 가능한 구간' },
  { badge: '매도 가능 (횡보)', color: 'var(--color-warning)', type: '매도', range: '현재가 ~ 60일 고점', desc: '횡보 중상단, 고점까지 매도 구간' },
  { badge: '반등 대기', color: 'var(--color-warning)', type: '매도', range: 'MA20 ~ 60일 고점', desc: '횡보 하단, 반등 후 이 구간 진입 시 매도' },
  { badge: '저점 매도', color: 'var(--color-loss)', type: '매도', range: '60일 저점 ~ 현재가', desc: '손절 구간, 이미 저점권에 있음' },
  { badge: '반등 후 매도', color: 'var(--color-loss)', type: '매도', range: 'MA60 ~ MA20', desc: '하락 추세, 반등 시 MA 구간 도달하면 매도' },
  { badge: '반등 대기 (저점)', color: 'var(--color-warning)', type: '매수', range: '60일 저점 ~ MA20', desc: '60일 저점 근처, 하락 중 — MA20 회복 후 매수 진입' },
  { badge: '반등 대기 (하락)', color: 'var(--color-warning)', type: '매수', range: '60일 저점 ~ MA20', desc: '하락 추세 진행 중 — MA20 돌파 시점에 매수 권장' },
  { badge: '매수 적합 (횡보)', color: 'var(--color-profit)', type: '매수', range: '60일 저점 ~ MA20', desc: '횡보 하단 매수 구간' },
  { badge: '분할 매수 (횡보)', color: 'var(--color-warning)', type: '매수', range: '60일 저점 ~ 현재가', desc: '횡보 중, 저점~현재가 구간 분할 매수' },
  { badge: '매수 가능', color: 'var(--color-profit)', type: '매수', range: 'MA20 ~ 현재가', desc: '상승 추세 초입, MA20 이상 구간에서 매수' },
  { badge: '분할 매수 (상승)', color: 'var(--color-warning)', type: '매수', range: 'MA20 ~ 현재가', desc: '상승 중상단, MA20 ~ 현재가 구간 나눠 매수' },
  { badge: '조정 대기', color: 'var(--color-loss)', type: '매수', range: 'MA60 ~ MA20', desc: '고점 근처, 조정 시 MA 구간 도달하면 매수' },
];

function GuideModal({ onClose }: { onClose: () => void }) {
  const signalRows = (type: '매도' | '매수') => BADGE_RANGE_ROWS.filter(r => r.type === type).map((r, i) => (
    <div key={r.badge + i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1.3fr', gap: 8,
      padding: '8px 12px', fontSize: 'var(--text-sm)', alignItems: 'start',
      borderTop: i > 0 ? '1px solid var(--border-secondary)' : 'none',
      background: i % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--bg-tertiary) 50%, transparent)' }}>
      <span style={{ fontWeight: 700, color: r.color }}>{r.badge}</span>
      <span style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>{r.range}</span>
      <span style={{ color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{r.desc}</span>
    </div>
  ));

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-elevated)', borderRadius: 14,
        border: '1px solid var(--border-primary)', width: '100%', maxWidth: 680, maxHeight: '85vh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: '1px solid var(--border-secondary)', flexShrink: 0 }}>
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>가이드 — 적용 원칙 & 타이밍 신호</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
            <MIcon name="close" size={18} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: '16px 18px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>

          {/* 매도/재배분 기준 */}
          <div style={{ fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>매도 / 재배분 기준</div>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '12px 14px', marginBottom: 20, lineHeight: 2 }}>
            <div>① 동일 종목이 여러 계좌에 있으면 <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>절세 우선순위 낮은 계좌에서 매도</span></div>
            <div style={{ paddingLeft: 14, color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', lineHeight: 1.8 }}>IRP &gt; 퇴직연금 &gt; 연금저축 &gt; ISA &gt; 일반/CMA</div>
            <div>② 매도 현금은 <span style={{ color: 'var(--color-profit)', fontWeight: 600 }}>같은 계좌 유지 종목에 목표 비중 기반 재배분</span> (계좌 간 이동 없음)</div>
            <div>③ <span style={{ color: 'var(--color-gold)', fontWeight: 600 }}>★ 수익률 40%↑</span> 종목은 중복이어도 매도하지 않음 (세금/수수료 고려)</div>
            <div>④ 퇴직/IRP는 매도 후 안전자산(채권+금) 비율이 <span style={{ fontWeight: 600 }}>30~35%</span> 유지되는지 별도 체크</div>
          </div>

          {/* 타이밍 신호 공통 설명 */}
          <div style={{ fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>타이밍 신호 기준</div>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 'var(--text-xs)', lineHeight: 1.9 }}>
            <span style={{ color: 'var(--color-profit)', fontWeight: 600 }}>MA20</span> 최근 20거래일 평균가 (단기) &nbsp;·&nbsp;
            <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>MA60</span> 최근 60거래일 평균가 (중기) &nbsp;·&nbsp;
            <span style={{ fontWeight: 600 }}>위치</span> 60일 저점~고점 내 현재가 위치 (0%=저점, 100%=고점)
            <br />뱃지 아래 숫자는 신호가 유효한 <strong>매도/매수 실행 가격 범위</strong>입니다.
          </div>

          {/* SELL */}
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-loss)', margin: '0 0 6px', letterSpacing: 1 }}>SELL — 매도</div>
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-secondary)', marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1.3fr', background: 'var(--bg-tertiary)',
              padding: '6px 12px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', gap: 8 }}>
              <span>신호</span><span>가격 범위</span><span>설명</span>
            </div>
            {signalRows('매도')}
          </div>

          {/* BUY */}
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-profit)', margin: '0 0 6px', letterSpacing: 1 }}>BUY — 매수</div>
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-secondary)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1.3fr', background: 'var(--bg-tertiary)',
              padding: '6px 12px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', gap: 8 }}>
              <span>신호</span><span>가격 범위</span><span>설명</span>
            </div>
            {signalRows('매수')}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 메인 ──────────────────────────────────────────────────────
type TargetAllocation = { 주식: number; 채권: number; 커버드콜: number; 금: number; 기타: number };
const DEFAULT_TARGETS: TargetAllocation = { 주식: 60, 채권: 20, 커버드콜: 10, 금: 5, 기타: 5 };

// ── 재조정 사이클: 매월 1일·15일 기준 ───────────────────────────
const EXECUTED_STORAGE_KEY = 'executed_holdings';

type ExecutionRecord = {
  date: string;              // 실행일 YYYY-MM-DD
  type: 'buy' | 'sell';
  shares: number;            // 실제 실행 수량 (펀드는 0)
  amount: number;            // 실제 실행 금액 (원)
  recommendedShares: number; // 추천 수량
  recommendedAmount: number; // 추천 금액
  isFund?: boolean;
};

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayIso(): string { return toIso(new Date()); }
function getCurrentCycleStart(): string {
  const d = new Date();
  const cycleDay = d.getDate() >= 15 ? 15 : 1;
  return toIso(new Date(d.getFullYear(), d.getMonth(), cycleDay));
}
function getNextCycleDate(): string {
  const d = new Date();
  return toIso(d.getDate() < 15 ? new Date(d.getFullYear(), d.getMonth(), 15) : new Date(d.getFullYear(), d.getMonth() + 1, 1));
}
function daysUntil(iso: string): number {
  const a = new Date(todayIso()).getTime();
  const b = new Date(iso).getTime();
  return Math.max(0, Math.round((b - a) / (1000 * 60 * 60 * 24)));
}
function getPrevCycleStart(cycleStart: string): string {
  const d = new Date(cycleStart);
  if (d.getDate() === 15) return toIso(new Date(d.getFullYear(), d.getMonth(), 1));
  return toIso(new Date(d.getFullYear(), d.getMonth() - 1, 15));
}

// 구 포맷(문자열 날짜) → 신 포맷(ExecutionRecord) 마이그레이션
function migrateExecutedMap(raw: unknown): Record<string, ExecutionRecord> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, ExecutionRecord> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string') {
      // 구 포맷: 수량 정보 없음 → 전량 실행으로 간주 (recommendedShares=0이면 부분 판정 불가)
      out[key] = { date: value, type: 'buy', shares: 0, amount: 0, recommendedShares: 0, recommendedAmount: 0 };
    } else if (value && typeof value === 'object' && 'date' in (value as object)) {
      out[key] = value as ExecutionRecord;
    }
  }
  return out;
}

// 목표 비중 기반 buys 계산 헬퍼
function computeBuys(
  keeps: AccountPlan['keeps'],
  freedCash: number,
  tgts: TargetAllocation,
  prices: Record<string, number>
): BuyItem[] {
  if (keeps.length === 0 || freedCash <= 0) return [];
  const classTotals: Record<AssetClass, number> = { 주식: 0, 채권: 0, 커버드콜: 0, 금: 0, 기타: 0 };
  for (const k of keeps) classTotals[k.cls] += k.val;
  const presentClasses = (Object.keys(classTotals) as AssetClass[]).filter(cls => classTotals[cls] > 0);
  const totalTargetWeight = presentClasses.reduce((s, cls) => s + (tgts[cls] || 0), 0);
  return keeps.map(k => {
    const clsTarget = totalTargetWeight > 0 ? (tgts[k.cls] || 0) / totalTargetWeight : 0;
    const intraClsWeight = classTotals[k.cls] > 0 ? k.val / classTotals[k.cls] : 0;
    const addAmount = Math.round(clsTarget * intraClsWeight * freedCash / 10000) * 10000;
    const price = k.h.isFund ? null : ((k.h.ticker && prices[k.h.ticker]) ? prices[k.h.ticker] : (k.h.avgPrice || null));
    const shares = (price && price > 0 && !k.h.isFund) ? Math.floor(addAmount / price) : null;
    return { h: k.h, cls: k.cls, currentVal: k.val, addAmount, shares, price };
  });
}

function computeAllPlans(
  accounts: Account[], prices: Record<string, number>,
  targets: TargetAllocation, overrideKeeps: Set<string>,
  executedInCycle: Set<string> = new Set()
): { accountPlans: AccountPlan[]; totalSells: number; retirementIssues: number } {
  const holdingMap = new Map<string, { h: Holding; acc: Account; val: number; ret: number | null }[]>();
  for (const acc of accounts) {
    for (const h of acc.holdings) {
      const key = `${acc.owner}__${h.ticker || h.name}`;
      if (!holdingMap.has(key)) holdingMap.set(key, []);
      holdingMap.get(key)!.push({ h, acc, val: hVal(h, prices), ret: calcReturn(h, prices) });
    }
  }

  const sellSet = new Set<string>();
  const reasonMap = new Map<string, { reason: string; reasonDetail: string }>();
  const keepReasonMap = new Map<string, string>();

  for (const [, group] of holdingMap) {
    if (group.length <= 1) {
      continue;
    }
    const sorted = [...group].sort((a, b) => {
      const pa = accPriority(a.acc), pb = accPriority(b.acc);
      return pa !== pb ? pb - pa : b.val - a.val;
    });
    const winner = sorted[0];
    const wp = accPriority(winner.acc);
    keepReasonMap.set(`${winner.acc.id}__${winner.h.id}`,
      `절세 우선순위 최고 — ${winner.acc.accountType}(${wp})`);

    for (const item of sorted.slice(1)) {
      const key = `${item.acc.id}__${item.h.id}`;
      const isHighReturn = item.ret !== null && item.ret >= 40;
      if (isHighReturn) {
        keepReasonMap.set(key, `수익률 +${item.ret!.toFixed(1)}% — 40%↑ 보호 규칙`);
        continue;
      }
      if (overrideKeeps.has(key)) {
        keepReasonMap.set(key, '수동 유지 선택');
        continue;
      }
      sellSet.add(key);
      const tp = accPriority(item.acc);
      reasonMap.set(key, {
        reason: '다른 절세 계좌에 동일 종목',
        reasonDetail: `${accLabel(winner.acc)}(우선순위 ${wp})에 동일 종목 → ${accLabel(item.acc)}(우선순위 ${tp})에서 매도 → 매도금은 ${accLabel(item.acc)} 유지 종목에 목표 비중대로 재배분`
      });
    }
  }

  const accountPlans: AccountPlan[] = accounts.map(acc => {
    const cash = acc.cash || 0;
    const totalVal = acc.holdings.reduce((s, h) => s + hVal(h, prices), 0) + cash;
    const sells: SellItem[] = [];
    const keeps: AccountPlan['keeps'] = [];

    for (const h of acc.holdings) {
      const val = hVal(h, prices);
      const ret = calcReturn(h, prices);
      const cls = classify(h.name);
      const key = `${acc.id}__${h.id}`;

      if (sellSet.has(key)) {
        const r = reasonMap.get(key) || { reason: '다른 절세 계좌에 동일 종목', reasonDetail: '' };
        sells.push({ h, val, cls, ret, reason: r.reason, reasonDetail: r.reasonDetail });
      } else {
        const isHighReturn = ret !== null && ret >= 40;
        keeps.push({ h, val, cls, ret, isHighReturn, keepReason: keepReasonMap.get(key) || '' });
      }
    }

    const sellTotal = sells.reduce((s, r) => s + r.val, 0);
    const freedCash = sellTotal + cash;
    // 매수 추천은 실제 보유 현금만 기준 — 미실행 매도 대금 포함 시 매도 전에도 같은 추천 반복됨
    // 이번 사이클에 이미 실행한 종목은 후보에서 제외 → 다음 사이클(1일/15일)에 통합 재계산
    const keepsForBuys = keeps.filter(k => !executedInCycle.has(`${acc.id}__${k.h.id}`));
    const buys = computeBuys(keepsForBuys, cash, targets, prices);

    const projectedTotal = keeps.reduce((s, k) => s + k.val, 0);
    const projectedSafe = keeps.reduce((s, k) => isSafeAsset(k.cls) ? s + k.val : s, 0);
    const projectedSafePct = projectedTotal > 0 ? projectedSafe / projectedTotal * 100 : 0;
    const currentSafe = acc.holdings.reduce((s, h) => isSafeAsset(classify(h.name)) ? s + hVal(h, prices) : s, cash);
    const currentSafePct = totalVal > 0 ? currentSafe / totalVal * 100 : 0;

    const isRet = isRetirementAcc(acc);
    const safeStatus: AccountPlan['safeStatus'] = !isRet ? 'na'
      : projectedSafePct < 30 ? 'under'
      : projectedSafePct >= 35 ? 'over'
      : 'good';

    let safeAdjust: AccountPlan['safeAdjust'] = null;
    if (isRet && safeStatus === 'under') {
      safeAdjust = { action: '채권/금 추가 매수', amount: projectedTotal * 0.30 - projectedSafe };
    } else if (isRet && safeStatus === 'over') {
      safeAdjust = { action: '주식 추가 or 채권 매도', amount: projectedSafe - projectedTotal * 0.35 };
    }

    return { acc, sells, keeps, buys, freedCash, currentSafePct, projectedSafePct, safeStatus, safeAdjust, totalVal };
  });

  const totalSells = accountPlans.reduce((s, p) => s + p.sells.length, 0);
  const retirementIssues = accountPlans.filter(p => p.safeStatus === 'under' || p.safeStatus === 'over').length;
  return { accountPlans, totalSells, retirementIssues };
}

function loadTargetsFromStorage(): TargetAllocation {
  try {
    const raw = localStorage.getItem('rebalancing_targets');
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_TARGETS;
}


export function OptimalGuide() {
  const { accounts, prices, isMobile, navigateTo, reloadAccounts } = useAppContext();
  const [signals, setSignals] = useState<Record<string, StockSignal>>({});
  const [signalsLoading, setSignalsLoading] = useState(false);
  const [changeRates, setChangeRates] = useState<Record<string, number>>({});
  const [showGuide, setShowGuide] = useState(false);
  const [signalFilter, setSignalFilter] = useState<SignalFilter>(null);
  const [targets, setTargets] = useState<TargetAllocation>(loadTargetsFromStorage);
  const [prevTargets, setPrevTargets] = useState<TargetAllocation | null>(null);
  const [showDivDetail, setShowDivDetail] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(1450);
  const [showComparison, setShowComparison] = useState(false);
  const [showExecReport, setShowExecReport] = useState(false);
  const [execMode, setExecMode] = useState(false);
  const [expandAll, setExpandAll] = useState<boolean | null>(null);
  const [checkedSells, setCheckedSells] = useState<Set<string>>(new Set()); // `${accId}__${holdingId}`
  const [checkedBuys, setCheckedBuys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // 사이클 내 실행 이력 (localStorage) — 매월 1일·15일에 자연히 무효화
  const [executedMap, setExecutedMap] = useState<Record<string, ExecutionRecord>>(() => {
    try { return migrateExecutedMap(JSON.parse(localStorage.getItem(EXECUTED_STORAGE_KEY) || '{}')); }
    catch { return {}; }
  });
  const cycleStart = useMemo(() => getCurrentCycleStart(), []);
  const nextCycle = useMemo(() => getNextCycleDate(), []);
  const executedInCycle = useMemo(() => {
    const s = new Set<string>();
    for (const [key, rec] of Object.entries(executedMap)) {
      if (rec.date >= cycleStart) s.add(key);
    }
    return s;
  }, [executedMap, cycleStart]);

  // 부분 실행 입력값 (execMode 내에서만 유효, 저장 후 리셋)
  const [executionInputs, setExecutionInputs] = useState<Record<string, number>>({});
  const setExecutionInput = (key: string, value: number) => {
    setExecutionInputs(prev => ({ ...prev, [key]: value }));
  };
  // KV에서 targets + prevTargets 로드 (마운트 시 1회)
  useEffect(() => {
    kvGet<TargetAllocation>('rebalancing_targets').then(val => {
      if (val) setTargets(val);
    }).catch(() => {});
    kvGet<TargetAllocation>('rebalancing_targets_prev').then(val => {
      if (val) setPrevTargets(val);
    }).catch(() => {});
  }, []);

  // 환율 fetch
  useEffect(() => {
    fetch('https://asset-dashboard-api.jilliankim200.workers.dev/exchange-rates')
      .then(r => r.json())
      .then((d: { USD?: number }) => { if (d.USD) setExchangeRate(d.USD); })
      .catch(() => {});
  }, []);

  // 커버드콜 월 배당금 추정 — 목표 비중 기반 스케일링
  const coveredCallMonthlyDiv = useMemo(() => {
    try {
      // 1. 현재 커버드콜 보유 금액
      const currentCCVal = accounts.reduce((sum, acc) =>
        sum + acc.holdings.filter(h => classify(h.name) === '커버드콜')
          .reduce((s, h) => s + hVal(h, prices), 0), 0);
      if (currentCCVal <= 0) return 0;

      // 2. dividend_rates_sync에서 배당률 로드, 수량은 accounts에서
      const raw = localStorage.getItem('dividend_rates_sync') || localStorage.getItem('dividend_stocks');
      if (!raw) return 0;
      const ratesRaw: { ticker: string; quantity?: number; dividendPerShare: number }[] = JSON.parse(raw);
      // ticker → dividendPerShare 맵 구성
      const rateMap: Record<string, number> = {};
      for (const r of ratesRaw) {
        const t = r.ticker.replace(/_H$/, '').toUpperCase();
        rateMap[t] = r.dividendPerShare;
      }
      let currentDiv = 0;
      for (const acc of accounts) {
        for (const h of acc.holdings) {
          if (!h.ticker) continue;
          const t = h.ticker.replace(/_H$/, '').toUpperCase();
          const rate = rateMap[t];
          if (!rate || !h.quantity) continue;
          const isUsd = /^[A-Z]{2,5}$/.test(t);
          const base = rate * h.quantity;
          currentDiv += isUsd ? base * 0.85 * exchangeRate : base;
        }
      }
      if (currentDiv <= 0) return 0;

      // 3. 전체 자산 × 목표 커버드콜 비중 = 목표 커버드콜 금액
      const totalAssets = accounts.reduce((sum, acc) =>
        sum + (acc.cash || 0) + acc.holdings.reduce((s, h) => s + hVal(h, prices), 0), 0);
      const targetCCVal = totalAssets * (targets['커버드콜'] || 0) / 100;

      // 4. 현재 수익률로 목표 금액 배당 추정
      const monthlyYield = currentDiv / currentCCVal;
      return Math.round(targetCCVal * monthlyYield);
    } catch { return 0; }
  }, [accounts, prices, targets, exchangeRate]);

  const { accountPlans, totalSells, retirementIssues } = useMemo(() =>
    computeAllPlans(accounts, prices, targets, new Set(), executedInCycle),
    [accounts, prices, targets, executedInCycle]);

  const currentAlloc = useMemo(() => {
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
    const result: Record<AssetClass, number> = { 주식: 0, 채권: 0, 커버드콜: 0, 금: 0, 기타: 0 };
    if (total > 0) {
      for (const cls of Object.keys(byClass) as AssetClass[]) {
        result[cls] = Math.round(byClass[cls] / total * 1000) / 10;
      }
    }
    return result;
  }, [accounts, prices]);

  const toggleCheck = (set: Set<string>, setFn: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) => {
    setFn(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  };

  const checkedCount = checkedSells.size + checkedBuys.size;

  const handleExecSave = async () => {
    if (checkedCount === 0) return;
    setSaving(true);
    try {
      const updated = structuredClone(accounts);
      const today = todayIso();
      const newRecs: Record<string, ExecutionRecord> = {};

      // 1. 매도 처리 (부분 매도 지원)
      for (const key of checkedSells) {
        const [accId, holdingId] = key.split('__');
        const acc = updated.find(a => a.id === accId);
        if (!acc) continue;
        const idx = acc.holdings.findIndex(h => h.id === holdingId);
        if (idx === -1) continue;
        const h = acc.holdings[idx];
        const plan = accountPlans.find(p => p.acc.id === accId);
        const sell = plan?.sells.find(s => s.h.id === holdingId);
        if (!sell) continue;

        if (h.isFund) {
          // 펀드: 금액 기준. 입력값 없으면 전량 매도
          const maxAmt = h.amount || 0;
          const execAmt = Math.min(Math.max(0, executionInputs[key] ?? maxAmt), maxAmt);
          if (execAmt <= 0) continue;
          h.amount = maxAmt - execAmt;
          acc.cash = (acc.cash || 0) + execAmt;
          if ((h.amount || 0) <= 0) acc.holdings.splice(idx, 1);
          newRecs[key] = {
            date: today, type: 'sell', isFund: true,
            shares: 0, amount: execAmt,
            recommendedShares: 0, recommendedAmount: sell.val,
          };
        } else {
          const maxShares = h.quantity || 0;
          const execShares = Math.min(Math.max(0, Math.floor(executionInputs[key] ?? maxShares)), maxShares);
          if (execShares <= 0) continue;
          const pricePerShare = maxShares > 0 ? sell.val / maxShares : 0;
          const sellAmount = Math.round(execShares * pricePerShare);
          h.quantity = maxShares - execShares;
          acc.cash = (acc.cash || 0) + sellAmount;
          if (h.quantity <= 0) acc.holdings.splice(idx, 1);
          newRecs[key] = {
            date: today, type: 'sell',
            shares: execShares, amount: sellAmount,
            recommendedShares: maxShares, recommendedAmount: sell.val,
          };
        }
      }

      // 2. 추가매수 처리 (부분 매수 지원)
      for (const key of checkedBuys) {
        const [accId, holdingId] = key.split('__');
        const acc = updated.find(a => a.id === accId);
        if (!acc) continue;
        const h = acc.holdings.find(hh => hh.id === holdingId);
        if (!h) continue;
        const plan = accountPlans.find(p => p.acc.id === accId);
        const buy = plan?.buys.find(b => b.h.id === holdingId);
        if (!buy || buy.addAmount <= 0) continue;

        if (h.isFund) {
          const maxAmt = buy.addAmount;
          const execAmt = Math.min(Math.max(0, executionInputs[key] ?? maxAmt), maxAmt);
          if (execAmt <= 0) continue;
          h.amount = (h.amount || 0) + execAmt;
          acc.cash = Math.max(0, (acc.cash || 0) - execAmt);
          newRecs[key] = {
            date: today, type: 'buy', isFund: true,
            shares: 0, amount: execAmt,
            recommendedShares: 0, recommendedAmount: buy.addAmount,
          };
        } else if (buy.shares && buy.shares > 0 && buy.price) {
          const maxShares = buy.shares;
          const execShares = Math.min(Math.max(0, Math.floor(executionInputs[key] ?? maxShares)), maxShares);
          if (execShares <= 0) continue;
          const cost = execShares * buy.price;
          const oldCost = h.avgPrice * h.quantity;
          h.quantity += execShares;
          h.avgPrice = h.quantity > 0 ? Math.round((oldCost + cost) / h.quantity) : h.avgPrice;
          acc.cash = Math.max(0, (acc.cash || 0) - cost);
          newRecs[key] = {
            date: today, type: 'buy',
            shares: execShares, amount: cost,
            recommendedShares: maxShares, recommendedAmount: buy.addAmount,
          };
        }
      }

      await saveAccounts(updated);

      // 실행 기록 저장 (reloadAccounts 이전에 → 렌더 깜빡임 방지)
      if (Object.keys(newRecs).length > 0) {
        const nextMap = { ...executedMap, ...newRecs };
        localStorage.setItem(EXECUTED_STORAGE_KEY, JSON.stringify(nextMap));
        setExecutedMap(nextMap);
      }

      await reloadAccounts();
      setExecMode(false);
      setCheckedSells(new Set());
      setCheckedBuys(new Set());
      setExecutionInputs({});
    } catch (err) {
      console.error('실행 저장 실패:', err);
    } finally {
      setSaving(false);
    }
  };

  // 이전 vs 현재 targets 비교 — 커버드콜 매수금액 변화 계산
  const divChangePlans = useMemo(() => {
    if (!prevTargets) return [];
    const result: { accLabel: string; name: string; before: number; after: number }[] = [];
    for (const plan of accountPlans) {
      const prevBuys = computeBuys(plan.keeps, plan.freedCash, prevTargets, prices);
      for (const k of plan.keeps) {
        if (k.cls !== '커버드콜') continue;
        const after = plan.buys.find(b => b.h.id === k.h.id)?.addAmount ?? 0;
        const before = prevBuys.find(b => b.h.id === k.h.id)?.addAmount ?? 0;
        if (before !== after) {
          result.push({ accLabel: accLabel(plan.acc), name: k.h.name, before, after });
        }
      }
    }
    return result;
  }, [accountPlans, prevTargets, prices]);

  // 전체 티커 수집 후 신호 + 등락률 fetch
  useEffect(() => {
    const tickers = accounts.flatMap(a => a.holdings.map(h => h.ticker)).filter(Boolean) as string[];
    if (tickers.length === 0) return;
    setSignalsLoading(true);
    fetchStockSignals(tickers).then(data => {
      setSignals(data);
      setSignalsLoading(false);
    });
    fetchCurrentPricesWithChange(tickers).then(data => {
      const rates: Record<string, number> = {};
      for (const [t, v] of Object.entries(data)) rates[t] = v.changeRate;
      setChangeRates(rates);
    });
  }, [accounts]);

  // 현재 데이터에 존재하는 신호 목록
  const availableSignals = useMemo(() => {
    if (Object.keys(signals).length === 0) return { sell: [] as {label:string;color:string}[], buy: [] as {label:string;color:string}[] };
    const sellMap = new Map<string, string>();
    const buyMap = new Map<string, string>();
    for (const plan of accountPlans) {
      for (const s of plan.sells) {
        if (s.h.ticker && signals[s.h.ticker]) {
          const sig = getSellSignal(signals[s.h.ticker]);
          sellMap.set(sig.label, sig.color);
        }
      }
      for (const k of plan.keeps) {
        if (k.h.ticker && signals[k.h.ticker]) {
          const sellSig = getSellSignal(signals[k.h.ticker]);
          sellMap.set(sellSig.label, sellSig.color);
          const buySig = getBuySignal(signals[k.h.ticker]);
          buyMap.set(buySig.label, buySig.color);
        }
      }
    }
    return {
      sell: [...sellMap.entries()].map(([label, color]) => ({ label, color })),
      buy:  [...buyMap.entries()].map(([label, color]) => ({ label, color })),
    };
  }, [accountPlans, signals]);

  // 신호 필터 적용
  const filteredPlans = useMemo(() => {
    if (!signalFilter) return accountPlans;
    return accountPlans.filter(plan => {
      if (signalFilter.type === 'sell') {
        return plan.sells.some(s =>
          s.h.ticker && signals[s.h.ticker] && getSellSignal(signals[s.h.ticker]).label === signalFilter.label
        );
      } else {
        // 실제 매수 추천(buys)이 있는 계좌만 — 유지만 있는 "변경 없음" 계좌 제외
        return plan.buys.some(b =>
          b.h.ticker && signals[b.h.ticker] && getBuySignal(signals[b.h.ticker]).label === signalFilter.label
        );
      }
    });
  }, [accountPlans, signals, signalFilter]);

  const p = isMobile ? '16px 12px' : '24px';

  return (
    <div style={{ padding: p }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>최적 가이드</div>
        <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)' }}>
          중복 종목은 하위 계좌에서 매도하고, 그 현금을 같은 계좌 내 유지 종목에 비례 재배분합니다.
        </div>
      </div>

      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: isMobile ? 6 : 10, marginBottom: isMobile ? 14 : 20 }}>
        {[
          { icon: 'remove_shopping_cart', label: '매도 종목', value: `${totalSells}개`, color: totalSells > 0 ? 'var(--color-loss)' : 'var(--color-profit)' },
          { icon: 'warning', label: '안전자산 조정', value: `${retirementIssues}개`, color: retirementIssues > 0 ? 'var(--color-loss)' : 'var(--color-profit)' },
          { icon: 'account_balance', label: '전체 계좌', value: `${accounts.length}개`, color: 'var(--text-secondary)' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: isMobile ? '8px 10px' : '12px 14px', display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10, minWidth: 0 }}>
            <div style={{ width: isMobile ? 28 : 32, height: isMobile ? 28 : 32, borderRadius: 9, background: `color-mix(in srgb, ${c.color} 15%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MIcon name={c.icon} size={isMobile ? 14 : 16} style={{ color: c.color }} />
            </div>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div style={{ fontSize: isMobile ? 'var(--text-xs)' : 'var(--text-sm)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</div>
              <div style={{ fontSize: isMobile ? 'var(--text-base)' : 'var(--text-lg)', fontWeight: 700, color: c.color }}>{c.value}</div>
            </div>
          </div>
        ))}
      </div>

      {showComparison && <ComparisonPanel accounts={accounts} prices={prices} plans={accountPlans} targets={targets} />}

      {/* 목표 비중 카드 */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-secondary)' }}>
            <MIcon name="tune" size={15} style={{ color: 'var(--text-tertiary)' }} />
            목표 비중 (재투자 배분 기준)
          </div>
          <button
            onClick={() => navigateTo('rebalancing')}
            style={{ fontSize: 'var(--text-sm)', padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
              border: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)',
              color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <MIcon name="edit" size={12} style={{ color: 'var(--accent-blue)' }} />
            수정
          </button>
        </div>
        {isMobile ? (
          /* 모바일: 자산 클래스별 세로 스택 (한 줄에 목표 vs 현재 나란히) */
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 'var(--text-sm)' }}>
            {(Object.keys(targets) as AssetClass[]).map((cls, idx, arr) => {
              const cur = currentAlloc[cls] ?? 0;
              const diff = cur - targets[cls];
              const diffColor = Math.abs(diff) <= 3 ? 'var(--color-profit)' : Math.abs(diff) <= 8 ? 'var(--color-warning)' : 'var(--color-loss)';
              return (
                <div key={cls} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 2px',
                  borderBottom: idx < arr.length - 1 ? '1px solid var(--border-secondary)' : 'none',
                }}>
                  <span style={{ fontWeight: 700, color: ASSET_COLORS[cls], minWidth: 54, flexShrink: 0 }}>{cls}</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 72 }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>목표</span>
                    <span style={{ fontWeight: 700, color: ASSET_COLORS[cls] }}>{targets[cls]}%</span>
                    {cls === '커버드콜' && coveredCallMonthlyDiv > 0 && divChangePlans.length > 0 && (
                      <span onClick={e => { e.stopPropagation(); setShowDivDetail(true); }}
                        style={{ fontSize: 'var(--text-xs)', color: ASSET_COLORS[cls], opacity: 0.8,
                          cursor: 'pointer', textDecoration: 'underline dotted' }}>▾</span>
                    )}
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>현재</span>
                    <span style={{ fontWeight: 700, color: diffColor }}>{cur.toFixed(1)}%</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: diffColor, opacity: 0.75 }}>
                      ({diff >= 0 ? '+' : ''}{diff.toFixed(1)})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(5, 1fr)', gap: '4px 0', fontSize: 'var(--text-sm)' }}>
            {/* 헤더 */}
            <span />
            {(Object.keys(targets) as AssetClass[]).map(cls => (
              <span key={cls} style={{ textAlign: 'center', fontWeight: 700, color: ASSET_COLORS[cls], paddingBottom: 4 }}>{cls}</span>
            ))}
            {/* 목표 */}
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', paddingRight: 10, display: 'flex', alignItems: 'center' }}>목표</span>
            {(Object.entries(targets) as [AssetClass, number][]).map(([cls, pct]) => (
              <span key={cls} style={{ textAlign: 'center', fontWeight: 700, color: ASSET_COLORS[cls] }}>
                {pct}%
                {cls === '커버드콜' && coveredCallMonthlyDiv > 0 && (
                  <span
                    onClick={e => { e.stopPropagation(); if (divChangePlans.length > 0) setShowDivDetail(true); }}
                    style={{ fontSize: 'var(--text-xs)', color: ASSET_COLORS[cls], opacity: 0.8, marginLeft: 3,
                      cursor: divChangePlans.length > 0 ? 'pointer' : 'default',
                      textDecoration: divChangePlans.length > 0 ? 'underline dotted' : 'none' }}>
                    {divChangePlans.length > 0 && '▾'}
                  </span>
                )}
              </span>
            ))}
            {/* 현재 */}
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', paddingRight: 10, display: 'flex', alignItems: 'center' }}>현재</span>
            {(Object.keys(targets) as AssetClass[]).map(cls => {
              const cur = currentAlloc[cls] ?? 0;
              const diff = cur - targets[cls];
              const diffColor = Math.abs(diff) <= 3 ? 'var(--color-profit)' : Math.abs(diff) <= 8 ? 'var(--color-warning)' : 'var(--color-loss)';
              return (
                <div key={cls} style={{ textAlign: 'center' }}>
                  <span style={{ fontWeight: 700, color: diffColor }}>{cur.toFixed(1)}%</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: diffColor, opacity: 0.75, marginLeft: 3 }}>
                    {diff >= 0 ? '+' : ''}{diff.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 계좌별 플랜 */}
      <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <MIcon name="account_balance_wallet" size={16} style={{ color: 'var(--text-secondary)' }} />
        계좌별 액션 플랜
        <button onClick={() => setShowGuide(true)} style={{
          marginLeft: 'auto', fontSize: 'var(--text-sm)', padding: '3px 10px', borderRadius: 6, fontWeight: 600,
          cursor: 'pointer', border: '1px solid var(--border-primary)',
          background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <MIcon name="info" size={13} style={{ color: 'var(--text-tertiary)' }} />
          가이드
        </button>
      </div>
      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}

      {/* 커버드콜 매수 변화 팝업 */}
      {showDivDetail && divChangePlans.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowDivDetail(false)}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 16, padding: '20px 20px', width: '100%', maxWidth: 680,
            maxHeight: '80vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>커버드콜 비중 변경 영향</div>
              <button onClick={() => setShowDivDetail(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 'var(--text-lg)' }}>✕</button>
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginBottom: 14 }}>
              {prevTargets && `커버드콜 ${prevTargets['커버드콜']}% → ${targets['커버드콜']}% · 계좌별 추가매수금액 변화`}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {divChangePlans.map((row, i) => {
                const diff = row.after - row.before;
                const isIncrease = diff > 0;
                return (
                  <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.accLabel}</div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.4,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{row.name}</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginBottom: 2 }}>{fmtKrw(row.before)} → {fmtKrw(row.after)}</div>
                    <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: isIncrease ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                      {isIncrease ? '+' : ''}{fmtKrw(diff)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 10, fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
              목표 비중 기준 월 배당 예상: <span style={{ fontWeight: 700, color: 'var(--asset-covered)' }}>{fmtKrw(coveredCallMonthlyDiv)}</span>
            </div>
          </div>
        </div>
      )}
      {signalsLoading && (
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <MIcon name="sync" size={14} style={{ color: 'var(--text-tertiary)' }} />
          시세 데이터 로딩 중... (MA20/MA60/고저점 계산)
        </div>
      )}

      {/* 신호 필터 + 액션 버튼 */}
      {!signalsLoading && (availableSignals.sell.length > 0 || availableSignals.buy.length > 0) && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center' }}>
            <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginRight: 2 }}>신호 필터</span>
            {isMobile ? (
              /* 모바일: select 단일 드롭다운 */
              <select
                value={signalFilter ? `${signalFilter.type}:${signalFilter.label}` : ''}
                onChange={e => {
                  const v = e.target.value;
                  if (!v) { setSignalFilter(null); return; }
                  const [type, ...rest] = v.split(':');
                  setSignalFilter({ type: type as 'sell' | 'buy', label: rest.join(':') });
                }}
                style={{
                  width: 110, height: 32, padding: '0 26px 0 10px', borderRadius: 8,
                  border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)', fontSize: 'var(--text-sm)', fontWeight: 600,
                  lineHeight: 1.2, boxSizing: 'border-box',
                  appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
                  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='7' viewBox='0 0 10 7'><path d='M1 1l4 4 4-4' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 9px center',
                  backgroundSize: '10px 7px',
                }}>
                <option value="">전체</option>
                {availableSignals.sell.length > 0 && (
                  <optgroup label="매도">
                    {availableSignals.sell.map(s => (
                      <option key={`sell-${s.label}`} value={`sell:${s.label}`}>{s.label}</option>
                    ))}
                  </optgroup>
                )}
                {availableSignals.buy.length > 0 && (
                  <optgroup label="매수">
                    {availableSignals.buy.map(s => (
                      <option key={`buy-${s.label}`} value={`buy:${s.label}`}>{s.label}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            ) : (
              <>
                <button
                  onClick={() => setSignalFilter(null)}
                  style={{ padding: '3px 10px', borderRadius: 6, fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', border: 'none',
                    background: signalFilter === null ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                    color: signalFilter === null ? 'var(--accent-blue-fg)' : 'var(--text-tertiary)' }}>
                  전체
                </button>
                {availableSignals.sell.length > 0 && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-quaternary)', padding: '0 2px' }}>매도</span>
                )}
                {availableSignals.sell.map(s => (
                  <button key={`sell-${s.label}`}
                    onClick={() => setSignalFilter(signalFilter?.label === s.label && signalFilter?.type === 'sell' ? null : { type: 'sell', label: s.label })}
                    style={{ padding: '3px 10px', borderRadius: 6, fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', border: 'none',
                      background: signalFilter?.type === 'sell' && signalFilter?.label === s.label
                        ? `color-mix(in srgb, ${s.color} 25%, var(--bg-tertiary))`
                        : `color-mix(in srgb, ${s.color} var(--badge-mix), transparent)`,
                      color: s.color,
                      outline: signalFilter?.type === 'sell' && signalFilter?.label === s.label ? `1.5px solid ${s.color}` : 'none',
                    }}>
                    {s.label}
                  </button>
                ))}
                {availableSignals.buy.length > 0 && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-quaternary)', padding: '0 2px' }}>매수</span>
                )}
                {availableSignals.buy.map(s => (
                  <button key={`buy-${s.label}`}
                    onClick={() => setSignalFilter(signalFilter?.label === s.label && signalFilter?.type === 'buy' ? null : { type: 'buy', label: s.label })}
                    style={{ padding: '3px 10px', borderRadius: 6, fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', border: 'none',
                      background: signalFilter?.type === 'buy' && signalFilter?.label === s.label
                        ? `color-mix(in srgb, ${s.color} 25%, var(--bg-tertiary))`
                        : `color-mix(in srgb, ${s.color} var(--badge-mix), transparent)`,
                      color: s.color,
                      outline: signalFilter?.type === 'buy' && signalFilter?.label === s.label ? `1.5px solid ${s.color}` : 'none',
                    }}>
                    {s.label}
                  </button>
                ))}
              </>
            )}
            </div>
            {/* 액션 버튼 */}
            <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap', justifyContent: isMobile ? 'flex-end' : 'flex-start' }}>
              <button onClick={() => setExpandAll(true)} title="모두 펼치기"
                style={{ padding: '4px 6px', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border-primary)',
                  background: 'var(--bg-secondary)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                <MIcon name="unfold_more" size={16} style={{ color: 'var(--text-tertiary)' }} />
              </button>
              <button onClick={() => setExpandAll(false)} title="모두 닫기"
                style={{ padding: '4px 6px', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border-primary)',
                  background: 'var(--bg-secondary)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                <MIcon name="unfold_less" size={16} style={{ color: 'var(--text-tertiary)' }} />
              </button>
              <button onClick={() => setShowComparison(c => !c)}
                style={{ fontSize: 'var(--text-sm)', padding: '4px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                  border: showComparison ? '1.5px solid var(--accent-blue)' : '1px solid var(--border-primary)',
                  background: showComparison ? 'color-mix(in srgb, var(--accent-blue) 12%, var(--bg-secondary))' : 'var(--bg-secondary)',
                  color: showComparison ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', gap: 4 }}>
                <MIcon name="compare_arrows" size={13} style={{ color: showComparison ? 'var(--accent-blue)' : 'var(--text-tertiary)' }} />
                비교
              </button>
              <button onClick={() => { setExecMode(m => !m); setCheckedSells(new Set()); setCheckedBuys(new Set()); }}
                style={{ fontSize: 'var(--text-sm)', padding: '4px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                  border: execMode ? '1.5px solid var(--color-profit)' : '1px solid var(--border-primary)',
                  background: execMode ? 'color-mix(in srgb, var(--color-profit) 12%, var(--bg-secondary))' : 'var(--bg-secondary)',
                  color: execMode ? 'var(--color-profit)' : 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', gap: 4 }}>
                <MIcon name={execMode ? 'close' : 'play_arrow'} size={13} style={{ color: execMode ? 'var(--color-profit)' : 'var(--text-tertiary)' }} />
                {execMode ? '취소' : '실행'}
              </button>
              {execMode && checkedCount > 0 && (
                <button onClick={handleExecSave} disabled={saving}
                  style={{ fontSize: 'var(--text-sm)', padding: '4px 12px', borderRadius: 8, cursor: saving ? 'wait' : 'pointer', fontWeight: 700,
                    border: 'none', background: 'var(--color-profit)', color: '#fff',
                    display: 'flex', alignItems: 'center', gap: 4, opacity: saving ? 0.6 : 1 }}>
                  <MIcon name="save" size={13} style={{ color: '#fff' }} />
                  {saving ? '저장 중...' : `저장 (${checkedCount}건)`}
                </button>
              )}
            </div>
          </div>
          {signalFilter && (
            <div style={{ marginTop: 6, fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
              {filteredPlans.length}개 계좌에 <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                {signalFilter.type === 'sell' ? '매도' : '매수'} · {signalFilter.label}
              </span> 신호 해당
            </div>
          )}
        </div>
      )}

      {/* 사이클 정보 배너 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 8, flexWrap: 'wrap',
        padding: isMobile ? '6px 10px' : '8px 12px', marginBottom: 10, borderRadius: 8,
        background: 'var(--bg-elevated)', border: '1px solid var(--border-secondary)',
        fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5,
      }}>
        <MIcon name="event" size={14} style={{ color: 'var(--text-tertiary)' }} />
        <span>
          이번 사이클 <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{cycleStart}</span> 시작 ·
          다음 재조정 <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{nextCycle}</span>
          <span style={{ color: 'var(--text-tertiary)' }}> ({daysUntil(nextCycle)}일 후)</span>
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {executedInCycle.size > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <MIcon name="check_circle" size={13} style={{ color: 'var(--color-profit)' }} />
              이번 사이클 실행 <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{executedInCycle.size}</span>건
            </span>
          )}
          <button onClick={() => setShowExecReport(true)} style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
            borderRadius: 6, padding: '2px 8px', fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)', cursor: 'pointer', lineHeight: 1.6,
          }}>실천 현황 ···</button>
        </span>
      </div>

      {filteredPlans.map(plan => (
        <AccountCard key={plan.acc.id} plan={plan} isMobile={isMobile} signals={signals} changeRates={changeRates} signalFilter={signalFilter}
          execMode={execMode} checkedSells={checkedSells} checkedBuys={checkedBuys}
          expandAll={expandAll}
          executedInCycle={executedInCycle}
          executedMap={executedMap}
          executionInputs={executionInputs}
          onExecutionInputChange={setExecutionInput}
          onToggleSell={k => toggleCheck(checkedSells, setCheckedSells, k)}
          onToggleBuy={k => toggleCheck(checkedBuys, setCheckedBuys, k)}
          onNameClick={(ticker, name) => {
            sessionStorage.setItem('chart_nav_ticker', ticker);
            sessionStorage.setItem('chart_nav_from', 'optimal-guide');
            sessionStorage.setItem('chart_nav_name', name);
            navigateTo('chart');
          }} />
      ))}

      {/* 실천 현황 팝업 */}
      {showExecReport && (() => {
        const prevStart = getPrevCycleStart(cycleStart);
        // 이번 사이클 기록
        const curRecs = Object.entries(executedMap).filter(([, r]) => r.date >= cycleStart);
        // 지난 사이클 기록
        const prevRecs = Object.entries(executedMap).filter(([, r]) => r.date >= prevStart && r.date < cycleStart);

        // 계좌/종목 이름 조회 맵
        const holdingNameMap = new Map<string, string>();
        const accNameMap = new Map<string, string>();
        for (const acc of accounts) {
          accNameMap.set(acc.id, accLabel(acc));
          for (const h of acc.holdings) holdingNameMap.set(`${acc.id}__${h.id}`, h.name);
        }

        function renderRecords(recs: [string, ExecutionRecord][], label: string) {
          if (recs.length === 0) return (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', padding: '8px 0' }}>실행 기록 없음</div>
          );
          // 그룹 by accId
          const byAcc = new Map<string, [string, ExecutionRecord][]>();
          for (const r of recs) {
            const accId = r[0].split('__')[0];
            if (!byAcc.has(accId)) byAcc.set(accId, []);
            byAcc.get(accId)!.push(r);
          }
          const totalAmt = recs.reduce((s, [, r]) => s + r.amount, 0);
          const totalRec = recs.reduce((s, [, r]) => s + r.recommendedAmount, 0);
          const totalPct = totalRec > 0 ? Math.round(totalAmt / totalRec * 100) : 100;
          return (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{label}</span>
                <span style={{ fontSize: 'var(--text-xs)', color: totalPct >= 80 ? 'var(--color-profit)' : totalPct >= 50 ? 'var(--accent-blue)' : 'var(--color-loss)', fontWeight: 700 }}>
                  전체 실천율 {totalPct}%
                </span>
              </div>
              {Array.from(byAcc.entries()).map(([accId, rows]) => {
                const aName = accNameMap.get(accId) || accId;
                return (
                  <div key={accId} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, padding: '4px 8px', background: 'var(--bg-elevated)', borderRadius: 4 }}>{aName}</div>
                    {rows.map(([key, rec]) => {
                      const hName = holdingNameMap.get(key) || key.split('__')[1];
                      const pct = rec.recommendedAmount > 0 ? Math.round(rec.amount / rec.recommendedAmount * 100) : 100;
                      const isSell = rec.type === 'sell';
                      return (
                        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', borderBottom: '1px solid var(--border-secondary)', fontSize: 'var(--text-xs)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ padding: '1px 5px', borderRadius: 4, fontSize: '10px', fontWeight: 700, background: isSell ? 'rgba(255,71,87,0.12)' : 'rgba(49,130,246,0.12)', color: isSell ? 'var(--color-loss)' : 'var(--accent-blue)' }}>
                              {isSell ? '매도' : '매수'}
                            </span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{hName}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <span style={{ color: 'var(--text-tertiary)' }}>
                              {rec.isFund ? `${(rec.amount / 10000).toFixed(0)}만` : `${rec.shares}주`}
                              {rec.recommendedAmount > 0 && rec.amount !== rec.recommendedAmount && (
                                <span style={{ color: 'var(--text-quaternary)', marginLeft: 2 }}>
                                  / {rec.isFund ? `${(rec.recommendedAmount / 10000).toFixed(0)}만` : `${rec.recommendedShares}주`}
                                </span>
                              )}
                            </span>
                            <span style={{ fontWeight: 700, minWidth: 36, textAlign: 'right', color: pct >= 80 ? 'var(--color-profit)' : pct >= 50 ? 'var(--accent-blue)' : 'var(--color-loss)' }}>
                              {pct}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 6, background: 'var(--bg-elevated)', fontSize: 'var(--text-xs)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>실행 금액 합계</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {(totalAmt / 10000).toFixed(0)}만원
                  {totalRec > 0 && totalRec !== totalAmt && <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>/ 추천 {(totalRec / 10000).toFixed(0)}만원</span>}
                </span>
              </div>
            </div>
          );
        }

        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)' }}
            onClick={e => { if (e.target === e.currentTarget) setShowExecReport(false); }}>
            <div style={{ background: 'var(--bg-primary)', borderRadius: 14, padding: isMobile ? 20 : 28, width: isMobile ? '92vw' : 480, maxWidth: '95vw', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>사이클 실천 현황</span>
                <button onClick={() => setShowExecReport(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 18, lineHeight: 1 }}>✕</button>
              </div>
              {renderRecords(curRecs, `이번 사이클 (${cycleStart} ~)`)}
              {prevRecs.length > 0 && renderRecords(prevRecs, `지난 사이클 (${prevStart} ~ ${cycleStart})`)}
              {curRecs.length === 0 && prevRecs.length === 0 && (
                <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: '24px 0' }}>
                  아직 실행 기록이 없습니다.<br />
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-quaternary)', marginTop: 6, display: 'block' }}>계좌 플랜에서 매매를 실행하면 여기에 기록됩니다.</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
