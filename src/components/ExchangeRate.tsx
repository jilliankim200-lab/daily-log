import { useState, useEffect } from 'react';
import { MIcon } from './MIcon';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://asset-dashboard-api.jilliankim200.workers.dev';

interface ExchangeRateData {
  usd: number; usdChange: number; usdChangeRate: number;
  jpy: number; jpyChange: number; jpyChangeRate: number;
  wti: number; wtiChange: number; wtiChangeRate: number;
}

function RateItem({ label, value, unit, changeRate }: {
  label: string; value: number; unit: string; changeRate: number;
}) {
  const isUp = changeRate > 0;
  const isDown = changeRate < 0;
  const color = isUp ? 'var(--color-profit)' : isDown ? 'var(--color-loss)' : 'var(--text-tertiary)';
  const arrow = isUp ? '▲' : isDown ? '▼' : '';

  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-blue)' }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
        {value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
      </span>
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{unit}</span>
      {changeRate !== 0 && (
        <span style={{ fontSize: 11, fontWeight: 600, color }}>
          {arrow}{Math.abs(changeRate).toFixed(2)}%
        </span>
      )}
    </div>
  );
}

export function ExchangeRate() {
  const [rates, setRates] = useState<ExchangeRateData | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    fetch(`${WORKER_URL}/exchange-rates`, { signal: controller.signal })
      .then(r => r.json())
      .then(setRates)
      .catch(() => {})
      .finally(() => clearTimeout(timeoutId));
  }, []);

  if (!rates) return null;

  const divider = (
    <div style={{ width: 1, height: 14, background: 'var(--border-primary)', flexShrink: 0 }} />
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
      <MIcon name="trending_up" size={16} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
      <RateItem label="USD" value={rates.usd} unit="원" changeRate={rates.usdChangeRate} />
      {divider}
      <RateItem label="JPY" value={rates.jpy} unit="원" changeRate={rates.jpyChangeRate} />
      {divider}
      <RateItem label="WTI" value={rates.wti} unit="$" changeRate={rates.wtiChangeRate} />
    </div>
  );
}
