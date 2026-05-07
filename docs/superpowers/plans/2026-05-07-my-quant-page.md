# 내 퀀트 (MyQuant) 페이지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "내 퀀트" 페이지를 신설하여 사용자가 자신의 포트폴리오를 입력하고 듀얼모멘텀 신호 기반으로 리밸런싱 시뮬레이션을 즉시 확인할 수 있게 한다.

**Architecture:** 신규 `MyQuant.tsx` 컴포넌트를 생성하고 `App.tsx`에 메뉴 + 렌더 케이스를 추가한다. 포트폴리오 데이터는 `localStorage`에 저장하고, 모멘텀 신호는 Worker KV `/kv/crash_signals`에서 fetch한다. 기존 3개 퀀트 페이지는 수정하지 않는다.

**Tech Stack:** React 18 + TypeScript, CSS 디자인 토큰 (`var(--bg-primary)` 등), Google Material Icons (`MIcon` 컴포넌트), Cloudflare Worker KV (`VITE_WORKER_URL`), localStorage

---

## 파일 구조

| 파일 | 역할 |
|------|------|
| `src/components/MyQuant.tsx` | 신규 생성 — 내 퀀트 페이지 전체 |
| `src/App.tsx` | 수정 — 메뉴 항목 추가, renderPage 케이스 추가, INDICATOR_IDS 추가 |

---

### Task 1: App.tsx — 메뉴 + 라우팅 추가

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: INDICATOR_IDS에 'my-quant' 추가**

`src/App.tsx` 84번째 줄:
```typescript
// Before:
const INDICATOR_IDS = ['macro-sector', 'deep-research', 'financial-scoring', 'quant-dashboard', 'quant-basics'] as const;

// After:
const INDICATOR_IDS = ['macro-sector', 'deep-research', 'financial-scoring', 'quant-dashboard', 'quant-basics', 'my-quant'] as const;
```

- [ ] **Step 2: 지표 섹션 하위 메뉴에 '내 퀀트' 추가**

`src/App.tsx` 359~366번째 줄의 지표 하위 메뉴 배열에 항목 추가:
```typescript
// quant-basics 항목 다음에 추가:
{ id: 'my-quant',        icon: 'account_balance_wallet', label: '내 퀀트' },
```

- [ ] **Step 3: renderPage에 케이스 추가**

`src/App.tsx` 235번째 줄 (quant-basics 케이스 다음):
```typescript
// Before:
      case "quant-basics": return <QuantBasics />;
      case "national-growth-fund": return <NationalGrowthFund />;

// After:
      case "quant-basics": return <QuantBasics />;
      case "my-quant": return <MyQuant />;
      case "national-growth-fund": return <NationalGrowthFund />;
```

- [ ] **Step 4: import 추가**

`src/App.tsx` 상단 import 블록에 추가 (QuantBasics import 다음 줄):
```typescript
import { MyQuant } from "./components/MyQuant";
```

- [ ] **Step 5: 빌드 확인 (MyQuant 없이 임시 확인)**

MyQuant.tsx를 아직 만들지 않았으므로 import는 잠시 주석 처리 후 확인:
```bash
cd C:/workspace/daily-log
npm run build 2>&1 | tail -5
```
Expected: MyQuant 관련 오류만 있음 (다른 오류 없음). 확인 후 주석 되돌리기.

---

### Task 2: MyQuant.tsx — 뼈대 + 타입 정의

**Files:**
- Create: `src/components/MyQuant.tsx`

- [ ] **Step 1: 파일 생성 — 타입 + 상태 + 기본 레이아웃**

```typescript
import { useEffect, useState } from "react";
import { MIcon } from "./MIcon";
import { useAppContext } from "../App";

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://asset-dashboard-api.jilliankim200.workers.dev';
const LS_KEY = 'myquant_portfolio';

type CrashItem = { ticker: string; name: string; cat: string; r3m: number | null; r6m: number | null };
type Signal = 'BUY' | 'HOLD' | 'CASH';

interface PortfolioItem {
  id: string;
  name: string;
  amount: number;
}

function genId() { return Math.random().toString(36).slice(2, 9); }

function loadPortfolio(): PortfolioItem[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PortfolioItem[];
  } catch { return []; }
}

function savePortfolio(items: PortfolioItem[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

export function MyQuant() {
  const { isMobile } = useAppContext();
  const [crashItems, setCrashItems] = useState<CrashItem[]>([]);
  const [crashLoading, setCrashLoading] = useState(true);
  const [crashUpdatedAt, setCrashUpdatedAt] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>(loadPortfolio);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`${WORKER_URL}/kv/crash_signals`)
      .then(r => r.json())
      .then((res: { data: CrashItem[]; updatedAt: string } | null) => {
        if (res?.data?.length) { setCrashItems(res.data); setCrashUpdatedAt(res.updatedAt); }
      })
      .catch(() => {})
      .finally(() => setCrashLoading(false));
  }, []);

  const pad = isMobile ? 16 : 32;

  return (
    <div style={{ padding: pad, maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>내 퀀트</h2>
      {/* 섹션은 다음 Task에서 추가 */}
    </div>
  );
}
```

