import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '../types';
import { authService, toUser } from '../services/authService';
import { supabase } from '../lib/supabase';

interface AuthContextType {
    user: User | null;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    isAuthenticated: boolean;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};
