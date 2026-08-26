import React, { useState, useEffect } from 'react';
import { Order, OrderStatus, SystemSettings, FinancialSummary } from '../types';
import { apiFetch } from '../utils/api';
import {
  ShieldCheck,
  Lock,
  Unlock,
  Search,
  Edit,
  CheckCircle2,
  Printer,
  RefreshCw,
  Clock,
  Truck,
  Boxes,
  Package,
  Calendar,
  AlertCircle,
  FileText,
  DollarSign,
  TrendingUp,
  Wallet,
  ArrowUpRight,
} from 'lucide-react';

interface AdminDashboardProps {
  orders: Order[];
  settings: SystemSettings | null;
  onToggleOrdersOpen: (isOpen: boolean) => void;
  onOpenEditModal: (order: Order) => void;
  onOpenPrintModal: (order: Order) => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  onRefreshData: () => void;
  onNavigateToTab?: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  orders = [],
  settings,
  onToggleOrdersOpen,
  onOpenEditModal,
  onOpenPrintModal,
  onUpdateStatus,
  onRefreshData,
  onNavigateToTab,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [finSummary, setFinSummary] = useState<FinancialSummary | null>(null);
  const [finLoading, setFinLoading] = useState(false);

  const fetchFinancialStats = async () => {
    try {
      setFinLoading(true);
      const res = await apiFetch('/api/debts');
      if (res.ok) {
        const json = await res.json();
        if (json.summary) {
          setFinSummary(json.summary);
        }
      }
    } catch (err) {
      console.error('Error fetching financial summary in AdminDashboard:', err);
    } finally {
      setFinLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancialStats();
  }, [orders]);

  const isOrdersOpen = settings?.isManualOverrideActive
    ? settings.manualOrdersOpen
    : true;

  const safeOrders = Array.isArray(orders) ? orders : [];

