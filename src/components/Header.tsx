import { Menu, RefreshCw, Eye, EyeOff, Sun, Moon } from "lucide-react";
import { Button } from "./ui/button";
import { ExchangeRate } from "./ExchangeRate";
import { MarketIndices } from "./MarketIndices";
import { useState, useEffect } from "react";

interface HeaderProps {
  userName?: string;
  onMenuClick?: () => void;
  lastUpdated?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  isAmountHidden?: boolean;
  onToggleAmountHidden?: () => void;
  onToggleTheme?: () => void;
}

export function Header({ userName = "사용자", onMenuClick, lastUpdated, onRefresh, isRefreshing = false, isAmountHidden = false, onToggleAmountHidden, onToggleTheme }: HeaderProps) {
  const [isDarkMode, setIsDarkMode] = useState(true); // 다크모드를 기본값으로 설정
  
  // Check dark mode on mount and when theme changes
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    checkDarkMode();
    
    // Listen for theme changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['class'] 
    });
    
    return () => observer.disconnect();
  }, []);
  
  return (
    <header className="h-[60px] bg-[#dbe1f5] dark:bg-[#1E293B] flex items-center justify-between px-4 lg:px-8 sticky top-0 z-10 transition-colors duration-200">
      {/* Left side - Mobile Menu */}
      <div className="flex items-center gap-3 lg:gap-4">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="lg:hidden hover:bg-white/50 dark:hover:bg-white/10 transition-colors"
        >
          <Menu className="w-5 h-5 text-[--color-text-body]" />
        </Button>
      </div>

      {/* Right side - User info and actions */}
      <div className="flex items-center gap-1.5 lg:gap-3">
        {/* Exchange Rate - Hidden on small mobile */}
        <div className="hidden sm:block">
          <ExchangeRate />
        </div>

        {/* Market Indices - Hidden on small mobile */}
        <div className="hidden sm:block">
          <MarketIndices />
        </div>

        {/* Update Button */}
        {onRefresh && (
          <Button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="relative bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 hover:shadow-xl hover:scale-110 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg px-[8px] py-[4px] rounded-[4px] border border-purple-600"
            style={{ fontSize: '13px', fontWeight: '600' }}
          >
            <div className="absolute inset-0 bg-white/20 rounded-[4px] blur-sm"></div>
            <RefreshCw className={`w-[16px] h-[16px] sm:mr-[4px] relative z-10 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline relative z-10">업데이트</span>
          </Button>
        )}

        {/* Theme Toggle Button */}
        {onToggleTheme && (
          <Button
            onClick={onToggleTheme}
            variant="ghost"
            size="icon"
            className="hover:bg-white/50 dark:hover:bg-white/10 transition-colors px-[8px] py-[4px] rounded-[4px] border border-white/20 dark:border-white/10"
          >
            {isDarkMode ? (
              <Sun className="w-[16px] h-[16px] text-[--color-text-body]" />
            ) : (
              <Moon className="w-[16px] h-[16px] text-[--color-text-body]" />
            )}
          </Button>
        )}

        {/* Toggle Amount Visibility */}
        {onToggleAmountHidden && (
          <Button
            onClick={onToggleAmountHidden}
            variant="ghost"
            size="icon"
            className="hover:bg-white/50 dark:hover:bg-white/10 transition-colors px-[8px] py-[4px] rounded-[4px] border border-white/20 dark:border-white/10"
          >
            {isAmountHidden ? (
              <EyeOff className="w-[16px] h-[16px] text-[--color-text-body]" />
            ) : (
              <Eye className="w-[16px] h-[16px] text-[--color-text-body]" />
            )}
          </Button>
        )}
      </div>
    </header>
  );
}