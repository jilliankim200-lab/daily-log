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
