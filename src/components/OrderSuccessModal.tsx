import React from 'react';
import { Order, SystemSettings } from '../types';
import {
  CheckCircle2,
  Clock,
  Check,
  Truck,
  PackageCheck,
  Phone,
  MessageCircle,
  Printer,
  ChevronLeft,
  X,
  FileText,
} from 'lucide-react';

interface OrderSuccessModalProps {
  order: Order | null;
  settings: SystemSettings | null;
  onClose: () => void;
  onNavigateToOrders: () => void;
  onPrintReceipt?: (order: Order) => void;
}

const TIMELINE_STEPS = [
  { id: 'Pending', label: 'تم استلام الطلب', icon: Clock },
  { id: 'Reviewing', label: 'جاري المراجعة', icon: FileText },
  { id: 'Confirmed', label: 'تم تأكيد الطلب', icon: Check },
  { id: 'Preparing', label: 'جاري التجهيز', icon: PackageCheck },
  { id: 'Out for Delivery', label: 'خرج للتوصيل', icon: Truck },
  { id: 'Delivered', label: 'تم التسليم', icon: CheckCircle2 },
];

export const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({
  order,
  settings,
  onClose,
  onNavigateToOrders,
  onPrintReceipt,
}) => {
  if (!order) return null;

  const currentStepIdx = Math.max(
    0,
    TIMELINE_STEPS.findIndex((s) => s.id === order.status)
  );

  const repPhone = settings?.phonePrimary || '01000000000';
  const whatsappMsg = encodeURIComponent(
    `السلام عليكم، بخصوص طلب الجملة رقم #${order.orderNumber} لـ ${order.customerName}`
  );

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      dir="rtl"
    >
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-5 text-right relative space-y-4 animate-scaleUp overflow-hidden max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Success Header */}
        <div className="text-center space-y-1 pt-2">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-800 rounded-3xl flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-xl font-black text-slate-900">تم إرسال طلبك بنجاح!</h2>
          <div className="inline-block bg-emerald-50 text-emerald-900 border border-emerald-200 px-3 py-1 rounded-xl text-xs font-mono font-black mt-1">
            رقم الطلب: #{order.orderNumber}
          </div>
        </div>

        {/* Order Details Brief */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>العميل:</span>
            <span className="font-bold text-slate-900">{order.customerName}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>إجمالي الكمية:</span>
            <span className="font-bold text-slate-900">
              {order.totalQuantity} كرتونة ({order.itemsCount} صنف)
            </span>
          </div>
          <div className="flex justify-between text-slate-600 border-t border-slate-200 pt-1">
            <span>المبلغ الإجمالي:</span>
            {order.grandTotal > 0 ? (
              <span className="font-black text-emerald-800 font-mono text-sm">
                {order.grandTotal.toLocaleString('ar-EG')} ج.م
              </span>
            ) : (
              <span className="font-bold text-slate-600 text-xs bg-slate-200/70 px-2 py-0.5 rounded">
                🔒 معتمد عند التسليم
              </span>
            )}
          </div>
        </div>

        {/* 7-Step Status Timeline */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          <div className="text-xs font-black text-slate-900 flex items-center justify-between">
            <span>مراحل معالجة وتوصيل الطلب</span>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
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
                : order.status}
            </span>
          </div>

          <div className="relative pl-2 pr-2 py-1 space-y-3">
            {TIMELINE_STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isPastOrCurrent = idx <= currentStepIdx;
              const isCurrent = idx === currentStepIdx;

              return (
                <div key={step.id} className="flex items-center gap-3 relative">
                  {/* Circle Indicator */}
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors z-10 ${
                      isPastOrCurrent
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-400 border border-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>

                  {/* Step Label */}
                  <div className="flex-1 text-xs">
                    <span
                      className={`font-bold ${
                        isCurrent
                          ? 'text-emerald-900 font-black'
                          : isPastOrCurrent
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>

                  {isCurrent && (
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Contact Sales Rep */}
        <div className="grid grid-cols-2 gap-2">
          <a
            href={`https://wa.me/2${repPhone}?text=${whatsappMsg}`}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            <span>واتساب المندوب</span>
          </a>

          <a
            href={`tel:${repPhone}`}
            className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 flex items-center justify-center gap-1.5 transition-colors"
          >
            <Phone className="w-4 h-4" />
            <span>اتصال هاتفي</span>
          </a>
        </div>

        {/* Bottom Actions */}
        <div className="space-y-2 pt-1 border-t border-slate-100">
          {onPrintReceipt && (
            <button
              onClick={() => onPrintReceipt(order)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة فاتورة / إيصال حراري 80mm</span>
            </button>
          )}

          <button
            onClick={() => {
              onClose();
              onNavigateToOrders();
            }}
            className="w-full py-3 bg-emerald-800 hover:bg-emerald-900 text-white font-black text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-xs"
          >
            <span>متابعة طلباتي في سجل الأوردرات</span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
