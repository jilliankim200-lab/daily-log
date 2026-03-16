import { useState, useEffect, useMemo } from "react";
import { useAppContext } from "../App";
import { fetchSnapshots, saveSnapshot } from "../api";
import { holdingValue } from "../types";
import type { DailySnapshot } from "../types";
import { fetchMarketData, selectMarketItems, type MarketIndexData } from "../utils/fetchMarketData";
import {
  TrendingUp,
  Coffee, Sunset, Moon, Wallet, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

function fmt(n: number) { return Math.round(n).toLocaleString('ko-KR'); }

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return { text: 'Good Morning', Icon: Coffee, color: 'var(--text-primary)' };
  if (h >= 12 && h < 18) return { text: 'Good Afternoon', Icon: Sunset, color: 'var(--text-primary)' };
  return { text: 'Good Evening', Icon: Moon, color: 'var(--text-primary)' };
}

export function NewDashboard() {
  const { accounts, isAmountHidden, otherAssets, prices } = useAppContext();
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [marketData, setMarketData] = useState<MarketIndexData[]>([]);

  useEffect(() => { fetchSnapshots().then(s => setSnapshots(s.filter(Boolean))); }, []);

  useEffect(() => {
    fetchMarketData().then(setMarketData).catch(console.error);
    const timer = setInterval(() => {
      fetchMarketData().then(setMarketData).catch(console.error);
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  const calcHoldings = (accs: typeof accounts) =>
    accs.reduce((s, a) => s + (a.cash || 0) + a.holdings.reduce((ss, h) => ss + holdingValue(h, prices[h.ticker]), 0), 0);

  const wifeHoldings = calcHoldings(accounts.filter(a => a.owner === 'wife'));
  const husbandHoldings = calcHoldings(accounts.filter(a => a.owner === 'husband'));
  const wifeOther = otherAssets.filter(a => a.owner === 'wife').reduce((s, a) => s + a.amount, 0);
  const husbandOther = otherAssets.filter(a => a.owner === 'husband').reduce((s, a) => s + a.amount, 0);
  const otherTotal = otherAssets.reduce((s, a) => s + a.amount, 0);

  const totalAsset = calcHoldings(accounts) + otherTotal;
  const wifeTotal = wifeHoldings + wifeOther;
  const husbandTotal = husbandHoldings + husbandOther;

  // 자동 스냅샷: 10시, 16시에 자동 저장
  useEffect(() => {
    if (accounts.length === 0 || totalAsset === 0) return;

    const AUTO_SNAP_KEY = 'auto_snapshot_last';
    const tryAutoSave = async () => {
      const now = new Date();
      const hour = now.getHours();
      const todayStr = now.toISOString().slice(0, 10);
      // 10시(10:00~10:59) 또는 16시(16:00~16:59)에만 저장
      if (hour !== 10 && hour !== 16) return;

      const slotKey = `${todayStr}_${hour}`;
      const lastSaved = localStorage.getItem(AUTO_SNAP_KEY);
      if (lastSaved === slotKey) return; // 이미 이 슬롯에 저장됨

      const prevSnaps = JSON.parse(localStorage.getItem('asset_snapshots') || '[]') as DailySnapshot[];
      const prev = prevSnaps.find(s => s && s.date && s.date < todayStr);
      const change = prev ? totalAsset - prev.totalAsset : 0;
      const rate = prev && prev.totalAsset > 0 ? (change / prev.totalAsset) * 100 : 0;

      const snap: DailySnapshot = {
        date: todayStr,
        totalAsset,
        wifeAsset: wifeTotal,
        husbandAsset: husbandTotal,
        assetChange: change,
        changeRate: rate,
      };
      await saveSnapshot(snap);
      localStorage.setItem(AUTO_SNAP_KEY, slotKey);
      const updated = await fetchSnapshots();
      setSnapshots(updated.filter(Boolean));
      console.log(`[자동 스냅샷] ${todayStr} ${hour}시 저장 완료`);
    };

    // 즉시 체크 + 1분마다 체크
    tryAutoSave();
    const timer = setInterval(tryAutoSave, 60_000);
    return () => clearInterval(timer);
  }, [totalAsset, wifeTotal, husbandTotal, accounts.length]);

  // 스냅샷 기반 증감 계산
  const today = new Date().toISOString().slice(0, 10);
  const todaySnap = snapshots.find(s => s.date === today);
  const latestSnap = snapshots[0];
  const prevSnap = snapshots[1];

  const dailyChange = latestSnap && prevSnap ? latestSnap.totalAsset - prevSnap.totalAsset : 0;
  const dailyRate = prevSnap && prevSnap.totalAsset > 0 ? (dailyChange / prevSnap.totalAsset) * 100 : 0;

  // 월간/연간 증감
  const thisMonth = today.slice(0, 7);
  const monthStart = snapshots.filter(s => s.date.startsWith(thisMonth)).pop();
  const monthlyChange = monthStart ? totalAsset - monthStart.totalAsset : 0;

  const thisYear = today.slice(0, 4);
  const yearStart = snapshots.filter(s => s.date.startsWith(thisYear)).pop();
  const yearlyChange = yearStart ? totalAsset - yearStart.totalAsset : 0;

  const handleSaveSnapshot = async () => {
    setSavingSnapshot(true);
    try {
      const snap: DailySnapshot = {
        date: today,
        totalAsset,
        wifeAsset: wifeTotal,
        husbandAsset: husbandTotal,
        assetChange: dailyChange,
        changeRate: dailyRate,
      };
      await saveSnapshot(snap);
      const updated = await fetchSnapshots();
      setSnapshots(updated);
    } catch (err) {
      console.error('스냅샷 저장 실패:', err);
    } finally {
      setSavingSnapshot(false);
    }
  };

  const greeting = getGreeting();
  const GreetingIcon = greeting.Icon;
  const hide = (v: string) => isAmountHidden ? '••••' : v;

  if (accounts.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <Wallet style={{ width: 48, height: 48, margin: '0 auto 16px', color: 'var(--text-disabled)' }} />
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', marginBottom: 8 }}>
            계좌 데이터가 없습니다
          </h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
            "부부 계좌" 메뉴에서 계좌와 종목을 먼저 등록해주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <GreetingIcon style={{ width: 20, height: 20, color: greeting.color }} />
          </div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' }}>
            {greeting.text}
          </h1>
        </div>
        <div />
      </div>

      {/* 통합 티커 바: 시장 지표 + 자산 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        padding: '12px 0', marginBottom: 24,
        borderBottom: '1px solid var(--border-primary)',
      }}>
        {(() => {
          // 시장 지표 항목
          const marketItems = selectMarketItems(marketData).map(item => {
            const isUp = item.direction === 'RISING';
            const isDown = item.direction === 'FALLING';
            return {
              label: item.name,
              displayValue: item.code === 'FX_USDKRW' ? item.price.toFixed(2) : item.price.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
              subValue: `${item.change > 0 ? '+' : ''}${item.code === 'FX_USDKRW' ? item.change.toFixed(1) : item.change.toFixed(2)} (${item.changeRate > 0 ? '+' : ''}${item.changeRate.toFixed(2)}%)`,
              color: isUp ? 'var(--color-profit)' : isDown ? 'var(--color-loss)' : 'var(--text-secondary)',
              sparkColor: isUp ? 'var(--color-profit)' : isDown ? 'var(--color-loss)' : 'var(--text-secondary)',
              trend: isUp ? 0.4 : isDown ? -0.4 : 0,
              isMarket: true,
              valueColor: 'var(--text-primary)',
            };
          });
          // 자산 항목
          const assetItems = [
            { label: '총 자산', value: totalAsset, isTotal: true },
            { label: `${new Date().getFullYear()}년`, value: yearlyChange },
            {
              label: (() => { const t = new Date(); const days = ['일','월','화','수','목','금','토']; return `${t.getMonth()+1}/${t.getDate()} ${days[t.getDay()]}`; })(),
              value: dailyChange,
            },
            { label: `${new Date().getMonth()+1}월`, value: monthlyChange },
          ].map(item => {
            const isPositive = item.value > 0;
            const isNegative = item.value < 0;
            const changeColor = isPositive ? 'var(--color-profit)' : isNegative ? 'var(--color-loss)' : 'var(--text-secondary)';
            const pct = item.isTotal ? null
              : item.label.includes('년') && yearStart ? ((item.value / yearStart.totalAsset) * 100)
              : item.label.includes('월') && monthStart ? ((item.value / monthStart.totalAsset) * 100)
              : prevSnap ? ((item.value / prevSnap.totalAsset) * 100)
              : null;
            return {
              label: item.label,
              displayValue: hide(item.isTotal ? fmt(item.value) : `${isPositive ? '+' : ''}${fmt(item.value)}`),
              subValue: !item.isTotal && pct !== null ? hide(`${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`) : null,
              color: changeColor,
              sparkColor: item.isTotal ? 'var(--text-quaternary)' : isPositive ? 'var(--color-profit)' : isNegative ? 'var(--color-loss)' : 'var(--text-quaternary)',
              trend: item.isTotal ? 0.3 : isPositive ? 0.5 : isNegative ? -0.5 : 0,
              isMarket: false,
              valueColor: item.isTotal ? 'var(--text-primary)' : changeColor,
              fontSize: item.isTotal ? 16 : 13,
            };
          });

          const allItems = [...marketItems, ...assetItems];

          return allItems.map((item, i) => {
            const sparkPoints = (() => {
              const pts: number[] = [];
              let v = 20;
              for (let j = 0; j < 16; j++) {
                v += item.trend + (Math.sin(j * 1.3 + i * 5) * 2.5) + (Math.cos(j * 0.7 + i * 3) * 1.5);
                v = Math.max(4, Math.min(36, v));
                pts.push(v);
              }
              return pts.map((y, x) => `${x * (40 / 15)},${40 - y}`).join(' ');
            })();
            const isSep = item.isMarket && i === marketItems.length - 1;

            return (
              <div key={i} style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                padding: '0 12px',
                borderRight: i < allItems.length - 1 ? `1px solid var(${isSep ? '--border-primary' : '--border-secondary'})` : 'none',
              }}>
                <svg width="40" height="32" viewBox="0 0 40 40" style={{ flexShrink: 0 }}>
                  <defs>
                    <linearGradient id={`tGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={item.sparkColor} stopOpacity="0.25" />
                      <stop offset="100%" stopColor={item.sparkColor} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polygon points={`0,40 ${sparkPoints} 40,40`} fill={`url(#tGrad${i})`} />
                  <polyline points={sparkPoints} fill="none" stroke={item.sparkColor}
                    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 1, whiteSpace: 'nowrap' }}>
                    {item.label}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span className="toss-number" style={{
                      fontSize: (item as any).fontSize || 13, fontWeight: 600,
                      color: item.valueColor, whiteSpace: 'nowrap',
                    }}>
                      {item.displayValue}
                    </span>
                    {item.subValue && (
                      <span className="toss-number" style={{ fontSize: 10, color: item.color, whiteSpace: 'nowrap' }}>
                        {item.subValue}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          });
        })()}
      </div>

      {/* 자산 증감 상세 내역 */}
      <div style={{ marginBottom: 24 }}>
          <div>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp style={{ width: 14, height: 14, color: 'var(--text-primary)' }} />
                </div>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)' }}>
                  자산 증감 상세 내역
                </span>
              </div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '4px 10px', borderRadius: 20 }}>
                최근 {Math.min(snapshots.length, 14)}일
              </span>
            </div>

            {snapshots.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center' }}>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                  스냅샷 데이터가 없습니다. "오늘 스냅샷 저장" 버튼을 눌러 기록을 시작하세요.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="toss-table">
                  <thead>
                    <tr>
                      <th>날짜</th>
                      <th style={{ textAlign: 'right' }}>총 자산</th>
                      <th style={{ textAlign: 'right' }}>자산 증감</th>
                      <th style={{ textAlign: 'right' }}>증감률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.slice(0, 14).map((snap, i) => {
                      const prev = snapshots[i + 1];
                      const change = prev ? snap.totalAsset - prev.totalAsset : snap.assetChange;
                      const rate = prev && prev.totalAsset > 0 ? (change / prev.totalAsset) * 100 : snap.changeRate;
                      return (
                        <tr key={snap.date}>
                          <td style={{ fontWeight: 'var(--font-medium)' }}>{snap.date}</td>
                          <td className="toss-number" style={{ textAlign: 'right' }}>
                            {hide(`${fmt(snap.totalAsset)}원`)}
                          </td>
                          <td className="toss-number" style={{
                            textAlign: 'right', fontWeight: 'var(--font-semibold)',
                            color: change > 0 ? 'var(--color-profit)' : change < 0 ? 'var(--color-loss)' : 'var(--text-primary)',
                          }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                              {change > 0 && <ArrowUpRight style={{ width: 12, height: 12 }} />}
                              {change < 0 && <ArrowDownRight style={{ width: 12, height: 12 }} />}
                              {hide(`${change > 0 ? '+' : ''}${fmt(change)}원`)}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span style={{
                              display: 'inline-flex', padding: '2px 8px', borderRadius: 20,
                              fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)',
                              background: rate > 0 ? 'var(--color-profit-bg)' : rate < 0 ? 'var(--color-loss-bg)' : 'var(--bg-secondary)',
                              color: rate > 0 ? 'var(--color-profit)' : rate < 0 ? 'var(--color-loss)' : 'var(--text-secondary)',
                            }}>
                              {isAmountHidden ? '••••' : `${rate > 0 ? '+' : ''}${rate.toFixed(2)}%`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
      </div>

      {/* 소유자별 요약 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        <OwnerSummary
          label="지윤"
          emoji="👩"
          accounts={accounts.filter(a => a.owner === 'wife')}
          total={wifeTotal}
          grandTotal={totalAsset}
          isHidden={isAmountHidden}
        />
        <OwnerSummary
          label="오빠"
          emoji="👨"
          accounts={accounts.filter(a => a.owner === 'husband')}
          total={husbandTotal}
          grandTotal={totalAsset}
          isHidden={isAmountHidden}
        />
      </div>
    </div>
  );
}

/* ── Sub-components ── */


function OwnerSummary({ label, emoji, accounts, total, grandTotal, isHidden }: {
  label: string; emoji: string; accounts: { alias: string; holdings: { avgPrice: number; quantity: number }[] }[];
  total: number; grandTotal: number; isHidden: boolean;
}) {
  const hide = (v: string) => isHidden ? '••••' : v;
  return (
    <div className="toss-card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>{emoji}</span>
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' }}>{label}</span>
        </div>
        <span className="toss-number" style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' }}>
          {hide(`${fmt(total)}원`)}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {accounts.map(a => {
          const accTotal = (a.cash || 0) + a.holdings.reduce((s, h) => s + (h.isFund ? (h.amount || 0) : h.avgPrice * h.quantity), 0);
          const pct = grandTotal > 0 ? (accTotal / grandTotal) * 100 : 0;
          return (
            <div key={a.alias} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 12px', borderRadius: 8, background: 'var(--bg-secondary)',
            }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{a.alias}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="toss-number" style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)' }}>
                  {hide(`${fmt(accTotal)}원`)}
                </span>
                <span className="toss-number" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', minWidth: 40, textAlign: 'right' }}>
                  {isHidden ? '••••' : `${pct.toFixed(1)}%`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
