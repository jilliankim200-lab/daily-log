# 매도 신호 통합 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 3곳에 흩어진 매도 로직을 sellEngine 게이트로 통일해, 상승추세 종목에 매도 신호가 뜨지 않도록 한다.

**Architecture:** `sellConfig.ts`(설정값 + localStorage 저장)와 `sellEngine.ts`(AND 조건 판단 로직)를 신규 생성하고, OptimalGuide·MonthlyStrategy에 게이트로 삽입한다. 기존 절세·재배분·타이밍 로직은 그대로 유지된다.

**Tech Stack:** TypeScript, React, localStorage

---

## 파일 구조

| 파일 | 변경 |
|---|---|
| `src/utils/sellConfig.ts` | 신규 생성 — 설정값 타입, 기본값, localStorage 저장/로드 |
| `src/utils/sellEngine.ts` | 신규 생성 — `getSellDecision()` 판단 로직 |
| `src/components/OptimalGuide.tsx` | 수정 — sellConfig 상태, filteredPlans 파생, 설정 패널 UI |
| `src/components/MonthlyStrategy.tsx` | 수정 — signals 페칭, candidates sellEngine 필터 |

---

## Task 1: sellConfig.ts 생성

**Files:**
- Create: `src/utils/sellConfig.ts`

- [ ] **Step 1: 파일 생성**

```typescript
// src/utils/sellConfig.ts
const STORAGE_KEY = 'sell_config_v1';

export interface SellConfig {
  targetReturn: number;  // 수익 실현 트리거 (소수점. 0.20 = +20%)
  stopLoss: number;      // 손절 트리거 (음수 소수점. -0.10 = -10%)
}

export const DEFAULT_SELL_CONFIG: SellConfig = {
  targetReturn: 0.20,
  stopLoss: -0.10,
};

export function loadSellConfig(): SellConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SELL_CONFIG;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SELL_CONFIG, ...parsed };
  } catch {
    return DEFAULT_SELL_CONFIG;
  }
}

export function saveSellConfig(config: SellConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd /c/workspace/daily-log && npx tsc --noEmit 2>&1 | head -20
```

에러 없음 확인.

- [ ] **Step 3: 커밋**

```bash
git add src/utils/sellConfig.ts
git commit -m "feat: sellConfig — 매도 기준 설정값 + localStorage 저장"
```

---

## Task 2: sellEngine.ts 생성

**Files:**
- Create: `src/utils/sellEngine.ts`

- [ ] **Step 1: 파일 생성**

```typescript
// src/utils/sellEngine.ts
import { type SellConfig, DEFAULT_SELL_CONFIG } from './sellConfig';

export interface SellInput {
  currentReturn: number | null;  // 소수점 (0.25 = +25%). calcReturn() / 100 으로 변환해서 전달
  currentPrice: number;
  ma20: number;
  ma60: number;
}

export type SellAction = 'hold' | 'sell_half' | 'sell_all';
export type SellUrgency = 'none' | 'medium' | 'high' | 'critical';

export interface SellDecision {
  action: SellAction;
  reason: string;
  urgency: SellUrgency;
}

export function getSellDecision(
  input: SellInput,
  config: SellConfig = DEFAULT_SELL_CONFIG,
): SellDecision {
  const { currentReturn, currentPrice, ma20, ma60 } = input;

  // Veto: 상승추세 — 주가가 MA20 위이면 무조건 홀딩
  if (currentPrice > ma20) {
    return { action: 'hold', reason: '상승추세 (주가 > MA20)', urgency: 'none' };
  }

  // 시나리오 1: 추세 붕괴 전량 매도
  // 주가 < MA20 AND MA20 < MA60 → 데드크로스 or 진입
  if (ma20 < ma60) {
    return { action: 'sell_all', reason: '추세 붕괴 (MA20 < MA60)', urgency: 'high' };
  }

  // 시나리오 3: 긴급 손절 (시나리오 2보다 먼저 체크 — 손실이 우선)
  if (currentReturn !== null && currentReturn <= config.stopLoss) {
    return { action: 'sell_all', reason: `손절 기준 도달 (${(currentReturn * 100).toFixed(1)}%)`, urgency: 'critical' };
  }

  // 시나리오 2: 수익 실현 부분 매도
  // 주가 < MA20 이고 (시나리오 1 미해당) + 수익률 목표 달성
  if (currentReturn !== null && currentReturn >= config.targetReturn) {
    return { action: 'sell_half', reason: `목표 수익 달성 + 추세 꺾임 (${(currentReturn * 100).toFixed(1)}%)`, urgency: 'medium' };
  }

  return { action: 'hold', reason: '매도 조건 미충족', urgency: 'none' };
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd /c/workspace/daily-log && npx tsc --noEmit 2>&1 | head -20
```

에러 없음 확인.

- [ ] **Step 3: 커밋**

```bash
git add src/utils/sellEngine.ts
git commit -m "feat: sellEngine — AND 조건 매도 판단 로직"
```

