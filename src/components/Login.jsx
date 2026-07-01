import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
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
        <div style={styles.page}>
            <form style={styles.card} onSubmit={handleSubmit}>
                <h1 style={styles.title}>รุ่งฟ้าแอร์</h1>
                <p style={styles.subtitle}>เข้าสู่ระบบเพื่อเปิดหน้าขาย</p>

                <label style={styles.label} htmlFor="username">ชื่อผู้ใช้</label>
                <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={styles.input}
                    disabled={loading}
                />

                <label style={styles.label} htmlFor="password">รหัสผ่าน</label>
                <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={styles.input}
                    disabled={loading}
                />

                {error && <div style={styles.error}>{error}</div>}

                <button type="submit" style={styles.button} disabled={loading}>
                    {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
                </button>
            </form>
        </div>
    );
};

const styles = {
    page: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f4f4f2',
        fontFamily: "'Tahoma', sans-serif",
    },
    card: {
        width: '100%',
        maxWidth: '340px',
        background: '#fff',
        borderRadius: '10px',
        padding: '32px 28px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column',
    },
    title: {
        textAlign: 'center',
        color: '#166534',
        fontSize: '20px',
        margin: '0 0 4px 0',
    },
    subtitle: {
        textAlign: 'center',
        color: '#666',
        fontSize: '13px',
        margin: '0 0 24px 0',
    },
    label: {
        fontSize: '12px',
        color: '#333',
        marginBottom: '4px',
    },
    input: {
        padding: '10px 12px',
        marginBottom: '16px',
        border: '1px solid #ccc',
        borderRadius: '6px',
        fontSize: '14px',
        outline: 'none',
    },
    error: {
        color: '#b91c1c',
        fontSize: '12px',
        marginBottom: '12px',
        textAlign: 'center',
    },
    button: {
        marginTop: '8px',
        padding: '11px',
        background: '#166534',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: 'bold',
        cursor: 'pointer',
    },
};

export default Login;
