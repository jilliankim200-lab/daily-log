const STORAGE_KEY = 'sell_config_v1';

export interface SellConfig {
  targetReturn: number;  // 수익 실현 트리거 (소수점. 0.20 = +20%)
  stopLoss: number;      // 손절 트리거 (음수 소수점. -0.10 = -10%)
}

export const DEFAULT_SELL_CONFIG: SellConfig = {
  targetReturn: 0.20,
  stopLoss: -0.10,
};

export function loadSellConfig(): SellConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SELL_CONFIG;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SELL_CONFIG, ...parsed };
  } catch {
    return DEFAULT_SELL_CONFIG;
  }
}

export function saveSellConfig(config: SellConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
