import React, { useState } from 'react';
import { Order, OrderItem, Product, OrderStatus } from '../types';
import {
  Edit,
  Trash2,
  Plus,
  Save,
  AlertCircle,
  CheckCircle,
  Truck,
  DollarSign,
  Clock,
  X,
  CreditCard,
  UserCheck,
} from 'lucide-react';
import { apiFetch } from '../utils/api';

interface AdminOrderEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  allProducts: Product[];
  onSaveSuccess: () => void;
}

export const AdminOrderEditModal: React.FC<AdminOrderEditModalProps> = ({
  isOpen,
  onClose,
  order,
  allProducts,
  onSaveSuccess,
}) => {
  const [items, setItems] = useState<OrderItem[]>(order.items || []);
  const [orderDiscount, setOrderDiscount] = useState<number>(order.discount || 0);
  const [status, setStatus] = useState<OrderStatus>(order.status || 'Pending');
  const [notes, setNotes] = useState<string>(order.notes || '');
  const [adminNotes, setAdminNotes] = useState<string>(order.adminNotes || '');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Delivery & Mandatory Collection Modal State
  const [showCollectModal, setShowCollectModal] = useState<boolean>(false);
  const [collectAmount, setCollectAmount] = useState<string>('');
  const [collectMethod, setCollectMethod] = useState<'Cash' | 'VodafoneCash' | 'Bank' | 'Cheque'>('Cash');
  const [collectedBy, setCollectedBy] = useState<string>('محمد فوزي (المندوب)');
  const [collectNotes, setCollectNotes] = useState<string>('');

  if (!isOpen) return null;

  // Add Product to Order
  const handleAddProduct = () => {
    if (!selectedProductId) return;
    const prod = allProducts.find((p) => p.id === selectedProductId);
    if (!prod) return;

    const existing = items.find((i) => i.productId === prod.id);
    if (existing) {
      setItems((prev) =>
        prev.map((i) =>
          i.productId === prod.id
            ? {
                ...i,
                quantity: i.quantity + 1,
                totalPrice: (i.quantity + 1) * i.unitPrice - i.discount,
              }
            : i
        )
      );
    } else {
      const newItem: OrderItem = {
        id: 'temp_' + Date.now(),
        orderId: order.id,
        productId: prod.id,
        productName: prod.name,
        unitPrice: prod.price,
        quantity: prod.minQty || 1,
        unit: prod.unit,
        discount: 0,
        totalPrice: prod.price * (prod.minQty || 1),
      };
      setItems((prev) => [...prev, newItem]);
    }

    setSelectedProductId('');
  };

  // Delete product from THIS order only 🗑️
  const handleDeleteItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  // Update item fields (quantity, unitPrice, discount)
  const handleItemChange = (
    itemId: string,
    field: 'quantity' | 'unitPrice' | 'discount',
    value: number
  ) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id === itemId) {
          const qty = field === 'quantity' ? Math.max(1, value) : i.quantity;
          const price = field === 'unitPrice' ? Math.max(0, value) : i.unitPrice;
          const disc = field === 'discount' ? Math.max(0, value) : i.discount;
          const total = qty * price - disc;

          return {
            ...i,
            quantity: qty,
            unitPrice: price,
            discount: disc,
            totalPrice: Math.max(0, total),
          };
        }
        return i;
      })
    );
  };

  // Recalculate totals
  const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0);
  const grandTotal = Math.max(0, subtotal - orderDiscount);
  const currentPaid = order.paidAmount || 0;
  const currentRemaining = Math.max(0, grandTotal - currentPaid);

  // Status Change Interceptor: If changing to Delivered, trigger mandatory collection modal
  const handleStatusChange = (newStatus: OrderStatus) => {
    if (newStatus === 'Delivered') {
      setStatus('Delivered');
      setCollectAmount(String(currentRemaining));
      setShowCollectModal(true);
    } else {
      setStatus(newStatus);
    }
  };

  // Open delivery & collection confirmation modal directly
  const handleTriggerDeliveryCollect = () => {
    setStatus('Delivered');
    setCollectAmount(String(currentRemaining));
    setShowCollectModal(true);
  };

  // Save Order Changes (with optional collection if triggered)
  const handleSaveOrder = async (overrideStatus?: OrderStatus, collectionData?: any) => {
    if (items.length === 0) {
      setError('لا يمكن حفظ طلب بدون أصناف');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const finalStatus = overrideStatus || status;
      const payload: any = {
        items: items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.productName,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
          unit: i.unit,
          discount: i.discount,
        })),
        discount: orderDiscount,
        notes,
        adminNotes,
        status: finalStatus,
        performedBy: 'الحاج فوزي / محمد فوزي',
      };

      if (collectionData) {
        payload.collectPayment = collectionData;
      }

      const res = await apiFetch(`/api/orders/${order.id}/edit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShowCollectModal(false);
        onSaveSuccess();
        onClose();
      } else {
        setError(data.error || 'فشل حفظ تعديلات الطلب');
      }
    } catch (err: any) {
      setError('حدث خطأ أثناء حفظ التعديلات');
    } finally {
      setLoading(false);
    }
  };

  // Confirm Collection & Delivery inside modal
  const handleConfirmCollectionAndDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    const paidNow = parseFloat(collectAmount) || 0;
    if (paidNow < 0) {
      setError('لا يمكن تسجيل مبلغ مدفوع بالسالب');
      return;
    }

    const collectionData = {
      amount: paidNow,
      paymentMethod: collectMethod,
      collectedBy: collectedBy,
      notes: collectNotes || (paidNow > 0 ? `دفعة ${paidNow} ج وقت التسليم` : 'تسليم آجل بدون دفعة'),
    };

    handleSaveOrder('Delivered', collectionData);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white border border-gray-200 rounded-2xl max-w-3xl w-full p-4 sm:p-6 text-right shadow-2xl text-slate-800 relative my-6 max-h-[95vh] flex flex-col justify-between" dir="rtl">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-slate-400 hover:text-slate-700 text-lg font-bold p-1 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100 shrink-0">
          <div className="w-11 h-11 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center text-amber-700 text-lg font-bold shrink-0">
            <Edit className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                تعديل الطلب {order.orderNumber}
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-200">
                {order.customerName}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              شركة الحليم للتجارة والتوزيع — تعديل الأصناف، الأسعار، الخصومات وحالة التسليم والتحصيل.
            </p>
          </div>
        </div>

        {error && (
          <div className="my-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3 flex items-center gap-2 font-medium shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="overflow-y-auto flex-1 pr-1 space-y-4 my-3">
          {/* Status Bar Selector */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <label className="block text-xs font-bold text-slate-700 mb-2">
              حالة الطلب الحالية:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => handleStatusChange('Pending')}
                className={`py-2 px-2 rounded-lg border transition-colors ${
                  status === 'Pending'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                ⏳ قيد الانتظار
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('Preparing')}
                className={`py-2 px-2 rounded-lg border transition-colors ${
                  status === 'Preparing'
                    ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                📦 جاري التجهيز
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('Out for Delivery')}
                className={`py-2 px-2 rounded-lg border transition-colors ${
                  status === 'Out for Delivery'
                    ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                🚚 خرج للتوصيل
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('Delivered')}
                className={`py-2 px-2 rounded-lg border transition-colors flex items-center justify-center gap-1 ${
                  status === 'Delivered'
                    ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                    : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>تم التسليم والتحصيل</span>
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('Cancelled')}
                className={`py-2 px-2 rounded-lg border transition-colors col-span-2 sm:col-span-1 ${
                  status === 'Cancelled'
                    ? 'bg-red-600 text-white border-red-700 shadow-xs'
                    : 'bg-white text-red-700 border-red-200 hover:bg-red-50'
                }`}
              >
                ❌ ملغي
              </button>
            </div>
          </div>

          {/* Add Product Dropdown Bar */}
          <div className="bg-slate-50 border border-gray-200 rounded-xl p-3 flex flex-col sm:flex-row items-center gap-2">
            <div className="w-full sm:flex-1">
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500 text-right font-medium"
              >
                <option value="">-- اختر صنف لإضافته إلى فاتورة الطلب --</option>
                {allProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.category}) — {p.price} ج / {p.unit}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleAddProduct}
              disabled={!selectedProductId}
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shrink-0 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة الصنف</span>
            </button>
          </div>

          {/* Items Editing Table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto max-h-60">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="p-2.5">اسم الصنف</th>
                    <th className="p-2.5 text-center">الكمية</th>
                    <th className="p-2.5 text-center">السعر (ج)</th>
                    <th className="p-2.5 text-center">خصم الصنف</th>
                    <th className="p-2.5 text-center">الإجمالي</th>
                    <th className="p-2.5 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900 max-w-[180px]">
                        <div>{item.productName}</div>
                        <div className="text-[10px] text-slate-400 font-normal">الوحدة: {item.unit}</div>
                      </td>

                      {/* Quantity Input */}
                      <td className="p-2.5 text-center">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 1)
                          }
                          className="w-14 bg-slate-50 border border-gray-300 rounded-md p-1 text-center font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                        />
                      </td>

                      {/* Unit Price Input */}
                      <td className="p-2.5 text-center">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={item.unitPrice}
                          onChange={(e) =>
                            handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)
                          }
                          className="w-16 bg-slate-50 border border-gray-300 rounded-md p-1 text-center font-bold text-emerald-700 focus:outline-none focus:border-amber-500"
                        />
                      </td>

                      {/* Item Discount Input */}
                      <td className="p-2.5 text-center">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={item.discount}
                          onChange={(e) =>
                            handleItemChange(item.id, 'discount', parseFloat(e.target.value) || 0)
                          }
                          className="w-14 bg-slate-50 border border-gray-300 rounded-md p-1 text-center text-amber-700 font-bold focus:outline-none focus:border-amber-500"
                        />
                      </td>

                      {/* Line Total */}
                      <td className="p-2.5 text-center font-black text-emerald-700">
                        {(item.totalPrice || 0).toLocaleString('ar-EG')} ج
                      </td>

                      {/* Delete Item Button 🗑️ */}
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-md transition-colors border border-red-200"
                          title="حذف هذا الصنف من الطلب"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Order Discount & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">خصم إضافي للفاتورة (جنيه):</label>
              <input
                type="number"
                min={0}
                step="any"
                value={orderDiscount}
                onChange={(e) => setOrderDiscount(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-gray-300 rounded-lg p-2 font-bold text-amber-700 focus:outline-none focus:border-amber-500 text-right"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">ملاحظات الإدارة والمندوب:</label>
              <input
                type="text"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="مثال: تم التعديل هاتفياً مع العميل..."
                className="w-full bg-slate-50 border border-gray-300 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-amber-500 text-right"
              />
            </div>
          </div>

          {/* Payment & Balance Status Card */}
          <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-white p-2 rounded-lg border border-emerald-100">
              <span className="text-slate-500 block text-[11px]">إجمالي الفاتورة:</span>
              <span className="font-black text-slate-900 text-sm">
                {(grandTotal || 0).toLocaleString('ar-EG')} ج
              </span>
            </div>
            <div className="bg-white p-2 rounded-lg border border-emerald-100">
              <span className="text-slate-500 block text-[11px]">المدفوع سابقاً:</span>
              <span className="font-bold text-emerald-700 text-sm">
                {(currentPaid || 0).toLocaleString('ar-EG')} ج
              </span>
            </div>
            <div className="bg-white p-2 rounded-lg border border-emerald-100">
              <span className="text-slate-500 block text-[11px]">المتبقي المطلوب:</span>
              <span className={`font-black text-sm ${currentRemaining > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                {(currentRemaining || 0).toLocaleString('ar-EG')} ج
              </span>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons Footer */}
        <div className="pt-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-right w-full sm:w-auto">
            <div className="text-base font-black text-slate-900">
              صافي الفاتورة: {(grandTotal || 0).toLocaleString('ar-EG')} جنيه
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-3.5 py-2.5 rounded-xl border border-gray-300 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
            >
              إلغاء
            </button>

            {/* Quick Delivery & Collection Button */}
            <button
              type="button"
              onClick={handleTriggerDeliveryCollect}
              className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5"
            >
              <Truck className="w-4 h-4" />
              <span>تأكيد التسليم والتحصيل</span>
            </button>

            {/* Save Edits Only */}
            <button
              onClick={() => handleSaveOrder()}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <span>جاري الحفظ...</span>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>حفظ التعديلات</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* MANDATORY COLLECTION MODAL (نافذة التحصيل الإجبارية) */}
        {/* ---------------------------------------------------- */}
        {showCollectModal && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 z-60 overflow-y-auto">
            <div className="bg-white border-2 border-emerald-600 rounded-2xl max-w-md w-full p-5 text-right shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-150" dir="rtl">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-emerald-100 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 bg-emerald-100 border border-emerald-300 rounded-xl flex items-center justify-center text-emerald-800 shrink-0">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-emerald-950">
                      تسجيل تحصيل الفاتورة قبل التسليم
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      الطلب: {order.orderNumber} — العميل: {order.customerName}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowCollectModal(false)}
                  className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Financial Snapshot */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">إجمالي قيمة الفاتورة المعدلة:</span>
                  <span className="font-bold text-slate-900">{(grandTotal || 0).toLocaleString('ar-EG')} ج</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">المدفوع سابقاً:</span>
                  <span className="font-bold text-emerald-700">{(currentPaid || 0).toLocaleString('ar-EG')} ج</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 font-black text-sm">
                  <span className="text-slate-800">المتبقي المطلوب تحصيله:</span>
                  <span className="text-emerald-700">{(currentRemaining || 0).toLocaleString('ar-EG')} ج</span>
                </div>
              </div>

              {/* Collection Form */}
              <form onSubmit={handleConfirmCollectionAndDelivery} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    المبلغ المدفوع نقدًا / دفعة الاستلام (جنيه) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max={currentRemaining}
                    required
                    value={collectAmount}
                    onChange={(e) => setCollectAmount(e.target.value)}
                    className="w-full p-3 rounded-xl border-2 border-emerald-600 bg-emerald-50/30 text-emerald-950 font-mono text-lg font-black focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center"
                    placeholder="0"
                  />

                  {/* Quick Action Buttons */}
                  <div className="grid grid-cols-3 gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => setCollectAmount(String(currentRemaining))}
                      className="py-1.5 px-2 bg-emerald-700 text-white rounded-lg font-bold text-[11px] hover:bg-emerald-800 transition-colors shadow-2xs"
                    >
                      سداد كامل ({currentRemaining.toLocaleString('ar-EG')} ج)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCollectAmount(String(Math.round(currentRemaining / 2)))}
                      className="py-1.5 px-2 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg font-bold text-[11px] hover:bg-amber-200 transition-colors"
                    >
                      دفع النصف ({Math.round(currentRemaining / 2).toLocaleString('ar-EG')} ج)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCollectAmount('0')}
                      className="py-1.5 px-2 bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-bold text-[11px] hover:bg-slate-200 transition-colors"
                    >
                      آجل بالكامل (0 ج)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">طريقة الدفع:</label>
                  <select
                    value={collectMethod}
                    onChange={(e) => setCollectMethod(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-800"
                  >
                    <option value="Cash">💵 نقدًا (كاش مع المندوب محمد فوزي)</option>
                    <option value="VodafoneCash">📱 فودافون كاش / محفظة إلكترونية</option>
                    <option value="Bank">🏦 تحويل بنكي / إنستاباي</option>
                    <option value="Cheque">📜 شيك تجاري</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">المحصل المسئول:</label>
                  <input
                    type="text"
                    value={collectedBy}
                    onChange={(e) => setCollectedBy(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">ملاحظات التحصيل:</label>
                  <input
                    type="text"
                    value={collectNotes}
                    onChange={(e) => setCollectNotes(e.target.value)}
                    placeholder="مثال: تم الاستلام نقدًا عند المحل"
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  />
                </div>

                {/* Instant Dynamic Balance Calculation */}
                <div className="p-3 bg-slate-100 rounded-xl border border-slate-300 flex justify-between items-center font-bold">
                  <span className="text-slate-700">المتبقي الجديد على العميل:</span>
                  <span className={`text-base font-black ${
                    Math.max(0, currentRemaining - (parseFloat(collectAmount) || 0)) > 0
                      ? 'text-red-700'
                      : 'text-emerald-700'
                  }`}>
                    {Math.max(0, currentRemaining - (parseFloat(collectAmount) || 0)).toLocaleString('ar-EG')} ج
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCollectModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors"
                  >
                    رجوع
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    {loading ? (
                      <Clock className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    <span>تأكيد التسليم وتسجيل التحصيل</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
