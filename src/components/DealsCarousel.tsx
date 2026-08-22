import React, { useState, useEffect } from 'react';
import { DealOffer, Product, SystemSettings } from '../types';
import {
  Flame,
  Clock,
  Tag,
  Plus,
  Minus,
  Check,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Gift,
  Star,
  Package,
  Award,
  Lock,
} from 'lucide-react';

interface DealsCarouselProps {
  deals: DealOffer[];
  products: Product[];
  settings: SystemSettings | null;
  cartItems: Array<{ product: Product; quantity: number }>;
  onUpdateCartItem: (product: Product, delta: number) => void;
  onSetCartItemQty: (product: Product, quantity: number) => void;
  onViewAllDeals?: () => void;
}

export const DealsCarousel: React.FC<DealsCarouselProps> = ({
  deals,
  products,
  settings,
  cartItems,
  onUpdateCartItem,
  onSetCartItemQty,
  onViewAllDeals,
}) => {
  const isPricesHidden = Boolean(settings?.hidePrices);

  // Filter out any deals that are inactive or expired
  const activeDeals = deals.filter((d) => d.isActive && !d.isExpired);

  if (activeDeals.length === 0) {
    return null;
  }

  return (
    <section className="bg-gradient-to-b from-amber-500/10 via-orange-500/5 to-transparent border border-amber-200/80 rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-sm overflow-hidden relative">
      {/* Background subtle glow decoration */}
      <div className="absolute top-0 left-1/4 w-72 h-32 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
            <Flame className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                🔥 العروض والفرص
              </h2>
              <span className="bg-amber-500/20 text-amber-900 border border-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full">
                {activeDeals.length} عروض متاحة
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              خصومات وأسعار خاصة متاحة الآن لتجار التجزئة والسوبر ماركت
            </p>
          </div>
        </div>

        {onViewAllDeals && (
          <button
            onClick={onViewAllDeals}
            className="text-xs font-bold text-amber-800 hover:text-amber-900 bg-amber-100/80 hover:bg-amber-200/80 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1 shrink-0"
          >
            <span>كل العروض</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Horizontal Scroll Track */}
      <div className="flex items-stretch gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-amber-300 scrollbar-track-transparent">
        {activeDeals.map((deal) => {
          // Match underlying product
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
            <DealCard
              key={deal.id}
              deal={deal}
              product={matchedProduct}
              quantity={currentQty}
              isPricesHidden={isPricesHidden}
              onUpdateQty={onUpdateCartItem}
              onSetQty={onSetCartItemQty}
            />
          );
        })}
      </div>
    </section>
  );
};

interface DealCardProps {
  deal: DealOffer;
  product: Product;
  quantity: number;
  isPricesHidden: boolean;
  onUpdateQty: (product: Product, delta: number) => void;
  onSetQty: (product: Product, qty: number) => void;
}

