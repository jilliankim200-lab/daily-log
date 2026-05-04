# 자산 대시보드 시스템 기술 참조 문서

> 이 문서를 보고 동일한 시스템을 재현하거나, 문제 발생 시 원인을 파악할 수 있도록 작성된 기술 참조 문서입니다.  
> 최종 업데이트: 2026-05-04 (r2)

---

## 1. 시스템 개요

개인 자산을 관리하는 **React 단일 페이지 앱**. 주요 기능:
- 보유 종목 현황 및 수익률 조회
- 매도/매수 신호 자동 판단 (sellEngine)
- 리밸런싱 가이드
- 자산증감 추적 (월별 스냅샷)
- 가계부 (예산 vs 실적)
- 주가 차트 (MA20/MA60 이동평균)
- 월별 투자전략 페이지

---

## 2. 기술 스택

| 레이어 | 기술 |
|---|---|
| 프론트엔드 | React 18 + TypeScript + Vite |
| 스타일 | CSS 변수 기반 디자인 토큰 (Tailwind 병행) |
| 차트 | Recharts (LineChart) |
| 데이터 저장 | localStorage (설정값, 캐시), Cloudflare KV (스냅샷) |
| 백엔드 프록시 | Cloudflare Worker (`asset-dashboard-api.jilliankim200.workers.dev`) |
| 데이터 소스 | **네이버 금융** (fchart, polling.finance.naver.com) |
| 배포 | Cloudflare Pages (`wrangler pages deploy`) |

### 왜 Cloudflare Worker가 필요한가?
브라우저에서 네이버 금융 API를 직접 호출하면 **CORS 차단**으로 실패함.  
Worker가 서버 사이드에서 네이버 API를 호출 → 프론트에 JSON 전달.

---

## 3. 프로젝트 구조

```
daily-log/
├── src/
│   ├── App.tsx                    ← 라우팅, 전역 Context, MENU_ITEMS, 계좌 데이터
│   ├── components/
│   │   ├── OptimalGuide.tsx       ← 매도/매수 신호 핵심 페이지 ★
│   │   ├── ChartPage.tsx          ← 주가 차트 (MA20/MA60)
│   │   ├── MonthlyStrategy.tsx    ← 월별 투자전략
│   │   ├── AssetChange.tsx        ← 자산증감 (월별 스냅샷 + 배당금 자동 기록)
│   │   ├── HouseholdBudget.tsx    ← 가계부 (예산/실적)
│   │   ├── Holdings.tsx           ← 보유종목 현황 + 신호 기준 가이드 패널
│   │   ├── CalcChecklist.tsx      ← 계산식 검증 (iframe 래퍼) ★ 신규
│   │   ├── Dividend.tsx           ← 배당 내역 + 월 추정치 localStorage 저장
│   │   ├── AccountReturn.tsx      ← 계좌별 수익률
│   │   ├── Rebalancing.tsx        ← 리밸런싱 가이드
│   │   ├── Header.tsx             ← 상단 헤더 (환율, 주요지수)
│   │   ├── MarketIndices.tsx      ← 코스피/나스닥 등 지수 버튼
│   │   └── MarketIndicesModal.tsx ← 지수 상세 모달
│   └── utils/
│       ├── sellEngine.ts          ← 매도 판단 로직 ★ (신규)
│       ├── sellConfig.ts          ← 매도 기준 설정값 ★ (신규)
│       ├── fetchStockSignals.ts   ← MA/타이밍 신호 fetch + 계산
│       ├── fetchPrices.ts         ← 실시간 현재가 + 등락률 fetch
│       ├── fetchMarketData.ts     ← 코스피/나스닥 등 지수 fetch
│       └── seedData.ts            ← 초기 데이터 시드
├── worker/
│   └── src/index.ts               ← Cloudflare Worker (백엔드 프록시)
├── public/
│   └── calc-checklist.html        ← 계산식 검증 독립 HTML (Vite static)
└── docs/
    ├── SYSTEM_REFERENCE.md        ← 이 문서
    └── superpowers/
        ├── specs/                 ← 설계 문서
        └── plans/                 ← 구현 계획
```

---

## 4. 데이터 흐름

