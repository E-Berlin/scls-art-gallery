// components/BackgroundSlider.tsx
import React, { useEffect, useState } from "react";
import "./BackgroundSlider.css";

interface BackgroundSliderProps {
    images: string[];
    interval?: number;
}

const BackgroundSlider: React.FC<BackgroundSliderProps> = ({ images, interval = 5000 }) => {
    const [current, setCurrent] = useState(0);
    const [prev, setPrev] = useState<number | null>(null);

    useEffect(() => {
        const t = setInterval(() => {
            setPrev(current);
            setCurrent((s) => (s + 1) % images.length);
        }, interval);
        return () => clearInterval(t);
    }, [current, images.length, interval]);

    return (
        <div className="background-slider">
            {images.map((img, idx) => {
                let className = "bg-image";
                if (idx === current) className += " fade-in";
                else if (idx === prev) className += " fade-out";

                return (
                    <div
                        key={idx}
                        className={className}
                        style={{ backgroundImage: `url(${img})` }}
                    />
                );
            })}
        </div>
    );
};

export default BackgroundSlider;
