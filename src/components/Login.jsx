import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { loginWithUsername } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!username.trim() || !password) {
            setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบ');
            return;
        }

        setLoading(true);
        const { error: loginError } = await loginWithUsername(username, password);
        setLoading(false);

        if (loginError) {
            setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
            return;
        }

        // ไม่ต้อง navigate เอง — App.jsx จะเช็ค session แล้วสลับหน้าให้อัตโนมัติ
    };

    return (
        <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-[#eef8f1] px-4">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Prompt:wght@500;600;700&family=Sarabun:wght@400;500;600&display=swap');
                .rf-font-display { font-family: 'Prompt', sans-serif; }
                .rf-font-body { font-family: 'Sarabun', sans-serif; }
                @keyframes rf-drift {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    50% { transform: translate(-16px, 20px) scale(1.06); }
                }
                @keyframes rf-drift-slow {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    50% { transform: translate(20px, -14px) scale(1.04); }
                }
                @keyframes rf-fade-up {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes rf-spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes rf-breeze {
                    0%, 100% { opacity: 0.35; transform: translateX(0); }
                    50% { opacity: 0.7; transform: translateX(4px); }
                }
                @media (prefers-reduced-motion: reduce) {
                    .rf-blob-a, .rf-blob-b, .rf-card, .rf-breeze-line { animation: none !important; }
                }
            `}</style>

            {/* พื้นหลังเขียวอ่อนสบายตา */}
            <div
                className="absolute inset-0"
                style={{
                    background: 'radial-gradient(120% 120% at 15% 0%, #e3f7ea 0%, #eef8f1 45%, #e8f4ed 100%)'
                }}
            />
            <div
                className="rf-blob-a absolute -top-20 -left-16 w-96 h-96 rounded-full opacity-50 blur-3xl"
                style={{ background: 'radial-gradient(circle, #86e0b0 0%, transparent 70%)', animation: 'rf-drift 12s ease-in-out infinite' }}
            />
            <div
                className="rf-blob-b absolute -bottom-28 -right-14 w-[26rem] h-[26rem] rounded-full opacity-40 blur-3xl"
                style={{ background: 'radial-gradient(circle, #a7e8d8 0%, transparent 70%)', animation: 'rf-drift-slow 14s ease-in-out infinite' }}
            />

            {/* การ์ด */}
            <form
                onSubmit={handleSubmit}
                className="rf-card relative w-full max-w-[380px] rounded-3xl p-8 sm:p-9"
                style={{
                    background: 'rgba(255,255,255,0.92)',
                    boxShadow: '0 20px 50px -20px rgba(22,101,52,0.25), 0 0 0 1px rgba(22,101,52,0.05)',
                    animation: 'rf-fade-up 0.5s ease-out'
                }}
            >
                {/* ตราสัญลักษณ์: เครื่องปรับอากาศ */}
                <div className="flex justify-center mb-5">
                    <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-md relative overflow-hidden"
                        style={{ background: 'linear-gradient(135deg, #4ade80 0%, #16a34a 100%)' }}
                    >
                        <svg width="34" height="34" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                            {/* ตัวเครื่องแอร์ผนัง */}
                            <rect x="6" y="13" width="36" height="14" rx="5" fill="white" />
                            {/* ไฟสถานะ */}
                            <circle cx="33" cy="20" r="1.6" fill="#16a34a" />
                            {/* ช่องลม / บานเกล็ด */}
                            <line x1="11" y1="20" x2="29" y2="20" stroke="#16a34a" strokeWidth="1.6" strokeLinecap="round" />
                            {/* ลมเย็นที่พัดออกมา */}
                            <path className="rf-breeze-line" d="M12 30q4 3 0 6" stroke="white" strokeWidth="2" strokeLinecap="round" style={{ animation: 'rf-breeze 2.2s ease-in-out infinite' }} />
                            <path className="rf-breeze-line" d="M20 30q4 4 0 8" stroke="white" strokeWidth="2" strokeLinecap="round" style={{ animation: 'rf-breeze 2.2s ease-in-out infinite 0.3s' }} />
                            <path className="rf-breeze-line" d="M28 30q4 3 0 6" stroke="white" strokeWidth="2" strokeLinecap="round" style={{ animation: 'rf-breeze 2.2s ease-in-out infinite 0.6s' }} />
                        </svg>
                    </div>
                </div>

                <h1 className="rf-font-display text-center text-[22px] font-bold text-[#14532d] mb-1">
                    ระบบจัดการขายร้านรุ่งฟ้าแอร์
                </h1>
                <p className="rf-font-body text-center text-[13px] text-slate-500 mb-7">
                    เข้าสู่ระบบเพื่อเปิดหน้าขาย
                </p>

                {/* ชื่อผู้ใช้ */}
                <div className="mb-4">
                    <label htmlFor="username" className="rf-font-body block text-[12px] font-medium text-slate-600 mb-1.5">
                        ชื่อผู้ใช้
                    </label>
                    <div className="relative">
                        <span className="absolute inset-y-0 left-3.5 flex items-center text-slate-400">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                                <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5Zm0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5Z"
                                    fill="currentColor" />
                            </svg>
                        </span>
                        <input
                            id="username"
                            type="text"
                            autoComplete="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={loading}
                            placeholder="กรอกชื่อผู้ใช้"
                            className="rf-font-body w-full pl-10 pr-3.5 py-3 text-[14px] rounded-xl border border-green-100 bg-green-50/50 text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:bg-white focus:border-green-400 focus:ring-4 focus:ring-green-200/40 disabled:opacity-60"
                        />
                    </div>
                </div>

                {/* รหัสผ่าน */}
                <div className="mb-2">
                    <label htmlFor="password" className="rf-font-body block text-[12px] font-medium text-slate-600 mb-1.5">
                        รหัสผ่าน
                    </label>
                    <div className="relative">
                        <span className="absolute inset-y-0 left-3.5 flex items-center text-slate-400">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                                <path d="M17 9V7a5 5 0 0 0-10 0v2a3 3 0 0 0-3 3v7a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-7a3 3 0 0 0-3-3ZM9 7a3 3 0 0 1 6 0v2H9V7Z"
                                    fill="currentColor" />
                            </svg>
                        </span>
                        <input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading}
                            placeholder="กรอกรหัสผ่าน"
                            className="rf-font-body w-full pl-10 pr-11 py-3 text-[14px] rounded-xl border border-green-100 bg-green-50/50 text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:bg-white focus:border-green-400 focus:ring-4 focus:ring-green-200/40 disabled:opacity-60"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            tabIndex={-1}
                            className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
                        >
                            {showPassword ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.83 2.83M9.36 5.6C10.2 5.2 11.08 5 12 5c5 0 9 4.5 10 7-.5 1.16-1.34 2.5-2.5 3.7M6.6 6.6C4.6 7.9 3 9.9 2 12c1 2.5 5 7 10 7 1.36 0 2.62-.3 3.75-.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6"/></svg>
                            )}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="rf-font-body flex items-center gap-2 mt-4 mb-1 px-3 py-2.5 rounded-lg bg-red-50 border border-red-100 text-red-600 text-[12.5px]">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/><path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="rf-font-display w-full mt-6 py-3 rounded-xl text-white text-[14.5px] font-semibold tracking-wide shadow-lg shadow-green-500/20 transition-all hover:shadow-xl hover:shadow-green-500/30 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:hover:translate-y-0 flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #4ade80 0%, #15803d 100%)' }}
                >
                    {loading && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'rf-spin 0.7s linear infinite' }}>
                            <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
                            <path d="M21 12a9 9 0 0 0-9-9" stroke="white" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                    )}
                    {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
                </button>
            </form>
        </div>
    );
};

export default Login;
