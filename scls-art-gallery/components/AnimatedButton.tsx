// components/AnimatedButton.tsx
import React from "react";
import "./AnimatedButton.css";

interface AnimatedButtonProps {
    text: string;
    onClick?: () => void;
    delay?: number;
    loading?: boolean;
    loadingText?: string;
    disabled?: boolean;
}

const AnimatedButton: React.FC<AnimatedButtonProps> = ({
    text,
    onClick,
    delay = 0,
    loading = false,
    loadingText = "Loading...",
    disabled = false
}) => {
    const handleClick = () => {
        if (!loading && !disabled && onClick) {
            onClick();
        }
    };

    return (
        <div
            className="animated-button-wrapper"
            style={{ animationDelay: `${delay}s` }}
        >
            <button
                className={`animated-button ${loading ? 'loading' : ''} ${disabled ? 'disabled' : ''}`}
                onClick={handleClick}
                disabled={loading || disabled}
            >
                {loading ? loadingText : text}
            </button>
        </div>
    );
};

export default AnimatedButton;