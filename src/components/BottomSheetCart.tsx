import React, { useState, useEffect, useMemo } from 'react';
import { Product, SystemSettings, User } from '../types';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  X,
  Send,
  AlertCircle,
  CheckCircle,
  Truck,
  Store,
  MapPin,
  Phone,
  User as UserIcon,
  Clock,
  Edit3,
  Save,
  ArrowRight,
  Search,
  PackagePlus,
  Info,
  Check,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { CartItem } from './NotebookCatalog';
import { apiFetch } from '../utils/api';

interface BottomSheetCartProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  allProducts?: Product[];
  user: User | null;
  settings: SystemSettings | null;
  onUpdateQty: (product: Product, delta: number) => void;
  onSetQty: (product: Product, qty: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onSaveCart?: (newCart: CartItem[]) => void;
  onBrowseCatalog?: () => void;
  onSubmitSuccess: (orderData: any) => void;
  onOpenLogin: () => void;
}

export const BottomSheetCart: React.FC<BottomSheetCartProps> = ({
  isOpen,
  onClose,
  cart,
  allProducts = [],
  user,
  settings,
  onUpdateQty,
  onSetQty,
  onRemoveItem,
  onClearCart,
  onSaveCart,
  onBrowseCatalog,
  onSubmitSuccess,
  onOpenLogin,
}) => {
  // Modes: 'view' (Standard Cart Overview), 'edit' (Edit Order Mode), 'checkout' (Customer Details & Submit)
  const [mode, setMode] = useState<'view' | 'edit' | 'checkout'>('view');
  
  // Local editable items state when in 'edit' mode
  const [editItems, setEditItems] = useState<CartItem[]>([]);
  
  // Product Search / Add More modal state inside edit mode
  const [isAddPickerOpen, setIsAddPickerOpen] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');

  // Checkout inputs
  const [notes, setNotes] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestStore, setGuestStore] = useState('');
  const [guestAddress, setGuestAddress] = useState('');
  
  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [priceChangeWarnings, setPriceChangeWarnings] = useState<
    Array<{ productId: string; productName: string; oldPrice: number; newPrice: number }>
  >([]);

  // Sync editItems with incoming cart when opened or when cart changes outside edit mode
  useEffect(() => {
    if (isOpen) {
      setEditItems(cart.map((item) => ({ ...item })));
      setError('');
      setSaveSuccessMsg('');
      setPriceChangeWarnings([]);
    }
  }, [isOpen, cart]);

  if (!isOpen) return null;

  // Active items based on mode
  const currentItems = mode === 'edit' ? editItems : cart;
  const isPricesHidden = user?.role !== 'admin' && Boolean(settings?.hidePrices);

  // Summary Totals
  const totalItemsCount = currentItems.length;
  const totalQuantity = currentItems.reduce((sum, i) => sum + i.quantity, 0);
  const grandTotal = isPricesHidden
    ? 0
    : currentItems.reduce((sum, i) => sum + (i.product.price || 0) * i.quantity, 0);

  // Filtered products for quick add in edit mode
  const availableToAddProducts = allProducts.filter((p) => {
    if (p.status === 'hidden' || p.status === 'locked') return false;
    const isAlreadyInCart = editItems.some((item) => item.product.id === p.id);
    if (isAlreadyInCart) return false;
    if (!productSearchQuery.trim()) return true;
    const q = productSearchQuery.trim().toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.category && p.category.toLowerCase().includes(q)) ||
      (p.packaging && p.packaging.toLowerCase().includes(q))
    );
  });

  // --- Handlers for Edit Mode ---
  const handleStartEdit = () => {
    setEditItems(cart.map((i) => ({ ...i })));
    setMode('edit');
    setError('');
    setSaveSuccessMsg('');
  };

  const handleCancelEdit = () => {
    setEditItems(cart.map((i) => ({ ...i })));
    setMode('view');
    setError('');
  };

  const handleEditItemQtyChange = (productId: string, delta: number) => {
    setEditItems((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const next = Math.max(1, item.quantity + delta);
          if (item.product.maxQty !== null && next > item.product.maxQty) {
            return item;
          }
          return { ...item, quantity: next };
        }
        return item;
      })
    );
  };

  const handleEditItemDirectQty = (productId: string, rawVal: string) => {
    const parsed = parseInt(rawVal, 10);
    setEditItems((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          if (isNaN(parsed) || parsed < 1) {
            return { ...item, quantity: 1 };
          }
          if (item.product.maxQty !== null && parsed > item.product.maxQty) {
            return { ...item, quantity: item.product.maxQty };
          }
          return { ...item, quantity: parsed };
        }
        return item;
      })
    );
  };

  const handleEditItemRemove = (productId: string) => {
    setEditItems((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const handleAddProductToEditList = (product: Product) => {
    setEditItems((prev) => {
      const exists = prev.find((i) => i.product.id === product.id);
      if (exists) return prev;
      return [...prev, { product, quantity: product.minQty || 1 }];
    });
    setIsAddPickerOpen(false);
    setProductSearchQuery('');
  };

  // --- STRICT SERVER-SIDE RECALCULATION & SAVE ---
  const handleSaveEdits = async () => {
    if (editItems.length === 0) {
      if (onSaveCart) {
        onSaveCart([]);
      } else {
        onClearCart();
      }
      setMode('view');
      return;
    }

    setLoading(true);
    setError('');
    setSaveSuccessMsg('');
    setPriceChangeWarnings([]);

    try {
      const payload = {
        items: editItems.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          reportedPrice: i.product.price,
        })),
      };

      const res = await apiFetch('/api/cart/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Map validated items from server database
        const updatedCart: CartItem[] = data.items.map((srvItem: any) => ({
          product: srvItem.product,
          quantity: srvItem.quantity,
        }));

        if (onSaveCart) {
          onSaveCart(updatedCart);
        } else {
          // Fallback if onSaveCart not provided
          onClearCart();
          updatedCart.forEach((it) => onSetQty(it.product, it.quantity));
        }

        if (data.hasPriceChanges && data.priceChanges?.length > 0) {
          setPriceChangeWarnings(data.priceChanges);
        }

        setSaveSuccessMsg('تم حفظ التعديلات وإعادة احتساب الإجماليات بنجاح من قاعدة البيانات');
        setMode('view');
      } else {
        setError(data.error || 'تعذر حفظ التعديلات وإعادة حساب الأسعار');
      }
    } catch (err) {
      setError('حدث خطأ أثناء الاتصال بالخادم، يرجى المحاولة مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  // --- Final Checkout Submit ---
  const handleFinalSubmit = async () => {
    if (cart.length === 0) return;

    const finalName = user ? user.fullName : guestName.trim();
    const finalPhone = user ? user.phone : guestPhone.trim();
    const finalStore = user?.storeName || guestStore.trim() || 'سوبر ماركت / محل تجاري';
    const finalAddress = user?.address || guestAddress.trim() || 'الإسكندرية';

    if (!finalName || !finalPhone) {
      setError('يرجى كتابة الاسم ورقم الهاتف للمتابعة وتأكيد الطلب');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const orderPayload = {
        customerId: user?.id || 'guest-' + Date.now(),
        customerName: finalName + (finalStore ? ` (${finalStore})` : ''),
        customerPhone: finalPhone,
        customerAddress: finalAddress,
        salesRep: settings?.salesRepName || 'محمد فوزي',
        items: cart.map((i) => ({
          productId: i.product.id,
          productName: i.product.name,
          unitPrice: i.product.price,
          quantity: i.quantity,
          unit: i.product.unit || 'كرتونة',
          discount: 0,
          totalPrice: i.product.price * i.quantity,
        })),
        subtotal: grandTotal,
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
        setMode('view');
        onClose();
        onSubmitSuccess(data.order);
      } else {
        setError(data.error || 'فشل إرسال الطلب، يرجى المحاولة مرة أخرى');
      }
    } catch (err) {
      setError('تعذر الاتصال بالخادم، يرجى التحقق من اتصال الإنترنت');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex flex-col justify-end items-center"
      dir="rtl"
    >
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Sheet Container */}
      <div className="relative bg-white w-full max-w-xl rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col z-10 text-right animate-slideUp border-t border-slate-100">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold shadow-2xs ${
                mode === 'edit'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              {mode === 'edit' ? <Edit3 className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-slate-900 text-base leading-tight">
                  {mode === 'view' && `سلة طلبات الجملة (${totalItemsCount} أصناف)`}
                  {mode === 'edit' && '✏️ تعديل أصناف وكميات الطلب'}
                  {mode === 'checkout' && 'إتمام وتأكيد الفاتورة'}
                </h2>
                {mode === 'edit' && (
                  <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-2xs">
                    وضع التعديل
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">شركة الحليم للتجارة والتوزيع</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {mode === 'view' && cart.length > 0 && (
              <button
                onClick={onClearCart}
                className="text-[11px] text-red-600 hover:text-red-800 font-bold px-2.5 py-1.5 hover:bg-red-50 rounded-xl transition-colors"
                title="تفريغ السلة بالكامل"
              >
                تفريغ
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Success Message Banner */}
        {saveSuccessMsg && (
          <div className="mx-4 mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Price Change Alert if Server Prices Were Updated */}
        {priceChangeWarnings.length > 0 && (
          <div className="mx-4 mt-3 p-3.5 bg-amber-50 border border-amber-300 rounded-2xl text-amber-900 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-black">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>تنبيه: تم تحديث أسعار بعض الأصناف وفق لائحة الأسعار الرسمية</span>
            </div>
            <div className="space-y-1 pr-6 text-[11px]">
              {priceChangeWarnings.map((pc) => (
                <div key={pc.productId} className="flex items-center justify-between border-b border-amber-200/50 pb-0.5">
                  <span>{pc.productName}</span>
                  <span className="font-mono font-bold">
                    <span className="line-through text-slate-400 mr-1">{pc.oldPrice} ج.م</span>
                    <span className="text-emerald-800 font-black">{pc.newPrice} ج.م</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-2xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 1: NORMAL CART OVERVIEW (عرض السلة الحالي) */}
        {/* ============================================================== */}
        {mode === 'view' && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[55vh]">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-3">
                  <ShoppingCart className="w-14 h-14 text-slate-300 mx-auto stroke-1" />
                  <p className="text-sm font-bold text-slate-700">سلة الطلبات فارغة</p>
                  <p className="text-xs text-slate-400">
                    أضف الأصناف والكراتين المطلوبة من الكتالوج لإتمام الأوردر
                  </p>
                  {onBrowseCatalog && (
                    <button
                      onClick={() => {
                        onClose();
                        onBrowseCatalog();
                      }}
                      className="mt-2 px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-black rounded-xl shadow-xs"
                    >
                      تصفح الكتالوج الآن
                    </button>
                  )}
                </div>
              ) : (
                cart.map((item) => {
                  const lineTotal = (item.product.price || 0) * item.quantity;
                  return (
                    <div
                      key={item.product.id}
                      className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                          {item.product.name}
                        </div>
                        <div className="text-[11px] text-slate-600 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          {!isPricesHidden && item.product.price > 0 ? (
                            <span className="font-bold">
                              السعر:{' '}
                              <span className="font-mono text-emerald-800 font-black">
                                {item.product.price} جنيه
                              </span>{' '}
                              / {item.product.unit || 'كرتونة'}
                            </span>
                          ) : (
                            <span className="text-slate-500 font-bold bg-slate-200/60 px-1.5 py-0.5 rounded text-[10px]">
                              🔒 تسعير جملة خاص
                            </span>
                          )}
                          {item.product.packaging && (
                            <span className="text-slate-400 text-[10px]">
                              • التعبئة: {item.product.packaging}
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-bold text-slate-700 mt-1">
                          الكمية: <span className="font-black text-slate-900 font-mono">{item.quantity}</span> {item.product.unit || 'كرتونة'}
                        </div>
                      </div>

                      {/* Line Item Total */}
                      <div className="text-left shrink-0 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs">
                        <div className="text-[10px] text-slate-500 font-medium">
                          {!isPricesHidden && item.product.price > 0 ? 'إجمالي الصنف' : 'الكمية المطلوبة'}
                        </div>
                        <div className="text-xs sm:text-sm font-black text-emerald-800 font-mono">
                          {!isPricesHidden && item.product.price > 0
                            ? `${lineTotal.toLocaleString('ar-EG')} جنيه`
                            : `${item.quantity} ${item.product.unit || 'كرتونة'}`}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Summary & Main Action Buttons */}
            {cart.length > 0 && (
              <div className="p-4 border-t border-slate-100 bg-slate-50/70 space-y-3.5">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-700 font-bold">
                    <span>إجمالي الكمية:</span>
                    <span className="text-slate-900 font-black font-mono">
                      {totalQuantity} كرتونة ({totalItemsCount} أصناف)
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-base font-black text-slate-900 border-t border-slate-200/80 pt-2">
                    <span>إجمالي الفاتورة:</span>
                    <span className="text-lg sm:text-xl text-emerald-800 font-mono font-black">
                      {!isPricesHidden && grandTotal > 0 ? (
                        `${grandTotal.toLocaleString('ar-EG')} جنيه`
                      ) : (
                        <span className="text-xs text-slate-600 font-bold bg-slate-200/70 px-2.5 py-1 rounded-lg">
                          🔒 تسعير معتمد مع إدارة المبيعات
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Primary Dual Actions: [✏️ تعديل الطلب] and [متابعة لإتمام الطلب →] */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  {/* Prominent Edit Order Button */}
                  <button
                    onClick={handleStartEdit}
                    className="py-3.5 px-4 bg-amber-500 hover:bg-amber-600 active:scale-98 text-white font-black text-xs sm:text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 border border-amber-600"
                    title="تعديل الكميات وإضافة أو حذف أصناف"
                  >
                    <Edit3 className="w-4 h-4 shrink-0" />
                    <span>✏️ تعديل الطلب</span>
                  </button>

                  {/* Proceed to Checkout Button */}
                  <button
                    onClick={() => setMode('checkout')}
                    className="py-3.5 px-4 bg-emerald-800 hover:bg-emerald-900 active:scale-98 text-white font-black text-xs sm:text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <span>متابعة لإتمام الطلب</span>
                    <span className="text-base font-bold">←</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ============================================================== */}
        {/* VIEW 2: EDIT ORDER MODE (وضع تعديل الطلب) */}
        {/* ============================================================== */}
        {mode === 'edit' && (
          <>
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between text-xs text-amber-900">
              <div className="flex items-center gap-1.5 font-bold">
                <Info className="w-4 h-4 text-amber-700 shrink-0" />
                <span>يمكنك زيادة أو كتابة الكمية يدويًا أو حذف صنف</span>
              </div>
              <span className="text-[11px] font-mono text-amber-800 font-black">
                {editItems.length} أصناف
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[50vh]">
              {editItems.length === 0 ? (
                <div className="py-8 text-center text-slate-400 space-y-2">
                  <p className="text-xs font-bold text-slate-600">تم حذف جميع الأصناف من التعديل</p>
                  <button
                    onClick={() => setIsAddPickerOpen(true)}
                    className="px-4 py-2 bg-emerald-800 text-white text-xs font-bold rounded-xl"
                  >
                    + إضافة أصناف جديدة من الكتالوج
                  </button>
                </div>
              ) : (
                editItems.map((item) => {
                  const lineTotal = (item.product.price || 0) * item.quantity;
                  return (
                    <div
                      key={item.product.id}
                      className="p-3.5 bg-white border-2 border-amber-200/80 rounded-2xl space-y-2.5 shadow-xs"
                    >
                      {/* Top row: Name, Packaging & Delete Single Item */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-black text-xs sm:text-sm text-slate-900 truncate">
                            {item.product.name}
                          </div>
                          <div className="text-[11px] text-slate-600 mt-0.5 flex flex-wrap items-center gap-1.5">
                            {!isPricesHidden && item.product.price > 0 ? (
                              <span className="font-bold">
                                السعر:{' '}
                                <span className="font-mono text-emerald-800 font-bold">
                                  {item.product.price} جنيه
                                </span>{' '}
                                / {item.product.unit || 'كرتونة'}
                              </span>
                            ) : (
                              <span className="text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                                🔒 تسعير جملة خاص
                              </span>
                            )}
                            {item.product.packaging && (
                              <span className="text-slate-400 text-[10px]">
                                • التعبئة: {item.product.packaging}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Delete Single Item Only */}
                        <button
                          type="button"
                          onClick={() => handleEditItemRemove(item.product.id)}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                          title="حذف هذا الصنف فقط"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Bottom Row: [-] [Editable Input] [+] and Real-time Total */}
                      <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100">
                        {/* Stepper with manual text typing */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-600 ml-1">الكمية:</span>
                          <div className="flex items-center bg-slate-50 border border-slate-300 rounded-xl p-1 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => handleEditItemQtyChange(item.product.id, -1)}
                              disabled={item.quantity <= (item.product.minQty || 1)}
                              className="w-8 h-8 rounded-lg bg-white hover:bg-red-50 hover:text-red-600 text-slate-800 font-black text-sm flex items-center justify-center shadow-2xs disabled:opacity-40 transition-colors"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>

                            {/* Manual Number Input */}
                            <input
                              type="number"
                              min={item.product.minQty || 1}
                              max={item.product.maxQty || 9999}
                              value={item.quantity}
                              onChange={(e) => handleEditItemDirectQty(item.product.id, e.target.value)}
                              className="w-14 text-center font-black text-slate-900 font-mono text-sm bg-transparent focus:outline-none focus:bg-white focus:ring-1 focus:ring-amber-500 rounded-md py-0.5 mx-1"
                            />

                            <button
                              type="button"
                              onClick={() => handleEditItemQtyChange(item.product.id, 1)}
                              disabled={item.product.maxQty !== null && item.quantity >= item.product.maxQty}
                              className="w-8 h-8 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-black text-sm flex items-center justify-center shadow-2xs disabled:opacity-40 transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Real-time Line Calculation */}
                        <div className="text-left">
                          {!isPricesHidden && item.product.price > 0 ? (
                            <>
                              <div className="text-[10px] text-slate-500 font-medium">
                                {item.quantity} × {item.product.price} =
                              </div>
                              <div className="text-xs sm:text-sm font-black text-emerald-800 font-mono">
                                {lineTotal.toLocaleString('ar-EG')} جنيه
                              </div>
                            </>
                          ) : (
                            <div className="text-xs font-black text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">
                              {item.quantity} {item.product.unit || 'كرتونة'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Add New Products From Catalog Button */}
              <button
                type="button"
                onClick={() => setIsAddPickerOpen(true)}
                className="w-full py-3 border-2 border-dashed border-emerald-400 hover:border-emerald-600 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-900 font-black text-xs rounded-2xl transition-all flex items-center justify-center gap-2"
              >
                <PackagePlus className="w-4 h-4 text-emerald-700" />
                <span>+ إضافة أصناف جديدة من الكتالوج</span>
              </button>
            </div>

            {/* Quick Product Picker Modal (Inside Edit Mode) */}
            {isAddPickerOpen && (
              <div className="absolute inset-0 bg-white rounded-t-3xl z-20 flex flex-col p-4 animate-fadeIn">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                    <PackagePlus className="w-4 h-4 text-emerald-700" />
                    <span>إضافة صنف من كتالوج الجملة</span>
                  </h3>
                  <button
                    onClick={() => {
                      setIsAddPickerOpen(false);
                      setProductSearchQuery('');
                    }}
                    className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative my-3">
                  <input
                    type="text"
                    value={productSearchQuery}
                    onChange={(e) => setProductSearchQuery(e.target.value)}
                    placeholder="ابحث عن اسم المنتج، القسم، أو التعبئة..."
                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-700 rounded-xl py-2.5 pr-9 pl-3 text-xs font-bold text-slate-900 focus:outline-none"
                    autoFocus
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>

                {/* Products List */}
                <div className="flex-1 overflow-y-auto space-y-2 max-h-[50vh]">
                  {availableToAddProducts.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      {productSearchQuery ? 'لا توجد نتائج مطابقة للبحث' : 'جميع الأصناف المتاحة مضافة بالفعل للسلة'}
                    </div>
                  ) : (
                    availableToAddProducts.map((prod) => (
                      <div
                        key={prod.id}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 hover:border-emerald-400 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs text-slate-900 truncate">{prod.name}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {!isPricesHidden && prod.price > 0 ? (
                              <span className="text-emerald-800 font-bold font-mono">{prod.price} جنيه / {prod.unit || 'كرتونة'}</span>
                            ) : (
                              <span className="text-slate-500 font-bold">🔒 تسعير خاص</span>
                            )}
                            {prod.packaging && ` • ${prod.packaging}`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddProductToEditList(prod)}
                          className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-black text-xs rounded-xl shadow-xs shrink-0 flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>إضافة</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Bottom Summary & Actions in Edit Mode: [💾 حفظ التعديلات] & [← العودة للسلة] */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-700 font-bold">
                  <span>إجمالي الكمية المعدلة:</span>
                  <span className="text-slate-900 font-black font-mono">
                    {totalQuantity} كرتونة ({totalItemsCount} أصناف)
                  </span>
                </div>

                <div className="flex items-center justify-between text-base font-black text-slate-900 border-t border-slate-200 pt-1.5">
                  <span>إجمالي الفاتورة المحدث:</span>
                  <span className="text-lg sm:text-xl text-emerald-800 font-mono font-black">
                    {!isPricesHidden && grandTotal > 0 ? (
                      `${grandTotal.toLocaleString('ar-EG')} جنيه`
                    ) : (
                      <span className="text-xs text-slate-600 font-bold bg-slate-200/70 px-2.5 py-1 rounded-lg">
                        🔒 تسعير معتمد مع إدارة المبيعات
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Edit Mode Buttons */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={loading}
                  className="py-3 px-4 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs sm:text-sm rounded-2xl transition-colors flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>← العودة للسلة</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveEdits}
                  disabled={loading}
                  className="py-3 px-4 bg-emerald-800 hover:bg-emerald-900 active:scale-98 text-white font-black text-xs sm:text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{loading ? 'جاري التحقق...' : '💾 حفظ التعديلات'}</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* ============================================================== */}
        {/* VIEW 3: CHECKOUT DETAILS & SUBMIT (تأكيد الطلب) */}
        {/* ============================================================== */}
        {mode === 'checkout' && (
          <div className="p-4 space-y-3.5 overflow-y-auto max-h-[75vh]">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-xs text-emerald-900 flex items-center gap-2.5">
              <Truck className="w-4 h-4 text-emerald-700 shrink-0" />
              <div>
                <span className="font-bold">توصيل جملة مباشر:</span> الدفع نقداً أو حسب الاتفاق مع المندوب عند الاستلام.
              </div>
            </div>

            {/* Customer Inputs */}
            <div className="space-y-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم العميل / صاحب المحل <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={user ? user.fullName : guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    disabled={!!user}
                    placeholder="مثال: الحاج أحمد فوزي"
                    className="w-full bg-white border border-slate-300 focus:border-emerald-700 rounded-xl py-2.5 pr-9 pl-3 text-xs font-bold text-slate-900 focus:outline-none disabled:bg-slate-100"
                  />
                  <UserIcon className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم المحل / السوبر ماركت
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={user?.storeName || guestStore}
                    onChange={(e) => setGuestStore(e.target.value)}
                    disabled={!!user?.storeName}
                    placeholder="مثال: سوبر ماركت الأمانة"
                    className="w-full bg-white border border-slate-300 focus:border-emerald-700 rounded-xl py-2.5 pr-9 pl-3 text-xs font-bold text-slate-900 focus:outline-none disabled:bg-slate-100"
                  />
                  <Store className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رقم الهاتف (للتواصل والتأكيد) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={user ? user.phone : guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    disabled={!!user}
                    placeholder="مثال: 01012345678"
                    className="w-full bg-white border border-slate-300 focus:border-emerald-700 rounded-xl py-2.5 pr-9 pl-3 text-xs font-bold text-slate-900 focus:outline-none disabled:bg-slate-100 font-mono"
                  />
                  <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  عنوان التسليم / المنطقة
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={user?.address || guestAddress}
                    onChange={(e) => setGuestAddress(e.target.value)}
                    placeholder="مثال: الإسكندرية - بجوار مسجد القويري بوابة 8"
                    className="w-full bg-white border border-slate-300 focus:border-emerald-700 rounded-xl py-2.5 pr-9 pl-3 text-xs font-bold text-slate-900 focus:outline-none"
                  />
                  <MapPin className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ملاحظات الطلب أو موعد التسليم المفضل
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: يرجى التسليم قبل العصر / الاتصال قبل التحرك"
                  rows={2}
                  className="w-full bg-white border border-slate-300 focus:border-emerald-700 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none resize-none font-medium"
                />
              </div>
            </div>

            {/* Order Totals Summary */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>الأصناف ({totalItemsCount}):</span>
                <span className="font-bold text-slate-900">{totalQuantity} كرتونة</span>
              </div>
              <div className="flex justify-between font-black text-slate-900 text-sm pt-1 border-t border-slate-200">
                <span>المبلغ المطلوب عند الاستلام:</span>
                <span className="text-emerald-800 font-mono text-base font-black">
                  {!isPricesHidden && grandTotal > 0 ? (
                    `${grandTotal.toLocaleString('ar-EG')} جنيه`
                  ) : (
                    <span className="text-xs text-slate-600 font-bold bg-slate-200/70 px-2 py-0.5 rounded">
                      🔒 تسعير معتمد عند التسليم
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setMode('view')}
                disabled={loading}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition-colors"
              >
                رجوع للسلة
              </button>

              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={loading}
                className="flex-1 py-3.5 bg-emerald-800 hover:bg-emerald-900 active:scale-98 text-white font-black text-sm rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{loading ? 'جاري إرسال الطلب...' : 'تأكيد وإرسال الطلب الآن'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
