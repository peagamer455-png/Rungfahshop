import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Sidebar = ({ isOpen, setIsOpen }) => {
  const navigate = useNavigate();
  const location = useLocation(); // เพื่อใช้เช็คว่าตอนนี้อยู่หน้าไหน
  const { logout } = useAuth();

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
      <div className={`fixed top-0 left-0 h-full w-64 bg-white shadow-2xl z-[60] flex flex-col justify-between transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="p-6 overflow-y-auto">
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

        {/* ปุ่มออกจากระบบ */}
        <div className="p-6 pt-4 border-t border-gray-100">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white text-sm transition-all duration-200 shadow-md shadow-red-500/20 hover:shadow-lg hover:shadow-red-500/30 hover:-translate-y-0.5 active:translate-y-0"
            style={{ background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            ออกจากระบบ
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
