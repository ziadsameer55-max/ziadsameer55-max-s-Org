import React, { useState, useMemo } from 'react';
import { DealOffer, Product, SystemSettings } from '../types';
import {
  Flame,
  Search,
  Filter,
  ArrowUpDown,
  Tag,
  Plus,
  Minus,
  Check,
  X,
  Lock,
  Gift,
  Star,
  Package,
  Award,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { DealCountdown } from './DealsCarousel';

interface AllDealsViewProps {
  deals: DealOffer[];
  products: Product[];
  settings: SystemSettings | null;
  cartItems: Array<{ product: Product; quantity: number }>;
  onUpdateCartItem: (product: Product, delta: number) => void;
  onSetCartItemQty: (product: Product, quantity: number) => void;
  onBack: () => void;
}

export const AllDealsView: React.FC<AllDealsViewProps> = ({
  deals,
  products,
  settings,
  cartItems,
  onUpdateCartItem,
  onSetCartItemQty,
  onBack,
}) => {
  const isPricesHidden = Boolean(settings?.hidePrices);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOfferType, setSelectedOfferType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'discount' | 'price_asc' | 'price_desc' | 'newest'>('discount');

  // Active Deals
  const activeDeals = useMemo(() => {
    return deals.filter((d) => d.isActive && !d.isExpired);
  }, [deals]);

  // Categories present in deals
  const categories = useMemo(() => {
    const cats = new Set<string>();
    activeDeals.forEach((d) => {
      if (d.category) cats.add(d.category);
    });
    return Array.from(cats);
  }, [activeDeals]);

  // Filtered & Sorted Deals
  const filteredDeals = useMemo(() => {
    return activeDeals
      .filter((deal) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const nameMatch = deal.productName.toLowerCase().includes(q);
          const brandMatch = deal.productBrand?.toLowerCase().includes(q);
          const catMatch = deal.category?.toLowerCase().includes(q);
          const badgeMatch = deal.badgeText?.toLowerCase().includes(q);
          if (!nameMatch && !brandMatch && !catMatch && !badgeMatch) return false;
        }

        // Offer type
        if (selectedOfferType !== 'all' && deal.offerType !== selectedOfferType) {
          return false;
        }

        // Category
        if (selectedCategory !== 'all' && deal.category !== selectedCategory) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'discount') {
          return (b.discountPercentage || 0) - (a.discountPercentage || 0);
        }
        if (sortBy === 'price_asc') {
          return a.offerPrice - b.offerPrice;
        }
        if (sortBy === 'price_desc') {
          return b.offerPrice - a.offerPrice;
        }
        if (sortBy === 'newest') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return 0;
      });
  }, [activeDeals, searchQuery, selectedOfferType, selectedCategory, sortBy]);

  const offerTypeFilters = [
    { key: 'all', label: 'كل العروض', icon: Flame },
    { key: 'discount', label: 'خصومات خاصة', icon: Tag },
    { key: 'special_price', label: 'أسعار مميزة', icon: Gift },
    { key: 'new_product', label: 'منتجات جديدة', icon: Star },
    { key: 'carton_deal', label: 'سعر كرتونة', icon: Package },
    { key: 'bestseller', label: 'الأكثر طلبًا', icon: Award },
    { key: 'limited_time', label: 'لفترة محدودة', icon: Clock },
  ];

  return (
    <div className="space-y-6 pb-20 animate-fade-in text-right">
      {/* Top Bar Header */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <button
                onClick={onBack}
                className="bg-white/20 hover:bg-white/30 p-2 rounded-2xl transition-colors shrink-0"
                title="الرجوع للكتالوج"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-300 animate-ping" />
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                  🔥 صالة العروض والفرص الحصرية
                </h1>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-amber-100/90 max-w-xl pr-9">
              عروض الجملة والخصومات المحدثة يومياً لتجار المحلات والسوبر ماركت من شركة الحليم للتجارة والتوزيع.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-3 text-center shrink-0">
            <span className="text-2xl font-black font-mono block">
              {activeDeals.length}
            </span>
            <span className="text-[11px] text-amber-100 font-medium block">
              عرض متاح حالياً
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm space-y-3.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث في العروض (اسم الصنف، الماركة، نوع العرض)..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              aria-label="ترتيب العروض حسب"
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            >
              <option value="discount">الأعلى خصماً 💥</option>
              <option value="price_asc">الأقل سعراً ⬇️</option>
              <option value="price_desc">الأعلى سعراً ⬆️</option>
              <option value="newest">الأحدث نزولاً ✨</option>
            </select>
          </div>
        </div>

        {/* Offer Type Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {offerTypeFilters.map((flt) => {
            const Icon = flt.icon;
            const isSelected = selectedOfferType === flt.key;
            return (
              <button
                key={flt.key}
                onClick={() => setSelectedOfferType(flt.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{flt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Category Filters */}
        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-slate-100 scrollbar-thin">
            <span className="text-[11px] font-bold text-slate-400 shrink-0 ml-1">
              القسم:
            </span>
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-emerald-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              جميع الأقسام
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-emerald-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Deals Grid */}
      {filteredDeals.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <Flame className="w-8 h-8" />
          </div>
          <h3 className="text-base font-black text-slate-900">
            لا توجد عروض مطابقة للبحث
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            جرب تغيير كلمات البحث أو تصفية الأقسام لعرض باقي الفرص المتاحة.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedOfferType('all');
              setSelectedCategory('all');
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-black px-4 py-2 rounded-xl transition-colors"
          >
            إعادة تعيين الفلاتر
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredDeals.map((deal) => {
            const matchedProduct = products.find((p) => p.id === deal.productId) || {
              id: deal.productId,
              name: deal.productName,
              category: deal.category || 'عام',
              price: isPricesHidden ? 0 : deal.offerPrice,
              unit: deal.productUnit || 'كرتونة',
              image: deal.productImage || 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=500',
              status: 'open' as const,
              minQty: 1,
              maxQty: null,
              stock: 100,
            };

            const cartItem = cartItems.find((ci) => ci.product.id === matchedProduct.id);
            const currentQty = cartItem ? cartItem.quantity : 0;

            return (
              <div
                key={deal.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
              >
                {/* Top Badge */}
                <div className="flex items-center justify-between gap-1 mb-2.5">
                  <span className="inline-flex items-center gap-1 bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-lg shadow-xs">
                    <Flame className="w-3 h-3" />
                    <span>{deal.badgeText || '🔥 عرض خاص'}</span>
                  </span>

                  {!isPricesHidden && deal.discountPercentage && deal.discountPercentage > 0 && (
                    <span className="bg-rose-50 text-rose-700 border border-rose-200 text-xs font-black font-mono px-2 py-0.5 rounded-md">
                      -{deal.discountPercentage}%
                    </span>
                  )}
                </div>

                {/* Product Image */}
                <div className="relative aspect-4/3 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden mb-3 flex items-center justify-center p-3">
                  <img
                    src={deal.productImage || matchedProduct.image}
                    alt={deal.productName}
                    referrerPolicy="no-referrer"
                    className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  {matchedProduct.stock <= (matchedProduct.lowStockThreshold || 5) && matchedProduct.stock > 0 && (
                    <div className="absolute bottom-1.5 right-1.5 bg-amber-500 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded-md">
                      متبقي {matchedProduct.stock} فقط
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="space-y-1 text-right flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-medium block">
                      {deal.productBrand || deal.category || matchedProduct.category}
                      {deal.productSize ? ` • ${deal.productSize}` : ''}
                    </span>
                    <h3 className="font-black text-sm text-slate-900 line-clamp-2 leading-snug">
                      {deal.productName}
                    </h3>
                    {deal.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                        {deal.description}
                      </p>
                    )}
                  </div>

                  {deal.endDate && (
                    <div className="mt-2">
                      <DealCountdown endDate={deal.endDate} />
                    </div>
                  )}

                  {/* Pricing */}
                  <div className="pt-2.5 border-t border-slate-100 mt-2.5">
                    {isPricesHidden ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-2 text-center text-amber-900 text-xs font-black flex items-center justify-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-amber-700" />
                        <span>عرض خاص - احصل على سعر مميز</span>
                      </div>
                    ) : (
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-[11px] text-slate-400 font-medium">
                            سعر العرض:
                          </span>
                          <div className="flex items-baseline gap-1 font-mono">
                            <span className="text-lg font-black text-emerald-800">
                              {deal.offerPrice.toLocaleString('ar-EG')}
                            </span>
                            <span className="text-[10px] text-slate-500 font-bold">
                              ج.م / {deal.productUnit || matchedProduct.unit}
                            </span>
                          </div>
                        </div>

                        {deal.originalPrice > deal.offerPrice && (
                          <div className="text-left font-mono">
                            <span className="text-[11px] text-slate-400 line-through block">
                              {deal.originalPrice.toLocaleString('ar-EG')} ج.م
                            </span>
                            <span className="text-[10px] text-emerald-600 font-bold block">
                              وفّر {(deal.originalPrice - deal.offerPrice).toLocaleString('ar-EG')} ج
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Add to Cart Controls */}
                    <div className="mt-3">
                      {currentQty === 0 ? (
                        <button
                          onClick={() => onUpdateCartItem(matchedProduct, 1)}
                          className="w-full py-2.5 px-3 bg-emerald-800 hover:bg-emerald-900 active:scale-[0.98] text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all"
                        >
                          <Plus className="w-4 h-4" />
                          <span>أضف للسلة بالعرض</span>
                        </button>
                      ) : (
                        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-300 rounded-xl p-1">
                          <button
                            onClick={() => onUpdateCartItem(matchedProduct, -1)}
                            className="w-8 h-8 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg flex items-center justify-center font-black transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>

                          <div className="text-center">
                            <span className="font-mono font-black text-sm text-emerald-950 block">
                              {currentQty}
                            </span>
                            <span className="text-[9px] text-emerald-700 font-bold block">
                              {deal.productUnit || matchedProduct.unit} في السلة
                            </span>
                          </div>

                          <button
                            onClick={() => onUpdateCartItem(matchedProduct, 1)}
                            className="w-8 h-8 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg flex items-center justify-center font-black transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
