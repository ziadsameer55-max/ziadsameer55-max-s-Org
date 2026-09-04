import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  User,
  Product,
  Category,
  Order,
  SystemSettings,
  OrderStatus,
  DealOffer,
} from './types';
import { Header } from './components/Header';
import { NotebookCatalog, CartItem } from './components/NotebookCatalog';
import { CategoriesExploreView } from './components/CategoriesExploreView';
import { checkIsStoreOpen } from './utils/orderStatus';
import { BottomSheetCart } from './components/BottomSheetCart';
import { OrderSuccessModal } from './components/OrderSuccessModal';
import { CustomerAccount } from './components/CustomerAccount';
import { BottomNavigation } from './components/BottomNavigation';
import { AdminSidebar } from './components/AdminSidebar';
import { AdminFastOrders } from './components/AdminFastOrders';
import { AdminCustomersManager } from './components/AdminCustomersManager';
import { AdminDebtsManager } from './components/AdminDebtsManager';
import { AdminCollectionsReport } from './components/AdminCollectionsReport';
import { AdminProductsManager } from './components/AdminProductsManager';
import { AdminLowStock } from './components/AdminLowStock';
import { AdminDealsManager } from './components/AdminDealsManager';
import { AdminInformationManager } from './components/AdminInformationManager';
import { CustomerInformationModal } from './components/CustomerInformationModal';
import { AdminSettings } from './components/AdminSettings';
import { AdminOrderEditModal } from './components/AdminOrderEditModal';
import { PrintReceiptModal } from './components/PrintReceiptModal';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { LoginModal } from './components/LoginModal';
import { AIAssistant } from './components/AIAssistant';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  ShoppingCart,
  Package,
  Star,
  Menu,
  ShieldCheck,
  CheckCircle2,
  Settings as SettingsIcon,
  RefreshCw,
  Store,
  Wallet,
  ClipboardList,
} from 'lucide-react';
import { apiFetch } from './utils/api';

