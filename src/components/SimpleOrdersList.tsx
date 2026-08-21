import React, { useState } from 'react';
import { Order, OrderStatus } from '../types';
import {
  Package,
  RotateCcw,
  Printer,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface SimpleOrdersListProps {
  orders: Order[];
  onReorder: (order: Order) => void;
  onOpenPrintModal: (order: Order) => void;
  onNavigateToCatalog: () => void;
}

export const SimpleOrdersList: React.FC<SimpleOrdersListProps> = ({
  orders,
  onReorder,
  onOpenPrintModal,
  onNavigateToCatalog,
}) => {
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'Pending':
        return { label: 'قيد الانتظار', icon: '⏳', color: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'Confirmed':
        return { label: 'تم التأكيد', icon: '📋', color: 'bg-blue-50 text-blue-800 border-blue-200' };
      case 'Preparing':
        return { label: 'جاري التجهيز', icon: '📦', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
      case 'Out for Delivery':
        return { label: 'خرج للتوصيل', icon: '🚚', color: 'bg-purple-50 text-purple-800 border-purple-200' };
      case 'Delivered':
        return { label: 'تم التسليم', icon: '✅', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'Cancelled':
        return { label: 'ملغي', icon: '❌', color: 'bg-red-50 text-red-800 border-red-200' };
      default:
        return { label: status, icon: '📋', color: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const toggleExpand = (orderId: string) => {
    setExpandedOrderId(prev => prev === orderId ? null : orderId);
  };

  return (
    <div className="space-y-3 pb-24 text-right max-w-2xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between py-1">
        <h2 className="font-black text-slate-900 text-lg">سجل الطلبات</h2>
        <span className="text-xs bg-white text-slate-700 font-bold px-3 py-1 rounded-full border border-slate-200">
          {orders.length} طلب
        </span>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 shadow-xs space-y-3">
          <Package className="w-12 h-12 mx-auto text-emerald-600 opacity-40" />
          <h3 className="font-bold text-base text-slate-800">لا توجد طلبات سابقة بعد</h3>
          <p className="text-xs text-slate-400">
            يمكنك تصفح دفتر المنتجات وإرسال طلبك الآن بسهولة.
          </p>
          <button
            onClick={onNavigateToCatalog}
            className="mt-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
          >
            بدء الطلب الآن
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {orders.map((order) => {
            const badge = getStatusBadge(order.status);
            const isExpanded = expandedOrderId === order.id;

            return (
              <div
                key={order.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:border-slate-300 transition-colors"
              >
                {/* Main Clickable Row */}
                <div
                  onClick={() => toggleExpand(order.id)}
                  className="p-3.5 sm:p-4 cursor-pointer flex items-center justify-between gap-3 select-none"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 font-mono text-base">
                      {order.orderNumber}
                    </span>
                    <span className="text-slate-400 text-xs">—</span>
                    {order.grandTotal > 0 ? (
                      <span className="font-black text-emerald-800 font-mono text-base">
                        {order.grandTotal.toLocaleString('ar-EG')} ج
                      </span>
                    ) : (
                      <span className="font-bold text-slate-600 text-xs bg-slate-100 px-2 py-0.5 rounded">
                        🔒 تسعير خاص
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-bold border inline-flex items-center gap-1 ${badge.color}`}
                    >
                      <span>{badge.icon}</span>
                      <span>{badge.label}</span>
                    </span>

                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Quick details summary line */}
                <div className="px-3.5 pb-2.5 -mt-1 text-[11px] text-slate-500 flex items-center justify-between border-b border-slate-50">
                  <span>{order.createdAt} • {order.itemsCount} صنف</span>
                  <div className="flex items-center gap-1.5 font-bold">
                    {order.grandTotal > 0 ? (
                      order.paymentStatus === 'Paid' ? (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          🟢 مدفوعة بالكامل
                        </span>
                      ) : order.paymentStatus === 'Partial' ? (
                        <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          🟡 متبقي: {(order.remainingBalance || 0).toLocaleString('ar-EG')} ج
                        </span>
                      ) : (
                        <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                          🔴 غير مدفوعة (أجل)
                        </span>
                      )
                    ) : (
                      <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        تسليم واستلام
                      </span>
                    )}
                  </div>
                </div>

                {/* Expanded Item Breakdown & Action Buttons */}
                {isExpanded && (
                  <div className="p-3.5 bg-slate-50 border-t border-slate-100 space-y-3 animate-fadeIn text-xs">
                    {/* Financial summary for customer if prices visible */}
                    {order.grandTotal > 0 && (
                      <div className="bg-white border border-slate-200 rounded-xl p-2.5 grid grid-cols-3 gap-2 text-center font-mono">
                        <div>
                          <span className="text-[10px] text-slate-500 font-sans block">قيمة الفاتورة</span>
                          <span className="font-bold text-slate-900">{order.grandTotal.toLocaleString('ar-EG')} ج</span>
                        </div>
                        <div className="border-r border-l border-slate-200">
                          <span className="text-[10px] text-slate-500 font-sans block">المدفوع</span>
                          <span className="font-bold text-emerald-800">{(order.paidAmount || 0).toLocaleString('ar-EG')} ج</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-sans block">المتبقي</span>
                          <span className={`font-black ${(order.remainingBalance || 0) > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                            {((order.remainingBalance != null ? order.remainingBalance : Math.max(0, (order.grandTotal || 0) - (order.paidAmount || 0))) || 0).toLocaleString('ar-EG')} ج
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Items table */}
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                      {(order.items || []).map((item) => (
                        <div key={item.id} className="p-2.5 flex justify-between items-center text-xs">
                          <div>
                            <span className="font-bold text-slate-800">{item.productName}</span>
                            <span className="text-[11px] text-slate-400 font-mono block">
                              {item.quantity} {item.unit}
                              {item.unitPrice > 0 && ` × ${item.unitPrice} ج`}
                            </span>
                          </div>
                          <span className="font-bold text-emerald-800 font-mono">
                            {item.totalPrice > 0
                              ? `${item.totalPrice.toLocaleString('ar-EG')} ج`
                              : `${item.quantity} ${item.unit}`}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onReorder(order);
                        }}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>🔄 إعادة الطلب</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenPrintModal(order);
                        }}
                        className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl transition-colors flex items-center gap-1"
                      >
                        <Printer className="w-3.5 h-3.5 text-emerald-700" />
                        <span>الفاتورة</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
