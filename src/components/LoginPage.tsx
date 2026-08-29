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
  X,
  RefreshCw,
} from 'lucide-react';
import { apiFetch, parseApiResponse } from '../utils/api';

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

  // Forgot / Reset Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

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

    if (password.length < 6) {
      setError('كلمة المرور يجب ألا تقل عن 6 خانات.');
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

      const parsed = await parseApiResponse(res);
      if (parsed.ok && parsed.data?.success && parsed.data?.user) {
        onLoginSuccess(parsed.data.user);
      } else {
        // Generic secure error message preventing user enumeration
        setError(parsed.error || parsed.data?.message || 'بيانات الدخول غير صحيحة، يرجى مراجعة رقم الهاتف/اسم المستخدم وكلمة المرور');
      }
    } catch {
      setError('تعذر الاتصال بالخادم، يرجى التحقق من اتصال الإنترنت والمحاولة مجدداً');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    const clean = forgotPhone.trim();
    if (!clean) {
      setForgotError('يرجى إدخال رقم الهاتف المسجل');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: clean }),
      });
      const parsed = await parseApiResponse(res);
      if (parsed.ok && parsed.data?.success) {
        if (parsed.data.resetToken) {
          setResetToken(parsed.data.resetToken);
          setForgotSuccess('تم إصدار رمز استعادة الحساب بنجاح. يرجى إدخال كلمة المرور الجديدة أدناه.');
          setForgotStep(2);
        } else {
          setForgotSuccess(parsed.data.message || 'إذا كان رقم الهاتف مسجلاً لدينا، فسيتم قبول طلب استعادة الحساب.');
        }
      } else {
        setForgotError(parsed.error || 'حدث خطأ أثناء معالجة الطلب');
      }
    } catch {
      setForgotError('تعذر الاتصال بالخادم، يرجى المحاولة مرة أخرى');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleExecuteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (newPassword.length < 6) {
      setForgotError('كلمة المرور يجب ألا تقل عن 6 خانات.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setForgotError('كلمة المرور وتأكيد كلمة المرور غير متطابقين');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: forgotPhone.trim(),
          token: resetToken.trim(),
          newPassword,
          confirmPassword: confirmNewPassword,
        }),
      });
      const parsed = await parseApiResponse(res);
      if (parsed.ok && parsed.data?.success) {
        setForgotSuccess('تم إعادة تعيين كلمة المرور بنجاح! جاري العودة لشاشة تسجيل الدخول...');
        setTimeout(() => {
          setShowForgotModal(false);
          setForgotStep(1);
          setForgotPhone('');
          setResetToken('');
          setNewPassword('');
          setConfirmNewPassword('');
          setForgotSuccess('');
        }, 1800);
      } else {
        setForgotError(parsed.error || parsed.data?.message || 'رمز استعادة الحساب غير صحيح أو منتهي الصلاحية');
      }
    } catch {
      setForgotError('تعذر الاتصال بالخادم أثناء استعادة الحساب');
    } finally {
      setForgotLoading(false);
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
                minLength={6}
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

          {/* Remember Me Checkbox & Forgot Password */}
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
              onClick={() => {
                setShowForgotModal(true);
                setForgotStep(1);
                setForgotError('');
                setForgotSuccess('');
                setForgotPhone(identifier.trim());
              }}
              className="text-xs text-amber-400 hover:text-amber-300 font-bold transition-colors"
            >
              نسيت كلمة المرور؟
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

      {/* Forgot / Reset Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-amber-500/30">
                <RefreshCw className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white">استعادة كلمة المرور</h3>
              <p className="text-xs text-slate-300 mt-1">
                {forgotStep === 1
                  ? 'أدخل رقم الهاتف المسجل لتوليد رمز استعادة الحساب'
                  : 'أدخل رمز الاستعادة وكلمة المرور الجديدة'}
              </p>
            </div>

            {forgotError && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/90 border border-red-700 text-red-200 text-xs font-bold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-950/90 border border-emerald-700 text-emerald-200 text-xs font-bold flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{forgotSuccess}</span>
              </div>
            )}

            {forgotStep === 1 ? (
              <form onSubmit={handleRequestReset} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1.5 block">
                    رقم الهاتف المسجل
                  </label>
                  <input
                    type="text"
                    value={forgotPhone}
                    onChange={(e) => setForgotPhone(e.target.value)}
                    placeholder="مثال: 01011112222"
                    dir="ltr"
                    required
                    className="w-full bg-slate-950 text-white rounded-xl px-4 py-3 text-sm font-semibold border-2 border-slate-700 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 text-right"
                  />
                </div>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-60 cursor-pointer"
                >
                  {forgotLoading ? 'جاري التحقق...' : 'طلب رمز الاستعادة'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleExecuteReset} className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">
                    رمز الاستعادة (Reset Token)
                  </label>
                  <input
                    type="text"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder="رمز الاستعادة"
                    dir="ltr"
                    required
                    className="w-full bg-slate-950 text-white rounded-xl px-3.5 py-2.5 text-xs font-mono border-2 border-slate-700 focus:outline-none focus:border-emerald-400 text-center"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">
                    كلمة المرور الجديدة
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="6 خانات على الأقل"
                    dir="ltr"
                    required
                    minLength={6}
                    className="w-full bg-slate-950 text-white rounded-xl px-3.5 py-2.5 text-sm border-2 border-slate-700 focus:outline-none focus:border-emerald-400 text-right"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">
                    تأكيد كلمة المرور الجديدة
                  </label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="أعد كتابة كلمة المرور"
                    dir="ltr"
                    required
                    minLength={6}
                    className="w-full bg-slate-950 text-white rounded-xl px-3.5 py-2.5 text-sm border-2 border-slate-700 focus:outline-none focus:border-emerald-400 text-right"
                  />
                </div>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-60 cursor-pointer mt-2"
                >
                  {forgotLoading ? 'جاري التحديث...' : 'تحديث كلمة المرور والدخول'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-6 text-center space-y-1 select-none">
        <p className="text-xs text-slate-400 font-medium">
          شركة الحليم للتجارة والتوزيع • نظام الحسابات والتوريدات المؤمن B2B
        </p>
        <p className="text-[11px] text-slate-400 font-normal">
          Designed & Developed by Astra Systems | Technical Support: 01278910793
        </p>
      </div>
    </div>
  );
};
