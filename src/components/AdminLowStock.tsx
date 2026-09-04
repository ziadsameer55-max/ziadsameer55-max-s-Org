import React, { useState, useEffect, useMemo } from 'react';
import { Product, SystemSettings } from '../types';
import { apiFetch } from '../utils/api';
import {
  PackageX,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Search,
  SlidersHorizontal,
  PackageCheck,
  CheckCircle2,
  TrendingDown,
  Layers,
  Printer,
  Plus,
  ArrowUpDown,
  Settings,
  LayoutGrid,
  List,
  Edit3,
  Boxes,
  Sparkles,
} from 'lucide-react';
import { printHtmlContent } from '../utils/printHelper';

interface AdminLowStockProps {
  products: Product[];
  settings: SystemSettings | null;
  onRefreshData: () => void;
  onNavigateToSettings?: () => void;
}

export type LowStockFilterType = 'all' | 'out_of_stock' | 'critical' | 'low' | 'moderate';

export interface StockStatusInfo {
  key: LowStockFilterType;
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
  cardBorder: string;
  cardBg: string;
}

export const getStockStatus = (stock: number, threshold: number = 30): StockStatusInfo => {
  if (stock <= 0) {
    return {
      key: 'out_of_stock',
      label: 'نفد من المخزن',
      badgeBg: 'bg-red-500/10 text-red-600 dark:text-red-400',
      badgeText: 'text-red-700 dark:text-red-300 font-black',
      badgeBorder: 'border-red-300 dark:border-red-800/80',
      dotColor: 'bg-red-500',
      cardBorder: 'border-red-200 hover:border-red-400 dark:border-red-900/60',
      cardBg: 'bg-red-50/30 dark:bg-red-950/10',
    };
  }
  if (stock >= 1 && stock <= 9) {
    return {
      key: 'critical',
      label: 'مخزون حرج',
      badgeBg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
      badgeText: 'text-orange-700 dark:text-orange-300 font-black',
      badgeBorder: 'border-orange-300 dark:border-orange-800/80',
      dotColor: 'bg-orange-500',
      cardBorder: 'border-orange-200 hover:border-orange-400 dark:border-orange-900/60',
      cardBg: 'bg-orange-50/30 dark:bg-orange-950/10',
    };
  }
  if (stock >= 10 && stock <= 19) {
    return {
      key: 'low',
      label: 'مخزون قليل',
      badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      badgeText: 'text-amber-700 dark:text-amber-300 font-bold',
      badgeBorder: 'border-amber-300 dark:border-amber-800/80',
      dotColor: 'bg-amber-500',
      cardBorder: 'border-amber-200 hover:border-amber-400 dark:border-amber-900/60',
      cardBg: 'bg-amber-50/30 dark:bg-amber-950/10',
    };
  }
  // 20 to threshold - 1 (e.g. 20 to 29)
  return {
    key: 'moderate',
    label: 'مخزون منخفض',
    badgeBg: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
    badgeText: 'text-yellow-800 dark:text-yellow-300 font-bold',
    badgeBorder: 'border-yellow-300 dark:border-yellow-800/80',
    dotColor: 'bg-yellow-500',
    cardBorder: 'border-yellow-200 hover:border-yellow-400 dark:border-yellow-900/60',
    cardBg: 'bg-yellow-50/20 dark:bg-yellow-950/10',
  };
};

