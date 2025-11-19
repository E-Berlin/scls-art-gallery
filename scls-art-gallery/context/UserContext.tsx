// context/UserContext.tsx
import React, { createContext, useState, useContext, useEffect } from "react";
import { SERVER_URL } from "../config/config";

interface User {
    id: string;
    username: string;
    email: string;
    avatar?: string;
    role: "user" | "admin";
    likes: number;
    score: number;
    isVerified: boolean;
}

interface UserContextType {
    user: User | null;
    setUser: (user: User | null) => void;
    logout: () => void;
    isInitialized: boolean;
    updateUser: (updates: Partial<User>) => void;
    refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUserState] = useState<User | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // 新增：刷新用户数据
    const refreshUser = React.useCallback(async () => {
        if (!user) return;

        try {
            const response = await fetch(`${SERVER_URL}/api/auth/user/${user.id}`);
            const data = await response.json();

            if (response.ok && data.user) {
                setUserState(data.user);
                localStorage.setItem("user", JSON.stringify(data.user));
            }
        } catch (error) {
            console.error("Failed to refresh user data:", error);
        }
    }, [user]);

    useEffect(() => {
        const savedUser = localStorage.getItem("user");
        if (savedUser) {
            try {
                const parsedUser = JSON.parse(savedUser);
                setUserState(parsedUser);
            } catch (err) {
                localStorage.removeItem("user");
            }
        }
        setIsInitialized(true);
    }, []);

    const setUser = React.useCallback((newUser: User | null) => {
        setUserState(newUser);
        if (newUser) {
            localStorage.setItem("user", JSON.stringify(newUser));
        } else {
            localStorage.removeItem("user");
        }
    }, []);

    const updateUser = React.useCallback((updates: Partial<User>) => {
        setUserState(prev => prev ? { ...prev, ...updates } : null);
        // 同时更新localStorage
        const currentUser = localStorage.getItem("user");
        if (currentUser) {
            try {
                const parsedUser = JSON.parse(currentUser);
                const updatedUser = { ...parsedUser, ...updates };
                localStorage.setItem("user", JSON.stringify(updatedUser));
            } catch (err) {
                console.error("Failed to update user in localStorage:", err);
            }
        }
    }, []);

    const logout = React.useCallback(() => {
        setUser(null);
    }, [setUser]);

    const contextValue = React.useMemo(() => ({
        user,
        setUser,
        logout,
        isInitialized,
        updateUser,
        refreshUser
    }), [user, setUser, logout, isInitialized, updateUser, refreshUser]);

    return (
        <UserContext.Provider value={contextValue}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = (): UserContextType => {
    const context = useContext(UserContext);
    if (!context) throw new Error("useUser must be used within a UserProvider");
    return context;
};