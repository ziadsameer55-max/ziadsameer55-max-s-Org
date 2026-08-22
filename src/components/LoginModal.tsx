import React, { useState } from 'react';
import { User } from '../types';
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
  const [viewMode, setViewMode] = useState<'login' | 'register' | 'forgot'>('login');
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

  // Forgot password form state
  const [forgotPhone, setForgotPhone] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [generatedDemoToken, setGeneratedDemoToken] = useState('');

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
    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
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

    if (regPassword.length < 6) {
      setError('كلمة المرور يجب ألا تقل عن 6 خانات');
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

  const handleForgotRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: forgotPhone.trim() }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.resetToken) {
          setResetToken(data.resetToken);
          setGeneratedDemoToken(data.resetToken);
        }
        setSuccessMsg(data.message || 'تم إرسال رمز الاستعادة بنجاح');
        setForgotStep(2);
      } else {
        setError(data.error || 'تعذر معالجة الطلب');
      }
    } catch (err) {
      setError('حدث خطأ أثناء معالجة الطلب');
    } finally {
      setLoading(false);
    }
  };

  const handleResetExecuteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (newPassword !== confirmNewPassword) {
      setError('كلمة المرور وتأكيدها غير متطابقين');
      return;
    }

    if (newPassword.length < 6) {
      setError('كلمة المرور الجديدة يجب ألا تقل عن 6 خانات');
      return;
    }

    setLoading(true);

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

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message || 'تم تغيير كلمة المرور بنجاح');
        setTimeout(() => {
          setViewMode('login');
          setUsername(forgotPhone);
          setPassword('');
          setForgotStep(1);
          setResetToken('');
        }, 1500);
      } else {
        setError(data.error || 'رمز الاستعادة غير صحيح أو منتهي الصلاحية');
      }
    } catch (err) {
      setError('حدث خطأ أثناء إعادة تعيين كلمة المرور');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickCustomer = (phone: string, pass: string) => {
    setUsername(phone);
    setPassword(pass);
    resetMessages();
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
        <div className="text-center mb-4">
          <div className="w-12 h-12 bg-emerald-800 rounded-2xl flex items-center justify-center text-white text-xl font-black mx-auto mb-2 shadow-sm">
            ح
          </div>
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
                <label className="block text-xs font-black text-slate-700 mb-1">
                  {authRole === 'admin' ? 'اسم مستخدم الإدارة' : 'رقم الهاتف أو اسم المستخدم'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={
                      authRole === 'admin'
                        ? 'MohamedFawzy'
                        : 'مثال: 01011112222'
                    }
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-700 focus:bg-white rounded-2xl px-3.5 py-2.5 pr-10 text-xs text-slate-900 focus:outline-none transition-all font-bold"
                  />
                  {authRole === 'admin' ? (
                    <ShieldCheck className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                  ) : (
                    <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-black text-slate-700">كلمة المرور</label>
                  {authRole === 'customer' && (
                    <button
                      type="button"
                      onClick={() => {
                        setViewMode('forgot');
                        setForgotPhone(username);
                        resetMessages();
                      }}
                      className="text-[11px] font-bold text-emerald-800 hover:underline"
                    >
                      نسيت كلمة المرور؟
                    </button>
                  )}
                </div>
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

            {/* Customer Demo Switcher */}
            {authRole === 'customer' && (
              <div className="mt-4 pt-3.5 border-t border-slate-100">
                <div className="text-[10px] font-bold text-slate-400 mb-2 text-center">
                  حسابات تجار تجريبية سريعة:
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
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="6 خانات على الأقل"
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

        {/* 3. FORGOT / RESET PASSWORD VIEW */}
        {viewMode === 'forgot' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                setViewMode('login');
                resetMessages();
              }}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 mb-1"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>العودة لتسجيل الدخول</span>
            </button>

            {forgotStep === 1 ? (
              <form onSubmit={handleForgotRequestSubmit} className="space-y-3">
                <p className="text-xs text-slate-600 font-bold leading-relaxed">
                  أدخل رقم الهاتف المسجل بحسابك لاستلام رمز التحقق وتعيين كلمة مرور جديدة:
                </p>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">رقم الهاتف المسجل</label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      value={forgotPhone}
                      onChange={(e) => setForgotPhone(e.target.value)}
                      placeholder="مثال: 01011112222"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-700 focus:bg-white rounded-2xl px-3.5 py-2.5 pr-10 text-xs text-slate-900 focus:outline-none transition-all font-bold font-mono"
                    />
                    <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-800 hover:bg-emerald-900 text-white font-black py-3 px-4 rounded-2xl text-xs transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {loading ? 'جاري التحقق...' : 'طلب رمز استعادة كلمة المرور'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetExecuteSubmit} className="space-y-3">
                {generatedDemoToken && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] font-mono text-amber-900">
                    <span className="font-bold">رمز التحقق التجريبي المؤقت:</span> {generatedDemoToken}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">رمز الاستعادة (Token)</label>
                  <input
                    type="text"
                    required
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder="أدخل الرمز المستلم..."
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-700 focus:bg-white rounded-2xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none transition-all font-bold font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">كلمة المرور الجديدة</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="6 خانات على الأقل..."
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-700 focus:bg-white rounded-2xl px-3.5 py-2 pr-10 text-xs text-slate-900 focus:outline-none transition-all font-bold font-mono"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-2.5" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">تأكيد كلمة المرور الجديدة</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="أعد إدخال كلمة المرور..."
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-700 focus:bg-white rounded-2xl px-3.5 py-2 pr-10 text-xs text-slate-900 focus:outline-none transition-all font-bold font-mono"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-2.5" />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="text-[11px] text-slate-500 font-bold hover:text-slate-800"
                  >
                    {showNewPassword ? 'إخفاء كلمات المرور' : 'إظهار كلمات المرور'}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-800 hover:bg-emerald-900 text-white font-black py-3 px-4 rounded-2xl text-xs transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {loading ? 'جاري التحديث...' : 'تأكيد تغيير كلمة المرور'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
