import React from 'react';
import { Category, Product } from '../types';
import {
  Sparkles,
  Search,
  Package,
  Layers,
  ChevronLeft,
  ArrowRight,
} from 'lucide-react';

interface CategoriesExploreViewProps {
  categories: Category[];
  products: Product[];
  onSelectCategory: (categoryName: string) => void;
}

// Category icons mapping
const CATEGORY_ICONS: Record<string, string> = {
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

export const CategoriesExploreView: React.FC<CategoriesExploreViewProps> = ({
  categories = [],
  products = [],
  onSelectCategory,
}) => {
  const safeProducts = Array.isArray(products) ? products : [];
  const getProductCount = (categoryName: string) => {
    return safeProducts.filter(
      (p) => p.category === categoryName && p.status !== 'hidden'
    ).length;
  };

  return (
    <div className="space-y-4 pb-28 text-right max-w-2xl mx-auto" dir="rtl">
      {/* Header Banner */}
      <div className="bg-emerald-800 text-white rounded-3xl p-5 shadow-sm relative overflow-hidden">
        <div className="relative z-10 space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-700/80 text-emerald-100 text-[11px] font-bold">
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>كتالوج أصناف الجملة الشامل</span>
          </div>
          <h2 className="text-xl font-black">أقسام شركة الحليم</h2>
          <p className="text-xs text-emerald-200 leading-relaxed max-w-md">
            تصفح أقسام المنتجات المختلفة وأسعار الجملة للكرتونة والبالتة المعتمدة.
          </p>
        </div>
      </div>

      {/* Grid of Categories */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
        {categories.map((cat) => {
          const count = getProductCount(cat.name);
          const emoji = CATEGORY_ICONS[cat.name] || '📦';

          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.name)}
              className="bg-white hover:bg-slate-50 border border-slate-200 hover:border-emerald-500 rounded-2xl p-4 text-right transition-all flex flex-col justify-between group shadow-2xs hover:shadow-sm"
            >
              <div className="flex items-start justify-between">
                <span className="text-3xl sm:text-4xl">{emoji}</span>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 font-mono">
                  {count} صنف
                </span>
              </div>

              <div className="mt-3">
                <h3 className="font-black text-slate-900 text-xs sm:text-sm group-hover:text-emerald-800 transition-colors leading-tight">
                  {cat.name}
                </h3>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span>عرض المنتجات</span>
                  <ChevronLeft className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-700 group-hover:-translate-x-1 transition-all" />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
