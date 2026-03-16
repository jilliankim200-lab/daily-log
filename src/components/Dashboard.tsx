import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { PiggyBank, DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Sparkles, Coffee, Sunset, Moon, RefreshCw, Star, ArrowUpDown } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface Transaction {
  id: number;
  date: string;
  dividend: number;
  totalAsset: number;
  assetChange: number;
  changeRate: number;
}

interface SheetsData {
  dividend: number;
  totalAsset: number;
  assetChange: number;
  monthlyAssetChange: number;
  yearlyAssetChange2025: number;
  yearlyAssetChange2026: number;
  monthlyAssetA1?: string;
  monthlyAssetB1?: string;
  lastUpdated: string;
  lastDate: string;
  transactions: Transaction[];
}

interface WatchlistItem {
  id: number;
  priceChange: number;
  stockName: string;
  ticker: string;
  currentPrice: number;
}

interface WatchlistData {
  items: WatchlistItem[];
  lastUpdated: string;
}

interface DashboardProps {
  onDataUpdate?: (lastUpdated: string) => void;
  refreshTrigger?: number;
  onRefreshStateChange?: (isRefreshing: boolean) => void;
  isAmountHidden?: boolean;
}

export function Dashboard({ onDataUpdate, refreshTrigger, onRefreshStateChange, isAmountHidden = false }: DashboardProps = {}) {
  const [sheetsData, setSheetsData] = useState<SheetsData | null>(null);
  const [watchlistData, setWatchlistData] = useState<WatchlistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | 'name'>('desc');
  const [showTotalAsset, setShowTotalAsset] = useState(false);

  const fetchSheetsData = async () => {
    try {
      setLoading(true);
      if (onRefreshStateChange) {
        onRefreshStateChange(true);
      }
      setError(null);
      
      console.log('Fetching sheets data from server...');
      
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-cee564ea/sheets-data`;
      console.log('Request URL:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          console.error('Error response:', errorData);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          console.error('Could not parse error response:', e);
          const textError = await response.text().catch(() => '');
          if (textError) {
            console.error('Error text:', textError);
            errorMessage = `${errorMessage}: ${textError.substring(0, 100)}`;
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Fetched sheets data:', data);
      setSheetsData(data);
      if (onDataUpdate) {
        onDataUpdate(data.lastUpdated);
      }
    } catch (err) {
      console.error('Failed to fetch sheets data:', err);
      const errorMessage = err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다';
      console.error('Error details:', {
        name: err instanceof Error ? err.name : 'Unknown',
        message: errorMessage,
        stack: err instanceof Error ? err.stack : undefined
      });
      
      // Provide more helpful error messages
      if (errorMessage.includes('Failed to fetch')) {
        setError('서버에 연결할 수 없습니다. Supabase Edge Function이 배포되어 있는지 확인해주세요.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
      if (onRefreshStateChange) {
        onRefreshStateChange(false);
      }
    }
  };

  const fetchWatchlistData = async () => {
    try {
      setWatchlistLoading(true);
      setWatchlistError(null);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-cee564ea/watchlist-data`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          console.error('Watchlist fetch error details:', errorData);
        } catch (parseError) {
          // If response is not JSON, use the status text
          errorMessage = `${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Fetched watchlist data:', data);
      setWatchlistData(data);
    } catch (err) {
      console.error('Failed to fetch watchlist data:', err);
      setWatchlistError(err instanceof Error ? err.message : '관심종목 데이터를 불러오는데 실패했습니다');
      // Set empty data so UI doesn't break
      setWatchlistData({ items: [], lastUpdated: new Date().toISOString() });
    } finally {
      setWatchlistLoading(false);
    }
  };

  useEffect(() => {
    fetchSheetsData();
    fetchWatchlistData();
  }, []);

  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      fetchSheetsData();
      fetchWatchlistData();
    }
  }, [refreshTrigger]);

  // Calculate change rate
  const changeRate = sheetsData && sheetsData.totalAsset > 0
    ? (sheetsData.assetChange / sheetsData.totalAsset) * 100
    : 0;

  // Get transactions or empty array
  const transactions = sheetsData?.transactions || [];

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good Morning';
    if (hour >= 12 && hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Helper function to format amount
  const formatAmount = (amount: number) => {
    return isAmountHidden ? '***' : amount.toLocaleString();
  };

  // Sort watchlist items
  const getSortedWatchlist = () => {
    if (!watchlistData) return [];
    const items = [...watchlistData.items];
    
    if (sortOrder === 'desc') {
      return items.sort((a, b) => b.priceChange - a.priceChange);
    } else if (sortOrder === 'asc') {
      return items.sort((a, b) => a.priceChange - b.priceChange);
    } else {
      return items.sort((a, b) => a.stockName.localeCompare(b.stockName, 'ko'));
    }
  };

  const toggleSortOrder = () => {
    if (sortOrder === 'desc') {
      setSortOrder('asc');
    } else if (sortOrder === 'asc') {
      setSortOrder('name');
    } else {
      setSortOrder('desc');
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 lg:p-8 pt-2 bg-[#dbe1f5] dark:bg-[#0F172A] relative">
      {/* Header Section */}
      <div className="mb-8 relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-700 shadow-sm border border-[--color-gray-200] dark:border-slate-600 flex items-center justify-center">
            {(() => {
              const hour = new Date().getHours();
              if (hour >= 5 && hour < 12) return <Coffee className="w-5 h-5 text-orange-500" />;
              if (hour >= 12 && hour < 18) return <Sunset className="w-5 h-5 text-yellow-500" />;
              return <Moon className="w-5 h-5 text-indigo-500" />;
            })()}
          </div>
          <h2 className="font-bold text-black dark:text-white" style={{ fontSize: '24px' }}>
            {getGreeting()}
          </h2>
        </div>
        
        <button 
          onClick={() => setShowTotalAsset(!showTotalAsset)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all shadow-sm border ${
            showTotalAsset 
            ? 'bg-white dark:bg-slate-800 text-[#3182f6] border-[#3182f6]/20' 
            : 'bg-gray-100 dark:bg-slate-800 text-gray-500 border-transparent dark:text-slate-500'
          }`}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${showTotalAsset ? 'bg-[#3182f6] shadow-[0_0_5px_#3182f6]' : 'bg-gray-400 dark:bg-slate-600'}`} />
          자산총액 {showTotalAsset ? 'ON' : 'OFF'}
        </button>
      </div>
      
      {/* Metric Cards */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${showTotalAsset ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 md:gap-6 mb-8`}>
        {/* Total Asset Card */}
        {showTotalAsset && (
          <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 dark:bg-transparent p-4 dark:p-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 dark:h-28 dark:shadow-none">
            {/* Decorative circles - only in light mode */}
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl dark:hidden" />
            <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-xl dark:hidden" />
            
            <div className="relative h-full">
              {/* Light mode layout */}
              <div className="dark:hidden">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                      <PiggyBank className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-white/90 font-medium">총 자산</span>
                  </div>
                  <div className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full">
                    <span className="text-xs text-white font-semibold">TOTAL</span>
                  </div>
                </div>
                
                <div>
                  {loading ? (
                    <div className="h-10 bg-white/20 rounded-lg animate-pulse" />
                  ) : error ? (
                    <span className="text-white/70 text-sm">오류</span>
                  ) : (
                    <div className="flex items-baseline gap-2 justify-end">
                      <span className="font-bold text-white" style={{ fontSize: '28px' }}>
                        {formatAmount(sheetsData?.totalAsset || 0)}
                      </span>
                      <span className="text-xl text-white/80 font-medium">원</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Dark mode layout - Figma style */}
              <div className="hidden dark:flex flex-col justify-center h-full px-4 bg-[#1e293b] rounded-xl">
                <div className="flex items-center gap-3 mb-1.5">
                  <div className="w-10 h-10 bg-[#ad46ff] rounded-[10px] flex items-center justify-center flex-shrink-0">
                    <PiggyBank className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[#99a1af] text-xs">총 자산</span>
                </div>
                <div className="pl-[52px]">
                  {loading ? (
                    <div className="h-8 w-24 bg-white/10 rounded-lg animate-pulse" />
                  ) : error ? (
                    <span className="text-white/70 text-sm">오류</span>
                  ) : (
                    <span className="font-normal text-white text-2xl">
                      {formatAmount(sheetsData?.totalAsset || 0)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2026년 자산증감 Card */}
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-400 dark:bg-transparent p-4 dark:p-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 dark:h-28 dark:shadow-none">
          {/* Decorative circles - only in light mode */}
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl dark:hidden" />
          <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-xl dark:hidden" />
          
          <div className="relative h-full">
            {/* Light mode layout */}
            <div className="dark:hidden">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-white/90 font-medium">2026년 자산증감</span>
                </div>
              </div>
              
              <div>
                {loading ? (
                  <div className="h-10 bg-white/20 rounded-lg animate-pulse" />
                ) : error ? (
                  <span className="text-white/70 text-sm">오류</span>
                ) : (
                  <div className="flex items-baseline gap-2 justify-end">
                    <span className="font-bold text-white" style={{ fontSize: '28px' }}>
                      {isAmountHidden ? '***' : (sheetsData?.monthlyAssetB1 || '0')}
                    </span>
                    <span className="text-xl text-white/80 font-medium">원</span>
                  </div>
                )}
              </div>
            </div>

            {/* Dark mode layout - Figma style */}
            <div className="hidden dark:flex flex-col justify-center h-full px-4 bg-[#1e293b] rounded-xl">
              <div className="flex items-center gap-3 mb-1.5">
                <div className="w-10 h-10 bg-[#2b7fff] rounded-[10px] flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <span className="text-[#99a1af] text-xs">2026년 자산증감</span>
              </div>
              <div className="pl-[52px]">
                {loading ? (
                  <div className="h-8 w-24 bg-white/10 rounded-lg animate-pulse" />
                ) : error ? (
                  <span className="text-white/70 text-sm">오류</span>
                ) : (
                  <span className="font-normal text-white text-2xl">
                    {isAmountHidden ? '***' : (sheetsData?.monthlyAssetB1 || '0')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Asset Change Card */}
        <div className={`group relative overflow-hidden rounded-2xl p-4 dark:p-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 dark:h-28 dark:shadow-none ${
          sheetsData && sheetsData.assetChange >= 0
            ? 'bg-gradient-to-r from-emerald-400 to-green-500 dark:bg-transparent'
            : 'bg-gradient-to-r from-orange-400 to-red-500 dark:bg-transparent'
        }`}>
          {/* Decorative circles - only in light mode */}
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl dark:hidden" />
          <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-xl dark:hidden" />
          
          <div className="relative h-full">
            {/* Light mode layout */}
            <div className="dark:hidden">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    {sheetsData && sheetsData.assetChange >= 0 ? (
                      <TrendingUp className="w-6 h-6 text-white" />
                    ) : (
                      <TrendingDown className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <span className="text-white/90 font-medium">
                    {(() => {
                      const today = new Date();
                      const month = today.getMonth() + 1;
                      const date = today.getDate();
                      const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
                      const dayName = dayNames[today.getDay()];
                      return `${month}월 ${date}일 ${dayName} 자산 증감`;
                    })()}
                  </span>
                </div>
                <div className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full">
                  <span className="text-xs text-white font-semibold">
                    {sheetsData && sheetsData.assetChange >= 0 ? 'UP' : 'DOWN'}
                  </span>
                </div>
              </div>
              
              <div>
                {loading ? (
                  <div className="h-10 bg-white/20 rounded-lg animate-pulse" />
                ) : error ? (
                  <span className="text-white/70 text-sm">오류</span>
                ) : (
                  <div className="flex items-baseline gap-2 justify-end">
                    <span className="font-bold text-white" style={{ fontSize: '28px' }}>
                      {sheetsData && sheetsData.assetChange > 0 ? '+' : ''}
                      {formatAmount(sheetsData?.assetChange || 0)}
                    </span>
                    <span className="text-xl text-white/80 font-medium">원</span>
                  </div>
                )}
              </div>
            </div>

            {/* Dark mode layout - Figma style */}
            <div className="hidden dark:flex flex-col justify-center h-full px-4 bg-[#1e293b] rounded-xl">
              <div className="flex items-center gap-3 mb-1.5">
                <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0 ${
                  sheetsData && sheetsData.assetChange >= 0 ? 'bg-[#2b7fff]' : 'bg-[#f6339a]'
                }`}>
                  {sheetsData && sheetsData.assetChange >= 0 ? (
                    <TrendingUp className="w-5 h-5 text-white" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-white" />
                  )}
                </div>
                <span className="text-[#99a1af] text-xs">일일 증감</span>
              </div>
              <div className="pl-[52px]">
                {loading ? (
                  <div className="h-8 w-24 bg-white/10 rounded-lg animate-pulse" />
                ) : error ? (
                  <span className="text-white/70 text-sm">오류</span>
                ) : (
                  <span className="font-normal text-white text-2xl">
                    {sheetsData && sheetsData.assetChange > 0 ? '+' : ''}
                    {formatAmount(sheetsData?.assetChange || 0)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Asset Change Card (2월 자산증감) */}
        <div className={`group relative overflow-hidden rounded-2xl p-4 dark:p-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 dark:h-28 dark:shadow-none ${
          sheetsData && !sheetsData.monthlyAssetA1?.toString().startsWith('-')
            ? 'bg-gradient-to-r from-violet-500 to-purple-600 dark:bg-transparent'
            : 'bg-gradient-to-r from-pink-400 to-rose-500 dark:bg-transparent'
        }`}>
          {/* Decorative circles - only in light mode */}
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl dark:hidden" />
          <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-xl dark:hidden" />
          
          <div className="relative h-full">
            {/* Light mode layout */}
            <div className="dark:hidden">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-white/90 font-medium">3월 자산증감</span>
                </div>
                <div className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full">
                  <span className="text-xs text-white font-semibold">
                    {sheetsData && sheetsData.monthlyAssetA1?.toString().startsWith('-') ? 'DOWN' : 'UP'}
                  </span>
                </div>
              </div>
              
              <div>
                {loading ? (
                  <div className="h-10 bg-white/20 rounded-lg animate-pulse" />
                ) : error ? (
                  <span className="text-white/70 text-sm">오류</span>
                ) : (
                  <div className="flex items-baseline gap-2 justify-end">
                    <span className="font-bold text-white" style={{ fontSize: '28px' }}>
                      {isAmountHidden ? '***' : (sheetsData?.monthlyAssetA1 || '0')}
                    </span>
                    <span className="text-xl text-white/80 font-medium">원</span>
                  </div>
                )}
              </div>
            </div>

            {/* Dark mode layout - Figma style */}
            <div className="hidden dark:flex flex-col justify-center h-full px-4 bg-[#1e293b] rounded-xl">
              <div className="flex items-center gap-3 mb-1.5">
                <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0 ${
                  sheetsData && !sheetsData.monthlyAssetA1?.toString().startsWith('-') ? 'bg-[#ad46ff]' : 'bg-[#f6339a]'
                }`}>
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-[#99a1af] text-xs">2월 증감</span>
              </div>
              <div className="pl-[52px]">
                {loading ? (
                  <div className="h-8 w-24 bg-white/10 rounded-lg animate-pulse" />
                ) : error ? (
                  <span className="text-white/70 text-sm">오류</span>
                ) : (
                  <span className="font-normal text-white text-2xl">
                    {isAmountHidden ? '***' : (sheetsData?.monthlyAssetA1 || '0')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-red-50 to-orange-50 border border-red-200">
          <p className="text-red-700 text-sm font-medium">
            ⚠️ 데이터 로드 실패: {error}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
        {/* Recent Transactions - Takes 2 columns */}
        <div className="col-span-1 lg:col-span-2">
          <div className="bg-white/80 dark:bg-[#2a2d3e] backdrop-blur-sm rounded-2xl shadow-lg border border-[--color-border] dark:border-[#1e2939] overflow-hidden">
            <div className="p-6 border-b border-[--color-border] dark:border-[#364153] bg-gradient-to-r from-purple-50/50 to-blue-50/50 dark:from-slate-800/30 dark:to-slate-700/30">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-[--color-text-body] dark:text-[#d1d5dc] flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-white" />
                  </div>
                  자산 증감 상세 내역
                </h3>
                <span className="text-xs text-[--color-text-secondary] dark:text-[#99a1af] bg-white/60 dark:bg-[#364153]/60 px-3 py-1.5 rounded-full">
                  최근 2주간 ({transactions.length}일)
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-12 text-center">
                  <div className="inline-block w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="mt-4 text-[--color-text-secondary] dark:text-[#99a1af]">데이터 로딩 중...</p>
                </div>
              ) : transactions.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-[--color-text-secondary] dark:text-[#99a1af]">표시할 데이터가 없습니다</p>
                </div>
              ) : (
                <>
                  {/* Desktop Table - hidden on mobile */}
                  <table className="w-full hidden md:table">
                    <thead>
                      <tr className="bg-gradient-to-r from-gray-50 to-purple-50/30 dark:from-[#1e2939] dark:to-purple-900/10">
                        <th className="text-left py-4 px-6 text-xs font-semibold text-[--color-text-secondary] dark:text-[#99a1af] uppercase tracking-wider">날짜</th>
                        {showTotalAsset && <th className="text-right py-4 px-6 text-xs font-semibold text-[--color-text-secondary] dark:text-[#99a1af] uppercase tracking-wider">총 자산</th>}
                        {showTotalAsset && <th className="text-right py-4 px-6 text-xs font-semibold text-[--color-text-secondary] dark:text-[#99a1af] uppercase tracking-wider">배당금</th>}
                        <th className="text-right py-4 px-6 text-xs font-semibold text-[--color-text-secondary] dark:text-[#99a1af] uppercase tracking-wider">자산 증감</th>
                        <th className="text-right py-4 px-6 text-xs font-semibold text-[--color-text-secondary] dark:text-[#99a1af] uppercase tracking-wider">증감률</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx, index) => (
                        <tr 
                          key={tx.id} 
                          className={`border-b border-[--color-border] dark:border-[#364153] hover:bg-gradient-to-r hover:from-purple-50/30 hover:to-pink-50/30 dark:hover:from-purple-900/10 dark:hover:to-pink-900/10 transition-colors ${
                            index % 2 === 0 ? 'bg-white dark:bg-[#2a2d3e]' : 'bg-gray-50/30 dark:bg-[#1e2939]'
                          }`}
                        >
                          <td className="py-4 px-6">
                            <span className="text-sm font-medium text-[--color-text-body] dark:text-[#d1d5dc]">{tx.date}</span>
                          </td>
                          {showTotalAsset && (
                            <td className="py-4 px-6 text-right">
                              <span className="text-sm font-semibold text-[--color-text-body] dark:text-[#d1d5dc]">
                                {formatAmount(tx.totalAsset)}원
                              </span>
                            </td>
                          )}
                          {showTotalAsset && (
                            <td className="py-4 px-6 text-right">
                              <span className="inline-flex items-center gap-1 text-sm font-semibold text-red-600 dark:text-red-400">
                                <ArrowUpRight className="w-3 h-3" />
                                {formatAmount(tx.dividend)}원
                              </span>
                            </td>
                          )}
                          <td className={`py-4 px-6 text-right ${
                            tx.assetChange > 0 ? 'text-red-600 dark:text-red-400' : tx.assetChange < 0 ? 'text-blue-600 dark:text-blue-400' : 'text-[--color-text-body] dark:text-[#d1d5dc]'
                          }`}>
                            <span className="inline-flex items-center gap-1 text-sm font-semibold">
                              {tx.assetChange > 0 && <ArrowUpRight className="w-3 h-3" />}
                              {tx.assetChange < 0 && <ArrowDownRight className="w-3 h-3" />}
                              {tx.assetChange > 0 ? '+' : ''}{formatAmount(tx.assetChange)}원
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                              tx.changeRate > 0 
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' 
                                : tx.changeRate < 0 
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' 
                                : 'bg-gray-100 dark:bg-gray-700/30 text-gray-700 dark:text-gray-400'
                            }`}>
                              {tx.changeRate > 0 ? '+' : ''}{tx.changeRate.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Mobile Card View - shown only on mobile */}
                  <div className="md:hidden p-4 space-y-3">
                    {transactions.map((tx, index) => (
                      <div 
                        key={tx.id}
                        className={`p-4 rounded-xl border border-[--color-border] dark:border-[#364153] ${
                          index % 2 === 0 ? 'bg-white dark:bg-[#2a2d3e]' : 'bg-gray-50/50 dark:bg-[#1e2939]'
                        }`}
                      >
                        {/* Line 1: Date and Change Rate */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-semibold text-[--color-text-body] dark:text-[#d1d5dc]" style={{ fontSize: '16px' }}>{tx.date}</span>
                          <span className={`inline-flex items-center px-3 py-1.5 rounded-full font-semibold ${
                            tx.changeRate > 0 
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' 
                              : tx.changeRate < 0 
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' 
                              : 'bg-gray-100 dark:bg-gray-700/30 text-gray-700 dark:text-gray-400'
                          }`} style={{ fontSize: '15px' }}>
                            {tx.changeRate > 0 ? '+' : ''}{tx.changeRate.toFixed(2)}%
                          </span>
                        </div>
                        
                        {/* Line 2: Total Asset and Dividend */}
                        <div className="flex items-center justify-between mb-3">
                          {showTotalAsset && (
                            <div className="flex flex-col">
                              <span className="text-[--color-text-secondary] dark:text-[#99a1af] mb-1" style={{ fontSize: '14px' }}>총 자산</span>
                              <span className="font-semibold text-[--color-text-body] dark:text-[#d1d5dc]" style={{ fontSize: '17px' }}>
                                {formatAmount(tx.totalAsset)}원
                              </span>
                            </div>
                          )}
                          {showTotalAsset && (
                            <div className="flex flex-col items-end">
                              <span className="text-[--color-text-secondary] dark:text-[#99a1af] mb-1" style={{ fontSize: '14px' }}>배당금</span>
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400" style={{ fontSize: '17px' }}>
                                <ArrowUpRight className="w-4 h-4" />
                                {formatAmount(tx.dividend)}원
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {/* Line 3: Asset Change */}
                        <div className="pt-3 border-t border-[--color-border] dark:border-[#364153]">
                          <div className="flex items-center justify-between">
                            <span className="text-[--color-text-secondary] dark:text-[#99a1af]" style={{ fontSize: '14px' }}>자산 증감</span>
                            <span className={`inline-flex items-center gap-1 font-semibold ${
                              tx.assetChange > 0 ? 'text-emerald-600 dark:text-emerald-400' : tx.assetChange < 0 ? 'text-red-600 dark:text-red-400' : 'text-[--color-text-body] dark:text-[#d1d5dc]'
                            }`} style={{ fontSize: '17px' }}>
                              {tx.assetChange > 0 && <ArrowUpRight className="w-4 h-4" />}
                              {tx.assetChange < 0 && <ArrowDownRight className="w-4 h-4" />}
                              {tx.assetChange > 0 ? '+' : ''}{formatAmount(tx.assetChange)}원
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Watchlist and Asset Trend Chart */}
        <div className="col-span-1 space-y-4 md:space-y-6">
          {/* Watchlist Card */}
          <div className="bg-white/80 dark:bg-[#2a2d3e] backdrop-blur-sm rounded-2xl shadow-lg border border-[--color-border] dark:border-[#1e2939] p-6 h-full">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-[--color-text-body] dark:text-[#d1d5dc] flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500 to-amber-500 flex items-center justify-center">
                  <Star className="w-4 h-4 text-white" />
                </div>
                관심종목
              </h3>
              <Button
                size="sm"
                variant="ghost"
                className="hover:bg-gray-100 dark:hover:bg-[#364153] transition-all"
                onClick={toggleSortOrder}
              >
                <ArrowUpDown className="w-4 h-4 text-gray-900 dark:text-[#d1d5dc]" />
              </Button>
            </div>
            <div className="space-y-2 overflow-y-auto custom-scrollbar" style={{ maxHeight: '850px' }}>
              {watchlistLoading ? (
                <div className="py-8 text-center">
                  <div className="inline-block w-6 h-6 border-3 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="mt-2 text-xs text-[--color-text-secondary] dark:text-[#99a1af]">로딩 중...</p>
                </div>
              ) : watchlistError ? (
                <div className="py-4 text-center">
                  <p className="text-xs text-red-600 dark:text-red-400">{watchlistError}</p>
                </div>
              ) : watchlistData && watchlistData.items.length > 0 ? (
                getSortedWatchlist().map((item) => (
                  <a 
                    key={item.id}
                    href={`https://www.tossinvest.com/stocks/${item.ticker.startsWith('A') || !/^\d+$/.test(item.ticker) ? item.ticker : 'A' + item.ticker}/order`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-gray-50 to-amber-50/30 dark:from-[#1e2939] dark:to-amber-900/10 border border-[--color-border] dark:border-[#364153] hover:shadow-md transition-all cursor-pointer"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-[--color-text-body] dark:text-[#d1d5dc]">{item.stockName}</span>
                      <span className="text-xs text-[--color-text-secondary] dark:text-[#99a1af] mt-0.5">
                        {formatAmount(item.currentPrice)}원
                      </span>
                    </div>
                    <span className={`text-sm font-semibold ${
                      item.priceChange > 0 ? 'text-red-600 dark:text-red-400' : item.priceChange < 0 ? 'text-blue-600 dark:text-blue-400' : 'text-[--color-text-body] dark:text-[#d1d5dc]'
                    }`}>
                      {item.priceChange > 0 ? '+' : ''}{item.priceChange.toFixed(2)}%
                    </span>
                  </a>
                ))
              ) : (
                <div className="py-8 text-center">
                  <p className="text-xs text-[--color-text-secondary] dark:text-[#99a1af]">관심종목이 없습니다</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}