import React, { useState } from 'react';
import { User } from '../types';
import { BrandLogo } from './BrandLogo';
import {
  User as UserIcon,
  Store,
  Phone,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Building2,
  MapPin,
} from 'lucide-react';
import { apiFetch } from '../utils/api';

interface RegisterPageProps {
  onRegisterSuccess: (user: User) => void;
  onNavigate: (path: string) => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onRegisterSuccess, onNavigate }) => {
  const [fullName, setFullName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('الإسكندرية');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    const cleanName = fullName.trim();
    const cleanStore = storeName.trim();
    const cleanPhone = phone.replace(/\s+/g, '').trim();

    if (!cleanName || cleanName.length < 3) {
      setError('يرجى إدخال اسم العميل بالكامل (3 أحرف على الأقل)');
      return;
    }

    if (!cleanStore || cleanStore.length < 2) {
      setError('يرجى إدخال اسم المحل أو السوبر ماركت التجاري');
      return;
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      setError('يرجى إدخال رقم هاتف محمول صالح (مثال: 01012345678)');
      return;
    }

    if (password.length < 12) {
      setError('كلمة المرور يجب ألا تقل عن 12 خانة/رمز وتتضمن أحرفاً كبيرة وصغيرة وأرقاماً ورموزاً خاصة');
      return;
    }

    if (password !== confirmPassword) {
      setError('كلمة المرور وتأكيد كلمة المرور غير متطابقين');
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: cleanName,
          storeName: cleanStore,
          phone: cleanPhone,
          address: address.trim() || 'محافظة الإسكندرية',
          password,
          confirmPassword,
          rememberMe,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.user) {
        onRegisterSuccess(data.user);
      } else {
        setError(data.error || 'تعذر إنشاء الحساب، يرجى مراجعة البيانات المدخلة');
      }
    } catch {
      setError('تعذر الاتصال بالخادم، يرجى المحاولة مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden selection:bg-emerald-600 selection:text-white" dir="rtl">
      {/* Background Ambient Glows */}
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-emerald-700/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 relative z-10">
        
        {/* Brand Header */}
        <div className="text-center mb-5 flex flex-col items-center">
          <BrandLogo
            size="lg"
            variant="glass"
            withGlow
            className="mb-2.5"
          />
          <h1 className="text-lg sm:text-xl font-black text-white">
            شركة الحليم للتجارة والتوزيع
          </h1>
          <p className="text-xs text-amber-400 font-bold mt-0.5">
            تسجيل حساب عميل / تاجر جديد
          </p>
        </div>

        {/* Info Banner */}
        <div className="bg-emerald-950/60 border border-emerald-800/60 rounded-2xl p-3.5 mb-5 text-center">
          <p className="text-xs text-emerald-200 font-semibold leading-relaxed">
            أنشئ حسابك الآن للاستفادة من أسعار الجملة، العروض الحصرية، وطلب البضائع مباشرة
          </p>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-red-950/80 border border-red-800/80 text-red-200 text-xs font-bold flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          
          {/* Full Name */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              اسم العميل / التاجر <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="مثال: الحاج أحمد فوزي"
                className="w-full bg-slate-950 border border-slate-750 text-white rounded-2xl pr-10 pl-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-semibold transition-all placeholder:text-slate-600"
                required
              />
            </div>
          </div>

          {/* Store Name */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              اسم المحل / السوبر ماركت <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500">
                <Store className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="مثال: سوبر ماركت الأمل والبركة"
                className="w-full bg-slate-950 border border-slate-750 text-white rounded-2xl pr-10 pl-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-semibold transition-all placeholder:text-slate-600"
                required
              />
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              رقم الهاتف المحمول (اسم الدخول) <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500">
                <Phone className="w-4 h-4" />
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01012345678"
                dir="ltr"
                className="w-full bg-slate-950 border border-slate-750 text-white rounded-2xl pr-10 pl-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-mono transition-all text-right placeholder:text-slate-600 placeholder:text-right"
                required
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              العنوان / المنطقة
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500">
                <MapPin className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="الإسكندرية - العصافرة"
                className="w-full bg-slate-950 border border-slate-750 text-white rounded-2xl pr-10 pl-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-semibold transition-all placeholder:text-slate-600"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              كلمة المرور <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="12 خانة على الأقل (حروف كبيرة وصغيرة وأرقام ورموز)"
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
            <p className="text-[11px] text-slate-500 mt-1">يجب أن تشمل حروفاً إنجليزية كبيرة وصغيرة، أرقاماً، ورموزاً خاصة مثل (!@#$%).</p>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              تأكيد كلمة المرور <span className="text-red-400">*</span>
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
                minLength={12}
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

          {/* Remember Me */}
          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-900"
              />
              <span className="text-xs text-slate-300 font-semibold">تذكر تسجيل الدخول (30 يوم)</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/30 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                جاري إنشاء الحساب...
              </span>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>إنشاء الحساب والبدء في التسوق</span>
              </>
            )}
          </button>
        </form>

        {/* Back to Login Link */}
        <div className="mt-5 pt-4 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-400">
            لديك حساب مسجل بالفعل؟{' '}
            <button
              type="button"
              onClick={() => onNavigate('/login')}
              className="text-amber-400 hover:text-amber-300 font-black underline underline-offset-4 mr-1 transition-colors"
            >
              تسجيل الدخول
            </button>
          </p>
        </div>

      </div>

      {/* Footer Info */}
      <div className="mt-6 text-center text-xs text-slate-500 select-none">
        شركة الحليم للتجارة والتوزيع • الإسكندرية
      </div>
    </div>
  );
};