```
[네이버 금융 API]
  ├── fchart.stock.naver.com/sise.nhn?symbol={ticker}&timeframe=day&count=90
  │     → 과거 일별 종가 데이터 (차트용)
  ├── polling.finance.naver.com/api/realtime/domestic/stock/{ticker}
  │     → 실시간 현재가 + 당일 등락률
  └── polling.finance.naver.com/api/realtime/domestic/index/KOSPI
        → 코스피/코스닥 지수

         ↓ (CORS 우회)

[Cloudflare Worker] 엔드포인트:
  ├── GET /stock-chart/{ticker}?days=90    → 과거 가격 배열
  ├── GET /stock-prices?tickers=A,B,C     → 배치 현재가
  ├── GET /stock-prices-with-change?...   → 현재가 + 등락률
  ├── GET /stock-detail/{ticker}          → MA20/MA60/고저점/등락률 통합
  └── GET /market-indices                 → 코스피/코스닥/나스닥/S&P

         ↓

[React 프론트엔드]
  ├── fetchStockSignals.ts → /stock-detail  (6시간 localStorage 캐시)
  ├── fetchPrices.ts       → /stock-prices-with-change (5분 캐시)
  └── ChartPage.tsx        → /stock-chart (페이지별 fresh fetch)
```

---

## 5. 핵심 로직: 매도 신호 3레이어 구조

### 설계 원칙

> "이건 팔아야 해" 수준의 **강한 액션 신호만** 올린다. AND 조건 다중 충족 시에만 매도 권고.

```
레이어 1 — sellEngine: "팔 것인가?" (AND 조건)
     ↓ SELL일 때만
레이어 2 — OptimalGuide 기존 로직: "어느 계좌에서, 얼마나?"
     ↓
레이어 3 — fetchStockSignals: "지금 타이밍이 맞나?"
```

---

### 레이어 1: sellEngine (`src/utils/sellEngine.ts`)

**입력:**
```ts
interface SellInput {
  currentReturn: number | null;  // 소수점 (0.25 = +25%)
  currentPrice: number;
  ma20: number;
  ma60: number;
}
```

**판단 흐름 (순서 중요):**

```
① Veto: 주가 > MA20
   → action: 'hold', urgency: 'none'
   → 이하 조건 모두 건너뜀 (상승추세 보호)

② 추세 붕괴: MA20 < MA60
   → action: 'sell_all', urgency: 'high'
   → 이유: 단기선이 중기선 아래로 꺾임 (데드크로스)

③ 긴급 손절: currentReturn <= -10% (stopLoss)
   → action: 'sell_all', urgency: 'critical'

④ 목표 수익 실현: currentReturn >= +20% (targetReturn) AND 주가 < MA20
   → action: 'sell_half', urgency: 'medium'
   → 추세가 꺾인 상태에서만 절반 매도

기본값
   → action: 'hold', urgency: 'none'
```

**출력 타입:**
```ts
type SellAction = 'hold' | 'sell_half' | 'sell_all';
type SellUrgency = 'none' | 'medium' | 'high' | 'critical';
```

---

### 레이어 1-설정: sellConfig (`src/utils/sellConfig.ts`)

```ts
// localStorage 키: 'sell_config_v1'
const DEFAULT_SELL_CONFIG = {
  targetReturn: 0.20,   // +20%
  stopLoss: -0.10,      // -10%
};
```

- `loadSellConfig()` / `saveSellConfig()` 로 localStorage 저장/로드
- OptimalGuide 상단 **"매도 기준 설정" 패널**에서 UI로 조정 가능
- 변경 즉시 매도 신호 재계산됨

---

### 레이어 2: OptimalGuide 계좌 로직

sellEngine이 `'hold'` → 해당 종목 매도 후보 **완전 제외**  
sellEngine이 `'sell_all'` 또는 `'sell_half'` → 기존 로직 진입:

```
① 동일 종목 여러 계좌 → 절세 우선순위 낮은 계좌에서 매도
   IRP > 퇴직연금 > 연금저축 > ISA > 일반/CMA

② 수익률 40%↑ 종목 → sellEngine SELL이어도 매도 제외
   (양도세 + 수수료 고려)

③ 퇴직/IRP → 매도 후 안전자산(채권+금) 30~35% 유지 체크

④ 매도 현금 → 같은 계좌 내 목표 비중 기반 재배분 (계좌 간 이동 없음)
```

