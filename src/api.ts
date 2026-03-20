import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './utils/supabase/info';
import type { Account, DailySnapshot, OtherAsset } from './types';

const SUPABASE_URL = `https://${projectId}.supabase.co`;
const TABLE = 'kv_store_cee564ea';

const supabase = createClient(SUPABASE_URL, publicAnonKey);

// localStorage keys (폴백용)
const STORAGE_KEY = 'asset_accounts';
const SNAPSHOT_KEY = 'asset_snapshots';
const OTHER_ASSETS_KEY = 'asset_others';

// ── KV 헬퍼 ──
async function kvGet<T>(key: string): Promise<T | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .upsert({ key, value });
  if (error) throw error;
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
    console.error('Supabase 계좌 조회 실패:', err);
  }
  const local = localStorage.getItem(STORAGE_KEY);
  return local ? JSON.parse(local) : [];
}

export async function saveAccounts(accounts: Account[]): Promise<void> {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  try {
    await kvSet('accounts', accounts);
  } catch (err) {
    console.error('Supabase 계좌 저장 실패:', err);
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
    console.error('Supabase 스냅샷 조회 실패:', err);
  }
  const local = localStorage.getItem(SNAPSHOT_KEY);
  return local ? (JSON.parse(local) as DailySnapshot[]).filter(s => s && s.date) : [];
}

export async function saveSnapshot(snapshot: DailySnapshot): Promise<void> {
  // Supabase에서 최신 데이터를 가져와서 업데이트 (localStorage 기준으로 덮어쓰기 방지)
  let existing: DailySnapshot[] = [];
  try {
    const remote = await kvGet<DailySnapshot[]>('snapshots');
    if (remote) existing = remote.filter(s => s && s.date);
  } catch {
    // Supabase 실패 시 로컬 폴백
    const raw = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || '[]') as DailySnapshot[];
    existing = raw.filter(s => s && s.date);
  }

  const idx = existing.findIndex(s => s.date === snapshot.date);
  if (idx >= 0) {
    // 이미 저장된 값보다 20% 이상 낮으면 잘못된 데이터로 판단하여 무시
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

  // 로컬 + Supabase 동기화
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(sorted));
  try {
    await kvSet('snapshots', sorted);
  } catch (err) {
    console.error('Supabase 스냅샷 저장 실패:', err);
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
    console.error('Supabase 기타자산 조회 실패:', err);
  }
  const local = localStorage.getItem(OTHER_ASSETS_KEY);
  return local ? JSON.parse(local) : [];
}

export async function saveOtherAssets(assets: OtherAsset[]): Promise<void> {
  localStorage.setItem(OTHER_ASSETS_KEY, JSON.stringify(assets));
  try {
    await kvSet('otherAssets', assets);
  } catch (err) {
    console.error('Supabase 기타자산 저장 실패:', err);
  }
}
