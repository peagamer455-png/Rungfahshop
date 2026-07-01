import React from 'react';
import { formatCurrency } from '../utils'; // อย่าลืมแก้ path ให้ถูกต้อง

const SummaryCard = ({ title, value, colorClass, icon, mask = false }) => {
    const getColors = (c) => {
        if (c.includes('blue')) return { bg: 'bg-blue-100', text: 'text-blue-600' };
        if (c.includes('yellow')) return { bg: 'bg-yellow-100', text: 'text-yellow-600' };
        if (c.includes('green')) return { bg: 'bg-green-100', text: 'text-green-600' };
        if (c.includes('emerald')) return { bg: 'bg-emerald-100', text: 'text-emerald-600' };
        if (c.includes('purple')) return { bg: 'bg-purple-100', text: 'text-purple-600' };
        return { bg: 'bg-gray-100', text: 'text-gray-600' };
    };

    const colors = getColors(colorClass);

    return (
        <div className={`bg-white p-5 rounded-xl shadow-lg border-b-4 ${colorClass}`}>
            <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-500">{title}</div>
                <div className={`p-2 rounded-full ${colors.bg} ${colors.text}`}>
                    {icon}
                </div>
            </div>
            <div className="mt-2 text-3xl font-extrabold text-gray-900">
                {/* ถ้า mask เป็น true ให้แสดง ****** แทนตัวเลข */}
                {mask ? '******' : formatCurrency(value)}
            </div>
        </div>
    );
};

export default SummaryCard;