import React from 'react';
import { User, SystemSettings, Order, Product } from '../types';
import {
  ClipboardList,
  Wallet,
  Package,
  Settings,
  Store,
  Power,
  LogOut,
  ChevronLeft,
  ShieldCheck,
  UserCheck,
  X,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

interface AdminSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: User | null;
  settings: SystemSettings | null;
  orders: Order[];
  products: Product[];
  onToggleOrdersOpen: () => void;
  onLogout: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeTab,
  setActiveTab,
  user,
  settings,
  orders,
  products,
  onToggleOrdersOpen,
  onLogout,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const pendingOrdersCount = orders.filter((o) => o.status === 'Pending').length;
  const isOrdersOpen = settings?.manualOrdersOpen ?? true;

  const navItems = [
    {
      id: 'admin-orders',
      label: 'دفتر الطلبات',
      icon: ClipboardList,
      badge: pendingOrdersCount > 0 ? `${pendingOrdersCount} جديد` : `${orders.length}`,
      badgeColor: pendingOrdersCount > 0 ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-700 text-slate-300',
    },
    {
      id: 'admin-debts',
      label: 'التحصيل والمديونيات',
      icon: Wallet,
      badge: 'الخزينة',
      badgeColor: 'bg-emerald-600 text-white font-bold',
    },
    {
      id: 'admin-products',
      label: 'إدارة المنتجات والأسعار',
      icon: Package,
      badge: `${products.length} صنف`,
      badgeColor: 'bg-slate-700 text-slate-300',
    },
    {
      id: 'admin-deals',
      label: 'إدارة العروض والخصومات',
      icon: Sparkles,
      badge: 'عروض 🔥',
      badgeColor: 'bg-red-500 text-white font-bold',
    },
    {
      id: 'admin-settings',
      label: 'إعدادات النظام والمتجر',
      icon: Settings,
      badge: null,
      badgeColor: '',
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-white border-l border-slate-800 select-none">
      {/* Top Header Profile & Brand */}
      <div className="p-4 border-b border-slate-800/80">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-lg shadow-sm">
              ح
            </div>
            <div>
              <h2 className="font-black text-sm text-white leading-tight">
                لوحة تحكم الإدارة
              </h2>
              <span className="text-[11px] text-slate-400">شركة الحليم للتجارة</span>
            </div>
          </div>

          {/* Close button for mobile drawer */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Admin / Rep User Badge */}
        <div className="bg-slate-800/90 rounded-xl p-2.5 flex items-center justify-between text-xs border border-slate-700/60">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-200 block text-xs">
                {user?.fullName || 'محمد فوزي'}
              </span>
              <span className="text-[10px] text-amber-400/90 font-medium">
                مدير النظام والمبيعات
              </span>
            </div>
          </div>
          <span className="text-[10px] bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 px-1.5 py-0.5 rounded font-mono font-bold">
            أدمن
          </span>
        </div>
      </div>

      {/* Main Navigation Menu */}
      <div className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        <div className="text-[10px] font-black uppercase text-slate-400 px-3 mb-2 tracking-wider">
          القائمة الرئيسية
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-amber-400 text-slate-950 shadow-md font-black translate-x-1'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Section Divider */}
        <div className="pt-4 pb-2">
          <div className="text-[10px] font-black uppercase text-slate-400 px-3 mb-2 tracking-wider">
            المتجر والتسليم
          </div>

          {/* Quick Store Open/Close Toggle */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-300">استقبال الطلبات:</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                  isOrdersOpen ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-red-950 text-red-300 border border-red-800'
                }`}
              >
                {isOrdersOpen ? '🟢 متاح الآن' : '🔴 مغلق'}
              </span>
            </div>

            <button
              onClick={onToggleOrdersOpen}
              className={`w-full py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                isOrdersOpen
                  ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30'
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{isOrdersOpen ? 'إيقاف استقبال الطلبات' : 'فتح استقبال الطلبات'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer Controls: Switch to Storefront & Logout */}
      <div className="p-3 border-t border-slate-800/80 space-y-2 bg-slate-950/40">
        <button
          onClick={() => {
            setActiveTab('catalog');
            if (onCloseMobile) onCloseMobile();
          }}
          className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center justify-between transition-colors border border-slate-700/50"
        >
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-emerald-400" />
            <span>معاينة متجر العملاء</span>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
        </button>

        <button
          onClick={onLogout}
          className="w-full py-2 px-3 hover:bg-red-500/10 text-red-400 hover:text-red-300 text-xs font-bold rounded-xl flex items-center gap-2 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar (On the Right in RTL) */}
      <aside className="hidden md:block w-64 lg:w-72 shrink-0 sticky top-0 h-screen z-30 shadow-lg">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop & Sidebar */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex" dir="rtl">
          {/* Backdrop */}
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-fadeIn"
          />

          {/* Drawer Panel */}
          <div className="relative w-4/5 max-w-xs h-full z-10 shadow-2xl animate-slideInRight">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
