import React, { useState, useEffect } from 'react';
import { SystemSettings, PaperSize, DaySchedule, PrintFontSizes } from '../types';
import { BrandLogo } from './BrandLogo';
import {
  Settings,
  Printer,
  Clock,
  Save,
  ShieldCheck,
  Phone,
  MapPin,
  FileText,
  Bot,
  MessageSquare,
  Sparkles,
  Lock,
  EyeOff,
  Eye,
  ShieldAlert,
  CheckCircle2,
  Sliders,
  Type,
  Maximize2,
  RefreshCw,
} from 'lucide-react';
import { printHtmlContent } from '../utils/printHelper';

interface AdminSettingsProps {
  settings: SystemSettings | null;
  onSaveSettings: (newSettings: SystemSettings) => void;
}

const DEFAULT_FONT_SIZES: Record<PaperSize, PrintFontSizes> = {
  '58mm': { header: 14, meta: 10, tableHeader: 10, tableRows: 10, summary: 11, footer: 9 },
  '57mm': { header: 14, meta: 10, tableHeader: 10, tableRows: 10, summary: 11, footer: 9 },
  '76mm': { header: 15, meta: 11, tableHeader: 11, tableRows: 11, summary: 12, footer: 10 },
  '80mm': { header: 16, meta: 11, tableHeader: 11, tableRows: 11, summary: 12, footer: 10 },
  'A5': { header: 18, meta: 12, tableHeader: 12, tableRows: 12, summary: 13, footer: 11 },
  'A4': { header: 20, meta: 13, tableHeader: 13, tableRows: 12, summary: 14, footer: 11 },
  'custom': { header: 16, meta: 11, tableHeader: 11, tableRows: 11, summary: 12, footer: 10 },
};

