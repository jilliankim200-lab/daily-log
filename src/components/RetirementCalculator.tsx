import { useState, useEffect } from "react";
import { MIcon } from "./MIcon";

interface RetirementCalculatorProps {
  isAmountHidden?: boolean;
}

export function RetirementCalculator({ isAmountHidden = false }: RetirementCalculatorProps) {
  const [currentAge, setCurrentAge] = useState(30);
  const [retirementAge, setRetirementAge] = useState(65);
  const [monthlyExpense, setMonthlyExpense] = useState(300);
  const [receiptYears, setReceiptYears] = useState(30);
  const [currentAssets, setCurrentAssets] = useState(50000);
  const [monthlyInvestment, setMonthlyInvestment] = useState(500);
  const [expectedReturn, setExpectedReturn] = useState(4);
  const [showResults, setShowResults] = useState(false);

  // 계산 결과 저장 (캐시)
  const [cachedResults, setCachedResults] = useState({
    totalInvestment: 0,
    futureValue: 0,
    monthlyReceipt: 0,
    achievementRate: 0,
    totalProfit: 0
  });

  // localStorage에서 데이터 불러오기
  useEffect(() => {
    const savedData = localStorage.getItem('retirementCalculatorData');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setCurrentAge(parsed.currentAge || 30);
        setRetirementAge(parsed.retirementAge || 65);
        setMonthlyExpense(parsed.monthlyExpense || 300);
        setReceiptYears(parsed.receiptYears || 30);
        setCurrentAssets(parsed.currentAssets || 50000);
        setMonthlyInvestment(parsed.monthlyInvestment || 500);
        setExpectedReturn(parsed.expectedReturn || 4);
        // 캐시된 결과도 복원
        if (parsed.cachedResults) {
          setCachedResults(parsed.cachedResults);
        }
      } catch (e) {
        console.error('Failed to load saved data:', e);
      }
    }
  }, []);

  // 데이터가 변경될 때마다 localStorage에 저장
  useEffect(() => {
    const dataToSave = {
      currentAge,
      retirementAge,
      monthlyExpense,
      receiptYears,
      currentAssets,
      monthlyInvestment,
      expectedReturn,
      showResults,
      cachedResults
    };
    localStorage.setItem('retirementCalculatorData', JSON.stringify(dataToSave));
  }, [currentAge, retirementAge, monthlyExpense, receiptYears, currentAssets, monthlyInvestment, expectedReturn, showResults, cachedResults]);

  // 입력값이 변경될 때마다 결과 재계산 및 캐시 업데이트
  useEffect(() => {
    const totalInv = calculateTotalInvestment();
    const futureVal = calculateFutureValue();
    const monthlyRec = calculateMonthlyReceipt();
    const achieveRate = calculateAchievementRate();
    const totalProf = futureVal - currentAssets - totalInv;

    setCachedResults({
      totalInvestment: totalInv,
      futureValue: futureVal,
      monthlyReceipt: monthlyRec,
      achievementRate: achieveRate,
      totalProfit: totalProf
    });
  }, [currentAge, retirementAge, monthlyExpense, receiptYears, currentAssets, monthlyInvestment, expectedReturn]);

  // 계산 함수들
  const calculateYearsToRetirement = () => retirementAge - currentAge;
  
  const calculateTotalInvestment = () => {
    const months = calculateYearsToRetirement() * 12;
    return monthlyInvestment * months;
  };

  const calculateFutureValue = () => {
    const months = calculateYearsToRetirement() * 12;
    const monthlyRate = expectedReturn / 100 / 12;
    
    // 현재 자산의 미래 가치
    const currentAssetsFV = currentAssets * Math.pow(1 + monthlyRate, months);
    
    // 월 투자금의 미래 가치 (연금 공식)
    const monthlyInvestmentFV = monthlyInvestment * 
      ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
    
    return currentAssetsFV + monthlyInvestmentFV;
  };

  const calculateMonthlyReceipt = () => {
    const totalAmount = calculateFutureValue();
    const totalMonths = receiptYears * 12;
    return totalAmount / totalMonths;
  };

  const calculateTotalExpense = () => {
    return monthlyExpense * receiptYears * 12;
  };

  const calculateAchievementRate = () => {
    const totalReceipt = calculateMonthlyReceipt() * receiptYears * 12;
    const totalExpense = calculateTotalExpense();
    return Math.min((totalReceipt / totalExpense) * 100, 100);
  };

  const formatAmount = (amount: number) => {
    if (isAmountHidden) {
      return "••••••";
    }
    if (amount >= 10000) {
      return `${(amount / 10000).toFixed(0)}억`;
    } else if (amount >= 1000) {
      return `${(amount / 10000).toFixed(2)}억`;
    }
    return `${amount.toLocaleString()}만원`;
  };

  const formatNumber = (num: number) => {
    if (isAmountHidden) return "••••••";
    return num.toLocaleString();
  };

  const totalInvestment = calculateTotalInvestment();
  const futureValue = calculateFutureValue();
  const monthlyReceipt = calculateMonthlyReceipt();
  const achievementRate = calculateAchievementRate();
  const totalProfit = futureValue - currentAssets - totalInvestment;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <MIcon name="calculate" size={20} style={{ color: 'white' }} />
          </div>
          <div>
            <h2 className="text-[20px] text-black dark:text-white">은퇴 계획 계산기</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">나만의 은퇴 계획을 설계해보세요</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 왼쪽: 입력 섹션 */}
        <div className="space-y-6">
          {/* 은퇴정보 */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <MIcon name="info" size={20} style={{ color: '#3b82f6' }} />
              <h3 className="text-lg text-black dark:text-white">은퇴정보</h3>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">현재 나이</label>
                  <input
                    type="number"
                    value={currentAge}
                    onChange={(e) => setCurrentAge(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-black dark:text-white"
                    min="20"
                    max="80"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">은퇴연령</label>
                  <input
                    type="number"
                    value={retirementAge}
                    onChange={(e) => setRetirementAge(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-black dark:text-white"
                    min="40"
                    max="100"
                  />
                </div>
              </div>

              <div className="pt-2 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                <p className="text-sm text-gray-600 dark:text-gray-400">은퇴까지 남은 기간</p>
                <p className="text-2xl text-blue-600 dark:text-blue-400 mt-1">{calculateYearsToRetirement()}년</p>
              </div>
            </div>
          </div>

          {/* 은퇴생활비 */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <MIcon name="savings" size={20} style={{ color: '#22c55e' }} />
              <h3 className="text-lg text-black dark:text-white">은퇴생활비</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">은퇴 후 월 생활비 (만원)</label>
                <input
                  type="number"
                  value={monthlyExpense}
                  onChange={(e) => setMonthlyExpense(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-black dark:text-white"
                  min="100"
                  step="50"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">생활비 수령 기간 (년)</label>
                <input
                  type="range"
                  value={receiptYears}
                  onChange={(e) => setReceiptYears(Number(e.target.value))}
                  className="w-full"
                  min="10"
                  max="50"
                />
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>10년</span>
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">{receiptYears}년</span>
                  <span>50년</span>
                </div>
              </div>

              <div className="pt-2 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-900/20">
                <p className="text-sm text-gray-600 dark:text-gray-400">필요 총 생활비</p>
                <p className="text-2xl text-green-600 dark:text-green-400 mt-1">{formatAmount(calculateTotalExpense())}</p>
              </div>
            </div>
          </div>

          {/* 은퇴자금마련 */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <MIcon name="trending_up" size={20} style={{ color: '#a855f7' }} />
              <h3 className="text-lg text-black dark:text-white">은퇴자금마련</h3>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">현재 보유 자산 (만원)</label>
                  <input
                    type="number"
                    value={currentAssets}
                    onChange={(e) => setCurrentAssets(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-black dark:text-white"
                    min="0"
                    step="1000"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">월 투자금액 (만원)</label>
                  <input
                    type="number"
                    value={monthlyInvestment}
                    onChange={(e) => setMonthlyInvestment(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-black dark:text-white"
                    min="0"
                    step="10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">예상 수익률 (%)</label>
                <input
                  type="range"
                  value={expectedReturn}
                  onChange={(e) => setExpectedReturn(Number(e.target.value))}
                  className="w-full"
                  min="0"
                  max="15"
                  step="0.5"
                />
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>0%</span>
                  <span className="text-purple-600 dark:text-purple-400 font-semibold">{expectedReturn}%</span>
                  <span>15%</span>
                </div>
              </div>

              <div className="pt-2 px-4 py-3 rounded-xl bg-purple-50 dark:bg-purple-900/20">
                <p className="text-sm text-gray-600 dark:text-gray-400">총 투자금액</p>
                <p className="text-2xl text-purple-600 dark:text-purple-400 mt-1">{formatAmount(totalInvestment)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽: 결과 섹션 */}
        <div className="space-y-6">
          {/* 예상투자결과 */}
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 shadow-lg text-white">
            <div className="flex items-center gap-2 mb-4">
              <MIcon name="my_location" size={20} />
              <h3 className="text-lg">예상투자결과</h3>
            </div>
            
            <div className="space-y-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <p className="text-sm text-white/80 mb-1">예상 총 자산</p>
                <p className="text-3xl font-bold">{formatAmount(futureValue)}</p>
                <p className="text-xs text-white/60 mt-1">
                  은퇴 시점 ({retirementAge}세)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <p className="text-xs text-white/80 mb-1">투자원금</p>
                  <p className="text-lg font-semibold">{formatAmount(currentAssets + totalInvestment)}</p>
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <p className="text-xs text-white/80 mb-1">예상수익금</p>
                  <p className="text-lg font-semibold text-yellow-300">{formatAmount(totalProfit)}</p>
                </div>
              </div>

              {/* 투자 명언 */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="text-center space-y-3">
                  <div className="text-3xl">💡</div>
                  <p className="text-white/90 text-sm leading-relaxed italic">
                    "{(() => {
                      const quotes = [
                        "위험을 감수하지 않으면 위험해진다. - 워렌 버핏",
                        "단기적 고통은 장기적 이익을 위한 것이다. - 레이 달리오",
                        "시장을 이기려 하지 말고 시장과 함께하라. - 존 보글",
                        "복리는 세상에서 가장 강력한 힘이다. - 알버트 아인슈타인",
                        "인내심은 투자의 핵심 덕목이다. - 벤저민 그레이엄",
                        "가장 좋은 투자는 자기 자신에게 하는 투자다. - 워렌 버핏",
                        "돈을 잃지 않는 것이 첫 번째 규칙이다. - 워렌 버핏",
                        "다각화는 무지에 대한 보호책이다. - 워렌 버핏",
                        "시장은 단기적으로는 투표 기계, 장기적으로는 저울이다. - 벤저민 그레이엄",
                        "기회는 준비된 자에게만 온다. - 피터 린치",
                        "투자에서 성공하려면 남들이 탐욕스러울 때 두려워하고, 남들이 두려워할 때 탐욕스러워야 한다. - 워렌 버핏",
                        "주식을 10년간 보유할 생각이 없다면 10분도 보유하지 마라. - 워렌 버핏",
                        "시간은 좋은 기업의 친구이자 나쁜 기업의 적이다. - 워렌 버핏",
                        "예측은 예측자에 대해서는 많이 말하지만 미래에 대해서는 거의 말하지 않는다. - 워렌 버핏",
                        "투자의 성공은 지능이 아니라 기질의 문제다. - 워렌 버핏",
                        "리스크는 당신이 무엇을 하는지 모르는 데서 온다. - 워렌 버핏",
                        "가격은 당신이 지불하는 것이고, 가치는 당신이 얻는 것이다. - 워렌 버핏",
                        "좋은 주식을 찾는 것보다 좋은 가격에 사는 것이 중요하다. - 찰리 멍거",
                        "인플레이션은 눈에 보이지 않는 세금이다. - 밀턴 프리드먼",
                        "투자는 단순하지만 쉽지는 않다. - 워렌 버핏",
                        "부는 하루아침에 만들어지지 않는다. - 존 D. 록펠러",
                        "투자는 마라톤이지 단거리 달리기가 아니다. - 피터 린치",
                        "저축 없이는 부를 쌓을 수 없다. - 토머스 제퍼슨",
                        "적은 금액이라도 꾸준히 투자하면 큰 부를 만든다. - 존 템플턴",
                        "시간은 복리의 마법을 만든다. - 알버트 아인슈타인",
                        "주식 시장은 조급한 사람으로부터 인내심 있는 사람에게로 돈을 이동시킨다. - 워렌 버핏",
                        "투자에서 가장 큰 리스크는 리스크를 모르는 것이다. - 레이 달리오",
                        "월가에서 가장 위험한 말은 이번엔 다르다이다. - 존 템플턴",
                        "시장이 떨어질 때 사고, 올라갈 때 팔아라. - 존 템플턴",
                        "경제의 미래는 알 수 없지만, 좋은 회사는 알 수 있다. - 피터 린치"
                      ];
                      const randomIndex = Math.floor(Math.random() * quotes.length);
                      return quotes[randomIndex];
                    })()}"
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 은퇴후 목표 달성도 */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg text-black dark:text-white mb-4">은퇴 후 목표 달성도</h3>
            
            <div className="space-y-6">
              {/* 월 수령액 */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">예상 월 수령액</p>
                  <p className="text-2xl text-black dark:text-white font-bold">{formatAmount(monthlyReceipt)}</p>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  {receiptYears}년 동안 매달 수령 가능한 금액
                </p>
              </div>

              {/* 달성률 표시 */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">목표 달성률</p>
                  <p className={`text-2xl font-bold ${achievementRate >= 100 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {isAmountHidden ? '••••' : `${achievementRate.toFixed(1)}%`}
                  </p>
                </div>
                
                {/* 프로그레스 바 */}
                <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      achievementRate >= 100 
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                        : 'bg-gradient-to-r from-red-500 to-orange-500'
                    }`}
                    style={{ width: `${Math.min(achievementRate, 100)}%` }}
                  />
                </div>
                
                <div className="mt-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-700">
                  {achievementRate >= 100 ? (
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-white text-sm">✓</span>
                      </div>
                      <div>
                        <p className="text-sm text-green-600 dark:text-green-400 font-semibold">목표 달성 가능!</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          현재 계획대로 투자하시면 은퇴 후 {receiptYears}년 동안 월 {formatAmount(monthlyExpense)}의 생활비를 충당할 수 있습니다.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-white text-sm">!</span>
                      </div>
                      <div>
                        <p className="text-sm text-red-600 dark:text-red-400 font-semibold">목표 달성 부족</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          월 투자금액을 늘리거나 은퇴 시기를 조정해보세요. 또는 은퇴 후 생활비를 줄이는 것도 고려해보실 수 있습니다.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 비교 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">월 수령 가능</p>
                  <p className="text-lg text-blue-600 dark:text-blue-400 font-semibold">{formatAmount(monthlyReceipt)}</p>
                </div>
                <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">월 필요 금액</p>
                  <p className="text-lg text-purple-600 dark:text-purple-400 font-semibold">{formatAmount(monthlyExpense)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}