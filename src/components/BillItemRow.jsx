// src/components/BillItemRow.jsx
import React from 'react';
import { formatCurrency } from '../utils';

// ✅ ป้องกันปุ่มถูกกดโดยไม่ตั้งใจจาก Enter/Spacebar (คีย์บอร์ด)
// e.detail === 0 หมายถึง click event นี้ถูก trigger จากคีย์บอร์ด ไม่ใช่เมาส์จริง
// เมาส์คลิกจริงจะมี e.detail >= 1 เสมอ
const onlyMouseClick = (handler) => (e) => {
    if (e.detail === 0) return; // มาจากคีย์บอร์ด (Enter/Space) → ไม่ทำงาน
    handler(e);
};

// ✅ กัน Enter/Spacebar ทำงานตั้งแต่ต้นทาง (กันหน้าเว็บเลื่อนตอนกด space ด้วย)
const blockKeyboardActivation = (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
    }
};

const BillItemRow = ({ item, maxQty, onUpdateQty, onRemove, setPopupContent, setShowPopup }) => {
    const stock = item.stock || 0;
    const isOutOfStock = item.qty >= stock;

    // ✅ รองรับทั้ง AddBillView (lastQty) และ EditBillView (reservedQty)
    // เพราะสอง view นี้ใช้ชื่อ field ต่างกันเก็บค่า "จำนวนล่าสุดที่ถูกต้อง"
    const fallbackQty = Number(item.lastQty ?? item.reservedQty) || 1;

    const handleInputChange = (e) => {
        onUpdateQty(item.productId, e.target.value, true);
    };

    const handleBlur = () => {
        // ✅ ออกจากช่องแล้วยังว่าง/ไม่ถูกต้อง -> ดึงกลับเป็นค่าล่าสุดที่ถูกต้อง
        if (item.qty === "" || item.qty === null || Number(item.qty) <= 0) {
            onUpdateQty(item.productId, fallbackQty, true);
        }
    };

    const handlePlus = () => {
        onUpdateQty(item.productId, 1, false); // ✅ ไม่เช็ค stock ที่นี่อีกต่อไป
    };

    const handleMinus = () => {
        onUpdateQty(item.productId, -1, false);
    };

    const handleRemove = () => {
        onRemove(item.productId);
    };

    return (
        <div className="flex items-center justify-between p-3 border border-green-100 rounded-lg bg-green-50 shadow-sm transition-all">
            <div className="flex-1 min-w-0 pr-3">
                <p className="font-semibold text-gray-800 truncate">{item.name}</p>
                <p className="text-xs text-gray-500">@{formatCurrency(item.price)}</p>
            </div>
            <div className="flex items-center space-x-2">
                <button
                    onClick={onlyMouseClick(handleMinus)}
                    onKeyDown={blockKeyboardActivation}
                    className="p-1 w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300 active:scale-90 transition-transform"
                >-</button>
                <input
                    type="number"
                    min="0"
                    max={maxQty}
                    value={item.qty}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    className="font-bold text-gray-900 w-12 text-center bg-white border border-gray-300 rounded-md py-1 focus:ring-2 focus:ring-green-400 outline-none"
                />
                <button
                    onClick={onlyMouseClick(handlePlus)}
                    onKeyDown={blockKeyboardActivation}
                    className="p-1 w-8 h-8 flex items-center justify-center bg-green-400 text-white rounded-full hover:bg-green-500 active:scale-90 transition-transform"
                >+</button>
            </div>
            <div className="ml-4 w-24 text-right">
                <p className="font-bold text-green-700">{formatCurrency(item.price * item.qty)}</p>
            </div>
            <button
                onClick={onlyMouseClick(handleRemove)}
                onKeyDown={blockKeyboardActivation}
                className="ml-3 text-red-400 hover:text-red-600 p-2"
            >✕</button>
        </div>
    );
};
export default BillItemRow;
