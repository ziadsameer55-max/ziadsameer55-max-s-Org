import React, { useRef, useState } from 'react';
import { Order, SystemSettings } from '../types';
import { Printer, X, FileText, Receipt, CheckCircle, Store, Phone, Calendar, User as UserIcon } from 'lucide-react';
import { printHtmlContent } from '../utils/printHelper';

interface PrintReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  settings: SystemSettings | null;
}

export const PrintReceiptModal: React.FC<PrintReceiptModalProps> = ({
  isOpen,
  onClose,
  order,
  settings,
}) => {
  const [printFormat, setPrintFormat] = useState<'80mm' | 'A4'>('80mm');
  const printableRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (printableRef.current) {
      printHtmlContent(printableRef.current.innerHTML, {
        title: `فاتورة #${order.orderNumber}`,
        paperSize: printFormat === '80mm' ? '80mm' : 'A4',
      });
    } else {
      window.print();
    }
  };

  const remaining = order.remainingBalance !== undefined
    ? order.remainingBalance
    : Math.max(0, order.grandTotal - (order.paidAmount || 0));

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" dir="rtl">
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-invoice, #printable-invoice * {
            visibility: visible !important;
          }
          #printable-invoice {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 8px !important;
            color: #000000 !important;
            background: #ffffff !important;
            font-family: 'Cairo', 'Courier New', monospace !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-3xl max-w-2xl w-full p-5 text-right shadow-2xl relative my-6 text-slate-900 animate-scaleUp max-h-[92vh] flex flex-col">
        {/* Controls Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 no-print shrink-0">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-emerald-800" />
            <div>
              <h3 className="font-black text-sm sm:text-base text-slate-900">
                طباعة الفاتورة - طلب #{order.orderNumber}
              </h3>
              <p className="text-[11px] text-slate-500">شركة الحليم للتجارة والتوزيع</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Format Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-bold">
              <button
                onClick={() => setPrintFormat('80mm')}
                className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                  printFormat === '80mm'
                    ? 'bg-white text-emerald-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>حراري 80mm</span>
              </button>
              <button
                onClick={() => setPrintFormat('A4')}
                className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                  printFormat === 'A4'
                    ? 'bg-white text-emerald-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>ورق A4 رسمي</span>
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-black text-xs flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة 🖨️</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Preview Container */}
        <div className="flex-1 overflow-y-auto p-3 flex justify-center bg-slate-100/70 rounded-2xl my-3">
          <div
            ref={printableRef}
            id="printable-invoice"
            className={`bg-white border border-slate-300 p-4 text-black shadow-sm font-sans transition-all ${
              printFormat === '80mm' ? 'w-[320px] text-xs' : 'w-full max-w-[650px] text-sm'
            }`}
            style={{ fontFamily: "'Cairo', sans-serif" }}
          >
            {/* Header */}
            <div className="text-center pb-2 border-b-2 border-black border-dashed">
              <h2 className="text-base font-black tracking-tight">شركة الحليم للتجارة والتوزيع</h2>
              <p className="text-[11px] font-bold text-slate-800">
                {settings?.activityDescription || 'توريدات المواد الغذائية والمشروبات بالجملة'}
              </p>
              <p className="text-[10px] text-slate-700">
                {settings?.address || 'محافظة الإسكندرية - بجوار مسجد القويري - بوابة 8'} • هاتف: {settings?.phonePrimary || '01000000000'}
              </p>
            </div>

            {/* Order & Customer Metadata */}
            <div className="py-2 border-b border-black border-dashed space-y-1 text-[11px]">
              <div className="flex justify-between font-bold">
                <span>رقم الفاتورة:</span>
                <span className="font-mono">#{order.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>التاريخ والوقت:</span>
                <span>{order.createdAt}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>العميل / المحل:</span>
                <span>{order.customerName}</span>
              </div>
              {order.customerPhone && (
                <div className="flex justify-between">
                  <span>الهاتف:</span>
                  <span className="font-mono">{order.customerPhone}</span>
                </div>
              )}
              {order.customerAddress && (
                <div className="flex justify-between">
                  <span>العنوان:</span>
                  <span>{order.customerAddress}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>المندوب المسئول:</span>
                <span>{order.salesRep || settings?.salesRepName || 'محمد فوزي'}</span>
              </div>
            </div>

            {/* Items Table */}
            <div className="py-2">
              <table className="w-full text-right text-[11px]">
                <thead>
                  <tr className="border-b-2 border-black font-black">
                    <th className="py-1">الصنف</th>
                    <th className="py-1 text-center">الكمية</th>
                    <th className="py-1 text-center">السعر</th>
                    <th className="py-1 text-left">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(order.items || []).map((item, idx) => (
                    <tr key={idx} className="py-1">
                      <td className="py-1 font-bold">{item.productName}</td>
                      <td className="py-1 text-center font-mono font-bold">
                        {item.quantity} {item.unit || 'كرتونة'}
                      </td>
                      <td className="py-1 text-center font-mono">
                        {item.unitPrice} ج
                      </td>
                      <td className="py-1 text-left font-mono font-bold">
                        {item.totalPrice.toLocaleString('ar-EG')} ج
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals & Payments */}
            <div className="border-t-2 border-black border-dashed pt-2 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>إجمالي الأصناف:</span>
                <span className="font-bold">
                  {order.totalQuantity} كرتونة ({order.itemsCount} صنف)
                </span>
              </div>
              <div className="flex justify-between font-black text-sm border-t border-slate-300 pt-1">
                <span>إجمالي الفاتورة:</span>
                <span className="font-mono">{order.grandTotal.toLocaleString('ar-EG')} جنيه</span>
              </div>
              <div className="flex justify-between text-emerald-800 font-bold">
                <span>المبلغ المسدد نقداً:</span>
                <span className="font-mono">{(order.paidAmount || 0).toLocaleString('ar-EG')} جنيه</span>
              </div>
              <div className="flex justify-between font-black text-red-700">
                <span>المتبقي على الحساب:</span>
                <span className="font-mono">{(remaining || 0).toLocaleString('ar-EG')} جنيه</span>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-3 pt-2 border-t border-black border-dashed text-center text-[10px] text-slate-700 space-y-0.5">
              <p className="font-bold">
                {settings?.receiptFooter || 'شكراً لتعاملكم مع شركة الحليم للتجارة والتوزيع'}
              </p>
              <p>البضاعة المستلمة بحالة جيدة ولا ترد إلا في حالة عيوب الصناعة</p>
              <div className="flex justify-between pt-3 text-[9px] font-bold text-slate-600">
                <span>توقيع المستلم: ....................</span>
                <span>توقيع المندوب: ....................</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
