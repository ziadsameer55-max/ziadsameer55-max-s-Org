import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  User,
  Product,
  Category,
  Order,
  SystemSettings,
  OrderStatus,
} from './types';
import { Header } from './components/Header';
import { NotebookCatalog, CartItem } from './components/NotebookCatalog';
import { CategoriesExploreView } from './components/CategoriesExploreView';
import { BottomSheetCart } from './components/BottomSheetCart';
import { OrderSuccessModal } from './components/OrderSuccessModal';
import { CustomerAccount } from './components/CustomerAccount';
import { BottomNavigation } from './components/BottomNavigation';
import { AdminSidebar } from './components/AdminSidebar';
import { AdminFastOrders } from './components/AdminFastOrders';
import { AdminDebtsManager } from './components/AdminDebtsManager';
import { AdminProductsManager } from './components/AdminProductsManager';
import { AdminSettings } from './components/AdminSettings';
import { AdminOrderEditModal } from './components/AdminOrderEditModal';
import { PrintReceiptModal } from './components/PrintReceiptModal';
import { LoginModal } from './components/LoginModal';
import { AIAssistant } from './components/AIAssistant';
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

export default function App() {
  // Default logged in user (Default to Supermarket Customer)
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('halim_user');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      id: 'usr-cust-1',
      username: '01011112222',
      fullName: 'الحاج أحمد فوزي',
      phone: '01011112222',
      role: 'customer',
      storeName: 'سوبر ماركت الأمل',
      address: 'الإسكندرية - بجوار مسجد القويري بوابة 8',
    };
  });

  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<string>('catalog');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isMobileAdminSidebarOpen, setIsMobileAdminSidebarOpen] = useState(false);

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
  const [submittedOrder, setSubmittedOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);

  // Toast alert
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

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
    setActiveTab('catalog');
    showToast('تم تسجيل الخروج بنجاح');
    fetchData();
  };

  // Login Handler
  const handleLoginSuccess = (u: User) => {
    try {
      localStorage.setItem('halim_user', JSON.stringify(u));
    } catch {}
    setUser(u);
    showToast(`مرحباً بك، ${u.fullName}`);
    if (u.role === 'admin') {
      setActiveTab('admin-orders');
    } else {
      setActiveTab('catalog');
    }
    fetchData();
  };

  const handleUpdateCartItem = (product: Product, delta: number) => {
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
        setCategories(cData);
      }

      // 3. Products
      const pRole = user?.role || 'customer';
      const prodRes = await apiFetch(`/api/products?role=${pRole}`);
      if (prodRes.ok) {
        const pData = await prodRes.json();
        setProducts(pData);
      }

      // 4. Orders
      const orderUrl =
        user?.role === 'customer' ? `/api/orders?customerId=${user.id}` : '/api/orders';
      const orderRes = await apiFetch(orderUrl);
      if (orderRes.ok) {
        const oData = await orderRes.json();
        setOrders(oData);
      }
    } catch (err) {
      console.error('Failed to load initial data from server:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchData();

    // Check if admin login requested via URL parameter or hash
    const params = new URLSearchParams(window.location.search);
    if (params.get('login') || params.get('admin') || window.location.hash.includes('admin') || window.location.hash.includes('login')) {
      setIsLoginOpen(true);
    }
  }, [fetchData]);

  // Compute store status
  const isStoreOpen = useMemo(() => {
    if (!settings) return true;
    if (settings.isManualOverrideActive) {
      return settings.manualOrdersOpen;
    }

    if (!settings.scheduleEnabled || !settings.weeklySchedule) return true;

    const dayNames: Record<number, string> = {
      0: 'fri',
      1: 'sat',
      2: 'sun',
      3: 'mon',
      4: 'tue',
      5: 'wed',
      6: 'thu',
    };
    const currentDayKey = dayNames[new Date().getDay()];
    const dayConfig = settings.weeklySchedule.find((d) => d.dayKey === currentDayKey);

    if (!dayConfig || !dayConfig.isOpen) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [oH, oM] = dayConfig.openTime.split(':').map(Number);
    const [cH, cM] = dayConfig.closeTime.split(':').map(Number);

    const openMinutes = oH * 60 + oM;
    const closeMinutes = cH * 60 + cM;

    return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
  }, [settings]);

  // Compute customer outstanding debt
  const customerUnpaidDebt = useMemo(() => {
    if (!user) return 0;
    const myOrders = orders.filter(
      (o) => (o.customerId === user.id || o.customerPhone === user.phone) && o.status !== 'Cancelled'
    );
    const totalInvoiced = myOrders.reduce((s, o) => s + o.grandTotal, 0);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (res.ok) {
        setSettings(newSettings);
        showToast('تم حفظ الإعدادات بنجاح');
      }
    } catch (err) {
      showToast('فشل حفظ الإعدادات', 'error');
    }
  };

  const handleReorder = (ord: Order) => {
    const reorderItems: CartItem[] = (ord.items || []).map((item) => {
      const matched = products.find((p) => p.id === item.productId);
      if (matched) {
        return { product: matched, quantity: item.quantity };
      }
      return {
        product: {
          id: item.productId,
          name: item.productName,
          category: 'عام',
          price: item.unitPrice,
          unit: item.unit || 'كرتونة',
          image: '',
          status: 'open',
          minQty: 1,
          maxQty: null,
          stock: 100,
        },
        quantity: item.quantity,
      };
    });

    if (reorderItems.length > 0) {
      setCart(reorderItems);
      setIsCartOpen(true);
      showToast('تم نسخ أصناف الطلب السابق إلى السلة بنجاح', 'success');
    }
  };

  const isAdminView = activeTab.startsWith('admin');

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
          <AdminSidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            user={user}
            settings={settings}
            orders={orders}
            products={products}
            onToggleOrdersOpen={handleToggleOrdersOpen}
            onLogout={handleLogout}
            isOpenMobile={isMobileAdminSidebarOpen}
            onCloseMobile={() => setIsMobileAdminSidebarOpen(false)}
          />

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
                      {activeTab === 'admin-debts' && '💰 إدارة التحصيل والمديونيات'}
                      {activeTab === 'admin-products' && '📦 إدارة المنتجات والتسعير'}
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

              {activeTab === 'admin-debts' && (
                <AdminDebtsManager
                  onOpenOrderDetails={(orderId) => {
                    const ord = orders.find((o) => o.id === orderId);
                    if (ord) setEditingOrder(ord);
                  }}
                  onRefreshData={fetchData}
                />
              )}

              {activeTab === 'admin-products' && (
                <AdminProductsManager
                  products={products}
                  categories={categories}
                  onRefreshData={fetchData}
                />
              )}

              {activeTab === 'admin-settings' && (
                <AdminSettings settings={settings} onSaveSettings={handleSaveSettings} />
              )}
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
            <Header
              user={user}
              settings={settings}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              cartCount={cart.length}
              unpaidDebt={customerUnpaidDebt}
              onOpenCart={() => setIsCartOpen(true)}
              onOpenLogin={() => setIsLoginOpen(true)}
            />

            {/* Main Content Area */}
            <main className="max-w-2xl mx-auto px-3 sm:px-4 py-3">
              {/* Tab 1: Catalog / Home */}
              {activeTab === 'catalog' && (
                <NotebookCatalog
                  products={products}
                  categories={categories}
                  settings={settings}
                  user={user}
                  orders={orders}
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
              )}

              {/* Tab 2: Categories Explorer */}
              {activeTab === 'categories' && (
                <CategoriesExploreView
                  categories={categories}
                  products={products}
                  onSelectCategory={(catName) => {
                    setSelectedCategory(catName);
                    setActiveTab('catalog');
                  }}
                />
              )}

              {/* Tab 3: Cart (Direct Tab trigger opens bottom sheet or catalog) */}
              {activeTab === 'cart' && (
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
              )}

              {/* Tab 4: Orders & Account (Full Financial Ledger, Orders, Tracking, Statement) */}
              {(activeTab === 'orders' || activeTab === 'account') && (
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
              )}
            </main>
          </div>

          {/* 5-Tab Mobile Bottom Navigation */}
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
        </div>
      )}

      {/* Halim AI Customer Assistant (مساعد الحليم الذكي) */}
      {!isAdminView && (
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
      )}

      {/* Unified Bottom Sheet Cart */}
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

      {/* Admin Order Edit Modal */}
      {editingOrder && (
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
    </div>
  );
}
