import { useState, useEffect } from 'react';
import { useAppContext } from '../App';
import { fetchCurrentPrices } from '../utils/fetchPrices';
import { MIcon } from './MIcon';
import type { Account, Holding } from '../types';

interface AccountDetail {
  alias: string;
  quantity: number;
  avgPrice: number;
}

interface MergedHolding {
  name: string;
  ticker: string;
  avgPrice: number;
  quantity: number;
  totalCost: number;
  accounts: string[];
  accountDetails: AccountDetail[];
  isFund?: boolean;
  amount?: number;
}

function mergeHoldings(accounts: Account[]): MergedHolding[] {
  const map = new Map<string, MergedHolding>();
  for (const acc of accounts) {
    for (const h of acc.holdings) {
      if (h.isFund) {
        // 펀드는 합산하지 않고 개별 표시
        const key = `fund_${h.name}_${acc.alias}`;
        map.set(key, {
          name: h.name, ticker: '', avgPrice: 0, quantity: 0,
          totalCost: h.amount || 0, accounts: [acc.alias], accountDetails: [],
          isFund: true, amount: h.amount,
        });
        continue;
      }
      const key = `${h.ticker}_${h.name}`;
      const existing = map.get(key);
      if (existing) {
        const newTotalCost = existing.totalCost + h.avgPrice * h.quantity;
        const newQty = existing.quantity + h.quantity;
        existing.avgPrice = newQty > 0 ? Math.round(newTotalCost / newQty) : 0;
        existing.quantity = newQty;
        existing.totalCost = newTotalCost;
        if (!existing.accounts.includes(acc.alias)) existing.accounts.push(acc.alias);
        existing.accountDetails.push({ alias: acc.alias, quantity: h.quantity, avgPrice: h.avgPrice });
      } else {
        map.set(key, {
          name: h.name, ticker: h.ticker, avgPrice: h.avgPrice,
          quantity: h.quantity, totalCost: h.avgPrice * h.quantity,
          accounts: [acc.alias],
          accountDetails: [{ alias: acc.alias, quantity: h.quantity, avgPrice: h.avgPrice }],
        });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalCost - a.totalCost);
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ko-KR');
}

function getSignal(avgPrice: number, currentPrice: number | undefined): 'buy' | 'sell' | 'hold' | 'none' {
  if (!currentPrice || currentPrice <= 0) return 'none';
  const changeRate = ((currentPrice - avgPrice) / avgPrice) * 100;
  if (changeRate <= -3) return 'buy';
  if (changeRate >= 10) return 'sell';
  return 'hold';
}

function SignalBadge({ signal, noIcon }: { signal: 'buy' | 'sell' | 'hold' | 'none'; noIcon?: boolean }) {
  if (signal === 'none') return <span style={{ color: 'var(--text-quaternary)', fontSize: 12 }}>—</span>;

  const config = {
    buy:  { label: '매수', color: 'var(--color-loss)',    icon: 'trending_up'   },
    sell: { label: '매도', color: 'var(--color-profit)',  icon: 'trending_down' },
    hold: { label: '보유', color: 'var(--text-tertiary)', icon: 'remove'        },
  };
  const c = config[signal];

  return (
    <span className={`signal-badge signal-badge-${signal}`} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
      padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600,
      background: `color-mix(in srgb, ${c.color} 12%, transparent)`,
      color: c.color,
    }}>
      {!noIcon && <MIcon name={c.icon} size={12} />}
      {c.label}
    </span>
  );
}

