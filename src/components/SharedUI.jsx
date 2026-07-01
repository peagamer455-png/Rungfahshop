import React from 'react';

// 1. Loading Spinner
export const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-screen bg-gray-50">
    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-green-500"></div>
    <p className="ml-4 text-green-700 font-semibold">กำลังโหลดข้อมูลระบบ...</p>
  </div>
);

// 2. Header (เพิ่ม props 'date' เข้ามา)
export const Header = ({
  title = "ระบบจัดการหน้าร้านรุ่งฟ้าแอร์",
  onToggleSidebar,
  onToggleSensitive,
  sensitiveVisible,
  date // รับค่าวันที่เข้ามา
}) => (
  <header className="flex items-center justify-between p-4 bg-white shadow-sm sticky top-0 z-10 border-b border-gray-100">
    <div className="flex items-center">
      <button
        onClick={onToggleSidebar}
        className="p-2 mr-3 text-green-600 rounded-full hover:bg-green-50 transition duration-150 lg:hidden"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <h1 className="text-xl font-bold text-green-800">{title}</h1>
    </div>

    <div className="flex items-center gap-3">
      {/* ส่วนแสดงวันที่ */}
      {date && (
        <div className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-white border border-green-200 rounded-lg shadow-[0_2px_10px_-3px_rgba(0,0,0,0.1)]">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-bold text-gray-800 tracking-tight">
            {date}
          </span>
        </div>
      )}

      <button
        onClick={onToggleSensitive}
        title={sensitiveVisible ? 'ซ่อนข้อมูลสรุปยอด' : 'แสดงข้อมูลสรุปยอด'}
        className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${sensitiveVisible
            ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        aria-pressed={sensitiveVisible}
      >
        {sensitiveVisible ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a10.05 10.05 0 012.03-3.274M6.1 6.1A9.95 9.95 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.015 10.015 0 01-4.53 5.29M3 3l18 18" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )}
        <span className="hidden sm:inline">
          {sensitiveVisible ? 'ซ่อนยอดสรุป' : 'ดูยอดสรุป'}
        </span>
      </button>
    </div>
  </header>
);

// 3. Modal Popup
export const ModalPopup = ({ isOpen, title, message, onClose, actions }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-600 mb-6 text-sm">{message}</p>
        <div className="flex justify-end space-x-2">
          {actions ? actions.map((action, index) => (
            <button
              key={index}
              onClick={() => { action.handler(); onClose(); }}
              className={`px-4 py-2 rounded-lg font-medium text-sm ${action.variant === 'danger' ? 'bg-rose-500 text-white' : 'bg-green-600 text-white'}`}
            >
              {action.label}
            </button>
          )) : (
            <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">ปิด</button>
          )}
        </div>
      </div>
    </div>
  );
};