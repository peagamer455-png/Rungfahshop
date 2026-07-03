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

// ✅ activePromos ถูกบันทึกเป็น string รูปแบบ "{ชื่อโปร} ({จำนวนชุด} ชุด)" เสมอ (ดูจาก AddBillView.jsx)
const PROMO_ENTRY_REGEX = /^(.*)\((\d+)\s*ชุด\)\s*$/;

const POSView = ({ products, bills, promotions, loadData, setPopupContent, setShowPopup, navigateTo, sensitiveVisible, openPasswordModal, onToggleSensitive, setSidebarOpen }) => {
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

    // ✅ แยกยอดขายสินค้าเป็น "ราคาปกติ" กับ "โปรโมชั่น" โดยอิง activePromos + ตาราง promotions จริง
    // (ไม่ใช้วิธีเทียบราคาต่อชิ้นแล้ว เพราะระบบนี้ item.price ไม่เคยเปลี่ยน ส่วนลดถูกหักเป็นก้อนที่ระดับบิลแทน)
    const productSalesSummary = useMemo(() => {
        const promoDefs = promotions || [];
        const normalMap = {};
        const promoMap = {};

        const addTo = (map, productId, name, qty, amount, promoNamesSet) => {
            if (qty <= 0) return;
            if (!map[productId]) {
                map[productId] = { productId, name, qty: 0, amount: 0, promoNames: new Set() };
            }
            map[productId].qty += qty;
            map[productId].amount += amount;
            if (promoNamesSet) {
                promoNamesSet.forEach(n => map[productId].promoNames.add(n));
            }
        };

        todayBills.forEach(bill => {
            const items = bill.items || [];

            // ขั้นที่ 1: หาว่าบิลนี้ใช้โปรอะไรบ้าง แล้วโปรนั้นๆ "กิน" สินค้าตัวไหนไปกี่ชิ้น/เป็นเงินเท่าไหร่
            const promoQtyByProduct = {};
            const promoRevenueByProduct = {};
            const promoNamesByProduct = {};

            (bill.activePromos || []).forEach(entry => {
                const match = String(entry).match(PROMO_ENTRY_REGEX);
                if (!match) return;

                const promoName = match[1].trim();
                const sets = Number(match[2]) || 0;
                if (sets <= 0) return;

                const promo = promoDefs.find(p => p.name === promoName);
                if (!promo) return; // โปรถูกลบ/แก้ชื่อไปแล้ว ไม่มีให้จับคู่ ก็ปล่อยผ่าน (นับเป็นราคาปกติ)

                if (promo.type === 'qty') {
                    const pItem = promo.items?.[0];
                    if (!pItem) return;

                    const billItem = items.find(i => i.productId === pItem.id);
                    if (!billItem) return;

                    const qtyConsumed = sets * (Number(promo.min_qty) || 0);
                    const revenue = sets * (Number(promo.discount_price) || 0);

                    promoQtyByProduct[pItem.id] = (promoQtyByProduct[pItem.id] || 0) + qtyConsumed;
                    promoRevenueByProduct[pItem.id] = (promoRevenueByProduct[pItem.id] || 0) + revenue;
                    if (!promoNamesByProduct[pItem.id]) promoNamesByProduct[pItem.id] = new Set();
                    promoNamesByProduct[pItem.id].add(promo.name);

                } else if (promo.type === 'bundle') {
                    const parts = (promo.items || []).map(pItem => {
                        const requiredQty = (pItem.qty && pItem.qty > 0) ? pItem.qty : 1;
                        const billItem = items.find(i => i.productId === pItem.id);
                        const unitPrice = billItem ? (Number(billItem.price) || 0) : 0;
                        return { id: pItem.id, requiredQty, normalValue: unitPrice * requiredQty };
                    });

                    const totalNormalPerSet = parts.reduce((sum, p) => sum + p.normalValue, 0);
                    if (totalNormalPerSet <= 0) return;

                    const totalRevenue = sets * (Number(promo.discount_price) || 0);

                    parts.forEach(p => {
                        if (p.normalValue <= 0) return;
                        const qtyConsumed = sets * p.requiredQty;
                        const share = p.normalValue / totalNormalPerSet;
                        const revenue = totalRevenue * share;

                        promoQtyByProduct[p.id] = (promoQtyByProduct[p.id] || 0) + qtyConsumed;
                        promoRevenueByProduct[p.id] = (promoRevenueByProduct[p.id] || 0) + revenue;
                        if (!promoNamesByProduct[p.id]) promoNamesByProduct[p.id] = new Set();
                        promoNamesByProduct[p.id].add(promo.name);
                    });
                }
            });

            // ขั้นที่ 2: ไล่ทีละ item ในบิล หัก qty ส่วนที่โปรกินไปออก เหลือเท่าไหร่คือ "ราคาปกติ"
            items.forEach(item => {
                const totalQty = Number(item.qty) || 0;
                const price = Number(item.price) || 0;
                const productId = item.productId;

                const promoQtyRaw = promoQtyByProduct[productId] || 0;
                const promoQty = Math.min(promoQtyRaw, totalQty);
                const normalQty = totalQty - promoQty;

                if (normalQty > 0) {
                    addTo(normalMap, productId, item.name, normalQty, normalQty * price, null);
                }

                if (promoQty > 0) {
                    // เผื่อกรณีข้อมูลไม่ครบ (promoQtyRaw > totalQty) ให้ลดสัดส่วนรายได้ตามจริง
                    const revenueRatio = promoQtyRaw > 0 ? (promoQty / promoQtyRaw) : 0;
                    const promoAmount = (promoRevenueByProduct[productId] || 0) * revenueRatio;
                    addTo(promoMap, productId, item.name, promoQty, promoAmount, promoNamesByProduct[productId]);
                }
            });
        });

        const toList = (map) => Object.values(map)
            .map(g => ({ ...g, promoNames: Array.from(g.promoNames || []) }))
            .sort((a, b) => b.amount - a.amount);

        const normalList = toList(normalMap);
        const promoItemList = toList(promoMap);

        const sumQty = (list) => list.reduce((s, g) => s + g.qty, 0);
        const sumAmount = (list) => list.reduce((s, g) => s + g.amount, 0);

        const normalTotal = sumAmount(normalList);
        const normalQty = sumQty(normalList);
        const promoTotal = sumAmount(promoItemList);
        const promoQty = sumQty(promoItemList);

        return {
            normalList,
            promoList: promoItemList,
            normalTotal,
            normalQty,
            promoTotal,
            promoQty,
            grandTotal: normalTotal + promoTotal,
            grandQty: normalQty + promoQty,
        };
    }, [todayBills, promotions]);

    // ฟังก์ชันจัดการการคลิกเปิด/ปิดข้อมูล Sensitive
    const handleToggleSensitive = () => {
        onToggleSensitive();
    };

    const openProductSummary = () => {
        const {
            normalList,
            promoList,
            grandTotal,
            grandQty,
            normalTotal,
            promoTotal,
        } = productSalesSummary;

        const renderTable = (items, subtotal, showPromoBadge) => (
            <table className="w-full text-base mb-2">
                <thead>
                    <tr className="text-left text-gray-500 border-b">
                        <th className="py-3 pr-2">สินค้า</th>
                        <th className="py-3 px-2 text-right">จำนวน</th>
                        <th className="py-3 pl-2 text-right">รวม</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, idx) => (
                        <tr key={idx} className="border-b last:border-b-0 hover:bg-gray-50">
                            <td className="py-3 pr-2 font-medium text-gray-800">
                                {item.name}
                                {showPromoBadge && item.promoNames && item.promoNames.length > 0 && (
                                    <span className="ml-2 inline-block px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 rounded-full">
                                        {item.promoNames.join(', ')}
                                    </span>
                                )}
                            </td>
                            <td className="py-3 px-2 text-right text-gray-600">{item.qty}</td>
                            <td className="py-3 pl-2 text-right font-semibold text-green-700">{formatCurrency(item.amount)}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr>
                        <td colSpan={2} className="pt-2 text-right text-gray-500 text-sm">รวม</td>
                        <td className="pt-2 text-right font-bold text-green-700">{formatCurrency(subtotal)}</td>
                    </tr>
                </tfoot>
            </table>
        );

        setPopupContent({
            title: "📦 สรุปสินค้าที่ขายวันนี้",
            color: "green",
            size: "xl",
            message: (
                <div className="max-h-[65vh] overflow-y-auto -mx-1 px-1">
                    {normalList.length === 0 && promoList.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">วันนี้ยังไม่มีรายการขาย</p>
                    ) : (
                        <>
                            {normalList.length > 0 && (
                                <div className="mb-6">
                                    <h3 className="font-semibold text-gray-700 mb-2">🏷️ ราคาปกติ</h3>
                                    {renderTable(normalList, normalTotal, false)}
                                </div>
                            )}

                            {promoList.length > 0 && (
                                <div className="mb-6">
                                    <h3 className="font-semibold text-amber-700 mb-2">🔖 โปรโมชั่น</h3>
                                    {renderTable(promoList, promoTotal, true)}
                                </div>
                            )}

                            <div className="flex justify-between items-center mt-5 pt-4 border-t-2 border-gray-200">
                                <span className="text-gray-600">
                                    รวม {normalList.length + promoList.length} รายการ / {grandQty} ชิ้น
                                </span>
                                <span className="text-xl font-bold text-green-700">{formatCurrency(grandTotal)}</span>
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
                onOpenProductSummary={openProductSummary}
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
