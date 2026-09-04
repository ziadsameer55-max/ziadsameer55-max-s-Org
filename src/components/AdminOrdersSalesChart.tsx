import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Order } from '../types';
import {
  TrendingUp,
  Calendar,
  ShoppingBag,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Award,
  Layers,
} from 'lucide-react';

interface AdminOrdersSalesChartProps {
  orders: Order[];
}

interface DayData {
  dateKey: string;
  dayLabel: string;
  shortLabel: string;
  fullDateStr: string;
  orderCount: number;
  totalRevenue: number;
  deliveredCount: number;
  pendingCount: number;
}

// Helper to safely parse dates regardless of format (ISO, Arabic locale, or order id timestamp)
function parseOrderDate(order: Order): Date {
  // 1. Try order ID timestamp (e.g. ord_1788212795351_mskp)
  if (order.id && order.id.startsWith('ord_')) {
    const parts = order.id.split('_');
    const ts = parseInt(parts[1], 10);
    if (!isNaN(ts) && ts > 1600000000000) {
      return new Date(ts);
    }
  }

  // 2. Try createdAt
  if (order.createdAt) {
    // Clean arabic numbers and special bidi chars
    const cleaned = order.createdAt
      .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u061C]/g, '')
      .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());

    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) {
      return d;
    }

    // Try matching D/M/YYYY or YYYY-M-D
    const match = cleaned.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const year = parseInt(match[3], 10);
      return new Date(year, month, day);
    }
  }

  return new Date();
}

