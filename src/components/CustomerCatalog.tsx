import React, { useState, useEffect, useMemo } from 'react';
import { Product, Category, SystemSettings, User } from '../types';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Star,
  Package,
  Sparkles,
  Lock,
  X,
  AlertCircle,
} from 'lucide-react';

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CustomerCatalogProps {
  products: Product[];
  categories: Category[];
  settings: SystemSettings | null;
  user: User | null;
  isStoreOpen: boolean;
  activeViewMode?: 'catalog' | 'favorites';
  onOpenReviewModal: (cart: CartItem[]) => void;
  onOpenLogin: () => void;
  onNavigateToTab: (tab: string) => void;
  cart: CartItem[];
  onUpdateCartItem: (product: Product, delta: number) => void;
  onSetCartItemQty: (product: Product, qty: number) => void;
}

export const CustomerCatalog: React.FC<CustomerCatalogProps> = ({
  products = [],
  categories = [],
  settings,
  user,
  isStoreOpen,
  activeViewMode = 'catalog',
  onOpenReviewModal,
  onOpenLogin,
  onNavigateToTab,
  cart = [],
  onUpdateCartItem,
  onSetCartItemQty,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('halim_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const safeProducts = Array.isArray(products) ? products : [];
  const safeFavorites = Array.isArray(favorites) ? favorites : [];

  // Toggle favorite product
  const toggleFavorite = (productId: string) => {
    setFavorites((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      const updated = safePrev.includes(productId)
        ? safePrev.filter((id) => id !== productId)
        : [...safePrev, productId];
      try {
        localStorage.setItem('halim_favorites', JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
      return updated;
    });
  };

  // Filter products based on search, category, view mode, and status
  const visibleProducts = useMemo(() => {
    return safeProducts.filter((p) => {
      // Don't show hidden products to customers
      if (p.status === 'hidden') return false;

      // Filter by favorites if in favorites mode
      if (activeViewMode === 'favorites' && !safeFavorites.includes(p.id)) {
        return false;
      }

      // Filter by category
      if (selectedCategory !== 'all' && p.category !== selectedCategory) {
        return false;
      }

      // Instant search matching
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (p.name || '').toLowerCase().includes(q);
        const matchCat = (p.category || '').toLowerCase().includes(q);
        const matchDesc = p.description ? p.description.toLowerCase().includes(q) : false;
        return matchName || matchCat || matchDesc;
      }

      return true;
    });
  }, [safeProducts, searchQuery, selectedCategory, activeViewMode, safeFavorites]);

  // Cart summary calculations
  const totalItemsCount = cart.length;
  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const grandTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  // Helper to find quantity of a product in cart
  const getProductQty = (productId: string): number => {
    const item = cart.find((i) => i.product.id === productId);
    return item ? item.quantity : 0;
  };

  return (
    <div className="space-y-3.5 pb-28 text-right" dir="rtl">
      {/* Closed store alert if applicable */}
      {!isStoreOpen && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3.5 flex items-center gap-3 text-xs">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div>
            <span className="font-bold block">استقبال الطلبات متوقف حالياً</span>
            <span className="text-[11px] text-red-600">
              يمكنك تصفح المنتجات وسنستقبل طلبك فور فتح مواعيد العمل (8:00 ص - 10:00 م).
            </span>
          </div>
        </div>
      )}

      {/* Top Search Bar */}
      <div className="sticky top-14 z-30 bg-[#F3F4F6] pt-1 pb-1">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 ابحث عن منتج بالاسم (بيبسي، مياه، أرز...)"
            className="w-full bg-white border border-gray-300 rounded-2xl py-3 pr-11 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-right shadow-xs font-medium"
          />
          <Search className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3.5 top-3.5 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Categories Horizontal Slider */}
      {activeViewMode === 'catalog' && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none text-xs -mx-1 px-1">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-xl font-bold whitespace-nowrap transition-all text-xs shrink-0 ${
              selectedCategory === 'all'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-gray-200'
            }`}
          >
            الكل ({safeProducts.filter((p) => p.status !== 'hidden').length})
          </button>

          {(categories || []).map((cat) => {
            const count = safeProducts.filter(
              (p) => p.category === cat.name && p.status !== 'hidden'
            ).length;
            if (count === 0 && safeProducts.length > 0) return null;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all text-xs shrink-0 ${
                  selectedCategory === cat.name
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-gray-200'
                }`}
              >
                {cat.name} {count > 0 && <span className="opacity-75">({count})</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Favorites Banner if on favorites view */}
      {activeViewMode === 'favorites' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 fill-amber-500 text-amber-500 shrink-0" />
            <span className="font-bold">منتجاتك المفضلة والأكثر طلباً</span>
          </div>
          <span className="text-[11px] text-amber-700">{visibleProducts.length} منتج محفوظ</span>
        </div>
      )}

      {/* Empty State when Database has 0 products */}
      {products.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center text-slate-500 shadow-xs space-y-3 my-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
            <Package className="w-8 h-8 opacity-70" />
          </div>
          <h3 className="font-bold text-base text-slate-800">قائمة المنتجات فارغة حالياً</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            تم مسح جميع المنتجات السابقة بنجاح. يمكن للإدارة الآن إضافة المنتجات والأسعار الجديدة من لوحة الإدارة.
          </p>
          {user?.role === 'admin' && (
            <button
              onClick={() => onNavigateToTab('admin-products')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة منتجات جديدة الآن</span>
            </button>
          )}
        </div>
      ) : visibleProducts.length === 0 ? (
        /* Empty search or empty favorites */
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-slate-500 shadow-xs space-y-2">
          {activeViewMode === 'favorites' ? (
            <>
              <Star className="w-10 h-10 text-amber-400 mx-auto opacity-60" />
              <h4 className="font-bold text-sm text-slate-800">لم تقم بحفظ أي منتجات في المفضلة بعد</h4>
              <p className="text-xs text-slate-400">
                اضغط على زر النجمة ⭐ بجانب أي منتج في قائمة الطلب لإضافته هنا لسرعة تكرار الطلب.
              </p>
              <button
                onClick={() => onNavigateToTab('catalog')}
                className="mt-2 px-4 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg"
              >
                تصفح المنتجات
              </button>
            </>
          ) : (
            <>
              <Search className="w-8 h-8 text-slate-300 mx-auto" />
              <h4 className="font-bold text-sm text-slate-800">لا توجد نتائج تطابق بحثك</h4>
              <p className="text-xs text-slate-400">تأكد من كتابة الاسم بشكل صحيح أو تصفح كل الأقسام.</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="mt-2 px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-gray-200"
              >
                إلغاء الفلتر وعرض الكل
              </button>
            </>
          )}
        </div>
      ) : (
        /* Products Fast Grid (Mobile-First 1 Column on small, 2 col on tablet, 3 col on desktop) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {visibleProducts.map((product) => {
            const qtyInCart = getProductQty(product.id);
            const isFav = favorites.includes(product.id);
            const isLocked = product.status === 'locked' || !isStoreOpen;

            return (
              <div
                key={product.id}
                className={`bg-white border rounded-2xl p-3.5 transition-all shadow-xs flex flex-col justify-between relative ${
                  qtyInCart > 0
                    ? 'border-emerald-500 ring-2 ring-emerald-500/10'
                    : 'border-gray-200 hover:border-gray-300'
                } ${isLocked ? 'opacity-70 bg-slate-50/80' : ''}`}
              >
                {/* Top Row: Name, Favorite Star, Locked Badge */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 text-sm leading-snug">
                        {product.name}
                      </h3>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {product.category}
                        {product.description && ` • ${product.description}`}
                      </div>
                    </div>

                    {/* Star Favorite Button */}
                    <button
                      onClick={() => toggleFavorite(product.id)}
                      className="p-1.5 text-slate-300 hover:text-amber-500 transition-colors"
                      title={isFav ? 'إزالة من منتجاتي' : 'إضافة إلى منتجاتي المفضلة'}
                    >
                      <Star
                        className={`w-5 h-5 ${
                          isFav ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Price & Unit Line */}
                  <div className="mt-2.5 flex items-baseline justify-between">
                    <div>
                      <span className="text-base font-black text-emerald-700 font-mono">
                        {(product.price || 0).toLocaleString('ar-EG')}
                      </span>
                      <span className="text-xs text-slate-700 font-medium mr-1">جنيه</span>
                      <span className="text-[11px] text-slate-400 block font-normal">
                        الوحدة: {product.unit}
                      </span>
                    </div>

                    {product.minQty > 1 && (
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                        أقل كمية: {product.minQty}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Action: Stepper or Locked Notice */}
                <div className="mt-3.5 pt-2.5 border-t border-gray-100">
                  {isLocked ? (
                    <div className="py-2 bg-red-50 text-red-700 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1">
                      <Lock className="w-3.5 h-3.5" />
                      <span>غير متاح مؤقتاً (مقفل)</span>
                    </div>
                  ) : qtyInCart === 0 ? (
                    /* Initial Add Button (Thumb-Friendly, Min 44px Height) */
                    <button
                      onClick={() => onUpdateCartItem(product, product.minQty || 1)}
                      className="w-full h-11 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                    >
                      <Plus className="w-4 h-4" />
                      <span>إضافة للطلب</span>
                    </button>
                  ) : (
                    /* Direct Instant Stepper [-] Qty [+] */
                    <div className="flex items-center justify-between bg-emerald-50/80 border border-emerald-300 rounded-xl p-1 h-11">
                      <button
                        onClick={() => onUpdateCartItem(product, -1)}
                        className="w-10 h-9 bg-white text-emerald-800 rounded-lg font-black text-base flex items-center justify-center hover:bg-red-50 hover:text-red-600 shadow-2xs transition-colors active:scale-95 shrink-0"
                        title="إنقاص الكمية"
                      >
                        <Minus className="w-4 h-4" />
                      </button>

                      <div className="text-center flex-1 px-2">
                        <div className="font-black text-emerald-900 text-sm font-mono">
                          {qtyInCart} <span className="text-[11px] font-bold">{product.unit}</span>
                        </div>
                        <div className="text-[10px] text-emerald-700 font-bold font-mono">
                          = {(qtyInCart * (product.price || 0)).toLocaleString('ar-EG')} ج.م
                        </div>
                      </div>

                      <button
                        onClick={() => onUpdateCartItem(product, 1)}
                        className="w-10 h-9 bg-emerald-600 text-white rounded-lg font-black text-base flex items-center justify-center hover:bg-emerald-700 shadow-2xs transition-colors active:scale-95 shrink-0"
                        title="زيادة الكمية"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky Bottom Cart Bar (Prominent & Always Visible when Cart > 0) */}
      {totalItemsCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-2xl z-40 max-w-lg mx-auto sm:max-w-xl md:max-w-2xl lg:max-w-4xl sm:rounded-t-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium">
                  {totalItemsCount} أصناف ({totalQuantity} قطعة)
                </div>
                <div className="text-base sm:text-lg font-black text-slate-900 font-mono">
                  {(grandTotal || 0).toLocaleString('ar-EG')}{' '}
                  <span className="text-xs font-bold text-emerald-700">جنيه</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onOpenReviewModal(cart)}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <span>عرض السلة ومتابعة الطلب</span>
              <span>←</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
