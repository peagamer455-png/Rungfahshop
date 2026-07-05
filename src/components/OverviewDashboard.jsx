import React, { useState, useEffect, useRef } from 'react';
import { supabase } from "../supabaseClient";
import { Header } from "./SharedUI";

/* ============================================================
   DESIGN SYSTEM — โทนสีกลาง ใช้ซ้ำได้ทั้งโปรเจกต์
   อ้างอิง Stripe / Vercel / Linear / Supabase / Tailwind UI
   ============================================================ */
export const theme = {
  colors: {
    primary: '#2563EB',
    primaryHover: '#1D4ED8',
    success: '#10B981',
    danger: '#EF4444',
    warning: '#F59E0B',
    info: '#06B6D4',
    purple: '#7C3AED',
    teal: '#14B8A6',
    orange: '#F97316',
    title: '#111827',
    text: '#374151',
    subtext: '#6B7280',
    disabled: '#9CA3AF',
    border: '#E5E7EB',
    bg: '#F8FAFC',
  },
  page: 'bg-[#F8FAFC] min-h-screen',
  card: 'bg-white rounded-2xl border border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.05)]',
  cardHover: 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(0,0,0,0.08)]',
  title: 'text-[#111827] font-bold',
  text: 'text-[#374151]',
  subtext: 'text-[#6B7280]',
};

/* Badge เพิ่ม/ลด — Pill shape ตามสเปก */
const GrowthBadge = ({ value }) => {
  if (value === null || value === undefined) return null;
  const isUp = value >= 0;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
      style={{
        background: isUp ? '#DCFCE7' : '#FEE2E2',
        color: isUp ? '#15803D' : '#DC2626',
      }}
    >
      <span className="text-[10px]">{isUp ? '▲' : '▼'}</span>
      {Math.abs(value).toFixed(1)}%
    </span>
  );
};

/* ============================================================
   KPI CARD
   ============================================================ */
const StatCard = ({ title, value, icon, accentColor, growth }) => (
  <div className={`${theme.card} ${theme.cardHover} p-6`}>
    <div className="flex items-start justify-between mb-4">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center text-lg"
        style={{ background: `${accentColor}14` }}
      >
        <span style={{ filter: 'saturate(1.1)' }}>{icon}</span>
      </div>
      {growth !== undefined && <GrowthBadge value={growth} />}
    </div>
    <p className="text-sm text-[#6B7280] font-medium mb-1">{title}</p>
    <h3 className="text-3xl font-bold tracking-tight" style={{ color: accentColor }}>
      {value}
    </h3>
  </div>
);

/* ============================================================
   SECTION COMPARISON CARD (วันนี้ / เดือนนี้ / ไตรมาส / ปี)
   ============================================================ */
