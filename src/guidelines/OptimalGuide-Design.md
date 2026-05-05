# 최적 가이드 (OptimalGuide) 설계 문서

> 최종 업데이트: 2026-05-05

---

## 1. 개요

`OptimalGuide.tsx`는 다중 계좌(부부 공동) 포트폴리오를 분석하여 절세 최적화·목표 비중 달성을 위한 매도/매수 액션 플랜을 생성하는 핵심 컴포넌트이다.

---

## 2. 핵심 데이터 흐름

```
accounts + prices
    │
    ▼
computeAllPlans()          ← 절세 계좌 중복 종목 정리, 전체 포트폴리오 기준 계산
    │
    ▼
rawAccountPlans
    │
    ├─ 필터 ON  ──► rawAccountPlans.map(getSellDecision 필터)  ← 기술적 분석 매도 조건 적용
    │
    └─ 필터 OFF ──► applyVolatilityHarvest()                   ← 변동성 수확 전략 적용
    │
    ▼
accountPlans (최종 플랜)
```

---

## 3. `computeAllPlans` — 절세 중복 정리 + 목표 비중 매수 배분

### 3-1. 매도 선별 (sellSet)

- 동일 소유자(owner) + 동일 종목(ticker/name)이 **복수 계좌**에 있으면 중복 처리
- 절세 우선순위: IRP > 연금저축 > ISA > 일반
- 우선순위 낮은 계좌의 종목을 `sellSet`에 추가
- 예외: 해당 종목 수익률 ≥ +40%이면 보호 (40%↑ 보호 규칙)

### 3-2. 전체 포트폴리오 글로벌 집계

```
globalPortfolioValue = Σ(모든 계좌 보유 종목 평가액) + Σ(모든 계좌 현금)
globalClassTotals[cls] = Σ(sellSet 제외 keep 종목의 평가액, cls별)
```

### 3-3. 매수 배분 — `computeBuys` (deficit 기반)

**목적:** 매도 후 확보된 현금을 목표 비중 미달 자산군에 집중 배분

```
deficit[cls] = max(0, globalPortfolioValue × target[cls]/100 − globalClassTotals[cls])
totalDeficit = Σ deficit[cls]

각 종목 addAmount = (deficit[cls] / totalDeficit) × (종목val / 계좌내cls합) × freedCash
```

- `freedCash = sellTotal + cash` (매도 예정금 + 계좌 현금 전부 사용)
- 이미 목표 초과인 자산군은 `deficit = 0` → 매수 없음
- 글로벌 deficit 기준이므로 계좌 간 불균형도 보정

---

## 4. 필터 ON — 기술적 분석 기반 매도 필터 (`getSellDecision`)

> `sellEngineEnabled = true` (기본값)

중복 종목(sellSet) 중 **현재 기술적 조건도 매도 적합한 것만** 표시

| 우선순위 | 조건 | 결과 |
|---|---|---|
| 1 (Veto) | 현재가 > MA20 | `hold` — 매도 표시 안 함 |
| 2 | MA20 < MA60 (추세 붕괴) | `sell_all` |
| 3 | 수익률 < 손절선(기본 -15%) | `sell_all` |
| 4 | 수익률 > 익절선(기본 +20%) + 추세 꺾임 | `sell_half` |
| default | 해당 없음 | `hold` |

손절선·익절선은 UI에서 조절 가능 (`sellConfig`)

---

## 5. 필터 OFF — 변동성 수확 전략 (`applyVolatilityHarvest`)

> `sellEngineEnabled = false`

추세 무관하게 **수익률·당일등락률**만으로 기계적 분할매매를 권유

### 5-1. 분할매도 기준 (수익률 기반)

| 수익률 구간 | 매도 비율 | `partialRatio` |
|---|---|---|
| +20% ~ +35% | 보유의 1/4 | 0.25 |
| +35% ~ +50% | 보유의 1/3 | 0.333 |
| +50% 이상 | 보유의 1/2 | 0.5 |
| +20% 미만 | 매도 없음 | — |

- 중복 계좌 여부와 무관하게 **전 종목** 적용
- `SellItem.partialRatio` 필드에 저장 → UI에서 뱃지("1/4 매도" 등) 및 예정 금액 표시

### 5-2. 분할매수 기준 (당일 등락률 기반)

| 당일 하락률 | 매수 금액 | 비율 |
|---|---|---|
| -2% ~ -3% | 가용현금의 1/4 | 0.25 |
| -3% ~ -5% | 가용현금의 1/3 | 0.333 |
| -5% 이상 | 가용현금의 1/2 | 0.5 |

- `가용현금 = 계좌 현금 + 분할매도 예정금(val × partialRatio)`
- 대상: 보유 유지(keeps) 종목 중 `changeRates`가 있는 것

---

## 6. 자산 분류 (`classify`)

```
종목명에 "커버드콜" 포함         → 커버드콜
국채/채권/단기채/액티브 포함      → 채권
나스닥/S&P/코스피/반도체/AI 등   → 주식
금현물/KRX금                     → 금
그 외                             → 기타
```

**안전자산 (`isSafeAsset`):** 채권, 금만 해당 (커버드콜 제외)
- 연금/IRP 계좌의 30% 안전비중 체크에 사용

---

## 7. UI 주요 상태

| 상태 | 기본값 | 설명 |
|---|---|---|
| `sellEngineEnabled` | `true` | 필터 ON/OFF (localStorage 유지) |
| `targets` | `{주식:60, 채권:20, 커버드콜:10, 금:5, 기타:5}` | 목표 비중 (localStorage 유지) |
| `signalFilter` | `null` | 종목 신호 필터 (매도적합/반등대기 등) |
| `execMode` | `false` | 실행 체크박스 모드 |
| `executedInCycle` | Set | 현 사이클(1일/15일) 실행 완료 종목 |

---

## 8. 계좌 헤더 뱃지 표시 규칙

| 조건 | 뱃지 |
|---|---|
| sells.length > 0 | 🔴 매도 N개 |
| sells.length = 0 | ⬜ 매도없음 (회색) |
| buys 중 addAmount > 0인 것 있음 | 🔴 추가매수 N개 |
| 연금계좌 + 안전비중 미달 | 🔴 ⚠ 안전자산 미달 |
| 연금계좌 + 안전비중 초과 | 🔴 ▲ 안전자산 초과 |