- [ ] **Step 2: 빌드 확인**

```bash
cd C:/workspace/daily-log
npm run build 2>&1 | tail -10
```
Expected: `✓ built in` 메시지, 오류 없음.

- [ ] **Step 3: 커밋**

```bash
cd C:/workspace/daily-log
git add src/App.tsx src/components/MyQuant.tsx
git commit -m "feat: 내 퀀트 페이지 뼈대 + 라우팅 추가"
```

---

### Task 3: 신호 요약 카드

**Files:**
- Modify: `src/components/MyQuant.tsx`

- [ ] **Step 1: 신호 계산 헬퍼 함수 추가 (파일 상단 genId 위)**

```typescript
function getTopAsset(items: CrashItem[]): CrashItem | null {
  if (!items.length) return null;
  return [...items].sort((a, b) => (b.r3m ?? -999) - (a.r3m ?? -999))[0];
}

function calcSignal(item: CrashItem | null): Signal {
  if (!item) return 'CASH';
  const r3 = item.r3m ?? 0;
  const r6 = item.r6m ?? 0;
  if (r3 > 0 && r6 > 0) return 'BUY';
  if (r3 < 0) return 'CASH';
  return 'HOLD';
}

function nextRebalanceDate(): string {
  const now = new Date();
  const year = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const month = (now.getMonth() + 1) % 12; // 다음달 (0-indexed)
  // 다음달 첫 번째 월요일
  const d = new Date(year, month, 1);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

const SIGNAL_CONFIG: Record<Signal, { color: string; label: string; icon: string; desc: string }> = {
  BUY:  { color: '#22c55e', label: '매수', icon: 'trending_up',   desc: '3M·6M 모멘텀 모두 양호 — 전략 자산 100% 매수' },
  HOLD: { color: '#f59e0b', label: '관망', icon: 'pause_circle',  desc: '모멘텀 혼조 — 전략 자산 60% + 현금 40%' },
  CASH: { color: '#ef4444', label: '현금', icon: 'shield',        desc: '3M 모멘텀 음수 — 단기채권 또는 현금 대피' },
};
```

- [ ] **Step 2: SignalCard 컴포넌트 추가 (export MyQuant 위)**

