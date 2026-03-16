import React, { useState, useEffect, createContext, useContext } from "react";
import { CoupleAccounts } from "./components/CoupleAccounts";
import { NewDashboard } from "./components/NewDashboard";
import { AssetChange } from "./components/AssetChange";
import { Rebalancing } from "./components/Rebalancing";
import { CashFlow } from "./components/CashFlow";
import { Holdings } from "./components/Holdings";
import { Dividend } from "./components/Dividend";
import { PasswordModal } from "./components/PasswordModal";
import { RightSidebar } from "./components/RightSidebar";
import { fetchAccounts, fetchOtherAssets, saveOtherAssets } from "./api";
import type { Account, OtherAsset } from "./types";
import { fetchCurrentPrices } from "./utils/fetchPrices";
import { loadSeedDataIfNeeded, loadSeedOtherAssets } from "./utils/seedData";
import { importHistoricalSnapshots } from "./utils/importSnapshots";
import { fetchGoldPricePerDon } from "./utils/fetchGoldPrice";
import "./styles/custom-scrollbar.css";
// lucide-react 아이콘은 Material Icons로 대체

// Material Icons 헬퍼
function MIcon({ name, size = 20, style }: { name: string; size?: number; style?: React.CSSProperties }) {
  return (
    <span className="material-symbols-rounded" style={{
      fontSize: size, lineHeight: 1, ...style,
    }}>{name}</span>
  );
}

// Context
interface AppContextType {
  accounts: Account[];
  setAccounts: (a: Account[]) => void;
  reloadAccounts: () => Promise<void>;
  isAmountHidden: boolean;
  otherAssets: OtherAsset[];
  setOtherAssets: (a: OtherAsset[]) => void;
  prices: Record<string, number>;
  loadPrices: () => Promise<void>;
}
export const AppContext = createContext<AppContextType>({
  accounts: [], setAccounts: () => {}, reloadAccounts: async () => {}, isAmountHidden: true,
  otherAssets: [], setOtherAssets: () => {},
  prices: {}, loadPrices: async () => {},
});
export const useAppContext = () => useContext(AppContext);

const MENU_ITEMS = [
  { id: "dashboard", label: "대시보드", materialIcon: "dashboard" },
  { id: "couple-accounts", label: "부부 계좌", materialIcon: "group" },
  { id: "holdings", label: "보유종목", materialIcon: "bar_chart" },
  { id: "asset-change", label: "자산증감", materialIcon: "show_chart" },
  { id: "rebalancing", label: "리밸런싱", materialIcon: "tune" },
  { id: "cashflow", label: "현금흐름", materialIcon: "account_balance_wallet" },
  { id: "dividend", label: "배당", materialIcon: "paid" },
];

