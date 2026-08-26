import React from 'react';
import { Product, SystemSettings } from '../types';
import { Award, TrendingUp, Plus, Minus, Lock, Star } from 'lucide-react';

interface BestsellersShelfProps {
  products: Array<Product & { totalSold?: number }>;
  settings: SystemSettings | null;
  cartItems: Array<{ product: Product; quantity: number }>;
  onUpdateCartItem: (product: Product, delta: number) => void;
  onSetItemQty?: (product: Product, quantity: number) => void;
  onSetCartItemQty: (product: Product, quantity: number) => void;
  isStoreOpen?: boolean;
}

export const BestsellersShelf: React.FC<BestsellersShelfProps> = ({
  products,
  settings,
  cartItems,
  onUpdateCartItem,
  onSetCartItemQty,
  isStoreOpen = true,
}) => {
  const isPricesHidden = Boolean(settings?.hidePrices);

  if (!products || products.length === 0) {
    return null;
  }

  return (
    <section className="bg-gradient-to-b from-yellow-500/10 via-amber-500/5 to-transparent border border-yellow-200/80 rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-sm overflow-hidden relative">
      {/* Background decoration */}
      <div className="absolute top-0 right-1/4 w-72 h-32 bg-yellow-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-yellow-500 to-amber-600 text-slate-950 flex items-center justify-center shadow-md shadow-yellow-500/20">
            <Award className="w-5 h-5 font-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                ⭐ الأكثر طلبًا
              </h2>
              <span className="bg-yellow-100 text-yellow-900 border border-yellow-300 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                الأعلى مبيعاً
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              الأصناف الأكثر سحبًا واعتمادًا من أصحاب السوبر ماركت وتجار التجزئة
            </p>
          </div>
        </div>
      </div>

      {/* Horizontal Scroll Track */}
      <div className="flex items-stretch gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-yellow-300 scrollbar-track-transparent">
        {products.map((product, idx) => {
          const cartItem = cartItems.find((ci) => ci.product.id === product.id);
          const currentQty = cartItem ? cartItem.quantity : 0;

          return (
            <div
              key={product.id}
              className="w-52 sm:w-60 shrink-0 bg-white border border-slate-200/90 rounded-2xl p-3 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
            >
              {/* Rank Badge */}
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="inline-flex items-center gap-1 bg-yellow-50 text-yellow-900 border border-yellow-200 text-[10px] font-black px-2 py-0.5 rounded-lg">
                  <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                  <span>#{idx + 1} في المبيعات</span>
                </span>

                {product.totalSold && product.totalSold > 0 && (
                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black px-1.5 py-0.5 rounded-md">
                    🔥 {product.totalSold} {product.unit}
                  </span>
                )}
              </div>

              {/* Product Image */}
              <div className="relative aspect-4/3 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden mb-2.5 flex items-center justify-center p-2">
                <img
                  src={product.image}
                  alt={product.name}
                  referrerPolicy="no-referrer"
                  className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />

                {product.stock <= (product.lowStockThreshold || 5) && product.stock > 0 && (
                  <div className="absolute bottom-1 right-1 bg-amber-500/90 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded-md backdrop-blur-xs">
                    متبقي {product.stock}
                  </div>
                )}
              </div>

              {/* Title and Category */}
              <div className="space-y-1 text-right flex-1 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-medium block">
                    {product.category}
                  </span>
                  <h3 className="font-black text-xs sm:text-sm text-slate-900 line-clamp-2 leading-snug">
                    {product.name}
                  </h3>
                </div>

                {/* Pricing & Add to Cart */}
                <div className="pt-2 border-t border-slate-100 mt-2">
                  {isPricesHidden ? (
                    <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-1.5 text-center text-amber-900 text-[11px] font-black flex items-center justify-center gap-1">
                      <Lock className="w-3 h-3 text-amber-700" />
                      <span>أسعار الجملة بعد الدخول</span>
                    </div>
                  ) : (
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-xs text-slate-400 font-medium">السعر:</span>
                      <div className="flex items-baseline gap-1 font-mono">
                        <span className="text-base sm:text-lg font-black text-emerald-800">
                          {product.price.toLocaleString('ar-EG')}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold">
                          ج.م / {product.unit}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Cart button */}
                  <div className="mt-1">
                    {!isStoreOpen ? (
                      <div className="w-full py-2 bg-red-50 text-red-700 text-xs font-bold rounded-xl border border-red-200 flex items-center justify-center gap-1">
                        <Lock className="w-3.5 h-3.5" />
                        <span>مغلق</span>
                      </div>
                    ) : currentQty === 0 ? (
                      <button
                        onClick={() => onUpdateCartItem(product, 1)}
                        className="w-full py-2 px-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>طلب الصنف</span>
                      </button>
                    ) : (
                      <div className="flex items-center justify-between bg-emerald-50 border border-emerald-300 rounded-xl p-1">
                        <button
                          onClick={() => onUpdateCartItem(product, -1)}
                          className="w-7 h-7 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg flex items-center justify-center font-black transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>

                        <div className="text-center">
                          <span className="font-mono font-black text-xs text-emerald-950 block">
                            {currentQty}
                          </span>
                          <span className="text-[9px] text-emerald-700 font-bold block">
                            {product.unit}
                          </span>
                        </div>

                        <button
                          onClick={() => onUpdateCartItem(product, 1)}
                          className="w-7 h-7 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg flex items-center justify-center font-black transition-colors"
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
        })}
      </div>
    </section>
  );
};
