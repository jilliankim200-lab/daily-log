import { useState, useRef, useEffect } from "react";
import { X, TrendingUp, TrendingDown } from "lucide-react";

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

interface MarketIndicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: MarketIndicesData;
}

export function MarketIndicesModal({ isOpen, onClose, data }: MarketIndicesModalProps) {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && modalRef.current) {
      // Center the modal on open
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const modalWidth = modalRef.current.offsetWidth;
      const modalHeight = modalRef.current.offsetHeight;
      
      setPosition({
        x: Math.max(0, (windowWidth - modalWidth) / 2),
        y: Math.max(0, (windowHeight - modalHeight) / 2)
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;
        
        const maxX = window.innerWidth - (modalRef.current?.offsetWidth || 0);
        const maxY = window.innerHeight - (modalRef.current?.offsetHeight || 0);
        
        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
        });
      };

      const handleGlobalMouseUp = () => {
        setIsDragging(false);
      };

      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.modal-header')) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const renderIndex = (label: string, indexData?: IndexData) => {
    if (!indexData || indexData.error) {
      return (
        <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl">
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{label}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">데이터를 불러올 수 없습니다</p>
        </div>
      );
    }

    const isPositive = indexData.change >= 0;
    const changeColor = isPositive 
      ? 'text-red-600 dark:text-red-400' 
      : 'text-blue-600 dark:text-blue-400';
    const bgColor = isPositive
      ? 'bg-red-50 dark:bg-red-900/20'
      : 'bg-blue-50 dark:bg-blue-900/20';

    return (
      <div className={`${bgColor} p-4 rounded-xl space-y-2`}>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{label}</p>
        <div className="space-y-1">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {indexData.currentPrice.toLocaleString(undefined, { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            })}
          </p>
          <div className={`flex items-center gap-1 ${changeColor} text-sm font-semibold`}>
            {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span>
              {isPositive ? '+' : ''}{indexData.change.toFixed(2)} ({isPositive ? '+' : ''}{indexData.changePercent.toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 z-50"
        onClick={onClose}
      />

      {/* Draggable Modal */}
      <div
        ref={modalRef}
        className="fixed z-50 bg-white dark:bg-[#1e293b] rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-2xl"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          maxHeight: '85vh',
          cursor: isDragging ? 'grabbing' : 'default'
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Header - Draggable */}
        <div className="modal-header sticky top-0 z-10 bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 rounded-t-2xl cursor-grab active:cursor-grabbing">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">📊 주요지수</h2>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/20 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="overflow-y-auto px-6 py-4 space-y-4" style={{ maxHeight: 'calc(85vh - 80px)' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderIndex('코스피', data.kospi)}
            {renderIndex('코스닥', data.kosdaq)}
            {renderIndex('나스닥', data.nasdaq)}
            {renderIndex('S&P 500', data.sp500)}
          </div>

          {/* Last Updated */}
          <div className="text-center pt-2 border-t border-gray-200 dark:border-slate-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              마지막 업데이트: {new Date(data.lastUpdated).toLocaleString('ko-KR')}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
