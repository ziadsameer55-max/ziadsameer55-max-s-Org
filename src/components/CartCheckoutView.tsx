import React, { useState } from 'react';
import { Product, SystemSettings, User } from '../types';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  Send,
  AlertCircle,
  FileText,
  User as UserIcon,
  Phone,
  Store,
  CheckCircle2,
} from 'lucide-react';
import { apiFetch } from '../utils/api';

interface CartItem {
  product: Product;
  quantity: number;
}

interface CartCheckoutViewProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  user: User | null;
  settings: SystemSettings | null;
  onUpdateQty: (product: Product, delta: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onOpenLogin: () => void;
  onSubmitSuccess: (orderData: any) => void;
}

export const CartCheckoutView: React.FC<CartCheckoutViewProps> = ({
  isOpen,
  onClose,
  cart,
  user,
  settings,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onOpenLogin,
  onSubmitSuccess,
}) => {
  const [notes, setNotes] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestStore, setGuestStore] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const totalItemsCount = cart.length;
  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const grandTotal = subtotal;

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    // Validate phone and name if not logged in
    const finalName = user ? user.fullName : guestName.trim();
    const finalPhone = user ? user.phone : guestPhone.trim();
    const finalStore = user?.storeName || guestStore.trim() || 'محل تجاري';
    const finalAddress = user?.address || 'الإسكندرية';

    if (!finalName || !finalPhone) {
      setError('يرجى كتابة الاسم ورقم الهاتف لإرسال الطلب');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const orderPayload = {
        customerId: user?.id || 'guest-' + Date.now(),
        customerName: finalName + (finalStore ? ` - ${finalStore}` : ''),
        customerPhone: finalPhone,
        customerAddress: finalAddress,
        salesRep: settings?.salesRepName || 'محمد فوزي',
        items: cart.map((i) => ({
          productId: i.product.id,
          productName: i.product.name,
          unitPrice: i.product.price,
          quantity: i.quantity,
          unit: i.product.unit,
          discount: 0,
          totalPrice: i.product.price * i.quantity,
        })),
        subtotal,
        discount: 0,
        grandTotal,
        notes: notes.trim(),
      };

      const res = await apiFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onClearCart();
        onSubmitSuccess(data.order);
      } else {
        setError(data.error || 'حدث خطأ أثناء إرسال الطلب، يرجى المحاولة ثانية');
      }
    } catch (err: any) {
      setError('تعذر الاتصال بالخادم، يرجى التحقق من اتصال الإنترنت');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 overflow-y-auto flex items-start justify-center p-3 sm:p-4" dir="rtl">
      <div className="bg-white border border-gray-200 rounded-2xl max-w-xl w-full my-4 sm:my-8 shadow-2xl overflow-hidden flex flex-col text-right animate-fadeIn">
        {/* Top Header */}
        <div className="bg-slate-50 p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
              title="العودة للمنتجات"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <div>
              <h2 className="font-black text-slate-900 text-base sm:text-lg leading-tight">
                سلة الطلبات — مراجعة وتأكيد
              </h2>
              <p className="text-xs text-slate-500">شركة الحليم للتجارة والتوزيع</p>
            </div>
          </div>

          <button
            onClick={onClearCart}
            className="text-xs text-red-600 hover:text-red-800 font-bold px-2 py-1 hover:bg-red-50 rounded-lg transition-colors"
          >
            تفريغ السلة
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmitOrder} className="p-4 sm:p-5 space-y-4 flex-1">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3 flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Items List */}
          {cart.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <ShoppingCart className="w-10 h-10 mx-auto opacity-30" />
              <div className="text-sm font-bold text-slate-600">سلة الطلبات فارغة</div>
              <p className="text-xs">أضف بعض المنتجات من الكتالوج لإتمام الطلب.</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs"
              >
                العودة للكتالوج
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>الأصناف المختارة ({cart.length})</span>
                <span>تعديل الكميات مباشرة</span>
              </div>

              <div className="divide-y divide-gray-100 border border-gray-200 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                {cart.map(({ product, quantity }) => (
                  <div
                    key={product.id}
                    className="p-3 bg-white hover:bg-slate-50/60 flex items-center justify-between gap-3 transition-colors text-xs"
                  >
                    {/* Product info */}
                    <div className="flex-1">
                      <div className="font-bold text-slate-900 text-xs sm:text-sm">
                        {product.name}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                        {(product.price || 0).toLocaleString('ar-EG')} ج.م / {product.unit}
                      </div>
                    </div>

                    {/* Stepper [-] Qty [+] */}
                    <div className="flex items-center gap-1.5 bg-slate-100 border border-gray-200 rounded-xl p-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onUpdateQty(product, -1)}
                        className="w-8 h-8 rounded-lg bg-white hover:bg-red-50 hover:text-red-600 text-slate-700 font-bold flex items-center justify-center shadow-2xs transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <span className="w-8 text-center font-black text-slate-900 font-mono text-xs">
                        {quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() => onUpdateQty(product, 1)}
                        className="w-8 h-8 rounded-lg bg-white hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 font-bold flex items-center justify-center shadow-2xs transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Total Price & Delete */}
                    <div className="text-left shrink-0 min-w-[70px]">
                      <div className="font-black text-emerald-700 font-mono text-xs sm:text-sm">
                        {(quantity * (product.price || 0)).toLocaleString('ar-EG')} ج.م
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(product.id)}
                        className="text-[10px] text-red-500 hover:text-red-700 font-medium mt-0.5"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customer Details info (If not logged in, prompt quick fields) */}
          {cart.length > 0 && (
            <>
              {user ? (
                <div className="bg-slate-50 border border-gray-200 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>بيانات العميل:</span>
                    <span className="font-bold text-slate-900">{user.fullName} ({user.phone})</span>
                  </div>
                  {user.storeName && (
                    <div className="flex justify-between items-center text-slate-600">
                      <span>المحل / النشاط:</span>
                      <span className="font-bold text-emerald-700">{user.storeName}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-slate-600">
                    <span>المندوب المستلم:</span>
                    <span className="font-bold text-slate-800">{settings?.salesRepName || 'محمد فوزي'}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 space-y-2 text-xs">
                  <div className="font-bold text-amber-900 flex items-center justify-between">
                    <span>بيانات إرسال الطلب السريع:</span>
                    <button
                      type="button"
                      onClick={onOpenLogin}
                      className="text-emerald-700 underline font-bold text-[11px]"
                    >
                      أو سجل دخولك هنا
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="اسمك الكريم / المحل *"
                      className="w-full bg-white border border-gray-300 rounded-lg p-2 text-slate-900 text-xs focus:outline-none focus:border-emerald-600"
                    />
                    <input
                      type="tel"
                      required
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      placeholder="رقم الهاتف للتواصل والتسليم *"
                      className="w-full bg-white border border-gray-300 rounded-lg p-2 text-slate-900 text-xs focus:outline-none focus:border-emerald-600 font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Notes Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ملاحظات إضافية للطلب (اختياري):
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: يرجى التسليم قبل الظهر، أو الاتصال قبل الوصول..."
                  className="w-full bg-slate-50 border border-gray-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white"
                />
              </div>

              {/* Order Summary Box */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>عدد الأصناف المختلفة:</span>
                  <span className="font-bold text-slate-900">{totalItemsCount} أصناف</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>إجمالي عدد القطع / الطرود:</span>
                  <span className="font-bold text-slate-900">{totalQuantity} قطعة</span>
                </div>
                <div className="pt-2 border-t border-emerald-200 flex justify-between items-baseline">
                  <span className="text-sm font-bold text-emerald-950">الإجمالي النهائي للفاتورة:</span>
                  <span className="text-xl sm:text-2xl font-black text-emerald-800 font-mono">
                    {(grandTotal || 0).toLocaleString('ar-EG')}{' '}
                    <span className="text-xs font-normal">جنيه</span>
                  </span>
                </div>
              </div>

              {/* Single CTA Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-sm sm:text-base rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <span>جاري إرسال الطلب...</span>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>تأكيد وإرسال الطلب الآن</span>
                  </>
                )}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
