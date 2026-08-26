import React, { useState } from 'react';
import { BrandLogo } from './BrandLogo';
import {
  KeyRound,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react';
import { apiFetch } from '../utils/api';

interface ForgotPasswordPageProps {
  onNavigate: (path: string) => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onNavigate }) => {
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [token, setToken] = useState('');
  const [generatedDemoToken, setGeneratedDemoToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Step 1: Request Reset Token
  const handleRequestToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanPhone = phone.replace(/\s+/g, '').trim();
    if (!cleanPhone) {
      setError('يرجى إدخال رقم الهاتف المسجل لدينا');
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.resetToken) {
          setToken(data.resetToken);
          setGeneratedDemoToken(data.resetToken);
        }
        setSuccessMsg(data.message || 'تم قبول الطلب، يرجى إدخال رمز الاستعادة وكلمة المرور الجديدة');
        setStep(2);
      } else {
        setError(data.error || 'تعذر معالجة الطلب، يرجى التأكد من رقم الهاتف');
      }
    } catch {
      setError('تعذر الاتصال بالخادم، يرجى المحاولة مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Submit New Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!token.trim()) {
      setError('يرجى إدخال رمز استعادة الحساب');
      return;
    }

    if (newPassword.length < 12) {
      setError('كلمة المرور الجديدة يجب ألا تقل عن 12 خانة وتتضمن أحرفاً وأرقاماً ورموزاً');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('كلمة المرور وتأكيد كلمة المرور غير متطابقين');
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.replace(/\s+/g, '').trim(),
          token: token.trim(),
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg('تم تغيير كلمة المرور بنجاح! جاري تحويلك لصفحة الدخول...');
        setTimeout(() => {
          onNavigate('/login');
        }, 2000);
      } else {
        setError(data.error || 'رمز الاستعادة غير صحيح أو انتهت صلاحيته');
      }
    } catch {
      setError('حدث خطأ أثناء الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden selection:bg-emerald-600 selection:text-white" dir="rtl">
      {/* Ambient Glows */}
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-emerald-700/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Card */}
      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 relative z-10">
        
        {/* Header */}
        <div className="text-center mb-6 flex flex-col items-center">
          <BrandLogo size="lg" variant="glass" withGlow className="mb-2" />
          <h1 className="text-lg sm:text-xl font-black text-white">
            استعادة كلمة المرور
          </h1>
          <p className="text-xs text-amber-400/90 font-bold mt-1">
            شركة الحليم للتجارة والتوزيع • نظام الأمان والحسابات
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black ${
            step === 1 ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-400'
          }`}>
            <span>1</span>
            <span>رقم الهاتف</span>
          </div>
          <div className="w-6 h-0.5 bg-slate-800" />
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black ${
            step === 2 ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-400'
          }`}>
            <span>2</span>
            <span>كلمة المرور الجديدة</span>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-red-950/80 border border-red-800/80 text-red-200 text-xs font-bold flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-950/80 border border-emerald-800/80 text-emerald-200 text-xs font-bold flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{successMsg}</span>
          </div>
        )}

        {/* Step 1: Phone Entry */}
        {step === 1 && (
          <form onSubmit={handleRequestToken} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                رقم الهاتف المسجل بالحساب
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01011112222"
                  dir="ltr"
                  className="w-full bg-slate-950 border border-slate-750 text-white rounded-2xl pr-10 pl-4 py-3 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-mono transition-all text-right placeholder:text-slate-600 placeholder:text-right"
                  required
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/30 active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  جاري التحقق...
                </span>
              ) : (
                <>
                  <span>طلب رمز استعادة كلمة المرور</span>
                  <ArrowRight className="w-4 h-4 rotate-180" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Step 2: Token + New Password */}
        {step === 2 && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            
            {/* Auto-filled Demo Token Notification */}
            {generatedDemoToken && (
              <div className="p-3 bg-amber-950/60 border border-amber-800/60 rounded-2xl text-xs text-amber-200">
                <span className="font-black text-amber-400 block mb-1">🔑 رمز الاستعادة المؤقت:</span>
                <span className="font-mono font-bold select-all bg-slate-950 px-2 py-0.5 rounded border border-amber-900/60 text-white">
                  {generatedDemoToken}
                </span>
                <span className="block text-[10px] text-amber-300/80 mt-1">
                  (صالح للاستخدام لمرة واحدة لمدة 15 دقيقة)
                </span>
              </div>
            )}

            {/* Reset Token Input */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                رمز استعادة الحساب
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="أدخل رمز الاستعادة"
                dir="ltr"
                className="w-full bg-slate-950 border border-slate-750 text-white rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-mono transition-all text-center placeholder:text-slate-600"
                required
              />
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                كلمة المرور الجديدة
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="12 خانة على الأقل (حروف وأرقام ورموز)"
                  dir="ltr"
                  className="w-full bg-slate-950 border border-slate-750 text-white rounded-2xl pr-10 pl-11 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-mono transition-all text-right placeholder:text-slate-600 placeholder:text-right"
                  required
                  minLength={12}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  title={showPassword ? 'إخفاء' : 'إظهار'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                تأكيد كلمة المرور الجديدة
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="أعد إدخال كلمة المرور"
                  dir="ltr"
                  className="w-full bg-slate-950 border border-slate-750 text-white rounded-2xl pr-10 pl-11 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-mono transition-all text-right placeholder:text-slate-600 placeholder:text-right"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  title={showConfirmPassword ? 'إخفاء' : 'إظهار'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/30 active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  جاري حفظ كلمة المرور...
                </span>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>تأكيد وتعيين كلمة المرور الجديدة</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Back Link */}
        <div className="mt-6 pt-4 border-t border-slate-800 text-center">
          <button
            type="button"
            onClick={() => onNavigate('/login')}
            className="text-xs text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1.5"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>العودة إلى صفحة تسجيل الدخول</span>
          </button>
        </div>

      </div>
    </div>
  );
};
