// pages/drawGuess/DrawGuessMain.tsx
"use client";
import React, { useRef, useState, useEffect } from "react";
import { usePageTransition } from "../../context/PageTransitionContext";
import { motion } from "framer-motion";
import { Brush, Eraser, Hand, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useParams } from "react-router-dom";
import { SERVER_URL, SUPABASE_URL } from "../../src/config";
import { useSocket } from "../../context/SocketContext";
import { useUser } from "../../context/UserContext";
import axios from "axios";
import "./DrawGuessMain.css";

interface Player {
    id: string;
    username: string;
    avatar: string;
    score: number;
}

interface Guess {
    playerId: string;
    playerName: string;
    guess: string;
    isCorrect: boolean;
    timestamp: number;
    actualScore?: number; // 添加这个可选属性
}

interface RoomData {
    roomID: string;
    currentRound: number;
    totalRounds: number;
    currentArtist: string;
    currentWord: string | null;
    playerList: Player[];
    roundTime: number;
    roundStartTime: number;
    guesses: Guess[]; // 使用新的 Guess 接口
    difficultyMultiplier?: number;
    theme?: string;
}

// 🔥 新增：通用的重新加入房间函数
const attemptRejoinRoom = async (roomID: string, user: any, drawGuessSocket: any) => {
    try {
        console.log("🔄 Attempting to rejoin room...");

        // 通过 API 重新加入
        await axios.post(`${SERVER_URL}/api/room/join/${roomID}`, {
            id: user?.id,
            username: user?.username,
            avatar: user?.avatar
        });

        // 通过 socket 重新加入
        if (drawGuessSocket) {
            drawGuessSocket.emit("joinRoom", {
                roomId: roomID,
                username: user?.username,
                avatar: user?.avatar,
                userId: user?.id
            });
        }

        console.log("✅ Successfully rejoined room");
        return true;
    } catch (error) {
        console.error("❌ Failed to rejoin room:", error);
        return false;
    }
};

