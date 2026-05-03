import React, { useState, useEffect, createContext, useContext } from "react";
import { CoupleAccounts } from "./components/CoupleAccounts";
import { NewDashboard } from "./components/NewDashboard";
import { AssetChange } from "./components/AssetChange";
import { Rebalancing } from "./components/Rebalancing";
import { Holdings } from "./components/Holdings";
import { Dividend } from "./components/Dividend";
import { Contribution } from "./components/Contribution";
import { FinancialReview } from "./components/FinancialReview";
import { HouseholdBudget } from "./components/HouseholdBudget";
import { RebalancingGuide } from "./components/RebalancingGuide";
import { OptimalGuide } from "./components/OptimalGuide";
import { ChartPage } from "./components/ChartPage";
import { AccountReturn } from "./components/AccountReturn";
import { StockDailyRecord } from "./components/StockDailyRecord";
import { MonthlyStrategy } from "./components/MonthlyStrategy";
import { PasswordModal } from "./components/PasswordModal";
import { RightSidebar } from "./components/RightSidebar";
import { MarketIndices } from "./components/MarketIndices";
import { ExchangeRate } from "./components/ExchangeRate";
import { fetchAccounts, fetchOtherAssets, saveOtherAssets } from "./api";
import type { Account, OtherAsset } from "./types";
import { fetchCurrentPrices } from "./utils/fetchPrices";
import { loadSeedDataIfNeeded, loadSeedOtherAssets } from "./utils/seedData";
import { importHistoricalSnapshots } from "./utils/importSnapshots";
import { fetchGoldPricePerDon } from "./utils/fetchGoldPrice";
import "./styles/custom-scrollbar.css";
// lucide-react 아이콘은 Material Icons로 대체
import { MIcon } from "./components/MIcon";

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
  navigateTo: (page: string) => void;
  isMobile: boolean;
  isHappyMode: boolean;
}
export const AppContext = createContext<AppContextType>({
  accounts: [], setAccounts: () => {}, reloadAccounts: async () => {}, isAmountHidden: true,
  otherAssets: [], setOtherAssets: () => {},
  prices: {}, loadPrices: async () => {},
  navigateTo: () => {},
  isMobile: false,
  isHappyMode: false,
});
export const useAppContext = () => useContext(AppContext);

const MENU_ITEMS = [
  { id: "dashboard", label: "대시보드", materialIcon: "dashboard" },
  { id: "couple-accounts", label: "계좌종목등록", materialIcon: "group" },
  { id: "dividend", label: "배당", materialIcon: "paid" },
  { id: "rebalancing", label: "리밸런싱", materialIcon: "tune" },
  { id: "rebalancing-guide", label: "리밸런싱 가이드", materialIcon: "auto_fix_high" },
  { id: "optimal-guide", label: "최적 가이드", materialIcon: "stars" },
  { id: "chart", label: "차트", materialIcon: "candlestick_chart" },
  { id: "holdings", label: "보유종목", materialIcon: "list" },
  { id: "asset-change", label: "자산증감", materialIcon: "show_chart" },
  { id: "contribution", label: "납입", materialIcon: "savings" },
  { id: "account-return", label: "계좌수익률", materialIcon: "percent" },
  { id: "financial-review", label: "재정평가", materialIcon: "summarize" },
  { id: "household-budget", label: "가계부", materialIcon: "receipt_long" },
  { id: "stock-daily-record", label: "개별종목기록", materialIcon: "table_chart" },
  { id: "monthly-strategy", label: "2026년5월", materialIcon: "calendar_month" },
];

const FONT_SIZES = [
  { label: '작게', scale: 0.85 },
  { label: '보통', scale: 1.0 },
  { label: '크게', scale: 1.15 },
  { label: '매우 크게', scale: 1.3 },
];

