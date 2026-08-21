import React, { useState, useMemo, useEffect } from 'react';
import { Product, Category, SystemSettings, User, Order } from '../types';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Star,
  Package,
  Lock,
  X,
  AlertCircle,
  LayoutGrid,
  List,
  SlidersHorizontal,
  PhoneCall,
  Sparkles,
  Flame,
  TrendingUp,
  RotateCcw,
  Tag,
} from 'lucide-react';
import { ProductCard } from './ProductCard';

export interface CartItem {
  product: Product;
  quantity: number;
}

interface NotebookCatalogProps {
  products: Product[];
  categories: Category[];
  settings: SystemSettings | null;
  user: User | null;
  orders?: Order[];
  isStoreOpen: boolean;
  cart: CartItem[];
  favorites: string[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  onToggleFavorite: (productId: string) => void;
  onUpdateCartItem: (product: Product, delta: number) => void;
  onSetCartItemQty: (product: Product, qty: number) => void;
  onOpenCart: () => void;
  onNavigateToTab: (tab: string) => void;
  onReorder?: (order: Order) => void;
}

const CATEGORY_EMOJIS: Record<string, string> = {
  'المشروبات الغازية والمياه': '🥤',
  'الشيبسي والسناكس': '🥔',
  'البسكويت والحلويات': '🍪',
  'الأرز': '🍚',
  'السكر': '🧂',
  'الزيوت والسمنة': '🫗',
  'المكرونة': '🍝',
  'المعلبات': '🥫',
  'الصلصات': '🥫',
  'الشاي والقهوة': '☕',
  'منتجات الألبان': '🥛',
  'الحفاضات': '🧒',
  'التوابل والإضافات': '🌿',
  'العصائر': '🧃',
  'مستلزمات المطاعم والكافيهات': '🍴',
  'حلاوة البوادي السادة': '🍯',
  'المناديل': '🧻',
  'الإندومي': '🍜',
};

export const NotebookCatalog: React.FC<NotebookCatalogProps> = ({
  products,
  categories,
  settings,
  user,
  orders = [],
  isStoreOpen,
  cart,
  favorites,
  selectedCategory,
  onSelectCategory,
  onToggleFavorite,
  onUpdateCartItem,
  onSetCartItemQty,
  onOpenCart,
  onNavigateToTab,
  onReorder,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    try {
      const saved = localStorage.getItem('halim_catalog_view_mode');
      if (saved === 'grid' || saved === 'list') return saved;
      return window.innerWidth < 640 ? 'grid' : 'list';
    } catch {
      return 'list';
    }
  });

  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'offers' | 'bestsellers' | 'favorites'>('all');

  useEffect(() => {
    try {
      localStorage.setItem('halim_catalog_view_mode', viewMode);
    } catch {}
  }, [viewMode]);

  // Customer previous order items for the "Reorder" quick shelf
  const customerPastItems = useMemo(() => {
    if (!user || orders.length === 0) return [];
    const myOrders = orders.filter(
      (o) => (o.customerId === user.id || o.customerPhone === user.phone) && o.status !== 'Cancelled'
    );
    const itemIds = new Set<string>();
    myOrders.forEach((o) => {
      o.items?.forEach((i) => itemIds.add(i.productId));
    });
    return products.filter((p) => itemIds.has(p.id) && p.status !== 'hidden');
  }, [user, orders, products]);

  // Filter products based on search, category, and quick filter tab
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (p.status === 'hidden') return false;

      // Quick filter tabs
      if (activeFilterTab === 'favorites' && !favorites.includes(p.id)) {
        return false;
      }
      if (activeFilterTab === 'offers' && !p.name.includes('عرض') && p.price > 100 && (p.stock > 100 ? false : false)) {
        // Offer filter
      }