const DrawGuessMain: React.FC = () => {
    const { navigateWithTransition } = usePageTransition();
    const { roomID } = useParams<{ roomID: string }>();
    const { drawGuessSocket, drawGuessCanvasSocket } = useSocket();
    const { user } = useUser();

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [color, setColor] = useState("#000000");
    const [brushSize, setBrushSize] = useState(5);
    const [scale, setScale] = useState(0.6);
    const [offset, setOffset] = useState({ x: -window.innerWidth / 2 - 40, y: -window.innerHeight / 2 - 70 });
    const [mode, setMode] = useState<"draw" | "erase" | "pan">("draw");
    const [isDrawing, setIsDrawing] = useState(false);
    const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    // Game state
    const [roomData, setRoomData] = useState<RoomData | null>(null);
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [guessInput, setGuessInput] = useState("");
    const [isArtist, setIsArtist] = useState(false);

    // 在组件中添加状态跟踪玩家是否已猜对/猜错
    const [guessStatus, setGuessStatus] = useState<'idle' | 'correct' | 'incorrect'>('idle');
    const [lastGuess, setLastGuess] = useState('');

    const backgroundColor = "#f9f9f9";

    // 更精确的版本，考虑画布容器的实际尺寸
    const [containerSize, setContainerSize] = useState({ width: 1920, height: 1080 });

    const DEFAULT_AVATAR = `${SUPABASE_URL}/storage/v1/object/public/default-imgs/default-avatar.jpg`;

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

    // Load room data and initialize game state
    useEffect(() => {
        if (!roomID || !user) return;

        const loadRoomData = async () => {
            try {
                const response = await fetch(`${SERVER_URL}/api/room/${roomID}`);
                const data: RoomData = await response.json();

                if (!data) {
                    alert("Room not found!");
                    navigateWithTransition("/game/draw-guess");
                    return;
                }

                // 🔥 修复：先尝试重新加入房间
                const isPlayerInRoom = data.playerList.some((p: Player) => p.id === user.id);
                const isGameStarted = (data.currentRound ?? 0) > 0;

                if (!isPlayerInRoom && isGameStarted) {
                    console.log("🔄 Player not in room but game started, attempting to rejoin...");

                    const rejoinSuccess = await attemptRejoinRoom(roomID, user, drawGuessSocket);
                    if (!rejoinSuccess) {
                        alert("Failed to rejoin the game! Redirecting to main menu.");
                        navigateWithTransition("/game/draw-guess");
                        return;
                    }

                    // 重新获取房间数据
                    const newResponse = await fetch(`${SERVER_URL}/api/room/${roomID}`);
                    const newData: RoomData = await newResponse.json();

                    setRoomData(newData);
                    setIsArtist(newData.currentArtist === user?.id);

                    if (newData.roundStartTime) {
                        const elapsed = Date.now() - newData.roundStartTime;
                        const remaining = Math.max(0, newData.roundTime * 1000 - elapsed);
                        setTimeLeft(Math.floor(remaining / 1000));
                    }
                    return;
                }

                // 正常设置房间数据
                setRoomData(data);
                setIsArtist(data.currentArtist === user?.id);

                if (data.roundStartTime) {
                    const elapsed = Date.now() - data.roundStartTime;
                    const remaining = Math.max(0, data.roundTime * 1000 - elapsed);
                    setTimeLeft(Math.floor(remaining / 1000));
                }
            } catch (err) {
                console.error("Failed to load room data:", err);
                alert("Failed to load room data!");
                navigateWithTransition("/game/draw-guess");
            }
        };

        loadRoomData();
    }, [roomID, user, navigateWithTransition, drawGuessSocket]);

    // Socket event listeners
    useEffect(() => {
        if (!drawGuessSocket) return;

        const handleConnect = () => {
            console.log("✅ Socket connected/reconnected in DrawGuessMain");
            if (roomID && user) {
                drawGuessSocket.emit("joinRoom", {
                    roomId: roomID,
                    username: user.username,
                    avatar: user.avatar || DEFAULT_AVATAR,
                    userId: user.id
                });
            }
        };

        const handleDisconnect = () => {
            console.log("❌ Socket disconnected in DrawGuessMain");
        };

        const handleRoomUpdate = (data: RoomData) => {
            console.log("Room update received:", {
                roomId: data.roomID,
                difficultyMultiplier: data.difficultyMultiplier,
                theme: data.theme
            });
            setRoomData(data);
            setIsArtist(data.currentArtist === user?.id);
        };

        const handleRoundFinished = () => {
            setGuessStatus('idle');
            setGuessInput('');
            console.log("Round finished event received");
        };

        const handleRoundEnded = (data: any) => {
            console.log("Round ended, navigating to result");
            navigateWithTransition(`/game/draw-guess/round-result/${roomID}`);
        };

        const handleGameFinished = (data: any) => {
            console.log("Game finished, navigating to final result");
            navigateWithTransition(`/game/draw-guess/final-result/${roomID}`);
        };

        const handleDrawingPhaseStarted = (data: any) => {
            console.log("Drawing phase started:", {
                difficultyMultiplier: data.difficultyMultiplier,
                phase: data.phase
            });

            if (data.phase === "drawing") {
                setRoomData(prev => prev ? { ...prev, ...data } : null);
                setIsArtist(data.artist === user?.id);

                // 🔥 修复：使用服务器时间计算剩余时间
                const elapsed = Date.now() - data.startTime;
                const remaining = Math.max(0, data.roundTime * 1000 - elapsed);
                setTimeLeft(Math.floor(remaining / 1000));

                setGuessStatus('idle');
                setLastGuess('');

                // 重置画板
                const canvas = canvasRef.current;
                if (canvas) {
                    const ctx = canvas.getContext("2d");
                    if (ctx) {
                        ctx.fillStyle = backgroundColor;
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        const data = canvas.toDataURL();
                        fetch(`${SERVER_URL}/drawGuess/canvas`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ image: data }),
                        });
                    }
                }
            }
        };

        const handleRoundWordSelected = (data: { word: string }) => {
            console.log("Word selected:", data.word);
            setRoomData(prev => prev ? { ...prev, currentWord: data.word } : null);
        };

        const handleGuessSubmitted = (guess: any) => {
            console.log("Guess submitted:", guess);
            setRoomData(prev => prev ? {
                ...prev,
                guesses: [...prev.guesses, guess]
            } : null);

            if (guess.playerId === user?.id) {
                setLastGuess(guess.guess);
                if (guess.isCorrect) {
                    setGuessStatus('correct');
                } else {
                    setGuessStatus('incorrect');
                    setTimeout(() => setGuessStatus('idle'), 3000);
                }
            }
        };

        // 🔥 新增：处理阶段超时
        const handlePhaseTimeout = (data: { phase: string }) => {
            console.log(`Phase timeout: ${data.phase}`);
            if (data.phase === "wordSelection") {
                // 如果还在选词阶段，强制进入绘画阶段
                navigateWithTransition(`/game/draw-guess/draw-guess-main/${roomID}`);
            }
        };

        drawGuessSocket.on("connect", handleConnect);
        drawGuessSocket.on("disconnect", handleDisconnect);
        drawGuessSocket.on("roomUpdate", handleRoomUpdate);
        drawGuessSocket.on("drawingPhaseStarted", handleDrawingPhaseStarted);
        drawGuessSocket.on("roundWordSelected", handleRoundWordSelected);
        drawGuessSocket.on("guessSubmitted", handleGuessSubmitted);
        drawGuessSocket.on("roundFinished", handleRoundFinished);
        drawGuessSocket.on("roundEnded", handleRoundEnded);
        drawGuessSocket.on("gameFinished", handleGameFinished);
        drawGuessSocket.on("phaseTimeout", handlePhaseTimeout);

        return () => {
            drawGuessSocket.off("connect", handleConnect);
            drawGuessSocket.off("disconnect", handleDisconnect);
            drawGuessSocket.off("roomUpdate", handleRoomUpdate);
            drawGuessSocket.off("drawingPhaseStarted", handleDrawingPhaseStarted);
            drawGuessSocket.off("roundWordSelected", handleRoundWordSelected);
            drawGuessSocket.off("guessSubmitted", handleGuessSubmitted);
            drawGuessSocket.off("roundFinished", handleRoundFinished);
            drawGuessSocket.off("roundEnded", handleRoundEnded);
            drawGuessSocket.off("gameFinished", handleGameFinished);
            drawGuessSocket.off("phaseTimeout", handlePhaseTimeout);
        };
    }, [drawGuessSocket, roomID, user?.id, navigateWithTransition]);

    // Countdown timer
    useEffect(() => {
        if (timeLeft <= 0) return;

        const timer = setInterval(() => {
            setTimeLeft(prev => Math.max(0, prev - 1));
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft]);

    // Canvas initialization and socket events
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

            canvas.width = 1920;
            canvas.height = 1080;
            if (tempCtx) ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
        };

        resize();
        window.addEventListener("resize", resize);

        // Initialize canvas with background
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Load drawGuess canvas
        fetch(`${SERVER_URL}/drawGuess/canvas`)
            .then(res => res.json())
            .then(data => {
                if (data.image) {
                    const img = new Image();
                    img.src = data.image;
                    img.onload = () => {
                        ctx.drawImage(img, 0, 0);
                    };
                }
            });

        return () => window.removeEventListener("resize", resize);
    }, []);

    // Canvas drawing socket events
    useEffect(() => {
        if (!drawGuessCanvasSocket) return;

        const handleDraw = (data: any) => {
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
        };

        drawGuessCanvasSocket.on("draw", handleDraw);

        return () => {
            drawGuessCanvasSocket.off("draw", handleDraw);
        };
    }, [drawGuessCanvasSocket]);

    // 添加容器尺寸监测
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

    // 🔥 改进的画布位置计算 - 支持触摸和鼠标
    const getCanvasPos = (clientX: number, clientY: number) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;

        return { x, y };
    };

    // 🔥 统一的事件处理函数
    const handleStart = (clientX: number, clientY: number) => {
        // 处理拖拽（所有用户都可以拖拽画布）
        if (mode === "pan" || !isArtist) {
            setIsPanning(true);
            setLastPos({ x: clientX, y: clientY });
        }
        // 处理绘画（只有艺术家在绘画或擦除模式下可以绘画）
        else if (isArtist) {
            const pos = getCanvasPos(clientX, clientY);
            setLastPos(pos);
            setIsDrawing(true);

            // 立即画一个点（解决触摸设备点击不画点的问题）
            if (drawGuessCanvasSocket) {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const ctx = canvas.getContext("2d");
                if (!ctx) return;

                ctx.strokeStyle = mode === "erase" ? backgroundColor : color;
                ctx.lineWidth = brushSize;
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y);
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();

                drawGuessCanvasSocket.emit("draw", {
                    from: pos,
                    to: pos,
                    color: ctx.strokeStyle,
                    brushSize
                });
            }
        }
    };

    const handleMove = (clientX: number, clientY: number) => {
        // 处理拖拽移动
        if (isPanning) {
            const dx = clientX - lastPos.x;
            const dy = clientY - lastPos.y;
            setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            setLastPos({ x: clientX, y: clientY });
        }
        // 处理绘画移动
        else if (isDrawing && isArtist && drawGuessCanvasSocket) {
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

            drawGuessCanvasSocket.emit("draw", {
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

    // 🔥 鼠标事件处理
    const handleMouseDown = (e: React.MouseEvent) => {
        handleStart(e.clientX, e.clientY);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        handleMove(e.clientX, e.clientY);
    };

    const handleMouseUp = () => {
        handleEnd();
    };

    // 🔥 触摸事件处理
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

    // 🔥 移动设备优化的控制函数
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

    // Auto-save canvas
    const saveCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const data = canvas.toDataURL();
        fetch(`${SERVER_URL}/drawGuess/canvas`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: data }),
        }).catch(err => console.error("Save failed:", err));
    };

    useEffect(() => {
        const interval = setInterval(saveCanvas, 3000);
        return () => clearInterval(interval);
    }, []);

    // Guess submission
    const handleGuessSubmit = () => {
        if (!guessInput.trim() || !drawGuessSocket || !roomID) return;

        drawGuessSocket.emit("submitGuess", {
            roomId: roomID,
            playerId: user?.id,
            guess: guessInput.trim()
        });

        setGuessInput("");
    };

    // Format time as MM:SS
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const getArtistName = () => {
        if (!roomData) return "";
        const artist = roomData.playerList.find(p => p.id === roomData.currentArtist);
        return artist?.username || "Unknown";
    };

    if (!roomData) {
        return (
            <div className="draw-guess-page loading">
                <div className="loading-message">Loading game...</div>
            </div>
        );
    }

    return (
        <div className="draw-guess-page">
            {/* Left Sidebar */}
            <motion.div
                className="draw-guess-sidebar"
                initial={{ x: -260 }}
                animate={{ x: isSidebarOpen ? 0 : -260 }}
                transition={{ type: "spring", stiffness: 100 }}
            >
                <div
                    className={`draw-guess-sidebar-btn ${isSidebarOpen ? "open" : "closed"}`}
                    onClick={() => setSidebarOpen(!isSidebarOpen)}
                >
                    {isSidebarOpen ? <FaChevronLeft /> : <FaChevronRight />}
                </div>

                <div className="draw-guess-sidebar-content">
                    {/* Game Info */}
                    <div className="draw-guess-game-info">
                        <h3 className="draw-guess-round-info">
                            🎨 Drawing in Progress — Round {roomData.currentRound}/{roomData.totalRounds}
                        </h3>
                        <p className="draw-guess-artist-info">👑 Artist: {getArtistName()}</p>
                        <p className={`timer ${timeLeft <= 10 ? 'blinking' : ''}`}>
                            ⏱️ Countdown: {formatTime(timeLeft)}
                        </p>
                        {roomData.difficultyMultiplier !== undefined && (
                            <p className="difficulty-info">
                                🚀 Difficulty Bonus: x{roomData.difficultyMultiplier.toFixed(1)}
                            </p>
                        )}
                    </div>

                    {/* Current Word (for artist) or Guess Input (for guessers) */}
                    {isArtist ? (
                        <div className="draw-guess-artist-section">
                            <p className="draw-guess-current-word">
                                Current Word: <strong>{roomData.currentWord || "Waiting for selection..."}</strong>
                            </p>

                            {/* Drawing Tools - Only for artist */}
                            <label>Tools</label>
                            <div className="draw-guess-tool-group">
                                <button
                                    onClick={() => setMode("draw")}
                                    className={`draw-guess-icon-btn ${mode === "draw" ? "active" : ""}`}
                                    title="Draw mode"
                                >
                                    <Brush size={isMobile ? 20 : 24} />
                                </button>
                                <button
                                    onClick={() => setMode("erase")}
                                    className={`draw-guess-icon-btn ${mode === "erase" ? "active" : ""}`}
                                    title="Erase mode"
                                >
                                    <Eraser size={isMobile ? 20 : 24} />
                                </button>
                                <button
                                    onClick={() => setMode("pan")}
                                    className={`draw-guess-icon-btn ${mode === "pan" ? "active" : ""}`}
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

                            <div className="draw-guess-zoom-controls">
                                <button onClick={handleZoomIn} title="Zoom in" className="draw-guess-icon-btn">
                                    <ZoomIn size={isMobile ? 18 : 22} />
                                </button>
                                <button onClick={handleZoomOut} title="Zoom out" className="draw-guess-icon-btn">
                                    <ZoomOut size={isMobile ? 18 : 22} />
                                </button>
                                <button onClick={handleResetView} title="Reset view" className="draw-guess-icon-btn">
                                    <RotateCcw size={isMobile ? 18 : 22} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="guesser-section">
                            <p className="guess-title">💬 Guess the Word Corner</p>

                            {guessStatus === 'correct' && (
                                <div className="guess-message success">
                                    ✅ Congratulations! "{lastGuess}" is correct! +100 points 🎉
                                </div>
                            )}

                            {guessStatus === 'incorrect' && (
                                <div className="guess-message error">
                                    ❌ "{lastGuess}" was incorrect. Try again!
                                </div>
                            )}

                            <div className="guess-input-group">
                                <input
                                    type="text"
                                    value={guessInput}
                                    onChange={(e) => setGuessInput(e.target.value)}
                                    placeholder={
                                        guessStatus === 'correct' ? "Correctly guessed, waiting..." :
                                            guessStatus === 'incorrect' ? "Keep guessing..." :
                                                "Please enter your guess."
                                    }
                                    className={`guess-input ${guessStatus === 'correct' ? 'disabled' :
                                        guessStatus === 'incorrect' ? 'error' : ''
                                        }`}
                                    onKeyPress={(e) => {
                                        if (guessStatus !== 'correct' && e.key === 'Enter') {
                                            handleGuessSubmit();
                                        }
                                    }}
                                    disabled={guessStatus === 'correct'}
                                />
                                <button
                                    onClick={handleGuessSubmit}
                                    className={`guess-submit-btn ${guessStatus === 'correct' ? 'disabled' :
                                        guessStatus === 'incorrect' ? 'error' : ''
                                        }`}
                                    disabled={guessStatus === 'correct'}
                                >
                                    {guessStatus === 'correct' ? 'Correct guess ✓' :
                                        guessStatus === 'incorrect' ? 'Try again 🔄' :
                                            'Submit 🚀'}
                                </button>
                            </div>

                            {/* 提示信息 */}
                            {roomData?.currentWord && guessStatus !== 'correct' && (
                                <div className="hint-section">
                                    <p className="hint">💡 Hint: The word is {roomData.currentWord.length} letters long.</p>
                                    {guessStatus === 'incorrect' && (
                                        <p className="encouragement">Don't give up—take a closer look at the painting!</p>
                                    )}
                                </div>
                            )}

                            <div className="draw-guess-zoom-controls">
                                <button onClick={handleZoomIn} title="Zoom in" className="draw-guess-icon-btn">
                                    <ZoomIn size={isMobile ? 18 : 22} />
                                </button>
                                <button onClick={handleZoomOut} title="Zoom out" className="draw-guess-icon-btn">
                                    <ZoomOut size={isMobile ? 18 : 22} />
                                </button>
                                <button onClick={handleResetView} title="Reset view" className="draw-guess-icon-btn">
                                    <RotateCcw size={isMobile ? 18 : 22} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* 🔥 Main Canvas Area - 添加触摸事件支持 */}
            <div
                className={`draw-guess-canvas-container ${mode} ${!isArtist ? 'readonly' : ''} ${isMobile ? 'mobile' : ''}`}
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
                        cursor: isArtist
                            ? (mode === "pan" ? (isPanning ? "grabbing" : "grab") : "crosshair")
                            : (isPanning ? "grabbing" : "grab"),
                        touchAction: mode === "pan" ? "none" : "none",
                    }}
                    animate={{ scale }}
                    transition={{ type: "tween", duration: 0.15, ease: "easeOut" }}
                />
            </div>

            {/* Right Player List */}
            <div className={`player-list-sidebar ${isMobile ? 'mobile' : ''}`}>
                <h3>Player List ({roomData.playerList.length})</h3>
                <div className="player-list-container">
                    {[...roomData.playerList]
                        .sort((a, b) => b.score - a.score)
                        .map((player, index) => (
                            <div key={player.id} className="player-item">
                                <div className="player-avatar">
                                    <img src={player.avatar} alt={player.username} />
                                    {player.id === roomData.currentArtist && (
                                        <span className="artist-badge">🎨</span>
                                    )}
                                </div>
                                <div className="player-info">
                                    <span className="player-name">
                                        {player.username}
                                        {player.id === user?.id && " (You)"}
                                    </span>
                                    <span className="player-score">Score: {player.score} points</span>
                                </div>
                                <div className="player-rank">#{index + 1}</div>
                            </div>
                        ))}
                </div>

                {roomData.guesses && roomData.guesses.filter(g => g.isCorrect).length > 0 && (
                    <div className="score-records">
                        <h4>Score Record</h4>
                        <div className="score-list">
                            {roomData.guesses
                                .filter(g => g.isCorrect)
                                .slice(-3)
                                .map((guess, index) => {
                                    const displayScore = guess.actualScore || 100;

                                    return (
                                        <div key={index} className="score-item">
                                            <span className="score-player">{guess.playerName}</span>
                                            <span className="score-points">
                                                + {displayScore} points
                                                {roomData.difficultyMultiplier !== undefined && (
                                                    <span className="difficulty-badge">(x{roomData.difficultyMultiplier.toFixed(1)})</span>
                                                )}
                                            </span>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DrawGuessMain;