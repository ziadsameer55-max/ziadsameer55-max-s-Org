import React, { useState, useEffect, useMemo } from 'react';
import { InformationItem, InformationType, InformationPriority, InformationStatus, Product, User } from '../types';
import {
  Bell,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  Search,
  Tag,
  Clock,
  Calendar,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Percent,
  CheckCircle2,
  Eye,
  Filter,
  Layers,
  Sparkles,
  ShieldCheck,
  Users,
  Package,
  Megaphone,
  Truck,
  ArrowRight,
  Info,
  Archive,
} from 'lucide-react';
import { apiFetch } from '../utils/api';

interface AdminInformationManagerProps {
  products?: Product[];
  sessionToken?: string;
  onRefreshData?: () => void;
}

export const AdminInformationManager: React.FC<AdminInformationManagerProps> = ({
  products = [],
  sessionToken,
  onRefreshData,
}) => {
  const [informationList, setInformationList] = useState<InformationItem[]>([]);
  const [customers, setCustomers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InformationItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formType, setFormType] = useState<InformationType>('general');
  const [formPriority, setFormPriority] = useState<InformationPriority>('normal');
  const [formTargetType, setFormTargetType] = useState<'all' | 'specific_customer' | 'group'>('all');
  const [formTargetId, setFormTargetId] = useState<string>('');
  const [formProductId, setFormProductId] = useState<string>('');
  const [formOldPrice, setFormOldPrice] = useState<string>('');
  const [formNewPrice, setFormNewPrice] = useState<string>('');
  const [formStatus, setFormStatus] = useState<InformationStatus>('published');
  const [formExpiresAt, setFormExpiresAt] = useState<string>('');

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchInformation = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch('/api/information', {
        headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setInformationList(Array.isArray(data.information) ? data.information : []);
      } else {
        setError('تعذر تحميل سجلات المعلومات من الخادم');
      }
    } catch (err: any) {
      console.error('Error fetching information:', err);
      setError('حدث خطأ أثناء الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await apiFetch('/api/customers', {
        headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setCustomers(Array.isArray(data) ? data : Array.isArray(data.customers) ? data.customers : []);
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  };

  useEffect(() => {
    fetchInformation();
    fetchCustomers();
  }, []);

  const showToast = (msg: string, isError = false) => {
    if (isError) {
      setErrorToast(msg);
      setTimeout(() => setErrorToast(null), 4000);
    } else {
      setSuccessToast(msg);
      setTimeout(() => setSuccessToast(null), 3500);
    }
  };

  const resetForm = () => {
    setFormTitle('');
    setFormContent('');
    setFormType('general');
    setFormPriority('normal');
    setFormTargetType('all');
    setFormTargetId('');
    setFormProductId('');
    setFormOldPrice('');
    setFormNewPrice('');
    setFormStatus('published');
    setFormExpiresAt('');
    setEditingItem(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (item: InformationItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormContent(item.content);
    setFormType(item.type);
    setFormPriority(item.priority);
    setFormTargetType(item.targetType || 'all');
    setFormTargetId(item.targetId || '');
    setFormProductId(item.productId || '');
    setFormOldPrice(item.oldPrice !== null && item.oldPrice !== undefined ? String(item.oldPrice) : '');
    setFormNewPrice(item.newPrice !== null && item.newPrice !== undefined ? String(item.newPrice) : '');
    setFormStatus(item.status);
    setFormExpiresAt(item.expiresAt ? item.expiresAt.substring(0, 10) : '');
    setIsModalOpen(true);
  };

  // Handle auto-population when selecting a product
  const handleProductSelect = (prodId: string) => {
    setFormProductId(prodId);
    if (!prodId) return;

    const selectedProduct = products.find((p) => p.id === prodId);
    if (selectedProduct) {
      if (!formOldPrice) {
        setFormOldPrice(String(selectedProduct.price));
      }
      if (formType === 'price_change') {
        if (!formTitle || formTitle.includes('تحديث سعر')) {
          setFormTitle(`تحديث سعر: ${selectedProduct.name}`);
        }
      }
    }
  };

  const calculatedPctChange = useMemo(() => {
    const oldP = parseFloat(formOldPrice);
    const newP = parseFloat(formNewPrice);
    if (!isNaN(oldP) && !isNaN(newP) && oldP > 0) {
      return Math.round(((newP - oldP) / oldP) * 100);
    }
    return null;
  }, [formOldPrice, formNewPrice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) {
      showToast('يرجى ملء عنوان ونص المعلومة', true);
      return;
    }

    setIsSubmitting(true);

    try {
      const targetCustomer = customers.find((c) => c.id === formTargetId);
      const selectedProduct = products.find((p) => p.id === formProductId);

      const payload = {
        title: formTitle.trim(),
        content: formContent.trim(),
        type: formType,
        priority: formPriority,
        targetType: formTargetType,
        targetId: formTargetType === 'specific_customer' ? formTargetId : null,
        targetName: formTargetType === 'specific_customer' ? (targetCustomer?.fullName || targetCustomer?.storeName || null) : null,
        productId: formProductId || null,
        productName: selectedProduct?.name || null,
        productImage: selectedProduct?.image || null,
        productUnit: selectedProduct?.unit || null,
        oldPrice: formOldPrice ? parseFloat(formOldPrice) : null,
        newPrice: formNewPrice ? parseFloat(formNewPrice) : null,
        priceChangePercentage: calculatedPctChange,
        status: formStatus,
        expiresAt: formExpiresAt ? new Date(formExpiresAt + 'T23:59:59').toISOString() : null,
      };

      const url = editingItem ? `/api/information/${editingItem.id}` : '/api/information';
      const method = editingItem ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(editingItem ? 'تم تحديث المعلومة بنجاح ✅' : 'تم نشر المعلومة والتنبيه بنجاح 🔔');
        setIsModalOpen(false);
        resetForm();
        fetchInformation();
        onRefreshData?.();
      } else {
        showToast(data.error || 'فشلت العملية، يرجى التحقق من البيانات', true);
      }
    } catch (err) {
      console.error('Error saving information:', err);
      showToast('حدث خطأ أثناء الحفظ', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (item: InformationItem) => {
    try {
      const nextStatus: InformationStatus =
        item.status === 'published' ? 'draft' : item.status === 'draft' ? 'archived' : 'published';

      const res = await apiFetch(`/api/information/${item.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.ok) {
        showToast(`تم تغيير الحالة إلى: ${getStatusLabel(nextStatus)}`);
        fetchInformation();
      } else {
        showToast('تعذر تغيير حالة المعلومة', true);
      }
    } catch (err) {
      showToast('حدث خطأ أثناء تغيير الحالة', true);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await apiFetch(`/api/information/${id}`, {
        method: 'DELETE',
        headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {},
      });

      if (res.ok) {
        showToast('تم حذف المعلومة وسجل قراءاتها بنجاح 🗑️');
        setDeleteConfirmId(null);
        fetchInformation();
        onRefreshData?.();
      } else {
        showToast('تعذر حذف المعلومة', true);
      }
    } catch (err) {
      showToast('حدث خطأ أثناء الحذف', true);
    }
  };

  // Filtered List
  const filteredList = useMemo(() => {
    return informationList.filter((item) => {
      // Type
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      // Status
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      // Priority
      if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false;
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesContent = item.content.toLowerCase().includes(q);
        const matchesProduct = item.productName?.toLowerCase().includes(q);
        const matchesTarget = item.targetName?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesContent && !matchesProduct && !matchesTarget) return false;
      }
      return true;
    });
  }, [informationList, typeFilter, statusFilter, priorityFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = informationList.length;
    const published = informationList.filter((i) => i.status === 'published').length;
    const priceChanges = informationList.filter((i) => i.type === 'price_change').length;
    const totalReads = informationList.reduce((acc, curr) => acc + (curr.readCount || 0), 0);
    return { total, published, priceChanges, totalReads };
  }, [informationList]);

  const getTypeBadge = (type: InformationType) => {
    switch (type) {
      case 'price_change':
        return {
          label: 'تغيير أسعار 📉',
          bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          icon: TrendingDown,
        };
      case 'offer':
        return {
          label: 'عرض خاص 🔥',
          bg: 'bg-red-500/10 text-red-400 border-red-500/30',
          icon: Sparkles,
        };
      case 'warning':
        return {
          label: 'تنبيه هام ⚠️',
          bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          icon: AlertCircle,
        };
      case 'policy':
        return {
          label: 'سياسة وتوزيع 🚚',
          bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
          icon: Truck,
        };
      case 'schedule':
        return {
          label: 'مواعيد العمل ⏰',
          bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
          icon: Clock,
        };
      default:
        return {
          label: 'إعلان عام 📢',
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          icon: Megaphone,
        };
    }
  };

  const getPriorityBadge = (priority: InformationPriority) => {
    switch (priority) {
      case 'urgent':
        return { label: 'عاجل جداً', color: 'bg-red-600 text-white' };
      case 'high':
        return { label: 'أولوية عالية', color: 'bg-amber-500 text-slate-950 font-bold' };
      default:
        return { label: 'عادي', color: 'bg-slate-700 text-slate-300' };
    }
  };

  const getStatusLabel = (status: InformationStatus) => {
    switch (status) {
      case 'published':
        return 'منشور ✅';
      case 'draft':
        return 'مسودة 📝';
      case 'archived':
        return 'مؤرشف 📁';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notifications */}
      {successToast && (
        <div className="fixed bottom-5 left-5 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-emerald-400 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-100" />
          <span className="font-bold text-sm">{successToast}</span>
        </div>
      )}

      {errorToast && (
        <div className="fixed bottom-5 left-5 z-50 bg-rose-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-rose-400">
          <AlertCircle className="w-5 h-5 text-rose-100" />
          <span className="font-bold text-sm">{errorToast}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-72 h-72 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Bell className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white flex items-center gap-2">
                  مركز المعلومات والتنبيهات
                  <span className="text-xs bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30 font-medium">
                    لوحة الإعلانات الرسمية
                  </span>
                </h1>
                <p className="text-slate-400 text-sm">
                  إرسال وتتبع الإعلانات وتنبيهات تحديث الأسعار وسياسات التوزيع للعملاء فورياً
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchInformation}
              title="تحديث البيانات"
              className="p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black px-5 py-2.5 rounded-xl shadow-lg shadow-amber-500/20 transition transform active:scale-95"
            >
              <Plus className="w-5 h-5" />
              <span>إضافة معلومة جديدة</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800">
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">إجمالي المعلومات</p>
              <p className="text-xl font-black text-white mt-0.5">{stats.total}</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">المعلومات المنشورة</p>
              <p className="text-xl font-black text-emerald-400 mt-0.5">{stats.published}</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">تحديثات الأسعار</p>
              <p className="text-xl font-black text-amber-400 mt-0.5">{stats.priceChanges}</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">إجمالي مشاهدات العملاء</p>
              <p className="text-xl font-black text-blue-400 mt-0.5">{stats.totalReads}</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Eye className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث في عنوان المعلومة، المحتوى، أو الصنف..."
              className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl pr-10 pl-4 py-2 text-sm focus:outline-none focus:border-amber-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Type Filter Select */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            >
              <option value="all">كل الأنواع</option>
              <option value="general">إعلانات عامة 📢</option>
              <option value="price_change">تغيير أسعار 📉</option>
              <option value="offer">عروض خاصة 🔥</option>
              <option value="warning">تنبيهات هامة ⚠️</option>
              <option value="policy">سياسات وتوزيع 🚚</option>
              <option value="schedule">مواعيد عمل ⏰</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            >
              <option value="all">كل الحالات</option>
              <option value="published">منشور فقط</option>
              <option value="draft">مسودات</option>
              <option value="archived">مؤرشف</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            >
              <option value="all">كل الأولويات</option>
              <option value="urgent">عاجل</option>
              <option value="high">عالية</option>
              <option value="normal">عادية</option>
            </select>
          </div>
        </div>
      </div>

      {/* List of Information Items */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-400 mb-3" />
          <p>جاري تحميل سجلات المعلومات والتنبيهات...</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
          <Bell className="w-12 h-12 mx-auto text-slate-600 mb-2" />
          <h3 className="text-lg font-bold text-white">لا توجد معلومات مطابقة</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            لم يتم العثور على أي معلومات مسجلة تطابق الفلاتر الحالية. يمكنك نشر معلومة أو تنبيه جديد للعملاء الآن.
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-sm transition mt-2"
          >
            <Plus className="w-4 h-4" />
            <span>نشر معلومة جديدة</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredList.map((item) => {
            const typeBadge = getTypeBadge(item.type);
            const priorityBadge = getPriorityBadge(item.priority);
            const TypeIcon = typeBadge.icon;

            const readPercentage =
              item.totalTargetCount && item.totalTargetCount > 0
                ? Math.min(100, Math.round(((item.readCount || 0) / item.totalTargetCount) * 100))
                : 0;

            return (
              <div
                key={item.id}
                className={`bg-slate-900 border rounded-2xl p-5 transition hover:border-slate-600 shadow-md ${
                  item.priority === 'urgent'
                    ? 'border-red-500/40 bg-gradient-to-r from-red-950/20 via-slate-900 to-slate-900'
                    : item.status === 'draft'
                    ? 'border-dashed border-slate-700 opacity-80'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  {/* Left Column (Details) */}
                  <div className="flex-1 space-y-3">
                    {/* Badges Bar */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold ${typeBadge.bg}`}
                      >
                        <TypeIcon className="w-3.5 h-3.5" />
                        {typeBadge.label}
                      </span>

                      {item.priority !== 'normal' && (
                        <span className={`px-2 py-0.5 rounded-md text-xs ${priorityBadge.color}`}>
                          {priorityBadge.label}
                        </span>
                      )}

                      <span
                        className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                          item.status === 'published'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : item.status === 'draft'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {getStatusLabel(item.status)}
                      </span>

                      {item.targetType === 'specific_customer' ? (
                        <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          خاص بالعميل: {item.targetName || item.targetId}
                        </span>
                      ) : (
                        <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          لكافة العملاء
                        </span>
                      )}

                      <span className="text-slate-500 text-xs flex items-center gap-1 mr-auto">
                        <Clock className="w-3 h-3" />
                        {new Date(item.publishedAt).toLocaleString('ar-EG', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">{item.title}</h3>

                    {/* Product Price Tag Box (If Price Change) */}
                    {item.productId && (
                      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-center gap-4 flex-wrap">
                        {item.productImage && (
                          <img
                            src={item.productImage}
                            alt={item.productName || 'صنف'}
                            className="w-12 h-12 object-cover rounded-lg border border-slate-700"
                          />
                        )}
                        <div className="flex-1 min-w-[150px]">
                          <p className="text-sm font-bold text-white flex items-center gap-1.5">
                            <Package className="w-4 h-4 text-amber-400" />
                            {item.productName}
                          </p>
                          <p className="text-xs text-slate-400">الوحدة: {item.productUnit || 'كرتونة'}</p>
                        </div>

                        {item.newPrice !== null && item.newPrice !== undefined && (
                          <div className="flex items-center gap-3 text-sm">
                            {item.oldPrice !== null && item.oldPrice !== undefined && (
                              <div className="text-slate-400 line-through text-xs">
                                {item.oldPrice.toLocaleString('ar-EG')} ج.م
                              </div>
                            )}
                            <div className="text-emerald-400 font-black text-base bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                              {item.newPrice.toLocaleString('ar-EG')} ج.م
                            </div>
                            {item.priceChangePercentage !== null && item.priceChangePercentage !== undefined && (
                              <span
                                className={`text-xs px-2 py-0.5 rounded font-bold flex items-center gap-0.5 ${
                                  item.priceChangePercentage < 0
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-rose-500/20 text-rose-300'
                                }`}
                              >
                                {item.priceChangePercentage < 0 ? (
                                  <TrendingDown className="w-3 h-3" />
                                ) : (
                                  <TrendingUp className="w-3 h-3" />
                                )}
                                {Math.abs(item.priceChangePercentage)}%
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Content */}
                    <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">{item.content}</p>

                    {/* Read Reach Stats Bar */}
                    <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-800/80 text-xs text-slate-400">
                      <div className="flex items-center gap-2">
                        <Eye className="w-3.5 h-3.5 text-blue-400" />
                        <span>
                          تمت المشاهدة من{' '}
                          <strong className="text-white font-bold">{item.readCount || 0}</strong> عميل
                        </span>
                        {item.totalTargetCount ? (
                          <span className="text-slate-500">
                            (من أصل {item.totalTargetCount} عميل - {readPercentage}%)
                          </span>
                        ) : null}
                      </div>

                      {item.expiresAt && (
                        <span className="text-amber-400/80 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          تاريخ الانتهاء: {new Date(item.expiresAt).toLocaleDateString('ar-EG')}
                        </span>
                      )}

                      <span className="text-slate-500">الناشر: {item.createdBy || 'الإدارة'}</span>
                    </div>
                  </div>

                  {/* Right Column (Actions) */}
                  <div className="flex md:flex-col items-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-slate-800 justify-end">
                    <button
                      onClick={() => handleToggleStatus(item)}
                      title="تغيير حالة النشر"
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                    >
                      {item.status === 'published' ? (
                        <Archive className="w-4 h-4 text-amber-400" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      )}
                    </button>

                    <button
                      onClick={() => openEditModal(item)}
                      title="تعديل المعلومة"
                      className="p-2 rounded-xl bg-slate-800 hover:bg-blue-600/20 text-slate-300 hover:text-blue-400 border border-slate-700 hover:border-blue-500/40 transition"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setDeleteConfirmId(item.id)}
                      title="حذف المعلومة"
                      className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600/20 text-slate-300 hover:text-rose-400 border border-slate-700 hover:border-rose-500/40 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Delete Confirmation Alert */}
                {deleteConfirmId === item.id && (
                  <div className="mt-4 p-3.5 bg-rose-950/40 border border-rose-600/50 rounded-xl flex items-center justify-between gap-3 text-sm animate-fadeIn">
                    <div className="flex items-center gap-2 text-rose-300">
                      <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                      <span>هل أنت متأكد من حذف هذه المعلومة وسجل قراءتها نهائياً؟</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-1 rounded-lg text-xs transition"
                      >
                        نعم، حذف
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded-lg text-xs transition"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Information Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 p-5 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {editingItem ? 'تعديل المعلومة / الإعلان' : 'نشر معلومة وتنبيه جديد'}
                  </h2>
                  <p className="text-xs text-slate-400">سيتم إرسال هذا التنبيه لعملاء المتجر فور النشر</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1">
              {/* Type and Priority Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">نوع المعلومة</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as InformationType)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                  >
                    <option value="general">إعلان عام 📢</option>
                    <option value="price_change">تغيير أسعار 📉</option>
                    <option value="offer">عرض خاص 🔥</option>
                    <option value="warning">تنبيه عاجل ⚠️</option>
                    <option value="policy">سياسة وتوزيع 🚚</option>
                    <option value="schedule">مواعيد عمل ⏰</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">مستوى الأولوية</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as InformationPriority)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                  >
                    <option value="normal">عادية (أزرق/أخضر)</option>
                    <option value="high">عالية (تنبيه ذهبي بارز)</option>
                    <option value="urgent">عاجل جداً (شريط أحمر منبثق)</option>
                  </select>
                </div>
              </div>

              {/* Title Input */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  عنوان المعلومة <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="مثال: تحديث أسعار الكانز والشيبسي لهذا الأسبوع..."
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Optional Product Selection & Price Change Fields */}
              {(formType === 'price_change' || formType === 'offer' || formProductId) && (
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <Package className="w-4 h-4" />
                      ربط بصنف محدد من الكتالوج (اختياري)
                    </label>
                    {formProductId && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormProductId('');
                          setFormOldPrice('');
                          setFormNewPrice('');
                        }}
                        className="text-xs text-rose-400 hover:underline"
                      >
                        إلغاء الربط بالصنف
                      </button>
                    )}
                  </div>

                  <select
                    value={formProductId}
                    onChange={(e) => handleProductSelect(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- اختر صنفاً لربطه بالتنبيه --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.price} ج.م / {p.unit})
                      </option>
                    ))}
                  </select>

                  {formProductId && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">السعر السابق (ج.م)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={formOldPrice}
                          onChange={(e) => setFormOldPrice(e.target.value)}
                          placeholder="السعر القديم"
                          className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">السعر الجديد (ج.م)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={formNewPrice}
                          onChange={(e) => setFormNewPrice(e.target.value)}
                          placeholder="السعر الجديد"
                          className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">نسبة التغير</label>
                        <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-bold text-center">
                          {calculatedPctChange !== null ? (
                            <span className={calculatedPctChange < 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {calculatedPctChange > 0 ? `+${calculatedPctChange}%` : `${calculatedPctChange}%`}
                            </span>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Target Audience */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">الجمهور المستهدف</label>
                  <select
                    value={formTargetType}
                    onChange={(e) => setFormTargetType(e.target.value as 'all' | 'specific_customer')}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                  >
                    <option value="all">جميع العملاء في المتجر 👥</option>
                    <option value="specific_customer">عميل محدد بالاسم 👤</option>
                  </select>
                </div>

                {formTargetType === 'specific_customer' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">اختر العميل</label>
                    <select
                      value={formTargetId}
                      onChange={(e) => setFormTargetId(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                    >
                      <option value="">-- اختر حساب العميل --</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.fullName} ({c.storeName || c.phone})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Content Textarea */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  نص وتفاصيل المعلومة <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="اكتب تفاصيل التنبيه أو الإعلان بوضوح للعملاء..."
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 text-sm focus:outline-none focus:border-amber-500 resize-none leading-relaxed"
                />
              </div>

              {/* Expiry Date & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    تاريخ انتهاء المعلومة (اختياري)
                  </label>
                  <input
                    type="date"
                    value={formExpiresAt}
                    onChange={(e) => setFormExpiresAt(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    سيتم إخفاء المعلومة تلقائياً بعد هذا التاريخ
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">حالة النشر</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as InformationStatus)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                  >
                    <option value="published">نشر فوري للعملاء ✅</option>
                    <option value="draft">حفظ كمسودة 📝</option>
                    <option value="archived">أرشفة 📁</option>
                  </select>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 transition flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : editingItem ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Bell className="w-4 h-4" />
                  )}
                  <span>{editingItem ? 'حفظ التعديلات' : 'نشر التنبيه الآن'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