const DealCard: React.FC<DealCardProps> = ({
  deal,
  product,
  quantity,
  isPricesHidden,
  onUpdateQty,
  onSetQty,
}) => {
  // Offer Type Styling & Icons
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'discount':
        return {
          icon: Flame,
          bg: 'bg-rose-500 text-white',
          border: 'border-rose-600',
          label: deal.badgeText || '🔥 خصم خاص',
        };
      case 'special_price':
        return {
          icon: Gift,
          bg: 'bg-amber-500 text-slate-950 font-black',
          border: 'border-amber-600',
          label: deal.badgeText || '🎁 سعر خاص',
        };
      case 'new_product':
        return {
          icon: Star,
          bg: 'bg-emerald-600 text-white font-bold',
          border: 'border-emerald-700',
          label: deal.badgeText || '⭐ منتج جديد',
        };
      case 'carton_deal':
        return {
          icon: Package,
          bg: 'bg-indigo-600 text-white font-bold',
          border: 'border-indigo-700',
          label: deal.badgeText || '📦 سعر كرتونة مميز',
        };
      case 'bestseller':
        return {
          icon: Award,
          bg: 'bg-yellow-500 text-slate-950 font-black',
          border: 'border-yellow-600',
          label: deal.badgeText || '🏆 الأكثر طلبًا',
        };
      case 'limited_time':
      default:
        return {
          icon: Clock,
          bg: 'bg-orange-600 text-white font-bold',
          border: 'border-orange-700',
          label: deal.badgeText || '⏰ عرض لفترة محدودة',
        };
    }
  };

  const badgeInfo = getTypeBadge(deal.offerType);
  const BadgeIcon = badgeInfo.icon;

  return (
    <div className="w-56 sm:w-64 shrink-0 bg-white border border-slate-200/90 rounded-2xl p-3 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
      {/* Top Banner Tag */}
      <div className="flex items-center justify-between gap-1 mb-2">
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-lg shadow-xs ${badgeInfo.bg}`}
        >
          <BadgeIcon className="w-3 h-3 shrink-0" />
          <span className="truncate max-w-[130px]">{badgeInfo.label}</span>
        </span>

        {!isPricesHidden && deal.discountPercentage && deal.discountPercentage > 0 && (
          <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black font-mono px-1.5 py-0.5 rounded-md">
            -{deal.discountPercentage}%
          </span>
        )}
      </div>

      {/* Product Image & Badges */}
      <div className="relative aspect-4/3 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden mb-2.5 flex items-center justify-center p-2">
        <img
          src={deal.productImage || product.image}
          alt={deal.productName}
          referrerPolicy="no-referrer"
          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />

        {product.stock <= (product.lowStockThreshold || 5) && product.stock > 0 && (
          <div className="absolute bottom-1 right-1 bg-amber-500/90 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded-md backdrop-blur-xs">
            متبقي {product.stock} فقط
          </div>
        )}
      </div>

      {/* Product Title & Brand/Category */}
      <div className="space-y-1 text-right flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
            <span>{deal.productBrand || deal.category || product.category}</span>
            {deal.productSize && <span>• {deal.productSize}</span>}
          </div>
          <h3 className="font-black text-xs sm:text-sm text-slate-900 line-clamp-2 leading-snug">
            {deal.productName}
          </h3>
          {deal.description && (
            <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
              {deal.description}
            </p>
          )}
        </div>

        {/* Countdown Timer if endDate is set */}
        {deal.endDate && (
          <div className="mt-1.5">
            <DealCountdown endDate={deal.endDate} />
          </div>
        )}

        {/* Pricing Section */}
        <div className="pt-2 border-t border-slate-100 mt-2">
          {isPricesHidden ? (
            <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-2 text-center text-amber-900 text-xs font-black flex items-center justify-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-700" />
              <span>🔥 عرض خاص - احصل على سعر مميز</span>
            </div>
          ) : (
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xs text-slate-400 font-medium">سعر العرض:</span>
                <div className="flex items-baseline gap-1 font-mono">
                  <span className="text-base sm:text-lg font-black text-emerald-800">
                    {deal.offerPrice.toLocaleString('ar-EG')}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold">ج.م / {deal.productUnit || product.unit}</span>
                </div>
              </div>

              {deal.originalPrice > deal.offerPrice && (
                <div className="text-left font-mono">
                  <span className="text-[10px] text-slate-400 line-through block">
                    {deal.originalPrice.toLocaleString('ar-EG')} ج.م
                  </span>
                  <span className="text-[9px] text-emerald-600 font-bold block">
                    وفّر {(deal.originalPrice - deal.offerPrice).toLocaleString('ar-EG')} ج
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Action Button / Cart Controls */}
          <div className="mt-2.5">
            {quantity === 0 ? (
              <button
                onClick={() => onUpdateQty(product, 1)}
                className="w-full py-2 px-3 bg-gradient-to-r from-emerald-700 to-emerald-800 hover:from-emerald-800 hover:to-emerald-900 active:scale-[0.98] text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>أضف للسلة بالعرض</span>
              </button>
            ) : (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-300 rounded-xl p-1">
                <button
                  onClick={() => onUpdateQty(product, -1)}
                  className="w-7 h-7 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg flex items-center justify-center font-black transition-colors"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>

                <div className="text-center">
                  <span className="font-mono font-black text-xs text-emerald-950 block">
                    {quantity}
                  </span>
                  <span className="text-[9px] text-emerald-700 font-bold block">
                    {deal.productUnit || product.unit} في السلة
                  </span>
                </div>

                <button
                  onClick={() => onUpdateQty(product, 1)}
                  className="w-7 h-7 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg flex items-center justify-center font-black transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Countdown Timer Component with live seconds ticking
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
      <div className="bg-slate-100 text-slate-500 text-[10px] font-bold py-1 px-2 rounded-lg text-center">
        انتهت صلاحية العرض
      </div>
    );
  }

  return (
    <div className="bg-orange-50/90 border border-orange-200/80 rounded-lg p-1.5 text-center text-orange-950 flex items-center justify-center gap-1 text-[10px] font-bold">
      <Clock className="w-3 h-3 text-orange-600 shrink-0" />
      <span>ينتهي خلال:</span>
      <span className="font-mono font-black text-orange-700">
        {timeLeft.days > 0 && `${timeLeft.days}ي `}
        {timeLeft.hours.toString().padStart(2, '0')}:
        {timeLeft.minutes.toString().padStart(2, '0')}:
        {timeLeft.seconds.toString().padStart(2, '0')}
      </span>
    </div>
  );
};
