import React, { useState, useEffect, useRef } from 'react';
import { supabase } from "../supabaseClient";
import { Header } from "./SharedUI";

const StatCard = ({ title, value, icon, gradient, textColor, subColor }) => (
  <div className={`relative overflow-hidden p-6 rounded-2xl shadow-md flex flex-col justify-between ${gradient}`}>
    <div className="flex justify-between items-start">
      <p className={`text-xs font-semibold uppercase tracking-widest ${subColor}`}>{title}</p>
      <span className="text-2xl opacity-80">{icon}</span>
    </div>
    <div className="mt-5">
      <h3 className={`text-2xl font-extrabold ${textColor}`}>{value}</h3>
    </div>
    <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full opacity-10 bg-white" />
  </div>
);

// ✅ Badge แสดง % การเติบโต พร้อมลูกศรและสี
const GrowthBadge = ({ value }) => {
  if (value === null || value === undefined) {
    return <span className="text-[11px] font-semibold text-gray-400">— ใหม่</span>;
  }
  const isUp = value >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
      {isUp ? '▲' : '▼'} {Math.abs(value).toFixed(1)}%
    </span>
  );
};

// ✅ การ์ดเปรียบเทียบช่วงเวลา (วันนี้vsเมื่อวาน, เดือนนี้vsเดือนก่อน ฯลฯ)
const ComparisonCard = ({ title, icon, comparison, comparisonLabel, formatCurrency }) => {
  if (!comparison) return null;
  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
          <span>{icon}</span> {title}
        </p>
      </div>
      <div className="space-y-1">
        <p className="text-[11px] text-gray-400">ยอดขาย</p>
        <div className="flex items-center justify-between">
          <span className="text-base font-extrabold text-blue-600">{formatCurrency(comparison.current_sale)}</span>
          <GrowthBadge value={comparison.sale_growth} />
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-[11px] text-gray-400">กำไร</p>
        <div className="flex items-center justify-between">
          <span className="text-base font-extrabold text-emerald-600">{formatCurrency(comparison.current_profit)}</span>
          <GrowthBadge value={comparison.profit_growth} />
        </div>
      </div>
      <p className="text-[10px] text-gray-300 pt-2 border-t border-gray-50">เทียบกับ {comparisonLabel}</p>
    </div>
  );
};

