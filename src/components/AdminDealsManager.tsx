import React, { useState, useEffect, useMemo } from 'react';
import { DealOffer, Product, OfferType } from '../types';
import {
  Flame,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  Search,
  Tag,
  Clock,
  Gift,
  Star,
  Package,
  Award,
  Calendar,
  AlertCircle,
  TrendingUp,
  RefreshCw,
  Percent,
  CheckCircle2,
  Eye,
  EyeOff,
  Filter,
  Sparkles,
  Layers,
  ArrowUpDown,
  AlertTriangle,
} from 'lucide-react';
import { DealCountdown } from './DealsCarousel';
import { apiFetch } from '../utils/api';

interface AdminDealsManagerProps {
  products?: Product[];
  sessionToken?: string;
  onRefreshProducts?: () => void;
  onRefreshData?: () => void;
}

export const AdminDealsManager: React.FC<AdminDealsManagerProps> = ({
  products = [],
  sessionToken,
  onRefreshProducts,
  onRefreshData,
}) => {
  const [deals, setDeals] = useState<DealOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'expired'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Form State for creating/editing deal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingDealId, setEditingDealId] = useState<string | null>(null);

  // Delete Confirmation Modal State
  const [deletingDeal, setDeletingDeal] = useState<DealOffer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form inputs
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productPickerSearch, setProductPickerSearch] = useState('');
  const [offerType, setOfferType] = useState<OfferType>('discount');
  const [badgeText, setBadgeText] = useState('🔥 عرض خاص');
  const [offerPrice, setOfferPrice] = useState<number | ''>('');
  const [originalPrice, setOriginalPrice] = useState<number | ''>('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [size, setSize] = useState('');
  const [unit, setUnit] = useState('كرتونة');
  const [category, setCategory] = useState('عام');
  const [image, setImage] = useState('');
  const [isActiveForm, setIsActiveForm] = useState(true);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') {
      setSuccessToast(msg);
      setTimeout(() => setSuccessToast(null), 3500);
    } else {
      setErrorToast(msg);
      setTimeout(() => setErrorToast(null), 4000);
    }
  };

  // Fetch Deals from Server Database
  const fetchDeals = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch('/api/deals?role=admin');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'تعذر جلب العروض من الخادم');
      }
      const data = await res.json();
      setDeals(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تحميل العروض');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeals();
  }, [sessionToken]);

  // Sync refresh helpers
  const triggerRefresh = () => {
    fetchDeals();
    if (onRefreshProducts) onRefreshProducts();
    if (onRefreshData) onRefreshData();
  };

  const safeProducts = Array.isArray(products) ? products : [];

  // When selected product changes in form, auto-populate original price, unit, category, image
  const handleSelectProduct = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = safeProducts.find((p) => p.id === prodId);
    if (prod) {
      setOriginalPrice(prod.price || 0);
      // Default to 10% discount if not already set
      if (!offerPrice) {
        const discounted = Math.max(1, Math.round((prod.price || 100) * 0.9));
        setOfferPrice(discounted);
      }
      setUnit(prod.unit || 'كرتونة');
      setCategory(prod.category || 'عام');
      setImage(prod.image || '');

      // Try to parse brand from packaging or name
      const words = (prod.name || '').split(' ');
      if (words.length > 0 && !brand) {
        setBrand(words[0]);
      }
    }
  };

  // Open Create Modal
  const openCreateModal = () => {
    setEditingDealId(null);
    setSelectedProductId('');
    setProductPickerSearch('');
    setOfferType('discount');
    setBadgeText('🔥 عرض خاص');
    setOfferPrice('');
    setOriginalPrice('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setDescription('');
    setBrand('');
    setSize('');
    setUnit('كرتونة');
    setCategory('عام');
    setImage('');
    setIsActiveForm(true);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (deal: DealOffer) => {
    setEditingDealId(deal.id);
    setSelectedProductId(deal.productId);
    setProductPickerSearch('');
    setOfferType(deal.offerType);
    setBadgeText(deal.badgeText);
    setOfferPrice(deal.offerPrice);
    setOriginalPrice(deal.originalPrice);
    setStartDate(deal.startDate ? deal.startDate.split('T')[0] : '');
    setEndDate(deal.endDate ? deal.endDate.split('T')[0] : '');
    setDescription(deal.description || '');
    setBrand(deal.productBrand || '');
    setSize(deal.productSize || '');
    setUnit(deal.productUnit || 'كرتونة');
    setCategory(deal.category || 'عام');
    setImage(deal.productImage || '');
    setIsActiveForm(deal.isActive);
    setIsModalOpen(true);
  };

  // Quick preset badges
  const BADGE_PRESETS = [
    '🔥 عرض خاص',
    '📦 سعر كرتونة سوبر',
    '⚡ خصم اليوم فقط',
    '🎁 اشتري بسعر الجملة',
    '⭐ تشكيلة جديدة',
    '🏆 الأكثر طلباً',
    '⏰ لفترة محدودة',
  ];

  // Quick End Date presets
  const applyDatePreset = (days: number | null) => {
    if (days === null) {
      setEndDate('');
      return;
    }
    const d = new Date();
    d.setDate(d.getDate() + days);
    setEndDate(d.toISOString().split('T')[0]);
  };

  // Live discount calculations
  const calculatedDiscount = useMemo(() => {
    const orig = Number(originalPrice);
    const off = Number(offerPrice);
    if (!orig || !off || orig <= 0 || off <= 0) return { pct: 0, savings: 0 };
    const diff = orig - off;
    const pct = Math.max(0, Math.round((diff / orig) * 100));
    return { pct, savings: Math.max(0, diff) };
  }, [originalPrice, offerPrice]);

  // Save (Create or Update) Deal
  const handleSaveDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      showToast('يرجى اختيار الصنف من القائمة', 'error');
      return;
    }
    if (offerPrice === '' || Number(offerPrice) <= 0) {
      showToast('يرجى كتابة سعر العرض بشكل صحيح', 'error');
      return;
    }
    if (originalPrice === '' || Number(originalPrice) <= 0) {
      showToast('يرجى كتابة السعر الأصلي بشكل صحيح', 'error');
      return;
    }

    const prod = safeProducts.find((p) => p.id === selectedProductId);
    const prodName = prod ? prod.name : 'منتج';
    const prodImage = image || (prod ? prod.image : '');

    const payload = {
      productId: selectedProductId,
      productName: prodName,
      productImage: prodImage,
      productBrand: brand.trim(),
      productSize: size.trim(),
      productUnit: unit.trim() || 'كرتونة',
      category: category.trim() || 'عام',
      offerType,
      badgeText: badgeText.trim() || '🔥 عرض خاص',
      offerPrice: Number(offerPrice),
      originalPrice: Number(originalPrice),
      startDate: startDate || new Date().toISOString().split('T')[0],
      endDate: endDate ? endDate : null,
      description: description.trim(),
      isActive: isActiveForm,
      targetType: 'all',
    };

    setIsSubmitting(true);
    try {
      const url = editingDealId ? `/api/deals/${editingDealId}` : '/api/deals';
      const method = editingDealId ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'تعذر حفظ العرض');
      }

      showToast(
        editingDealId ? '✅ تم تحديث بيانات العرض بنجاح' : '✅ تم إنشاء العرض وإضافته للكتالوج بنجاح',
        'success'
      );
      setIsModalOpen(false);
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message || 'حدث خطأ أثناء حفظ العرض', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Active State
  const handleToggleActive = async (id: string, currentStatus: boolean, name: string) => {
    try {
      // Optimistic update
      setDeals((prev) =>
        prev.map((d) => (d.id === id ? { ...d, isActive: !currentStatus } : d))
      );

      const res = await apiFetch(`/api/deals/${id}/toggle`, {
        method: 'PATCH',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'تعذر تعديل حالة العرض');
      }

      showToast(
        !currentStatus
          ? `🟢 تم تفعيل العرض لـ "${name}" (يظهر للعملاء الآن)`
          : `⚪ تم إيقاف العرض لـ "${name}" مؤقتاً`,
        'success'
      );
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message || 'فشل تغيير حالة العرض', 'error');
      fetchDeals(); // Revert
    }
  };

  // Delete Deal after confirmation
  const handleConfirmDelete = async () => {
    if (!deletingDeal) return;
    setIsDeleting(true);
    try {
      const res = await apiFetch(`/api/deals/${deletingDeal.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'تعذر حذف العرض');
      }

      showToast(`✅ تم حذف العرض الخاص بـ "${deletingDeal.productName}" بنجاح`, 'success');
      setDeletingDeal(null);
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message || 'حدث خطأ أثناء حذف العرض', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Products filtered for the picker inside modal
  const pickerFilteredProducts = useMemo(() => {
    if (!productPickerSearch.trim()) return safeProducts;
    const q = productPickerSearch.toLowerCase().trim();
    return safeProducts.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q)
    );
  }, [safeProducts, productPickerSearch]);

  // Filtered deals for listing
  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (deal.productName || '').toLowerCase().includes(q);
        const brandMatch = (deal.productBrand || '').toLowerCase().includes(q);
        const catMatch = (deal.category || '').toLowerCase().includes(q);
        const badgeMatch = (deal.badgeText || '').toLowerCase().includes(q);
        if (!nameMatch && !brandMatch && !catMatch && !badgeMatch) return false;
      }

      // Status
      if (statusFilter === 'active' && (!deal.isActive || deal.isExpired)) return false;
      if (statusFilter === 'inactive' && deal.isActive) return false;
      if (statusFilter === 'expired' && !deal.isExpired) return false;

      // Type
      if (typeFilter !== 'all' && deal.offerType !== typeFilter) return false;

      return true;
    });
  }, [deals, searchQuery, statusFilter, typeFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = deals.length;
    const active = deals.filter((d) => d.isActive && !d.isExpired).length;
    const inactive = deals.filter((d) => !d.isActive).length;
    const expired = deals.filter((d) => d.isExpired).length;
    const maxDiscount = deals.reduce((max, d) => Math.max(max, d.discountPercentage || 0), 0);
    return { total, active, inactive, expired, maxDiscount };
  }, [deals]);

  const getOfferTypeLabel = (type: OfferType) => {
    switch (type) {
      case 'discount':
        return { label: 'خصم خاص', icon: Flame, color: 'text-rose-600 bg-rose-50 border-rose-200' };
      case 'special_price':
        return { label: 'سعر خاص', icon: Gift, color: 'text-amber-700 bg-amber-50 border-amber-200' };
      case 'carton_deal':
        return { label: 'سعر كرتونة', icon: Package, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' };
      case 'new_product':
        return { label: 'منتج جديد', icon: Star, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
      case 'bestseller':
        return { label: 'الأكثر طلباً', icon: Award, color: 'text-yellow-800 bg-yellow-50 border-yellow-200' };
      case 'limited_time':
      default:
        return { label: 'لفترة محدودة', icon: Clock, color: 'text-orange-700 bg-orange-50 border-orange-200' };
    }
  };

  return (
    <div className="space-y-6 text-right pb-16" dir="rtl">
      {/* Toast Notifications */}
      {successToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-900/95 text-white px-5 py-3 rounded-2xl shadow-xl border border-emerald-500 flex items-center gap-2.5 text-xs sm:text-sm font-black animate-slideDown backdrop-blur-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {errorToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-rose-900/95 text-white px-5 py-3 rounded-2xl shadow-xl border border-rose-500 flex items-center gap-2.5 text-xs sm:text-sm font-black animate-slideDown backdrop-blur-xs">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorToast}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/60 rounded-3xl p-5 sm:p-6 shadow-xl text-white relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-80 h-36 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
              <Flame className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  إدارة العروض والفرص الحصرية (🔥)
                </h1>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-400/40 text-[10px] font-black px-2 py-0.5 rounded-full">
                  {stats.active} عرض نشط
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-1">
                تحديد أسعار الكراتين المميزة، الخصومات الحصرية، والعروض الموقوتة لتجار الجملة والتجزئة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={triggerRefresh}
              className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
              title="تحديث البيانات من السيرفر"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={openCreateModal}
              className="bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 font-black text-xs sm:text-sm px-4 py-2.5 rounded-2xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-transform active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ إضافة عرض جديد</span>
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-slate-700/60 font-mono">
          <div className="bg-slate-800/60 rounded-2xl p-2.5 border border-slate-700/40">
            <span className="text-[10px] text-slate-400 font-bold block">إجمالي العروض</span>
            <span className="text-base font-black text-white">{stats.total}</span>
          </div>

          <div className="bg-emerald-950/40 rounded-2xl p-2.5 border border-emerald-800/40">
            <span className="text-[10px] text-emerald-300 font-bold block">🟢 عروض مفعلة للعملاء</span>
            <span className="text-base font-black text-emerald-400">{stats.active}</span>
          </div>

          <div className="bg-slate-800/60 rounded-2xl p-2.5 border border-slate-700/40">
            <span className="text-[10px] text-slate-400 font-bold block">⚪ عروض متوقفة</span>
            <span className="text-base font-black text-slate-300">{stats.inactive}</span>
          </div>

          <div className="bg-amber-950/40 rounded-2xl p-2.5 border border-amber-800/40">
            <span className="text-[10px] text-amber-300 font-bold block">🔥 أعلى خصم متاح</span>
            <span className="text-base font-black text-amber-400">{stats.maxDiscount}%</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالصنف، الماركة، أو نص الشارة..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 rounded-2xl py-2.5 pr-10 pl-9 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl shrink-0 overflow-x-auto text-xs font-bold">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الكل ({deals.length})
            </button>

            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-300" />
              <span>المفعلة ({stats.active})</span>
            </button>

            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                statusFilter === 'inactive'
                  ? 'bg-white text-slate-900 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              المتوقفة ({stats.inactive})
            </button>

            {stats.expired > 0 && (
              <button
                onClick={() => setStatusFilter('expired')}
                className={`px-3 py-1.5 rounded-xl transition-all text-amber-700 ${
                  statusFilter === 'expired'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'hover:text-amber-800'
                }`}
              >
                منتهية الصلاحية ({stats.expired})
              </button>
            )}
          </div>
        </div>

        {/* Offer Type Chips Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 text-xs font-bold scrollbar-none">
          <span className="text-slate-400 text-[11px] shrink-0 pl-1">نوع العرض:</span>
          {[
            { key: 'all', label: 'جميع الأنواع' },
            { key: 'discount', label: '🔥 خصومات خاصة' },
            { key: 'special_price', label: '🎁 أسعار خاصة' },
            { key: 'carton_deal', label: '📦 أسعار كراتين' },
            { key: 'new_product', label: '⭐ منتجات جديدة' },
            { key: 'bestseller', label: '🏆 الأكثر طلباً' },
            { key: 'limited_time', label: '⏰ لفترة محدودة' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTypeFilter(t.key)}
              className={`px-2.5 py-1 rounded-xl whitespace-nowrap transition-colors text-[11px] ${
                typeFilter === t.key
                  ? 'bg-slate-800 text-white font-black'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Deals Cards Grid */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400 font-medium space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mx-auto" />
          <p>جاري تحميل قائمة العروض من قاعدة البيانات...</p>
        </div>
      ) : filteredDeals.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
            <Flame className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">
              {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                ? 'لا توجد عروض مطابقة للبحث أو التصفية'
                : 'لا توجد عروض ترويجية مسجلة حالياً'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              اضغط على زر "+ إضافة عرض جديد" لإنشاء خصومات حصرية أو تحديد أسعار خاصة للكرتونة تظهر للعملاء في الصفحة الرئيسية.
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-black rounded-2xl shadow-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء أول عرض الآن</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDeals.map((deal) => {
            const isDealExpired = Boolean(deal.isExpired);
            const typeInfo = getOfferTypeLabel(deal.offerType);
            const TypeIcon = typeInfo.icon;
            const savings = deal.originalPrice - deal.offerPrice;

            return (
              <div
                key={deal.id}
                className={`bg-white border rounded-3xl p-4 shadow-xs flex flex-col justify-between transition-all duration-200 hover:shadow-md relative overflow-hidden ${
                  !deal.isActive
                    ? 'border-slate-300 bg-slate-50/70 opacity-70'
                    : isDealExpired
                    ? 'border-amber-300 bg-amber-50/20'
                    : 'border-amber-200/90 ring-1 ring-amber-400/20'
                }`}
              >
                <div>
                  {/* Top Bar with Badge and Status */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 bg-amber-500 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-lg shadow-xs">
                        <Flame className="w-3 h-3" />
                        <span>{deal.badgeText || 'عرض خاص'}</span>
                      </span>

                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg border ${typeInfo.color}`}>
                        <TypeIcon className="w-3 h-3" />
                        <span>{typeInfo.label}</span>
                      </span>
                    </div>

                    {/* Active / Inactive Toggle Switch Button */}
                    <button
                      onClick={() => handleToggleActive(deal.id, deal.isActive, deal.productName)}
                      title={deal.isActive ? 'تعطيل العرض (إخفاءه عن العملاء)' : 'تفعيل العرض (إظهاره للعملاء)'}
                      className={`text-[11px] font-black px-2.5 py-1 rounded-xl flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer ${
                        deal.isActive
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${deal.isActive ? 'bg-white' : 'bg-slate-500'}`} />
                      <span>{deal.isActive ? 'مفعل 🟢' : 'متوقف ⚪'}</span>
                    </button>
                  </div>

                  {/* Product Details Block */}
                  <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                    <div className="w-14 h-14 bg-white rounded-xl overflow-hidden shrink-0 border border-slate-200 p-1 flex items-center justify-center">
                      <img
                        src={deal.productImage || 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=500'}
                        alt={deal.productName}
                        referrerPolicy="no-referrer"
                        className="max-h-full max-w-full object-contain"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1 truncate">
                        <span>{deal.category || 'عام'}</span>
                        {deal.productBrand && <span>• {deal.productBrand}</span>}
                      </div>
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 line-clamp-1">
                        {deal.productName}
                      </h4>
                      {deal.productSize && (
                        <span className="text-[10px] text-slate-500 font-medium block">
                          الحجم / العبوة: {deal.productSize}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pricing Box */}
                  <div className="mt-3 bg-gradient-to-r from-emerald-50/70 to-amber-50/40 border border-emerald-200/80 rounded-2xl p-3 flex items-center justify-between font-mono">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block">سعر العرض للعميل:</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-base sm:text-lg font-black text-emerald-800">
                          {deal.offerPrice.toLocaleString('ar-EG')}
                        </span>
                        <span className="text-[10px] text-slate-600 font-bold">ج.م / {deal.productUnit || 'كرتونة'}</span>
                      </div>
                    </div>

                    <div className="text-left">
                      <span className="text-[11px] text-slate-400 line-through block">
                        {deal.originalPrice.toLocaleString('ar-EG')} ج.م
                      </span>
                      <div className="flex items-center gap-1 text-[11px] font-black text-rose-600 justify-end">
                        <span>خصم {deal.discountPercentage || 0}%</span>
                        {savings > 0 && (
                          <span className="text-[9px] text-emerald-700 font-bold bg-emerald-100/80 px-1 py-0.5 rounded">
                            (وفّر {savings} ج)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Description / Notes */}
                  {deal.description && (
                    <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                      {deal.description}
                    </p>
                  )}

                  {/* Expiration or Countdown Timer */}
                  <div className="mt-2.5">
                    {deal.endDate ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>ينتهي في: {deal.endDate.split('T')[0]}</span>
                          </span>
                          {isDealExpired && (
                            <span className="text-rose-600 font-black">منتهي الصلاحية ⚠️</span>
                          )}
                        </div>
                        {!isDealExpired && <DealCountdown endDate={deal.endDate} />}
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3" />
                        <span>متاح ومستمر بدون تاريخ انتهاء محدد</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Bottom Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400">
                    أضيف بتاريخ: {deal.startDate ? deal.startDate.split('T')[0] : 'سابقاً'}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditModal(deal)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                      title="تعديل العرض"
                    >
                      <Edit className="w-3.5 h-3.5 text-slate-600" />
                      <span>تعديل</span>
                    </button>

                    <button
                      onClick={() => setDeletingDeal(deal)}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1 cursor-pointer border border-rose-200"
                      title="حذف العرض نهائياً"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>حذف</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 my-8 animate-scaleUp">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/20">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingDealId ? 'تعديل بيانات العرض الترويجي' : 'إنشاء وتفعيل عرض جديد'}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    سيظهر العرض فوراً للعملاء في الصفحة الرئيسية وقسم العروض
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDeal} className="space-y-4">
              {/* Product Selection */}
              <div>
                <label className="block text-xs font-black text-slate-800 mb-1.5">
                  اختر الصنف من الكتالوج *
                </label>

                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={productPickerSearch}
                      onChange={(e) => setProductPickerSearch(e.target.value)}
                      placeholder="🔍 ابحث في الأصناف للتحديد السريع..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pr-9 pl-3 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                  </div>

                  <select
                    value={selectedProductId}
                    onChange={(e) => handleSelectProduct(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  >
                    <option value="">-- اضغط لاختيار الصنف المراد عمل العرض عليه --</option>
                    {pickerFilteredProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — ({p.price} ج.م / {p.unit || 'كرتونة'}) [{p.category}]
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Offer Type & Custom Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-800 mb-1">
                    نوع العرض *
                  </label>
                  <select
                    value={offerType}
                    onChange={(e) => setOfferType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                  >
                    <option value="discount">🔥 خصم خاص (Discount)</option>
                    <option value="special_price">🎁 سعر خاص (Special Price)</option>
                    <option value="carton_deal">📦 سعر كرتونة مميز (Carton Deal)</option>
                    <option value="new_product">⭐ منتج جديد (New Product)</option>
                    <option value="bestseller">🏆 الأكثر طلبًا (Bestseller)</option>
                    <option value="limited_time">⏰ لفترة محدودة (Limited Time)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 mb-1">
                    نص الشارة (Badge)
                  </label>
                  <input
                    type="text"
                    value={badgeText}
                    onChange={(e) => setBadgeText(e.target.value)}
                    placeholder="مثال: 🔥 عرض الأسبوع"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Quick Badge Presets */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px] font-bold scrollbar-none">
                <span className="text-slate-400 shrink-0">مقترحات:</span>
                {BADGE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setBadgeText(preset)}
                    className={`px-2 py-0.5 rounded-lg border transition-colors shrink-0 ${
                      badgeText === preset
                        ? 'bg-amber-500 text-slate-950 border-amber-600'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* Pricing: Original & Offer Price + Live Calculation */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-800 mb-1">
                      السعر الأصلي (ج.م) *
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      value={originalPrice}
                      onChange={(e) => setOriginalPrice(e.target.value ? Number(e.target.value) : '')}
                      required
                      placeholder="مثال: 200"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-800 mb-1">
                      سعر العرض للعميل (ج.م) *
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={offerPrice}
                      onChange={(e) => setOfferPrice(e.target.value ? Number(e.target.value) : '')}
                      required
                      placeholder="مثال: 150"
                      className="w-full bg-emerald-50 border border-emerald-300 rounded-xl px-3 py-2 text-xs font-mono font-black text-emerald-950 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Calculation Preview */}
                {calculatedDiscount.pct > 0 && (
                  <div className="bg-emerald-100/70 border border-emerald-300 rounded-xl p-2.5 flex items-center justify-between text-xs font-bold text-emerald-900">
                    <span className="flex items-center gap-1">
                      <Percent className="w-3.5 h-3.5 text-emerald-700" />
                      <span>نسبة الخصم المحتسبة: {calculatedDiscount.pct}%</span>
                    </span>
                    <span>توفير للعميل: {calculatedDiscount.savings} ج.م</span>
                  </div>
                )}
              </div>

              {/* Brand, Size, Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الماركة / الشركة
                  </label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="مثال: بيبسي، شيبسي"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    حجم العبوة
                  </label>
                  <input
                    type="text"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    placeholder="مثال: 330 مل، 1 كجم"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    وحدة التسعير
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="كرتونة، لفة، باكت"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              {/* Start & End Dates */}
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      تاريخ بدء العرض
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      تاريخ انتهاء العرض (اختياري للعد التنازلي)
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                    />
                  </div>
                </div>

                {/* Quick Date Presets */}
                <div className="flex items-center gap-1.5 overflow-x-auto text-[10px] font-bold">
                  <span className="text-slate-400 shrink-0">مدة سريعة:</span>
                  <button
                    type="button"
                    onClick={() => applyDatePreset(3)}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700"
                  >
                    3 أيام
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset(7)}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700"
                  >
                    أسبوع
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset(15)}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700"
                  >
                    15 يوم
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset(30)}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700"
                  >
                    شهر كامل
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset(null)}
                    className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 rounded-lg text-amber-800"
                  >
                    مستمر بدون انتهاء
                  </button>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  وصف العرض أو شروط خاصة للعميل
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="مثال: خصم خاص لعملاء الجملة بمحافظة الإسكندرية، ساري حتى نفاد الكمية المخصصة..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Active Toggle Switch */}
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-3">
                <div>
                  <span className="text-xs font-black text-slate-900 block">حالة العرض المبدئية</span>
                  <span className="text-[11px] text-slate-500">
                    {isActiveForm ? '🟢 مفعل وسيظهر فوراً للعملاء في الكتالوج' : '⚪ متوقف ومخفي مؤقتاً عن العملاء'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsActiveForm(!isActiveForm)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                    isActiveForm
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-300 text-slate-700'
                  }`}
                >
                  {isActiveForm ? 'مفعل 🟢' : 'معطل ⚪'}
                </button>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 text-xs font-black text-white bg-emerald-800 hover:bg-emerald-900 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingDealId ? 'حفظ التعديلات' : 'إنشاء وتفعيل العرض'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingDeal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-rose-200 animate-scaleUp">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">تأكيد حذف العرض الترويجي</h3>
                <p className="text-xs text-slate-500">هذا الإجراء سيقوم بإلغاء العرض نهائياً من قاعدة البيانات</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1 text-xs">
              <div className="font-black text-slate-900">{deletingDeal.productName}</div>
              <div className="text-slate-500 font-mono">
                سعر العرض: <span className="font-bold text-emerald-800">{deletingDeal.offerPrice} ج.م</span> (السعر الأصلي: {deletingDeal.originalPrice} ج.م)
              </div>
            </div>

            <p className="text-xs text-rose-700 font-bold">
              هل أنت متأكد من رغبتك في حذف هذا العرض؟ سيعود الصنف لسعره الأصلي فوراً في المتجر.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingDeal(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                إلغاء التراجع
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري الحذف...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>نعم، احذف العرض</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
