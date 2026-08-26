import React, { useState, useMemo, useRef } from 'react';
import { Order, PaymentTransaction, SystemSettings } from '../types';
import logoImg from '../assets/images/alhalim_logo_1787745934656.jpg';
import {
  Printer,
  X,
  FileText,
  Receipt,
  Share2,
  Copy,
  Check,
  Building,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { printHtmlContent } from '../utils/printHelper';

interface CustomerInfo {
  id?: string;
  name: string;
  phone?: string;
  storeName?: string;
  address?: string;
}

interface StatementSummary {
  totalInvoiced: number;
  totalPaid: number;
  totalDebt: number;
  ordersCount?: number;
  paymentsCount?: number;
}

interface PrintStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: CustomerInfo;
  settings: SystemSettings | null;
  orders: Order[];
  payments: PaymentTransaction[];
  summary?: StatementSummary;
}

interface StatementLedgerRow {
  id: string;
  type: 'invoice' | 'payment';
  date: string;
  sortTimestamp: number;
  docNumber: string;
  description: string;
  notes?: string;
  debit: number; // مدين (فاتورة / مسحوبات)
  credit: number; // دائن (دفعة / سداد)
  runningBalance: number;
}

export const PrintStatementModal: React.FC<PrintStatementModalProps> = ({
  isOpen,
  onClose,
  customer,
  settings,
  orders = [],
  payments = [],
  summary: propSummary,
}) => {
  const [printFormat, setPrintFormat] = useState<'A4' | '80mm'>('A4');
  const [copied, setCopied] = useState(false);
  const printableRef = useRef<HTMLDivElement>(null);

  // Parse Arabic or ISO date into timestamp for sorting
  const parseDateToTimestamp = (dateStr: string): number => {
    if (!dateStr) return 0;
    try {
      const parsed = Date.parse(dateStr);
      if (!isNaN(parsed)) return parsed;
      // Handle "YYYY-MM-DD hh:mm A"
      const parts = dateStr.split(/[\s,]+/);
      if (parts[0] && parts[0].includes('-')) {
        const d = Date.parse(parts[0]);
        if (!isNaN(d)) return d;
      }
    } catch {}
    return 0;
  };

  const safeOrders = Array.isArray(orders) ? orders : [];
  const safePayments = Array.isArray(payments) ? payments : [];

  // Build Chronological Ledger Movements
  const { ledgerRows, calcSummary } = useMemo(() => {
    const validOrders = safeOrders.filter((o) => o.status !== 'Cancelled');
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

    // Add Invoices
    validOrders.forEach((o) => {
      allEvents.push({
        id: `inv-${o.id}`,
        type: 'invoice',
        date: o.createdAt || '',
        sortTimestamp: parseDateToTimestamp(o.createdAt),
        docNumber: o.orderNumber,
        description: `فاتورة بضاعة (${o.itemsCount || (o.items ? o.items.length : 1)} صنف - ${o.totalQuantity || 1} كرتونة)`,
        notes: o.notes,
        debit: o.grandTotal || 0,
        credit: 0,
      });
    });

    // Add Payments
    payments.forEach((p) => {
      allEvents.push({
        id: `pay-${p.id}`,
        type: 'payment',
        date: p.paymentDate || p.createdAt || '',
        sortTimestamp: parseDateToTimestamp(p.paymentDate || p.createdAt),
        docNumber: p.orderNumber ? p.orderNumber : `#${p.id.slice(-5)}`,
        description: `سند قبض / تحصيل دفعة نقدية ${p.collectedBy ? `(المحصل: ${p.collectedBy})` : ''}`,
        notes: p.notes,
        debit: 0,
        credit: p.amount || 0,
      });
    });

    // Sort chronologically ascending to calculate running balance
    allEvents.sort((a, b) => a.sortTimestamp - b.sortTimestamp);

    let running = 0;
    let sumInvoiced = 0;
    let sumPaid = 0;

    const computedRows: StatementLedgerRow[] = allEvents.map((ev) => {
      running += ev.debit - ev.credit;
      sumInvoiced += ev.debit;
      sumPaid += ev.credit;
      return {
        ...ev,
        runningBalance: running,
      };
    });

    const netDebt = Math.max(0, sumInvoiced - sumPaid);

    return {
      ledgerRows: computedRows,
      calcSummary: {
        totalInvoiced: propSummary?.totalInvoiced ?? sumInvoiced,
        totalPaid: propSummary?.totalPaid ?? sumPaid,
        totalDebt: propSummary?.totalDebt ?? netDebt,
        ordersCount: validOrders.length,
        paymentsCount: payments.length,
      },
    };
  }, [orders, payments, propSummary]);

  if (!isOpen) return null;

  const companyAddress = settings?.address || 'محافظة الإسكندرية - بجوار مسجد القويري - بوابة 8';
  const companyPhone = settings?.phonePrimary || '01000000000';
  const salesRep = settings?.salesRepName || 'محمد فوزي';
  const currentDate = new Date().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // 1. Direct High-Precision Printing
  const handlePrint = () => {
    if (printableRef.current) {
      printHtmlContent(printableRef.current.innerHTML, {
        title: `كشف حساب - ${customer.name}`,
        paperSize: printFormat,
      });
    } else {
      window.print();
    }
  };

  // 2. WhatsApp Statement Dispatch
  const handleShareWhatsApp = () => {
    let text = `📄 *كشف حساب تفصيلي - شركة الحليم للتجارة والتوزيع*\n`;
    text += `🏢 *المقر:* ${companyAddress}\n`;
    text += `👤 *العميل:* ${customer.name}\n`;
    if (customer.storeName) text += `🏪 *المحل:* ${customer.storeName}\n`;
    if (customer.phone) text += `📱 *الهاتف:* ${customer.phone}\n`;
    text += `🗓️ *تاريخ التقرير:* ${currentDate}\n\n`;
    text += `═══════════════════\n`;
    text += `📊 *الملخص المالي العام:*\n`;
    text += `▫️ إجمالي المسحوبات (الفواتير): ${calcSummary.totalInvoiced.toLocaleString('ar-EG')} ج.م\n`;
    text += `▫️ إجمالي المسدد (المدفوعات): ${calcSummary.totalPaid.toLocaleString('ar-EG')} ج.م\n`;
    text += `🔴 *الرصيد الصافي المتبقي المستحق:* ${calcSummary.totalDebt.toLocaleString('ar-EG')} ج.م\n`;
    text += `═══════════════════\n\n`;
    text += `📋 *حركة الفواتير والدفعات الأخيرة:*\n`;

    // Take last 10 movements for WhatsApp message
    const recentRows = ledgerRows.slice(-10);
    recentRows.forEach((r, idx) => {
      const typeIcon = r.type === 'invoice' ? '📦 فاتورة' : '💵 دفعة';
      const amountStr =
        r.type === 'invoice'
          ? `+${r.debit.toLocaleString('ar-EG')} ج`
          : `-${r.credit.toLocaleString('ar-EG')} ج`;
      text += `${idx + 1}. [${r.date}] ${typeIcon} (${r.docNumber}): ${amountStr} -> رصيد: ${r.runningBalance.toLocaleString('ar-EG')} ج\n`;
    });

    text += `\n📞 *مندوب التوزيع الميداني:* ${salesRep} (${companyPhone})\n`;
    text += `🙏 شكراً لتعاملكم مع شركة الحليم.`;

    const cleanPhone = customer.phone ? customer.phone.replace(/[^0-9]/g, '') : '';
    const targetUrl = cleanPhone
      ? `https://wa.me/2${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;

    window.open(targetUrl, '_blank');
  };

  // 3. Copy Summary to Clipboard
  const handleCopySummary = () => {
    const text = `كشف حساب: ${customer.name}\nإجمالي المسحوبات: ${calcSummary.totalInvoiced.toLocaleString('ar-EG')} ج.م\nإجمالي المسدد: ${calcSummary.totalPaid.toLocaleString('ar-EG')} ج.م\nالرصيد الصافي المستحق: ${calcSummary.totalDebt.toLocaleString('ar-EG')} ج.م\nشركة الحليم للتجارة والتوزيع (${companyAddress})`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl max-w-4xl w-full p-4 sm:p-6 text-right shadow-2xl relative my-4 text-slate-900 animate-fadeIn max-h-[94vh] flex flex-col">
        {/* Modal Top Actions Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                طباعة كشف الحساب التفصيلي
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                حركة المسحوبات والفواتير مقابل الدفعات المسددة والرصيد
              </p>
            </div>
          </div>

          {/* Quick Actions Control Strip */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Paper Format Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setPrintFormat('A4')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  printFormat === 'A4'
                    ? 'bg-white text-emerald-900 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>ورق A4 رسمي</span>
              </button>
              <button
                onClick={() => setPrintFormat('80mm')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  printFormat === '80mm'
                    ? 'bg-white text-emerald-900 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>حراري 80mm</span>
              </button>
            </div>

            {/* Print Trigger Button */}
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة فورية</span>
            </button>

            {/* WhatsApp Share Button */}
            <button
              onClick={handleShareWhatsApp}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
              title="إرسال كشف الحساب عبر واتساب"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">واتساب</span>
            </button>

            {/* Copy Button */}
            <button
              onClick={handleCopySummary}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors text-xs font-bold"
              title="نسخ الملخص"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Container (Scrollable Preview) */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-4 flex justify-center bg-slate-100/80 rounded-2xl my-3">
          <div
            ref={printableRef}
            id="printable-statement"
            className={`bg-white border border-slate-300 p-4 sm:p-6 text-black shadow-md font-sans transition-all ${
              printFormat === '80mm'
                ? 'w-[320px] text-xs'
                : 'w-full max-w-[800px] text-sm'
            }`}
            style={{ fontFamily: "'Cairo', sans-serif" }}
          >
            {/* 1. Official Header with Updated Alexandria Address & Logo */}
            <div className="text-center pb-3 border-b-2 border-slate-900 flex flex-col items-center">
              <img
                src={logoImg}
                alt="شركة الحليم للتجارة والتوزيع"
                referrerPolicy="no-referrer"
                className="w-16 h-16 object-contain mb-1"
              />
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-950">
                شركة الحليم للتجارة والتوزيع
              </h1>
              <p className="text-xs font-bold text-slate-800 mt-0.5">
                {settings?.activityDescription || 'توريدات وتوزيع المواد الغذائية والمشروبات والمياه بالجملة'}
              </p>
              <p className="text-[11px] font-bold text-slate-700 mt-1 flex flex-wrap items-center justify-center gap-x-2">
                <span>📍 المقر الرئيسي: {companyAddress}</span>
                <span>• 📞 هاتف الإدارة: {companyPhone}</span>
              </p>
              <div className="inline-block bg-slate-900 text-white text-xs font-black px-4 py-1 rounded-full mt-2">
                كشف حساب عميل معتمد
              </div>
            </div>

            {/* 2. Customer & Document Meta Info */}
            <div className="grid grid-cols-2 gap-2 py-3 border-b border-slate-300 text-xs bg-slate-50/70 p-3 rounded-xl my-2">
              <div>
                <div className="font-bold text-slate-900">
                  اسم العميل: <span className="font-black text-slate-950">{customer.name}</span>
                </div>
                {customer.storeName && (
                  <div className="text-slate-700 mt-0.5">
                    اسم المنشأة: <span className="font-bold">{customer.storeName}</span>
                  </div>
                )}
                {customer.phone && (
                  <div className="text-slate-700 mt-0.5">
                    رقم الهاتف: <span className="font-mono font-bold">{customer.phone}</span>
                  </div>
                )}
                {customer.address && (
                  <div className="text-slate-700 mt-0.5">
                    العنوان: <span>{customer.address}</span>
                  </div>
                )}
              </div>

              <div className="text-left">
                <div className="text-slate-700">
                  تاريخ استخراج الكشف: <span className="font-bold text-slate-900">{currentDate}</span>
                </div>
                <div className="text-slate-700 mt-0.5">
                  مندوب المنطقة: <span className="font-bold text-slate-900">{salesRep}</span>
                </div>
                <div className="text-slate-700 mt-0.5">
                  حالة الحساب: <span className={`font-bold ${calcSummary.totalDebt > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                    {calcSummary.totalDebt > 0 ? 'يوجد مديونية متبقية' : 'خالص بالكامل'}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Summary 3-Box Financial Grid */}
            <div className="grid grid-cols-3 gap-2 text-center p-2.5 bg-slate-100/90 rounded-xl border border-slate-300 text-xs font-mono my-3">
              <div className="p-1">
                <span className="text-[10px] text-slate-600 font-sans block font-bold">إجمالي الفواتير (مدين)</span>
                <span className="font-black text-slate-950 text-sm sm:text-base">
                  {calcSummary.totalInvoiced.toLocaleString('ar-EG')} ج
                </span>
              </div>
              <div className="border-r border-l border-slate-300 p-1">
                <span className="text-[10px] text-emerald-800 font-sans block font-bold">إجمالي المسدد (دائن)</span>
                <span className="font-black text-emerald-800 text-sm sm:text-base">
                  {calcSummary.totalPaid.toLocaleString('ar-EG')} ج
                </span>
              </div>
              <div className="p-1">
                <span className="text-[10px] text-red-700 font-sans block font-bold">صافي الرصيد المستحق</span>
                <span className={`font-black text-sm sm:text-base ${calcSummary.totalDebt > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {calcSummary.totalDebt.toLocaleString('ar-EG')} ج
                </span>
              </div>
            </div>

            {/* 4. Detailed Chronological Ledger Table */}
            <div className="my-3 overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-200 text-slate-900 border-b border-slate-400 font-black">
                    <th className="p-2 border border-slate-300">#</th>
                    <th className="p-2 border border-slate-300">التاريخ</th>
                    <th className="p-2 border border-slate-300">البيان ونوع الحركة</th>
                    <th className="p-2 border border-slate-300 text-center">مدين (مسحوبات)</th>
                    <th className="p-2 border border-slate-300 text-center">دائن (مسدد)</th>
                    <th className="p-2 border border-slate-300 text-center">الرصيد التراكمي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[11px] sm:text-xs">
                  {ledgerRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-500 font-sans font-bold">
                        لا توجد حركات مسجلة على هذا الحساب بعد.
                      </td>
                    </tr>
                  ) : (
                    ledgerRows.map((row, idx) => (
                      <tr
                        key={row.id}
                        className={row.type === 'payment' ? 'bg-emerald-50/40' : 'hover:bg-slate-50'}
                      >
                        <td className="p-2 border border-slate-300 text-slate-500 text-center">{idx + 1}</td>
                        <td className="p-2 border border-slate-300 font-sans text-slate-700 whitespace-nowrap">
                          {row.date.split(',')[0] || row.date}
                        </td>
                        <td className="p-2 border border-slate-300 font-sans">
                          <div className="font-bold text-slate-900">
                            {row.type === 'invoice' ? '📦 ' : '💵 '}
                            {row.docNumber} - {row.description}
                          </div>
                          {row.notes && (
                            <div className="text-[10px] text-slate-500 mt-0.5">{row.notes}</div>
                          )}
                        </td>
                        <td className="p-2 border border-slate-300 text-center font-bold text-red-700">
                          {row.debit > 0 ? `${row.debit.toLocaleString('ar-EG')}` : '-'}
                        </td>
                        <td className="p-2 border border-slate-300 text-center font-bold text-emerald-800">
                          {row.credit > 0 ? `${row.credit.toLocaleString('ar-EG')}` : '-'}
                        </td>
                        <td className="p-2 border border-slate-300 text-center font-black text-slate-950">
                          {row.runningBalance.toLocaleString('ar-EG')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {/* Total Footer Row */}
                <tfoot>
                  <tr className="bg-slate-200/90 font-black text-slate-950 border-t-2 border-slate-400">
                    <td colSpan={3} className="p-2 border border-slate-300 text-left font-sans">
                      الإجمالي النهائي:
                    </td>
                    <td className="p-2 border border-slate-300 text-center text-red-700 font-mono">
                      {calcSummary.totalInvoiced.toLocaleString('ar-EG')}
                    </td>
                    <td className="p-2 border border-slate-300 text-center text-emerald-800 font-mono">
                      {calcSummary.totalPaid.toLocaleString('ar-EG')}
                    </td>
                    <td className="p-2 border border-slate-300 text-center text-slate-950 font-mono text-sm">
                      {calcSummary.totalDebt.toLocaleString('ar-EG')} ج
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 5. Statement Footer & Signatures (for A4) */}
            {printFormat === 'A4' && (
              <div className="mt-6 pt-4 border-t border-slate-300 grid grid-cols-3 gap-4 text-center text-xs text-slate-800">
                <div>
                  <div className="font-bold">توقيع العميل / المستلم</div>
                  <div className="h-10 border-b border-dashed border-slate-400 mt-2"></div>
                </div>
                <div>
                  <div className="font-bold">توقيع المحصل / المندوب</div>
                  <div className="h-10 border-b border-dashed border-slate-400 mt-2"></div>
                </div>
                <div>
                  <div className="font-bold">اعتماد إدارة الحسابات</div>
                  <div className="h-10 border-b border-dashed border-slate-400 mt-2"></div>
                </div>
              </div>
            )}

            {/* Footer Note */}
            <div className="text-center text-[10px] text-slate-600 mt-4 pt-2 border-t border-dashed border-slate-300">
              {settings?.receiptFooter || 'شكراً لتعاملكم مع شركة الحليم للتجارة والتوزيع'}
            </div>
          </div>
        </div>

        {/* Modal Bottom Footer Strip */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 shrink-0 text-xs">
          <div className="text-slate-500 font-medium">
            📍 المقر: <span className="font-bold text-slate-800">{companyAddress}</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
