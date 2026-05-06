# 국민성장펀드 ETF 대시보드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 국민성장펀드 수혜 ETF 6개의 현재가·등락률을 카드로 표시하고, 카드 클릭 시 기존 ChartPage로 이동하며, 사용자가 ETF를 추가/삭제할 수 있는 페이지를 만든다.

**Architecture:** `NationalGrowthFund.tsx` 단일 컴포넌트로 구성. localStorage(`ngf_etf_list`)에서 ETF 목록을 읽어 카드 그리드로 렌더링. 현재가는 기존 `fetchCurrentPricesWithChange` 유틸 재사용. 차트 이동은 기존 `chart_new_tab_ticker` localStorage 패턴 재사용.

**Tech Stack:** React 18 + TypeScript, CSS 변수 (`design-tokens.css`), `fetchCurrentPricesWithChange` (기존 유틸), Google Material Icons

---

## 파일 구조

| 파일 | 작업 | 역할 |
|------|------|------|
| `src/components/NationalGrowthFund.tsx` | **Create** | 전체 페이지 컴포넌트 |
| `src/App.tsx` | **Modify** | MENU_ITEMS 항목 추가 + import + case |

---

## Task 1: App.tsx 라우팅 추가

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: MENU_ITEMS에 항목 추가**

`src/App.tsx`의 MENU_ITEMS 배열 마지막에 추가 (line ~73 근처, `calc-checklist` 다음):

```ts
{ id: "national-growth-fund", label: "국민성장펀드", materialIcon: "account_balance" },
```

- [ ] **Step 2: import 추가**

`src/App.tsx` 상단 import 목록에 추가 (다른 컴포넌트 import 근처):

```ts
import { NationalGrowthFund } from "./components/NationalGrowthFund";
```

- [ ] **Step 3: renderPage() switch에 case 추가**

`src/App.tsx`의 renderPage() switch 블록 (line ~229 근처) 마지막 case 다음:

```ts
case "national-growth-fund": return <NationalGrowthFund />;
```

- [ ] **Step 4: 개발 서버에서 확인**

`npm run dev` 실행 후 사이드바에 "국민성장펀드" 메뉴가 보이는지 확인. 클릭 시 빈 화면(컴포넌트 미구현이므로)이 나오면 정상.

> 컴포넌트가 없으면 import 에러 발생 — Task 2를 먼저 빈 파일로 생성 후 이 Task를 진행해도 됨.

- [ ] **Step 5: 커밋**

```bash
git add src/App.tsx
git commit -m "feat: 국민성장펀드 페이지 라우팅 추가"
```

---

## Task 2: NationalGrowthFund.tsx — 뼈대 + localStorage + seed 데이터

**Files:**
- Create: `src/components/NationalGrowthFund.tsx`

- [ ] **Step 1: 타입 + seed 데이터 + localStorage hook 작성**

`src/components/NationalGrowthFund.tsx` 파일 생성:

```tsx
import React, { useState } from 'react';
import { useAppContext } from '../App';
import { fetchCurrentPricesWithChange } from '../utils/fetchPrices';
import { MIcon } from './MIcon';

type NgfEtf = {
  ticker: string;
  name: string;
  sector: string;  // "A" ~ "F"
  label: string;   // "AI·반도체" 등
};

const SECTOR_COLORS: Record<string, string> = {
  A: '#4FC3F7',
  B: '#81C784',
  C: '#FFB74D',
  D: '#E57373',
  E: '#BA68C8',
  F: '#4DB6AC',
};

const DEFAULT_ETFS: NgfEtf[] = [
  { ticker: '455850', name: 'SOL AI반도체소부장',   sector: 'A', label: 'AI·반도체' },
  { ticker: '261250', name: 'KODEX 바이오',         sector: 'B', label: '바이오' },
  { ticker: '475050', name: 'ACE KPOP포커스',       sector: 'C', label: '콘텐츠' },
  { ticker: '421320', name: 'PLUS 우주항공&UAM',    sector: 'D', label: '방산·우주' },
  { ticker: '455860', name: 'SOL 2차전지소부장Fn',  sector: 'E', label: '이차전지' },
  { ticker: '445290', name: 'KODEX 로봇액티브',     sector: 'F', label: '로봇' },
];

const LS_KEY = 'ngf_etf_list';

function loadEtfs(): NgfEtf[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_ETFS;
}

function saveEtfs(list: NgfEtf[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

export function NationalGrowthFund() {
  const [etfs, setEtfs] = useState<NgfEtf[]>(loadEtfs);

  return (
    <div style={{ padding: '24px' }}>
      <h2>국민성장펀드 ETF 트래커</h2>
      <pre>{JSON.stringify(etfs, null, 2)}</pre>
    </div>
  );
}
```

