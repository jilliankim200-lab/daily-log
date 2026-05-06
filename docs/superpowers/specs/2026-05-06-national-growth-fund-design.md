# 국민성장펀드 ETF 대시보드 — 설계 문서

**작성일:** 2026-05-06  
**접근법:** A (개별 차트 + 뉴스 링크)

---

## 1. 개요

국민성장펀드(KDB 산업은행, 5년 150조원) 수혜 ETF를 추적하는 정보 페이지.  
6개 분야별 추천 ETF의 현재가·등락률을 카드로 표시하고, 카드 클릭 시 기존 ChartPage로 이동.  
ETF 목록은 사용자가 추가/삭제 가능하며 localStorage에 저장.

---

## 2. 아키텍처

### 신규 컴포넌트
`src/components/NationalGrowthFund.tsx`

### 데이터 흐름
```
NationalGrowthFund
  ├── localStorage("ngf_etf_list")     ETF 목록 저장/불러오기
  ├── fetchPrices.ts                    기존 유틸 재사용 — 현재가·등락률
  └── navigateTo('chart')              기존 ChartPage 이동 패턴
```

### 라우팅
- `App.tsx` MENU_ITEMS에 추가: `{ id: "national-growth-fund", label: "국민성장펀드", materialIcon: "account_balance" }`
- `renderPage()` switch에 case 추가: `case "national-growth-fund": return <NationalGrowthFund />;`

---

## 3. 기본 ETF 목록 (localStorage seed)

| 분야 | 배지 | ETF명 | 티커 |
|------|------|-------|------|
| AI·반도체 | A | SOL AI반도체소부장 | 455850 |
| 바이오 | B | KODEX 바이오 | 261250 |
| 콘텐츠 | C | ACE KPOP포커스 | 475050 |
| 방산·우주 | D | PLUS 우주항공&UAM | 421320 |
| 이차전지 | E | SOL 2차전지소부장Fn | 455860 |
| 로봇 | F | KODEX 로봇액티브 | 445290 |

---

## 4. UI 구조

### 4-1. 페이지 레이아웃
```
[국민성장펀드 ETF 트래커]  — 페이지 헤더
[+ ETF 추가] 버튼           — 우상단

[카드 그리드 — 2열(PC) / 1열(모바일)]
  카드 × N개

[관련 뉴스]                 — 하단 섹션
  링크 목록
```

### 4-2. ETF 카드
```
┌──────────────────────────────────┐
│ [A] AI·반도체            [✕]     │
│ SOL AI반도체소부장               │
│ 455850                           │
│ 12,340원        ▲ +2.14%        │
└──────────────────────────────────┘
```
- 분야 배지(A~F): 각 배지별 색상 구분 (CSS 변수 활용)
- 현재가·등락률: `fetchPrices` 결과, 상승=빨강 하락=파랑 (기존 앱 컨벤션)
- 삭제 버튼(✕): 우상단, localStorage 즉시 반영
- 카드 클릭: `navigateTo('chart')` + `localStorage.setItem('chart_new_tab_ticker', ticker)` — 기존 ChartPage 새탭 패턴 그대로 사용

### 4-3. ETF 추가 모달
입력 필드 3개:
- 티커 (숫자 6자리)
- ETF명
- 분야 배지 (A~F 선택)

확인 시 localStorage `ngf_etf_list` 배열에 push.

### 4-4. 뉴스 링크 섹션
하드코딩 6개, 새 탭 오픈 (`target="_blank"`):

| 제목 | 네이버 뉴스 검색 키워드 |
|------|------------------------|
| 국민성장펀드 최신 뉴스 | 국민성장펀드 |
| 국민참여형 펀드 가입 | 국민참여형 국민성장펀드 |
| 반도체 소부장 동향 | 반도체 소부장 ETF |
| 바이오 기술특례 뉴스 | 바이오 기술특례 코스닥 |
| 우주·방산 소형주 | 우주항공 UAM 주식 |
| 로봇 부품 산업 | 로봇 부품 중소형주 |

URL 패턴: `https://search.naver.com/search.naver?where=news&query=<키워드>`

---

## 5. localStorage 스키마

```ts
// key: "ngf_etf_list"
type NgfEtf = {
  ticker: string;   // "455850"
  name: string;     // "SOL AI반도체소부장"
  sector: string;   // "A"
  label: string;    // "AI·반도체"
};
```

---

## 6. 기존 코드 재사용 포인트

| 재사용 대상 | 출처 | 용도 |
|------------|------|------|
| `fetchPrices()` | `src/utils/fetchPrices.ts` | 현재가·등락률 |
| `chart_new_tab_ticker` | `App.tsx` localStorage 패턴 | 차트 이동 |
| `navigateTo` | `AppContext` | 페이지 전환 |
| CSS 변수 (`--color-up`, `--color-down`) | `design-tokens.css` | 등락 색상 |

---

## 7. 구현 범위 (Out of Scope)

- ETF 역사적 가격 데이터 (Worker 수정 불필요)
- 비교 차트 (접근법 B로 나중에 확장 가능)
- 뉴스 자동 수집 (접근법 B/C로 나중에 확장 가능)
- 국민참여형펀드 직접 가입 연동