---

### 레이어 3: 타이밍 신호 (`src/utils/fetchStockSignals.ts`)

`/stock-detail/{ticker}` 에서 받아온 `StockSignal` 기반으로 계산.

```ts
interface StockSignal {
  ticker: string;
  currentPrice: number;
  changeRate: number;    // 당일 등락률 (%)
  ma20: number;
  ma60: number;
  high: number;          // 60일 고점
  low: number;           // 60일 저점
  position: number;      // 0~1 (60일 범위 내 현재 위치)
}
```

**getTrend():**
```
주가 > MA20 AND > MA60 → 'up'    (상승추세)
주가 < MA20 AND < MA60 → 'down'  (하락추세)
그 외                  → 'sideways' (횡보)
```

**매도 타이밍 신호:**
| 신호 | 조건 | 색 |
|---|---|---|
| 매도 적합 | up + position ≥ 70% | 초록 |
| 매도 가능 | up + position < 70% | 초록 |
| 매도 가능 | sideways + position ≥ 50% | 주황 |
| 반등 대기 | sideways + position < 50% | 주황 |
| 저점 매도 | down + position ≤ 30% | 빨강 |
| 반등 후 매도 | down + position > 30% | 빨강 |

**매수 타이밍 신호 (소프트 게이트):**
| 신호 | 조건 | 색 | 분할 권장 |
|---|---|---|---|
| 반등 대기 | down + position ≤ 20% | 주황 | ✓ |
| 반등 대기 | down + position > 20% | 주황 | ✓ |
| 매수 적합 | sideways + position ≤ 40% | 초록 | |
| 분할 매수 | sideways + position > 40% | 주황 | ✓ |
| 조정 대기 | up + position ≥ 80% | 빨강 | ✓ |
| 분할 매수 | up + 60% ≤ position < 80% | 주황 | ✓ |
| 매수 가능 | up + position < 60% | 초록 | |

**"분할 권장" 표시**: `'조정 대기'` 또는 `'반등 대기'` 신호 → 매수 추천 금액 옆에 `· 분할 권장` 텍스트 + 배지 색이 timing.color로 변경 (기존에는 무조건 초록).

---

## 6. 차트 페이지 (`src/components/ChartPage.tsx`)

### 데이터 소스
- 차트 과거 데이터: `/stock-chart/{ticker}?days={30|90|180}`
- 실시간 등락률: `fetchCurrentPricesWithChange([ticker])` (OptimalGuide와 동일 API)

### MA 계산 (로컬)
```ts
function calcMA(prices: number[], period: number): (number | null)[] {
  return prices.map((_, i) => {
    if (i < period - 1) return null;
    const slice = prices.slice(i - period + 1, i + 1);
    return Math.round(slice.reduce((s, p) => s + p, 0) / period);
  });
}
```

### 등락률 계산 방식 (중요 수정 이력)
**버그**: 초기에 `rawData[last] - rawData[last-1]`으로 계산 → "어제의 등락률"이 표시됨.  
**수정**: `fetchCurrentPricesWithChange`로 실시간 등락률 별도 fetch → OptimalGuide와 일치.

```ts
// 실시간 API 우선, 실패 시 rawData fallback
const changeRate = realtimeChangeRate ?? histChangeRate;
```

### 커스텀 티커 검색
- 보유 종목 목록 외에 6자리 티커를 직접 입력해 조회 가능
- `isCustomTicker`: 선택된 ticker가 allHoldings에 없으면 true
- select에서는 "— 보유 종목 선택 —" 옵션 표시

---

## 7. 자산증감 (`src/components/AssetChange.tsx`)

### 스냅샷 구조
```ts
interface DailySnapshot {
  date: string;       // YYYY-MM-DD
  totalAsset: number;
  dividend?: number;  // 해당 월 배당금
  // ... 기타 자산 분류
}
```

- 저장소: localStorage + Cloudflare KV (`asset_snapshots`)
- `saveSnapshot(snapshot)` → KV에 저장
- `fetchSnapshots()` → KV에서 로드

### 월별 카드 뷰 (PC)
- 이전: 와이드 테이블 (가독성 나쁨)
- 변경: `isYearFilter=true` 일 때 **2열 카드 그리드** (`gridTemplateColumns: repeat(2, 1fr)`)

