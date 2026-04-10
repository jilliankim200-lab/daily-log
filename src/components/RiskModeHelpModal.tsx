import { useState, useRef, useEffect } from "react";
import { MIcon } from "./MIcon";

interface RiskModeHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RiskModeHelpModal({ isOpen, onClose }: RiskModeHelpModalProps) {
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

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 z-[60]"
        onClick={onClose}
      />

      {/* Draggable Modal */}
      <div
        ref={modalRef}
        className="fixed z-[60] bg-white dark:bg-[#1e293b] rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-2xl"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          maxHeight: '85vh',
          cursor: isDragging ? 'grabbing' : 'default'
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Header - Draggable */}
        <div className="modal-header sticky top-0 z-10 bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-4 rounded-t-2xl cursor-grab active:cursor-grabbing">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">🎯 리스크 모드 상세 가이드</h2>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/20 rounded-lg"
            >
              <MIcon name="close" size={20} />
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="overflow-y-auto px-6 py-4 space-y-5" style={{ maxHeight: 'calc(85vh - 80px)' }}>
          {/* ① 리스크 온 */}
          <section className="bg-green-50 dark:bg-green-900/20 p-5 rounded-xl space-y-3">
            <h3 className="text-lg font-bold text-green-700 dark:text-green-400 flex items-center gap-2">
              <span>①</span> 리스크 온 (🟢)
            </h3>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">조건 (모두 충족)</p>
                <div className="ml-4 space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">⬜</span>
                    <span>코스피 120일선 위</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">⬜</span>
                    <span>S&P500 120일선 위</span>
                  </div>
                </div>
              </div>

              <div className="bg-white/60 dark:bg-slate-800/60 p-3 rounded-lg">
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">➡️ 분배금 재투자</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 ml-4">나스닥100 / 코스피 가능</p>
              </div>

              <div className="bg-green-100 dark:bg-green-900/40 p-3 rounded-lg">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>📌 의미:</strong><br />
                  "한국·미국 모두 중기 상승 추세"
                </p>
              </div>
            </div>
          </section>

          {/* ② 중립 */}
          <section className="bg-yellow-50 dark:bg-yellow-900/20 p-5 rounded-xl space-y-3">
            <h3 className="text-lg font-bold text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
              <span>②</span> 중립 (🟡)
            </h3>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">조건 (아래 중 하나라도 해당)</p>
                <div className="ml-4 space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">⬜</span>
                    <span>코스피만 120일선 이탈</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">⬜</span>
                    <span>S&P500만 120일선 이탈</span>
                  </div>
                </div>
              </div>

              <div className="bg-white/60 dark:bg-slate-800/60 p-3 rounded-lg">
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">➡️ 분배금 → 단기채</p>
                <p className="text-sm text-red-600 dark:text-red-400 ml-4">주식 재투자 ❌</p>
              </div>

              <div className="bg-yellow-100 dark:bg-yellow-900/40 p-3 rounded-lg">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>📌 의미:</strong><br />
                  "한쪽은 불안 → 공격 중단"
                </p>
              </div>
            </div>
          </section>

          {/* ③ 리스크 오프 */}
          <section className="bg-red-50 dark:bg-red-900/20 p-5 rounded-xl space-y-3">
            <h3 className="text-lg font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
              <span>③</span> 리스크 오프 (🔴)
            </h3>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">조건 (아래 중 하나라도 해당)</p>
                <div className="ml-4 space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">⬜</span>
                    <span>코스피 + S&P500 모두 120일선 아래</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-gray-400 flex-shrink-0">⬜</span>
                    <span>둘 중 하나라도 120일선 아래에서 2주 이상 회복 실패</span>
                  </div>
                </div>
              </div>

              <div className="bg-white/60 dark:bg-slate-800/60 p-3 rounded-lg space-y-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">➡️ 분배금 전액 단기채</p>
                <p className="text-sm text-red-600 dark:text-red-400 ml-4">• 주식 매수 ❌</p>
                <p className="text-sm text-red-600 dark:text-red-400 ml-4">• 기존 주식도 감축 대상</p>
              </div>

              <div className="bg-red-100 dark:bg-red-900/40 p-3 rounded-lg">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>📌 의미:</strong><br />
                  "방어 모드"
                </p>
              </div>
            </div>
          </section>

          {/* 보조 규칙 */}
          <section className="bg-orange-50 dark:bg-orange-900/20 p-5 rounded-xl space-y-3">
            <h3 className="text-lg font-bold text-orange-700 dark:text-orange-400">
              📌 보조 규칙 (헷갈릴 때 쓰는 안전핀)
            </h3>

            <div className="space-y-3">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                아래 중 <strong>1개만 발생해도</strong> 한 단계 보수적으로 판단
              </p>

              <div className="ml-4 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <div className="flex items-center gap-2">
                  <span>📉</span>
                  <span>주식 비중이 목표 +3% 초과</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>📉</span>
                  <span>VIX 급등 (30 근접 이상)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>📉</span>
                  <span>나스닥 –10% 이상 급락</span>
                </div>
              </div>

              <div className="bg-white/60 dark:bg-slate-800/60 p-3 rounded-lg">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>👉 예:</strong>
                </p>
                <div className="ml-4 mt-1 space-y-0.5 text-sm text-gray-600 dark:text-gray-400">
                  <p>• 리스크 온 → 중립</p>
                  <p>• 중립 → 리스크 오프</p>
                </div>
              </div>
            </div>
          </section>

          {/* 가장 중요한 문장 */}
          <section className="bg-gradient-to-r from-purple-500 to-pink-600 p-6 rounded-xl text-center">
            <p className="text-sm text-white/90 mb-2">🧠 가장 중요한 문장</p>
            <p className="text-lg font-bold text-white leading-relaxed">
              "리스크 온은 기분이 아니라,<br />
              120일선 위냐 아래냐로 결정한다."
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
