import React, { useState, useEffect } from 'react';
import { useAppContext } from '../App';
import { MIcon } from './MIcon';
import { fetchCurrentPricesWithChange } from '../utils/fetchPrices';

type PriceMap = Record<string, { price: number; changeRate: number }>;

type NgfEtf = {
  ticker: string;
  name: string;
  sector: string;
  label: string;
};

const SECTOR_COLORS: Record<string, string> = {
  A: '#4FC3F7',
  B: '#81C784',
  C: '#FFB74D',
  D: '#E57373',
  E: '#BA68C8',
  F: '#4DB6AC',
};

const DEFAULT_ETFS: NgfEtf[] = [
  { ticker: '455850', name: 'SOL AI반도체소부장',   sector: 'A', label: 'AI·반도체' },
  { ticker: '261250', name: 'KODEX 바이오',         sector: 'B', label: '바이오' },
  { ticker: '475050', name: 'ACE KPOP포커스',       sector: 'C', label: '콘텐츠' },
  { ticker: '421320', name: 'PLUS 우주항공&UAM',    sector: 'D', label: '방산·우주' },
  { ticker: '455860', name: 'SOL 2차전지소부장Fn',  sector: 'E', label: '이차전지' },
  { ticker: '445290', name: 'KODEX 로봇액티브',     sector: 'F', label: '로봇' },
];

const LS_KEY = 'ngf_etf_list';

function loadEtfs(): NgfEtf[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_ETFS;
}

function saveEtfs(list: NgfEtf[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

export function NationalGrowthFund() {
  const { navigateTo } = useAppContext();
  const [etfs, setEtfs] = useState<NgfEtf[]>(loadEtfs);
  const [prices, setPrices] = useState<PriceMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tickers = etfs.map(e => e.ticker);
    if (tickers.length === 0) { setLoading(false); return; }
    fetchCurrentPricesWithChange(tickers)
      .then(setPrices)
      .finally(() => setLoading(false));
  }, [etfs.map(e => e.ticker).join(',')]);

  function handleDelete(ticker: string) {
    const next = etfs.filter(e => e.ticker !== ticker);
    setEtfs(next);
    saveEtfs(next);
  }

  function handleCardClick(etf: NgfEtf) {
    localStorage.setItem('chart_new_tab_ticker', etf.ticker);
    navigateTo('chart');
  }

  return (
    <div style={{ padding: '24px', maxWidth: '900px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>국민성장펀드 ETF 트래커</h2>
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '8px 16px', borderRadius: 'var(--radius-md)',
            background: 'var(--accent-blue)', color: 'var(--accent-blue-fg)',
            border: 'none', cursor: 'pointer', fontSize: '14px',
          }}
          onClick={() => {/* Task 5에서 구현 */}}
        >
          <MIcon name="add" size={18} />
          ETF 추가
        </button>
      </div>

      {loading && (
        <div style={{ color: 'var(--text-tertiary)', marginBottom: '12px', fontSize: '13px' }}>
          가격 조회 중...
        </div>
      )}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: '16px',
      }}>
        {etfs.map(etf => {
          const pd = prices[etf.ticker];
          return (
            <EtfCard
              key={etf.ticker}
              etf={etf}
              price={pd?.price ?? null}
              changeRate={pd?.changeRate ?? null}
              onDelete={handleDelete}
              onClick={handleCardClick}
            />
          );
        })}
      </div>
    </div>
  );
}

type EtfCardProps = {
  etf: NgfEtf;
  price: number | null;
  changeRate: number | null;
  onDelete: (ticker: string) => void;
  onClick: (etf: NgfEtf) => void;
};

function EtfCard({ etf, price, changeRate, onDelete, onClick }: EtfCardProps) {
  const isUp = changeRate !== null && changeRate > 0;
  const isDown = changeRate !== null && changeRate < 0;
  const sectorColor = SECTOR_COLORS[etf.sector] ?? '#888';

  return (
    <div
      onClick={() => onClick(etf)}
      style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        cursor: 'pointer',
        position: 'relative',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      <button
        onClick={e => { e.stopPropagation(); onDelete(etf.ticker); }}
        style={{
          position: 'absolute', top: '10px', right: '10px',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-tertiary)', padding: '2px',
          display: 'flex', alignItems: 'center',
        }}
      >
        <MIcon name="close" size={16} />
      </button>

      <div style={{ marginBottom: '8px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          background: sectorColor + '22',
          color: sectorColor,
          padding: '2px 10px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 700,
        }}>
          {etf.sector} · {etf.label}
        </span>
      </div>

      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
        {etf.name}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>
        {etf.ticker}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {price !== null ? price.toLocaleString('ko-KR') + '원' : '—'}
        </span>
        <span style={{
          fontSize: '14px', fontWeight: 600,
          color: isUp ? 'var(--color-profit)' : isDown ? 'var(--color-loss)' : 'var(--text-tertiary)',
        }}>
          {changeRate !== null
            ? (isUp ? '▲ +' : isDown ? '▼ ' : '') + changeRate.toFixed(2) + '%'
            : '—'}
        </span>
      </div>
    </div>
  );
}
