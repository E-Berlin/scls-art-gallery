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
    const [isMobile, setIsMobile] = useState(false);
    const [isScrolling, setIsScrolling] = useState(false);
    const maskRef = useRef<HTMLDivElement>(null);

    // 🔥 修复：使用 number 类型而不是 NodeJS.Timeout
    const scrollTimeoutRef = useRef<number | null>(null);
    let gamepadInterval: number;

    // 🔥 新增：设备检测
    useEffect(() => {
        const checkDevice = () => {
            const userAgent = navigator.userAgent.toLowerCase();
            const isMobileDevice = /mobile|android|iphone|ipad|phone/i.test(userAgent);
            const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            setIsMobile(isMobileDevice || isTouchDevice || window.innerWidth <= 768);
        };

        checkDevice();
        window.addEventListener('resize', checkDevice);
        return () => window.removeEventListener('resize', checkDevice);
    }, []);

    const maxExpandHeight =
        typeof window !== "undefined" ? window.innerHeight - offsetTop : 800;

    const overlayTranslate = -maskHeight * 0.3 - overlayOffsetY;

    // 🔥 改进的滚动处理函数
    const handleScroll = (deltaY: number, isTouch = false) => {
        if (!maskRef.current) return;

        const contentEl = maskRef.current.querySelector(".scroll-mask-content");
        const isAtTop = contentEl ? contentEl.scrollTop === 0 : true;
        const isAtBottom = contentEl
            ? Math.abs(contentEl.scrollHeight - contentEl.scrollTop - contentEl.clientHeight) < 1
            : false;

        // 设置滚动状态（用于视觉反馈）
        setIsScrolling(true);
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = setTimeout(() => setIsScrolling(false), 150);

        if (deltaY > 0) {
            // 向上滚动 - 展开蒙版
            if (!fixedContent) {
                setMaskHeight(maxExpandHeight);
                setFixedContent(true);

                // 移动设备触觉反馈
                if (isMobile && isTouch && navigator.vibrate) {
                    navigator.vibrate(30);
                }
                return true; // 表示已处理
            }
        } else if (deltaY < 0) {
            // 向下滚动 - 收起蒙版
            if (fixedContent && isAtTop) {
                setFixedContent(false);
                setMaskHeight(initialHeight);

                // 移动设备触觉反馈
                if (isMobile && isTouch && navigator.vibrate) {
                    navigator.vibrate(30);
                }
                return true; // 表示已处理
            }
        }
        return false;
    };

    // 🔥 统一的事件处理器
    const handleWheel = (e: WheelEvent) => {
        const handled = handleScroll(e.deltaY, false);
        if (handled) {
            e.preventDefault();
        }
    };

    // 🔥 新增：触摸滚动处理
    const handleTouchStart = (e: TouchEvent) => {
        // 记录触摸起始位置用于计算滚动方向
        const touchY = e.touches[0].clientY;
        let lastTouchY = touchY;

        const handleTouchMove = (moveEvent: TouchEvent) => {
            if (!fixedContent || maskRef.current?.querySelector(".scroll-mask-content")?.scrollTop === 0) {
                const currentTouchY = moveEvent.touches[0].clientY;
                const deltaY = lastTouchY - currentTouchY; // 负值表示向上滚动

                const handled = handleScroll(deltaY * 2, true); // 放大触摸滚动效果
                if (handled) {
                    moveEvent.preventDefault();
                }

                lastTouchY = currentTouchY;
            }
        };

        const handleTouchEnd = () => {
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };

        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd);
    };

    // 🔥 新增：键盘导航支持
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowDown' && !fixedContent) {
            // 按下向下箭头展开
            handleScroll(1, false);
            e.preventDefault();
        } else if (e.key === 'ArrowUp' && fixedContent) {
            // 在顶部按下向上箭头收起
            const contentEl = maskRef.current?.querySelector(".scroll-mask-content");
            const isAtTop = contentEl ? contentEl.scrollTop === 0 : false;
            if (isAtTop) {
                handleScroll(-1, false);
                e.preventDefault();
            }
        } else if (e.key === 'Escape' && fixedContent) {
            // ESC键收起
            setFixedContent(false);
            setMaskHeight(initialHeight);
            e.preventDefault();
        }
    };

    // 🔥 改进的事件监听器
    useEffect(() => {
        // 鼠标滚轮
        window.addEventListener("wheel", handleWheel, { passive: false });

        // 触摸事件
        window.addEventListener("touchstart", handleTouchStart, { passive: false });

        // 键盘导航
        window.addEventListener("keydown", handleKeyDown);

        // 游戏手柄支持
        const handleGamepad = (e: GamepadEvent) => {
            const gamepad = e.gamepad;
            if (gamepad.buttons[13]?.pressed) { // 下方向键
                handleScroll(1, false);
            } else if (gamepad.buttons[12]?.pressed && fixedContent) { // 上方向键
                const contentEl = maskRef.current?.querySelector(".scroll-mask-content");
                const isAtTop = contentEl ? contentEl.scrollTop === 0 : false;
                if (isAtTop) {
                    handleScroll(-1, false);
                }
            }
        };

        window.addEventListener("gamepadconnected", (e) => {
            console.log("Gamepad connected:", e.gamepad.id);
        });

        window.addEventListener("gamepaddisconnected", (e) => {
            console.log("Gamepad disconnected:", e.gamepad.id);
        });

        // 游戏手柄轮询
        if (!isMobile) {
            gamepadInterval = setInterval(() => {
                const gamepads = navigator.getGamepads();
                for (const gamepad of gamepads) {
                    if (gamepad) {
                        handleGamepad({ gamepad } as GamepadEvent);
                    }
                }
            }, 100);
        }

        return () => {
            window.removeEventListener("wheel", handleWheel);
            window.removeEventListener("touchstart", handleTouchStart);
            window.removeEventListener("keydown", handleKeyDown);
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
            if (gamepadInterval) {
                clearInterval(gamepadInterval);
            }
        };
    }, [fixedContent, maxExpandHeight, initialHeight, isMobile]);

    // 🔥 新增：动态调整最大高度（响应窗口大小变化）
    useEffect(() => {
        const handleResize = () => {
            if (fixedContent) {
                const newMaxHeight = window.innerHeight - offsetTop;
                setMaskHeight(newMaxHeight);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [fixedContent, offsetTop]);

    return (
        <>
            {/* Overlay - 添加移动设备优化 */}
            <div
                className={`scroll-mask-overlay ${isScrolling ? 'scrolling' : ''} ${isMobile ? 'mobile' : ''}`}
                style={{
                    transform: `translateY(${overlayTranslate}px)`,
                }}
                aria-hidden
            >
                <div className="overlay-inner">
                    <h1 className="overlay-title">
                        <span className="gradient-left-line"></span>
                        {title}
                        <span className="gradient-right-line"></span>
                    </h1>
                    <h2 className="overlay-sub-title">{subTitle}</h2>
                    <div className="overlay-icon">{icon}</div>
                    <div className="overlay-sub">
                        <span className="overlay-hint">
                            {isMobile ? 'Swipe Up' : 'Scroll Down'}
                        </span>
                        <FaChevronDown
                            className={`overlay-arrow ${isScrolling ? 'pulsing' : ''}`}
                        />
                    </div>

                    {/* 新增：键盘/手柄提示 */}
                    {!isMobile && (
                        <div className="control-hints">
                            <span className="hint-tip">↓ to expand • ↑ to collapse • ESC to close</span>
                        </div>
                    )}
                </div>
            </div>

            {/* 蒙版 - 添加触摸滚动优化 */}
            <div
                className={`scroll-mask ${fixedContent ? 'expanded' : 'collapsed'} ${isMobile ? 'mobile' : ''}`}
                style={{
                    height: `${maskHeight}px`,
                    position: fixedContent ? "fixed" : "absolute",
                }}
                ref={maskRef}
            >
                <div
                    className="scroll-mask-content"
                    style={{
                        // 移动设备优化滚动
                        WebkitOverflowScrolling: 'touch',
                        overflow: 'auto',
                    }}
                >
                    <h3 className="scroll-mask-title">
                        <span className="gradient-left-line"></span>
                        {scrollMaskTitle}
                        <span className="gradient-right-line"></span>
                    </h3>
                    {children}

                    {/* 新增：移动设备关闭提示 */}
                    {isMobile && fixedContent && (
                        <div className="mobile-close-hint">
                            <span>Swipe down from top to close</span>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default ScrollMask;