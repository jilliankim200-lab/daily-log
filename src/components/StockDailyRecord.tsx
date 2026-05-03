import { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../App';
import { kvGet } from '../api';
import { MIcon } from './MIcon';
import type { Account, OtherAsset } from '../types';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://asset-dashboard-api.jilliankim200.workers.dev';

interface DayPrice {
  date: string;
  price: number;
}

interface OtherAssetSnapshot {
  date: string;
  assets: { id: string; name: string; owner: 'wife' | 'husband' | 'shared'; amount: number }[];
}

type OwnerFilter = 'all' | 'wife' | 'husband';

const OWNER_LABEL: Record<OwnerFilter, string> = { all: '전체', wife: '아내', husband: '남편' };

function fmt(n: number) {
  return n.toLocaleString('ko-KR');
}

function shortDate(d: string) {
  const [, m, day] = d.split('-');
  return `${parseInt(m)}/${parseInt(day)}`;
}

function dayOfWeek(d: string) {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[new Date(d).getDay()];
}

// 계좌별 종목 히스토리 테이블 컴포넌트
function AccountStockTable({
  account,
  histories,
  dates,
  isAmountHidden,
  isMobile,
}: {
  account: Account;
  histories: Record<string, DayPrice[]>;
  dates: string[];
  isAmountHidden: boolean;
  isMobile: boolean;
}) {
  const holdings = account.holdings.filter(
    h => !h.isFund && h.ticker && /^[0-9A-Z]{6}$/i.test(h.ticker)
  );

  if (holdings.length === 0) {
    return (
      <div style={{ color: 'var(--text-tertiary)', fontSize: 13, padding: '12px 0' }}>
        등록된 종목 없음
      </div>
    );
  }

  const cash = account.cash || 0;

  // 날짜별 계좌 합계 계산 (현금 포함)
  const dateTotals = dates.map(date => {
    let total = cash;
    for (const h of holdings) {
      const hist = histories[h.ticker] || [];
      const entry = hist.find(d => d.date === date);
      if (entry) total += entry.price * h.quantity;
    }
    return total;
  });

  // 모바일: 날짜별 수직 카드 레이아웃
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 12px 12px' }}>
        {[...dates].reverse().map((date, rdi) => {
          const di = dates.length - 1 - rdi;
          const total = dateTotals[di];
          const prevTotal = di > 0 ? dateTotals[di - 1] : null;
          const totalChange = prevTotal !== null ? total - prevTotal : null;
          const totalUp = totalChange !== null && totalChange > 0;
          const totalDown = totalChange !== null && totalChange < 0;
          return (
            <div key={date} style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 10, overflow: 'hidden',
            }}>
              {/* 날짜 헤더 */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', background: 'var(--bg-tertiary)',
                borderBottom: '1px solid var(--border-primary)',
              }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                  {date} ({dayOfWeek(date)})
                </div>
                {total > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: totalUp ? '#ef4444' : totalDown ? '#3b82f6' : 'var(--text-primary)' }}>
                      {isAmountHidden ? '••••••' : fmt(total)}
                    </div>
                    {totalChange !== null && totalChange !== 0 && (
                      <div style={{ fontSize: 11, color: totalUp ? '#ef4444' : '#3b82f6' }}>
                        {totalUp ? '+' : ''}{isAmountHidden ? '••••' : fmt(totalChange)}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* 종목별 행 */}
              {holdings.map((h, hi) => {
                const hist = histories[h.ticker] || [];
                const entry = hist.find(d => d.date === date);
                const prevEntry = di > 0 ? hist.find(d => d.date === dates[di - 1]) : null;
                const change = entry && prevEntry ? (entry.price - prevEntry.price) * h.quantity : null;
                const isUp = change !== null && change > 0;
                const isDown = change !== null && change < 0;
                return (
                  <div key={h.id || h.ticker} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--border-primary)',
                    background: hi % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                  }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-primary)' }}>{h.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{h.ticker} · {fmt(h.quantity)}주</div>
                    </div>
                    <div style={{ textAlign: 'right', color: isUp ? '#ef4444' : isDown ? '#3b82f6' : 'var(--text-primary)' }}>
                      {entry ? (
                        <>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>
                            {isAmountHidden ? '••••••' : fmt(entry.price * h.quantity)}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{fmt(entry.price)}</div>
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)' }}>-</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* 현금 행 */}
              {cash > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: holdings.length % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-primary)' }}>현금</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                      {isAmountHidden ? '••••••' : fmt(cash)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // 데스크탑: 가로 스크롤 테이블
  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 600, fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{
              textAlign: 'left', padding: '8px 12px', background: 'var(--bg-tertiary)',
              borderBottom: '1px solid var(--border-primary)',
              position: 'sticky', left: 0, zIndex: 2,
              whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontWeight: 600,
            }}>
              종목 / 날짜
            </th>
            {dates.map(date => (
              <th key={date} style={{
                textAlign: 'center', padding: '6px 8px',
                background: 'var(--bg-tertiary)',
                borderBottom: '1px solid var(--border-primary)',
                whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontWeight: 500,
                minWidth: 80,
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{dayOfWeek(date)}</div>
                <div>{shortDate(date)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {holdings.map((h, hi) => {
            const hist = histories[h.ticker] || [];
            return (
              <tr key={h.id || h.ticker} style={{
                background: hi % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)',
              }}>
                <td style={{
                  padding: '8px 12px', position: 'sticky', left: 0, zIndex: 1,
                  background: hi % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                  borderBottom: '1px solid var(--border-primary)',
                  borderRight: '1px solid var(--border-primary)',
                  whiteSpace: 'nowrap',
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{h.name}</div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                    {h.ticker} · {fmt(h.quantity)}주
                  </div>
                </td>
                {dates.map((date, di) => {
                  const entry = hist.find(d => d.date === date);
                  const prevEntry = di > 0 ? hist.find(d => d.date === dates[di - 1]) : null;
                  const change = entry && prevEntry ? entry.price - prevEntry.price : null;
                  const isUp = change !== null && change > 0;
                  const isDown = change !== null && change < 0;
                  return (
                    <td key={date} style={{
                      textAlign: 'right', padding: '8px 10px',
                      borderBottom: '1px solid var(--border-primary)',
                      color: isUp ? '#ef4444' : isDown ? '#3b82f6' : 'var(--text-primary)',
                    }}>
                      {entry ? (
                        <>
                          <div style={{ fontWeight: 600 }}>
                            {isAmountHidden ? '••••••' : fmt(entry.price * h.quantity)}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                            {fmt(entry.price)}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)' }}>-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {/* 현금 행 */}
          {cash > 0 && (
            <tr style={{ background: holdings.length % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)' }}>
              <td style={{
                padding: '8px 12px', position: 'sticky', left: 0, zIndex: 1,
                background: holdings.length % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-primary)',
                borderRight: '1px solid var(--border-primary)',
                whiteSpace: 'nowrap',
              }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>현금</div>
              </td>
              {dates.map(date => (
                <td key={date} style={{
                  textAlign: 'right', padding: '8px 10px',
                  borderBottom: '1px solid var(--border-primary)',
                  color: 'var(--text-primary)',
                }}>
                  <div style={{ fontWeight: 600 }}>{isAmountHidden ? '••••••' : fmt(cash)}</div>
                </td>
              ))}
            </tr>
          )}
          {/* 합계 행 */}
          <tr style={{ background: 'var(--bg-tertiary)', fontWeight: 700 }}>
            <td style={{
              padding: '8px 12px', position: 'sticky', left: 0, zIndex: 1,
              background: 'var(--bg-tertiary)',
              borderTop: '2px solid var(--border-primary)',
              borderRight: '1px solid var(--border-primary)',
              color: 'var(--text-primary)', fontSize: 13,
            }}>
              합계
            </td>
            {dateTotals.map((total, di) => {
              const prevTotal = di > 0 ? dateTotals[di - 1] : null;
              const change = prevTotal !== null ? total - prevTotal : null;
              const isUp = change !== null && change > 0;
              const isDown = change !== null && change < 0;
              return (
                <td key={dates[di]} style={{
                  textAlign: 'right', padding: '8px 10px',
                  borderTop: '2px solid var(--border-primary)',
                  color: isUp ? '#ef4444' : isDown ? '#3b82f6' : 'var(--text-primary)',
                }}>
                  {total > 0 ? (
                    <>
                      <div>{isAmountHidden ? '••••••' : fmt(total)}</div>
                      {change !== null && change !== 0 && (
                        <div style={{ fontSize: 11, color: isUp ? '#ef4444' : '#3b82f6' }}>
                          {isUp ? '+' : ''}{isAmountHidden ? '••••' : fmt(change)}
                        </div>
                      )}
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-tertiary)' }}>-</span>
                  )}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function OtherAssetSection({
  otherAssets, snapshots, ownerFilter, isAmountHidden, isMobile, collapsed, onToggle,
}: {
  otherAssets: OtherAsset[];
  snapshots: OtherAssetSnapshot[];
  ownerFilter: OwnerFilter;
  isAmountHidden: boolean;
  isMobile: boolean;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const filtered = otherAssets.filter(a =>
    ownerFilter === 'all' || a.owner === ownerFilter || a.owner === 'shared'
  );
  if (filtered.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);

  // 스냅샷 날짜 목록 (오래된순) + 오늘이 없으면 오늘 추가
  const snapDates = snapshots.map(s => s.date);
  const allDates = snapDates.includes(today) ? snapDates : [...snapDates, today];
  const displayDates = allDates.slice(-20); // 최대 20일

  // 날짜별 자산 금액 조회
  const getAmount = (assetId: string, date: string): number | null => {
    if (date === today) {
      const a = otherAssets.find(a => a.id === assetId);
      return a ? a.amount : null;
    }
    const snap = snapshots.find(s => s.date === date);
    const entry = snap?.assets.find(a => a.id === assetId);
    return entry ? entry.amount : null;
  };

  const dateTotals = displayDates.map(date =>
    filtered.reduce((sum, a) => {
      const v = getAmount(a.id, date);
      return sum + (v ?? 0);
    }, 0)
  );

  // 모바일: 수직 카드
  if (isMobile) {
    return (
      <div style={{ marginTop: 20 }}>
        <button onClick={onToggle} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
          borderRadius: collapsed ? 12 : '12px 12px 0 0', cursor: 'pointer',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f59e0b20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MIcon name="savings" size={16} style={{ color: '#f59e0b' }} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>기타 자산</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{filtered.length}항목 · 스냅샷 기록</div>
            </div>
          </div>
          <MIcon name={collapsed ? 'expand_more' : 'expand_less'} size={20} style={{ color: 'var(--text-tertiary)' }} />
        </button>
        {!collapsed && (
          <div style={{ border: '1px solid var(--border-primary)', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12 }}>
              {[...displayDates].reverse().map((date, rdi) => {
                const di = displayDates.length - 1 - rdi;
                const total = dateTotals[di];
                const prevTotal = di > 0 ? dateTotals[di - 1] : null;
                const change = prevTotal !== null ? total - prevTotal : null;
                const isUp = change !== null && change > 0;
                const isDown = change !== null && change < 0;
                return (
                  <div key={date} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-primary)' }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{date} ({dayOfWeek(date)}){date === today ? ' · 오늘' : ''}</div>
                      {total > 0 && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: isUp ? '#ef4444' : isDown ? '#3b82f6' : 'var(--text-primary)' }}>
                            {isAmountHidden ? '••••••' : fmt(total)}
                          </div>
                          {change !== null && change !== 0 && (
                            <div style={{ fontSize: 11, color: isUp ? '#ef4444' : '#3b82f6' }}>
                              {isUp ? '+' : ''}{isAmountHidden ? '••••' : fmt(change)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {filtered.map((a, ai) => {
                      const val = getAmount(a.id, date);
                      return (
                        <div key={a.id} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderBottom: ai < filtered.length - 1 ? '1px solid var(--border-primary)' : 'none',
                          background: ai % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                        }}>
                          <div>
                            <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-primary)' }}>{a.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{a.owner === 'shared' ? '공동' : a.owner === 'wife' ? '아내' : '남편'}</div>
                          </div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                            {val !== null ? (isAmountHidden ? '••••••' : fmt(val)) : <span style={{ color: 'var(--text-tertiary)' }}>-</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 데스크탑: 가로 테이블
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 12, overflow: 'hidden' }}>
        <button onClick={onToggle} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
          borderBottom: collapsed ? 'none' : '1px solid var(--border-primary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f59e0b20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MIcon name="savings" size={16} style={{ color: '#f59e0b' }} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>기타 자산</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {filtered.length}항목 · 스냅샷 기록
                {snapshots.length === 0 && ' (오늘부터 기록 시작)'}
              </div>
            </div>
          </div>
          <MIcon name={collapsed ? 'expand_more' : 'expand_less'} size={20} style={{ color: 'var(--text-tertiary)' }} />
        </button>
        {!collapsed && (
          <div style={{ padding: '16px 0', overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 500, fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 12px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-primary)', position: 'sticky', left: 0, zIndex: 2, whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    항목 / 날짜
                  </th>
                  {displayDates.map(date => (
                    <th key={date} style={{ textAlign: 'center', padding: '6px 8px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-primary)', whiteSpace: 'nowrap', color: date === today ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: date === today ? 700 : 500, minWidth: 90 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{dayOfWeek(date)}</div>
                      <div>{shortDate(date)}{date === today ? ' 오늘' : ''}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, ai) => (
                  <tr key={a.id} style={{ background: ai % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)' }}>
                    <td style={{ padding: '8px 12px', position: 'sticky', left: 0, zIndex: 1, background: ai % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)', borderRight: '1px solid var(--border-primary)', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{a.owner === 'shared' ? '공동' : a.owner === 'wife' ? '아내' : '남편'}</div>
                    </td>
                    {displayDates.map((date, di) => {
                      const val = getAmount(a.id, date);
                      const prevVal = di > 0 ? getAmount(a.id, displayDates[di - 1]) : null;
                      const change = val !== null && prevVal !== null ? val - prevVal : null;
                      const isUp = change !== null && change > 0;
                      const isDown = change !== null && change < 0;
                      return (
                        <td key={date} style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid var(--border-primary)', color: isUp ? '#ef4444' : isDown ? '#3b82f6' : 'var(--text-primary)' }}>
                          {val !== null ? (
                            <>
                              <div style={{ fontWeight: 600 }}>{isAmountHidden ? '••••••' : fmt(val)}</div>
                              {change !== null && change !== 0 && (
                                <div style={{ fontSize: 11, color: isUp ? '#ef4444' : '#3b82f6' }}>
                                  {isUp ? '+' : ''}{isAmountHidden ? '••••' : fmt(change)}
                                </div>
                              )}
                            </>
                          ) : (
                            <span style={{ color: 'var(--text-tertiary)' }}>-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* 합계 행 */}
                <tr style={{ background: 'var(--bg-tertiary)', fontWeight: 700 }}>
                  <td style={{ padding: '8px 12px', position: 'sticky', left: 0, zIndex: 1, background: 'var(--bg-tertiary)', borderTop: '2px solid var(--border-primary)', borderRight: '1px solid var(--border-primary)', color: 'var(--text-primary)', fontSize: 13 }}>합계</td>
                  {dateTotals.map((total, di) => {
                    const prevTotal = di > 0 ? dateTotals[di - 1] : null;
                    const change = prevTotal !== null ? total - prevTotal : null;
                    const isUp = change !== null && change > 0;
                    const isDown = change !== null && change < 0;
                    return (
                      <td key={displayDates[di]} style={{ textAlign: 'right', padding: '8px 10px', borderTop: '2px solid var(--border-primary)', color: isUp ? '#ef4444' : isDown ? '#3b82f6' : 'var(--text-primary)' }}>
                        {total > 0 ? (
                          <>
                            <div>{isAmountHidden ? '••••••' : fmt(total)}</div>
                            {change !== null && change !== 0 && (
                              <div style={{ fontSize: 11, color: isUp ? '#ef4444' : '#3b82f6' }}>
                                {isUp ? '+' : ''}{isAmountHidden ? '••••' : fmt(change)}
                              </div>
                            )}
                          </>
                        ) : <span style={{ color: 'var(--text-tertiary)' }}>-</span>}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function StockDailyRecord() {
  const { accounts, otherAssets, isAmountHidden, isMobile } = useAppContext();
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all');
  const [histories, setHistories] = useState<Record<string, DayPrice[]>>({});
  const [loading, setLoading] = useState(false);
  const [dates, setDates] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [otherSnapshots, setOtherSnapshots] = useState<OtherAssetSnapshot[]>([]);
  const [otherCollapsed, setOtherCollapsed] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (accounts.length === 0) return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const allTickers = [...new Set(
      accounts.flatMap(a =>
        a.holdings
          .filter(h => !h.isFund && h.ticker && /^[0-9A-Z]{6}$/i.test(h.ticker))
          .map(h => h.ticker)
      )
    )];

    if (allTickers.length === 0) return;

    setLoading(true);
    Promise.all(
      allTickers.map(async ticker => {
        try {
          const res = await fetch(`${WORKER_URL}/stock-chart/${ticker}?days=30`);
          if (!res.ok) return [ticker, [] as DayPrice[]] as const;
          const data: DayPrice[] = await res.json();
          // 4주 = 최근 20 거래일
          return [ticker, data.slice(-20)] as const;
        } catch {
          return [ticker, [] as DayPrice[]] as const;
        }
      })
    ).then(results => {
      const map: Record<string, DayPrice[]> = {};
      const dateSet = new Set<string>();
      for (const [ticker, hist] of results) {
        map[ticker] = hist;
        hist.forEach(d => dateSet.add(d.date));
      }
      const sortedDates = [...dateSet].sort();
      setHistories(map);
      setDates(sortedDates);
      setLoading(false);
    });

    // 기타 자산 스냅샷 로드
    kvGet<OtherAssetSnapshot[]>('other_asset_snapshots').then(data => {
      if (data && data.length > 0) {
        const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
        setOtherSnapshots(sorted.slice(-28));
      }
    }).catch(() => {});
  }, [accounts]);

  const filteredAccounts: Account[] = accounts.filter(a =>
    ownerFilter === 'all' || a.owner === ownerFilter
  ).filter(a => a.holdings.some(h => !h.isFund && h.ticker));

  const toggleCollapse = (id: string) => {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div style={{ padding: isMobile ? 16 : 24, maxWidth: 1400 }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            개별종목기록
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            최근 4주 일별 종가 기록 (종가 × 보유수량)
          </div>
        </div>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-tertiary)', fontSize: 13 }}>
            <MIcon name="sync" size={16} style={{ animation: 'spin 1s linear infinite' }} />
            가격 조회 중...
          </div>
        )}
      </div>

      {/* 소유자 필터 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['all', 'wife', 'husband'] as OwnerFilter[]).map(owner => (
          <button
            key={owner}
            onClick={() => setOwnerFilter(owner)}
            style={{
              padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: ownerFilter === owner ? 700 : 400,
              background: ownerFilter === owner ? 'var(--color-primary)' : 'var(--bg-secondary)',
              color: ownerFilter === owner ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.15s',
            }}
          >
            {OWNER_LABEL[owner]}
          </button>
        ))}
      </div>

      {/* 날짜 범위 표시 */}
      {dates.length > 0 && (
        <div style={{
          marginBottom: 16, padding: '8px 14px', borderRadius: 8,
          background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
          fontSize: 12, color: 'var(--text-tertiary)', display: 'inline-block',
        }}>
          <MIcon name="calendar_today" size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          {dates[0]} ~ {dates[dates.length - 1]} ({dates.length}거래일)
        </div>
      )}

      {/* 계좌별 섹션 */}
      {filteredAccounts.length === 0 && !loading ? (
        <div style={{
          textAlign: 'center', padding: 48, color: 'var(--text-tertiary)',
          background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-primary)',
        }}>
          <MIcon name="inbox" size={32} style={{ marginBottom: 8 }} />
          <div>등록된 계좌가 없습니다</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {filteredAccounts.map(account => {
            const isOpen = !collapsed[account.id];
            const ownerColor = account.owner === 'wife' ? '#ec4899' : '#3b82f6';
            const holdingCount = account.holdings.filter(h => !h.isFund && h.ticker).length;
            return (
              <div key={account.id} style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 12,
                overflow: 'hidden',
              }}>
                {/* 계좌 헤더 */}
                <button
                  onClick={() => toggleCollapse(account.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: isOpen ? '1px solid var(--border-primary)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: ownerColor + '20',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <MIcon name="account_balance" size={16} style={{ color: ownerColor }} />
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                        {account.ownerName} · {account.alias || account.institution}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                        {account.accountType} · {holdingCount}종목
                      </div>
                    </div>
                  </div>
                  <MIcon
                    name={isOpen ? 'expand_less' : 'expand_more'}
                    size={20}
                    style={{ color: 'var(--text-tertiary)' }}
                  />
                </button>

                {/* 테이블 */}
                {isOpen && (
                  <div style={{ padding: isMobile ? '12px 0' : '16px 0' }}>
                    <AccountStockTable
                      account={account}
                      histories={histories}
                      dates={dates}
                      isAmountHidden={isAmountHidden}
                      isMobile={isMobile}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 기타 자산 섹션 */}
      {otherAssets.length > 0 && (
        <OtherAssetSection
          otherAssets={otherAssets}
          snapshots={otherSnapshots}
          ownerFilter={ownerFilter}
          isAmountHidden={isAmountHidden}
          isMobile={isMobile}
          collapsed={otherCollapsed}
          onToggle={() => setOtherCollapsed(p => !p)}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
