import { useState, useEffect } from 'react';
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { RefreshCw, Eye, EyeOff, Info, BookOpen, X, ExternalLink } from "lucide-react";
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface EntryManagementProps {
  isAmountHidden: boolean;
}

interface EntryData {
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
}

export function EntryManagement({ isAmountHidden }: EntryManagementProps) {
  const [data, setData] = useState<EntryData[]>([]);
  const [headers, setHeaders] = useState<EntryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showTooltipH, setShowTooltipH] = useState(false);
  const [showTooltipO, setShowTooltipO] = useState(false);
  const [showTooltipR, setShowTooltipR] = useState(false);
  const [showTooltipM, setShowTooltipM] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-cee564ea/entry-management`,
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
        throw new Error(result.details || result.error);
      }

      setHeaders(result.headers || null);
      setData(result.data || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching entry management data:', err);
      setError(err instanceof Error ? err.message : '데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (value: string): string => {
    if (isAmountHidden && /^\d+$/.test(value.replace(/[,.%]/g, ''))) return '****';
    return value || '-';
  };

  // 기본 표시할 컬럼들 (A, B, C, H, I, M, N, O, R)
  const defaultColumns = ['A', 'B', 'C', 'H', 'I', 'M', 'N', 'O', 'R'];
  const allColumns = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S'];
  const columnsToShow = showAllColumns ? allColumns : defaultColumns;

  useEffect(() => {
    fetchData();
  }, []);

  // 티커 링크 생성 (토스증권)
  const createTickerLink = (ticker: string) => {
    if (!ticker || ticker === "****") return "#";
    const formattedTicker = ticker.startsWith('A') || !/^\d+$/.test(ticker) 
      ? ticker 
      : `A${ticker}`;
    return `https://www.tossinvest.com/stocks/${formattedTicker}/order`;
  };

  return (
    <div className="min-h-screen bg-[#dbe1f5] dark:bg-[#0F172A] p-4 md:p-8">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-[--color-text-body] dark:text-white mb-1">
                진입관리
              </h1>
              <p className="text-sm text-[--color-text-secondary] dark:text-gray-400">
                실시간 종목 진입 및 신호 분석
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setShowAllColumns(!showAllColumns)}
                variant="outline"
                className="bg-white dark:bg-[#1e293b] border-[--color-border] dark:border-[#334155] text-[13px] h-9 px-3 gap-2 rounded-md"
              >
                {showAllColumns ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    기본 컬럼
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    전체 컬럼
                  </>
                )}
              </Button>
              <Button
                onClick={() => setShowGuide(true)}
                variant="outline"
                className="bg-white dark:bg-[#1e293b] border-[--color-border] dark:border-[#334155] text-[13px] h-9 px-3 gap-2 rounded-md"
              >
                <BookOpen className="w-3.5 h-3.5" />
                가이드
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
            <p className="text-xs text-[--color-text-secondary] dark:text-gray-400">
              마지막 업데이트: {lastUpdated.toLocaleString('ko-KR')}
            </p>
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
                      {col === 'H' ? (
                        <div className="relative inline-flex items-center gap-1.5">
                          <span>{headers[col as keyof EntryData] || col}</span>
                          <Info 
                            className="w-3.5 h-3.5 text-purple-500 cursor-help" 
                            onMouseEnter={() => setShowTooltipH(true)}
                            onMouseLeave={() => setShowTooltipH(false)}
                          />
                        </div>
                      ) : col === 'I' ? (
                        <div className="relative inline-flex items-center gap-1.5">
                          <span>{headers[col as keyof EntryData] || col}</span>
                          <Info 
                            className="w-3.5 h-3.5 text-blue-500 cursor-help" 
                            onMouseEnter={() => setShowTooltip(true)}
                            onMouseLeave={() => setShowTooltip(false)}
                          />
                        </div>
                      ) : col === 'O' ? (
                        <div className="relative inline-flex items-center gap-1.5">
                          <span>{headers[col as keyof EntryData] || col}</span>
                          <Info 
                            className="w-3.5 h-3.5 text-green-500 cursor-help" 
                            onMouseEnter={() => setShowTooltipO(true)}
                            onMouseLeave={() => setShowTooltipO(false)}
                          />
                        </div>
                      ) : col === 'R' ? (
                        <div className="relative inline-flex items-center gap-1.5">
                          <span>{headers[col as keyof EntryData] || col}</span>
                          <Info 
                            className="w-3.5 h-3.5 text-red-500 cursor-help" 
                            onMouseEnter={() => setShowTooltipR(true)}
                            onMouseLeave={() => setShowTooltipR(false)}
                          />
                        </div>
                      ) : col === 'M' ? (
                        <div className="relative inline-flex items-center gap-1.5">
                          <span>{headers[col as keyof EntryData] || col}</span>
                          <Info 
                            className="w-3.5 h-3.5 text-amber-500 cursor-help" 
                            onMouseEnter={() => setShowTooltipM(true)}
                            onMouseLeave={() => setShowTooltipM(false)}
                          />
                        </div>
                      ) : (
                        headers[col as keyof EntryData] || col
                      )}
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
                        const value = row[col as keyof EntryData];
                        const formattedValue = formatValue(value);
                        const isTicker = col === 'A';
                        const isName = col === 'B';
                        
                        // H열 색상 처리
                        let colorClass = '';
                        if (col === 'H' && value && !isAmountHidden) {
                          const numValue = parseFloat(value);
                          if (!isNaN(numValue)) {
                            if (numValue <= 0.2) colorClass = 'text-green-600 dark:text-green-400 font-bold';
                            else if (numValue >= 0.8) colorClass = 'text-red-600 dark:text-red-400 font-bold';
                          }
                        }

                        // MA20/MA60 뱃지 처리
                        const isMABadge = (val: string) => {
                          return val?.includes("MA") && (val?.includes("위") || val?.includes("아래") || val?.includes("▲") || val?.includes("▼"));
                        };
                        
                        return (
                          <td
                            key={col}
                            className={`px-4 py-3.5 text-[13px] whitespace-nowrap transition-colors ${
                              colorClass || 'text-[--color-text-body] dark:text-gray-300'
                            } ${
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
                            ) : isMABadge(value) && !isAmountHidden ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                value.includes('▲') || value.includes('위')
                                  ? 'bg-red-50 text-red-600 border border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30' 
                                  : 'bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30'
                              }`}>
                                {value}
                              </span>
                            ) : (
                              <span className={/^-/.test(value) ? 'text-blue-600 dark:text-blue-400' : /^[+]/.test(value) ? 'text-red-600 dark:text-red-400' : ''}>
                                {formattedValue}
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
                      데이터가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Tooltips & Modals */}
        {showGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <Card className="w-full max-w-2xl bg-white dark:bg-[#1e293b] border-none overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-500" />
                  진입관리 가이드
                </h2>
                <button onClick={() => setShowGuide(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white border-l-4 border-purple-500 pl-3">H열: 상대 위치 (0~1)</h3>
                  <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl space-y-2 text-sm">
                    <p>• <span className="text-green-600 dark:text-green-400 font-bold">0.2 이하</span>: 최근 60일 내 저점권 (매수 고려)</p>
                    <p>• <span className="text-red-600 dark:text-red-400 font-bold">0.8 이상</span>: 최근 60일 내 고점권 (경계)</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white border-l-4 border-blue-500 pl-3">R열: 매수 신호</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                      <p className="font-bold text-emerald-700 dark:text-emerald-400 mb-1">🚀 본 매수</p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-500">가격 메리트와 추세가 모두 확인됨</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30">
                      <p className="font-bold text-blue-700 dark:text-blue-400 mb-1">🧪 시험 매수</p>
                      <p className="text-xs text-blue-600 dark:text-blue-500">가격은 저렴하나 추세 확인 중</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 text-center">
                <Button onClick={() => setShowGuide(false)} className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto px-10">확인</Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
