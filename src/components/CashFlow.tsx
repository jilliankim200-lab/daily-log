import { useState, useEffect } from "react";
import { Calculator, TrendingUp, Eye, EyeOff, RotateCcw, Info, X, Download, FileText, FileSpreadsheet, FileJson, ChevronDown, ChevronUp } from "lucide-react";
import { toast, Toaster } from "sonner";

interface CashFlowProps {
  isAmountHidden?: boolean;
}

interface InputValues {
  startYear: number; // 시작년도
  retirementStartAge: number;
  spouseRetirementStartAge: number; // 배우자 은퇴시작나이
  simulationEndAge: number;
  monthlyLivingCostBefore75: number; // 75세 이전 월 생활비
  monthlyLivingCostAfter75: number; // 75세 이후 월 생활비
  inflationRate: number;
  husbandISA: number;
  wifeISA: number;
  isaReturnRate: number; // ISA 연수익률
  overseasInvestmentAmount: number; // 해외직투금액 (초기금액)
  overseasReturnRate: number; // 해외주식 연수익률
  totalPension: number;
  pensionWithdrawalAmount: number;
  pensionReturnRate: number;
  pensionExcessTaxRate: number;
  homeValue: number;
  pensionStartAge: number;
  nationalPensionStartAge: number;
  nationalPensionYearly: number;
  homePensionStartAge: number;
  homePensionMonthly: number;
  lifeInsurancePensionStartAge: number; // 생명보험연금 시작연령
  lifeInsurancePensionYearly: number; // 생명보험연금 연간금액
  usePensionDepletion: boolean; // 연금소진 토글
}

interface SimulationRow {
  year: number;
  age: number;
  livingCost: number;
  isaWithdrawal: number;
  overseasDividend: number; // 해외 배당금
  overseasStockSale: number; // 해외주식매도
  pensionAfterTax: number;
  nationalPension: number;
  homePension: number;
  lifeInsurancePension: number; // 생명보험연금
  totalIncome: number;
  totalExpense: number;
  yearlySurplus: number;
  isaBalance: number;
  pensionBalance: number;
  overseasBalance: number; // 해외주식 잔액
  healthInsurance: number;
}

