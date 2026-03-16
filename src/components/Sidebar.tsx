import { Home, User, TrendingUp, Target, Calculator, Sparkles, ChevronLeft, ChevronRight, Clock, ListChecks, Flame, HeartPulse, Building2, FileText, DollarSign, LogIn, LogOut, Star, Package, Globe } from "lucide-react";

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  lastUpdated?: string;
}

export function Sidebar({ currentPage, onNavigate, isCollapsed = false, onToggleCollapse, lastUpdated }: SidebarProps) {
  // Get current date in YYYYMMDD format
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const date = String(today.getDate()).padStart(2, '0');
    
    return `${year}${month}${date}`;
  };

  const menuItems = [
    { id: "couple-accounts", label: "부부 계좌", icon: User, gradient: "from-purple-500 to-pink-500" },
    { id: "dashboard", label: "대시보드", icon: Home, gradient: "from-blue-500 to-cyan-500" },
    { id: "asset-change", label: "자산증감", icon: TrendingUp, gradient: "from-pink-500 to-rose-500" },
    { id: "rebalancing-checklist", label: "리밸런싱", icon: ListChecks, gradient: "from-orange-500 to-amber-500" },
    { id: "overseas-purchase", label: "해외매수", icon: Globe, gradient: "from-blue-600 to-indigo-600" },
    { id: "entry-management", label: "진입관리", icon: LogIn, gradient: "from-violet-500 to-purple-500" },
    { id: "retirement-calculator", label: "은퇴계산기", icon: Calculator, gradient: "from-blue-500 to-indigo-600" },
    { id: "retirement-plan", label: "은퇴설계", icon: FileText, gradient: "from-teal-500 to-cyan-500" },
    { id: "cash-flow", label: "현금흐름", icon: DollarSign, gradient: "from-emerald-500 to-green-500" },
  ];

  return (
    <div className={`
      h-screen bg-white dark:bg-[#2a2d3e] border-r border-[--color-border] dark:border-[#1e2939] flex flex-col relative overflow-hidden transition-all duration-300
      ${isCollapsed ? 'w-[80px]' : 'w-[240px]'}
    `}>
      {/* Decorative gradient background */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 rounded-full blur-3xl opacity-30 -mr-32 -mt-32" />
      
      {/* Collapse/Expand Button - PC only */}
      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex absolute right-2 top-[30px] z-50 w-6 h-6 bg-white dark:bg-[#364153] border border-[--color-border] dark:border-[#1e2939] rounded-full items-center justify-center hover:bg-gray-50 dark:hover:bg-[#475569] transition-colors shadow-md"
          aria-label={isCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-[--color-text-secondary]" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-[--color-text-secondary]" />
          )}
        </button>
      )}
      
      {/* Logo Section */}
      <div className="relative h-[60px] flex items-center px-6 pt-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => onNavigate('dashboard')}>
        <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center w-full' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg flex-shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          {!isCollapsed && (
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {getTodayDate()}
              </h2>
              <p className="text-xs text-[--color-text-secondary]">Asset Dashboard</p>
            </div>
          )}
        </div>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 py-6 px-3 relative">
        <div className="flex flex-col gap-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`
                  group relative flex items-center gap-3 rounded-xl transition-all duration-300
                  ${isCollapsed ? 'justify-center px-2 py-3.5' : 'px-4 py-3.5'}
                  ${isActive 
                    ? 'bg-gray-50 dark:bg-[#364153]' 
                    : 'hover:bg-[--color-gray-50] dark:hover:bg-[#364153]/50'
                  }
                `}
                title={isCollapsed ? item.label : undefined}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[--color-text-body] dark:bg-[#818CF8] rounded-r-full" />
                )}
                
                {/* Icon */}
                <div className={`
                  w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300 flex-shrink-0
                  ${isActive 
                    ? 'bg-white dark:bg-[#475569] border border-[--color-border] dark:border-[#1e2939]' 
                    : 'bg-[--color-gray-100] dark:bg-[#364153] group-hover:bg-[--color-gray-200] dark:group-hover:bg-[#475569]'
                  }
                `}>
                  <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-[--color-primary] dark:text-[#818CF8]' : 'text-[--color-text-secondary] group-hover:text-[--color-text-body]'}`} />
                </div>
                
                {/* Label */}
                {!isCollapsed && (
                  <span className={`
                    text-[15px] font-medium transition-colors
                    ${isActive 
                      ? 'text-[--color-text-body] dark:text-[#d1d5dc]' 
                      : 'text-[--color-text-secondary] dark:text-[#99a1af] group-hover:text-[--color-text-body] dark:group-hover:text-[#d1d5dc]'
                    }
                  `}>
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Bottom decoration */}
      {!isCollapsed && (
        <>
          {/* Last Updated Info */}
          {lastUpdated && (
            <div className="relative p-3 mx-3 mb-2 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-100 dark:border-purple-800/30">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white dark:bg-[#364153] rounded-lg shadow-sm">
                  <Clock className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mb-0.5">마지막 업데이트</p>
                  <p className="text-[11px] text-gray-600 dark:text-gray-400 truncate">
                    {new Date(lastUpdated).toLocaleString('ko-KR', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="relative p-4 m-3 rounded-xl bg-white dark:bg-[#364153] border border-[--color-border] dark:border-[#1e2939] overflow-hidden">
            <div className="relative">
              <p className="text-[--color-text-body] dark:text-[#d1d5dc] text-sm font-semibold mb-1">jiyoon youtube</p>
              <p className="text-[--color-text-secondary] dark:text-[#99a1af] text-xs">Upgrade for advanced analytics</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}