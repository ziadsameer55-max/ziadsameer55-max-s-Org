import React, { useState, useEffect } from 'react';
import { AdminCustomerRecord, CustomerStatement, Order } from '../types';
import {
  Users,
  Search,
  RefreshCw,
  Phone,
  Store,
  MapPin,
  Calendar,
  DollarSign,
  ShoppingBag,
  AlertCircle,
  CheckCircle2,
  Check,
  Lock,
  Unlock,
  Eye,
  FileText,
  Printer,
  ChevronLeft,
  X,
  UserCheck,
  Building2,
  Clock,
} from 'lucide-react';
import { apiFetch } from '../utils/api';
import { PrintStatementModal } from './PrintStatementModal';

interface AdminCustomersManagerProps {
  onOpenOrderDetails?: (orderId: string) => void;
  onRefreshData?: () => void;
}

export const AdminCustomersManager: React.FC<AdminCustomersManagerProps> = ({
  onOpenOrderDetails,
  onRefreshData,
}) => {
  const [customers, setCustomers] = useState<AdminCustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'disabled' | 'withDebt'>('all');

  // Customer Statement Modal State
  const [selectedStatement, setSelectedStatement] = useState<CustomerStatement | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Status Toggle State
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Partial Debt Collection State
  const [partialCollectCustomer, setPartialCollectCustomer] = useState<{
    id: string;
    fullName: string;
    phone?: string;
    currentDebt: number;
  } | null>(null);
  const [partialCollectAmount, setPartialCollectAmount] = useState('');
  const [partialCollectMethod, setPartialCollectMethod] = useState<'Cash' | 'Bank' | 'VodafoneCash' | 'Cheque'>('Cash');
  const [partialCollectNotes, setPartialCollectNotes] = useState('');
  const [partialCollecting, setPartialCollecting] = useState(false);
  const [partialCollectError, setPartialCollectError] = useState('');

  // Full Debt Settlement State
  const [fullCollectCustomer, setFullCollectCustomer] = useState<{
    id: string;
    fullName: string;
    phone?: string;
    currentDebt: number;
  } | null>(null);
  const [fullCollecting, setFullCollecting] = useState(false);
  const [fullCollectMethod, setFullCollectMethod] = useState<'Cash' | 'Bank' | 'VodafoneCash' | 'Cheque'>('Cash');
  const [fullCollectNotes, setFullCollectNotes] = useState('');
  const [fullCollectError, setFullCollectError] = useState('');

  const handleExecutePartialCollection = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!partialCollectCustomer) return;

    const amt = parseFloat(partialCollectAmount);
    if (isNaN(amt) || amt <= 0) {
      setPartialCollectError('يرجى إدخال مبلغ تحصيل صحيح أكبر من صفر');
      return;
    }

    if (amt > partialCollectCustomer.currentDebt) {
      setPartialCollectError(`المبلغ المدخل (${amt.toLocaleString('ar-EG')} ج) يتجاوز إجمالي مديونية العميل (${partialCollectCustomer.currentDebt.toLocaleString('ar-EG')} ج)`);
      return;
    }

    setPartialCollecting(true);
    setPartialCollectError('');

    try {
      const res = await apiFetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: partialCollectCustomer.id,
          customerName: partialCollectCustomer.fullName,
          customerPhone: partialCollectCustomer.phone,
          amount: amt,
          paymentMethod: partialCollectMethod,
          notes: partialCollectNotes.trim() || `دفعة جزئية من الحساب`,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFeedbackMsg({ text: `✅ تم تسجيل تحصيل مبلغ ${amt.toLocaleString('ar-EG')} ج.م بنجاح`, type: 'success' });

        // Update local state without reload
        setCustomers((prev) =>
          (prev || []).map((c) => {
            if (c.id === partialCollectCustomer.id) {
              const newDebt = Math.max(0, (c.currentDebt || 0) - amt);
              return {
                ...c,
                currentDebt: newDebt,
                totalPaid: (c.totalPaid || 0) + amt,
              };
            }
            return c;
          })
        );

        setPartialCollectCustomer(null);
        setPartialCollectAmount('');
        setPartialCollectNotes('');
        if (onRefreshData) onRefreshData();
      } else {
        setPartialCollectError(data.error || 'حدث خطأ أثناء تسجيل الدفعة');
      }
    } catch {
      setPartialCollectError('تعذر الاتصال بالخادم');
    } finally {
      setPartialCollecting(false);
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  const handleExecuteFullSettlement = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!fullCollectCustomer) return;

    setFullCollecting(true);
    setFullCollectError('');

    try {
      const res = await apiFetch(`/api/customers/${encodeURIComponent(fullCollectCustomer.id)}/settle-full`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: fullCollectMethod,
          notes: fullCollectNotes.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const settledAmount = Number(data.settledAmount || fullCollectCustomer.currentDebt);
        setFeedbackMsg({ text: '✅ تم تحصيل كامل مديونية العميل بنجاح', type: 'success' });

        // Update local state without reload
        setCustomers((prev) =>
          (prev || []).map((c) => {
            if (c.id === fullCollectCustomer.id) {
              return {
                ...c,
                currentDebt: 0,
                totalPaid: (c.totalPaid || 0) + settledAmount,
              };
            }
            return c;
          })
        );

        // Update selected statement if open
        if (selectedStatement && (selectedStatement.customer.id === fullCollectCustomer.id || selectedStatement.customer.phone === fullCollectCustomer.phone)) {
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
        if (onRefreshData) onRefreshData();
      } else {
        setFullCollectError(data.error || 'حدث خطأ أثناء تنفيذ التحصيل الكامل');
      }
    } catch {
      setFullCollectError('تعذر الاتصال بالخادم');
    } finally {
      setFullCollecting(false);
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/customers');
      if (res.ok) {
        const data = await res.json();
        setCustomers(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const openCustomerStatement = async (customerId: string) => {
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

  const handleToggleStatus = async (customer: AdminCustomerRecord) => {
    const newStatus = customer.status === 'active' ? 'disabled' : 'active';
    const confirmText =
      newStatus === 'disabled'
        ? `هل أنت متأكد من تعطيل حساب "${customer.fullName}"؟ لن يتمكن من تسجيل الدخول أو إرسال طلبات جديدة.`
        : `هل أنت متأكد من إعادة تفعيل حساب "${customer.fullName}"؟`;

    if (!window.confirm(confirmText)) return;

    setActionLoadingId(customer.id);
    setFeedbackMsg(null);

    try {
      const res = await apiFetch(`/api/admin/customers/${encodeURIComponent(customer.id)}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCustomers((prev) =>
          (prev || []).map((c) => (c.id === customer.id ? { ...c, status: newStatus } : c))
        );
        setFeedbackMsg({ text: data.message || 'تم تحديث حالة الحساب بنجاح', type: 'success' });
        if (onRefreshData) onRefreshData();
      } else {
        setFeedbackMsg({ text: data.error || 'تعذر تغيير حالة الحساب', type: 'error' });
      }
    } catch {
      setFeedbackMsg({ text: 'حدث خطأ أثناء الاتصال بالخادم', type: 'error' });
    } finally {
      setActionLoadingId(null);
      setTimeout(() => setFeedbackMsg(null), 3000);
    }
  };

  const safeCustomers = Array.isArray(customers) ? customers : [];
  const filteredCustomers = safeCustomers.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    const matchQuery =
      !q ||
      c.fullName.toLowerCase().includes(q) ||
      c.storeName.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.id.toLowerCase().includes(q);

    if (!matchQuery) return false;

    if (filterStatus === 'active') return c.status === 'active';
    if (filterStatus === 'disabled') return c.status === 'disabled';
    if (filterStatus === 'withDebt') return c.currentDebt > 0;

    return true;
  });

  const totalRegistered = safeCustomers.length;
  const activeCount = safeCustomers.filter((c) => c.status === 'active').length;
  const disabledCount = safeCustomers.filter((c) => c.status === 'disabled').length;
  const totalDebts = safeCustomers.reduce((sum, c) => sum + (c.currentDebt || 0), 0);

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header & Stats */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-800" />
              <span>إدارة حسابات العملاء والتجار</span>
            </h2>
            <p className="text-xs text-slate-500 font-bold mt-0.5">
              متابعة حسابات التجار المسجلين، فواتيرهم، مديونياتهم والتحكم في تفعيل أو تعطيل الحسابات
            </p>
          </div>

          <button
            onClick={fetchCustomers}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث البيانات</span>
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-right">
            <div className="text-[11px] font-bold text-slate-500 mb-1">إجمالي الحسابات</div>
            <div className="text-lg font-black text-slate-900">{totalRegistered} تاجر</div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-right">
            <div className="text-[11px] font-bold text-emerald-700 mb-1">حسابات نشطة</div>
            <div className="text-lg font-black text-emerald-900">{activeCount} حساب</div>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-right">
            <div className="text-[11px] font-bold text-rose-700 mb-1">حسابات معطلة</div>
            <div className="text-lg font-black text-rose-900">{disabledCount} حساب</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-right">
            <div className="text-[11px] font-bold text-amber-700 mb-1">إجمالي المديونيات</div>
            <div className="text-base sm:text-lg font-black text-amber-900 font-mono">
              {totalDebts.toLocaleString('ar-EG')} ج
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackMsg && (
        <div
          className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fadeIn ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث باسم العميل، اسم المحل، رقم الهاتف أو معرف العميل..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-700 focus:bg-white rounded-2xl px-3.5 py-2.5 pr-10 text-xs text-slate-900 focus:outline-none transition-all font-bold"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
          </div>

          {/* Status Filter Chips */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFilterStatus('all')}
              className={`py-1.5 px-3 rounded-xl text-xs font-black whitespace-nowrap transition-colors ${
                filterStatus === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              الكل ({customers.length})
            </button>
            <button
              onClick={() => setFilterStatus('active')}
              className={`py-1.5 px-3 rounded-xl text-xs font-black whitespace-nowrap transition-colors ${
                filterStatus === 'active'
                  ? 'bg-emerald-800 text-white'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              النشطة ({activeCount})
            </button>
            <button
              onClick={() => setFilterStatus('disabled')}
              className={`py-1.5 px-3 rounded-xl text-xs font-black whitespace-nowrap transition-colors ${
                filterStatus === 'disabled'
                  ? 'bg-rose-700 text-white'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              المعطلة ({disabledCount})
            </button>
            <button
              onClick={() => setFilterStatus('withDebt')}
              className={`py-1.5 px-3 rounded-xl text-xs font-black whitespace-nowrap transition-colors ${
                filterStatus === 'withDebt'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              عليهم مديونية
            </button>
          </div>
        </div>
      </div>

      {/* Customers List / Table */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-emerald-800" />
            <p className="text-xs font-bold">جاري تحميل سجلات العملاء...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-bold text-slate-600">لا توجد حسابات مطابقة للبحث</p>
            <p className="text-xs text-slate-400 mt-1">جرّب البحث برقم هاتف أو اسم مختلف</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-black border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">معرف العميل</th>
                  <th className="py-3 px-4">العميل والمحل</th>
                  <th className="py-3 px-4">رقم الهاتف</th>
                  <th className="py-3 px-4 text-center">الطلبات</th>
                  <th className="py-3 px-4">إجمالي المشتريات</th>
                  <th className="py-3 px-4">المديونية الحالية</th>
                  <th className="py-3 px-4">تاريخ التسجيل</th>
                  <th className="py-3 px-4 text-center">الحالة</th>
                  <th className="py-3 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((cust) => {
                  const isCurrentAction = actionLoadingId === cust.id;
                  const hasDebt = cust.currentDebt > 0;

                  return (
                    <tr key={cust.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-500 whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px]">
                          {cust.id}
                        </span>
                      </td>

                      {/* Customer & Store */}
                      <td className="py-3.5 px-4">
                        <div className="font-black text-slate-900">{cust.fullName}</div>
                        <div className="flex items-center gap-1 text-[11px] text-emerald-800 font-bold mt-0.5">
                          <Store className="w-3 h-3 text-emerald-700 shrink-0" />
                          <span>{cust.storeName || 'محل تجاري'}</span>
                        </div>
                        {cust.address && (
                          <div className="text-[10px] text-slate-400 truncate max-w-xs mt-0.5">
                            {cust.address}
                          </div>
                        )}
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-4 font-mono font-bold whitespace-nowrap">
                        <a
                          href={`tel:${cust.phone}`}
                          className="text-slate-800 hover:text-emerald-800 flex items-center gap-1 transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{cust.phone}</span>
                        </a>
                      </td>

                      {/* Orders Count */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center justify-center bg-slate-100 text-slate-800 px-2 py-0.5 rounded-full font-bold">
                          {cust.ordersCount} طلب
                        </span>
                      </td>

                      {/* Total Purchases */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                        {(cust.totalPurchases || 0).toLocaleString('ar-EG')} ج
                      </td>

                      {/* Current Debt */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {hasDebt ? (
                          <span className="inline-flex items-center gap-1 font-mono font-black text-rose-700 bg-rose-50 px-2 py-1 rounded-lg">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{cust.currentDebt.toLocaleString('ar-EG')} ج</span>
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded-lg text-[11px]">
                            خالص الحساب ✓
                          </span>
                        )}
                      </td>

                      {/* Created At */}
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {cust.createdAt ? cust.createdAt.split('T')[0] : '—'}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {cust.status === 'active' ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 font-black px-2.5 py-1 rounded-full text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                            <span>نشط ومفعل</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-900 font-black px-2.5 py-1 rounded-full text-[10px]">
                            <Lock className="w-3 h-3 text-rose-700" />
                            <span>معطل</span>
                          </span>
                        )}
                      </td>

                      {/* Actions: 🟡 تحصيل جزئي | 🟢 تم التحصيل الكامل | 📋 الحساب */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {hasDebt && (
                            <>
                              {/* 🟡 تحصيل جزئي */}
                              <button
                                onClick={() => {
                                  setPartialCollectCustomer({
                                    id: cust.id,
                                    fullName: cust.fullName,
                                    phone: cust.phone,
                                    currentDebt: cust.currentDebt,
                                  });
                                  setPartialCollectAmount('');
                                  setPartialCollectMethod('Cash');
                                  setPartialCollectNotes('');
                                  setPartialCollectError('');
                                }}
                                title="تسجيل دفعة جزئية من حساب العميل"
                                className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl transition-all font-black text-[11px] flex items-center gap-1 shadow-2xs hover:scale-105 active:scale-95 border border-amber-400"
                              >
                                <DollarSign className="w-3.5 h-3.5 text-slate-950" />
                                <span>تحصيل جزئي</span>
                              </button>

                              {/* 🟢 تم التحصيل الكامل */}
                              <button
                                onClick={() => {
                                  setFullCollectCustomer({
                                    id: cust.id,
                                    fullName: cust.fullName,
                                    phone: cust.phone,
                                    currentDebt: cust.currentDebt,
                                  });
                                  setFullCollectMethod('Cash');
                                  setFullCollectNotes('');
                                  setFullCollectError('');
                                }}
                                title="تحصيل كامل المديونية وتصفير الحساب"
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all font-black text-[11px] flex items-center gap-1 shadow-2xs hover:scale-105 active:scale-95 border border-emerald-500"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>تحصيل كامل</span>
                              </button>
                            </>
                          )}

                          {/* 📋 الحساب */}
                          <button
                            onClick={() => openCustomerStatement(cust.id)}
                            title="عرض كشف الحساب والطلبات"
                            className="p-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 rounded-xl transition-colors font-bold text-[11px] flex items-center gap-1 border border-slate-200"
                          >
                            <FileText className="w-3.5 h-3.5 text-slate-700" />
                            <span>الحساب</span>
                          </button>

                          {/* Toggle Status (Enable / Disable) */}
                          <button
                            onClick={() => handleToggleStatus(cust)}
                            disabled={isCurrentAction}
                            title={cust.status === 'active' ? 'تعطيل الحساب' : 'إعادة تفعيل الحساب'}
                            className={`p-1.5 rounded-xl transition-colors text-[11px] font-bold flex items-center gap-1 ${
                              cust.status === 'active'
                                ? 'bg-rose-50 hover:bg-rose-100 text-rose-800'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isCurrentAction ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : cust.status === 'active' ? (
                              <>
                                <Lock className="w-3.5 h-3.5 text-rose-600" />
                                <span>تعطيل</span>
                              </>
                            ) : (
                              <>
                                <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                                <span>تفعيل</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Statement / Account Details Modal */}
      {selectedStatement && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn" dir="rtl">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl text-slate-800">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {selectedStatement.customer.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-bold mt-0.5">
                    <span>{selectedStatement.customer.storeName || 'محل تجاري'}</span>
                    <span>•</span>
                    <span className="font-mono">{selectedStatement.customer.phone}</span>
                    <span>•</span>
                    <span className="font-mono text-emerald-800">{selectedStatement.customer.id}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPrintModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-black transition-colors shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة كشف الحساب</span>
                </button>
                <button
                  onClick={() => setSelectedStatement(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Statement Content */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              {/* Financial Breakdown */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-right">
                  <div className="text-[11px] font-bold text-slate-500">إجمالي المشتريات</div>
                  <div className="text-base font-black text-slate-900 font-mono mt-0.5">
                    {selectedStatement.summary.totalInvoiced.toLocaleString('ar-EG')} ج
                  </div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-right">
                  <div className="text-[11px] font-bold text-emerald-700">إجمالي المدفوعات</div>
                  <div className="text-base font-black text-emerald-900 font-mono mt-0.5">
                    {selectedStatement.summary.totalPaid.toLocaleString('ar-EG')} ج
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-right">
                  <div className="text-[11px] font-bold text-amber-700">صافي المديونية الحالية</div>
                  <div className="text-base font-black text-amber-900 font-mono mt-0.5">
                    {selectedStatement.summary.totalDebt.toLocaleString('ar-EG')} ج
                  </div>
                </div>
              </div>

              {/* Orders History */}
              <div>
                <h4 className="text-xs font-black text-slate-900 mb-2 flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-emerald-800" />
                  <span>سجل الطلبات والفواتير ({selectedStatement.orders.length})</span>
                </h4>

                {selectedStatement.orders.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-2xl text-xs font-bold">
                    لا توجد طلبات مسجلة لهذا العميل بعد
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedStatement.orders.map((ord) => (
                      <div
                        key={ord.id}
                        className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-emerald-900 text-xs">
                              {ord.orderNumber}
                            </span>
                            <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-bold">
                              {ord.status}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {ord.createdAt}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 font-bold mt-1">
                            {ord.itemsCount} أصناف • {ord.totalQuantity} عبوة
                          </div>
                        </div>

                        <div className="text-left flex items-center gap-3">
                          <div>
                            <div className="text-xs font-mono font-black text-slate-900">
                              {ord.grandTotal.toLocaleString('ar-EG')} ج
                            </div>
                            <div className="text-[10px] font-bold text-slate-500">
                              المدفوع: {ord.paidAmount?.toLocaleString('ar-EG') || 0} ج | المتبقي:{' '}
                              {ord.remainingBalance?.toLocaleString('ar-EG') || 0} ج
                            </div>
                          </div>

                          {onOpenOrderDetails && (
                            <button
                              onClick={() => {
                                onOpenOrderDetails(ord.id);
                                setSelectedStatement(null);
                              }}
                              className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-emerald-700 rounded-xl text-[11px] font-bold text-slate-700 hover:text-emerald-800 transition-colors"
                            >
                              عرض الفاتورة
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payments History */}
              {selectedStatement.payments.length > 0 && (
                <div>
                  <h4 className="text-xs font-black text-slate-900 mb-2 flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-800" />
                    <span>سجل سندات القبض والتحصيلات ({selectedStatement.payments.length})</span>
                  </h4>

                  <div className="space-y-1.5">
                    {selectedStatement.payments.map((p) => (
                      <div
                        key={p.id}
                        className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-2.5 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-800">
                            تحصيل بواسطة: <span className="font-black">{p.collectedBy}</span> ({p.paymentMethod})
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {p.paymentDate} {p.notes ? `• ${p.notes}` : ''}
                          </div>
                        </div>
                        <div className="font-mono font-black text-emerald-800 text-sm">
                          +{p.amount.toLocaleString('ar-EG')} ج
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Print Statement Modal */}
      {selectedStatement && (
        <PrintStatementModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          customer={selectedStatement.customer}
          settings={null}
          orders={selectedStatement.orders || []}
          payments={selectedStatement.payments || []}
          summary={selectedStatement.summary}
        />
      )}

      {/* Partial Debt Collection Modal */}
      {partialCollectCustomer && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn" dir="rtl">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-5 sm:p-6 text-right shadow-2xl text-slate-800 relative">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-black">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-slate-900">
                    تسجيل تحصيل جزئي
                  </h3>
                  <p className="text-xs text-slate-500 font-bold">
                    إدخال دفعة جزئية من مديونية العميل
                  </p>
                </div>
              </div>

              <button
                onClick={() => setPartialCollectCustomer(null)}
                disabled={partialCollecting}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Debt Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 mb-4 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-bold">العميل:</span>
                <span className="font-black text-slate-900">{partialCollectCustomer.fullName}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-red-700 font-black">إجمالي المديونية الحالية:</span>
                <span className="font-black text-base text-red-700 font-mono">
                  {(partialCollectCustomer.currentDebt || 0).toLocaleString('ar-EG')} ج.م
                </span>
              </div>
            </div>

            <form onSubmit={handleExecutePartialCollection} className="space-y-3">
              <div>
                <label className="block text-xs font-black text-slate-800 mb-1">
                  المبلغ المدفوع (ج.م) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  max={partialCollectCustomer.currentDebt}
                  required
                  placeholder="مثال: 2000"
                  value={partialCollectAmount}
                  onChange={(e) => setPartialCollectAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-base font-black bg-white focus:outline-hidden focus:border-amber-600"
                />
              </div>

              {/* Dynamic Live Calculation */}
              {parseFloat(partialCollectAmount) > 0 && (
                <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl flex justify-between items-center text-xs font-bold text-slate-800">
                  <span>المتبقي بعد هذه الدفعة:</span>
                  <span className="font-mono font-black text-slate-950 text-sm">
                    {Math.max(0, (partialCollectCustomer.currentDebt || 0) - (parseFloat(partialCollectAmount) || 0)).toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  طريقة التحصيل
                </label>
                <select
                  value={partialCollectMethod}
                  onChange={(e) => setPartialCollectMethod(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:outline-hidden focus:border-amber-600"
                >
                  <option value="Cash">نقدًا (كاش مع المندوب / الخزينة)</option>
                  <option value="VodafoneCash">فودافون كاش / محافظ إلكترونية</option>
                  <option value="Bank">تحويل بنكي / إنستاباي</option>
                  <option value="Cheque">شيك بنكي مقبول الدفع</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ملاحظات (اختياري)
                </label>
                <input
                  type="text"
                  placeholder="مثال: دفعة من حساب الفاتورة الأخيرة"
                  value={partialCollectNotes}
                  onChange={(e) => setPartialCollectNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-hidden focus:border-amber-600"
                />
              </div>

              {partialCollectError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{partialCollectError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setPartialCollectCustomer(null)}
                  disabled={partialCollecting}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={partialCollecting}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl shadow-md transition-all text-xs disabled:opacity-50 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] border border-amber-400"
                >
                  {partialCollecting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جاري تسجيل الدفعة...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>تسجيل الدفعة الجزئية</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Debt Collection Confirmation Dialog Modal */}
      {fullCollectCustomer && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn" dir="rtl">
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
                <span className="font-black text-slate-900 text-sm">{fullCollectCustomer.fullName}</span>
              </div>

              {fullCollectCustomer.phone && (
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs text-slate-500 font-bold">رقم الهاتف:</span>
                  <span className="font-mono font-bold text-slate-700 text-xs">{fullCollectCustomer.phone}</span>
                </div>
              )}

              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs text-red-700 font-black">إجمالي المديونية الحالية:</span>
                <span className="font-black text-base text-red-700 font-mono">
                  {(fullCollectCustomer.currentDebt || 0).toLocaleString('ar-EG')} ج.م
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-200 pb-2 bg-emerald-100/60 p-2 rounded-xl">
                <span className="text-xs text-emerald-900 font-black">المبلغ الذي سيتم تحصيله:</span>
                <span className="font-black text-base text-emerald-900 font-mono">
                  {(fullCollectCustomer.currentDebt || 0).toLocaleString('ar-EG')} ج.م
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
    </div>
  );
};
