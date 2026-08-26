import React from 'react';
import { Product } from '../types';
import { Star, Plus, Minus, Lock, ShoppingCart } from 'lucide-react';
import { CartItem } from './NotebookCatalog';

interface SimpleFavoritesProps {
  products: Product[];
  favorites: string[];
  cart: CartItem[];
  onToggleFavorite: (productId: string) => void;
  onUpdateCartItem: (product: Product, delta: number) => void;
  onSetCartItemQty: (product: Product, qty: number) => void;
  onOpenCart: () => void;
  onNavigateToCatalog: () => void;
  isStoreOpen?: boolean;
}

export const SimpleFavorites: React.FC<SimpleFavoritesProps> = ({
  products = [],
  favorites = [],
  cart = [],
  onToggleFavorite,
  onUpdateCartItem,
  onSetCartItemQty,
  onOpenCart,
  onNavigateToCatalog,
  isStoreOpen = true,
}) => {
  const safeProducts = Array.isArray(products) ? products : [];
  const safeFavorites = Array.isArray(favorites) ? favorites : [];
  const safeCart = Array.isArray(cart) ? cart : [];

  const favoriteProducts = safeProducts.filter((p) => safeFavorites.includes(p.id));

  const totalItemsCount = safeCart.length;
  const totalQuantity = safeCart.reduce((sum, i) => sum + i.quantity, 0);
  const grandTotal = safeCart.reduce((sum, i) => sum + (i.product?.price || 0) * i.quantity, 0);

  const getProductQty = (productId: string): number => {
    const item = safeCart.find((i) => i.product?.id === productId);
    return item ? item.quantity : 0;
  };

  return (
    <div className="space-y-3 pb-28 text-right max-w-2xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between py-1">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
          <h2 className="font-black text-slate-900 text-lg">منتجاتي المفضلة</h2>
        </div>
        <span className="text-xs bg-amber-50 text-amber-900 font-bold px-3 py-1 rounded-full border border-amber-200">
          {favoriteProducts.length} منتج
        </span>
      </div>

      {favoriteProducts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 shadow-xs space-y-3">
          <Star className="w-12 h-12 text-amber-400 mx-auto opacity-50" />
          <h3 className="font-bold text-base text-slate-800">لا توجد منتجات في المفضلة بعد</h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            اضغط على علامة النجمة ⭐ بجانب أي منتج في قائمة الطلب لحفظه هنا وتكراره بسرعة.
          </p>
          <button
            onClick={onNavigateToCatalog}
            className="mt-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
          >
            تصفح قائمة المنتجات
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          {favoriteProducts.map((product) => {
            const qty = getProductQty(product.id);
            const isLocked = product.status === 'locked' || !isStoreOpen;

            return (
              <div
                key={product.id}
                className={`p-3.5 sm:p-4 flex items-center justify-between gap-3 transition-colors ${
                  qty > 0 ? 'bg-emerald-50/60' : 'hover:bg-slate-50/70'
                }`}
              >
                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onToggleFavorite(product.id)}
                      className="text-amber-400 hover:text-slate-300 p-0.5 shrink-0 transition-colors"
                      title="إزالة من المفضلة"
                    >
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    </button>

                    <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate leading-snug">
                      {product.name}
                    </h3>
                  </div>

                  <div className="mt-1 flex items-baseline gap-2 text-xs">
                    <span className="font-black text-emerald-800 text-sm sm:text-base font-mono">
                      {(product.price || 0).toLocaleString('ar-EG')} ج.م
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      / {product.unit}
                    </span>
                  </div>
                </div>

                {/* Instant Stepper [-] Qty [+] */}
                <div className="shrink-0">
                  {isLocked ? (
                    <div className="px-3 py-1.5 bg-red-50 text-red-700 text-xs font-bold rounded-lg border border-red-200 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>مغلق</span>
                    </div>
                  ) : qty === 0 ? (
                    <button
                      onClick={() => onUpdateCartItem(product, product.minQty || 1)}
                      className="h-10 px-4 bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-800 font-bold text-xs sm:text-sm rounded-xl border border-slate-300 hover:border-emerald-600 transition-colors flex items-center justify-center gap-1 active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      <span>أضف</span>
                    </button>
                  ) : (
                    <div className="flex items-center bg-white border-2 border-emerald-600 rounded-xl p-0.5 shadow-2xs">
                      <button
                        onClick={() => onUpdateCartItem(product, -1)}
                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-800 font-black text-sm flex items-center justify-center transition-colors active:scale-90 shrink-0"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <input
                        type="number"
                        min="0"
                        value={qty}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          onSetCartItemQty(product, isNaN(val) ? 0 : val);
                        }}
                        className="w-12 sm:w-14 text-center font-black text-emerald-950 font-mono text-sm sm:text-base focus:outline-none bg-transparent"
                      />

                      <button
                        onClick={() => onUpdateCartItem(product, 1)}
                        className="w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center transition-colors active:scale-90 shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky Bottom Cart Bar */}
      {totalItemsCount > 0 && (
        <div className="fixed bottom-14 md:bottom-3 left-3 right-3 max-w-lg mx-auto z-30">
          <button
            onClick={onOpenCart}
            className="w-full bg-emerald-800 hover:bg-emerald-900 text-white p-3.5 rounded-2xl shadow-xl border border-emerald-700 flex items-center justify-between transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div className="text-right">
                <div className="text-xs text-emerald-200">
                  {totalItemsCount} أصناف ({totalQuantity} قطعة)
                </div>
                <div className="text-base font-black font-mono">
                  {(grandTotal || 0).toLocaleString('ar-EG')}{' '}
                  <span className="text-xs font-normal">جنيه</span>
                </div>
              </div>
            </div>

            <div className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs">
              <span>عرض السلة وإرسال الطلب</span>
              <span>←</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
