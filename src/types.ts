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
  status?: 'active' | 'suspended';
  token?: string;
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

export type PaymentMethod = 'Cash' | 'Bank' | 'VodafoneCash' | 'Check' | 'Other';

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
  totalOutstandingDebt: number;
  debtorsCount: number;
  totalOrdersCount: number;
  paidOrdersCount: number;
  partialOrdersCount: number;
  unpaidOrdersCount: number;
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
  paymentStatus: PaymentStatus; // Paid | Partial | Unpaid
  notes?: string;
  adminNotes?: string;
  items?: OrderItem[];
  payments?: PaymentTransaction[];
}

export type PaperSize = '58mm' | '80mm' | '57mm' | '76mm' | 'A4' | 'A5';

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