export default function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAmountHidden, setIsAmountHidden] = useState(true);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [otherAssets, setOtherAssetsState] = useState<OtherAsset[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [prices, setPrices] = useState<Record<string, number>>({});

  const setOtherAssets = (assets: OtherAsset[]) => {
    setOtherAssetsState(assets);
    saveOtherAssets(assets);
  };

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const shouldBeDark = saved === 'dark';
    setIsDarkMode(shouldBeDark);
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      if (!saved) localStorage.setItem('theme', 'light');
    }
  }, []);

  const loadPrices = async (accs?: Account[]) => {
    const tickers = (accs || accounts).flatMap((a: Account) => a.holdings.map((h: any) => h.ticker)).filter(Boolean);
    if (tickers.length === 0) return;
    try {
      const p = await fetchCurrentPrices(tickers);
      setPrices(p);
    } catch (err) { console.error(err); }
  };

  const reloadAccounts = async () => {
    try {
      const data = await fetchAccounts();
      setAccounts(data);
      await loadPrices(data);
    } catch (err) { console.error(err); }
  };
  useEffect(() => {
    importHistoricalSnapshots();
    loadSeedDataIfNeeded();
    loadSeedOtherAssets();
    reloadAccounts();
    fetchOtherAssets().then(async (assets) => {
      const filtered = assets.filter(a => a.name !== '연금이외');
      // 금 시세 반영 (15돈)
      const goldPrice = await fetchGoldPricePerDon();
      const GOLD_DON = 15;
      const updated = filtered.map(a => {
        if (a.name === '금' && goldPrice) {
          return { ...a, amount: goldPrice * GOLD_DON };
        }
        return a;
      });
      const changed = filtered.length !== assets.length || (goldPrice && updated.some((a, i) => a.amount !== filtered[i].amount));
      if (changed) {
        saveOtherAssets(updated);
      }
      setOtherAssetsState(updated);
    });
  }, []);

  const toggleTheme = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await reloadAccounts();
      setToastMessage('데이터가 새로고침되었습니다');
      setTimeout(() => setToastMessage(null), 2000);
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleAmountHidden = () => {
    if (isAmountHidden) setIsPasswordModalOpen(true);
    else setIsAmountHidden(true);
  };

  const renderPage = () => {
    switch (currentPage) {
      case "couple-accounts": return <CoupleAccounts />;
      case "holdings": return <Holdings />;
      case "dashboard": return <NewDashboard />;
      case "asset-change": return <AssetChange />;
      case "rebalancing": return <Rebalancing />;
      case "cashflow": return <CashFlow isAmountHidden={isAmountHidden} />;
      case "dividend": return <Dividend />;
    }
  };

  return (
    <AppContext.Provider value={{ accounts, setAccounts, reloadAccounts, isAmountHidden, otherAssets, setOtherAssets, prices, loadPrices }}>
      <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-primary)' }}>
        {/* Mobile overlay */}
        {isSidebarOpen && (
          <div
            onClick={() => setIsSidebarOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40,
            }}
          />
        )}

        {/* Sidebar */}
        <aside style={{
          width: 220, flexShrink: 0, height: '100vh', overflowY: 'auto',
          background: 'var(--bg-primary)', borderRight: '1px solid var(--border-primary)',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* 로고 */}
          <div
            onClick={() => setCurrentPage('dashboard')}
            style={{ height: 56, display: 'flex', alignItems: 'center', paddingLeft: 20, cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--accent-blue)',
              }}>
                <MIcon name="auto_awesome" size={16} style={{ color: '#fff' }} />
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>자산관리</span>
            </div>
          </div>

          {/* 메뉴 */}
          <nav style={{ padding: '8px 12px' }}>
            {MENU_ITEMS.map((item) => {
              const active = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setCurrentPage(item.id); setIsSidebarOpen(false); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    marginBottom: 2, transition: 'background 0.15s',
                    background: active ? 'var(--bg-tertiary)' : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: active ? 600 : 500, fontSize: 14,
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = active ? 'var(--bg-tertiary)' : 'transparent'; }}
                >
                  <MIcon name={item.materialIcon} size={20} style={{ opacity: active ? 1 : 0.6 }} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* 메인 영역 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* 헤더 */}
          <header style={{
            height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 24px', background: 'var(--bg-primary)',
          }}>
            {/* 인사말 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--bg-tertiary)',
              }}>
                <MIcon name={(() => { const h = new Date().getHours(); if (h >= 5 && h < 12) return 'coffee'; if (h >= 12 && h < 18) return 'wb_sunny'; return 'dark_mode'; })()} size={16} style={{ color: 'var(--text-primary)' }} />
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                {(() => { const h = new Date().getHours(); if (h >= 5 && h < 12) return 'Good Morning'; if (h >= 12 && h < 18) return 'Good Afternoon'; return 'Good Evening'; })()}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={handleSync}
                style={{
                  padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'transparent', color: 'var(--text-secondary)', transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                title="데이터 새로고침"
              >
                <MIcon name="sync" size={20} style={isSyncing ? { animation: 'spin 0.8s linear infinite' } : undefined} />
              </button>
              <button
                onClick={toggleAmountHidden}
                style={{
                  padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'transparent', color: 'var(--text-secondary)', transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                title={isAmountHidden ? '금액 보기' : '금액 숨기기'}
              >
                <MIcon name={isAmountHidden ? "visibility_off" : "visibility"} size={20} />
              </button>
              <button
                onClick={toggleTheme}
                style={{
                  padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'transparent', color: 'var(--text-secondary)', transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                title={isDarkMode ? '라이트 모드' : '다크 모드'}
              >
                <MIcon name={isDarkMode ? "light_mode" : "dark_mode"} size={20} />
              </button>
              <button
                onClick={() => setIsRightSidebarOpen(prev => !prev)}
                style={{
                  padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'transparent', color: 'var(--text-secondary)', transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                title={isRightSidebarOpen ? '보유종목 숨기기' : '보유종목 보기'}
              >
                <MIcon name={isRightSidebarOpen ? "right_panel_open" : "right_panel_close"} size={20} />
              </button>
            </div>
          </header>

          {/* 페이지 + 우측 사이드바 */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <main className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)' }}>
              <ErrorBoundary>
                {renderPage()}
              </ErrorBoundary>
            </main>
            {isRightSidebarOpen && <RightSidebar />}
          </div>
        </div>

        <PasswordModal
          open={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
          onSuccess={() => setIsAmountHidden(false)}
        />

        {/* Toast */}
        {toastMessage && (
          <div style={{
            position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--bg-elevated)', color: 'var(--text-primary)',
            padding: '12px 24px', borderRadius: 12, fontSize: 14, fontWeight: 500,
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)', border: '1px solid var(--border-primary)',
            zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8,
            animation: 'toast-in 0.25s ease',
          }}>
            <MIcon name="check_circle" size={18} style={{ color: 'var(--color-success)' }} />
            {toastMessage}
          </div>
        )}

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(-360deg); }
          }
          @keyframes toast-in {
            from { opacity: 0; transform: translateX(-50%) translateY(16px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
          }
        `}</style>
      </div>
    </AppContext.Provider>
  );
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: '#f44', fontFamily: 'monospace' }}>
          <h2>렌더링 오류 발생</h2>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 16, fontSize: 14, color: '#fff', background: '#333', padding: 16, borderRadius: 8 }}>
            {this.state.error.message}{'\n'}{this.state.error.stack}
          </pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 16, padding: '8px 16px', cursor: 'pointer' }}>
            다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
