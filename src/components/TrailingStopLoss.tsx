import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../App';
import { fetchCurrentPricesWithChange, detectCurrency, fetchLowSince, fetchTrend } from '../utils/fetchPrices';
import type { TrendInfo } from '../utils/fetchPrices';
import { kvGet, kvSet } from '../api';
import { MIcon } from './MIcon';
import type { Holding, Account } from '../types';

interface TrailingEntry {
  pct: number;        // 손절률 (10 = 10%)
  peakPrice: number;  // 추적 고점
  troughPrice?: number; // 손절 발생 이후 추적 저점 (재매수 반등 기준)
  troughAt?: number;    // 저점이 마지막으로 갱신된 시각(ms) — "신저가 없는 날 수" 계산용
  reboundPct?: number;  // 재매수 반등 확인 기준 (% , 기본 5)
  rebuyBudget?: number; // 재매수 예산 (원/달러)
  splitProfile?: 'safe' | 'balanced' | 'aggressive'; // 분할 비율 성향
  sellReboundPct?: number; // (보유·못판 경우) 반등 매도 알림 기준 (%, 기본 5)
  trendMa?: 20 | 60 | 120; // 추세 판정 이동평균선 (기본 120)
}

// 분할 비율: [반등 확인선 %, 고점 회복선 %]
const SPLIT_RATIOS: Record<'safe' | 'balanced' | 'aggressive', { rebound: number; recover: number; label: string }> = {
  safe:       { rebound: 30, recover: 70, label: '안전' },
  balanced:   { rebound: 50, recover: 50, label: '균형' },
  aggressive: { rebound: 70, recover: 30, label: '공격' },
};

interface CustomStock {
  id: string;
  ticker: string;
  name: string;
  avgPrice: number;
  currency: 'KRW' | 'USD';
}

const LS_KEY = 'trailing_stops_v1';
const CUSTOM_KEY = 'trailing_custom_stocks_v1';
const WATCH_KEY = 'trailing_rebuy_watch_v1';

// 손절 발생 시 저장되는 재매수 워치 항목 (매도해도 카드가 사라지지 않게 별도 보관)
interface RebuyWatch {
  ticker: string;
  name: string;
  currency: 'KRW' | 'USD';
  avgPrice: number;
  peakPrice: number;       // 고점 회복선
  troughPrice: number;     // 손절 후 저점
  pct: number;             // 당시 손절률
  reboundPct: number;
  splitProfile: 'safe' | 'balanced' | 'aggressive';
  rebuyBudget: number;
  triggeredAt: number;     // 손절 발생 시각(ms)
}

function load(): Record<string, TrailingEntry> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
  catch { return {}; }
}
function save(e: Record<string, TrailingEntry>) {
  localStorage.setItem(LS_KEY, JSON.stringify(e));
  kvSet(LS_KEY, e).catch(() => {});
}
function loadWatch(): RebuyWatch[] {
  try { return JSON.parse(localStorage.getItem(WATCH_KEY) || '[]'); }
  catch { return []; }
}
function saveWatch(w: RebuyWatch[]) {
  localStorage.setItem(WATCH_KEY, JSON.stringify(w));
  kvSet(WATCH_KEY, w).catch(() => {});
}
function loadCustom(): CustomStock[] {
  try {
    const raw: CustomStock[] = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]');
    return raw.map(s => ({ ...s, currency: s.currency ?? detectCurrency(s.ticker) }));
  } catch { return []; }
}
function saveCustom(s: CustomStock[]) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(s));
  kvSet(CUSTOM_KEY, s).catch(() => {});
}
function fmt(n: number) { return Math.round(n).toLocaleString('ko-KR'); }
function fmtPrice(n: number, currency: 'KRW' | 'USD') {
  return currency === 'USD'
    ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `${fmt(n)}원`;
}
function fmtPct(n: number, digits = 1) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;
}

interface RowProps {
  holding: Holding;
  account: Account;
  currentPrice?: number;
  changeRate?: number;
  entry: TrailingEntry;
  currency: 'KRW' | 'USD';
  onPctChange: (pct: number) => void;
  onResetPeak: () => void;
  onReboundPctChange: (pct: number) => void;
  onSellReboundChange: (pct: number) => void;
  onTrendMaChange: (ma: 20 | 60 | 120) => void;
  onBudgetChange: (budget: number) => void;
  onProfileChange: (profile: 'safe' | 'balanced' | 'aggressive') => void;
  isAmountHidden: boolean;
  onNameClick?: (ticker: string) => void;
  highlight?: boolean;
  rowRef?: React.RefObject<HTMLDivElement>;
  showGuide?: boolean;
  trend?: TrendInfo;
}

