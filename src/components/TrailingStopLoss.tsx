import { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../App';
import { fetchCurrentPricesWithChange } from '../utils/fetchPrices';
import { kvGet, kvSet } from '../api';
import { MIcon } from './MIcon';
import type { Holding, Account } from '../types';

interface TrailingEntry {
  pct: number;       // 손절률 (10 = 10%)
  peakPrice: number; // 추적 고점
}

interface CustomStock {
  id: string;
  ticker: string;
  name: string;
  avgPrice: number;
}

const LS_KEY = 'trailing_stops_v1';
const CUSTOM_KEY = 'trailing_custom_stocks_v1';

function load(): Record<string, TrailingEntry> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
  catch { return {}; }
}
function save(e: Record<string, TrailingEntry>) {
  localStorage.setItem(LS_KEY, JSON.stringify(e));
  kvSet(LS_KEY, e).catch(() => {});
}
function loadCustom(): CustomStock[] {
  try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); }
  catch { return []; }
}
function saveCustom(s: CustomStock[]) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(s));
  kvSet(CUSTOM_KEY, s).catch(() => {});
}
function fmt(n: number) { return Math.round(n).toLocaleString('ko-KR'); }
function fmtPct(n: number, digits = 1) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;
}

interface RowProps {
  holding: Holding;
  account: Account;
  currentPrice?: number;
  changeRate?: number;
  entry: TrailingEntry;
  onPctChange: (pct: number) => void;
  onResetPeak: () => void;
}

