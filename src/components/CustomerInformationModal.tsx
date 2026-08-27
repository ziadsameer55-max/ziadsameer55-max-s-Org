import React, { useState, useEffect, useMemo } from 'react';
import { InformationItem, InformationType, Product, User } from '../types';
import {
  Bell,
  X,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Sparkles,
  Megaphone,
  Truck,
  Clock,
  Search,
  Package,
  ShoppingCart,
  Check,
  ChevronRight,
  ExternalLink,
  Calendar,
} from 'lucide-react';
import { apiFetch } from '../utils/api';

interface CustomerInformationModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  products?: Product[];
  onAddToCart?: (product: Product, delta: number) => void;
  onOpenCart?: () => void;
  onUnreadCountChange?: (count: number) => void;
}

export const CustomerInformationModal: React.FC<CustomerInformationModalProps> = ({
  isOpen,
  onClose,
  user,
  products = [],
  onAddToCart,
  onOpenCart,
  onUnreadCountChange,
}) => {
  const [information, setInformation] = useState<InformationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchCustomerInfo = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('halim_session_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await apiFetch('/api/information', { headers });
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data.information) ? data.information : [];
        setInformation(items);
        const unread = items.filter((i: InformationItem) => !i.isRead).length;
        setUnreadCount(unread);
        onUnreadCountChange?.(unread);
      }
    } catch (err) {
      console.error('Error fetching customer information:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCustomerInfo();
    }
  }, [isOpen]);

  const markItemAsRead = async (item: InformationItem) => {
    if (item.isRead) return;

    try {
      // Optimistic update
      setInformation((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isRead: true } : i))
      );
      setUnreadCount((prev) => {
        const next = Math.max(0, prev - 1);
        onUnreadCountChange?.(next);
        return next;
      });

      const token = localStorage.getItem('halim_session_token');
      if (token) {
        await apiFetch(`/api/information/${item.id}/read`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (err) {
      console.error('Error marking item as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      setMarkingAll(true);
      // Optimistic update
      setInformation((prev) => prev.map((i) => ({ ...i, isRead: true })));
      setUnreadCount(0);
      onUnreadCountChange?.(0);

      const token = localStorage.getItem('halim_session_token');
      if (token) {
        await apiFetch('/api/information/read-all', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (err) {
      console.error('Error marking all as read:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  // Filter and search
  const filteredItems = useMemo(() => {
    return information.filter((item) => {
      if (activeFilter === 'price_change' && item.type !== 'price_change') return false;
      if (activeFilter === 'offer' && item.type !== 'offer') return false;
      if (activeFilter === 'general' && item.type !== 'general' && item.type !== 'policy' && item.type !== 'schedule')
        return false;
      if (activeFilter === 'unread' && item.isRead) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesContent = item.content.toLowerCase().includes(q);
        const matchesProduct = item.productName?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesContent && !matchesProduct) return false;
      }
      return true;
    });
  }, [information, activeFilter, searchQuery]);

  const handleOrderProduct = (item: InformationItem) => {
    if (!item.productId) return;
    const targetProd = products.find((p) => p.id === item.productId);
    if (targetProd && onAddToCart) {
      onAddToCart(targetProd, targetProd.minQty || 1);
      markItemAsRead(item);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-150" dir="rtl">
      <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Bell className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">المعلومات والتنبيهات</h2>
                {unreadCount > 0 && (
                  <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full font-mono">
                    {unreadCount} جديد
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">آخر تحديثات الأسعار، العروض، وإعلانات التوزيع المباشرة</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                disabled={markingAll}
                className="text-[11px] font-bold text-amber-400 hover:text-amber-300 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 px-2.5 py-1.5 rounded-xl transition flex items-center gap-1"
                title="تحديد الكل كمقروء"
              >
                <Check className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">تحديد الكل كمقروء</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Pills & Search */}
        <div className="p-3 bg-slate-950/70 border-b border-slate-800 space-y-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 ${
                activeFilter === 'all'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              الكل ({information.length})
            </button>
            <button
              onClick={() => setActiveFilter('price_change')}
              className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 flex items-center gap-1 ${
                activeFilter === 'price_change'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              تغييرات الأسعار
            </button>
            <button
              onClick={() => setActiveFilter('offer')}
              className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 flex items-center gap-1 ${
                activeFilter === 'offer'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              العروض والخصومات
            </button>
            <button
              onClick={() => setActiveFilter('general')}
              className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 flex items-center gap-1 ${
                activeFilter === 'general'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Megaphone className="w-3.5 h-3.5" />
              إعلانات وسياسات
            </button>
            {unreadCount > 0 && (
              <button
                onClick={() => setActiveFilter('unread')}
                className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 ${
                  activeFilter === 'unread'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'bg-slate-800 text-amber-300'
                }`}
              >
                غير المقروء ({unreadCount})
              </button>
            )}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث في الإعلانات والتنبيهات..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-4 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-600 transition"
            />
          </div>
        </div>

        {/* Content List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-slate-500">
              <Bell className="w-8 h-8 animate-spin mx-auto text-amber-400 mb-2" />
              <p className="text-xs">جاري تحديث المعلومات والتنبيهات...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-300">لا توجد تنبيهات جديدة</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                أنت مطلع على جميع المعلومات وتحديثات الأسعار الصادرة من شركة الحليم للتجارة والتوزيع.
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const isUnread = !item.isRead;

              return (
                <div
                  key={item.id}
                  onClick={() => markItemAsRead(item)}
                  className={`p-4 rounded-2xl border transition relative cursor-pointer ${
                    isUnread
                      ? 'bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border-amber-500/40 shadow-md'
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  {/* Unread dot */}
                  {isUnread && (
                    <span className="absolute top-4 left-4 w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                  )}

                  {/* Header Row */}
                  <div className="flex items-center gap-2 mb-2">
                    {item.type === 'price_change' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        <TrendingDown className="w-3 h-3" />
                        تحديث سعر
                      </span>
                    )}
                    {item.type === 'offer' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 border border-red-500/30">
                        <Sparkles className="w-3 h-3" />
                        عرض خاص
                      </span>
                    )}
                    {item.type === 'warning' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        <AlertCircle className="w-3 h-3" />
                        تنبيه عاجل
                      </span>
                    )}
                    {item.type === 'policy' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        <Truck className="w-3 h-3" />
                        توزيع وخطوط سير
                      </span>
                    )}
                    {item.type === 'schedule' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        <Clock className="w-3 h-3" />
                        مواعيد
                      </span>
                    )}
                    {item.type === 'general' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <Megaphone className="w-3 h-3" />
                        إعلان رسمي
                      </span>
                    )}

                    <span className="text-[10px] text-slate-500 mr-auto flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      {new Date(item.publishedAt).toLocaleDateString('ar-EG', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-bold text-white mb-1.5 leading-snug">{item.title}</h3>

                  {/* Product Price Change Spotlight (Interactive Card) */}
                  {item.productId && (
                    <div className="my-2.5 bg-slate-900 border border-slate-700/80 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        {item.productImage && (
                          <img
                            src={item.productImage}
                            alt={item.productName || 'صنف'}
                            className="w-11 h-11 object-cover rounded-lg border border-slate-700 shrink-0"
                          />
                        )}
                        <div>
                          <p className="text-xs font-bold text-white">{item.productName}</p>
                          <p className="text-[10px] text-slate-400">الوحدة: {item.productUnit || 'كرتونة'}</p>
                        </div>
                      </div>

                      {item.newPrice !== null && (
                        <div className="flex items-center gap-2 mr-auto">
                          {item.oldPrice !== null && item.oldPrice !== undefined && (
                            <span className="text-slate-500 line-through text-[11px]">
                              {item.oldPrice} ج.م
                            </span>
                          )}
                          <span className="text-emerald-400 font-black text-sm bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                            {item.newPrice} ج.م
                          </span>

                          {onAddToCart && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOrderProduct(item);
                              }}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm transition active:scale-95"
                            >
                              <ShoppingCart className="w-3.5 h-3.5" />
                              <span>طلب الصنف</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Text Content */}
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{item.content}</p>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950/80 border-t border-slate-800 text-center text-[11px] text-slate-400 flex items-center justify-between px-4">
          <span>شركة الحليم للتجارة والتوزيع • خدمة العملاء</span>
          <button
            onClick={onClose}
            className="text-emerald-400 hover:text-emerald-300 font-bold"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
