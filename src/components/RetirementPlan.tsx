import { MIcon } from "./MIcon";
import { useState, useEffect } from "react";
import { CashFlowModal } from "./CashFlowModal";

interface RetirementPlanProps {
  isAmountHidden?: boolean;
}

export function RetirementPlan({ isAmountHidden = false }: RetirementPlanProps) {
  const [textSize, setTextSize] = useState<'small' | 'normal' | 'large'>('small');
  const [showCashFlowModal, setShowCashFlowModal] = useState(false);
  const [calculatedData, setCalculatedData] = useState<any>(null);

  // localStorage에서 데이터 불러오기
  useEffect(() => {
    const savedData = localStorage.getItem('retirementPlanData');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.textSize) setTextSize(parsed.textSize);
        if (parsed.calculatedData) setCalculatedData(parsed.calculatedData);
      } catch (e) {
        console.error('Failed to load saved data:', e);
      }
    }
  }, []);

  // 데이터가 변경될 때마다 localStorage에 저장
  useEffect(() => {
    const dataToSave = {
      textSize,
      calculatedData
    };
    localStorage.setItem('retirementPlanData', JSON.stringify(dataToSave));
  }, [textSize, calculatedData]);

  // 텍스트 크기에 따른 클래스 매핑
  const getTextClass = (baseSize: string) => {
    const sizeMap = {
      small: {
        '13': 'text-[13px]',
        '14': 'text-[14px]',
        '15': 'text-[15px]',
        '16': 'text-[16px]',
        '18': 'text-[18px]',
        '20': 'text-[20px]',
      },
      normal: {
        '13': 'text-[15px]',
        '14': 'text-[16px]',
        '15': 'text-[17px]',
        '16': 'text-[18px]',
        '18': 'text-[20px]',
        '20': 'text-[22px]',
      },
      large: {
        '13': 'text-[17px]',
        '14': 'text-[18px]',
        '15': 'text-[19px]',
        '16': 'text-[20px]',
        '18': 'text-[22px]',
        '20': 'text-[24px]',
      },
    };
    
    return sizeMap[textSize][baseSize as keyof typeof sizeMap.small] || baseSize;
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 lg:p-8 bg-[#dbe1f5] dark:bg-[#0F172A]">
      {/* Header with Text Size Control */}
      <div className="flex items-center justify-between mb-4 md:mb-8">
        <h1 className="text-[20px] font-bold text-black dark:text-white">은퇴설계</h1>
        
        {/* Text Size Buttons */}
        <div className="flex items-center gap-2 bg-white dark:bg-[#2a2d3e] rounded-xl p-2 border border-gray-200 dark:border-[#1e2939]">
          <MIcon name="title" size={16} style={{ color: '#6b7280' }} />
          <button
            onClick={() => setTextSize('small')}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
              textSize === 'small'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-[#364153] text-gray-600 dark:text-[#99a1af] hover:bg-gray-200 dark:hover:bg-[#3d4759]'
            }`}
          >
            작게
          </button>
          <button
            onClick={() => setTextSize('normal')}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
              textSize === 'normal'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-[#364153] text-gray-600 dark:text-[#99a1af] hover:bg-gray-200 dark:hover:bg-[#3d4759]'
            }`}
          >
            보통
          </button>
          <button
            onClick={() => setTextSize('large')}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
              textSize === 'large'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-[#364153] text-gray-600 dark:text-[#99a1af] hover:bg-gray-200 dark:hover:bg-[#3d4759]'
            }`}
          >
            크게
          </button>
        </div>
      </div>
      
      <div className="space-y-6">
        {/* Main Question */}
        <div className="bg-white dark:bg-[#2a2d3e] rounded-2xl p-6 md:p-8 border border-gray-200 dark:border-[#1e2939]">
          <h2 className={`${getTextClass('16')} font-bold text-gray-800 dark:text-[#d1d5dc] mb-2`}>
            51세부터 매달 400만 원 현금,
          </h2>
          <h2 className={`${getTextClass('16')} font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent`}>
            어디서 어떻게 만들 것인가?
          </h2>
        </div>

        {/* 핵심 결론 */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl p-6 md:p-8 border-2 border-emerald-200 dark:border-emerald-800/30">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
              <MIcon name="shield" size={20} style={{ color: 'white' }} />
            </div>
            <h3 className={`${getTextClass('14')} font-bold text-gray-800 dark:text-[#d1d5dc]`}>🔥 결론부터 한 줄</h3>
          </div>
          
          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-3">
              <MIcon name="calendar_today" size={20} style={{ color: '#059669', marginTop: 2, flexShrink: 0 }} />
              <p className={`${getTextClass('13')} text-gray-800 dark:text-[#d1d5dc]`}>
                <span className="font-bold">51~55세:</span> 과세계좌 + ISA로 버티고
              </p>
            </div>
            <div className="flex items-start gap-3">
              <MIcon name="calendar_today" size={20} style={{ color: '#059669', marginTop: 2, flexShrink: 0 }} />
              <p className={`${getTextClass('13')} text-gray-800 dark:text-[#d1d5dc]`}>
                <span className="font-bold">55~65세:</span> ISA + 연금저축 일부 인출
              </p>
            </div>
            <div className="flex items-start gap-3">
              <MIcon name="calendar_today" size={20} style={{ color: '#059669', marginTop: 2, flexShrink: 0 }} />
              <p className={`${getTextClass('13')} text-gray-800 dark:text-[#d1d5dc]`}>
                <span className="font-bold">65세 이후:</span> 국민연금 + 연금계좌 정규 인출
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#364153] rounded-xl p-5">
            <p className={`${getTextClass('13')} font-bold text-gray-800 dark:text-[#d1d5dc] mb-4`}>이 순서를 지키면</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <MIcon name="check_circle" size={20} style={{ color: '#10b981', flexShrink: 0 }} />
                <span className={`${getTextClass('13')} text-gray-800 dark:text-[#d1d5dc]`}>건보 폭탄 ❌</span>
              </div>
              <div className="flex items-center gap-2">
                <MIcon name="check_circle" size={20} style={{ color: '#10b981', flexShrink: 0 }} />
                <span className={`${getTextClass('13')} text-gray-800 dark:text-[#d1d5dc]`}>세금 폭탄 ❌</span>
              </div>
              <div className="flex items-center gap-2">
                <MIcon name="check_circle" size={20} style={{ color: '#10b981', flexShrink: 0 }} />
                <span className={`${getTextClass('13')} text-gray-800 dark:text-[#d1d5dc]`}>현금 부족 ❌</span>
              </div>
            </div>
          </div>
        </div>

        {/* 현금흐름표 버튼 */}
        <div className="flex justify-center">
          <button
            onClick={() => setShowCashFlowModal(true)}
            className="group bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-8 py-4 rounded-2xl font-bold text-[16px] shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-3"
          >
            <MIcon name="description" size={24} />
            현금흐름표
            <span className="text-[12px] opacity-90">(51~90세 상세 시뮬레이션)</span>
          </button>
        </div>
      </div>

      {/* 현금흐름표 모달 */}
      <CashFlowModal 
        isOpen={showCashFlowModal}
        onClose={() => setShowCashFlowModal(false)}
      />
    </div>
  );
}
