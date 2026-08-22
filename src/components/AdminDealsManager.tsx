import React, { useState, useEffect } from 'react';
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
  ToggleLeft,
  ToggleRight,
  TrendingUp,
} from 'lucide-react';
import { DealCountdown } from './DealsCarousel';

interface AdminDealsManagerProps {
  products: Product[];
  sessionToken?: string;
  onRefreshProducts?: () => void;
}

export const AdminDealsManager: React.FC<AdminDealsManagerProps> = ({
  products,
  sessionToken,
  onRefreshProducts,
}) => {
  const [deals, setDeals] = useState<DealOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State for creating/editing deal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDealId, setEditingDealId] = useState<string | null>(null);

  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productSearch, setProductSearch] = useState('');
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

  // Fetch Deals from Server
  const fetchDeals = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/deals?role=admin', {
        headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {},
      });
      if (!res.ok) throw new Error('تعذر جلب العروض من الخادم');
      const data = await res.json();
      setDeals(data);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تحميل العروض');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeals();
  }, [sessionToken]);

  // When selected product changes in form, auto-populate original price, unit, category
  const handleSelectProduct = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      setOriginalPrice(prod.price);
      setOfferPrice(Math.round(prod.price * 0.9)); // default 10% off
      setUnit(prod.unit);
      setCategory(prod.category);
      // Try to parse brand from name if possible
      const words = prod.name.split(' ');
      if (words.length > 0) {
        setBrand(words[0]);
      }
    }
  };

  // Open Create Modal
  const openCreateModal = () => {
    setEditingDealId(null);
    setSelectedProductId('');
    setProductSearch('');
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
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (deal: DealOffer) => {
    setEditingDealId(deal.id);
    setSelectedProductId(deal.productId);
    setProductSearch('');
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
    setIsModalOpen(true);
  };

  // Save (Create or Update) Deal
  const handleSaveDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || offerPrice === '' || originalPrice === '') {
      setError('يرجى تحديد الصنف وسعر العرض والسعر الأصلي');
      return;
    }

    const prod = products.find((p) => p.id === selectedProductId);
    const prodName = prod ? prod.name : 'منتج';
    const prodImage = prod ? prod.image : '';

    const payload = {
      productId: selectedProductId,
      productName: prodName,
      productImage: prodImage,
      productBrand: brand,
      productSize: size,
      productUnit: unit,
      category,
      offerType,
      badgeText,
      offerPrice: Number(offerPrice),
      originalPrice: Number(originalPrice),
      startDate,
      endDate: endDate || null,
      description,
      targetType: 'all',
    };

    try {
      setError(null);
      const url = editingDealId ? `/api/deals/${editingDealId}` : '/api/deals';
      const method = editingDealId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'تعذر حفظ العرض');
      }

      setSuccessMsg(editingDealId ? 'تم تحديث بيانات العرض بنجاح' : 'تم إضافة العرض بنجاح للكتالوج');
      setTimeout(() => setSuccessMsg(null), 3000);
      setIsModalOpen(false);
      fetchDeals();
      if (onRefreshProducts) onRefreshProducts();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ العرض');
    }
  };

  // Toggle Active State
  const handleToggleActive = async (id: string) => {
    try {
      const res = await fetch(`/api/deals/${id}/toggle`, {
        method: 'PATCH',
        headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {},
      });
      if (res.ok) {
        fetchDeals();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Deal
  const handleDeleteDeal = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من رغبتك في حذف العرض الخاص بـ "${name}"؟`)) {
      return;
    }
    try {
      const res = await fetch(`/api/deals/${id}`, {
        method: 'DELETE',
        headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {},
      });
      if (res.ok) {
        setSuccessMsg('تم حذف العرض بنجاح');
        setTimeout(() => setSuccessMsg(null), 3000);
        fetchDeals();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filter products for dropdown
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.category.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 text-right">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/20">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">
              إدارة العروض والفرص الحصرية (🔥)
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              إنشاء عروض ترويجية، تحديد أسعار الكراتين المميزة، والخصومات محددة الوقت
            </p>
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="bg-emerald-800 hover:bg-emerald-900 text-white font-black text-xs px-4 py-2.5 rounded-2xl shadow-sm flex items-center justify-center gap-2 transition-transform active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>إنشاء عرض جديد</span>
        </button>
      </div>

      {/* Success / Error Messages */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-black p-3.5 rounded-2xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-300 text-rose-900 text-xs font-black p-3.5 rounded-2xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Deals Table / Cards */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400 font-medium">
          جاري تحميل قائمة العروض...
        </div>
      ) : deals.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <Flame className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-black text-slate-900">لا توجد عروض حالياً</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            اضغط على زر "إنشاء عرض جديد" لإضافة خصم أو سعر كرتونة مميز يظهر للعملاء في الصفحة الرئيسية.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deals.map((deal) => {
            const isDealExpired = deal.isExpired;
            return (
              <div
                key={deal.id}
                className={`bg-white border rounded-2xl p-4 shadow-sm space-y-3 flex flex-col justify-between transition-all ${
                  !deal.isActive || isDealExpired
                    ? 'border-slate-200 opacity-60 bg-slate-50/50'
                    : 'border-amber-200/90'
                }`}
              >
                {/* Card Top */}
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-flex items-center gap-1 bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-lg shadow-xs">
                    <Flame className="w-3 h-3" />
                    <span>{deal.badgeText}</span>
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleActive(deal.id)}
                      title={deal.isActive ? 'تعطيل العرض' : 'تفعيل العرض'}
                      className={`text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition-colors ${
                        deal.isActive
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {deal.isActive ? 'مفعل' : 'معطل'}
                    </button>

                    <button
                      onClick={() => openEditModal(deal)}
                      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                      title="تعديل"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteDeal(deal.id, deal.productName)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Product details */}
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-slate-100 rounded-xl overflow-hidden shrink-0 border border-slate-200 p-1 flex items-center justify-center">
                    <img
                      src={deal.productImage || 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=500'}
                      alt={deal.productName}
                      referrerPolicy="no-referrer"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <span className="text-[10px] text-slate-400 font-bold block truncate">
                      {deal.category} • {deal.productBrand || 'عام'}
                    </span>
                    <h4 className="text-xs font-black text-slate-900 truncate">
                      {deal.productName}
                    </h4>
                    {deal.productSize && (
                      <span className="text-[10px] text-slate-500 font-medium block">
                        الحجم: {deal.productSize}
                      </span>
                    )}
                  </div>
                </div>

                {/* Pricing info */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 flex items-center justify-between font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 font-medium block">سعر العرض:</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-black text-emerald-800">
                        {deal.offerPrice.toLocaleString('ar-EG')}
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold">ج.م / {deal.productUnit}</span>
                    </div>
                  </div>

                  <div className="text-left">
                    <span className="text-[10px] text-slate-400 line-through block">
                      {deal.originalPrice.toLocaleString('ar-EG')} ج.م
                    </span>
                    <span className="text-[10px] text-rose-600 font-bold block">
                      خصم {deal.discountPercentage}%
                    </span>
                  </div>
                </div>

                {/* Expiry info */}
                {deal.endDate && (
                  <div>
                    <DealCountdown endDate={deal.endDate} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-black text-slate-900">
                  {editingDealId ? 'تعديل بيانات العرض' : 'إنشاء عرض ترويجي جديد'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDeal} className="space-y-4">
              {/* Product Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اختر الصنف من الكتالوج *
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleSelectProduct(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                >
                  <option value="">-- اضغط لاختيار الصنف --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.price} ج.م / {p.unit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Offer Type & Badge Text */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    نوع العرض *
                  </label>
                  <select
                    value={offerType}
                    onChange={(e) => setOfferType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    نص الشارة (Badge)
                  </label>
                  <input
                    type="text"
                    value={badgeText}
                    onChange={(e) => setBadgeText(e.target.value)}
                    placeholder="مثال: 🔥 عرض الأسبوع"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Pricing: Original & Offer Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    السعر الأصلي (ج.م) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(e.target.value ? Number(e.target.value) : '')}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    سعر العرض للعميل (ج.م) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={offerPrice}
                    onChange={(e) => setOfferPrice(e.target.value ? Number(e.target.value) : '')}
                    required
                    className="w-full bg-emerald-50 border border-emerald-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Brand & Size */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الماركة / الشركة
                  </label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="مثال: بيبسي، كوكاكولا، شيبسي"
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
                    placeholder="مثال: 330 مل، 1 لتر، 50 جرام"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                  />
                </div>
              </div>

              {/* Start & End Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    تاريخ البدء
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
                    تاريخ الانتهاء (اختياري للعد التنازلي)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  وصف العرض أو ملاحظات
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="مثال: ساري حتى نفاد الكمية المخصصة للعرض..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-800"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black text-white bg-emerald-800 hover:bg-emerald-900 rounded-xl transition-all shadow-sm"
                >
                  {editingDealId ? 'حفظ التعديلات' : 'إضافة العرض'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
