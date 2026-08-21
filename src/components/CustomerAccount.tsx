import React, { useState, useEffect, useMemo } from 'react';
import { User, SystemSettings, Order, PaymentTransaction, CustomerDebtSummary } from '../types';
import {
  User as UserIcon,
  Phone,
  Store,
  MapPin,
  LogOut,
  ShoppingBag,
  Clock,
  ShieldCheck,
  Headphones,
  CheckCircle2,
  FileText,
  CreditCard,
  Printer,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingDown,
  Receipt,
  Share2,
} from 'lucide-react';
import { apiFetch } from '../utils/api';
import { PrintStatementModal } from './PrintStatementModal';

interface CustomerAccountProps {
  user: User | null;
  settings: SystemSettings | null;
  orders: Order[];
  onOpenLogin: () => void;
  onLogout: () => void;
  onNavigateToTab: (tab: string) => void;
  onReorder: (order: Order) => void;
  onPrintReceipt: (order: Order) => void;
}

export const CustomerAccount: React.FC<CustomerAccountProps> = ({
  user,
  settings,
  orders,
  onOpenLogin,
  onLogout,
  onNavigateToTab,
  onReorder,
  onPrintReceipt,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'orders' | 'payments' | 'statement'>('orders');
  const [statementData, setStatementData] = useState<{
    summary: { totalInvoiced: number; totalPaid: number; totalDebt: number; ordersCount: number; paymentsCount: number };
    orders: Order[];
    payments: PaymentTransaction[];
  } | null>(null);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [isPrintStatementModalOpen, setIsPrintStatementModalOpen] = useState(false);

  // Fetch detailed customer statement
  useEffect(() => {
    if (!user) return;
    const fetchStatement = async () => {
      setLoadingStatement(true);
      try {
        const res = await apiFetch(`/api/customers/${user.id}/statement`);
        if (res.ok) {
          const data = await res.json();
          setStatementData(data);
        }
      } catch (err) {
        console.error('Failed to load customer statement:', err);
      } finally {
        setLoadingStatement(false);
      }
    };
    fetchStatement();
  }, [user, orders]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-12 text-center space-y-4 px-4" dir="rtl">
        <div className="w-16 h-16 bg-emerald-100 rounded-3xl text-emerald-800 flex items-center justify-center mx-auto shadow-xs">
          <UserIcon className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900">حساب العميل والمديونيات</h2>
        <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
          سجل دخولك لتتمكن من متابعة رصيد مديونيتك، مراجعة كشف الحساب، فواتيرك السابقة وسجل دفعاتك.
        </p>
        <button
          onClick={onOpenLogin}
          className="w-full py-3.5 bg-emerald-800 hover:bg-emerald-900 text-white font-black text-sm rounded-2xl shadow-md transition-all"
        >
          تسجيل الدخول إلى حسابك
        </button>
      </div>
    );
  }

  const myOrders = orders.filter(
    (o) => o.customerId === user.id || o.customerPhone === user.phone
  );

  const totalInvoiced = statementData?.summary.totalInvoiced ?? myOrders.reduce((s, o) => s + (o.status !== 'Cancelled' ? o.grandTotal : 0), 0);
  const totalPaid = statementData?.summary.totalPaid ?? myOrders.reduce((s, o) => s + (o.status !== 'Cancelled' ? (o.paidAmount || 0) : 0), 0);
  const currentDebt = statementData?.summary.totalDebt ?? Math.max(0, totalInvoiced - totalPaid);

  const paymentsList = statementData?.payments || [];

  // Parse Arabic or ISO date into timestamp for sorting
  const parseDateToTimestamp = (dateStr: string): number => {
    if (!dateStr) return 0;
    try {
      const parsed = Date.parse(dateStr);
      if (!isNaN(parsed)) return parsed;
      const parts = dateStr.split(/[\s,]+/);
      if (parts[0] && parts[0].includes('-')) {
        const d = Date.parse(parts[0]);
        if (!isNaN(d)) return d;
      }
    } catch {}
    return 0;
  };

  // Build Chronological Ledger Movements for Customer Account Tab
  const statementMovements = useMemo(() => {
    const validOrders = myOrders.filter((o) => o.status !== 'Cancelled');
    const allEvents: {
      id: string;
      type: 'invoice' | 'payment';
      date: string;
      sortTimestamp: number;
      docNumber: string;
      description: string;
      notes?: string;
      debit: number;
      credit: number;
    }[] = [];

    validOrders.forEach((o) => {
      allEvents.push({
        id: `inv-${o.id}`,
        type: 'invoice',
        date: o.createdAt || '',
        sortTimestamp: parseDateToTimestamp(o.createdAt),
        docNumber: o.orderNumber,
        description: `فاتورة بضاعة #${o.orderNumber}`,
        notes: `${o.itemsCount || 1} صنف (${o.totalQuantity || 1} كرتونة)`,
        debit: o.grandTotal || 0,
        credit: 0,
      });
    });

    paymentsList.forEach((p) => {
      allEvents.push({
        id: `pay-${p.id}`,
        type: 'payment',
        date: p.paymentDate || p.createdAt || '',
        sortTimestamp: parseDateToTimestamp(p.paymentDate || p.createdAt),
        docNumber: p.orderNumber ? p.orderNumber : `#${p.id.slice(-5)}`,
        description: `سند سداد دفعة نقدية`,
        notes: p.collectedBy ? `المحصل: ${p.collectedBy}` : p.notes,
        debit: 0,
        credit: p.amount || 0,
      });
    });

    allEvents.sort((a, b) => a.sortTimestamp - b.sortTimestamp);

    let running = 0;
    return allEvents.map((ev) => {
      running += ev.debit - ev.credit;
      return {
        ...ev,
        runningBalance: running,
      };
    });
  }, [myOrders, paymentsList]);

  return (
    <div className="max-w-2xl mx-auto space-y-3.5 pb-28 text-right px-1" dir="rtl">
      {/* Print Statement Modal */}
      {isPrintStatementModalOpen && (
        <PrintStatementModal
          isOpen={isPrintStatementModalOpen}
          onClose={() => setIsPrintStatementModalOpen(false)}
          customer={{
            id: user.id,
            name: user.fullName,
            phone: user.phone,
            storeName: user.storeName,
            address: user.address || settings?.address || 'محافظة الإسكندرية - بجوار مسجد القويري - بوابة 8',
          }}
          settings={settings}
          orders={myOrders}
          payments={paymentsList}
          summary={{
            totalInvoiced,
            totalPaid,
            totalDebt: currentDebt,
            ordersCount: myOrders.filter((o) => o.status !== 'Cancelled').length,
            paymentsCount: paymentsList.length,
          }}
        />
      )}
      {/* 1. Customer Profile Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-13 h-13 rounded-2xl bg-emerald-800 text-white flex items-center justify-center text-xl font-black shadow-xs shrink-0">
              {user.fullName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900">{user.fullName}</h2>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-md">
                  عميل جملة
                </span>
              </div>
              <div className="text-xs text-slate-500 font-mono mt-0.5">{user.phone}</div>
              {user.storeName && (
                <div className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                  <Store className="w-3 h-3" />
                  <span>{user.storeName}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onOpenLogin}
              className="p-2 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors text-xs font-bold flex items-center gap-1"
              title="دخول حساب آخر / لوحة الإدارة"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span className="hidden sm:inline text-[11px]">دخول الإدارة</span>
            </button>
            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors shrink-0"
              title="تسجيل الخروج"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Address */}
        {user.address && (
          <div className="pt-3 flex items-center gap-2 text-xs text-slate-600">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
            <span>{user.address}</span>
          </div>
        )}
      </div>

      {/* 2. Customer Debt & Financial Status Banner */}
      <div
        className={`rounded-3xl p-5 border transition-all shadow-xs ${
          currentDebt > 0
            ? 'bg-amber-500/10 border-amber-300 text-amber-950'
            : 'bg-emerald-800 text-white border-emerald-700'
        }`}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className={`text-xs font-bold ${currentDebt > 0 ? 'text-amber-900' : 'text-emerald-200'}`}>
              رصيد الحساب والمديونية الحالية
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono mt-1">
              {(currentDebt || 0).toLocaleString('ar-EG')}{' '}
              <span className="text-sm font-normal">جنيه مصري</span>
            </div>
            <div className={`text-[11px] mt-1 ${currentDebt > 0 ? 'text-amber-800 font-semibold' : 'text-emerald-100'}`}>
              {currentDebt > 0
                ? '⚠️ مبالغ متبقية مستحقة السداد لإدارة شركة الحليم'
                : '✅ رصيدك خالص تماماً - لا توجد أي مديونيات متأخرة'}
            </div>
          </div>

          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
            currentDebt > 0 ? 'bg-amber-200 text-amber-900' : 'bg-emerald-700 text-white'
          }`}>
            <Receipt className="w-6 h-6" />
          </div>
        </div>

        {/* Financial Sub-Metrics */}
        <div className={`grid grid-cols-2 gap-2 mt-4 pt-3 border-t text-xs ${
          currentDebt > 0 ? 'border-amber-200' : 'border-emerald-700/60'
        }`}>
          <div>
            <span className={currentDebt > 0 ? 'text-amber-800' : 'text-emerald-200'}>
              إجمالي المسحوبات (الفواتير):
            </span>
            <div className="font-bold font-mono text-sm mt-0.5">
              {(totalInvoiced || 0).toLocaleString('ar-EG')} ج.م
            </div>
          </div>
          <div>
            <span className={currentDebt > 0 ? 'text-amber-800' : 'text-emerald-200'}>
              إجمالي المسدد (المدفوعات):
            </span>
            <div className="font-bold font-mono text-sm mt-0.5">
              {(totalPaid || 0).toLocaleString('ar-EG')} ج.م
            </div>
          </div>
        </div>
      </div>

      {/* 3. Sub-Navigation Tabs: Orders / Payments / Statement */}
      <div className="flex items-center bg-white border border-slate-200 rounded-2xl p-1 shadow-2xs">
        <button
          onClick={() => setActiveSubTab('orders')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 ${
            activeSubTab === 'orders'
              ? 'bg-emerald-800 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>طلباتي ({myOrders.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('payments')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 ${
            activeSubTab === 'payments'
              ? 'bg-emerald-800 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>سجل المدفوعات ({paymentsList.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('statement')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 ${
            activeSubTab === 'statement'
              ? 'bg-emerald-800 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>كشف الحساب</span>
        </button>
      </div>

      {/* SubTab 1: Orders List */}
      {activeSubTab === 'orders' && (
        <div className="space-y-3">
          {myOrders.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center text-slate-400 space-y-2">
              <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto stroke-1" />
              <p className="text-sm font-bold text-slate-700">لم تقم بإرسال أي طلبات بعد</p>
              <p className="text-xs text-slate-400">تصفح الكتالوج وأرسل أول أوردر جملة لمحلّك</p>
              <button
                onClick={() => onNavigateToTab('catalog')}
                className="mt-2 px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl"
              >
                تصفح المنتجات الآن
              </button>
            </div>
          ) : (
            myOrders.map((order) => {
              const isExpanded = expandedOrderId === order.id;
              const remaining = order.remainingBalance !== undefined ? order.remainingBalance : Math.max(0, order.grandTotal - (order.paidAmount || 0));

              return (
                <div
                  key={order.id}
                  className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs text-right"
                >
                  {/* Order Top Bar */}
                  <div
                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                    className="p-4 cursor-pointer hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-sm font-mono">
                          #{order.orderNumber}
                        </span>
                        {/* Status pill */}
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                            order.status === 'Delivered'
                              ? 'bg-emerald-100 text-emerald-800'
                              : order.status === 'Cancelled'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {order.status === 'Pending'
                            ? 'قيد الانتظار'
                            : order.status === 'Confirmed'
                            ? 'تم التأكيد'
                            : order.status === 'Preparing'
                            ? 'جاري التجهيز'
                            : order.status === 'Out for Delivery'
                            ? 'خرج للتوصيل'
                            : order.status === 'Delivered'
                            ? 'تم التسليم'
                            : order.status === 'Cancelled'
                            ? 'ملغي'
                            : order.status}
                        </span>

                        {/* Payment badge */}
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            remaining === 0
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {remaining === 0 ? 'خالص' : `متبقي ${remaining.toLocaleString('ar-EG')} ج`}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                        <span>{order.createdAt}</span>
                        <span>•</span>
                        <span>{order.totalQuantity} كرتونة ({order.itemsCount} صنف)</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-left">
                        <div className="text-sm font-black text-emerald-800 font-mono">
                          {order.grandTotal.toLocaleString('ar-EG')} ج.م
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Items & Actions */}
                  {isExpanded && (
                    <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-3">
                      {/* Items list */}
                      <div className="space-y-1.5">
                        <div className="text-xs font-black text-slate-800 mb-1">
                          أصناف الطلب:
                        </div>
                        {(order.items || []).map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs py-1 border-b border-slate-200/50"
                          >
                            <span className="text-slate-800 font-medium">
                              {item.productName} ({item.quantity} {item.unit || 'كرتونة'})
                            </span>
                            <span className="font-mono text-slate-700">
                              {item.totalPrice.toLocaleString('ar-EG')} ج.م
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                        <button
                          onClick={() => onReorder(order)}
                          className="py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-2xs"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>تكرار الطلب للسلة</span>
                        </button>

                        <button
                          onClick={() => onPrintReceipt(order)}
                          className="py-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-2xs"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>طباعة إيصال 80mm</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SubTab 2: Payments List */}
      {activeSubTab === 'payments' && (
        <div className="space-y-3">
          {paymentsList.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center text-slate-400 space-y-2">
              <CreditCard className="w-10 h-10 text-slate-300 mx-auto stroke-1" />
              <p className="text-sm font-bold text-slate-700">لا يوجد سجل دفعات مسجلة بعد</p>
              <p className="text-xs text-slate-400">
                يتم تسجيل الدفعات النقدية تلقائياً عند تسليم البضاعة أو السداد للمندوب.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl divide-y divide-slate-100 overflow-hidden shadow-xs">
              {paymentsList.map((pay) => (
                <div key={pay.id} className="p-4 flex items-center justify-between gap-3 text-right">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                      <ArrowDownLeft className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-xs sm:text-sm text-slate-900">
                        سداد دفعة نقدية
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                        <span>{pay.paymentDate}</span>
                        {pay.collectedBy && <span>• المحصل: {pay.collectedBy}</span>}
                      </div>
                      {pay.notes && (
                        <div className="text-[10px] text-slate-400 mt-0.5">{pay.notes}</div>
                      )}
                    </div>
                  </div>

                  <div className="text-left">
                    <div className="font-black text-emerald-800 font-mono text-sm sm:text-base">
                      +{(pay.amount || 0).toLocaleString('ar-EG')} ج.م
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      إيصال سداد
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SubTab 3: Full Detailed Ledger Statement */}
      {activeSubTab === 'statement' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-black text-slate-900 text-sm sm:text-base">كشف الحساب التفصيلي</h3>
              <p className="text-[11px] text-slate-500">
                حركة المسحوبات والفواتير مقابل الدفعات المسددة والرصيد التراكمي
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPrintStatementModalOpen(true)}
                className="px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
                title="معاينة وطباعة كشف الحساب الرسمي"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة الكشف</span>
              </button>
            </div>
          </div>

          {/* Statement Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-black">
                  <th className="p-2.5">التاريخ</th>
                  <th className="p-2.5">البيان والحركة</th>
                  <th className="p-2.5 text-center">فاتورة (مدين)</th>
                  <th className="p-2.5 text-center">سداد (دائن)</th>
                  <th className="p-2.5 text-center">الرصيد المتبقي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {statementMovements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400 font-sans font-bold">
                      لا توجد حركات مسجلة على حسابك حتى الآن
                    </td>
                  </tr>
                ) : (
                  statementMovements.map((mov) => (
                    <tr
                      key={mov.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        mov.type === 'payment' ? 'bg-emerald-50/30' : ''
                      }`}
                    >
                      <td className="p-2.5 text-slate-500 font-sans text-[11px] whitespace-nowrap">
                        {mov.date.split(',')[0]}
                      </td>
                      <td className="p-2.5 font-sans">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{mov.type === 'invoice' ? '📦' : '💵'}</span>
                          <span>{mov.description}</span>
                        </div>
                        {mov.notes && (
                          <div className="text-[10px] text-slate-400 mt-0.5">{mov.notes}</div>
                        )}
                      </td>
                      <td className="p-2.5 text-center text-red-600 font-bold">
                        {mov.debit > 0 ? `${mov.debit.toLocaleString('ar-EG')} ج` : '-'}
                      </td>
                      <td className="p-2.5 text-center text-emerald-700 font-bold">
                        {mov.credit > 0 ? `+${mov.credit.toLocaleString('ar-EG')} ج` : '-'}
                      </td>
                      <td className="p-2.5 text-center font-black text-slate-900">
                        {mov.runningBalance.toLocaleString('ar-EG')} ج
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Final Debt Total in Statement */}
          <div className="p-3.5 bg-slate-50 rounded-2xl flex items-center justify-between text-xs font-black border border-slate-200">
            <span className="text-slate-700">صافي رصيد المديونية المستحق:</span>
            <span className={`text-sm sm:text-base font-mono ${currentDebt > 0 ? 'text-red-700' : 'text-emerald-800'}`}>
              {(currentDebt || 0).toLocaleString('ar-EG')} جنيه مصري
            </span>
          </div>
        </div>
      )}

      {/* 4. Sales Rep Dedicated Contact Box */}
      <div className="bg-emerald-50 border border-emerald-200/80 rounded-3xl p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-800 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-emerald-950">مندوب شركة الحليم لمنطقتك</div>
            <div className="text-sm font-black text-emerald-900">
              {settings?.salesRepName || 'محمد فوزي'}
            </div>
            <div className="text-[10px] text-emerald-700">
              {settings?.managerName || 'إدارة الحاج فوزي عبد الحليم'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <a
            href={`tel:${settings?.phonePrimary || '01000000000'}`}
            className="flex-1 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs text-center flex items-center justify-center gap-1.5 transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>اتصال هاتفي</span>
          </a>

          <a
            href={`https://wa.me/2${settings?.phonePrimary || '01000000000'}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2.5 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs rounded-xl shadow-xs text-center flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>واتساب المندوب</span>
          </a>
        </div>
      </div>
    </div>
  );
};
