import React, { useState } from 'react';
import { User } from '../types';
import { Lock, Phone, UserCheck, ShieldCheck, Store, KeyRound, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { apiFetch } from '../utils/api';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [authMode, setAuthMode] = useState<'customer' | 'admin'>('customer');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();
      if (data.success && data.user) {
        onLoginSuccess(data.user);
        onClose();
      } else {
        setError(data.message || 'بيانات الدخول غير صحيحة');
      }
    } catch (err) {
      setError('تعذر الاتصال بالخادم، يرجى المحاولة مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickCustomer = (phone: string, pass: string) => {
    setUsername(phone);
    setPassword(pass);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn" dir="rtl">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 text-right shadow-2xl text-slate-800 relative">
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-slate-400 hover:text-slate-700 w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors font-bold text-sm"
        >
          ✕
        </button>

        {/* Brand Header */}
        <div className="text-center mb-5">
          <div className="w-12 h-12 bg-emerald-800 rounded-2xl flex items-center justify-center text-white text-xl font-black mx-auto mb-2 shadow-sm">
            ح
          </div>
          <h2 className="text-base font-black text-slate-900">تسجيل الدخول — شركة الحليم</h2>
          <p className="text-[11px] text-slate-500 mt-0.5 font-bold">
            نظام التجارة والتوزيع والتوريدات بالجملة
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl mb-4 text-xs font-black">
          <button
            type="button"
            onClick={() => {
              setAuthMode('customer');
              setError('');
            }}
            className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              authMode === 'customer'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>حساب تاجر / عميل</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('admin');
              setError('');
            }}
            className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              authMode === 'admin'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>بوابة الإدارة</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl p-3 flex items-center gap-2 font-bold animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-black text-slate-700 mb-1">
              {authMode === 'admin' ? 'اسم مستخدم الإدارة' : 'رقم الهاتف أو اسم المستخدم'}
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={authMode === 'admin' ? 'أدخل اسم مستخدم الإدارة...' : 'أدخل رقم هاتف المحل (مثال: 01011112222)'}
                className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-700 focus:bg-white rounded-2xl px-3.5 py-2.5 pr-10 text-xs text-slate-900 focus:outline-none transition-all font-bold"
              />
              {authMode === 'admin' ? (
                <ShieldCheck className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              ) : (
                <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-700 mb-1">كلمة المرور</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور..."
                className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-700 focus:bg-white rounded-2xl px-3.5 py-2.5 pr-10 pl-10 text-xs text-slate-900 focus:outline-none transition-all font-bold font-mono"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600 p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full text-white font-black py-3 px-4 rounded-2xl text-xs transition-all shadow-md flex items-center justify-center gap-2 ${
              authMode === 'admin'
                ? 'bg-slate-900 hover:bg-slate-800 border border-slate-700'
                : 'bg-emerald-800 hover:bg-emerald-900 border border-emerald-700'
            }`}
          >
            {loading ? (
              <span>جاري التحقق والتسجيل...</span>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>{authMode === 'admin' ? 'دخول لوحة تحكم الإدارة' : 'دخول حساب المتجر'}</span>
              </>
            )}
          </button>
        </form>

        {/* Customer Demo Switcher (Only in Customer Mode) */}
        {authMode === 'customer' && (
          <div className="mt-4 pt-3.5 border-t border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 mb-2 text-center">
              حسابات عملاء تجريبية سريعة:
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
              <button
                type="button"
                onClick={() => handleQuickCustomer('01011112222', '123456')}
                className="p-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 font-bold text-center transition-colors"
              >
                <Store className="w-3.5 h-3.5 text-emerald-700 mx-auto mb-0.5" />
                <div className="truncate">ماركت الأمل</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickCustomer('01222223333', '123456')}
                className="p-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 font-bold text-center transition-colors"
              >
                <Store className="w-3.5 h-3.5 text-emerald-700 mx-auto mb-0.5" />
                <div className="truncate">ماركت البركة</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickCustomer('01555556666', '123456')}
                className="p-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 font-bold text-center transition-colors"
              >
                <Store className="w-3.5 h-3.5 text-emerald-700 mx-auto mb-0.5" />
                <div className="truncate">ماركت الحمد</div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