export const AdminLowStock: React.FC<AdminLowStockProps> = ({
  products = [],
  settings,
  onRefreshData,
  onNavigateToSettings,
}) => {
  // Current low stock threshold from settings or default to 30
  const threshold = settings?.lowStockThreshold ?? 30;

  // Local state
  const [dbLowStockItems, setDbLowStockItems] = useState<Product[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<LowStockFilterType>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Quick Restock modal state
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockAmount, setRestockAmount] = useState<number>(0);
  const [isSavingRestock, setIsSavingRestock] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Fetch directly from server endpoint to guarantee database freshness
  const fetchLowStockFromDb = async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch(`/api/products/low-stock?threshold=${threshold}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.products)) {
          setDbLowStockItems(data.products);
        }
      }
    } catch (err) {
      console.error('Error fetching low stock from DB:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load and refetch when threshold changes
  useEffect(() => {
    fetchLowStockFromDb();
  }, [threshold]);

  // If products prop updates from App.tsx (e.g. after stock edit or order placement),
  // synchronize immediately
  useEffect(() => {
    if (products && products.length > 0) {
      // Re-filter products with stock < threshold
      const filtered = products
        .filter((p) => (p.stock ?? 0) < threshold)
        .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0) || a.name.localeCompare(b.name, 'ar'));
      setDbLowStockItems(filtered);
    }
  }, [products, threshold]);

  // Manual refresh button handler: fetches from DB and also calls onRefreshData
  const handleManualRefresh = async () => {
    await fetchLowStockFromDb();
    onRefreshData();
    showToast('تم تحديث بيانات نواقص المخزن من قاعدة البيانات بنجاح 🔄');
  };

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 4000);
  };

  // Base list of items with stock < threshold
  const baseItems: Product[] = useMemo(() => {
    const list = dbLowStockItems !== null 
      ? dbLowStockItems 
      : products.filter((p) => (p.stock ?? 0) < threshold);

    // Rule 9: Sort from lowest to highest, so 0 stock items appear first
    return [...list].sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0) || a.name.localeCompare(b.name, 'ar'));
  }, [dbLowStockItems, products, threshold]);

  // Category counts for quick tabs
  const statusCounts = useMemo(() => {
    const counts = {
      all: baseItems.length,
      out_of_stock: 0,
      critical: 0,
      low: 0,
      moderate: 0,
    };
    baseItems.forEach((p) => {
      const s = p.stock ?? 0;
      if (s <= 0) counts.out_of_stock++;
      else if (s >= 1 && s <= 9) counts.critical++;
      else if (s >= 10 && s <= 19) counts.low++;
      else counts.moderate++;
    });
    return counts;
  }, [baseItems]);

  // Filtered and searched items
  const displayItems = useMemo(() => {
    return baseItems.filter((p) => {
      const stock = p.stock ?? 0;

      // Filter by status
      if (selectedFilter === 'out_of_stock' && stock > 0) return false;
      if (selectedFilter === 'critical' && (stock < 1 || stock > 9)) return false;
      if (selectedFilter === 'low' && (stock < 10 || stock > 19)) return false;
      if (selectedFilter === 'moderate' && stock < 20) return false;

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (p.name || '').toLowerCase().includes(q);
        const matchesCategory = (p.category || '').toLowerCase().includes(q);
        const matchesPackaging = (p.packaging || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCategory && !matchesPackaging) return false;
      }

      return true;
    });
  }, [baseItems, selectedFilter, searchQuery]);

  // Handle saving new stock quantity
  const handleSaveRestock = async () => {
    if (!restockProduct) return;
    try {
      setIsSavingRestock(true);
      const newStock = Math.max(0, parseInt(String(restockAmount), 10) || 0);

      const res = await apiFetch(`/api/products/${encodeURIComponent(restockProduct.id)}/stock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: newStock }),
      });

      if (res.ok) {
        showToast(`تم تحديث مخزون "${restockProduct.name}" بنجاح إلى ${newStock} ${restockProduct.unit || 'كرتونة'}`);
        setRestockProduct(null);
        // Refresh server and local state
        await fetchLowStockFromDb();
        onRefreshData();
      } else {
        showToast('تعذر تحديث المخزون، يرجى المحاولة مرة أخرى', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء حفظ كمية المخزون', 'error');
    } finally {
      setIsSavingRestock(false);
    }
  };

  // Open Quick Restock Modal
  const openRestockModal = (product: Product) => {
    setRestockProduct(product);
    setRestockAmount(product.stock ?? 0);
  };

  // Print Low Stock Sheet for Warehouse Procurement
  const handlePrintDeficiencies = () => {
    const today = new Date().toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const rowsHtml = displayItems
      .map((item, idx) => {
        const status = getStockStatus(item.stock ?? 0, threshold);
        return `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 6px; text-align: center; font-weight: bold; width: 30px;">${idx + 1}</td>
            <td style="padding: 8px 6px; text-align: right; font-weight: bold;">
              ${item.name}
              ${item.packaging ? `<br><small style="color: #64748b;">${item.packaging}</small>` : ''}
            </td>
            <td style="padding: 8px 6px; text-align: center;">${item.category || 'عام'}</td>
            <td style="padding: 8px 6px; text-align: center; font-weight: bold; color: ${item.stock <= 0 ? '#dc2626' : '#d97706'}; font-size: 14px;">
              ${item.stock ?? 0} ${item.unit || 'كرتونة'}
            </td>
            <td style="padding: 8px 6px; text-align: center;">
              <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; background: #f1f5f9;">
                ${status.label}
              </span>
            </td>
            <td style="padding: 8px 6px; text-align: center; border-right: 1px dashed #cbd5e1; width: 80px;">
              _____
            </td>
          </tr>
        `;
      })
      .join('');

    const printHtml = `
      <div dir="rtl" style="font-family: system-ui, -apple-system, sans-serif; padding: 15px; color: #0f172a;">
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="margin: 0 0 4px 0; font-size: 20px; font-weight: 900;">${settings?.companyName || 'شركة الحليم للتجارة والتوزيع'}</h1>
            <h2 style="margin: 0; font-size: 15px; color: #b45309;">📦 تقرير نواقص المخزن وتوريدات البضاعة</h2>
          </div>
          <div style="text-align: left; font-size: 12px; color: #475569;">
            <div>التاريخ: <strong>${today}</strong></div>
            <div>حد التنبيه: <strong>أقل من ${threshold} كرتونة</strong></div>
            <div>إجمالي النواقص: <strong>${displayItems.length} صنف</strong></div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #0f172a; color: white;">
              <th style="padding: 8px 6px; text-align: center; width: 30px;">#</th>
              <th style="padding: 8px 6px; text-align: right;">اسم الصنف</th>
              <th style="padding: 8px 6px; text-align: center;">التصنيف</th>
              <th style="padding: 8px 6px; text-align: center;">الرصيد المتبقي</th>
              <th style="padding: 8px 6px; text-align: center;">الحالة</th>
              <th style="padding: 8px 6px; text-align: center;">الكمية المطلوبة للتوريد</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div style="margin-top: 25px; padding-top: 10px; border-top: 1px dashed #94a3b8; display: flex; justify-content: space-between; font-size: 11px; color: #64748b;">
          <span>المسؤول: ${settings?.managerName || 'إدارة المخازن والمشتريات'}</span>
          <span>المندوب: ${settings?.salesRepName || 'محمد فوزي'}</span>
          <span>توقيع أمين المخزن: ______________</span>
        </div>
      </div>
    `;

    printHtmlContent(printHtml, {
      title: `تقرير نواقص المخزن - شركة الحليم`,
      paperSize: 'A4',
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6 text-right pb-16" dir="rtl">
      {/* Toast Feedback Notification */}
      {feedbackMessage && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-lg border text-xs sm:text-sm font-bold flex items-center gap-2 animate-bounce ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-950 text-emerald-200 border-emerald-500/50'
              : 'bg-red-950 text-red-200 border-red-500/50'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* 1. Header Banner & Actions */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 shadow-2xs">
              <PackageX className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base sm:text-xl font-black text-slate-900 dark:text-white">
                  📦 نواقص المخزن
                </h1>
                {/* Rule 8: Counter Badge */}
                <span className="px-3 py-1 rounded-full bg-red-500 text-white font-black text-xs sm:text-sm shadow-xs animate-pulse">
                  عدد الأصناف الناقصة: {baseItems.length}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-1">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  عرض تلقائي لكافة المنتجات التي يقل رصيد مخزونها عن حد الأمان المعتمد
                </p>
                {/* Rule 20: Threshold info with quick link to settings */}
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  <span>حد النقص المعتمد:</span>
                  <strong className="text-amber-700 dark:text-amber-400 font-mono">أقل من {threshold}</strong>
                  <span>كرتونة/صنف</span>
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Rule 17: Refresh Button */}
            <button
              onClick={handleManualRefresh}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-2 border border-slate-200 dark:border-slate-700 disabled:opacity-50"
              title="إعادة جلب أحدث كميات المخزون مباشرة من قاعدة البيانات"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
              <span>تحديث البيانات</span>
            </button>

            {/* Print Deficiencies Report */}
            {baseItems.length > 0 && (
              <button
                onClick={handlePrintDeficiencies}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                title="طباعة بيان النواقص لأمر التوريد والشراء"
              >
                <Printer className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">طباعة كشف التوريد</span>
                <span className="sm:hidden">طباعة</span>
              </button>
            )}

            {/* Navigate to Settings to adjust threshold */}
            {onNavigateToSettings && (
              <button
                onClick={onNavigateToSettings}
                className="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-400 text-xs font-bold transition-all flex items-center gap-1.5 border border-amber-500/30"
                title="تعديل حد النقص من إعدادات النظام"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">تعديل حد النقص</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. Fast KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
          {/* Out of Stock Card */}
          <div
            onClick={() => setSelectedFilter(selectedFilter === 'out_of_stock' ? 'all' : 'out_of_stock')}
            className={`p-3 rounded-xl border transition-all cursor-pointer select-none ${
              selectedFilter === 'out_of_stock'
                ? 'bg-red-500 text-white border-red-600 shadow-sm ring-2 ring-red-500/30'
                : 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 hover:border-red-300'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold mb-1">
              <span className={selectedFilter === 'out_of_stock' ? 'text-red-100' : 'text-red-800 dark:text-red-400'}>
                نفد من المخزن (0)
              </span>
              <span className="w-2 h-2 rounded-full bg-red-500" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl sm:text-2xl font-black font-mono ${selectedFilter === 'out_of_stock' ? 'text-white' : 'text-red-700 dark:text-red-300'}`}>
                {statusCounts.out_of_stock}
              </span>
              <span className={`text-[10px] font-bold ${selectedFilter === 'out_of_stock' ? 'text-red-100' : 'text-slate-500'}`}>صنف</span>
            </div>
          </div>

          {/* Critical Card (1 - 9) */}
          <div
            onClick={() => setSelectedFilter(selectedFilter === 'critical' ? 'all' : 'critical')}
            className={`p-3 rounded-xl border transition-all cursor-pointer select-none ${
              selectedFilter === 'critical'
                ? 'bg-orange-500 text-white border-orange-600 shadow-sm ring-2 ring-orange-500/30'
                : 'bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/50 hover:border-orange-300'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold mb-1">
              <span className={selectedFilter === 'critical' ? 'text-orange-100' : 'text-orange-800 dark:text-orange-400'}>
                مخزون حرج (1-9)
              </span>
              <span className="w-2 h-2 rounded-full bg-orange-500" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl sm:text-2xl font-black font-mono ${selectedFilter === 'critical' ? 'text-white' : 'text-orange-700 dark:text-orange-300'}`}>
                {statusCounts.critical}
              </span>
              <span className={`text-[10px] font-bold ${selectedFilter === 'critical' ? 'text-orange-100' : 'text-slate-500'}`}>صنف</span>
            </div>
          </div>

          {/* Low Card (10 - 19) */}
          <div
            onClick={() => setSelectedFilter(selectedFilter === 'low' ? 'all' : 'low')}
            className={`p-3 rounded-xl border transition-all cursor-pointer select-none ${
              selectedFilter === 'low'
                ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-sm ring-2 ring-amber-500/30'
                : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 hover:border-amber-300'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold mb-1">
              <span className={selectedFilter === 'low' ? 'text-slate-950' : 'text-amber-800 dark:text-amber-400'}>
                مخزون قليل (10-19)
              </span>
              <span className="w-2 h-2 rounded-full bg-amber-500" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl sm:text-2xl font-black font-mono ${selectedFilter === 'low' ? 'text-slate-950' : 'text-amber-700 dark:text-amber-300'}`}>
                {statusCounts.low}
              </span>
              <span className={`text-[10px] font-bold ${selectedFilter === 'low' ? 'text-slate-800' : 'text-slate-500'}`}>صنف</span>
            </div>
          </div>

          {/* Moderate Card (20 - threshold) */}
          <div
            onClick={() => setSelectedFilter(selectedFilter === 'moderate' ? 'all' : 'moderate')}
            className={`p-3 rounded-xl border transition-all cursor-pointer select-none ${
              selectedFilter === 'moderate'
                ? 'bg-yellow-500 text-slate-950 border-yellow-600 shadow-sm ring-2 ring-yellow-500/30'
                : 'bg-yellow-50/50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900/50 hover:border-yellow-300'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold mb-1">
              <span className={selectedFilter === 'moderate' ? 'text-slate-950' : 'text-yellow-800 dark:text-yellow-400'}>
                مخزون منخفض (20-{threshold - 1})
              </span>
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl sm:text-2xl font-black font-mono ${selectedFilter === 'moderate' ? 'text-slate-950' : 'text-yellow-700 dark:text-yellow-300'}`}>
                {statusCounts.moderate}
              </span>
              <span className={`text-[10px] font-bold ${selectedFilter === 'moderate' ? 'text-slate-800' : 'text-slate-500'}`}>صنف</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Search Bar & Filter Tabs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Rule 18: Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث باسم الصنف أو التعبئة أو التصنيف..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pr-10 pl-4 py-2.5 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white dark:focus:bg-slate-800 transition-all font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-200 dark:bg-slate-700 rounded-full w-5 h-5 flex items-center justify-center"
              >
                ✕
              </button>
            )}
          </div>

          {/* View Mode Toggle: Grid vs Table */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 self-end sm:self-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-black'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="عرض الكروت"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden md:inline">كروت</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-black'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="عرض الجدول المفصل"
            >
              <List className="w-4 h-4" />
              <span className="hidden md:inline">جدول</span>
            </button>
          </div>
        </div>

        {/* Rule 19: Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {/* الكل */}
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedFilter === 'all'
                ? 'bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-950 font-black shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <span>الكل</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              selectedFilter === 'all'
                ? 'bg-white/20 dark:bg-slate-900/20'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {statusCounts.all}
            </span>
          </button>

          {/* نفد */}
          <button
            onClick={() => setSelectedFilter('out_of_stock')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedFilter === 'out_of_stock'
                ? 'bg-red-600 text-white font-black shadow-xs'
                : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100 border border-red-200/60 dark:border-red-900/50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            <span>نفد</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-mono font-bold">
              {statusCounts.out_of_stock}
            </span>
          </button>

          {/* حرج */}
          <button
            onClick={() => setSelectedFilter('critical')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedFilter === 'critical'
                ? 'bg-orange-600 text-white font-black shadow-xs'
                : 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 hover:bg-orange-100 border border-orange-200/60 dark:border-orange-900/50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
            <span>حرج (1-9)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-mono font-bold">
              {statusCounts.critical}
            </span>
          </button>

          {/* قليل */}
          <button
            onClick={() => setSelectedFilter('low')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedFilter === 'low'
                ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 border border-amber-200/60 dark:border-amber-900/50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
            <span>قليل (10-19)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 font-mono font-bold">
              {statusCounts.low}
            </span>
          </button>

          {/* منخفض */}
          <button
            onClick={() => setSelectedFilter('moderate')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedFilter === 'moderate'
                ? 'bg-yellow-500 text-slate-950 font-black shadow-xs'
                : 'bg-yellow-50 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-300 hover:bg-yellow-100 border border-yellow-200/60 dark:border-yellow-900/50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
            <span>منخفض (20-{threshold - 1})</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 font-mono font-bold">
              {statusCounts.moderate}
            </span>
          </button>
        </div>
      </div>

      {/* 4. Products List / Grid or Empty State */}
      {displayItems.length === 0 ? (
        /* Rule 12: Empty State Message */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 sm:p-12 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 mx-auto flex items-center justify-center shadow-xs">
            <PackageCheck className="w-8 h-8" />
          </div>

          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              {searchQuery || selectedFilter !== 'all'
                ? 'لا توجد أصناف تطابق معايير البحث والفلتر الحالية'
                : '✅ لا توجد نواقص في المخزن حاليًا'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              {searchQuery || selectedFilter !== 'all'
                ? 'جرّب إلغاء الفلتر أو كتابة اسم صنف آخر للبحث عنه.'
                : `جميع المنتجات في المخزن متوفرة برصيد كافٍ (${threshold} كرتونة فأكثر) وفقاً لحد التنبيه المعتمد حالياً.`}
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={handleManualRefresh}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>إعادة الفحص والتحقق</span>
            </button>

            {onNavigateToSettings && (
              <button
                onClick={onNavigateToSettings}
                className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold transition-all flex items-center gap-1.5 border border-amber-500/30"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>تعديل حد التنبيه (حالياً: {threshold})</span>
              </button>
            )}
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* Rule 5 & 7 & 9: Cards Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {displayItems.map((item, index) => {
            const stock = item.stock ?? 0;
            const status = getStockStatus(stock, threshold);
            // Percentage of threshold
            const stockPct = Math.min(100, Math.max(0, Math.round((stock / threshold) * 100)));

            return (
              <div
                key={item.id}
                className={`bg-white dark:bg-slate-900 border-2 ${status.cardBorder} rounded-2xl p-4 transition-all shadow-xs hover:shadow-md flex flex-col justify-between space-y-3 relative overflow-hidden`}
              >
                {/* Ranking order badge (rule 9) */}
                <span className="absolute top-2 left-2 text-[10px] font-mono font-bold text-slate-400 dark:text-slate-600 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  #{index + 1}
                </span>

                {/* Top: Image, Category, Status Badge */}
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback icon on image failure
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Boxes className="w-6 h-6 text-slate-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      {/* Category */}
                      {item.category && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                          {item.category}
                        </span>
                      )}

                      {/* Rule 6: Status Badge */}
                      <span
                        className={`text-[11px] px-2.5 py-0.5 rounded-full border ${status.badgeBg} ${status.badgeText} ${status.badgeBorder} flex items-center gap-1`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor}`} />
                        <span>{status.label}</span>
                      </span>
                    </div>

                    {/* Product Name */}
                    <h3 className="font-black text-sm text-slate-900 dark:text-white leading-snug line-clamp-2">
                      {item.name}
                    </h3>

                    {/* Packaging & Unit (Rule 5) */}
                    {(item.packaging || item.unit) && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                        {item.packaging ? item.packaging : `الوحدة: ${item.unit || 'كرتونة'}`}
                      </p>
                    )}
                  </div>
                </div>

                {/* Middle: Prominent Stock Indicator (Rule 7) */}
                <div className={`p-3 rounded-xl border ${status.cardBg} ${status.cardBorder} space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      الرصيد الفعلي الحالي:
                    </span>
                    {/* Prominent display e.g. "بيبسي كان 300 مل — المتبقي: 12" */}
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      المتبقي:{' '}
                      <strong
                        className={`text-base font-black font-mono px-2 py-0.5 rounded-lg ${
                          stock === 0
                            ? 'bg-red-500 text-white'
                            : stock < 10
                            ? 'bg-orange-500 text-white'
                            : 'bg-amber-400 text-slate-950'
                        }`}
                      >
                        {stock}
                      </strong>{' '}
                      {item.unit || 'كرتونة'}
                    </span>
                  </div>

                  {/* Visual Progress Bar towards safety threshold */}
                  <div className="space-y-1">
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${status.dotColor}`}
                        style={{ width: `${Math.max(4, stockPct)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>0</span>
                      <span>حد الأمان: {threshold}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Card Controls: Quick Restock Button */}
                <div className="pt-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium font-mono">
                    {item.price > 0 ? `${item.price.toLocaleString('ar-EG')} ج.م` : ''}
                  </span>

                  <button
                    onClick={() => openRestockModal(item)}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-amber-400 dark:hover:bg-amber-300 text-white dark:text-slate-950 text-xs font-black transition-all flex items-center gap-1.5 shadow-2xs"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>تعديل المخزون</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Rule 5 & 7 & 9: Detailed Table View */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black">
                <tr>
                  <th className="p-3 w-10 text-center">#</th>
                  <th className="p-3">الصنف</th>
                  <th className="p-3">التصنيف والتعبئة</th>
                  <th className="p-3 text-center">الكمية الحالية</th>
                  <th className="p-3 text-center">حالة المخزون</th>
                  <th className="p-3 text-center">مستوى الأمان</th>
                  <th className="p-3 text-center">إجراء سريع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayItems.map((item, index) => {
                  const stock = item.stock ?? 0;
                  const status = getStockStatus(stock, threshold);
                  const stockPct = Math.min(100, Math.max(0, Math.round((stock / threshold) * 100)));

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="p-3 text-center font-mono font-bold text-slate-400">
                        {index + 1}
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <Boxes className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <span className="font-black text-slate-900 dark:text-white block">
                              {item.name}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {item.price > 0 ? `${item.price.toLocaleString('ar-EG')} ج.م` : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="p-3">
                        <span className="text-slate-700 dark:text-slate-200 font-bold block">
                          {item.category || 'عام'}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {item.packaging || item.unit || 'كرتونة'}
                        </span>
                      </td>

                      {/* Rule 7: Clear Quantity */}
                      <td className="p-3 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <span className="text-slate-500 text-[11px] font-medium">المتبقي:</span>
                          <span
                            className={`font-mono font-black text-sm px-2.5 py-0.5 rounded-lg ${
                              stock === 0
                                ? 'bg-red-500 text-white'
                                : stock < 10
                                ? 'bg-orange-500 text-white'
                                : 'bg-amber-400 text-slate-950'
                            }`}
                          >
                            {stock}
                          </span>
                          <span className="text-slate-600 dark:text-slate-300 text-xs font-bold">
                            {item.unit || 'كرتونة'}
                          </span>
                        </div>
                      </td>

                      {/* Rule 6: Status */}
                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border ${status.badgeBg} ${status.badgeText} ${status.badgeBorder}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor}`} />
                          <span>{status.label}</span>
                        </span>
                      </td>

                      {/* Safety Level Bar */}
                      <td className="p-3 text-center w-36">
                        <div className="space-y-1">
                          <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${status.dotColor}`}
                              style={{ width: `${Math.max(5, stockPct)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {stock} / {threshold}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="p-3 text-center">
                        <button
                          onClick={() => openRestockModal(item)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors flex items-center gap-1 mx-auto border border-slate-200 dark:border-slate-700"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-amber-500" />
                          <span>تعديل</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Quick Restock / Stock Adjustment Modal */}
      {restockProduct && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          dir="rtl"
          onClick={() => setRestockProduct(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-black">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                    تعديل رصيد المخزون
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    تزويد أو تصحيح الكمية الفعلية للصنف
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRestockProduct(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Product Summary */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 overflow-hidden shrink-0 flex items-center justify-center">
                {restockProduct.image ? (
                  <img
                    src={restockProduct.image}
                    alt={restockProduct.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Boxes className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-black text-sm text-slate-900 dark:text-white block truncate">
                  {restockProduct.name}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">
                  {restockProduct.category} • {restockProduct.packaging || restockProduct.unit || 'كرتونة'}
                </span>
              </div>
              <div className="text-left">
                <span className="text-[10px] text-slate-400 block">الرصيد الحالي</span>
                <span className="text-sm font-black font-mono text-red-500">
                  {restockProduct.stock ?? 0}
                </span>
              </div>
            </div>

            {/* Input Restock Amount */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                الكمية الجديدة بالمخزن ({restockProduct.unit || 'كرتونة'}):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={restockAmount}
                  onChange={(e) => setRestockAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="flex-1 bg-white dark:bg-slate-800 border-2 border-amber-400 rounded-xl px-4 py-3 text-lg font-black font-mono text-slate-900 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
                <span className="text-xs font-bold text-slate-500">
                  {restockProduct.unit || 'كرتونة'}
                </span>
              </div>

              {/* Fast increment buttons */}
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[11px] text-slate-500 font-medium">تزويد سريع:</span>
                {[+10, +25, +50, +100].map((inc) => (
                  <button
                    key={inc}
                    type="button"
                    onClick={() => setRestockAmount((prev) => Math.max(0, (Number(prev) || 0) + inc))}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-mono font-bold transition-colors"
                  >
                    +{inc}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setRestockAmount(threshold)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold transition-colors border border-amber-500/30"
                >
                  حد الأمان ({threshold})
                </button>
              </div>
            </div>

            {/* Note */}
            <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
              💡 عند حفظ كمية أكبر من أو تساوي {threshold}، سيتم ترفيع الصنف تلقائياً وإزالته من قائمة النواقص، وستنعكس الكمية فوراً في جميع شاشات الإدارة والمتجر.
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRestockProduct(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveRestock}
                disabled={isSavingRestock}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isSavingRestock ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>حفظ الكمية الجديدة</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