### 배당금 인라인 편집
- PC 월별 테이블 + 모바일 카드 모두 연필(edit) 아이콘 클릭 → 입력 필드 전환
- 저장 시 `saveSnapshot()` 호출 후 `fetchSnapshots()` 재로드
- Enter / Escape 키보드 단축키 지원

### 배당금 자동 기록 (2026-05 이후)
매월 마지막 거래일 기준 `월예상배당(합산)` 값을 자동으로 기록하는 구조:

```
Dividend.tsx 렌더 시:
  localStorage['monthly_dividend_estimates']['YYYY-MM'] = Math.round(totalMonthlyEstimate)
  (배당 페이지를 열 때마다 현재 월 추정치 덮어씀)

AssetChange.tsx 로드 시:
  - 이전 달(< 현재 YYYY-MM) 중 snapshot.dividend가 없는 월 스캔
  - monthly_dividend_estimates[month]가 있으면 → 해당 월의 마지막 스냅샷에 자동 saveSnapshot
  - 별도 UI 조작 불필요 — 배당 페이지를 한 번 열면 다음 자산증감 조회 시 자동 기입
```

**주의:** 배당 페이지를 마지막 거래일 근처에 열어야 그 시점의 값이 저장됨.  
직접 수정이 필요하면 연필 아이콘으로 수동 override 가능.

---

## 8. 가계부 (`src/components/HouseholdBudget.tsx`)

### 시드 데이터 버전 관리
특정 월의 실적을 업데이트할 때 이미 세팅된 KV/localStorage를 덮어써야 하는 문제 해결.

```ts
const SEED_VERSION_2026_04 = 'v2';  // 버전 올리면 강제 재시드
const SEED_VER_KEY = 'budget_seed_ver_2026_04';

// loadData() 내부
const savedVer = localStorage.getItem(SEED_VER_KEY);
if (savedVer !== SEED_VERSION_2026_04) {
  // 버전 불일치 → 캐시 무시하고 시드 데이터 강제 적용
  localStorage.setItem(SEED_VER_KEY, SEED_VERSION_2026_04);
  await seedAndLoad();
}
```

### 2026년 4월 실적 (우리은행 기준)
| 카테고리 | 실적 |
|---|---|
| 노랑우산(은퇴자금) | 4,000,000 |
| 대출 | 930,000 |
| 용돈 | 533,200 |
| 식비/외식 | 253,753 |
| 쇼핑 | 460,048 |
| 의료/약국 | 2,730 |
| 기타 | 208,439 |
| **합계** | **10,582,802** |

---

## 9. 보유종목 신호 기준 (`src/components/Holdings.tsx`)

### 신호 판단 함수
```ts
// 평균 매수가 기준
function getSignal(avgPrice, currentPrice): 'buy' | 'sell' | 'hold' | 'none'
  // currentPrice <= avgPrice × 0.97  → 'buy'  (평균단가 -3% 이하)
  // currentPrice >= avgPrice × 1.10  → 'sell' (평균단가 +10% 이상)

// 당일 등락률 기준
function getDaySignal(rate): 'buy' | 'sell' | 'hold' | 'none'
  // rate <= -3  → 'buy'  (당일 -3% 이하)
  // rate >= +3  → 'sell' (당일 +3% 이상)
```

### 필터 버튼 + 신호 가이드 패널
헤더 오른쪽에 `?` 아이콘 버튼 → 클릭 시 인라인 패널 토글.  
4가지 신호 조건을 조건식 + 설명으로 표시. 모바일/PC 모두 동작.

```tsx
const [showGuide, setShowGuide] = useState(false);
// showGuide === true → 헤더 아래 패널 렌더 (grid 2열)
```

---

## 10. 계산식 검증 페이지 (`src/components/CalcChecklist.tsx`)

### 구조
- `public/calc-checklist.html` — 독립 실행 가능한 HTML (CDN 의존성 없음)
- `CalcChecklist.tsx` — iframe 래퍼, 높이 = `isMobile ? calc(100vh - 60px) : 100vh`
- App.tsx `MENU_ITEMS`에 `{ id: "calc-checklist", label: "계산식 검증", materialIcon: "fact_check" }` 등록

