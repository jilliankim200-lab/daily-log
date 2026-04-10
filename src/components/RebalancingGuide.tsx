import React, { useMemo, useState } from 'react';
import { useAppContext } from '../App';
import { MIcon } from './MIcon';
import type { Account, Holding } from '../types';

// ── 기본 유틸 ────────────────────────────────────────────────
function hVal(h: Holding, prices: Record<string, number>): number {
  if (h.isFund) return h.amount || 0;
  const p = (h.ticker && prices[h.ticker]) ? prices[h.ticker] : h.avgPrice;
  return p * h.quantity;
}
function fmtKrw(n: number): string {
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  return n.toLocaleString();
}
function fmtFull(n: number): string {
  return Math.round(n).toLocaleString('ko-KR') + '원';
}

// ── 분류 ─────────────────────────────────────────────────────
// 커버드콜은 주식 계열로 취급 (안전자산 아님)
type AssetClass = '주식' | '채권' | '커버드콜' | '금' | '기타';

const ASSET_COLORS: Record<AssetClass, string> = {
  주식:    'var(--asset-stock)',
  채권:    'var(--asset-bond)',
  커버드콜: 'var(--asset-covered)',
  금:      'var(--asset-gold)',
  기타:    'var(--asset-other)',
};

function classify(name: string): AssetClass {
  if (['커버드콜'].some(k => name.includes(k))) return '커버드콜';
  if (['국채', '채권', '단기채', '액티브'].some(k => name.includes(k))) return '채권';
  if (['금현물', 'KRX금'].some(k => name.includes(k))) return '금';
  if (['나스닥', 'S&P', '코스닥', '코스피', '반도체', 'AI', '인도', '배당',
       '고배당', '밸류체인', '미국', '글로벌', '200', '500', '30년국채'].some(k => name.includes(k))) return '주식';
  return '기타';
}

// 안전자산: 채권 + 금 + 현금 (커버드콜은 주식)
function isSafeAsset(cls: AssetClass): boolean {
  return cls === '채권' || cls === '금';
}

// ── 퇴직/IRP 계좌 판별 ────────────────────────────────────────
// accountType: 퇴직연금, IRP 포함
// alias/institution: 퇴직, DC, DB, IRP 포함
function isRetirementAcc(acc: Account): boolean {
  const t = acc.accountType;
  const a = acc.alias || acc.institution;
  return (
    t.includes('퇴직연금') || t.includes('IRP') ||
    a.includes('퇴직') || a.includes('DC') || a.includes('DB') || a.includes('IRP')
  );
}

// 안전자산 비중 계산 (현금 포함)
function calcSafeRatio(acc: Account, prices: Record<string, number>) {
  const cash = acc.cash || 0;
  const totalVal = acc.holdings.reduce((s, h) => s + hVal(h, prices), 0) + cash;
  const safeVal = acc.holdings.reduce((s, h) => {
    return isSafeAsset(classify(h.name)) ? s + hVal(h, prices) : s;
  }, cash); // 현금도 안전자산
  const safePct = totalVal > 0 ? (safeVal / totalVal) * 100 : 0;
  return { safePct, safeVal, totalVal };
}

// 수익률 계산
function calcReturn(h: Holding, prices: Record<string, number>): number | null {
  if (h.isFund || !h.avgPrice || h.avgPrice === 0) return null;
  const cur = (h.ticker && prices[h.ticker]) ? prices[h.ticker] : null;
  if (!cur) return null;
  return ((cur - h.avgPrice) / h.avgPrice) * 100;
}

function holdingCount(count: number) {
  if (count <= 2) return { label: '적정', color: 'var(--color-profit)', icon: 'check_circle' };
  if (count === 3) return { label: '보통', color: 'var(--color-warning)', icon: 'info' };
  return { label: '많음', color: 'var(--color-loss)', icon: 'warning' };
}

