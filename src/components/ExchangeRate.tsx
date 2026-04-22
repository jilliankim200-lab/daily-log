import { useState, useEffect } from 'react';
import { MIcon } from './MIcon';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://asset-dashboard-api.jilliankim200.workers.dev';

interface ExchangeRateData {
  usd: number;
  jpy: number;
}

export function ExchangeRate() {
  const [rates, setRates] = useState<ExchangeRateData>({ usd: 0, jpy: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExchangeRates();
  }, []);

  const fetchExchangeRates = async () => {
    try {
      setLoading(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${WORKER_URL}/exchange-rates`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`Failed to fetch exchange rates: ${response.statusText}`);

      const data = await response.json();
      setRates({ usd: data.usd || 0, jpy: data.jpy || 0 });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Exchange rate request timed out');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <MIcon name="trending_up" size={16} style={{ color: 'rgb(37 99 235)' }} />
      <div className="flex items-center gap-4">
        <div className="flex items-baseline gap-1">
          <span className="text-[13px] font-semibold text-blue-600 dark:text-blue-400">USD</span>
          <span className="text-[15px] font-bold text-[#1d1d1f] dark:text-white">
            {rates.usd.toLocaleString()}
          </span>
          <span className="text-[12px] text-[#86868b] dark:text-[#d1d5dc]">원</span>
        </div>
        <div className="w-px h-4 bg-[--color-gray-300] dark:bg-gray-600" />
        <div className="flex items-baseline gap-1">
          <span className="text-[13px] font-semibold text-blue-600 dark:text-blue-400">JPY</span>
          <span className="text-[15px] font-bold text-[#1d1d1f] dark:text-white">
            {rates.jpy.toLocaleString()}
          </span>
          <span className="text-[12px] text-[#86868b] dark:text-[#d1d5dc]">원</span>
        </div>
      </div>
    </div>
  );
}