function HoldingInfoPopup({ accountDetails, isFund, isAmountHidden, currentPrice }: {
  accountDetails: AccountDetail[]; isFund?: boolean; isAmountHidden?: boolean; currentPrice?: number;
}) {
  const [open, setOpen] = useState(false);
  const multiAccount = accountDetails.length > 1;

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(!open); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-quaternary)', display: 'inline-flex', alignItems: 'center' }}
      >
        <MIcon name="info" size={14} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: 4,
            background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
            borderRadius: 10, padding: '12px 16px', minWidth: multiAccount ? 260 : 180,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>계좌별 상세</span>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-tertiary)' }}>
                <MIcon name="close" size={12} />
              </button>
            </div>
            {!isFund && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {accountDetails.map((d, i) => {
                  const signal = getSignal(d.avgPrice, currentPrice);
                  const pnlRate = currentPrice && d.avgPrice > 0 ? ((currentPrice - d.avgPrice) / d.avgPrice) * 100 : null;
                  const signalConfig = {
                    buy:  { label: '매수', color: 'var(--color-loss)'    },
                    sell: { label: '매도', color: 'var(--color-profit)'  },
                    hold: { label: '보유', color: 'var(--text-tertiary)' },
                    none: { label: '—',   color: 'var(--text-quaternary)' },
                  }[signal];
                  return (
                    <div key={i} style={{
                      padding: '8px 10px', borderRadius: 8,
                      background: 'var(--bg-secondary)',
                      border: multiAccount && signal === 'sell' ? '1px solid rgba(255,69,58,0.3)' : '1px solid transparent',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{d.alias}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: signalConfig.color }}>{signalConfig.label}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>
                        <span>수량 <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{d.quantity.toLocaleString('ko-KR')}</span></span>
                        <span>평단 <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                          {isAmountHidden ? '••••' : `${Math.round(d.avgPrice).toLocaleString('ko-KR')}원`}
                        </span></span>
                        {pnlRate !== null && (
                          <span style={{ color: pnlRate > 0 ? 'var(--color-gain)' : pnlRate < 0 ? 'var(--color-loss)' : 'var(--text-secondary)', fontWeight: 600 }}>
                            {pnlRate > 0 ? '+' : ''}{pnlRate.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </span>
  );
}

function OwnerSection({
  ownerName,
  accounts,
  prices,
  isAmountHidden,
  isMobile,
}: {
  ownerName: string;
  accounts: Account[];
  prices: Record<string, number>;
  isAmountHidden: boolean;
  isMobile?: boolean;
}) {
  const [signalFilter, setSignalFilter] = useState<'all' | 'buy' | 'sell'>('all');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const allHoldings = mergeHoldings(accounts);
  const totalCost = allHoldings.reduce((s, h) => s + h.totalCost, 0);
  const totalCurrent = allHoldings.reduce((s, h) => {
    if (h.isFund) return s + (h.amount || 0);
    const cp = prices[h.ticker];
    return s + (cp ? cp * h.quantity : h.totalCost);
  }, 0);
  const totalPnl = totalCurrent - totalCost;
  const totalPnlRate = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const buyCount = allHoldings.filter(h => !h.isFund && getSignal(h.avgPrice, prices[h.ticker]) === 'buy').length;
  const sellCount = allHoldings.filter(h => !h.isFund && getSignal(h.avgPrice, prices[h.ticker]) === 'sell').length;

  // filter by signal
  const filtered = signalFilter === 'all' ? allHoldings : allHoldings.filter(h => {
    if (h.isFund) return false;
    return getSignal(h.avgPrice, prices[h.ticker]) === signalFilter;
  });

  // sort
  const holdings = [...filtered].sort((a, b) => {
    if (!sortKey) return 0;
    let av = 0, bv = 0;
    const cpA = prices[a.ticker], cpB = prices[b.ticker];
    switch (sortKey) {
      case '현재가': av = cpA || 0; bv = cpB || 0; break;
      case '등락률': av = cpA && a.avgPrice ? ((cpA - a.avgPrice) / a.avgPrice) * 100 : 0; bv = cpB && b.avgPrice ? ((cpB - b.avgPrice) / b.avgPrice) * 100 : 0; break;
      case '수량': av = a.quantity; bv = b.quantity; break;
      case '매입금액': av = a.totalCost; bv = b.totalCost; break;
      case '평가금액': av = cpA ? cpA * a.quantity : a.totalCost; bv = cpB ? cpB * b.quantity : b.totalCost; break;
      case '수익금': av = (cpA ? cpA * a.quantity : a.totalCost) - a.totalCost; bv = (cpB ? cpB * b.quantity : b.totalCost) - b.totalCost; break;
      default: return 0;
    }
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === 'desc') setSortDir('asc');
      else { setSortKey(null); setSortDir('desc'); }
    } else {
      setSortKey(key); setSortDir('desc');
    }
  };

  return (
    <div style={{
      background: 'var(--bg-primary)', borderRadius: 16,
      border: '1px solid var(--border-primary)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: isMobile ? '14px 16px' : '20px 24px',
        display: 'flex', alignItems: isMobile ? 'flex-start' : 'center',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 10 : 0,
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-primary)',
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            {ownerName}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
            {allHoldings.length}개 종목 · {accounts.length}개 계좌
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {(['all', 'buy', 'sell'] as const).map(f => {
            const label = f === 'all' ? `전체 ${allHoldings.length}` : f === 'buy' ? `매수 ${buyCount}` : `매도 ${sellCount}`;
            const isActive = signalFilter === f;
            const colors = f === 'buy'
              ? { bg: 'color-mix(in srgb, var(--color-loss) 12%, transparent)', color: 'var(--color-loss)', activeBg: 'var(--color-loss)', activeFg: '#fff' }
              : f === 'sell'
              ? { bg: 'color-mix(in srgb, var(--color-profit) 12%, transparent)', color: 'var(--color-profit)', activeBg: 'var(--color-profit)', activeFg: '#fff' }
              : { bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)', activeBg: 'var(--accent-blue)', activeFg: 'var(--accent-blue-fg)' };
            return (
              <button
                key={f}
                onClick={() => setSignalFilter(signalFilter === f ? 'all' : f)}
                style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: isActive ? colors.activeBg : colors.bg,
                  color: isActive ? colors.activeFg : colors.color,
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div style={{
        padding: isMobile ? '12px 16px' : '16px 24px',
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, auto)',
        gap: isMobile ? 12 : 32,
        borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-secondary)',
      }}>
        {[
          { label: '매입금액', value: isAmountHidden ? '••••••' : `${fmt(totalCost)}원`, color: 'var(--text-primary)' },
          { label: '평가금액', value: isAmountHidden ? '••••••' : `${fmt(totalCurrent)}원`, color: 'var(--text-primary)' },
          { label: '수익금', value: isAmountHidden ? '••••••' : `${totalPnl > 0 ? '+' : ''}${fmt(totalPnl)}원`, color: totalPnl > 0 ? 'var(--color-gain)' : totalPnl < 0 ? 'var(--color-loss)' : 'var(--text-primary)' },
          { label: '수익률', value: `${totalPnlRate > 0 ? '+' : ''}${totalPnlRate.toFixed(2)}%`, color: totalPnlRate > 0 ? 'var(--color-gain)' : totalPnlRate < 0 ? 'var(--color-loss)' : 'var(--text-primary)' },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
            <div className="toss-number" style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Mobile card list */}
      {isMobile && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {holdings.map((h, i) => {
            if (h.isFund) {
              return (
                <div key={`fund-${h.name}-${i}`} style={{
                  padding: '14px 16px', borderBottom: '1px solid var(--border-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{h.name}</span>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>펀드</span>
                  </div>
                  <span className="toss-number" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    {isAmountHidden ? '••••••' : `${fmt(h.amount || 0)}원`}
                  </span>
                </div>
              );
            }
            const cp = prices[h.ticker];
            const evalAmount = cp ? cp * h.quantity : h.totalCost;
            const pnl = evalAmount - h.totalCost;
            const pnlRate = h.totalCost > 0 ? ((evalAmount - h.totalCost) / h.totalCost) * 100 : 0;
            const changeRate = cp ? ((cp - h.avgPrice) / h.avgPrice) * 100 : 0;
            const signal = getSignal(h.avgPrice, cp);
            const pnlColor = pnl > 0 ? 'var(--color-gain)' : pnl < 0 ? 'var(--color-loss)' : 'var(--text-primary)';
            const sellAccounts = h.accountDetails.filter(d => getSignal(d.avgPrice, cp) === 'sell').map(d => d.alias);
            return (
              <div key={`${h.ticker}-${h.name}-${i}`} style={{
                padding: '14px 16px', borderBottom: '1px solid var(--border-primary)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  {/* 좌: 뱃지 → 종목명 → 티커 수직 배열 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <SignalBadge signal={signal} noIcon />
                      {sellAccounts.length > 0 && (
                        <span style={{ fontSize: 10, color: 'var(--color-profit)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {sellAccounts.join('·')}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
                      <HoldingInfoPopup accountDetails={h.accountDetails} isAmountHidden={isAmountHidden} currentPrice={cp} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>{h.ticker}</div>
                  </div>
                  {/* 우: 금액 + 수익률 */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="toss-number" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      {isAmountHidden ? '••••••' : `${fmt(evalAmount)}원`}
                    </div>
                    <div className="toss-number" style={{ fontSize: 12, fontWeight: 600, color: pnlColor, marginTop: 2, whiteSpace: 'nowrap' }}>
                      {isAmountHidden ? '••••' : `${pnlRate > 0 ? '+' : ''}${pnlRate.toFixed(2)}%`}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-tertiary)' }}>
                  <span>현재가 <span className="toss-number" style={{ color: cp ? (changeRate > 0 ? 'var(--color-gain)' : changeRate < 0 ? 'var(--color-loss)' : 'var(--text-secondary)') : 'var(--text-quaternary)', fontWeight: 600 }}>
                    {cp ? `${fmt(cp)}` : '—'}{cp && changeRate !== 0 ? ` (${changeRate > 0 ? '+' : ''}${changeRate.toFixed(2)}%)` : ''}
                  </span></span>
                  <span>수량 <span className="toss-number" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{fmt(h.quantity)}</span></span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Desktop Table */}
      {!isMobile && <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
              {['신호', '종목명', '현재가', '등락률', '수량', '매입금액', '평가금액', '수익금'].map(col => {
                const sortable = !['신호', '종목명'].includes(col);
                return (
                  <th
                    key={col}
                    onClick={sortable ? () => toggleSort(col) : undefined}
                    style={{
                      padding: '12px 16px', textAlign: col === '종목명' ? 'left' : 'right',
                      fontSize: 12, fontWeight: 600, color: sortKey === col ? 'var(--accent-blue)' : 'var(--text-tertiary)',
                      whiteSpace: 'nowrap', cursor: sortable ? 'pointer' : 'default', userSelect: 'none',
                      ...(col === '신호' ? { textAlign: 'center', width: 70 } : {}),
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      {col}
                      {sortKey === col && (
                        sortDir === 'desc'
                          ? <MIcon name="expand_more" size={12} />
                          : <MIcon name="expand_less" size={12} />
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {holdings.map((h, i) => {
              if (h.isFund) {
                return (
                  <tr key={`fund-${h.name}-${i}`} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-quaternary)' }}>—</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {h.name}
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>펀드</span>
                        <HoldingInfoPopup accountDetails={h.accountDetails} isFund />
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-quaternary)' }}>-</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-quaternary)' }}>-</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-quaternary)' }}>-</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {isAmountHidden ? '••••••' : `${fmt(h.amount || 0)}원`}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {isAmountHidden ? '••••••' : `${fmt(h.amount || 0)}원`}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-quaternary)' }}>-</td>
                  </tr>
                );
              }

              const cp = prices[h.ticker];
              const evalAmount = cp ? cp * h.quantity : h.totalCost;
              const pnl = evalAmount - h.totalCost;
              const pnlRate = h.totalCost > 0 ? ((evalAmount - h.totalCost) / h.totalCost) * 100 : 0;
              const changeRate = cp ? ((cp - h.avgPrice) / h.avgPrice) * 100 : 0;
              const signal = getSignal(h.avgPrice, cp);
              const pnlColor = pnl > 0 ? 'var(--color-gain)' : pnl < 0 ? 'var(--color-loss)' : 'var(--text-primary)';
              const sellAccounts = h.accountDetails.filter(d => getSignal(d.avgPrice, cp) === 'sell').map(d => d.alias);

              return (
                <tr
                  key={`${h.ticker}-${h.name}-${i}`}
                  style={{
                    borderBottom: '1px solid var(--border-primary)',
                    background: 'transparent',
                  }}
                >
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <SignalBadge signal={signal} />
                      {sellAccounts.length > 0 && (
                        <span style={{ fontSize: 10, color: 'var(--color-profit)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {sellAccounts.join('·')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {h.name}
                      <HoldingInfoPopup accountDetails={h.accountDetails} isAmountHidden={isAmountHidden} currentPrice={cp} />
                    </div>
                    <a
                      href={`https://www.tossinvest.com/stocks/A${h.ticker}/order`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 11, color: 'var(--text-quaternary)', fontWeight: 400, marginTop: 2, display: 'inline-block', textDecoration: 'none' }}
                      onClick={(e) => e.stopPropagation()}
                    >{h.ticker}</a>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: cp ? 'var(--text-primary)' : 'var(--text-quaternary)' }}>
                    {cp ? (isAmountHidden ? '••••' : fmt(cp)) : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: changeRate > 0 ? 'var(--color-gain)' : changeRate < 0 ? 'var(--color-loss)' : 'var(--text-secondary)' }}>
                    {cp ? `${changeRate > 0 ? '+' : ''}${changeRate.toFixed(2)}%` : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {fmt(h.quantity)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {isAmountHidden ? '••••••' : `${fmt(h.totalCost)}원`}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {isAmountHidden ? '••••••' : `${fmt(evalAmount)}원`}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: pnlColor }}>
                    {isAmountHidden ? '••••' : (
                      <div>
                        <div>{pnl > 0 ? '+' : ''}{fmt(pnl)}원</div>
                        <div style={{ fontSize: 11, fontWeight: 400, marginTop: 1 }}>
                          {pnlRate > 0 ? '+' : ''}{pnlRate.toFixed(2)}%
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>}
    </div>
  );
}

export function Holdings() {
  const { accounts, isAmountHidden, isMobile } = useAppContext();
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const loadPrices = async () => {
    const allTickers = accounts.flatMap(a => a.holdings.map(h => h.ticker));
    if (allTickers.length === 0) return;
    setLoading(true);
    try {
      const p = await fetchCurrentPrices(allTickers);
      setPrices(p);
    } catch (err) {
      console.error('가격 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPrices(); }, [accounts]);

  const wifeAccounts = accounts.filter(a => a.owner === 'wife');
  const husbandAccounts = accounts.filter(a => a.owner === 'husband');

  return (
    <div style={{ padding: isMobile ? '16px' : '24px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: isMobile ? 16 : 28,
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            매수매도알림
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 6 }}>
            매입가 대비 3% 이상 하락 시 매수 신호, 10% 이상 상승 시 매도 신호
          </p>
        </div>
        <button
          onClick={loadPrices}
          disabled={loading}
          className="toss-btn toss-btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', padding: '6px 12px', opacity: loading ? 0.6 : 1 }}
        >
          <MIcon name="sync" size={14} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} />
          {!isMobile && (loading ? '조회 중...' : '현재가 새로고침')}
        </button>
      </div>

      {/* Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <OwnerSection
          ownerName="지윤"
          accounts={wifeAccounts}
          prices={prices}
          isAmountHidden={isAmountHidden}
          isMobile={isMobile}
        />
        <OwnerSection
          ownerName="오빠"
          accounts={husbandAccounts}
          prices={prices}
          isAmountHidden={isAmountHidden}
          isMobile={isMobile}
        />
      </div>
    </div>
  );
}