      if (selectedCategory !== 'all' && p.category !== selectedCategory) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = p.name.toLowerCase().includes(q);
        const matchCat = p.category.toLowerCase().includes(q);
        const matchBrand = p.brand ? p.brand.toLowerCase().includes(q) : false;
        const matchPackaging = p.packaging ? p.packaging.toLowerCase().includes(q) : false;
        const matchDesc = p.description ? p.description.toLowerCase().includes(q) : false;
        return matchName || matchCat || matchBrand || matchPackaging || matchDesc;
      }

      return true;
    });
  }, [products, searchQuery, selectedCategory, activeFilterTab, favorites]);

  const totalItemsCount = cart.length;
  const totalQuantity = cart.reduce((sum, i) => sum + i.quantity, 0);
  const grandTotal = cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  const getProductQty = (productId: string): number => {
    const item = cart.find((i) => i.product.id === productId);
    return item ? item.quantity : 0;
  };

  return (
    <div className="space-y-3.5 pb-28 text-right max-w-2xl mx-auto" dir="rtl">
      {/* 1. Store Hours / Status Alert */}
      {!isStoreOpen && (
        <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-2xl p-3.5 flex items-center gap-3 text-xs shadow-2xs">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <div className="font-black text-amber-900">استقبال الطلبات مغلق حالياً</div>
            <div className="text-[11px] text-amber-800 mt-0.5">
              يمكنك تجهيز دفتر أوردراتك وإرساله فور فتح المواعيد الرسمية للتوصيل.
            </div>
          </div>
        </div>
      )}

      {/* 2. Customer Welcome Greeting */}
      {user && (
        <div className="bg-gradient-to-r from-emerald-800 to-emerald-900 text-white rounded-2xl p-3.5 flex items-center justify-between shadow-xs">
          <div>
            <div className="text-xs text-emerald-200">أهلاً بك يا</div>
            <div className="text-sm font-black text-white">{user.fullName}</div>
          </div>
          {user.storeName && (
            <span className="text-[11px] bg-emerald-700/80 text-emerald-100 px-2.5 py-1 rounded-xl font-bold border border-emerald-600">
              {user.storeName}
            </span>
          )}
        </div>
      )}

      {/* 3. Sticky Search Bar & View Mode Toggle */}
      <div className="sticky top-14 z-20 bg-slate-100/95 backdrop-blur-md pt-1 pb-1">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 ابحث بالصنف أو البراند أو الحجم (بيبسي، شيبسي، أرز، زيت...)"
              className="w-full bg-white border border-slate-300 focus:border-emerald-700 rounded-2xl py-3 pr-10 pl-10 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none shadow-xs font-bold transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-3 text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Grid/List View Toggle */}
          <div className="flex items-center bg-white border border-slate-300 rounded-2xl p-1 shadow-xs shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-xl transition-colors ${
                viewMode === 'grid'
                  ? 'bg-emerald-700 text-white'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="عرض شبكي للبطاقات (Grid)"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-xl transition-colors ${
                viewMode === 'list'
                  ? 'bg-emerald-700 text-white'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="عرض قائمة جملة سريعة (List)"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Horizontal Category Scroller with Emojis */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs select-none">
        <button
          onClick={() => {
            onSelectCategory('all');
            setActiveFilterTab('all');
          }}
          className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all shrink-0 text-xs flex items-center gap-1 shadow-2xs ${
            selectedCategory === 'all' && activeFilterTab === 'all'
              ? 'bg-emerald-800 text-white'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <span>📦 الكل</span>
          <span className="text-[10px] opacity-80">
            ({products.filter((p) => p.status !== 'hidden').length})
          </span>
        </button>

        {/* Favorite Filter Chip */}
        <button
          onClick={() => {
            setActiveFilterTab(activeFilterTab === 'favorites' ? 'all' : 'favorites');
            if (activeFilterTab !== 'favorites') onSelectCategory('all');
          }}
          className={`px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-all shrink-0 text-xs flex items-center gap-1 shadow-2xs ${
            activeFilterTab === 'favorites'
              ? 'bg-amber-500 text-white'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${activeFilterTab === 'favorites' ? 'fill-white' : 'text-amber-500'}`} />
          <span>المفضلة ({favorites.length})</span>
        </button>

        {categories.map((cat) => {
          const count = products.filter(
            (p) => p.category === cat.name && p.status !== 'hidden'
          ).length;
          if (count === 0 && products.length > 0) return null;
          const emoji = CATEGORY_EMOJIS[cat.name] || '🏷️';
          const isSelected = selectedCategory === cat.name && activeFilterTab === 'all';

          return (
            <button
              key={cat.id}
              onClick={() => {
                onSelectCategory(cat.name);
                setActiveFilterTab('all');
              }}
              className={`px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-all shrink-0 text-xs flex items-center gap-1 shadow-2xs ${
                isSelected
                  ? 'bg-emerald-800 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <span>{emoji}</span>
              <span>{cat.name}</span>
              <span className="text-[10px] opacity-75">({count})</span>
            </button>
          );
        })}
      </div>

      {/* 5. Quick Reorder Shelf (if customer has past orders and search is empty) */}
      {!searchQuery && customerPastItems.length > 0 && selectedCategory === 'all' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-3.5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-900">
              <RotateCcw className="w-3.5 h-3.5 text-emerald-700" />
              <span>📦 اطلب مرة أخرى (من طلباتك السابقة)</span>
            </div>
            <button
              onClick={() => onNavigateToTab('orders')}
              className="text-[11px] font-bold text-emerald-800 hover:underline"
            >
              عرض الكل
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none">
            {customerPastItems.slice(0, 6).map((item) => {
              const qty = getProductQty(item.id);
              return (
                <div
                  key={item.id}
                  className="w-36 bg-slate-50 border border-slate-200/80 rounded-2xl p-2 shrink-0 flex flex-col justify-between text-right"
                >
                  <div>
                    <div className="text-[11px] font-black text-slate-900 line-clamp-1">
                      {item.name}
                    </div>
                    <div className="text-[10px] text-emerald-800 font-black font-mono mt-0.5">
                      {item.price.toLocaleString('ar-EG')} ج.م
                    </div>
                  </div>

                  <div className="mt-2">
                    {qty === 0 ? (
                      <button
                        onClick={() => onUpdateCartItem(item, 1)}
                        className="w-full py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[10px] font-black flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>أضف كرتونة</span>
                      </button>
                    ) : (
                      <div className="flex items-center justify-between bg-emerald-100 text-emerald-900 rounded-lg px-2 py-0.5 text-[10px] font-black">
                        <span>{qty} في السلة</span>
                        <button
                          onClick={() => onUpdateCartItem(item, 1)}
                          className="w-4 h-4 bg-emerald-700 text-white rounded-md flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. Products List or Grid */}
      {products.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center text-slate-500 shadow-xs space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-100">
            <Package className="w-7 h-7" />
          </div>
          <h3 className="font-black text-base text-slate-900">قائمة المنتجات فارغة حالياً</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            {user?.role === 'admin'
              ? 'يمكنك إضافة الأصناف والأسعار الحقيقية من لوحة الإدارة.'
              : 'جاري تحديث قائمة الأصناف والأسعار من قبل إدارة شركة الحليم للتجارة والتوزيع.'}
          </p>
          {user?.role === 'admin' && (
            <button
              onClick={() => onNavigateToTab('admin-products')}
              className="mt-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>إدارة المنتجات والأسعار (لوحة الإدارة)</span>
            </button>
          )}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center text-slate-500 space-y-2.5 shadow-xs">
          <Search className="w-8 h-8 text-slate-300 mx-auto" />
          <h4 className="font-bold text-sm text-slate-800">
            لا توجد أصناف تطابق البحث "{searchQuery}"
          </h4>
          <p className="text-xs text-slate-400">
            جرب البحث باسم صنف آخر أو تصفح بقية الأقسام.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              onSelectCategory('all');
              setActiveFilterTab('all');
            }}
            className="mt-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl"
          >
            عرض جميع المنتجات
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              quantity={getProductQty(product.id)}
              isFavorite={favorites.includes(product.id)}
              onToggleFavorite={onToggleFavorite}
              onUpdateQty={onUpdateCartItem}
              onSetQty={onSetCartItemQty}
              viewMode="grid"
            />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-slate-100 bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              quantity={getProductQty(product.id)}
              isFavorite={favorites.includes(product.id)}
              onToggleFavorite={onToggleFavorite}
              onUpdateQty={onUpdateCartItem}
              onSetQty={onSetCartItemQty}
              viewMode="list"
            />
          ))}
        </div>
      )}

      {/* 7. Sticky Bottom Cart Bar (Cartona B2B Wholesale Style) */}
      {totalItemsCount > 0 && (
        <div className="fixed bottom-16 left-3 right-3 max-w-lg mx-auto z-30 animate-slideUp">
          <button
            onClick={onOpenCart}
            className="w-full bg-emerald-800 hover:bg-emerald-900 active:scale-[0.99] text-white p-3.5 rounded-2xl shadow-2xl border border-emerald-700 flex items-center justify-between transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div className="text-right">
                <div className="text-xs text-emerald-200">
                  {totalItemsCount} أصناف • {totalQuantity} كرتونة
                </div>
                <div className="text-base font-black font-mono">
                  {grandTotal > 0 ? (
                    <>
                      {grandTotal.toLocaleString('ar-EG')}{' '}
                      <span className="text-xs font-normal">جنيه</span>
                    </>
                  ) : (
                    <span className="text-xs text-emerald-100 font-bold">تسعير خاص بالطلب 🔒</span>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs">
              <span>عرض السلة وإتمام الطلب</span>
              <span>←</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

