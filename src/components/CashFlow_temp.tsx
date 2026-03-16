          {/* ⚠️ 파이어족 실패 경고 */}
          {!isFireSuccess && assetDepletionAge && failureInfo && (
            <div className="mb-6 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/30 dark:to-orange-900/30 rounded-2xl p-6 md:p-8 border-4 border-red-500 dark:border-red-700 shadow-2xl">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-16 h-16 bg-red-600 dark:bg-red-800 rounded-full flex items-center justify-center text-3xl">
                  ⚠️
                </div>
                <div className="flex-1">
                  <h2 className="text-[28px] font-black text-red-700 dark:text-red-300 mb-3">
                    🚨 파이어족 실패 경고!
                  </h2>
                  <p className="text-[18px] font-bold text-red-600 dark:text-red-400 mb-2">
                    {assetDepletionAge}세에 현금흐름이 마이너스가 됩니다! 😱
                  </p>
                  <p className="text-[15px] text-red-500 dark:text-red-400 mb-4">
                    연 부족액: <strong className="text-[18px]">{formatAmount(failureInfo.deficit)}원</strong>
                  </p>
                  
                  {/* 실패 시점 상세 정보 */}
                  <div className="bg-white dark:bg-[#1e2939] rounded-xl p-5 mb-4 border-2 border-red-400 dark:border-red-600">
                    <p className="text-[16px] font-bold text-red-700 dark:text-red-300 mb-3">📊 {assetDepletionAge}세 현금흐름 분석</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[14px]">
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                        <p className="text-gray-600 dark:text-gray-400 text-[12px] mb-1">총 수입</p>
                        <p className="text-blue-700 dark:text-blue-300 font-bold">{formatAmount(failureInfo.totalIncome)}원</p>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                        <p className="text-gray-600 dark:text-gray-400 text-[12px] mb-1">총 지출</p>
                        <p className="text-red-700 dark:text-red-300 font-bold">{formatAmount(failureInfo.totalExpense)}원</p>
                      </div>
                      <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
                        <p className="text-gray-600 dark:text-gray-400 text-[12px] mb-1">생활비</p>
                        <p className="text-orange-700 dark:text-orange-300 font-bold">{formatAmount(failureInfo.livingCost)}원</p>
                      </div>
                    </div>
                  </div>

                  {/* 실패 원인 분석 */}
                  <div className="bg-white dark:bg-[#1e2939] rounded-xl p-5 mb-4 border-2 border-orange-400 dark:border-orange-600">
                    <p className="text-[16px] font-bold text-orange-700 dark:text-orange-300 mb-3">🔍 실패 원인 분석</p>
                    <ul className="space-y-2 text-[14px] text-gray-700 dark:text-gray-300">
                      {failureInfo.reason.map((reason, idx) => (
                        <li key={idx} className="flex items-start gap-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2">
                          <span className="text-red-600 dark:text-red-400 font-bold mt-0.5">⚠️</span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {/* 솔루션 제안 */}
                  <div className="bg-white dark:bg-[#1e2939] rounded-xl p-5 mb-4 border-2 border-green-400 dark:border-green-600">
                    <p className="text-[16px] font-bold text-green-700 dark:text-green-300 mb-3">💡 해결 방안 (우선순위별)</p>
                    <ul className="space-y-2 text-[14px] text-gray-700 dark:text-gray-300">
                      <li className="flex items-start gap-2">
                        <span className="text-red-600 dark:text-red-400 font-bold">1️⃣</span>
                        <span><strong className="text-red-600 dark:text-red-400">월 생활비 감소:</strong> 현재 {formatAmount(inputs.monthlyLivingCost)}원 → 추천: <span className="text-blue-600 dark:text-blue-400 font-bold">{formatAmount(Math.max(inputs.monthlyLivingCost - failureInfo.deficit / 12, inputs.monthlyLivingCost * 0.7))}원</span> (부족액 해소)</span>
                      </li>
                      {inputs.usePensionDepletion ? (
                        <li className="flex items-start gap-2">
                          <span className="text-orange-600 dark:text-orange-400 font-bold">2️⃣</span>
                          <span><strong className="text-orange-600 dark:text-orange-400">연금소진 모드 OFF:</strong> 고정 인출액으로 변경하여 초반 현금흐름 안정화</span>
                        </li>
                      ) : (
                        <li className="flex items-start gap-2">
                          <span className="text-orange-600 dark:text-orange-400 font-bold">2️⃣</span>
                          <span><strong className="text-orange-600 dark:text-orange-400">개인연금 인출액 증가:</strong> 현재 {formatAmount(inputs.pensionWithdrawalAmount)}원 → 추천: <span className="text-blue-600 dark:text-blue-400 font-bold">{formatAmount(inputs.pensionWithdrawalAmount + failureInfo.deficit)}원</span> (부족액만큼 증액)</span>
                        </li>
                      )}
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-600 dark:text-yellow-400 font-bold">3️⃣</span>
                        <span><strong className="text-yellow-600 dark:text-yellow-400">은퇴 연기:</strong> 현재 {inputs.retirementStartAge}세 → 추천: <span className="text-blue-600 dark:text-blue-400 font-bold">{inputs.retirementStartAge + Math.ceil((assetDepletionAge - inputs.retirementStartAge) * 0.1)}세</span> (자산 축적 기간 확보)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 dark:text-green-400 font-bold">4️⃣</span>
                        <span><strong className="text-green-600 dark:text-green-400">초기 자산 증대:</strong> 총 자산을 <span className="text-blue-600 dark:text-blue-400 font-bold">{formatAmount((inputs.totalPension + inputs.husbandISA + inputs.wifeISA + inputs.overseasInvestmentAmount) * 1.15)}원</span>으로 증액 (15% 상향)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600 dark:text-blue-400 font-bold">5️⃣</span>
                        <span><strong className="text-blue-600 dark:text-blue-400">국민연금 조기 수령:</strong> {inputs.nationalPensionStartAge}세 → <span className="text-blue-600 dark:text-blue-400 font-bold">63세</span> (감액되지만 현금흐름 개선)</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-gradient-to-r from-red-100 to-orange-100 dark:from-red-900/40 dark:to-orange-900/40 rounded-xl p-4 border border-red-300 dark:border-red-600">
                    <p className="text-[13px] font-bold text-red-700 dark:text-red-300 mb-2">⚡ 조치 필요</p>
                    <p className="text-[12px] text-gray-700 dark:text-gray-300 leading-relaxed">
                      위 해결 방안 중 <strong className="text-red-600 dark:text-red-400">1번(생활비 감소) 필수 + 2~5번 중 1개 이상</strong> 조합하여 적용하면 {inputs.simulationEndAge}세까지 안정적인 파이어족 생활이 가능합니다! 🔄
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
