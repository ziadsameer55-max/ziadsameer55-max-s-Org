import React, { useRef, useState, useEffect } from 'react';
import { Order, SystemSettings, PaperSize } from '../types';
import logoImg from '../assets/images/alhalim_logo_1787745934656.jpg';
import {
  Printer,
  X,
  FileText,
  Receipt,
  CheckCircle,
  Store,
  Phone,
  Calendar,
  User as UserIcon,
  Wallet,
  ToggleLeft,
  ToggleRight,
  Layers,
} from 'lucide-react';
import { printHtmlContent } from '../utils/printHelper';
import { apiFetch } from '../utils/api';

interface PrintReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  settings: SystemSettings | null;
  isAdmin?: boolean;
}

export const PrintReceiptModal: React.FC<PrintReceiptModalProps> = ({
  isOpen,
  onClose,
  order,
  settings,
  isAdmin = true,
}) => {
  const [selectedPaperSize, setSelectedPaperSize] = useState<PaperSize>(
    settings?.paperSize || '80mm'
  );
  const [showDebtSection, setShowDebtSection] = useState<boolean>(
    isAdmin || (settings?.showPreviousDebtOnReceipt ?? true)
  );
  const [livePreviousDebt, setLivePreviousDebt] = useState<number | null>(
    order.previousDebt !== undefined ? order.previousDebt : null
  );
  const printableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (settings?.paperSize) {
      setSelectedPaperSize(settings.paperSize);
    }
  }, [settings?.paperSize]);

  // Fetch verified previous debt from database if not already present
  useEffect(() => {
    if (!isOpen) return;

    if (order.previousDebt !== undefined) {
      setLivePreviousDebt(order.previousDebt);
      return;
    }

    let isMounted = true;
    async function fetchCustomerDebt() {
      try {
        const targetId = order.customerId || order.customerPhone;
        if (!targetId) return;
        const res = await apiFetch(`/api/customers/${encodeURIComponent(targetId)}/debt`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data && typeof data.totalDebt === 'number') {
            const prev = Math.max(0, data.totalDebt - (order.grandTotal - (order.paidAmount || 0)));
            setLivePreviousDebt(prev);
          }
        }
      } catch (err) {
        console.error('Error fetching live customer debt:', err);
      }
    }
    fetchCustomerDebt();

    return () => {
      isMounted = false;
    };
  }, [isOpen, order]);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (printableRef.current) {
      printHtmlContent(printableRef.current.innerHTML, {
        title: `فاتورة #${order.orderNumber}`,
        paperSize: selectedPaperSize,
        customWidthMm: settings?.customWidthMm,
        customHeightMm: settings?.customHeightMm,
        fontSizes: settings?.printFontSizes,
      });
    } else {
      window.print();
    }
  };

  const previousDebt = livePreviousDebt !== null ? livePreviousDebt : (order.previousDebt || 0);
  const currentInvoice = order.currentInvoice !== undefined ? order.currentInvoice : order.grandTotal;
  const totalDue = order.totalDueWithDebt !== undefined ? order.totalDueWithDebt : (previousDebt + currentInvoice);
  const paid = order.paidAmount || 0;
  const remainingFinal = order.finalRemainingWithDebt !== undefined
    ? order.finalRemainingWithDebt
    : Math.max(0, totalDue - paid);

  const activeFontSizes = settings?.printFontSizes || {
    header: selectedPaperSize === '58mm' ? 14 : 16,
    meta: selectedPaperSize === '58mm' ? 10 : 11,
    tableHeader: selectedPaperSize === '58mm' ? 10 : 11,
    tableRows: selectedPaperSize === '58mm' ? 10 : 11,
    summary: selectedPaperSize === '58mm' ? 11 : 12,
    footer: selectedPaperSize === '58mm' ? 9 : 10,
  };

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
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 no-print shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-emerald-800" />
            <div>
              <h3 className="font-black text-sm sm:text-base text-slate-900">
                طباعة الفاتورة - طلب #{order.orderNumber}
              </h3>
              <p className="text-[11px] text-slate-500">شركة الحليم للتجارة والتوزيع</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Paper Size Quick Selector */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-bold">
              {(['58mm', '80mm', 'A4'] as PaperSize[]).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setSelectedPaperSize(size)}
                  className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                    selectedPaperSize === size
                      ? 'bg-white text-emerald-900 shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>{size}</span>
                </button>
              ))}
            </div>

            {/* Toggle Debt Breakdown */}
            <button
              type="button"
              onClick={() => setShowDebtSection(!showDebtSection)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all ${
                showDebtSection
                  ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-2xs'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
              }`}
              title="إظهار أو إخفاء قسم المديونية السابقة في الفاتورة المطبوعة"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>{showDebtSection ? 'المديونية: ظاهرة' : 'المديونية: مخفية'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-black text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة 🖨️</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
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
              selectedPaperSize === '58mm' || selectedPaperSize === '57mm'
                ? 'w-[260px]'
                : selectedPaperSize === '76mm'
                ? 'w-[300px]'
                : selectedPaperSize === '80mm'
                ? 'w-[330px]'
                : 'w-full max-w-[650px]'
            }`}
            style={{ fontFamily: "'Cairo', sans-serif" }}
          >
            {/* Header */}
            <div className="text-center pb-2 border-b-2 border-black border-dashed">
              {settings?.showHeaderLogo !== false && (
                <div className="flex justify-center mb-1.5">
                  <img
                    src={logoImg}
                    alt="شركة الحليم"
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 object-contain mx-auto"
                  />
                </div>
              )}
              <h2
                style={{ fontSize: `${activeFontSizes.header}px` }}
                className="font-black tracking-tight print-header-title text-slate-950"
              >
                {settings?.companyName || 'شركة الحليم للتجارة والتوزيع'}
              </h2>
              <p
                style={{ fontSize: `${activeFontSizes.meta}px` }}
                className="font-bold text-slate-800 print-meta-text"
              >
                {settings?.managerName || 'إدارة الحاج فوزي عبد الحليم'} | المندوب: {order.salesRep || settings?.salesRepName || 'محمد فوزي'}
              </p>
              <p
                style={{ fontSize: `${activeFontSizes.meta - 1}px` }}
                className="text-slate-700 print-meta-text"
              >
                {settings?.address || 'محافظة الإسكندرية - بجوار مسجد القويري - بوابة 8'} • هاتف: {settings?.phonePrimary || '01000000000'}
              </p>
            </div>

            {/* Order & Customer Metadata */}
            <div
              style={{ fontSize: `${activeFontSizes.meta}px` }}
              className="py-2 border-b border-black border-dashed space-y-1 print-meta-text"
            >
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
              <table
                className={`w-full text-right ${
                  settings?.showItemsBorder !== false ? 'border border-slate-300' : ''
                }`}
              >
                <thead>
                  <tr
                    style={{ fontSize: `${activeFontSizes.tableHeader}px` }}
                    className="border-b-2 border-black font-black print-th-text bg-slate-50"
                  >
                    <th className="py-1 px-1">الصنف</th>
                    <th className="py-1 px-1 text-center">الكمية</th>
                    <th className="py-1 px-1 text-center">السعر</th>
                    <th className="py-1 px-1 text-left">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(order.items || []).map((item, idx) => (
                    <tr
                      key={idx}
                      style={{ fontSize: `${activeFontSizes.tableRows}px` }}
                      className="py-1 print-tr-text"
                    >
                      <td className="py-1 px-1 font-bold">{item.productName}</td>
                      <td className="py-1 px-1 text-center font-mono font-bold">
                        {item.quantity} {item.unit || 'كرتونة'}
                      </td>
                      <td className="py-1 px-1 text-center font-mono">
                        {item.unitPrice} ج
                      </td>
                      <td className="py-1 px-1 text-left font-mono font-bold">
                        {item.totalPrice.toLocaleString('ar-EG')} ج
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary of Items */}
            <div
              style={{ fontSize: `${activeFontSizes.summary}px` }}
              className="border-t-2 border-black border-dashed pt-2 pb-1 print-summary-text"
            >
              <div className="flex justify-between font-medium">
                <span>إجمالي الأصناف:</span>
                <span className="font-bold">
                  {order.totalQuantity} كرتونة ({order.itemsCount} صنف)
                </span>
              </div>
            </div>

            {/* Debt & Financial Breakdown Section (Strictly Structured) */}
            {showDebtSection ? (
              <div
                style={{ fontSize: `${activeFontSizes.summary}px` }}
                className="border-t-2 border-black border-dashed pt-2 space-y-1 print-summary-text"
              >
                {/* Previous Debt & Current Invoice */}
                <div className="flex justify-between py-0.5">
                  <span className="font-bold text-slate-800">المديونية السابقة:</span>
                  <span className="font-mono font-black">{previousDebt.toLocaleString('ar-EG')} ج.م</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="font-bold text-slate-800">الفاتورة الحالية:</span>
                  <span className="font-mono font-black">{currentInvoice.toLocaleString('ar-EG')} ج.م</span>
                </div>

                {/* Divider */}
                <div className="border-t-2 border-black my-1"></div>

                {/* Total Due & Paid */}
                <div className="flex justify-between py-0.5 font-black text-xs sm:text-sm">
                  <span>الإجمالي المستحق:</span>
                  <span className="font-mono">{totalDue.toLocaleString('ar-EG')} ج.م</span>
                </div>
                <div className="flex justify-between py-0.5 font-bold text-emerald-900">
                  <span>المدفوع:</span>
                  <span className="font-mono">{paid.toLocaleString('ar-EG')} ج.م</span>
                </div>

                {/* Divider */}
                <div className="border-t-2 border-black my-1"></div>

                {/* Remaining Total */}
                <div className="flex justify-between py-0.5 font-black text-xs sm:text-base text-red-700">
                  <span>المتبقي:</span>
                  <span className="font-mono">{remainingFinal.toLocaleString('ar-EG')} ج.م</span>
                </div>
                <div className="border-t-2 border-black my-1"></div>
              </div>
            ) : (
              /* Standard Single-Invoice View */
              <div
                style={{ fontSize: `${activeFontSizes.summary}px` }}
                className="border-t-2 border-black border-dashed pt-2 space-y-1 print-summary-text"
              >
                <div className="flex justify-between font-black text-sm border-t border-slate-300 pt-1">
                  <span>إجمالي الفاتورة الحالية:</span>
                  <span className="font-mono">{order.grandTotal.toLocaleString('ar-EG')} جنيه</span>
                </div>
                <div className="flex justify-between text-emerald-800 font-bold">
                  <span>المبلغ المسدد نقداً:</span>
                  <span className="font-mono">{(order.paidAmount || 0).toLocaleString('ar-EG')} جنيه</span>
                </div>
                <div className="flex justify-between font-black text-red-700">
                  <span>المتبقي على الحساب:</span>
                  <span className="font-mono">{Math.max(0, order.grandTotal - (order.paidAmount || 0)).toLocaleString('ar-EG')} جنيه</span>
                </div>
              </div>
            )}

            {/* Footer */}
            <div
              style={{ fontSize: `${activeFontSizes.footer}px` }}
              className="mt-3 pt-2 border-t border-black border-dashed text-center text-slate-700 space-y-0.5 print-footer-text"
            >
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