export default function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [isAmountHidden, setIsAmountHidden] = useState(true);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [otherAssets, setOtherAssetsState] = useState<OtherAsset[]>([]);
  const [isHappyMode, setIsHappyMode] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [fontSizeIndex, setFontSizeIndex] = useState(() => {
    const saved = localStorage.getItem('fontSizeIndex');
    if (saved) return parseInt(saved, 10);
    return window.innerWidth < 768 ? 2 : 1; // 모바일 기본: 크게(1.15x)
  });

  const setOtherAssets = (assets: OtherAsset[]) => {
    const real = assets.filter(a => a.id !== '__happy_bonus__');
    setOtherAssetsState(real);
    saveOtherAssets(real);
  };

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    let shouldBeDark: boolean;
    if (saved === 'dark' || saved === 'light') {
      // 사용자가 수동으로 설정한 경우 그 값 사용
      shouldBeDark = saved === 'dark';
    } else {
      // 미설정 시 시간 기반 자동: 18시~06시는 다크, 나머지는 라이트
      const h = new Date().getHours();
      shouldBeDark = h >= 18 || h < 6;
    }
    setIsDarkMode(shouldBeDark);
    document.documentElement.classList.toggle('dark', shouldBeDark);
  }, []);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // 폰트 크기 적용 - zoom으로 전체 스케일링
  const fontScale = FONT_SIZES[fontSizeIndex]?.scale || 1.0;
  useEffect(() => {
    localStorage.setItem('fontSizeIndex', String(fontSizeIndex));
  }, [fontSizeIndex]);

  const cycleFontSize = () => {
    setFontSizeIndex(prev => (prev + 1) % FONT_SIZES.length);
  };

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
  // 2분마다 주가 자동 폴링 (장 시간: KST 09:00~15:35)
  useEffect(() => {
    const INTERVAL_MS = 2 * 60 * 1000;
    const timer = setInterval(() => {
      const now = new Date();
      const kstHour = (now.getUTCHours() + 9) % 24;
      const kstMin = now.getUTCMinutes();
      const kstTime = kstHour * 100 + kstMin;
      if (kstTime >= 900 && kstTime <= 1535) {
        loadPrices();
      }
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [accounts]);

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
      case "dividend": return <Dividend />;
      case "contribution": return <Contribution />;
      case "financial-review": return <FinancialReview />;
      case "household-budget": return <HouseholdBudget />;
      case "rebalancing-guide": return <RebalancingGuide />;
      case "optimal-guide": return <OptimalGuide />;
      case "chart": return <ChartPage />;
      case "account-return": return <AccountReturn />;
      case "stock-daily-record": return <StockDailyRecord />;
      case "monthly-strategy": return <MonthlyStrategy />;
    }
  };

  const HAPPY_BONUS: OtherAsset = { id: '__happy_bonus__', name: '오빠주식', owner: 'husband', amount: 1_124_565_712 };
  const effectiveOtherAssets = isHappyMode ? [...otherAssets, HAPPY_BONUS] : otherAssets;

  return (
    <AppContext.Provider value={{ accounts, setAccounts, reloadAccounts, isAmountHidden, otherAssets: effectiveOtherAssets, setOtherAssets, prices, loadPrices, navigateTo: setCurrentPage, isMobile, isHappyMode }}>
      <div style={{ display: 'flex', height: `${100 / fontScale}vh`, background: 'var(--bg-primary)', zoom: fontScale }}>
        {/* Mobile overlay */}
        {isSidebarOpen && (
          <div
            onClick={() => { setIsSidebarOpen(false); setIsLeftSidebarOpen(false); }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40,
            }}
          />
        )}

        {/* Sidebar */}
        <aside style={{
          ...(isMobile ? {
            position: 'fixed', top: 0, left: 0, zIndex: 50,
            width: isLeftSidebarOpen ? 220 : 0,
            height: '100vh',
            boxShadow: isLeftSidebarOpen ? '4px 0 24px rgba(0,0,0,0.4)' : 'none',
          } : {
            width: isLeftSidebarOpen ? 220 : 0,
            flexShrink: 0,
          }),
          overflowY: 'auto', overflowX: 'hidden',
          background: 'var(--bg-primary)',
          display: 'flex', flexDirection: 'column',
          transition: 'width 0.2s ease, box-shadow 0.2s ease',
        }}>
          {/* 로고 + 닫기 버튼 */}
          <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 20, paddingRight: 8 }}>
            <div
              onClick={() => setCurrentPage('dashboard')}
              style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--accent-blue)',
              }}>
                <MIcon name="diamond" size={16} style={{ color: 'var(--accent-blue-fg)' }} />
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Finote</span>
            </div>
            <button
              onClick={() => { setIsLeftSidebarOpen(false); setIsSidebarOpen(false); }}
              style={{
                padding: 6, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'transparent', color: 'var(--text-tertiary)', transition: 'background 0.15s',
                display: 'flex', alignItems: 'center',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <MIcon name="close" size={20} />
            </button>
          </div>

          {/* 메뉴 */}
          <nav style={{ padding: '8px 12px' }}>
            {MENU_ITEMS.map((item) => {
              const active = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setCurrentPage(item.id); setIsSidebarOpen(false); setIsLeftSidebarOpen(isMobile ? false : isLeftSidebarOpen); }}
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
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* 좌측: 헤더 + 콘텐츠 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* 헤더 좌측 */}
            <header style={{
              height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: isMobile ? '0 16px' : '0 24px', background: 'var(--bg-primary)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => {
                    const next = !isLeftSidebarOpen;
                    setIsLeftSidebarOpen(next);
                    if (isMobile) setIsSidebarOpen(next);
                  }}
                  style={{
                    padding: 6, borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: 'transparent', color: 'var(--text-secondary)', transition: 'background 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  title={isLeftSidebarOpen ? '메뉴 접기' : '메뉴 펼치기'}
                >
                  <MIcon name="menu" size={22} />
                </button>
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
                {!isMobile && (
                  <>
                    <ExchangeRate />
                  </>
                )}
                <button onClick={handleSync} style={{ padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--text-secondary)', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title="데이터 새로고침">
                  <MIcon name="sync" size={20} style={isSyncing ? { animation: 'spin 0.8s linear infinite' } : undefined} />
                </button>
                <button onClick={toggleAmountHidden} style={{ padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--text-secondary)', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title={isAmountHidden ? '금액 보기' : '금액 숨기기'}>
                  <MIcon name={isAmountHidden ? "visibility_off" : "visibility"} size={20} />
                </button>
                <button onClick={toggleTheme} style={{ padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--text-secondary)', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title={isDarkMode ? '라이트 모드' : '다크 모드'}>
                  <MIcon name={isDarkMode ? "light_mode" : "dark_mode"} size={20} />
                </button>
                {!isMobile && (
                  <button onClick={cycleFontSize} style={{ padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--text-secondary)', transition: 'background 0.15s', position: 'relative' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title={`글자 크기: ${FONT_SIZES[fontSizeIndex].label}`}>
                    <MIcon name="text_fields" size={20} />
                    <span style={{ position: 'absolute', bottom: 2, right: 2, fontSize: 8, fontWeight: 700, color: 'var(--text-tertiary)', lineHeight: 1 }}>
                      {fontSizeIndex === 0 ? 'S' : fontSizeIndex === 1 ? 'M' : fontSizeIndex === 2 ? 'L' : 'XL'}
                    </span>
                  </button>
                )}
              </div>
            </header>
            <main className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)' }}>
              <ErrorBoundary>
                {renderPage()}
              </ErrorBoundary>
            </main>
          </div>

        </div>

        {/* HAPPY 모드 버튼 — 좌측 하단 고정 */}
        <button
          onClick={() => setIsHappyMode(p => !p)}
          style={{
            position: 'fixed', bottom: 24, left: 24, zIndex: 999,
            width: 40, height: 40, borderRadius: 10, border: 'none', cursor: 'pointer',
            background: isHappyMode ? '#f59e0b' : 'var(--bg-secondary)',
            color: isHappyMode ? '#fff' : 'var(--text-tertiary)',
            boxShadow: isHappyMode ? '0 2px 12px rgba(245,158,11,0.4)' : '0 2px 8px rgba(0,0,0,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          title={isHappyMode ? 'HAPPY 모드 해제' : 'HAPPY 모드 (오빠주식 +1,124,565,712)'}
        >
          <MIcon name="celebration" size={20} />
        </button>

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
