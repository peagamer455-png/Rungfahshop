import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const HistoryBillCard = ({ bill, products, loadData, setPopupContent, setShowPopup, showBillDetails, onViewDetails }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const handleDelete = async () => {
    setPopupContent({
      title: "⚠️ ยืนยันการลบบิล",
      message: `คุณต้องการลบบิลเลขที่ ${bill.id} ใช่หรือไม่? ระบบจะทำการคืนสินค้าเข้าสต็อกให้โดยอัตโนมัติ`,
      actions: [
        { label: "ยกเลิก", handler: () => setShowPopup(false) },
        {
          label: "ลบและคืนสต็อก",
          variant: "danger",
          primary: true,
          handler: async () => {
            setIsDeleting(true);
            setPopupContent({
              title: "⏳ กำลังดำเนินการ...",
              message: "ระบบกำลังคืนสต็อกและลบข้อมูลบิล กรุณารอสักครู่ครับ",
              isLoading: true,
              color: "red",
              actions: [{ label: "กำลังประมวลผล...", variant: "danger" }]
            });
            try {
              // 1. วนลูปคืนสต็อกใน Supabase
              // ✅ ใช้ RPC increment_stock แบบเดียวกับที่อื่นในระบบ (atomic ในระดับ DB)
              //    แทนการอ่านค่า stock ฝั่ง client แล้วเขียนทับ (เสี่ยงชนกันเวลามีหลายเครื่องแก้สต็อกพร้อมกัน)
              // ✅ อ้างอิงด้วย productId แทนชื่อสินค้า กันกรณีสินค้าถูกเปลี่ยนชื่อภายหลังแล้วคืนสต็อกไม่เข้า
              if (bill.items && bill.items.length > 0) {
                for (const item of bill.items) {
                  const refundQty = Number(item.qty) || 0;
                  if (refundQty <= 0 || !item.productId) continue;

                  const { error: rpcErr } = await supabase.rpc('increment_stock', {
                    p_id: item.productId,
                    amount: refundQty,
                  });

                  if (rpcErr) throw rpcErr;
                }
              }

              // 2. ลบบิลออกจากตาราง bills ใน Supabase
              const { error: deleteErr } = await supabase
                .from('bills')
                .delete()
                .eq('id', bill.id);

              if (deleteErr) throw deleteErr;
              await loadData();
              setPopupContent({
                title: "✅ ดำเนินการสำเร็จ",
                message: "ลบบิลและคืนสต็อกสินค้าเรียบร้อยแล้วครับ",
                isLoading: false,
                color: "green"
              });
            } catch (error) {
              setPopupContent({
                title: "🚫 พบข้อผิดพลาด",
                message: `ขออภัยครับ ไม่สามารถดำเนินการได้: ${error.message} โปรดลองใหม่อีกครั้ง`,
                isLoading: false,
                color: "red"
              });
              setShowPopup(true);
            } finally {
              setIsDeleting(false);
            }
          }
        }
      ]
    });
    setShowPopup(true);
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-md border-l-4 border-green-400 flex justify-between items-center transition duration-200 hover:shadow-lg">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-500">
          {formatDate(bill.date)}
        </div>
        <h4 className="text-lg font-bold text-gray-700 truncate">บิลที่: #{bill.id}</h4>
        <p className="text-sm text-gray-600 truncate">ลูกค้า/ช่าง: {bill.customer || 'ไม่ระบุ'}</p>
      </div>

      <div className="flex space-x-2 ml-4">
        <button
          onClick={onViewDetails}
          className="p-2 bg-green-100 text-green-600 rounded-full hover:bg-green-200"
          aria-label="View Details"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7a10.015 10.015 0 01-4.53 5.29M3 3l18 18" />
          </svg>
        </button>
        <button
          onClick={handleDelete}
          className="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200"
          aria-label="Delete Bill"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default HistoryBillCard;