  // Filter orders
  const filteredOrders = safeOrders.filter((ord) => {
    if (filterStatus !== 'all') {
      if (filterStatus === 'Pending' && ord.status !== 'Pending' && ord.status !== 'New') return false;
      if (filterStatus !== 'Pending' && ord.status !== filterStatus) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        (ord.orderNumber || '').toLowerCase().includes(q) ||
        (ord.customerName || '').toLowerCase().includes(q) ||
        (ord.customerPhone || '').includes(q)
      );
    }
    return true;
  });

  // Calculate order counts
  const pendingCount = safeOrders.filter((o) => o.status === 'Pending' || o.status === 'New').length;
  const confirmedCount = safeOrders.filter((o) => o.status === 'Confirmed').length;
  const preparingCount = safeOrders.filter((o) => o.status === 'Preparing').length;
  const totalDelivered = safeOrders.filter((o) => o.status === 'Delivered').length;
  const totalSales = finSummary?.totalSales ?? safeOrders
    .filter((o) => o.status !== 'Cancelled')
    .reduce((sum, o) => sum + (o.grandTotal || 0), 0);

  const getStatusBadge = (status: OrderStatus | string) => {
    switch (status) {
      case 'Pending':
      case 'New':
        return (
          <span className="bg-amber-50 text-amber-800 border border-amber-200 text-xs px-2.5 py-0.5 rounded-full font-bold">
            قيد الانتظار ⏳
          </span>
        );
      case 'Confirmed':
        return (
          <span className="bg-blue-50 text-blue-800 border border-blue-200 text-xs px-2.5 py-0.5 rounded-full font-bold">
            تم التأكيد 📋
          </span>
        );
      case 'Preparing':
        return (
          <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs px-2.5 py-0.5 rounded-full font-bold">
            جاري التجهيز 📦
          </span>
        );
      case 'Out for Delivery':
      case 'Ready':
        return (
          <span className="bg-purple-50 text-purple-800 border border-purple-200 text-xs px-2.5 py-0.5 rounded-full font-bold">
            خرج للتوصيل 🚚
          </span>
        );
      case 'Delivered':
        return (
          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs px-2.5 py-0.5 rounded-full font-bold">
            تم التسليم ✅
          </span>
        );
      case 'Cancelled':
        return (
          <span className="bg-red-50 text-red-800 border border-red-200 text-xs px-2.5 py-0.5 rounded-full font-bold">
            ملغي ❌
          </span>
        );
      default:
        return (
          <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 text-right pb-16" dir="rtl">
      {/* Top Banner & Fast Controls */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 font-bold shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-800">
              لوحة تحكم الإدارة ومراجعة الطلبات
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              شركة الحليم للتجارة والتوزيع — إدارة الحاج فوزي عبد الحليم (المندوب: محمد فوزي)
            </p>
          </div>
        </div>

        {/* Store Ordering Switch */}
        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-gray-200 w-full md:w-auto justify-between md:justify-end text-xs">
          <span className="font-bold text-slate-700 px-2">
            الاستقبال: {isOrdersOpen ? '🟢 مفتوح' : '🔴 مغلق'}
          </span>

          <button
            onClick={() => onToggleOrdersOpen(true)}
            className={`px-3 py-1.5 rounded font-bold transition-all flex items-center gap-1 ${
              isOrdersOpen
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>فتح</span>
          </button>

          <button
            onClick={() => onToggleOrdersOpen(false)}
            className={`px-3 py-1.5 rounded font-bold transition-all flex items-center gap-1 ${
              !isOrdersOpen
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>إغلاق</span>
          </button>
        </div>
      </div>

      {/* Financial Performance Overview (Server-Authoritative) */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-4 shadow-sm border border-slate-700/60">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-700/80">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
              💰
            </div>
            <div>
              <h3 className="text-xs font-black text-white">مؤشرات الخزينة والتحصيل الفعلي</h3>
              <span className="text-[10px] text-slate-400">محدثة لحظيًا بناءً على سجل المدفوعات الحقيقي</span>
            </div>
          </div>

          {onNavigateToTab && (
            <button
              onClick={() => onNavigateToTab('admin-collections')}
              className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-slate-800/80 hover:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 transition-colors cursor-pointer"
            >
              <span>فتح تقرير التحصيل الكامل</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* Total Sales */}
          <div className="bg-slate-800/90 rounded-xl p-2.5 border border-slate-700/70">
            <span className="text-[10px] text-slate-400 font-bold block mb-0.5">📊 إجمالي المبيعات</span>
            <div className="text-sm md:text-base font-black text-white">
              {(finSummary?.totalSales ?? totalSales).toLocaleString('ar-EG')}{' '}
              <span className="text-[9px] text-slate-400 font-normal">ج.م</span>
            </div>
          </div>

          {/* Today Collection */}
          <div className="bg-emerald-950/40 rounded-xl p-2.5 border border-emerald-800/60">
            <span className="text-[10px] text-emerald-400 font-bold block mb-0.5">💰 تحصيل اليوم</span>
            <div className="text-sm md:text-base font-black text-emerald-300">
              {(finSummary?.collectedToday || 0).toLocaleString('ar-EG')}{' '}
              <span className="text-[9px] text-emerald-400/80 font-normal">ج.م</span>
            </div>
          </div>

          {/* This Week Collection */}
          <div className="bg-blue-950/40 rounded-xl p-2.5 border border-blue-800/60">
            <span className="text-[10px] text-blue-400 font-bold block mb-0.5">📅 تحصيل هذا الأسبوع</span>
            <div className="text-sm md:text-base font-black text-blue-300">
              {(finSummary?.collectedThisWeek || 0).toLocaleString('ar-EG')}{' '}
              <span className="text-[9px] text-blue-400/80 font-normal">ج.م</span>
            </div>
          </div>

          {/* This Month Collection */}
          <div className="bg-indigo-950/40 rounded-xl p-2.5 border border-indigo-800/60">
            <span className="text-[10px] text-indigo-400 font-bold block mb-0.5">🗓️ تحصيل هذا الشهر</span>
            <div className="text-sm md:text-base font-black text-indigo-300">
              {(finSummary?.collectedThisMonth || 0).toLocaleString('ar-EG')}{' '}
              <span className="text-[9px] text-indigo-400/80 font-normal">ج.م</span>
            </div>
          </div>

          {/* This Year Collection */}
          <div className="bg-purple-950/40 rounded-xl p-2.5 border border-purple-800/60">
            <span className="text-[10px] text-purple-400 font-bold block mb-0.5">📆 تحصيل هذه السنة</span>
            <div className="text-sm md:text-base font-black text-purple-300">
              {(finSummary?.collectedThisYear || 0).toLocaleString('ar-EG')}{' '}
              <span className="text-[9px] text-purple-400/80 font-normal">ج.م</span>
            </div>
          </div>

          {/* Total Outstanding Debt */}
          <div className="bg-red-950/40 rounded-xl p-2.5 border border-red-800/60">
            <span className="text-[10px] text-red-400 font-bold block mb-0.5">⚠️ إجمالي المديونيات</span>
            <div className="text-sm md:text-base font-black text-red-300">
              {(finSummary?.totalOutstandingDebt || 0).toLocaleString('ar-EG')}{' '}
              <span className="text-[9px] text-red-400/80 font-normal">ج.م</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Summary Metrics Cards (Order Pipeline) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white border border-amber-200 rounded-xl p-3 shadow-xs relative overflow-hidden">
          <div className="text-[11px] text-amber-800 font-medium flex items-center justify-between">
            <span>قيد الانتظار ⏳</span>
            {pendingCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            )}
          </div>
          <div className="text-xl font-black text-amber-900 mt-0.5">{pendingCount}</div>
        </div>

        <div className="bg-white border border-blue-200 rounded-xl p-3 shadow-xs">
          <div className="text-[11px] text-blue-700 font-medium">تم التأكيد 📋</div>
          <div className="text-xl font-black text-blue-900 mt-0.5">{confirmedCount}</div>
        </div>

        <div className="bg-white border border-indigo-200 rounded-xl p-3 shadow-xs">
          <div className="text-[11px] text-indigo-700 font-medium">جاري التجهيز 📦</div>
          <div className="text-xl font-black text-indigo-900 mt-0.5">{preparingCount}</div>
        </div>

        <div className="bg-white border border-emerald-200 rounded-xl p-3 shadow-xs">
          <div className="text-[11px] text-emerald-700 font-medium">تم التسليم بنجاح ✅</div>
          <div className="text-xl font-black text-emerald-900 mt-0.5 font-mono">{totalDelivered}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2.5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم الطلب، اسم العميل، أو الهاتف..."
              className="w-full bg-slate-50 border border-gray-200 rounded-lg py-2 pr-9 pl-3 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white text-right"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 scrollbar-none text-xs">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1 rounded-md font-bold shrink-0 transition-all ${
                filterStatus === 'all'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              الكل ({orders.length})
            </button>
            <button
              onClick={() => setFilterStatus('Pending')}
              className={`px-3 py-1 rounded-md font-bold shrink-0 transition-all ${
                filterStatus === 'Pending'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              قيد الانتظار ({pendingCount})
            </button>
            <button
              onClick={() => setFilterStatus('Confirmed')}
              className={`px-3 py-1 rounded-md font-bold shrink-0 transition-all ${
                filterStatus === 'Confirmed'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              معتمد ({confirmedCount})
            </button>
            <button
              onClick={() => setFilterStatus('Preparing')}
              className={`px-3 py-1 rounded-md font-bold shrink-0 transition-all ${
                filterStatus === 'Preparing'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              جاري التجهيز ({preparingCount})
            </button>
            <button
              onClick={() => setFilterStatus('Delivered')}
              className={`px-3 py-1 rounded-md font-bold shrink-0 transition-all ${
                filterStatus === 'Delivered'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              تم التسليم ({totalDelivered})
            </button>

            <button
              onClick={onRefreshData}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 border border-gray-200 transition-all mr-1"
              title="تحديث البيانات"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-slate-500 shadow-xs space-y-1">
          <Package className="w-10 h-10 mx-auto opacity-30 text-emerald-600" />
          <h3 className="font-bold text-sm text-slate-800">لا توجد طلبات تطابق هذا التحديد</h3>
          <p className="text-xs text-slate-400">جرب تغيير حالة الفلتر أو كلمة البحث</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const isPending = order.status === 'Pending' || order.status === 'New';

            return (
              <div
                key={order.id}
                className={`bg-white border rounded-xl p-3.5 sm:p-4 shadow-xs transition-all ${
                  isPending
                    ? 'border-amber-400 ring-2 ring-amber-500/10'
                    : 'border-gray-200'
                }`}
              >
                {/* Header Info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-base text-slate-900">{order.orderNumber}</span>
                    <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded font-bold border border-gray-200">
                      العميل: {order.customerName} ({order.customerPhone})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-mono">{order.createdAt}</span>

                    {/* Status Dropdown */}
                    <select
                      value={order.status}
                      onChange={(e) => onUpdateStatus(order.id, e.target.value as OrderStatus)}
                      className="bg-slate-50 border border-gray-200 text-slate-800 text-xs font-bold rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="Pending">⏳ قيد الانتظار (Pending)</option>
                      <option value="Confirmed">📋 تم التأكيد (Confirmed)</option>
                      <option value="Preparing">📦 جاري التجهيز (Preparing)</option>
                      <option value="Out for Delivery">🚚 خرج للتوصيل (Out for Delivery)</option>
                      <option value="Delivered">✅ تم التسليم (Delivered)</option>
                      <option value="Cancelled">❌ ملغي (Cancelled)</option>
                    </select>
                  </div>
                </div>

                {/* Items Grid */}
                <div className="py-2.5 space-y-1">
                  <div className="text-xs font-bold text-slate-500 mb-1">أصناف الطلب:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {order.items?.map((item) => (
                      <div
                        key={item.id}
                        className="bg-slate-50 border border-gray-100 rounded-lg p-2 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-800">{item.productName}</div>
                          <div className="text-slate-500 text-[11px] mt-0.5">
                            {item.quantity} {item.unit} × {item.unitPrice.toLocaleString('ar-EG')} ج.م
                          </div>
                        </div>
                        <div className="font-bold text-emerald-700 font-mono">
                          {item.totalPrice.toLocaleString('ar-EG')} ج.م
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                {(order.notes || order.adminNotes) && (
                  <div className="bg-amber-50/60 rounded-lg p-2 text-xs text-slate-700 border border-amber-100 space-y-0.5 mb-2">
                    {order.notes && (
                      <div>
                        <strong className="text-amber-900">ملاحظات العميل:</strong> {order.notes}
                      </div>
                    )}
                    {order.adminNotes && (
                      <div>
                        <strong className="text-emerald-900">ملاحظات الإدارة:</strong> {order.adminNotes}
                      </div>
                    )}
                  </div>
                )}

                {/* Footer and Actions */}
                <div className="pt-2.5 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-right w-full sm:w-auto">
                    <span className="text-xs text-slate-500">
                      الأصناف: <strong className="text-slate-800">{order.itemsCount}</strong> | الكمية:{' '}
                      <strong className="text-slate-800">{order.totalQuantity}</strong>
                    </span>
                    <div className="text-sm sm:text-base font-black text-emerald-600 font-mono">
                      الإجمالي: {order.grandTotal.toLocaleString('ar-EG')}{' '}
                      <span className="text-xs font-normal">جنيه</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto justify-end">
                    {/* Edit Order button */}
                    <button
                      onClick={() => onOpenEditModal(order)}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors flex items-center gap-1 shadow-xs"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>تعديل وحذف الأصناف</span>
                    </button>

                    {/* Quick confirm/status transitions */}
                    {order.status === 'Pending' || order.status === 'New' ? (
                      <button
                        onClick={() => onUpdateStatus(order.id, 'Confirmed')}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors flex items-center gap-1 shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>تأكيد الطلب 📋</span>
                      </button>
                    ) : order.status === 'Confirmed' ? (
                      <button
                        onClick={() => onUpdateStatus(order.id, 'Preparing')}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors flex items-center gap-1 shadow-xs"
                      >
                        <Boxes className="w-3.5 h-3.5" />
                        <span>تحويل للتجهيز 📦</span>
                      </button>
                    ) : order.status === 'Preparing' ? (
                      <button
                        onClick={() => onUpdateStatus(order.id, 'Out for Delivery')}
                        className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors flex items-center gap-1 shadow-xs"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>خروج للتوصيل 🚚</span>
                      </button>
                    ) : null}

                    {/* Print Receipt */}
                    <button
                      onClick={() => onOpenPrintModal(order)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-gray-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      <Printer className="w-3.5 h-3.5 text-emerald-600" />
                      <span>طباعة الفاتورة</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