- [ ] **Step 2: 개발 서버에서 확인**

브라우저에서 "국민성장펀드" 메뉴 클릭 → 6개 ETF JSON이 화면에 출력되면 정상.

- [ ] **Step 3: 커밋**

```bash
git add src/components/NationalGrowthFund.tsx
git commit -m "feat: NationalGrowthFund 뼈대 + localStorage seed"
```

---

## Task 3: ETF 카드 UI (가격 없이 레이아웃만)

**Files:**
- Modify: `src/components/NationalGrowthFund.tsx`

- [ ] **Step 1: 카드 컴포넌트 추가 + 그리드 렌더링**

`NationalGrowthFund.tsx`의 return 블록을 아래로 교체:

```tsx
export function NationalGrowthFund() {
  const { navigateTo } = useAppContext();
  const [etfs, setEtfs] = useState<NgfEtf[]>(loadEtfs);

  function handleDelete(ticker: string) {
    const next = etfs.filter(e => e.ticker !== ticker);
    setEtfs(next);
    saveEtfs(next);
  }

  function handleCardClick(etf: NgfEtf) {
    localStorage.setItem('chart_new_tab_ticker', etf.ticker);
    navigateTo('chart');
  }

  return (
    <div style={{ padding: '24px', maxWidth: '900px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>국민성장펀드 ETF 트래커</h2>
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '8px 16px', borderRadius: 'var(--radius-md)',
            background: 'var(--accent-blue)', color: 'var(--accent-blue-fg)',
            border: 'none', cursor: 'pointer', fontSize: '14px',
          }}
          onClick={() => {/* Task 5에서 구현 */}}
        >
          <MIcon name="add" size={18} />
          ETF 추가
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: '16px',
      }}>
        {etfs.map(etf => (
          <EtfCard
            key={etf.ticker}
            etf={etf}
            price={null}
            changeRate={null}
            onDelete={handleDelete}
            onClick={handleCardClick}
          />
        ))}
      </div>
    </div>
  );
}

type EtfCardProps = {
  etf: NgfEtf;
  price: number | null;
  changeRate: number | null;
  onDelete: (ticker: string) => void;
  onClick: (etf: NgfEtf) => void;
};

function EtfCard({ etf, price, changeRate, onDelete, onClick }: EtfCardProps) {
  const isUp = changeRate !== null && changeRate > 0;
  const isDown = changeRate !== null && changeRate < 0;
  const sectorColor = SECTOR_COLORS[etf.sector] ?? '#888';

  return (
    <div
      onClick={() => onClick(etf)}
      style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        cursor: 'pointer',
        position: 'relative',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      {/* 삭제 버튼 */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(etf.ticker); }}
        style={{
          position: 'absolute', top: '10px', right: '10px',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-tertiary)', padding: '2px',
          display: 'flex', alignItems: 'center',
        }}
      >
        <MIcon name="close" size={16} />
      </button>

      {/* 분야 배지 */}
      <div style={{ marginBottom: '8px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          background: sectorColor + '22',
          color: sectorColor,
          padding: '2px 10px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 700,
        }}>
          {etf.sector} · {etf.label}
        </span>
      </div>

      {/* ETF 이름 */}
      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
        {etf.name}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>
        {etf.ticker}
      </div>

      {/* 현재가 + 등락률 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {price !== null ? price.toLocaleString('ko-KR') + '원' : '—'}
        </span>
        <span style={{
          fontSize: '14px', fontWeight: 600,
          color: isUp ? 'var(--color-profit)' : isDown ? 'var(--color-loss)' : 'var(--text-tertiary)',
        }}>
          {changeRate !== null
            ? (isUp ? '▲ +' : isDown ? '▼ ' : '') + changeRate.toFixed(2) + '%'
            : '—'}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 개발 서버에서 확인**

카드 6개가 그리드로 표시되고, 가격은 `—`로 나오면 정상. 삭제 버튼(✕) 클릭 시 카드가 사라지면 정상. 페이지 새로고침 후 삭제된 카드가 복원되지 않으면 localStorage 정상 동작.

- [ ] **Step 3: 커밋**

```bash
git add src/components/NationalGrowthFund.tsx
git commit -m "feat: ETF 카드 UI + 삭제 기능"
```

---

## Task 4: fetchPrices 연동 (현재가·등락률 자동 로드)

**Files:**
- Modify: `src/components/NationalGrowthFund.tsx`

- [ ] **Step 1: 가격 state + useEffect 추가**

`NationalGrowthFund` 함수 내부 state 선언부에 추가:

```tsx
type PriceMap = Record<string, { price: number; changeRate: number }>;

