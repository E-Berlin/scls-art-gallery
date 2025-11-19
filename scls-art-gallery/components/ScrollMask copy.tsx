// components/ScrollMask.tsx
import React, { useState, useEffect, useRef } from "react";
import { FaImages, FaChevronDown } from "react-icons/fa";
import "./ScrollMask.css";

interface ScrollMaskProps {
    initialHeight?: number;
    offsetTop?: number;
    overlayOffsetY?: number; // overlay 上移偏移量
    children?: React.ReactNode;
    title?: string;
    subTitle?: string;
    icon?: React.ReactNode;
    scrollMaskTitle?: string;
}

const ScrollMask: React.FC<ScrollMaskProps> = ({
    initialHeight = 60,
    offsetTop = 80,
    overlayOffsetY = 50,
    title = "NONE",
    subTitle = "NONE",
    icon = <FaImages />,
    scrollMaskTitle = "NONE",
    children,
}) => {
    const [maskHeight, setMaskHeight] = useState(initialHeight);
    const [fixedContent, setFixedContent] = useState(false);
    const maskRef = useRef<HTMLDivElement>(null);

    const maxExpandHeight =
        typeof window !== "undefined" ? window.innerHeight - offsetTop : 800;

    const overlayTranslate = -maskHeight * 0.3 - overlayOffsetY;

    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (!maskRef.current) return;

            const contentEl = maskRef.current.querySelector(".scroll-mask-content");
            const isAtTop = contentEl ? contentEl.scrollTop === 0 : true;
            const isAtBottom = contentEl
                ? contentEl.scrollHeight - contentEl.scrollTop === contentEl.clientHeight
                : false;

            if (e.deltaY > 0) {
                // 用户向上滚
                if (!fixedContent) {
                    // 蒙版先自动完全弹出
                    setMaskHeight(maxExpandHeight);
                    setFixedContent(true);
                    e.preventDefault();
                }
            } else if (e.deltaY < 0) {
                // 用户向下滚
                if (fixedContent && isAtTop) {
                    // 蒙版内部滚动回到顶部时才收起
                    setFixedContent(false);
                    setMaskHeight(initialHeight);
                    e.preventDefault();
                }
            }
        };

        window.addEventListener("wheel", handleWheel, { passive: false });
        return () => window.removeEventListener("wheel", handleWheel);
    }, [fixedContent, initialHeight, maxExpandHeight]);

    return (
        <>
            {/* overlay */}
            <div
                className="scroll-mask-overlay"
                style={{
                    transform: `translateY(${overlayTranslate}px)`,
                }}
                aria-hidden
            >
                <div className="overlay-inner">
                    <h1 className="overlay-title"><span className="gradient-left-line"></span> {title} <span className="gradient-right-line"></span></h1>
                    <h2 className="overlay-sub-title">{subTitle}</h2>
                    <div className="overlay-icon">{icon}</div>
                    <div className="overlay-sub">
                        <span className="overlay-hint">Scroll Down</span>
                        <FaChevronDown className="overlay-arrow" />
                    </div>
                </div>
            </div>

            {/* 蒙版 */}
            <div
                className="scroll-mask"
                style={{
                    height: `${maskHeight}px`,
                    position: fixedContent ? "fixed" : "absolute",
                }}
                ref={maskRef}
            >
                <div className="scroll-mask-content">
                    <h3 className="scroll-mask-title"><span className="gradient-left-line"></span> {scrollMaskTitle} <span className="gradient-right-line"></span></h3>
                    {children}
                </div>
            </div>
        </>
    );
};

export default ScrollMask;
