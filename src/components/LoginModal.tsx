import React, { useState } from 'react';
import { User } from '../types';
import { BrandLogo } from './BrandLogo';
import {
  Lock,
  Phone,
  UserCheck,
  ShieldCheck,
  Store,
  KeyRound,
  AlertCircle,
  Eye,
  EyeOff,
  UserPlus,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Building2,
  MapPin,
} from 'lucide-react';
import { apiFetch } from '../utils/api';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [viewMode, setViewMode] = useState<'login' | 'register'>('login');
  const [authRole, setAuthRole] = useState<'customer' | 'admin'>('customer');

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Register form state
  const [regFullName, setRegFullName] = useState('');
  const [regStoreName, setRegStoreName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // UI state
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const resetMessages = () => {
    setError('');
    setSuccessMsg('');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    const cleanUser = username.trim();
    if (!cleanUser) {
      setError(authRole === 'admin' ? 'يرجى إدخال اسم مستخدم الإدارة' : 'يرجى إدخال رقم الهاتف أو البريد الإلكتروني');
      return;
    }

    if (!password) {
      setError('يرجى إدخال كلمة المرور');
      return;
    }

    // Client-side phone / email / username validation
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanUser);
    const cleanPhone = cleanUser.replace(/[\s\-()]/g, '');
    const isEgyPhone = /^(?:\+20|0020|0)?1[0125][0-9]{8}$/.test(cleanPhone);
    const isGeneralPhone = /^[0-9]{9,15}$/.test(cleanPhone);

    if (authRole === 'customer') {
      if (!isEmail && !isEgyPhone && !isGeneralPhone) {
        setError('يرجى إدخال رقم هاتف محمول صحيح (11 رقماً مثل 010 أو 011 أو 012 أو 015) أو بريد إلكتروني صالح');
        return;
      }
    } else {
      if (!isEmail && cleanUser.length < 3) {
        setError('اسم مستخدم الإدارة يجب ألا يقل عن 3 أحرف');
        return;
      }
    }

    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUser,
          password,
          rememberMe,
        }),
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

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (regPassword !== regConfirmPassword) {
      setError('كلمة المرور وتأكيد كلمة المرور غير متطابقين');
      return;
    }

    if (regPassword.length < 12) {
      setError('كلمة المرور يجب ألا تقل عن 12 خانة وتتضمن أحرفاً وأرقاماً ورموزاً');
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: regFullName.trim(),
          storeName: regStoreName.trim() || 'محل تجاري',
          phone: regPhone.trim(),
          address: regAddress.trim() || 'محافظة الإسكندرية',
          password: regPassword,
          confirmPassword: regConfirmPassword,
          rememberMe,
        }),
      });

      const data = await res.json();
      if (data.success && data.user) {
        onLoginSuccess(data.user);
        onClose();
      } else {
        setError(data.error || 'تعذر إنشاء الحساب، يرجى مراجعة البيانات');
      }
    } catch (err) {
      setError('حدث خطأ أثناء الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn" dir="rtl">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-sm sm:max-w-md w-full p-5 sm:p-6 text-right shadow-2xl text-slate-800 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-slate-400 hover:text-slate-700 w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors font-bold text-sm"
        >
          ✕
        </button>

        {/* Brand Header */}
        <div className="text-center mb-4 flex flex-col items-center">
          <BrandLogo
            size="md"
            variant="light"
            className="mb-2"
          />
          <h2 className="text-base sm:text-lg font-black text-slate-900">
            {viewMode === 'login' && 'تسجيل الدخول — شركة الحليم'}
            {viewMode === 'register' && 'إنشاء حساب تاجر جديد'}
            {viewMode === 'forgot' && 'استعادة كلمة المرور'}
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5 font-bold">
            نظام التجارة والتوزيع والتوريدات بالجملة — الإسكندرية
          </p>
        </div>

        {/* View Mode Switching (Login vs Register) */}
        {viewMode !== 'forgot' && (
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl mb-4 text-xs font-black">
            <button
              type="button"
              onClick={() => {
                setViewMode('login');
                resetMessages();
              }}
              className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                viewMode === 'login'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>تسجيل الدخول</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('register');
                resetMessages();
              }}
              className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                viewMode === 'register'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>إنشاء حساب جديد</span>
            </button>
          </div>
        )}

        {/* Messages */}
        {error && (
          <div className="mb-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl p-3 flex items-start gap-2 font-bold animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl p-3 flex items-start gap-2 font-bold">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 1. LOGIN VIEW */}
        {viewMode === 'login' && (
          <div>
            {/* Customer vs Admin Tab */}
            <div className="flex items-center gap-2 mb-3 text-[11px] font-bold text-slate-500">
              <button
                type="button"
                onClick={() => {
                  setAuthRole('customer');
                  resetMessages();
                }}
                className={`flex-1 py-1.5 px-2.5 rounded-xl border text-center transition-all ${
                  authRole === 'customer'
                    ? 'border-emerald-700 bg-emerald-50 text-emerald-900 font-black'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                حساب تاجر / عميل
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthRole('admin');
                  resetMessages();
                }}
                className={`flex-1 py-1.5 px-2.5 rounded-xl border text-center transition-all ${
                  authRole === 'admin'
                    ? 'border-slate-900 bg-slate-900 text-white font-black'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                بوابة الإدارة العامة
              </button>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-black text-slate-800 mb-1.5">
                  {authRole === 'admin' ? 'اسم مستخدم الإدارة أو البريد' : 'رقم الهاتف المسجل أو البريد الإلكتروني'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={
                      authRole === 'admin'
                        ? 'مثال: mohamed.fawzy أو البريد'
                        : 'مثال: 01011112222 أو name@domain.com'
                    }
                    className="w-full bg-white border-2 border-slate-300 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/15 rounded-2xl px-3.5 py-3 pr-10 text-xs text-slate-950 placeholder:text-slate-400 focus:outline-none transition-all font-bold shadow-xs"
                  />
                  {authRole === 'admin' ? (
                    <ShieldCheck className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5" />
                  ) : (
                    <Phone className="w-4 h-4 text-emerald-700 absolute right-3.5 top-3.5" />
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-black text-slate-800">كلمة المرور</label>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور..."
                    className="w-full bg-white border-2 border-slate-300 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/15 rounded-2xl px-3.5 py-3 pr-10 pl-10 text-xs text-slate-950 placeholder:text-slate-400 focus:outline-none transition-all font-bold font-mono shadow-xs"
                  />
                  <Lock className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-3 text-slate-500 hover:text-slate-800 p-1 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-emerald-800 rounded border-slate-300 focus:ring-emerald-700"
                  />
                  <span>تذكرني على هذا الجهاز (30 يوماً)</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full text-white font-black py-3 px-4 rounded-2xl text-xs transition-all shadow-md flex items-center justify-center gap-2 ${
                  authRole === 'admin'
                    ? 'bg-slate-900 hover:bg-slate-800 border border-slate-700'
                    : 'bg-emerald-800 hover:bg-emerald-900 border border-emerald-700'
                }`}
              >
                {loading ? (
                  <span>جاري التحقق والتسجيل...</span>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>{authRole === 'admin' ? 'دخول لوحة تحكم الإدارة' : 'دخول حساب المتجر'}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* 2. REGISTRATION VIEW */}
        {viewMode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-2.5">
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">
                اسم المحل / السوبر ماركت / الشركة <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={regStoreName}
                  onChange={(e) => setRegStoreName(e.target.value)}
                  placeholder="مثال: سوبر ماركت النور"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-700 focus:bg-white rounded-2xl px-3.5 py-2 pr-10 text-xs text-slate-900 focus:outline-none transition-all font-bold"
                />
                <Store className="w-4 h-4 text-slate-400 absolute right-3.5 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">
                اسم المسؤول / التاجر <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  placeholder="مثال: أحمد محمود إبراهيم"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-700 focus:bg-white rounded-2xl px-3.5 py-2 pr-10 text-xs text-slate-900 focus:outline-none transition-all font-bold"
                />
                <UserCheck className="w-4 h-4 text-slate-400 absolute right-3.5 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">
                رقم الهاتف المحمول (اسم الدخول) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="مثال: 01099887766"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-700 focus:bg-white rounded-2xl px-3.5 py-2 pr-10 text-xs text-slate-900 focus:outline-none transition-all font-bold font-mono"
                />
                <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">العنوان / المنطقة بالإسكندرية</label>
              <div className="relative">
                <input
                  type="text"
                  value={regAddress}
                  onChange={(e) => setRegAddress(e.target.value)}
                  placeholder="مثال: العجمي - الهانوفيل - شارع مسجد القويري"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-700 focus:bg-white rounded-2xl px-3.5 py-2 pr-10 text-xs text-slate-900 focus:outline-none transition-all font-bold"
                />
                <MapPin className="w-4 h-4 text-slate-400 absolute right-3.5 top-2.5" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  كلمة المرور <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    minLength={12}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="12 خانة على الأقل (حروف وأرقام ورموز)"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-700 focus:bg-white rounded-2xl px-3 py-2 text-xs text-slate-900 focus:outline-none transition-all font-bold font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  تأكيد كلمة المرور <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    minLength={12}
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="أعد إدخال الكلمة"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-700 focus:bg-white rounded-2xl px-3 py-2 text-xs text-slate-900 focus:outline-none transition-all font-bold font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-emerald-800 rounded border-slate-300 focus:ring-emerald-700"
                />
                <span>تذكرني على هذا الجهاز</span>
              </label>

              <button
                type="button"
                onClick={() => setShowRegPassword(!showRegPassword)}
                className="text-[11px] text-slate-500 font-bold hover:text-slate-800"
              >
                {showRegPassword ? 'إخفاء كلمات المرور' : 'إظهار كلمات المرور'}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-emerald-800 hover:bg-emerald-900 text-white font-black py-3 px-4 rounded-2xl text-xs transition-all shadow-md flex items-center justify-center gap-2 border border-emerald-700"
            >
              {loading ? (
                <span>جاري إنشاء الحساب والتأمين...</span>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>تأكيد وإنشاء حساب التاجر</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
