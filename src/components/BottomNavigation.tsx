import React from 'react';
import { Home, Grid, ShoppingCart, ClipboardList, User as UserIcon } from 'lucide-react';

interface BottomNavigationProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  cartCount: number;
  unpaidDebt?: number;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onSelectTab,
  cartCount,
  unpaidDebt = 0,
}) => {
  const tabs = [
    {
      id: 'catalog',
      label: 'الرئيسية',
      icon: Home,
    },
    {
      id: 'categories',
      label: 'الأقسام',
      icon: Grid,
    },
    {
      id: 'cart',
      label: 'السلة',
      icon: ShoppingCart,
      badge: cartCount > 0 ? cartCount : null,
    },
    {
      id: 'orders',
      label: 'طلباتي',
      icon: ClipboardList,
    },
    {
      id: 'account',
      label: 'حسابي',
      icon: UserIcon,
      hasDebtDot: unpaidDebt > 0,
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-30 shadow-lg no-print select-none"
      dir="rtl"
    >
      <div className="max-w-md mx-auto grid grid-cols-5 h-15 px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center gap-1 relative transition-all duration-150 active:scale-95 ${
                isActive
                  ? 'text-emerald-800 font-black'
                  : 'text-slate-500 hover:text-slate-800 font-semibold'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'scale-110 stroke-[2.5]' : 'stroke-[1.75]'
                  }`}
                />

                {/* Badge for Cart count */}
                {tab.badge && (
                  <span className="absolute -top-1.5 -right-2 bg-emerald-600 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs font-mono">
                    {tab.badge}
                  </span>
                )}

                {/* Red alert dot if customer has outstanding debt */}
                {tab.hasDebtDot && (
                  <span
                    className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white"
                    title="يوجد رصيد مديونية مستحق"
                  />
                )}
              </div>

              <span className="text-[11px] leading-none tracking-tight">
                {tab.label}
              </span>

              {/* Active Tab Underline Indicator */}
              {isActive && (
                <span className="absolute bottom-1 w-4 h-0.5 bg-emerald-700 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
