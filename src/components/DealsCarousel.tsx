import React, { useState, useEffect, useRef } from 'react';
import { DealOffer, Product, SystemSettings } from '../types';
import {
  Flame,
  Clock,
  Tag,
  Plus,
  Minus,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Gift,
  Star,
  Package,
  Award,
  Lock,
  ShoppingCart,
  Percent,
  TrendingDown,
  Layers,
  ArrowLeft,
  Store,
} from 'lucide-react';

interface DealsCarouselProps {
  deals: DealOffer[];
  products: Product[];
  settings: SystemSettings | null;
  cartItems: Array<{ product: Product; quantity: number }>;
  onUpdateCartItem: (product: Product, delta: number) => void;
  onSetCartItemQty: (product: Product, quantity: number) => void;
  onViewAllDeals?: () => void;
  isStoreOpen?: boolean;
}

export const DealsCarousel: React.FC<DealsCarouselProps> = ({
  deals = [],
  products = [],
  settings,
  cartItems = [],
  onUpdateCartItem,
  onSetCartItemQty,
  onViewAllDeals,
  isStoreOpen = true,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isPricesHidden = Boolean(settings?.hidePrices);

  const safeDeals = Array.isArray(deals) ? deals : [];
  const activeDeals = safeDeals.filter((d) => d.isActive && !d.isExpired);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 320;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  // Empty state when there are no active deals
  if (activeDeals.length === 0) {
    return (
      <section className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 border border-emerald-800/40 rounded-3xl p-6 sm:p-8 text-center text-white shadow-lg relative overflow-hidden my-4" dir="rtl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 max-w-md mx-auto space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-emerald-600 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-emerald-900/50">
            <Sparkles className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-400 bg-amber-950/80 border border-amber-800/80 px-3 py-1 rounded-full shadow-inner">
              <Tag className="w-3 h-3" />
              <span>عروض الجملة الدورية</span>
            </span>
            <h3 className="text-lg font-black text-white pt-1">
              ترقبوا باقة العروض والخصومات القادمة
            </h3>
            <p className="text-xs text-slate-300 font-medium leading-relaxed">
              يقوم فريق شركة الحليم بتحديث الخصومات والأسعار الخاصة للتجار دورياً. يمكنك طلب كافة المنتجات والكراتين بأسعار الجملة المباشرة من الكتالوج أدناه.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 my-2" dir="rtl">
      {/* Section Header */}
      <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-slate-950 border border-emerald-800/50 rounded-3xl p-4 sm:p-5 text-white shadow-xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -top-12 left-1/3 w-64 h-32 bg-amber-400/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 right-10 w-48 h-28 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-emerald-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0 font-black">
              <Flame className="w-6 h-6 text-slate-950 animate-pulse" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-1.5">
                  <span>عروض وفرص الجملة</span>
                  <span className="text-amber-400 font-mono text-sm font-bold">({activeDeals.length})</span>
                </h2>
                <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-black px-2.5 py-0.5 rounded-full backdrop-blur-xs flex items-center gap-1">
                  <Percent className="w-2.5 h-2.5" />
                  <span>خصومات حصرية للتجار</span>
                </span>
              </div>
              <p className="text-xs text-emerald-100/80 font-medium mt-0.5">
                أسعار مخفضة وتوفير فوري على الكراتين والطلبيات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Scroll buttons for desktop/tablet */}
            <div className="hidden sm:flex items-center gap-1 bg-white/10 backdrop-blur-xs p-1 rounded-2xl border border-white/15">
              <button
                type="button"
                onClick={() => handleScroll('right')}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                title="السابق"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleScroll('left')}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                title="التالي"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {onViewAllDeals && (
              <button
                type="button"
                onClick={onViewAllDeals}
                className="text-xs font-black text-emerald-950 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 px-3.5 py-2 rounded-2xl transition-all flex items-center gap-1.5 shadow-md shadow-amber-950/20 active:scale-95 cursor-pointer"
              >
                <span>عرض الكل</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cards Carousel Track */}
      <div
        ref={scrollContainerRef}
        className="flex items-stretch gap-3.5 sm:gap-4 overflow-x-auto pb-3 pt-1 px-1 scrollbar-thin scrollbar-thumb-emerald-800 scrollbar-track-slate-100 snap-x snap-mandatory"
      >
        {activeDeals.map((deal) => {
          // Resolve matching product or build fallback representation
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
            <div key={deal.id} className="snap-start shrink-0">
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
          );
        })}
      </div>
    </section>
  );
};

interface PremiumDealCardProps {
  deal: DealOffer;
  product: Product;
  quantity: number;
  isPricesHidden: boolean;
  onUpdateQty: (product: Product, delta: number) => void;
  onSetQty: (product: Product, qty: number) => void;
  isStoreOpen?: boolean;
}

