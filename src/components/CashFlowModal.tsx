import { CheckCircle, FileText, X } from "lucide-react";

interface CashFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CashFlowModal({ isOpen, onClose }: CashFlowModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#2a2d3e] rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* 모달 헤더 */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-indigo-600 p-6 rounded-t-2xl flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-white" />
            <h2 className="text-[20px] font-bold text-white">현금흐름표 (51~90세)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* 모달 내용 */}
        <div className="p-6 md:p-8 space-y-6">
          {/* 공통 전제 */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-6 border border-amber-200 dark:border-amber-800/30">
            <h3 className="text-[16px] font-bold text-[--color-text-body] dark:text-[#d1d5dc] mb-4 flex items-center gap-2">
              🔧 시뮬레이션 공통 전제 (확정)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 지출 */}
              <div className="bg-white dark:bg-[#364153] rounded-lg p-4">
                <h4 className="text-[14px] font-bold text-[--color-text-body] dark:text-[#d1d5dc] mb-3">💸 지출</h4>
                <div className="space-y-2 text-[13px] text-[--color-text-secondary] dark:text-[#99a1af]">
                  <p>• 월 생활비: 500만</p>
                  <p>• 연 생활비: 6,000만</p>
                  <p>• 의료비 + 건보료:</p>
                  <p className="pl-4">- 69세까지: 연 500만</p>
                  <p className="pl-4">- 70세 이후: 연 800만</p>
                  <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
                    <p className="font-bold text-[--color-text-body] dark:text-[#d1d5dc]">👉 총 필요 현금</p>
                    <p className="pl-4">- 51~69세: 연 6,500만</p>
                    <p className="pl-4">- 70~90세: 연 6,800만</p>
                  </div>
                </div>
              </div>

              {/* 수입 */}
              <div className="bg-white dark:bg-[#364153] rounded-lg p-4">
                <h4 className="text-[14px] font-bold text-[--color-text-body] dark:text-[#d1d5dc] mb-3">💰 확정 수입 구조</h4>
                <div className="space-y-2 text-[13px] text-[--color-text-secondary] dark:text-[#99a1af]">
                  <p>• 과세계좌 배당: 연 1,200만 (월 100만)</p>
                  <p>• ISA/연금 내부 배당: 계좌 내 재투자</p>
                  <p>• 국민연금: 65세부터 연 1,200만 (부부 합산 가정)</p>
                </div>
              </div>
            </div>
          </div>

          {/* 51~54세 테이블 */}
          <div className="bg-white dark:bg-[#2a2d3e] rounded-xl p-6 border border-[--color-border] dark:border-[#1e2939]">
            <h3 className="text-[15px] font-bold text-[--color-text-body] dark:text-[#d1d5dc] mb-4">
              🔹 ① 51~54세 (ISA 브리지 구간)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-blue-50 dark:bg-blue-900/20">
                    <th className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] font-bold text-[--color-text-body] dark:text-[#d1d5dc]">나이</th>
                    <th className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] font-bold text-[--color-text-body] dark:text-[#d1d5dc]">남편</th>
                    <th className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] font-bold text-[--color-text-body] dark:text-[#d1d5dc]">아내</th>
                    <th className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] font-bold text-[--color-text-body] dark:text-[#d1d5dc]">공통</th>
                    <th className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] font-bold text-blue-600 dark:text-blue-400">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {[51, 52, 53, 54].map((age) => (
                    <tr key={age} className="hover:bg-gray-50 dark:hover:bg-[#364153]">
                      <td className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] text-center font-medium text-[--color-text-body] dark:text-[#d1d5dc]">{age}</td>
                      <td className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] text-center text-[--color-text-secondary] dark:text-[#99a1af]">ISA 2,650만</td>
                      <td className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] text-center text-[--color-text-secondary] dark:text-[#99a1af]">ISA 2,650만</td>
                      <td className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] text-center text-[--color-text-secondary] dark:text-[#99a1af]">배당 1,200만</td>
                      <td className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] text-center font-bold text-blue-600 dark:text-blue-400">6,500만</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800/30">
              <p className="text-[13px] text-[--color-text-body] dark:text-[#d1d5dc]">
                <span className="font-bold">👉 ISA 연 소진액:</span>
              </p>
              <p className="text-[13px] text-[--color-text-secondary] dark:text-[#99a1af] pl-4">• 남편 1.06억</p>
              <p className="text-[13px] text-[--color-text-secondary] dark:text-[#99a1af] pl-4">• 아내 1.06억</p>
              <p className="text-[13px] text-red-600 dark:text-red-400 font-bold pl-4 mt-2">→ 은퇴 전 ISA 추가 적립 전제 (현실적)</p>
            </div>
          </div>

          {/* 55~64세 테이블 */}
          <div className="bg-white dark:bg-[#2a2d3e] rounded-xl p-6 border border-[--color-border] dark:border-[#1e2939]">
            <h3 className="text-[15px] font-bold text-[--color-text-body] dark:text-[#d1d5dc] mb-4">
              🔹 ② 55~64세 (연금 개시, 안정 구간)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-purple-50 dark:bg-purple-900/20">
                    <th className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] font-bold text-[--color-text-body] dark:text-[#d1d5dc]">나이</th>
                    <th className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] font-bold text-[--color-text-body] dark:text-[#d1d5dc]">남편</th>
                    <th className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] font-bold text-[--color-text-body] dark:text-[#d1d5dc]">아내</th>
                    <th className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] font-bold text-[--color-text-body] dark:text-[#d1d5dc]">공통</th>
                    <th className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] font-bold text-purple-600 dark:text-purple-400">합계</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-gray-50 dark:hover:bg-[#364153]">
                    <td className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] text-center font-medium text-[--color-text-body] dark:text-[#d1d5dc]">55~64</td>
                    <td className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] text-center text-[--color-text-secondary] dark:text-[#99a1af]">연금 2,650만</td>
                    <td className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] text-center text-[--color-text-secondary] dark:text-[#99a1af]">연금 2,650만</td>
                    <td className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] text-center text-[--color-text-secondary] dark:text-[#99a1af]">배당 1,200만</td>
                    <td className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] text-center font-bold text-purple-600 dark:text-purple-400">6,500만</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800/30">
              <p className="text-[13px] font-bold text-[--color-text-body] dark:text-[#d1d5dc] mb-2">📌 포인트</p>
              <div className="space-y-1 text-[13px] text-[--color-text-secondary] dark:text-[#99a1af]">
                <p>• 연금소득 = 금융소득 아님</p>
                <p>• 건보 점수 변화 거의 없음</p>
                <p>• ISA 보존</p>
              </div>
            </div>
          </div>

          {/* 65~69세 테이블 */}
          <div className="bg-white dark:bg-[#2a2d3e] rounded-xl p-6 border border-[--color-border] dark:border-[#1e2939]">
            <h3 className="text-[15px] font-bold text-[--color-text-body] dark:text-[#d1d5dc] mb-4">
              🔹 ③ 65~69세 (국민연금 합류)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-emerald-50 dark:bg-emerald-900/20">
                    <th className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] font-bold text-[--color-text-body] dark:text-[#d1d5dc]">나이</th>
                    <th className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] font-bold text-[--color-text-body] dark:text-[#d1d5dc]">남편</th>
                    <th className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] font-bold text-[--color-text-body] dark:text-[#d1d5dc]">아내</th>
                    <th className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] font-bold text-[--color-text-body] dark:text-[#d1d5dc]">공통</th>
                    <th className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] font-bold text-emerald-600 dark:text-emerald-400">합계</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-gray-50 dark:hover:bg-[#364153]">
                    <td className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] text-center font-medium text-[--color-text-body] dark:text-[#d1d5dc]">65~69</td>
                    <td className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] text-center text-[--color-text-secondary] dark:text-[#99a1af]">연금 2,050만</td>
                    <td className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] text-center text-[--color-text-secondary] dark:text-[#99a1af]">연금 2,050만</td>
                    <td className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] text-center text-[--color-text-secondary] dark:text-[#99a1af]">배당 1,200만<br/>+ 국민연금 1,200만</td>
                    <td className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] text-center font-bold text-emerald-600 dark:text-emerald-400">6,500만</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800/30">
              <p className="text-[13px] text-emerald-600 dark:text-emerald-400 font-bold">
                👉 연금 인출액 자동 감소 → 연금 고갈 리스크 ↓
              </p>
            </div>
          </div>

          {/* 70~90세 테이블 */}
          <div className="bg-white dark:bg-[#2a2d3e] rounded-xl p-6 border border-[--color-border] dark:border-[#1e2939]">
            <h3 className="text-[15px] font-bold text-[--color-text-body] dark:text-[#d1d5dc] mb-4">
              🔹 ④ 70~90세 (고령 안정 구간)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-indigo-50 dark:bg-indigo-900/20">
                    <th className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] font-bold text-[--color-text-body] dark:text-[#d1d5dc]">나이</th>
                    <th className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] font-bold text-[--color-text-body] dark:text-[#d1d5dc]">남편</th>
                    <th className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] font-bold text-[--color-text-body] dark:text-[#d1d5dc]">아내</th>
                    <th className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] font-bold text-[--color-text-body] dark:text-[#d1d5dc]">공통</th>
                    <th className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] font-bold text-indigo-600 dark:text-indigo-400">합계</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-gray-50 dark:hover:bg-[#364153]">
                    <td className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] text-center font-medium text-[--color-text-body] dark:text-[#d1d5dc]">70~90</td>
                    <td className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] text-center text-[--color-text-secondary] dark:text-[#99a1af]">연금 2,200만</td>
                    <td className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] text-center text-[--color-text-secondary] dark:text-[#99a1af]">연금 2,200만</td>
                    <td className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] text-center text-[--color-text-secondary] dark:text-[#99a1af]">배당 1,200만<br/>+ 국민연금 1,200만</td>
                    <td className="border border-gray-300 dark:border-gray-600 p-3 text-[13px] text-center font-bold text-indigo-600 dark:text-indigo-400">6,800만</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 border border-indigo-200 dark:border-indigo-800/30">
              <div className="space-y-1 text-[13px] text-[--color-text-secondary] dark:text-[#99a1af]">
                <p>📌 의료비 증가 반영</p>
                <p>📌 연금 인출은 실질 원금 비소진 속도</p>
              </div>
            </div>
          </div>

          {/* 전체 흐름 요약 */}
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 border-2 border-blue-200 dark:border-blue-800/30">
            <h3 className="text-[16px] font-bold text-[--color-text-body] dark:text-[#d1d5dc] mb-4">
              🔍 전체 흐름 한눈 요약
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px]">
              <div className="flex items-center gap-2">
                <span className="font-bold text-blue-600 dark:text-blue-400">51~54:</span>
                <span className="text-[--color-text-secondary] dark:text-[#99a1af]">ISA → 시간 벌기</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-purple-600 dark:text-purple-400">55~64:</span>
                <span className="text-[--color-text-secondary] dark:text-[#99a1af]">연금 → 주력 엔진</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">65~69:</span>
                <span className="text-[--color-text-secondary] dark:text-[#99a1af]">연금 ↓ + 국민연금 →</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-indigo-600 dark:text-indigo-400">70~90:</span>
                <span className="text-[--color-text-secondary] dark:text-[#99a1af]">연금 + 국민연금 안정</span>
              </div>
            </div>
          </div>

          {/* 성립 이유 */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl p-6 border border-emerald-200 dark:border-emerald-800/30">
            <h3 className="text-[16px] font-bold text-[--color-text-body] dark:text-[#d1d5dc] mb-4">
              ✅ 이 구조가 성립하는 이유 (중요)
            </h3>
            <div className="space-y-2 text-[13px] text-[--color-text-secondary] dark:text-[#99a1af]">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>금융소득 2천만 이하 유지</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>연금·ISA 인출 → 건보 점수 영향 ❌</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>부부 분산 → 세금·리스크 분산</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>ISA를 "아끼지 않고 써서" 연금 보호</span>
              </div>
            </div>
          </div>

          {/* 체크 포인트 */}
          <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-xl p-6 border-2 border-red-200 dark:border-red-800/30">
            <h3 className="text-[16px] font-bold text-red-600 dark:text-red-400 mb-4">
              ⚠️ 체크해야 할 현실 포인트 2가지
            </h3>
            <div className="space-y-4">
              <div className="bg-white dark:bg-[#364153] rounded-lg p-4">
                <p className="text-[14px] font-bold text-[--color-text-body] dark:text-[#d1d5dc] mb-2">1️⃣ ISA 총액</p>
                <div className="space-y-1 text-[13px] text-[--color-text-secondary] dark:text-[#99a1af]">
                  <p>• 최소 필요: 약 2.2억</p>
                  <p>• 현재 1.2억 → 은퇴 전 증액 필수</p>
                </div>
              </div>
              <div className="bg-white dark:bg-[#364153] rounded-lg p-4">
                <p className="text-[14px] font-bold text-[--color-text-body] dark:text-[#d1d5dc] mb-2">2️⃣ 연금 총액</p>
                <div className="space-y-1 text-[13px] text-[--color-text-secondary] dark:text-[#99a1af]">
                  <p>• 부부 합산 5억+</p>
                  <p>• → 위 인출 구조 90세까지 유지 가능</p>
                </div>
              </div>
            </div>
          </div>

          {/* 최종 한 문장 */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-6 text-white">
            <h3 className="text-[16px] font-bold mb-3">🧠 최종 한 문장</h3>
            <p className="text-[15px] leading-relaxed">
              월 500만 생활비 구조에서도<br/>
              <span className="font-bold text-yellow-300">ISA는 브리지로 사라지고,</span><br/>
              <span className="font-bold text-yellow-300">연금은 90세까지 살아남는다.</span><br/>
              <span className="text-[16px] font-bold text-yellow-300">이게 '실패하지 않는 FIRE'다.</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
