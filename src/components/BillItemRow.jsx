// src/components/BillItemRow.jsx
import React from 'react';
import { formatCurrency } from '../utils';

const BillItemRow = ({ item, onUpdateQty, onRemove, setPopupContent, setShowPopup }) => {
    const stock = item.stock || 0;
    const isOutOfStock = item.qty >= stock;

    const handleInputChange = (e) => {
        const value = e.target.value;

        if (value === "") {
            onUpdateQty(item.productId, "", true);
            return;
        }

        let newQty = parseInt(value, 10);
        if (isNaN(newQty) || newQty < 0) return;

        if (newQty > stock) {
            newQty = stock;
            setPopupContent({ title: "❌ สินค้าหมด", message: "ขออภัยครับ สินค้านี้สต็อกหมดแล้ว", color: "red" });
            setShowPopup(true);
        }

        onUpdateQty(item.productId, newQty, true);
    };

    const handlePlus = () => {
        if (item.qty < stock) {
            onUpdateQty(item.productId, 1, false);
        } else {
            setPopupContent({ title: "❌ สินค้าหมด", message: "ขออภัยครับ สินค้านี้สต็อกหมดแล้ว", color: "red" });
            setShowPopup(true);
        }
    };


    return (
        <div className="flex items-center justify-between p-3 border border-green-100 rounded-lg bg-green-50 shadow-sm transition-all">
            <div className="flex-1 min-w-0 pr-3">
                <p className="font-semibold text-gray-800 truncate">{item.name}</p>
                <p className="text-xs text-gray-500">@{formatCurrency(item.price)}</p>
            </div>

            <div className="flex items-center space-x-2">
                {/* เพิ่ม active:scale-95 เพื่อความลื่นไหลของ UI */}
                <button
                    onClick={() => onUpdateQty(item.productId, -1, false)}
                    className="p-1 w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300 active:scale-90 transition-transform"
                >-</button>

                <input
                    type="number"
                    value={item.qty}
                    onChange={handleInputChange}
                    className="font-bold text-gray-900 w-12 text-center bg-white border border-gray-300 rounded-md py-1 focus:ring-2 focus:ring-green-400 outline-none"
                    min="0"
                />

                <button
                    onClick={handlePlus} // เปลี่ยนมาเรียก handlePlus แทน
                    className="p-1 w-8 h-8 flex items-center justify-center bg-green-400 text-white rounded-full hover:bg-green-500 active:scale-90 transition-transform"
                >+</button>
            </div>

            <div className="ml-4 w-24 text-right">
                <p className="font-bold text-green-700">{formatCurrency(item.price * item.qty)}</p>
            </div>

            <button
                onClick={() => onRemove(item.productId)}
                className="ml-3 text-red-400 hover:text-red-600 p-2"
            >✕</button>
        </div>
    );
};

export default BillItemRow;