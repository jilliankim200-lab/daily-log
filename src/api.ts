import type { Account, DailySnapshot, OtherAsset } from './types';

// Cloudflare Worker URL - 배포 후 실제 URL로 교체됨
const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://asset-dashboard-api.jilliankim200.workers.dev';

// localStorage keys (폴백용)
const STORAGE_KEY = 'asset_accounts';
const SNAPSHOT_KEY = 'asset_snapshots';
const OTHER_ASSETS_KEY = 'asset_others';

// ── KV 헬퍼 ──
async function kvGet<T>(key: string): Promise<T | null> {
  const res = await fetch(`${WORKER_URL}/kv/${key}`);
  if (!res.ok) throw new Error(`kvGet failed: ${res.status}`);
  const data = await res.json();
  return data ?? null;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const res = await fetch(`${WORKER_URL}/kv/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error(`kvSet failed: ${res.status}`);
}

// ── 계좌 데이터 ──
export async function fetchAccounts(): Promise<Account[]> {
  try {
    const accounts = await kvGet<Account[]>('accounts');
    if (accounts) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
      return accounts;
    }
  } catch (err) {
    console.error('Worker 계좌 조회 실패:', err);
  }
  const local = localStorage.getItem(STORAGE_KEY);
  return local ? JSON.parse(local) : [];
}

export async function saveAccounts(accounts: Account[]): Promise<void> {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  try {
    await kvSet('accounts', accounts);
  } catch (err) {
    console.error('Worker 계좌 저장 실패:', err);
  }
}

// ── 스냅샷 ──
export async function fetchSnapshots(): Promise<DailySnapshot[]> {
  try {
    const snapshots = await kvGet<DailySnapshot[]>('snapshots');
    if (snapshots) {
      const valid = snapshots.filter(s => s && s.date);
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(valid));
      return valid;
    }
  } catch (err) {
    console.error('Worker 스냅샷 조회 실패:', err);
  }
  const local = localStorage.getItem(SNAPSHOT_KEY);
  return local ? (JSON.parse(local) as DailySnapshot[]).filter(s => s && s.date) : [];
}

export async function saveSnapshot(snapshot: DailySnapshot): Promise<void> {
  let existing: DailySnapshot[] = [];
  try {
    const remote = await kvGet<DailySnapshot[]>('snapshots');
    if (remote) existing = remote.filter(s => s && s.date);
  } catch {
    const raw = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || '[]') as DailySnapshot[];
    existing = raw.filter(s => s && s.date);
  }

  const idx = existing.findIndex(s => s.date === snapshot.date);
  if (idx >= 0) {
    const existingTotal = existing[idx].totalAsset;
    if (existingTotal > 0 && snapshot.totalAsset < existingTotal * 0.8) {
      console.warn(`[스냅샷 보호] ${snapshot.date}: ${snapshot.totalAsset} < ${existingTotal} * 0.8 → 저장 차단`);
      return;
    }
    existing[idx] = snapshot;
  } else {
    existing.push(snapshot);
  }
  const sorted = existing.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 365);

  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(sorted));
  try {
    await kvSet('snapshots', sorted);
  } catch (err) {
    console.error('Worker 스냅샷 저장 실패:', err);
  }
}

// ── 기타 자산 ──
export async function fetchOtherAssets(): Promise<OtherAsset[]> {
  try {
    const assets = await kvGet<OtherAsset[]>('otherAssets');
    if (assets) {
      localStorage.setItem(OTHER_ASSETS_KEY, JSON.stringify(assets));
      return assets;
    }
  } catch (err) {
    console.error('Worker 기타자산 조회 실패:', err);
  }
  const local = localStorage.getItem(OTHER_ASSETS_KEY);
  return local ? JSON.parse(local) : [];
}

export async function saveOtherAssets(assets: OtherAsset[]): Promise<void> {
  localStorage.setItem(OTHER_ASSETS_KEY, JSON.stringify(assets));
  try {
    await kvSet('otherAssets', assets);
  } catch (err) {
    console.error('Worker 기타자산 저장 실패:', err);
  }
}

// ── 수동 스냅샷 트리거 ──
export async function triggerSnapshot(): Promise<void> {
  await fetch(`${WORKER_URL}/snapshot`, { method: 'POST' });
}
