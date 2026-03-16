import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { MarketIndicesModal } from './MarketIndicesModal';

interface IndexData {
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  error?: string;
}

interface MarketIndicesData {
  kospi?: IndexData;
  kosdaq?: IndexData;
  nasdaq?: IndexData;
  sp500?: IndexData;
  lastUpdated: string;
}

export function MarketIndices() {
  const [data, setData] = useState<MarketIndicesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchMarketIndices = async () => {
    try {
      setError(null);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-cee564ea/market-indices`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          },
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const indicesData = await response.json();
      console.log('Market indices data:', indicesData);
      setData(indicesData);
    } catch (err) {
      // Silently handle errors - don't spam console
      if (err instanceof Error && err.name === 'AbortError') {
        // Request timed out - use cached data if available
        console.log('Market indices request timed out - using cached data');
      } else if (err instanceof Error && err.message.includes('Failed to fetch')) {
        // Network error - server may be unavailable
        console.log('Network error fetching market indices - server may be starting up');
      }
      // Keep existing data if fetch fails, don't clear it
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketIndices();
    // Refresh every 60 seconds
    const interval = setInterval(fetchMarketIndices, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/30 dark:bg-white/5">
        <span className="text-xs text-[--color-text-secondary] dark:text-[#99a1af]">로딩중...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/30 dark:bg-white/5">
        <span className="text-xs text-[--color-text-secondary] dark:text-[#99a1af]">지수 정보 로딩 실패</span>
      </div>
    );
  }

  const renderIndex = (label: string, indexData?: IndexData) => {
    if (!indexData || indexData.error) return null;

    const isPositive = indexData.change >= 0;
    const changeColor = isPositive ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400';

    return (
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-medium text-[--color-text-body] dark:text-[#d1d5dc] whitespace-nowrap">
          {label}
        </span>
        <span className="text-[10px] font-semibold text-[--color-text-body] dark:text-white whitespace-nowrap">
          {indexData.currentPrice.toLocaleString(undefined, { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
          })}
        </span>
        <span className={`text-[10px] font-semibold ${changeColor} flex items-center gap-0.5 whitespace-nowrap`}>
          {isPositive ? '+' : ''}{indexData.change.toFixed(2)} ({isPositive ? '+' : ''}{indexData.changePercent.toFixed(2)}%)
        </span>
      </div>
    );
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-[4px] px-[8px] py-[4px] rounded-[4px] bg-white/40 dark:bg-white/5 backdrop-blur-sm hover:bg-white/60 dark:hover:bg-white/10 transition-colors border border-white/20 dark:border-white/10"
      >
        <span className="text-[13px] font-semibold text-[--color-text-body] dark:text-white whitespace-nowrap">
          📊 주요지수
        </span>
      </button>

      {data && (
        <MarketIndicesModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          data={data}
        />
      )}
    </>
  );
}