function HoldingRow({ holding, account, currentPrice, changeRate, entry, onPctChange, onResetPeak }: RowProps) {
  const { peakPrice, pct } = entry;
  const stopPrice = peakPrice * (1 - pct / 100);
  const hasPrice = currentPrice != null && currentPrice > 0;

  const returnPct = hasPrice ? ((currentPrice! - holding.avgPrice) / holding.avgPrice * 100) : null;
  const distPct = hasPrice ? ((currentPrice! - stopPrice) / currentPrice! * 100) : null;

  const isTriggered = hasPrice && currentPrice! <= stopPrice;
  const isWarning = !isTriggered && hasPrice && distPct! < 3;

  const statusColor = isTriggered ? '#F04452' : isWarning ? '#FF9500' : '#30C85E';
  const statusBg = isTriggered ? '#FFF0F1' : isWarning ? '#FFF4E5' : '#EDFBF2';
  const statusLabel = isTriggered ? '손절 발생' : isWarning ? '주의 구간' : '추적 중';

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      padding: '14px 16px',
      marginBottom: 10,
      border: isTriggered ? '1.5px solid #F04452' : '1px solid var(--border-primary)',
      boxShadow: isTriggered ? '0 0 0 3px rgba(240,68,82,0.08)' : 'none',
    }}>
      {/* 상단: 종목명 + 계좌 + 상태 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{holding.name}</span>
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
            {hasPrice ? `${fmt(currentPrice!)}원` : '—'}
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
            {fmt(peakPrice)}원
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
          background: isTriggered ? '#FFF0F1' : isWarning ? '#FFF4E5' : 'var(--bg-secondary)',
          borderRadius: 10, padding: '10px 12px'
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, fontWeight: 500 }}>손절가</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: statusColor }}>
            {fmt(stopPrice)}원
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
          <span>매입가 <b style={{ color: 'var(--text-primary)' }}>{fmt(holding.avgPrice)}원</b></span>
          {returnPct != null && (
            <span>수익률 <b style={{ color: returnPct >= 0 ? '#F04452' : '#3182F6' }}>{fmtPct(returnPct)}</b></span>
          )}
          <span style={{ color: 'var(--text-tertiary)' }}>{holding.quantity.toLocaleString()}주</span>
        </div>

        {/* 손절률 조절 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>손절률</span>
          {[5, 7, 10, 15, 20].map(v => (
            <button key={v} onClick={() => onPctChange(v)}
              style={{
                padding: '4px 9px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                background: pct === v ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                color: pct === v ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.1s',
              }}>
              {v}%
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type FilterType = 'all' | 'triggered' | 'warning' | 'safe';

export function TrailingStopLoss() {
  const { accounts, isMobile } = useAppContext();
  const [priceData, setPriceData] = useState<Record<string, { price: number; changeRate: number }>>({});
  const [entries, setEntries] = useState<Record<string, TrailingEntry>>(load);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [customStocks, setCustomStocks] = useState<CustomStock[]>(loadCustom);
  const [addTicker, setAddTicker] = useState('');
  const [addPrice, setAddPrice] = useState('');
  const [addLoading, setAddLoading] = useState(false);

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
      market: 'KR' as const, avgPrice: s.avgPrice, quantity: 1,
    })),
  };

  const tickers = [...new Set([
    ...accountHoldings.flatMap(a => a.holdings.map(h => h.ticker)),
    ...customStocks.map(s => s.ticker),
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
  }, []);

  useEffect(() => { fetchPrices(); }, []);

  const updatePct = (ticker: string, pct: number) => {
    setEntries(prev => {
      const avgPrice = accountHoldings.flatMap(a => a.holdings).find(h => h.ticker === ticker)?.avgPrice ?? 0;
      const currentP = priceData[ticker]?.price ?? avgPrice;
      const entry = prev[ticker] ?? { pct: 10, peakPrice: currentP };
      const next = { ...prev, [ticker]: { ...entry, pct } };
      save(next);
      return next;
    });
  };

  const addCustomStock = async () => {
    const ticker = addTicker.trim().toUpperCase();
    const price = parseFloat(addPrice.replace(/,/g, ''));
    if (!ticker || !price || price <= 0) return;
    if (customStocks.find(s => s.ticker === ticker)) return;
    setAddLoading(true);
    let name = ticker;
    try {
      const r = await fetch(`/naver-stock/${ticker}/basic`);
      if (r.ok) { const d = await r.json(); name = d.stockName || ticker; }
    } catch { /* 이름 조회 실패 시 ticker 사용 */ }
    const newStock: CustomStock = { id: `${ticker}-${Date.now()}`, ticker, name, avgPrice: price };
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

  // 손절 발생/주의 종목 수 계산
  const counts = tickers.reduce((acc, ticker) => {
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
    <div style={{ minHeight: '100%', background: 'var(--bg-page)' }}>
      <div style={{ padding: isMobile ? '16px 12px 32px' : '20px 20px 40px', maxWidth: 860, margin: '0 auto' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 5 }}>
              추적 손절매
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              주가 상승 시 고점을 자동 추적하고, 고점 대비 설정 비율 하락 시 매도 신호를 알립니다
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 12 }}>
            <select
              value={selectedAccountId}
              onChange={e => setSelectedAccountId(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border-primary)', background: '#fff', fontSize: 13, color: selectedAccountId !== 'all' && triggeredAccountIds.has(selectedAccountId) ? '#F04452' : 'var(--text-primary)', fontFamily: 'inherit', cursor: 'pointer', outline: 'none', maxWidth: isMobile ? 110 : 160 }}>
              <option value="all">전체 계좌</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}
                  style={{ color: triggeredAccountIds.has(acc.id) ? '#F04452' : 'var(--text-primary)' }}>
                  {triggeredAccountIds.has(acc.id) ? '[!] ' : ''}{acc.ownerName} {acc.institution} {acc.accountType}{acc.alias ? ` (${acc.alias})` : ''}
                </option>
              ))}
              <option value="custom">── 개별종목 ({customStocks.length})</option>
            </select>
            <button onClick={fetchPrices} disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.65 : 1, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              <MIcon name="refresh" size={15} />
              {loading ? '조회 중' : '가격 갱신'}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
            {([
              { label: '손절 발생', count: counts.triggered, color: '#F04452', bg: '#FFF0F1', icon: 'warning', filter: 'triggered' },
              { label: '주의 구간', count: counts.warning, color: '#FF9500', bg: '#FFF4E5', icon: 'notification_important', filter: 'warning' },
              { label: '추적 중', count: counts.safe, color: '#30C85E', bg: '#EDFBF2', icon: 'check_circle', filter: 'safe' },
            ] as const).map(s => {
              const isActive = activeFilter === s.filter;
              return (
                <div key={s.label}
                  onClick={() => setActiveFilter(isActive ? 'all' : s.filter)}
                  style={{
                    background: s.bg, borderRadius: 12, padding: '12px 14px',
                    display: 'flex', alignItems: 'center', gap: 10,
                    cursor: 'pointer', transition: 'all 0.15s',
                    outline: isActive ? `2px solid ${s.color}` : '2px solid transparent',
                    boxShadow: isActive ? `0 0 0 3px ${s.color}22` : 'none',
                    transform: isActive ? 'scale(1.02)' : 'scale(1)',
                  }}>
                  <MIcon name={s.icon} size={20} style={{ color: s.color }} />
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.count}</div>
                    <div style={{ fontSize: 11, color: s.color, marginTop: 2, fontWeight: 600 }}>{s.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 원칙 안내 */}
        <div style={{ background: '#EDF3FF', borderRadius: 12, padding: '12px 16px', marginBottom: 24, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <MIcon name="info" size={18} style={{ color: 'var(--accent-blue)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: '#1B64DA', lineHeight: 1.7 }}>
            <b>추적 손절매 원칙</b> — 주가가 오르면 고점을 자동 갱신합니다. 고점 대비 설정 비율만큼 하락하면 매도합니다.
            <br />예) 고점 20,000원 · 손절률 10% → 손절가 18,000원. 주가가 18,000원 이하로 떨어지면 매도 신호.
          </div>
        </div>

        {/* 개별종목 뷰 */}
        {isCustomView && (
          <div style={{ marginBottom: 28 }}>
            {/* 추가 폼 */}
            <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 16, border: '1px solid var(--border-primary)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>종목 추가</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  value={addTicker}
                  onChange={e => setAddTicker(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && addCustomStock()}
                  placeholder="티커 (예: 005930)"
                  style={{ flex: '1 1 100px', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                />
                <input
                  value={addPrice}
                  onChange={e => setAddPrice(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomStock()}
                  placeholder="매수가 (원)"
                  type="number"
                  style={{ flex: '1 1 100px', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                />
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
              customStocks.map(cs => {
                const pd = priceData[cs.ticker];
                const entry = entries[cs.ticker] ?? { pct: 10, peakPrice: pd?.price ?? cs.avgPrice };
                const fakeHolding: Holding = { id: cs.id, name: cs.name, ticker: cs.ticker, market: 'KR', avgPrice: cs.avgPrice, quantity: 1 };
                return (
                  <div key={cs.id} style={{ position: 'relative' }}>
                    <HoldingRow
                      holding={fakeHolding}
                      account={customAccount}
                      currentPrice={pd?.price}
                      changeRate={pd?.changeRate}
                      entry={entry}
                      onPctChange={p => updatePct(cs.ticker, p)}
                      onResetPeak={() => resetPeak(cs.ticker)}
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

            // 손절 발생 → 주의 → 추적 중 순으로 정렬
            const sorted = [...filtered].sort((a, b) => {
              const getPriority = (h: typeof holdings[0]) => {
                const e = entries[h.ticker];
                if (!e) return 2;
                const p = priceData[h.ticker]?.price;
                if (!p) return 2;
                const stop = e.peakPrice * (1 - e.pct / 100);
                if (p <= stop) return 0;
                if ((p - stop) / p * 100 < 3) return 1;
                return 2;
              };
              return getPriority(a) - getPriority(b);
            });

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

                  return (
                    <HoldingRow
                      key={`${account.id}-${h.ticker}`}
                      holding={h}
                      account={account}
                      currentPrice={pd?.price}
                      changeRate={pd?.changeRate}
                      entry={entry}
                      onPctChange={(p) => updatePct(h.ticker, p)}
                      onResetPeak={() => resetPeak(h.ticker)}
                    />
                  );
                })}
              </div>
            );
          })
        ) : null}
      </div>
    </div>
  );
}
