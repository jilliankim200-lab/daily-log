import { useMemo } from "react";
import { useAppContext } from "../App";
import { holdingValue } from "../types";

function fmt(n: number) { return Math.round(n).toLocaleString('ko-KR'); }

function MIcon({ name, size = 20, style }: { name: string; size?: number; style?: React.CSSProperties }) {
  return (
    <span className="material-symbols-rounded" style={{
      fontSize: size, lineHeight: 1, ...style,
    }}>{name}</span>
  );
}

export function RightSidebar() {
  const { accounts, isAmountHidden, prices, navigateTo } = useAppContext();

  const holdingSummary = useMemo(() => {
    const map = new Map<string, {
      name: string; ticker: string; totalQty: number;
      totalCost: number; totalCurrent: number; owners: Set<string>;
      isFund?: boolean; amount?: number;
    }>();
    accounts.forEach(a => a.holdings.forEach(h => {
      const key = h.ticker || h.name;
      const currentVal = holdingValue(h, prices[h.ticker]);
      const costVal = h.isFund ? (h.amount || 0) : h.avgPrice * h.quantity;
      const existing = map.get(key);
      if (existing) {
        existing.totalCurrent += currentVal;
        existing.totalCost += costVal;
        existing.totalQty += h.quantity;
        existing.owners.add(a.ownerName);
      } else {
        map.set(key, {
          name: h.name, ticker: h.ticker,
          totalQty: h.quantity, totalCost: costVal,
          totalCurrent: currentVal, owners: new Set([a.ownerName]),
          isFund: h.isFund, amount: h.amount,
        });
      }
    }));
    return Array.from(map.values()).sort((a, b) => b.totalCurrent - a.totalCurrent);
  }, [accounts, prices]);

  const hide = (v: string) => isAmountHidden ? '••••' : v;

  return (
    <>
      {/* Header */}
      <div
        onClick={() => navigateTo('holdings')}
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', transition: 'background 0.1s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
          보유종목
        </span>
        <span style={{
          fontSize: 12, color: 'var(--text-tertiary)',
          background: 'var(--bg-secondary)', padding: '3px 10px', borderRadius: 20,
        }}>
          {holdingSummary.length}종목
        </span>
      </div>

      {/* Holdings List */}
      <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
        {holdingSummary.map((h, i) => {
          const pnl = h.totalCurrent - h.totalCost;
          const pnlRate = h.totalCost > 0 ? (pnl / h.totalCost) * 100 : 0;
          const currentPrice = h.ticker ? prices[h.ticker] : undefined;
          const pnlColor = pnl > 0 ? 'var(--color-profit)' : pnl < 0 ? 'var(--color-loss)' : 'var(--text-secondary)';

          return (
            <div
              key={`${h.ticker}-${i}`}
              style={{
                padding: '12px 20px',
                borderBottom: '1px solid var(--border-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              onClick={() => navigateTo('holdings')}
            >
              {/* Left: icon + name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {h.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {Array.from(h.owners).join(' · ')}
                  {h.isFund && <span style={{
                    marginLeft: 4, fontSize: 10, padding: '1px 5px', borderRadius: 4,
                    background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)',
                  }}>펀드</span>}
                </div>
              </div>

              {/* Right: price + change */}
              <div style={{ textAlign: 'right', marginLeft: 8, flexShrink: 0 }}>
                <div className="toss-number" style={{
                  fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
                }}>
                  {hide(`${fmt(h.totalCurrent)}원`)}
                </div>
                {!h.isFund && currentPrice ? (
                  <div className="toss-number" style={{
                    fontSize: 11, color: pnlColor, marginTop: 2,
                  }}>
                    {hide(`${pnl > 0 ? '+' : ''}${fmt(pnl)}원 (${pnlRate > 0 ? '+' : ''}${pnlRate.toFixed(1)}%)`)}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {hide(`${fmt(h.totalQty)}주`)}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {holdingSummary.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
            보유종목이 없습니다
          </div>
        )}
      </div>
    </>
  );
}
