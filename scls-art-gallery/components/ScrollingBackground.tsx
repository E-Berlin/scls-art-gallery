// components/ScrollingBackground.tsx
"use client";
import React, { useEffect, useState } from "react";
import styles from "./ScrollingBackground.module.css";

const ICONS = [
    "🎨", "✏️", "🐱", "🐶", "🖌️", "📐", "🖼️",
    "🌟", "✨", "🍀", "🍎", "🍄", "⚡", "💧", "🪐",
    "🎲", "🧩", "🎯", "🕹️"
];

type IconItem = {
    id: number;
    x: number;
    y: number;
    size: number;
    icon: string;
    floatOffset: number;
};

export const ScrollingBackground: React.FC = () => {
    const [icons, setIcons] = useState<IconItem[]>([]);

    useEffect(() => {
        const GAP_X = 10; // 横向间距 vw
        const GAP_Y = 12; // 纵向间距 vh
        const rows = Math.ceil(100 / GAP_Y) + 1; // 多加一行保证铺满
        const cols = Math.ceil(100 / GAP_X);     // 每屏列数

        const temp: IconItem[] = [];
        let idCounter = 0;

        // 生成一屏列
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                temp.push({
                    id: idCounter++,
                    x: col * GAP_X,
                    y: row * GAP_Y + Math.random() * GAP_Y * 0.3,
                    size: 50 + Math.random() * 20,
                    icon: ICONS[Math.floor(Math.random() * ICONS.length)],
                    floatOffset: Math.random() * 8,
                });
            }
        }

        // 复制一屏用于无缝滚动，x + 100vw
        const clone = temp.map((i) => ({
            ...i,
            id: idCounter++,
            x: i.x + 100,
        }));

        setIcons([...temp, ...clone]);
    }, []);

    return (
        <div className={styles.container}>
            <div className={styles.scrollWrapper}>
                {icons.map((i) => (
                    <div
                        key={i.id}
                        className={styles.icon}
                        style={{
                            left: `${i.x}vw`,
                            top: `${i.y}vh`,
                            fontSize: `${i.size}px`,
                            animationDelay: `${Math.random() * 2}s`,
                            transform: `translateY(${i.floatOffset}px)`,
                        }}
                    >
                        {i.icon}
                    </div>
                ))}
            </div>
        </div>
    );
};
