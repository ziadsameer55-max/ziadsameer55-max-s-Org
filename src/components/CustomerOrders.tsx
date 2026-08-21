import React from 'react';
import { Order, OrderStatus } from '../types';
import {
  Clock,
  Printer,
  Package,
  RotateCcw,
  CheckCircle2,
  Boxes,
  Truck,
  XCircle,
  FileText,
} from 'lucide-react';

interface CustomerOrdersProps {
  orders: Order[];
  onOpenPrintModal: (order: Order) => void;
  onReorder: (order: Order) => void;
  onNavigateToCatalog?: () => void;
}

export const CustomerOrders: React.FC<CustomerOrdersProps> = ({
  orders,
  onOpenPrintModal,
  onReorder,
  onNavigateToCatalog,
}) => {
  const getStatusDisplay = (status: OrderStatus) => {
    switch (status) {
      case 'Pending':
        return {
          label: 'قيد الانتظار',
          icon: '⏳',
          className: 'bg-amber-50 text-amber-800 border-amber-200',
        };
      case 'Confirmed':
        return {
          label: 'تم التأكيد',
          icon: '📋',
          className: 'bg-blue-50 text-blue-800 border-blue-200',
        };
      case 'Preparing':
        return {
          label: 'جاري التجهيز',
          icon: '📦',
          className: 'bg-indigo-50 text-indigo-800 border-indigo-200',
        };
      case 'Out for Delivery':
        return {
          label: 'خرج للتوصيل',
          icon: '🚚',
          className: 'bg-purple-50 text-purple-800 border-purple-200',
        };
      case 'Delivered':
        return {
          label: 'تم التسليم',
          icon: '✅',
          className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        };
      case 'Cancelled':
        return {
          label: 'ملغي',
          icon: '❌',
          className: 'bg-red-50 text-red-800 border-red-200',
        };
      default:
        return {
          label: status,
          icon: '📋',
          className: 'bg-slate-100 text-slate-700 border-slate-200',
        };
    }
  };

  return (
    <div className="space-y-4 pb-20 text-right" dir="rtl">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0 border border-emerald-100">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">سجل طلباتي</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              متابعة حالة الطلبات وإعادة طلب الأصناف بضغطة زر
            </p>
          </div>
        </div>

        <span className="text-xs bg-slate-100 text-slate-700 font-bold px-3 py-1 rounded-full border border-gray-200">
          {orders.length} طلبات
        </span>
      </div>

      {/* Orders Cards List */}
      {orders.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-slate-500 shadow-xs space-y-3">
          <Package className="w-12 h-12 mx-auto opacity-30 text-emerald-600" />
          <h3 className="font-bold text-base text-slate-800">لا توجد لديك طلبات سابقة</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            تصفح كتالوج شركة الحليم وأضف المنتجات المطلوبة لبدء أول طلب لك.
          </p>
          {onNavigateToCatalog && (
            <button
              onClick={onNavigateToCatalog}
              className="mt-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors inline-block"
            >
              ابدأ التسوق الآن
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const statusInfo = getStatusDisplay(order.status);

            return (
              <div
                key={order.id}
                className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs hover:border-gray-300 transition-all space-y-3"
              >
                {/* Top Row: Order # and Status */}
                <div className="flex items-center justify-between pb-2.5 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-base text-slate-900 font-mono">
                      {order.orderNumber}
                    </span>
                    <span className="text-xs text-slate-400 font-normal">
                      • {order.createdAt}
                    </span>
                  </div>

                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-bold border inline-flex items-center gap-1 ${statusInfo.className}`}
                  >
                    <span>{statusInfo.icon}</span>
                    <span>{statusInfo.label}</span>
                  </span>
                </div>

                {/* Middle Info Row: Items count, Total, Items preview */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">الأصناف: </span>
                    <strong className="text-slate-800 font-bold">{order.itemsCount} صنف</strong>
                    <span className="text-slate-400 mx-1.5">|</span>
                    <span className="text-slate-500">الكمية: </span>
                    <strong className="text-slate-800 font-bold">{order.totalQuantity} قطعة</strong>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-xs text-slate-500 ml-1.5">الإجمالي:</span>
                    <span className="text-base font-black text-emerald-700 font-mono">
                      {(order.grandTotal || 0).toLocaleString('ar-EG')}{' '}
                      <span className="text-xs font-bold">جنيه</span>
                    </span>
                  </div>
                </div>

                {/* Items Summary Pills */}
                {order.items && order.items.length > 0 && (
                  <div className="bg-slate-50 border border-gray-100 rounded-xl p-2.5 text-xs text-slate-600 flex flex-wrap gap-1.5">
                    {order.items.slice(0, 4).map((i) => (
                      <span
                        key={i.id}
                        className="bg-white border border-gray-200 px-2 py-0.5 rounded-md text-[11px] font-medium"
                      >
                        {i.productName} ({i.quantity} {i.unit})
                      </span>
                    ))}
                    {order.items.length > 4 && (
                      <span className="text-slate-400 text-[11px] self-center">
                        +{order.items.length - 4} أصناف أخرى...
                      </span>
                    )}
                  </div>
                )}

                {/* Actions: Re-order & Print */}
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-500">
                    المندوب: <strong className="text-slate-700">{order.salesRep || 'محمد فوزي'}</strong>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Re-order Button 🔄 */}
                    <button
                      onClick={() => onReorder(order)}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5"
                      title="نسخ الأصناف إلى السلة لإنشاء طلب جديد"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>🔄 إعادة الطلب</span>
                    </button>

                    {/* Print / View Receipt */}
                    <button
                      onClick={() => onOpenPrintModal(order)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-gray-200 rounded-xl font-bold text-xs transition-colors flex items-center gap-1"
                      title="عرض وطباعة الفاتورة"
                    >
                      <Printer className="w-3.5 h-3.5 text-emerald-600" />
                      <span>الفاتورة</span>
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