```typescript
function SignalCard({ crashItems, crashLoading, crashUpdatedAt }: {
  crashItems: CrashItem[]; crashLoading: boolean; crashUpdatedAt: string | null;
}) {
  const top = getTopAsset(crashItems);
  const signal = calcSignal(top);
  const cfg = SIGNAL_CONFIG[signal];

  return (
    <div style={{
      background: 'var(--bg-secondary)', borderRadius: 16, padding: 24,
      border: '1px solid var(--border-primary)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <MIcon name="bolt" size={20} style={{ color: 'var(--accent-blue)' }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          이번 달 신호
        </span>
        {crashUpdatedAt && (
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
            {crashUpdatedAt} 기준
          </span>
        )}
      </div>

      {crashLoading ? (
        <div style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>신호 로딩 중…</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: cfg.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MIcon name={cfg.icon} size={26} style={{ color: cfg.color }} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: cfg.color }}>
                {top?.name ?? '—'} {cfg.label}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                {cfg.desc}
              </div>
            </div>
          </div>
          <div style={{
            fontSize: 13, color: 'var(--text-tertiary)',
            padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 8, display: 'inline-block',
          }}>
            다음 리밸런싱 예정: {nextRebalanceDate()}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: MyQuant return 안에 SignalCard 삽입**

```typescript
// h2 태그 다음에 추가:
<SignalCard crashItems={crashItems} crashLoading={crashLoading} crashUpdatedAt={crashUpdatedAt} />
```

- [ ] **Step 4: 빌드 확인**

```bash
cd C:/workspace/daily-log
npm run build 2>&1 | tail -5
```
Expected: 오류 없음.

- [ ] **Step 5: 커밋**

```bash
cd C:/workspace/daily-log
git add src/components/MyQuant.tsx
git commit -m "feat: 내 퀀트 — 이번 달 신호 요약 카드"
```

---

### Task 4: 포트폴리오 입력 테이블

**Files:**
- Modify: `src/components/MyQuant.tsx`

- [ ] **Step 1: PortfolioTable 컴포넌트 추가 (SignalCard 위)**

```typescript
function PortfolioTable({ portfolio, setPortfolio, onSave, saved }: {
  portfolio: PortfolioItem[];
  setPortfolio: (p: PortfolioItem[]) => void;
  onSave: () => void;
  saved: boolean;
}) {
  const total = portfolio.reduce((s, i) => s + (i.amount || 0), 0);

  const updateItem = (id: string, field: keyof PortfolioItem, value: string | number) => {
    setPortfolio(portfolio.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const addRow = () => {
    setPortfolio([...portfolio, { id: genId(), name: '', amount: 0 }]);
  };

  const removeRow = (id: string) => {
    setPortfolio(portfolio.filter(p => p.id !== id));
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
    borderRadius: 6, padding: '6px 10px', fontSize: 14,
    color: 'var(--text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 16, padding: 24, border: '1px solid var(--border-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <MIcon name="account_balance_wallet" size={20} style={{ color: 'var(--accent-blue)' }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          내 포트폴리오
        </span>
      </div>

      {/* 헤더 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 80px 36px', gap: 8, marginBottom: 8, padding: '0 4px' }}>
        {['ETF명', '금액 (원)', '비중', ''].map(h => (
          <span key={h} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>{h}</span>
        ))}
      </div>

      {/* 행 */}
      {portfolio.map(item => {
        const weight = total > 0 ? ((item.amount / total) * 100).toFixed(1) : '0.0';
        return (
          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 80px 36px', gap: 8, marginBottom: 6, alignItems: 'center' }}>
            <input
              style={inputStyle}
              placeholder="예: KODEX 반도체"
              value={item.name}
              onChange={e => updateItem(item.id, 'name', e.target.value)}
            />
            <input
              style={{ ...inputStyle, textAlign: 'right' }}
              type="number"
              min={0}
              value={item.amount || ''}
              placeholder="0"
              onChange={e => updateItem(item.id, 'amount', Number(e.target.value))}
            />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'right' }}>{weight}%</span>
            <button
              onClick={() => removeRow(item.id)}
              style={{
                width: 32, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer',
                background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <MIcon name="close" size={16} />
            </button>
          </div>
        );
      })}

      {/* 합계 */}
      {portfolio.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 160px 80px 36px', gap: 8,
          borderTop: '1px solid var(--border-primary)', paddingTop: 8, marginTop: 4,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>합계</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>
            {total.toLocaleString()}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>100%</span>
          <span />
        </div>
      )}

      {/* 액션 버튼 */}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button
          onClick={addRow}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            borderRadius: 8, border: '1px solid var(--border-primary)', cursor: 'pointer',
            background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
          }}
        >
          <MIcon name="add" size={16} /> ETF 추가
        </button>
        <button
          onClick={onSave}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            borderRadius: 8, border: 'none', cursor: 'pointer',
            background: saved ? 'var(--color-success, #22c55e)' : 'var(--accent-blue)', color: '#fff', fontSize: 13, fontWeight: 600,
          }}
        >
          <MIcon name={saved ? 'check' : 'save'} size={16} />
          {saved ? '저장됨' : '저장'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: MyQuant에 handleSave 함수 + PortfolioTable 삽입**

`MyQuant` 컴포넌트 내부에 `saved` 상태와 `handleSave` 추가, return 안에 PortfolioTable 삽입:

```typescript
// useState 선언 부분 (saved 이미 있으므로 handleSave만 추가):
const handleSave = () => {
  const valid = portfolio.filter(p => p.name.trim() && p.amount > 0);
  savePortfolio(valid);
  setPortfolio(valid);
  setSaved(true);
  setTimeout(() => setSaved(false), 2000);
};

// return 안, SignalCard 다음:
<PortfolioTable portfolio={portfolio} setPortfolio={setPortfolio} onSave={handleSave} saved={saved} />
```

- [ ] **Step 3: 빌드 확인**

```bash
cd C:/workspace/daily-log
npm run build 2>&1 | tail -5
```
Expected: 오류 없음.

- [ ] **Step 4: 커밋**

```bash
cd C:/workspace/daily-log
git add src/components/MyQuant.tsx
git commit -m "feat: 내 퀀트 — 포트폴리오 입력 테이블 + localStorage 저장"
```

---

### Task 5: 리밸런싱 시뮬레이터

**Files:**
- Modify: `src/components/MyQuant.tsx`

- [ ] **Step 1: 목표 비중 계산 + 시뮬레이션 헬퍼 추가 (파일 상단)**

```typescript
interface RebalanceRow {
  name: string;
  currentAmount: number;
  currentWeight: number;
  targetWeight: number;   // 0~1
  targetAmount: number;
  diff: number;           // 양수=매수, 음수=매도
}

function calcTargetWeights(signal: Signal, topAsset: CrashItem | null): { name: string; weight: number }[] {
  if (signal === 'CASH' || !topAsset) {
    return [{ name: '현금 (단기채권)', weight: 1 }];
  }
  if (signal === 'BUY') {
    return [{ name: topAsset.name, weight: 1 }];
  }
  // HOLD: 1위 자산 60% + 현금 40%
  return [
    { name: topAsset.name, weight: 0.6 },
    { name: '현금 (단기채권)', weight: 0.4 },
  ];
}

function calcRebalance(portfolio: PortfolioItem[], signal: Signal, top: CrashItem | null): RebalanceRow[] {
  const total = portfolio.reduce((s, i) => s + i.amount, 0);
  if (total === 0) return [];

  const targets = calcTargetWeights(signal, top);
  const rows: RebalanceRow[] = [];

  // 매도 행: 현재 보유 중인 자산
  for (const item of portfolio) {
    const targetEntry = targets.find(t => t.name === item.name || item.name.includes(t.name.split(' ')[0]));
    const targetWeight = targetEntry?.weight ?? 0;
    const targetAmount = total * targetWeight;
    const diff = targetAmount - item.amount;
    rows.push({
      name: item.name,
      currentAmount: item.amount,
      currentWeight: item.amount / total,
      targetWeight,
      targetAmount,
      diff,
    });
  }

  // 목표에만 있고 현재 보유 없는 자산 추가
  for (const t of targets) {
    const already = rows.find(r => r.name === t.name || r.name.includes(t.name.split(' ')[0]));
    if (!already) {
      rows.push({
        name: t.name,
        currentAmount: 0,
        currentWeight: 0,
        targetWeight: t.weight,
        targetAmount: total * t.weight,
        diff: total * t.weight,
      });
    }
  }

  return rows.filter(r => Math.abs(r.diff) > 100); // 100원 이하 무시
}
```

- [ ] **Step 2: RebalanceSimulator 컴포넌트 추가 (PortfolioTable 위)**

```typescript
function RebalanceSimulator({ portfolio, crashItems, crashLoading }: {
  portfolio: PortfolioItem[];
  crashItems: CrashItem[];
  crashLoading: boolean;
}) {
  const total = portfolio.reduce((s, i) => s + i.amount, 0);
  const top = getTopAsset(crashItems);
  const signal = calcSignal(top);
  const cfg = SIGNAL_CONFIG[signal];
  const rows = calcRebalance(portfolio, signal, top);
  const sells = rows.filter(r => r.diff < 0);
  const buys = rows.filter(r => r.diff > 0);
  const totalTrade = rows.reduce((s, r) => s + Math.abs(r.diff), 0) / 2;

  if (portfolio.length === 0 || total === 0) {
    return (
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: 16, padding: 24,
        border: '1px solid var(--border-primary)', textAlign: 'center',
      }}>
        <MIcon name="calculate" size={32} style={{ color: 'var(--text-tertiary)', display: 'block', margin: '0 auto 8px' }} />
        <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>
          포트폴리오를 입력하고 저장하면 리밸런싱 시뮬레이션이 표시됩니다.
        </div>
      </div>
    );
  }

  const rowStyle = (diff: number): React.CSSProperties => ({
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 12px', borderRadius: 8, marginBottom: 4,
    background: diff < 0 ? '#ef444414' : '#22c55e14',
  });

  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 16, padding: 24, border: '1px solid var(--border-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <MIcon name="calculate" size={20} style={{ color: 'var(--accent-blue)' }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          리밸런싱 시뮬레이터
        </span>
      </div>

      {crashLoading ? (
        <div style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>신호 로딩 중…</div>
      ) : (
        <>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 20, background: cfg.color + '22',
            color: cfg.color, fontSize: 13, fontWeight: 700, marginBottom: 16,
          }}>
            <MIcon name={cfg.icon} size={14} />
            목표: {top?.name ?? '현금'} {signal === 'HOLD' ? '60% + 현금 40%' : signal === 'BUY' ? '100%' : '100%'}
          </div>

          {sells.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 6, letterSpacing: '0.04em' }}>
                매도
              </div>
              {sells.map(r => (
                <div key={r.name} style={rowStyle(r.diff)}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{r.name}</span>
                  <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 700 }}>
                    {Math.abs(r.diff).toLocaleString()}원
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 6 }}>
                      ({(r.currentWeight * 100).toFixed(0)}% → {(r.targetWeight * 100).toFixed(0)}%)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {buys.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#22c55e', marginBottom: 6, letterSpacing: '0.04em' }}>
                매수
              </div>
              {buys.map(r => (
                <div key={r.name} style={rowStyle(r.diff)}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{r.name}</span>
                  <span style={{ fontSize: 13, color: '#22c55e', fontWeight: 700 }}>
                    +{r.diff.toLocaleString()}원
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 6 }}>
                      ({(r.currentWeight * 100).toFixed(0)}% → {(r.targetWeight * 100).toFixed(0)}%)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{
            borderTop: '1px solid var(--border-primary)', paddingTop: 12,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>총 거래 금액 (편도)</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
              {totalTrade.toLocaleString()}원
            </span>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: MyQuant return에 RebalanceSimulator 삽입**

```typescript
// PortfolioTable 다음에 추가:
<RebalanceSimulator portfolio={portfolio} crashItems={crashItems} crashLoading={crashLoading} />
```

- [ ] **Step 4: 빌드 확인**

```bash
cd C:/workspace/daily-log
npm run build 2>&1 | tail -5
```
Expected: 오류 없음.

- [ ] **Step 5: 커밋**

```bash
cd C:/workspace/daily-log
git add src/components/MyQuant.tsx
git commit -m "feat: 내 퀀트 — 리밸런싱 시뮬레이터"
```

---

### Task 6: 빈 상태 처리 + 폴리시 점검

**Files:**
- Modify: `src/components/MyQuant.tsx`

- [ ] **Step 1: crash_signals fetch 실패 시 재시도 버튼 추가**

`SignalCard` 컴포넌트에 `error` prop 추가:

```typescript
// SignalCard 인터페이스에 error 추가:
function SignalCard({ crashItems, crashLoading, crashUpdatedAt, onRetry }: {
  crashItems: CrashItem[]; crashLoading: boolean; crashUpdatedAt: string | null;
  onRetry: () => void;
}) {
  // ...기존 코드...

  // crashLoading 이후, !crashItems.length일 때 처리:
  if (!crashLoading && !crashItems.length) {
    return (
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 16, padding: 24, border: '1px solid var(--border-primary)' }}>
        <div style={{ color: '#ef4444', fontSize: 14, marginBottom: 12 }}>신호 로딩 실패</div>
        <button
          onClick={onRetry}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            borderRadius: 8, border: '1px solid var(--border-primary)', cursor: 'pointer',
            background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: 13,
          }}
        >
          <MIcon name="refresh" size={16} /> 다시 시도
        </button>
      </div>
    );
  }
  // ...나머지 기존 코드...
}
```

- [ ] **Step 2: MyQuant에 fetchCrash 함수 분리 + onRetry 연결**

```typescript
// useEffect 내 fetch 로직을 함수로 추출:
const fetchCrash = () => {
  setCrashLoading(true);
  fetch(`${WORKER_URL}/kv/crash_signals`)
    .then(r => r.json())
    .then((res: { data: CrashItem[]; updatedAt: string } | null) => {
      if (res?.data?.length) { setCrashItems(res.data); setCrashUpdatedAt(res.updatedAt); }
    })
    .catch(() => {})
    .finally(() => setCrashLoading(false));
};

useEffect(() => { fetchCrash(); }, []);

// SignalCard에 onRetry={fetchCrash} 전달
```

- [ ] **Step 3: 최종 빌드 + TypeScript 체크**

```bash
cd C:/workspace/daily-log
npx tsc --noEmit 2>&1 | tail -20
npm run build 2>&1 | tail -5
```
Expected: 타입 오류 없음, `✓ built in` 메시지.

- [ ] **Step 4: 최종 커밋**

```bash
cd C:/workspace/daily-log
git add src/components/MyQuant.tsx
git commit -m "feat: 내 퀀트 — 에러 핸들링 + fetch 재시도"
```