export function NationalGrowthFund() {
  const { navigateTo } = useAppContext();
  const [etfs, setEtfs] = useState<NgfEtf[]>(loadEtfs);
  const [prices, setPrices] = useState<PriceMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tickers = etfs.map(e => e.ticker);
    if (tickers.length === 0) { setLoading(false); return; }
    fetchCurrentPricesWithChange(tickers)
      .then(setPrices)
      .finally(() => setLoading(false));
  }, [etfs.map(e => e.ticker).join(',')]);

  // ... 나머지 핸들러들 동일
```

- [ ] **Step 2: EtfCard에 price/changeRate 전달**

카드 렌더링 부분을 아래로 교체:

```tsx
{etfs.map(etf => {
  const pd = prices[etf.ticker];
  return (
    <EtfCard
      key={etf.ticker}
      etf={etf}
      price={pd?.price ?? null}
      changeRate={pd?.changeRate ?? null}
      onDelete={handleDelete}
      onClick={handleCardClick}
    />
  );
})}
```

- [ ] **Step 3: 로딩 상태 표시**

그리드 위에 추가:

```tsx
{loading && (
  <div style={{ color: 'var(--text-tertiary)', marginBottom: '12px', fontSize: '13px' }}>
    가격 조회 중...
  </div>
)}
```

- [ ] **Step 4: 개발 서버에서 확인**

페이지 로드 시 "가격 조회 중..." 표시 후 각 카드에 현재가와 등락률이 표시되면 정상. 상승 종목은 빨간색, 하락 종목은 파란색이면 정상.

- [ ] **Step 5: 커밋**

```bash
git add src/components/NationalGrowthFund.tsx
git commit -m "feat: ETF 현재가·등락률 fetchPrices 연동"
```

---

## Task 5: ETF 추가 모달

**Files:**
- Modify: `src/components/NationalGrowthFund.tsx`

- [ ] **Step 1: 모달 state + 컴포넌트 추가**

`NationalGrowthFund` 함수에 state 추가:

```tsx
const [showAddModal, setShowAddModal] = useState(false);
```

"ETF 추가" 버튼 onClick을 `() => setShowAddModal(true)` 로 교체.

return 블록 마지막에 모달 추가:

```tsx
{showAddModal && (
  <AddEtfModal
    onAdd={(etf) => {
      const next = [...etfs, etf];
      setEtfs(next);
      saveEtfs(next);
      setShowAddModal(false);
    }}
    onClose={() => setShowAddModal(false)}
  />
)}
```

- [ ] **Step 2: AddEtfModal 컴포넌트 추가**

파일 하단에 추가:

```tsx
const SECTOR_OPTIONS = [
  { value: 'A', label: 'A · AI·반도체' },
  { value: 'B', label: 'B · 바이오' },
  { value: 'C', label: 'C · 콘텐츠' },
  { value: 'D', label: 'D · 방산·우주' },
  { value: 'E', label: 'E · 이차전지' },
  { value: 'F', label: 'F · 로봇' },
];

const SECTOR_LABELS: Record<string, string> = {
  A: 'AI·반도체', B: '바이오', C: '콘텐츠',
  D: '방산·우주', E: '이차전지', F: '로봇',
};