const MetricRow = ({ label, currentValue, previousValue, growth, formatCurrency }) => {
  const hasGrowth = growth !== null && growth !== undefined;
  const isUp = hasGrowth && growth >= 0;

  return (
    <div className="rounded-xl p-4" style={{ background: '#F8FAFC', border: '1px solid #E5E7EB' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6B7280' }}>
          {label}
        </span>
        {hasGrowth ? (
          <GrowthBadge value={growth} />
        ) : (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#F3F4F6', color: '#9CA3AF' }}>
            ข้อมูลใหม่
          </span>
        )}
      </div>

      <div
        className="text-2xl font-bold mb-1"
        style={{ color: hasGrowth ? (isUp ? '#15803D' : '#DC2626') : theme.colors.title }}
      >
        {formatCurrency(currentValue)}
      </div>

      <div className="text-xs font-medium" style={{ color: theme.colors.text }}>
        ช่วงก่อนหน้า:{' '}
        <span className="font-bold" style={{ color: theme.colors.text }}>
          {formatCurrency(previousValue)}
        </span>
      </div>
    </div>
  );
};

const ComparisonCard = ({ title, comparison, comparisonLabel, formatCurrency }) => {
  if (!comparison) return null;
  return (
    <div className={`${theme.card} ${theme.cardHover} overflow-hidden`}>
      {/* Header ขาว + แถบบางสี Primary ด้านซ้าย ตามสเปก */}
      <div className="px-5 py-3.5 flex items-center gap-3 border-b" style={{ borderColor: '#E5E7EB' }}>
        <span className="w-1 h-5 rounded-full" style={{ background: theme.colors.primary }} />
        <p className="text-base font-semibold" style={{ color: theme.colors.title }}>{title}</p>
      </div>
      <div className="p-4 space-y-3">
        <MetricRow
          label="ยอดขาย"
          currentValue={comparison.current_sale}
          previousValue={comparison.previous_sale}
          growth={comparison.sale_growth}
          formatCurrency={formatCurrency}
        />
        <MetricRow
          label="กำไร"
          currentValue={comparison.current_profit}
          previousValue={comparison.previous_profit}
          growth={comparison.profit_growth}
          formatCurrency={formatCurrency}
        />
        <p className="text-xs text-center pt-1" style={{ color: theme.colors.disabled }}>
          {comparisonLabel}
        </p>
      </div>
    </div>
  );
};

/* ============================================================
   CHART — Revenue #3B82F6 / Profit #10B981 / Grid #E5E7EB
   ============================================================ */
const BarChart = ({ chartData, labels, formatCurrency }) => {
  const [tooltip, setTooltip] = useState(null);
  const containerRef = useRef(null);

  const localMax = React.useMemo(() => {
    if (!chartData || chartData.length === 0) return 1;
    const vals = chartData.flatMap(d => [d.profit || 0, d.total_net ?? d.sale ?? 0]);
    return Math.max(...vals, 1);
  }, [chartData]);

  return (
    <div ref={containerRef} className="relative flex items-end h-[260px] gap-[3px] pb-1 overflow-visible">
      {chartData?.map((d, i) => {
        const saleVal = d.total_net ?? d.sale ?? 0;
        const profitVal = d.profit || 0;
        const saleHeightPct = localMax > 0 ? (saleVal / localMax) * 100 : 0;
        const profitHeightPct = localMax > 0 ? (profitVal / localMax) * 100 : 0;
        const isActive = tooltip?.index === i;

        return (
          <div
            key={i}
            className="relative flex-1 h-full flex flex-col items-center justify-end group cursor-pointer"
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const containerRect = containerRef.current.getBoundingClientRect();
              setTooltip({
                index: i,
                x: rect.left - containerRect.left + rect.width / 2,
                y: rect.top - containerRect.top,
                label: labels[i],
                sale: saleVal,
                profit: profitVal,
              });
            }}
            onMouseLeave={() => setTooltip(null)}
          >
            <div
              className="absolute bottom-0 w-full rounded-t-[4px] transition-all duration-200"
              style={{
                height: `${saleHeightPct}%`,
                background: '#3B82F6',
                opacity: isActive ? 1 : 0.85,
                minHeight: saleHeightPct > 0 ? '3px' : '0',
              }}
            />
            <div
              className="absolute bottom-0 rounded-t-[4px] transition-all duration-200"
              style={{
                width: '52%',
                height: `${profitHeightPct}%`,
                background: '#10B981',
                opacity: isActive ? 1 : 0.9,
                minHeight: profitHeightPct > 0 ? '3px' : '0',
              }}
            />
            <span className="absolute -bottom-6 text-[10px] font-medium select-none" style={{ color: theme.colors.subtext }}>
              {labels[i]}
            </span>
          </div>
        );
      })}

      {/* Grid lines */}
      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none -z-10">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="w-full border-t" style={{ borderColor: '#E5E7EB' }} />
        ))}
      </div>

      {tooltip && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{ left: `${tooltip.x}px`, top: `${tooltip.y - 8}px`, transform: 'translate(-50%, -100%)' }}
        >
          <div
            className="rounded-xl px-4 py-3 min-w-[150px]"
            style={{ background: '#FFFFFF', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', border: '1px solid #E5E7EB' }}
          >
            <p className="text-sm font-bold mb-1.5" style={{ color: theme.colors.title }}>{tooltip.label}</p>
            <div className="flex justify-between gap-4 text-xs mb-0.5">
              <span style={{ color: theme.colors.subtext }}>ยอดขาย</span>
              <span className="font-bold" style={{ color: '#3B82F6' }}>{formatCurrency(tooltip.sale)}</span>
            </div>
            <div className="flex justify-between gap-4 text-xs">
              <span style={{ color: theme.colors.subtext }}>กำไร</span>
              <span className="font-bold" style={{ color: '#10B981' }}>{formatCurrency(tooltip.profit)}</span>
            </div>
            <div className="flex justify-between gap-4 text-xs pt-1.5 mt-1.5 border-t" style={{ borderColor: '#E5E7EB' }}>
              <span style={{ color: theme.colors.disabled }}>อัตรากำไร</span>
              <span className="font-bold" style={{ color: theme.colors.text }}>
                {tooltip.sale > 0 ? ((tooltip.profit / tooltip.sale) * 100).toFixed(1) : '0.0'}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================
   MAIN DASHBOARD
   ============================================================ */
const OverviewDashboard = ({ formatCurrency, openPasswordModal, setSidebarOpen }) => {
  const [timeRange, setTimeRange] = useState('month');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const hasOpenedModal = useRef(false);

  useEffect(() => {
    if (!isAuthorized && !hasOpenedModal.current) {
      hasOpenedModal.current = true;
      openPasswordModal(() => setIsAuthorized(true));
    }
  }, [isAuthorized, openPasswordModal]);

  useEffect(() => {
    if (!isAuthorized) return;
    const fetchStats = async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_dashboard_stats', { p_range: timeRange });
      if (!error && data) setStats(data);
      else console.error("Dashboard Error:", error);
      setLoading(false);
    };
    fetchStats();
  }, [timeRange, isAuthorized]);

  if (!isAuthorized) return (
    <div className={`flex items-center justify-center min-h-screen ${theme.page}`}>
      <p style={{ color: theme.colors.subtext }} className="font-medium">กรุณายืนยันตัวตน</p>
    </div>
  );
  if (loading) return (
    <div className={`flex items-center justify-center min-h-screen ${theme.page}`}>
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto"
          style={{ borderColor: '#E5E7EB', borderTopColor: theme.colors.primary }} />
        <p className="text-sm" style={{ color: theme.colors.subtext }}>กำลังโหลดข้อมูล...</p>
      </div>
    </div>
  );
  if (!stats) return (
    <div className={`flex items-center justify-center min-h-screen ${theme.page}`}>
      <p style={{ color: theme.colors.disabled }}>ไม่พบข้อมูล</p>
    </div>
  );

  const timeRanges = [
    { id: 'week', label: 'สัปดาห์' },
    { id: 'month', label: 'เดือน' },
    { id: 'quarter', label: 'ไตรมาส' },
    { id: 'year_months', label: 'ปี' },
    { id: 'year', label: '5 ปี' },
  ];

  const profitMargin = stats.totalsale > 0 ? (stats.totalProfit / stats.totalsale) * 100 : 0;
  const c = stats.comparisons || {};

  // แมป growth ของ KPI card ตามช่วงเวลาที่เลือก (ใช้ข้อมูลจริงจาก comparisons เท่านั้น)
  const growthForRange = timeRange === 'month' ? c.month
    : timeRange === 'quarter' ? c.quarter
    : (timeRange === 'year_months' || timeRange === 'year') ? c.year
    : null;

  return (
    <div className={theme.page}>
      <Header title="สรุปภาพรวมร้านค้า" onToggleSidebar={() => setSidebarOpen(prev => !prev)} />

      <div className="p-6 lg:p-8 max-w-7xl mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

        {/* Time Range Picker */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: theme.colors.title }}>ภาพรวมยอดขาย</h2>
            <p className="text-xs mt-1" style={{ color: theme.colors.subtext }}>
              วิเคราะห์ยอดขาย กำไร และแนวโน้มการเติบโต
            </p>
          </div>
          <div className={`flex p-1 gap-1 ${theme.card}`}>
            {timeRanges.map(r => (
              <button
                key={r.id}
                onClick={() => setTimeRange(r.id)}
                className="px-4 py-2 text-sm font-semibold transition-all duration-200"
                style={{
                  borderRadius: '10px',
                  background: timeRange === r.id ? theme.colors.primary : 'transparent',
                  color: timeRange === r.id ? '#FFFFFF' : theme.colors.subtext,
                }}
                onMouseEnter={(e) => {
                  if (timeRange !== r.id) e.currentTarget.style.background = '#F3F4F6';
                }}
                onMouseLeave={(e) => {
                  if (timeRange !== r.id) e.currentTarget.style.background = 'transparent';
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          <StatCard
            title="รายได้รวม"
            value={formatCurrency(stats.totalsale)}
            icon="💰"
            accentColor={theme.colors.primary}
            growth={growthForRange?.sale_growth}
          />
          <StatCard
            title="กำไรสุทธิ"
            value={formatCurrency(stats.totalProfit)}
            icon="💵"
            accentColor={theme.colors.success}
            growth={growthForRange?.profit_growth}
          />
          <StatCard
            title="จำนวนบิล"
            value={`${stats.totalBills} ใบ`}
            icon="🧾"
            accentColor={theme.colors.purple}
          />
          <StatCard
            title="อัตรากำไร"
            value={`${profitMargin.toFixed(1)}%`}
            icon="📈"
            accentColor={theme.colors.teal}
          />
          <StatCard
            title="เฉลี่ย/บิล"
            value={formatCurrency(stats.totalProfit / (stats.totalBills || 1))}
            icon="📊"
            accentColor={theme.colors.orange}
          />
        </div>

        {/* Comparison Section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-semibold" style={{ color: theme.colors.title }}>
              เปรียบเทียบการเติบโต
            </h3>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: '#EFF6FF', color: theme.colors.primary }}
            >
              เทียบช่วงเวลาเดียวกัน
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <ComparisonCard title="วันนี้" comparison={c.today} comparisonLabel="เทียบเมื่อวาน ณ เวลาเดียวกัน" formatCurrency={formatCurrency} />
            <ComparisonCard title="เดือนนี้ (MTD)" comparison={c.month} comparisonLabel="เทียบเดือนก่อน ถึงวันเดียวกัน" formatCurrency={formatCurrency} />
            <ComparisonCard title="ไตรมาสนี้ (QTD)" comparison={c.quarter} comparisonLabel="เทียบไตรมาสก่อน ถึงวันเดียวกัน" formatCurrency={formatCurrency} />
            <ComparisonCard title="ปีนี้ (YTD)" comparison={c.year} comparisonLabel="เทียบปีก่อน ถึงวันเดียวกัน" formatCurrency={formatCurrency} />
          </div>
        </div>

        {/* Chart */}
        <div className={`${theme.card} p-6`}>
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-lg font-semibold" style={{ color: theme.colors.title }}>ยอดขายเทียบกำไร</h3>
              <p className="text-xs mt-1" style={{ color: theme.colors.subtext }}>
                แถบด้านหลัง = ยอดขาย · แถบด้านหน้า = กำไร
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold" style={{ color: theme.colors.subtext }}>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#3B82F6' }} /> ยอดขาย
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#10B981' }} /> กำไร
              </span>
            </div>
          </div>
          <BarChart chartData={stats.chartData} labels={stats.labels} formatCurrency={formatCurrency} />
        </div>
      </div>
    </div>
  );
};

export default OverviewDashboard;