function parseCurrentRoute(): string {
  const path = window.location.pathname.replace(/^\/+/, '');
  const hash = window.location.hash.replace(/^#\/?/, '');
  return hash || path || 'catalog';
}

export default function App() {
  // User Authentication State
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('halim_user');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [deals, setDeals] = useState<DealOffer[]>([]);
  
  // Active route / tab with strict initial check
  const [activeTab, setActiveTabState] = useState<string>(() => {
    const initial = parseCurrentRoute();
    if (initial.startsWith('admin')) {
      try {
        const saved = localStorage.getItem('halim_user');
        const parsed = saved ? JSON.parse(saved) : null;
        if (parsed?.role !== 'admin') {
          return 'catalog';
        }
      } catch {
        return 'catalog';
      }
    }
    return initial;
  });

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isMobileAdminSidebarOpen, setIsMobileAdminSidebarOpen] = useState(false);

  const userRef = React.useRef<User | null>(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Safe navigation that strictly guards admin routes
  const navigateTo = useCallback((target: string, overrideUser?: User | null) => {
    const effectiveUser = overrideUser !== undefined ? overrideUser : userRef.current;
    let clean = target.startsWith('/') ? target.slice(1) : target;
    clean = clean.replace(/^#\/?/, '');
    if (!clean) clean = 'catalog';

    // Strict Guard: Prevent any non-admin / customer from navigating to admin routes
    if (clean.startsWith('admin') && effectiveUser?.role !== 'admin') {
      clean = 'catalog';
      setToast({ message: 'عفواً، الدخول إلى لوحة الإدارة مخصص لحساب الإدارة فقط', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }

    setActiveTabState(clean);
    try {
      const newUrl = `/${clean}`;
      if (window.location.pathname !== newUrl) {
        window.history.pushState(null, '', newUrl);
      }
    } catch {}
  }, []);

  const setActiveTab = (tab: string) => {
    navigateTo(tab);
  };

  // Listen for browser Back/Forward navigation with admin route guards
  useEffect(() => {
    const handlePopState = () => {
      let route = parseCurrentRoute();
      if (route.startsWith('admin') && userRef.current?.role !== 'admin') {
        route = 'catalog';
        try {
          window.history.replaceState(null, '', '/catalog');
        } catch {}
      }
      setActiveTabState(route);
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  // Favorites stored in localStorage
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('halim_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Unified Cart State
  const [cart, setCart] = useState<CartItem[]>([]);

  // Modals & Bottom Sheets
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isCustomerInfoOpen, setIsCustomerInfoOpen] = useState(false);
  const [unreadInfoCount, setUnreadInfoCount] = useState(0);
  const [submittedOrder, setSubmittedOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);

  // Toast alert
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Hydrate & Validate Auth Session with Backend on mount
  useEffect(() => {
    async function verifySession() {
      try {
        const saved = localStorage.getItem('halim_user');
        if (saved) {
          const parsedSaved = JSON.parse(saved);
          // Pre-populate user state immediately so UI is responsive
          if (parsedSaved && parsedSaved.id) {
            setUser(parsedSaved);
          }

          const res = await apiFetch('/api/auth/me');
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.user) {
              setUser(data.user);
              localStorage.setItem('halim_user', JSON.stringify(data.user));
            } else {
              // Session expired or invalid
              localStorage.removeItem('halim_user');
              setUser(null);
            }
          } else if (res.status === 401 || res.status === 403) {
            // Explicitly unauthorized or expired
            localStorage.removeItem('halim_user');
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Session check error:', err);
      } finally {
        setIsAuthChecking(false);
      }
    }
    verifySession();

    // Listen to global 401 Session Expired events from apiClient / apiFetch
    const handleAuthExpiredEvent = (e: any) => {
      const msg = e.detail?.message || 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً';
      localStorage.removeItem('halim_user');
      setUser(null);
      showToast(msg, 'error');
      setIsLoginOpen(true);
    };

    // Network connection status listeners
    const handleOnline = () => showToast('تم استعادة الاتصال بالإنترنت 🟢', 'success');
    const handleOffline = () => showToast('انقطع الاتصال بالإنترنت ⚠️ يرجى التحقق من الشبكة', 'error');

    window.addEventListener('halim:session-expired', handleAuthExpiredEvent);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('halim:session-expired', handleAuthExpiredEvent);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Strict Admin Route Guard for Non-Admin / Customer Accounts
  useEffect(() => {
    if (!isAuthChecking) {
      if (activeTab.startsWith('admin') && user?.role !== 'admin') {
        navigateTo('/catalog');
        showToast('عفواً، الدخول إلى لوحة الإدارة مخصص لحساب الإدارة فقط', 'error');
      }
    }
  }, [activeTab, user?.role, isAuthChecking, navigateTo]);

  // Toggle favorite
  const handleToggleFavorite = (productId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
      try {
        localStorage.setItem('halim_favorites', JSON.stringify(next));
      } catch (err) {
        console.error(err);
      }
      return next;
    });
  };

  // Logout Handler
  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    localStorage.removeItem('halim_user');
    setUser(null);
    navigateTo('/login');
    showToast('تم تسجيل الخروج بنجاح');
    fetchData();
  };

  // Login Handler
  const handleLoginSuccess = (u: User) => {
    try {
      localStorage.setItem('halim_user', JSON.stringify(u));
    } catch {}
    userRef.current = u;
    setUser(u);
    setIsLoginOpen(false);
    showToast(`مرحباً بك، ${u.fullName || u.username}`);
    if (u.role === 'admin') {
      navigateTo('/admin-orders', u);
    } else {
      navigateTo('/catalog', u);
    }
    fetchData();
  };

  const handleUpdateCartItem = (product: Product, delta: number) => {
    // Check if store is open for customers
    const storeStatus = checkIsStoreOpen(settings);
    if (!storeStatus.isOpen && user?.role !== 'admin' && delta > 0) {
      showToast(
        storeStatus.reason || 'عذرًا، تم إغلاق استقبال الطلبات حاليًا. يرجى المحاولة مرة أخرى لاحقًا.',
        'error'
      );
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (!existing) {
        if (delta <= 0) return prev;
        const initialQty = Math.max(delta, product.minQty || 1);
        return [...prev, { product, quantity: initialQty }];
      }

      const nextQty = existing.quantity + delta;
      if (nextQty <= 0) {
        return prev.filter((item) => item.product.id !== product.id);
      }

      if (product.maxQty !== null && nextQty > product.maxQty) {
        showToast(`أقصى كمية مسموح بها لهذا المنتج هي ${product.maxQty}`, 'error');
        return prev;
      }

      return prev.map((item) =>
        item.product.id === product.id ? { ...item, quantity: nextQty } : item
      );
    });
  };

  const handleSetCartItemQty = (product: Product, qty: number) => {
    // Check if store is open for customers
    const storeStatus = checkIsStoreOpen(settings);
    if (!storeStatus.isOpen && user?.role !== 'admin' && qty > 0) {
      showToast(
        storeStatus.reason || 'عذرًا، تم إغلاق استقبال الطلبات حاليًا. يرجى المحاولة مرة أخرى لاحقًا.',
        'error'
      );
      return;
    }

    setCart((prev) => {
      if (qty <= 0) {
        return prev.filter((item) => item.product.id !== product.id);
      }
      const existing = prev.find((item) => item.product.id === product.id);
      if (!existing) {
        return [...prev, { product, quantity: qty }];
      }
      return prev.map((item) =>
        item.product.id === product.id ? { ...item, quantity: qty } : item
      );
    });
  };

  const handleRemoveCartItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      // 1. Settings
      const settingsRes = await apiFetch('/api/settings');
      if (settingsRes.ok) {
        const sData = await settingsRes.json();
        setSettings(sData);
      }

      // 2. Categories
      const catRes = await apiFetch('/api/categories');
      if (catRes.ok) {
        const cData = await catRes.json();
        setCategories(Array.isArray(cData) ? cData : []);
      }

      // 3. Products
      const pRole = user?.role || 'customer';
      const prodRes = await apiFetch(`/api/products?role=${pRole}`);
      if (prodRes.ok) {
        const pData = await prodRes.json();
        setProducts(Array.isArray(pData) ? pData : []);
      }

      // 4. Orders
      if (user) {
        const orderUrl =
          user.role === 'customer' ? `/api/orders?customerId=${user.id}` : '/api/orders';
        const orderRes = await apiFetch(orderUrl);
        if (orderRes.ok) {
          const oData = await orderRes.json();
          setOrders(Array.isArray(oData) ? oData : []);
        }
      } else {
        setOrders([]);
      }

      // 5. Deals & Offers
      try {
        const dealsRes = await apiFetch('/api/deals');
        if (dealsRes.ok) {
          const dData = await dealsRes.json();
          setDeals(Array.isArray(dData) ? dData : []);
        }
      } catch (err) {
        console.error('Failed to load deals:', err);
      }

      // 6. Information & Notifications
      try {
        const token = localStorage.getItem('halim_session_token');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const infoRes = await apiFetch('/api/information', { headers });
        if (infoRes.ok) {
          const iData = await infoRes.json();
          const items = Array.isArray(iData.information) ? iData.information : [];
          const unread = items.filter((i: any) => !i.isRead).length;
          setUnreadInfoCount(unread);
        }
      } catch (err) {
        console.error('Failed to load information items:', err);
      }
    } catch (err) {
      console.error('Failed to load initial data from server:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute store status
  const isStoreOpen = useMemo(() => {
    return checkIsStoreOpen(settings).isOpen;
  }, [settings]);

  // Compute customer outstanding debt
  const customerUnpaidDebt = useMemo(() => {
    if (!user) return 0;
    const safeOrders = Array.isArray(orders) ? orders : [];
    const myOrders = safeOrders.filter(
      (o) => (o.customerId === user.id || o.customerPhone === user.phone) && o.status !== 'Cancelled'
    );
    const totalInvoiced = myOrders.reduce((s, o) => s + (o.grandTotal || 0), 0);
    const totalPaid = myOrders.reduce((s, o) => s + (o.paidAmount || 0), 0);
    return Math.max(0, totalInvoiced - totalPaid);
  }, [user, orders]);

  // Toggle Orders Open/Close manually
  const handleToggleOrdersOpen = async (isOpen: boolean) => {
    try {
      const res = await apiFetch('/api/settings/toggle-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOpen }),
      });
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
        showToast(
          isOpen ? '🟢 تم فتح استقبال الطلبات' : '🔴 تم إغلاق استقبال الطلبات',
          'success'
        );
      }
    } catch (err) {
      showToast('حدث خطأ أثناء تغيير حالة الطلبات', 'error');
    }
  };

  // Update order status
  const handleUpdateOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      const res = await apiFetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, performedBy: user?.fullName }),
      });
      if (res.ok) {
        showToast(`تم تحديث حالة الطلب`);
        fetchData();
      }
    } catch (err) {
      showToast('فشل تحديث حالة الطلب', 'error');
    }
  };

  // Save new settings
  const handleSaveSettings = async (newSettings: SystemSettings) => {
    try {
      const res = await apiFetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Role': user?.role || 'admin',
        },
        body: JSON.stringify(newSettings),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const updated = data?.settings || newSettings;
        setSettings(updated);
        showToast('تم حفظ وتطبيق إعدادات النظام بنجاح 🟢', 'success');
        // Refresh products and data to reflect any visibility changes immediately
        fetchData();
      } else {
        const errorData = await res.json().catch(() => null);
        showToast(errorData?.error || errorData?.message || 'فشل حفظ الإعدادات، يرجى المحاولة مرة أخرى 🔴', 'error');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      showToast('فشل الاتصال بالخادم لحفظ الإعدادات 🔴', 'error');
    }
  };

  const handleReorder = (ord: Order) => {
    const storeStatus = checkIsStoreOpen(settings);
    if (!storeStatus.isOpen && user?.role !== 'admin') {
      showToast(
        storeStatus.reason || 'عذرًا، تم إغلاق استقبال الطلبات حاليًا. يرجى المحاولة مرة أخرى لاحقًا.',
        'error'
      );
      return;
    }

    const availableItems: CartItem[] = [];
    const unavailableNames: string[] = [];

    (ord.items || []).forEach((item) => {
      const matched = products.find((p) => p.id === item.productId);
      if (matched && matched.status === 'open' && (matched.stock === undefined || matched.stock > 0)) {
        // Enforce limits and use live up-to-date product prices
        const minQ = matched.minQty || 1;
        const maxQ = matched.maxQty || 9999;
        const validQty = Math.max(minQ, Math.min(maxQ, item.quantity));
        availableItems.push({ product: matched, quantity: validQty });
      } else {
        unavailableNames.push(item.productName);
      }
    });

    if (availableItems.length > 0) {
      setCart(availableItems);
      setIsCartOpen(true);
      if (unavailableNames.length > 0) {
        showToast(`تمت إضافة ${availableItems.length} صنف متاح بالسعر الحالي. تم استبعاد الأصناف غير المتاحة (${unavailableNames.join('، ')})`, 'success');
      } else {
        showToast('تمت إضافة جميع أصناف الطلب السابق إلى السلة بالأسعار الحالية 🛒', 'success');
      }
    } else {
      showToast('عفواً، جميع أصناف هذا الطلب غير متاحة للطلب حالياً أو نفدت من المخزن', 'error');
    }
  };

  const isAdmin = Boolean(user && user.role === 'admin');
  const isAdminView = isAdmin && activeTab.startsWith('admin');

  // Loading screen while validating initial session
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center select-none" dir="rtl">
        <div className="w-16 h-16 rounded-3xl bg-white/10 p-3.5 border border-white/20 shadow-2xl flex items-center justify-center mb-4">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
        <h1 className="text-white font-black text-base sm:text-lg mb-1">شركة الحليم للتجارة والتوزيع</h1>
        <p className="text-slate-400 text-xs font-bold">جاري تحميل المنصة والتحقق من الحساب...</p>
      </div>
    );
  }

  // If user is not authenticated, render standalone authentication pages
  if (!user) {
    if (activeTab === 'register') {
      return (
        <div dir="rtl">
          {toast && (
            <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-bounce no-print">
              <div
                className={`px-4 py-2.5 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2 ${
                  toast.type === 'success'
                    ? 'bg-emerald-800 text-white border-emerald-700'
                    : 'bg-red-700 text-white border-red-600'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{toast.message}</span>
              </div>
            </div>
          )}
          <ErrorBoundary sectionName="صفحة إنشاء الحساب" onReset={() => navigateTo('catalog')}>
            <RegisterPage onRegisterSuccess={handleLoginSuccess} onNavigate={navigateTo} />
          </ErrorBoundary>
        </div>
      );
    }

    // Default to Standalone LoginPage
    return (
      <div dir="rtl">
        {toast && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-bounce no-print">
            <div
              className={`px-4 py-2.5 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2 ${
                toast.type === 'success'
                  ? 'bg-emerald-800 text-white border-emerald-700'
                  : 'bg-red-700 text-white border-red-600'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{toast.message}</span>
            </div>
          </div>
        )}
        <ErrorBoundary sectionName="صفحة تسجيل الدخول" onReset={() => navigateTo('catalog')}>
          <LoginPage onLoginSuccess={handleLoginSuccess} onNavigate={navigateTo} />
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-slate-100 text-slate-900 font-sans selection:bg-emerald-800 selection:text-white"
      dir="rtl"
    >
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 animate-bounce no-print">
          <div
            className={`px-4 py-2.5 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2 ${
              toast.type === 'success'
                ? 'bg-emerald-800 text-white border-emerald-700'
                : 'bg-red-700 text-white border-red-600'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADMIN VIEW LAYOUT WITH SIDEBAR                                           */}
      {/* ========================================================================= */}
      {isAdminView && user?.role === 'admin' ? (
        <div className="flex min-h-screen bg-slate-100">
          {/* Persistent / Responsive Sidebar */}
          <ErrorBoundary sectionName="القائمة الجانبية للإدارة">
            <AdminSidebar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              user={user}
              settings={settings}
              orders={orders}
              products={products}
              onToggleOrdersOpen={() => handleToggleOrdersOpen(!settings?.manualOrdersOpen)}
              onLogout={handleLogout}
              isOpenMobile={isMobileAdminSidebarOpen}
              onCloseMobile={() => setIsMobileAdminSidebarOpen(false)}
            />
          </ErrorBoundary>

          {/* Admin Main Content Wrapper */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Admin Top Sticky Bar */}
            <header className="bg-slate-900 text-white border-b border-slate-800 px-4 py-3 sticky top-0 z-20 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsMobileAdminSidebarOpen(true)}
                    className="md:hidden p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200"
                    title="فتح القائمة الجانبية"
                  >
                    <Menu className="w-5 h-5" />
                  </button>

                  <div>
                    <h1 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                      {activeTab === 'admin-orders' && '📋 إدارة طلبات الجملة'}
                      {activeTab === 'admin-customers' && '👥 إدارة حسابات العملاء والتجار'}
                      {activeTab === 'admin-debts' && '💰 إدارة التحصيل والمديونيات'}
                      {activeTab === 'admin-collections' && '💰 التحصيل والمقبوضات'}
                      {activeTab === 'admin-products' && '📦 إدارة المنتجات والتسعير'}
                      {activeTab === 'admin-low-stock' && '📦 نواقص المخزن وتنبيهات العجز'}
                      {activeTab === 'admin-deals' && '🔥 إدارة العروض والخصومات'}
                      {activeTab === 'admin-information' && '🔔 إدارة المعلومات والتنبيهات'}
                      {activeTab === 'admin-settings' && '⚙️ إعدادات النظام والمتجر'}
                    </h1>
                    <span className="text-[10px] text-slate-400 hidden sm:inline-block">
                      شركة الحليم للتجارة والتوزيع • الإسكندرية
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchData}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="تحديث البيانات"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setActiveTab('catalog')}
                    className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Store className="w-3.5 h-3.5" />
                    <span>معاينة كمتجر</span>
                  </button>
                </div>
              </div>
            </header>

            {/* Admin Body Screen */}
            <main className="flex-1 p-3 sm:p-5 max-w-6xl w-full mx-auto overflow-y-auto">
              <ErrorBoundary sectionName="لوحة تحكم الإدارة" onReset={fetchData}>
                {activeTab === 'admin-orders' && (
                  <AdminFastOrders
                    orders={orders}
                    settings={settings}
                    allProducts={products}
                    onToggleOrdersOpen={handleToggleOrdersOpen}
                    onUpdateStatus={handleUpdateOrderStatus}
                    onOpenEditModal={(ord) => setEditingOrder(ord)}
                    onOpenPrintModal={(ord) => setPrintingOrder(ord)}
                    onRefreshData={fetchData}
                  />
                )}

                {activeTab === 'admin-customers' && (
                  <AdminCustomersManager
                    onOpenOrderDetails={(orderId) => {
                      const ord = orders.find((o) => o.id === orderId);
                      if (ord) setEditingOrder(ord);
                    }}
                    onRefreshData={fetchData}
                  />
                )}

                {activeTab === 'admin-debts' && (
                  <AdminDebtsManager
                    settings={settings}
                    onOpenOrderDetails={(orderId) => {
                      const ord = orders.find((o) => o.id === orderId);
                      if (ord) setEditingOrder(ord);
                    }}
                    onRefreshData={fetchData}
                  />
                )}

                {activeTab === 'admin-collections' && (
                  <AdminCollectionsReport onRefreshGlobal={fetchData} />
                )}

                {activeTab === 'admin-products' && (
                  <AdminProductsManager
                    products={products}
                    categories={categories}
                    onRefreshData={fetchData}
                  />
                )}

                {activeTab === 'admin-low-stock' && (
                  <AdminLowStock
                    products={products}
                    settings={settings}
                    onRefreshData={fetchData}
                    onNavigateToSettings={() => setActiveTab('admin-settings')}
                  />
                )}

                {activeTab === 'admin-deals' && (
                  <AdminDealsManager
                    products={products}
                    onRefreshData={fetchData}
                    onRefreshProducts={fetchData}
                  />
                )}

                {activeTab === 'admin-information' && (
                  <AdminInformationManager
                    products={products}
                    onRefreshData={fetchData}
                  />
                )}

                {activeTab === 'admin-settings' && (
                  <AdminSettings settings={settings} onSaveSettings={handleSaveSettings} />
                )}
              </ErrorBoundary>
            </main>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* CUSTOMER STOREFRONT LAYOUT (CARTONA-INSPIRED B2B WHOLESALE)               */
        /* ========================================================================= */
        <div className="flex flex-col justify-between min-h-screen">
          <div>
            {/* Header */}
            <ErrorBoundary sectionName="رأس الصفحة">
              <Header
                user={user}
                settings={settings}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                cartCount={cart.length}
                unpaidDebt={customerUnpaidDebt}
                unreadInfoCount={unreadInfoCount}
                onOpenCart={() => setIsCartOpen(true)}
                onOpenLogin={() => setIsLoginOpen(true)}
                onOpenInformation={() => setIsCustomerInfoOpen(true)}
                onLogout={handleLogout}
              />
            </ErrorBoundary>

            {/* Main Content Area */}
            <main className="max-w-2xl mx-auto px-3 sm:px-4 py-3">
              {/* Tab 1: Catalog / Home */}
              {activeTab === 'catalog' && (
                <ErrorBoundary sectionName="كتالوج المنتجات" onReset={fetchData}>
                  <NotebookCatalog
                    products={products}
                    categories={categories}
                    settings={settings}
                    user={user}
                    orders={orders}
                    deals={deals}
                    isStoreOpen={isStoreOpen}
                    cart={cart}
                    favorites={favorites}
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                    onToggleFavorite={handleToggleFavorite}
                    onUpdateCartItem={handleUpdateCartItem}
                    onSetCartItemQty={handleSetCartItemQty}
                    onOpenCart={() => setIsCartOpen(true)}
                    onNavigateToTab={(tab) => setActiveTab(tab)}
                    onReorder={handleReorder}
                  />
                </ErrorBoundary>
              )}

              {/* Tab 2: Categories Explorer */}
              {activeTab === 'categories' && (
                <ErrorBoundary sectionName="تصفح الأقسام" onReset={fetchData}>
                  <CategoriesExploreView
                    categories={categories}
                    products={products}
                    onSelectCategory={(catName) => {
                      setSelectedCategory(catName);
                      setActiveTab('catalog');
                    }}
                  />
                </ErrorBoundary>
              )}

              {/* Tab 3: Cart (Direct Tab trigger opens bottom sheet or catalog) */}
              {activeTab === 'cart' && (
                <ErrorBoundary sectionName="سلة طلبات الجملة" onReset={() => setIsCartOpen(true)}>
                  <div className="py-8 text-center space-y-4">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-800 rounded-3xl flex items-center justify-center mx-auto">
                      <ShoppingCart className="w-8 h-8" />
                    </div>
                    <h3 className="text-base font-black text-slate-900">سلة طلبات الجملة</h3>
                    <p className="text-xs text-slate-500">
                      لديك {cart.length} أصناف في السلة بإجمالي {cart.reduce((s, i) => s + i.product.price * i.quantity, 0).toLocaleString('ar-EG')} ج.م
                    </p>
                    <button
                      onClick={() => setIsCartOpen(true)}
                      className="px-6 py-3 bg-emerald-800 hover:bg-emerald-900 text-white font-black text-xs rounded-2xl shadow-md"
                    >
                      فتح السلة ومتابعة الطلب
                    </button>
                  </div>
                </ErrorBoundary>
              )}

              {/* Tab 4: Orders & Account (Full Financial Ledger, Orders, Tracking, Statement) */}
              {(activeTab === 'orders' || activeTab === 'account') && (
                <ErrorBoundary sectionName="كشف الحساب والطلبات" onReset={fetchData}>
                  <CustomerAccount
                    user={user}
                    settings={settings}
                    orders={orders}
                    onOpenLogin={() => setIsLoginOpen(true)}
                    onLogout={handleLogout}
                    onNavigateToTab={(tab) => setActiveTab(tab)}
                    onReorder={handleReorder}
                    onPrintReceipt={(ord) => setPrintingOrder(ord)}
                  />
                </ErrorBoundary>
              )}
            </main>
          </div>

          {/* 5-Tab Mobile Bottom Navigation */}
          <ErrorBoundary sectionName="شريط التنقل السفلي">
            <BottomNavigation
              activeTab={activeTab === 'orders' ? 'orders' : activeTab === 'account' ? 'account' : activeTab}
              onSelectTab={(tab) => {
                if (tab === 'cart') {
                  setIsCartOpen(true);
                } else {
                  setActiveTab(tab);
                }
              }}
              cartCount={cart.length}
              unpaidDebt={customerUnpaidDebt}
            />
          </ErrorBoundary>
        </div>
      )}

      {/* Halim AI Customer Assistant (مساعد الحليم الذكي) */}
      {!isAdminView && (
        <ErrorBoundary sectionName="المساعد الذكي">
          <AIAssistant
            user={user}
            settings={settings}
            orders={orders}
            onNavigateToTab={(tab) => {
              if (tab === 'cart') {
                setIsCartOpen(true);
              } else {
                setActiveTab(tab);
              }
            }}
            onOpenCart={() => setIsCartOpen(true)}
            onOpenLogin={() => setIsLoginOpen(true)}
          />
        </ErrorBoundary>
      )}

      {/* Unified Bottom Sheet Cart */}
      <ErrorBoundary sectionName="سلة المشتريات" onReset={() => setIsCartOpen(false)}>
        <BottomSheetCart
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          cart={cart}
          allProducts={products}
          user={user}
          settings={settings}
          onUpdateQty={handleUpdateCartItem}
          onSetQty={handleSetCartItemQty}
          onRemoveItem={handleRemoveCartItem}
          onClearCart={handleClearCart}
          onSaveCart={(newCart) => setCart(newCart)}
          onBrowseCatalog={() => {
            setIsCartOpen(false);
            setActiveTab('catalog');
          }}
          onOpenLogin={() => setIsLoginOpen(true)}
          onSubmitSuccess={(orderData) => {
            setSubmittedOrder(orderData);
            fetchData();
          }}
        />
      </ErrorBoundary>

      {/* Order Success & 7-Stage Tracker Modal */}
      {submittedOrder && (
        <OrderSuccessModal
          order={submittedOrder}
          settings={settings}
          onClose={() => setSubmittedOrder(null)}
          onNavigateToOrders={() => {
            setSubmittedOrder(null);
            setActiveTab('orders');
          }}
          onPrintReceipt={(ord) => setPrintingOrder(ord)}
        />
      )}

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Admin Order Edit Modal (Strict Admin Only) */}
      {isAdmin && editingOrder && (
        <AdminOrderEditModal
          isOpen={!!editingOrder}
          onClose={() => setEditingOrder(null)}
          order={editingOrder}
          allProducts={products}
          onSaveSuccess={() => {
            showToast('تم حفظ تعديلات الطلب بنجاح', 'success');
            setEditingOrder(null);
            fetchData();
          }}
        />
      )}

      {/* Print Thermal Receipt (80mm & A4) Modal */}
      {printingOrder && (
        <PrintReceiptModal
          isOpen={!!printingOrder}
          onClose={() => setPrintingOrder(null)}
          order={printingOrder}
          settings={settings}
        />
      )}

      {/* Customer Information & Notification Center Modal */}
      <CustomerInformationModal
        isOpen={isCustomerInfoOpen}
        onClose={() => {
          setIsCustomerInfoOpen(false);
          fetchData();
        }}
        user={user}
        products={products}
        onAddToCart={handleUpdateCartItem}
        onOpenCart={() => {
          setIsCustomerInfoOpen(false);
          setIsCartOpen(true);
        }}
        onUnreadCountChange={(count) => setUnreadInfoCount(count)}
      />
    </div>
  );
}
