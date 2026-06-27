import React, { useEffect, useRef } from "react";

const PasswordConfirmModal = ({
  isOpen,
  onClose,
  onSuccess,
  passwordInput,
  setPasswordInput,
  passwordVisible,
  setPasswordVisible,
  passwordError,
  setPasswordError,
  SENSITIVE_PASSWORD,
}) => {
  const passwordInputRef = useRef(null);

  // Focus ที่ช่องกรอกรหัสทันทีที่ Modal เปิด
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => passwordInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const verify = () => {
    if (passwordInput === SENSITIVE_PASSWORD) {
      if (typeof onSuccess === "function") {
        onSuccess();
      } else {
        setPasswordError("รหัสไม่ถูกต้อง กรุณาลองใหม่");
      }
      setPasswordInput(""); // เคลียร์รหัสผ่านที่ค้างใน Input
      setPasswordError(""); // เคลียร์ Error
      onClose(); // ปิด Modal
    } else {
      setPasswordError("รหัสไม่ถูกต้อง กรุณาลองใหม่");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-fade-in-up">
        <div className="flex items-center justify-center mb-4">
          <div className="bg-gray-100 rounded-full p-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="size-6 text-gray-600"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
          </div>
        </div>
        <h3 className="text-xl font-bold text-center text-gray-900 mb-2">
          กรุณาใส่รหัส
        </h3>
        <p className="text-gray-600 text-center mb-4">
          กรุณาใส่รหัสเพื่อยืนยันการกระทำ
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            รหัส
          </label>
          <div className="relative">
            <input
              ref={passwordInputRef}
              type={passwordVisible ? "text" : "password"}
              value={passwordInput}
              onChange={(e) => {
                setPasswordInput(e.target.value);
                setPasswordError("");
              }}
              className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 outline-none"
              placeholder="ใส่รหัสยืนยัน"
              onKeyDown={(e) => {
                if (e.key === "Enter") verify();
              }}
            />
            <button
              type="button"
              onClick={() => setPasswordVisible((v) => !v)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {/* ไอคอนตา */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={
                    passwordVisible
                      ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a10.05 10.05 0 012.03-3.274M6.1 6.1A9.95 9.95 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.015 10.015 0 01-4.53 5.29M3 3l18 18"
                      : "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  }
                />
              </svg>
            </button>
          </div>
          {passwordError && (
            <p className="mt-2 text-sm text-red-600">{passwordError}</p>
          )}
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
          >
            ยกเลิก
          </button>
          <button
            onClick={verify}
            className="px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600"
          >
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  );
};

export default PasswordConfirmModal;
