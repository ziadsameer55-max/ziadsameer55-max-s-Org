import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Bot,
  User as UserIcon,
  Phone,
  MessageCircle,
  RotateCcw,
  Sparkles,
  HelpCircle,
  ShoppingCart,
  FileText,
  CreditCard,
  Package,
  ExternalLink,
  ChevronDown,
  CheckCircle2,
} from 'lucide-react';
import { User, SystemSettings, Order } from '../types';
import { apiFetch } from '../utils/api';

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
  actionButtons?: {
    label: string;
    icon?: 'cart' | 'account' | 'catalog' | 'phone' | 'whatsapp' | 'statement';
    action: () => void;
  }[];
}

interface AIAssistantProps {
  user: User | null;
  settings: SystemSettings | null;
  orders?: Order[];
  onNavigateToTab: (tab: string) => void;
  onOpenCart: () => void;
  onOpenLogin: () => void;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({
  user,
  settings,
  orders = [],
  onNavigateToTab,
  onOpenCart,
  onOpenLogin,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasNewBadge, setHasNewBadge] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const supportPhone = settings?.supportPhone || settings?.phonePrimary || '01000000000';
  const supportWhatsapp = settings?.supportWhatsapp || settings?.phonePrimary || '01000000000';
  const workingHours = settings?.supportWorkingHours || 'يومياً من 8:00 صباحاً حتى 10:00 مساءً';
  const repName = settings?.salesRepName || 'محمد فوزي';

  const safeOrders = Array.isArray(orders) ? orders : [];

  // Calculate user's current debt
  const userDebt = React.useMemo(() => {
    if (!user) return 0;
    const userOrders = safeOrders.filter(
      (o) => (o.customerId === user.id || o.customerPhone === user.phone) && o.status !== 'Cancelled'
    );
    const totalInvoiced = userOrders.reduce((s, o) => s + (o.grandTotal || 0), 0);
    const totalPaid = userOrders.reduce((s, o) => s + (o.paidAmount || 0), 0);
    return Math.max(0, totalInvoiced - totalPaid);
  }, [user, safeOrders]);

  // Latest order
  const latestOrder = React.useMemo(() => {
    if (!user) return null;
    const userOrders = safeOrders.filter(
      (o) => (o.customerId === user.id || o.customerPhone === user.phone)
    );
    return userOrders.length > 0 ? userOrders[0] : null;
  }, [user, safeOrders]);

  const defaultGreeting: Message = {
    id: 'greet_1',
    sender: 'bot',
    text:
      settings?.aiGreetingMessage ||
      'أهلاً بك 👋\nأنا مساعد الحليم الذكي.\nأقدر أساعدك في استخدام الموقع وحل أي مشكلة أو استفسار.',
    timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
  };

  const [messages, setMessages] = useState<Message[]>([defaultGreeting]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      setHasNewBadge(false);
      scrollToBottom();
    }
  }, [isOpen, messages]);

  const handleResetChat = () => {
    setMessages([
      {
        id: 'greet_' + Date.now(),
        sender: 'bot',
        text: 'أهلاً بك من جديد! 👋 كيف أقدر أساعدك اليوم في منصة شركة الحليم؟',
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // Quick Action Handler
  const handleQuickAction = async (actionType: string) => {
    let queryText = '';
    let directBotAnswer = '';
    let actions: Message['actionButtons'] = undefined;

    const time = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    if (actionType === 'register') {
      queryText = 'كيفية التسجيل';
      directBotAnswer =
        'لإنشاء حساب عميل جديد 📝:\n1. اضغط على زر "تسجيل الدخول" في الأعلى أو من تبويب "حسابي".\n2. إذا كنت تاجراً جديداً، سجل رقم هاتفك وسيتم تفعيل حسابك وأسعار الجملة فوراً مع مندوب المنطقة (' +
        repName +
        ') أو بالاتصال على الدعم الفني.';
      actions = [
        {
          label: 'تسجيل الدخول الآن 🔑',
          icon: 'account',
          action: () => {
            setIsOpen(false);
            onOpenLogin();
          },
        },
      ];
    } else if (actionType === 'login') {
      queryText = 'كيفية تسجيل الدخول';
      directBotAnswer =
        'لتسجيل الدخول 🔑:\n1. اضغط على زر تسجيل الدخول بالأعلى.\n2. اكتب رقم هاتفك المسجل وكلمة المرور.\n3. اضغط "تسجيل الدخول" لتتمكن من إرسال الطلبات ومتابعة كشف الحساب.';
      actions = [
        {
          label: 'فتح شاشة تسجيل الدخول',
          icon: 'account',
          action: () => {
            setIsOpen(false);
            onOpenLogin();
          },
        },
      ];
    } else if (actionType === 'order') {
      queryText = 'كيفية طلب الأوردر';
      directBotAnswer =
        'طريقة عمل طلب الجملة 🛒:\n1. تصفح الأصناف في دفتر الطلبات وحدد عدد الكراتين بالضغط على زر (+).\n2. اضغط على شريط "عرض السلة" بالأسفل لمراجعة الأصناف والإجمالي.\n3. اضغط زر "تأكيد وإرسال الطلب" وسيصل الأوردر مباشرة لإدارة شركة الحليم للتجهيز والتسليم.';
      actions = [
        {
          label: 'تصفح الأصناف والمنتجات 📦',
          icon: 'catalog',
          action: () => {
            setIsOpen(false);
            onNavigateToTab('catalog');
          },
        },
        {
          label: 'فتح سلة الطلبات 🛒',
          icon: 'cart',
          action: () => {
            setIsOpen(false);
            onOpenCart();
          },
        },
      ];
    } else if (actionType === 'cart') {
      queryText = 'كيفية إضافة أصناف للسلة';
      directBotAnswer =
        'لإضافة أصناف للسلة ➕:\nاضغط على علامة (+) بجوار أي صنف من أصناف المشروبات أو الشيبسي أو البسكويت، وسيتم إضافة الكرتونة فوراً إلى السلة مع تحديث إجمالي الفاتورة تلقائياً.';
      actions = [
        {
          label: 'الذهاب لدفتر الأصناف 🥤',
          icon: 'catalog',
          action: () => {
            setIsOpen(false);
            onNavigateToTab('catalog');
          },
        },
      ];
    } else if (actionType === 'debt') {
      queryText = 'الاستعلام عن حسابي والمديونية';
      if (user) {
        directBotAnswer = `حسابك الحالي 💰:\nالعميل: ${user.fullName}\nإجمالي المديونية المتبقية: ${(userDebt || 0).toLocaleString('ar-EG')} جنيه مصري.\n\nيمكنك فتح شاشة حسابك لمشاهدة جميع الفواتير والمبالغ المسددة وطباعة كشف الحساب التفصيلي.`;
        actions = [
          {
            label: 'عرض كشف الحساب والمديونية 📄',
            icon: 'statement',
            action: () => {
              setIsOpen(false);
              onNavigateToTab('account');
            },
          },
        ];
      } else {
        directBotAnswer =
          'لمعرفة رصيدك والمديونية المتبقية 💰:\nيرجى تسجيل الدخول أولاً برقم هاتفك المسجل لتتمكن من استعراض كشف حسابك المالي وفواتيرك السابقة.';
        actions = [
          {
            label: 'تسجيل الدخول 🔑',
            icon: 'account',
            action: () => {
              setIsOpen(false);
              onOpenLogin();
            },
          },
        ];
      }
    } else if (actionType === 'track_order') {
      queryText = 'متابعة حالة طلبي الأخير';
      if (latestOrder) {
        const statusMap: Record<string, string> = {
          Pending: 'قيد المراجعة والانتظار ⏳',
          Confirmed: 'تم الاعتماد من الإدارة 🟢',
          Preparing: 'جاري تجهيز البضاعة في المخزن 📦',
          'Out for Delivery': 'الطلب في الطريق مع المندوب 🚚',
          Delivered: 'تم التسليم بنجاح ✅',
          Cancelled: 'ملغي ❌',
        };
        directBotAnswer = `حالة آخر طلب لك:\nرقم الطلب: ${latestOrder.orderNumber}\nالحالة: ${statusMap[latestOrder.status] || latestOrder.status}\nالإجمالي: ${(latestOrder.grandTotal || 0).toLocaleString('ar-EG')} ج.م\nالمتبقي: ${(latestOrder.remainingBalance || 0).toLocaleString('ar-EG')} ج.م\nتاريخ الطلب: ${latestOrder.createdAt}`;
        actions = [
          {
            label: 'تتبع الطلب والفواتير 📋',
            icon: 'account',
            action: () => {
              setIsOpen(false);
              onNavigateToTab('orders');
            },
          },
        ];
      } else {
        directBotAnswer =
          'لا يوجد طلبات سابقة مسجلة على حسابك حالياً. يمكنك تصفح دفتر الأصناف وعمل أول طلب جملة الآن!';
        actions = [
          {
            label: 'طلب أوردر جديد 🛒',
            icon: 'catalog',
            action: () => {
              setIsOpen(false);
              onNavigateToTab('catalog');
            },
          },
        ];
      }
    } else if (actionType === 'print') {
      queryText = 'طباعة الفواتير وكشف الحساب';
      directBotAnswer =
        'لطباعة الفواتير وكشف الحساب 🖨️:\n1. افتح تبويب "حسابي والطلبات".\n2. بجوار أي فاتورة اضغط على أيقونة الطابعة (🖨️).\n3. النظام يدعم مقاسات الطابعات الحرارية (80mm, 58mm) ومقاس A4 بالكامل.';
      actions = [
        {
          label: 'فتح الفواتير للطباعة 🖨️',
          icon: 'statement',
          action: () => {
            setIsOpen(false);
            onNavigateToTab('account');
          },
        },
      ];
    } else if (actionType === 'support') {
      queryText = 'التواصل مع الدعم الفني والإدارة';
      directBotAnswer = `فريق الدعم الفني وإدارة شركة الحليم في خدمتكم دائماً 📞:\n- هاتف الإدارة: ${supportPhone}\n- واتساب المبيعات: ${supportWhatsapp}\n- مواعيد العمل: ${workingHours}\n- مندوب التوزيع والتحصيل: ${repName}`;
      actions = [
        {
          label: `اتصال هاتفي (${supportPhone})`,
          icon: 'phone',
          action: () => {
            window.open(`tel:${supportPhone}`, '_self');
          },
        },
        {
          label: `محادثة واتساب (${supportWhatsapp})`,
          icon: 'whatsapp',
          action: () => {
            const cleanPhone = supportWhatsapp.replace(/[^0-9]/g, '');
            const intlPhone = cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone;
            window.open(`https://wa.me/${intlPhone}`, '_blank');
          },
        },
      ];
    }

    // Add user message then direct answer
    const userMsg: Message = {
      id: 'usr_' + Date.now(),
      sender: 'user',
      text: queryText,
      timestamp: time,
    };

    const botMsg: Message = {
      id: 'bot_' + Date.now(),
      sender: 'bot',
      text: directBotAnswer,
      timestamp: time,
      actionButtons: actions,
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
  };

  // Send Custom Message to AI Server
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || isLoading) return;

    setInputText('');
    const time = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    const userMsg: Message = {
      id: 'usr_' + Date.now(),
      sender: 'user',
      text,
      timestamp: time,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'model',
        text: m.text,
      }));

      const res = await apiFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          customerId: user?.id,
          history: historyPayload,
        }),
      });

      const data = await res.json();
      const reply =
        data.reply ||
        'أهلاً بك! يمكنك تصفح الأصناف وعمل طلبك أو التواصل مع الدعم الفني على ' + supportPhone;

      // Check if reply suggests support
      let actionButtons: Message['actionButtons'] = undefined;
      if (
        reply.includes('فريق الدعم الفني') ||
        reply.includes('الدعم الفني') ||
        reply.includes('واتساب') ||
        reply.includes('هاتف')
      ) {
        actionButtons = [
          {
            label: `اتصال بالإدارة 📞`,
            icon: 'phone',
            action: () => {
              window.open(`tel:${supportPhone}`, '_self');
            },
          },
          {
            label: `محادثة واتساب 💬`,
            icon: 'whatsapp',
            action: () => {
              const cleanPhone = supportWhatsapp.replace(/[^0-9]/g, '');
              const intlPhone = cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone;
              window.open(`https://wa.me/${intlPhone}`, '_blank');
            },
          },
        ];
      }

      const botMsg: Message = {
        id: 'bot_' + Date.now(),
        sender: 'bot',
        text: reply,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        actionButtons,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const fallbackMsg: Message = {
        id: 'bot_err_' + Date.now(),
        sender: 'bot',
        text: `المشكلة تحتاج تدخل من فريق الدعم الفني.\nيرجى التواصل معنا مباشرة على رقم: ${supportPhone} أو واتساب: ${supportWhatsapp}.`,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        actionButtons: [
          {
            label: `اتصال هاتفي (${supportPhone})`,
            icon: 'phone',
            action: () => window.open(`tel:${supportPhone}`, '_self'),
          },
        ],
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // If AI Assistant is disabled in settings, don't show
  if (settings && settings.aiAssistantEnabled === false) {
    return null;
  }

  return (
    <>
      {/* Floating Action Button (Clean positioning above mobile navigation & cart) */}
      <div className="fixed bottom-20 md:bottom-6 left-4 md:left-6 z-40 no-print flex flex-col items-start gap-2">
        {!isOpen && (
          <button
            id="halim-ai-fab-button"
            onClick={() => setIsOpen(true)}
            className="group relative flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-emerald-800 to-teal-800 hover:from-emerald-900 hover:to-teal-900 text-white rounded-full shadow-xl border border-emerald-600/30 transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none"
            aria-label="مساعد الحليم الذكي"
          >
            {/* Pulsing indicator */}
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400"></span>
            </span>

            <div className="flex items-center gap-1.5 font-black text-xs md:text-sm tracking-wide">
              <span>مساعد الحليم</span>
              <span className="text-base">🤖</span>
            </div>

            {hasNewBadge && (
              <span className="bg-amber-400 text-slate-950 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shadow-xs">
                جديد
              </span>
            )}
          </button>
        )}
      </div>

      {/* Floating Chat Modal / Drawer */}
      {isOpen && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:left-6 sm:w-96 sm:h-[580px] z-50 flex flex-col bg-white sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-right no-print">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white p-3.5 flex items-center justify-between shadow-md shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-xl shadow-inner">
                  🤖
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-emerald-900 rounded-full"></span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-black text-sm text-white">مساعد الحليم الذكي</h3>
                  <span className="text-[10px] bg-emerald-700/80 border border-emerald-500/40 text-emerald-100 px-1.5 py-0.2 rounded font-bold">
                    AI
                  </span>
                </div>
                <p className="text-[11px] text-emerald-200 flex items-center gap-1 font-medium mt-0.5">
                  <span>خدمة عملاء فورية لطلبات الجملة</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleResetChat}
                className="p-2 text-emerald-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                title="بدء محادثة جديدة"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-emerald-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Help Header Banner */}
          <div className="bg-slate-50 border-b border-slate-200/80 px-3 py-2 flex items-center justify-between text-[11px] text-slate-600">
            <span className="font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>اختيارات سريعة للمساعدة:</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium">متاح 24/7</span>
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-slate-50/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                } space-y-1.5`}
              >
                <div className="flex items-end gap-1.5 max-w-[88%]">
                  {msg.sender === 'bot' && (
                    <div className="w-6 h-6 rounded-lg bg-emerald-800 text-white flex items-center justify-center text-xs shrink-0 shadow-xs mb-1">
                      🤖
                    </div>
                  )}

                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed shadow-xs whitespace-pre-line ${
                      msg.sender === 'user'
                        ? 'bg-emerald-800 text-white rounded-br-none'
                        : 'bg-white text-slate-800 border border-slate-200/90 rounded-bl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>

                {/* Optional Action Buttons Inside Message */}
                {msg.actionButtons && msg.actionButtons.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mr-7 mt-1">
                    {msg.actionButtons.map((btn, idx) => (
                      <button
                        key={idx}
                        onClick={btn.action}
                        className="text-[11px] font-bold px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                      >
                        {btn.icon === 'cart' && <ShoppingCart className="w-3.5 h-3.5 text-emerald-700" />}
                        {btn.icon === 'account' && <UserIcon className="w-3.5 h-3.5 text-emerald-700" />}
                        {btn.icon === 'catalog' && <Package className="w-3.5 h-3.5 text-emerald-700" />}
                        {btn.icon === 'statement' && <FileText className="w-3.5 h-3.5 text-emerald-700" />}
                        {btn.icon === 'phone' && <Phone className="w-3.5 h-3.5 text-emerald-700" />}
                        {btn.icon === 'whatsapp' && <MessageCircle className="w-3.5 h-3.5 text-emerald-700" />}
                        <span>{btn.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                <span className="text-[9px] text-slate-400 px-1">
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {/* Quick Action Chips Selection Grid */}
            <div className="pt-2">
              <p className="text-[10px] font-extrabold text-slate-400 mb-2 px-1">
                الأسئلة الشائعة والإرشادات السريعة:
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'order', label: '🛒 كيفية طلب الأوردر' },
                  { id: 'cart', label: '➕ إضافة أصناف للسلة' },
                  { id: 'debt', label: '💰 حسابي والمديونية' },
                  { id: 'track_order', label: '📦 تتبع آخر أوردر' },
                  { id: 'login', label: '🔑 تسجيل الدخول' },
                  { id: 'register', label: '📝 إنشاء حساب جديد' },
                  { id: 'print', label: '🖨️ طباعة الفواتير' },
                  { id: 'support', label: '📞 الدعم الفني' },
                ].map((chip) => (
                  <button
                    key={chip.id}
                    onClick={() => handleQuickAction(chip.id)}
                    className="p-2 text-right bg-white hover:bg-emerald-50/80 hover:border-emerald-300 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 transition-all shadow-2xs flex items-center justify-between"
                  >
                    <span>{chip.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs py-2 px-1">
                <div className="w-5 h-5 rounded-lg bg-emerald-800 text-white flex items-center justify-center text-[10px]">
                  🤖
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-pulse"></span>
                  <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-pulse delay-100"></span>
                  <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-pulse delay-200"></span>
                  <span className="text-[11px] text-slate-500 font-medium mr-1">
                    جاري التفكير والرد...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Support Quick Bar */}
          <div className="bg-amber-50/80 border-t border-amber-100 px-3 py-1.5 flex items-center justify-between text-[10px] text-amber-900 font-semibold">
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3 text-amber-700" />
              <span>دعم مباشر: {supportPhone}</span>
            </span>
            <a
              href={`https://wa.me/${supportWhatsapp.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-0.5"
            >
              <span>واتساب</span>
              <MessageCircle className="w-3 h-3 text-emerald-600" />
            </a>
          </div>

          {/* Input Footer Form */}
          <form
            onSubmit={handleSendMessage}
            className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="اكتب استفسارك لمساعد الحليم..."
              className="flex-1 bg-slate-100 border border-slate-200 focus:border-emerald-600 focus:bg-white rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="p-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-40 text-white font-bold transition-all shadow-xs shrink-0 flex items-center justify-center"
              title="إرسال"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
