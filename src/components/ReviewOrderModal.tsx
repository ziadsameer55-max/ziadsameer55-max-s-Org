import React, { useState } from 'react';
import { Product, User } from '../types';
import { ShoppingCart, Trash2, Plus, Minus, Send, AlertCircle, CheckCircle } from 'lucide-react';
import { CartItem } from './CustomerCatalog';
import { apiFetch } from '../utils/api';

interface ReviewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  user: User;
  onOrderSuccess: (orderNumber: string) => void;
}

export const ReviewOrderModal: React.FC<ReviewOrderModalProps> = ({
  isOpen,
  onClose,
  cart: initialCart,
  user,
  onOrderSuccess,
}) => {
  const [items, setItems] = useState<CartItem[]>(initialCart);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleQtyChange = (productId: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const next = item.quantity + delta;
            return next > 0 ? { ...item, quantity: next } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveItem = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleSubmitOrder = async () => {
    if (items.length === 0) return;
    setLoading(true);
    setError('');

    try {
      const payload = {
        customerId: user.id,
        customerName: user.fullName,
        customerPhone: user.phone,
        customerAddress: user.address || '',
        notes,
        items: items.map((i) => ({
          productId: i.product.id,
          productName: i.product.name,
          unitPrice: i.product.price,
          quantity: i.quantity,
          unit: i.product.unit,
          discount: 0,
        })),
      };

      const res = await apiFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onOrderSuccess(data.orderNumber);
        onClose();
      } else {
        setError(data.error || 'فشل في حفظ الطلب، يرجى المحاولة مرة أخرى');
      }
    } catch (err: any) {
      setError('حدث خطأ أثناء إرسال الطلب للشركة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white border border-gray-200 rounded-xl max-w-xl w-full p-4 sm:p-5 text-right shadow-2xl text-slate-800 relative my-6 max-h-[92vh] flex flex-col justify-between" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-center text-emerald-700 font-bold shrink-0">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-800">
                مراجعة وتأكيد الطلب قبل الإرسال
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                شركة الحليم للتجارة والتوزيع — إدارة الحاج فوزي عبد الحليم (المندوب: محمد فوزي)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 text-lg font-bold"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-2.5 flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="overflow-y-auto flex-1 pr-1 space-y-3">
          {/* Customer Info Card */}
          <div className="bg-slate-50 border border-gray-200 rounded-lg p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500 block mb-0.5 font-medium">العميل / المنشأة:</span>
              <span className="font-bold text-slate-800">
                {user.fullName} {user.storeName ? `(${user.storeName})` : ''}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5 font-medium">رقم الهاتف للتواصل:</span>
              <span className="font-bold text-emerald-700">{user.phone}</span>
            </div>
          </div>

          {/* Items Table */}
          {items.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <p className="font-bold text-xs">سلة الطلب فارغة</p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-gray-200">
                  <tr>
                    <th className="p-2">الصنف</th>
                    <th className="p-2 text-center">الكمية</th>
                    <th className="p-2">السعر</th>
                    <th className="p-2">الإجمالي</th>
                    <th className="p-2 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item) => (
                    <tr key={item.product.id} className="hover:bg-slate-50/50">
                      <td className="p-2 font-bold text-slate-800">
                        <div>{item.product.name}</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          {item.product.unit}
                        </div>
                      </td>
                      <td className="p-2 text-center">
                        <div className="inline-flex items-center gap-1 bg-slate-100 rounded px-1 py-0.5">
                          <button
                            onClick={() => handleQtyChange(item.product.id, 1)}
                            className="w-5 h-5 rounded bg-white hover:bg-emerald-600 hover:text-white text-slate-800 font-bold flex items-center justify-center transition-colors shadow-xs"
                          >
                            +
                          </button>
                          <span className="w-6 text-center font-bold">{item.quantity}</span>
                          <button
                            onClick={() => handleQtyChange(item.product.id, -1)}
                            className="w-5 h-5 rounded bg-white hover:bg-slate-300 text-slate-800 font-bold flex items-center justify-center transition-colors shadow-xs"
                          >
                            -
                          </button>
                        </div>
                      </td>
                      <td className="p-2 text-slate-600 font-mono">
                        {(item.product.price || 0).toLocaleString('ar-EG')} ج
                      </td>
                      <td className="p-2 font-bold text-emerald-700 font-mono">
                        {((item.product.price || 0) * item.quantity).toLocaleString('ar-EG')} ج
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => handleRemoveItem(item.product.id)}
                          className="text-red-400 hover:text-red-600 p-1"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Notes Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ملاحظات إضافية على الطلب (اختياري):
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: يرجى التوصيل بعد الساعة 3 عصراً، أو تسليم الطلب للمخزن..."
              className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-600 resize-none"
            />
          </div>

          {/* Summary Box */}
          <div className="bg-slate-50 border border-gray-200 rounded-lg p-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>عدد الأصناف:</span>
              <span className="font-bold text-slate-800">{items.length}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>إجمالي عدد الوحدات:</span>
              <span className="font-bold text-slate-800">{totalQty}</span>
            </div>
            <div className="flex justify-between text-slate-800 font-bold text-sm border-t border-gray-200 pt-1.5">
              <span>إجمالي قيمة الطلب:</span>
              <span className="text-emerald-700 font-black font-mono">
                {(subtotal || 0).toLocaleString('ar-EG')} جنيه مصري
              </span>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 mt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors"
          >
            رجوع لتعديل الطلب
          </button>

          <button
            onClick={handleSubmitOrder}
            disabled={loading || items.length === 0}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-all shadow-xs flex items-center gap-2 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{loading ? 'جاري إرسال الطلب...' : 'تأكيد وإرسال الطلب الآن'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
