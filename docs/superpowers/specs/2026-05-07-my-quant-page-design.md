# 내 퀀트 (MyQuant) 페이지 설계

## 목표

기존 퀀트 3페이지(QuantBasics, QuantDashboard, MonthlyStrategy)는 레퍼런스로 유지하되, 별도 "내 퀀트" 페이지를 신설하여 사용자가 자신의 포트폴리오를 입력하고 듀얼모멘텀 전략 신호를 기반으로 리밸런싱 시뮬레이션을 즉시 확인할 수 있게 한다.

## 아키텍처

- **신규 파일**: `src/components/MyQuant.tsx`
- **라우팅**: `src/App.tsx`에 `/my-quant` 경로 추가, 사이드바 메뉴 "내 퀀트" 추가
- **기존 파일 변경 없음**: QuantBasics, QuantDashboard, MonthlyStrategy 수정 불필요
- **데이터 소스**:
  - 모멘텀 신호: Worker KV `GET /kv/crash_signals` (이미 존재)
  - 포트폴리오: 사용자 직접 입력 → `localStorage` 저장 (서버 불필요)
  - 목표 비중: 듀얼모멘텀 신호에서 자동 계산

## 기술 스택

- React 18 + TypeScript
- CSS 디자인 토큰 (`var(--bg-primary)` 등) — 다크/라이트 자동 대응
- Worker URL: `import.meta.env.VITE_WORKER_URL`
- localStorage key: `myquant_portfolio`

---

## 섹션 1: 이번 달 신호 요약

### 목적
"오늘 뭘 사야 해?"를 한눈에 답한다.

### UI
- 카드 1개, 상단 고정
- 현재 듀얼모멘텀 신호 표시 (예: "반도체 100% 매수")
- 신호 색상: 🟢 매수, 🟡 관망, 🔴 현금 대피
- 7대 자산 중 1위 자산명 + 모멘텀 상태 한 줄 설명
- 다음 리밸런싱 예상 날짜 (매월 첫째 주)
- "QuantDashboard 상세 보기" 링크

### 데이터 로직
```typescript
// crash_signals에서 r3m 기준 1위 자산 도출
const topAsset = crashItems.sort((a, b) => b.r3m - a.r3m)[0];
const signal = topAsset.r3m > 0 && topAsset.r6m > 0 ? 'BUY' : topAsset.r3m < 0 ? 'CASH' : 'HOLD';
```

---

## 섹션 2: 내 포트폴리오 입력

### 목적
현재 보유 자산을 입력하고 비중을 계산한다.

### UI
- 편집 가능한 테이블
  - 컬럼: ETF명 | 현재 금액(원) | 현재 비중(%) | 삭제 버튼
  - 하단: 합계 행
- "ETF 추가" 버튼 → 빈 행 추가
- "저장" 버튼 → localStorage에 JSON 저장
- 페이지 진입 시 localStorage에서 자동 복원

### 데이터 구조
```typescript
interface PortfolioItem {
  id: string;       // uuid
  name: string;     // ETF명
  amount: number;   // 현재 금액(원)
}

// localStorage key: "myquant_portfolio"
// value: JSON.stringify(PortfolioItem[])
```

### 비중 계산
```typescript
const total = items.reduce((s, i) => s + i.amount, 0);
const weight = (item.amount / total * 100).toFixed(1) + '%';
```

---

## 섹션 3: 리밸런싱 시뮬레이터

### 목적
"현재 포트 → 전략 목표"의 갭을 계산해 구체적인 매매 금액을 출력한다.

### 목표 비중 계산 로직
- 신호가 BUY → 1위 자산 100%
- 신호가 HOLD → 1위 자산 60% + 현금 40% (혼합 신호 시 보수적 적용)
- 신호가 CASH → 현금 100%

### UI
```
목표: [자산명] [비중]%  ← 현재 신호 자동 반영

팔아야 할 것
  [ETF명]   [금액]원  (현재%→목표%)

사야 할 것
  [ETF명]   [금액]원  (현재%→목표%)

리밸런싱 후 예상 구성: [자산명] [비중]%
총 거래 금액: [합계]원
```

### 계산 로직
```typescript
// 목표 금액 = 총 포트폴리오 × 목표 비중
const targetAmount = total * targetWeight;
const diff = targetAmount - currentAmount;
// diff > 0 → 매수, diff < 0 → 매도, diff === 0 → 유지
```

---

## 라우팅 및 사이드바

- `src/App.tsx`: `<Route path="/my-quant" element={<MyQuant />}` 추가
- 사이드바 메뉴: "지표" 섹션 하위에 "내 퀀트" 추가 (QuantBasics 위)
- 아이콘: `account_balance_wallet` (Google Material Icons)

---

## 엣지 케이스

| 상황 | 처리 |
|------|------|
| 포트폴리오 미입력 | "포트폴리오를 입력해주세요" 안내 + 시뮬레이터 비활성화 |
| crash_signals fetch 실패 | "신호 로딩 실패" 표시, 수동 새로고침 버튼 |
| 금액 합계 = 0 | 비중 계산 skip, "금액을 입력해주세요" |
| ETF명 공백 | 저장 시 유효성 검사, 빈 행 무시 |

---

## 구현 범위 (YAGNI)

**포함:**
- 신호 요약 카드 (KV 연동)
- 포트폴리오 입력 테이블 (localStorage)
- 리밸런싱 시뮬레이터 (자동 계산)

**미포함 (향후):**
- 과거 백테스트 시뮬레이션
- 포트폴리오 수익률 추적 히스토리
- 서버 사이드 포트폴리오 저장
