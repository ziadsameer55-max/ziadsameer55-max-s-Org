import React from 'react';
import { Product } from '../types';
import { Plus, Minus, Star, Lock, Package, Check, Sparkles } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  quantity: number;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onUpdateQty: (product: Product, delta: number) => void;
  onSetQty: (product: Product, qty: number) => void;
  viewMode?: 'grid' | 'list';
  hidePrice?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  quantity,
  isFavorite,
  onToggleFavorite,
  onUpdateQty,
  onSetQty,
  viewMode = 'list',
  hidePrice = false,
}) => {
  const isLocked = product.status === 'locked';
  const isPriceActuallyHidden = hidePrice || (product.price === 0 || !product.price);
  const lineTotal = (product.price || 0) * (quantity || 0);
  const lowThreshold = product.lowStockThreshold || 5;
  const isLowStock = product.stock <= lowThreshold && product.stock > 0;

  if (viewMode === 'grid') {
    return (
      <div
        className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden relative shadow-xs ${
          quantity > 0
            ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        {/* Favorite Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(product.id);
          }}
          className="absolute top-2 left-2 z-10 w-8 h-8 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-slate-400 hover:text-amber-500 shadow-xs transition-colors"
          title={isFavorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
        >
          <Star
            className={`w-4 h-4 ${
              isFavorite ? 'fill-amber-400 text-amber-400' : 'text-slate-400'
            }`}
          />
        </button>

        {/* Stock / Status Badge */}
        <div className="absolute top-2 right-2 z-10">
          {isLocked ? (
            <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-700 text-[10px] font-black flex items-center gap-0.5 border border-red-200">
              <Lock className="w-2.5 h-2.5" />
              مغلق
            </span>
          ) : isLowStock ? (
            <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[10px] font-black border border-amber-600 shadow-xs animate-pulse">
              ⚠️ متبقي {product.stock} {product.unit || 'كرتونة'}
            </span>
          ) : null}
        </div>

        {/* Image Container */}
        <div className="w-full h-32 sm:h-36 bg-slate-50 flex items-center justify-center p-3 relative overflow-hidden">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="max-h-full max-w-full object-contain drop-shadow-xs transition-transform duration-300 hover:scale-105"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                // Fallback to icon
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Package className="w-6 h-6" />
            </div>
          )}
        </div>

        {/* Card Body */}
        <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between text-right">
          <div>
            {/* Category / Packaging Tag */}
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium mb-1">
              <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                {product.category}
              </span>
              {product.packaging && (
                <span className="text-slate-400">• {product.packaging}</span>
              )}
            </div>

            {/* Product Name */}
            <h3 className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-2 leading-snug">
              {product.name}
            </h3>

            {/* Wholesale Price */}
            <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
              {!isPriceActuallyHidden && product.price > 0 ? (
                <>
                  <span className="text-sm sm:text-base font-black text-emerald-800 font-mono">
                    {product.price.toLocaleString('ar-EG')} ج.م
                  </span>
                  <span className="text-[11px] text-slate-500 font-semibold">
                    / {product.unit || 'كرتونة'}
                  </span>
                </>
              ) : (
                <span className="text-[11px] font-black text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-500" />
                  <span>سعر الجملة محمي للإدارة</span>
                </span>
              )}
            </div>
          </div>

          {/* Stepper / Add Action */}
          <div className="mt-3 pt-2.5 border-t border-slate-100">
            {isLocked ? (
              <div className="text-center py-2 bg-slate-100 rounded-xl text-slate-400 text-xs font-bold">
                غير متاح للطلب
              </div>
            ) : quantity === 0 ? (
              <button
                onClick={() => onUpdateQty(product, product.minQty || 1)}
                className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة كرتونة</span>
              </button>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between bg-white border-2 border-emerald-600 rounded-xl p-0.5 shadow-2xs">
                  <button
                    onClick={() => onUpdateQty(product, -1)}
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-700 font-black text-sm flex items-center justify-center transition-colors active:scale-90"
                    title="إنقاص"
                  >
                    <Minus className="w-3 h-3" />
                  </button>

                  <input
                    type="number"
                    min="0"
                    max={product.maxQty || 9999}
                    value={quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      onSetQty(product, isNaN(val) ? 0 : val);
                    }}
                    className="w-10 text-center font-black text-emerald-950 font-mono text-xs sm:text-sm focus:outline-none bg-transparent"
                  />

                  <button
                    onClick={() => onUpdateQty(product, 1)}
                    className="w-7 h-7 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-black text-sm flex items-center justify-center transition-colors active:scale-90"
                    title="زيادة"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {product.price > 0 ? (
                  <div className="text-center text-[10px] font-bold text-emerald-800 font-mono">
                    الإجمالي: {(lineTotal || 0).toLocaleString('ar-EG')} ج.م
                  </div>
                ) : (
                  <div className="text-center text-[10px] font-bold text-slate-500">
                    الكمية: {quantity} {product.unit || 'كرتونة'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default: B2B Wholesale List Row
  return (
    <div
      className={`p-3 sm:p-3.5 flex items-center justify-between gap-3 transition-all ${
        quantity > 0
          ? 'bg-emerald-50/70 border-r-4 border-r-emerald-600'
          : 'hover:bg-slate-50/80 bg-white'
      }`}
    >
      {/* Thumbnail */}
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-50 border border-slate-100 p-1 flex items-center justify-center shrink-0 overflow-hidden relative">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="max-h-full max-w-full object-contain"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <Package className="w-6 h-6 text-slate-400" />
        )}
      </div>

      {/* Product Details */}
      <div className="flex-1 min-w-0 text-right">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onToggleFavorite(product.id)}
            className="text-slate-300 hover:text-amber-500 p-0.5 shrink-0 transition-colors"
            title={isFavorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
          >
            <Star
              className={`w-3.5 h-3.5 ${
                isFavorite ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
              }`}
            />
          </button>

          <h3 className="font-bold text-slate-900 text-xs sm:text-sm truncate leading-snug">
            {product.name}
          </h3>
        </div>

        {/* Packaging / Category tags */}
        <div className="mt-0.5 flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500">
          <span className="text-slate-600 font-medium">{product.category}</span>
          {product.packaging && (
            <span className="text-slate-400 text-[10px]">
              • {product.packaging}
            </span>
          )}
          {product.minQty > 1 && (
            <span className="text-[10px] bg-slate-100 text-slate-600 px-1 rounded">
              أقل طلب: {product.minQty}
            </span>
          )}
          {isLowStock && (
            <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.2 rounded">
              ⚠️ متبقي {product.stock} {product.unit || 'كرتونة'}
            </span>
          )}
        </div>

        {/* Price & Line sum */}
        <div className="mt-1 flex items-baseline gap-2 flex-wrap text-xs">
          {!isPriceActuallyHidden && product.price > 0 ? (
            <>
              <span className="font-black text-emerald-800 text-sm sm:text-base font-mono">
                {product.price.toLocaleString('ar-EG')} ج.م
              </span>
              <span className="text-slate-500 text-[11px]">
                / {product.unit || 'كرتونة'}
              </span>
              {quantity > 0 && (
                <span className="text-[11px] font-black text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md font-mono">
                  = {(lineTotal || 0).toLocaleString('ar-EG')} ج.م
                </span>
              )}
            </>
          ) : (
            <span className="text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1">
              <Lock className="w-3 h-3 text-slate-500" />
              <span>سعر الجملة محمي للإدارة</span>
            </span>
          )}
        </div>
      </div>

      {/* Action: Stepper or Add button */}
      <div className="shrink-0">
        {isLocked ? (
          <div className="px-2.5 py-1 bg-red-50 text-red-700 text-[11px] font-bold rounded-lg border border-red-200 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            <span>مغلق</span>
          </div>
        ) : quantity === 0 ? (
          <button
            onClick={() => onUpdateQty(product, product.minQty || 1)}
            className="h-9 px-3.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-1 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>أضف</span>
          </button>
        ) : (
          <div className="flex items-center bg-white border-2 border-emerald-600 rounded-xl p-0.5 shadow-2xs">
            <button
              onClick={() => onUpdateQty(product, -1)}
              className="w-7 sm:w-8 h-7 sm:h-8 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-800 font-black text-sm flex items-center justify-center transition-colors active:scale-90"
              title="إنقاص"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            <input
              type="number"
              min="0"
              max={product.maxQty || 9999}
              value={quantity}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onSetQty(product, isNaN(val) ? 0 : val);
              }}
              className="w-10 sm:w-12 text-center font-black text-emerald-950 font-mono text-xs sm:text-sm focus:outline-none bg-transparent"
            />

            <button
              onClick={() => onUpdateQty(product, 1)}
              className="w-7 sm:w-8 h-7 sm:h-8 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-black text-sm flex items-center justify-center transition-colors active:scale-90"
              title="زيادة"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
