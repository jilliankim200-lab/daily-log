import { useState, useEffect } from 'react';
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { RefreshCw, Eye, EyeOff, Info, Globe, ShoppingCart, ExternalLink } from "lucide-react";
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface OverseasPurchaseProps {
  isAmountHidden: boolean;
}

interface PurchaseData {
  A: string;
  B: string;
  C: string;
  D: string;
  E: string;
  F: string;
  G: string;
  H: string;
  I: string;
  J: string;
  K: string;
  L: string;
  M: string;
  N: string;
  O: string;
  P: string;
  Q: string;
  R: string;
  S: string;
  T: string;
  U: string;
}

export function OverseasPurchase({ isAmountHidden }: OverseasPurchaseProps) {
  const [data, setData] = useState<PurchaseData[]>([]);
  const [headers, setHeaders] = useState<PurchaseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showAllColumns, setShowAllColumns] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-cee564ea/overseas-purchase`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`서버 오류: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.error) {
        const errorMsg = result.details ? `${result.error}: ${result.details}` : result.error;
        throw new Error(errorMsg);
      }

      setHeaders(result.headers || null);
      setData(result.data || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching overseas purchase data:', err);
      setError(err instanceof Error ? err.message : '데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (value: string): string => {
    if (isAmountHidden && /^\d+$/.test(value.replace(/[,.%]/g, ''))) return '****';
    return value || '-';
  };

  // 요청받은 기본 출력 컬럼 (A, B, C, I, M, N, O, P, Q, R, T)
  const defaultColumns = ['A', 'B', 'C', 'I', 'M', 'N', 'O', 'P', 'Q', 'R', 'T'];
  // 전체 컬럼 (A-U)
  const allColumns = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U'];
  
  const columnsToShow = showAllColumns ? allColumns : defaultColumns;

  useEffect(() => {
    fetchData();
  }, []);

  // 티커 링크 생성 (토스증권)
  const createTickerLink = (ticker: string) => {
    if (!ticker || ticker === "****") return "#";
    // 티커가 'A'로 시작하거나 숫자가 아니면 (예: US 주식) 그대로 사용, 
    // 숫자만 있으면 (KR 주식) 'A'를 붙임
    const formattedTicker = ticker.startsWith('A') || !/^\d+$/.test(ticker) 
      ? ticker 
      : `A${ticker}`;
    return `https://www.tossinvest.com/stocks/${formattedTicker}/order`;
  };

  return (
    <div className="min-h-screen bg-[#dbe1f5] dark:bg-[#0F172A] p-4 md:p-8">
      <div className="max-w-[1800px] mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                  <Globe className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-[--color-text-body] dark:text-white">
                  해외매수
                </h1>
              </div>
              <p className="text-sm text-[--color-text-secondary] dark:text-gray-400">
                해외 주식 매수 및 포트폴리오 관리
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setShowAllColumns(!showAllColumns)}
                className="bg-white dark:bg-[#1e293b] border-[--color-border] dark:border-[#334155] text-[13px] h-9 px-3 gap-2 rounded-md"
              >
                {showAllColumns ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    기본출력
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    전체컬럼
                  </>
                )}
              </Button>
              <Button
                onClick={fetchData}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white text-[13px] h-9 px-3 gap-2 rounded-md"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                새로고침
              </Button>
            </div>
          </div>
          
          {lastUpdated && (
            <div className="mt-4 flex items-center gap-2 text-xs text-[--color-text-secondary] dark:text-gray-400">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              마지막 업데이트: {lastUpdated.toLocaleString('ko-KR')}
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3">
            <Info className="w-5 h-5 text-red-600 dark:text-red-400" />
            <p className="text-red-800 dark:text-red-400 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Data Table */}
        <Card className="bg-white dark:bg-[#1e293b] border-[--color-border] dark:border-[#334155] rounded-xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-[#0F172A]/50 border-b border-[--color-border] dark:border-[#334155]">
                  {headers && columnsToShow.map((col, index) => (
                    <th
                      key={col}
                      className={`px-4 py-4 text-[12px] font-bold text-[--color-text-secondary] dark:text-gray-400 uppercase tracking-wider whitespace-nowrap ${
                        index < 2 ? 'sticky left-0 z-30 bg-gray-50 dark:bg-[#0F172A]' : ''
                      }`}
                      style={
                        index === 0 ? { minWidth: '100px', left: '0' } :
                        index === 1 ? { minWidth: '180px', left: '100px' } : {}
                      }
                    >
                      <div className="flex items-center gap-1.5">
                        {headers[col as keyof PurchaseData] || col}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[--color-border] dark:divide-[#334155]">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {columnsToShow.map((col) => (
                        <td key={col} className="px-4 py-4">
                          <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : data.length > 0 ? (
                  data.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className="hover:bg-gray-50 dark:hover:bg-[#334155]/30 transition-colors group"
                    >
                      {columnsToShow.map((col, colIndex) => {
                        const value = row[col as keyof PurchaseData];
                        const isTicker = col === 'A';
                        const isName = col === 'B';
                        
                        return (
                          <td
                            key={col}
                            className={`px-4 py-3.5 text-[13px] text-[--color-text-body] dark:text-gray-300 whitespace-nowrap transition-colors ${
                              colIndex < 2 ? 'sticky left-0 z-20 bg-white dark:bg-[#1e293b] group-hover:bg-gray-50 dark:group-hover:bg-[#252f44]' : ''
                            }`}
                            style={
                              colIndex === 0 ? { left: '0' } :
                              colIndex === 1 ? { left: '100px' } : {}
                            }
                          >
                            {isTicker && value && !isAmountHidden ? (
                              <a
                                href={createTickerLink(value)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold group/link"
                              >
                                {value}
                                <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                              </a>
                            ) : isName ? (
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {value}
                              </span>
                            ) : (value === '▼ MA20 아래' || value === '▲ MA20 위' || value === '▼ MA60 아래' || value === '▲ MA60 위') ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                value.includes('▲') 
                                  ? 'bg-red-50 text-red-600 border border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30' 
                                  : 'bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30'
                              }`}>
                                {value}
                              </span>
                            ) : (
                              <span className={/^-/.test(value) ? 'text-blue-600 dark:text-blue-400' : /^[+]/.test(value) ? 'text-red-600 dark:text-red-400' : ''}>
                                {formatValue(value)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={columnsToShow.length}
                      className="px-4 py-20 text-center text-[--color-text-secondary] dark:text-gray-500"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <ShoppingCart className="w-12 h-12 opacity-20" />
                        <p className="text-lg">데이터가 없습니다.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Info Legend */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30 rounded-2xl">
            <h3 className="text-sm font-bold text-blue-900 dark:text-blue-300 mb-3 flex items-center gap-2">
              <Info className="w-4 h-4" />
              필수 컬럼 안내
            </h3>
            <p className="text-xs text-blue-800 dark:text-blue-400 leading-relaxed">
              기본출력 모드에서는 티커, 종목명 등 핵심 정보 11개 항목만 표시됩니다.<br />
              전체 데이터를 확인하시려면 상단의 '전체컬럼' 버튼을 클릭해 주세요.
            </p>
          </Card>
          
          <Card className="p-6 bg-amber-50/50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 rounded-2xl">
            <h3 className="text-sm font-bold text-amber-900 dark:text-amber-300 mb-3 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              매수 원칙
            </h3>
            <p className="text-xs text-amber-800 dark:text-amber-400 leading-relaxed">
              분할 매수 원칙을 준수하고, 포트폴리오 비중을 정기적으로 점검하세요.<br />
              티커를 클릭하면 토스증권 상세 페이지로 연결됩니다.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
