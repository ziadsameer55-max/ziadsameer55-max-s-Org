import React, { useState, useEffect, useMemo } from 'react';
import { CollectionPeriod, CollectionsReportData, PaymentTransaction } from '../types';
import { apiFetch } from '../utils/api';
import {
  DollarSign,
  Calendar,
  Wallet,
  TrendingUp,
  Search,
  Filter,
  RefreshCw,
  Printer,
  ArrowDownLeft,
  User,
  Phone,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Building2,
  Smartphone,
  ChevronDown,
} from 'lucide-react';

interface AdminCollectionsReportProps {
  onRefreshGlobal?: () => void;
}

export const AdminCollectionsReport: React.FC<AdminCollectionsReportProps> = ({
  onRefreshGlobal,
}) => {
  const [data, setData] = useState<CollectionsReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<CollectionPeriod>('this_month');
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCollectionsData = async () => {
    setLoading(true);
    try {
      let url = `/api/reports/collections?period=${period}`;
      if (period === 'custom') {
        url += `&startDate=${customStart}&endDate=${customEnd}`;
      }
      if (paymentMethodFilter !== 'all') {
        url += `&paymentMethod=${encodeURIComponent(paymentMethodFilter)}`;
      }
      if (searchQuery.trim()) {
        url += `&q=${encodeURIComponent(searchQuery.trim())}`;
      }

      const res = await apiFetch(url);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Error fetching collections report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollectionsData();
  }, [period, paymentMethodFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCollectionsData();
  };

  const handleCustomDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (period === 'custom') {
      fetchCollectionsData();
    }
  };

  // Period label translation
  const getPeriodLabel = (p: CollectionPeriod) => {
    switch (p) {
      case 'today':
        return 'اليوم';
      case 'yesterday':
        return 'أمس';
      case 'this_week':
        return 'هذا الأسبوع';
      case 'last_week':
        return 'الأسبوع السابق';
      case 'this_month':
        return 'هذا الشهر';
      case 'last_month':
        return 'الشهر السابق';
      case 'this_year':
        return 'هذه السنة';
      case 'last_year':
        return 'السنة السابقة';
      case 'custom':
        return 'فترة مخصصة';
      default:
        return 'هذا الشهر';
    }
  };

  const getMethodBadge = (method: string) => {
    switch (method) {
      case 'Cash':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-xs font-bold">
            💵 نقدي
          </span>
        );
      case 'Bank':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full text-xs font-bold">
            🏦 تحويل بنكي
          </span>
        );
      case 'VodafoneCash':
        return (
          <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full text-xs font-bold">
            📱 فودافون كاش
          </span>
        );
      case 'Cheque':
        return (
          <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full text-xs font-bold">
            📝 شيك
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-slate-50 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full text-xs font-bold">
            💳 أخرى
          </span>
        );
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleString('ar-EG', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    } catch {}
    return dateStr;
  };

  const handlePrint = () => {
    window.print();
  };

  const summary = data?.summary;
  const periodSummary = data?.periodSummary;
  const payments = data?.payments || [];

  return (
    <div className="space-y-6 pb-12 print:p-0 print:space-y-4" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-5 md:p-6 shadow-md border border-slate-700/60 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                💰
              </div>
              <h1 className="text-xl md:text-2xl font-black text-white">
                التحصيل والمقبوضات
              </h1>
            </div>
            <p className="text-xs md:text-sm text-slate-300">
              تقرير ومتابعة حركات التحصيل والمقبوضات النقدية والبنكية الفعلية من واقع الخزينة
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchCollectionsData();
                if (onRefreshGlobal) onRefreshGlobal();
              }}
              disabled={loading}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-600 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>تحديث البيانات</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black rounded-xl shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة التقرير</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Main Stat Cards (Today, This Week, This Month, This Year) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 md:gap-4">
        {/* Today */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <span>💰</span>
              <span>تحصيل اليوم</span>
            </span>
            <div className="text-xl md:text-2xl font-black text-emerald-800 tracking-tight">
              {(summary?.today || 0).toLocaleString('ar-EG')}{' '}
              <span className="text-xs font-bold text-slate-600">ج.م</span>
            </div>
            <span className="text-[10px] text-slate-600 block">
              اليوم: {new Date().toLocaleDateString('ar-EG', { dateStyle: 'medium' })}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center font-bold shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* This Week */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <span>📅</span>
              <span>تحصيل هذا الأسبوع</span>
            </span>
            <div className="text-xl md:text-2xl font-black text-blue-800 tracking-tight">
              {(summary?.thisWeek || 0).toLocaleString('ar-EG')}{' '}
              <span className="text-xs font-bold text-slate-600">ج.م</span>
            </div>
            <span className="text-[10px] text-slate-600 block">
              الأسبوع الحالي
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-bold shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        {/* This Month */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <span>🗓️</span>
              <span>تحصيل هذا الشهر</span>
            </span>
            <div className="text-xl md:text-2xl font-black text-indigo-800 tracking-tight">
              {(summary?.thisMonth || 0).toLocaleString('ar-EG')}{' '}
              <span className="text-xs font-bold text-slate-600">ج.م</span>
            </div>
            <span className="text-[10px] text-slate-600 block">
              شهر {new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center font-bold shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* This Year */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <span>📆</span>
              <span>تحصيل هذه السنة</span>
            </span>
            <div className="text-xl md:text-2xl font-black text-purple-800 tracking-tight">
              {(summary?.thisYear || 0).toLocaleString('ar-EG')}{' '}
              <span className="text-xs font-bold text-slate-600">ج.م</span>
            </div>
            <span className="text-[10px] text-slate-600 block">
              عام {new Date().getFullYear()}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center font-bold shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Secondary Financial Indicators Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 print:hidden">
        <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-200/70 text-amber-900 flex items-center justify-center font-bold">
              📊
            </div>
            <div>
              <span className="text-xs text-amber-900 font-bold block">إجمالي مبيعات المتجر</span>
              <span className="text-sm font-black text-amber-950">
                {(summary?.totalSales || 0).toLocaleString('ar-EG')} ج.م
              </span>
            </div>
          </div>
          <span className="text-[11px] text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-md font-bold">
            كل الفواتير المؤكدة
          </span>
        </div>

        <div className="bg-red-50/60 border border-red-200/70 rounded-xl p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-200/70 text-red-900 flex items-center justify-center font-bold">
              ⚠️
            </div>
            <div>
              <span className="text-xs text-red-900 font-bold block">إجمالي المديونيات الحالية المتبقية</span>
              <span className="text-sm font-black text-red-950">
                {(summary?.totalOutstandingDebt || 0).toLocaleString('ar-EG')} ج.م
              </span>
            </div>
          </div>
          <span className="text-[11px] text-red-800 bg-red-100/70 px-2 py-0.5 rounded-md font-bold">
            مستحقات آجلة لدى التجار
          </span>
        </div>
      </div>

      {/* Filters & Period Selector Toolbar */}
      <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-xs space-y-4 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Period Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {(
              [
                { id: 'today', label: 'اليوم' },
                { id: 'yesterday', label: 'أمس' },
                { id: 'this_week', label: 'هذا الأسبوع' },
                { id: 'last_week', label: 'الأسبوع السابق' },
                { id: 'this_month', label: 'هذا الشهر' },
                { id: 'last_month', label: 'الشهر السابق' },
                { id: 'this_year', label: 'هذه السنة' },
                { id: 'last_year', label: 'السنة السابقة' },
                { id: 'custom', label: 'فترة مخصصة' },
              ] as { id: CollectionPeriod; label: string }[]
            ).map((tab) => {
              const active = period === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setPeriod(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Payment Method Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-slate-600">طريقة الدفع:</span>
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="all">كل طرق الدفع</option>
              <option value="Cash">💵 نقدي</option>
              <option value="Bank">🏦 تحويل بنكي</option>
              <option value="VodafoneCash">📱 فودافون كاش</option>
              <option value="Cheque">📝 شيك</option>
              <option value="Other">💳 أخرى</option>
            </select>
          </div>
        </div>

        {/* Custom Date Pickers if 'custom' is active */}
        {period === 'custom' && (
          <form
            onSubmit={handleCustomDateSubmit}
            className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3 bg-amber-50/40 p-3 rounded-xl border border-amber-200/50"
          >
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              <span>تحديد الفترة من:</span>
            </span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-400"
            />
            <span className="text-xs font-bold text-slate-700">إلى:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-400"
            />
            <button
              type="submit"
              className="px-3.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs"
            >
              تطبيق التصفية
            </button>
          </form>
        )}

        {/* Search Input Filter */}
        <form onSubmit={handleSearchSubmit} className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم، رقم الهاتف، رقم الفاتورة، أو اسم المحصل..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-20 pr-10 py-2.5 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
          <button
            type="submit"
            className="absolute left-2 top-1.5 px-3 py-1 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-lg text-xs font-black cursor-pointer transition-colors"
          >
            بحث
          </button>
        </form>
      </div>

      {/* Payment Method Breakdown for Selected Period */}
      <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
            <span>💳</span>
            <span>التحصيل حسب طريقة الدفع ({getPeriodLabel(period)})</span>
          </h3>
          <span className="text-xs text-slate-600 font-bold">
            عدد الحركات: {periodSummary?.transactionsCount || 0}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Cash */}
          <div className="bg-emerald-50/70 border border-emerald-200/70 rounded-xl p-3">
            <span className="text-[11px] font-bold text-emerald-800 block mb-1">
              💵 نقدي (Cash)
            </span>
            <div className="text-base md:text-lg font-black text-emerald-950">
              {(periodSummary?.byMethod?.Cash || 0).toLocaleString('ar-EG')}{' '}
              <span className="text-[10px] text-emerald-800 font-bold">ج.م</span>
            </div>
          </div>

          {/* Bank */}
          <div className="bg-blue-50/70 border border-blue-200/70 rounded-xl p-3">
            <span className="text-[11px] font-bold text-blue-800 block mb-1">
              🏦 تحويل بنكي
            </span>
            <div className="text-base md:text-lg font-black text-blue-950">
              {(periodSummary?.byMethod?.Bank || 0).toLocaleString('ar-EG')}{' '}
              <span className="text-[10px] text-blue-800 font-bold">ج.م</span>
            </div>
          </div>

          {/* Vodafone Cash */}
          <div className="bg-red-50/70 border border-red-200/70 rounded-xl p-3">
            <span className="text-[11px] font-bold text-red-800 block mb-1">
              📱 فودافون كاش
            </span>
            <div className="text-base md:text-lg font-black text-red-950">
              {(periodSummary?.byMethod?.VodafoneCash || 0).toLocaleString('ar-EG')}{' '}
              <span className="text-[10px] text-red-800 font-bold">ج.م</span>
            </div>
          </div>

          {/* Cheque */}
          <div className="bg-purple-50/70 border border-purple-200/70 rounded-xl p-3">
            <span className="text-[11px] font-bold text-purple-800 block mb-1">
              📝 شيكات
            </span>
            <div className="text-base md:text-lg font-black text-purple-950">
              {(periodSummary?.byMethod?.Cheque || 0).toLocaleString('ar-EG')}{' '}
              <span className="text-[10px] text-purple-800 font-bold">ج.م</span>
            </div>
          </div>

          {/* Other */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 col-span-2 sm:col-span-1">
            <span className="text-[11px] font-bold text-slate-800 block mb-1">
              💳 أخرى
            </span>
            <div className="text-base md:text-lg font-black text-slate-900">
              {(periodSummary?.byMethod?.Other || 0).toLocaleString('ar-EG')}{' '}
              <span className="text-[10px] text-slate-700 font-bold">ج.م</span>
            </div>
          </div>
        </div>
      </div>

      {/* Collections Transaction History Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
              <span>📋</span>
              <span>سجل التحصيل والمقبوضات ({getPeriodLabel(period)})</span>
            </h2>
            <span className="text-xs text-slate-600 font-medium">
              مرتب من الأحدث إلى الأقدم بناءً على تاريخ السداد الفعلي
            </span>
          </div>

          <div className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">
            إجمالي الحركات المعروضة: {payments.length} حركة
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black uppercase text-[11px]">
              <tr>
                <th className="py-3 px-3.5 text-center">#</th>
                <th className="py-3 px-3.5">التاريخ والوقت</th>
                <th className="py-3 px-3.5">العميل / المتجر</th>
                <th className="py-3 px-3.5">رقم الفاتورة / المرجع</th>
                <th className="py-3 px-3.5">طريقة الدفع</th>
                <th className="py-3 px-3.5">المبلغ المحصل</th>
                <th className="py-3 px-3.5">المحصل / المسؤول</th>
                <th className="py-3 px-3.5">البيان / ملاحظات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-600">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                      <span className="text-xs font-bold text-slate-700">جاري تحميل سجل التحصيل...</span>
                    </div>
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-600">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-2xl">
                        💰
                      </div>
                      <span className="text-sm font-bold text-slate-800">
                        لا توجد حركات تحصيل مسجلة خلال هذه الفترة
                      </span>
                      <span className="text-xs text-slate-600">
                        أي تحصيل يتم عند تسليم الطلبات أو سداد الحسابات سيظهر هنا فورًا
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                payments.map((pay, idx) => (
                  <tr key={pay.id || idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3.5 text-center text-slate-600 font-mono text-[11px]">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3.5 font-medium whitespace-nowrap text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        <span>{formatDateTime(pay.createdAt || pay.paymentDate)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-slate-900">{pay.customerName || 'عميل'}</div>
                      {pay.customerPhone && (
                        <div className="text-[11px] text-slate-600 font-mono flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-600" />
                          <span>{pay.customerPhone}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3.5 font-mono font-bold text-slate-700 whitespace-nowrap">
                      {pay.orderNumber ? (
                        <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                          {pay.orderNumber}
                        </span>
                      ) : (
                        <span className="text-slate-600 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-sans text-[11px] font-bold">
                          تحصيل حساب
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      {getMethodBadge(pay.paymentMethod)}
                    </td>
                    <td className="py-3 px-3.5 font-black text-emerald-700 text-sm whitespace-nowrap">
                      +{(pay.amount || 0).toLocaleString('ar-EG')}{' '}
                      <span className="text-[10px] text-slate-600 font-bold">ج.م</span>
                    </td>
                    <td className="py-3 px-3.5 text-slate-700 font-medium whitespace-nowrap">
                      <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[11px] font-bold">
                        {pay.collectedBy || 'محمد فوزي'}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-slate-600 text-[11px] max-w-xs truncate">
                      {pay.notes || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Table Footer Grand Total for the Period */}
            {payments.length > 0 && (
              <tfoot className="bg-slate-900 text-white font-black">
                <tr>
                  <td colSpan={5} className="py-3.5 px-4 text-left font-bold text-xs">
                    إجمالي التحصيل للفترة المحددة ({getPeriodLabel(period)}):
                  </td>
                  <td className="py-3.5 px-3.5 text-amber-400 text-base font-black tracking-tight whitespace-nowrap">
                    {(periodSummary?.totalCollected || 0).toLocaleString('ar-EG')} ج.م
                  </td>
                  <td colSpan={2} className="py-3.5 px-4 text-slate-300 text-xs font-normal">
                    {periodSummary?.transactionsCount} حركة تحصيل معتمدة
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
