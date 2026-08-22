import React, { useState } from 'react';
import { Product, Category } from '../types';
import {
  Package,
  Plus,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  CheckCircle,
  Search,
  CheckSquare,
  Square,
  AlertTriangle,
  X,
} from 'lucide-react';
import { apiFetch } from '../utils/api';

interface AdminProductsManagerProps {
  products: Product[];
  categories: Category[];
  onRefreshData: () => void;
}

export const AdminProductsManager: React.FC<AdminProductsManagerProps> = ({
  products,
  categories,
  onRefreshData,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'locked' | 'hidden'>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'lowStock' | 'outOfStock'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [quickStockEditProduct, setQuickStockEditProduct] = useState<Product | null>(null);
  const [quickStockValue, setQuickStockValue] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [statusActionLoading, setStatusActionLoading] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Filter products
  const filteredProducts = products.filter((p) => {
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && (p.status || 'open') !== statusFilter) return false;
    
    // Stock filter
    const threshold = p.lowStockThreshold || 5;
    const currentStock = p.stock ?? 0;
    if (stockFilter === 'lowStock' && (currentStock > threshold || currentStock <= 0)) return false;
    if (stockFilter === 'outOfStock' && currentStock > 0) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    }
    return true;
  });

  // Toggle single product selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Toggle select all filtered
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProducts.map((p) => p.id));
    }
  };

  // Single status toggle
  const handleStatusToggle = async (productId: string, newStatus: 'open' | 'locked' | 'hidden') => {
    setStatusActionLoading(productId);
    try {
      const res = await apiFetch(`/api/products/${productId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'تعذر تعديل حالة المنتج');
      } else {
        const label =
          newStatus === 'open'
            ? 'تم فتح الصنف للطلب بنجاح 🟢'
            : newStatus === 'locked'
            ? 'تم قفل الصنف بنجاح 🔒'
            : 'تم إخفاء الصنف من كتالوج العملاء 👁️';
        showToast(label);
        onRefreshData();
      }
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء تعديل حالة المنتج');
    } finally {
      setStatusActionLoading(null);
    }
  };

  // Delete single product
  const handleDeleteProduct = async (id: string) => {
    try {
      const res = await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setConfirmDeleteId(null);
        setSelectedIds((prev) => prev.filter((i) => i !== id));
        showToast('تم حذف المنتج من الكتالوج بنجاح');
        onRefreshData();
      } else {
        showToast('تعذر حذف المنتج');
      }
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء حذف المنتج');
    }
  };

  // Bulk Status Update
  const handleBulkStatus = async (status: 'open' | 'locked' | 'hidden') => {
    if (selectedIds.length === 0) return;
    try {
      const res = await apiFetch('/api/products/bulk/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, status }),
      });
      if (res.ok) {
        const label =
          status === 'open'
            ? `تم فتح ${selectedIds.length} منتج للطلب 🟢`
            : status === 'locked'
            ? `تم قفل ${selectedIds.length} منتج 🔒`
            : `تم إخفاء ${selectedIds.length} منتج عن العملاء 👁️`;
        showToast(label);
        setSelectedIds([]);
        onRefreshData();
      } else {
        showToast('تعذر التعديل الجماعي لحالة المنتجات');
      }
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء التعديل الجماعي');
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`هل أنت متأكد من حذف ${selectedIds.length} منتج نهائياً؟`)) return;
    try {
      const res = await apiFetch('/api/products/bulk/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (res.ok) {
        showToast(`تم حذف ${selectedIds.length} منتج بنجاح`);
        setSelectedIds([]);
        onRefreshData();
      } else {
        showToast('تعذر حذف المنتجات المحددة');
      }
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء الحذف');
    }
  };

  // Save product (Add or Edit)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct?.name || !editingProduct?.price) return;
    setLoading(true);

    try {
      const res = await apiFetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProduct),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setEditingProduct(null);
        onRefreshData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuickStock = async () => {
    if (!quickStockEditProduct) return;
    try {
      setLoading(true);
      const res = await apiFetch(`/api/products/${encodeURIComponent(quickStockEditProduct.id)}/stock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: quickStockValue }),
      });
      if (res.ok) {
        showToast(`تم تحديث مخزون "${quickStockEditProduct.name}" إلى ${quickStockValue} ${quickStockEditProduct.unit}`);
        setQuickStockEditProduct(null);
        onRefreshData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingProduct({
      name: '',
      category: categories[0]?.name || 'المشروبات والمياه',
      price: 100,
      unit: 'كرتونة',
      image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500',
      status: 'open',
      minQty: 1,
      maxQty: null,
      stock: 100,
      description: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct({ ...p });
    setIsModalOpen(true);
  };

  const openCount = products.filter((p) => p.status === 'open').length;
  const lockedCount = products.filter((p) => p.status === 'locked').length;
  const hiddenCount = products.filter((p) => p.status === 'hidden').length;

  return (
    <div className="space-y-4 text-right pb-16 relative" dir="rtl">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-bounce no-print">
          <div className="bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700 text-xs font-bold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-bold shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-800">
              إدارة المنتجات والمخزون وحالات العرض
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              شركة الحليم للتجارة والتوزيع — التحكم في الأسعار والكميات وقفل/فتح وإخفاء المنتجات
            </p>
          </div>
        </div>

        <button
          onClick={openAddModal}
          className="w-full md:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>+ إضافة منتج جديد للكتالوج</span>
        </button>
      </div>

      {/* Metrics Row / Status Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div
          onClick={() => setStatusFilter('all')}
          className={`border rounded-xl p-3 shadow-xs cursor-pointer transition-all ${
            statusFilter === 'all'
              ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-900/20'
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className={`text-[11px] font-medium ${statusFilter === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
            إجمالي المنتجات
          </div>
          <div className={`text-lg font-black ${statusFilter === 'all' ? 'text-white' : 'text-slate-800'}`}>
            {products.length}
          </div>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'open' ? 'all' : 'open')}
          className={`border rounded-xl p-3 shadow-xs cursor-pointer transition-all ${
            statusFilter === 'open'
              ? 'bg-emerald-700 text-white border-emerald-700 ring-2 ring-emerald-600/30'
              : 'bg-white border-emerald-200 hover:border-emerald-300'
          }`}
        >
          <div className={`text-[11px] font-bold ${statusFilter === 'open' ? 'text-emerald-100' : 'text-emerald-700'}`}>
            متاح للطلب 🟢
          </div>
          <div className={`text-lg font-black ${statusFilter === 'open' ? 'text-white' : 'text-emerald-800'}`}>
            {openCount}
          </div>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'locked' ? 'all' : 'locked')}
          className={`border rounded-xl p-3 shadow-xs cursor-pointer transition-all ${
            statusFilter === 'locked'
              ? 'bg-red-700 text-white border-red-700 ring-2 ring-red-600/30'
              : 'bg-white border-red-200 hover:border-red-300'
          }`}
        >
          <div className={`text-[11px] font-bold ${statusFilter === 'locked' ? 'text-red-100' : 'text-red-700'}`}>
            مقفل مؤقتاً 🔒
          </div>
          <div className={`text-lg font-black ${statusFilter === 'locked' ? 'text-white' : 'text-red-800'}`}>
            {lockedCount}
          </div>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'hidden' ? 'all' : 'hidden')}
          className={`border rounded-xl p-3 shadow-xs cursor-pointer transition-all ${
            statusFilter === 'hidden'
              ? 'bg-slate-700 text-white border-slate-700 ring-2 ring-slate-600/30'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className={`text-[11px] font-bold ${statusFilter === 'hidden' ? 'text-slate-200' : 'text-slate-600'}`}>
            مخفي عن العملاء 👁️
          </div>
          <div className={`text-lg font-black ${statusFilter === 'hidden' ? 'text-white' : 'text-slate-700'}`}>
            {hiddenCount}
          </div>
        </div>
      </div>

      {/* Search & Category Filter */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن اسم المنتج أو التصنيف..."
              className="w-full bg-slate-50 border border-gray-200 rounded-lg py-2 pr-9 pl-3 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white text-right"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 scrollbar-none text-xs">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1 rounded-md font-bold shrink-0 transition-all ${
                categoryFilter === 'all'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              كل الأقسام ({products.length})
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryFilter(c.name)}
                className={`px-3 py-1 rounded-md font-bold shrink-0 transition-all ${
                  categoryFilter === c.name
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter Banner if active */}
        {statusFilter !== 'all' && (
          <div className="flex items-center justify-between bg-slate-100 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-bold">
            <div className="flex items-center gap-1.5">
              <span>تصفية حسب الحالة:</span>
              <span className="text-emerald-800 font-black">
                {statusFilter === 'open' && '🟢 متاح للطلب فقط'}
                {statusFilter === 'locked' && '🔴 مقفل مؤقتاً فقط'}
                {statusFilter === 'hidden' && '👁️ مخفي عن العملاء فقط'}
              </span>
            </div>
            <button
              onClick={() => setStatusFilter('all')}
              className="text-slate-500 hover:text-slate-800 text-[11px] underline"
            >
              إلغاء تصفية الحالة
            </button>
          </div>
        )}

        {/* Bulk Action Bar (when selected) */}
        {selectedIds.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs animate-fadeIn">
            <div className="font-bold text-emerald-900 flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4 text-emerald-600" />
              <span>تم تحديد {selectedIds.length} منتج</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => handleBulkStatus('open')}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs flex items-center gap-1"
              >
                <span>🟢</span>
                <span>فتح للطلب</span>
              </button>
              <button
                onClick={() => handleBulkStatus('locked')}
                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs shadow-xs flex items-center gap-1"
              >
                <Lock className="w-3 h-3" />
                <span>قفل</span>
              </button>
              <button
                onClick={() => handleBulkStatus('hidden')}
                className="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-lg text-xs shadow-xs flex items-center gap-1"
              >
                <EyeOff className="w-3 h-3" />
                <span>إخفاء</span>
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold rounded-lg text-xs flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>حذف المحدد</span>
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="px-2 py-1 text-slate-500 hover:text-slate-800 text-xs"
              >
                إلغاء التحديد
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Products Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
        {products.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <Package className="w-12 h-12 mx-auto opacity-30 text-emerald-600" />
            <h3 className="font-bold text-base text-slate-800">قائمة المنتجات فارغة حالياً</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              تم إفراغ قاعدة البيانات بنجاح. يمكنك الآن البدء بإضافة المنتجات الجديدة وأسعارها ووحداتها.
            </p>
            <button
              onClick={openAddModal}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة أول منتج للكتالوج</span>
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            لا توجد منتجات تطابق البحث الحالي
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-gray-200">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <button
                      onClick={toggleSelectAll}
                      className="p-1 text-slate-500 hover:text-slate-800"
                      title="تحديد الكل"
                    >
                      {selectedIds.length === filteredProducts.length &&
                      filteredProducts.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </th>
                  <th className="p-3">المنتج</th>
                  <th className="p-3">التصنيف</th>
                  <th className="p-3">السعر والوحدة</th>
                  <th className="p-3">المخزون والتوريد</th>
                  <th className="p-3">حدود الكميات</th>
                  <th className="p-3">الحالة الحالية</th>
                  <th className="p-3 text-center">تغيير سريع</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((p) => {
                  const isSelected = selectedIds.includes(p.id);
                  const currentStock = p.stock !== undefined ? p.stock : 100;
                  const threshold = p.lowStockThreshold || 5;
                  const isOutOfStock = currentStock <= 0;
                  const isLowStock = !isOutOfStock && currentStock <= threshold;

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isSelected ? 'bg-emerald-50/40' : ''
                      } ${isOutOfStock ? 'bg-red-50/20' : isLowStock ? 'bg-amber-50/30' : ''}`}
                    >
                      <td className="p-3 text-center">
                        <button
                          onClick={() => toggleSelect(p.id)}
                          className="p-1 text-slate-400 hover:text-emerald-600"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                        </button>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={p.image}
                            alt={p.name}
                            className="w-9 h-9 rounded-md object-cover bg-slate-100 border border-gray-200 shrink-0"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 text-xs">{p.name}</span>
                              {isOutOfStock && (
                                <span className="px-1.5 py-0.2 rounded-md bg-red-100 text-red-700 text-[10px] font-black border border-red-200 flex items-center gap-0.5">
                                  <AlertTriangle className="w-2.5 h-2.5 text-red-600" />
                                  نفد المخزون
                                </span>
                              )}
                              {isLowStock && (
                                <span className="px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-900 text-[10px] font-black border border-amber-300 flex items-center gap-0.5 animate-pulse">
                                  <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                                  تنبيه توريد ({currentStock} {p.unit})
                                </span>
                              )}
                            </div>
                            {p.description && (
                              <div className="text-[10px] text-slate-400 line-clamp-1">
                                {p.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="p-3 font-semibold text-slate-600">{p.category}</td>

                      <td className="p-3">
                        <span className="font-black text-emerald-600 font-mono text-xs">
                          {(p.price || 0).toLocaleString('ar-EG')} ج.م
                        </span>
                        <span className="text-slate-400 text-[10px] block">لكل {p.unit}</span>
                      </td>

                      {/* Stock & Low Stock Indicator Column */}
                      <td className="p-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-xs text-slate-800">
                              {currentStock}
                            </span>
                            <span className="text-slate-500 text-[10px]">{p.unit}</span>
                            <button
                              onClick={() => {
                                setQuickStockEditProduct(p);
                                setQuickStockValue(currentStock);
                              }}
                              className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition-colors"
                              title="تعديل سريع لكمية المخزون"
                            >
                              تعديل
                            </button>
                          </div>

                          {isOutOfStock ? (
                            <div className="text-[10px] font-black text-red-600 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-600 inline-block"></span>
                              <span>غير متوفر بالمستودع</span>
                            </div>
                          ) : isLowStock ? (
                            <div className="text-[10px] font-black text-amber-700 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping inline-block"></span>
                              <span>منخفض (حد التوريد: {threshold})</span>
                            </div>
                          ) : (
                            <div className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block"></span>
                              <span>متوفر كافٍ</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="p-3 text-slate-600 text-[11px]">
                        <div>أقل: {p.minQty || 1}</div>
                        <div>أقصى: {p.maxQty === null ? 'مفتوح' : p.maxQty}</div>
                      </td>

                      <td className="p-3">
                        {p.status === 'open' && (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            🟢 متاح للطلب
                          </span>
                        )}
                        {p.status === 'locked' && (
                          <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            🔴 مقفل مؤقتاً
                          </span>
                        )}
                        {p.status === 'hidden' && (
                          <span className="bg-slate-100 text-slate-600 border border-gray-200 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <EyeOff className="w-3 h-3" />
                            👁️ مخفي
                          </span>
                        )}
                      </td>

                      {/* Quick toggles */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {statusActionLoading === p.id ? (
                            <span className="text-[10px] text-slate-400 font-bold animate-pulse">جاري الحفظ...</span>
                          ) : (
                            <>
                              {p.status === 'open' && (
                                <>
                                  <button
                                    onClick={() => handleStatusToggle(p.id, 'locked')}
                                    className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-bold inline-flex items-center gap-1 transition-all"
                                    title="قفل المنتج مؤقتاً بحيث لا يستطيع العملاء طلبه"
                                  >
                                    <Lock className="w-3 h-3" />
                                    <span>قفل</span>
                                  </button>
                                  <button
                                    onClick={() => handleStatusToggle(p.id, 'hidden')}
                                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-[11px] font-bold inline-flex items-center gap-1 transition-all"
                                    title="إخفاء المنتج تماماً عن كتالوج العملاء"
                                  >
                                    <EyeOff className="w-3 h-3" />
                                    <span>إخفاء</span>
                                  </button>
                                </>
                              )}

                              {p.status === 'locked' && (
                                <>
                                  <button
                                    onClick={() => handleStatusToggle(p.id, 'open')}
                                    className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 text-[11px] font-bold inline-flex items-center gap-1 transition-all"
                                    title="إلغاء القفل وفتح المنتج للطلب فوراً"
                                  >
                                    <Unlock className="w-3 h-3" />
                                    <span>فتح للطلب</span>
                                  </button>
                                  <button
                                    onClick={() => handleStatusToggle(p.id, 'hidden')}
                                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-[11px] font-bold inline-flex items-center gap-1 transition-all"
                                    title="إخفاء المنتج عن العملاء"
                                  >
                                    <EyeOff className="w-3 h-3" />
                                    <span>إخفاء</span>
                                  </button>
                                </>
                              )}

                              {p.status === 'hidden' && (
                                <>
                                  <button
                                    onClick={() => handleStatusToggle(p.id, 'open')}
                                    className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 text-[11px] font-bold inline-flex items-center gap-1 transition-all"
                                    title="إظهار المنتج وفتحه للطلب"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>إظهار وفتح</span>
                                  </button>
                                  <button
                                    onClick={() => handleStatusToggle(p.id, 'locked')}
                                    className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-bold inline-flex items-center gap-1 transition-all"
                                    title="إظهار المنتج كصنف مقفل"
                                  >
                                    <Lock className="w-3 h-3" />
                                    <span>قفل</span>
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>

                      {/* Edit & Delete actions */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-gray-200"
                            title="تعديل تفاصيل المنتج"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setConfirmDeleteId(p.id)}
                            className="p-1 bg-red-50 hover:bg-red-100 text-red-600 rounded border border-red-200"
                            title="حذف المنتج"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-gray-200 rounded-xl max-w-sm w-full p-5 text-right shadow-xl text-slate-800">
            <h4 className="font-bold text-sm text-slate-900 mb-2">تأكيد حذف المنتج</h4>
            <p className="text-xs text-slate-500 mb-4">
              هل أنت متأكد من رغبتك في حذف هذا المنتج نهائياً من الكتالوج؟
            </p>
            <div className="flex justify-end gap-2 text-xs font-bold">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={() => handleDeleteProduct(confirmDeleteId)}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >
                حذف المنتج
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isModalOpen && editingProduct && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-xl max-w-lg w-full p-5 text-right shadow-2xl text-slate-800 relative my-6">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 left-4 text-slate-400 hover:text-slate-700 text-lg font-bold p-1"
            >
              ✕
            </button>

            <h3 className="font-bold text-sm sm:text-base text-slate-800 mb-3 pb-2 border-b border-gray-100">
              {editingProduct.id ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد للكتالوج'}
            </h3>

            <form onSubmit={handleSaveProduct} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم المنتج:</label>
                <input
                  type="text"
                  required
                  value={editingProduct.name || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  placeholder="مثال: بيبسي كانز (صندوق × 24)"
                  className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white text-right font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">التصنيف:</label>
                  <select
                    value={editingProduct.category || categories[0]?.name}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, category: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white text-right font-medium"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">الوحدة (كرتونة / لفة / صندوق):</label>
                  <input
                    type="text"
                    required
                    value={editingProduct.unit || 'كرتونة'}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, unit: e.target.value })
                    }
                    placeholder="كرتونة / لفة / صندوق / قطعة"
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">السعر (جنيه مصري):</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    required
                    value={editingProduct.price || ''}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        price: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="120"
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-emerald-700 font-bold focus:outline-none focus:border-emerald-500 focus:bg-white text-right"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">المخزون الحالي:</label>
                  <input
                    type="number"
                    min={0}
                    value={editingProduct.stock ?? 100}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        stock: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-slate-800 font-bold focus:outline-none focus:border-emerald-500 focus:bg-white text-right"
                  />
                </div>
              </div>

              {/* Low Stock Warning Threshold */}
              <div className="bg-amber-50/60 p-2.5 rounded-lg border border-amber-200/80">
                <label className="block font-bold text-amber-900 mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>حد التنبيه لانخفاض المخزون (طلب توريد):</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={editingProduct.lowStockThreshold || 5}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        lowStockThreshold: Math.max(1, parseInt(e.target.value) || 5),
                      })
                    }
                    className="w-24 bg-white border border-amber-300 rounded-md p-1.5 text-slate-900 font-bold text-right"
                  />
                  <span className="text-[11px] text-amber-800">
                    وحدات ({editingProduct.unit || 'كرتونة'}) — يظهر تنبيه مرئي عند وصول المخزون لهذا الحد أو أقل
                  </span>
                </div>
              </div>

              {/* Quantity Limits */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-2.5 rounded-lg border border-gray-100">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">أقل كمية للطلب:</label>
                  <input
                    type="number"
                    min={1}
                    value={editingProduct.minQty || 1}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        minQty: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full bg-white border border-gray-200 rounded-md p-1.5 text-slate-800 text-right"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    أقصى كمية (اتركه فارغاً لبدون حد):
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editingProduct.maxQty ?? ''}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        maxQty: e.target.value ? parseInt(e.target.value) : null,
                      })
                    }
                    placeholder="بدون حد أقصى"
                    className="w-full bg-white border border-gray-200 rounded-md p-1.5 text-slate-800 text-right"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رابط الصورة (اختياري):</label>
                <input
                  type="text"
                  value={editingProduct.image || ''}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, image: e.target.value })
                  }
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-emerald-500 text-right text-[11px]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">حالة المنتج الأولية:</label>
                <select
                  value={editingProduct.status || 'open'}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      status: e.target.value as any,
                    })
                  }
                  className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-slate-800 text-right font-medium"
                >
                  <option value="open">🟢 متاح للطلب (Open)</option>
                  <option value="locked">🔴 مقفل مؤقتاً (Locked)</option>
                  <option value="hidden">👁️ مخفي عن العملاء (Hidden)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 font-bold text-xs hover:bg-slate-200"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs disabled:opacity-50"
                >
                  {loading ? 'جاري الحفظ...' : 'حفظ المنتج في الكتالوج'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Stock Adjustment Modal */}
      {quickStockEditProduct && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-sm w-full p-5 text-right shadow-2xl text-slate-800 relative animate-scaleUp">
            <button
              onClick={() => setQuickStockEditProduct(null)}
              className="absolute top-4 left-4 text-slate-400 hover:text-slate-700 p-1"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
              <Package className="w-5 h-5 text-emerald-600" />
              <div>
                <h4 className="font-bold text-sm text-slate-900">تعديل سريع لمخزون الصنف</h4>
                <p className="text-[11px] text-slate-500 line-clamp-1">{quickStockEditProduct.name}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  الكمية الفعلية المتاحة في المخزن ({quickStockEditProduct.unit || 'كرتونة'}):
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickStockValue(Math.max(0, quickStockValue - 5))}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 font-black text-slate-700 flex items-center justify-center text-sm"
                  >
                    -5
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickStockValue(Math.max(0, quickStockValue - 1))}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 font-black text-slate-700 flex items-center justify-center text-sm"
                  >
                    -1
                  </button>
                  <input
                    type="number"
                    min={0}
                    value={quickStockValue}
                    onChange={(e) => setQuickStockValue(Math.max(0, parseInt(e.target.value) || 0))}
                    className="flex-1 bg-slate-50 border-2 border-emerald-500 rounded-lg p-2 text-center font-mono font-black text-base text-slate-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setQuickStockValue(quickStockValue + 1)}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 font-black text-slate-700 flex items-center justify-center text-sm"
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickStockValue(quickStockValue + 10)}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 font-black text-slate-700 flex items-center justify-center text-sm"
                  >
                    +10
                  </button>
                </div>
              </div>

              {quickStockValue <= (quickStockEditProduct.lowStockThreshold || 5) && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 p-2 rounded-lg text-[11px] flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>تنبيه: هذه الكمية تقع تحت حد التوريد ({quickStockEditProduct.lowStockThreshold || 5} وحدات).</span>
                </div>
              )}

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setQuickStockEditProduct(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 font-bold text-xs hover:bg-slate-200"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSaveQuickStock}
                  disabled={loading}
                  className="px-5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs disabled:opacity-50"
                >
                  {loading ? 'جاري الحفظ...' : 'تحديث المخزون الآن'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