---

## Task 3: OptimalGuide — sellEngine 게이트 + 설정 패널 UI

**Files:**
- Modify: `src/components/OptimalGuide.tsx`

### 3-A: import 추가 및 sellConfig 상태 추가

- [ ] **Step 1: import 추가**

파일 상단 import 영역에 추가:

```typescript
import { loadSellConfig, saveSellConfig, DEFAULT_SELL_CONFIG, type SellConfig } from '../utils/sellConfig';
import { getSellDecision } from '../utils/sellEngine';
```

- [ ] **Step 2: 컴포넌트 상태 변수 추가**

`const [saving, setSaving] = useState(false);` 아래에 추가:

```typescript
const [sellConfig, setSellConfig] = useState<SellConfig>(loadSellConfig);
```

- [ ] **Step 3: `computeAllPlans` 호출부 수정**

기존 (line 1336):
```typescript
const { accountPlans, totalSells, retirementIssues } = useMemo(() =>
  computeAllPlans(accounts, prices, targets, new Set(), executedInCycle),
  [accounts, prices, targets, executedInCycle]);
```

다음으로 교체:
```typescript
const { accountPlans: rawAccountPlans, retirementIssues } = useMemo(() =>
  computeAllPlans(accounts, prices, targets, new Set(), executedInCycle),
  [accounts, prices, targets, executedInCycle]);

// sellEngine 게이트: signals 로드 완료 전에는 필터 안 함
const accountPlans = useMemo(() => {
  if (Object.keys(signals).length === 0) return rawAccountPlans;
  return rawAccountPlans.map(plan => ({
    ...plan,
    sells: plan.sells.filter(s => {
      if (!s.h.ticker || !signals[s.h.ticker]) return true;
      const sig = signals[s.h.ticker];
      const decision = getSellDecision(
        {
          currentReturn: s.ret !== null ? s.ret / 100 : null,
          currentPrice: sig.currentPrice,
          ma20: sig.ma20,
          ma60: sig.ma60,
        },
        sellConfig,
      );
      return decision.action !== 'hold';
    }),
  }));
}, [rawAccountPlans, signals, sellConfig]);

const totalSells = useMemo(
  () => accountPlans.reduce((s, p) => s + p.sells.length, 0),
  [accountPlans],
);
```

- [ ] **Step 4: 타입 체크**

```bash
cd /c/workspace/daily-log && npx tsc --noEmit 2>&1 | head -30
```

에러 없음 확인.

### 3-B: 설정 패널 UI 추가

- [ ] **Step 5: 설정 패널 핸들러 추가**

`setSellConfig` 상태 추가 직후에 핸들러 함수 추가:

```typescript
const handleSellConfigChange = (key: keyof SellConfig, delta: number) => {
  setSellConfig(prev => {
    const next = { ...prev, [key]: Math.round((prev[key] + delta) * 100) / 100 };
    saveSellConfig(next);
    return next;
  });
};
```

- [ ] **Step 6: 설정 패널 UI 삽입**

OptimalGuide 메인 return 안, 페이지 제목 div 바로 아래 (`{/* 요약 카드 */}` 주석 바로 위):

```tsx
{/* 매도 기준 설정 패널 */}
<div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: isMobile ? '10px 12px' : '12px 16px', marginBottom: isMobile ? 14 : 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
    <MIcon name="tune" size={15} style={{ color: 'var(--text-tertiary)' }} />
    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>매도 기준</span>
  </div>
  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
    {/* 수익 실현 */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-primary)', borderRadius: 8, padding: '5px 10px' }}>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>수익실현</span>
      <button onClick={() => handleSellConfigChange('targetReturn', -0.05)}
        style={{ background: 'none', border: '1px solid var(--border-secondary)', borderRadius: 4, color: 'var(--text-secondary)', width: 20, height: 20, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0 }}>−</button>
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-profit)', minWidth: 36, textAlign: 'center' }}>
        +{(sellConfig.targetReturn * 100).toFixed(0)}%
      </span>
      <button onClick={() => handleSellConfigChange('targetReturn', 0.05)}
        style={{ background: 'none', border: '1px solid var(--border-secondary)', borderRadius: 4, color: 'var(--text-secondary)', width: 20, height: 20, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0 }}>+</button>
    </div>
    {/* 손절 */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-primary)', borderRadius: 8, padding: '5px 10px' }}>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>손절</span>
      <button onClick={() => handleSellConfigChange('stopLoss', -0.05)}
        style={{ background: 'none', border: '1px solid var(--border-secondary)', borderRadius: 4, color: 'var(--text-secondary)', width: 20, height: 20, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0 }}>−</button>
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-loss)', minWidth: 36, textAlign: 'center' }}>
        {(sellConfig.stopLoss * 100).toFixed(0)}%
      </span>
      <button onClick={() => handleSellConfigChange('stopLoss', 0.05)}
        style={{ background: 'none', border: '1px solid var(--border-secondary)', borderRadius: 4, color: 'var(--text-secondary)', width: 20, height: 20, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0 }}>+</button>
    </div>
  </div>
  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>자동 저장</span>
</div>
```

