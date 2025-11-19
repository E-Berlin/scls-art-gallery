// pages/drawGuess/WordSelection.tsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { usePageTransition } from "../../context/PageTransitionContext";
import { useSocket } from "../../context/SocketContext";
import { useUser } from "../../context/UserContext";
import { SERVER_URL, SUPABASE_URL } from "../../src/config";
import { ScrollingBackground } from "../../components/ScrollingBackground";
import axios from "axios";
import "./WordSelection.css";

// 🔥 新增：定义 Player 接口
interface Player {
    id: string;
    username: string;
    avatar: string;
    score: number;
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

const WordSelection: React.FC = () => {
    const { roomID } = useParams<{ roomID: string }>();
    const { drawGuessSocket } = useSocket();
    const { navigateWithTransition } = usePageTransition();
    const { user } = useUser();

    const [wordOptions, setWordOptions] = useState<string[]>([]);
    const [isArtist, setIsArtist] = useState(false);
    const [artist, setArtist] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState(15);

    const DEFAULT_AVATAR = `${SUPABASE_URL}/storage/v1/object/public/default-imgs/default-avatar.jpg`;

    const computeRemaining = (startTime: any, roundTime: any, serverNow?: any) => {
        const s = Number(startTime);
        const r = Number(roundTime);
        if (!s || !r) return 15;

        const drift = serverNow ? Date.now() - Number(serverNow) : 0;
        const remaining = Math.ceil((s + r * 1000 - (Date.now() - drift)) / 1000);
        return Math.max(0, remaining);
    };

    useEffect(() => {
        if (!drawGuessSocket) return;

        // 监听连接事件
        const handleConnect = () => {
            console.log("✅ Socket connected/reconnected in WordSelection");
            // 重新加入房间以确保状态同步
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
            console.log("❌ Socket disconnected in WordSelection");
        };

        drawGuessSocket.on("connect", handleConnect);
        drawGuessSocket.on("disconnect", handleDisconnect);

        return () => {
            drawGuessSocket.off("connect", handleConnect);
            drawGuessSocket.off("disconnect", handleDisconnect);
        };
    }, [drawGuessSocket, roomID, user]);

    useEffect(() => {
        if (!drawGuessSocket || !user || !roomID) return;

        const initRound = async () => {
            try {
                const res = await axios.get(`${SERVER_URL}/api/room/${roomID}`);
                const room = res.data;

                if (!room) {
                    alert("Room not found!");
                    navigateWithTransition("/game/draw-guess");
                    return;
                }

                // 🔥 修复：先尝试重新加入房间，而不是直接重定向
                const isPlayerInRoom = room.playerList.some((p: Player) => p.id === user.id);
                const isGameStarted = (room.currentRound ?? 0) > 0;

                if (!isPlayerInRoom && isGameStarted) {
                    console.log("🔄 Player not in room but game started, attempting to rejoin...");

                    const rejoinSuccess = await attemptRejoinRoom(roomID, user, drawGuessSocket);
                    if (!rejoinSuccess) {
                        alert("Failed to rejoin the game! Redirecting to main menu.");
                        navigateWithTransition("/game/draw-guess");
                        return;
                    }

                    // 重新获取房间数据
                    const newRes = await axios.get(`${SERVER_URL}/api/room/${roomID}`);
                    const newRoom = newRes.data;

                    if (newRoom.wordOptions && newRoom.wordOptions.length > 0) {
                        setWordOptions(newRoom.wordOptions);
                        setArtist(newRoom.currentArtist);
                        setIsArtist(user?.id === newRoom.currentArtist);

                        const remaining = computeRemaining(newRoom.roundStartTime, 15, newRoom.serverNow);
                        setTimeLeft(remaining);
                    }
                    return;
                }

                // 原有的游戏状态检查逻辑
                if (room.roundState !== "wordSelection" && room.roundState !== "waiting") {
                    console.log(`🔄 Not in word selection phase (${room.roundState}), redirecting...`);
                    if (room.roundState === "drawing") {
                        navigateWithTransition(`/game/draw-guess/draw-guess-main/${roomID}`);
                        return;
                    }
                }

                if (room.wordOptions && room.wordOptions.length > 0) {
                    setWordOptions(room.wordOptions);
                    setArtist(room.currentArtist);
                    setIsArtist(user?.id === room.currentArtist);

                    const remaining = computeRemaining(room.roundStartTime, 15, room.serverNow);
                    setTimeLeft(remaining);
                } else {
                    await axios.post(`${SERVER_URL}/api/room/startRound`, {
                        roomId: roomID,
                        theme: room.theme
                    });
                }
            } catch (err) {
                console.error(err);
                alert("Failed to load room data!");
                navigateWithTransition("/game/draw-guess");
            }
        };

        initRound();

        const handleRoundStarted = (data: any) => {
            if (data.phase !== "wordSelection") return;

            setWordOptions(data.wordOptions);
            setArtist(data.artist);
            setIsArtist(user?.id === data.artist);

            const remaining = computeRemaining(data.startTime, data.roundTime, data.serverNow);
            setTimeLeft(remaining);
        };

        const handleRoundWordSelected = (data: any) => {
            navigateWithTransition(`/game/draw-guess/draw-guess-main/${roomID}`);
        };

        drawGuessSocket.on("roundStarted", handleRoundStarted);
        drawGuessSocket.on("roundWordSelected", handleRoundWordSelected);

        return () => {
            drawGuessSocket?.off("roundStarted", handleRoundStarted);
            drawGuessSocket?.off("roundWordSelected", handleRoundWordSelected);
        };
    }, [drawGuessSocket, roomID, user, navigateWithTransition]);

    useEffect(() => {
        if (timeLeft <= 0) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    drawGuessSocket?.emit("roundTimeout", { roomId: roomID });
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [timeLeft, drawGuessSocket, roomID]);

    // 添加错误处理
    useEffect(() => {
        if (!drawGuessSocket) return;

        const handleSelectWordError = (data: any) => {
            console.error("❌ Word selection error:", data);
            alert("You are not the current artist or it's not word selection phase!");
        };

        drawGuessSocket.on("selectWordError", handleSelectWordError);

        return () => {
            drawGuessSocket.off("selectWordError", handleSelectWordError);
        };
    }, [drawGuessSocket]);

    const handleSelectWord = (word: string) => {
        console.log(`🎨 Artist selecting word: ${word}, userID: ${user?.id}`);
        drawGuessSocket?.emit("selectWord", { roomId: roomID, word });
    };

    return (
        <div className="word-selection-page">
            {/* 背景漂浮图标 */}
            <ScrollingBackground />

            <div className="word-selection-container">
                {isArtist ? (
                    <>
                        <h2 className="word-selection-title">
                            🎨 Please select a word
                            <span className="word-selection-artist-badge">artist</span>
                        </h2>
                        <div className="word-selection-options-grid">
                            {wordOptions.map((word, index) => (
                                <button
                                    key={word}
                                    onClick={() => handleSelectWord(word)}
                                    className="word-selection-option-button"
                                    style={{ animationDelay: `${0.2 + index * 0.1}s` }}
                                >
                                    {word}
                                </button>
                            ))}
                        </div>
                    </>
                ) : (
                    <h2 className="word-selection-waiting-message">
                        🎨 The artist is selecting a word...
                    </h2>
                )}

                <div className="word-selection-timer-display">
                    ⏱️ Time remaining: {timeLeft}s
                </div>
            </div>
        </div>
    );
};

export default WordSelection;