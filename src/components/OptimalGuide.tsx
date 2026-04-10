import React, { useMemo, useState, useEffect } from 'react';
import { useAppContext } from '../App';
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
  keeps: { h: Holding; val: number; cls: AssetClass; ret: number | null; isHighReturn: boolean }[];
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
        <span style={{ fontSize: 10, fontWeight: 600, color: timing.color, whiteSpace: 'nowrap' }}>
          {timing.label}
        </span>
        {hasRange && (
          <span style={{ fontSize: 9, fontWeight: 400, color: timing.color, opacity: 0.8, marginTop: 1, whiteSpace: 'nowrap' }}>
            {fmtP(timing.range![0])}~{fmtP(timing.range![1])}
          </span>
        )}
      </div>
      {show && (
        <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', right: 0, zIndex: 300,
          background: 'var(--bg-tooltip)', border: '1px solid var(--border-tooltip)',
          borderRadius: 8, padding: '7px 11px', fontSize: 11, color: 'var(--text-primary)',
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
      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, fontWeight: 600, flexShrink: 0,
        minWidth: 44, textAlign: 'center',
        background: `color-mix(in srgb, ${badgeColor} var(--badge-mix), transparent)`, color: badgeColor }}>
        {badge}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, color: dim ? 'var(--text-tertiary)' : 'var(--text-primary)', fontWeight: 500,
          textDecoration: dim ? 'line-through' : 'none' }}>{name}</span>
        {cls && <span style={{ fontSize: 10, marginLeft: 5, padding: '1px 5px', borderRadius: 4,
          background: `color-mix(in srgb, ${ASSET_COLORS[cls]} var(--badge-mix), transparent)`, color: ASSET_COLORS[cls] }}>{cls}</span>}
      </div>
      {note && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>{note}</span>}
      {(ret != null || amount != null) && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: 1 }}>
          {ret != null && (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              수익률 <span style={{ fontWeight: 600, color: ret >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>{ret >= 0 ? '+' : ''}{ret.toFixed(1)}%</span>
            </span>
          )}
          {amount != null && (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
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
        <span style={{ fontSize: 11, fontWeight: 800, color }}>{step}</span>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color }}>{label}</span>
      {sub && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400 }}>{sub}</span>}
    </div>
  );
}

