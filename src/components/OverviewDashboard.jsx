import React, { useState, useEffect, useRef } from 'react';
import { supabase } from "../supabaseClient";
import { Header } from "./SharedUI";

const StatCard = ({ title, value, icon, accent }) => (
  <div className="relative overflow-hidden bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${accent.iconBg}`}>
        {icon}
      </div>
    </div>
    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
    <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">{value}</h3>
    <div className={`absolute top-0 left-0 w-full h-1 ${accent.bar}`} />
  </div>
);

const GrowthPill = ({ value }) => {
  if (value === null || value === undefined) {
    return <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">ข้อมูลใหม่</span>;
  }
  const isUp = value >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${
      isUp ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200' : 'bg-rose-50 text-rose-600 ring-1 ring-rose-200'
    }`}>
      <span className="text-[10px]">{isUp ? '↑' : '↓'}</span>
      {Math.abs(value).toFixed(1)}%
    </span>
  );
};

const ComparisonCard = ({ title, comparison, comparisonLabel, formatCurrency }) => {
  if (!comparison) return null;
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 space-y-4 hover:border-slate-300 transition-colors">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{title}</p>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-400 font-medium">ยอดขาย</span>
            <GrowthPill value={comparison.sale_growth} />
          </div>
          <span className="text-lg font-extrabold text-slate-800">{formatCurrency(comparison.current_sale)}</span>
        </div>

        <div className="h-px bg-slate-100" />

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-400 font-medium">กำไร</span>
            <GrowthPill value={comparison.profit_growth} />
          </div>
          <span className="text-lg font-extrabold text-emerald-600">{formatCurrency(comparison.current_profit)}</span>
        </div>
      </div>

      <p className="text-[10px] text-slate-300 pt-1">{comparisonLabel}</p>
    </div>
  );
};

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
                background: isActive
                  ? 'linear-gradient(180deg, #38bdf8, #0284c7)'
                  : 'linear-gradient(180deg, #7dd3fc, #38bdf8)',
                minHeight: saleHeightPct > 0 ? '3px' : '0',
                opacity: isActive ? 1 : 0.75,
              }}
            />
            <div
              className="absolute bottom-0 rounded-t-[4px] transition-all duration-200"
              style={{
                width: '52%',
                height: `${profitHeightPct}%`,
                background: isActive
                  ? 'linear-gradient(180deg, #34d399, #059669)'
                  : 'linear-gradient(180deg, #6ee7b7, #10b981)',
                minHeight: profitHeightPct > 0 ? '3px' : '0',
                boxShadow: isActive ? '0 0 0 1px rgba(5,150,105,0.3)' : 'none',
              }}
            />
            <span className="absolute -bottom-6 text-[9px] text-slate-400 font-medium select-none">{labels[i]}</span>
          </div>
        );
      })}

      {/* grid lines เบาๆ เพิ่ม texture แบบ dashboard มืออาชีพ */}
      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none -z-10">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="w-full border-t border-slate-100" />
        ))}
      </div>

      {tooltip && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{ left: `${tooltip.x}px`, top: `${tooltip.y - 8}px`, transform: 'translate(-50%, -100%)' }}
        >
          <div className="bg-slate-900 text-white text-[11px] rounded-xl shadow-2xl px-3.5 py-2.5 min-w-[140px] ring-1 ring-slate-700">
            <p className="font-bold text-sky-400 mb-1.5">{tooltip.label}</p>
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">ยอดขาย</span>
              <span className="font-semibold text-sky-300">{formatCurrency(tooltip.sale)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">กำไร</span>
              <span className="font-semibold text-emerald-300">{formatCurrency(tooltip.profit)}</span>
            </div>
            <div className="flex justify-between gap-3 pt-1.5 mt-1.5 border-t border-slate-700">
              <span className="text-slate-500">อัตรากำไร</span>
              <span className="font-semibold text-slate-300">
                {tooltip.sale > 0 ? ((tooltip.profit / tooltip.sale) * 100).toFixed(1) : '0.0'}%
              </span>
            </div>
          </div>
          <div className="flex justify-center">
            <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1" />
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
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <p className="text-slate-400 font-medium">กรุณายืนยันตัวตน</p>
    </div>
  );
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-400 text-sm">กำลังโหลดข้อมูล...</p>
      </div>
    </div>
  );
  if (!stats) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <p className="text-slate-400">ไม่พบข้อมูล</p>
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
    <div className="min-h-screen bg-slate-50">
      <Header title="สรุปภาพรวมร้านค้า" onToggleSidebar={() => setSidebarOpen(prev => !prev)} />

      <div className="p-4 lg:p-8 space-y-8 max-w-7xl mx-auto">

        {/* Time Range Picker */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">ภาพรวมยอดขาย</h2>
            <p className="text-xs text-slate-400 mt-0.5">วิเคราะห์ยอดขาย กำไร และแนวโน้มการเติบโต</p>
          </div>
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 gap-1">
            {timeRanges.map(r => (
              <button
                key={r.id}
                onClick={() => setTimeRange(r.id)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                  timeRange === r.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
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
            accent={{ iconBg: 'bg-sky-50', bar: 'bg-sky-400' }} />
          <StatCard title="กำไรสุทธิ" value={formatCurrency(stats.totalProfit)} icon="💵"
            accent={{ iconBg: 'bg-emerald-50', bar: 'bg-emerald-400' }} />
          <StatCard title="อัตรากำไร" value={`${profitMargin.toFixed(1)}%`} icon="📈"
            accent={{ iconBg: 'bg-amber-50', bar: 'bg-amber-400' }} />
          <StatCard title="จำนวนบิล" value={`${stats.totalBills} ใบ`} icon="🧾"
            accent={{ iconBg: 'bg-violet-50', bar: 'bg-violet-400' }} />
          <StatCard title="เฉลี่ย/บิล" value={formatCurrency(stats.totalProfit / (stats.totalBills || 1))} icon="📊"
            accent={{ iconBg: 'bg-rose-50', bar: 'bg-rose-400' }} />
        </div>

        {/* Comparison Section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-sm font-bold text-slate-700">เปรียบเทียบการเติบโต</h3>
            <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">เทียบช่วงเวลาเดียวกัน</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ComparisonCard title="วันนี้" comparison={c.today} comparisonLabel="เทียบเมื่อวาน ณ เวลาเดียวกัน" formatCurrency={formatCurrency} />
            <ComparisonCard title="เดือนนี้ (MTD)" comparison={c.month} comparisonLabel="เทียบเดือนก่อน ถึงวันเดียวกัน" formatCurrency={formatCurrency} />
            <ComparisonCard title="ไตรมาสนี้ (QTD)" comparison={c.quarter} comparisonLabel="เทียบไตรมาสก่อน ถึงวันเดียวกัน" formatCurrency={formatCurrency} />
            <ComparisonCard title="ปีนี้ (YTD)" comparison={c.year} comparisonLabel="เทียบปีก่อน ถึงวันเดียวกัน" formatCurrency={formatCurrency} />
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/70 shadow-sm">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">ยอดขายเทียบกำไร</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">แถบด้านหลัง = ยอดขาย · แถบด้านหน้า = กำไร</p>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-sky-400" /> ยอดขาย
              </span>
              <span className="flex items-center gap-1.5">
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
