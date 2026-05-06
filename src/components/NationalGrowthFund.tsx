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

const NEWS_LINKS = [
  { label: '국민성장펀드 최신 뉴스',   query: '국민성장펀드' },
  { label: '국민참여형 펀드 가입',      query: '국민참여형 국민성장펀드' },
  { label: '반도체 소부장 동향',        query: '반도체 소부장 ETF' },
  { label: '바이오 기술특례 뉴스',      query: '바이오 기술특례 코스닥' },
  { label: '우주·방산 소형주',          query: '우주항공 UAM 주식' },
  { label: '로봇 부품 산업',            query: '로봇 부품 중소형주' },
];

function naverNewsUrl(query: string) {
  return `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(query)}`;
}

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
  const [showAddModal, setShowAddModal] = useState(false);

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
          onClick={() => setShowAddModal(true)}
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

      {/* 관련 뉴스 */}
      <div style={{ marginTop: '32px' }}>
        <h3 style={{ color: 'var(--text-primary)', marginBottom: '12px', fontSize: '16px' }}>
          관련 뉴스
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {NEWS_LINKS.map(link => (
            <a
              key={link.query}
              href={naverNewsUrl(link.query)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 14px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                textDecoration: 'none',
                fontSize: '14px',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-primary)')}
            >
              <MIcon name="open_in_new" size={16} style={{ color: 'var(--text-tertiary)' }} />
              {link.label}
            </a>
          ))}
        </div>
      </div>

      {showAddModal && (
        <AddEtfModal
          onAdd={(etf) => {
            const next = [...etfs, etf];
            setEtfs(next);
            saveEtfs(next);
            setShowAddModal(false);
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}
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

const SECTOR_OPTIONS = [
  { value: 'A', label: 'A · AI·반도체' },
  { value: 'B', label: 'B · 바이오' },
  { value: 'C', label: 'C · 콘텐츠' },
  { value: 'D', label: 'D · 방산·우주' },
  { value: 'E', label: 'E · 이차전지' },
  { value: 'F', label: 'F · 로봇' },
];

const SECTOR_LABELS: Record<string, string> = {
  A: 'AI·반도체', B: '바이오', C: '콘텐츠',
  D: '방산·우주', E: '이차전지', F: '로봇',
};

function AddEtfModal({ onAdd, onClose }: {
  onAdd: (etf: NgfEtf) => void;
  onClose: () => void;
}) {
  const [ticker, setTicker] = useState('');
  const [name, setName] = useState('');
  const [sector, setSector] = useState('A');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ticker.trim() || !name.trim()) return;
    onAdd({ ticker: ticker.trim(), name: name.trim(), sector, label: SECTOR_LABELS[sector] });
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '13px', color: 'var(--text-secondary)',
    display: 'block', marginBottom: '4px',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)',
          padding: '24px', width: '320px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>ETF 추가</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
            <MIcon name="close" size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>티커 (6자리)</label>
            <input
              style={inputStyle}
              value={ticker}
              onChange={e => setTicker(e.target.value)}
              placeholder="예: 455850"
              maxLength={6}
              required
            />
          </div>
          <div>
            <label style={labelStyle}>ETF 이름</label>
            <input
              style={inputStyle}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="예: SOL AI반도체소부장"
              required
            />
          </div>
          <div>
            <label style={labelStyle}>분야</label>
            <select style={inputStyle} value={sector} onChange={e => setSector(e.target.value)}>
              {SECTOR_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            style={{
              padding: '10px', background: 'var(--accent-blue)', color: 'var(--accent-blue-fg)',
              border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
              fontWeight: 600, fontSize: '14px',
            }}
          >
            추가
          </button>
        </form>
      </div>
    </div>
  );
}