### 검증 항목 (8개 섹션)
| 섹션 | 소스 파일 | 함수 |
|---|---|---|
| getTrend | fetchStockSignals.ts:19–25 | getTrend() |
| getSellSignal | fetchStockSignals.ts:30–47 | getSellSignal() |
| getBuySignal | fetchStockSignals.ts:50–68 | getBuySignal() |
| position | worker/src/index.ts | (low60, high60 기반) |
| sellEngine | sellEngine.ts | getSellDecision() |
| getSignal | Holdings.tsx:66–72 | getSignal() |
| getDaySignal | Holdings.tsx:74–79 | getDaySignal() |
| sellEngine 우선순위 | sellEngine.ts | getSellDecision() |

### 주의: 테스트 데이터 설계 시 함정
`getTrend() = 'sideways'`는 주가가 MA20/MA60 사이에 있을 때만 성립.  
둘 다 주가보다 높으면 `'down'`, 둘 다 낮으면 `'up'`.

---

## 11. OptimalGuide 가이드 모달

"가이드" 버튼 클릭 시 열리는 모달. `GuideModal` 컴포넌트.

### 섹션 구성
1. **매도 실행 기준 (sellEngine)** — 4조건 순서도
2. **매도 후 재배분 원칙** — 계좌 우선순위
3. **타이밍 신호 기준** — MA20/MA60 설명
4. **SELL 신호 구간** — 타이밍 배지 테이블
5. **BUY 신호 구간** — 타이밍 배지 테이블 + 분할 매수 가이드

---

## 12. 전역 UI 규칙

### maxWidth
모든 페이지 루트 div에 적용:
```tsx
style={{ maxWidth: 960, margin: '0 auto' }}
```
- MonthlyStrategy만 예외: `maxWidth: 720`

### 최소 폰트 크기
- 전체 페이지: 최소 **13px** (2026년5월 페이지 포함)
- `var(--text-xs)` = 12px, `var(--text-sm)` = 14px
- 10px, 11px, `var(--text-xs)` 사용 금지 → `fontSize: 13`으로 대체

### 아이콘
**Google Material Icons 전용.** 이모지/SVG/FontAwesome 사용 금지.
```html
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
<span class="material-icons">icon_name</span>
```

### 테마
CSS 변수 기반 다크/라이트 모드:
```
var(--bg-primary)      var(--text-primary)
var(--color-profit)    var(--color-loss)
var(--color-gold)      var(--accent-blue)
var(--border-primary)  var(--border-secondary)
```

---

## 13. 알려진 버그 및 수정 이력

### ① allHoldings TDZ(Temporal Dead Zone) 오류
**증상:** `Cannot access 'allHoldings' before initialization` 런타임 오류  
**원인:** `isCustomTicker`를 `allHoldings` useMemo 선언 이전에 참조  
**수정:** `isCustomTicker` 계산을 `allHoldings` useMemo 블록 이후로 이동

```ts
// 잘못된 위치 (useMemo 전)
const isCustomTicker = selectedTicker && !allHoldings.find(...);  // ← 오류

const allHoldings = useMemo(...);  // ← allHoldings 정의

// 올바른 위치 (useMemo 후)
const allHoldings = useMemo(...);
const isCustomTicker = selectedTicker && !allHoldings.find(...);  // ← 정상
```

### ② addBadge가 timing 계산 이전에 선언
**증상:** `timing` 변수를 참조하기 전에 `addBadge` JSX 생성  
**원인:** addBadge가 timing보다 앞에 선언됨  
**수정:** addBadge 선언을 timing 계산 이후로 이동

### ③ 차트 페이지 등락률 불일치
**증상:** OptimalGuide는 -0.27%, 차트 페이지는 +4.70% 같은 전혀 다른 값  
**원인:** 차트는 `rawData[last] - rawData[last-1]`을 사용 = 어제의 일중 변동률  
**수정:** `fetchCurrentPricesWithChange`로 실시간 등락률을 별도 fetch (OptimalGuide와 동일 소스)

### ④ 가계부 시드 데이터 미반영
**증상:** `SEED_2026_04` 실적값을 변경해도 화면에 반영 안 됨  
**원인:** 이미 KV/localStorage에 이전 값이 import 완료 상태로 저장되어 있어 시드가 무시됨  
**수정:** 버전 기반 강제 재시드 (`SEED_VERSION_2026_04 = 'v2'`)

