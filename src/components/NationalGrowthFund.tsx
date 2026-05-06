import React, { useState } from 'react';
import { useAppContext } from '../App';
import { fetchCurrentPricesWithChange } from '../utils/fetchPrices';
import { MIcon } from './MIcon';

type NgfEtf = {
  ticker: string;
  name: string;
  sector: string;  // "A" ~ "F"
  label: string;   // "AI·반도체" 등
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
  const [etfs, setEtfs] = useState<NgfEtf[]>(loadEtfs);

  return (
    <div style={{ padding: '24px' }}>
      <h2>국민성장펀드 ETF 트래커</h2>
      <pre>{JSON.stringify(etfs, null, 2)}</pre>
    </div>
  );
}
