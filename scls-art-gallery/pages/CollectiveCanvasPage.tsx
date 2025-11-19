// pages/CollectiveCanvasPage.tsx
"use client";
import React, { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Brush, Eraser, Hand, Users, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { SERVER_URL } from "../src/config";
import { io, Socket } from "socket.io-client";
import "./CollectiveCanvasPage.css";

const CollectiveCanvasPage: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [color, setColor] = useState("#000000");
    const [brushSize, setBrushSize] = useState(5);
    const [scale, setScale] = useState(0.6);
    const [offset, setOffset] = useState({ x: -window.innerWidth / 2 - 40, y: -window.innerHeight / 2 - 70 });
    const [mode, setMode] = useState<"draw" | "erase" | "pan">("draw");
    const [isDrawing, setIsDrawing] = useState(false);
    const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const [onlineCount, setOnlineCount] = useState(0);
    const [isMobile, setIsMobile] = useState(false);
    const backgroundColor = "#f9f9f9";

    const [containerSize, setContainerSize] = useState({ width: 1920, height: 1080 });

    // 检测设备类型
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

    // 🔥 直接连接到 canvas 命名空间
    useEffect(() => {
        const newSocket = io(`${SERVER_URL}/canvas`);
        setSocket(newSocket);

        newSocket.on("connect", () => {
            console.log("Canvas socket connected:", newSocket.id);
        });

        newSocket.on("onlineCount", (count: number) => {
            console.log("Online count updated:", count);
            setOnlineCount(count);
        });

        newSocket.on("draw", (data: any) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            ctx.strokeStyle = data.color;
            ctx.lineWidth = data.brushSize;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(data.from.x, data.from.y);
            ctx.lineTo(data.to.x, data.to.y);
            ctx.stroke();
        });

        return () => {
            newSocket.disconnect();
        };
    }, []);

    // 加载画板的 useEffect
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const resize = () => {
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext("2d");
            if (tempCtx) tempCtx.drawImage(canvas, 0, 0);
            canvas.width = 1920 * 3;
            canvas.height = 1080 * 3;
            if (tempCtx) ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
        };

        resize();
        window.addEventListener("resize", resize);

        // 从 Supabase 加载画板
        const loadCanvas = async () => {
            try {
                const response = await fetch(`${SERVER_URL}/canvas`);
                const data = await response.json();

                if (data.image) {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.src = data.image;
                    img.onload = () => {
                        ctx.drawImage(img, 0, 0);
                    };
                    img.onerror = () => {
                        console.warn('Failed to load collective canvas image, using default background');
                    };
                }
            } catch (error) {
                console.error('Failed to load collective canvas from Supabase:', error);
            }
        };

        loadCanvas();

        return () => window.removeEventListener("resize", resize);
    }, []);

    // 🔥 添加容器尺寸监测
    useEffect(() => {
        const updateContainerSize = () => {
            const container = document.querySelector('.canvas-container');
            if (container) {
                const rect = container.getBoundingClientRect();
                setContainerSize({ width: rect.width, height: rect.height });
            }
        };

        updateContainerSize();
        window.addEventListener('resize', updateContainerSize);
        return () => window.removeEventListener('resize', updateContainerSize);
    }, []);

    const getDisplayBrushSize = () => {
        const logicalToDisplayRatio = (1920 * 3) / containerSize.width;
        return (brushSize * scale) / logicalToDisplayRatio;
    };

    // 🔥 统一的事件处理函数
    const getCanvasPos = (clientX: number, clientY: number) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;

        return { x, y };
    };

    const handleStart = (clientX: number, clientY: number) => {
        if (mode === "pan") {
            setIsPanning(true);
            setLastPos({ x: clientX, y: clientY });
        } else {
            const pos = getCanvasPos(clientX, clientY);
            setLastPos(pos);
            setIsDrawing(true);

            // 立即画一个点
            const canvas = canvasRef.current;
            if (!canvas || !socket) return;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            ctx.strokeStyle = mode === "erase" ? backgroundColor : color;
            ctx.lineWidth = brushSize;
            ctx.lineCap = "round";

            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();

            socket.emit("draw", {
                from: pos,
                to: pos,
                color: ctx.strokeStyle,
                brushSize
            });
        }
    };

    const handleMove = (clientX: number, clientY: number) => {
        if (isPanning) {
            const dx = clientX - lastPos.x;
            const dy = clientY - lastPos.y;
            setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            setLastPos({ x: clientX, y: clientY });
        } else if (isDrawing && socket) {
            const pos = getCanvasPos(clientX, clientY);
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            ctx.strokeStyle = mode === "erase" ? backgroundColor : color;
            ctx.lineWidth = brushSize;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(lastPos.x, lastPos.y);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();

            socket.emit("draw", {
                from: lastPos,
                to: pos,
                color: ctx.strokeStyle,
                brushSize
            });
            setLastPos(pos);
        }
    };

    const handleEnd = () => {
        setIsDrawing(false);
        setIsPanning(false);
    };

    // 🔥 鼠标事件
    const handleMouseDown = (e: React.MouseEvent) => {
        handleStart(e.clientX, e.clientY);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        handleMove(e.clientX, e.clientY);
    };

    const handleMouseUp = () => {
        handleEnd();
    };

    // 🔥 触摸事件
    const handleTouchStart = (e: React.TouchEvent) => {
        e.preventDefault();
        const touch = e.touches[0];
        handleStart(touch.clientX, touch.clientY);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        e.preventDefault();
        const touch = e.touches[0];
        handleMove(touch.clientX, touch.clientY);
    };

    const handleTouchEnd = () => {
        handleEnd();
    };

    // 🔥 移动设备优化的缩放控制
    const handleZoomIn = () => {
        setScale(s => Math.min(8, s + 0.1));
        if (isMobile && navigator.vibrate) navigator.vibrate(50);
    };

    const handleZoomOut = () => {
        setScale(s => Math.max(0.1, s - 0.1));
        if (isMobile && navigator.vibrate) navigator.vibrate(50);
    };

    const handleResetView = () => {
        setScale(0.6);
        setOffset({ x: -window.innerWidth / 2 - 40, y: -window.innerHeight / 2 - 70 });
        if (isMobile && navigator.vibrate) navigator.vibrate(100);
    };

    const saveCanvas = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        try {
            const data = canvas.toDataURL();

            const response = await fetch(`${SERVER_URL}/canvas`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: data }),
            });

            if (!response.ok) {
                throw new Error('Failed to save canvas');
            }

            //console.log('Collective canvas saved to Supabase');
        } catch (err) {
            console.error("Save failed:", err);
        }
    };

    useEffect(() => {
        const interval = setInterval(saveCanvas, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="collective-canvas-page">
            <motion.div
                className="collective-sidebar"
                initial={{ x: -260 }}
                animate={{ x: isSidebarOpen ? 0 : -260 }}
                transition={{ type: "spring", stiffness: 100 }}
            >
                <div
                    className={`collective-sidebar-btn ${isSidebarOpen ? "open" : "closed"}`}
                    onClick={() => setSidebarOpen(!isSidebarOpen)}
                >
                    {isSidebarOpen ? <FaChevronLeft /> : <FaChevronRight />}
                </div>

                <div className="collective-sidebar-content">
                    <h2 className="collective-sidebar-title">Collective Canvas</h2>
                    <label>Tools</label>

                    <div className="collective-tool-group">
                        <button
                            onClick={() => setMode("draw")}
                            className={`collective-icon-btn ${mode === "draw" ? "active" : ""}`}
                            title="Draw mode"
                        >
                            <Brush size={isMobile ? 20 : 24} />
                        </button>

                        <button
                            onClick={() => setMode("erase")}
                            className={`collective-icon-btn ${mode === "erase" ? "active" : ""}`}
                            title="Erase mode"
                        >
                            <Eraser size={isMobile ? 20 : 24} />
                        </button>

                        <button
                            onClick={() => setMode("pan")}
                            className={`collective-icon-btn ${mode === "pan" ? "active" : ""}`}
                            title="Pan mode"
                        >
                            <Hand size={isMobile ? 20 : 24} />
                        </button>
                    </div>

                    <label>Color</label>

                    <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        title="Brush color"
                        className="color-picker"
                    />

                    <label>Brush Size: {brushSize}</label>
                    <input
                        type="range"
                        min="1"
                        max="40"
                        value={brushSize}
                        onChange={(e) => setBrushSize(Number(e.target.value))}
                        title="Brush size"
                        className="brush-slider"
                        style={{
                            '--slider-color': color,
                            '--range-percent': `${((brushSize - 1) / 39) * 100}%`
                        } as React.CSSProperties}
                    />

                    {!isMobile && (
                        <div className="collective-brush-preview-container">
                            <div
                                className="collective-brush-preview"
                                style={{
                                    width: `${getDisplayBrushSize()}px`,
                                    height: `${getDisplayBrushSize()}px`,
                                    backgroundColor: color,
                                    transform: 'none',
                                }}
                            />
                        </div>
                    )}

                    <div className="collective-zoom-controls">
                        <button onClick={handleZoomIn} title="Zoom in" className="collective-icon-btn">
                            <ZoomIn size={isMobile ? 18 : 22} />
                        </button>
                        <button onClick={handleZoomOut} title="Zoom out" className="collective-icon-btn">
                            <ZoomOut size={isMobile ? 18 : 22} />
                        </button>
                        <button onClick={handleResetView} title="Reset view" className="collective-icon-btn">
                            <RotateCcw size={isMobile ? 18 : 22} />
                        </button>
                    </div>

                    <div className="collective-online-count">
                        <Users size={18} />
                        <span>{onlineCount} online</span>
                    </div>
                </div>
            </motion.div>

            {/* 添加触摸事件支持 */}
            <div
                className={`collective-canvas-container ${mode} ${isMobile ? 'mobile' : ''}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
            >
                <motion.canvas
                    ref={canvasRef}
                    style={{
                        position: "absolute",
                        top: `50%`,
                        left: `50%`,
                        translate: `${offset.x}px ${offset.y}px`,
                        transformOrigin: "center",
                        width: "1920px",
                        height: "1080px",
                        touchAction: mode === "pan" ? "none" : "none",
                    }}
                    animate={{ scale }}
                    transition={{ type: "tween", duration: 0.15, ease: "easeOut" }}
                />
            </div>
        </div>
    );
};

export default CollectiveCanvasPage;