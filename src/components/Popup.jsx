import React from "react";
const Popup = ({ content, setShowPopup }) => {
  if (!content) return null;
  const { title, message, actions, isLoading, color = "green", content: inputElement, size } = content;

  // ✅ ขนาดกล่อง ปรับได้ผ่าน content.size (ไม่ระบุ = เท่าเดิม)
  const sizeClass = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  }[size] || "max-w-sm";

  const scanKeyframes = `
    @keyframes scan-animation {
      0% { left: -40%; }
      100% { left: 100%; }
    }
  `;
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
      onClick={() => !isLoading && setShowPopup(false)}
    >
      <style>{scanKeyframes}</style>
      <style>{`
        @keyframes slide-track {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${sizeClass} p-6 animate-fade-in-up`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* หัวข้อ */}
        <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
        {/* ข้อความ — เปลี่ยนจาก <p> เป็น <div> เพื่อรองรับ JSX ซับซ้อน เช่น ตาราง */}
        <div className="text-gray-600 mb-6">{message}</div>
        {inputElement && <div className="mb-6">{inputElement}</div>}
        {/* ปุ่มกด */}
        <div className="flex justify-end gap-3 min-h-[40px] items-center w-full">
          {isLoading ? (
            <div className="w-full">
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden relative">
                <div
                  className={`h-full w-[40%] rounded-full ${color === "green" ? "bg-green-600" : "bg-red-600"}`}
                  style={{
                    position: "absolute",
                    animation: "slide-track 1.5s infinite linear",
                    transformOrigin: "left"
                  }}
                ></div>
              </div>
            </div>
          ) : (
            <>
              {actions && actions.length > 0 ? (
                actions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => action.handler()}
                    className={`px-4 py-2 rounded-lg font-semibold transition ${action.variant === "danger"
                        ? "bg-red-600 text-white hover:bg-red-700"
                        : action.variant === "success"
                          ? "bg-green-600 text-white hover:bg-green-700"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                  >
                    {action.label}
                  </button>
                ))
              ) : (
                <button
                  onClick={() => setShowPopup(false)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
                >
                  ตกลง
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
export default Popup;
