import React, { useState } from 'react';
import { Header } from "./SharedUI";
import { formatCurrency } from '../utils';
import { useSearchParams } from 'react-router-dom';
import { handlePrint } from './PrintService';
import PasswordConfirmModal from "./PasswordConfirmModal";

const BillDetailView = ({ bills, products, navigateTo, openPasswordModal, currentBillId, setSidebarOpen }) => {
    const [sensitiveVisible, setSensitiveVisible] = useState(false);
    const [searchParams] = useSearchParams();
    const idFromUrl = searchParams.get('id');
    const bill = bills.find(b => String(b.id) === String(idFromUrl));

    const formatDate = (dateString) => new Date(dateString).toLocaleDateString('th-TH', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    if (!bill) return <div className="p-10 text-center text-slate-500">ไม่พบบิลที่ค้นหา</div>;

    const details = bill.payment_details || { cash: 0, transfer: 0 };
    const isCashOnly = details.cash > 0 && details.transfer === 0;
    const isTransferOnly = details.cash === 0 && details.transfer > 0;
    const isMixed = details.cash > 0 && details.transfer > 0;
    const totalcost = bill.items?.reduce((acc, item) => {
        const productInfo = products?.find(p => String(p.id) === String(item.productId));

        const itemCost = productInfo?.cost || 0;

        return acc + (itemCost * item.qty);
    }, 0) || 0;

    const handleToggleSensitive = () => {
        if (!sensitiveVisible) {
            openPasswordModal(() => {
                setSensitiveVisible(true);
            });
        } else {
            setSensitiveVisible(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <Header
                title={`📋 รายละเอียดบิลเลขที่ #${bill.billNumber || String(bill.id).substring(0, 5)}`}
                sensitiveVisible={sensitiveVisible}
                onToggleSensitive={handleToggleSensitive}
                onToggleSidebar={() => setSidebarOpen(prev => !prev)}
            />

            <div className="mx-auto max-w-2xl bg-white shadow-lg shadow-slate-200/50 rounded-3xl overflow-hidden border border-slate-100 mx-4 mt-8">
                {/* เพิ่ม relative ที่นี่ */}
                <div className="bg-yellow-400 p-8 text-white relative">
                    {/* ใช้ flex justify-between เพื่อให้เลขบิลอยู่ซ้ายและปุ่มอยู่ขวา */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-yellow-100 text-xs font-bold uppercase tracking-widest mb-1">เลขที่บิล</p>
                            <h2 className="text-3xl font-black">#{bill.billNumber || String(bill.id).substring(0, 5)}</h2>
                        </div>

                        {/* ตรงนี้ใช้ justify-end เพื่อดันปุ่มไปชิดขอบขวาให้สุด */}
                        <div className="flex gap-2 justify-end">
                            {/* 1. ปุ่มพิมพ์ (จาก 400 เป็น 300 และ hover เป็น 400) */}
                            <button
                                onClick={() => handlePrint(bill, 'receipt')}
                                className="w-10 h-10 flex items-center justify-center bg-blue-400 hover:bg-blue-500 text-white rounded-full transition-all duration-200 shadow-sm"
                                title="พิมพ์บิล"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                </svg>
                            </button>

                            {/* 2. ปุ่มแก้ไข */}
                            <button
                                onClick={() => {
                                    navigateTo(`edit-bill/${idFromUrl}`);
                                }}
                                className="w-10 h-10 flex items-center justify-center bg-orange-400 hover:bg-orange-500 text-white rounded-full transition-all duration-200 shadow-sm"
                                title="แก้ไขบิล"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                            </button>

                            {/* 3. ปุ่มย้อนกลับ */}
                            <button
                                onClick={() => window.history.back()}
                                className="w-10 h-10 flex items-center justify-center bg-red-400 hover:bg-red-500 text-white rounded-full transition-all duration-200 shadow-sm"
                                title="ย้อนกลับ"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-8 space-y-8">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">ลูกค้า</p>
                            <p className="font-bold text-slate-800 text-lg">{bill.customer || 'ลูกค้าทั่วไป'}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">วันที่</p>
                            <p className="font-semibold text-slate-700">{formatDate(bill.date)}</p>
                        </div>
                    </div>

                    <div>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">รายการสินค้า</p>
                        <div className="space-y-4">
                            {bill.items?.map((item, index) => (
                                <div key={index} className="flex justify-between items-center">
                                    <p className="font-bold text-emerald-500 font-large">{item.name} <span className="text-emerald-400 text-sm">x{item.qty}</span></p>
                                    <p className="font-bold text-emerald-500">{formatCurrency(item.price * item.qty)}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                                        {/* สรุปข้อมูลการเงิน */}
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-3">
                    
                        {/* ยอดรวมก่อนหักส่วนลด */}
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-bold">ยอดรวม</span>
                            <span className="text-xl font-bold text-slate-700">{formatCurrency(bill.totalsale)}</span>
                        </div>
                    
                        {/* ส่วนลด (แสดงเฉพาะเมื่อมี) */}
                        {bill.discount > 0 && (
                            <div className="flex justify-between items-center">
                                <span className="text-red-400 font-bold">ส่วนลด</span>
                                <span className="font-mono text-red-500 font-bold">-{formatCurrency(bill.discount)}</span>
                            </div>
                        )}

                        {/* VAT (แสดงเฉพาะเมื่อติ๊ก) */}
                        {bill.payment_details?.vatEnabled && (
                            <div className="flex justify-between items-center">
                                <span className="text-blue-500 font-bold">+VAT 7%</span>
                                <span className="font-mono text-blue-600 font-bold">+{formatCurrency(bill.payment_details.vatAmount || 0)}</span>
                            </div>
                        )}
                    
                        {/* ยอดสุทธิ */}
                        <div className={`flex justify-between items-center pt-3 border-t border-slate-200`}>
                            <span className="text-slate-500 font-bold">ยอดสุทธิ</span>
                            <span className="text-2xl font-black text-emerald-600">{formatCurrency(bill.total_net)}</span>
                        </div>
                    
                        {/* ต้นทุน / กำไร */}
                        <div className="pt-3 border-t border-slate-200 space-y-2">
                            <div className="flex justify-between text-md">
                                <span className="text-red-400 font-bold">ต้นทุนรวม</span>
                                <span className="font-mono text-red-600 font-bold">
                                    {sensitiveVisible ? `-${formatCurrency(totalcost)}` : "-xxxx"}
                                </span>
                            </div>
                            <div className="flex justify-between text-md">
                                <span className="text-green-500 font-bold">กำไรสุทธิ</span>
                                <span className="font-bold text-green-500">
                                    {sensitiveVisible ? formatCurrency(bill.total_net - totalcost) : "xxxx"}
                                </span>
                            </div>
                        </div>
                    
                    </div>

                    <div className="flex justify-center">
                        <span className={`px-6 py-2 text-xs font-bold rounded-full border ${isTransferOnly ? 'bg-blue-50 text-blue-600 border-blue-200' :
                            isCashOnly ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                'bg-purple-50 text-purple-600 border-purple-200'
                            }`}>
                            ชำระด้วย: {
                                isTransferOnly ? 'โอนเงิน' :
                                    isCashOnly ? 'เงินสด' :
                                        'เงินสด + โอน'
                            }
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default BillDetailView;
