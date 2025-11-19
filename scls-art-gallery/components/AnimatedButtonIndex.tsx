// components/AnimatedButtonIndex.tsx
import React from "react";
import "./AnimatedButtonIndex.css";

interface AnimatedButtonProps {
    text: string;
    onClick?: () => void;
    delay?: number; // 可以传入动画延迟
}

const AnimatedButtonIndex: React.FC<AnimatedButtonProps> = ({ text, onClick, delay = 0 }) => {
    return (
        <div
            className="animated-index-button-wrapper"
            style={{ animationDelay: `${delay}s` }}
        >
            <button className="animated-index-button" onClick={onClick}>
                {text}
            </button>
        </div>
    );
};

export default AnimatedButtonIndex;
