import React, { useState, useMemo } from 'react';
import { User } from '../types';
import { BrandLogo } from './BrandLogo';
import {
  Lock,
  Phone,
  ShieldCheck,
  Eye,
  EyeOff,
  Store,
  KeyRound,
  Mail,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { apiFetch } from '../utils/api';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
  onNavigate: (path: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onNavigate }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeRoleTab, setActiveRoleTab] = useState<'customer' | 'admin'>('customer');
  const [isTouched, setIsTouched] = useState(false);

  // Validate format of phone number or email address
  const validationState = useMemo(() => {
    const val = identifier.trim();
    if (!val) {
      return { isValid: false, type: 'empty', message: '' };
    }

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    if (isEmail) {
      return { isValid: true, type: 'email', message: 'صيغة بريد إلكتروني صحيحة' };
    }

    // Clean phone number: remove spaces, dashes, parentheses
    const cleanPhone = val.replace(/[\s\-()]/g, '');

    // Egyptian mobile standard: 010, 011, 012, 015 (11 digits) or +20 / 0020 prefix
    const isEgyMobile = /^(?:\+20|0020|0)?1[0125][0-9]{8}$/.test(cleanPhone);
    const isGeneralPhone = /^[0-9]{9,15}$/.test(cleanPhone);

    if (isEgyMobile || isGeneralPhone) {
      return {
        isValid: true,
        type: 'phone',
        message: isEgyMobile ? 'رقم هاتف محمول مصري صحيح' : 'صيغة رقم هاتف صحيحة',
      };
    }

    // For admin, usernames with length >= 3 are acceptable
    if (activeRoleTab === 'admin' && /^[a-zA-Z0-9._-]{3,}$/.test(val)) {
      return { isValid: true, type: 'username', message: 'اسم مستخدم صالح' };
    }

    if (val.includes('@')) {
      return { isValid: false, type: 'invalid_email', message: 'صيغة البريد الإلكتروني غير مكتملة (مثال: name@domain.com)' };
    }

    if (activeRoleTab === 'customer') {
      return {
        isValid: false,
        type: 'invalid_phone',
        message: 'يرجى كتابة رقم هاتف صحيح (11 رقماً مثل 010... أو 011...) أو بريد إلكتروني صالح',
      };
    }

    return {
      isValid: false,
      type: 'invalid_username',
      message: 'يرجى إدخال اسم مستخدم صحيح (3 أحرف على الأقل) أو بريد إلكتروني',
    };
  }, [identifier, activeRoleTab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsTouched(true);

    const cleanIdentifier = identifier.trim();

    // 1. Check empty inputs
    if (!cleanIdentifier) {
      setError(
        activeRoleTab === 'customer'
          ? 'يرجى إدخال رقم الهاتف المسجل أو البريد الإلكتروني'
          : 'يرجى إدخال اسم المستخدم أو البريد الإلكتروني'
      );
      return;
    }

    if (!password) {
      setError('يرجى إدخال كلمة المرور');
      return;
    }

    // 2. Client-side Format Validation before sending to server
    if (!validationState.isValid) {
      setError(validationState.message || 'يرجى التأكد من كتابة صيغة الهاتف أو البريد الإلكتروني بشكل صحيح قبل المتابعة');
      return;
    }

    if (password.length < 4) {
      setError('كلمة المرور يجب أن لا تقل عن 4 خانات');
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanIdentifier,
          password,
          rememberMe,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.user) {
        onLoginSuccess(data.user);
      } else {
        // Generic secure error message preventing user enumeration
        setError(data.message || 'بيانات الدخول غير صحيحة، يرجى مراجعة رقم الهاتف/اسم المستخدم وكلمة المرور');
      }
    } catch {
      setError('تعذر الاتصال بالخادم، يرجى التحقق من اتصال الإنترنت والمحاولة مجدداً');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden selection:bg-emerald-600 selection:text-white" dir="rtl">
      {/* Background Decorative Ambient Glows */}
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-emerald-700/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Container */}
      <div className="w-full max-w-md bg-slate-900/95 backdrop-blur-2xl border-2 border-slate-700/80 rounded-3xl shadow-2xl p-6 sm:p-8 relative z-10">
        
        {/* Brand Header */}
        <div className="text-center mb-6 flex flex-col items-center">
          <BrandLogo
            size="xl"
            variant="glass"
            withGlow
            className="mb-3 hover:scale-105 transition-transform"
          />
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              شركة الحليم للتجارة والتوزيع
            </h1>
          </div>
          <p className="text-xs text-amber-400 font-bold tracking-wide">
            منصة مبيعات الجملة والتوريدات B2B • الإسكندرية
          </p>
        </div>

        {/* Page Title & Subtitle */}
        <div className="bg-slate-800/80 rounded-2xl p-3.5 mb-5 border border-slate-700 text-center shadow-inner">
          <h2 className="text-base sm:text-lg font-black text-white flex items-center justify-center gap-2">
            مرحبًا بك 👋
          </h2>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed font-medium">
            سجل الدخول إلى حسابك لمتابعة الطلبات والأسعار وكشف الحساب
          </p>
        </div>

        {/* Account Role Tabs (Customer / Admin) */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-2xl border-2 border-slate-700/90 mb-5">
          <button
            type="button"
            onClick={() => {
              setActiveRoleTab('customer');
              setError('');
              setIsTouched(false);
            }}
            className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              activeRoleTab === 'customer'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40 ring-1 ring-emerald-400/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>حساب عميل / تاجر</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveRoleTab('admin');
              setError('');
              setIsTouched(false);
            }}
            className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              activeRoleTab === 'admin'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20 font-black ring-1 ring-amber-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>إدارة الشركة</span>
          </button>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="mb-5 p-3.5 rounded-2xl bg-red-950/90 border-2 border-red-700/90 text-red-100 text-xs font-bold flex items-start gap-2.5 animate-shake shadow-lg">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Phone / Username / Email Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-black text-slate-200 flex items-center gap-1.5">
                {activeRoleTab === 'customer' ? (
                  <>
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>رقم الهاتف أو البريد الإلكتروني</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>اسم مستخدم الإدارة أو البريد</span>
                  </>
                )}
              </label>

              {/* Status Pill on typing */}
              {identifier.trim().length > 0 && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                    validationState.isValid
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600'
                      : 'bg-amber-950/80 text-amber-300 border-amber-600'
                  }`}
                >
                  {validationState.isValid ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>صحيح</span>
                    </>
                  ) : (
                    <span>يرجى التحقق</span>
                  )}
                </span>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                {identifier.includes('@') ? (
                  <Mail className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Phone className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <input
                type={activeRoleTab === 'customer' ? 'text' : 'text'}
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (error) setError('');
                }}
                onBlur={() => setIsTouched(true)}
                placeholder={
                  activeRoleTab === 'customer'
                    ? 'مثال: 01011112222 أو mail@domain.com'
                    : 'مثال: mohamed.fawzy أو البريد'
                }
                dir="ltr"
                className={`w-full bg-slate-950 text-white rounded-2xl pr-10 pl-4 py-3.5 text-sm font-semibold transition-all text-right placeholder:text-slate-400 placeholder:text-right shadow-inner border-2 ${
                  isTouched && identifier.trim() && !validationState.isValid
                    ? 'border-amber-500/80 focus:border-amber-400 focus:ring-4 focus:ring-amber-500/20'
                    : validationState.isValid
                    ? 'border-emerald-600/80 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/25'
                    : 'border-slate-600 hover:border-slate-500 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20'
                } focus:outline-none focus:bg-slate-900`}
                autoComplete="username"
                required
              />
            </div>

            {/* Helper/Validation Text below input */}
            {isTouched && identifier.trim() && !validationState.isValid && (
              <p className="text-[11px] text-amber-400 font-bold mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{validationState.message}</span>
              </p>
            )}
          </div>

          {/* Password Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-black text-slate-200 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>كلمة المرور</span>
              </label>

              {/* Prominent Quick Forgot-Password Link */}
              <button
                type="button"
                onClick={() => onNavigate('/forgot-password')}
                className="inline-flex items-center gap-1 text-xs font-black text-emerald-400 hover:text-emerald-300 hover:underline underline-offset-4 transition-all py-0.5 px-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800/80 hover:bg-emerald-900/60"
              >
                <KeyRound className="w-3 h-3 text-amber-400" />
                <span>نسيت كلمة المرور؟</span>
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4 text-emerald-400" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="أدخل كلمة المرور الخاصة بك"
                dir="ltr"
                className="w-full bg-slate-950 text-white rounded-2xl pr-10 pl-12 py-3.5 text-sm font-semibold transition-all text-right placeholder:text-slate-400 placeholder:text-right shadow-inner border-2 border-slate-600 hover:border-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20 focus:bg-slate-900"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 hover:text-white transition-colors"
                title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember Me Checkbox & Quick Recovery Shortcut */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-2 border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900 cursor-pointer"
              />
              <span className="text-xs text-slate-200 font-bold">تذكر تسجيل الدخول (30 يوم)</span>
            </label>

            <button
              type="button"
              onClick={() => onNavigate('/forgot-password')}
              className="text-[11px] text-slate-400 hover:text-amber-300 font-bold transition-colors md:hidden"
            >
              استعادة الحساب 🔑
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3.5 px-4 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 shadow-xl ${
              activeRoleTab === 'admin'
                ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-amber-400/20 ring-2 ring-amber-300'
                : 'bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-white shadow-emerald-700/30 ring-2 ring-emerald-500/40'
            } active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer mt-2`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                جاري التحقق وتسجيل الدخول...
              </span>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>تسجيل الدخول إلى المنصة</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Password Recovery Banner / Card */}
        <div className="mt-5 p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-right">
            <div className="w-7 h-7 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
              <KeyRound className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-200 leading-tight">واجهتك مشكلة في كلمة المرور؟</p>
              <p className="text-[10px] text-slate-400 mt-0.5">استرجع حسابك فوراً عبر رقم هاتفك</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/forgot-password')}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 text-[11px] font-black border border-slate-700 transition-all shrink-0 flex items-center gap-1"
          >
            <span>استعادة</span>
            <ArrowLeft className="w-3 h-3" />
          </button>
        </div>

        {/* Navigation Link to Register */}
        <div className="mt-5 text-center">
          <p className="text-xs text-slate-300 font-semibold">
            ليس لديك حساب تاجر حتى الآن؟{' '}
            <button
              type="button"
              onClick={() => onNavigate('/register')}
              className="text-amber-400 hover:text-amber-300 font-black underline underline-offset-4 mr-1 transition-colors"
            >
              إنشاء حساب جديد
            </button>
          </p>
        </div>

      </div>

      {/* Footer Info */}
      <div className="mt-6 text-center text-xs text-slate-400 font-medium select-none">
        شركة الحليم للتجارة والتوزيع • نظام الحسابات والتوريدات المؤمن B2B
      </div>
    </div>
  );
};
