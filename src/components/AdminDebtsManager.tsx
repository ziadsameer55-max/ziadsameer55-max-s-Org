import React, { useState, useEffect } from 'react';
import { CustomerDebtSummary, FinancialSummary, CustomerStatement, PaymentTransaction, Order } from '../types';
import {
  Wallet,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  FileText,
  Printer,
  Share2,
  Plus,
  RefreshCw,
  Phone,
  User,
  MapPin,
  Calendar,
  X,
  ArrowDownLeft,
  ChevronLeft,
  Check,
} from 'lucide-react';
import { apiFetch } from '../utils/api';
import { PrintStatementModal } from './PrintStatementModal';

interface AdminDebtsManagerProps {
  onOpenOrderDetails?: (orderId: string) => void;
  onRefreshData?: () => void;
}

export const AdminDebtsManager: React.FC<AdminDebtsManagerProps> = ({
  onOpenOrderDetails,
  onRefreshData,
}) => {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [customers, setCustomers] = useState<CustomerDebtSummary[]>([]);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'debtors' | 'allCustomers' | 'paymentsLog'>('debtors');

  // Modal States
  const [selectedStatement, setSelectedStatement] = useState<CustomerStatement | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [collectModalCustomer, setCollectModalCustomer] = useState<CustomerDebtSummary | null>(null);
  const [collectAmount, setCollectAmount] = useState<string>('');
  const [collectMethod, setCollectMethod] = useState<'Cash' | 'Bank' | 'VodafoneCash' | 'Cheque'>('Cash');
  const [collectNotes, setCollectNotes] = useState('');
  const [collecting, setCollecting] = useState(false);
  const [collectError, setCollectError] = useState('');
  const [collectSuccess, setCollectSuccess] = useState('');

  // Full Debt Settlement Modal State
  const [fullCollectCustomer, setFullCollectCustomer] = useState<CustomerDebtSummary | null>(null);
  const [fullCollecting, setFullCollecting] = useState(false);
  const [fullCollectMethod, setFullCollectMethod] = useState<'Cash' | 'Bank' | 'VodafoneCash' | 'Cheque'>('Cash');
  const [fullCollectNotes, setFullCollectNotes] = useState('');
  const [fullCollectError, setFullCollectError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleExecuteFullSettlement = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!fullCollectCustomer) return;

    setFullCollecting(true);
    setFullCollectError('');

    try {
      const res = await apiFetch(`/api/customers/${encodeURIComponent(fullCollectCustomer.customerId)}/settle-full`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: fullCollectMethod,
          notes: fullCollectNotes.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const settledAmount = Number(data.settledAmount || fullCollectCustomer.totalDebt);
        showToast('✅ تم تحصيل كامل مديونية العميل بنجاح');

        // Update local customers state immediately without page refresh
        setCustomers((prev) =>
          prev.map((c) => {
            if (c.customerId === fullCollectCustomer.customerId) {
              return {
                ...c,
                totalPaid: (c.totalPaid || 0) + settledAmount,
                totalDebt: 0,
                paidOrdersCount: (c.paidOrdersCount || 0) + (c.unpaidOrdersCount || 0),
                unpaidOrdersCount: 0,
              };
            }
            return c;
          })
        );

        // Update summary state immediately
        setSummary((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            totalCollected: (prev.totalCollected || 0) + settledAmount,
            totalOutstandingDebt: Math.max(0, (prev.totalOutstandingDebt || 0) - settledAmount),
            debtorsCount: Math.max(0, (prev.debtorsCount || 0) - 1),
            paidOrdersCount: (prev.paidOrdersCount || 0) + (fullCollectCustomer.unpaidOrdersCount || 1),
            unpaidOrdersCount: Math.max(0, (prev.unpaidOrdersCount || 0) - (fullCollectCustomer.unpaidOrdersCount || 1)),
          };
        });

        // If statement modal is open, update its content immediately
        if (selectedStatement && (selectedStatement.customer.id === fullCollectCustomer.customerId || selectedStatement.customer.phone === fullCollectCustomer.customerPhone)) {
          setSelectedStatement((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              summary: {
                ...prev.summary,
                totalPaid: (prev.summary.totalPaid || 0) + settledAmount,
                totalDebt: 0,
              },
              orders: (prev.orders || []).map((ord) => ({
                ...ord,
                paidAmount: ord.grandTotal,
                remainingBalance: 0,
                paymentStatus: 'Paid',
              })),
            };
          });
        }

        setFullCollectCustomer(null);
        fetchDebtsData();
        if (onRefreshData) onRefreshData();
      } else {
        setFullCollectError(data.error || 'حدث خطأ أثناء تنفيذ التحصيل الكامل');
      }
    } catch (err: any) {
      setFullCollectError('تعذر الاتصال بالخادم');
    } finally {
      setFullCollecting(false);
    }
  };

  const fetchDebtsData = async () => {
    setLoading(true);
    try {
      const [debtsRes, paymentsRes] = await Promise.all([
        apiFetch('/api/debts'),
        apiFetch('/api/payments'),
      ]);

      if (debtsRes.ok) {
        const data = await debtsRes.json();
        setSummary(data?.summary || null);
        setCustomers(Array.isArray(data?.customers) ? data.customers : []);
      }

      if (paymentsRes.ok) {
        const pData = await paymentsRes.json();
        setPayments(Array.isArray(pData) ? pData : []);
      }
    } catch (err) {
      console.error('Failed to load debts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebtsData();
  }, []);

  const openStatement = async (customerId: string) => {
    setStatementLoading(true);
    try {
      const res = await apiFetch(`/api/customers/${encodeURIComponent(customerId)}/statement`);
      if (res.ok) {
        const data = await res.json();
        setSelectedStatement(data);
      }
    } catch (err) {
      console.error('Failed to load statement:', err);
    } finally {
      setStatementLoading(false);
    }
  };

  const handleOpenCollectModal = (customer: CustomerDebtSummary) => {
    setCollectModalCustomer(customer);
    setCollectAmount(customer.totalDebt > 0 ? String(customer.totalDebt) : '');
    setCollectMethod('Cash');
    setCollectNotes('');
    setCollectError('');
    setCollectSuccess('');
  };

  const submitCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectModalCustomer) return;

    const numAmount = parseFloat(collectAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setCollectError('يرجى إدخال مبلغ تحصيل صحيح أكبر من الصفر');
      return;
    }

    if (numAmount > collectModalCustomer.totalDebt && collectModalCustomer.totalDebt > 0) {
      setCollectError(`لا يمكن تحصيل مبلغ (${numAmount} ج) أكبر من إجمالي المديونية (${collectModalCustomer.totalDebt} ج)`);
      return;
    }

    setCollecting(true);
    setCollectError('');

    try {
      const res = await apiFetch(`/api/customers/${encodeURIComponent(collectModalCustomer.customerId)}/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numAmount,
          paymentMethod: collectMethod,
          collectedBy: 'محمد فوزي',
          notes: collectNotes.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCollectSuccess(`تم تسجيل تحصيل مبلغ ${numAmount.toLocaleString('ar-EG')} ج بنجاح!`);
        setTimeout(() => {
          setCollectModalCustomer(null);
          setCollectSuccess('');
          fetchDebtsData();
          if (onRefreshData) onRefreshData();
        }, 1200);
      } else {
        setCollectError(data.error || 'حدث خطأ أثناء تسجيل التحصيل');
      }
    } catch (err: any) {
      setCollectError('تعذر الاتصال بالخادم');
    } finally {
      setCollecting(false);
    }
  };

  const shareStatementOnWhatsApp = (statement: CustomerStatement) => {
    const text = `*شركة الحليم للتجارة والتوزيع*
*كشف حساب العميل:* ${statement.customer?.name || ''}
📞 رقم الهاتف: ${statement.customer?.phone || ''}
----------------------------------------
📊 *الملخص المالي:*
- إجمالي قيمة الفواتير: ${(statement.summary?.totalInvoiced || 0).toLocaleString('ar-EG')} جنيه
- إجمالي المبالغ المسددة: ${(statement.summary?.totalPaid || 0).toLocaleString('ar-EG')} جنيه
- 🔴 *صافي المتبقي والمديونية:* ${(statement.summary?.totalDebt || 0).toLocaleString('ar-EG')} جنيه
----------------------------------------
تاريخ الكشف: ${new Date().toLocaleDateString('ar-EG')}
المندوب المسئول: محمد فوزي (01000000000)`;

    const url = `https://wa.me/20${statement.customer.phone.replace(/^0+/, '')}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const safeCustomers = Array.isArray(customers) ? customers : [];
  const filteredCustomers = safeCustomers.filter((c) => {
    if (activeTab === 'debtors' && (c.totalDebt || 0) <= 0) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        (c.customerName || '').toLowerCase().includes(q) ||
        (c.customerPhone || '').includes(q) ||
        (c.address && c.address.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const safePayments = Array.isArray(payments) ? payments : [];
  const filteredPayments = safePayments.filter((p) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        (p.customerName || '').toLowerCase().includes(q) ||
        (p.customerPhone && p.customerPhone.includes(q)) ||
        (p.orderNumber && p.orderNumber.toLowerCase().includes(q)) ||
        (p.collectedBy && p.collectedBy.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-4 text-right pb-24 max-w-5xl mx-auto" dir="rtl">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-emerald-800 text-white px-5 py-3 rounded-2xl shadow-2xl font-black text-sm flex items-center gap-2.5 border border-emerald-600 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xl">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-black text-base sm:text-lg">
              إدارة التحصيل والمديونيات والمقبوضات
            </h2>
            <p className="text-xs text-slate-400">
              متابعة حسابات العملاء، الفواتير الآجلة، وتسجيل دفعات التسليم النقدية
            </p>
          </div>
        </div>

        <button
          onClick={fetchDebtsData}
          disabled={loading}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>تحديث البيانات</span>
        </button>
      </div>

      {/* 4 Financial Indicator Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Sales */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs">
          <div className="text-xs font-bold text-slate-500 flex items-center justify-between">
            <span>إجمالي المبيعات</span>
            <span className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="font-black text-lg sm:text-xl text-slate-900 font-mono mt-1">
            {(summary?.totalSales || 0).toLocaleString('ar-EG')} ج
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            إجمالي {summary?.totalOrdersCount || 0} طلب نشط
          </div>
        </div>

        {/* Total Collected */}
        <div className="bg-white border border-emerald-200 rounded-2xl p-3.5 shadow-xs bg-emerald-50/20">
          <div className="text-xs font-bold text-emerald-800 flex items-center justify-between">
            <span>المبالغ المحصلة 🟢</span>
            <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="font-black text-lg sm:text-xl text-emerald-800 font-mono mt-1">
            {(summary?.totalCollected || 0).toLocaleString('ar-EG')} ج
          </div>
          <div className="text-[11px] text-emerald-800 font-bold mt-0.5 flex flex-wrap items-center gap-1.5">
            {summary?.collectedToday !== undefined && (
              <span>اليوم: {summary.collectedToday.toLocaleString('ar-EG')} ج</span>
            )}
            {summary?.collectedThisMonth !== undefined && (
              <span>• الشهر: {summary.collectedThisMonth.toLocaleString('ar-EG')} ج</span>
            )}
          </div>
        </div>

        {/* Deferred / Partial */}
        <div className="bg-white border border-amber-200 rounded-2xl p-3.5 shadow-xs bg-amber-50/20">
          <div className="text-xs font-bold text-amber-800 flex items-center justify-between">
            <span>فواتير جزئية 🟡</span>
            <span className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="font-black text-lg sm:text-xl text-amber-900 font-mono mt-1">
            {summary?.partialOrdersCount || 0} فاتورة
          </div>
          <div className="text-[11px] text-amber-700 mt-0.5">
            {summary?.unpaidOrdersCount || 0} فاتورة آجلة بالكامل
          </div>
        </div>

        {/* Total Outstanding Debt */}
        <div className="bg-white border border-red-200 rounded-2xl p-3.5 shadow-xs bg-red-50/20">
          <div className="text-xs font-bold text-red-800 flex items-center justify-between">
            <span>إجمالي المديونيات 🔴</span>
            <span className="p-1.5 bg-red-100 text-red-800 rounded-lg">
              <AlertCircle className="w-4 h-4" />
            </span>
          </div>
          <div className="font-black text-lg sm:text-xl text-red-700 font-mono mt-1">
            {(summary?.totalOutstandingDebt || 0).toLocaleString('ar-EG')} ج
          </div>
          <div className="text-[11px] text-red-600 font-bold mt-0.5">
            على {summary?.debtorsCount || 0} عميل
          </div>
        </div>
      </div>

      {/* Tabs & Search Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('debtors')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
              activeTab === 'debtors'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-200'
            }`}
          >
            🔴 العملاء المدينون ({customers.filter((c) => c.totalDebt > 0).length})
          </button>

          <button
            onClick={() => setActiveTab('allCustomers')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
              activeTab === 'allCustomers'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-200'
            }`}
          >
            👥 كل العملاء ({customers.length})
          </button>

          <button
            onClick={() => setActiveTab('paymentsLog')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
              activeTab === 'paymentsLog'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-200'
            }`}
          >
            📋 سجل المقبوضات ({payments.length})
          </button>
        </div>

        {/* Search input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="بحث باسم العميل أو رقم الهاتف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-9 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:outline-hidden focus:border-amber-500"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin text-amber-500 mb-2" />
          <p className="text-xs font-bold">جاري تحميل بيانات المديونيات والتحصيل...</p>
        </div>
      ) : activeTab === 'paymentsLog' ? (
        /* Payments Log List */
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700 flex justify-between items-center">
            <span>سجل عمليات التحصيل والمقبوضات المسجلة</span>
            <span className="font-mono text-emerald-800">{filteredPayments.length} عملية</span>
          </div>

          {filteredPayments.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-bold">
              لا توجد مقبوضات مسجلة تطابق البحث
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {filteredPayments.map((p) => (
                <div key={p.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold shrink-0 mt-0.5">
                      <ArrowDownLeft className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>{p.customerName}</span>
                        {p.orderNumber && (
                          <span className="text-[11px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-bold">
                            {p.orderNumber}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex flex-wrap gap-2">
                        <span>📅 {p.paymentDate}</span>
                        <span>👤 المحصل: {p.collectedBy}</span>
                        <span>💳 الطريقة: {p.paymentMethod === 'Cash' ? 'نقدًا' : p.paymentMethod}</span>
                      </div>
                      {p.notes && (
                        <p className="text-[11px] text-slate-600 mt-1 italic">
                          "{p.notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-left font-mono shrink-0">
                    <span className="text-sm font-black text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      + {(p.amount || 0).toLocaleString('ar-EG')} ج
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Customers Debts List */
        <div className="space-y-2.5">
          {filteredCustomers.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 space-y-1">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 opacity-60" />
              <p className="text-xs font-bold text-slate-700">لا توجد حسابات أو مديونيات مطابقة للبحث</p>
            </div>
          ) : (
            filteredCustomers.map((cust) => {
              const hasDebt = cust.totalDebt > 0;

              return (
                <div
                  key={cust.customerId}
                  className={`bg-white border rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 transition-colors ${
                    hasDebt ? 'border-red-200 hover:border-red-300' : 'border-slate-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 text-sm sm:text-base">
                        {cust.customerName}
                      </span>
                      {hasDebt ? (
                        <span className="text-[10px] bg-red-100 text-red-800 border border-red-300 font-bold px-2 py-0.5 rounded-full">
                          مطلوب سداد
                        </span>
                      ) : (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-0.5 rounded-full">
                          خالص الحساب ✅
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-mono">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        <span>{cust.customerPhone}</span>
                      </span>
                      {cust.address && (
                        <span className="flex items-center gap-1 font-sans">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{cust.address}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Numbers Grid */}
                  <div className="grid grid-cols-3 gap-2 w-full md:w-auto text-center font-mono text-xs bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <div className="px-2">
                      <span className="text-[10px] text-slate-500 font-sans block">إجمالي الفواتير</span>
                      <span className="font-bold text-slate-800">
                        {(cust.totalInvoiced || 0).toLocaleString('ar-EG')} ج
                      </span>
                    </div>

                    <div className="px-2 border-r border-l border-slate-200">
                      <span className="text-[10px] text-slate-500 font-sans block">المسدد</span>
                      <span className="font-bold text-emerald-800">
                        {(cust.totalPaid || 0).toLocaleString('ar-EG')} ج
                      </span>
                    </div>

                    <div className="px-2">
                      <span className="text-[10px] text-slate-500 font-sans block">المديونية (المتبقي)</span>
                      <span className={`font-black text-sm ${hasDebt ? 'text-red-700' : 'text-slate-400'}`}>
                        {(cust.totalDebt || 0).toLocaleString('ar-EG')} ج
                      </span>
                    </div>
                  </div>

                  {/* Actions: 🟡 تحصيل جزئي | 🟢 تم التحصيل الكامل | 📋 كشف حساب */}
                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end pt-1 md:pt-0">
                    {hasDebt && (
                      <>
                        {/* 🟡 تحصيل جزئي */}
                        <button
                          onClick={() => handleOpenCollectModal(cust)}
                          className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 border border-amber-400 hover:scale-[1.02] active:scale-[0.98]"
                          title="تسجيل دفعة جزئية بمبلغ يحدده الأدمن"
                        >
                          <DollarSign className="w-3.5 h-3.5 text-slate-950" />
                          <span>تحصيل جزئي</span>
                        </button>

                        {/* 🟢 تم التحصيل الكامل */}
                        <button
                          onClick={() => {
                            setFullCollectCustomer(cust);
                            setFullCollectMethod('Cash');
                            setFullCollectNotes('');
                            setFullCollectError('');
                          }}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 border border-emerald-500 hover:scale-[1.02] active:scale-[0.98]"
                          title="تحصيل كامل المبلغ المستحق وتصفير المديونية فورًا"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>تم التحصيل الكامل</span>
                        </button>
                      </>
                    )}

                    {/* 📋 كشف حساب */}
                    <button
                      onClick={() => openStatement(cust.customerId)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 border border-slate-300"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-600" />
                      <span>كشف حساب</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Collect Payment Modal */}
      {collectModalCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 text-right shadow-2xl text-slate-800 relative animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">
                    تسجيل تحصيل مالي من العميل
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">{collectModalCustomer.customerName}</p>
                </div>
              </div>

              <button
                onClick={() => setCollectModalCustomer(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Debt Box */}
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-red-800 font-bold block">إجمالي المديونية الحالية:</span>
                <span className="text-xs text-red-600">الفواتير غير المسددة أو الجزئية</span>
              </div>
              <span className="font-black text-lg text-red-700 font-mono">
                {(collectModalCustomer.totalDebt || 0).toLocaleString('ar-EG')} جنيه
              </span>
            </div>

            {collectError && (
              <div className="mb-3 p-2.5 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{collectError}</span>
              </div>
            )}

            {collectSuccess && (
              <div className="mb-3 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold flex items-center gap-1.5">
                <Check className="w-4 h-4 shrink-0" />
                <span>{collectSuccess}</span>
              </div>
            )}

            <form onSubmit={submitCollection} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  المبلغ المحصل (جنيه) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  max={collectModalCustomer.totalDebt}
                  required
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-mono text-base font-bold focus:outline-hidden focus:border-emerald-600"
                  placeholder="أدخل المبلغ المحصل..."
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">طريقة التحصيل</label>
                <select
                  value={collectMethod}
                  onChange={(e) => setCollectMethod(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold"
                >
                  <option value="Cash">💵 نقدًا (كاش مع المندوب محمد فوزي)</option>
                  <option value="VodafoneCash">📱 فودافون كاش / محفظة إلكترونية</option>
                  <option value="Bank">🏦 تحويل بنكي / إنستاباي</option>
                  <option value="Cheque">📜 شيك تجاري</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات التحصيل (اختياري)</label>
                <input
                  type="text"
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                  placeholder="مثال: دفعة من حساب فاتورة الأسبوع الماضي"
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              {/* Fast Remaining Calculation Preview */}
              {parseFloat(collectAmount) > 0 && (
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex justify-between font-mono font-bold text-slate-700">
                  <span>المتبقي بعد هذا التحصيل:</span>
                  <span className="text-slate-900">
                    {Math.max(0, (collectModalCustomer.totalDebt || 0) - (parseFloat(collectAmount) || 0)).toLocaleString('ar-EG')} ج
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCollectModalCustomer(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={collecting}
                  className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {collecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>تأكيد تسجيل التحصيل</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Detailed Statement Modal */}
      {selectedStatement && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-5 text-right shadow-2xl text-slate-800 relative my-8 animate-fadeIn max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
              <div>
                <h3 className="font-black text-base sm:text-lg text-slate-900">
                  كشف حساب العميل: {selectedStatement.customer.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  📞 {selectedStatement.customer.phone} • {selectedStatement.customer.address || 'الإسكندرية'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPrintModalOpen(true)}
                  className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-colors shadow-2xs"
                  title="طباعة كشف الحساب"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة</span>
                </button>

                <button
                  onClick={() => shareStatementOnWhatsApp(selectedStatement)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-colors"
                  title="إرسال كشف الحساب للعميل عبر واتساب"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>واتساب</span>
                </button>

                <button
                  onClick={() => setSelectedStatement(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Statement Summary 3 Metrics */}
            <div className="grid grid-cols-3 gap-2 text-center p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono mb-3">
              <div>
                <span className="text-[10px] text-slate-500 font-sans block">إجمالي الفواتير</span>
                <span className="font-black text-slate-900 text-sm">
                  {(selectedStatement.summary?.totalInvoiced || 0).toLocaleString('ar-EG')} ج
                </span>
              </div>
              <div className="border-r border-l border-slate-200">
                <span className="text-[10px] text-slate-500 font-sans block">إجمالي المسدد</span>
                <span className="font-black text-emerald-800 text-sm">
                  {(selectedStatement.summary?.totalPaid || 0).toLocaleString('ar-EG')} ج
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-sans block">الصافي المتبقي</span>
                <span className="font-black text-red-700 text-sm">
                  {(selectedStatement.summary?.totalDebt || 0).toLocaleString('ar-EG')} ج
                </span>
              </div>
            </div>

            {/* Invoices List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              <div>
                <h4 className="font-bold text-xs text-slate-700 mb-1.5">
                  سجل الفواتير والطلبات ({selectedStatement.orders?.length || 0})
                </h4>
                <div className="space-y-1.5">
                  {(selectedStatement.orders || []).map((ord) => {
                    const isPaid = ord.paymentStatus === 'Paid';
                    const isPartial = ord.paymentStatus === 'Partial';

                    return (
                      <div
                        key={ord.id}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900 font-mono">{ord.orderNumber}</span>
                            <span className="text-slate-500 font-mono text-[11px]">{ord.createdAt}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                isPaid
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isPartial
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {isPaid ? 'مدفوعة بالكامل' : isPartial ? 'مدفوعة جزئيًا' : 'غير مدفوعة (أجل)'}
                            </span>
                          </div>
                        </div>

                        <div className="text-left font-mono">
                          <div className="font-bold text-slate-800">{(ord.grandTotal || 0).toLocaleString('ar-EG')} ج</div>
                          {(ord.remainingBalance || 0) > 0 && (
                            <div className="text-[10px] text-red-700 font-bold">
                              متبقي: {(ord.remainingBalance || 0).toLocaleString('ar-EG')} ج
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Payments History */}
              {(selectedStatement.payments || []).length > 0 && (
                <div>
                  <h4 className="font-bold text-xs text-slate-700 mb-1.5">
                    سجل التحصيلات والدفعات ({selectedStatement.payments.length})
                  </h4>
                  <div className="space-y-1.5">
                    {selectedStatement.payments.map((pay) => (
                      <div
                        key={pay.id}
                        className="p-2 bg-emerald-50/50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-emerald-900">
                            سداد دفعة {(pay.amount || 0).toLocaleString('ar-EG')} ج
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {pay.paymentDate} • بواسطة {pay.collectedBy}
                          </div>
                        </div>
                        <span className="font-mono font-bold text-emerald-800">
                          + {(pay.amount || 0).toLocaleString('ar-EG')} ج
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="pt-3 border-t border-slate-200 mt-3 flex flex-wrap justify-between items-center gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {/* 🟡 تحصيل جزئي */}
                <button
                  onClick={() => {
                    const custObj = customers.find((c) => c.customerId === selectedStatement.customer.id);
                    if (custObj) {
                      handleOpenCollectModal(custObj);
                    }
                  }}
                  disabled={selectedStatement.summary.totalDebt <= 0}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-xs transition-all disabled:opacity-40 flex items-center gap-1.5 border border-amber-400"
                >
                  <DollarSign className="w-3.5 h-3.5 text-slate-950" />
                  <span>تحصيل جزئي</span>
                </button>

                {/* 🟢 تم التحصيل الكامل */}
                {selectedStatement.summary.totalDebt > 0 && (
                  <button
                    onClick={() => {
                      const custObj = customers.find((c) => c.customerId === selectedStatement.customer.id) || {
                        customerId: selectedStatement.customer.id,
                        customerName: selectedStatement.customer.name,
                        customerPhone: selectedStatement.customer.phone,
                        address: selectedStatement.customer.address,
                        totalInvoiced: selectedStatement.summary.totalInvoiced,
                        totalPaid: selectedStatement.summary.totalPaid,
                        totalDebt: selectedStatement.summary.totalDebt,
                        unpaidOrdersCount: selectedStatement.orders.filter((o) => (o.remainingBalance || 0) > 0).length,
                        paidOrdersCount: selectedStatement.orders.filter((o) => (o.remainingBalance || 0) <= 0).length,
                      };
                      setFullCollectCustomer(custObj);
                      setFullCollectMethod('Cash');
                      setFullCollectNotes('');
                      setFullCollectError('');
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 border border-emerald-500"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تم التحصيل الكامل</span>
                  </button>
                )}
              </div>

              <button
                onClick={() => setSelectedStatement(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Debt Collection Confirmation Dialog Modal */}
      {fullCollectCustomer && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-5 sm:p-6 text-right shadow-2xl text-slate-800 relative">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-slate-900">
                    تأكيد التحصيل الكامل
                  </h3>
                  <p className="text-xs text-slate-500 font-bold">
                    تسجيل سداد وتصفير كامل مديونية العميل
                  </p>
                </div>
              </div>

              <button
                onClick={() => setFullCollectCustomer(null)}
                disabled={fullCollecting}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Prominent Confirmation Question */}
            <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-2xl mb-4 text-emerald-950">
              <div className="font-black text-sm text-center mb-1">
                هل تم تحصيل كامل المبلغ المستحق من هذا العميل؟
              </div>
              <p className="text-[11px] text-emerald-800 text-center font-medium">
                سيتم سداد وتحديث جميع الفواتير الآجلة والجزئية تلقائياً وتسجيل الدفعة في سجل المقبوضات.
              </p>
            </div>

            {/* Customer & Debt Overview Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs text-slate-500 font-bold">اسم العميل:</span>
                <span className="font-black text-slate-900 text-sm">{fullCollectCustomer.customerName}</span>
              </div>

              {fullCollectCustomer.customerPhone && (
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs text-slate-500 font-bold">رقم الهاتف:</span>
                  <span className="font-mono font-bold text-slate-700 text-xs">{fullCollectCustomer.customerPhone}</span>
                </div>
              )}

              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs text-red-700 font-black">إجمالي المديونية الحالية:</span>
                <span className="font-black text-base text-red-700 font-mono">
                  {(fullCollectCustomer.totalDebt || 0).toLocaleString('ar-EG')} ج.م
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-200 pb-2 bg-emerald-100/60 p-2 rounded-xl">
                <span className="text-xs text-emerald-900 font-black">المبلغ الذي سيتم تحصيله:</span>
                <span className="font-black text-base text-emerald-900 font-mono">
                  {(fullCollectCustomer.totalDebt || 0).toLocaleString('ar-EG')} ج.م
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-600 font-bold">المتبقي بعد التحصيل:</span>
                <span className="font-black text-sm text-emerald-700 font-mono bg-white px-2.5 py-0.5 rounded-lg border border-emerald-200">
                  0 ج.م (خالص الحساب ✅)
                </span>
              </div>
            </div>

            {/* Payment Method & Notes */}
            <form onSubmit={handleExecuteFullSettlement} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  طريقة التحصيل
                </label>
                <select
                  value={fullCollectMethod}
                  onChange={(e) => setFullCollectMethod(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:outline-hidden focus:border-emerald-700"
                >
                  <option value="Cash">نقدًا (كاش مع المندوب / الخزينة)</option>
                  <option value="VodafoneCash">فودافون كاش / محافظ إلكترونية</option>
                  <option value="Bank">تحويل بنكي / إنستاباي</option>
                  <option value="Cheque">شيك بنكي مقبول الدفع</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ملاحظات إضافية على التحصيل (اختياري)
                </label>
                <input
                  type="text"
                  placeholder="مثال: تم الاستلام نقدًا بالكامل بالمحل"
                  value={fullCollectNotes}
                  onChange={(e) => setFullCollectNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-hidden focus:border-emerald-700"
                />
              </div>

              {fullCollectError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{fullCollectError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setFullCollectCustomer(null)}
                  disabled={fullCollecting}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={fullCollecting}
                  className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl shadow-md transition-all text-xs disabled:opacity-50 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {fullCollecting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جاري تنفيذ التحصيل...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تأكيد التحصيل الكامل</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Statement Modal */}
      {isPrintModalOpen && selectedStatement && (
        <PrintStatementModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          customer={{
            id: selectedStatement.customer.id,
            name: selectedStatement.customer.name,
            phone: selectedStatement.customer.phone,
            storeName: selectedStatement.customer.storeName,
            address: selectedStatement.customer.address || 'محافظة الإسكندرية - بجوار مسجد القويري - بوابة 8',
          }}
          settings={null}
          orders={selectedStatement.orders || []}
          payments={selectedStatement.payments || []}
          summary={selectedStatement.summary}
        />
      )}
    </div>
  );
};
