export type UserRole = 'admin' | 'customer';

export interface User {
  id: string;
  username: string;
  fullName: string;
  phone: string;
  role: UserRole;
  storeName?: string;
  address?: string;
  creditBalance?: number;
  status?: 'active' | 'suspended' | 'disabled';
  token?: string;
  createdAt?: string;
}

export interface AdminCustomerRecord {
  id: string;
  username: string;
  fullName: string;
  storeName: string;
  phone: string;
  address?: string;
  ordersCount: number;
  totalPurchases: number;
  currentDebt: number;
  totalPaid: number;
  createdAt: string;
  status: 'active' | 'disabled';
}

export type ProductStatus = 'open' | 'locked' | 'hidden';

export interface Product {
  id: string;
  name: string;
  brand?: string;
  category: string;
  size?: string;
  packaging?: string; // e.g. "كرتونة 24 كانز", "كرتونة 15 كيس"
  price: number; // Wholesale carton / balta price in EGP
  unit: string; // كرتونة, بالتة, باكت, شيكارة, لفة, صندوق
  image: string;
  status: ProductStatus;
  minQty: number; // default 1
  maxQty: number | null; // null means unlimited (بدون حد أقصى)
  stock: number; // Inventory quantity in cartons
  lowStockThreshold?: number; // threshold for supply warning (default 5)
  description?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
}

export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Preparing'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled';

export type PaymentStatus = 'Paid' | 'Partial' | 'Unpaid';

export type PaymentMethod = 'Cash' | 'Bank' | 'VodafoneCash' | 'Check' | 'Cheque' | 'Other';

export interface PaymentTransaction {
  id: string;
  orderId?: string;
  orderNumber?: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  collectedBy: string;
  notes?: string;
  createdAt: string;
}

export interface CustomerDebtSummary {
  customerId: string;
  customerName: string;
  customerPhone: string;
  storeName?: string;
  address?: string;
  totalInvoiced: number;
  totalPaid: number;
  totalDebt: number; // totalInvoiced - totalPaid
  unpaidOrdersCount: number;
  paidOrdersCount: number;
  lastOrderDate?: string;
  lastPaymentDate?: string;
}

export interface FinancialSummary {
  totalSales: number;
  totalCollected: number;
  collectedToday?: number;
  collectedThisWeek?: number;
  collectedThisMonth?: number;
  collectedThisYear?: number;
  totalOutstandingDebt: number;
  debtorsCount: number;
  totalOrdersCount: number;
  paidOrdersCount: number;
  partialOrdersCount: number;
  unpaidOrdersCount: number;
}

export type CollectionPeriod =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'last_year'
  | 'custom';

export interface CollectionsReportData {
  summary: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    thisYear: number;
    totalOutstandingDebt: number;
    totalSales: number;
    totalCollectedAllTime: number;
  };
  periodSummary: {
    period: CollectionPeriod;
    startDate?: string;
    endDate?: string;
    totalCollected: number;
    transactionsCount: number;
    byMethod: {
      Cash: number;
      Bank: number;
      VodafoneCash: number;
      Cheque: number;
      Other: number;
    };
  };
  payments: PaymentTransaction[];
}

export interface CustomerStatement {
  customer: {
    id: string;
    name: string;
    phone: string;
    storeName?: string;
    address?: string;
  };
  summary: {
    totalInvoiced: number;
    totalPaid: number;
    totalDebt: number;
    ordersCount: number;
    paymentsCount: number;
  };
  orders: Order[];
  payments: PaymentTransaction[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  unit: string;
  discount: number;
  totalPrice: number; // (unitPrice * quantity) - discount
}

export interface Order {
  id: string;
  orderNumber: string; // e.g. #10254
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  salesRep: string; // "محمد فوزي"
  status: OrderStatus;
  createdAt: string; // ISO string or formatted date
  updatedAt: string;
  itemsCount: number; // number of distinct items
  totalQuantity: number;
  subtotal: number;
  discount: number;
  grandTotal: number;
  paidAmount: number; // المبلغ المدفوع
  remainingBalance: number; // المبلغ المتبقي = grandTotal - paidAmount
  previousDebt?: number; // المديونية السابقة للعميل المحسوبة من الخادم
  currentInvoice?: number; // الفاتورة الحالية (grandTotal)
  totalDueWithDebt?: number; // الإجمالي المستحق = المديونية السابقة + الفاتورة الحالية
  finalRemainingWithDebt?: number; // المتبقي النهائي = الإجمالي المستحق - المدفوع
  paymentStatus: PaymentStatus; // Paid | Partial | Unpaid
  notes?: string;
  adminNotes?: string;
  items?: OrderItem[];
  payments?: PaymentTransaction[];
}

export type PaperSize = '58mm' | '80mm' | '57mm' | '76mm' | 'A4' | 'A5' | 'custom';

export interface PrintFontSizes {
  header: number; // e.g. 13 - 22px
  meta: number; // e.g. 10 - 15px
  tableHeader: number; // e.g. 10 - 14px
  tableRows: number; // e.g. 10 - 14px
  summary: number; // e.g. 11 - 16px
  footer: number; // e.g. 9 - 13px
}

export interface DaySchedule {
  dayName: string; // السبت, الأحد, ...
  dayKey: 'sat' | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri';
  isOpen: boolean;
  openTime: string; // "08:00"
  closeTime: string; // "22:00"
}

export interface SystemSettings {
  companyName: string; // شركة الحليم للتجارة والتوزيع
  managerName: string; // إدارة الحاج فوزي عبد الحليم
  salesRepName: string; // المندوب: محمد فوزي
  phonePrimary: string;
  phoneSecondary: string;
  address: string;
  receiptFooter: string;
  paperSize: PaperSize;
  customWidthMm?: number; // Custom thermal width in mm (e.g. 72mm, 100mm)
  customHeightMm?: number; // Custom thermal/paper height in mm (optional)
  printFontSizes?: PrintFontSizes; // Fine-grained font sizes for each receipt element
  
