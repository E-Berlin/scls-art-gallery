// context/PageTransitionContext.tsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface TransitionContextType {
    navigateWithTransition: (path: string) => void;
}

const TransitionContext = createContext<TransitionContextType | undefined>(undefined);

export const usePageTransition = () => {
    const context = useContext(TransitionContext);
    if (!context) throw new Error("usePageTransition must be used within PageTransitionProvider");
    return context;
};

export const PageTransitionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [opacity, setOpacity] = useState(1); // 初始黑色覆盖
    const [isEntering, setIsEntering] = useState(true); // 页面进入状态
    const [isLeaving, setIsLeaving] = useState(false);  // 页面离开状态
    const [targetPath, setTargetPath] = useState("");
    const navigate = useNavigate();

    // 页面加载时自动黑 → 正常淡入
    useEffect(() => {
        if (isEntering) {
            const timer = setTimeout(() => {
                setOpacity(0);
                setIsEntering(false);
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [isEntering]);

    // 页面离开触发黑屏 + 跳转
    const navigateWithTransition = (path: string) => {
        if (isLeaving) return; // 防止重复触发
        setTargetPath(path);
        setIsLeaving(true);
        setOpacity(1); // 黑屏覆盖
        setTimeout(() => {
            setIsLeaving(false);
            setIsEntering(true); // 新页面加载时需要淡入
            navigate(path);
        }, 800); // 动画时间
    };

    return (
        <TransitionContext.Provider value={{ navigateWithTransition }}>
            {children}
            <div
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    width: "100vw",
                    height: "100vh",
                    backgroundColor: "black",
                    pointerEvents: "none",
                    opacity,
                    transition: "opacity 0.8s ease-in-out",
                    zIndex: 9999,
                }}
            />
        </TransitionContext.Provider>
    );
};
