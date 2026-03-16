import { useState, useEffect } from 'react';
import { useAppContext } from '../App';
import { fetchCurrentPrices } from '../utils/fetchPrices';
import { RefreshCw, TrendingDown, TrendingUp, Minus, Info, X, ChevronUp, ChevronDown } from 'lucide-react';
import type { Account, Holding } from '../types';

interface MergedHolding {
  name: string;
  ticker: string;
  avgPrice: number;
  quantity: number;
  totalCost: number;
  accounts: string[];
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
          totalCost: h.amount || 0, accounts: [acc.alias],
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
      } else {
        map.set(key, {
          name: h.name, ticker: h.ticker, avgPrice: h.avgPrice,
          quantity: h.quantity, totalCost: h.avgPrice * h.quantity,
          accounts: [acc.alias],
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

function SignalBadge({ signal }: { signal: 'buy' | 'sell' | 'hold' | 'none' }) {
  if (signal === 'none') return <span style={{ color: 'var(--text-quaternary)', fontSize: 12 }}>—</span>;

  const config = {
    buy: { label: '매수', bg: 'rgba(52, 199, 89, 0.15)', color: '#34c759', icon: TrendingDown },
    sell: { label: '매도', bg: 'rgba(255, 69, 58, 0.15)', color: '#ff453a', icon: TrendingUp },
    hold: { label: '보유', bg: 'rgba(142, 142, 147, 0.12)', color: 'var(--text-tertiary)', icon: Minus },
  };
  const c = config[signal];
  const Icon = c.icon;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
      padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
      background: c.bg, color: c.color,
    }}>
      <Icon style={{ width: 12, height: 12 }} />
      {c.label}
    </span>
  );
}

function HoldingInfoPopup({ accounts, avgPrice, isFund, isAmountHidden }: {
  accounts: string[]; avgPrice: number; isFund?: boolean; isAmountHidden?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(!open); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-quaternary)', display: 'inline-flex', alignItems: 'center' }}
      >
        <Info style={{ width: 14, height: 14 }} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: 4,
            background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
            borderRadius: 10, padding: '12px 16px', minWidth: 180,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>상세 정보</span>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-tertiary)' }}>
                <X style={{ width: 12, height: 12 }} />
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>계좌</span>
                <span style={{ fontWeight: 600 }}>{accounts.join(', ')}</span>
              </div>
              {!isFund && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>평단가</span>
                  <span style={{ fontWeight: 600 }}>{isAmountHidden ? '••••' : `${Math.round(avgPrice).toLocaleString('ko-KR')}원`}</span>
                </div>
              )}
            </div>
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
}: {
  ownerName: string;
  accounts: Account[];
  prices: Record<string, number>;
  isAmountHidden: boolean;
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
        padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
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
              ? { bg: 'rgba(52,199,89,0.15)', color: '#34c759', activeBg: '#34c759' }
              : f === 'sell'
              ? { bg: 'rgba(255,69,58,0.15)', color: '#ff453a', activeBg: '#ff453a' }
              : { bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)', activeBg: 'var(--text-secondary)' };
            return (
              <button
                key={f}
                onClick={() => setSignalFilter(signalFilter === f ? 'all' : f)}
                style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: isActive ? colors.activeBg : colors.bg,
                  color: isActive ? '#fff' : colors.color,
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
        padding: '16px 24px', display: 'flex', gap: 32,
        borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-secondary)',
      }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>매입금액</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            {isAmountHidden ? '••••••' : `${fmt(totalCost)}원`}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>평가금액</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            {isAmountHidden ? '••••••' : `${fmt(totalCurrent)}원`}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>수익금</div>
          <div style={{
            fontSize: 16, fontWeight: 700,
            color: totalPnl > 0 ? 'var(--color-gain)' : totalPnl < 0 ? 'var(--color-loss)' : 'var(--text-primary)',
          }}>
            {isAmountHidden ? '••••••' : `${totalPnl > 0 ? '+' : ''}${fmt(totalPnl)}원`}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>수익률</div>
          <div style={{
            fontSize: 16, fontWeight: 700,
            color: totalPnlRate > 0 ? 'var(--color-gain)' : totalPnlRate < 0 ? 'var(--color-loss)' : 'var(--text-primary)',
          }}>
            {totalPnlRate > 0 ? '+' : ''}{totalPnlRate.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
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
                          ? <ChevronDown style={{ width: 12, height: 12 }} />
                          : <ChevronUp style={{ width: 12, height: 12 }} />
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
                        <HoldingInfoPopup accounts={h.accounts} avgPrice={0} isFund />
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

              return (
                <tr
                  key={`${h.ticker}-${h.name}-${i}`}
                  style={{
                    borderBottom: '1px solid var(--border-primary)',
                    background: signal === 'buy' ? 'rgba(52, 199, 89, 0.04)' : signal === 'sell' ? 'rgba(255, 69, 58, 0.04)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <SignalBadge signal={signal} />
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {h.name}
                      <HoldingInfoPopup accounts={h.accounts} avgPrice={h.avgPrice} isAmountHidden={isAmountHidden} />
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
      </div>
    </div>
  );
}

export function Holdings() {
  const { accounts, isAmountHidden } = useAppContext();
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
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 28,
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            보유종목
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 6 }}>
            매입가 대비 3% 이상 하락 시 매수 신호, 10% 이상 상승 시 매도 신호
          </p>
        </div>
        <button
          onClick={loadPrices}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'var(--accent-blue)', color: '#fff', fontSize: 13, fontWeight: 600,
            opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s',
          }}
        >
          <RefreshCw style={{ width: 14, height: 14, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          현재가 새로고침
        </button>
      </div>

      {/* Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <OwnerSection
          ownerName="지윤"
          accounts={wifeAccounts}
          prices={prices}
          isAmountHidden={isAmountHidden}
        />
        <OwnerSection
          ownerName="오빠"
          accounts={husbandAccounts}
          prices={prices}
          isAmountHidden={isAmountHidden}
        />
      </div>
    </div>
  );
}
