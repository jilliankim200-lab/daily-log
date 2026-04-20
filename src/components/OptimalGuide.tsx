import React, { useMemo, useState, useEffect } from 'react';
import { useAppContext } from '../App';
import { kvGet, saveAccounts } from '../api';
import { MIcon } from './MIcon';
import type { Account, Holding } from '../types';
import { fetchStockSignals, getSellSignal, getBuySignal } from '../utils/fetchStockSignals';
import type { StockSignal } from '../utils/fetchStockSignals';

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
  const hasRange = timing.range && timing.range[0] > 0 && timing.range[1] > timing.range[0];
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'default',
        background: `color-mix(in srgb, ${timing.color} var(--badge-mix), transparent)`,
        borderRadius: 5, padding: hasRange ? '2px 6px 3px' : '2px 6px' }}>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: timing.color, whiteSpace: 'nowrap' }}>
          {timing.label}
        </span>
        {hasRange && (
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 400, color: timing.color, opacity: 0.8, marginTop: 1, whiteSpace: 'nowrap' }}>
            {fmtP(timing.range![0])}~{fmtP(timing.range![1])}
          </span>
        )}
      </div>
      {show && (
        <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', right: 0, zIndex: 300,
          background: 'var(--bg-tooltip)', border: '1px solid var(--border-tooltip)',
          borderRadius: 8, padding: '7px 11px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)',
          whiteSpace: 'nowrap', boxShadow: 'var(--shadow-tooltip)' }}>
          {timing.desc}
        </div>
      )}
    </div>
  );
}

// ── 행 컴포넌트 ───────────────────────────────────────────────
function Row({ badge, badgeColor, name, cls, ret, amount, note, dim, extra }: {
  badge: string; badgeColor: string; name: string; cls?: AssetClass;
  ret?: number | null; amount?: number; note?: string; dim?: boolean; extra?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', opacity: dim ? 0.55 : 1 }}>
      <span style={{ fontSize: 'var(--text-sm)', padding: '2px 8px', borderRadius: 6, fontWeight: 600, flexShrink: 0,
        minWidth: 44, textAlign: 'center',
        background: `color-mix(in srgb, ${badgeColor} var(--badge-mix), transparent)`, color: badgeColor }}>
        {badge}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 'var(--text-base)', color: dim ? 'var(--text-tertiary)' : 'var(--text-primary)', fontWeight: 500,
          textDecoration: dim ? 'line-through' : 'none' }}>{name}</span>
        {cls && <span style={{ fontSize: 'var(--text-xs)', marginLeft: 5, padding: '1px 5px', borderRadius: 4,
          background: `color-mix(in srgb, ${ASSET_COLORS[cls]} var(--badge-mix), transparent)`, color: ASSET_COLORS[cls] }}>{cls}</span>}
      </div>
      {note && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', flexShrink: 0 }}>{note}</span>}
      {(ret != null || amount != null) && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: 1 }}>
          {ret != null && (
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
              수익률 <span style={{ fontWeight: 600, color: ret >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>{ret >= 0 ? '+' : ''}{ret.toFixed(1)}%</span>
            </span>
          )}
          {amount != null && (
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
              보유 <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{fmtKrw(amount)}</span>
            </span>
          )}
        </div>
      )}
      {extra}
    </div>
  );
}