function AddEtfModal({ onAdd, onClose }: {
  onAdd: (etf: NgfEtf) => void;
  onClose: () => void;
}) {
  const [ticker, setTicker] = useState('');
  const [name, setName] = useState('');
  const [sector, setSector] = useState('A');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ticker.trim() || !name.trim()) return;
    onAdd({ ticker: ticker.trim(), name: name.trim(), sector, label: SECTOR_LABELS[sector] });
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '13px', color: 'var(--text-secondary)',
    display: 'block', marginBottom: '4px',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)',
          padding: '24px', width: '320px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>ETF 추가</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
            <MIcon name="close" size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>티커 (6자리)</label>
            <input
              style={inputStyle}
              value={ticker}
              onChange={e => setTicker(e.target.value)}
              placeholder="예: 455850"
              maxLength={6}
              required
            />
          </div>
          <div>
            <label style={labelStyle}>ETF 이름</label>
            <input
              style={inputStyle}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="예: SOL AI반도체소부장"
              required
            />
          </div>
          <div>
            <label style={labelStyle}>분야</label>
            <select style={inputStyle} value={sector} onChange={e => setSector(e.target.value)}>
              {SECTOR_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            style={{
              padding: '10px', background: 'var(--accent-blue)', color: 'var(--accent-blue-fg)',
              border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
              fontWeight: 600, fontSize: '14px',
            }}
          >
            추가
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 개발 서버에서 확인**

"ETF 추가" 버튼 클릭 → 모달 오픈. 티커·이름·분야 입력 후 추가 → 카드 그리드에 새 카드 추가됨. 페이지 새로고침 후 추가된 카드가 유지되면 정상.

- [ ] **Step 4: 커밋**

```bash
git add src/components/NationalGrowthFund.tsx
git commit -m "feat: ETF 추가 모달"
```

---

## Task 6: 뉴스 링크 섹션

**Files:**
- Modify: `src/components/NationalGrowthFund.tsx`

- [ ] **Step 1: 뉴스 링크 데이터 + 섹션 추가**

파일 상단 상수 영역에 추가:

```tsx
const NEWS_LINKS = [
  { label: '국민성장펀드 최신 뉴스',   query: '국민성장펀드' },
  { label: '국민참여형 펀드 가입',      query: '국민참여형 국민성장펀드' },
  { label: '반도체 소부장 동향',        query: '반도체 소부장 ETF' },
  { label: '바이오 기술특례 뉴스',      query: '바이오 기술특례 코스닥' },
  { label: '우주·방산 소형주',          query: '우주항공 UAM 주식' },
  { label: '로봇 부품 산업',            query: '로봇 부품 중소형주' },
];

function naverNewsUrl(query: string) {
  return `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(query)}`;
}
```

return 블록의 닫는 `</div>` 직전에 뉴스 섹션 추가:

```tsx
{/* 뉴스 링크 섹션 */}
<div style={{ marginTop: '32px' }}>
  <h3 style={{ color: 'var(--text-primary)', marginBottom: '12px', fontSize: '16px' }}>
    관련 뉴스
  </h3>
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    {NEWS_LINKS.map(link => (
      <a
        key={link.query}
        href={naverNewsUrl(link.query)}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 14px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-primary)',
          textDecoration: 'none',
          fontSize: '14px',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-primary)')}
      >
        <MIcon name="open_in_new" size={16} style={{ color: 'var(--text-tertiary)' }} />
        {link.label}
      </a>
    ))}
  </div>
</div>
```

- [ ] **Step 2: 개발 서버에서 확인**

뉴스 섹션 6개 링크 표시 확인. 링크 클릭 시 네이버 뉴스 검색 새 탭에서 열리면 정상.

- [ ] **Step 3: 커밋**

```bash
git add src/components/NationalGrowthFund.tsx
git commit -m "feat: 관련 뉴스 링크 섹션 추가"
```

---

## Task 7: 빌드 확인 + 최종 커밋

**Files:**
- 없음 (빌드 검증만)

- [ ] **Step 1: TypeScript 빌드 확인**

```bash
npm run build
```

Expected: 에러 없이 `dist/` 생성. 타입 에러 발생 시 수정.

- [ ] **Step 2: 전체 기능 최종 확인 체크리스트**

- [ ] 사이드바에 "국민성장펀드" 메뉴 표시
- [ ] 페이지 진입 시 6개 ETF 카드 표시
- [ ] 가격/등락률 로드 (5분 캐시)
- [ ] 상승=빨강, 하락=파랑 색상
- [ ] 카드 클릭 → ChartPage로 이동
- [ ] 삭제(✕) 클릭 → 카드 제거 + 새로고침 후 유지
- [ ] ETF 추가 버튼 → 모달 → 카드 추가 + 새로고침 후 유지
- [ ] 뉴스 링크 6개 → 새 탭 오픈
- [ ] 모바일(≤768px)에서 1열 그리드 확인

- [ ] **Step 3: 최종 커밋**

```bash
git add -A
git commit -m "feat: 국민성장펀드 ETF 대시보드 페이지 완성"
```