### ⑤ 자산증감 월별 배당금 기록 불가
**증상:** localStorage를 코드로 직접 수정 불가  
**수정:** 월별 카드에 인라인 편집 UI 추가 (연필 아이콘 → 입력 필드 → saveSnapshot 호출)

---

## 14. Worker API 엔드포인트 레퍼런스

| 엔드포인트 | 메서드 | 설명 |
|---|---|---|
| `/stock-chart/{ticker}?days=N` | GET | 과거 N일 일별 종가 `[{date, price}]` |
| `/stock-prices?tickers=A,B` | GET | 배치 현재가 `{A: price, B: price}` |
| `/stock-prices-with-change?tickers=A,B` | GET | 현재가 + 등락률 `{A: {price, changeRate}}` |
| `/stock-detail/{ticker}` | GET | MA20/MA60/고저점/position 통합 |
| `/market-indices` | GET | 코스피/코스닥/나스닥/S&P/환율 |

---

## 15. localStorage 키 목록

| 키 | 용도 |
|---|---|
| `sell_config_v1` | 매도 기준 설정 (targetReturn, stopLoss) |
| `stock_signals_cache` | 주식 신호 캐시 (6시간 TTL) |
| `stock_prices_cache` | 현재가 캐시 (5분 TTL) |
| `market_index_cache` | 시장 지수 캐시 (1분 TTL) |
| `executed_holdings` | 이번 사이클 매도/매수 실행 기록 |
| `budget_seed_ver_2026_04` | 가계부 시드 버전 (`v2`) |
| `asset_snapshots` | 자산 일별 스냅샷 로컬 캐시 |
| `monthly_dividend_estimates` | 월별 예상 배당금 맵 `{ 'YYYY-MM': amount }` — Dividend.tsx가 기록, AssetChange.tsx가 자동 채움 |
| `dividend_rates_sync` | 배당률 데이터 (ticker, dividendPerShare, frequency 등) |
| `dividend_target_monthly` | 배당 목표 금액 (기본 7,000,000) |

---

## 16. 배포 방법

```bash
# 빌드
npm run build

# Cloudflare Pages 배포 (wrangler)
wrangler pages deploy build --project-name=daily-log

# Worker 배포 (worker/ 디렉토리에서)
cd worker
wrangler deploy
```

---

## 17. 재현 체크리스트 (처음부터 만들 때)

- [ ] React + TypeScript + Vite 프로젝트 생성
- [ ] Cloudflare Worker 설정 (wrangler.toml, `/stock-chart`, `/stock-detail`, `/stock-prices-with-change`)
- [ ] Worker에서 네이버 금융 API 호출 (CORS 우회)
- [ ] `src/utils/sellConfig.ts` — 설정값 + localStorage 저장
- [ ] `src/utils/sellEngine.ts` — 4조건 AND 판단 로직
- [ ] `src/utils/fetchStockSignals.ts` — MA/타이밍 신호 fetch (6시간 캐시)
- [ ] `src/utils/fetchPrices.ts` — 실시간 등락률 fetch (`/stock-prices-with-change`)
- [ ] OptimalGuide — sellEngine 게이트 + 설정 패널 + 3레이어 출력
- [ ] ChartPage — `/stock-chart` fetch + 로컬 MA 계산 + 실시간 등락률 별도 fetch
- [ ] AssetChange — 월별 2열 카드 그리드 + 배당금 인라인 편집 + 자동 기록 로직
- [ ] HouseholdBudget — 버전 기반 시드 데이터 강제 재적용 로직
- [ ] Holdings — 신호 가이드 패널 (`showGuide` 토글, `?` 버튼)
- [ ] Dividend — `monthly_dividend_estimates` localStorage 저장 useEffect
- [ ] CalcChecklist — `public/calc-checklist.html` + iframe 래퍼 컴포넌트
- [ ] App.tsx MENU_ITEMS — 라우팅 배열 (모바일 드로어 소스)
- [ ] Sidebar.tsx menuItems — PC 사이드바 (별도 배열, MENU_ITEMS와 독립)
- [ ] 전 페이지 `maxWidth: 960, margin: '0 auto'` 적용
- [ ] 최소 폰트 13px 보장
- [ ] Google Material Icons CDN 연결
