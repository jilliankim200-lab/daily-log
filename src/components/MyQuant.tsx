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
  const month = (now.getMonth() + 1) % 12;
  const d = new Date(year, month, 1);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

const SIGNAL_CONFIG: Record<Signal, { color: string; label: string; icon: string; desc: string }> = {
  BUY:  { color: '#22c55e', label: '매수', icon: 'trending_up',   desc: '3M·6M 모멘텀 모두 양호 — 전략 자산 100% 매수' },
  HOLD: { color: '#f59e0b', label: '관망', icon: 'pause_circle',  desc: '모멘텀 혼조 — 전략 자산 60% + 현금 40%' },
  CASH: { color: '#ef4444', label: '현금', icon: 'shield',        desc: '3M 모멘텀 음수 — 단기채권 또는 현금 대피' },
};

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

  const inputStyle = {
    background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
    borderRadius: 6, padding: '6px 10px', fontSize: 14,
    color: 'var(--text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box' as const,
  };

  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 16, padding: 24, border: '1px solid var(--border-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <MIcon name="account_balance_wallet" size={20} style={{ color: 'var(--accent-blue)' }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          내 포트폴리오
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 80px 36px', gap: 8, marginBottom: 8, padding: '0 4px' }}>
        {['ETF명', '금액 (원)', '비중', ''].map(h => (
          <span key={h} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>{h}</span>
        ))}
      </div>

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
            background: saved ? '#22c55e' : 'var(--accent-blue)', color: '#fff', fontSize: 13, fontWeight: 600,
          }}
        >
          <MIcon name={saved ? 'check' : 'save'} size={16} />
          {saved ? '저장됨' : '저장'}
        </button>
      </div>
    </div>
  );
}

function SignalCard({ crashItems, crashLoading, crashUpdatedAt, onRetry }: {
  crashItems: CrashItem[]; crashLoading: boolean; crashUpdatedAt: string | null;
  onRetry: () => void;
}) {
  const top = getTopAsset(crashItems);
  const signal = calcSignal(top);
  const cfg = SIGNAL_CONFIG[signal];

  if (!crashLoading && !crashItems.length) {
    return (
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: 16, padding: 24,
        border: '1px solid var(--border-primary)',
      }}>
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

export function MyQuant() {
  const { isMobile } = useAppContext();
  const [crashItems, setCrashItems] = useState<CrashItem[]>([]);
  const [crashLoading, setCrashLoading] = useState(true);
  const [crashUpdatedAt, setCrashUpdatedAt] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>(loadPortfolio);
  const [saved, setSaved] = useState(false);

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

  const handleSave = () => {
    const valid = portfolio.filter(p => p.name.trim() && p.amount > 0);
    savePortfolio(valid);
    setPortfolio(valid);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const pad = isMobile ? 16 : 32;

  return (
    <div style={{ padding: pad, maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>내 퀀트</h2>
      <SignalCard crashItems={crashItems} crashLoading={crashLoading} crashUpdatedAt={crashUpdatedAt} onRetry={fetchCrash} />
      <PortfolioTable portfolio={portfolio} setPortfolio={setPortfolio} onSave={handleSave} saved={saved} />
    </div>
  );
}
