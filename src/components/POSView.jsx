import React, { useMemo } from 'react';
import { Header } from './SharedUI'; // Import จาก SharedUI
import { formatCurrency } from '../utils';
import SummaryCard from './SummaryCard';
import HistoryBillCard from './HistoryBillCard';

const FloatingActionButton = ({ onClick }) => (
    <button
        onClick={onClick}
        className="fixed bottom-6 right-6 bg-green-600 text-white p-4 rounded-full shadow-2xl hover:bg-green-700 transition-all flex justify-center items-center z-30 w-14 h-14"
    >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
    </button>
);

const POSView = ({ products, bills, loadData, setPopupContent, setShowPopup, navigateTo, sensitiveVisible, openPasswordModal, onToggleSensitive, setSidebarOpen }) => {
    const todayDateString = useMemo(() => new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), []);

    const todayBills = useMemo(() => {
        const todayString = new Date().toISOString().split('T')[0];
        return (bills || []).filter(b => {
            if (!b.date) return false;
            const billDateString = new Date(b.date).toISOString().split('T')[0];

            return billDateString === todayString;
        });
    }, [bills]);

    const dailySummary = useMemo(() => {
        return todayBills.reduce((acc, b) => {
            const total_net = Number(b.total_net) || 0;
            const billCost = (b.items || []).reduce((sum, item) => {
                return sum + ((Number(item.cost) || 0) * (Number(item.qty) || 0));
            }, 0);

            acc.totalsale += total_net;
            acc.totalcost += billCost;

            const details = typeof b.payment_details === 'string'
                ? JSON.parse(b.payment_details)
                : (b.payment_details || null);

            if (details) {
                const cash = Number(details.cash) || 0;
                const transfer = Number(details.transfer) || 0;
                const detailSum = cash + transfer;

                acc.cash += cash;
                acc.transfer += transfer;

                // ถ้า cash+transfer ไม่ครบ total_net (บิลเก่าที่ข้อมูลไม่สมบูรณ์)
                // ให้เอาส่วนที่ขาดไปใส่ cash
                const diff = total_net - detailSum;
                if (diff > 0) acc.cash += diff;

            } else {
                // บิลเก่าที่ไม่มี payment_details เลย
                if (b.payment_method === 'transfer') {
                    acc.transfer += total_net;
                } else {
                    acc.cash += total_net;
                }
            }

            return acc;
        }, { totalsale: 0, totalcost: 0, cash: 0, transfer: 0 });
    }, [todayBills]);

    const productSalesSummary = useMemo(() => {
    const grouped = {};

    todayBills.forEach(bill => {
        (bill.items || []).forEach(item => {
            const key = item.productId ?? item.name;
            const qty = Number(item.qty) || 0;
            const price = Number(item.price) || 0;

            if (!grouped[key]) {
                grouped[key] = { name: item.name, qty: 0, amount: 0 };
            }
            grouped[key].qty += qty;
            grouped[key].amount += price * qty;
        });
    });

    const list = Object.values(grouped)
        .map(g => ({ ...g, avgPrice: g.qty > 0 ? g.amount / g.qty : 0 }))
        .sort((a, b) => b.amount - a.amount);

    const grandTotal = list.reduce((sum, g) => sum + g.amount, 0);
    const grandQty = list.reduce((sum, g) => sum + g.qty, 0);

    return { list, grandTotal, grandQty };
}, [todayBills]);

    // ฟังก์ชันจัดการการคลิกเปิด/ปิดข้อมูล Sensitive
    const handleToggleSensitive = () => {
        onToggleSensitive();
    };
    
    const openProductSummary = () => {
        const { list, grandTotal, grandQty } = productSalesSummary;

        setPopupContent({
            title: "📦 สรุปสินค้าที่ขายวันนี้",
            color: "green",
            message: (
                <div className="max-h-[55vh] overflow-y-auto -mx-1 px-1">
                    {list.length === 0 ? (
                        <p className="text-center text-gray-500 py-4">วันนี้ยังไม่มีรายการขาย</p>
                    ) : (
                        <>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-500 border-b">
                                        <th className="py-2 pr-1">สินค้า</th>
                                        <th className="py-2 px-1 text-right">จำนวน</th>
                                        <th className="py-2 px-1 text-right">ราคา/ชิ้น</th>
                                        <th className="py-2 pl-1 text-right">รวม</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {list.map((item, idx) => (
                                        <tr key={idx} className="border-b last:border-b-0">
                                            <td className="py-2 pr-1 font-medium text-gray-800">{item.name}</td>
                                            <td className="py-2 px-1 text-right text-gray-600">{item.qty}</td>
                                            <td className="py-2 px-1 text-right text-gray-600">{formatCurrency(item.avgPrice)}</td>
                                            <td className="py-2 pl-1 text-right font-semibold text-green-700">{formatCurrency(item.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="flex justify-between items-center mt-4 pt-3 border-t text-sm">
                                <span className="text-gray-600">รวม {list.length} รายการ / {grandQty} ชิ้น</span>
                                <span className="text-base font-bold text-green-700">{formatCurrency(grandTotal)}</span>
                            </div>
                        </>
                    )}
                </div>
            ),
            actions: [{ label: "ปิด", handler: () => setShowPopup(false) }]
        });
        setShowPopup(true);
    };


    return (
        <div className="bg-gray-50 min-h-screen pb-20">
            {/* 1. ใช้ Header จาก SharedUI */}
            <Header
                title="🛒 หน้าร้าน (POS)"
                date={todayDateString}
                sensitiveVisible={sensitiveVisible}
                onToggleSensitive={handleToggleSensitive}
                onToggleSidebar={() => setSidebarOpen(prev => !prev)}
            />

            <div className="p-4 sm:p-6">

                {/* 2. สรุปยอด */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
                    <SummaryCard
                        title="💰 ยอดขาย"
                        value={dailySummary.totalsale}
                        colorClass="border-blue-500"
                        icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V9m0 3v2m0 3a5 5 0 01-5 5H5a2 2 0 01-2-2v-5l1.45-1.45m17.1-5.74A2 2 0 0121 5H3a2 2 0 000 4h18a2 2 0 012 2v5a2 2 0 01-2 2h-2" /></svg>}
                    />
                    <SummaryCard
                        title="💵 เงินสด"
                        value={dailySummary.cash}
                        colorClass="border-emerald-500"
                        icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                    />
                    <SummaryCard
                        title="📱 เงินโอน"
                        value={dailySummary.transfer}
                        colorClass="border-purple-500"
                        icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
                    />
                    <SummaryCard
                        title="💸 ต้นทุน"
                        value={dailySummary.totalcost}
                        colorClass="border-yellow-500"
                        mask={!sensitiveVisible}
                        icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                    />
                    <SummaryCard
                        title="📈 กำไร"
                        value={dailySummary.totalsale - dailySummary.totalcost}
                        colorClass="border-green-500"
                        mask={!sensitiveVisible}
                        icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                    />
                </div>

                {/* 3. รายการบิล */}
                <div>
                    <h2 className="text-xl font-bold text-green-700 mb-4">รายการบิลวันนี้ ({todayBills.length} บิล)</h2>
                    <div className="space-y-3">
                        {todayBills.length > 0 ? (
                            todayBills.map((bill) => (
                                <HistoryBillCard
                                    key={bill.id}
                                    bill={bill}
                                    products={products}
                                    loadData={loadData}
                                    setPopupContent={setPopupContent}
                                    setShowPopup={setShowPopup}
                                    onViewDetails={() => navigateTo(`/bill-detail?id=${bill.id}`)}
                                />
                            ))
                        ) : (
                            <div className="bg-white p-6 rounded-xl shadow-md text-center text-gray-500">
                                วันนี้ยังไม่มีรายการบิล
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <FloatingActionButton onClick={() => navigateTo('/addBill')} />
        </div>
    );
};

export default POSView;