export const PremiumDealCard: React.FC<PremiumDealCardProps> = ({
  deal,
  product,
  quantity,
  isPricesHidden,
  onUpdateQty,
  onSetQty,
  isStoreOpen = true,
}) => {
  // Calculated savings
  const originalPrice = deal.originalPrice || product.price || 0;
  const offerPrice = deal.offerPrice;
  const hasDiscount = originalPrice > offerPrice && !isPricesHidden;
  const savingsAmount = hasDiscount ? originalPrice - offerPrice : 0;
  const discountPercent = deal.discountPercentage || (hasDiscount ? Math.round((savingsAmount / originalPrice) * 100) : 0);

  // Badge metadata
  const getOfferBadge = () => {
    switch (deal.offerType) {
      case 'discount':
        return {
          label: deal.badgeText || 'خصم خاص',
          icon: Percent,
          bg: 'bg-rose-600 text-white border-rose-700',
        };
      case 'special_price':
        return {
          label: deal.badgeText || 'سعر خاص',
          icon: Gift,
          bg: 'bg-amber-500 text-slate-950 font-black border-amber-600',
        };
      case 'carton_deal':
        return {
          label: deal.badgeText || 'عرض كرتونة',
          icon: Package,
          bg: 'bg-indigo-700 text-white border-indigo-800',
        };
      case 'new_product':
        return {
          label: deal.badgeText || 'صنف جديد',
          icon: Star,
          bg: 'bg-emerald-700 text-white border-emerald-800',
        };
      case 'limited_time':
      default:
        return {
          label: deal.badgeText || 'لفترة محدودة',
          icon: Clock,
          bg: 'bg-orange-600 text-white border-orange-700',
        };
    }
  };

  const badge = getOfferBadge();
  const BadgeIcon = badge.icon;

  return (
    <div className="w-[280px] sm:w-[300px] h-full bg-white border-2 border-slate-200 hover:border-emerald-700 rounded-3xl p-4 flex flex-col justify-between shadow-sm hover:shadow-xl transition-all duration-300 group relative overflow-hidden select-none">
      {/* Top Header Tags */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-xl shadow-xs border ${badge.bg}`}
        >
          <BadgeIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate max-w-[130px]">{badge.label}</span>
        </span>

        {discountPercent > 0 && !isPricesHidden && (
          <span className="inline-flex items-center gap-1 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs px-2.5 py-1 rounded-xl border border-amber-400/80 shadow-xs font-mono">
            <TrendingDown className="w-3 h-3 text-slate-950" />
            <span>-{discountPercent}%</span>
          </span>
        )}
      </div>

      {/* Product Image Frame */}
      <div className="relative w-full h-44 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100/70 border border-slate-200/80 p-3 flex items-center justify-center overflow-hidden mb-3.5 group-hover:bg-slate-50 transition-colors">
        <img
          src={deal.productImage || product.image}
          alt={deal.productName}
          referrerPolicy="no-referrer"
          className="max-h-full max-w-full object-contain group-hover:scale-108 transition-transform duration-300 drop-shadow-sm"
          loading="lazy"
        />

        {/* Stock status indicator */}
        {product.stock <= (product.lowStockThreshold || 5) && product.stock > 0 && (
          <div className="absolute bottom-2 right-2 bg-slate-950/85 backdrop-blur-xs text-amber-400 border border-amber-500/40 text-[10px] font-black px-2 py-0.5 rounded-lg shadow-sm">
            متبقي {product.stock} فقط
          </div>
        )}

        {/* Minimum order qty badge if applicable */}
        {deal.minOrderQty && deal.minOrderQty > 1 && (
          <div className="absolute top-2 left-2 bg-emerald-950/80 backdrop-blur-xs text-emerald-300 border border-emerald-700/60 text-[10px] font-black px-2 py-0.5 rounded-lg shadow-sm">
            أقل طلب: {deal.minOrderQty} {deal.productUnit || product.unit}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="flex-1 flex flex-col justify-between space-y-2 text-right">
        <div>
          <div className="flex items-center gap-1 text-[11px] text-slate-500 font-bold mb-1">
            <span className="text-emerald-800 font-black">{deal.category || product.category}</span>
            {deal.productBrand && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-slate-600">{deal.productBrand}</span>
              </>
            )}
            {deal.productSize && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-slate-600">{deal.productSize}</span>
              </>
            )}
          </div>

          <h3 className="font-black text-sm sm:text-base text-slate-950 leading-snug line-clamp-2 min-h-[44px]">
            {deal.productName}
          </h3>

          {deal.description && (
            <p className="text-[11px] text-slate-500 line-clamp-1 mt-1 font-medium">
              {deal.description}
            </p>
          )}
        </div>

        {/* Countdown Timer if endDate exists */}
        {deal.endDate && (
          <div className="pt-1">
            <DealCountdown endDate={deal.endDate} />
          </div>
        )}

        {/* Price & Savings Container */}
        <div className="pt-3 border-t border-slate-200 mt-2">
          {isPricesHidden ? (
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3 text-center text-amber-400 text-xs font-black flex items-center justify-center gap-2">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>سعر الجملة خاص بالتجار المسجلين</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block mb-0.5">
                    سعر العرض الحصري:
                  </span>
                  <div className="flex items-baseline gap-1 font-mono">
                    <span className="text-xl sm:text-2xl font-black text-emerald-800 tracking-tight">
                      {offerPrice.toLocaleString('ar-EG')}
                    </span>
                    <span className="text-xs text-slate-600 font-black">
                      ج.م / {deal.productUnit || product.unit}
                    </span>
                  </div>
                </div>

                {hasDiscount && (
                  <div className="text-left font-mono">
                    <span className="text-xs text-slate-400 line-through block font-semibold">
                      {originalPrice.toLocaleString('ar-EG')} ج.م
                    </span>
                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md inline-block mt-0.5">
                      وفر {savingsAmount.toLocaleString('ar-EG')} ج
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Button: "اطلب الآن" or Quantity Stepper */}
          <div className="mt-3">
            {!isStoreOpen ? (
              <div className="w-full py-2.5 px-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-xs">
                <Store className="w-4 h-4" />
                <span>المتجر مغلق حالياً</span>
              </div>
            ) : quantity === 0 ? (
              <button
                type="button"
                onClick={() => onUpdateQty(product, deal.minOrderQty || 1)}
                className="w-full py-3 px-4 bg-gradient-to-r from-emerald-800 via-emerald-900 to-emerald-950 hover:from-emerald-700 hover:to-emerald-900 text-white rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-[0.98] border border-emerald-700/80 cursor-pointer"
              >
                <ShoppingCart className="w-4 h-4 text-amber-400" />
                <span>اطلب الآن بالعرض</span>
              </button>
            ) : (
              <div className="flex items-center justify-between bg-emerald-950 text-white border-2 border-emerald-700 rounded-2xl p-1 shadow-md">
                <button
                  type="button"
                  onClick={() => onUpdateQty(product, -1)}
                  className="w-9 h-9 bg-white/10 hover:bg-white/25 text-white rounded-xl flex items-center justify-center font-black transition-colors cursor-pointer active:scale-95"
                  title="إنقاص الكمية"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <div className="text-center px-2">
                  <span className="font-mono font-black text-sm text-amber-400 block leading-tight">
                    {quantity}
                  </span>
                  <span className="text-[9px] text-emerald-200 font-bold block">
                    {deal.productUnit || product.unit} بالسلة
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onUpdateQty(product, 1)}
                  className="w-9 h-9 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-xl flex items-center justify-center font-black transition-colors cursor-pointer active:scale-95 shadow-sm"
                  title="زيادة الكمية"
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
};

// Countdown Timer Component with live ticking and polished amber/gold badge styling
export const DealCountdown: React.FC<{ endDate: string }> = ({ endDate }) => {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: false });

  useEffect(() => {
    const calculateTime = () => {
      const endTimestamp = endDate.includes('T')
        ? new Date(endDate).getTime()
        : new Date(endDate + 'T23:59:59').getTime();
      const diff = endTimestamp - Date.now();

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, isExpired: false });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [endDate]);

  if (timeLeft.isExpired) {
    return (
      <div className="bg-slate-100 border border-slate-200 text-slate-500 text-[10px] font-bold py-1.5 px-2.5 rounded-xl text-center flex items-center justify-center gap-1">
        <Clock className="w-3 h-3 text-slate-400" />
        <span>انتهت فترة هذا العرض</span>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300/80 rounded-xl py-1.5 px-2.5 text-center text-amber-950 flex items-center justify-between text-[11px] font-bold shadow-2xs">
      <div className="flex items-center gap-1.5 text-amber-900">
        <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin-slow shrink-0" />
        <span>ينتهي خلال:</span>
      </div>
      <div className="font-mono font-black text-amber-900 text-xs flex items-center gap-1" dir="ltr">
        {timeLeft.days > 0 && <span className="bg-amber-200/80 px-1 py-0.5 rounded text-[10px]">{timeLeft.days}d</span>}
        <span className="bg-amber-200/80 px-1 py-0.5 rounded text-[10px]">{timeLeft.hours.toString().padStart(2, '0')}h</span>
        <span>:</span>
        <span className="bg-amber-200/80 px-1 py-0.5 rounded text-[10px]">{timeLeft.minutes.toString().padStart(2, '0')}m</span>
        <span>:</span>
        <span className="bg-amber-300 text-slate-950 px-1 py-0.5 rounded text-[10px]">{timeLeft.seconds.toString().padStart(2, '0')}s</span>
      </div>
    </div>
  );
};
