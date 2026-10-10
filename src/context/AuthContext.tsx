import React, { useState, useEffect, type ReactNode } from 'react';
import type { User } from '../types';
import { authService, toUser } from '../services/authService';
import { supabase } from '../lib/supabase';
import { AuthContext } from './useAuth';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        authService.getCurrentUser().then((currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session ? toUser(session.user) : null);
        });

        return () => subscription.unsubscribe();
    }, []);

    const login = async (username: string, password: string) => {
        setUser(await authService.login(username, password));
    };

    const register = async (username: string, password: string) => {
        setUser(await authService.register(username, password));
    };

    const logout = async () => {
        await authService.logout();
        setUser(null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                login,
                register,
                logout,
                isAuthenticated: user !== null,
                loading,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
