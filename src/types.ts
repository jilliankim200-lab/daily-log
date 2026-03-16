// 자산관리 시스템 공통 타입

export interface Holding {
  id: string;
  name: string;        // 종목명
  ticker: string;      // 종목코드/티커
  market: 'KR' | 'US'; // 시장 구분
  avgPrice: number;    // 평균매입단가
  quantity: number;    // 보유수량
  currentPrice?: number; // 현재가 (API에서 조회)
  isFund?: boolean;    // 펀드 여부 (금액만 입력)
  amount?: number;     // 펀드 금액
}

// 홀딩의 평가금액 계산 헬퍼
export function holdingValue(h: Holding, currentPrice?: number): number {
  if (h.isFund) return h.amount || 0;
  if (currentPrice) return currentPrice * h.quantity;
  return h.avgPrice * h.quantity;
}

// 홀딩의 매입금액 계산 헬퍼
export function holdingCost(h: Holding): number {
  if (h.isFund) return h.amount || 0;
  return h.avgPrice * h.quantity;
}

export interface Account {
  id: string;
  owner: 'wife' | 'husband'; // 소유자
  ownerName: string;          // 표시 이름
  institution: string;        // 증권사/은행
  accountType: string;        // ISA, 연금저축, IRP, 일반, CMA 등
  alias: string;              // 계좌 별칭
  holdings: Holding[];
  cash?: number;              // 현금 잔액
}

export interface OtherAsset {
  id: string;
  owner: 'wife' | 'husband' | 'shared'; // 소유자
  name: string;       // 자산명
  amount: number;     // 금액
}

export interface DailySnapshot {
  date: string;         // YYYY-MM-DD
  totalAsset: number;
  wifeAsset: number;
  husbandAsset: number;
  assetChange: number;  // 전일대비
  changeRate: number;   // 전일대비 %
  dividend?: number;    // 배당금
}
