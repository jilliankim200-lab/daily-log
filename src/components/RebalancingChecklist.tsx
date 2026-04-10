import { useState } from "react";
import { Card } from "./ui/card";
import { MIcon } from "./MIcon";
import { RebalancingHelpModal } from "./RebalancingHelpModal";

export function RebalancingChecklist() {
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  // State for each checkbox
  const [checks, setChecks] = useState({
    // 시장 상태 확인
    kospi120Up: false,
    kospi120Down: false,
    kospi60Up: false,
    kospi60Down: false,
    sp500120Up: false,
    sp500120Down: false,
    
    // 리스크 모드
    riskOn: false,
    riskNeutral: false,
    riskOff: false,
    
    // 리스크 온
    stockMaintain: false,
    coveredCall: false,
    shortTermBond: false,
    
    // 중립
    stopBuying: false,
    dividendToShort: false,
    maintainRatio: false,
    
    // 리스크 오프
    reduceStock: false,
    reduceKosdaqNasdaq: false,
    toShortBond: false,
    
    // 수익 보호
    profit30: false,
    sell20to30: false,
    sell60day: false,
    
    // 커버드콜 분배금
    riskOnReinvest: false,
    neutralReinvest: false,
    riskOffReinvest: false,
    
    // 최종 점검
    targetRatio: false,
    noEmotion: false,
    calendarSet: false,
  });

  const toggleCheck = (key: keyof typeof checks) => {
    setChecks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const CheckBox = ({ checked, onClick }: { checked: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      className="flex-shrink-0 transition-all duration-200 hover:scale-110"
    >
      {checked ? (
        <MIcon name="check_circle" size={20} style={{ color: '#0064ff' }} />
      ) : (
        <MIcon name="radio_button_unchecked" size={20} style={{ color: '#d1d5db' }} />
      )}
    </button>
  );

  const handleHelpClick = (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setModalPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    setIsHelpModalOpen(true);
  };

  const handleModalMouseDown = (event: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({ x: event.clientX - modalPosition.x, y: event.clientY - modalPosition.y });
  };

  const handleModalMouseMove = (event: React.MouseEvent) => {
    if (isDragging) {
      setModalPosition({ x: event.clientX - dragOffset.x, y: event.clientY - dragOffset.y });
    }
  };

  const handleModalMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 lg:p-8 bg-[#dbe1f5] dark:bg-[#0F172A]">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-[20px] font-bold text-black dark:text-white">리밸런싱 체크리스트</h1>
          <button
            onClick={() => setIsHelpModalOpen(true)}
            className="p-1.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
            aria-label="도움말"
          >
            <MIcon name="help" size={20} style={{ color: '#3b82f6' }} />
          </button>
        </div>
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">월 1회 · 같은 날 · 같은 차트 · 종가 기준</p>

        <div className="space-y-4">
          {/* ① 시장 상태 확인 */}
          <Card className="p-5 bg-white dark:bg-[#1e293b] border-0 dark:border dark:border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <MIcon name="visibility" size={20} style={{ color: '#2563eb' }} />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">① 시장 상태 확인</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">2분</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* 코스피 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">🇰🇷</span>
                  <span className="font-medium text-gray-900 dark:text-white">코스피</span>
                </div>
                <div className="ml-8 space-y-2">
                  <div className="flex items-center gap-3">
                    <CheckBox checked={checks.kospi120Up} onClick={() => toggleCheck('kospi120Up')} />
                    <span className="text-sm text-gray-700 dark:text-gray-300">120일선 위 / 아래</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckBox checked={checks.kospi60Up} onClick={() => toggleCheck('kospi60Up')} />
                    <span className="text-sm text-gray-700 dark:text-gray-300">60일선 위 / 아래</span>
                  </div>
                </div>
              </div>

              {/* S&P500 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">🇺🇸</span>
                  <span className="font-medium text-gray-900 dark:text-white">S&P500</span>
                </div>
                <div className="ml-8 space-y-2">
                  <div className="flex items-center gap-3">
                    <CheckBox checked={checks.sp500120Up} onClick={() => toggleCheck('sp500120Up')} />
                    <span className="text-sm text-gray-700 dark:text-gray-300">120일선 위 / 아래</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* ② 리스크 모드 결정 */}
          <Card className="p-5 bg-white dark:bg-[#1e293b] border-0 dark:border dark:border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
                <MIcon name="trending_up" size={20} style={{ color: '#9333ea' }} />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">② 리스크 모드 결정</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">1분</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                <CheckBox checked={checks.riskOn} onClick={() => toggleCheck('riskOn')} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">🟢</span>
                    <span className="font-medium text-gray-900 dark:text-white">리스크 온</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">코스피 & S&P500 모두 120일선 위</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                <CheckBox checked={checks.riskNeutral} onClick={() => toggleCheck('riskNeutral')} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">🟡</span>
                    <span className="font-medium text-gray-900 dark:text-white">중립</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">한쪽만 120일선 이탈</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                <CheckBox checked={checks.riskOff} onClick={() => toggleCheck('riskOff')} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">🔴</span>
                    <span className="font-medium text-gray-900 dark:text-white">리스크 오프</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">둘 다 120일선 아래</p>
                </div>
              </div>
            </div>
          </Card>

          {/* ③ 비중 조정 규칙 */}
          <Card className="p-5 bg-white dark:bg-[#1e293b] border-0 dark:border dark:border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-pink-50 dark:bg-pink-900/30 flex items-center justify-center">
                <MIcon name="my_location" size={20} style={{ color: '#db2777' }} />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">③ 비중 조정 규칙</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">핵심</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* 리스크 온 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">🟢</span>
                  <span className="font-medium text-gray-900 dark:text-white">리스크 온</span>
                </div>
                <div className="ml-8 space-y-2">
                  <div className="flex items-center gap-3">
                    <CheckBox checked={checks.stockMaintain} onClick={() => toggleCheck('stockMaintain')} />
                    <span className="text-sm text-gray-700 dark:text-gray-300">주식 비중 유지 또는 +2% 이내</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckBox checked={checks.coveredCall} onClick={() => toggleCheck('coveredCall')} />
                    <span className="text-sm text-gray-700 dark:text-gray-300">커버드콜 유지</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckBox checked={checks.shortTermBond} onClick={() => toggleCheck('shortTermBond')} />
                    <span className="text-sm text-gray-700 dark:text-gray-300">단기채 감소 금지</span>
                  </div>
                </div>
              </div>

              {/* 중립 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">🟡</span>
                  <span className="font-medium text-gray-900 dark:text-white">중립</span>
                </div>
                <div className="ml-8 space-y-2">
                  <div className="flex items-center gap-3">
                    <CheckBox checked={checks.stopBuying} onClick={() => toggleCheck('stopBuying')} />
                    <span className="text-sm text-gray-700 dark:text-gray-300">신규 매수 중단</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckBox checked={checks.dividendToShort} onClick={() => toggleCheck('dividendToShort')} />
                    <span className="text-sm text-gray-700 dark:text-gray-300">커버드콜 분배금 → 단기채</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckBox checked={checks.maintainRatio} onClick={() => toggleCheck('maintainRatio')} />
                    <span className="text-sm text-gray-700 dark:text-gray-300">기존 비중 유지</span>
                  </div>
                </div>
              </div>

              {/* 리스크 오프 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">🔴</span>
                  <span className="font-medium text-gray-900 dark:text-white">리스크 오프</span>
                </div>
                <div className="ml-8 space-y-2">
                  <div className="flex items-center gap-3">
                    <CheckBox checked={checks.reduceStock} onClick={() => toggleCheck('reduceStock')} />
                    <span className="text-sm text-gray-700 dark:text-gray-300">주식 비중 –20%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckBox checked={checks.reduceKosdaqNasdaq} onClick={() => toggleCheck('reduceKosdaqNasdaq')} />
                    <span className="text-sm text-gray-700 dark:text-gray-300">코스닥·나스닥 우선 축소</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckBox checked={checks.toShortBond} onClick={() => toggleCheck('toShortBond')} />
                    <span className="text-sm text-gray-700 dark:text-gray-300">축소 금액 → 단기채</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* ④ 수익 보호 규칙 */}
          <Card className="p-5 bg-white dark:bg-[#1e293b] border-0 dark:border dark:border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center">
                <MIcon name="error" size={20} style={{ color: '#ea580c' }} />
              </div>
              <h2 className="font-semibold text-gray-900 dark:text-white">④ 수익 보호 규칙</h2>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <CheckBox checked={checks.profit30} onClick={() => toggleCheck('profit30')} />
                <span className="text-sm text-gray-700 dark:text-gray-300">수익률 +30% 이상 자산 발생?</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckBox checked={checks.sell20to30} onClick={() => toggleCheck('sell20to30')} />
                <span className="text-sm text-gray-700 dark:text-gray-300">20~30% 비중 확정 매도</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckBox checked={checks.sell60day} onClick={() => toggleCheck('sell60day')} />
                <span className="text-sm text-gray-700 dark:text-gray-300">잔여 물량: 60일선 이탈 시 전량 정리</span>
              </div>
            </div>
          </Card>

          {/* ⑤ 커버드콜 분배금 재투자 */}
          <Card className="p-5 bg-white dark:bg-[#1e293b] border-0 dark:border dark:border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
                <MIcon name="attach_money" size={20} style={{ color: '#16a34a' }} />
              </div>
              <h2 className="font-semibold text-gray-900 dark:text-white">⑤ 커버드콜 분배금 재투자</h2>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <CheckBox checked={checks.riskOnReinvest} onClick={() => toggleCheck('riskOnReinvest')} />
                <div className="flex items-center gap-2">
                  <span className="text-lg">🟢</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">리스크 온 → 나스닥 / 코스피</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CheckBox checked={checks.neutralReinvest} onClick={() => toggleCheck('neutralReinvest')} />
                <div className="flex items-center gap-2">
                  <span className="text-lg">🟡</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">중립 → 단기채</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CheckBox checked={checks.riskOffReinvest} onClick={() => toggleCheck('riskOffReinvest')} />
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔴</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">리스크 오프 → 단기채만</span>
                </div>
              </div>
            </div>
          </Card>

          {/* ⑥ 최종 점검 */}
          <Card className="p-5 bg-white dark:bg-[#1e293b] border-0 dark:border dark:border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                <MIcon name="calendar_today" size={20} style={{ color: '#4f46e5' }} />
              </div>
              <h2 className="font-semibold text-gray-900 dark:text-white">⑥ 최종 점검</h2>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <CheckBox checked={checks.targetRatio} onClick={() => toggleCheck('targetRatio')} />
                <span className="text-sm text-gray-700 dark:text-gray-300">목표 비중 ±3% 이내</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckBox checked={checks.noEmotion} onClick={() => toggleCheck('noEmotion')} />
                <span className="text-sm text-gray-700 dark:text-gray-300">감정 개입 없음 (뉴스·예측 배제)</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckBox checked={checks.calendarSet} onClick={() => toggleCheck('calendarSet')} />
                <span className="text-sm text-gray-700 dark:text-gray-300">다음 점검일 캘린더 등록</span>
              </div>
            </div>
          </Card>

          {/* 기억할 한 문장 */}
          <Card className="p-6 bg-gradient-to-r from-blue-500 to-purple-600 border-0 text-center">
            <p className="text-sm text-white/80 mb-2">기억할 한 문장</p>
            <p className="text-xl font-bold text-white">"예측하지 말고, 규칙대로만 한다."</p>
          </Card>
        </div>

        {/* Help Modal */}
        <RebalancingHelpModal 
          isOpen={isHelpModalOpen}
          onClose={() => setIsHelpModalOpen(false)}
        />
      </div>
    </div>
  );
}