function StepHeader({ step, label, sub, color }: { step: number; label: string; sub?: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 4 }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: `color-mix(in srgb, ${color} 20%, transparent)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color }}>{step}</span>
      </div>
      <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color }}>{label}</span>
      {sub && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', fontWeight: 400 }}>{sub}</span>}
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
function AccountCard({ plan, isMobile, signals, signalFilter, execMode, checkedSells, checkedBuys, onToggleSell, onToggleBuy, dismissedBuys, onDismissBuy }: {
  plan: AccountPlan; isMobile: boolean; signals: Record<string, StockSignal>; signalFilter: SignalFilter;
  execMode?: boolean; checkedSells?: Set<string>; checkedBuys?: Set<string>;
  onToggleSell?: (key: string) => void; onToggleBuy?: (key: string) => void;
  dismissedBuys?: Set<string>; onDismissBuy?: (accId: string, holdingId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { acc, sells, keeps, buys, freedCash, projectedSafePct, safeStatus, totalVal, safeAdjust } = plan;

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

  const borderColor = hasIssue
    ? 'color-mix(in srgb, var(--color-loss) 25%, var(--border-primary))'
    : sells.length > 0
    ? 'color-mix(in srgb, var(--accent-blue) 20%, var(--border-primary))'
    : 'var(--border-primary)';

  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, marginBottom: 14, border: `1px solid ${borderColor}`, overflow: 'hidden' }}>
      {/* 헤더 */}
      <div onClick={() => setCollapsed(c => !c)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', cursor: 'pointer',
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
        <div style={{ padding: '14px 16px 16px' }}>

          {/* 안전자산 (퇴직/IRP) */}
          {isRet && (
            <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 10,
              background: safeStatus === 'good' ? 'color-mix(in srgb, var(--color-profit) 8%, var(--bg-tertiary))' : safeStatus === 'over' ? 'color-mix(in srgb, var(--color-warning) 8%, var(--bg-tertiary))' : 'color-mix(in srgb, var(--color-loss) 8%, var(--bg-tertiary))',
              border: `1px solid ${safeStatus === 'good' ? 'color-mix(in srgb, var(--color-profit) 20%, transparent)' : 'color-mix(in srgb, var(--color-loss) 20%, transparent)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>매도 후 안전자산 비율</span>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: safeStatus === 'good' ? 'var(--color-profit)' : safeStatus === 'over' ? 'var(--color-warning)' : 'var(--color-loss)' }}>
                  {projectedSafePct.toFixed(1)}% {safeStatus === 'good' ? '✓ 적정' : safeStatus === 'under' ? '⚠ 미달' : '▲ 초과'}
                </span>
              </div>
              {safeAdjust && <div style={{ marginTop: 4, fontSize: 'var(--text-sm)', fontWeight: 600, color: safeStatus === 'under' ? 'var(--color-loss)' : 'var(--color-warning)' }}>
                → {safeAdjust.action} 필요: {fmtKrw(safeAdjust.amount)}
              </div>}
              <div style={{ position: 'relative', height: 5, marginTop: 8, background: 'var(--bg-elevated)', borderRadius: 3 }}>
                <div style={{ position: 'absolute', left: 0, top: 0, height: 5, borderRadius: 3, width: `${Math.min(projectedSafePct, 100)}%`, background: safeStatus === 'good' ? 'var(--color-profit)' : safeStatus === 'over' ? 'var(--color-warning)' : 'var(--color-loss)', transition: 'width 0.5s' }} />
                <div style={{ position: 'absolute', left: '30%', top: -2, width: 2, height: 9, background: 'var(--color-profit)', borderRadius: 1 }} />
                <div style={{ position: 'absolute', left: '35%', top: -2, width: 2, height: 9, background: 'var(--color-warning)', borderRadius: 1 }} />
              </div>
            </div>
          )}

          {/* 변경 없음 */}
          {sells.length === 0 && (
            <div>
              {keeps.map((k, i) => {
                const matched = isRowMatch(k.h.ticker, 'buy');
                return (
                  <div key={k.h.id} style={{ borderBottom: i < keeps.length - 1 ? '1px solid var(--border-secondary)' : 'none',
                    opacity: signalFilter?.type === 'buy' && !matched ? 0.25 : 1, transition: 'opacity 0.15s' }}>
                    <Row badge={k.isHighReturn ? '★유지' : '유지'} badgeColor={k.isHighReturn ? 'var(--color-gold)' : 'var(--color-profit)'}
                      name={k.h.name} cls={k.cls} ret={k.ret} amount={k.val} />
                    {k.keepReason && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', padding: '0 0 4px 56px', marginTop: -4 }}>{k.keepReason}</div>}
                  </div>
                );
              })}
              {acc.cash && acc.cash > 0 && <Row badge="유지" badgeColor="var(--color-profit)" name="현금" amount={acc.cash} />}
            </div>
          )}

          {/* STEP 1: 매도 */}
          {sells.length > 0 && (
            <div style={{ marginBottom: 16, opacity: signalFilter?.type === 'buy' ? 0.25 : 1, transition: 'opacity 0.15s' }}>
              <StepHeader step={1} label="매도" sub={`— 총 ${fmtKrw(sells.reduce((s, r) => s + r.val, 0))} 현금화`} color="var(--color-loss)" />
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: '4px 12px' }}>
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
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Row badge="전량매도" badgeColor="var(--color-loss)" name={s.h.name} cls={s.cls}
                            ret={s.ret} amount={s.val}
                            note={s.h.isFund ? undefined : s.h.quantity ? `${s.h.quantity}주` : undefined}
                            dim={!matched}
                            extra={<TimingBadge timing={timing} />} />
                        </div>
                      </div>
                      {s.reasonDetail && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', padding: '0 0 4px 56px', marginTop: -4 }}>{s.reasonDetail}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: 재매수 — 매도 현금 or 기존 현금이 있을 때 표시 */}
          {freedCash > 0 && keeps.length > 0 && (
            <div style={{ opacity: signalFilter?.type === 'sell' ? 0.25 : 1, transition: 'opacity 0.15s' }}>
              <StepHeader step={sells.length > 0 ? 2 : 1} label="재매수"
                sub={sells.length > 0
                  ? `— 가용현금 ${fmtKrw(freedCash)} (매도 ${fmtKrw(sells.reduce((s,r)=>s+r.val,0))}${acc.cash ? ` + 기존현금 ${fmtKrw(acc.cash)}` : ''}) 비중대로 배분`
                  : `— 기존현금 ${fmtKrw(acc.cash ?? 0)} 비중대로 배분`}
                color="var(--color-profit)" />

              {noKeeps ? (
                <div style={{ background: 'color-mix(in srgb, var(--color-warning) 8%, var(--bg-tertiary))', borderRadius: 10, padding: '12px 14px',
                  border: '1px solid color-mix(in srgb, var(--color-warning) 20%, transparent)', fontSize: 'var(--text-sm)', color: 'var(--color-warning)', lineHeight: 1.7 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠ 이 계좌에 유지할 종목이 없습니다</div>
                  <div style={{ color: 'var(--text-secondary)' }}>모든 종목이 다른 계좌에도 보유 중입니다. 아래 중 하나를 선택하세요:</div>
                  <div style={{ marginTop: 6, color: 'var(--text-tertiary)' }}>
                    A. 매도하지 않고 중복 그대로 유지<br />
                    B. {fmtKrw(freedCash)}로 이 계좌에 새 종목 직접 선택 매수
                  </div>
                </div>
              ) : (
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: '4px 12px' }}>
                  {keeps.map((k, i) => {
                    const buy = buys.find(b => b.h.id === k.h.id);
                    const isDismissed = dismissedBuys?.has(`${acc.id}__${k.h.id}`);
                    const addBadge = buy && buy.addAmount > 0 && !isDismissed ? (
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 400, color: 'var(--color-profit)', flexShrink: 0,
                        background: 'color-mix(in srgb, var(--color-profit) 10%, transparent)', borderRadius: 6, padding: '3px 8px', marginLeft: 4 }}>
                        +{fmtKrw(buy.addAmount)}{buy.shares && buy.shares > 0 ? ` (약 ${buy.shares}주)` : ''}
                      </span>
                    ) : null;
                    const sig = k.h.ticker ? signals[k.h.ticker] : undefined;
                    const timing = sig ? getBuySignal(sig) : noSignal();
                    const hasBuy = buy && buy.addAmount > 0 && !isDismissed;
                    return (
                      <div key={k.h.id} style={{ borderBottom: i < keeps.length - 1 ? '1px solid var(--border-secondary)' : 'none',
                        opacity: signalFilter?.type === 'buy' && !matched ? 0.25 : 1, transition: 'opacity 0.15s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {buy && buy.addAmount > 0 && isDismissed && (
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', flexShrink: 0,
                              padding: '1px 6px', borderRadius: 4, background: 'var(--bg-elevated)', border: '1px solid var(--border-secondary)' }}>
                              매수완료
                            </span>
                          )}
                          {execMode && hasBuy && (
                            <button onClick={() => onToggleBuy?.(`${acc.id}__${k.h.id}`)}
                              style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, cursor: 'pointer',
                                border: `2px solid ${checkedBuys?.has(`${acc.id}__${k.h.id}`) ? 'var(--color-profit)' : 'var(--text-tertiary)'}`,
                                background: checkedBuys?.has(`${acc.id}__${k.h.id}`) ? 'color-mix(in srgb, var(--color-profit) 20%, transparent)' : 'var(--bg-elevated)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                              {checkedBuys?.has(`${acc.id}__${k.h.id}`) && <MIcon name="check" size={14} style={{ color: 'var(--color-profit)' }} />}
                            </button>
                          )}
                          {!execMode && buy && buy.addAmount > 0 && !isDismissed && (
                            <button onClick={() => onDismissBuy?.(acc.id, k.h.id)}
                              title="이미 매수했어요"
                              style={{ flexShrink: 0, fontSize: 10, color: 'var(--text-tertiary)', cursor: 'pointer',
                                padding: '1px 5px', borderRadius: 4, border: '1px solid var(--border-secondary)',
                                background: 'transparent', lineHeight: 1.4 }}>
                              이미 매수
                            </button>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Row badge={k.isHighReturn ? '★유지' : '추가매수'} badgeColor={k.isHighReturn ? 'var(--color-gold)' : 'var(--color-profit)'}
                              name={k.h.name} cls={k.cls} ret={k.ret} amount={k.val}
                              extra={<>{addBadge}<TimingBadge timing={timing} /></>} />
                          </div>
                        </div>
                        {k.keepReason && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', padding: '0 0 4px 56px', marginTop: -4 }}>{k.keepReason}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 뱃지 범위 기준 모달 ────────────────────────────────────────
const BADGE_RANGE_ROWS: { badge: string; color: string; type: '매도' | '매수'; range: string; desc: string }[] = [
  { badge: '매도 적합', color: 'var(--color-profit)', type: '매도', range: '현재가 ~ 70일 고점', desc: '상승 추세 고점 구간, 지금부터 고점까지 매도 유효' },
  { badge: '매도 가능 (상승)', color: 'var(--color-profit)', type: '매도', range: '현재가 ~ 70% 위치점', desc: '추가 상승 여지 있으나 매도 가능한 구간' },
  { badge: '매도 가능 (횡보)', color: 'var(--color-warning)', type: '매도', range: '현재가 ~ 70일 고점', desc: '횡보 중상단, 고점까지 매도 구간' },
  { badge: '반등 대기', color: 'var(--color-warning)', type: '매도', range: 'MA20 ~ 70일 고점', desc: '횡보 하단, 반등 후 이 구간 진입 시 매도' },
  { badge: '저점 매도', color: 'var(--color-loss)', type: '매도', range: '70일 저점 ~ 현재가', desc: '손절 구간, 이미 저점권에 있음' },
  { badge: '반등 후 매도', color: 'var(--color-loss)', type: '매도', range: 'MA60 ~ MA20', desc: '하락 추세, 반등 시 MA 구간 도달하면 매도' },
  { badge: '반등 대기 (저점)', color: 'var(--color-warning)', type: '매수', range: '70일 저점 ~ MA20', desc: '70일 저점 근처, 하락 중 — MA20 회복 후 매수 진입' },
  { badge: '반등 대기 (하락)', color: 'var(--color-warning)', type: '매수', range: '70일 저점 ~ MA20', desc: '하락 추세 진행 중 — MA20 돌파 시점에 매수 권장' },
  { badge: '매수 적합 (횡보)', color: 'var(--color-profit)', type: '매수', range: '70일 저점 ~ MA20', desc: '횡보 하단 매수 구간' },
  { badge: '분할 매수 (횡보)', color: 'var(--color-warning)', type: '매수', range: '70일 저점 ~ 현재가', desc: '횡보 중, 저점~현재가 구간 분할 매수' },
  { badge: '매수 가능', color: 'var(--color-profit)', type: '매수', range: 'MA20 ~ 현재가', desc: '상승 추세 초입, MA20 이상 구간에서 매수' },
  { badge: '분할 매수 (상승)', color: 'var(--color-warning)', type: '매수', range: 'MA20 ~ 현재가', desc: '상승 중상단, MA20 ~ 현재가 구간 나눠 매수' },
  { badge: '조정 대기', color: 'var(--color-loss)', type: '매수', range: 'MA60 ~ MA20', desc: '고점 근처, 조정 시 MA 구간 도달하면 매수' },
];

function BadgeRangeModal({ onClose }: { onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-elevated)', borderRadius: 14,
        border: '1px solid var(--border-primary)', width: '100%', maxWidth: 640, maxHeight: '80vh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: '1px solid var(--border-secondary)' }}>
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>타이밍 뱃지별 범위 기준</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-tertiary)', fontSize: 18, lineHeight: 1, padding: '2px 4px' }}>✕</button>
        </div>
        {/* 설명 */}
        <div style={{ padding: '10px 18px 6px', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          뱃지 아래 숫자는 해당 신호가 유효한 <strong style={{ color: 'var(--text-secondary)' }}>매도/매수 실행 가격 범위</strong>입니다.
          매도 범위는 현재가·기술적 고점 기준, 매수 범위는 저점·MA 기준으로 산출합니다.
        </div>
        {/* 테이블 */}
        <div style={{ overflowY: 'auto', padding: '4px 18px 18px' }}>
          {/* 매도 */}
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-loss)', margin: '12px 0 6px', letterSpacing: 1 }}>SELL — 매도 신호</div>
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-secondary)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', background: 'var(--bg-tertiary)',
              padding: '6px 12px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', gap: 8 }}>
              <span>뱃지</span><span>가격 범위</span><span>설명</span>
            </div>
            {BADGE_RANGE_ROWS.filter(r => r.type === '매도').map((r, i, arr) => (
              <div key={r.badge} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 8,
                padding: '8px 12px', fontSize: 'var(--text-sm)', alignItems: 'start',
                borderTop: i > 0 ? '1px solid var(--border-secondary)' : 'none',
                background: i % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--bg-tertiary) 50%, transparent)' }}>
                <span style={{ fontWeight: 600, color: r.color }}>{r.badge}</span>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{r.range}</span>
                <span style={{ color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{r.desc}</span>
              </div>
            ))}
          </div>
          {/* 매수 */}
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-profit)', margin: '16px 0 6px', letterSpacing: 1 }}>BUY — 매수 신호</div>
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-secondary)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', background: 'var(--bg-tertiary)',
              padding: '6px 12px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', gap: 8 }}>
              <span>뱃지</span><span>가격 범위</span><span>설명</span>
            </div>
            {BADGE_RANGE_ROWS.filter(r => r.type === '매수').map((r, i) => (
              <div key={r.badge} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 8,
                padding: '8px 12px', fontSize: 'var(--text-sm)', alignItems: 'start',
                borderTop: i > 0 ? '1px solid var(--border-secondary)' : 'none',
                background: i % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--bg-tertiary) 50%, transparent)' }}>
                <span style={{ fontWeight: 600, color: r.color }}>{r.badge}</span>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{r.range}</span>
                <span style={{ color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{r.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 메인 ──────────────────────────────────────────────────────
type TargetAllocation = { 주식: number; 채권: number; 커버드콜: number; 금: number; 기타: number };
const DEFAULT_TARGETS: TargetAllocation = { 주식: 60, 채권: 20, 커버드콜: 10, 금: 5, 기타: 5 };

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
  targets: TargetAllocation, overrideKeeps: Set<string>
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
        reasonDetail: `${accLabel(winner.acc)}(우선순위 ${wp})에 동일 종목 → ${accLabel(item.acc)}(우선순위 ${tp})에서 매도`
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
    const buys = computeBuys(keeps, cash, targets, prices);

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
  const [showRangeGuide, setShowRangeGuide] = useState(false);
  const [signalFilter, setSignalFilter] = useState<SignalFilter>(null);
  const [targets, setTargets] = useState<TargetAllocation>(loadTargetsFromStorage);
  const [prevTargets, setPrevTargets] = useState<TargetAllocation | null>(null);
  const [showDivDetail, setShowDivDetail] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(1450);
  const [showComparison, setShowComparison] = useState(false);
  const [execMode, setExecMode] = useState(false);
  const [checkedSells, setCheckedSells] = useState<Set<string>>(new Set()); // `${accId}__${holdingId}`
  const [checkedBuys, setCheckedBuys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [dismissedBuys, setDismissedBuys] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('og_dismissed_buys') || '[]')); }
    catch { return new Set(); }
  });
  const dismissBuy = (accId: string, holdingId: string) => {
    const key = `${accId}__${holdingId}`;
    const next = new Set(dismissedBuys);
    next.add(key);
    setDismissedBuys(next);
    localStorage.setItem('og_dismissed_buys', JSON.stringify([...next]));
  };
  const clearDismissed = () => {
    setDismissedBuys(new Set());
    localStorage.removeItem('og_dismissed_buys');
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
    computeAllPlans(accounts, prices, targets, new Set()), [accounts, prices, targets]);

  const toggleCheck = (set: Set<string>, setFn: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) => {
    setFn(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  };

  const checkedCount = checkedSells.size + checkedBuys.size;

  const handleExecSave = async () => {
    if (checkedCount === 0) return;
    setSaving(true);
    try {
      const updated = structuredClone(accounts);
      // 1. 매도 처리: 체크된 종목 제거 + 현금에 매도금액 추가
      for (const key of checkedSells) {
        const [accId, holdingId] = key.split('__');
        const acc = updated.find(a => a.id === accId);
        if (!acc) continue;
        const idx = acc.holdings.findIndex(h => h.id === holdingId);
        if (idx === -1) continue;
        const h = acc.holdings[idx];
        const sellVal = hVal(h, prices);
        acc.holdings.splice(idx, 1);
        acc.cash = (acc.cash || 0) + sellVal;
      }
      // 2. 추가매수 처리: 체크된 종목의 수량 증가 + 현금 차감
      for (const key of checkedBuys) {
        const [accId, holdingId] = key.split('__');
        const acc = updated.find(a => a.id === accId);
        if (!acc) continue;
        const h = acc.holdings.find(hh => hh.id === holdingId);
        if (!h) continue;
        // 해당 plan에서 buy 정보 찾기
        const plan = accountPlans.find(p => p.acc.id === accId);
        if (!plan) continue;
        const buy = plan.buys.find(b => b.h.id === holdingId);
        if (!buy || buy.addAmount <= 0) continue;
        if (h.isFund) {
          h.amount = (h.amount || 0) + buy.addAmount;
        } else if (buy.shares && buy.shares > 0 && buy.price) {
          h.quantity += buy.shares;
          // 평단가 재계산
          const oldCost = h.avgPrice * (h.quantity - buy.shares);
          const newCost = buy.price * buy.shares;
          h.avgPrice = Math.round((oldCost + newCost) / h.quantity);
        }
        acc.cash = Math.max(0, (acc.cash || 0) - buy.addAmount);
      }
      await saveAccounts(updated);
      await reloadAccounts();
      setExecMode(false);
      setCheckedSells(new Set());
      setCheckedBuys(new Set());
      clearDismissed();
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

  // 전체 티커 수집 후 신호 fetch
  useEffect(() => {
    const tickers = accounts.flatMap(a => a.holdings.map(h => h.ticker)).filter(Boolean);
    if (tickers.length === 0) return;
    setSignalsLoading(true);
    fetchStockSignals(tickers).then(data => {
      setSignals(data);
      setSignalsLoading(false);
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
          const sig = getBuySignal(signals[k.h.ticker]);
          buyMap.set(sig.label, sig.color);
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
        return plan.keeps.some(k =>
          k.h.ticker && signals[k.h.ticker] && getBuySignal(signals[k.h.ticker]).label === signalFilter.label
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { icon: 'remove_shopping_cart', label: '매도 종목', value: `${totalSells}개`, color: totalSells > 0 ? 'var(--color-loss)' : 'var(--color-profit)' },
          { icon: 'warning', label: '안전자산 조정', value: `${retirementIssues}개`, color: retirementIssues > 0 ? 'var(--color-loss)' : 'var(--color-profit)' },
          { icon: 'account_balance', label: '전체 계좌', value: `${accounts.length}개`, color: 'var(--text-secondary)' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: `color-mix(in srgb, ${c.color} 15%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MIcon name={c.icon} size={16} style={{ color: c.color }} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>{c.label}</div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: c.color }}>{c.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 시뮬레이션 비교 + 실행 */}
      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setShowComparison(c => !c)}
          style={{ fontSize: 'var(--text-sm)', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
            border: showComparison ? '1.5px solid var(--accent-blue)' : '1px solid var(--border-primary)',
            background: showComparison ? 'color-mix(in srgb, var(--accent-blue) 12%, var(--bg-secondary))' : 'var(--bg-secondary)',
            color: showComparison ? 'var(--accent-blue)' : 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', gap: 5 }}>
          <MIcon name="compare_arrows" size={14} style={{ color: showComparison ? 'var(--accent-blue)' : 'var(--text-tertiary)' }} />
          시뮬레이션 비교
        </button>
        <button onClick={() => { setExecMode(m => !m); setCheckedSells(new Set()); setCheckedBuys(new Set()); }}
          style={{ fontSize: 'var(--text-sm)', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
            border: execMode ? '1.5px solid var(--color-profit)' : '1px solid var(--border-primary)',
            background: execMode ? 'color-mix(in srgb, var(--color-profit) 12%, var(--bg-secondary))' : 'var(--bg-secondary)',
            color: execMode ? 'var(--color-profit)' : 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', gap: 5 }}>
          <MIcon name={execMode ? 'close' : 'play_arrow'} size={14} style={{ color: execMode ? 'var(--color-profit)' : 'var(--text-tertiary)' }} />
          {execMode ? '실행 취소' : '실행'}
        </button>
        {execMode && checkedCount > 0 && (
          <button onClick={handleExecSave} disabled={saving}
            style={{ fontSize: 'var(--text-sm)', padding: '6px 14px', borderRadius: 8, cursor: saving ? 'wait' : 'pointer', fontWeight: 700,
              border: 'none', background: 'var(--color-profit)', color: '#fff',
              display: 'flex', alignItems: 'center', gap: 5, opacity: saving ? 0.6 : 1 }}>
            <MIcon name="save" size={14} style={{ color: '#fff' }} />
            {saving ? '저장 중...' : `실행 저장 (${checkedCount}건)`}
          </button>
        )}
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(Object.entries(targets) as [AssetClass, number][]).map(([cls, pct]) => (
            <div key={cls} style={{ display: 'flex', alignItems: 'baseline', gap: 5,
              background: `color-mix(in srgb, ${ASSET_COLORS[cls]} var(--badge-mix), transparent)`,
              borderRadius: 6, padding: '4px 10px' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: ASSET_COLORS[cls], fontWeight: 600 }}>{cls}</span>
              <span style={{ fontSize: 'var(--text-sm)', color: ASSET_COLORS[cls], fontWeight: 700 }}>{pct}%</span>
              {cls === '커버드콜' && coveredCallMonthlyDiv > 0 && (
                <span
                  onClick={e => { e.stopPropagation(); if (divChangePlans.length > 0) setShowDivDetail(true); }}
                  style={{ fontSize: 'var(--text-xs)', color: ASSET_COLORS[cls], opacity: 0.85, marginLeft: 2,
                    cursor: divChangePlans.length > 0 ? 'pointer' : 'default',
                    textDecoration: divChangePlans.length > 0 ? 'underline dotted' : 'none' }}>
                  월 배당 {fmtKrw(coveredCallMonthlyDiv)}
                  {divChangePlans.length > 0 && ' ▾'}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 원칙 */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '14px 16px', marginBottom: 20, fontSize: 'var(--text-sm)', lineHeight: 1.9, color: 'var(--text-tertiary)' }}>
        <div style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, fontSize: 'var(--text-base)' }}>적용 원칙</div>

        <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 2 }}>[ 매도/재배분 기준 ]</div>
        <div>① 동일 종목이 여러 계좌에 있으면 <span style={{ color: 'var(--text-secondary)' }}>절세 우선순위 낮은 계좌에서 매도</span></div>
        <div style={{ paddingLeft: 12, color: 'var(--text-tertiary)' }}>IRP &gt; 퇴직연금 &gt; 연금저축 &gt; ISA &gt; 일반/CMA</div>
        <div>② 매도 현금은 <span style={{ color: 'var(--color-profit)' }}>같은 계좌 유지 종목에 목표 비중 기반 재배분</span> (계좌 간 이동 없음)</div>
        <div>③ <span style={{ color: 'var(--color-gold)' }}>★ 수익률 40%↑</span> 종목은 중복이어도 매도하지 않음 (세금/수수료 고려)</div>
        <div>④ 퇴직/IRP는 매도 후 안전자산(채권+금) 비율이 30~35% 유지되는지 별도 체크</div>

        <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginTop: 10, marginBottom: 6 }}>[ 타이밍 신호 기준 — 실제 시세 데이터 ]</div>
        <div style={{ marginBottom: 6 }}>
          <span style={{ color: 'var(--color-profit)', fontWeight: 600 }}>MA20</span> 최근 20거래일 평균가 (단기 추세) &nbsp;·&nbsp;
          <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>MA60</span> 최근 60거래일 평균가 (중기 추세) &nbsp;·&nbsp;
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>위치</span> 70일 저점~고점 범위 내 현재가 위치 (0%=저점, 100%=고점)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
          <div><span style={{ color: 'var(--color-profit)', fontWeight: 600 }}>매도 적합</span> — 현재가가 MA20·MA60 모두 위 + 위치 70% 이상 → 상승 추세 고점, 지금 팔기 유리</div>
          <div><span style={{ color: 'var(--color-profit)', fontWeight: 600 }}>매도 가능</span> — 현재가가 MA20·MA60 위 + 위치 70% 미만 → 상승 중이나 추가 여지 있음</div>
          <div><span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>반등 대기</span> — 횡보 구간(MA20·MA60 사이) + 위치 하단 → 소폭 반등 후 매도 권장</div>
          <div><span style={{ color: 'var(--color-loss)', fontWeight: 600 }}>반등 후 매도</span> — 현재가가 MA20·MA60 모두 아래 → 하락 추세, 지금 매도 시 손해 가능성</div>
          <div><span style={{ color: 'var(--color-profit)', fontWeight: 600 }}>저점 매수</span> — 현재가가 MA20·MA60 모두 아래 + 위치 30% 이하 → 바닥 구간, 매수 기회</div>
          <div><span style={{ color: 'var(--color-profit)', fontWeight: 600 }}>분할 매수</span> — 하락 추세이나 저점 미확인 → 한 번에 아닌 2~3회 나눠 매수</div>
          <div><span style={{ color: 'var(--color-profit)', fontWeight: 600 }}>매수 가능</span> — 현재가가 MA20·MA60 위 + 위치 60% 미만 → 상승 추세 초입 구간, 즉시 매수 가능</div>
          <div><span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>분할 매수</span> — 상승 추세 + 위치 60~80% → 오르고 있으나 고점 위험, 2회 분할 권장</div>
          <div><span style={{ color: 'var(--color-loss)', fontWeight: 600 }}>조정 대기</span> — 현재가가 MA20·MA60 위 + 위치 80% 이상 → 고점 근처, 조정 후 매수 권장</div>
        </div>
      </div>

      {/* 계좌별 플랜 */}
      <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <MIcon name="account_balance_wallet" size={16} style={{ color: 'var(--text-secondary)' }} />
        계좌별 액션 플랜
        <button onClick={() => setShowRangeGuide(true)} style={{
          marginLeft: 'auto', fontSize: 'var(--text-sm)', padding: '3px 10px', borderRadius: 6, fontWeight: 600,
          cursor: 'pointer', border: '1px solid var(--border-primary)',
          background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <MIcon name="info" size={13} style={{ color: 'var(--text-tertiary)' }} />
          뱃지별 범위 기준
        </button>
      </div>
      {showRangeGuide && <BadgeRangeModal onClose={() => setShowRangeGuide(false)} />}

      {/* 커버드콜 매수 변화 팝업 */}
      {showDivDetail && divChangePlans.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowDivDetail(false)}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 16, padding: '20px 20px', width: '100%', maxWidth: 680,
            maxHeight: '80vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>커버드콜 비중 변경 영향</div>
              <button onClick={() => setShowDivDetail(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 18 }}>✕</button>
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

      {/* 신호 필터 */}
      {!signalsLoading && (availableSignals.sell.length > 0 || availableSignals.buy.length > 0) && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginRight: 2 }}>신호 필터</span>
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

      {dismissedBuys.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
          padding: '6px 12px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-secondary)' }}>
          <MIcon name="check_circle" size={14} style={{ color: 'var(--color-profit)' }} />
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
            {dismissedBuys.size}개 종목 매수완료로 숨김
          </span>
          <button onClick={clearDismissed} style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)',
            cursor: 'pointer', border: '1px solid var(--border-secondary)', borderRadius: 4,
            padding: '1px 8px', background: 'transparent' }}>초기화</button>
        </div>
      )}
      {filteredPlans.map(plan => (
        <AccountCard key={plan.acc.id} plan={plan} isMobile={isMobile} signals={signals} signalFilter={signalFilter}
          execMode={execMode} checkedSells={checkedSells} checkedBuys={checkedBuys}
          onToggleSell={k => toggleCheck(checkedSells, setCheckedSells, k)}
          onToggleBuy={k => toggleCheck(checkedBuys, setCheckedBuys, k)}
          dismissedBuys={dismissedBuys} onDismissBuy={dismissBuy} />
      ))}
    </div>
  );
}
