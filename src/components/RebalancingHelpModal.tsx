import { useState, useRef, useEffect } from "react";
import { MIcon } from "./MIcon";
import { RiskModeHelpModal } from "./RiskModeHelpModal";

interface RebalancingHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RebalancingHelpModal({ isOpen, onClose }: RebalancingHelpModalProps) {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isRiskModeHelpOpen, setIsRiskModeHelpOpen] = useState(false);
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

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.modal-header')) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      
      // Keep modal within viewport
      const maxX = window.innerWidth - (modalRef.current?.offsetWidth || 0);
      const maxY = window.innerHeight - (modalRef.current?.offsetHeight || 0);
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

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
        className="fixed z-50 bg-white dark:bg-[#1e293b] rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-3xl"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          maxHeight: '85vh',
          cursor: isDragging ? 'grabbing' : 'default'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Header - Draggable */}
        <div className="modal-header sticky top-0 z-10 bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4 rounded-t-2xl cursor-grab active:cursor-grabbing">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">📖 리밸런싱 가이드</h2>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/20 rounded-lg"
            >
              <MIcon name="close" size={20} />
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="overflow-y-auto px-6 py-4 space-y-6" style={{ maxHeight: 'calc(85vh - 80px)' }}>
          {/* ① 시장 상태 확인 */}
          <section className="space-y-3">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-blue-500">①</span> 시장 상태 확인 → 판단만, 매매 X
            </h3>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl space-y-2">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <strong>코스피 / S&P500 120일선·60일선</strong>
              </p>
              
              <div className="mt-3">
                <p className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2">✅ 할 일</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 ml-4">
                  • 차트 열고 종가 기준으로 위/아래만 체크
                </p>
              </div>

              <div className="mt-3">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">❌ 하지 말 것</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 ml-4">
                  • "너무 올랐다 / 곧 빠질 것 같다" 해석 금지<br />
                  • 뉴스, 전망 참고 금지
                </p>
              </div>

              <div className="mt-3 bg-white/50 dark:bg-slate-800/50 p-3 rounded-lg">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  👉 이 단계는 <strong>결정용 신호 수집</strong>이지 행동 단계가 아님
                </p>
              </div>
            </div>
          </section>

          {/* ② 리스크 모드 결정 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span className="text-purple-500">②</span> 리스크 모드 결정 → 이번 달 전략 스위치
              </h3>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsRiskModeHelpOpen(true);
                }}
                className="p-1 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                aria-label="리스크 모드 상세 도움말"
              >
                <MIcon name="help" size={16} style={{ color: '#a855f7' }} />
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl">
                <p className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2">🟢 리스크 온</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>의미:</strong> 시장이 상승 추세 유지<br />
                  <strong>마음가짐:</strong> "공격하되, 무리하지 않는다"
                </p>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl">
                <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 mb-2">🟡 중립</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>의미:</strong> 방향성 불확실<br />
                  <strong>마음가짐:</strong> "지키는 달"
                </p>
              </div>

              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">🔴 리스크 오프</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>의미:</strong> 하락 추세<br />
                  <strong>마음가짐:</strong> "수익보다 생존"
                </p>
              </div>

              <div className="bg-white/50 dark:bg-slate-800/50 p-3 rounded-lg">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  👉 이걸 정해야 <strong>아래 모든 행동이 자동으로 결정됨</strong>
                </p>
              </div>
            </div>
          </section>

          {/* ③ 비중 조정 규칙 */}
          <section className="space-y-3">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-pink-500">③</span> 비중 조정 규칙 → 실제 매매 단계
            </h3>

            <div className="space-y-4">
              {/* 리스크 온 */}
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl space-y-2">
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">🟢 리스크 온일 때</p>
                
                <div className="ml-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-300">주식 비중 유지 또는 +2%</p>
                    <p className="text-xs ml-4">
                      👉 이미 목표치면 아무것도 안 해도 됨<br />
                      👉 늘려도 전체의 2%까지만
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-300">단기채 감소 금지</p>
                    <p className="text-xs ml-4">
                      👉 "주식 늘리자고 안전자산을 팔지 않는다"
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-300">커버드콜 유지</p>
                    <p className="text-xs ml-4">
                      👉 현금흐름은 그대로 가져간다
                    </p>
                  </div>
                </div>

                <div className="bg-white/50 dark:bg-slate-800/50 p-2 rounded-lg mt-3">
                  <p className="text-xs text-gray-700 dark:text-gray-300">
                    📌 핵심: <strong>공격장이어도 방어선은 남겨둔다</strong>
                  </p>
                </div>
              </div>

              {/* 중립 */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl space-y-2">
                <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">🟡 중립일 때</p>
                
                <div className="ml-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-300">신규 매수 중단</p>
                    <p className="text-xs ml-4">
                      👉 추가 진입 X, 물타기 X
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-300">커버드콜 분배금 → 단기채</p>
                    <p className="text-xs ml-4">
                      👉 새 돈은 전부 안전자산으로
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-300">기존 비중 유지</p>
                    <p className="text-xs ml-4">
                      👉 팔지도, 사지도 않는다
                    </p>
                  </div>
                </div>

                <div className="bg-white/50 dark:bg-slate-800/50 p-2 rounded-lg mt-3">
                  <p className="text-xs text-gray-700 dark:text-gray-300">
                    📌 핵심: <strong>"아무것도 안 하는 것도 전략"</strong>
                  </p>
                </div>
              </div>

              {/* 리스크 오프 */}
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl space-y-2">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">🔴 리스크 오프일 때</p>
                
                <div className="ml-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-300">주식 비중 –20%</p>
                    <p className="text-xs ml-4">
                      👉 전체 주식에서 20% 줄이기
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-300">코스닥·나스닥 우선 축소</p>
                    <p className="text-xs ml-4">
                      👉 변동성 큰 자산부터 정리
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-300">줄인 금액 → 단기채</p>
                    <p className="text-xs ml-4">
                      👉 현금 보관 ❌, 단기채로 이동 ⭕
                    </p>
                  </div>
                </div>

                <div className="bg-white/50 dark:bg-slate-800/50 p-2 rounded-lg mt-3">
                  <p className="text-xs text-gray-700 dark:text-gray-300">
                    📌 핵심: <strong>"손실 확정이 아니라 위험 제거"</strong>
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ④ 수익 보호 규칙 */}
          <section className="space-y-3">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-orange-500">④</span> 수익 보호 규칙 → 이미 번 돈 지키기
            </h3>
            
            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl space-y-3">
              <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">수익률 +30% 이상 자산 발생 시</p>
              
              <div className="ml-4 space-y-3 text-sm text-gray-600 dark:text-gray-400">
                <div>
                  <p className="font-medium text-gray-700 dark:text-gray-300">1️⃣ 20~30% 비중 확정 매도</p>
                  <p className="text-xs ml-4">
                    예: 1천만 원 → 200~300만 원 먼저 회수<br />
                    👉 "수익 일부는 현실화"
                  </p>
                </div>

                <div>
                  <p className="font-medium text-gray-700 dark:text-gray-300">2️⃣ 남은 물량</p>
                  <p className="text-xs ml-4">
                    60일선 이탈 시 → 전량 정리<br />
                    👉 추세가 꺾이면 미련 없이 종료
                  </p>
                </div>
              </div>

              <div className="bg-white/50 dark:bg-slate-800/50 p-2 rounded-lg">
                <p className="text-xs text-gray-700 dark:text-gray-300">
                  📌 핵심: <strong>"수익은 자동으로 보호한다"</strong>
                </p>
              </div>
            </div>
          </section>

          {/* ⑤ 커버드콜 분배금 재투자 */}
          <section className="space-y-3">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-green-500">⑤</span> 커버드콜 분배금 → 재투자 방향 통제
            </h3>
            
            <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl space-y-2">
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <p>
                  <span className="text-lg">🟢</span> <strong>리스크 온</strong> → 나스닥 / 코스피<br />
                  <span className="text-xs ml-6">(시장 좋을 때만 위험자산으로 환류)</span>
                </p>
                <p>
                  <span className="text-lg">🟡</span> <strong>중립</strong> → 단기채<br />
                  <span className="text-xs ml-6">(현금흐름을 안전자산으로 이동)</span>
                </p>
                <p>
                  <span className="text-lg">🔴</span> <strong>리스크 오프</strong> → 단기채만<br />
                  <span className="text-xs ml-6">(주식 재진입 금지)</span>
                </p>
              </div>

              <div className="bg-white/50 dark:bg-slate-800/50 p-2 rounded-lg mt-3">
                <p className="text-xs text-gray-700 dark:text-gray-300">
                  📌 핵심: <strong>"분배금도 감정 없이 운용"</strong>
                </p>
              </div>
            </div>
          </section>

          {/* ⑥ 최종 점검 */}
          <section className="space-y-3">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-indigo-500">⑥</span> 최종 점검 → 실수 방지 단계
            </h3>
            
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl space-y-2">
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <p>
                  <strong>목표 비중 ±3% 이내</strong><br />
                  <span className="text-xs ml-4">👉 너무 정확할 필요 없음</span>
                </p>
                <p>
                  <strong>감정 개입 없음</strong><br />
                  <span className="text-xs ml-4">👉 "이번엔 다를 것 같아" = 금지어</span>
                </p>
                <p>
                  <strong>다음 점검일 캘린더 등록</strong><br />
                  <span className="text-xs ml-4">👉 중간에 또 열어보지 않기</span>
                </p>
              </div>
            </div>
          </section>

          {/* 진짜 목적 */}
          <section className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 rounded-xl">
            <h3 className="text-lg font-bold text-white mb-3">이 체크리스트의 진짜 목적</h3>
            <div className="space-y-2 text-sm text-white/90">
              <p>❌ 수익 극대화</p>
              <p>⭕ <strong>큰 실수 방지 + 오래 살아남기</strong></p>
            </div>
          </section>
        </div>
      </div>

      {/* Risk Mode Help Modal */}
      <RiskModeHelpModal
        isOpen={isRiskModeHelpOpen}
        onClose={() => setIsRiskModeHelpOpen(false)}
      />
    </>
  );
}