// ── 요약 카드 + 클릭 팝오버 ──────────────────────────────────
function SummaryCards({
  accounts, prices, retirementStatus, duplicateInfo, highReturnHoldings, summary, isMobile,
}: {
  accounts: Account[];
  prices: Record<string, number>;
  retirementStatus: { acc: Account; safePct: number; safeVal: number; totalVal: number; ok: boolean }[];
  duplicateInfo: { key: string; name: string; cls: AssetClass; accounts: { accAlias: string; owner: string; val: number; isRetirement: boolean }[] }[];
  highReturnHoldings: { acc: Account; h: Holding; ret: number; pct: number }[];
  summary: { retFail: number; dupCount: number };
  isMobile: boolean;
}) {
  const [opened, setOpened] = useState<number | null>(null);

  const cards = [
    {
      icon: 'account_balance', label: '전체 계좌', color: 'var(--accent-blue)',
      value: `${accounts.length}개`,
    },
    {
      icon: 'warning', label: '30~35% 이탈', color: summary.retFail > 0 ? 'var(--color-loss)' : 'var(--color-profit)',
      value: `${summary.retFail}개`,
    },
    {
      icon: 'content_copy', label: '중복 종목', color: summary.dupCount > 0 ? 'var(--color-warning)' : 'var(--color-profit)',
      value: `${summary.dupCount}개`,
    },
    {
      icon: 'trending_up', label: '고수익(40%↑)', color: 'var(--color-profit)',
      value: `${highReturnHoldings.length}개`,
    },
  ];

  function renderTooltip(idx: number) {
    const base: React.CSSProperties = {
      position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 200,
      background: 'var(--bg-tooltip)', border: '1px solid var(--border-tooltip)',
      borderRadius: 12, boxShadow: 'var(--shadow-tooltip)',
      padding: '12px 14px', minWidth: 220,
      pointerEvents: 'auto',
    };
    const row: React.CSSProperties = {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '5px 0', borderBottom: '1px solid var(--border-secondary)',
      fontSize: 12, gap: 8,
    };
    const last: React.CSSProperties = { ...row, borderBottom: 'none' };

    if (idx === 0) {
      // 전체 계좌 목록
      return (
        <div style={base}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 8 }}>계좌 목록</div>
          {accounts.map((a, i) => {
            const tv = a.holdings.reduce((s, h) => s + hVal(h, prices), 0) + (a.cash || 0);
            const isRet = isRetirementAcc(a);
            return (
              <div key={i} style={i === accounts.length - 1 ? last : row}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                  {isRet && <span style={{ fontSize: 10, color: 'var(--color-warning)', marginRight: 4 }}>퇴직</span>}
                  {a.ownerName} · {a.alias || a.institution}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600, flexShrink: 0 }}>{fmtKrw(tv)}</span>
              </div>
            );
          })}
        </div>
      );
    }

    if (idx === 1) {
      // 30%룰 퇴직 계좌 전체
      return (
        <div style={base}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 8 }}>퇴직/IRP 안전자산 현황</div>
          {retirementStatus.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>퇴직/IRP 계좌 없음</div>
          )}
          {retirementStatus.map(({ acc, safePct, safeVal, totalVal, ok }, i) => (
            <div key={i} style={i === retirementStatus.length - 1 ? last : row}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{acc.ownerName} · {acc.alias || acc.institution}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  안전자산 {fmtKrw(safeVal)} / {fmtKrw(totalVal)}
                </div>
              </div>
              <span style={{
                fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 8, flexShrink: 0,
                background: ok ? 'color-mix(in srgb, var(--color-profit) 15%, transparent)' : 'color-mix(in srgb, var(--color-loss) 15%, transparent)',
                color: ok ? 'var(--color-profit)' : 'var(--color-loss)',
              }}>{safePct.toFixed(1)}% {ok ? '✓' : '⚠'}</span>
            </div>
          ))}
        </div>
      );
    }

    if (idx === 2) {
      // 중복 종목 목록
      return (
        <div style={{ ...base, maxHeight: 320, overflowY: 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 8 }}>중복 종목 목록</div>
          {duplicateInfo.map((d, i) => {
            const best = [...d.accounts].sort((a, b) => b.val - a.val)[0];
            return (
              <div key={i} style={i === duplicateInfo.length - 1 ? { ...last, flexDirection: 'column', alignItems: 'flex-start', gap: 4 } : { ...row, flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{d.name}</span>
                  <span style={{
                    fontSize: 10, padding: '1px 5px', borderRadius: 5,
                    background: `color-mix(in srgb, ${ASSET_COLORS[d.cls]} 15%, transparent)`,
                    color: ASSET_COLORS[d.cls],
                  }}>{d.cls}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {d.accounts.length}개 계좌 → <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>{best.accAlias}</span>으로 통합 추천
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (idx === 3) {
      // 고수익 종목 목록
      return (
        <div style={{ ...base, maxHeight: 320, overflowY: 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 8 }}>고수익 유지 종목</div>
          {highReturnHoldings.map(({ acc, h, ret, pct }, i) => (
            <div key={i} style={i === highReturnHoldings.length - 1 ? last : row}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 12 }}>{h.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>
                  {acc.ownerName} · {acc.alias || acc.institution} · 비중 {pct.toFixed(1)}%
                </div>
              </div>
              <span style={{ color: 'var(--color-profit)', fontWeight: 700, flexShrink: 0 }}>+{ret.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      );
    }

    return null;
  }

  // 바깥 클릭 시 닫기
  React.useEffect(() => {
    if (opened === null) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-summary-card]')) setOpened(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [opened]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
      {cards.map((c, idx) => (
        <div
          key={c.label}
          data-summary-card="1"
          style={{ position: 'relative' }}
          onClick={() => setOpened(opened === idx ? null : idx)}
        >
          <div style={{
            background: opened === idx ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
            borderRadius: 12, padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
            border: opened === idx ? `1px solid color-mix(in srgb, ${c.color} 30%, var(--border-primary))` : '1px solid transparent',
            cursor: 'pointer', transition: 'all 0.15s',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: `color-mix(in srgb, ${c.color} 15%, transparent)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MIcon name={c.icon} size={18} style={{ color: c.color }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{c.label}</div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: c.color }}>{c.value}</div>
            </div>
          </div>
          {opened === idx && renderTooltip(idx)}
        </div>
      ))}
    </div>
  );
}

// ── 계좌 카드 ─────────────────────────────────────────────────
function AccountCard({
  account, prices, isMobile, duplicateNames,
}: {
  account: Account; prices: Record<string, number>;
  isMobile: boolean; duplicateNames: Set<string>;
}) {
  const [expanded, setExpanded] = useState(true);
  const isRetirement = isRetirementAcc(account);
  const { safePct, safeVal, totalVal } = calcSafeRatio(account, prices);
  const safeStatus = !isRetirement ? 'good'
    : safePct < 30 ? 'under' : safePct >= 35 ? 'over' : 'good';
  const safeOk = safeStatus === 'good';

  const items = account.holdings.map(h => {
    const val = hVal(h, prices);
    const pct = totalVal > 0 ? (val / totalVal) * 100 : 0;
    const ret = calcReturn(h, prices);
    return { ...h, val, pct, cls: classify(h.name), ret };
  }).sort((a, b) => b.val - a.val);

  const status = holdingCount(account.holdings.length);

  return (
    <div style={{
      borderRadius: 14,
      border: `1px solid ${safeStatus === 'under' ? 'color-mix(in srgb, var(--color-loss) 40%, var(--border-primary))' : safeStatus === 'over' ? 'color-mix(in srgb, var(--color-warning) 40%, var(--border-primary))' : 'var(--border-primary)'}`,
      background: 'var(--bg-secondary)', overflow: 'hidden',
    }}>
      {/* 안전자산 상태 배너 */}
      {isRetirement && safeStatus === 'under' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px',
          background: 'color-mix(in srgb, var(--color-loss) 10%, transparent)',
          borderBottom: '1px solid color-mix(in srgb, var(--color-loss) 20%, transparent)',
          fontSize: 12, color: 'var(--color-loss)', fontWeight: 600,
        }}>
          <MIcon name="warning" size={14} />
          안전자산 {safePct.toFixed(1)}% — 30% 미달! 채권·금 비중 확대 필요
        </div>
      )}
      {isRetirement && safeStatus === 'over' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px',
          background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
          borderBottom: '1px solid color-mix(in srgb, var(--color-warning) 20%, transparent)',
          fontSize: 12, color: 'var(--color-warning)', fontWeight: 600,
        }}>
          <MIcon name="arrow_upward" size={14} />
          안전자산 {safePct.toFixed(1)}% — 35% 초과! 주식 ETF 비중 확대 검토
        </div>
      )}
      {isRetirement && safeStatus === 'good' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 18px',
          background: 'color-mix(in srgb, var(--color-profit) 8%, transparent)',
          borderBottom: '1px solid color-mix(in srgb, var(--color-profit) 15%, transparent)',
          fontSize: 11, color: 'var(--color-profit)',
        }}>
          <MIcon name="shield" size={13} />
          안전자산 {safePct.toFixed(1)}% — 목표 구간 달성 (30~35%)
        </div>
      )}

      {/* 헤더 */}
      <div onClick={() => setExpanded(e => !e)} style={{
        padding: '14px 18px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <MIcon name={status.icon} size={18} style={{ color: status.color, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                {account.alias || account.institution}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 10,
                background: isRetirement ? 'color-mix(in srgb, var(--color-warning) 15%, transparent)' : 'var(--bg-tertiary)',
                color: isRetirement ? 'var(--color-warning)' : 'var(--text-tertiary)',
              }}>{account.accountType}{isRetirement ? ' · 30%룰' : ''}</span>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 10,
                background: `color-mix(in srgb, ${status.color} var(--badge-mix), transparent)`,
                color: status.color,
              }}>{account.holdings.length}개 · {status.label}</span>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{fmtKrw(totalVal)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{account.ownerName}</div>
        </div>
      </div>

      {/* 비중 바 */}
      {items.length > 0 && (
        <div style={{ padding: '0 18px 10px' }}>
          <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
            {items.map((it, i) => (
              <div key={i} title={`${it.name} ${it.pct.toFixed(1)}%`}
                style={{ width: `${it.pct}%`, background: ASSET_COLORS[it.cls], borderRadius: 2, transition: 'width 0.3s' }} />
            ))}
            {(account.cash || 0) > 0 && (
              <div title={`현금 ${((account.cash! / totalVal) * 100).toFixed(1)}%`}
                style={{ width: `${(account.cash! / totalVal) * 100}%`, background: '#C3E88D', opacity: 0.5, borderRadius: 2 }} />
            )}
          </div>
          {/* 안전자산 목표 구간 마커 (30% ~ 35%) */}
          {isRetirement && (
            <div style={{ position: 'relative', height: 6, marginTop: 3 }}>
              {/* 목표 구간 하이라이트 */}
              <div style={{
                position: 'absolute', left: '30%', width: '5%', height: 4,
                background: 'color-mix(in srgb, var(--color-profit) 30%, transparent)',
                top: 0, borderRadius: 2,
              }} />
              <div style={{ position: 'absolute', left: '30%', top: 0, width: 1, height: 8, background: 'var(--color-profit)' }} />
              <div style={{ position: 'absolute', left: '35%', top: 0, width: 1, height: 8, background: 'var(--color-warning)' }} />
              <span style={{ position: 'absolute', left: 'calc(30% + 2px)', top: -3, fontSize: 9, color: 'var(--color-profit)' }}>30%</span>
              <span style={{ position: 'absolute', left: 'calc(35% + 2px)', top: -3, fontSize: 9, color: 'var(--color-warning)' }}>35%</span>
            </div>
          )}
        </div>
      )}

      {/* 종목 테이블 */}
      {expanded && items.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-secondary)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '8px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textAlign: 'left', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-secondary)' }}>종목</th>
                <th style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textAlign: 'center', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-secondary)' }}>분류</th>
                {!isMobile && <th style={{ padding: '8px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textAlign: 'right', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-secondary)' }}>평가금액</th>}
                <th style={{ padding: '8px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textAlign: 'right', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-secondary)' }}>비중</th>
                <th style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textAlign: 'right', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-secondary)' }}>수익률</th>
                <th style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textAlign: 'center', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-secondary)' }}>메모</th>
              </tr>
            </thead>
            <tbody>
              {items.map((h, i) => {
                const isDup = duplicateNames.has(h.ticker || h.name);
                const highReturn = h.ret !== null && h.ret >= 40;
                const isSafe = isSafeAsset(h.cls);
                // 퇴직 계좌에서 안전자산 제거 시 30% 룰 위반 여부
                const safeRemoveWarning = isRetirement && isSafe && (() => {
                  const newSafeVal = safeVal - h.val;
                  const newPct = totalVal > 0 ? (newSafeVal / totalVal) * 100 : 0;
                  return newPct < 30;
                })();

                return (
                  <tr key={i} style={{
                    background: highReturn
                      ? 'color-mix(in srgb, var(--color-profit) 5%, transparent)'
                      : isDup ? 'color-mix(in srgb, var(--color-warning) 4%, transparent)' : 'transparent',
                  }}>
                    <td style={{ padding: '10px 14px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 500 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {safeRemoveWarning && <MIcon name="lock" size={12} style={{ color: 'var(--color-warning)', flexShrink: 0 }} title="제거 시 30% 룰 위반" />}
                        <span>{h.name}</span>
                      </div>
                      {h.ticker && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{h.ticker}</div>}
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 6,
                        background: `color-mix(in srgb, ${ASSET_COLORS[h.cls]} 15%, transparent)`,
                        color: ASSET_COLORS[h.cls],
                      }}>{h.cls}</span>
                    </td>
                    {!isMobile && (
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                        {fmtFull(h.val)}
                      </td>
                    )}
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {h.pct.toFixed(1)}%
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: 12, fontWeight: 600,
                      color: h.ret === null ? 'var(--text-quaternary)'
                        : h.ret >= 40 ? 'var(--color-profit)'
                        : h.ret >= 0 ? 'var(--color-profit)'
                        : 'var(--color-loss)',
                    }}>
                      {h.ret === null ? '—' : `${h.ret >= 0 ? '+' : ''}${h.ret.toFixed(1)}%`}
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {highReturn && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
                            background: 'color-mix(in srgb, var(--color-profit) 15%, transparent)',
                            color: 'var(--color-profit)',
                          }}>유지↑</span>
                        )}
                        {isDup && (
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 8,
                            background: 'color-mix(in srgb, var(--color-warning) 15%, transparent)',
                            color: 'var(--color-warning)',
                          }}>중복</span>
                        )}
                        {safeRemoveWarning && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
                            background: 'color-mix(in srgb, var(--color-loss) 15%, transparent)',
                            color: 'var(--color-loss)',
                          }}>30%필수</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {(account.cash || 0) > 0 && (
                <tr>
                  <td style={{ padding: '10px 14px', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>현금</td>
                  <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>현금</span>
                  </td>
                  {!isMobile && <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{fmtFull(account.cash!)}</td>}
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                    {((account.cash! / totalVal) * 100).toFixed(1)}%
                  </td>
                  <td colSpan={2} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export function RebalancingGuide() {
  const { accounts, prices, isMobile } = useAppContext();
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'wife' | 'husband'>('all');
  const [selectedAccKey, setSelectedAccKey] = useState<string>('all');

  const accOptions = useMemo(() => [
    { key: 'all', label: '전체 계좌' },
    ...accounts.map(a => ({
      key: `${a.ownerName}·${a.alias || a.institution}`,
      label: `${a.ownerName}·${a.alias || a.institution}`,
    })),
  ], [accounts]);

  // 퇴직/IRP 계좌 안전자산 현황
  const retirementStatus = useMemo(() =>
    accounts
      .filter(isRetirementAcc)
      .map(acc => {
        const { safePct, safeVal, totalVal } = calcSafeRatio(acc, prices);
        const status: 'under' | 'good' | 'over' =
          safePct < 30 ? 'under' : safePct >= 35 ? 'over' : 'good';
        return { acc, safePct, safeVal, totalVal, ok: status === 'good', status };
      }),
    [accounts, prices]
  );

  // 중복 종목
  const duplicateInfo = useMemo(() => {
    const map = new Map<string, { name: string; cls: AssetClass; accounts: { accAlias: string; owner: string; val: number; isRetirement: boolean }[] }>();
    accounts.forEach(acc => {
      const isRet = isRetirementAcc(acc);
      acc.holdings.forEach(h => {
        const key = h.ticker || h.name;
        const cls = classify(h.name);
        if (!map.has(key)) map.set(key, { name: h.name, cls, accounts: [] });
        map.get(key)!.accounts.push({ accAlias: acc.alias || acc.institution, owner: acc.ownerName, val: hVal(h, prices), isRetirement: isRet });
      });
    });
    return Array.from(map.entries())
      .filter(([, v]) => v.accounts.length >= 2)
      .map(([key, v]) => ({ key, ...v }));
  }, [accounts, prices]);

  const duplicateNames = useMemo(() => new Set(duplicateInfo.map(d => d.key)), [duplicateInfo]);

  // 고수익(40%↑) 종목
  const highReturnHoldings = useMemo(() => {
    const result: { acc: Account; h: Holding; ret: number; pct: number }[] = [];
    accounts.forEach(acc => {
      const totalVal = acc.holdings.reduce((s, h) => s + hVal(h, prices), 0) + (acc.cash || 0);
      acc.holdings.forEach(h => {
        const ret = calcReturn(h, prices);
        if (ret !== null && ret >= 40) {
          const val = hVal(h, prices);
          const pct = totalVal > 0 ? (val / totalVal) * 100 : 0;
          result.push({ acc, h, ret, pct });
        }
      });
    });
    return result.sort((a, b) => b.ret - a.ret);
  }, [accounts, prices]);

  // 전체 요약
  const summary = useMemo(() => {
    const tooMany = accounts.filter(a => a.holdings.length >= 4).length;
    const ok = accounts.filter(a => a.holdings.length <= 2).length;
    const retFail = retirementStatus.filter(r => r.status !== 'good').length;
    return { tooMany, ok, dupCount: duplicateInfo.length, retFail };
  }, [accounts, duplicateInfo, retirementStatus]);

  // 유사 종목 그룹
  const similarGroups = useMemo(() => {
    const groups = [
      { label: '나스닥100 계열', keywords: ['나스닥100', '나스닥 100'], color: '#82AAFF' },
      { label: 'S&P500 계열',   keywords: ['S&P500', 'S&P 500'],       color: '#C3E88D' },
      { label: '미국30년국채',  keywords: ['30년국채', '미국채30'],      color: '#FFCB6B' },
      { label: '단기채 계열',   keywords: ['단기채', '단기채권액티브'],  color: '#89DDFF' },
      { label: '커버드콜 계열', keywords: ['커버드콜'],                  color: '#F78C6C' },
    ];
    return groups.map(g => {
      const matched: { accName: string; holdName: string; val: number }[] = [];
      accounts.forEach(acc => {
        acc.holdings.forEach(h => {
          if (g.keywords.some(kw => h.name.includes(kw)))
            matched.push({ accName: acc.alias || acc.institution, holdName: h.name, val: hVal(h, prices) });
        });
      });
      return { ...g, matched };
    }).filter(g => g.matched.length >= 2);
  }, [accounts, prices]);

  const filteredDuplicates = useMemo(() => {
    if (selectedAccKey === 'all') return duplicateInfo;
    const selAlias = selectedAccKey.split('·').slice(1).join('·');
    return duplicateInfo.filter(d => d.accounts.some(a => a.accAlias === selAlias));
  }, [duplicateInfo, selectedAccKey]);

  const filteredSimilarGroups = useMemo(() => {
    if (selectedAccKey === 'all') return similarGroups;
    const selAlias = selectedAccKey.split('·').slice(1).join('·');
    return similarGroups
      .map(g => ({ ...g, matched: g.matched.filter(m => m.accName === selAlias) }))
      .filter(g => g.matched.length >= 1);
  }, [similarGroups, selectedAccKey]);

  const filteredAccounts = useMemo(() => {
    if (selectedAccKey !== 'all') {
      const selAlias = selectedAccKey.split('·').slice(1).join('·');
      return accounts.filter(a => (a.alias || a.institution) === selAlias);
    }
    return accounts.filter(a => ownerFilter === 'all' || a.owner === ownerFilter);
  }, [accounts, ownerFilter, selectedAccKey]);

  const owners = [
    { id: 'all', label: '전체' },
    { id: 'wife', label: '지윤' },
    { id: 'husband', label: '오빠' },
  ] as const;

  if (accounts.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
        <MIcon name="account_balance" size={48} style={{ opacity: 0.3, display: 'block', margin: '0 auto 16px' }} />
        계좌종목등록 메뉴에서 계좌와 종목을 먼저 등록해 주세요.
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? '16px 12px' : '24px' }}>

      {/* 타이틀 + 셀렉트 */}
      <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', flexDirection: isMobile ? 'column' : 'row', gap: 12, marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>리밸런싱 가이드</h2>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
            계좌당 2~3개 종목 · 퇴직/IRP 안전자산 30% 룰 · 고수익 종목 유지
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MIcon name="filter_list" size={16} style={{ color: 'var(--text-tertiary)' }} />
          <select value={selectedAccKey} onChange={e => { setSelectedAccKey(e.target.value); setOwnerFilter('all'); }}
            style={{
              padding: '7px 32px 7px 12px', borderRadius: 10, fontSize: 'var(--text-sm)', fontWeight: 600,
              border: '1px solid var(--border-primary)', cursor: 'pointer', outline: 'none', appearance: 'none',
              background: selectedAccKey !== 'all' ? 'color-mix(in srgb, var(--accent-blue) 12%, var(--bg-secondary))' : 'var(--bg-secondary)',
              color: selectedAccKey !== 'all' ? 'var(--accent-blue)' : 'var(--text-primary)',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='%238b8c94'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
              minWidth: isMobile ? 160 : 180,
            }}>
            {accOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* 요약 카드 */}
      <SummaryCards
        accounts={accounts}
        prices={prices}
        retirementStatus={retirementStatus}
        duplicateInfo={duplicateInfo}
        highReturnHoldings={highReturnHoldings}
        summary={summary}
        isMobile={isMobile}
      />

      {/* ── 퇴직/IRP 안전자산 현황 ── */}
      {retirementStatus.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <MIcon name="shield" size={16} style={{ color: 'var(--color-warning)' }} />
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
              퇴직/IRP 안전자산 현황 <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>— 목표 구간 30~35% (채권·금·현금)</span>
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 10 }}>
            {retirementStatus.map(({ acc, safePct, safeVal, totalVal, ok, status }) => {
              const safeHoldings = acc.holdings.filter(h => isSafeAsset(classify(h.name)));
              const badgeColor = status === 'good' ? 'var(--color-profit)' : status === 'over' ? 'var(--color-warning)' : 'var(--color-loss)';
              const barColor   = status === 'good' ? 'var(--color-profit)' : status === 'over' ? 'var(--color-warning)' : 'var(--color-loss)';
              const borderColor = status === 'good'
                ? 'color-mix(in srgb, var(--color-profit) 25%, var(--border-primary))'
                : status === 'over'
                ? 'color-mix(in srgb, var(--color-warning) 35%, var(--border-primary))'
                : 'color-mix(in srgb, var(--color-loss) 40%, var(--border-primary))';
              const badgeLabel = status === 'good' ? '✓ 적정' : status === 'over' ? '▲ 초과' : '⚠ 미달';
              return (
                <div key={acc.id} style={{
                  background: 'var(--bg-secondary)', borderRadius: 12, padding: '14px 16px',
                  border: `1px solid ${borderColor}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                        {acc.alias || acc.institution}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 6 }}>{acc.ownerName} · {acc.accountType}</span>
                    </div>
                    <span style={{
                      fontSize: 13, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      background: `color-mix(in srgb, ${badgeColor} 15%, transparent)`,
                      color: badgeColor,
                    }}>
                      {safePct.toFixed(1)}% {badgeLabel}
                    </span>
                  </div>
                  {/* 안전자산 비중 바 */}
                  <div style={{ position: 'relative', marginBottom: 8 }}>
                    <div style={{ height: 10, borderRadius: 5, background: 'var(--bg-tertiary)', overflow: 'visible', position: 'relative' }}>
                      <div style={{
                        height: '100%', borderRadius: 5,
                        width: `${Math.min(safePct, 100)}%`,
                        background: barColor,
                        transition: 'width 0.5s',
                      }} />
                      {/* 목표 구간 30~35% 마커 */}
                      <div style={{ position: 'absolute', top: -3, left: '30%', width: 2, height: 16, background: 'var(--color-profit)', borderRadius: 1 }} />
                      <div style={{ position: 'absolute', top: -3, left: '35%', width: 2, height: 16, background: 'var(--color-warning)', borderRadius: 1 }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--text-tertiary)' }}>
                      <span>안전자산 {fmtKrw(safeVal)} / 총 {fmtKrw(totalVal)}</span>
                      <span>
                        <span style={{ color: 'var(--color-profit)' }}>|30%</span>
                        <span style={{ color: 'var(--color-warning)', marginLeft: 4 }}>|35%</span>
                      </span>
                    </div>
                  </div>
                  {/* 안전자산 종목 */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {safeHoldings.map((h, i) => {
                      const val = hVal(h, prices);
                      const pct = totalVal > 0 ? (val / totalVal) * 100 : 0;
                      const cls = classify(h.name);
                      return (
                        <span key={i} style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 8,
                          background: `color-mix(in srgb, ${ASSET_COLORS[cls]} 15%, transparent)`,
                          color: ASSET_COLORS[cls],
                        }}>
                          {h.name} {pct.toFixed(1)}%
                        </span>
                      );
                    })}
                    {(acc.cash || 0) > 0 && (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'color-mix(in srgb, #C3E88D 15%, transparent)', color: '#C3E88D' }}>
                        현금 {((acc.cash! / totalVal) * 100).toFixed(1)}%
                      </span>
                    )}
                    {safeHoldings.length === 0 && (acc.cash || 0) === 0 && (
                      <span style={{ fontSize: 11, color: 'var(--color-loss)' }}>안전자산 없음 — 채권·금 추가 필요</span>
                    )}
                    {!ok && (
                      <span style={{ fontSize: 11, color: 'var(--color-loss)', fontWeight: 600 }}>
                        → 추가 필요: {fmtKrw(totalVal * 0.3 - safeVal)} ({(30 - safePct).toFixed(1)}%p)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── 고수익 유지 종목 ── */}
      {highReturnHoldings.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <MIcon name="trending_up" size={16} style={{ color: 'var(--color-profit)' }} />
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
              고수익 유지 종목 <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>— 수익률 40%↑, 통합·매도 시 신중 검토</span>
            </span>
          </div>
          <div style={{ borderRadius: 12, border: '1px solid var(--border-primary)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['종목', '계좌', '수익률', '계좌 내 비중', '비고'].map((h, i) => (
                    <th key={i} style={{
                      padding: '9px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
                      textAlign: i === 0 ? 'left' : 'right', background: 'var(--bg-secondary)',
                      borderBottom: '1px solid var(--border-primary)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {highReturnHoldings.map(({ acc, h, ret, pct }, i) => (
                  <tr key={i}>
                    <td style={{ padding: '10px 14px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {h.name}
                      {h.ticker && <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 4 }}>{h.ticker}</span>}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {acc.ownerName} · {acc.alias || acc.institution}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-profit)' }}>
                      +{ret.toFixed(1)}%
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {pct.toFixed(1)}%
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                        background: 'color-mix(in srgb, var(--color-profit) 15%, transparent)',
                        color: 'var(--color-profit)',
                      }}>유지 권장</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── 중복 종목 ── */}
      {filteredDuplicates.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <MIcon name="content_copy" size={16} style={{ color: 'var(--color-warning)' }} />
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
              중복 종목 — 한 계좌로 통합 검토
              {selectedAccKey !== 'all' && <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 8 }}>({selectedAccKey} 관련)</span>}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredDuplicates.map(d => {
              const totalVal = d.accounts.reduce((s, a) => s + a.val, 0);
              const best = [...d.accounts].sort((a, b) => b.val - a.val)[0];
              const isSafe = isSafeAsset(d.cls);
              // 퇴직 계좌에서 안전자산 이동 시 30% 위반 체크
              const safeWarnings = isSafe ? d.accounts
                .filter(a => {
                  if (!a.isRetirement) return false;
                  const acc = accounts.find(ac => (ac.alias || ac.institution) === a.accAlias);
                  if (!acc) return false;
                  const { safePct, safeVal, totalVal: tv } = calcSafeRatio(acc, prices);
                  const newPct = tv > 0 ? ((safeVal - a.val) / tv) * 100 : 0;
                  return newPct < 30;
                })
                .map(a => a.accAlias) : [];

              return (
                <div key={d.key} style={{
                  background: 'var(--bg-secondary)', borderRadius: 10, padding: '12px 16px',
                  border: `1px solid ${safeWarnings.length > 0 ? 'color-mix(in srgb, var(--color-loss) 30%, var(--border-primary))' : 'color-mix(in srgb, var(--color-warning) 25%, var(--border-primary))'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{d.name}</span>
                        <span style={{
                          fontSize: 10, padding: '1px 6px', borderRadius: 6,
                          background: `color-mix(in srgb, ${ASSET_COLORS[d.cls]} 15%, transparent)`,
                          color: ASSET_COLORS[d.cls],
                        }}>{d.cls}</span>
                        {isSafe && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: 'color-mix(in srgb, #C3E88D 15%, transparent)', color: '#C3E88D' }}>안전자산</span>}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {d.accounts.map((a, i) => {
                          const hasWarning = safeWarnings.includes(a.accAlias);
                          return (
                            <span key={i} style={{
                              fontSize: 11, padding: '2px 8px', borderRadius: 8,
                              background: hasWarning ? 'color-mix(in srgb, var(--color-loss) 15%, transparent)' : 'var(--bg-tertiary)',
                              color: hasWarning ? 'var(--color-loss)' : 'var(--text-secondary)',
                              fontWeight: hasWarning ? 700 : 400,
                            }}>
                              {hasWarning && '🔒 '}{a.owner} · {a.accAlias} {fmtKrw(a.val)}
                            </span>
                          );
                        })}
                      </div>
                      {safeWarnings.length > 0 && (
                        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--color-loss)', fontWeight: 600 }}>
                          ⚠ {safeWarnings.join(', ')} — 안전자산 이동 시 30% 룰 위반 가능. 보충 후 이동 권장
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, fontSize: 12, color: 'var(--color-warning)', fontWeight: 600 }}>
                      <MIcon name="arrow_forward" size={14} />
                      <span>→ <strong>{best.accAlias}</strong>({fmtKrw(totalVal)})으로 통합 추천</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── 유사 종목 그룹 ── */}
      {filteredSimilarGroups.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <MIcon name="group_work" size={16} style={{ color: 'var(--accent-blue)' }} />
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>유사 종목 그룹 — 하나로 통일 검토</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 8 }}>
            {filteredSimilarGroups.map(g => (
              <div key={g.label} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '12px 16px', border: `1px solid color-mix(in srgb, ${g.color} 20%, var(--border-primary))` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: g.color, marginBottom: 8 }}>{g.label}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {g.matched.map((m, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
                      <span>{m.accName} · {m.holdName}</span>
                      <span style={{ fontWeight: 600 }}>{fmtKrw(m.val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 계좌별 현황 ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MIcon name="account_balance_wallet" size={16} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>계좌별 종목 현황</span>
          </div>
          {selectedAccKey === 'all' && (
            <div style={{ display: 'flex', gap: 6 }}>
              {owners.map(o => (
                <button key={o.id} onClick={() => setOwnerFilter(o.id)} style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                  background: ownerFilter === o.id ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                  color: ownerFilter === o.id ? 'var(--accent-blue-fg)' : 'var(--text-secondary)',
                }}>{o.label}</button>
              ))}
            </div>
          )}
        </div>

        {/* 범례 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14, alignItems: 'center' }}>
          {(Object.entries(ASSET_COLORS) as [AssetClass, string][]).map(([cls, color]) => (
            <span key={cls} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
              {cls}{(cls === '채권' || cls === '금') ? ' (안전)' : cls === '커버드콜' ? ' (주식)' : ''}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredAccounts.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', borderRadius: 12 }}>해당 계좌가 없습니다.</div>
          ) : (
            filteredAccounts.map(acc => (
              <AccountCard key={acc.id} account={acc} prices={prices} isMobile={isMobile} duplicateNames={duplicateNames} />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