function HoldingRow({ holding, account, currentPrice, changeRate, entry, currency, onPctChange, onResetPeak, onReboundPctChange, onSellReboundChange, onTrendMaChange, onBudgetChange, onProfileChange, isAmountHidden, onNameClick, highlight, rowRef, showGuide = true, trend }: RowProps) {
  const { peakPrice, pct } = entry;
  const stopPrice = peakPrice * (1 - pct / 100);
  const hasPrice = currentPrice != null && currentPrice > 0;

  const returnPct = hasPrice ? ((currentPrice! - holding.avgPrice) / holding.avgPrice * 100) : null;
  const distPct = hasPrice ? ((currentPrice! - stopPrice) / currentPrice! * 100) : null;

  const isTriggered = hasPrice && currentPrice! <= stopPrice;
  const isWarning = !isTriggered && hasPrice && distPct! < 3;

  // 반등 매도선 도달 여부 (손절 발생 보유 종목) — 카드 전체 강조용
  const sellReboundReached = isTriggered && hasPrice
    && currentPrice! >= (entry.troughPrice ?? currentPrice!) * (1 + (entry.sellReboundPct ?? 5) / 100);

  const statusColor = isTriggered ? '#F04452' : isWarning ? '#FF9500' : '#30C85E';
  const statusBg = isTriggered ? 'color-mix(in srgb, #F04452 12%, var(--bg-primary))' : isWarning ? 'color-mix(in srgb, #FF9500 14%, var(--bg-primary))' : 'color-mix(in srgb, #30C85E 12%, var(--bg-primary))';
  const statusLabel = isTriggered ? '손절 발생' : isWarning ? '주의 구간' : '추적 중';

  return (
    <div ref={rowRef} style={{
      background: 'var(--bg-primary)',
      borderRadius: 14,
      padding: '14px 16px',
      marginBottom: 10,
      border: highlight ? '2px solid var(--accent-blue)' : sellReboundReached ? '2px solid #FF9500' : isTriggered ? '1.5px solid #F04452' : '1px solid var(--border-primary)',
      boxShadow: highlight ? '0 0 0 4px rgba(49,130,246,0.12)' : sellReboundReached ? '0 0 0 4px rgba(255,149,0,0.18)' : isTriggered ? '0 0 0 3px rgba(240,68,82,0.08)' : 'none',
      transition: 'border 0.3s, box-shadow 0.3s',
    }}>
      {/* 상단: 종목명 + 계좌 + 상태 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span
              onClick={holding.ticker && onNameClick ? () => onNameClick(holding.ticker!) : undefined}
              onMouseEnter={e => { if (holding.ticker && onNameClick) e.currentTarget.style.color = 'var(--accent-blue)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
              style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', cursor: holding.ticker && onNameClick ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 4 }}>
              {holding.name}
              {holding.ticker && onNameClick && <MIcon name="candlestick_chart" size={13} style={{ color: 'var(--text-tertiary)' }} />}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 7px', borderRadius: 5, fontWeight: 500 }}>
              {holding.ticker}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
            {account.ownerName} · {account.institution} {account.accountType}
            {account.alias ? ` (${account.alias})` : ''}
          </div>
        </div>
        <div style={{ padding: '4px 10px', borderRadius: 20, background: statusBg, color: statusColor, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {statusLabel}
        </div>
      </div>

      {/* 가격 정보 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
        {/* 현재가 */}
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, fontWeight: 500 }}>현재가</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            {hasPrice ? (isAmountHidden ? '••••' : fmtPrice(currentPrice!, currency)) : '—'}
          </div>
          {changeRate != null && (
            <div style={{ fontSize: 11, color: changeRate >= 0 ? '#F04452' : '#3182F6', fontWeight: 600, marginTop: 2 }}>
              {fmtPct(changeRate)}
            </div>
          )}
        </div>

        {/* 추적 고점 */}
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
            추적 고점
            <button onClick={onResetPeak} title="현재가로 고점 초기화"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: 'var(--text-tertiary)' }}>
              <MIcon name="restart_alt" size={13} />
            </button>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent-blue)' }}>
            {isAmountHidden ? '••••' : fmtPrice(peakPrice, currency)}
          </div>
          {hasPrice && currentPrice! < peakPrice && (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              고점 대비 {fmtPct((currentPrice! - peakPrice) / peakPrice * 100)}
            </div>
          )}
          {hasPrice && currentPrice! >= peakPrice && (
            <div style={{ fontSize: 11, color: '#30C85E', fontWeight: 600, marginTop: 2 }}>신고점 갱신</div>
          )}
        </div>

        {/* 손절가 */}
        <div style={{
          background: isTriggered ? 'color-mix(in srgb, #F04452 12%, var(--bg-primary))' : isWarning ? 'color-mix(in srgb, #FF9500 14%, var(--bg-primary))' : 'var(--bg-secondary)',
          borderRadius: 10, padding: '10px 12px'
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}>
            손절가
            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: `color-mix(in srgb, ${statusColor} 12%, transparent)`, color: statusColor }}>{pct}%</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: statusColor }}>
            {isAmountHidden ? '••••' : fmtPrice(stopPrice, currency)}
          </div>
          {distPct != null && (
            <div style={{ fontSize: 11, color: statusColor, fontWeight: 600, marginTop: 2 }}>
              {isTriggered
                ? `손절가 ${Math.abs(distPct).toFixed(1)}% 이탈`
                : `하락 여유 ${distPct.toFixed(1)}%`}
            </div>
          )}
        </div>
      </div>

      {/* 하단: 매입가·수익률 + 손절률 조절 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* 매입가·수익률 */}
        <div style={{ display: 'flex', gap: 16, flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>
          <span>매입가 <b style={{ color: 'var(--text-primary)' }}>{isAmountHidden ? '••••' : fmtPrice(holding.avgPrice, currency)}</b></span>
          {returnPct != null && (
            <span>수익률 <b style={{ color: returnPct >= 0 ? '#F04452' : '#3182F6' }}>{isAmountHidden ? '••••' : fmtPct(returnPct)}</b></span>
          )}
          <span style={{ color: 'var(--text-tertiary)' }}>{isAmountHidden ? '••••' : holding.quantity.toLocaleString()}주</span>
        </div>

        {/* 손절률 조절 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>손절률</span>
          {[5, 7, 10, 15, 20].map(v => (
            <button key={v} onClick={() => onPctChange(v)}
              style={{
                padding: '4px 9px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                background: pct === v ? 'var(--pill-selected-bg)' : 'var(--bg-secondary)',
                color: pct === v ? 'var(--pill-selected-fg)' : 'var(--text-secondary)',
                transition: 'all 0.1s',
              }}>
              {v}%
            </button>
          ))}
        </div>
      </div>

      {/* ── 반등 매도 알림 (매도 신호 떴는데 못 판 보유 종목) ── */}
      {isTriggered && hasPrice && (() => {
        const sellPct = entry.sellReboundPct ?? 5;
        const trough = entry.troughPrice ?? currentPrice!;        // 손절 후 저점
        const sellLine = trough * (1 + sellPct / 100);           // 반등 매도선
        const reached = currentPrice! >= sellLine;               // 저점에서 +N% 반등
        const toLine = (sellLine - currentPrice!) / currentPrice! * 100;
        // 추세 판정: 선택한 이동평균선(기본 120) 이탈 또는 전 저점 이탈 → 매도 권장
        const maPeriod = entry.trendMa ?? 120;
        const maVal = trend ? (maPeriod === 20 ? trend.ma20 : maPeriod === 60 ? trend.ma60 : trend.ma120) : null;
        const belowMa = trend && maVal != null ? trend.cur < maVal : false;
        const broken = trend ? (belowMa || trend.belowPrevLow) : null;
        // 저점 갱신 후 경과일 (신저가 없는 날 수) — 바닥 신뢰도 가늠
        const daysSinceLow = entry.troughAt != null ? Math.floor((Date.now() - entry.troughAt) / 86400000) : null;
        return (
          <div style={{
            marginTop: 12, padding: '11px 13px', borderRadius: 10,
            border: `1.5px solid ${reached ? '#FF9500' : 'var(--border-primary)'}`,
            background: reached ? 'color-mix(in srgb, #FF9500 12%, var(--bg-primary))' : 'var(--bg-secondary)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <MIcon name={reached ? 'notifications_active' : 'sell'} size={15} style={{ color: '#FF9500' }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>반등 매도 알림</span>
              {reached && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: '#FF9500', color: '#fff' }}>지금 반등</span>}
              <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>못 파셨다면 반등에 매도</span>
            </div>
            {/* 추세 상태 + 판정 */}
            {trend && (
              <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                  background: belowMa ? 'color-mix(in srgb, #F04452 14%, transparent)' : 'color-mix(in srgb, #30C85E 14%, transparent)',
                  color: belowMa ? '#F04452' : '#30C85E' }}>
                  {maPeriod}일선 {belowMa ? '아래' : '위'}
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                  background: trend.belowPrevLow ? 'color-mix(in srgb, #F04452 14%, transparent)' : 'var(--bg-secondary)',
                  color: trend.belowPrevLow ? '#F04452' : 'var(--text-tertiary)' }}>
                  {trend.belowPrevLow ? '예전 바닥도 깨짐' : '예전 바닥 안 깨짐'}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, marginLeft: 'auto', color: broken ? '#F04452' : '#30C85E' }}>
                  {broken ? '추세 깨짐 → 매도 권장' : '추세 유지 → 보유 고려'}
                </span>
              </div>
              {/* 추세선 선택 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>추세선</span>
                {([20, 60, 120] as const).map(v => (
                  <button key={v} onClick={() => onTrendMaChange(v)}
                    style={{ padding: '3px 8px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 10.5, fontWeight: 600, fontFamily: 'inherit',
                      background: maPeriod === v ? 'var(--pill-selected-bg)' : 'var(--bg-primary)', color: maPeriod === v ? 'var(--pill-selected-fg)' : 'var(--text-secondary)' }}>
                    {v}일
                  </button>
                ))}
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 2 }}>20=단기 · 120=장기</span>
              </div>
              </>
            )}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>반등 매도선</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#FF9500' }}>{isAmountHidden ? '••••' : fmtPrice(sellLine, currency)}</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {reached ? `저점 +${sellPct}% 도달${broken === false ? ' (추세 유지 — 보유도 선택)' : ' — 매도 고려'}` : `현재가 +${Math.max(0, toLine).toFixed(1)}% 더 오르면`}
              </span>
            </div>
            {/* 저점 후 경과일 — 하락 멈춤(바닥) 신뢰도 */}
            {daysSinceLow != null && (
              <div style={{ marginBottom: 8, fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}>
                <MIcon name="schedule" size={13} style={{ color: daysSinceLow >= 3 ? '#30C85E' : 'var(--text-tertiary)' }} />
                {daysSinceLow === 0
                  ? <span style={{ color: '#F04452', fontWeight: 600 }}>오늘 신저가 — 아직 바닥 확인 안 됨</span>
                  : <span style={{ color: daysSinceLow >= 3 ? '#30C85E' : 'var(--text-secondary)', fontWeight: 600 }}>
                      저점 후 {daysSinceLow}일째 신저가 없음{daysSinceLow >= 3 ? ' · 바닥 신뢰도 ↑' : ''}
                    </span>}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>반등 기준</span>
              {[3, 5, 7].map(v => (
                <button key={v} onClick={() => onSellReboundChange(v)}
                  style={{ padding: '4px 9px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                    background: sellPct === v ? '#FF9500' : 'var(--bg-primary)', color: sellPct === v ? '#fff' : 'var(--text-secondary)' }}>
                  +{v}%
                </button>
              ))}
              <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginLeft: 4 }}>손절 후 저점 {isAmountHidden ? '••••' : fmtPrice(trough, currency)} 기준</span>
            </div>
          </div>
        );
      })()}

      {/* ── 재매수 가이드 (손절 발생 종목에만, 토글로 표시 제어) ── */}
      {showGuide && isTriggered && hasPrice && (() => {
        const reboundPct = entry.reboundPct ?? 7;
        const trough = entry.troughPrice ?? currentPrice!;          // 손절 후 저점
        const rebuyLine = trough * (1 + reboundPct / 100);          // 반등 확인선(보수적)
        const recoverLine = peakPrice;                              // 고점 회복선(추세전환)
        const hitRebuy = currentPrice! >= rebuyLine;
        const hitRecover = currentPrice! >= recoverLine;
        const toRebuy = (rebuyLine - currentPrice!) / currentPrice! * 100;
        const toRecover = (recoverLine - currentPrice!) / currentPrice! * 100;

        // 분할 매수 계산
        const profile = entry.splitProfile ?? 'balanced';
        const ratio = SPLIT_RATIOS[profile];
        const budget = entry.rebuyBudget ?? Math.round(holding.avgPrice * holding.quantity);
        const calcAlloc = (linePrice: number, pctOfBudget: number) => {
          const money = budget * pctOfBudget / 100;
          const shares = linePrice > 0 ? Math.floor(money / linePrice) : 0;
          return { pctOfBudget, shares, cost: shares * linePrice };
        };
        const allocRebuy = calcAlloc(rebuyLine, ratio.rebound);
        const allocRecover = calcAlloc(recoverLine, ratio.recover);

        const Line = ({ label, sub, price, hit, away, tone, alloc }: {
          label: string; sub: string; price: number; hit: boolean; away: number; tone: string;
          alloc: { pctOfBudget: number; shares: number; cost: number };
        }) => (
          <div style={{
            background: hit ? 'color-mix(in srgb, #30C85E 10%, #fff)' : 'var(--bg-secondary)',
            border: `1px solid ${hit ? 'color-mix(in srgb, #30C85E 40%, transparent)' : 'var(--border-primary)'}`,
            borderRadius: 10, padding: '10px 12px', flex: 1, minWidth: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: tone }}>{label}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone }}>{alloc.pctOfBudget}%</span>
              {hit && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: '#30C85E', color: '#fff' }}>도달</span>}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              {isAmountHidden ? '••••' : fmtPrice(price, currency)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {hit ? sub : `현재가 +${away.toFixed(1)}% 필요 · ${sub}`}
            </div>
            {/* 분할 매수 배분 */}
            <div style={{ marginTop: 7, paddingTop: 7, borderTop: '1px dashed var(--border-primary)', fontSize: 11.5 }}>
              <span style={{ color: 'var(--text-secondary)' }}>이 선에서 </span>
              <b style={{ color: tone }}>약 {isAmountHidden ? '••' : alloc.shares.toLocaleString()}주</b>
              <span style={{ color: 'var(--text-tertiary)' }}> ({isAmountHidden ? '••••' : fmtPrice(alloc.cost, currency)})</span>
            </div>
          </div>
        );

        return (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--border-primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <MIcon name="restart_alt" size={15} style={{ color: 'var(--accent-blue)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>재매수 가이드</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>손절도 규칙으로 했으니, 재매수도 규칙으로</span>
            </div>

            {/* 설명 */}
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.65, background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
              떨어지는 칼날을 잡지 않으려면 <b style={{ color: 'var(--text-primary)' }}>하락이 멈춘 신호</b>를 확인하고 들어갑니다. 아래 두 기준선에서 <b style={{ color: 'var(--text-primary)' }}>예산을 나눠</b> 매수해 타이밍 리스크를 분산합니다.
              <div style={{ marginTop: 6, color: 'var(--text-tertiary)' }}>
                · <b>반등 확인선</b>: 손절 후 저점({isAmountHidden ? '••••' : fmtPrice(trough, currency)}) 대비 +{reboundPct}% 회복 = 하락 멈춤(정찰 매수)<br/>
                · <b>고점 회복선</b>: 직전 추적 고점 재돌파 = 추세 전환 확인(비중 확대)
              </div>
            </div>

            {/* 예산 + 분할 성향 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>재매수 예산</span>
                <input
                  type="text" inputMode="numeric"
                  value={isAmountHidden ? '••••' : budget.toLocaleString('ko-KR')}
                  onChange={e => {
                    const n = Number(e.target.value.replace(/[^0-9]/g, ''));
                    if (!Number.isNaN(n)) onBudgetChange(n);
                  }}
                  style={{
                    width: 120, padding: '5px 9px', borderRadius: 8, fontSize: 12, fontFamily: 'inherit',
                    border: '1px solid var(--border-primary)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', textAlign: 'right',
                  }} />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{currency === 'USD' ? '$' : '원'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>분할 비율</span>
                {(['safe', 'balanced', 'aggressive'] as const).map(k => (
                  <button key={k} onClick={() => onProfileChange(k)} title={`반등 ${SPLIT_RATIOS[k].rebound} : 고점 ${SPLIT_RATIOS[k].recover}`}
                    style={{
                      padding: '4px 9px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                      background: profile === k ? 'var(--pill-selected-bg)' : 'var(--bg-secondary)',
                      color: profile === k ? 'var(--pill-selected-fg)' : 'var(--text-secondary)',
                    }}>
                    {SPLIT_RATIOS[k].label} {SPLIT_RATIOS[k].rebound}:{SPLIT_RATIOS[k].recover}
                  </button>
                ))}
              </div>
            </div>

            {/* 기준선 2개 (분할 주수 포함) */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <Line label="① 반등 확인선" sub="정찰 매수" price={rebuyLine} hit={hitRebuy} away={Math.max(0, toRebuy)} tone="#30C85E" alloc={allocRebuy} />
              <Line label="② 고점 회복선" sub="비중 확대" price={recoverLine} hit={hitRecover} away={Math.max(0, toRecover)} tone="var(--accent-blue)" alloc={allocRecover} />
            </div>

            {/* 반등 기준 조절 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>반등 기준</span>
              {[3, 5, 7].map(v => (
                <button key={v} onClick={() => onReboundPctChange(v)}
                  style={{
                    padding: '4px 9px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                    background: reboundPct === v ? 'var(--pill-selected-bg)' : 'var(--bg-secondary)',
                    color: reboundPct === v ? 'var(--pill-selected-fg)' : 'var(--text-secondary)',
                  }}>
                  +{v}%
                </button>
              ))}
              <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginLeft: 4 }}>저점 대비 회복폭</span>
            </div>

            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 8 }}>
              ※ 매매 규칙 참고용이며 특정 시점 매수 권유가 아닙니다. 최종 판단은 본인 책임입니다.
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── 재매수 워치 패널 (손절 발생 종목을 매도 후에도 보관) ──
interface WatchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  watchList: RebuyWatch[];
  priceData: Record<string, { price: number; changeRate: number }>;
  isAmountHidden: boolean;
  isMobile: boolean;
  onPatch: (ticker: string, patch: Partial<RebuyWatch>) => void;
  onPatchAll: (patch: Partial<RebuyWatch>) => void;
  onRemove: (ticker: string) => void;
  onNameClick?: (ticker: string) => void;
}

function RebuyWatchPanel({ isOpen, onClose, watchList, priceData, isAmountHidden, isMobile, onPatch, onPatchAll, onRemove, onNameClick }: WatchPanelProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [hitOnly, setHitOnly] = useState(false);
  // 반등/고점 도달 여부
  const isHit = (w: RebuyWatch) => {
    const p = priceData[w.ticker]?.price;
    if (p == null) return false;
    const rebuy = w.troughPrice * (1 + (w.reboundPct ?? 7) / 100);
    return p >= rebuy || p >= w.peakPrice;
  };
  const hitCount = watchList.filter(isHit).length;
  const toggleCard = (t: string) => setCollapsed(prev => {
    const n = new Set(prev);
    n.has(t) ? n.delete(t) : n.add(t);
    return n;
  });
  const collapseAll = () => setCollapsed(new Set(watchList.map(w => w.ticker)));
  const expandAll = () => setCollapsed(new Set());
  const allCollapsed = watchList.length > 0 && watchList.every(w => collapsed.has(w.ticker));

  const hdrIconBtn = {
    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
    padding: 4, display: 'flex', borderRadius: 6,
  } as const;

  return (
    <>
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 300,
        width: isMobile ? '100%' : 360, maxWidth: '100vw',
        background: 'var(--bg-secondary, #f7f8fa)',
        borderLeft: '1px solid var(--border-primary)',
        display: 'flex', flexDirection: 'column',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: isOpen ? '-8px 0 32px rgba(0,0,0,0.18)' : 'none',
      }}>
        {/* ── 헤더 (고정) ── */}
        <div style={{
          flexShrink: 0, padding: '14px 8px 14px 16px',
          background: 'var(--bg-primary, #fff)', borderBottom: '1px solid var(--border-primary)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <MIcon name="bookmark" size={18} style={{ color: 'var(--accent-blue)' }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>재매수 워치</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--accent-blue)', borderRadius: 10, padding: '1px 7px' }}>{watchList.length}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
            {watchList.length > 0 && (
              allCollapsed ? (
                <button onClick={expandAll} title="모두 펼치기" style={hdrIconBtn}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <MIcon name="unfold_more" size={19} />
                </button>
              ) : (
                <button onClick={collapseAll} title="모두 접기" style={hdrIconBtn}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <MIcon name="unfold_less" size={19} />
                </button>
              )
            )}
            <button onClick={onClose} title="닫기" style={hdrIconBtn}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              <MIcon name="close" size={20} />
            </button>
          </div>
        </div>

        {/* ── 본문 (자체 스크롤) ── */}
        <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.6, marginBottom: 12 }}>
        손절 발생한 종목은 여기 자동 저장됩니다. 매도해서 카드가 사라져도 재매수 기준선이 유지돼요.
      </p>

      {/* ── 전체 일괄 설정 (모든 종목 한 번에) ── */}
      {watchList.length > 0 && (() => {
        // 현재 설정된 값(최다 빈도)을 선택 표시
        const mode = <T,>(arr: T[], fallback: T): T => {
          const c = new Map<T, number>();
          arr.forEach(x => c.set(x, (c.get(x) ?? 0) + 1));
          let best = fallback, bestN = 0;
          c.forEach((n, x) => { if (n > bestN) { bestN = n; best = x; } });
          return best;
        };
        const allRebound = mode(watchList.map(w => w.reboundPct ?? 7), 7);
        const allProfile = mode(watchList.map(w => w.splitProfile ?? 'balanced'), 'balanced');
        return (
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: '10px 12px', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
              <MIcon name="tune" size={14} style={{ color: 'var(--accent-blue)' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>전체 일괄 설정</span>
              <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{watchList.length}종목 모두 적용</span>
            </div>
            {/* 반등 기준 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 56, flexShrink: 0 }}>반등 기준</span>
              {[3, 5, 7].map(v => (
                <button key={v} onClick={() => onPatchAll({ reboundPct: v })}
                  style={{ flex: 1, padding: '5px 0', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
                    background: allRebound === v ? 'var(--pill-selected-bg)' : 'var(--bg-secondary)', color: allRebound === v ? 'var(--pill-selected-fg)' : 'var(--text-secondary)' }}>
                  +{v}%
                </button>
              ))}
            </div>
            {/* 분할 비율 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 56, flexShrink: 0 }}>분할 비율</span>
              {(['safe', 'balanced', 'aggressive'] as const).map(k => (
                <button key={k} onClick={() => onPatchAll({ splitProfile: k })}
                  style={{ flex: 1, padding: '5px 0', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
                    background: allProfile === k ? 'var(--pill-selected-bg)' : 'var(--bg-secondary)', color: allProfile === k ? 'var(--pill-selected-fg)' : 'var(--text-secondary)' }}>
                  {SPLIT_RATIOS[k].label}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── 필터: 전체 / 도달만 ── */}
      {watchList.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <button onClick={() => setHitOnly(false)}
            style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
              background: !hitOnly ? 'var(--pill-selected-bg)' : 'var(--bg-secondary)', color: !hitOnly ? 'var(--pill-selected-fg)' : 'var(--text-secondary)' }}>
            전체 {watchList.length}
          </button>
          <button onClick={() => setHitOnly(true)}
            style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              background: hitOnly ? '#30C85E' : 'var(--bg-secondary)', color: hitOnly ? '#fff' : (hitCount > 0 ? '#30C85E' : 'var(--text-secondary)') }}>
            <MIcon name="notifications_active" size={14} />도달 {hitCount}
          </button>
        </div>
      )}

      {watchList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 8px', color: 'var(--text-tertiary)', fontSize: 12 }}>
          <MIcon name="inbox" size={28} style={{ opacity: 0.4, display: 'block', margin: '0 auto 6px' }} />
          아직 손절 발생 종목이 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {hitOnly && hitCount === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 8px', color: 'var(--text-tertiary)', fontSize: 12 }}>
              <MIcon name="search_off" size={26} style={{ opacity: 0.4, display: 'block', margin: '0 auto 6px' }} />
              아직 반등·고점에 도달한 종목이 없습니다.
            </div>
          )}
          {[...watchList]
            .filter(w => !hitOnly || isHit(w))
            .sort((a, b) => (isHit(b) ? 1 : 0) - (isHit(a) ? 1 : 0))
            .map(w => {
            const cur = priceData[w.ticker]?.price;
            const chg = priceData[w.ticker]?.changeRate;
            const reboundPct = w.reboundPct ?? 7;
            const ratio = SPLIT_RATIOS[w.splitProfile ?? 'balanced'];
            const budget = w.rebuyBudget ?? 0;
            const rebuyLine = w.troughPrice * (1 + reboundPct / 100);
            const recoverLine = w.peakPrice;
            const sharesAt = (price: number, pctOfBudget: number) => price > 0 ? Math.floor(budget * pctOfBudget / 100 / price) : 0;
            const hitRebuy = cur != null && cur >= rebuyLine;
            const hitRecover = cur != null && cur >= recoverLine;
            const awayRebuy = cur != null ? (rebuyLine - cur) / cur * 100 : null;
            const awayRecover = cur != null ? (recoverLine - cur) / cur * 100 : null;
            const d = new Date(w.triggeredAt);
            const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
            const isCol = collapsed.has(w.ticker);

            const MiniLine = ({ label, price, hit, away, shares, tone }: { label: string; price: number; hit: boolean; away: number | null; shares: number; tone: string }) => (
              <div style={{ background: hit ? 'color-mix(in srgb, #30C85E 10%, transparent)' : 'var(--bg-secondary)', borderRadius: 8, padding: '7px 9px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: tone }}>{label}</span>
                  {hit && <span style={{ fontSize: 9, fontWeight: 700, padding: '0 5px', borderRadius: 8, background: '#30C85E', color: '#fff' }}>도달</span>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{isAmountHidden ? '••••' : fmtPrice(price, w.currency)}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 1 }}>
                  {hit || away == null ? '' : `+${Math.max(0, away).toFixed(1)}% · `}약 {isAmountHidden ? '••' : shares.toLocaleString()}주
                </div>
              </div>
            );

            const anyHit = hitRebuy || hitRecover;
            const hitLabel = hitRecover ? '고점 회복' : hitRebuy ? '반등 도달' : '';
            return (
              <div key={w.ticker} style={{
                borderRadius: 12, padding: 11,
                border: anyHit ? '1.5px solid #30C85E' : '1px solid var(--border-primary)',
                background: anyHit ? 'color-mix(in srgb, #30C85E 8%, var(--bg-primary, #fff))' : 'var(--bg-primary, #fff)',
                boxShadow: anyHit ? '0 0 0 3px rgba(48,200,94,0.14)' : '0 1px 3px rgba(0,0,0,0.06)',
              }}>
                {/* 헤더 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                  <button onClick={() => toggleCard(w.ticker)} title={isCol ? '펼치기' : '접기'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2, display: 'flex', marginTop: 1 }}>
                    <MIcon name={isCol ? 'chevron_right' : 'expand_more'} size={18} />
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span
                        onClick={onNameClick ? () => onNameClick(w.ticker) : undefined}
                        style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', cursor: onNameClick ? 'pointer' : 'default', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {w.name}
                      </span>
                      {anyHit && (
                        <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: '#30C85E', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                          <MIcon name="notifications_active" size={11} />{hitLabel}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 1 }}>
                      {w.ticker} · 손절 {dateStr}
                      {isCol && cur != null && (
                        <> · <b style={{ color: 'var(--text-secondary)' }}>{isAmountHidden ? '••••' : fmtPrice(cur, w.currency)}</b>
                          {chg != null && <span style={{ color: chg >= 0 ? '#F04452' : '#3182F6', fontWeight: 600 }}> {fmtPct(chg)}</span>}
                        </>
                      )}
                    </div>
                  </div>
                  <button onClick={() => onRemove(w.ticker)} title="워치에서 제거"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2, display: 'flex' }}>
                    <MIcon name="close" size={15} />
                  </button>
                </div>

                {!isCol && (<>
                {/* 현재가 */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '8px 0' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>현재가</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{cur != null ? (isAmountHidden ? '••••' : fmtPrice(cur, w.currency)) : '—'}</span>
                  {chg != null && <span style={{ fontSize: 11, fontWeight: 600, color: chg >= 0 ? '#F04452' : '#3182F6' }}>{fmtPct(chg)}</span>}
                </div>

                {/* 두 기준선 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 8 }}>
                  <MiniLine label={`반등 ${ratio.rebound}%`} price={rebuyLine} hit={hitRebuy} away={awayRebuy} shares={sharesAt(rebuyLine, ratio.rebound)} tone="#30C85E" />
                  <MiniLine label={`고점 ${ratio.recover}%`} price={recoverLine} hit={hitRecover} away={awayRecover} shares={sharesAt(recoverLine, ratio.recover)} tone="var(--accent-blue)" />
                </div>

                {/* 컨트롤: 비율 + 반등기준 (예산 입력은 숨김) */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {(['safe', 'balanced', 'aggressive'] as const).map(k => (
                    <button key={k} onClick={() => onPatch(w.ticker, { splitProfile: k })}
                      style={{ padding: '3px 7px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 10.5, fontWeight: 600, fontFamily: 'inherit',
                        background: (w.splitProfile ?? 'balanced') === k ? 'var(--pill-selected-bg)' : 'var(--bg-secondary)', color: (w.splitProfile ?? 'balanced') === k ? 'var(--pill-selected-fg)' : 'var(--text-secondary)' }}>
                      {SPLIT_RATIOS[k].label}
                    </button>
                  ))}
                  <span style={{ width: 1, background: 'var(--border-primary)', margin: '0 2px' }} />
                  {[3, 5, 7].map(v => (
                    <button key={v} onClick={() => onPatch(w.ticker, { reboundPct: v })}
                      style={{ padding: '3px 7px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 10.5, fontWeight: 600, fontFamily: 'inherit',
                        background: reboundPct === v ? 'var(--pill-selected-bg)' : 'var(--bg-secondary)', color: reboundPct === v ? 'var(--pill-selected-fg)' : 'var(--text-secondary)' }}>
                      +{v}%
                    </button>
                  ))}
                </div>
                </>)}
              </div>
            );
          })}
        </div>
      )}
        </div>{/* /본문 스크롤 */}
      </div>{/* /드로어 */}
    </>
  );
}

type FilterType = 'all' | 'triggered' | 'warning' | 'safe';

export function TrailingStopLoss() {
  const { accounts, isMobile, isAmountHidden, navigateTo, showToast } = useAppContext();
  const [priceData, setPriceData] = useState<Record<string, { price: number; changeRate: number; low?: number }>>({});
  const [trend, setTrend] = useState<Record<string, TrendInfo>>({});
  const [entries, setEntries] = useState<Record<string, TrailingEntry>>(load);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [customStocks, setCustomStocks] = useState<CustomStock[]>(loadCustom);
  const [addTicker, setAddTicker] = useState('');
  const [addPrice, setAddPrice] = useState('');
  const [addCurrency, setAddCurrency] = useState<'KRW' | 'USD'>('KRW');
  const [addLoading, setAddLoading] = useState(false);
  const [globalPct, setGlobalPct] = useState<number>(10);
  const [highlightTicker, setHighlightTicker] = useState<string | null>(null);
  const [showPrinciple, setShowPrinciple] = useState(false);
  const [watchList, setWatchList] = useState<RebuyWatch[]>(loadWatch);
  const [watchOpen, setWatchOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(() => {
    try { return localStorage.getItem('trailing_show_guide_v1') !== '0'; } catch { return true; }
  });
  const toggleGuide = () => setShowGuide(v => {
    const next = !v;
    try { localStorage.setItem('trailing_show_guide_v1', next ? '1' : '0'); } catch {}
    return next;
  });
  const rowRefs = useRef<Record<string, React.RefObject<HTMLDivElement>>>({});

  const isCustomView = selectedAccountId === 'custom';

  // 펀드·현금 제외, ticker 있는 종목만 + 계좌 필터
  const accountHoldings = accounts
    .filter(acc => !isCustomView && (selectedAccountId === 'all' || acc.id === selectedAccountId))
    .map(acc => ({
      account: acc,
      holdings: acc.holdings.filter(h => !h.isFund && h.ticker && h.quantity > 0),
    }))
    .filter(a => a.holdings.length > 0);

  // 개별종목을 가상 account로 변환
  const customAccount: Account = {
    id: 'custom', owner: 'wife', ownerName: '개별종목',
    institution: '', accountType: '', alias: '',
    holdings: customStocks.map(s => ({
      id: s.id, name: s.name, ticker: s.ticker,
      market: (s.currency === 'USD' ? 'US' : 'KR') as 'KR' | 'US',
      avgPrice: s.avgPrice, quantity: 1,
    })),
  };

  const tickers = [...new Set([
    ...accountHoldings.flatMap(a => a.holdings.map(h => h.ticker)),
    ...customStocks.map(s => s.ticker),
    ...watchList.map(w => w.ticker),   // 매도된 워치 종목도 가격 계속 추적
  ])];

  const fetchPrices = useCallback(async () => {
    if (tickers.length === 0) return;
    setLoading(true);
    try {
      const data = await fetchCurrentPricesWithChange(tickers);
      setPriceData(data);
      setLastUpdated(new Date());

      // 고점 자동 갱신
      setEntries(prev => {
        const next = { ...prev };
        let changed = false;
        for (const ticker of tickers) {
          const p = data[ticker]?.price;
          if (!p) continue;
          if (!next[ticker]) {
            const avgPrice =
              accountHoldings.flatMap(a => a.holdings).find(h => h.ticker === ticker)?.avgPrice ??
              customStocks.find(s => s.ticker === ticker)?.avgPrice ?? p;
            next[ticker] = { pct: 10, peakPrice: Math.max(p, avgPrice) };
            changed = true;
          } else if (p > next[ticker].peakPrice) {
            next[ticker] = { ...next[ticker], peakPrice: p };
            changed = true;
          }
          // 재매수 추적: 손절가 이탈(손절 발생) 중이면 저점 갱신, 회복하면 저점 초기화
          // 장중 저가(low)가 있으면 그것까지 반영해 실제 최저가로 저점 기록
          const e = next[ticker];
          const low = data[ticker]?.low;
          const dayLow = (low != null && low > 0) ? Math.min(low, p) : p;
          const stop = e.peakPrice * (1 - e.pct / 100);
          if (p <= stop) {
            if (e.troughPrice == null || dayLow < e.troughPrice) {
              next[ticker] = { ...e, troughPrice: dayLow, troughAt: Date.now() }; // 신저가 → 시각 기록
              changed = true;
            }
          } else if (e.troughPrice != null) {
            const { troughPrice, troughAt, ...rest } = e;
            next[ticker] = rest;
            changed = true;
          }
        }
        if (changed) save(next);
        return changed ? next : prev;
      });
    } finally {
      setLoading(false);
    }
  }, [tickers.join(',')]);

  // name === ticker인 항목 이름 자동 재조회 후 저장
  const repairNames = async (stocks: CustomStock[]) => {
    const broken = stocks.filter(s => s.name === s.ticker);
    if (broken.length === 0) return stocks;
    const repaired = [...stocks];
    await Promise.all(broken.map(async s => {
      try {
        const r = await fetch(`/naver-stock/${s.ticker}/basic`);
        if (r.ok) {
          const d = await r.json();
          const name = d.stockName || s.ticker;
          const idx = repaired.findIndex(x => x.id === s.id);
          if (idx >= 0) repaired[idx] = { ...repaired[idx], name };
        }
      } catch { /* 실패 시 그대로 */ }
    }));
    return repaired;
  };

  // KV에서 데이터 로드 (마운트 시 1회 — localStorage보다 최신이면 덮어씀)
  useEffect(() => {
    kvGet<Record<string, TrailingEntry>>(LS_KEY).then(remote => {
      if (remote && Object.keys(remote).length > 0) {
        setEntries(remote);
        localStorage.setItem(LS_KEY, JSON.stringify(remote));
      }
    }).catch(() => {});
    kvGet<CustomStock[]>(CUSTOM_KEY).then(async remote => {
      const stocks = (remote && remote.length > 0) ? remote : loadCustom();
      const repaired = await repairNames(stocks);
      const changed = repaired.some((s, i) => s.name !== stocks[i]?.name);
      setCustomStocks(repaired);
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(repaired));
      if (changed) kvSet(CUSTOM_KEY, repaired).catch(() => {});
    }).catch(() => {});
    kvGet<RebuyWatch[]>(WATCH_KEY).then(remote => {
      if (remote && remote.length > 0) {
        setWatchList(remote);
        localStorage.setItem(WATCH_KEY, JSON.stringify(remote));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => { fetchPrices(); }, []);

  // 추세 상태(120일선·전 저점) 로드 — 티커 목록 변동 시
  useEffect(() => {
    if (tickers.length === 0) return;
    fetchTrend(tickers).then(t => { if (Object.keys(t).length) setTrend(prev => ({ ...prev, ...t })); }).catch(() => {});
  }, [tickers.join(',')]);

  // 페이지 방문 시 재매수 도달 종목 유무를 토스트로 1회 안내
  const visitToastRef = useRef(false);
  useEffect(() => {
    if (visitToastRef.current) return;
    if (loading) return;                              // 첫 시세 로딩 완료 대기
    if (Object.keys(priceData).length === 0) return; // 시세 없으면 대기
    visitToastRef.current = true;

    // (1) 보유 중인데 손절 발생 → 반등 매도선 도달 종목 (더 시급 → 먼저 안내)
    const sellHits: string[] = [];
    const scan = (name: string, ticker: string) => {
      const e = entries[ticker];
      const p = priceData[ticker]?.price;
      if (!e || !p) return;
      const stop = e.peakPrice * (1 - e.pct / 100);
      if (p > stop) return;                                  // 손절 발생 상태만
      const trough = e.troughPrice ?? p;
      const sellLine = trough * (1 + (e.sellReboundPct ?? 5) / 100);
      if (p >= sellLine) sellHits.push(name);
    };
    accountHoldings.forEach(a => a.holdings.forEach(h => scan(h.name, h.ticker)));
    customStocks.forEach(s => scan(s.name, s.ticker));

    // (2) 매도 후 재매수 워치 도달 종목
    const hits = watchList.filter(w => {
      const p = priceData[w.ticker]?.price;
      if (p == null) return false;
      const rebuy = w.troughPrice * (1 + (w.reboundPct ?? 7) / 100);
      return p >= rebuy || p >= w.peakPrice;
    });

    if (sellHits.length > 0) {
      const names = [...new Set(sellHits)].slice(0, 3).join(', ');
      showToast(`반등 매도 시점 ${sellHits.length}종목 — ${names}${sellHits.length > 3 ? ' 외' : ''} (못 파셨다면 반등에 매도)`, 12000);
    } else if (hits.length > 0) {
      const names = hits.map(h => h.name).slice(0, 3).join(', ');
      showToast(`재매수 도달 ${hits.length}종목 — ${names}${hits.length > 3 ? ' 외' : ''}`, 10000);
    } else if (watchList.length > 0) {
      showToast(`재매수 도달 종목 없음 · 워치 ${watchList.length}종목 추적 중`, 7000);
    } else {
      showToast('재매수 워치에 등록된 종목이 없습니다', 7000);
    }
  }, [loading, priceData, watchList, entries, showToast]);

  // 손절 발생 종목을 재매수 워치리스트에 자동 저장 (매도해도 가이드 유지)
  useEffect(() => {
    // 현재 화면에서 알 수 있는 모든 보유/개별 종목의 메타
    const meta: Record<string, { name: string; currency: 'KRW' | 'USD'; avgPrice: number; qty: number }> = {};
    accountHoldings.forEach(a => a.holdings.forEach(h => {
      meta[h.ticker] = { name: h.name, currency: detectCurrency(h.ticker), avgPrice: h.avgPrice, qty: h.quantity };
    }));
    customStocks.forEach(s => { meta[s.ticker] = { name: s.name, currency: s.currency, avgPrice: s.avgPrice, qty: 1 }; });

    // 당일 최저가(장중 저가) — low 가 있으면 현재가와 함께 최저 반영
    const dayLowOf = (t: string): number | undefined => {
      const d = priceData[t];
      if (!d?.price) return undefined;
      return (d.low != null && d.low > 0) ? Math.min(d.low, d.price) : d.price;
    };

    setWatchList(prev => {
      let next = prev;
      let changed = false;
      for (const ticker of Object.keys(meta)) {
        const e = entries[ticker];
        const p = priceData[ticker]?.price;
        if (!e || !p) continue;
        const stop = e.peakPrice * (1 - e.pct / 100);
        if (p > stop) continue; // 손절 발생 상태가 아니면 저장 안 함
        const m = meta[ticker];
        const dlow = dayLowOf(ticker) ?? p;
        const snapshot: RebuyWatch = {
          ticker, name: m.name, currency: m.currency, avgPrice: m.avgPrice,
          peakPrice: e.peakPrice,
          troughPrice: Math.min(e.troughPrice ?? p, dlow),
          pct: e.pct,
          reboundPct: e.reboundPct ?? 7,
          splitProfile: e.splitProfile ?? 'balanced',
          rebuyBudget: e.rebuyBudget ?? Math.round(m.avgPrice * m.qty),
          triggeredAt: prev.find(w => w.ticker === ticker)?.triggeredAt ?? Date.now(),
        };
        const idx = next.findIndex(w => w.ticker === ticker);
        if (idx === -1) {
          next = [...next, snapshot]; changed = true;
        } else {
          // 저점/고점/설정값 최신화 (triggeredAt 은 유지)
          const cur = next[idx];
          const merged = { ...snapshot, troughPrice: Math.min(cur.troughPrice, snapshot.troughPrice) };
          if (JSON.stringify(cur) !== JSON.stringify(merged)) {
            next = next.map((w, i) => i === idx ? merged : w); changed = true;
          }
        }
      }
      // 매도된(보유목록에 없는) 워치 종목도 장중 저가로 저점 갱신
      next = next.map(w => {
        const dlow = dayLowOf(w.ticker);
        if (dlow != null && dlow < w.troughPrice) { changed = true; return { ...w, troughPrice: dlow }; }
        return w;
      });
      if (changed) saveWatch(next);
      return changed ? next : prev;
    });
  }, [priceData, entries, customStocks.length]);

  // 마운트 시 1회: 손절일 이후 일봉 실제 최저가로 저점 보정 (앱을 안 켠 날의 하락도 반영)
  const lowBackfillRef = useRef(false);
  useEffect(() => {
    if (lowBackfillRef.current) return;
    const list = loadWatch();
    if (list.length === 0) return;
    lowBackfillRef.current = true;
    (async () => {
      const updates: Record<string, number> = {};
      await Promise.all(list.map(async w => {
        const d = new Date(w.triggeredAt);
        const since = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        const histLow = await fetchLowSince(w.ticker, since);
        if (histLow != null && histLow > 0 && histLow < w.troughPrice) updates[w.ticker] = histLow;
      }));
      if (Object.keys(updates).length === 0) return;
      setWatchList(prev => {
        const next = prev.map(w => updates[w.ticker] ? { ...w, troughPrice: updates[w.ticker] } : w);
        saveWatch(next);
        return next;
      });
    })();
  }, []);

  // 차트에서 복귀 시 해당 종목 포커스
  useEffect(() => {
    const returnTicker = sessionStorage.getItem('chart_return_ticker');
    if (!returnTicker) return;
    sessionStorage.removeItem('chart_return_ticker');
    setHighlightTicker(returnTicker);
    // 잠시 후 스크롤 (렌더링 완료 대기)
    setTimeout(() => {
      // 티커로 직접 OR accountId-ticker 형식 중 첫 번째 매칭 ref 탐색
      const ref = rowRefs.current[returnTicker]
        ?? Object.entries(rowRefs.current).find(([k]) => k.endsWith(`-${returnTicker}`))?.[1];
      if (ref?.current) {
        ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      // 2.5초 후 하이라이트 제거
      setTimeout(() => setHighlightTicker(null), 2500);
    }, 300);
  }, []);

  const goToChart = (ticker: string) => {
    sessionStorage.setItem('chart_nav_ticker', ticker);
    sessionStorage.setItem('chart_nav_from', 'trailing-stop');
    navigateTo('chart');
  };

  const updatePct = (ticker: string, pct: number) => {
    setEntries(prev => {
      const avgPrice =
        accountHoldings.flatMap(a => a.holdings).find(h => h.ticker === ticker)?.avgPrice
        ?? customStocks.find(s => s.ticker === ticker)?.avgPrice
        ?? 0;
      const currentP = priceData[ticker]?.price ?? (avgPrice > 0 ? avgPrice : undefined);
      const existingPeak = prev[ticker]?.peakPrice;
      const peakPrice = existingPeak && existingPeak > 0
        ? existingPeak
        : currentP ?? avgPrice;
      const entry = prev[ticker] ?? { pct: 10, peakPrice };
      const next = { ...prev, [ticker]: { ...entry, pct } };
      save(next);
      return next;
    });
    // 필터 유지 시 변경된 항목이 사라지는 현상 방지
    setActiveFilter('all');
  };

  const applyGlobalPct = (pct: number) => {
    setGlobalPct(pct);
    setActiveFilter('all');
    setEntries(prev => {
      const next = { ...prev };
      let changed = false;
      for (const ticker of visibleTickers) {
        const avgPrice =
          accountHoldings.flatMap(a => a.holdings).find(h => h.ticker === ticker)?.avgPrice
          ?? customStocks.find(s => s.ticker === ticker)?.avgPrice
          ?? 0;
        const currentP = priceData[ticker]?.price;
        const existingPeak = next[ticker]?.peakPrice;
        const peakPrice = existingPeak && existingPeak > 0
          ? existingPeak
          : currentP ?? (avgPrice > 0 ? avgPrice : undefined);
        if (!peakPrice) continue;
        if (!next[ticker]) {
          next[ticker] = { pct, peakPrice };
          changed = true;
        } else if (next[ticker].pct !== pct) {
          next[ticker] = { ...next[ticker], pct };
          changed = true;
        }
      }
      if (changed) save(next);
      return changed ? next : prev;
    });
  };

  const addCustomStock = async () => {
    const ticker = addTicker.trim().toUpperCase();
    const price = parseFloat(addPrice.replace(/,/g, ''));
    if (!ticker || !price || price <= 0) return;
    if (customStocks.find(s => s.ticker === ticker)) return;
    setAddLoading(true);
    const currency = addCurrency;
    let name = ticker;
    try {
      if (currency === 'KRW') {
        const r = await fetch(`/naver-stock/${ticker}/basic`);
        if (r.ok) { const d = await r.json(); name = d.stockName || ticker; }
      } else {
        const r = await fetch(`https://asset-dashboard-api.jilliankim200.workers.dev/stock-prices-foreign?tickers=${ticker}`);
        if (r.ok) {
          // 이름은 Yahoo Finance search로 따로 조회할 수 없으므로 ticker 사용
          // stock-check 엔드포인트에서 name 가져오기
          const cr = await fetch(`https://asset-dashboard-api.jilliankim200.workers.dev/stock-check?ticker=${ticker}`);
          if (cr.ok) { const cd = await cr.json(); if (cd.name) name = cd.name; }
        }
      }
    } catch { /* 이름 조회 실패 시 ticker 사용 */ }
    const newStock: CustomStock = { id: `${ticker}-${Date.now()}`, ticker, name, avgPrice: price, currency };
    const next = [...customStocks, newStock];
    setCustomStocks(next);
    saveCustom(next);
    setAddTicker('');
    setAddPrice('');
    setAddLoading(false);
  };

  const removeCustomStock = (id: string) => {
    const next = customStocks.filter(s => s.id !== id);
    setCustomStocks(next);
    saveCustom(next);
  };

  const resetPeak = (ticker: string) => {
    const current = priceData[ticker]?.price;
    if (!current) return;
    setEntries(prev => {
      const entry = prev[ticker] ?? { pct: 10, peakPrice: current };
      const next = { ...prev, [ticker]: { ...entry, peakPrice: current } };
      save(next);
      return next;
    });
  };

  const updateReboundPct = (ticker: string, reboundPct: number) => {
    setEntries(prev => {
      const entry = prev[ticker];
      if (!entry) return prev;
      const next = { ...prev, [ticker]: { ...entry, reboundPct } };
      save(next);
      return next;
    });
  };

  const updateSellReboundPct = (ticker: string, sellReboundPct: number) => {
    setEntries(prev => {
      const entry = prev[ticker];
      if (!entry) return prev;
      const next = { ...prev, [ticker]: { ...entry, sellReboundPct } };
      save(next);
      return next;
    });
  };

  const updateTrendMa = (ticker: string, trendMa: 20 | 60 | 120) => {
    setEntries(prev => {
      const entry = prev[ticker];
      if (!entry) return prev;
      const next = { ...prev, [ticker]: { ...entry, trendMa } };
      save(next);
      return next;
    });
  };

  const updateRebuyBudget = (ticker: string, rebuyBudget: number) => {
    setEntries(prev => {
      const entry = prev[ticker];
      if (!entry) return prev;
      const next = { ...prev, [ticker]: { ...entry, rebuyBudget } };
      save(next);
      return next;
    });
  };

  const updateSplitProfile = (ticker: string, splitProfile: 'safe' | 'balanced' | 'aggressive') => {
    setEntries(prev => {
      const entry = prev[ticker];
      if (!entry) return prev;
      const next = { ...prev, [ticker]: { ...entry, splitProfile } };
      save(next);
      return next;
    });
  };

  // 재매수 워치 항목 수정/삭제
  const patchWatch = (ticker: string, patch: Partial<RebuyWatch>) => {
    setWatchList(prev => {
      const next = prev.map(w => w.ticker === ticker ? { ...w, ...patch } : w);
      saveWatch(next);
      return next;
    });
  };
  const removeWatch = (ticker: string) => {
    setWatchList(prev => {
      const next = prev.filter(w => w.ticker !== ticker);
      saveWatch(next);
      return next;
    });
  };
  // 워치 전체 일괄 변경 (반등 기준·분할 비율)
  const patchAllWatch = (patch: Partial<RebuyWatch>) => {
    setWatchList(prev => {
      const next = prev.map(w => ({ ...w, ...patch }));
      saveWatch(next);
      return next;
    });
  };

  // 현재 뷰에서 보이는 티커만 카운트 (계좌 선택 시 해당 계좌만, 개별종목 뷰면 개별종목만)
  const visibleTickers = isCustomView
    ? customStocks.map(s => s.ticker)
    : accountHoldings.flatMap(a => a.holdings.map(h => h.ticker));

  const counts = [...new Set(visibleTickers)].reduce((acc, ticker) => {
    const entry = entries[ticker];
    if (!entry) return acc;
    const p = priceData[ticker]?.price;
    if (!p) return acc;
    const stopPrice = entry.peakPrice * (1 - entry.pct / 100);
    const distPct = (p - stopPrice) / p * 100;
    if (p <= stopPrice) acc.triggered++;
    else if (distPct < 3) acc.warning++;
    else acc.safe++;
    return acc;
  }, { triggered: 0, warning: 0, safe: 0 });

  // 계좌별 손절 발생 여부
  const triggeredAccountIds = new Set(
    accounts.flatMap(acc =>
      acc.holdings
        .filter(h => !h.isFund && h.ticker && h.quantity > 0)
        .filter(h => {
          const e = entries[h.ticker];
          const p = priceData[h.ticker]?.price;
          if (!e || !p) return false;
          return p <= e.peakPrice * (1 - e.pct / 100);
        })
        .map(() => acc.id)
    )
  );

  return (
    <div style={{
      minHeight: '100%', background: 'var(--bg-page)',
      paddingRight: !isMobile && watchOpen ? 360 : 0,
      transition: 'padding-right 0.3s cubic-bezier(0.4,0,0.2,1)',
    }}>
      <div style={{ padding: isMobile ? '16px 12px 32px' : '20px 20px 40px', maxWidth: 860, margin: '0 auto' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
              추적 손절매
              {/* 원칙 안내 — 아이콘 hover 툴팁 */}
              <span
                style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'help' }}
                onMouseEnter={() => setShowPrinciple(true)}
                onMouseLeave={() => setShowPrinciple(false)}
                onClick={() => setShowPrinciple(v => !v)}
              >
                <MIcon name="info" size={17} style={{ color: 'var(--accent-blue)', opacity: 0.8 }} />
                {showPrinciple && (
                  <span style={{
                    position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 50,
                    width: isMobile ? 260 : 340,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
                    borderRadius: 12, padding: '12px 14px',
                    boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
                    fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', lineHeight: 1.7,
                    whiteSpace: 'normal',
                  }}>
                    <b style={{ color: 'var(--text-primary)' }}>추적 손절매 원칙</b> — 주가가 오르면 고점을 자동 갱신합니다. 고점 대비 설정 비율만큼 하락하면 매도합니다.
                    <br />예) 고점 20,000원 · 손절률 10% → 손절가 18,000원. 주가가 18,000원 이하로 떨어지면 매도 신호.
                  </span>
                )}
              </span>
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              주가 상승 시 고점을 자동 추적하고, 고점 대비 설정 비율 하락 시 매도 신호를 알립니다
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 12 }}>
            <select
              value={selectedAccountId}
              onChange={e => setSelectedAccountId(e.target.value)}
              style={{ height: 38, boxSizing: 'border-box', padding: '0 10px', borderRadius: 10, border: '1px solid var(--border-primary)', background: 'var(--bg-elevated)', fontSize: 13, color: selectedAccountId !== 'all' && triggeredAccountIds.has(selectedAccountId) ? '#F04452' : 'var(--text-primary)', fontFamily: 'inherit', cursor: 'pointer', outline: 'none', minWidth: isMobile ? 140 : 200, maxWidth: isMobile ? 180 : 260 }}>
              <option value="all">전체 계좌</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}
                  style={{ color: triggeredAccountIds.has(acc.id) ? '#F04452' : 'var(--text-primary)' }}>
                  {triggeredAccountIds.has(acc.id) ? '[!] ' : ''}{acc.ownerName} {acc.institution} {acc.accountType}{acc.alias ? ` (${acc.alias})` : ''}
                </option>
              ))}
              <option value="custom">── 개별종목 ({customStocks.length})</option>
            </select>
            <button onClick={fetchPrices} disabled={loading} title={loading ? '조회 중...' : '가격 갱신'}
              style={{ width: 38, height: 38, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0, background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-primary)', borderRadius: 10, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.65 : 1, fontFamily: 'inherit' }}>
              <MIcon name="refresh" size={18} style={{ animation: loading ? 'spin 0.9s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>

        {lastUpdated && (
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 16 }}>
            마지막 조회 {lastUpdated.toLocaleTimeString('ko-KR')}
          </p>
        )}

        {/* 요약 카드 */}
        {(counts.triggered + counts.warning + counts.safe) > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {([
              { label: '손절 발생', count: counts.triggered, color: '#F04452', icon: 'warning', filter: 'triggered' },
              { label: '주의 구간', count: counts.warning, color: '#FF9500', icon: 'notification_important', filter: 'warning' },
              { label: '추적 중', count: counts.safe, color: '#30C85E', icon: 'check_circle', filter: 'safe' },
            ] as const).map(s => {
              const isActive = activeFilter === s.filter;
              // 손절 발생 종목이 1개 이상이면 강하게(솔리드) 강조
              const alarm = s.filter === 'triggered' && s.count > 0;
              return (
                <button key={s.label}
                  onClick={() => setActiveFilter(isActive ? 'all' : s.filter)}
                  style={{
                    flex: 1, minWidth: 0, fontFamily: 'inherit', cursor: 'pointer',
                    background: alarm ? s.color : 'var(--bg-primary)',
                    border: `1.5px solid ${isActive || alarm ? s.color : 'var(--border-primary)'}`,
                    borderRadius: 10, padding: '8px 12px',
                    display: 'flex', alignItems: 'center', gap: 9,
                    boxShadow: isActive ? `0 0 0 3px ${s.color}33` : alarm ? `0 2px 8px ${s.color}55` : '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'all 0.15s',
                  }}>
                  <span style={{
                    width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: alarm ? 'rgba(255,255,255,0.25)' : `color-mix(in srgb, ${s.color} 14%, transparent)`,
                  }}>
                    <MIcon name={s.icon} size={16} style={{ color: alarm ? '#fff' : s.color }} />
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                    <span style={{ fontSize: 20, fontWeight: 800, lineHeight: 1, color: alarm ? '#fff' : s.color }}>{s.count}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap', color: alarm ? 'rgba(255,255,255,0.95)' : 'var(--text-secondary)' }}>{s.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* 일괄 손절률 */}
        <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: '12px 16px', marginBottom: 24, border: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <MIcon name="tune" size={16} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>일괄 손절률</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[5, 7, 10, 15, 20].map(v => {
              const isSelected = globalPct === v;
              return (
                <button key={v} onClick={() => applyGlobalPct(v)}
                  style={{
                    padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                    background: isSelected ? 'var(--pill-selected-bg)' : 'var(--bg-secondary)',
                    color: isSelected ? 'var(--pill-selected-fg)' : 'var(--text-secondary)',
                    transition: 'all 0.15s',
                  }}>
                  {v}%
                </button>
              );
            })}
          </div>
          {/* 재매수 가이드 표시 토글 */}
          <button onClick={toggleGuide} title="손절 발생 카드의 재매수 가이드 표시/숨김"
            style={{
              marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
              border: `1.5px solid ${showGuide ? 'var(--accent-blue)' : 'var(--border-primary)'}`,
              background: showGuide ? 'color-mix(in srgb, var(--accent-blue) 12%, var(--bg-primary))' : 'var(--bg-primary)',
              color: showGuide ? 'var(--accent-blue)' : 'var(--text-tertiary)',
            }}>
            <MIcon name={showGuide ? 'visibility' : 'visibility_off'} size={16} />
            재매수 가이드 {showGuide ? '표시 중' : '숨김'}
          </button>
        </div>

        {/* 개별종목 뷰 */}
        {isCustomView && (
          <div style={{ marginBottom: 28 }}>
            {/* 추가 폼 */}
            <div style={{ background: 'var(--bg-primary)', borderRadius: 14, padding: '14px 16px', marginBottom: 16, border: '1px solid var(--border-primary)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>종목 추가</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  value={addTicker}
                  onChange={e => {
                    const v = e.target.value.toUpperCase();
                    setAddTicker(v);
                    setAddCurrency(detectCurrency(v));
                  }}
                  onKeyDown={e => e.key === 'Enter' && addCustomStock()}
                  placeholder="티커 (예: 005930 / TSLA)"
                  style={{ flex: '1 1 100px', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', flex: '1 1 120px', border: '1px solid var(--border-primary)', borderRadius: 8, overflow: 'hidden' }}>
                  <input
                    value={addPrice}
                    onChange={e => setAddPrice(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCustomStock()}
                    placeholder={addCurrency === 'USD' ? '매수가 ($)' : '매수가 (원)'}
                    type="number"
                    style={{ flex: 1, padding: '8px 10px', border: 'none', fontSize: 13, fontFamily: 'inherit', outline: 'none', minWidth: 0 }}
                  />
                  <select
                    value={addCurrency}
                    onChange={e => setAddCurrency(e.target.value as 'KRW' | 'USD')}
                    style={{ padding: '8px 6px', border: 'none', borderLeft: '1px solid var(--border-primary)', fontSize: 12, fontWeight: 700, color: addCurrency === 'USD' ? '#3182F6' : 'var(--text-secondary)', background: 'var(--bg-secondary)', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}>
                    <option value="KRW">KRW</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <button onClick={addCustomStock} disabled={addLoading || !addTicker || !addPrice}
                  style={{ padding: '8px 16px', background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: addLoading || !addTicker || !addPrice ? 'default' : 'pointer', opacity: addLoading || !addTicker || !addPrice ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                  {addLoading ? '조회 중...' : '추가'}
                </button>
              </div>
            </div>

            {/* 개별종목 목록 */}
            {customStocks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)' }}>
                <MIcon name="add_circle" size={36} style={{ opacity: 0.25, display: 'block', margin: '0 auto 10px' }} />
                <p style={{ fontSize: 13 }}>티커와 매수가를 입력해 종목을 추가하세요</p>
              </div>
            ) : (
              [...customStocks]
              .filter(cs => {
                if (activeFilter === 'all') return true;
                const e = entries[cs.ticker] ?? { pct: 10, peakPrice: cs.avgPrice };
                const p = priceData[cs.ticker]?.price;
                if (!p) return activeFilter === 'safe';
                const stop = e.peakPrice * (1 - e.pct / 100);
                const dist = (p - stop) / p * 100;
                if (activeFilter === 'triggered') return p <= stop;
                if (activeFilter === 'warning') return p > stop && dist < 3;
                return p > stop && dist >= 3;
              })
              .sort((a, b) => {
                const getDist = (cs: CustomStock) => {
                  const e = entries[cs.ticker];
                  const p = priceData[cs.ticker]?.price;
                  if (!e || !p) return 999;
                  return (p - e.peakPrice * (1 - e.pct / 100)) / p * 100;
                };
                return getDist(a) - getDist(b);
              })
              .map(cs => {
                const pd = priceData[cs.ticker];
                const entry = entries[cs.ticker] ?? { pct: 10, peakPrice: pd?.price ?? cs.avgPrice };
                const fakeHolding: Holding = { id: cs.id, name: cs.name, ticker: cs.ticker, market: 'KR', avgPrice: cs.avgPrice, quantity: 1 };
                if (!rowRefs.current[cs.ticker]) rowRefs.current[cs.ticker] = { current: null } as React.RefObject<HTMLDivElement>;
                return (
                  <div key={cs.id} style={{ position: 'relative' }}>
                    <HoldingRow
                      holding={fakeHolding}
                      account={customAccount}
                      currentPrice={pd?.price}
                      changeRate={pd?.changeRate}
                      entry={entry}
                      currency={cs.currency ?? detectCurrency(cs.ticker)}
                      onPctChange={p => updatePct(cs.ticker, p)}
                      onResetPeak={() => resetPeak(cs.ticker)}
                      onReboundPctChange={(p) => updateReboundPct(cs.ticker, p)}
                      onSellReboundChange={(p) => updateSellReboundPct(cs.ticker, p)}
                      onTrendMaChange={(m) => updateTrendMa(cs.ticker, m)}
                      onBudgetChange={(b) => updateRebuyBudget(cs.ticker, b)}
                      onProfileChange={(p) => updateSplitProfile(cs.ticker, p)}
                      isAmountHidden={isAmountHidden}
                      onNameClick={goToChart}
                      highlight={highlightTicker === cs.ticker}
                      rowRef={rowRefs.current[cs.ticker]}
                      showGuide={showGuide}
                      trend={trend[cs.ticker]}
                    />
                    <button onClick={() => removeCustomStock(cs.id)}
                      title="삭제"
                      style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2, display: 'flex', alignItems: 'center' }}>
                      <MIcon name="close" size={16} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 계좌별 종목 목록 */}
        {!isCustomView && accountHoldings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-tertiary)' }}>
            <MIcon name="inventory_2" size={40} style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
            <p>등록된 보유종목이 없습니다</p>
          </div>
        ) : !isCustomView ? (
          accountHoldings.map(({ account, holdings }) => {
            const getStatus = (ticker: string) => {
              const e = entries[ticker];
              const p = priceData[ticker]?.price;
              if (!e || !p) return 'safe';
              const stop = e.peakPrice * (1 - e.pct / 100);
              if (p <= stop) return 'triggered';
              if ((p - stop) / p * 100 < 3) return 'warning';
              return 'safe';
            };

            // 필터 적용
            const filtered = activeFilter === 'all'
              ? holdings
              : holdings.filter(h => getStatus(h.ticker) === activeFilter);

            if (filtered.length === 0) return null;

            // 손절 위험순 정렬: distPct 오름차순 (낮을수록 위험)
            const getDistPct = (h: typeof holdings[0]) => {
              const e = entries[h.ticker];
              const p = priceData[h.ticker]?.price;
              if (!e || !p) return 999;
              const stop = e.peakPrice * (1 - e.pct / 100);
              return (p - stop) / p * 100;
            };
            const sorted = [...filtered].sort((a, b) => getDistPct(a) - getDistPct(b));

            return (
              <div key={account.id} style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', padding: '3px 9px', borderRadius: 6 }}>
                    {account.ownerName}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {account.institution} {account.accountType}
                  </span>
                  {account.alias && (
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>· {account.alias}</span>
                  )}
                </div>

                {sorted.map(h => {
                  const pd = priceData[h.ticker];
                  const avgPrice = accountHoldings
                    .flatMap(a => a.holdings)
                    .find(x => x.ticker === h.ticker)?.avgPrice ?? h.avgPrice;
                  const defaultEntry: TrailingEntry = {
                    pct: 10,
                    peakPrice: pd?.price ?? h.avgPrice,
                  };
                  const entry = entries[h.ticker] ?? defaultEntry;
                  const rowKey = `${account.id}-${h.ticker}`;
                  if (!rowRefs.current[rowKey]) rowRefs.current[rowKey] = { current: null } as React.RefObject<HTMLDivElement>;

                  return (
                    <HoldingRow
                      key={rowKey}
                      holding={h}
                      account={account}
                      currentPrice={pd?.price}
                      changeRate={pd?.changeRate}
                      entry={entry}
                      currency={h.market === 'US' ? 'USD' : 'KRW'}
                      onPctChange={(p) => updatePct(h.ticker, p)}
                      onResetPeak={() => resetPeak(h.ticker)}
                      onReboundPctChange={(p) => updateReboundPct(h.ticker, p)}
                      onSellReboundChange={(p) => updateSellReboundPct(h.ticker, p)}
                      onTrendMaChange={(m) => updateTrendMa(h.ticker, m)}
                      onBudgetChange={(b) => updateRebuyBudget(h.ticker, b)}
                      onProfileChange={(p) => updateSplitProfile(h.ticker, p)}
                      isAmountHidden={isAmountHidden}
                      onNameClick={goToChart}
                      highlight={highlightTicker === h.ticker}
                      rowRef={rowRefs.current[rowKey]}
                      showGuide={showGuide}
                      trend={trend[h.ticker]}
                    />
                  );
                })}
              </div>
            );
          })
        ) : null}
      </div>

      {/* 재매수 워치 — 우측 고정 드로어 (AI 어시스턴트 형식) */}
      {!watchOpen && (
        <button onClick={() => setWatchOpen(true)} title="재매수 워치 열기"
          style={{
            position: 'fixed', top: '50%', right: 0, transform: 'translateY(-50%)', zIndex: 298,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '12px 8px', border: 'none', cursor: 'pointer',
            background: 'var(--accent-blue)', color: '#fff',
            borderRadius: '12px 0 0 12px', boxShadow: '-4px 0 16px rgba(0,0,0,0.18)',
            fontFamily: 'inherit',
          }}>
          <MIcon name="bookmark" size={20} />
          <span style={{ fontSize: 11, fontWeight: 700 }}>재매수</span>
          {watchList.length > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, background: '#fff', color: 'var(--accent-blue)', borderRadius: 10, padding: '0 6px', minWidth: 18, textAlign: 'center' }}>{watchList.length}</span>
          )}
        </button>
      )}
      <RebuyWatchPanel
        isOpen={watchOpen}
        onClose={() => setWatchOpen(false)}
        watchList={watchList}
        priceData={priceData}
        isAmountHidden={isAmountHidden}
        isMobile={isMobile}
        onPatch={patchWatch}
        onPatchAll={patchAllWatch}
        onRemove={removeWatch}
        onNameClick={goToChart}
      />
    </div>
  );
}
