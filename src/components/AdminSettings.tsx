import React, { useState, useEffect } from 'react';
import { SystemSettings, PaperSize, DaySchedule } from '../types';
import { Settings, Printer, Clock, Save, ShieldCheck, Phone, MapPin, FileText, Bot, MessageSquare, Sparkles, Lock, EyeOff, Eye, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface AdminSettingsProps {
  settings: SystemSettings | null;
  onSaveSettings: (newSettings: SystemSettings) => void;
}

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
      isManualOverrideActive: false,
      manualOrdersOpen: true,
      hidePrices: false,
      scheduleEnabled: true,
      preventOutOfStockSale: false,
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

  return (
    <div className="space-y-5 text-right pb-16">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 font-bold shrink-0">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">إعدادات النظام وطابعات الفواتير الحرارية</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              تحديد مقاسات ورق الطباعة الحراري (58mm, 80mm, A4) ومواعيد فتح وغلق الطلبات
            </p>
          </div>
        </div>

        {savedSuccess && (
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-3 py-1 rounded-lg font-bold animate-pulse">
            ✓ تم حفظ الإعدادات بنجاح
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* 🔐 Security & Price Visibility Settings (Server-Side Enforced) */}
        <div className="bg-white border-2 border-slate-200 hover:border-slate-300 rounded-xl p-4 sm:p-5 space-y-3.5 shadow-sm transition-all">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2.5 text-slate-900 font-bold text-sm sm:text-base">
              <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 border border-red-100 flex items-center justify-center shrink-0">
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

                {/* Subtitle status requirement */}
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

            {/* Detailed Behavior Breakdown Box */}
            <div className="mt-3 pt-3 border-t border-slate-200/80 text-[11px] text-slate-600">
              {settings.hidePrices ? (
                <div className="space-y-1 bg-white/80 p-2.5 rounded-lg border border-emerald-200/80">
                  <div className="font-bold text-emerald-900 text-xs mb-1">
                    🟢 تأثير تشغيل خيار إخفاء الأسعار (Server-Side Active):
                  </div>
                  <ul className="space-y-0.5 text-slate-700 list-disc list-inside leading-relaxed">
                    <li>أسعار المنتجات مخفية بالكامل ولا يتم إرسالها إطلاقاً في استجابات الـAPI للعملاء.</li>
                    <li>سعر الوحدة وسعر الكرتونة وإجمالي كل صنف مخفي ومحمي.</li>
                    <li>تفاصيل الأسعار وإجمالي الفاتورة في السلة والطلب مخفية عن العميل.</li>
                    <li>المدير (Admin) فقط هو من يرى الأسعار كاملة ويدير الفواتير الحقيقية.</li>
                  </ul>
                </div>
              ) : (
                <div className="space-y-1 bg-white/80 p-2.5 rounded-lg border border-slate-200">
                  <div className="font-bold text-slate-800 text-xs mb-1">
                    ⚪ تأثير إيقاف الخيار (الأسعار ظاهرة):
                  </div>
                  <ul className="space-y-0.5 text-slate-600 list-disc list-inside leading-relaxed">
                    <li>الأسعار تظهر لعملاء الجملة بشكل طبيعي في الكتالوج والبحث.</li>
                    <li>يظهر سعر الوحدة والكرتونة وإجمالي كل صنف فورياً.</li>
                    <li>تظهر تفاصيل الأسعار وحسابات الفاتورة في السلة والطلب.</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Thermal Printer Settings */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3.5 shadow-xs">
          <div className="flex items-center gap-2 pb-2.5 border-b border-gray-100 text-amber-800 font-bold text-xs sm:text-sm">
            <Printer className="w-4 h-4 text-amber-600" />
            <span>إعدادات طابعة الإيصالات الحرارية (Thermal Receipt Printers)</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              اختر مقاس ورق الطباعة الخاص بالطابعة الموصلة بالنظام:
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {[
                { id: '58mm', label: '58 مم (بون صغير)' },
                { id: '80mm', label: '80 مم (بون حراري قياسي)' },
                { id: '57mm', label: '57 مم (طابعة محمولة)' },
                { id: '76mm', label: '76 مم' },
                { id: 'A4', label: 'ورق A4 كامل' },
                { id: 'A5', label: 'ورق A5 نصف صفحة' },
              ].map((size) => (
                <button
                  type="button"
                  key={size.id}
                  onClick={() => setSettings({ ...settings, paperSize: size.id as PaperSize })}
                  className={`p-2.5 rounded-lg border text-center transition-all flex flex-col items-center justify-center gap-0.5 ${
                    settings.paperSize === size.id
                      ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold ring-2 ring-amber-500/20'
                      : 'bg-slate-50 border-gray-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Printer className="w-4 h-4 mb-0.5 text-amber-600" />
                  <span className="font-extrabold text-xs">{size.id}</span>
                  <span className="text-[10px] text-slate-500">{size.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              نص تذييل الفاتورة المطبوعة (Footer Text):
            </label>
            <input
              type="text"
              value={settings.receiptFooter}
              onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })}
              className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white text-right"
            />
          </div>

          {/* Previous Debt on Receipt Toggle */}
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-3 bg-amber-50/50 p-3 rounded-lg border border-amber-200/60">
            <div>
              <span className="font-bold text-xs text-slate-900 block">
                📑 إظهار قسم المديونية السابقة والإجمالي المستحق في الفاتورة المطبوعة للعميل
              </span>
              <span className="text-[11px] text-slate-500 font-normal">
                عند التفعيل، توضح الفاتورة المطبوعة (المديونية السابقة + الفاتورة الحالية = الإجمالي المستحق والمدفوع والمتبقي)
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={settings.showPreviousDebtOnReceipt ?? true}
                onChange={(e) => setSettings({ ...settings, showPreviousDebtOnReceipt: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
        </div>

        {/* Company Identity & Contact Info */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3.5 shadow-xs">
          <div className="flex items-center gap-2 pb-2.5 border-b border-gray-100 text-amber-800 font-bold text-xs sm:text-sm">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            <span>بيانات الهوية التجارية لشركة الحليم</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">اسم الشركة الرسمي:</label>
              <input
                type="text"
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white text-right"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">اسم الإدارة:</label>
              <input
                type="text"
                value={settings.managerName}
                onChange={(e) => setSettings({ ...settings, managerName: e.target.value })}
                className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white text-right"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">اسم المندوب:</label>
              <input
                type="text"
                value={settings.salesRepName}
                onChange={(e) => setSettings({ ...settings, salesRepName: e.target.value })}
                className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white text-right"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">رقم الهاتف الرئيسي:</label>
              <input
                type="text"
                value={settings.phonePrimary}
                onChange={(e) => setSettings({ ...settings, phonePrimary: e.target.value })}
                className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white text-right"
              />
            </div>
          </div>
        </div>

        {/* Weekly Working Schedule */}
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

        {/* AI Assistant & Customer Support Settings */}
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
                className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-emerald-600 focus:bg-white text-right"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">رقم واتساب المبيعات والدعم:</label>
              <input
                type="text"
                value={settings.supportWhatsapp || ''}
                onChange={(e) => setSettings({ ...settings, supportWhatsapp: e.target.value })}
                placeholder="مثال: 01000000000"
                className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-emerald-600 focus:bg-white text-right"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">مواعيد عمل الدعم الفني (النص الظاهر للعملاء):</label>
              <input
                type="text"
                value={settings.supportWorkingHours || ''}
                onChange={(e) => setSettings({ ...settings, supportWorkingHours: e.target.value })}
                placeholder="مثال: يومياً من 8:00 صباحاً حتى 10:00 مساءً (الجمعة عطلة)"
                className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-emerald-600 focus:bg-white text-right"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">رسالة الترحيب الأولى للمساعد الذكي:</label>
              <textarea
                rows={2}
                value={settings.aiGreetingMessage || ''}
                onChange={(e) => setSettings({ ...settings, aiGreetingMessage: e.target.value })}
                placeholder="أهلاً بك 👋 أنا مساعد الحليم الذكي. أقدر أساعدك في استخدام الموقع وحل أي استفسار..."
                className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-emerald-600 focus:bg-white text-right"
              />
            </div>
          </div>
        </div>

        {/* Submit Settings */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors shadow-xs flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>حفظ جميع الإعدادات الآن</span>
          </button>
        </div>
      </form>
    </div>
  );
};
