# 매도 신호 통합 설계

**날짜:** 2026-05-04  
**상태:** 승인됨

## 배경 및 문제

현재 매도 추천이 3곳에 분산되어 각자 다른 기준으로 출력되고 있음:

| 위치 | 기준 |
|---|---|
| `MonthlyStrategy.tsx` | 위험도 분류 + 계절성 (Sell in May) |
| `fetchStockSignals.ts` | MA/60일 고저점 기술적 타이밍 |
| `OptimalGuide.tsx` | 중복 종목·절세·자산배분 |

결과: 상승추세인 종목에도 매도 추천이 뜨는 등 기준 충돌 발생.

## 목표

"이건 팔아야 해" 수준의 **강한 액션 신호**를 일관된 기준으로 통일한다.  
기존 세부 로직(절세, 재배분, 타이밍 신호)은 유지하고, **앞에 게이트 레이어를 추가**하는 방식.

---

## 3레이어 구조

```
레이어 1 — sellEngine: "팔 것인가?" (신규)
     ↓ SELL일 때만
레이어 2 — OptimalGuide 기존 로직: "어느 계좌에서, 얼마나?" (기존 유지)
     ↓
레이어 3 — fetchStockSignals: "지금 타이밍이 맞나?" (기존 유지)
```

---

## 레이어 1: sellEngine 설계

### 파일 구조

```
src/utils/sellConfig.ts   ← 설정값 (사용자 변경 가능)
src/utils/sellEngine.ts   ← 판단 로직
```

### sellConfig.ts

```ts
export const DEFAULT_SELL_CONFIG = {
  targetReturn: 0.20,   // 수익 실현 트리거 (기본 +20%)
  stopLoss: -0.10,      // 긴급 손절 트리거 (기본 -10%)
};

const STORAGE_KEY = 'sell_config';

export function loadSellConfig() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? { ...DEFAULT_SELL_CONFIG, ...JSON.parse(saved) } : DEFAULT_SELL_CONFIG;
}

export function saveSellConfig(config: typeof DEFAULT_SELL_CONFIG) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
```

### sellEngine.ts — getSellDecision()

**입력:** `{ currentReturn, currentPrice, ma20, ma60 }`  
**출력:** `{ action: 'hold' | 'sell_half' | 'sell_all', reason: string, urgency: 'none' | 'medium' | 'high' | 'critical' }`

**판단 흐름:**

```
1단계 Veto (AND 조건)
  주가 > MA20 → action: 'hold', urgency: 'none'
  → 이하 체크 생략 (상승추세 보호)

2단계 시나리오 1 — 추세 붕괴 매도 (전량)
  주가 < MA20
  AND MA20 < MA60
  → action: 'sell_all', urgency: 'high'
  (앱에 일별 히스토리 데이터가 없으므로 "2거래일 연속" 조건 제외)

3단계 시나리오 2 — 수익 실현 매도 (부분)
  currentReturn >= targetReturn
  AND 주가 < MA20
  → action: 'sell_half', urgency: 'medium'

4단계 시나리오 3 — 긴급 손절 (전량)
  currentReturn <= stopLoss
  AND 주가 < MA60
  → action: 'sell_all', urgency: 'critical'

기본값
  → action: 'hold', urgency: 'none'
```

---

## 레이어 2: OptimalGuide 기존 로직 (유지)

sellEngine이 `'hold'`를 리턴하면 해당 종목은 매도 후보에서 제외.  
`'sell_half'` 또는 `'sell_all'`일 때만 기존 로직 진입.

**기존 규칙 그대로 유지:**
- ① 중복 종목 → 절세 우선순위 낮은 계좌에서 매도 (IRP > 퇴직 > 연금저축 > ISA > 일반)
- ② 수익률 40%↑ → sellEngine SELL이어도 매도 제외 (세금·수수료 고려)
- ③ 퇴직/IRP → 안전자산 30~35% 유지 체크
- ④ 매도 현금 → 같은 계좌 목표 비중 기반 재배분

---

## 레이어 3: fetchStockSignals (유지)

기술적 타이밍 신호 (매도 적합 / 매도 가능 / 반등 대기 / 저점 매도 / 반등 후 매도) 변경 없음.  
sellEngine SELL 판정 종목에만 타이밍 배지를 함께 표시.

---

## UI 변경: OptimalGuide 설정 패널

OptimalGuide 상단에 설정 패널 추가. MonthlyStrategy는 링크만 제공.

```
[ 매도 기준 설정 ]              브라우저 자동 저장
  수익 실현 기준    손절 기준
     +20%           −10%
  [−5%] [+5%]    [−5%] [+5%]
```

- 변경 즉시 매도 신호 재계산
- `localStorage`에 자동 저장 (새로고침 후에도 유지)

---

## MonthlyStrategy 변경

기존 위험도 분류(매우높음/높음/보통) 및 계절성 로직은 유지.  
단, sellEngine이 `'hold'`를 리턴한 종목은 매도 후보 목록에서 제외.  
→ 상승추세 종목이 "즉시 매도 검토"에 뜨는 문제 해결.

---

## 파일 변경 요약

| 파일 | 변경 |
|---|---|
| `src/utils/sellConfig.ts` | 신규 생성 |
| `src/utils/sellEngine.ts` | 신규 생성 |
| `src/components/OptimalGuide.tsx` | sellEngine 게이트 + 설정 패널 UI 추가 |
| `src/components/MonthlyStrategy.tsx` | sellEngine 게이트로 후보 필터링 |
| `src/utils/fetchStockSignals.ts` | 변경 없음 |

---

## 결정 사항

- 아키텍처: Config + Engine 분리 (옵션 C)
- 설정 UI 위치: OptimalGuide 상단 인라인 패널 (옵션 B)
- 기본값: targetReturn 20%, stopLoss -10%
- 저장 방식: localStorage (백엔드 없이 브라우저 로컬)
- 매도 신호 성격: "이건 팔아야 해" 강한 액션 신호 (AND 조건 다중 충족 시에만)
