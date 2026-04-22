import { useMemo } from "react";
import { useAppContext } from "../App";
import { holdingValue } from "../types";
import { MIcon } from "./MIcon";

function fmt(n: number) { return Math.round(n).toLocaleString('ko-KR'); }

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
        <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>
          보유종목
        </span>
        <span style={{
          fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)',
          background: 'var(--bg-secondary)', padding: '3px 10px', borderRadius: 20,
        }}>
          {holdingSummary.length}종목
        </span>
      </div>

      {/* Holdings List */}
      <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
        {holdingSummary.map((h, i) => {
          const currentPrice = h.ticker ? prices[h.ticker] : undefined;
          const dailyRate = h.ticker ? (prices[`${h.ticker}_rate`] ?? null) : null;
          const rateColor = dailyRate == null ? 'var(--text-secondary)' : dailyRate > 0 ? 'var(--color-profit)' : dailyRate < 0 ? 'var(--color-loss)' : 'var(--text-secondary)';

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
              {/* Left: name + owner */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 'var(--text-sm)', color: 'var(--text-primary)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {h.name}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {Array.from(h.owners).join(' · ')}
                  {h.isFund && <span style={{
                    marginLeft: 4, fontSize: 'var(--text-xs)', padding: '1px 5px', borderRadius: 4,
                    background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)',
                  }}>펀드</span>}
                </div>
              </div>

              {/* Right: 당일주가 + 당일등락률 */}
              <div style={{ textAlign: 'right', marginLeft: 8, flexShrink: 0 }}>
                {!h.isFund && currentPrice ? (
                  <>
                    <div className="toss-number" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                      {fmt(currentPrice)}원
                    </div>
                    <div className="toss-number" style={{ fontSize: 'var(--text-xs)', color: rateColor, marginTop: 2 }}>
                      {dailyRate != null ? `${dailyRate > 0 ? '+' : ''}${dailyRate.toFixed(2)}%` : '-'}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>펀드</div>
                )}
              </div>
            </div>
          );
        })}

        {holdingSummary.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
            보유종목이 없습니다
          </div>
        )}
      </div>
    </>
  );
}
