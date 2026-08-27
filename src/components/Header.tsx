import React, { useState, useRef, useEffect } from 'react';
import { User, SystemSettings } from '../types';
import { BrandLogo } from './BrandLogo';
import {
  ShoppingCart,
  ShieldCheck,
  User as UserIcon,
  Store,
  LogIn,
  Package,
  Wallet,
  RotateCcw,
  LogOut,
  ChevronDown,
  Bell,
} from 'lucide-react';

interface HeaderProps {
  user: User | null;
  settings: SystemSettings | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  cartCount: number;
  unpaidDebt?: number;
  unreadInfoCount?: number;
  onOpenCart: () => void;
  onOpenLogin: () => void;
  onOpenInformation?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  settings,
  activeTab,
  setActiveTab,
  cartCount,
  unpaidDebt = 0,
  unreadInfoCount = 0,
  onOpenCart,
  onOpenLogin,
  onOpenInformation,
  onLogout,
}) => {
  const isAdmin = user?.role === 'admin';
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="bg-emerald-900 text-white shadow-md sticky top-0 z-40 no-print select-none border-b border-emerald-800" dir="rtl">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
        {/* Brand Logo & Name */}
        <div
          onClick={() => setActiveTab(isAdmin && activeTab.startsWith('admin') ? 'admin-orders' : 'catalog')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <BrandLogo
            size="sm"
            variant="glass"
            className="group-hover:scale-105 transition-transform"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm sm:text-base font-black leading-none group-hover:text-amber-300 transition-colors">
                شركة الحليم
              </h1>
              <span className="bg-amber-400 text-slate-950 font-black text-[9px] px-1.5 py-0.2 rounded font-mono uppercase tracking-wider shadow-2xs">
                جملة B2B
              </span>
            </div>
            <p className="text-[10px] text-emerald-200 mt-0.5 leading-tight font-medium">
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

          {/* User Account / Menu Dropdown */}
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-1.5 bg-emerald-800/90 hover:bg-emerald-800 text-emerald-100 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border border-emerald-700/60 shadow-xs"
                title="قائمة الحساب"
              >
                <UserIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="max-w-[90px] sm:max-w-[130px] truncate text-[11px]">
                  مرحبًا، {user.fullName ? user.fullName.split(' ')[0] : user.storeName || 'العميل'}
                </span>
                <ChevronDown className={`w-3 h-3 text-emerald-300 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Account Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute left-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  {/* Greeting & Store Name Header */}
                  <div className="px-3.5 py-2 border-b border-slate-800">
                    <p className="text-xs font-black text-white truncate">
                      مرحبًا، {user.fullName}
                    </p>
                    {user.storeName && (
                      <p className="text-[10px] text-amber-400 font-bold truncate mt-0.5">
                        🏪 {user.storeName}
                      </p>
                    )}
                  </div>

                  {/* Navigation Links */}
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onOpenInformation?.();
                      }}
                      className="w-full text-right px-3.5 py-2 text-xs text-slate-200 hover:bg-emerald-800/40 hover:text-white flex items-center justify-between font-bold transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Bell className="w-3.5 h-3.5 text-amber-400" />
                        <span>🔔 المعلومات والتنبيهات</span>
                      </div>
                      {unreadInfoCount > 0 && (
                        <span className="bg-amber-400 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded-full font-mono">
                          {unreadInfoCount}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setActiveTab('account');
                      }}
                      className="w-full text-right px-3.5 py-2 text-xs text-slate-200 hover:bg-emerald-800/40 hover:text-white flex items-center gap-2 font-bold transition-colors"
                    >
                      <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
                      <span>👤 حسابي</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setActiveTab('orders');
                      }}
                      className="w-full text-right px-3.5 py-2 text-xs text-slate-200 hover:bg-emerald-800/40 hover:text-white flex items-center gap-2 font-bold transition-colors"
                    >
                      <Package className="w-3.5 h-3.5 text-emerald-400" />
                      <span>📦 طلباتي</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setActiveTab('account');
                      }}
                      className="w-full text-right px-3.5 py-2 text-xs text-slate-200 hover:bg-emerald-800/40 hover:text-white flex items-center gap-2 font-bold transition-colors"
                    >
                      <Wallet className="w-3.5 h-3.5 text-amber-400" />
                      <span>💰 حسابي ومديونيتي</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setActiveTab('orders');
                      }}
                      className="w-full text-right px-3.5 py-2 text-xs text-slate-200 hover:bg-emerald-800/40 hover:text-white flex items-center gap-2 font-bold transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                      <span>🔄 إعادة الطلب</span>
                    </button>
                  </div>

                  {/* Logout Button */}
                  {onLogout && (
                    <div className="pt-1 mt-1 border-t border-slate-800">
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          onLogout();
                        }}
                        className="w-full text-right px-3.5 py-2 text-xs text-red-400 hover:bg-red-950/40 hover:text-red-300 flex items-center gap-2 font-black transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>🚪 تسجيل الخروج</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-1 bg-white text-emerald-900 hover:bg-emerald-50 px-2.5 py-1.5 rounded-xl text-xs font-black transition-all shadow-xs"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>دخول</span>
            </button>
          )}

          {/* Notification Bell Icon in Header */}
          <button
            onClick={onOpenInformation}
            className="relative bg-emerald-800 hover:bg-emerald-700 border border-emerald-700 px-2.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1 transition-all active:scale-95 shadow-xs text-amber-300"
            title="المعلومات والتنبيهات"
          >
            <Bell className="w-4 h-4" />
            {unreadInfoCount > 0 && (
              <span className="bg-amber-400 text-slate-950 font-mono text-[10px] font-black min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center -mr-0.5 animate-pulse">
                {unreadInfoCount}
              </span>
            )}
          </button>

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
