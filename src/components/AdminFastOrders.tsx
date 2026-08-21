import React, { useState } from 'react';
import { Order, OrderStatus, SystemSettings, Product } from '../types';
import {
  Package,
  CheckCircle,
  Clock,
  Printer,
  ChevronDown,
  ChevronUp,
  XCircle,
  Truck,
  Edit,
  Power,
  Search,
  DollarSign,
  AlertCircle,
  Check,
  X,
  CreditCard,
  UserCheck,
} from 'lucide-react';
import { apiFetch } from '../utils/api';

interface AdminFastOrdersProps {
  orders: Order[];
  settings: SystemSettings | null;
  allProducts: Product[];
  onToggleOrdersOpen: (isOpen: boolean) => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  onOpenEditModal: (order: Order) => void;
  onOpenPrintModal: (order: Order) => void;
  onRefreshData: () => void;
}

export const AdminFastOrders: React.FC<AdminFastOrdersProps> = ({
  orders,
  settings,
  allProducts,
  onToggleOrdersOpen,
  onUpdateStatus,
  onOpenEditModal,
  onOpenPrintModal,
  onRefreshData,
}) => {
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Collect Modal State for specific order
  const [collectOrder, setCollectOrder] = useState<Order | null>(null);
  const [collectAmount, setCollectAmount] = useState<string>('');
  const [collectMethod, setCollectMethod] = useState<'Cash' | 'Bank' | 'VodafoneCash' | 'Cheque'>('Cash');
  const [collectNotes, setCollectNotes] = useState('');
  const [markDeliveredWithPayment, setMarkDeliveredWithPayment] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [collectError, setCollectError] = useState('');
  const [collectSuccess, setCollectSuccess] = useState('');

  const pendingOrders = orders.filter((o) => o.status === 'Pending');
  const isOrdersOpen = settings?.manualOrdersOpen ?? true;

  const filteredOrders = orders.filter((o) => {
    if (filterStatus !== 'all' && o.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchNum = o.orderNumber.toLowerCase().includes(q);
      const matchName = o.customerName.toLowerCase().includes(q);
      const matchPhone = o.customerPhone.includes(q);
      return matchNum || matchName || matchPhone;
    }
    return true;
  });

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'Pending':
        return { label: 'قيد الانتظار', icon: '⏳', color: 'bg-amber-100 text-amber-900 border-amber-300 font-bold' };
      case 'Confirmed':
        return { label: 'تم التأكيد', icon: '📋', color: 'bg-blue-100 text-blue-900 border-blue-300 font-bold' };
      case 'Preparing':
        return { label: 'جاري التجهيز', icon: '📦', color: 'bg-indigo-100 text-indigo-900 border-indigo-300 font-bold' };
      case 'Out for Delivery':
        return { label: 'خرج للتوصيل', icon: '🚚', color: 'bg-purple-100 text-purple-900 border-purple-300 font-bold' };
      case 'Delivered':
        return { label: 'تم التسليم', icon: '✅', color: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold' };
      case 'Cancelled':
        return { label: 'ملغي', icon: '❌', color: 'bg-red-100 text-red-900 border-red-300 font-bold' };
      default:
        return { label: status, icon: '📋', color: 'bg-slate-100 text-slate-700 border-slate-300' };
    }
  };

  const getPaymentBadge = (order: Order) => {
    const paid = order.paidAmount || 0;
    const remaining = order.remainingBalance != null ? order.remainingBalance : (order.grandTotal || 0) - paid;
    const status = order.paymentStatus || (paid >= (order.grandTotal || 0) ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid');

    if (status === 'Paid' || remaining <= 0) {
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
          <span>🟢</span>
          <span>مدفوعة بالكامل</span>
        </span>
      );
    }

    if (status === 'Partial' || (paid > 0 && remaining > 0)) {
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-amber-50 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
          <span>🟡</span>
          <span>مدفوعة جزئياً (متبقي {(remaining || 0).toLocaleString('ar-EG')} ج)</span>
        </span>
      );
    }

    return (
      <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-red-50 text-red-800 border border-red-300 inline-flex items-center gap-1">
        <span>🔴</span>
        <span>غير مدفوعة (أجل)</span>
      </span>
    );
  };

  const toggleExpand = (orderId: string) => {
    setExpandedOrderId((prev) => (prev === orderId ? null : orderId));
  };

  const openCollectModalForOrder = (order: Order) => {
    const remaining = order.remainingBalance != null ? order.remainingBalance : Math.max(0, (order.grandTotal || 0) - (order.paidAmount || 0));
    setCollectOrder(order);
    setCollectAmount(remaining > 0 ? String(remaining) : String(order.grandTotal || 0));
    setCollectMethod('Cash');
    setCollectNotes('تحصيل عند تسليم الطلب');
    setMarkDeliveredWithPayment(order.status !== 'Delivered');
    setCollectError('');
    setCollectSuccess('');
  };

  const handleCollectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectOrder) return;

    const numAmount = parseFloat(collectAmount) || 0;
    const currentRemaining = collectOrder.remainingBalance != null
      ? collectOrder.remainingBalance
      : Math.max(0, (collectOrder.grandTotal || 0) - (collectOrder.paidAmount || 0));

    if (numAmount < 0) {
      setCollectError('مبلغ التحصيل يجب أن يكون رقماً موجباً');
      return;
    }

    if (numAmount > currentRemaining && currentRemaining > 0) {
      setCollectError(`لا يمكن تحصيل مبلغ (${numAmount} ج) أكبر من المبلغ المتبقي على الفاتورة (${currentRemaining} ج)`);
      return;
    }

    setCollecting(true);
    setCollectError('');

    try {
      const res = await apiFetch(`/api/orders/${collectOrder.id}/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numAmount,
          paymentMethod: collectMethod,
          collectedBy: 'محمد فوزي',
          notes: collectNotes.trim(),
          markDelivered: markDeliveredWithPayment,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCollectSuccess('تم تسجيل التحصيل وتحديث حالة الطلب بنجاح! 🟢');
        setTimeout(() => {
          setCollectOrder(null);
          setCollectSuccess('');
          onRefreshData();
        }, 1000);
      } else {
        setCollectError(data.error || 'حدث خطأ أثناء حفظ التحصيل');
      }
    } catch (err) {
      setCollectError('تعذر الاتصال بالخادم');
    } finally {
      setCollecting(false);
    }
  };

  return (
    <div className="space-y-3 pb-24 text-right max-w-3xl mx-auto" dir="rtl">
      {/* Top Banner: Store Toggle & Pending Counter */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-lg">
            {pendingOrders.length}
          </div>
          <div>
            <h2 className="font-black text-base">
              🔴 طلبات جديدة قيد الانتظار ({pendingOrders.length})
            </h2>
            <p className="text-xs text-slate-400">إجمالي الطلبات المسجلة: {orders.length} طلب</p>
          </div>
        </div>

        {/* Instant Open/Close Switch */}
        <button
          onClick={() => onToggleOrdersOpen(!isOrdersOpen)}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
            isOrdersOpen
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
              : 'bg-red-600 hover:bg-red-700 text-white shadow-sm'
          }`}
        >
          <Power className="w-4 h-4" />
          <span>{isOrdersOpen ? 'استقبال الطلبات: مفتوح 🟢' : 'استقبال الطلبات: مغلق 🔴'}</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-colors ${
            filterStatus === 'all'
              ? 'bg-emerald-700 text-white'
              : 'bg-white text-slate-700 border border-slate-200'
          }`}
        >
          جميع الطلبات ({orders.length})
        </button>

        <button
          onClick={() => setFilterStatus('Pending')}
          className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-colors ${
            filterStatus === 'Pending'
              ? 'bg-amber-600 text-white'
              : 'bg-white text-amber-800 border border-amber-200'
          }`}
        >
          ⏳ قيد الانتظار ({pendingOrders.length})
        </button>

        <button
          onClick={() => setFilterStatus('Confirmed')}
          className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-colors ${
            filterStatus === 'Confirmed'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-700 border border-slate-200'
          }`}
        >
          📋 تم التأكيد
        </button>

        <button
          onClick={() => setFilterStatus('Preparing')}
          className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-colors ${
            filterStatus === 'Preparing'
              ? 'bg-indigo-600 text-white'
              : 'bg-white text-slate-700 border border-slate-200'
          }`}
        >
          📦 جاري التجهيز
        </button>

        <button
          onClick={() => setFilterStatus('Out for Delivery')}
          className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-colors ${
            filterStatus === 'Out for Delivery'
              ? 'bg-purple-600 text-white'
              : 'bg-white text-slate-700 border border-slate-200'
          }`}
        >
          🚚 خرج للتوصيل
        </button>

        <button
          onClick={() => setFilterStatus('Delivered')}
          className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-colors ${
            filterStatus === 'Delivered'
              ? 'bg-emerald-700 text-white'
              : 'bg-white text-slate-700 border border-slate-200'
          }`}
        >
          ✅ تم التسليم
        </button>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 space-y-2">
          <Package className="w-10 h-10 mx-auto opacity-30" />
          <div className="text-sm font-bold text-slate-600">لا توجد طلبات في هذا القسم</div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredOrders.map((order) => {
            const badge = getStatusBadge(order.status);
            const isExpanded = expandedOrderId === order.id;
            const paid = order.paidAmount || 0;
            const remaining = order.remainingBalance != null ? order.remainingBalance : Math.max(0, (order.grandTotal || 0) - paid);

            return (
              <div
                key={order.id}
                className={`bg-white border rounded-2xl overflow-hidden shadow-xs transition-colors ${
                  order.status === 'Pending'
                    ? 'border-amber-300 ring-2 ring-amber-400/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Header Row */}
                <div
                  onClick={() => toggleExpand(order.id)}
                  className="p-4 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-slate-900 font-mono text-base">
                        {order.orderNumber}
                      </span>
                      <span className="font-bold text-slate-800 text-sm">
                        {order.customerName}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                      {order.customerPhone} • {order.createdAt}
                    </div>
                    <div className="mt-1.5">
                      {getPaymentBadge(order)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 text-left">
                    <div>
                      <div className="font-black text-emerald-800 font-mono text-base">
                        {(order.grandTotal || 0).toLocaleString('ar-EG')} ج
                      </div>
                      {remaining > 0 && paid > 0 && (
                        <div className="text-[11px] text-red-700 font-mono font-bold">
                          متبقي: {(remaining || 0).toLocaleString('ar-EG')} ج
                        </div>
                      )}
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-md border inline-flex items-center gap-1 mt-1 ${badge.color}`}
                      >
                        <span>{badge.icon}</span>
                        <span>{badge.label}</span>
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(order.id);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-700"
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Management Screen for Order */}
                {isExpanded && (
                  <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-4 text-xs animate-fadeIn">
                    {/* Payment Summary Box */}
                    <div className="bg-white border border-slate-200 rounded-xl p-3 grid grid-cols-3 gap-2 text-center font-mono">
                      <div>
                        <span className="text-[10px] text-slate-500 font-sans block">إجمالي الفاتورة</span>
                        <span className="font-bold text-slate-900 text-sm">
                          {(order.grandTotal || 0).toLocaleString('ar-EG')} ج
                        </span>
                      </div>
                      <div className="border-r border-l border-slate-200">
                        <span className="text-[10px] text-slate-500 font-sans block">المدفوع نقداً</span>
                        <span className="font-bold text-emerald-800 text-sm">
                          {(paid || 0).toLocaleString('ar-EG')} ج
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-sans block">المتبقي على الفاتورة</span>
                        <span className={`font-black text-sm ${remaining > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                          {(remaining || 0).toLocaleString('ar-EG')} ج
                        </span>
                      </div>
                    </div>

                    {/* Items List */}
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                      <div className="bg-slate-100 p-2.5 font-bold text-slate-700 flex justify-between">
                        <span>الصنف والكمية</span>
                        <span>الإجمالي</span>
                      </div>
                      {(order.items || []).map((item) => (
                        <div key={item.id} className="p-2.5 flex justify-between items-center">
                          <div>
                            <span className="font-bold text-slate-900">{item.productName}</span>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {item.quantity} {item.unit} × {item.unitPrice} ج
                            </div>
                          </div>
                          <span className="font-bold text-emerald-800 font-mono text-sm">
                            {(item.totalPrice || 0).toLocaleString('ar-EG')} ج
                          </span>
                        </div>
                      ))}
                    </div>

                    {order.notes && (
                      <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl">
                        <strong>ملاحظات العميل:</strong> {order.notes}
                      </div>
                    )}

                    {/* Direct Quick Collection Button */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                      <div>
                        <span className="font-black text-emerald-900 block">
                          💵 تحصيل المبلغ عند التسليم
                        </span>
                        <span className="text-[11px] text-emerald-700">
                          {remaining > 0
                            ? `المتبقي على هذه الفاتورة: ${(remaining || 0).toLocaleString('ar-EG')} جنيه`
                            : 'تم سداد كامل قيمة هذه الفاتورة'}
                        </span>
                      </div>

                      <button
                        onClick={() => openCollectModalForOrder(order)}
                        className="w-full sm:w-auto px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                      >
                        <DollarSign className="w-4 h-4" />
                        <span>{remaining > 0 ? 'تسجيل تحصيل / سداد' : 'تعديل السداد'}</span>
                      </button>
                    </div>

                    {/* Status Action Buttons */}
                    <div className="space-y-2 pt-1">
                      <div className="text-[11px] font-bold text-slate-500">تغيير حالة الطلب مباشرة:</div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button
                          onClick={() => onUpdateStatus(order.id, 'Confirmed')}
                          className={`py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1 border ${
                            order.status === 'Confirmed'
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white hover:bg-blue-50 text-blue-800 border-blue-200'
                          }`}
                        >
                          <span>📋 تأكيد الطلب</span>
                        </button>

                        <button
                          onClick={() => onUpdateStatus(order.id, 'Preparing')}
                          className={`py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1 border ${
                            order.status === 'Preparing'
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white hover:bg-indigo-50 text-indigo-800 border-indigo-200'
                          }`}
                        >
                          <span>📦 بدء التجهيز</span>
                        </button>

                        <button
                          onClick={() => onUpdateStatus(order.id, 'Out for Delivery')}
                          className={`py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1 border ${
                            order.status === 'Out for Delivery'
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-white hover:bg-purple-50 text-purple-800 border-purple-200'
                          }`}
                        >
                          <span>🚚 خرج للتوصيل</span>
                        </button>

                        <button
                          onClick={() => {
                            if (remaining > 0) {
                              openCollectModalForOrder(order);
                            } else {
                              onUpdateStatus(order.id, 'Delivered');
                            }
                          }}
                          className={`py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1 border ${
                            order.status === 'Delivered'
                              ? 'bg-emerald-700 text-white border-emerald-700'
                              : 'bg-white hover:bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          <span>✅ تم التسليم والتحصيل</span>
                        </button>
                      </div>
                    </div>

                    {/* Secondary Actions: Edit / Cancel / Print */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 gap-2">
                      <button
                        onClick={() => onUpdateStatus(order.id, 'Cancelled')}
                        className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-xl transition-colors border border-red-200"
                      >
                        ❌ إلغاء الطلب
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onOpenEditModal(order)}
                          className="py-2 px-3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-colors flex items-center gap-1"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>تعديل الأصناف والخصم</span>
                        </button>

                        <button
                          onClick={() => onOpenPrintModal(order)}
                          className="py-2 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>طباعة الفاتورة</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Collect Modal for Specific Order */}
      {collectOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 text-right shadow-2xl text-slate-800 relative animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">
                    تحصيل فاتورة {collectOrder.orderNumber}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">{collectOrder.customerName}</p>
                </div>
              </div>

              <button
                onClick={() => setCollectOrder(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Math Breakdown */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3 grid grid-cols-2 gap-2 text-xs font-mono">
              <div>
                <span className="text-[10px] text-slate-500 font-sans block">إجمالي الفاتورة:</span>
                <span className="font-bold text-slate-900">{(collectOrder.grandTotal || 0).toLocaleString('ar-EG')} ج</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-sans block">المتبقي المطلوب:</span>
                <span className="font-black text-red-700">
                  {((collectOrder.remainingBalance != null ? collectOrder.remainingBalance : (collectOrder.grandTotal || 0) - (collectOrder.paidAmount || 0)) || 0).toLocaleString('ar-EG')} ج
                </span>
              </div>
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

            <form onSubmit={handleCollectSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  المبلغ المدفوع وقت التسليم (جنيه) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  max={collectOrder.remainingBalance != null ? collectOrder.remainingBalance : (collectOrder.grandTotal || 0)}
                  required
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-mono text-base font-bold focus:outline-hidden focus:border-emerald-600"
                  placeholder="0"
                />
                <div className="flex gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setCollectAmount(String(collectOrder.remainingBalance != null ? collectOrder.remainingBalance : (collectOrder.grandTotal || 0)))}
                    className="px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold"
                  >
                    دفع كامل المبلغ ({((collectOrder.remainingBalance != null ? collectOrder.remainingBalance : (collectOrder.grandTotal || 0)) || 0).toLocaleString('ar-EG')} ج)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollectAmount('0')}
                    className="px-2 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold"
                  >
                    أجل بالكامل (0 ج)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">طريقة الدفع</label>
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
                <label className="block font-bold text-slate-700 mb-1">ملاحظات التحصيل</label>
                <input
                  type="text"
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                  placeholder="مثال: تم الاستلام نقدًا عند باب المحل"
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex items-center gap-2 p-2.5 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                <input
                  type="checkbox"
                  id="markDeliveredCheck"
                  checked={markDeliveredWithPayment}
                  onChange={(e) => setMarkDeliveredWithPayment(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <label htmlFor="markDeliveredCheck" className="font-bold text-emerald-900 cursor-pointer">
                  تحديث حالة الطلب إلى "تم التسليم ✅" فورًا
                </label>
              </div>

              {/* Instant Remaining Calculation */}
              <div className="p-2.5 bg-slate-100 rounded-xl border border-slate-200 flex justify-between font-mono font-bold">
                <span>المتبقي الجديد على هذه الفاتورة:</span>
                <span className="text-red-700">
                  {Math.max(0, (collectOrder.remainingBalance != null ? collectOrder.remainingBalance : (collectOrder.grandTotal || 0)) - (parseFloat(collectAmount) || 0)).toLocaleString('ar-EG')} ج
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCollectOrder(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={collecting}
                  className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {collecting ? <Clock className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>حفظ وتأكيد التحصيل</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