export const AdminSettings: React.FC<AdminSettingsProps> = ({
  settings: initialSettings,
  onSaveSettings,
}) => {
  const [settings, setSettings] = useState<SystemSettings>(
    initialSettings || {
      companyName: 'شركة الحليم للتجارة والتوزيع',
      managerName: 'إدارة الحاج فوزي عبد الحليم',
      salesRepName: 'محمد فوزي',
      phonePrimary: '01000000000',
      phoneSecondary: '01222223333',
      address: 'محافظة الإسكندرية - بجوار مسجد القويري - بوابة 8',
      receiptFooter: 'شكراً لتعاملكم مع شركة الحليم للتجارة والتوزيع | الحاج فوزي عبد الحليم والمندوب محمد فوزي',
      paperSize: '80mm',
      customWidthMm: 80,
      customHeightMm: undefined,
      printFontSizes: { header: 16, meta: 11, tableHeader: 11, tableRows: 11, summary: 12, footer: 10 },
      isManualOverrideActive: false,
      manualOrdersOpen: true,
      hidePrices: false,
      scheduleEnabled: true,
      preventOutOfStockSale: false,
      showPreviousDebtOnReceipt: true,
      showHeaderLogo: true,
      showItemsBorder: true,
      aiAssistantEnabled: true,
      supportPhone: '01000000000',
      supportWhatsapp: '01000000000',
      supportWorkingHours: 'يومياً من 8:00 صباحاً حتى 10:00 مساءً (الجمعة عطلة)',
      aiGreetingMessage: 'أهلاً بك 👋 أنا مساعد الحليم الذكي. أقدر أساعدك في استخدام الموقع وحل أي استفسار عن طلبات الجملة والحسابات.',
      weeklySchedule: [
        { dayName: 'السبت', dayKey: 'sat', isOpen: true, openTime: '08:00', closeTime: '22:00' },
        { dayName: 'الأحد', dayKey: 'sun', isOpen: true, openTime: '08:00', closeTime: '22:00' },
        { dayName: 'الإثنين', dayKey: 'mon', isOpen: true, openTime: '08:00', closeTime: '22:00' },
        { dayName: 'الثلاثاء', dayKey: 'tue', isOpen: true, openTime: '08:00', closeTime: '22:00' },
        { dayName: 'الأربعاء', dayKey: 'wed', isOpen: true, openTime: '08:00', closeTime: '22:00' },
        { dayName: 'الخميس', dayKey: 'thu', isOpen: true, openTime: '08:00', closeTime: '22:00' },
        { dayName: 'الجمعة', dayKey: 'fri', isOpen: false, openTime: '08:00', closeTime: '22:00' },
      ],
    }
  );

  useEffect(() => {
    if (initialSettings) {
      setSettings(initialSettings);
    }
  }, [initialSettings]);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [quickSaveMsg, setQuickSaveMsg] = useState<string | null>(null);

  const activeFontSizes: PrintFontSizes = settings.printFontSizes || DEFAULT_FONT_SIZES[settings.paperSize || '80mm'];

  const handlePaperSizeChange = (newSize: PaperSize) => {
    const defaultFs = DEFAULT_FONT_SIZES[newSize];
    setSettings((prev) => ({
      ...prev,
      paperSize: newSize,
      printFontSizes: prev.printFontSizes || defaultFs,
    }));
  };

  const handleFontSizeChange = (key: keyof PrintFontSizes, val: number) => {
    setSettings((prev) => ({
      ...prev,
      printFontSizes: {
        ...(prev.printFontSizes || DEFAULT_FONT_SIZES[prev.paperSize || '80mm']),
        [key]: Math.max(7, Math.min(32, val)),
      },
    }));
  };

  const resetFontSizesToDefault = () => {
    const defaultFs = DEFAULT_FONT_SIZES[settings.paperSize || '80mm'];
    setSettings((prev) => ({
      ...prev,
      printFontSizes: defaultFs,
    }));
  };

  const handleScheduleChange = (
    index: number,
    field: 'isOpen' | 'openTime' | 'closeTime',
    val: any
  ) => {
    const updated = [...settings.weeklySchedule];
    updated[index] = { ...updated[index], [field]: val };
    setSettings({ ...settings, weeklySchedule: updated });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(settings);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  const handleToggleAndSaveHidePrices = (nextVal: boolean) => {
    const updated = { ...settings, hidePrices: nextVal };
    setSettings(updated);
    onSaveSettings(updated);
    setQuickSaveMsg(nextVal ? 'تم تفعيل إخفاء الأسعار وحفظ الإعدادات بنجاح 🔒' : 'تم تفعيل إظهار الأسعار وحفظ الإعدادات بنجاح 🟢');
    setTimeout(() => setQuickSaveMsg(null), 3500);
  };

  // Test Print Execution
  const handleTestPrint = () => {
    const testHtml = `
      <div style="text-align: center; margin-bottom: 8px;">
        <div class="print-header-title" style="font-weight: 900; margin-bottom: 2px;">
          ${settings.companyName || 'شركة الحليم للتجارة والتوزيع'}
        </div>
        <div class="print-meta-text" style="color: #475569; font-weight: bold;">
          ${settings.managerName || 'إدارة الحاج فوزي عبد الحليم'} | المندوب: ${settings.salesRepName || 'محمد فوزي'}
        </div>
        <div class="print-meta-text" style="color: #64748b;">
          هاتف: ${settings.phonePrimary} - ${settings.phoneSecondary}
        </div>
        <div class="print-meta-text" style="color: #64748b;">
          ${settings.address || 'محافظة الإسكندرية - بجوار مسجد القويري'}
        </div>
      </div>

      <div class="divider-dashed"></div>

      <div style="margin-bottom: 6px;" class="print-meta-text">
        <div style="display: flex; justify-content: space-between; font-weight: bold;">
          <span>رقم الفاتورة: #TEST-101</span>
          <span>التاريخ: ${new Date().toLocaleDateString('ar-EG')}</span>
        </div>
        <div style="margin-top: 2px;">
          <span>العميل: سوبر ماركت الأمل التجاري</span>
        </div>
        <div>
          <span>الهاتف: 01011112222</span>
        </div>
      </div>

      <div class="divider-dashed"></div>

      <table style="margin-bottom: 6px; ${settings.showItemsBorder === false ? 'border: none;' : ''}">
        <thead>
          <tr class="print-th-text">
            <th style="text-align: right; width: 45%;">الصنف</th>
            <th style="text-align: center; width: 15%;">الكمية</th>
            <th style="text-align: center; width: 20%;">السعر</th>
            <th style="text-align: left; width: 20%;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          <tr class="print-tr-text">
            <td style="font-weight: bold;">بيبسي كانز 300 مل</td>
            <td style="text-align: center;">5 كرتونة</td>
            <td style="text-align: center;" class="font-mono">240</td>
            <td style="text-align: left; font-weight: bold;" class="font-mono">1,200</td>
          </tr>
          <tr class="print-tr-text">
            <td style="font-weight: bold;">شيبسي عائلي مشكل</td>
            <td style="text-align: center;">4 بالتة</td>
            <td style="text-align: center;" class="font-mono">180</td>
            <td style="text-align: left; font-weight: bold;" class="font-mono">720</td>
          </tr>
          <tr class="print-tr-text">
            <td style="font-weight: bold;">أكوافينا مياه 1.5 لتر</td>
            <td style="text-align: center;">10 كرتونة</td>
            <td style="text-align: center;" class="font-mono">90</td>
            <td style="text-align: left; font-weight: bold;" class="font-mono">900</td>
          </tr>
        </tbody>
      </table>

      <div class="divider-dashed"></div>

      <div class="print-summary-text" style="margin-top: 4px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>إجمالي الأصناف الحالية:</span>
          <span class="font-mono font-bold">2,820 ج.م</span>
        </div>

        ${
          settings.showPreviousDebtOnReceipt !== false
            ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px; color: #dc2626; font-weight: bold;">
            <span>المديونية السابقة على العميل:</span>
            <span class="font-mono">1,500 ج.م</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px; font-weight: 900; border-top: 1px dashed #cbd5e1; padding-top: 2px;">
            <span>الإجمالي المستحق الكلي:</span>
            <span class="font-mono" style="font-size: 1.1em;">4,320 ج.م</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px; color: #047857; font-weight: bold;">
            <span>المدفوع نقداً:</span>
            <span class="font-mono">2,000 ج.م</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-weight: 900; color: #dc2626; border-top: 1px solid #0f172a; padding-top: 2px;">
            <span>المتبقي النهائي في الحساب:</span>
            <span class="font-mono">2,320 ج.م</span>
          </div>
        `
            : `
          <div style="display: flex; justify-content: space-between; font-weight: 900; border-top: 1px dashed #0f172a; padding-top: 2px;">
            <span>إجمالي الفاتورة:</span>
            <span class="font-mono">2,820 ج.م</span>
          </div>
        `
        }
      </div>

      <div class="divider-double"></div>

      <div class="print-footer-text" style="text-align: center; color: #475569; margin-top: 6px;">
        <div>${settings.receiptFooter || 'شكراً لتعاملكم مع شركة الحليم للتجارة والتوزيع'}</div>
        <div style="font-size: 8px; color: #94a3b8; font-family: monospace; margin-top: 4px; border-top: 1px dashed #cbd5e1; padding-top: 2px;">
          Powered by Astra Systems • 01278910793
        </div>
      </div>
    `;

    printHtmlContent(testHtml, {
      title: 'طباعة تجريبية - شركة الحليم',
      paperSize: settings.paperSize,
      customWidthMm: settings.customWidthMm,
      customHeightMm: settings.customHeightMm,
      fontSizes: activeFontSizes,
    });
  };

  return (
    <div className="space-y-6 text-right pb-20">
      {/* Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700 font-bold shrink-0 shadow-2xs">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              إعدادات النظام وطابعات الفواتير الحرارية
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              تخصيص مقاسات الورق الحراري (58mm, 80mm, A4)، أحجام الخطوط، معاينة فورية، وحماية تسعير الجملة
            </p>
          </div>
        </div>

        {savedSuccess && (
          <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs px-3.5 py-1.5 rounded-xl font-black flex items-center gap-1.5 shadow-2xs animate-pulse">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            تم حفظ الإعدادات بنجاح
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. 🔐 Security & Wholesale Price Visibility Settings (Server-Side Enforced) */}
        <div className="bg-white border-2 border-slate-200 hover:border-slate-300 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xs transition-all">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2.5 text-slate-900 font-bold text-sm sm:text-base">
              <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-slate-900 font-black">إعدادات الأمان وحماية تسعير الجملة</span>
                <span className="block text-[11px] text-slate-500 font-normal">
                  تحكم مباشر وخادم خلفي مشدد (Server-Side) لحجب أسعار الجملة عن الزوار والعملاء
                </span>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border border-slate-200 bg-slate-50 text-slate-600">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>صلاحية المدير العام</span>
            </div>
          </div>

          {quickSaveMsg && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{quickSaveMsg}</span>
            </div>
          )}

          {/* Toggle / Switch Box */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              settings.hidePrices
                ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/20'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1 text-right flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm sm:text-base font-black text-slate-900">
                    🔐 إخفاء الأسعار عن العملاء
                  </span>
                  {settings.hidePrices ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-black text-[10px] flex items-center gap-1 shadow-2xs">
                      <EyeOff className="w-3 h-3" />
                      مُفعل (الأسعار محجوبة)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      مُعطل (الأسعار ظاهرة)
                    </span>
                  )}
                </div>

                <div className="pt-0.5">
                  {settings.hidePrices ? (
                    <p className="text-xs font-black text-emerald-700 flex items-center gap-1.5">
                      <span>🟢 الأسعار مخفية تماماً عن العملاء في الكتالوج والسلة والطلبات</span>
                    </p>
                  ) : (
                    <p className="text-xs font-black text-slate-600 flex items-center gap-1.5">
                      <span>⚪ الأسعار ظاهرة لجميع العملاء كالمعتاد</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Physical Switch Element */}
              <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(settings.hidePrices)}
                  onClick={() => handleToggleAndSaveHidePrices(!settings.hidePrices)}
                  className={`relative inline-flex h-8 w-15 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 ${
                    settings.hidePrices ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                  title={settings.hidePrices ? 'اضغط لإلغاء إخفاء الأسعار' : 'اضغط لإخفاء الأسعار وحفظ التغيير فوراً'}
                >
                  <span
                    className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      settings.hidePrices ? '-translate-x-7' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-[10px] text-slate-500 font-bold">
                  {settings.hidePrices ? 'مفعل' : 'معطل'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. 🖨️ Thermal Printer & Layout Configuration with Live Preview */}
        <div className="bg-white border-2 border-amber-200/90 rounded-2xl p-4 sm:p-5 space-y-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-amber-100">
            <div className="flex items-center gap-2.5 text-amber-900 font-black text-sm sm:text-base">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <span>إعدادات طابعات الفواتير والبون الحراري (Thermal Receipts)</span>
                <span className="block text-[11px] text-slate-500 font-normal">
                  دعم جميع المقاسات (58mm, 80mm, 57mm, 76mm, A4, A5, مخصص) مع التحكم الكامل بحجم الخطوط
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestPrint}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>اختبار طباعة فورية</span>
            </button>
          </div>

          {/* Paper Size Selector Grid */}
          <div>
            <label className="block text-xs font-black text-slate-800 mb-2">
              1. اختر مقاس ورق الطباعة الخاص بالطابعة المتصلة:
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {[
                { id: '58mm', label: '58 مم (بون صغير)' },
                { id: '80mm', label: '80 مم (بون قياسي)' },
                { id: '57mm', label: '57 مم (بلوتوث محمول)' },
                { id: '76mm', label: '76 مم' },
                { id: 'A4', label: 'ورق A4 كامل' },
                { id: 'A5', label: 'ورق A5 نصف صفحة' },
                { id: 'custom', label: 'مقاس مخصص (مم)' },
              ].map((size) => (
                <button
                  type="button"
                  key={size.id}
                  onClick={() => handlePaperSizeChange(size.id as PaperSize)}
                  className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                    settings.paperSize === size.id
                      ? 'bg-amber-50 border-amber-400 text-amber-950 font-black ring-2 ring-amber-500/20 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Printer className="w-4 h-4 text-amber-700" />
                  <span className="font-mono font-extrabold text-xs">{size.id}</span>
                  <span className="text-[10px] text-slate-500 leading-tight">{size.label}</span>
                </button>
              ))}
            </div>

            {/* Custom mm Width & Height Inputs */}
            {settings.paperSize === 'custom' && (
              <div className="mt-3 p-3 bg-amber-50/60 border border-amber-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    عرض الورق المخصص (بالملم - mm):
                  </label>
                  <input
                    type="number"
                    min={35}
                    max={300}
                    value={settings.customWidthMm || 80}
                    onChange={(e) =>
                      setSettings({ ...settings, customWidthMm: parseInt(e.target.value, 10) || 80 })
                    }
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-mono text-center font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    طول الورق المخصص (بالملم - اتركه فارغاً للرول المستمر):
                  </label>
                  <input
                    type="number"
                    min={50}
                    max={500}
                    placeholder="تلقائي (رول حراري مستمر)"
                    value={settings.customHeightMm || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        customHeightMm: e.target.value ? parseInt(e.target.value, 10) : undefined,
                      })
                    }
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-mono text-center font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 2. Fine-grained Font Sizes Configuration */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black text-slate-800">
                <Sliders className="w-4 h-4 text-amber-700" />
                <span>2. تخصيص حجم الخطوط لعناصر الفاتورة (Font Sizes in Pixels)</span>
              </div>
              <button
                type="button"
                onClick={resetFontSizesToDefault}
                className="text-[11px] font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 underline cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                استعادة الأحجام الافتراضية
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Header Title */}
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/90">
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>عنوان ورأس الفاتورة:</span>
                  <span className="font-mono text-amber-800 font-black">{activeFontSizes.header}px</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={28}
                  value={activeFontSizes.header}
                  onChange={(e) => handleFontSizeChange('header', parseInt(e.target.value, 10))}
                  className="w-full accent-amber-600 cursor-pointer"
                />
              </div>

              {/* Meta / Customer Info */}
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/90">
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>بيانات العميل والتاريخ:</span>
                  <span className="font-mono text-amber-800 font-black">{activeFontSizes.meta}px</span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={20}
                  value={activeFontSizes.meta}
                  onChange={(e) => handleFontSizeChange('meta', parseInt(e.target.value, 10))}
                  className="w-full accent-amber-600 cursor-pointer"
                />
              </div>

              {/* Table Header */}
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/90">
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>عناوين جدول الأصناف:</span>
                  <span className="font-mono text-amber-800 font-black">{activeFontSizes.tableHeader}px</span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={20}
                  value={activeFontSizes.tableHeader}
                  onChange={(e) => handleFontSizeChange('tableHeader', parseInt(e.target.value, 10))}
                  className="w-full accent-amber-600 cursor-pointer"
                />
              </div>

              {/* Table Rows */}
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/90">
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>تفاصيل الأصناف والكميات:</span>
                  <span className="font-mono text-amber-800 font-black">{activeFontSizes.tableRows}px</span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={20}
                  value={activeFontSizes.tableRows}
                  onChange={(e) => handleFontSizeChange('tableRows', parseInt(e.target.value, 10))}
                  className="w-full accent-amber-600 cursor-pointer"
                />
              </div>

              {/* Summary / Debt Totals */}
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/90">
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>الإجماليات والمديونيات:</span>
                  <span className="font-mono text-amber-800 font-black">{activeFontSizes.summary}px</span>
                </div>
                <input
                  type="range"
                  min={9}
                  max={24}
                  value={activeFontSizes.summary}
                  onChange={(e) => handleFontSizeChange('summary', parseInt(e.target.value, 10))}
                  className="w-full accent-amber-600 cursor-pointer"
                />
              </div>

              {/* Footer */}
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/90">
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>تذييل الفاتورة وملاحظات:</span>
                  <span className="font-mono text-amber-800 font-black">{activeFontSizes.footer}px</span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={18}
                  value={activeFontSizes.footer}
                  onChange={(e) => handleFontSizeChange('footer', parseInt(e.target.value, 10))}
                  className="w-full accent-amber-600 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* 3. Toggles for Debt Breakdown & Styling */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Previous Debt on Receipt Toggle */}
            <div className="flex items-center justify-between gap-3 bg-amber-50/50 p-3 rounded-xl border border-amber-200/70">
              <div>
                <span className="font-bold text-xs text-slate-900 block">
                  📑 إظهار المديونية السابقة والإجمالي المستحق
                </span>
                <span className="text-[11px] text-slate-500 font-normal">
                  توضح الفاتورة (المديونية السابقة + الحالية = الإجمالي والمدفوع والمتبقي)
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={settings.showPreviousDebtOnReceipt !== false}
                  onChange={(e) => setSettings({ ...settings, showPreviousDebtOnReceipt: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Table Borders Toggle */}
            <div className="flex items-center justify-between gap-3 bg-amber-50/50 p-3 rounded-xl border border-amber-200/70">
              <div>
                <span className="font-bold text-xs text-slate-900 block">
                  📐 تسطير وحدود جدول الأصناف
                </span>
                <span className="text-[11px] text-slate-500 font-normal">
                  إظهار خطوط واضحة بين خانات الأصناف والكميات في الطباعة
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={settings.showItemsBorder !== false}
                  onChange={(e) => setSettings({ ...settings, showItemsBorder: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>

          {/* Footer Text */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              نص تذييل الفاتورة المطبوعة (Footer Text):
            </label>
            <input
              type="text"
              value={settings.receiptFooter}
              onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })}
              className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white text-right font-medium"
            />
          </div>

          {/* 4. Live Interactive Print Preview Container */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Maximize2 className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-black text-amber-300">
                  معاينة حية وتفاعلية لشكل الفاتورة المطبوعة (Live Simulated Receipt):
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                مقاس الورق: {settings.paperSize} | عرض: {settings.paperSize === '58mm' ? '54mm' : settings.paperSize === '80mm' ? '75mm' : 'كامل'}
              </span>
            </div>

            {/* Simulated Paper */}
            <div className="flex justify-center p-3 bg-slate-950/80 rounded-xl overflow-x-auto">
              <div
                className="bg-white text-slate-950 p-4 rounded shadow-2xl transition-all duration-200"
                style={{
                  width:
                    settings.paperSize === '58mm' || settings.paperSize === '57mm'
                      ? '260px'
                      : settings.paperSize === '76mm'
                      ? '310px'
                      : settings.paperSize === '80mm'
                      ? '340px'
                      : '460px',
                  fontFamily: 'Cairo, sans-serif',
                }}
              >
                {/* Header */}
                <div className="text-center pb-2 mb-2 border-b border-dashed border-slate-900">
                  <div
                    style={{ fontSize: `${activeFontSizes.header}px` }}
                    className="font-black text-slate-950 leading-tight"
                  >
                    {settings.companyName || 'شركة الحليم للتجارة والتوزيع'}
                  </div>
                  <div
                    style={{ fontSize: `${activeFontSizes.meta}px` }}
                    className="text-slate-600 font-bold mt-0.5"
                  >
                    {settings.managerName} | المندوب: {settings.salesRepName}
                  </div>
                  <div style={{ fontSize: `${activeFontSizes.meta - 1}px` }} className="text-slate-500">
                    هاتف: {settings.phonePrimary}
                  </div>
                  <div style={{ fontSize: `${activeFontSizes.meta - 1}px` }} className="text-slate-500">
                    {settings.address}
                  </div>
                </div>

                {/* Meta */}
                <div
                  style={{ fontSize: `${activeFontSizes.meta}px` }}
                  className="space-y-0.5 pb-2 mb-2 border-b border-dashed border-slate-900 text-slate-800"
                >
                  <div className="flex justify-between font-bold">
                    <span>فاتورة رقم: #10258</span>
                    <span>التاريخ: {new Date().toLocaleDateString('ar-EG')}</span>
                  </div>
                  <div>العميل: سوبر ماركت الأمل التجاري</div>
                  <div>الهاتف: 01011112222</div>
                </div>

                {/* Items Table */}
                <table
                  className={`w-full mb-2 ${
                    settings.showItemsBorder !== false ? 'border border-slate-300' : ''
                  }`}
                >
                  <thead>
                    <tr
                      style={{ fontSize: `${activeFontSizes.tableHeader}px` }}
                      className="bg-slate-100 font-black"
                    >
                      <th className="p-1 text-right border border-slate-200">الصنف</th>
                      <th className="p-1 text-center border border-slate-200">الكمية</th>
                      <th className="p-1 text-left border border-slate-200">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ fontSize: `${activeFontSizes.tableRows}px` }}>
                      <td className="p-1 border border-slate-200 font-bold">بيبسي كانز 300 مل</td>
                      <td className="p-1 text-center border border-slate-200 font-mono">5 كرتونة</td>
                      <td className="p-1 text-left border border-slate-200 font-mono font-bold">1,200 ج</td>
                    </tr>
                    <tr style={{ fontSize: `${activeFontSizes.tableRows}px` }}>
                      <td className="p-1 border border-slate-200 font-bold">شيبسي عائلي</td>
                      <td className="p-1 text-center border border-slate-200 font-mono">4 بالتة</td>
                      <td className="p-1 text-left border border-slate-200 font-mono font-bold">720 ج</td>
                    </tr>
                  </tbody>
                </table>

                {/* Totals & Debt */}
                <div
                  style={{ fontSize: `${activeFontSizes.summary}px` }}
                  className="space-y-1 pt-1 border-t border-dashed border-slate-900"
                >
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>إجمالي الأصناف:</span>
                    <span className="font-mono">1,920 ج.م</span>
                  </div>

                  {settings.showPreviousDebtOnReceipt !== false && (
                    <>
                      <div className="flex justify-between text-red-600 font-bold">
                        <span>المديونية السابقة:</span>
                        <span className="font-mono">800 ج.م</span>
                      </div>
                      <div className="flex justify-between font-black text-slate-950 border-t border-slate-200 pt-1">
                        <span>الإجمالي المستحق:</span>
                        <span className="font-mono">2,720 ج.م</span>
                      </div>
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>المدفوع نقداً:</span>
                        <span className="font-mono">1,500 ج.م</span>
                      </div>
                      <div className="flex justify-between font-black text-red-700 border-t border-slate-900 pt-1">
                        <span>المتبقي في الحساب:</span>
                        <span className="font-mono">1,220 ج.م</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Footer */}
                <div
                  style={{ fontSize: `${activeFontSizes.footer}px` }}
                  className="text-center text-slate-500 mt-3 pt-2 border-t border-double border-slate-900 font-medium"
                >
                  <p>{settings.receiptFooter || 'شكراً لتعاملكم مع شركة الحليم للتجارة والتوزيع'}</p>
                  <p className="text-[8px] text-slate-400 font-mono mt-1 pt-1 border-t border-slate-200">
                    Powered by Astra Systems • 01278910793
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Company Identity & Contact Info */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3.5 shadow-xs">
          <div className="flex items-center justify-between pb-2.5 border-b border-gray-100 text-amber-800 font-bold text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>بيانات الهوية التجارية وشعار شركة الحليم</span>
            </div>
            <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-md">
              لوجو معتمد
            </span>
          </div>

          {/* Logo Showcase & Preview Card */}
          <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border border-emerald-800/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-white">
            <div className="flex items-center gap-3.5">
              <BrandLogo
                size="lg"
                variant="badge"
                withGlow
              />
              <div className="text-right">
                <div className="flex items-center gap-1.5">
                  <h4 className="font-black text-sm text-white">شعار شركة الحليم للتجارة والتوزيع</h4>
                  <span className="bg-emerald-500 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded">مفعل</span>
                </div>
                <p className="text-[11px] text-amber-300 font-bold mt-0.5">
                  {settings.managerName || 'إدارة الحاج فوزي عبد الحليم'} • {settings.address || 'الإسكندرية'}
                </p>
                <p className="text-[10px] text-slate-300 mt-0.5">
                  يظهر اللوجو في شريط الترويسة، واجهات الدخول، الفواتير الحرارية، وكشوف الحسابات.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">اسم الشركة الرسمي:</label>
              <input
                type="text"
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white text-right font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">اسم الإدارة:</label>
              <input
                type="text"
                value={settings.managerName}
                onChange={(e) => setSettings({ ...settings, managerName: e.target.value })}
                className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white text-right font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">اسم المندوب:</label>
              <input
                type="text"
                value={settings.salesRepName}
                onChange={(e) => setSettings({ ...settings, salesRepName: e.target.value })}
                className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white text-right font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">رقم الهاتف الرئيسي:</label>
              <input
                type="text"
                value={settings.phonePrimary}
                onChange={(e) => setSettings({ ...settings, phonePrimary: e.target.value })}
                className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white text-right font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">رقم الهاتف الإضافي:</label>
              <input
                type="text"
                value={settings.phoneSecondary}
                onChange={(e) => setSettings({ ...settings, phoneSecondary: e.target.value })}
                className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white text-right font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">عنوان المقر الرئيسي:</label>
              <input
                type="text"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white text-right font-medium"
              />
            </div>
          </div>
        </div>

        {/* 4. Weekly Working Schedule */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3.5 shadow-xs">
          <div className="flex items-center gap-2 pb-2.5 border-b border-gray-100 text-amber-800 font-bold text-xs sm:text-sm">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>جدولة مواعيد فتح وغلق الطلبات اليومية</span>
          </div>

          <div className="space-y-2">
            {settings.weeklySchedule.map((day, idx) => (
              <div
                key={day.dayKey}
                className="bg-slate-50 border border-gray-100 p-2.5 rounded-lg flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={day.isOpen}
                    onChange={(e) => handleScheduleChange(idx, 'isOpen', e.target.checked)}
                    className="w-4 h-4 accent-amber-600 rounded"
                  />
                  <span className="font-bold text-slate-800 min-w-[60px]">{day.dayName}</span>
                  <span
                    className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                      day.isOpen ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {day.isOpen ? 'مفتوح' : 'مغلق'}
                  </span>
                </div>

                {day.isOpen && (
                  <div className="flex items-center gap-2 text-slate-600 font-medium">
                    <span>من:</span>
                    <input
                      type="time"
                      value={day.openTime}
                      onChange={(e) => handleScheduleChange(idx, 'openTime', e.target.value)}
                      className="bg-white border border-gray-200 rounded-md p-1 text-slate-800 text-center font-mono"
                    />
                    <span>إلى:</span>
                    <input
                      type="time"
                      value={day.closeTime}
                      onChange={(e) => handleScheduleChange(idx, 'closeTime', e.target.value)}
                      className="bg-white border border-gray-200 rounded-md p-1 text-slate-800 text-center font-mono"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 5. AI Assistant & Customer Support Settings */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-2.5 border-b border-gray-100">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs sm:text-sm">
              <Bot className="w-4 h-4 text-emerald-600" />
              <span>إعدادات مساعد الحليم الذكي والدعم الفني 🤖</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs font-bold text-slate-700">تفعيل المساعد الذكي:</span>
              <input
                type="checkbox"
                checked={settings.aiAssistantEnabled !== false}
                onChange={(e) =>
                  setSettings({ ...settings, aiAssistantEnabled: e.target.checked })
                }
                className="w-4 h-4 accent-emerald-600 rounded"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">رقم هاتف الدعم الفني والإدارة:</label>
              <input
                type="text"
                value={settings.supportPhone || ''}
                onChange={(e) => setSettings({ ...settings, supportPhone: e.target.value })}
                placeholder="مثال: 01000000000"
                className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-emerald-600 focus:bg-white text-right font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">رقم واتساب المبيعات والدعم:</label>
              <input
                type="text"
                value={settings.supportWhatsapp || ''}
                onChange={(e) => setSettings({ ...settings, supportWhatsapp: e.target.value })}
                placeholder="مثال: 01000000000"
                className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-emerald-600 focus:bg-white text-right font-medium"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">مواعيد عمل الدعم الفني (النص الظاهر للعملاء):</label>
              <input
                type="text"
                value={settings.supportWorkingHours || ''}
                onChange={(e) => setSettings({ ...settings, supportWorkingHours: e.target.value })}
                placeholder="مثال: يومياً من 8:00 صباحاً حتى 10:00 مساءً (الجمعة عطلة)"
                className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-emerald-600 focus:bg-white text-right font-medium"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">رسالة الترحيب الأولى للمساعد الذكي:</label>
              <textarea
                rows={2}
                value={settings.aiGreetingMessage || ''}
                onChange={(e) => setSettings({ ...settings, aiGreetingMessage: e.target.value })}
                placeholder="أهلاً بك 👋 أنا مساعد الحليم الذكي..."
                className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-emerald-600 focus:bg-white text-right font-medium"
              />
            </div>
          </div>
        </div>

        {/* Submit Settings */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-7 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-sm transition-all shadow-md hover:shadow-lg flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>حفظ جميع الإعدادات الآن</span>
          </button>
        </div>
      </form>
    </div>
  );
};
