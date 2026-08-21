import React from 'react';
import { Order } from '../types';
import { CheckCircle, Clock, ShoppingBag } from 'lucide-react';

interface OrderSuccessViewProps {
  order: Order | null;
  onTrackOrder: () => void;
  onNewOrder: () => void;
}

export const OrderSuccessView: React.FC<OrderSuccessViewProps> = ({
  order,
  onTrackOrder,
  onNewOrder,
}) => {
  if (!order) return null;

  return (
    <div className="max-w-md mx-auto py-8 px-4 text-center space-y-6" dir="rtl">
      {/* Big Check Icon */}
      <div className="w-20 h-20 bg-emerald-100 border-2 border-emerald-300 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-xs">
        <CheckCircle className="w-12 h-12" />
      </div>

      {/* Main Title */}
      <div className="space-y-1">
        <h2 className="text-2xl font-black text-slate-900">
          تم إرسال الطلب بنجاح
        </h2>
        <div className="text-xl font-black text-emerald-800 font-mono">
          {order.orderNumber}
        </div>
      </div>

      {/* Details Box */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2.5 text-xs text-right">
        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
          <span className="text-slate-500 font-medium">الإجمالي:</span>
          <span className="font-black text-lg text-emerald-800 font-mono">
            {(order.grandTotal || 0).toLocaleString('ar-EG')} جنيه
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-500 font-medium">حالة الطلب:</span>
          <span className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
            <span>🟡</span>
            <span>قيد المراجعة والتجهيز</span>
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-500 font-medium">المندوب المعتمد:</span>
          <span className="font-bold text-slate-800">{order.salesRep || 'محمد فوزي'}</span>
        </div>

        <div className="flex justify-between items-center text-[11px] text-slate-400">
          <span>توقيت الإرسال:</span>
          <span>{order.createdAt}</span>
        </div>
      </div>

      {/* Two Direct Buttons Only */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          onClick={onTrackOrder}
          className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 border border-slate-300"
        >
          <Clock className="w-4 h-4 text-emerald-700" />
          <span>متابعة الطلب</span>
        </button>

        <button
          onClick={onNewOrder}
          className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>طلب جديد</span>
        </button>
      </div>
    </div>
  );
};
