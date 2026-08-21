import React from 'react';
import { User, SystemSettings } from '../types';
import {
  ShoppingCart,
  ShieldCheck,
  User as UserIcon,
  Store,
  Bell,
  LogIn,
  Layers,
} from 'lucide-react';

interface HeaderProps {
  user: User | null;
  settings: SystemSettings | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  cartCount: number;
  unpaidDebt?: number;
  onOpenCart: () => void;
  onOpenLogin: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  settings,
  activeTab,
  setActiveTab,
  cartCount,
  unpaidDebt = 0,
  onOpenCart,
  onOpenLogin,
}) => {
  const isAdmin = user?.role === 'admin';

  return (
    <header className="bg-emerald-900 text-white shadow-md sticky top-0 z-40 no-print select-none border-b border-emerald-800" dir="rtl">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
        {/* Brand Logo & Name */}
        <div
          onClick={() => setActiveTab(isAdmin && activeTab.startsWith('admin') ? 'admin-orders' : 'catalog')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-white text-emerald-900 flex items-center justify-center font-black text-lg shadow-xs">
            ح
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm sm:text-base font-black leading-none">
                شركة الحليم
              </h1>
              <span className="bg-amber-400 text-slate-950 font-black text-[9px] px-1.5 py-0.2 rounded font-mono uppercase tracking-wider">
                جملة B2B
              </span>
            </div>
            <p className="text-[10px] text-emerald-200 mt-0.5 leading-tight">
              للتجارة والتوزيع والتوريدات
            </p>
          </div>
        </div>

        {/* User Badges & Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Admin Switcher Pill */}
          {isAdmin && (
            <button
              onClick={() =>
                setActiveTab(activeTab.startsWith('admin') ? 'catalog' : 'admin-orders')
              }
              className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 shadow-xs ${
                activeTab.startsWith('admin')
                  ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                  : 'bg-emerald-800 hover:bg-emerald-700 text-white border border-emerald-700'
              }`}
              title="التبديل بين لوحة الإدارة وواجهة العميل"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {activeTab.startsWith('admin') ? 'واجهة العميل' : 'لوحة الإدارة'}
              </span>
              <span className="sm:hidden">
                {activeTab.startsWith('admin') ? 'عميل' : 'إدارة'}
              </span>
            </button>
          )}

          {/* Customer Debt Badge if logged in and has debt */}
          {!isAdmin && user && unpaidDebt > 0 && (
            <div
              onClick={() => setActiveTab('account')}
              className="bg-amber-500/20 border border-amber-400/40 text-amber-200 px-2 py-1 rounded-xl text-[10px] sm:text-xs font-black flex items-center gap-1 cursor-pointer hover:bg-amber-500/30 transition-colors"
              title="انقر لعرض كشف الحساب والمديونية"
            >
              <span className="hidden sm:inline">المديونية:</span>
              <span className="font-mono text-amber-300 font-bold">
                {unpaidDebt.toLocaleString('ar-EG')} ج
              </span>
            </div>
          )}

          {/* User Account / Login Button */}
          {user ? (
            <button
              onClick={() => setActiveTab('account')}
              className="flex items-center gap-1.5 bg-emerald-800/80 hover:bg-emerald-800 text-emerald-100 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors border border-emerald-700/60"
            >
              <UserIcon className="w-3.5 h-3.5 text-emerald-300" />
              <span className="max-w-[80px] sm:max-w-[110px] truncate text-[11px]">
                {user.storeName || user.fullName}
              </span>
            </button>
          ) : (
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-1 bg-white text-emerald-900 hover:bg-emerald-50 px-2.5 py-1.5 rounded-xl text-xs font-black transition-all shadow-xs"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>دخول</span>
            </button>
          )}

          {/* Cart Icon in Header */}
          <button
            onClick={onOpenCart}
            className="relative bg-emerald-800 hover:bg-emerald-700 border border-emerald-700 px-2.5 sm:px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1 transition-all active:scale-95 shadow-xs"
            title="عرض سلة الطلبات"
          >
            <ShoppingCart className="w-4 h-4 text-emerald-200" />
            {cartCount > 0 && (
              <span className="bg-amber-400 text-slate-950 font-mono text-[11px] font-black w-4 h-4 rounded-full flex items-center justify-center -mr-0.5">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
