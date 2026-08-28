import React, { useState, useEffect } from 'react';
import { User, SystemSettings, CustomerStatement } from '../types';
import {
  Phone,
  Store,
  MapPin,
  LogOut,
  ShieldCheck,
  Headphones,
  User as UserIcon,
  LogIn,
  Settings,
  Wallet,
  FileText,
  DollarSign,
  Share2,
  X,
} from 'lucide-react';
import { apiFetch } from '../utils/api';

interface SimpleMoreViewProps {
  user: User | null;
  settings: SystemSettings | null;
  isStoreOpen: boolean;
  onOpenLogin: () => void;
  onLogout: () => void;
  onNavigateToAdmin: () => void;
}

export const SimpleMoreView: React.FC<SimpleMoreViewProps> = ({
  user,
  settings,
  isStoreOpen,
  onOpenLogin,
  onLogout,
  onNavigateToAdmin,
}) => {
  const isAdmin = user?.role === 'admin';
  const [statement, setStatement] = useState<CustomerStatement | null>(null);
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [loadingDebt, setLoadingDebt] = useState(false);

  useEffect(() => {
    if (user && user.id) {
      setLoadingDebt(true);
      apiFetch(`/api/customers/${encodeURIComponent(user.id)}/statement`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setStatement(data);
        })
        .catch((err) => console.error(err))
        .finally(() => setLoadingDebt(false));
    }
  }, [user]);

  return (
    <div className="space-y-4 pb-24 text-right max-w-lg mx-auto" dir="rtl">
      {/* Header */}
      <div className="py-1">
        <h2 className="font-black text-slate-900 text-lg">المزيد من الخيارات</h2>
        <p className="text-xs text-slate-500">شركة الحليم للتجارة والتوزيع</p>
      </div>

      {/* Account Info or Login */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        {user ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-12 h-12 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-black text-lg">
                {user.fullName.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{user.fullName}</h3>
                <div className="text-xs text-slate-500 font-mono">{user.phone}</div>
                {user.storeName && (
                  <div className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                    <Store className="w-3 h-3" />
                    <span>{user.storeName}</span>
                  </div>
                )}
              </div>
            </div>

            {user.address && (
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{user.address}</span>
              </div>
            )}

            {/* Financial Account Balance Card for Customer */}
            {statement && statement.summary && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Wallet className="w-4 h-4 text-emerald-700" />
                    <span>رصيد الحساب والمديونية:</span>
                  </div>
                  <button
                    onClick={() => setShowStatementModal(true)}
                    className="text-[11px] text-emerald-800 font-bold hover:underline"
                  >
                    عرض كشف الحساب
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-center font-mono pt-1">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-sans block">إجمالي الفواتير</span>
                    <span className="font-bold text-slate-900">{(statement.summary?.totalInvoiced || 0).toLocaleString('ar-EG')} ج</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-sans block">المسدد</span>
                    <span className="font-bold text-emerald-800">{(statement.summary?.totalPaid || 0).toLocaleString('ar-EG')} ج</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-sans block">الصافي المتبقي</span>
                    <span className={`font-black ${(statement.summary?.totalDebt || 0) > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                      {(statement.summary?.totalDebt || 0).toLocaleString('ar-EG')} ج
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Logout button */}
            <button
              onClick={onLogout}
              className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        ) : (
          <div className="text-center py-4 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
              <UserIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">تسجيل الدخول للعملاء</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto mt-0.5">
                سجل دخولك لحفظ بياناتك وعرض سجل فواتيرك وحسابك المالي.
              </p>
            </div>
            <button
              onClick={onOpenLogin}
              className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <LogIn className="w-4 h-4" />
              <span>تسجيل الدخول الآن</span>
            </button>
          </div>
        )}
      </div>

      {/* Admin Panel Access Button if Admin */}
      {isAdmin && (
        <button
          onClick={onNavigateToAdmin}
          className="w-full p-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl shadow-xs transition-colors flex items-center justify-between font-bold text-xs"
        >
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <span>الدخول إلى لوحة إدارة الطلبات، التحصيل، والمنتجات</span>
          </div>
          <span>←</span>
        </button>
      )}

      {/* Sales Rep Support Contact */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-emerald-800 font-bold">المندوب المعتمد لمنطقتك</div>
            <div className="text-sm font-black text-emerald-950">
              {settings?.salesRepName || 'محمد فوزي'}
            </div>
            <div className="text-[11px] text-emerald-700">
              {settings?.managerName || 'إدارة الحاج فوزي عبد الحليم'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <a
            href={`tel:${settings?.phonePrimary || '01000000000'}`}
            className="py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl text-center flex items-center justify-center gap-1.5 transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>اتصال هاتفي</span>
          </a>

          <a
            href={`https://wa.me/2${settings?.phonePrimary || '01000000000'}`}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2.5 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs rounded-xl text-center flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>واتساب المندوب</span>
          </a>
        </div>
      </div>

      {/* Store status info */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-600 flex items-center justify-between">
        <span>مواعيد استقبال الطلبات:</span>
        <span
          className={`font-bold px-2 py-0.5 rounded-full ${
            isStoreOpen
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {isStoreOpen ? '🟢 متاح لاستقبال الطلبات' : '🔴 مغلق حالياً'}
        </span>
      </div>

      {/* Developer & Technical Support Branding */}
      <div className="text-center pt-3 pb-2 space-y-1 select-none">
        <p className="text-xs text-slate-500 font-medium">شركة الحليم للتجارة والتوزيع</p>
        <p className="text-[11px] text-slate-400 font-normal">
          Designed & Developed by Astra Systems | Technical Support: 01278910793
        </p>
      </div>

      {/* Statement Modal for Customer */}
      {showStatementModal && statement && statement.summary && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 text-right shadow-2xl text-slate-800 relative my-8 animate-fadeIn max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="font-black text-base text-slate-900">كشف حسابك المالي</h3>
                <p className="text-xs text-slate-500 font-medium">شركة الحليم للتجارة والتوزيع</p>
              </div>
              <button
                onClick={() => setShowStatementModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono mb-3">
              <div>
                <span className="text-[10px] text-slate-500 font-sans block">إجمالي الفواتير</span>
                <span className="font-bold text-slate-900">{(statement.summary?.totalInvoiced || 0).toLocaleString('ar-EG')} ج</span>
              </div>
              <div className="border-r border-l border-slate-200">
                <span className="text-[10px] text-slate-500 font-sans block">المسدد</span>
                <span className="font-bold text-emerald-800">{(statement.summary?.totalPaid || 0).toLocaleString('ar-EG')} ج</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-sans block">الصافي المتبقي</span>
                <span className={`font-black ${(statement.summary?.totalDebt || 0) > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {(statement.summary?.totalDebt || 0).toLocaleString('ar-EG')} ج
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 text-xs pr-1">
              <h4 className="font-bold text-slate-700 mb-1">تفاصيل الفواتير ({statement.orders?.length || 0})</h4>
              {(statement.orders || []).map((ord) => (
                <div key={ord.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-900 font-mono">{ord.orderNumber}</span>
                    <div className="text-[10px] text-slate-500 font-mono">{ord.createdAt}</div>
                  </div>
                  <div className="text-left font-mono">
                    <div className="font-bold text-slate-900">{(ord.grandTotal || 0).toLocaleString('ar-EG')} ج</div>
                    {(ord.remainingBalance || 0) > 0 ? (
                      <div className="text-[10px] text-red-700 font-bold">متبقي: {(ord.remainingBalance || 0).toLocaleString('ar-EG')} ج</div>
                    ) : (
                      <div className="text-[10px] text-emerald-700 font-bold">خالص الحساب ✅</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowStatementModal(false)}
              className="mt-3 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