const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export const AdminOrdersSalesChart: React.FC<AdminOrdersSalesChartProps> = ({ orders }) => {
  const [chartMode, setChartMode] = useState<'orders' | 'revenue' | 'both'>('orders');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Compute 7-day data
  const { chartData, kpis } = useMemo(() => {
    const now = new Date();
    const days: DayData[] = [];

    // Build the last 7 days slots from 6 days ago up to today
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);

      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dayNum = String(d.getDate()).padStart(2, '0');
      const dateKey = `${y}-${m}-${dayNum}`;

      const dayName = ARABIC_DAYS[d.getDay()];
      const isToday = i === 0;
      const isYesterday = i === 1;

      let label = `${dayName} ${dayNum}/${m}`;
      if (isToday) label = `اليوم (${dayName})`;
      else if (isYesterday) label = `أمس (${dayName})`;

      days.push({
        dateKey,
        dayLabel: label,
        shortLabel: `${dayNum}/${m}`,
        fullDateStr: d.toLocaleDateString('ar-EG', { dateStyle: 'medium' }),
        orderCount: 0,
        totalRevenue: 0,
        deliveredCount: 0,
        pendingCount: 0,
      });
    }

    // Map orders to days
    const safeOrders = Array.isArray(orders) ? orders : [];
    let total7DayOrders = 0;
    let total7DayRevenue = 0;

    safeOrders.forEach((ord) => {
      const orderDate = parseOrderDate(ord);
      const y = orderDate.getFullYear();
      const m = String(orderDate.getMonth() + 1).padStart(2, '0');
      const dayNum = String(orderDate.getDate()).padStart(2, '0');
      const orderDateKey = `${y}-${m}-${dayNum}`;

      const targetDay = days.find((d) => d.dateKey === orderDateKey);
      if (targetDay) {
        targetDay.orderCount += 1;
        const rev = Number(ord.grandTotal || 0);
        targetDay.totalRevenue += rev;

        total7DayOrders += 1;
        total7DayRevenue += rev;

        if (ord.status === 'Delivered') {
          targetDay.deliveredCount += 1;
        } else if (ord.status === 'Pending') {
          targetDay.pendingCount += 1;
        }
      }
    });

    // Determine peak day
    let peakDay = days[0];
    days.forEach((d) => {
      if (d.orderCount > (peakDay?.orderCount || 0)) {
        peakDay = d;
      }
    });

    const averageDailyOrders = (total7DayOrders / 7).toFixed(1);
    const averageOrderValue = total7DayOrders > 0 ? Math.round(total7DayRevenue / total7DayOrders) : 0;

    return {
      chartData: days,
      kpis: {
        totalOrders: total7DayOrders,
        totalRevenue: total7DayRevenue,
        averageDailyOrders,
        averageOrderValue,
        peakDayLabel: peakDay && peakDay.orderCount > 0 ? `${peakDay.dayLabel} (${peakDay.orderCount} طلب)` : 'لا توجد بيانات',
      },
    };
  }, [orders]);

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data: DayData = payload[0].payload;
      return (
        <div
          dir="rtl"
          className="bg-slate-900/95 backdrop-blur-sm text-white p-3.5 rounded-xl border border-slate-700 shadow-xl text-right text-xs space-y-2 min-w-[180px]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-1.5 font-bold text-slate-200">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>{data.dayLabel}</span>
            </span>
            <span className="text-[10px] text-slate-400 font-normal">{data.shortLabel}</span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-emerald-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>حجم الطلبات:</span>
              </span>
              <span className="font-black text-sm">{data.orderCount} طلب</span>
            </div>

            <div className="flex items-center justify-between text-blue-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                <span>قيمة المبيعات:</span>
              </span>
              <span className="font-bold">{data.totalRevenue.toLocaleString('ar-EG')} ج.م</span>
            </div>

            {data.orderCount > 0 && (
              <div className="pt-1 border-t border-slate-800 text-[11px] text-slate-300 flex items-center justify-between">
                <span>متوسط الفاتورة:</span>
                <span className="font-semibold text-amber-300">
                  {Math.round(data.totalRevenue / data.orderCount).toLocaleString('ar-EG')} ج.م
                </span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      id="admin-orders-analytics-section"
      dir="rtl"
      className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-5 shadow-xs text-right space-y-4 transition-all"
    >
      {/* Header with Title & Collapse Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shadow-xs">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <span>نشاط وحجم الطلبات اليومية</span>
              <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                آخر 7 أيام
              </span>
            </h3>
            <p className="text-xs text-slate-500">تحليل فوري لحركة المبيعات وتدفق الطلبات لمساعدة الإدارة</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode switcher */}
          {!isCollapsed && (
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                id="chart-mode-orders-btn"
                onClick={() => setChartMode('orders')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  chartMode === 'orders'
                    ? 'bg-emerald-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>حجم الطلبات</span>
              </button>

              <button
                type="button"
                id="chart-mode-revenue-btn"
                onClick={() => setChartMode('revenue')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  chartMode === 'revenue'
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>قيمة المبيعات</span>
              </button>

              <button
                type="button"
                id="chart-mode-both-btn"
                onClick={() => setChartMode('both')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  chartMode === 'both'
                    ? 'bg-slate-800 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>عرض مزدوج</span>
              </button>
            </div>
          )}

          {/* Toggle Collapsible */}
          <button
            type="button"
            id="toggle-orders-chart-btn"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors"
            title={isCollapsed ? 'عرض المخطط البياني' : 'طي المخطط البياني'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">إجمالي طلبات الـ 7 أيام</div>
            <div className="font-black text-slate-900 text-sm sm:text-base">
              {kpis.totalOrders}{' '}
              <span className="text-xs font-normal text-slate-500">طلب</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <DollarSign className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">إجمالي المبيعات (7 أيام)</div>
            <div className="font-black text-slate-900 text-sm sm:text-base">
              {kpis.totalRevenue.toLocaleString('ar-EG')}{' '}
              <span className="text-xs font-normal text-slate-500">ج.م</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">معدل الطلب اليومي</div>
            <div className="font-black text-slate-900 text-sm sm:text-base">
              {kpis.averageDailyOrders}{' '}
              <span className="text-xs font-normal text-slate-500">طلب/يوم</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
            <Award className="w-4 h-4" />
          </div>
          <div className="truncate">
            <div className="text-[11px] text-slate-500 font-medium">اليوم الأعلى نشاطاً</div>
            <div className="font-bold text-slate-900 text-xs truncate" title={kpis.peakDayLabel}>
              {kpis.peakDayLabel}
            </div>
          </div>
        </div>
      </div>

      {/* Main Line Chart (Recharts) */}
      {!isCollapsed && (
        <div className="pt-2">
          <div className="h-[250px] sm:h-[280px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="shortLabel"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  stroke="#cbd5e1"
                  tickLine={false}
                />
                
                {/* Left Y Axis for Orders count */}
                {(chartMode === 'orders' || chartMode === 'both') && (
                  <YAxis
                    yAxisId="ordersAxis"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#059669' }}
                    stroke="#10b981"
                    tickLine={false}
                    axisLine={false}
                    orientation="left"
                  />
                )}

                {/* Right Y Axis for Revenue */}
                {(chartMode === 'revenue' || chartMode === 'both') && (
                  <YAxis
                    yAxisId="revenueAxis"
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: '#2563eb' }}
                    stroke="#3b82f6"
                    tickLine={false}
                    axisLine={false}
                    orientation={chartMode === 'revenue' ? 'left' : 'right'}
                    tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`)}
                  />
                )}

                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={30}
                  iconType="circle"
                  wrapperStyle={{ fontSize: '11px', paddingBottom: '6px' }}
                />

                {/* Line 1: Order Volume */}
                {(chartMode === 'orders' || chartMode === 'both') && (
                  <Line
                    yAxisId="ordersAxis"
                    type="monotone"
                    dataKey="orderCount"
                    name="حجم الطلبات (عدد)"
                    stroke="#059669"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#059669', strokeWidth: 2, stroke: '#ffffff' }}
                    activeDot={{ r: 6, fill: '#047857', stroke: '#ffffff', strokeWidth: 2 }}
                    isAnimationActive={true}
                  />
                )}

                {/* Line 2: Revenue */}
                {(chartMode === 'revenue' || chartMode === 'both') && (
                  <Line
                    yAxisId="revenueAxis"
                    type="monotone"
                    dataKey="totalRevenue"
                    name="قيمة المبيعات (ج.م)"
                    stroke="#2563eb"
                    strokeWidth={chartMode === 'both' ? 2 : 3}
                    strokeDasharray={chartMode === 'both' ? '4 4' : undefined}
                    dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#ffffff' }}
                    activeDot={{ r: 6, fill: '#1d4ed8', stroke: '#ffffff', strokeWidth: 2 }}
                    isAnimationActive={true}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
            <span>• البيانات يتم تحديثها تلقائياً مع كل طلب جديد يتم استلامه</span>
            <span>شركة الحليم للتجارة والتوزيع</span>
          </div>
        </div>
      )}
    </div>
  );
};