export function CashFlow({ isAmountHidden = false }: CashFlowProps) {
  const [showResults, setShowResults] = useState(false);
  const [hideAmounts, setHideAmounts] = useState(false);
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [isCoupleMode, setIsCoupleMode] = useState(false); // 부부 모드
  const [isInputExpanded, setIsInputExpanded] = useState(true); // 입력 폼 접기/펼치기

  const [inputs, setInputs] = useState<InputValues>({
    startYear: 2025, // 시작년도
    retirementStartAge: 54,
    spouseRetirementStartAge: 54, // 배우자 은퇴시작나이
    simulationEndAge: 85,
    monthlyLivingCostBefore75: 7000000, // 75세 이전 월 생활비
    monthlyLivingCostAfter75: 5000000, // 75세 이후 월 생활비 (감소)
    inflationRate: 2,
    husbandISA: 100000000,
    wifeISA: 100000000,
    isaReturnRate: 0.05, // ISA 연수익률 5%
    overseasInvestmentAmount: 130000000, // 해외직투 초기금액 1억3천만원
    overseasReturnRate: 0.07, // 해외주식 연수익률 7%
    totalPension: 1000000000,
    pensionWithdrawalAmount: 50000000,
    pensionReturnRate: 0.05, // 연금 연수익률 5%
    pensionExcessTaxRate: 0.15,
    homeValue: 650000000,
    pensionStartAge: 55,
    nationalPensionStartAge: 67,
    nationalPensionYearly: 30000000,
    homePensionStartAge: 55,
    homePensionMonthly: 1000000,
    lifeInsurancePensionStartAge: 55, // 생명보험연금 시작연령
    lifeInsurancePensionYearly: 1450000, // 생명보험연금 연간 145만원
    usePensionDepletion: true, // 연금소진 토글 기본값 ON
  });

  const [results, setResults] = useState<SimulationRow[]>([]);
  const [assetDepletionAge, setAssetDepletionAge] = useState<number | null>(null);
  const [isFireSuccess, setIsFireSuccess] = useState<boolean>(true);
  const [failureInfo, setFailureInfo] = useState<{
    age: number;
    deficit: number;
    totalIncome: number;
    totalExpense: number;
    livingCost: number;
    reason: string[];
  } | null>(null);

  // localStorage에서 데이터 불러오기
  useEffect(() => {
    const savedData = localStorage.getItem('cashFlowData');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        
        // 입력값 복원
        if (parsed.inputs) {
          setInputs({
            ...parsed.inputs,
            pensionWithdrawalAmount: parsed.inputs.pensionWithdrawalAmount ?? 50000000,
            usePensionDepletion: parsed.inputs.usePensionDepletion ?? false,
            // 기존 데이터 호환성: monthlyLivingCost를 75세 이전 값으로 변환
            monthlyLivingCostBefore75: parsed.inputs.monthlyLivingCostBefore75 ?? parsed.inputs.monthlyLivingCost ?? 7000000,
            monthlyLivingCostAfter75: parsed.inputs.monthlyLivingCostAfter75 ?? 5000000,
            // 생명보험연금 기본값
            lifeInsurancePensionStartAge: parsed.inputs.lifeInsurancePensionStartAge ?? 55,
            lifeInsurancePensionYearly: parsed.inputs.lifeInsurancePensionYearly ?? 1450000,
            // 배우자 은퇴시작나이 기본값
            spouseRetirementStartAge: parsed.inputs.spouseRetirementStartAge ?? 54,
            // 시작년도 기본값
            startYear: parsed.inputs.startYear ?? 2025,
            // ISA와 해외주식 수익률 기본값
            isaReturnRate: parsed.inputs.isaReturnRate ?? 0.05,
            overseasReturnRate: parsed.inputs.overseasReturnRate ?? 0.07,
            // 연금 수익률 기본값
            pensionReturnRate: parsed.inputs.pensionReturnRate ?? 0.05
          });
        }
        
        // 부부 모드 복원
        if (parsed.isCoupleMode !== undefined) {
          setIsCoupleMode(parsed.isCoupleMode);
        }
        
        // 시뮬레이션 결과 복원
        if (parsed.results && Array.isArray(parsed.results) && parsed.results.length > 0) {
          const updatedResults = parsed.results.map((row: SimulationRow) => ({
            ...row,
            nationalPension: row.nationalPension ?? 0,
            healthInsurance: row.healthInsurance ?? 0,
            lifeInsurancePension: row.lifeInsurancePension ?? 0
          }));
          setResults(updatedResults);
          setShowResults(true); // 결과가 있으면 표시
          
          // 성공/실패 정보 복원
          if (parsed.isFireSuccess !== undefined) {
            setIsFireSuccess(parsed.isFireSuccess);
          }
          if (parsed.assetDepletionAge !== undefined) {
            setAssetDepletionAge(parsed.assetDepletionAge);
          }
          if (parsed.failureInfo) {
            setFailureInfo(parsed.failureInfo);
          }
        }
      } catch (e) {
        console.error('Failed to load saved data:', e);
      }
    }
  }, []);

  // 데이터가 변경될 때마다 localStorage에 저장
  useEffect(() => {
    const dataToSave = {
      inputs,
      results,
      showResults,
      isFireSuccess,
      assetDepletionAge,
      failureInfo,
      isCoupleMode
    };
    localStorage.setItem('cashFlowData', JSON.stringify(dataToSave));
  }, [inputs, results, showResults, isFireSuccess, assetDepletionAge, failureInfo, isCoupleMode]);

  const handleInputChange = (field: keyof InputValues, value: string) => {
    // 콤마 제거하고 숫자로 변환
    const numericValue = value.replace(/,/g, '');
    setInputs(prev => ({
      ...prev,
      [field]: parseFloat(numericValue) || 0
    }));
  };

  const formatInputAmount = (amount: number): string => {
    return new Intl.NumberFormat('ko-KR').format(amount);
  };

  const formatKoreanAmount = (amount: number): string => {
    if (amount === 0) return '';
    
    const absAmount = Math.abs(amount);
    const eok = Math.floor(absAmount / 100000000);
    const man = Math.floor((absAmount % 100000000) / 10000);
    
    let result = '';
    
    if (amount < 0) {
      result += '마이너스 ';
    }
    
    if (eok > 0) {
      result += `${eok}억`;
      if (man > 0) {
        result += ` ${man.toLocaleString('ko-KR')}만`;
      }
    } else if (man > 0) {
      result += `${man.toLocaleString('ko-KR')}만`;
    }
    
    return result ? `${result}원` : '';
  };

  const calculateSimulation = () => {
    const rows: SimulationRow[] = [];
    
    // 초기값 설정
    let isaBalance = inputs.husbandISA + inputs.wifeISA;
    let pensionBalance = inputs.totalPension;
    let overseasBalance = inputs.overseasInvestmentAmount; // 해외직투 잔액
    
    // 수익률 기본값 설정 (NaN 방지)
    const isaReturnRate = inputs.isaReturnRate || 0.05;
    const overseasReturnRate = inputs.overseasReturnRate || 0.07;
    const pensionReturnRate = inputs.pensionReturnRate || 0.05;
    
    // 세금 및 건보 파라미터
    const overseasDividendTaxRate = 0.154;
    const pensionTaxRate = 0.055;
    const pensionSeparateTaxLimit = 12000000; // 1인당
    const financialIncomeDeduction = 10000000; // 금융소득 기본공제
    const propertyBasicDeduction = 50000000; // 재산 기본공제
    const propertyScoreRate = 0.0000005; // 재산 점수 환산율 (6억 → 300점)
    const financialScoreRate = 0.0000005; // 금융소득 점수 환산율 (200만원 → 1점)
    const scoreMonthlyPremium = 208; // 점수당 월 보험료

    for (let i = 0; i < inputs.simulationEndAge - inputs.retirementStartAge + 1; i++) {
      const currentAge = inputs.retirementStartAge + i;
      const currentYear = inputs.startYear + i;
      
      // 생활비 (75세 기준으로 다른 금액, 물가상승률 적용)
      const baseMonthlyLivingCost = currentAge < 75 
        ? inputs.monthlyLivingCostBefore75 
        : inputs.monthlyLivingCostAfter75;
      const yearlyBaseLivingCost = baseMonthlyLivingCost * 12;
      const livingCost = yearlyBaseLivingCost * Math.pow(1 + inputs.inflationRate / 100, i);
      
      // ========================================
      // 2단계: 고정 수입 계산 (나중에 계산)
      // ========================================
      
      // 주택연금
      let homePension = 0;
      if (isCoupleMode) {
        // 부부 모드: 본인과 배우자 중 한 명이라도 시작 나이 이상이면 전액 수령
        const spouseAge = currentAge - (inputs.retirementStartAge - inputs.spouseRetirementStartAge);
        if (currentAge >= inputs.homePensionStartAge || spouseAge >= inputs.homePensionStartAge) {
          homePension = inputs.homePensionMonthly * 12;
        }
      } else {
        // 단독 모드
        homePension = currentAge >= inputs.homePensionStartAge 
          ? inputs.homePensionMonthly * 12 
          : 0;
      }
      
      // 생명보험연금
      let lifeInsurancePension = 0;
      if (isCoupleMode) {
        // 부부 모드: 본인과 배우자 각각 계산
        let person1Insurance = 0;
        let person2Insurance = 0;
        
        if (currentAge >= inputs.lifeInsurancePensionStartAge) {
          person1Insurance = inputs.lifeInsurancePensionYearly / 2;
        }
        
        const spouseAge = currentAge - (inputs.retirementStartAge - inputs.spouseRetirementStartAge);
        if (spouseAge >= inputs.lifeInsurancePensionStartAge) {
          person2Insurance = inputs.lifeInsurancePensionYearly / 2;
        }
        
        lifeInsurancePension = person1Insurance + person2Insurance;
      } else {
        // 단독 모드
        lifeInsurancePension = currentAge >= inputs.lifeInsurancePensionStartAge
          ? inputs.lifeInsurancePensionYearly
          : 0;
      }
      
      // 국민연금 (67세부터) - 나이별 세율 적용 + 물가상승률 반영
      
      // 국민연금 (67세부터) - 나이별 세율 적용 + 물가상승률 반영 + 조기수령 감액률
      let nationalPension = 0;
      let nationalPensionPreTax = 0; // 건보료 계산용
      
      // 🔹 국민연금 조기수령 감액률 상수
      const NORMAL_PENSION_AGE = 67; // 정상수령 나이
      const EARLY_REDUCTION_RATE_PER_YEAR = 0.06; // 1년당 6% 감액
      
      if (isCoupleMode) {
        // 부부 모드: 본인과 배우자의 국민연금 각각 계산
        let person1NationalPension = 0;
        let person2NationalPension = 0;
        
        // 본인의 국민연금 (본인 나이 기준)
        if (currentAge >= inputs.nationalPensionStartAge) {
          const yearsFromStart = currentAge - inputs.nationalPensionStartAge;
          
          // 조기수령 감액률 계산
          const earlyYears = Math.max(0, NORMAL_PENSION_AGE - inputs.nationalPensionStartAge);
          const reductionRate = earlyYears * EARLY_REDUCTION_RATE_PER_YEAR;
          const adjustmentFactor = 1 - reductionRate;
          
          // 감액률 적용 후 물가상승률 반영
          const adjustedNationalPension = (inputs.nationalPensionYearly / 2) * adjustmentFactor * Math.pow(1 + inputs.inflationRate / 100, yearsFromStart);
          
          let agePensionTaxRate: number;
          if (currentAge < 70) {
            agePensionTaxRate = 0.055;
          } else if (currentAge < 80) {
            agePensionTaxRate = 0.044;
          } else {
            agePensionTaxRate = 0.033;
          }
          
          const nationalPensionTax = adjustedNationalPension * agePensionTaxRate;
          person1NationalPension = adjustedNationalPension - nationalPensionTax;
        }
        
        // 배우자의 국민연금 (배우자 나이 기준)
        const spouseAge = currentAge - (inputs.retirementStartAge - inputs.spouseRetirementStartAge);
        if (spouseAge >= inputs.nationalPensionStartAge) {
          const yearsFromStart = spouseAge - inputs.nationalPensionStartAge;
          
          // 조기수령 감액률 계산
          const earlyYears = Math.max(0, NORMAL_PENSION_AGE - inputs.nationalPensionStartAge);
          const reductionRate = earlyYears * EARLY_REDUCTION_RATE_PER_YEAR;
          const adjustmentFactor = 1 - reductionRate;
          
          // 감액률 적용 후 물가상승률 반영
          const adjustedNationalPension = (inputs.nationalPensionYearly / 2) * adjustmentFactor * Math.pow(1 + inputs.inflationRate / 100, yearsFromStart);
          
          let agePensionTaxRate: number;
          if (spouseAge < 70) {
            agePensionTaxRate = 0.055;
          } else if (spouseAge < 80) {
            agePensionTaxRate = 0.044;
          } else {
            agePensionTaxRate = 0.033;
          }
          
          const nationalPensionTax = adjustedNationalPension * agePensionTaxRate;
          person2NationalPension = adjustedNationalPension - nationalPensionTax;
        }
        
        nationalPension = person1NationalPension + person2NationalPension;
        nationalPensionPreTax = nationalPension / 0.945;
      } else {
        // 단독 모드: 기존 로직
        if (currentAge >= inputs.nationalPensionStartAge) {
          const yearsFromStart = currentAge - inputs.nationalPensionStartAge;
          
          // 조기수령 감액률 계산
          const earlyYears = Math.max(0, NORMAL_PENSION_AGE - inputs.nationalPensionStartAge);
          const reductionRate = earlyYears * EARLY_REDUCTION_RATE_PER_YEAR;
          const adjustmentFactor = 1 - reductionRate;
          
          // 감액률 적용 후 물가상승률 반영
          const adjustedNationalPension = inputs.nationalPensionYearly * adjustmentFactor * Math.pow(1 + inputs.inflationRate / 100, yearsFromStart);
          
          let agePensionTaxRate: number;
          if (currentAge < 70) {
            agePensionTaxRate = 0.055;
          } else if (currentAge < 80) {
            agePensionTaxRate = 0.044;
          } else {
            agePensionTaxRate = 0.033;
          }
          
          nationalPensionPreTax = adjustedNationalPension;
          const nationalPensionTax = adjustedNationalPension * agePensionTaxRate;
          nationalPension = adjustedNationalPension - nationalPensionTax;
        }
      }
      
      // ========================================
      // 3단계: 효율적 인출 전략 (세금 최적화 + 연금소진모드)
      // ========================================
      
      // 3-1. 건보료 예측 (개인연금 포함하여 정확하게 계산)
      const propertyScore = Math.max(0, inputs.homeValue - propertyBasicDeduction) * propertyScoreRate;
      
      // 개인연금 예상 인출액 계산 (건보료 예측용)
      const canPerson1Withdraw = currentAge >= inputs.pensionStartAge;
      const spouseAge = currentAge - (inputs.retirementStartAge - inputs.spouseRetirementStartAge);
      const canPerson2Withdraw = isCoupleMode && spouseAge >= inputs.pensionStartAge;
      
      let estimatedPensionIncome = 0;
      if ((canPerson1Withdraw || canPerson2Withdraw) && pensionBalance > 0) {
        const maxWithdrawal = inputs.pensionWithdrawalAmount;
        estimatedPensionIncome = Math.min(maxWithdrawal, pensionBalance) * 0.945; // 세후 예상
      }
      
      const estimatedIncomeScore = estimatedPensionIncome * 0.002 / 1000;
      const estimatedTotalScore = estimatedIncomeScore + propertyScore;
      const estimatedHealthInsurance = estimatedTotalScore * scoreMonthlyPremium * 12;
      
      // 3-2. 고정 수입 합계
      const fixedIncome = nationalPension + homePension + lifeInsurancePension;
      
      // 3-3. 필요액 계산
      let remainingNeeded = livingCost + estimatedHealthInsurance - fixedIncome;
      
      // ========================================
      // 💡 연금소진모드: 세 자산을 모두 균등하게 소진
      // ========================================
      let pensionAfterTax = 0;
      let pensionPreTax = 0;
      let isaWithdrawal = 0;
      let overseasDividend = 0;
      let overseasStockSale = 0;
      
      if (inputs.usePensionDepletion) {
        // 🔥 연금소진모드 ON: 모든 자산을 시뮬레이션 종료까지 균등 소진
        const remainingYears = inputs.simulationEndAge - currentAge + 1;
        
        // 1️⃣ 개인연금 균등 소진
        const canPerson1Withdraw = currentAge >= inputs.pensionStartAge;
        const spouseAge = currentAge - (inputs.retirementStartAge - inputs.spouseRetirementStartAge);
        const canPerson2Withdraw = isCoupleMode && spouseAge >= inputs.pensionStartAge;
        
        if ((canPerson1Withdraw || canPerson2Withdraw) && pensionBalance > 0) {
          // ⚠️ 연금 수령 나이 도달 시부터 남은 기간 동안 균등 소진
          const pensionRemainingYears = inputs.simulationEndAge - Math.max(currentAge, inputs.pensionStartAge) + 1;
          const r = pensionReturnRate;
          
          if (pensionRemainingYears > 0 && r > 0) {
            const factor = Math.pow(1 + r, pensionRemainingYears);
            pensionPreTax = pensionBalance * (r * factor) / (factor - 1);
          } else if (pensionRemainingYears === 1) {
            pensionPreTax = pensionBalance;
          } else {
            pensionPreTax = pensionBalance / Math.max(1, pensionRemainingYears);
          }
          pensionPreTax = Math.min(pensionPreTax, pensionBalance);
          
          // 인출 (수익률은 루프 끝에서 공통 적용 위해 여기서는 차감만)
          pensionBalance = Math.max(0, pensionBalance - pensionPreTax);
          
          // 세금 계산
          let agePensionTaxRate: number;
          if (currentAge < 70) {
            agePensionTaxRate = 0.055;
          } else if (currentAge < 80) {
            agePensionTaxRate = 0.044;
          } else {
            agePensionTaxRate = 0.033;
          }
          
          const pensionSeparateTaxLimit2 = isCoupleMode ? 24000000 : 12000000;
          const withinLimit = Math.min(pensionPreTax, pensionSeparateTaxLimit2);
          const taxWithinLimit = withinLimit * agePensionTaxRate;
          const afterTaxWithinLimit = withinLimit - taxWithinLimit;
          
          const excessAmount = Math.max(0, pensionPreTax - pensionSeparateTaxLimit2);
          const excessTax = excessAmount * inputs.pensionExcessTaxRate;
          const afterTaxExcess = excessAmount - excessTax;
          
          pensionAfterTax = afterTaxWithinLimit + afterTaxExcess;
        }
        
        // 2️⃣ ISA 균등 소진
        if (isaBalance > 0) {
          const r = isaReturnRate;
          
          if (remainingYears > 0 && r > 0) {
            const factor = Math.pow(1 + r, remainingYears);
            isaWithdrawal = isaBalance * (r * factor) / (factor - 1);
          } else if (remainingYears === 1) {
            isaWithdrawal = isaBalance;
          } else {
            isaWithdrawal = isaBalance / Math.max(1, remainingYears);
          }
          isaWithdrawal = Math.min(isaWithdrawal, isaBalance);
          
          // 인출
          isaBalance = Math.max(0, isaBalance - isaWithdrawal);
        }
        
        // 3️⃣ 해외배당 (자동 수입)
        const overseasDividendPreTax = overseasBalance * 0.06;
        const overseasDividendTax = overseasDividendPreTax * overseasDividendTaxRate;
        overseasDividend = overseasDividendPreTax - overseasDividendTax;
        
        // 4️⃣ 해외주식 균등 소진 (배당 제외한 원금만)
        if (overseasBalance > 0) {
          const r = overseasReturnRate - 0.06;
          
          if (remainingYears > 0 && r > 0) {
            const factor = Math.pow(1 + r, remainingYears);
            overseasStockSale = overseasBalance * (r * factor) / (factor - 1);
          } else if (remainingYears === 1) {
            overseasStockSale = overseasBalance;
          } else {
            overseasStockSale = overseasBalance / Math.max(1, remainingYears);
          }
          overseasStockSale = Math.min(overseasStockSale, overseasBalance);
          
          // 인출
          overseasBalance = Math.max(0, overseasBalance - overseasStockSale);
        }
      } else {
        // ========================================
        // 💼 일반 모드: 필요한 만큼만 인출 (세금 최적화)
        // ========================================
        
        // 3-4. 해외배당 (자동 수입, 세율 고정 15.4%)
        const overseasDividendPreTax = overseasBalance * 0.06;
        const overseasDividendTax = overseasDividendPreTax * overseasDividendTaxRate;
        overseasDividend = overseasDividendPreTax - overseasDividendTax;
        remainingNeeded -= overseasDividend;
        
        // 3-5. 개인연금 인출
        if ((canPerson1Withdraw || canPerson2Withdraw) && pensionBalance > 0) {
          const neededPreTax = remainingNeeded / 0.945;
          const maxWithdrawal = inputs.pensionWithdrawalAmount;
          const actualWithdrawal = Math.min(neededPreTax, maxWithdrawal, pensionBalance);
          
          pensionPreTax = actualWithdrawal;
          pensionBalance = Math.max(0, pensionBalance - actualWithdrawal);
          
          // 세금 계산
          let agePensionTaxRate: number;
          if (currentAge < 70) {
            agePensionTaxRate = 0.055;
          } else if (currentAge < 80) {
            agePensionTaxRate = 0.044;
          } else {
            agePensionTaxRate = 0.033;
          }
          
          const pensionSeparateTaxLimit2 = isCoupleMode ? 24000000 : 12000000;
          const withinLimit = Math.min(actualWithdrawal, pensionSeparateTaxLimit2);
          const taxWithinLimit = withinLimit * agePensionTaxRate;
          const afterTaxWithinLimit = withinLimit - taxWithinLimit;
          
          const excessAmount = Math.max(0, actualWithdrawal - pensionSeparateTaxLimit2);
          const excessTax = excessAmount * inputs.pensionExcessTaxRate;
          const afterTaxExcess = excessAmount - excessTax;
          
          pensionAfterTax = afterTaxWithinLimit + afterTaxExcess;
          remainingNeeded -= pensionAfterTax;
        }
        
        // 3-6. ISA 인출 (부족할 때만 사용)
        isaWithdrawal = Math.min(Math.max(0, remainingNeeded), isaBalance);
        remainingNeeded -= isaWithdrawal;
        isaBalance = Math.max(0, isaBalance - isaWithdrawal);
        
        // 3-7. 해외주식 매도
        overseasStockSale = Math.min(Math.max(0, remainingNeeded), overseasBalance);
        remainingNeeded -= overseasStockSale;
        overseasBalance = Math.max(0, overseasBalance - overseasStockSale);
      }
      
      // ========================================
      // 4단계: 건보료 재계산 (개인연금 확정 후)
      // ========================================
      const healthInsuranceBaseIncome = pensionAfterTax;
      
      const incomeScore = healthInsuranceBaseIncome * 0.002 / 1000;
      const totalScore = incomeScore + propertyScore;
      const healthInsurance = totalScore * scoreMonthlyPremium * 12;
      
      // ========================================
      // 5단계: 총계 계산
      // ========================================
      let totalIncome = pensionAfterTax + nationalPension + homePension + lifeInsurancePension + isaWithdrawal + overseasDividend + overseasStockSale;
      const totalExpense = livingCost + healthInsurance;
      
      // 국민연금 수령 나이부터 500만원 추가 차감
      const additionalDeduction = currentAge >= inputs.nationalPensionStartAge ? 5000000 : 0;
      let yearlySurplus = totalIncome - totalExpense - additionalDeduction;
      
      // ========================================
      // 🔧 부족분 보전: ISA → 해외주식 순으로 추가 인출
      // ========================================
      if (yearlySurplus < 0) {
        const shortage = Math.abs(yearlySurplus);
        
        // 1단계: ISA에서 추가 인출
        const additionalIsaWithdrawal = Math.min(shortage, isaBalance);
        isaWithdrawal += additionalIsaWithdrawal;
        isaBalance = Math.max(0, isaBalance - additionalIsaWithdrawal);
        totalIncome += additionalIsaWithdrawal;
        yearlySurplus += additionalIsaWithdrawal;
        
        // 2단계: 여전히 부족하면 해외주식 추가 매도
        if (yearlySurplus < 0) {
          const remainingShortage = Math.abs(yearlySurplus);
          const additionalStockSale = Math.min(remainingShortage, overseasBalance);
          overseasStockSale += additionalStockSale;
          overseasBalance = Math.max(0, overseasBalance - additionalStockSale);
          totalIncome += additionalStockSale;
          yearlySurplus += additionalStockSale;
        }
      }
      
      // ========================================
      // 6단계: 모든 자산 수익률 적용 (연말 기준, 인출 후 잔액에 적용)
      // ========================================
      // ISA 수익률
      isaBalance = isaBalance * (1 + isaReturnRate);
      
      // 해외주식 수익률 (배당 6% 제외한 순수익률 적용)
      overseasBalance = overseasBalance * (1 + overseasReturnRate - 0.06);

      // 개인연금 수익률 (연금 수령 전후 모두 적용)
      pensionBalance = pensionBalance * (1 + pensionReturnRate);
      
      // ✅ 디버그: 56-60세 값 확인
      if (currentAge >= 56 && currentAge <= 60) {
        console.log(`=== ${currentYear}년 (${currentAge}세) 계산 ===`);
        console.log('생활비:', livingCost.toLocaleString());
        console.log('건강보험료:', healthInsurance.toLocaleString());
        console.log('총지출:', totalExpense.toLocaleString());
        if (additionalDeduction > 0) {
          console.log('추가차감(국민연금 수령 시):', additionalDeduction.toLocaleString());
        }
        console.log('---');
        console.log('개인연금(세후):', pensionAfterTax.toLocaleString());
        console.log('국민연금:', nationalPension.toLocaleString());
        console.log('주택연금:', homePension.toLocaleString());
        console.log('생명보험연금:', lifeInsurancePension.toLocaleString());
        console.log('ISA 인출:', isaWithdrawal.toLocaleString());
        console.log('해외배당:', overseasDividend.toLocaleString());
        console.log('해외매도:', overseasStockSale.toLocaleString());
        console.log('총소득:', totalIncome.toLocaleString());
        console.log('---');
        console.log('연 잉여/부족:', yearlySurplus.toLocaleString());
        console.log('');
      }
      
      rows.push({
        year: currentYear,
        age: currentAge,
        livingCost,
        isaWithdrawal,
        overseasDividend,
        overseasStockSale,
        pensionAfterTax,
        nationalPension,
        homePension,
        lifeInsurancePension,
        totalIncome: totalIncome, // ✅ 명시적으로 할당
        totalExpense: totalExpense, // ✅ 명시적으로 할당
        yearlySurplus,
        isaBalance,
        pensionBalance,
        overseasBalance,
        healthInsurance
      });
    }
    
    // ✅ 연잉여 마이너스 감지 (파이어족 실패 체크)
    let depletionAge: number | null = null;
    let fireSuccess = true;
    let failureData: typeof failureInfo = null;
    
    for (const row of rows) {
      // ⚠️ 연 잉여/부족이 마이너스인 경우 = 현금흐름 실패
      if (row.age < inputs.simulationEndAge && row.yearlySurplus < 0) {
        depletionAge = row.age;
        fireSuccess = false;
        
        // 실패 원인 분석
        const reasons: string[] = [];
        const deficit = Math.abs(row.yearlySurplus);
        
        // 1. 생활비 과다 체크 (총 지출의 50% 이상)
        if (row.livingCost > row.totalExpense * 0.5) {
          const excessAmount = Math.round((row.livingCost - row.totalExpense * 0.4) / 10000);
          reasons.push(`생활비 과다 (연 ${Math.round(row.livingCost/10000)}만원, 약 ${excessAmount}만원 초과)`);
        }
        
        // 2. 연금/ISA 수입 부족 체크
        const capitalIncome = row.pensionAfterTax + row.overseasDividend + row.overseasStockSale;
        if (capitalIncome < row.livingCost * 0.7) {
          reasons.push(`자산소득 부족 (연 ${Math.round(capitalIncome/10000)}만원, 생활비의 ${Math.round(capitalIncome/row.livingCost*100)}%)`);
        }
        
        // 3. 국민연금 미수령 체크
        if (row.age >= 65 && row.nationalPension === 0) {
          reasons.push(`국민연금 미수령 (${inputs.nationalPensionStartAge}세 수령 예정)`);
        }
        
        // 4. 세금/건보료 과다 체크 (총 지출의 20% 이상)
        const taxAndInsurance = row.totalExpense - row.livingCost;
        if (taxAndInsurance > row.totalExpense * 0.2) {
          reasons.push(`세금/건보료 과다 (연 ${Math.round(taxAndInsurance/10000)}만원, 지출의 ${Math.round(taxAndInsurance/row.totalExpense*100)}%)`);
        }
        
        // 5. 자산 고갈 체크
        const totalAssets = row.isaBalance + row.pensionBalance + row.overseasBalance;
        if (totalAssets < (inputs.totalPension + inputs.husbandISA + inputs.wifeISA) * 0.3) {
          reasons.push(`자산 고갈 위험 (총자산 ${Math.round(totalAssets/100000000)}억원, 초기 대비 ${Math.round(totalAssets/(inputs.totalPension+inputs.husbandISA+inputs.wifeISA+inputs.overseasInvestmentAmount)*100)}%)`);
        }
        
        failureData = {
          age: row.age,
          deficit: deficit,
          totalIncome: row.totalIncome,
          totalExpense: row.totalExpense,
          livingCost: row.livingCost,
          reason: reasons.length > 0 ? reasons : ['수입 부족으로 지출을 감당할 수 없습니다']
        };
        
        break;
      }
    }
    
    setAssetDepletionAge(depletionAge);
    setIsFireSuccess(fireSuccess);
    setFailureInfo(failureData);
    setResults(rows);
    setShowResults(true);
    
    // 토스트 메시지 표시
    toast('시뮬레이션 결과가 저장되었습니다', {
      duration: 2000,
    });
  };

  const formatAmount = (amount: number, hideAmount: boolean = false): string => {
    if (hideAmount) return "••••••";
    return new Intl.NumberFormat('ko-KR').format(Math.round(amount));
  };

  const getAmountColor = (amount: number): string => {
    if (amount > 0) return 'var(--color-profit)';
    if (amount < 0) return 'var(--color-loss)';
    return 'var(--text-primary)';
  };

  const resetForm = () => {
    setInputs({
      startYear: 2025,
      retirementStartAge: 54,
      spouseRetirementStartAge: 54,
      simulationEndAge: 85,
      monthlyLivingCostBefore75: 7000000, // 75세 이전 월 생활비
      monthlyLivingCostAfter75: 5000000, // 75세 이후 월 생활비
      inflationRate: 2,
      husbandISA: 100000000,
      wifeISA: 100000000,
      overseasInvestmentAmount: 130000000,
      totalPension: 1000000000,
      pensionWithdrawalAmount: 50000000,
      pensionReturnRate: 0.07,
      pensionExcessTaxRate: 0.15,
      homeValue: 650000000,
      pensionStartAge: 55,
      nationalPensionStartAge: 67,
      nationalPensionYearly: 30000000,
      homePensionStartAge: 55,
      homePensionMonthly: 1000000,
      lifeInsurancePensionStartAge: 55,
      lifeInsurancePensionYearly: 1450000,
      usePensionDepletion: false,
    });
    setShowResults(false);
    setResults([]);
    setIsFireSuccess(true);
    setAssetDepletionAge(null);
    setFailureInfo(null);
    setIsCoupleMode(false); // 부부 모드 초기화
    
    // localStorage도 초기화
    localStorage.removeItem('cashFlowData');
  };

  // 📥 CSV 다운로드
  const downloadCSV = () => {
    const headers = [
      '나이', '년도', 'ISA인출', '해외배당', '해외매도', '개인연금(세후)', 
      '주택연금', '국민연금', '생명보험연금', '총수입', '생활비', '건보료', '총지출', '연잉여', 
      'ISA잔액', '연금잔액', '해외투자잔액'
    ];
    
    const rows = results.map(row => [
      row.age,
      row.year,
      Math.round(row.isaWithdrawal),
      Math.round(row.overseasDividend),
      Math.round(row.overseasStockSale),
      Math.round(row.pensionAfterTax),
      Math.round(row.homePension),
      Math.round(row.nationalPension),
      Math.round(row.lifeInsurancePension),
      Math.round(row.totalIncome),
      Math.round(row.livingCost),
      Math.round(row.healthInsurance),
      Math.round(row.totalExpense),
      Math.round(row.yearlySurplus),
      Math.round(row.isaBalance),
      Math.round(row.pensionBalance),
      Math.round(row.overseasBalance)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `현금흐름시뮬레이션_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // 📥 Excel 형식 다운로드 (CSV with Excel 호환)
  const downloadExcel = () => {
    const headers = [
      '나이', '년도', 'ISA인출', '해외배당', '해외매도', '개인연금(세후)', 
      '주택연금', '국민연금', '생명보험연금', '총수입', '생활비', '건보료', '총지출', '연잉여', 
      'ISA잔액', '연금잔액', '해외투자잔액'
    ];
    
    const rows = results.map(row => [
      row.age,
      row.year,
      Math.round(row.isaWithdrawal),
      Math.round(row.overseasDividend),
      Math.round(row.overseasStockSale),
      Math.round(row.pensionAfterTax),
      Math.round(row.homePension),
      Math.round(row.nationalPension),
      Math.round(row.lifeInsurancePension),
      Math.round(row.totalIncome),
      Math.round(row.livingCost),
      Math.round(row.healthInsurance),
      Math.round(row.totalExpense),
      Math.round(row.yearlySurplus),
      Math.round(row.isaBalance),
      Math.round(row.pensionBalance),
      Math.round(row.overseasBalance)
    ]);

    // Excel 호환 CSV (탭 구분)
    const csvContent = [
      headers.join('\t'),
      ...rows.map(row => row.join('\t'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `현금흐름시뮬레이션_${new Date().toISOString().split('T')[0]}.xls`;
    link.click();
  };

  // 📥 JSON 다운로드
  const downloadJSON = () => {
    const data = {
      metadata: {
        exportDate: new Date().toISOString(),
        retirementStartAge: inputs.retirementStartAge,
        simulationEndAge: inputs.simulationEndAge,
        monthlyLivingCostBefore75: inputs.monthlyLivingCostBefore75,
        monthlyLivingCostAfter75: inputs.monthlyLivingCostAfter75,
        inflationRate: inputs.inflationRate,
        totalPension: inputs.totalPension,
        pensionReturnRate: inputs.pensionReturnRate,
        usePensionDepletion: inputs.usePensionDepletion,
        isFireSuccess: isFireSuccess,
        assetDepletionAge: assetDepletionAge,
        failureInfo: failureInfo
      },
      results: results
    };

    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `현금흐름시뮬레이션_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  // 📥 텍스트 리포트 다운로드
  const downloadReport = () => {
    const reportLines = [
      '='.repeat(80),
      '현금흐름 시뮬레이션 리포트',
      '='.repeat(80),
      '',
      `생성일시: ${new Date().toLocaleString('ko-KR')}`,
      '',
      '【 입력 조건 】',
      '-'.repeat(80),
      `은퇴 시작 나이: ${inputs.retirementStartAge}세`,
      `시뮬레이션 종료 나이: ${inputs.simulationEndAge}세`,
      `75세 이전 월 생활비: ${formatAmount(inputs.monthlyLivingCostBefore75)}원`,
      `75세 이후 월 생활비: ${formatAmount(inputs.monthlyLivingCostAfter75)}원`,
      `물가상승률: ${inputs.inflationRate}%`,
      `초기 총 연금: ${formatAmount(inputs.totalPension)}원`,
      `연금 연수익률: ${(inputs.pensionReturnRate * 100).toFixed(1)}%`,
      `연금소진 모드: ${inputs.usePensionDepletion ? 'ON' : 'OFF'}`,
      '',
      '【 시뮬레이션 결과 】',
      '-'.repeat(80),
      `파이어족 성공: ${isFireSuccess ? '✅ 성공' : '❌ 실패'}`,
      assetDepletionAge ? `실패 나이: ${assetDepletionAge}세` : '',
      failureInfo ? `연 부족액: ${formatAmount(failureInfo.deficit)}원` : '',
      '',
      '【 연도별 상세 데이터 】',
      '-'.repeat(80),
      '나이\t년도\t총수입\t\t총지출\t\t연잉여\t\t총자산',
      '-'.repeat(80),
      ...results.map(row => 
        `${row.age}세\t${row.year}\t${formatAmount(row.totalIncome)}\t${formatAmount(row.totalExpense)}\t${formatAmount(row.yearlySurplus)}\t${formatAmount(row.isaBalance + row.pensionBalance + row.overseasBalance)}`
      ),
      '',
      '='.repeat(80),
      'Report End',
      '='.repeat(80)
    ].filter(line => line !== undefined);

    const reportContent = reportLines.join('\n');
    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `현금흐름리포트_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
  };

  return (
    <>
      <Toaster position="top-center" toastOptions={{
        style: {
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 12,
          padding: '12px 16px',
          fontSize: 13,
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        },
        descriptionClassName: 'toast-desc',
      }} />
      <div style={{ height: '100%', overflowY: 'auto', padding: 24, backgroundColor: 'var(--bg-page)' }}>

      {/* 입력 폼 */}
      <div className="toss-card" style={{ padding: 24, marginBottom: 24, border: '1px solid var(--border-primary)', borderRadius: 16, backgroundColor: 'var(--bg-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 'var(--font-bold)' as any, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calculator style={{ width: 18, height: 18, color: 'var(--accent-blue)' }} />
            입력값 설정
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setIsInputExpanded(!isInputExpanded)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' as any, color: 'var(--text-secondary)', borderRadius: 4 }}
              title={isInputExpanded ? "접기" : "펼치기"}
            >
              {isInputExpanded ? <ChevronUp style={{ width: 16, height: 16 }} /> : <ChevronDown style={{ width: 16, height: 16 }} />}
            </button>
            <button
              onClick={resetForm}
              style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' as any, color: 'var(--text-secondary)', borderRadius: 4, border: '1px solid var(--border-primary)' }}
            >
              <RotateCcw style={{ width: 16, height: 16 }} />
              초기화
            </button>
            <button
              onClick={() => setIsCoupleMode(!isCoupleMode)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, fontSize: 'var(--text-sm)', borderRadius: 4, fontWeight: 'var(--font-semibold)' as any, backgroundColor: isCoupleMode ? '#9333ea' : 'var(--bg-tertiary)', color: isCoupleMode ? '#ffffff' : 'var(--text-primary)', border: isCoupleMode ? '1px solid #9333ea' : '1px solid var(--border-primary)' }}
            >
              부부 {isCoupleMode ? '✓' : ''}
            </button>
          </div>
        </div>

        {isInputExpanded && (
          <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 24 }}>
          {/* 기본 정보 */}
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' as any, color: 'var(--text-secondary)', marginBottom: 8 }}>
              시작 년도
            </label>
            <input
              type="number"
              value={inputs.startYear}
              onChange={(e) => handleInputChange('startYear', e.target.value)}
              className="toss-input" style={{ width: '100%', paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8, border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 'var(--text-base)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' as any, color: 'var(--text-secondary)', marginBottom: 8 }}>
              {isCoupleMode ? '본인 은퇴 시작 나이' : '은퇴 시작 나이'}
            </label>
            <input
              type="number"
              value={inputs.retirementStartAge}
              onChange={(e) => handleInputChange('retirementStartAge', e.target.value)}
              className="toss-input" style={{ width: '100%', paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8, border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 'var(--text-base)' }}
            />
          </div>

          {isCoupleMode && (
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' as any, color: 'var(--text-secondary)', marginBottom: 8 }}>
                배우자 은퇴 시작 나이
              </label>
              <input
                type="number"
                value={inputs.spouseRetirementStartAge}
                onChange={(e) => handleInputChange('spouseRetirementStartAge', e.target.value)}
                className="toss-input" style={{ width: '100%', paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8, border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 'var(--text-base)' }}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' as any, color: 'var(--text-secondary)', marginBottom: 8 }}>
              시뮬레이션 종료 나이
            </label>
            <input
              type="number"
              value={inputs.simulationEndAge}
              onChange={(e) => handleInputChange('simulationEndAge', e.target.value)}
              className="toss-input" style={{ width: '100%', paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8, border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 'var(--text-base)' }}
            />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' as any, color: 'var(--text-secondary)', marginBottom: 8 }}>
              75세 이전 월 생활비 (원)
              <div style={{ position: 'relative' }}>
                <Info style={{ width: 16, height: 16, color: 'var(--accent-blue)', cursor: 'help' }} />
                <div style={{ position: 'absolute', left: '100%', marginLeft: 8, top: 0, width: 288, padding: 12, backgroundColor: '#111827', color: '#ffffff', borderRadius: 8, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', zIndex: 50, display: 'none' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <p style={{ fontWeight: 'var(--font-bold)' as any, fontSize: 'var(--text-xs)', marginBottom: 8, color: '#93c5fd', borderBottom: '1px solid #374151', paddingBottom: 6 }}>💰 월별 지출 내역</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 400, overflowY: 'auto', paddingRight: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>도시가스</span>
                        <span style={{ fontFamily: 'monospace' }}>₩50,000</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>관리비</span>
                        <span style={{ fontFamily: 'monospace' }}>₩200,000</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>인터넷</span>
                        <span style={{ fontFamily: 'monospace' }}>₩55,230</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>오빠휴대폰1</span>
                        <span style={{ fontFamily: 'monospace' }}>₩21,000</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>지윤휴대폰2</span>
                        <span style={{ fontFamily: 'monospace' }}>₩100,000</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>대중교통</span>
                        <span style={{ fontFamily: 'monospace' }}>₩100,000</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>하이패스</span>
                        <span style={{ fontFamily: 'monospace' }}>₩300,000</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>구독료</span>
                        <span style={{ fontFamily: 'monospace' }}>₩20,000</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>오빠실비</span>
                        <span style={{ fontFamily: 'monospace' }}>₩55,897</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>JY실비</span>
                        <span style={{ fontFamily: 'monospace' }}>₩69,020</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>JY암</span>
                        <span style={{ fontFamily: 'monospace' }}>₩28,000</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>오빠암보험</span>
                        <span style={{ fontFamily: 'monospace' }}>₩32,000</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>운전자보험</span>
                        <span style={{ fontFamily: 'monospace' }}>₩13,350</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>JY보험(K)</span>
                        <span style={{ fontFamily: 'monospace' }}>₩12,672</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>JY보험(K)</span>
                        <span style={{ fontFamily: 'monospace' }}>₩10,140</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>주택화재보험</span>
                        <span style={{ fontFamily: 'monospace' }}>₩9,900</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>JY독감보험</span>
                        <span style={{ fontFamily: 'monospace' }}>₩10,140</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>자동차세</span>
                        <span style={{ fontFamily: 'monospace' }}>₩500,000</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>오빠치아보험</span>
                        <span style={{ fontFamily: 'monospace' }}>₩30,700</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>어머님실비</span>
                        <span style={{ fontFamily: 'monospace' }}>₩161,684</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>엄마실비</span>
                        <span style={{ fontFamily: 'monospace' }}>₩123,610</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>엄마암</span>
                        <span style={{ fontFamily: 'monospace' }}>₩33,000</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>양압기</span>
                        <span style={{ fontFamily: 'monospace' }}>₩15,200</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>대출</span>
                        <span style={{ fontFamily: 'monospace' }}>₩930,000</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>용돈</span>
                        <span style={{ fontFamily: 'monospace' }}>₩850,000</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)' as any, color: '#fde047', marginTop: 8, paddingTop: 8, borderTop: '1px solid #374151' }}>
                        <span>합계</span>
                        <span style={{ fontFamily: 'monospace' }}>₩3,731,543</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ position: 'absolute', right: '100%', top: 16, marginRight: -8, width: 0, height: 0, borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderRight: '8px solid #111827' }}></div>
                </div>
              </div>
            </label>
            <input
              type="text"
              value={formatInputAmount(inputs.monthlyLivingCostBefore75)}
              onChange={(e) => handleInputChange('monthlyLivingCostBefore75', e.target.value)}
              className="toss-input" style={{ width: '100%', paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8, border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 'var(--text-base)' }}
            />
            {inputs.monthlyLivingCostBefore75 > 0 && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-blue)', marginTop: 6 }}>
                {formatKoreanAmount(inputs.monthlyLivingCostBefore75)}
              </p>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' as any, color: 'var(--text-secondary)', marginBottom: 8 }}>
              75세 이후 월 생활비 (원)
            </label>
            <input
              type="text"
              value={formatInputAmount(inputs.monthlyLivingCostAfter75)}
              onChange={(e) => handleInputChange('monthlyLivingCostAfter75', e.target.value)}
              className="toss-input" style={{ width: '100%', paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8, border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 'var(--text-base)' }}
            />
            {inputs.monthlyLivingCostAfter75 > 0 && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-profit)', marginTop: 6 }}>
                {formatKoreanAmount(inputs.monthlyLivingCostAfter75)}
              </p>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' as any, color: 'var(--text-secondary)', marginBottom: 8 }}>
              물가상승률 (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={inputs.inflationRate}
              onChange={(e) => handleInputChange('inflationRate', e.target.value)}
              className="toss-input" style={{ width: '100%', paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8, border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 'var(--text-base)' }}
            />
          </div>

          {/* 자산 */}
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' as any, color: 'var(--text-secondary)', marginBottom: 8 }}>
              남편 ISA (원)
            </label>
            <input
              type="text"
              value={formatInputAmount(inputs.husbandISA)}
              onChange={(e) => handleInputChange('husbandISA', e.target.value)}
              className="toss-input" style={{ width: '100%', paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8, border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 'var(--text-base)' }}
            />
            {inputs.husbandISA > 0 && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-blue)', marginTop: 6 }}>
                {formatKoreanAmount(inputs.husbandISA)}
              </p>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' as any, color: 'var(--text-secondary)', marginBottom: 8 }}>
              아내 ISA (원)
            </label>
            <input
              type="text"
              value={formatInputAmount(inputs.wifeISA)}
              onChange={(e) => handleInputChange('wifeISA', e.target.value)}
              className="toss-input" style={{ width: '100%', paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8, border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 'var(--text-base)' }}
            />
            {inputs.wifeISA > 0 && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-blue)', marginTop: 6 }}>
                {formatKoreanAmount(inputs.wifeISA)}
              </p>
            )}
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' as any, color: 'var(--text-secondary)', marginBottom: 8 }}>
              해외직투금액
              <div style={{ position: 'relative' }}>
                <Info style={{ width: 16, height: 16, color: 'var(--accent-blue)', cursor: 'help' }} />
                <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: '100%', marginBottom: 8, width: 288, padding: 12, backgroundColor: '#111827', color: '#ffffff', fontSize: 'var(--text-xs)', borderRadius: 8, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', zIndex: 50, pointerEvents: 'none', display: 'none' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <p style={{ fontWeight: 'var(--font-semibold)' as any, color: '#93c5fd' }}>해외직투 배당+매도 전략</p>
                    <p style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                      <span>📊</span>
                      <span>연 6% 배당 수령 + 90세에 잔액 0 목표</span>
                    </p>
                    <p style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                      <span>💡</span>
                      <span>2억 투자 시 매달 배당 100만원 + 매도 약 32만원 = 총 132만원 확보</span>
                    </p>
                  </div>
                  <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '100%', width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '4px solid #111827' }}></div>
                </div>
              </div>
            </label>
            <input
              type="text"
              value={formatInputAmount(inputs.overseasInvestmentAmount)}
              onChange={(e) => handleInputChange('overseasInvestmentAmount', e.target.value)}
              className="toss-input" style={{ width: '100%', paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8, border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 'var(--text-base)' }}
            />
            {inputs.overseasInvestmentAmount > 0 && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-blue)', marginTop: 6 }}>
                {formatKoreanAmount(inputs.overseasInvestmentAmount)}
              </p>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' as any, color: 'var(--text-secondary)', marginBottom: 8 }}>
              ISA 연수익률 (%)
            </label>
            <input
              type="text"
              value={((inputs.isaReturnRate || 0.05) * 100).toFixed(1)}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                setInputs(prev => ({ ...prev, isaReturnRate: value / 100 }));
              }}
              className="toss-input" style={{ width: '100%', paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8, border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 'var(--text-base)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' as any, color: 'var(--text-secondary)', marginBottom: 8 }}>
              해외주식 연수익률 (%)
            </label>
            <input
              type="text"
              value={((inputs.overseasReturnRate || 0.07) * 100).toFixed(1)}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                setInputs(prev => ({ ...prev, overseasReturnRate: value / 100 }));
              }}
              className="toss-input" style={{ width: '100%', paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8, border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 'var(--text-base)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' as any, color: 'var(--text-secondary)', marginBottom: 8 }}>
              연금계좌 합계 (원)
            </label>
            <input
              type="text"
              value={formatInputAmount(inputs.totalPension)}
              onChange={(e) => handleInputChange('totalPension', e.target.value)}
              className="toss-input" style={{ width: '100%', paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8, border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 'var(--text-base)' }}
            />
            {inputs.totalPension > 0 && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-blue)', marginTop: 6 }}>
                {formatKoreanAmount(inputs.totalPension)}
              </p>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' as any, color: 'var(--text-secondary)', marginBottom: 8 }}>
              연금 인출 금액 (원)
            </label>
            <input
              type="text"
              value={formatInputAmount(inputs.pensionWithdrawalAmount)}
              onChange={(e) => handleInputChange('pensionWithdrawalAmount', e.target.value)}
              className="toss-input" style={{ width: '100%', paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8, border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 'var(--text-base)' }}
            />
            {inputs.pensionWithdrawalAmount > 0 && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-blue)', marginTop: 6 }}>
                {formatKoreanAmount(inputs.pensionWithdrawalAmount)}
              </p>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' as any, color: 'var(--text-secondary)', marginBottom: 8 }}>
              연금 연수익률 (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={inputs.pensionReturnRate ? (inputs.pensionReturnRate * 100).toFixed(1) : '5.0'}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                handleInputChange('pensionReturnRate', (value / 100).toString());
              }}
              className="toss-input" style={{ width: '100%', paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8, border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 'var(--text-base)' }}
            />
            <p style={{ fontSize: 'var(--text-xs)', color: '#059669', marginTop: 6 }}>
              연간 수익 = 연금잔액 × {inputs.pensionReturnRate ? (inputs.pensionReturnRate * 100).toFixed(1) : '3.0'}%
            </p>
          </div>

          {/* 연금소진 토글 */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' as any, color: 'var(--text-secondary)', marginBottom: 8 }}>
              <span>연금소진 모드</span>
              <button
                type="button"
                onClick={() => setInputs({ ...inputs, usePensionDepletion: !inputs.usePensionDepletion })}
                style={{ position: 'relative', display: 'inline-flex', height: 24, width: 44, alignItems: 'center', borderRadius: 9999, backgroundColor: inputs.usePensionDepletion ? 'var(--accent-blue)' : '#d1d5db' }}
              >
                <span
                  style={{ display: 'inline-block', height: 16, width: 16, borderRadius: '50%', backgroundColor: '#ffffff', transform: inputs.usePensionDepletion ? 'translateX(24px)' : 'translateX(4px)' }}
                />
              </button>
            </label>
            <p style={{ fontSize: 'var(--text-xs)', color: '#d97706', marginTop: 6 }}>
              {inputs.usePensionDepletion 
                ? `✅ ON: ${inputs.simulationEndAge}세에 연금잔액 0원이 되도록 자동 계산` 
                : '❌ OFF: 입력한 연금인출금액 사용'}
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' as any, color: 'var(--text-secondary)', marginBottom: 8 }}>
              주택 시가 (원)
            </label>
            <input
              type="text"
              value={formatInputAmount(inputs.homeValue)}
              onChange={(e) => handleInputChange('homeValue', e.target.value)}
              className="toss-input" style={{ width: '100%', paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8, border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 'var(--text-base)' }}
            />
            {inputs.homeValue > 0 && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-blue)', marginTop: 6 }}>
                {formatKoreanAmount(inputs.homeValue)}
              </p>
            )}
          </div>

          {/* 연금 */}
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' as any, color: 'var(--text-secondary)', marginBottom: 8 }}>
              연금 개시 나이
            </label>
            <input
              type="number"
              value={inputs.pensionStartAge}
              onChange={(e) => handleInputChange('pensionStartAge', e.target.value)}
              className="toss-input" style={{ width: '100%', paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8, border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 'var(--text-base)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' as any, color: 'var(--text-secondary)', marginBottom: 8 }}>
              국민연금 개시 나이
            </label>
            <input
              type="number"
              value={inputs.nationalPensionStartAge}
              onChange={(e) => handleInputChange('nationalPensionStartAge', e.target.value)}
              className="toss-input" style={{ width: '100%', paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8, border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 'var(--text-base)' }}
            />
            {inputs.nationalPensionStartAge < 67 && (
              <div style={{ marginTop: 8, padding: 10, backgroundColor: '#fff7ed', borderRadius: 8, border: '1px solid #fed7aa' }}>
                <p style={{ fontSize: 'var(--text-xs)', color: '#c2410c', fontWeight: 'var(--font-medium)' as any }}>
                  ⚠️ 조기수령 감액: {67 - inputs.nationalPensionStartAge}년 × 6% = {((67 - inputs.nationalPensionStartAge) * 6)}% 감액
                </p>
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' as any, color: 'var(--text-secondary)', marginBottom: 8 }}>
              국민연금 연금액 (월, 원)
            </label>
            <p style={{ fontSize: 11, color: 'var(--accent-blue)', marginBottom: 6 }}>
              📌 67세 정상수령 기준 금액을 입력하세요
            </p>
            <input
              type="text"
              value={formatInputAmount(inputs.nationalPensionYearly / 12)}
              onChange={(e) => {
                const monthlyValue = parseFloat(e.target.value.replace(/,/g, '')) || 0;
                handleInputChange('nationalPensionYearly', (monthlyValue * 12).toString());
              }}
              className="toss-input" style={{ width: '100%', paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8, border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 'var(--text-base)' }}
            />
            {inputs.nationalPensionYearly > 0 && (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-blue)' }}>
                  67세 기준: 월 {formatKoreanAmount(inputs.nationalPensionYearly / 12)} (연 {formatKoreanAmount(inputs.nationalPensionYearly)})
                </p>
                {inputs.nationalPensionStartAge < 67 && (
                  <p style={{ fontSize: 'var(--text-xs)', color: '#ea580c', fontWeight: 'var(--font-medium)' as any }}>
                    {inputs.nationalPensionStartAge}세 수령 시: 월 {formatKoreanAmount((inputs.nationalPensionYearly / 12) * (1 - (67 - inputs.nationalPensionStartAge) * 0.06))} (연 {formatKoreanAmount(inputs.nationalPensionYearly * (1 - (67 - inputs.nationalPensionStartAge) * 0.06))})
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 주택연금 */}
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' as any, color: 'var(--text-secondary)', marginBottom: 8 }}>
              주택연금 개시 나이
            </label>
            <input
              type="number"
              value={inputs.homePensionStartAge}
              onChange={(e) => handleInputChange('homePensionStartAge', e.target.value)}
              className="toss-input" style={{ width: '100%', paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8, border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 'var(--text-base)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' as any, color: 'var(--text-secondary)', marginBottom: 8 }}>
              주택연금 월수령액 (원)
            </label>
            <input
              type="text"
              value={formatInputAmount(inputs.homePensionMonthly)}
              onChange={(e) => handleInputChange('homePensionMonthly', e.target.value)}
              className="toss-input" style={{ width: '100%', paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8, border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 'var(--text-base)' }}
            />
            {inputs.homePensionMonthly > 0 && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-blue)', marginTop: 6 }}>
                {formatKoreanAmount(inputs.homePensionMonthly)}
              </p>
            )}
          </div>
        </div>

        {/* 생명보험연금 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' as any, color: 'var(--text-secondary)', marginBottom: 8 }}>
              생명보험연금 개시 나이
            </label>
            <input
              type="number"
              value={inputs.lifeInsurancePensionStartAge}
              onChange={(e) => handleInputChange('lifeInsurancePensionStartAge', e.target.value)}
              className="toss-input" style={{ width: '100%', paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8, border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 'var(--text-base)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' as any, color: 'var(--text-secondary)', marginBottom: 8 }}>
              생명보험연금 연수령액 (원)
            </label>
            <input
              type="text"
              value={formatInputAmount(inputs.lifeInsurancePensionYearly)}
              onChange={(e) => handleInputChange('lifeInsurancePensionYearly', e.target.value)}
              className="toss-input" style={{ width: '100%', paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8, border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 'var(--text-base)' }}
            />
            {inputs.lifeInsurancePensionYearly > 0 && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-blue)', marginTop: 6 }}>
                {formatKoreanAmount(inputs.lifeInsurancePensionYearly)}
              </p>
            )}
          </div>
        </div>

        <div style={{ marginTop: 32, display: 'flex', flexDirection: 'row', gap: 16 }}>
          <button
            onClick={calculateSimulation}
            className="toss-btn" style={{ padding: '10px 24px', backgroundColor: 'var(--accent-blue)', color: '#fff', fontWeight: 600, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)' }}
          >
            <TrendingUp style={{ width: 20, height: 20 }} />
            시뮬레이션 실행
          </button>
          
          {showResults && results.length > 0 && (
            <button
              onClick={() => setShowDownloadModal(true)}
              className="toss-btn" style={{ padding: '10px 24px', backgroundColor: '#16a34a', color: '#fff', fontWeight: 600, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)' }}
            >
              <Download style={{ width: 20, height: 20 }} />
              결과 다운로드
            </button>
          )}
        </div>
        </>
        )}
      </div>

      {/* 다운로드 모달 */}
      {showDownloadModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 16, padding: 24, maxWidth: 672, width: '100%', border: '2px solid var(--accent-blue)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h3 style={{ fontSize: 22, fontWeight: 'var(--font-bold)' as any, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Download style={{ width: 24, height: 24, color: 'var(--accent-blue)' }} />
                시뮬레이션 결과 다운로드
              </h3>
              <button onClick={() => setShowDownloadModal(false)} style={{ padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }}>
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            <div style={{ marginBottom: 24, padding: 16, backgroundColor: 'var(--accent-blue-bg)', borderRadius: 12, border: '1px solid #bfdbfe' }}>
              <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>
                <strong style={{ color: 'var(--accent-blue)' }}>총 {results.length}개 연도</strong>의 시뮬레이션 데이터를 다양한 형식으로 다운로드할 수 있습니다.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              {/* Excel 다운로드 */}
              <button onClick={() => { downloadExcel(); setShowDownloadModal(false); }} style={{ padding: 24, backgroundColor: '#f0fdf4', borderRadius: 12, border: '2px solid #4ade80', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ flexShrink: 0, width: 48, height: 48, backgroundColor: '#16a34a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileSpreadsheet style={{ width: 24, height: 24, color: '#ffffff' }} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)' as any, color: '#15803d', marginBottom: 4 }}>Excel 파일</h4>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 8 }}>.xls 형식 (Excel에서 바로 열기)</p>
                    <p style={{ fontSize: 'var(--text-xs)', color: '#059669' }}>✅ 추천: 데이터 분석 및 차트 작성</p>
                  </div>
                </div>
              </button>

              {/* CSV 다운로드 */}
              <button onClick={() => { downloadCSV(); setShowDownloadModal(false); }} style={{ padding: 24, backgroundColor: 'var(--accent-blue-bg)', borderRadius: 12, border: '2px solid var(--accent-blue)', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ flexShrink: 0, width: 48, height: 48, backgroundColor: 'var(--accent-blue)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileSpreadsheet style={{ width: 24, height: 24, color: '#ffffff' }} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)' as any, color: '#1d4ed8', marginBottom: 4 }}>CSV 파일</h4>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 8 }}>.csv 형식 (범용 데이터)</p>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-blue)' }}>📊 Google 스프레드시트 호환</p>
                  </div>
                </div>
              </button>

              {/* JSON 다운로드 */}
              <button onClick={() => { downloadJSON(); setShowDownloadModal(false); }} style={{ padding: 24, backgroundColor: '#faf5ff', borderRadius: 12, border: '2px solid #c084fc', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ flexShrink: 0, width: 48, height: 48, backgroundColor: '#9333ea', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileJson style={{ width: 24, height: 24, color: '#ffffff' }} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)' as any, color: '#7e22ce', marginBottom: 4 }}>JSON 파일</h4>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 8 }}>.json 형식 (완전한 백업)</p>
                    <p style={{ fontSize: 'var(--text-xs)', color: '#9333ea' }}>💾 입력값 + 결과 + 실패정보 포함</p>
                  </div>
                </div>
              </button>

              {/* 텍스트 리포트 다운로드 */}
              <button onClick={() => { downloadReport(); setShowDownloadModal(false); }} style={{ padding: 24, backgroundColor: '#fffbeb', borderRadius: 12, border: '2px solid #fbbf24', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ flexShrink: 0, width: 48, height: 48, backgroundColor: '#d97706', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText style={{ width: 24, height: 24, color: '#ffffff' }} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)' as any, color: '#b45309', marginBottom: 4 }}>텍스트 리포트</h4>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 8 }}>.txt 형식 (읽기 쉬운 리포트)</p>
                    <p style={{ fontSize: 'var(--text-xs)', color: '#d97706' }}>📄 요약 정보 + 전체 데이터</p>
                  </div>
                </div>
              </button>
            </div>

            <div style={{ marginTop: 24, padding: 16, backgroundColor: 'var(--bg-secondary)', borderRadius: 12 }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', textAlign: 'center' }}>
                💡 <strong>Tip:</strong> Excel 파일은 즉시 편집 가능하며, JSON은 나중에 불러오기 용도로 사용할 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 결과 테이블 */}
      {showResults && results.length > 0 && (
        <>
          {/* ⚠️ 파이어족 실패 경고 */}
          {!isFireSuccess && assetDepletionAge && failureInfo && (
            <div style={{ marginBottom: 24, backgroundColor: '#fef2f2', borderRadius: 16, padding: 16, border: '1px solid rgba(239,68,68,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flexShrink: 0, width: 40, height: 40, backgroundColor: '#dc2626', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-xl)' }}>⚠️</div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 900, color: '#b91c1c', marginBottom: 8 }}>파이어족 실패 경고!</h2>
                  <p style={{ fontSize: 15, fontWeight: 'var(--font-bold)' as any, color: 'var(--color-profit)', marginBottom: 4 }}>{assetDepletionAge}세에 현금흐름이 마이너스가 됩니다! 😱</p>
                  <p style={{ fontSize: 'var(--text-sm)', color: '#ef4444', marginBottom: 8 }}>연 부족액: <strong style={{ fontSize: 15 }}>{formatAmount(failureInfo.deficit)}원</strong></p>

                  <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 12, padding: 12, marginBottom: 8, border: '2px solid #f87171' }}>
                    <p style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)' as any, color: '#b91c1c', marginBottom: 8 }}>📊 {assetDepletionAge}세 현금흐름 분석</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 'var(--text-sm)' }}>
                      <div style={{ backgroundColor: 'var(--accent-blue-bg)', borderRadius: 8, padding: 8 }}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 2 }}>총 수입</p>
                        <p style={{ color: '#1d4ed8', fontWeight: 'var(--font-bold)' as any }}>{formatAmount(failureInfo.totalIncome)}원</p>
                      </div>
                      <div style={{ backgroundColor: '#fef2f2', borderRadius: 8, padding: 8 }}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 2 }}>총 지출</p>
                        <p style={{ color: '#b91c1c', fontWeight: 'var(--font-bold)' as any }}>{formatAmount(failureInfo.totalExpense)}원</p>
                      </div>
                      <div style={{ backgroundColor: '#fff7ed', borderRadius: 8, padding: 8 }}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 2 }}>생활비</p>
                        <p style={{ color: '#c2410c', fontWeight: 'var(--font-bold)' as any }}>{formatAmount(failureInfo.livingCost)}원</p>
                      </div>
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 12, padding: 12, marginBottom: 8, border: '2px solid #fb923c' }}>
                    <p style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)' as any, color: '#c2410c', marginBottom: 8 }}>🔍 실패 원인 분석</p>
                    <ul style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                      {failureInfo.reason.map((reason, idx) => (
                        <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, backgroundColor: '#fff7ed', borderRadius: 8, padding: 6 }}>
                          <span style={{ color: 'var(--color-profit)', fontWeight: 'var(--font-bold)' as any, marginTop: 2 }}>⚠️</span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 12, padding: 12, marginBottom: 8, border: '2px solid #4ade80' }}>
                    <p style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)' as any, color: '#15803d', marginBottom: 8 }}>💡 해결 방안 (우선순위별)</p>
                    <ul style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ color: 'var(--color-profit)', fontWeight: 'var(--font-bold)' as any }}>1️⃣</span>
                        <span><strong style={{ color: 'var(--color-profit)' }}>월 생활비 감소:</strong> 현재 75세이전 {formatAmount(inputs.monthlyLivingCostBefore75)}원 → 추천: <span style={{ color: 'var(--accent-blue)', fontWeight: 'var(--font-bold)' as any }}>{formatAmount(Math.max(inputs.monthlyLivingCostBefore75 - failureInfo.deficit / 12, inputs.monthlyLivingCostBefore75 * 0.7))}원</span> (부족액 해소)</span>
                      </li>
                      {inputs.usePensionDepletion ? (
                        <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <span style={{ color: '#ea580c', fontWeight: 'var(--font-bold)' as any }}>2️⃣</span>
                          <span><strong style={{ color: '#ea580c' }}>연금소진 모드 OFF:</strong> 고정 인출액으로 변경하여 초반 현금흐름 안정화</span>
                        </li>
                      ) : (
                        <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <span style={{ color: '#ea580c', fontWeight: 'var(--font-bold)' as any }}>2️⃣</span>
                          <span><strong style={{ color: '#ea580c' }}>개인연금 인출액 증가:</strong> 현재 {formatAmount(inputs.pensionWithdrawalAmount)}원 → 추천: <span style={{ color: 'var(--accent-blue)', fontWeight: 'var(--font-bold)' as any }}>{formatAmount(inputs.pensionWithdrawalAmount + failureInfo.deficit)}원</span> (부족액만큼 증액)</span>
                        </li>
                      )}
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ color: '#ca8a04', fontWeight: 'var(--font-bold)' as any }}>3️⃣</span>
                        <span><strong style={{ color: '#ca8a04' }}>은퇴 연기:</strong> 현재 {inputs.retirementStartAge}세 → 추천: <span style={{ color: 'var(--accent-blue)', fontWeight: 'var(--font-bold)' as any }}>{inputs.retirementStartAge + Math.ceil((assetDepletionAge - inputs.retirementStartAge) * 0.1)}세</span> (자산 축적 기간 확보)</span>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ color: '#16a34a', fontWeight: 'var(--font-bold)' as any }}>4️⃣</span>
                        <span><strong style={{ color: '#16a34a' }}>초기 자산 증대:</strong> 총 자산을 <span style={{ color: 'var(--accent-blue)', fontWeight: 'var(--font-bold)' as any }}>{formatAmount((inputs.totalPension + inputs.husbandISA + inputs.wifeISA + inputs.overseasInvestmentAmount) * 1.15)}원</span>으로 증액 (15% 상향)</span>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ color: 'var(--accent-blue)', fontWeight: 'var(--font-bold)' as any }}>5️⃣</span>
                        <span><strong style={{ color: 'var(--accent-blue)' }}>국민연금 조기 수령:</strong> {inputs.nationalPensionStartAge}세 → <span style={{ color: 'var(--accent-blue)', fontWeight: 'var(--font-bold)' as any }}>63세</span> (감액되지만 현금흐름 개선)</span>
                      </li>
                    </ul>
                  </div>

                  <div style={{ backgroundColor: '#fee2e2', borderRadius: 12, padding: 8, border: '1px solid #fca5a5' }}>
                    <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)' as any, color: '#b91c1c', marginBottom: 4 }}>⚡ 조치 필요</p>
                    <p style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.375 }}>
                      위 해결 방안 중 <strong style={{ color: 'var(--color-profit)' }}>1번(생활비 감소) 필수 + 2~5번 중 1개 이상</strong> 조합하여 적용하면 {inputs.simulationEndAge}세까지 안정적인 파이어족 생활이 가능합니다! 🔄
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ✅ 파이어족 성공 메시지 */}
          {isFireSuccess && (
            <div style={{ marginBottom: 16, padding: '14px 18px', borderRadius: 10, background: 'rgba(0,184,148,0.08)', border: '1px solid rgba(0,184,148,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>✅</span>
              <div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-profit)' }}>파이어족 성공!</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{inputs.simulationEndAge}세까지 안정적인 현금흐름이 유지됩니다</div>
              </div>
            </div>
          )}

        <div className="toss-card" style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 16, padding: 24, border: '1px solid var(--border-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 'var(--font-bold)' as any, color: 'var(--text-primary)' }}>연도별 시뮬레이션 결과</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => setShowFormulaModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' as any, color: 'var(--accent-blue)', borderRadius: 4, border: '1px solid #93c5fd', backgroundColor: 'transparent', cursor: 'pointer' }} title="계산식 보기">
                <Info style={{ width: 16, height: 16 }} />
                계산식
              </button>
              <button onClick={() => setHideAmounts(!hideAmounts)} style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' as any, color: 'var(--text-secondary)', borderRadius: 4, border: '1px solid var(--border-primary)', backgroundColor: 'transparent', cursor: 'pointer' }}>
                {hideAmounts ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                {hideAmounts ? '금액 보기' : '금액 숨기기'}
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <div style={{ maxHeight: 600, overflowY: 'auto' }}>
              <table className="toss-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-secondary)' }}>
                  <tr>
                    {['나이','년도','연 생활비','ISA 인출'].map(h => <th key={h} style={{ border: '1px solid var(--border-primary)', padding: 12, fontWeight: 'var(--font-bold)' as any, color: 'var(--text-primary)', backgroundColor: '#dbeafe' }}>{h}</th>)}
                    {['해외배당\n세후','해외주식\n매도'].map(h => <th key={h} style={{ border: '1px solid var(--border-primary)', padding: 12, fontWeight: 'var(--font-bold)' as any, color: 'var(--text-primary)', backgroundColor: '#d1fae5' }} dangerouslySetInnerHTML={{__html: h.replace('\n','<br/>')}} />)}
                    {['연금\n세후','국민연금\n세후','주택연금','생명보험\n연금','총소득\n(세후)','건보료','총지출','연 잉여/\n부족','ISA 잔액'].map(h => <th key={h} style={{ border: '1px solid var(--border-primary)', padding: 12, fontWeight: 'var(--font-bold)' as any, color: 'var(--text-primary)', backgroundColor: '#dbeafe' }} dangerouslySetInnerHTML={{__html: h.replace('\n','<br/>')}} />)}
                    <th style={{ border: '1px solid var(--border-primary)', padding: 12, fontWeight: 'var(--font-bold)' as any, color: 'var(--text-primary)', backgroundColor: '#d1fae5' }} dangerouslySetInnerHTML={{__html: '해외주식<br/>잔액'}} />
                    <th style={{ border: '1px solid var(--border-primary)', padding: 12, fontWeight: 'var(--font-bold)' as any, color: 'var(--text-primary)', backgroundColor: '#dbeafe' }}>연금 잔액</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, index) => {
                    const cellBase: React.CSSProperties = { border: '1px solid var(--border-primary)', padding: 12, textAlign: 'right' };
                    return (
                    <tr key={index} style={{ backgroundColor: index % 5 === 0 ? 'rgba(219,234,254,0.3)' : 'transparent' }}>
                      <td style={{ ...cellBase, textAlign: 'center', fontWeight: 'var(--font-medium)' as any, color: 'var(--text-primary)', position: 'sticky', left: 0, backgroundColor: 'var(--bg-primary)', zIndex: 10 }}>{row.age}</td>
                      <td style={{ ...cellBase, textAlign: 'center', fontWeight: 'var(--font-medium)' as any, color: 'var(--text-primary)' }}>{row.year}</td>
                      <td style={{ ...cellBase, color: 'var(--text-secondary)' }}>{formatAmount(row.livingCost, hideAmounts)}</td>
                      <td style={{ ...cellBase, color: 'var(--accent-blue)' }}>{formatAmount(row.isaWithdrawal, hideAmounts)}</td>
                      <td style={{ ...cellBase, color: '#059669' }}>{formatAmount(row.overseasDividend, hideAmounts)}</td>
                      <td style={{ ...cellBase, color: '#047857', fontWeight: 'var(--font-semibold)' as any }}>{formatAmount(row.overseasStockSale, hideAmounts)}</td>
                      <td style={{ ...cellBase, color: '#9333ea' }}>{formatAmount(row.pensionAfterTax, hideAmounts)}</td>
                      <td style={{ ...cellBase, color: '#4f46e5' }}>{formatAmount(row.nationalPension, hideAmounts)}</td>
                      <td style={{ ...cellBase, color: '#ea580c' }}>{formatAmount(row.homePension, hideAmounts)}</td>
                      <td style={{ ...cellBase, color: '#db2777' }}>{formatAmount(row.lifeInsurancePension, hideAmounts)}</td>
                      <td style={{ ...cellBase, fontWeight: 'var(--font-semibold)' as any, color: 'var(--text-primary)' }}>{formatAmount(row.totalIncome, hideAmounts)}</td>
                      <td style={{ ...cellBase, color: 'var(--color-profit)' }}>{formatAmount(row.healthInsurance, hideAmounts)}</td>
                      <td style={{ ...cellBase, fontWeight: 'var(--font-medium)' as any, color: 'var(--text-primary)' }}>{formatAmount(row.totalExpense, hideAmounts)}</td>
                      <td style={{ ...cellBase, fontWeight: 'var(--font-bold)' as any, color: getAmountColor(row.yearlySurplus) }}>{formatAmount(row.yearlySurplus, hideAmounts)}</td>
                      <td style={{ ...cellBase, color: 'var(--accent-blue)', fontWeight: 'var(--font-medium)' as any }}>{formatAmount(row.isaBalance, hideAmounts)}</td>
                      <td style={{ ...cellBase, color: '#059669', fontWeight: 'var(--font-medium)' as any }}>{formatAmount(row.overseasBalance, hideAmounts)}</td>
                      <td style={{ ...cellBase, color: '#9333ea', fontWeight: 'var(--font-medium)' as any }}>{formatAmount(row.pensionBalance, hideAmounts)}</td>
                    </tr>
                    );
                  })}
                  <tr style={{ backgroundColor: '#fef3c7', borderTop: '4px solid #f59e0b' }}>
                    <td colSpan={2} style={{ border: '1px solid var(--border-primary)', padding: 12, textAlign: 'center', fontWeight: 900, color: '#92400e', position: 'sticky', left: 0, backgroundColor: '#fef3c7', zIndex: 10 }}>합계</td>
                    {[
                      results.reduce((s, r) => s + r.livingCost, 0),
                      results.reduce((s, r) => s + r.isaWithdrawal, 0),
                      results.reduce((s, r) => s + r.overseasDividend, 0),
                      results.reduce((s, r) => s + r.overseasStockSale, 0),
                      results.reduce((s, r) => s + r.pensionAfterTax, 0),
                      results.reduce((s, r) => s + r.nationalPension, 0),
                      results.reduce((s, r) => s + r.homePension, 0),
                      results.reduce((s, r) => s + r.lifeInsurancePension, 0),
                      results.reduce((s, r) => s + r.totalIncome, 0),
                      results.reduce((s, r) => s + r.healthInsurance, 0),
                      results.reduce((s, r) => s + r.totalExpense, 0),
                      results.reduce((s, r) => s + r.yearlySurplus, 0),
                    ].map((val, i) => (
                      <td key={i} style={{ border: '1px solid var(--border-primary)', padding: 12, textAlign: 'right', fontWeight: [8,10,11].includes(i) ? 900 : 'var(--font-bold)' as any, color: '#78350f' }}>{formatAmount(val, hideAmounts)}</td>
                    ))}
                    <td colSpan={3} style={{ border: '1px solid var(--border-primary)', padding: 12, textAlign: 'center', fontWeight: 'var(--font-medium)' as any, color: '#b45309', fontStyle: 'italic' }}>잔액 항목 제외</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 요약 정보 */}
          <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
            <div style={{ backgroundColor: 'var(--accent-blue-bg)', borderRadius: 12, padding: 20, border: '1px solid #bfdbfe' }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 8 }}>총 시뮬레이션 기간</p>
              <p style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)' as any, color: 'var(--accent-blue)' }}>{inputs.simulationEndAge - inputs.retirementStartAge + 1}년</p>
            </div>
            <div style={{ backgroundColor: '#ecfdf5', borderRadius: 12, padding: 20, border: '1px solid #a7f3d0' }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 8 }}>최종 ISA 잔액</p>
              <p style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)' as any, color: '#059669' }}>{formatAmount(results[results.length - 1]?.isaBalance || 0, hideAmounts)}원</p>
              {!hideAmounts && <p style={{ fontSize: 'var(--text-base)', color: '#059669', marginTop: 4 }}>({formatKoreanAmount(results[results.length - 1]?.isaBalance || 0)}원)</p>}
            </div>
            <div style={{ backgroundColor: '#fff7ed', borderRadius: 12, padding: 20, border: '1px solid #fed7aa' }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 8 }}>최종 해외주식 잔액</p>
              <p style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)' as any, color: '#ea580c' }}>{formatAmount(results[results.length - 1]?.overseasBalance || 0, hideAmounts)}원</p>
              {!hideAmounts && <p style={{ fontSize: 'var(--text-base)', color: '#ea580c', marginTop: 4 }}>({formatKoreanAmount(results[results.length - 1]?.overseasBalance || 0)}원)</p>}
            </div>
            <div style={{ backgroundColor: '#faf5ff', borderRadius: 12, padding: 20, border: '1px solid #e9d5ff' }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 8 }}>최종 연금 잔액</p>
              <p style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)' as any, color: '#9333ea' }}>{formatAmount(results[results.length - 1]?.pensionBalance || 0, hideAmounts)}원</p>
              {!hideAmounts && <p style={{ fontSize: 'var(--text-base)', color: '#9333ea', marginTop: 4 }}>({formatKoreanAmount(results[results.length - 1]?.pensionBalance || 0)}원)</p>}
            </div>
            <div style={{ borderRadius: 12, padding: 20, border: '1px solid', borderColor: results.reduce((sum, row) => sum + row.yearlySurplus, 0) >= 0 ? '#fecaca' : '#bfdbfe', backgroundColor: results.reduce((sum, row) => sum + row.yearlySurplus, 0) >= 0 ? '#fef2f2' : 'var(--accent-blue-bg)' }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 8 }}>전체 연 잉여/부족 합계</p>
              <p style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)' as any, color: getAmountColor(results.reduce((sum, row) => sum + row.yearlySurplus, 0)) }}>{formatAmount(results.reduce((sum, row) => sum + row.yearlySurplus, 0), hideAmounts)}원</p>
              {!hideAmounts && <p style={{ fontSize: 'var(--text-base)', marginTop: 4, color: results.reduce((sum, row) => sum + row.yearlySurplus, 0) >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>({formatKoreanAmount(results.reduce((sum, row) => sum + row.yearlySurplus, 0))}원)</p>}
            </div>
          </div>
        </div>
        </>
      )}

      {/* 계산식 설명 모달 */}
      {showFormulaModal && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowFormulaModal(false)}
        >
          <div
            style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 16, maxWidth: 896, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div style={{ position: 'sticky', top: 0, background: 'linear-gradient(to right, var(--accent-blue), #4f46e5)', padding: 24, borderRadius: '16px 16px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Info style={{ width: 24, height: 24, color: 'white' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>계산식 구조</h3>
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>각 컬럼의 계산 방법을 확인하세요</p>
                </div>
              </div>
              <button
                onClick={() => setShowFormulaModal(false)}
                style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}
              >
                <X style={{ width: 20, height: 20, color: 'white' }} />
              </button>
            </div>

            {/* 모달 내용 */}
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* 연 생활비 */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: 12, padding: 20, border: '1px solid var(--border-primary)' }}>
                <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#6b7280', display: 'inline-block' }}></span>
                  연 생활비
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)' }}>
                    <code style={{ backgroundColor: 'var(--accent-blue-bg)', padding: '4px 8px', borderRadius: 4, color: 'var(--accent-blue)', fontFamily: 'monospace', fontSize: 14 }}>
                      월 생활비 × 12 × (1 + 물가상승률)^연차
                    </code>
                  </p>
                  <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)' }}>
                    매년 물가상승률을 적용하여 증가하는 생활비입니다.
                  </p>
                </div>
              </div>

              {/* ISA 인출 */}
              <div style={{ backgroundColor: 'var(--accent-blue-bg)', borderRadius: 12, padding: 20, border: '1px solid var(--accent-blue)' }}>
                <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--accent-blue)', display: 'inline-block' }}></span>
                  ISA 인출
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)' }}>
                    <code style={{ backgroundColor: 'var(--accent-blue-bg)', padding: '4px 8px', borderRadius: 4, color: 'var(--accent-blue)', fontFamily: 'monospace', fontSize: 14 }}>
                      MAX(0, (생활비 + 건보료) - (해외배당 + 해외주식매도 + 연금 + 국민연금 + 주택연금))
                    </code>
                  </p>
                  <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>생활비 부족분 충당 방식:</span> 다른 소득으로 생활비와 건보료를 충당한 후 부족한 금액을 ISA에서 인출합니다. ISA 잔액이 부족하면 잔액 범위 내에서만 인출됩니다.
                  </p>
                </div>
              </div>

              {/* 해외직투 배당+매도 */}
              <div style={{ backgroundColor: '#ecfdf5', borderRadius: 12, padding: 20, border: '1px solid #a7f3d0' }}>
                <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#059669', display: 'inline-block' }}></span>
                  해외직투 배당+매도
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 8, padding: 12, border: '1px solid #a7f3d0' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#059669', marginBottom: 8 }}>📊 배당금 계산</p>
                    <code style={{ display: 'block', backgroundColor: '#d1fae5', padding: '8px 12px', borderRadius: 4, color: '#059669', fontFamily: 'monospace', fontSize: 14 }}>
                      해외주식 잔액 × 6% × (1 - 0.154)
                    </code>
                    <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 8 }}>• 배당소득세 15.4% 공제</p>
                  </div>

                  <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 8, padding: 12, border: '1px solid #a7f3d0' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#059669', marginBottom: 8 }}>💰 주식매도액 계산</p>
                    <code style={{ display: 'block', backgroundColor: '#d1fae5', padding: '8px 12px', borderRadius: 4, color: '#059669', fontFamily: 'monospace', fontSize: 14 }}>
                      목표금액 - 배당금 (매년 변동)
                    </code>
                    <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 8 }}>• 목표금액: 초기에 총자산으로 계산된 고정값</p>
                    <p style={{ fontSize: 14, color: '#9333ea', marginTop: 4, fontWeight: 600 }}>• 배당+매도 = 매년 일정 (목표금액 고정 방식) ✅</p>
                  </div>

                  <div style={{ backgroundColor: 'var(--accent-blue-bg)', borderRadius: 8, padding: 12, border: '2px solid var(--accent-blue)' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 8 }}>🔢 목표금액 고정 방식 (2억 투자, 51→90세)</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 600 }}>연 목표금액:</span>
                        <code style={{ fontFamily: 'monospace', color: '#dc2626' }}>1,189만원 (고정)</code>
                      </div>
                      <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid var(--border-primary)' }} />
                      <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 4, padding: '6px 8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontWeight: 600 }}>51세 (잔액 2.0억)</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>연배당:</span>
                          <code style={{ fontFamily: 'monospace', color: '#059669' }}>2억 × 6% × 0.846 = 1,015만원</code>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>연매도:</span>
                          <code style={{ fontFamily: 'monospace', color: 'var(--accent-blue)' }}>1,189만 - 1,015만 = 174만원</code>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#9333ea' }}>
                          <span>총수입:</span>
                          <code style={{ fontFamily: 'monospace' }}>1,189만원 ✅</code>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text-tertiary)' }}>
                          <span>52세 잔액:</span>
                          <code style={{ fontFamily: 'monospace' }}>2.0억 - 174만 = 1.98억</code>
                        </div>
                      </div>
                      <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 4, padding: '6px 8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontWeight: 600 }}>65세 (잔액 1.47억)</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>연배당:</span>
                          <code style={{ fontFamily: 'monospace', color: '#059669' }}>1.47억 × 6% × 0.846 = 748만원 📉</code>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>연매도:</span>
                          <code style={{ fontFamily: 'monospace', color: 'var(--accent-blue)' }}>1,189만 - 748만 = 441만원 📈</code>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#9333ea' }}>
                          <span>총수입:</span>
                          <code style={{ fontFamily: 'monospace' }}>1,189만원 ✅</code>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text-tertiary)' }}>
                          <span>66세 잔액:</span>
                          <code style={{ fontFamily: 'monospace' }}>1.47억 - 441만 = 1.43억</code>
                        </div>
                      </div>
                      <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 4, padding: '6px 8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontWeight: 600 }}>75세 (잔액 8,360만)</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>연배당:</span>
                          <code style={{ fontFamily: 'monospace', color: '#059669' }}>8,360만 × 6% × 0.846 = 424만원 📉</code>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>연매도:</span>
                          <code style={{ fontFamily: 'monospace', color: 'var(--accent-blue)' }}>1,189만 - 424만 = 765만원 📈</code>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#9333ea' }}>
                          <span>총수입:</span>
                          <code style={{ fontFamily: 'monospace' }}>1,189만원 ✅</code>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text-tertiary)' }}>
                          <span>76세 잔액:</span>
                          <code style={{ fontFamily: 'monospace' }}>8,360만 - 765만 = 7,595만</code>
                        </div>
                      </div>
                      <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 4, padding: '6px 8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontWeight: 600 }}>85세 (잔액 2,100만)</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>연배당:</span>
                          <code style={{ fontFamily: 'monospace', color: '#059669' }}>2,100만 × 6% × 0.846 = 107만원 📉📉</code>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>연매도:</span>
                          <code style={{ fontFamily: 'monospace', color: 'var(--accent-blue)' }}>1,189만 - 107만 = 1,082만원 📈📈</code>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#9333ea' }}>
                          <span>총수입:</span>
                          <code style={{ fontFamily: 'monospace' }}>1,189만원 ✅</code>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text-tertiary)' }}>
                          <span>86세 잔액:</span>
                          <code style={{ fontFamily: 'monospace' }}>2,100만 - 1,082만 = 1,018만</code>
                        </div>
                      </div>
                      <div style={{ backgroundColor: '#f0fdf4', borderRadius: 4, padding: '6px 8px', border: '2px solid #4ade80' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontWeight: 600, color: '#15803d' }}>✅ 핵심 원리</span>
                        </div>
                        <p style={{ fontSize: 14, color: '#15803d', lineHeight: 1.6 }}>
                          <span style={{ fontWeight: 700 }}>배당 + 매도 = 매년 1,189만원 (일정)</span><br/>
                          배당 감소 📉 → 매도 자동 증가 📈<br/>
                          90세에 잔액 0 달성!
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 연금 세후 */}
              <div style={{ backgroundColor: '#faf5ff', borderRadius: 12, padding: 20, border: '2px solid #c084fc' }}>
                <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#9333ea', display: 'inline-block' }}></span>
                  연금 세후 (개인연금)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 8, padding: 12, border: '1px solid #e9d5ff' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#9333ea', marginBottom: 8 }}>📋 기본 계산식</p>
                    <code style={{ display: 'block', backgroundColor: '#f3e8ff', padding: '8px 12px', borderRadius: 4, color: '#9333ea', fontFamily: 'monospace', fontSize: 14 }}>
                      연금 인출액 × (1 - 나이별 세율)
                    </code>
                  </div>

                  <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 8, padding: 12, border: '1px solid #e9d5ff' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#9333ea', marginBottom: 8 }}>🎯 분리과세 한도</p>
                    <ul style={{ fontSize: 14, color: 'var(--text-secondary)', marginLeft: 16, listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <li>부부 합산: <span style={{ fontWeight: 600, color: '#9333ea' }}>2,400만원</span> (각자 1,200만원)</li>
                      <li>한도 내: 나이별 세율 적용</li>
                      <li>한도 초과: 종합과세 15%</li>
                    </ul>
                  </div>

                  <div style={{ backgroundColor: '#f3e8ff', borderRadius: 8, padding: 12, border: '1px solid #c084fc' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#9333ea', marginBottom: 8 }}>📊 나이별 연금소득세율</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-primary)', borderRadius: 4, padding: '8px 12px' }}>
                        <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>55~69세</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>5.5%</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-primary)', borderRadius: 4, padding: '8px 12px' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>70~79세</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#ea580c' }}>4.4%</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-primary)', borderRadius: 4, padding: '8px 12px' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>80세 이상</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#059669' }}>3.3%</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'var(--accent-blue-bg)', borderRadius: 8, padding: 12, border: '1px solid var(--accent-blue)' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 8 }}>💡 계산 예시 (연 5,000만원 인출)</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>• 60세 (5.5%)</span>
                        <span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>4,725만원</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>• 75세 (4.4%)</span>
                        <span style={{ fontWeight: 600, color: '#ea580c' }}>4,780만원 (+55만원)</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>• 85세 (3.3%)</span>
                        <span style={{ fontWeight: 600, color: '#059669' }}>4,835만원 (+110만원)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 국민연금 세후 */}
              <div style={{ backgroundColor: '#eef2ff', borderRadius: 12, padding: 20, border: '2px solid #a5b4fc' }}>
                <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#4f46e5', display: 'inline-block' }}></span>
                  국민연금 세후
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 8, padding: 12, border: '1px solid #c7d2fe' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#4f46e5', marginBottom: 8 }}>📋 기본 계산식</p>
                    <code style={{ display: 'block', backgroundColor: '#e0e7ff', padding: '8px 12px', borderRadius: 4, color: '#4f46e5', fontFamily: 'monospace', fontSize: 13 }}>
                      67세 기준액 × (1 - 조기감액률) × (1 + 물가상승률)^경과년수 × (1 - 세율)
                    </code>
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
                      <p>✅ 조기감액률: (67세 - 수령시작나이) × 6%</p>
                      <p>✅ 경과년수: (현재나이 - 수령시작나이) → <span style={{ fontWeight: 700, color: '#ea580c' }}>첫 해는 0년 = 물가상승 미적용</span></p>
                      <p>✅ 물가상승률: 수령 시작 다음 해부터 2% 적용</p>
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#fff7ed', borderRadius: 8, padding: 12, border: '2px solid #fdba74' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#c2410c', marginBottom: 8 }}>⚠️ 조기수령 감액률</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-primary)', borderRadius: 4, padding: '8px 12px' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>63세 (4년 조기)</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>24% 감액</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-primary)', borderRadius: 4, padding: '8px 12px' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>65세 (2년 조기)</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#ea580c' }}>12% 감액</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-primary)', borderRadius: 4, padding: '8px 12px' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>67세 이후</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#059669' }}>감액 없음</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#e0e7ff', borderRadius: 8, padding: 12, border: '1px solid #a5b4fc' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#4f46e5', marginBottom: 8 }}>📊 나이별 연금소득세율</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-primary)', borderRadius: 4, padding: '8px 12px' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>55~69세</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>5.5%</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-primary)', borderRadius: 4, padding: '8px 12px' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>70~79세</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#ea580c' }}>4.4%</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-primary)', borderRadius: 4, padding: '8px 12px' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>80세 이상</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#059669' }}>3.3%</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'var(--accent-blue-bg)', borderRadius: 8, padding: 12, border: '2px solid var(--accent-blue)' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 8 }}>💡 계산 예시 (67세 월 250만원 기준, 63세 조기수령)</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ backgroundColor: '#fff7ed', borderRadius: 4, padding: '8px 12px', border: '1px solid #fdba74' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#ea580c' }}>• 63세 첫 해 (경과 0년)</span>
                          <span style={{ fontSize: 11, color: '#dc2626' }}>← 물가상승 미적용</span>
                        </div>
                        <code style={{ fontSize: 11, fontFamily: 'monospace', display: 'block', color: 'var(--text-tertiary)' }}>3,000만 × 0.76 × 1.02^0 × (1-0.055) = 2,154만원</code>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#ea580c' }}>월 179.5만원</span>
                      </div>
                      <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 4, padding: '8px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-blue)' }}>• 64세 (경과 1년)</span>
                          <span style={{ fontSize: 11, color: '#059669' }}>← 물가상승 +2%</span>
                        </div>
                        <code style={{ fontSize: 11, fontFamily: 'monospace', display: 'block', color: 'var(--text-tertiary)' }}>3,000만 × 0.76 × 1.02^1 × (1-0.055) = 2,197만원</code>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-blue)' }}>월 183.1만원</span>
                      </div>
                      <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 4, padding: '8px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-blue)' }}>• 65세 (경과 2년)</span>
                          <span style={{ fontSize: 11, color: '#059669' }}>← 물가상승 +4.04%</span>
                        </div>
                        <code style={{ fontSize: 11, fontFamily: 'monospace', display: 'block', color: 'var(--text-tertiary)' }}>3,000만 × 0.76 × 1.02^2 × (1-0.055) = 2,241만원</code>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-blue)' }}>월 186.8만원</span>
                      </div>
                      <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 4, padding: '8px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#ea580c' }}>• 70세 (경과 7년, 세율 변경)</span>
                          <span style={{ fontSize: 11, color: '#9333ea' }}>← 세율 4.4%</span>
                        </div>
                        <code style={{ fontSize: 11, fontFamily: 'monospace', display: 'block', color: 'var(--text-tertiary)' }}>3,000만 × 0.76 × 1.02^7 × (1-0.044) = 2,464만원</code>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#ea580c' }}>월 205.3만원</span>
                      </div>
                      <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 4, padding: '8px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#059669' }}>• 80세 (경과 17년, 세율 변경)</span>
                          <span style={{ fontSize: 11, color: '#9333ea' }}>← 세율 3.3%</span>
                        </div>
                        <code style={{ fontSize: 11, fontFamily: 'monospace', display: 'block', color: 'var(--text-tertiary)' }}>3,000만 × 0.76 × 1.02^17 × (1-0.033) = 3,038만원</code>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>월 253.2만원</span>
                      </div>
                    </div>
                    <div style={{ marginTop: 8, padding: 8, backgroundColor: '#fefce8', borderRadius: 4, border: '1px solid #fde047' }}>
                      <p style={{ fontSize: 11, color: '#a16207', fontWeight: 500 }}>
                        📌 85세까지 총 수령액: 67세 수령(5억 4천만) vs 63세 수령(5억 160만) → 약 3,840만원 차이
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 주택연금 */}
              <div style={{ backgroundColor: '#fff7ed', borderRadius: 12, padding: 20, border: '1px solid #fed7aa' }}>
                <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ea580c', display: 'inline-block' }}></span>
                  주택연금
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                    <code style={{ backgroundColor: '#ffedd5', padding: '4px 8px', borderRadius: 4, color: '#c2410c', fontFamily: 'monospace', fontSize: 13 }}>
                      월 수령액 × 12
                    </code>
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    주택연금은 비과세 소득으로 세금이 없습니다.
                  </p>
                </div>
              </div>

              {/* 총소득 */}
              <div style={{ backgroundColor: 'var(--accent-blue-bg)', borderRadius: 12, padding: 20, border: '2px solid var(--accent-blue)' }}>
                <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--accent-blue)', display: 'inline-block' }}></span>
                  총소득 (세후) = 총수입
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                    <code style={{ backgroundColor: 'var(--accent-blue-bg)', padding: '4px 8px', borderRadius: 4, color: 'var(--accent-blue)', fontFamily: 'monospace', fontSize: 13 }}>
                      ISA 인출 + 해외배당 + 해외주식매도 + 연금 + 국민연금 + 주택연금
                    </code>
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--accent-blue)', fontWeight: 600 }}>
                    ✅ ISA 인출을 포함한 실제 사용 가능한 총수입입니다.
                  </p>
                </div>
              </div>

              {/* 연금소진모드 계산식 */}
              <div style={{ backgroundColor: '#fdf2f8', borderRadius: 12, padding: 20, border: '2px solid #f9a8d4' }}>
                <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#db2777', display: 'inline-block' }}></span>
                  🔥 연금소진모드
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 8, padding: 12, border: '1px solid #fbcfe8' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#be185d', marginBottom: 8 }}>🎯 목표</p>
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                      시뮬레이션 종료 나이(예: 85세)에 <span style={{ fontWeight: 700, color: '#db2777' }}>모든 자산을 정확히 0원</span>으로 만드는 균등 인출 계산
                    </p>
                  </div>

                  <div style={{ backgroundColor: '#fce7f3', borderRadius: 8, padding: 12, border: '1px solid #f9a8d4' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#be185d', marginBottom: 8 }}>📐 PMT 공식 (개인연금, ISA 적용)</p>
                    <code style={{ display: 'block', backgroundColor: 'var(--bg-primary)', padding: '8px 12px', borderRadius: 4, color: '#be185d', fontFamily: 'monospace', fontSize: 13, marginBottom: 8 }}>
                      연 인출액 = 잔액 × (r × (1+r)^n) / ((1+r)^n - 1)
                    </code>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <p>• <code style={{ fontFamily: 'monospace', backgroundColor: '#fdf2f8', padding: '2px 6px', borderRadius: 4 }}>r</code> = 연수익률 (개인연금: 5%, ISA: 5%)</p>
                      <p>• <code style={{ fontFamily: 'monospace', backgroundColor: '#fdf2f8', padding: '2px 6px', borderRadius: 4 }}>n</code> = 남은 년수 (목표나이 - 현재나이 + 1)</p>
                      <p>• <code style={{ fontFamily: 'monospace', backgroundColor: '#fdf2f8', padding: '2px 6px', borderRadius: 4 }}>잔액</code> = 현재 자산 잔액</p>
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 8, padding: 12, border: '1px solid #fbcfe8' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#be185d', marginBottom: 8 }}>🔄 매년 실행 순서</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                      <div style={{ backgroundColor: 'var(--accent-blue-bg)', borderRadius: 4, padding: '8px 12px' }}>
                        <p style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>1️⃣ 개인연금 인출</p>
                        <code style={{ fontSize: 12, fontFamily: 'monospace', display: 'block', marginTop: 4 }}>PMT공식으로 인출액 계산 → 인출 후 잔액에 5% 수익률 적용</code>
                      </div>
                      <div style={{ backgroundColor: '#ecfdf5', borderRadius: 4, padding: '8px 12px' }}>
                        <p style={{ fontWeight: 600, color: '#059669' }}>2️⃣ ISA 인출</p>
                        <code style={{ fontSize: 12, fontFamily: 'monospace', display: 'block', marginTop: 4 }}>PMT공식으로 인출액 계산 → 인출 후 잔액에 5% 수익률 적용</code>
                      </div>
                      <div style={{ backgroundColor: '#faf5ff', borderRadius: 4, padding: '8px 12px' }}>
                        <p style={{ fontWeight: 600, color: '#9333ea' }}>3️⃣ 해외주식 (목표금액 고정 방식)</p>
                        <code style={{ fontSize: 12, fontFamily: 'monospace', display: 'block', marginTop: 4 }}>배당 6% 자동 수령 + 목표금액에서 배당 차감한 금액을 매도</code>
                        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>• 배당 감소 → 매도 자동 증가 (배당+매도 = 매년 일정)</p>
                        <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>• PMT 공식이 아닌 목표금액 고정 방식 사용</p>
                      </div>
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'var(--accent-blue-bg)', borderRadius: 8, padding: 12, border: '2px solid var(--accent-blue)' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 8 }}>💡 계산 예시 (개인연금 10억, 57→85세)</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 4, padding: '8px 12px' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-blue)' }}>초기 설정</p>
                        <ul style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <li>• 잔액 = 1,000,000,000원</li>
                          <li>• 수익률 r = 0.05 (5%)</li>
                          <li>• 남은 년수 n = 85 - 57 + 1 = 29년</li>
                        </ul>
                      </div>
                      <div style={{ backgroundColor: '#fdf2f8', borderRadius: 4, padding: '8px 12px', border: '1px solid #fbcfe8' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#db2777' }}>PMT 공식 적용</p>
                        <code style={{ fontSize: 11, fontFamily: 'monospace', display: 'block', color: 'var(--text-tertiary)', marginTop: 4 }}>
                          factor = (1 + 0.05)^29 = 4.1161<br/>
                          연 인출액 = 1,000,000,000 × (0.05 × 4.1161) / (4.1161 - 1)<br/>
                          = 1,000,000,000 × 0.20581 / 3.1161<br/>
                          = <span style={{ color: '#db2777', fontWeight: 700 }}>66,048,164원</span>
                        </code>
                      </div>
                      <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 4, padding: '8px 12px' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#9333ea' }}>57세 (첫 해)</p>
                        <ul style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <li>• 연초 잔액: 10억</li>
                          <li>• 인출: 6,605만원</li>
                          <li>• 인출 후: 9억 3,395만원</li>
                          <li style={{ color: '#059669', fontWeight: 600 }}>• 수익률 적용 후: 9억 3,395만 × 1.05 = 9억 8,065만원</li>
                        </ul>
                      </div>
                      <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 4, padding: '8px 12px' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#ea580c' }}>85세 (마지막)</p>
                        <ul style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <li>• 연초 잔액: 6,291만원</li>
                          <li>• 인출: 6,605만원 (동일)</li>
                          <li>• 인출 후: -314만원 → 실제로는 잔액만 인출</li>
                          <li style={{ color: '#db2777', fontWeight: 700 }}>• 86세 시작: 0원 ✅</li>
                        </ul>
                      </div>
                      <div style={{ backgroundColor: '#f0fdf4', borderRadius: 4, padding: '8px 12px', border: '2px solid #4ade80' }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>✅ 핵심 원리</p>
                        <p style={{ fontSize: 12, color: '#15803d', lineHeight: 1.6, marginTop: 4 }}>
                          매년 동일한 금액(6,605만원)을 인출하면서도,<br/>
                          수익률 5%를 반영하여 <span style={{ fontWeight: 700 }}>85세에 정확히 0원</span> 달성!
                        </p>
                      </div>
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#fefce8', borderRadius: 8, padding: 12, border: '2px solid #facc15' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#a16207', marginBottom: 8 }}>⚠️ 중요 포인트</p>
                    <ul style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8, listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <li><span style={{ fontWeight: 700, color: '#ca8a04' }}>인출 → 수익률 적용</span> 순서가 중요!</li>
                      <li>PMT 공식은 개인연금과 ISA에만 적용 (이미 수익률 고려)</li>
                      <li>해외주식은 목표금액 고정 방식 (배당 감소 → 매도 자동 증가)</li>
                      <li>남은 년수가 매년 줄어들면서 PMT 인출액은 자동으로 재계산됨</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 건강보험료 */}
              <div style={{ backgroundColor: '#fef2f2', borderRadius: 12, padding: 20, border: '2px solid #fca5a5' }}>
                <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#dc2626', display: 'inline-block' }}></span>
                  건강보험료 (지역가입자)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 8, padding: 12, border: '1px solid #fecaca' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 8 }}>📋 기본 계산식</p>
                    <code style={{ display: 'block', backgroundColor: '#fee2e2', padding: '8px 12px', borderRadius: 4, color: '#dc2626', fontFamily: 'monospace', fontSize: 13 }}>
                      (소득점수 + 재산점수) × 208원 × 12개월
                    </code>
                  </div>

                  <div style={{ backgroundColor: '#fee2e2', borderRadius: 8, padding: 12, border: '1px solid #fca5a5' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 8 }}>💰 소득점수 계산 (중요!)</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                      <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 4, padding: '8px 12px', border: '2px solid #f87171' }}>
                        <p style={{ fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>✅ 건보 반영 소득</p>
                        <code style={{ fontSize: 11, fontFamily: 'monospace', display: 'block', marginBottom: 4 }}>개인연금 세후만!</code>
                        <p style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>⚠️ 국민연금·주택연금·ISA·해외배당 모두 제외</p>
                      </div>
                      <div style={{ backgroundColor: 'var(--accent-blue-bg)', borderRadius: 4, padding: '8px 12px', border: '1px solid var(--accent-blue)' }}>
                        <p style={{ fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 4 }}>📊 소득점수 계산</p>
                        <code style={{ fontSize: 11, fontFamily: 'monospace', display: 'block' }}>개인연금 세후 × 0.002 ÷ 1,000</code>
                        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>• 0.002 = 연금 환산율 + 공제 + 감경 종합 반영</p>
                      </div>
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 8, padding: 12, border: '1px solid #fecaca' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 8 }}>🏠 재산점수 계산</p>
                    <code style={{ display: 'block', fontSize: 12, fontFamily: 'monospace', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', borderRadius: 4, padding: '8px 12px' }}>
                      MAX(0, 주택시가 - 50,000,000) × 0.0000005
                    </code>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>• 주택 기본공제: 5,000만원</p>
                  </div>

                  <div style={{ backgroundColor: 'var(--accent-blue-bg)', borderRadius: 8, padding: 12, border: '2px solid var(--accent-blue)' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 8 }}>💡 실제 계산 예시 (개인연금 5천만원 인출)</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                      <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 4, padding: '8px 12px' }}>
                        <p style={{ fontWeight: 600, marginBottom: 4, color: 'var(--accent-blue)' }}>📥 총소득 내역</p>
                        <ul style={{ fontSize: 11, marginLeft: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <li>• 개인연금 세후: 4,308만원 ✅ <span style={{ color: '#dc2626', fontWeight: 700 }}>건보 반영</span></li>
                          <li style={{ color: '#9ca3af', textDecoration: 'line-through' }}>• 국민연금: 0원 (67세부터)</li>
                          <li style={{ color: '#9ca3af', textDecoration: 'line-through' }}>• 해외배당+매도: 1,015만원</li>
                          <li style={{ color: '#9ca3af', textDecoration: 'line-through' }}>• 주택연금: 1,200만원</li>
                        </ul>
                      </div>
                      <div style={{ backgroundColor: '#fff7ed', borderRadius: 4, padding: '8px 12px', border: '1px solid #fed7aa' }}>
                        <p style={{ fontWeight: 600, marginBottom: 4, color: '#ea580c' }}>🧮 건보료 계산</p>
                        <ul style={{ fontSize: 11, marginLeft: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <li>• 건보 대상 소득: 43,080,000원</li>
                          <li style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>• 소득점수: 43,080,000 × 0.002 ÷ 1,000</li>
                          <li style={{ color: '#ea580c', fontWeight: 600 }}>• 소득점수: 86.16점</li>
                          <li style={{ color: '#9333ea' }}>• 재산점수: 300점 (주택 6.5억)</li>
                          <li style={{ color: '#059669', fontWeight: 700 }}>• 총 점수: 386.16점</li>
                        </ul>
                      </div>
                      <div style={{ backgroundColor: '#fee2e2', borderRadius: 4, padding: '8px 12px' }}>
                        <p style={{ fontWeight: 600, marginBottom: 4, color: '#dc2626' }}>💸 연간 건보료</p>
                        <code style={{ fontSize: 11, fontFamily: 'monospace', display: 'block', marginBottom: 4 }}>386.16점 × 208원 × 12개월 = 964,366원</code>
                        <p style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>✅ 월 약 <span style={{ fontSize: 13 }}>80,364원</span> (재산점수 포함)</p>
                        <p style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>• 소득점수만: 약 21만원/년</p>
                        <p style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>• 재산점수: 약 75만원/년</p>
                      </div>
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#fefce8', borderRadius: 8, padding: 12, border: '2px solid #facc15' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#a16207', marginBottom: 8 }}>⚠️ 핵심 포인트 (필독!)</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 4, padding: '8px 12px' }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>✅ 건보 반영 소득 (지역가입자)</p>
                        <ul style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <li>• <span style={{ fontWeight: 700, color: '#dc2626' }}>개인연금</span> (연금저축·IRP·DC) → 반영 (0.45 환산)</li>
                        </ul>
                      </div>
                      <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 4, padding: '8px 12px' }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#059669', marginBottom: 4 }}>❌ 건보 미반영 소득</p>
                        <ul style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <li>• <span style={{ textDecoration: 'line-through' }}>국민연금</span> → 지역가입자 미반영</li>
                          <li>• <span style={{ textDecoration: 'line-through' }}>주택연금</span> → 미반영</li>
                          <li>• <span style={{ textDecoration: 'line-through' }}>해외배당+매도</span> → 미반영 (연 2천만 이하)</li>
                          <li>• <span style={{ textDecoration: 'line-through' }}>ISA 인출/배당</span> → 비과세 미반영</li>
                        </ul>
                      </div>
                      <div style={{ backgroundColor: '#fef2f2', borderRadius: 4, padding: '8px 12px', border: '1px solid #fca5a5' }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>🔥 개인연금 5천만원 인출 시 → 월 약 8만원</p>
                        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>(재산점수 포함 / 주택 6.5억 기준 / 소득점수 약 2만원/월 + 재산점수 약 6만원/월)</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 총지출 */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: 12, padding: 20, border: '1px solid var(--border-primary)' }}>
                <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#6b7280', display: 'inline-block' }}></span>
                  총지출
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                    <code style={{ backgroundColor: 'var(--bg-tertiary)', padding: '4px 8px', borderRadius: 4, color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: 14 }}>
                      연 생활비 + 건보료
                    </code>
                  </p>
                </div>
              </div>

              {/* 총소득 (세후) */}
              <div style={{ backgroundColor: 'var(--accent-blue-bg)', borderRadius: 12, padding: 20, border: '2px solid var(--accent-blue)' }}>
                <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--accent-blue)', display: 'inline-block' }}></span>
                  총소득 (세후) = 총수입
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <code style={{ display: 'block', backgroundColor: 'var(--accent-blue-bg)', padding: '8px 12px', borderRadius: 4, color: 'var(--accent-blue)', fontFamily: 'monospace', fontSize: 13 }}>
                    총소득 = 연금세후 + 국민연금세후 + 주택연금 + 생명보험연금<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ ISA인출 + 해외배당 + 해외주식매도
                  </code>
                  <p style={{ fontSize: 13, color: 'var(--accent-blue)', fontWeight: 600 }}>
                    ✅ 모든 소득을 합산한 실제 사용 가능 금액
                  </p>
                </div>
              </div>

              {/* 총지출 */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: 12, padding: 20, border: '1px solid var(--border-primary)' }}>
                <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#6b7280', display: 'inline-block' }}></span>
                  총지출
                </h4>
                <code style={{ display: 'block', backgroundColor: 'var(--bg-tertiary)', padding: '8px 12px', borderRadius: 4, color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: 14 }}>
                  총지출 = 연생활비 + 건보료
                </code>
              </div>

              {/* 연 잉여/부족 */}
              <div style={{ backgroundColor: '#faf5ff', borderRadius: 12, padding: 20, border: '2px solid #c084fc' }}>
                <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: '#9333ea', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#9333ea', display: 'inline-block' }}></span>
                  연 잉여/부족
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 8, padding: 12, border: '1px solid #e9d5ff' }}>
                    <code style={{ display: 'block', backgroundColor: '#f3e8ff', padding: '8px 12px', borderRadius: 4, color: '#9333ea', fontFamily: 'monospace', fontSize: 14 }}>
                      연잉여부족 = 총소득 - 총지출 - 추가차감
                    </code>
                  </div>
                  <div style={{ backgroundColor: '#fff7ed', borderRadius: 8, padding: 12, border: '1px solid #fed7aa' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#c2410c', marginBottom: 8 }}>⚠️ 추가 차감액</p>
                    <code style={{ display: 'block', backgroundColor: '#ffedd5', padding: '8px 12px', borderRadius: 4, color: '#c2410c', fontFamily: 'monospace', fontSize: 12 }}>
                      추가차감 = (나이 &gt;= 국민연금시작나이) ? 500만원 : 0원
                    </code>
                    <p style={{ fontSize: 12, color: '#ea580c', marginTop: 8 }}>
                      • 국민연금 수령 시작 나이부터 연 500만원 차감
                    </p>
                  </div>
                  <div style={{ backgroundColor: '#f3e8ff', borderRadius: 8, padding: 12 }}>
                    <p style={{ fontSize: 14, color: '#9333ea' }}>
                      ✅ 양수: 잉여 (빨간색) / ❌ 음수: 부족 (파란색, 파이어족 실패)
                    </p>
                  </div>
                </div>
              </div>

              {/* 연금 잔액 */}
              <div style={{ backgroundColor: '#f5f3ff', borderRadius: 12, padding: 20, border: '2px solid #a78bfa' }}>
                <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#7c3aed', display: 'inline-block' }}></span>
                  연금 잔액
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 8, padding: 12, border: '1px solid #ddd6fe' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#7c3aed', marginBottom: 8 }}>📋 계산식</p>
                    <code style={{ display: 'block', backgroundColor: '#ede9fe', padding: '8px 12px', borderRadius: 4, color: '#7c3aed', fontFamily: 'monospace', fontSize: 13 }}>
                      연금잔액(다음해) = (연금잔액 - 연금세전) × (1 + 연금수익률)
                    </code>
                  </div>
                  <div style={{ backgroundColor: '#fef2f2', borderRadius: 8, padding: 12, border: '2px solid #fca5a5' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 8 }}>⚠️ 중요: 세전 금액 차감!</p>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <p>• 계좌에서 빠져나가는 것: <span style={{ fontWeight: 700, color: '#dc2626' }}>세전 금액</span></p>
                      <p>• 사용자가 받는 것: 세후 금액</p>
                      <p>• 세금: 정부가 가져감 (계좌에서 차감)</p>
                    </div>
                  </div>
                  <div style={{ backgroundColor: 'var(--accent-blue-bg)', borderRadius: 8, padding: 12, border: '1px solid var(--accent-blue)' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 8 }}>💡 계산 예시</p>
                    <code style={{ fontSize: 12, fontFamily: 'monospace', display: 'block', color: 'var(--text-tertiary)' }}>
                      현재 잔액: 10억<br/>
                      연금세전: 6,605만원<br/>
                      연금세후: 6,241만원 (5.5% 세금)<br/>
                      세금: 364만원<br/>
                      ---<br/>
                      인출 후: 10억 - 6,605만 = 9.34억<br/>
                      수익률 적용: 9.34억 × 1.07 = 9.99억
                    </code>
                  </div>
                </div>
              </div>

              {/* ISA 잔액 */}
              <div style={{ backgroundColor: '#ecfdf5', borderRadius: 12, padding: 20, border: '1px solid #a7f3d0' }}>
                <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#059669', display: 'inline-block' }}></span>
                  ISA 잔액
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <code style={{ display: 'block', backgroundColor: '#d1fae5', padding: '8px 12px', borderRadius: 4, color: '#059669', fontFamily: 'monospace', fontSize: 13 }}>
                    ISA잔액(다음해) = (ISA잔액 - ISA인출) × (1 + ISA수익률)
                  </code>
                  <p style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>
                    ✅ 인출 후 수익률 적용
                  </p>
                </div>
              </div>

              {/* 해외주식 잔액 */}
              <div style={{ backgroundColor: '#ecfeff', borderRadius: 12, padding: 20, border: '1px solid #a5f3fc' }}>
                <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#0891b2', display: 'inline-block' }}></span>
                  해외주식 잔액
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <code style={{ display: 'block', backgroundColor: '#cffafe', padding: '8px 12px', borderRadius: 4, color: '#0891b2', fontFamily: 'monospace', fontSize: 13 }}>
                    해외주식잔액(다음해) = (해외주식잔액 - 해외주식매도) × (1 + 해외주식수익률)
                  </code>
                  <p style={{ fontSize: 13, color: '#0891b2', fontWeight: 600 }}>
                    ⚠️ 매도 후 수익률 7% 적용! (배당 6% 포함)
                  </p>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                    <p>• 배당 6%는 별도 수령 (해외배당 컬럼)</p>
                    <p>• 매도액은 성장분 1%만 소진</p>
                    <p>• 잔액에는 총 수익률 7% 적용</p>
                  </div>
                </div>
              </div>

              {/* 총자산 */}
              <div style={{ backgroundColor: '#f0fdf4', borderRadius: 12, padding: 20, border: '2px solid #86efac' }}>
                <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: '#15803d', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#16a34a', display: 'inline-block' }}></span>
                  총자산
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <code style={{ display: 'block', backgroundColor: '#dcfce7', padding: '8px 12px', borderRadius: 4, color: '#15803d', fontFamily: 'monospace', fontSize: 14 }}>
                    총자산 = 연금잔액 + ISA잔액 + 해외주식잔액 + 금잔액
                  </code>
                  <p style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
                    ✅ 모든 금융자산의 합계 (주택 제외)
                  </p>
                </div>
              </div>
            </div>

            {/* 모달 푸터 */}
            <div style={{ position: 'sticky', bottom: 0, background: 'linear-gradient(to top, var(--bg-secondary), var(--bg-primary))', padding: 24, borderRadius: '0 0 16px 16px', borderTop: '2px solid var(--border-primary)' }}>
              <div style={{ backgroundColor: 'var(--accent-blue-bg)', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid var(--accent-blue)' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 8 }}>📌 데이터 검증 포인트</p>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <p>✅ 연금잔액: <span style={{ fontFamily: 'monospace' }}>(이전잔액 - 세전) × (1 + 수익률)</span></p>
                  <p>✅ ISA잔액: <span style={{ fontFamily: 'monospace' }}>(이전잔액 - 인출) × (1 + 수익률)</span></p>
                  <p>✅ 해외주식잔액: <span style={{ fontFamily: 'monospace' }}>(이전잔액 - 매도) × (1 + 수익률)</span></p>
                  <p>✅ 총소득: 7개 항목 합계</p>
                  <p>✅ 건보료: 개인연금만 반영 (국민연금·주택연금·ISA·해외 제외)</p>
                  <p style={{ color: '#ea580c', fontWeight: 600 }}>⚠️ 연잉여부족: 총소득 - 총지출 - 추가차감(국민연금 수령 시 500만원)</p>
                </div>
              </div>
              <button
                onClick={() => setShowFormulaModal(false)}
                className="toss-btn"
                style={{ width: '100%', padding: '12px 24px', background: 'linear-gradient(to right, var(--accent-blue), #4f46e5)', color: 'white', fontWeight: 600, borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 14 }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}