// ✅ กราฟซ้อนกัน: สีฟ้า (ยอดขาย) เต็มความกว้าง อยู่ด้านหลัง / สีเขียว (กำไร) แคบกว่า ซ้อนอยู่ด้านหน้า
const BarChart = ({ chartData, labels, formatCurrency }) => {
  const [tooltip, setTooltip] = useState(null);
  const containerRef = useRef(null);

  const localMax = React.useMemo(() => {
    if (!chartData || chartData.length === 0) return 1;
    const vals = chartData.flatMap(d => [d.profit || 0, d.total_net ?? d.sale ?? 0]);
    return Math.max(...vals, 1);
  }, [chartData]);

  return (
    <div ref={containerRef} className="relative flex items-end h-[240px] gap-[3px] border-b border-l border-gray-200 pb-1 overflow-visible">
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
              className="absolute bottom-0 w-full rounded-t-md transition-all duration-150"
              style={{
                height: `${saleHeightPct}%`,
                background: isActive
                  ? 'linear-gradient(180deg, #60a5fa, #2563eb)'
                  : 'linear-gradient(180deg, #93c5fd, #3b82f6)',
                minHeight: saleHeightPct > 0 ? '4px' : '0',
                opacity: 0.85,
              }}
            />
            <div
              className="absolute bottom-0 rounded-t-md transition-all duration-150"
              style={{
                width: '55%',
                height: `${profitHeightPct}%`,
                background: isActive
                  ? 'linear-gradient(180deg, #34d399, #059669)'
                  : 'linear-gradient(180deg, #6ee7b7, #10b981)',
                minHeight: profitHeightPct > 0 ? '4px' : '0',
              }}
            />
            <span className="absolute -bottom-5 text-[9px] text-gray-400 select-none">{labels[i]}</span>
          </div>
        );
      })}

      {tooltip && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y - 8}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="bg-gray-900 text-white text-[11px] rounded-xl shadow-xl px-3 py-2 min-w-[130px]">
            <p className="font-bold text-emerald-400 mb-1">{tooltip.label}</p>
            <div className="flex justify-between gap-3">
              <span className="text-gray-300">ยอดขาย</span>
              <span className="font-semibold text-blue-300">{formatCurrency(tooltip.sale)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-300">กำไร</span>
              <span className="font-semibold text-emerald-300">{formatCurrency(tooltip.profit)}</span>
            </div>
            <div className="flex justify-between gap-3 pt-1 mt-1 border-t border-white/10">
              <span className="text-gray-400">อัตรากำไร</span>
              <span className="font-semibold text-gray-200">
                {tooltip.sale > 0 ? ((tooltip.profit / tooltip.sale) * 100).toFixed(1) : '0.0'}%
              </span>
            </div>
          </div>
          <div className="flex justify-center">
            <div className="w-2 h-2 bg-gray-900 rotate-45 -mt-1" />
          </div>
        </div>
      )}
    </div>
  );
};

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
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100">
      <p className="text-gray-500 font-medium">กรุณายืนยันตัวตน</p>
    </div>
  );
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-500 text-sm">กำลังโหลดข้อมูล...</p>
      </div>
    </div>
  );
  if (!stats) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gray-400">ไม่พบข้อมูล</p>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50">
      <Header title="📊 สรุปภาพรวมร้านค้า" onToggleSidebar={() => setSidebarOpen(prev => !prev)} />

      <div className="p-4 lg:p-8 space-y-6">

        {/* Time Range Picker */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-gray-800 tracking-tight">ภาพรวมยอดขาย</h2>
            <p className="text-xs text-gray-400 mt-0.5">อัปเดตล่าสุด — ดูตามช่วงเวลาด้านขวา</p>
          </div>
          <div className="flex bg-white p-1 rounded-2xl shadow border border-gray-100 gap-1">
            {timeRanges.map(r => (
              <button
                key={r.id}
                onClick={() => setTimeRange(r.id)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                  timeRange === r.id
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard title="รายได้รวม" value={formatCurrency(stats.totalsale)} icon="💰"
            gradient="bg-gradient-to-br from-blue-500 to-indigo-600" textColor="text-white" subColor="text-blue-100" />
          <StatCard title="กำไรสุทธิ" value={formatCurrency(stats.totalProfit)} icon="💵"
            gradient="bg-gradient-to-br from-emerald-500 to-teal-600" textColor="text-white" subColor="text-emerald-100" />
          <StatCard title="อัตรากำไร" value={`${profitMargin.toFixed(1)}%`} icon="📈"
            gradient="bg-gradient-to-br from-amber-400 to-orange-500" textColor="text-white" subColor="text-amber-100" />
          <StatCard title="จำนวนบิล" value={`${stats.totalBills} ใบ`} icon="📝"
            gradient="bg-gradient-to-br from-orange-400 to-rose-500" textColor="text-white" subColor="text-orange-100" />
          <StatCard title="เฉลี่ย/บิล" value={formatCurrency(stats.totalProfit / (stats.totalBills || 1))} icon="📊"
            gradient="bg-gradient-to-br from-violet-500 to-purple-600" textColor="text-white" subColor="text-violet-100" />
        </div>

        {/* ✅ Comparison Section */}
        <div>
          <h3 className="text-sm font-bold text-gray-600 mb-3 flex items-center gap-2">
            🔍 เปรียบเทียบการเติบโต
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ComparisonCard title="วันนี้" icon="📅" comparison={c.today} comparisonLabel="เมื่อวาน" formatCurrency={formatCurrency} />
            <ComparisonCard title="เดือนนี้ (MTD)" icon="🗓️" comparison={c.month} comparisonLabel="เดือนก่อน (ช่วงเดียวกัน)" formatCurrency={formatCurrency} />
            <ComparisonCard title="ไตรมาสนี้ (QTD)" icon="📆" comparison={c.quarter} comparisonLabel="ไตรมาสก่อน (ช่วงเดียวกัน)" formatCurrency={formatCurrency} />
            <ComparisonCard title="ปีนี้ (YTD)" icon="🎯" comparison={c.year} comparisonLabel="ปีก่อน (ช่วงเดียวกัน)" formatCurrency={formatCurrency} />
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-gray-700 text-sm">ยอดขาย vs กำไร รายวัน</h3>
            <div className="flex items-center gap-3 text-[11px] text-gray-400">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-blue-400" /> ยอดขาย
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-emerald-400" /> กำไร
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
