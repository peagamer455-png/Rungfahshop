import React, { useState, useMemo, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Header } from "./SharedUI";
import Pagination from './Pagination';
import HistoryBillCard from './HistoryBillCard';

const BillHistoryView = ({ bills, products, loadData, setPopupContent, setShowPopup, showBillDetails, setSidebarOpen}) => {
  const [filterTerm, setFilterTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearPassword, setClearPassword] = useState('');
  const [clearError, setClearError] = useState('');
  const [clearPasswordVisible, setClearPasswordVisible] = useState(false);

  const itemsPerPage = 15;
  const SENSITIVE_PASSWORD = '261250'; // รหัสผ่านสำหรับลบประวัติ

  const filteredBills = useMemo(() => {
    let list = bills || [];
    if (filterTerm) {
      const lowerFilter = filterTerm.toString().toLowerCase();
      list = list.filter(bill => {
        if (bill.id && bill.id.toString().includes(lowerFilter)) return true;
        if (bill.customer && bill.customer.toLowerCase().includes(lowerFilter)) return true;
        if (bill.items && bill.items.some(item => item.name.toLowerCase().includes(lowerFilter))) return true;
        return false;
      });
    }

    if (dateFrom || dateTo) {
      const start = dateFrom ? new Date(dateFrom) : null;
      const end = dateTo ? new Date(dateTo) : null;
      if (start) start.setHours(0, 0, 0, 0);
      if (end) end.setHours(23, 59, 59, 999);
      list = list.filter(bill => {
        const t = new Date(bill.date).getTime();
        if (start && t < start.getTime()) return false;
        if (end && t > end.getTime()) return false;
        return true;
      });
    }
    return list;
  }, [bills, filterTerm, dateFrom, dateTo]);

  const totalPages = Math.ceil(filteredBills.length / itemsPerPage);

  const currentBills = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredBills.slice(start, start + itemsPerPage);
  }, [filteredBills, currentPage]);

  const handleClearHistory = async () => {
    if (clearPassword !== SENSITIVE_PASSWORD) {
      setClearError('รหัสไม่ถูกต้อง กรุณาลองใหม่');
      return;
    }
    try {
      const idsToDelete = filteredBills.map(b => b.id);
      const { error } = await supabase.from('bills').delete().in('id', idsToDelete);
      if (error) throw error;

      await loadData();
      setShowClearConfirm(false);
      setClearPassword('');
      setPopupContent({
        title: "✅ ดำเนินการสำเร็จ",
        message: `ระบบได้ลบข้อมูลบิลจำนวน ${idsToDelete.length} รายการเรียบร้อยแล้วครับ`,
        color: "green"
      });
      setShowPopup(true);
    } catch (error) {
      setPopupContent({
        title: "⚠️ ขออภัย พบข้อผิดพลาด",
        message: `ไม่สามารถดำเนินการได้: ${error.message} โปรดตรวจสอบการเชื่อมต่อหรือติดต่อผู้ดูแลระบบครับ`,
        color: "red"
      });
      setShowPopup(true);
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <Header title={`📋 ประวัติบิลทั้งหมด`} onToggleSidebar={() => setSidebarOpen(prev => !prev)}/>

      {/* Filter Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <input
          type="text"
          placeholder="🔍 ค้นหาบิล..."
          value={filterTerm}
          onChange={(e) => { setFilterTerm(e.target.value); setCurrentPage(1); }}
          className="md:col-span-2 p-3 border rounded-lg"
        />
        <div className="flex gap-2">
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }} className="w-full p-2 border rounded-lg" />
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }} className="w-full p-2 border rounded-lg" />
        </div>
      </div>

      <div className="flex justify-end mb-4">
        <button onClick={() => setShowClearConfirm(true)} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
          เคลียร์ประวัติบิล
        </button>
      </div>

      {/* List Section */}
      <div className="space-y-3">
        {currentBills.length > 0 ? (
          currentBills.map(bill => (
            <HistoryBillCard
              key={bill.id}
              bill={bill}
              products={products}
              loadData={loadData}
              setPopupContent={setPopupContent}
              setShowPopup={setShowPopup}
              onViewDetails={() => showBillDetails(bill.id)}
            />
          ))
        ) : (
          <div className="text-center py-10 text-gray-500">ไม่พบบิลที่ค้นหา</div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-8 flex justify-center">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            setCurrentPage={setCurrentPage}
          />
        </div>
      )}

      {/* Clear Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">ยืนยันการเคลียร์ประวัติ</h3>
            <input
              type={clearPasswordVisible ? "text" : "password"}
              value={clearPassword} onChange={(e) => setClearPassword(e.target.value)}
              className="w-full p-2 border rounded mb-2" placeholder="ใส่รหัสผ่าน"
            />
            {clearError && <p className="text-red-500 text-sm mb-2">{clearError}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowClearConfirm(false)} className="px-4 py-2 bg-gray-200 rounded">ยกเลิก</button>
              <button onClick={handleClearHistory} className="px-4 py-2 bg-red-500 text-white rounded">ลบรายการ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillHistoryView;
