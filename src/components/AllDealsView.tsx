import React, { useState, useMemo } from 'react';
import { DealOffer, Product, SystemSettings } from '../types';
import {
  Flame,
  Search,
  Filter,
  ArrowUpDown,
  Tag,
  Gift,
  Star,
  Package,
  Award,
  Clock,
  ChevronRight,
  Sparkles,
  Percent,
  TrendingDown,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
import { PremiumDealCard } from './DealsCarousel';

interface AllDealsViewProps {
  deals: DealOffer[];
  products: Product[];
  settings: SystemSettings | null;
  cartItems: Array<{ product: Product; quantity: number }>;
  onUpdateCartItem: (product: Product, delta: number) => void;
  onSetCartItemQty: (product: Product, quantity: number) => void;
  onBack: () => void;
  isStoreOpen?: boolean;
}

export const AllDealsView: React.FC<AllDealsViewProps> = ({
  deals = [],
  products = [],
  settings,
  cartItems = [],
  onUpdateCartItem,
  onSetCartItemQty,
  onBack,
  isStoreOpen = true,
}) => {
  const isPricesHidden = Boolean(settings?.hidePrices);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOfferType, setSelectedOfferType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'discount' | 'price_asc' | 'price_desc' | 'newest'>('discount');

  const safeDeals = Array.isArray(deals) ? deals : [];

  // Active Deals
  const activeDeals = useMemo(() => {
    return safeDeals.filter((d) => d.isActive && !d.isExpired);
  }, [safeDeals]);

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
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        }
        return 0;
      });
  }, [activeDeals, searchQuery, selectedOfferType, selectedCategory, sortBy]);

  const offerTypeFilters = [
    { key: 'all', label: 'جميع العروض', icon: Sparkles },
    { key: 'discount', label: 'تخفيضات ونسب خصم', icon: Percent },
    { key: 'special_price', label: 'أسعار جملة خاصة', icon: Gift },
    { key: 'carton_deal', label: 'عروض كراتين', icon: Package },
    { key: 'limited_time', label: 'عروض محدودة الوقت', icon: Clock },
    { key: 'new_product', label: 'أصناف جديدة', icon: Star },
  ];

  return (
    <div className="space-y-4 pb-20 animate-fadeIn" dir="rtl">
      {/* Top Header */}
      <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-slate-950 border border-emerald-800/60 rounded-3xl p-5 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-40 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer shrink-0 border border-white/10"
              title="العودة للكتالوج الرئيسي"
            >
              <ArrowRight className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                  صفحة التخفيضات الكبرى
                </span>
                <span className="text-xs text-emerald-200 font-mono font-bold">
                  ({filteredDeals.length} من {activeDeals.length} عرض)
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2 mt-1">
                <Flame className="w-6 h-6 text-amber-400" />
                <span>كافة عروض وخصومات الجملة</span>
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث في العروض بالاسم، الماركة أو الصنف..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-700 focus:bg-white rounded-2xl px-3.5 py-2.5 pr-10 text-xs text-slate-900 font-bold focus:outline-none transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <div className="relative shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-700 appearance-none pl-8 pr-3 cursor-pointer"
              >
                <option value="discount">الأعلى توفيراً وخصماً</option>
                <option value="price_asc">الأقل سعراً أولاً</option>
                <option value="price_desc">الأعلى سعراً أولاً</option>
                <option value="newest">أحدث العروض المضافة</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Offer Types Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {offerTypeFilters.map((flt) => {
            const Icon = flt.icon;
            const isSelected = selectedOfferType === flt.key;
            return (
              <button
                key={flt.key}
                onClick={() => setSelectedOfferType(flt.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-800 text-white shadow-sm'
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
          <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100 scrollbar-thin">
            <span className="text-[11px] font-bold text-slate-400 shrink-0 ml-1">
              القسم:
            </span>
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              جميع الأقسام
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid of Deals */}
      {filteredDeals.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <Flame className="w-7 h-7" />
          </div>
          <h3 className="text-base font-black text-slate-900">
            لا توجد عروض مطابقة لمعايير البحث
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            يمكنك تغيير كلمات البحث أو إعادة تعيين الفلاتر لعرض كافة العروض المتاحة.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedOfferType('all');
              setSelectedCategory('all');
            }}
            className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-black px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-sm"
          >
            إعادة تعيين الفلاتر
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filteredDeals.map((deal) => {
            const matchedProduct = products.find((p) => p.id === deal.productId) || {
              id: deal.productId,
              name: deal.productName,
              category: deal.category || 'عام',
              price: isPricesHidden ? 0 : deal.offerPrice,
              unit: deal.productUnit || 'كرتونة',
              image: deal.productImage || 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=500',
              status: 'open' as const,
              minQty: deal.minOrderQty || 1,
              maxQty: null,
              stock: 100,
            };

            const effectiveProduct: Product = {
              ...matchedProduct,
              price: isPricesHidden ? 0 : deal.offerPrice,
              name: deal.productName || matchedProduct.name,
              image: deal.productImage || matchedProduct.image,
              unit: deal.productUnit || matchedProduct.unit,
              minQty: deal.minOrderQty || matchedProduct.minQty || 1,
            };

            const cartItem = cartItems.find((ci) => ci.product.id === effectiveProduct.id);
            const currentQty = cartItem ? cartItem.quantity : 0;

            return (
              <div key={deal.id} className="flex justify-center">
                <div className="w-full max-w-[320px]">
                  <PremiumDealCard
                    deal={deal}
                    product={effectiveProduct}
                    quantity={currentQty}
                    isPricesHidden={isPricesHidden}
                    onUpdateQty={onUpdateCartItem}
                    onSetQty={onSetCartItemQty}
                    isStoreOpen={isStoreOpen}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
