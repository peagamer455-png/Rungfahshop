import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // โหลด session ปัจจุบัน (ถ้าเคย login ค้างไว้)
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        // ฟังการเปลี่ยนแปลงสถานะ login/logout
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setSession(session);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    // login ด้วย username: หา email จาก username ก่อน แล้วค่อย signIn จริง
    const loginWithUsername = async (username, password) => {
        const { data: profile, error: lookupError } = await supabase
            .from('profiles')
            .select('email')
            .eq('username', username.trim())
            .single();

        if (lookupError || !profile) {
            return { error: { message: 'ไม่พบชื่อผู้ใช้นี้ในระบบ' } };
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email: profile.email,
            password,
        });

        return { data, error };
    };

    const logout = async () => {
        await supabase.auth.signOut();
    };

    const value = {
        session,
        user: session?.user ?? null,
        loading,
        loginWithUsername,
        logout,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth ต้องถูกเรียกภายใน <AuthProvider>');
    return ctx;
};
