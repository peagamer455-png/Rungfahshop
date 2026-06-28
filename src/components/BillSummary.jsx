import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../utils';

const BillSummary = ({ subTotal, totalsale, discount, activePromos = [], onSave, isSubmitting, canSave, theme = 'green', printSize, setPrintSize, initialPaymentDetails }) => {
    const colors = {
        green: {
            bg: "bg-green-700",
            border: "border-green-600",
            borderDashed: "border-green-500",
            buttonActive: "bg-green-500",
            buttonInactive: "bg-green-800",
            textAccent: "text-green-200",
            saveBtn: "bg-white text-green-700 hover:bg-green-50 border-green-800"
        },
        yellow: {
            bg: "bg-yellow-600",
            border: "border-yellow-500",
            borderDashed: "border-yellow-400",
            buttonActive: "bg-yellow-400 text-yellow-900",
            buttonInactive: "bg-yellow-700",
            textAccent: "text-yellow-200",
            saveBtn: "bg-white text-yellow-700 hover:bg-yellow-50 border-yellow-800"
        }
    };
    const isGreen = theme === 'green';
    const bgMain = isGreen ? "bg-green-700" : "bg-yellow-600";
    const borderMain = isGreen ? "border-green-600" : "border-yellow-500";
    const btnActive = isGreen ? "bg-green-500" : "bg-yellow-400 text-yellow-900";
    const btnInactive = isGreen ? "bg-green-800" : "bg-yellow-700";
    const c = colors[theme];
    const [payMode, setPayMode] = useState(initialPaymentDetails?.method || 'cash');
    const [cash, setCash] = useState(totalsale);
    const netTotal = Math.max(0, subTotal - discount);
    const [receivedAmount, setReceivedAmount] = useState(0);

    const handlePrintSizeChange = (size) => {
        setPrintSize(size);
        localStorage.setItem('lastPrintSize', size);
    };

    useEffect(() => {
        if (payMode === 'cash') setCash(totalsale);
        else if (payMode === 'transfer') setCash(0);
    }, [netTotal, payMode]);

    useEffect(() => {
        if (payMode === 'cash') setCash(netTotal);
        else if (payMode === 'transfer') setCash(0);
    }, [netTotal, payMode]);

    const transfer = Math.max(0, netTotal - cash);

    const handleModeChange = (mode) => {
        setPayMode(mode);
        if (mode === 'cash') setCash(netTotal);
        if (mode === 'transfer') setCash(0);
    };

    const handleCashChange = (val) => {
        let value = Number(val) || 0;
        if (value < 0) value = 0;
        setCash(value);
    };

    // ยอดเงินสดที่บันทึกจริง = ไม่เกิน netTotal (ส่วนที่เกินคือเงินทอน ไม่ใช่รายรับ)
    const cashToRecord = Math.min(cash, netTotal);

    return (
        <div className={`sticky top-20 ${bgMain} text-white p-6 rounded-xl shadow-2xl space-y-4 border ${borderMain}`}>
            <h3 className="text-2xl font-black mb-4 border-b border-white/20 pb-2 flex items-center gap-2">
                สรุปยอดรวม
            </h3>

            <div className="flex justify-between items-center text-sm opacity-80">
                <span>ราคารวมสินค้า</span>
                <span>{formatCurrency(subTotal)}</span>
            </div>

            {discount > 0 && (
                <div className="flex justify-between items-center text-sm font-bold text-yellow-300">
                    <span>ส่วนลดโปรโมชั่น</span>
                    <span>-{formatCurrency(discount)}</span>
                </div>
            )}

            {activePromos && activePromos.length > 0 && (
                <div className="bg-white/10 p-3 rounded-lg border border-white/20 mt-2">
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1">โปรโมชั่นที่ใช้:</p>
                    <ul className="space-y-1">
                        {activePromos.map((name, idx) => (
                            <li key={idx} className="text-xs font-semibold text-green-200 flex items-center gap-1">
                                - {name}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className={`flex justify-between items-center text-xl font-black pt-2 border-t ${borderMain} border-dashed`}>
                <span className="text-white/70">ยอดสุทธิ</span>
                <span className="text-3xl text-white drop-shadow-md">{formatCurrency(netTotal)}</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
                {[{ id: 'cash', label: 'เงินสด' }, { id: 'transfer', label: 'เงินโอน' }, { id: 'split', label: 'สด + โอน' }].map((item) => (
                    <button
                        key={item.id}
                        onClick={() => handleModeChange(item.id)}
                        className={`py-2 text-xs font-bold rounded-lg border-2 transition-all ${payMode === item.id ? `${btnActive} border-white` : `${btnInactive} border-white/20`}`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {(payMode === 'cash' || payMode === 'split') && (
                <div className={`${isGreen ? "bg-green-900/50" : "bg-yellow-800/50"} p-4 rounded-xl border border-white/20 space-y-4 animate-fade-in`}>
                    <div className="text-sm font-bold uppercase tracking-wider">
                        {payMode === 'cash' ? "รายละเอียดเงินสด" : "รายละเอียดการชำระเงิน"}
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold opacity-80">รับเงินสด (บาท)</label>
                        <input
                            type="number"
                            value={cash}
                            onChange={(e) => {
                                const val = Number(e.target.value);
                                setCash(val >= 0 ? val : 0);
                            }}
                            className="w-full bg-black/20 text-white p-3 rounded-lg border border-white/30 focus:border-white outline-none font-bold text-xl"
                        />
                    </div>

                    <div className={`p-3 rounded-lg border border-dashed flex justify-between items-center ${payMode === 'cash'
                        ? (cash >= netTotal ? "bg-green-600/30 border-green-300" : "bg-red-600/30 border-red-300")
                        : "bg-blue-600/30 border-blue-300"
                        }`}>
                        <span className="text-sm font-bold">
                            {payMode === 'cash'
                                ? (cash >= netTotal ? "เงินทอน" : "ยังขาดอีก")
                                : "คงเหลือต้องโอน"}
                        </span>
                        <span className="text-2xl font-black">
                            {formatCurrency(
                                payMode === 'cash'
                                    ? Math.abs(cash - netTotal)
                                    : Math.max(0, netTotal - cash)
                            )}
                        </span>
                    </div>
                </div>
            )}

            <div className="space-y-1">
                <label className="text-xs font-bold opacity-80 uppercase">ขนาดบิลที่ต้องการ</label>
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => handlePrintSizeChange('a4')} className={`py-2 rounded-lg text-sm font-bold border transition ${printSize === 'a4' ? `${btnActive} border-white` : `${btnInactive} opacity-70`}`}>A4</button>
                    <button onClick={() => handlePrintSizeChange('receipt')} className={`py-2 rounded-lg text-sm font-bold border transition ${printSize === 'receipt' ? `${btnActive} border-white` : `${btnInactive} opacity-70`}`}>ใบเสร็จ</button>
                </div>
            </div>

            <button
                onClick={() => onSave({ payMode: payMode, paymentDetails: { cash: cashToRecord, transfer }, printSize })}
                disabled={!canSave || isSubmitting || (payMode !== 'transfer' && cash < netTotal)}
                className="w-full mt-4 py-5 bg-white text-black rounded-xl font-black text-xl hover:bg-gray-100 transition-all shadow-xl disabled:opacity-50 border-b-4 border-gray-300"
            >
                {isSubmitting ? 'กำลังบันทึก...' : '💾 บันทึกข้อมูล'}
            </button>
        </div>
    );
};

export default BillSummary;
