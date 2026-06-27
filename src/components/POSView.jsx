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

const POSView = ({ products, bills, loadData, setPopupContent, setShowPopup, navigateTo, sensitiveVisible, openPasswordModal, onToggleSensitive }) => {
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

            const totalsale = Number(b.total_net) || 0;
            const billCost = (b.items || []).reduce((sum, item) => {
                return sum + ((Number(item.cost) || 0) * (Number(item.qty) || 0));
            }, 0);

            acc.totalsale += totalsale;
            acc.totalcost += billCost;

            const details = typeof b.payment_details === 'string'
                ? JSON.parse(b.payment_details)
                : (b.payment_details || {});

            if (b.payment_details) {
                // กรณีจ่ายผสม (แบบใหม่)
                acc.cash += (Number(details.cash) || 0);
                acc.transfer += (Number(details.transfer) || 0);
            } else {
                // กรณีบิลเก่า (แบบเดิมที่เก็บเป็น string)
                if (b.payment_method === 'transfer') {
                    acc.transfer += totalsale;
                } else {
                    acc.cash += totalsale;
                }
            }

            return acc;
        }, {
            totalsale: 0,
            totalcost: 0,
            cash: 0,       // กำหนดค่าเริ่มต้นเป็น 0
            transfer: 0    // กำหนดค่าเริ่มต้นเป็น 0
        });
    }, [todayBills]);

    // ฟังก์ชันจัดการการคลิกเปิด/ปิดข้อมูล Sensitive
    const handleToggleSensitive = () => {
        onToggleSensitive();
    };


    return (
        <div className="bg-gray-50 min-h-screen pb-20">
            {/* 1. ใช้ Header จาก SharedUI */}
            <Header
                title="🛒 หน้าร้าน (POS)"
                date={todayDateString}
                sensitiveVisible={sensitiveVisible}
                onToggleSensitive={handleToggleSensitive}
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