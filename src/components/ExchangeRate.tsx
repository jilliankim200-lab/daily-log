import { useState, useEffect } from 'react';
import { TrendingUp, Loader2 } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';

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
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-cee564ea/exchange-rate-data`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          },
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch exchange rates: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Fetched exchange rates:', data);
      setRates({ usd: data.usd || 0, jpy: data.jpy || 0 });
    } catch (err) {
      // Silently handle errors - don't spam console
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Exchange rate request timed out - using cached data');
      } else if (err instanceof Error && err.message.includes('Failed to fetch')) {
        console.log('Network error fetching exchange rates - server may be starting up');
      }
      // Keep existing data if fetch fails
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-white border border-[--color-gray-200] rounded-lg shadow-sm">
        <Loader2 className="w-4 h-4 animate-spin text-[--color-gray-600]" />
        <span style={{ fontSize: '14px', color: '#86868b' }}>환율 로딩 중...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
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