- [ ] **Step 7: 브라우저에서 확인**

`npm run dev` → 최적가이드 페이지 열어서:
1. 설정 패널이 보이는지 확인
2. +/− 버튼으로 수치가 변하는지 확인
3. 새로고침 후에도 수치가 유지되는지 확인 (localStorage)
4. 상승추세 종목이 매도 목록에서 빠지는지 확인 (signals 로드 후)

- [ ] **Step 8: 커밋**

```bash
git add src/components/OptimalGuide.tsx
git commit -m "feat: OptimalGuide — sellEngine 게이트 + 매도 기준 설정 패널"
```

---

## Task 4: MonthlyStrategy — signals 페칭 + sellEngine 게이트

**Files:**
- Modify: `src/components/MonthlyStrategy.tsx`

- [ ] **Step 1: import 추가**

파일 상단 import 영역에 추가:

```typescript
import { useState, useEffect, useMemo } from 'react';
import { fetchStockSignals, type StockSignal } from '../utils/fetchStockSignals';
import { getSellDecision } from '../utils/sellEngine';
import { loadSellConfig } from '../utils/sellConfig';
```

- [ ] **Step 2: `React` 참조 정리**

파일 첫 줄이 `import React, { useMemo } from 'react';`이면:

```typescript
import React, { useState, useEffect, useMemo } from 'react';
```

로 교체 (이미 useMemo가 있으므로 useState, useEffect만 추가).

- [ ] **Step 3: signals 상태 + useEffect 추가**

`export function MonthlyStrategy()` 본문의 `const { accounts, prices, isMobile } = useAppContext();` 바로 아래에 추가:

```typescript
const [signals, setSignals] = useState<Record<string, StockSignal>>({});

useEffect(() => {
  const tickers = accounts
    .flatMap(a => a.holdings.map(h => h.ticker))
    .filter((t): t is string => Boolean(t));
  if (tickers.length === 0) return;
  fetchStockSignals(tickers).then(setSignals);
}, [accounts]);
```

- [ ] **Step 4: candidates에 sellEngine 필터 적용**

기존 `candidates` useMemo 반환 직전 (`return list.sort(...)` 앞)에 필터 추가:

```typescript
// sellEngine 게이트: 상승추세 종목 제거
const sellConfig = loadSellConfig();
const filtered = list.filter(c => {
  if (!c.holding.ticker || !signals[c.holding.ticker]) return true;
  const sig = signals[c.holding.ticker];
  const avgPrice = c.holding.avgPrice || 0;
  const currentPrice = prices[c.holding.ticker] || avgPrice;
  const currentReturn = avgPrice > 0 ? (currentPrice - avgPrice) / avgPrice : null;
  const decision = getSellDecision(
    { currentReturn, currentPrice: sig.currentPrice, ma20: sig.ma20, ma60: sig.ma60 },
    sellConfig,
  );
  return decision.action !== 'hold';
});
return filtered.sort((a, b) => a.priority - b.priority || b.val - a.val);
```

> ⚠️ 기존 `return list.sort(...)` 줄을 삭제하고 위 코드로 교체한다.

- [ ] **Step 5: useMemo 의존성 배열 업데이트**

`candidates` useMemo의 의존성 배열을 다음으로 업데이트:

```typescript
}, [accounts, prices, signals]);
```

- [ ] **Step 6: 타입 체크**

```bash
cd /c/workspace/daily-log && npx tsc --noEmit 2>&1 | head -30
```

에러 없음 확인.

- [ ] **Step 7: 브라우저에서 확인**

월별전략 페이지 열어서:
1. 상승추세 종목이 매도 후보에서 빠지는지 확인
2. 하락추세 종목은 그대로 표시되는지 확인
3. signals 로드 전에는 기존과 동일하게 표시되는지 확인

- [ ] **Step 8: 커밋**

```bash
git add src/components/MonthlyStrategy.tsx
git commit -m "feat: MonthlyStrategy — sellEngine 게이트로 상승추세 종목 매도 후보 제외"
```

---

## Self-Review 체크리스트

- [x] **스펙 커버리지**: sellConfig(Task 1), sellEngine(Task 2), OptimalGuide 게이트+UI(Task 3), MonthlyStrategy 게이트(Task 4) — 모두 커버됨
- [x] **Placeholder 없음**: 모든 스텝에 실제 코드 포함
- [x] **타입 일관성**: `SellConfig`, `SellInput`, `SellDecision`, `SellAction`, `SellUrgency` — Task 1→2→3→4 순서로 정의 후 사용
- [x] **수익률 단위**: `calcReturn()` 은 % 반환(25), sellEngine은 소수점(0.25) 받음. Task 3/4에서 `/100` 변환 명시됨
- [x] **signals 없을 때**: `return true` (필터 통과) — 데이터 없으면 기존 동작 유지
