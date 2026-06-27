import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const Sidebar = ({ isOpen, setIsOpen }) => {
  const navigate = useNavigate();
  const location = useLocation(); // เพื่อใช้เช็คว่าตอนนี้อยู่หน้าไหน

  // รายการเมนูใหม่ที่สอดคล้องกับระบบ Routing ของเรา
  const menuItems = [
    { id: '/', label: '🛒 หน้าร้าน (POS)' },
    { id: '/billHistory', label: '📜 ประวัติบิลทั้งหมด' },
    { id: '/promotion', label: '🎁 จัดการโปรโมชั่น' },
    { id: '/inventory', label: '📦 จัดการคลังสินค้า' },
    { id: '/dashboard', label: '📊 สรุปภาพรวมร้านค้า' },
  ];

  return (
    <>
      {/* Overlay สำหรับมือถือ */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={() => setIsOpen(false)}
          style={{ pointerEvents: 'auto' }}
        />
      )}

      {/* Sidebar Container */}
      <div className={`fixed top-0 left-0 h-full w-64 bg-white shadow-2xl z-[60] transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="p-6">
          {/* Logo / Header */}
          <div className="flex items-center mb-8">
            <h2 className="text-2xl font-black text-green-700">🧊 รุ่งฟ้าแอร์</h2>
          </div>
          
          {/* Menu Navigation */}
          <nav className="space-y-2">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    navigate(item.id);
                    setIsOpen(false); // ปิด sidebar เมื่อกดบนมือถือ
                  }}
                  className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 font-medium ${
                    isActive 
                      ? 'bg-green-600 text-white shadow-md' 
                      : 'text-gray-600 hover:bg-green-50 hover:text-green-700'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