// ── 계좌 카드 ──────────────────────────────────────────────────
function AccountCard({ plan, isMobile, signals, signalFilter }: { plan: AccountPlan; isMobile: boolean; signals: Record<string, StockSignal>; signalFilter: SignalFilter }) {
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
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{accLabel(acc)}</span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)', borderRadius: 5, padding: '1px 6px' }}>{acc.accountType}</span>
          {sells.length > 0
            ? <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, fontWeight: 600, background: 'color-mix(in srgb, var(--color-loss) 15%, transparent)', color: 'var(--color-loss)' }}>매도 {sells.length}개</span>
            : <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, fontWeight: 600, background: 'color-mix(in srgb, var(--color-profit) 15%, transparent)', color: 'var(--color-profit)' }}>변경 없음</span>
          }
          {isRet && hasIssue && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, fontWeight: 600, background: 'color-mix(in srgb, var(--color-loss) 15%, transparent)', color: 'var(--color-loss)' }}>
            {safeStatus === 'under' ? '⚠ 안전자산 미달' : '▲ 안전자산 초과'}
          </span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{fmtKrw(totalVal)}</span>
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
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>매도 후 안전자산 비율</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: safeStatus === 'good' ? 'var(--color-profit)' : safeStatus === 'over' ? 'var(--color-warning)' : 'var(--color-loss)' }}>
                  {projectedSafePct.toFixed(1)}% {safeStatus === 'good' ? '✓ 적정' : safeStatus === 'under' ? '⚠ 미달' : '▲ 초과'}
                </span>
              </div>
              {safeAdjust && <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: safeStatus === 'under' ? 'var(--color-loss)' : 'var(--color-warning)' }}>
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
                    <Row badge={k.isHighReturn ? '★유지' : '유지'} badgeColor={k.isHighReturn ? '#FFD700' : 'var(--color-profit)'}
                      name={k.h.name} cls={k.cls} ret={k.ret} amount={k.val} />
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
                      <Row badge="전량매도" badgeColor="var(--color-loss)" name={s.h.name} cls={s.cls}
                        ret={s.ret} amount={s.val}
                        note={s.h.isFund ? undefined : s.h.quantity ? `${s.h.quantity}주` : undefined}
                        dim={!matched}
                        extra={<TimingBadge timing={timing} />} />
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
                  border: '1px solid color-mix(in srgb, var(--color-warning) 20%, transparent)', fontSize: 12, color: 'var(--color-warning)', lineHeight: 1.7 }}>
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
                    const addBadge = buy && buy.addAmount > 0 ? (
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-profit)', flexShrink: 0,
                        background: 'color-mix(in srgb, var(--color-profit) 10%, transparent)', borderRadius: 6, padding: '3px 8px', marginLeft: 4, fontWeight: 400 }}>
                        +{fmtKrw(buy.addAmount)}{buy.shares && buy.shares > 0 ? ` (약 ${buy.shares}주)` : ''}
                      </span>
                    ) : null;
                    const sig = k.h.ticker ? signals[k.h.ticker] : undefined;
                    const timing = sig ? getBuySignal(sig) : noSignal();
                    const matched = isRowMatch(k.h.ticker, 'buy');
                    return (
                      <div key={k.h.id} style={{ borderBottom: i < keeps.length - 1 ? '1px solid var(--border-secondary)' : 'none',
                        opacity: signalFilter?.type === 'buy' && !matched ? 0.25 : 1, transition: 'opacity 0.15s' }}>
                        <Row badge={k.isHighReturn ? '★유지' : '추가매수'} badgeColor={k.isHighReturn ? '#FFD700' : 'var(--color-profit)'}
                          name={k.h.name} cls={k.cls} ret={k.ret} amount={k.val}
                          extra={<>{addBadge}<TimingBadge timing={timing} /></>} />
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
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>타이밍 뱃지별 범위 기준</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-tertiary)', fontSize: 18, lineHeight: 1, padding: '2px 4px' }}>✕</button>
        </div>
        {/* 설명 */}
        <div style={{ padding: '10px 18px 6px', fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          뱃지 아래 숫자는 해당 신호가 유효한 <strong style={{ color: 'var(--text-secondary)' }}>매도/매수 실행 가격 범위</strong>입니다.
          매도 범위는 현재가·기술적 고점 기준, 매수 범위는 저점·MA 기준으로 산출합니다.
        </div>
        {/* 테이블 */}
        <div style={{ overflowY: 'auto', padding: '4px 18px 18px' }}>
          {/* 매도 */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-loss)', margin: '12px 0 6px', letterSpacing: 1 }}>SELL — 매도 신호</div>
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-secondary)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', background: 'var(--bg-tertiary)',
              padding: '6px 12px', fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', gap: 8 }}>
              <span>뱃지</span><span>가격 범위</span><span>설명</span>
            </div>
            {BADGE_RANGE_ROWS.filter(r => r.type === '매도').map((r, i, arr) => (
              <div key={r.badge} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 8,
                padding: '8px 12px', fontSize: 11, alignItems: 'start',
                borderTop: i > 0 ? '1px solid var(--border-secondary)' : 'none',
                background: i % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--bg-tertiary) 50%, transparent)' }}>
                <span style={{ fontWeight: 600, color: r.color }}>{r.badge}</span>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{r.range}</span>
                <span style={{ color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{r.desc}</span>
              </div>
            ))}
          </div>
          {/* 매수 */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-profit)', margin: '16px 0 6px', letterSpacing: 1 }}>BUY — 매수 신호</div>
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-secondary)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', background: 'var(--bg-tertiary)',
              padding: '6px 12px', fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', gap: 8 }}>
              <span>뱃지</span><span>가격 범위</span><span>설명</span>
            </div>
            {BADGE_RANGE_ROWS.filter(r => r.type === '매수').map((r, i) => (
              <div key={r.badge} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 8,
                padding: '8px 12px', fontSize: 11, alignItems: 'start',
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

function loadTargetsFromStorage(): TargetAllocation {
  try {
    const raw = localStorage.getItem('rebalancing_targets');
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_TARGETS;
}


export function OptimalGuide() {
  const { accounts, prices, isMobile, navigateTo } = useAppContext();
  const [signals, setSignals] = useState<Record<string, StockSignal>>({});
  const [signalsLoading, setSignalsLoading] = useState(false);
  const [showRangeGuide, setShowRangeGuide] = useState(false);
  const [signalFilter, setSignalFilter] = useState<SignalFilter>(null);
  const [targets, setTargets] = useState<TargetAllocation>(loadTargetsFromStorage);
  const [exchangeRate, setExchangeRate] = useState(1450);

  // rebalancing_targets 변경 감지 (다른 탭/컴포넌트에서 변경 시 반영)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'rebalancing_targets' && e.newValue) {
        try { setTargets(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // 환율 fetch
  useEffect(() => {
    fetch('https://asset-dashboard-api.jilliankim200.workers.dev/exchange-rates')
      .then(r => r.json())
      .then((d: { USD?: number }) => { if (d.USD) setExchangeRate(d.USD); })
      .catch(() => {});
  }, []);

  // 커버드콜 월 배당금 추정 — dividend_stocks 전체 합산 (배당 페이지 관리 데이터)
  const coveredCallMonthlyDiv = useMemo(() => {
    try {
      const raw = localStorage.getItem('dividend_stocks');
      if (!raw) return 0;
      const stocks: { ticker: string; quantity: number; dividendPerShare: number }[] = JSON.parse(raw);
      let total = 0;
      for (const s of stocks) {
        if (!s.quantity || s.quantity <= 0) continue;
        const baseTicker = s.ticker.replace(/_H$/, '').toUpperCase();
        const isUsd = /^[A-Z]{2,5}$/.test(baseTicker);
        const base = s.dividendPerShare * s.quantity;
        total += isUsd ? base * 0.85 * exchangeRate : base;
      }
      return Math.round(total);
    } catch { return 0; }
  }, [exchangeRate]);

  const { accountPlans, totalSells, retirementIssues } = useMemo(() => {
    // 동일 소유자 내 중복 감지
    const holdingMap = new Map<string, { h: Holding; acc: Account; val: number; ret: number | null }[]>();
    for (const acc of accounts) {
      for (const h of acc.holdings) {
        const key = `${acc.owner}__${h.ticker || h.name}`;
        if (!holdingMap.has(key)) holdingMap.set(key, []);
        holdingMap.get(key)!.push({ h, acc, val: hVal(h, prices), ret: calcReturn(h, prices) });
      }
    }

    // 종목별 winner (절세 우선순위)
    const sellSet = new Set<string>(); // `${accId}__${holdingId}` → 매도 대상

    for (const [, group] of holdingMap) {
      if (group.length <= 1) continue;
      const sorted = [...group].sort((a, b) => {
        const pa = accPriority(a.acc), pb = accPriority(b.acc);
        return pa !== pb ? pb - pa : b.val - a.val;
      });
      const winner = sorted[0];
      for (const item of sorted.slice(1)) {
        const isHighReturn = item.ret !== null && item.ret >= 40;
        if (!isHighReturn) {
          sellSet.add(`${item.acc.id}__${item.h.id}`);
        }
      }
    }

    // 계좌별 플랜 계산
    const accountPlans: AccountPlan[] = accounts.map(acc => {
      const cash = acc.cash || 0;
      const totalVal = acc.holdings.reduce((s, h) => s + hVal(h, prices), 0) + cash;

      const sells: SellItem[] = [];
      const keeps: AccountPlan['keeps'] = [];

      for (const h of acc.holdings) {
        const val = hVal(h, prices);
        const ret = calcReturn(h, prices);
        const cls = classify(h.name);
        const isHighReturn = ret !== null && ret >= 40;

        if (sellSet.has(`${acc.id}__${h.id}`)) {
          sells.push({ h, val, cls, ret, reason: '다른 절세 계좌에 동일 종목' });
        } else {
          keeps.push({ h, val, cls, ret, isHighReturn });
        }
      }

      // 매도 후 여유 현금 (매도금액 + 기존 현금)
      const sellTotal = sells.reduce((s, r) => s + r.val, 0);
      const freedCash = sellTotal + cash;

      // 재투자: 목표 비중 기반 배분 + 주수 계산
      // 각 자산군별 현재 keep 금액 합계
      const classTotals: Record<AssetClass, number> = { 주식: 0, 채권: 0, 커버드콜: 0, 금: 0, 기타: 0 };
      for (const k of keeps) classTotals[k.cls] += k.val;

      // keep 중인 자산군의 목표 비중 합계 (없는 자산군 제외)
      const presentClasses = (Object.keys(classTotals) as AssetClass[]).filter(cls => classTotals[cls] > 0);
      const totalTargetWeight = presentClasses.reduce((s, cls) => s + (targets[cls] || 0), 0);

      const keepTotal = keeps.reduce((s, k) => s + k.val, 0);
      const buys: BuyItem[] = keepTotal > 0 && freedCash > 0
        ? keeps.map(k => {
          // 자산군 목표 비중 → 같은 자산군 내 현재 보유 비율로 분배
          const clsTarget = totalTargetWeight > 0 ? (targets[k.cls] || 0) / totalTargetWeight : 0;
          const intraClsWeight = classTotals[k.cls] > 0 ? k.val / classTotals[k.cls] : 0;
          const weight = clsTarget * intraClsWeight;
          const addAmount = Math.round(weight * freedCash / 10000) * 10000;
          const price = k.h.isFund ? null : ((k.h.ticker && prices[k.h.ticker]) ? prices[k.h.ticker] : (k.h.avgPrice || null));
          const shares = (price && price > 0 && !k.h.isFund) ? Math.floor(addAmount / price) : null;
          return { h: k.h, cls: k.cls, currentVal: k.val, addAmount, shares, price };
        })
        : [];

      // 안전자산 (매도 후 기준)
      const projectedTotal = keeps.reduce((s, k) => s + k.val, 0); // 현금은 재투자되므로 제외
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
  }, [accounts, prices, targets]);

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
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
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
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{c.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: c.color }}>{c.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 목표 비중 카드 */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
            <MIcon name="tune" size={15} style={{ color: 'var(--text-tertiary)' }} />
            목표 비중 (재투자 배분 기준)
          </div>
          <button
            onClick={() => navigateTo('rebalancing')}
            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
              border: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)',
              color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <MIcon name="edit" size={12} style={{ color: 'var(--accent-blue)' }} />
            수정
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(Object.entries(targets) as [AssetClass, number][]).map(([cls, pct]) => (
            <div key={cls} style={{ display: 'flex', alignItems: 'center', gap: 5,
              background: `color-mix(in srgb, ${ASSET_COLORS[cls]} var(--badge-mix), transparent)`,
              borderRadius: 6, padding: '3px 10px' }}>
              <span style={{ fontSize: 11, color: ASSET_COLORS[cls], fontWeight: 600 }}>{cls}</span>
              <span style={{ fontSize: 12, color: ASSET_COLORS[cls], fontWeight: 700 }}>{pct}%</span>
              {cls === '커버드콜' && coveredCallMonthlyDiv > 0 && (
                <span style={{ fontSize: 10, color: ASSET_COLORS[cls], opacity: 0.75, marginLeft: 2 }}>
                  월 배당 {fmtKrw(coveredCallMonthlyDiv)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 원칙 */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '14px 16px', marginBottom: 20, fontSize: 12, lineHeight: 1.9, color: 'var(--text-tertiary)' }}>
        <div style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, fontSize: 13 }}>적용 원칙</div>

        <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 2 }}>[ 매도/재배분 기준 ]</div>
        <div>① 동일 종목이 여러 계좌에 있으면 <span style={{ color: 'var(--text-secondary)' }}>절세 우선순위 낮은 계좌에서 매도</span></div>
        <div style={{ paddingLeft: 12, color: 'var(--text-tertiary)' }}>IRP &gt; 퇴직연금 &gt; 연금저축 &gt; ISA &gt; 일반/CMA</div>
        <div>② 매도 현금은 <span style={{ color: 'var(--color-profit)' }}>같은 계좌 유지 종목에 목표 비중 기반 재배분</span> (계좌 간 이동 없음)</div>
        <div>③ <span style={{ color: '#FFD700' }}>★ 수익률 40%↑</span> 종목은 중복이어도 매도하지 않음 (세금/수수료 고려)</div>
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
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <MIcon name="account_balance_wallet" size={16} style={{ color: 'var(--text-secondary)' }} />
        계좌별 액션 플랜
        <button onClick={() => setShowRangeGuide(true)} style={{
          marginLeft: 'auto', fontSize: 11, padding: '3px 10px', borderRadius: 6, fontWeight: 600,
          cursor: 'pointer', border: '1px solid var(--border-primary)',
          background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <MIcon name="info" size={13} style={{ color: 'var(--text-tertiary)' }} />
          뱃지별 범위 기준
        </button>
      </div>
      {showRangeGuide && <BadgeRangeModal onClose={() => setShowRangeGuide(false)} />}
      {signalsLoading && (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <MIcon name="sync" size={14} style={{ color: 'var(--text-tertiary)' }} />
          시세 데이터 로딩 중... (MA20/MA60/고저점 계산)
        </div>
      )}

      {/* 신호 필터 */}
      {!signalsLoading && (availableSignals.sell.length > 0 || availableSignals.buy.length > 0) && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginRight: 2 }}>신호 필터</span>
            <button
              onClick={() => setSignalFilter(null)}
              style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
                background: signalFilter === null ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                color: signalFilter === null ? 'var(--accent-blue-fg)' : 'var(--text-tertiary)' }}>
              전체
            </button>
            {availableSignals.sell.length > 0 && (
              <span style={{ fontSize: 10, color: 'var(--text-quaternary)', padding: '0 2px' }}>매도</span>
            )}
            {availableSignals.sell.map(s => (
              <button key={`sell-${s.label}`}
                onClick={() => setSignalFilter(signalFilter?.label === s.label && signalFilter?.type === 'sell' ? null : { type: 'sell', label: s.label })}
                style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
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
              <span style={{ fontSize: 10, color: 'var(--text-quaternary)', padding: '0 2px' }}>매수</span>
            )}
            {availableSignals.buy.map(s => (
              <button key={`buy-${s.label}`}
                onClick={() => setSignalFilter(signalFilter?.label === s.label && signalFilter?.type === 'buy' ? null : { type: 'buy', label: s.label })}
                style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
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
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>
              {filteredPlans.length}개 계좌에 <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                {signalFilter.type === 'sell' ? '매도' : '매수'} · {signalFilter.label}
              </span> 신호 해당
            </div>
          )}
        </div>
      )}

      {filteredPlans.map(plan => (
        <AccountCard key={plan.acc.id} plan={plan} isMobile={isMobile} signals={signals} signalFilter={signalFilter} />
      ))}
    </div>
  );
}