  // Ordering manual controls
  isManualOverrideActive: boolean; // if true, manual status wins
  manualOrdersOpen: boolean; // manual state: open (true) or closed (false)
  
  // Security & Wholesale Price Visibility Controls (Server-Enforced)
  hidePrices?: boolean; // 🔐 إخفاء الأسعار عن العملاء

  // Schedule settings
  scheduleEnabled: boolean;
  weeklySchedule: DaySchedule[];

  // Inventory settings
  preventOutOfStockSale: boolean;
  lowStockThreshold?: number; // default 5 units for supply alerts

  // Invoice & Receipt Debt Breakdown & Styling Controls
  showPreviousDebtOnReceipt?: boolean; // إظهار المديونية السابقة والإجمالي المستحق في الفاتورة المطبوعة
  showHeaderLogo?: boolean; // إظهار شعار وترويسة الشركة في الطباعة
  showItemsBorder?: boolean; // إظهار خطوط وحدود جدول الأصناف في الطباعة

  // AI Assistant & Support settings
  aiAssistantEnabled?: boolean;
  supportPhone?: string;
  supportWhatsapp?: string;
  supportWorkingHours?: string;
  aiGreetingMessage?: string;
}

export interface OrderLog {
  id: string;
  orderId: string;
  timestamp: string;
  action: string;
  performedBy: string;
  details: string;
}

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'system' | 'stock';
  read: boolean;
  createdAt: string;
  orderId?: string;
}

export type OfferType =
  | 'discount' // 🔥 خصم
  | 'special_price' // 🎁 سعر خاص
  | 'new_product' // ⭐ منتج جديد
  | 'carton_deal' // 📦 سعر كرتونة مميز
  | 'bestseller' // 🏆 الأكثر طلبًا
  | 'limited_time'; // ⏰ عرض لفترة محدودة

export type InformationType =
  | 'general' // 📢 إعلان عام
  | 'price_change' // 🏷️ تغيير أسعار
  | 'deal' // 🔥 عرض ترويجي
  | 'offer' // 🔥 عرض خاص
  | 'urgent' // ⚠️ تنبيه عاجل
  | 'warning' // ⚠️ تحذير وتنبيه
  | 'policy' // 📦 تعليمات وتوريدات
  | 'schedule'; // ⏰ مواعيد عمل وتوزيع

export type InformationPriority = 'normal' | 'high' | 'urgent';

export type InformationStatus = 'draft' | 'published' | 'archived';

export interface InformationItem {
  id: string;
  title: string;
  content: string;
  type: InformationType;
  priority: InformationPriority;
  targetType: 'all' | 'specific_customer' | 'group';
  targetId?: string | null;
  targetName?: string | null;
  productId?: string | null;
  productName?: string | null;
  productImage?: string | null;
  productUnit?: string | null;
  oldPrice?: number | null;
  newPrice?: number | null;
  priceChangePercentage?: number | null;
  status: InformationStatus;
  publishedAt: string; // ISO string
  expiresAt?: string | null; // ISO string
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  // Dynamic fields computed per user
  isRead?: boolean;
  readAt?: string | null;
  readCount?: number;
  totalTargetCount?: number;
}

export interface InformationRead {
  id: string;
  informationId: string;
  userId: string;
  readAt: string;
}

export interface DealOffer {
  id: string;
  productId: string;
  productName: string;
  productImage?: string;
  productBrand?: string;
  productSize?: string;
  productUnit?: string;
  category?: string;
  offerType: OfferType;
  badgeText: string; // e.g. "خصم خاص", "الأكثر طلباً", "لفترة محدودة"
  offerPrice: number; // Wholesale deal price in EGP
  originalPrice: number; // Previous/Regular price in EGP
  discountPercentage?: number;
  startDate: string; // YYYY-MM-DD or ISO string
  endDate?: string | null; // YYYY-MM-DD or ISO string (null = indefinite)
  description?: string;
  isActive: boolean;
  targetType?: 'all' | 'specific_customer' | 'group';
  targetId?: string | null;
  createdAt: string;
  // Computed runtime fields
  isExpired?: boolean;
  remainingSeconds?: number;
}
