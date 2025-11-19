// pages/drawGuess/Lobby.tsx
import { useParams } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { usePageTransition } from "../../context/PageTransitionContext";
import { useSocket } from "../../context/SocketContext";
import { useUser } from "../../context/UserContext";
import { SERVER_URL, SUPABASE_URL } from "../../src/config";
import { ScrollingBackground } from "../../components/ScrollingBackground";
import axios from "axios";
import "./Lobby.css";

interface Player {
    id: string;
    username: string;
    avatar?: string;
    score?: number;
}

interface Room {
    roomID: string;
    playerList: Player[];
    maxPlayers: number;
    theme: string;
    host: { id: string; username: string };
    // 游戏状态属性
    currentRound?: number;
    totalRounds?: number;
    currentArtist?: string;
    currentWord?: string | null;
    roundState?: string;
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

const Lobby: React.FC = () => {
    const { roomID } = useParams<{ roomID: string }>();
    const { navigateWithTransition } = usePageTransition();
    const { drawGuessSocket } = useSocket();
    const { user } = useUser();
    const [room, setRoom] = useState<Room | null>(null);
    const [displayRoom, setDisplayRoom] = useState<Room | null>(null);
    const [copySuccess, setCopySuccess] = useState(false);

    const DEFAULT_AVATAR = `${SUPABASE_URL}/storage/v1/object/public/default-imgs/default-avatar.jpg`;

    useEffect(() => {
        if (!drawGuessSocket || !user || !roomID) return;

        const handleRoomUpdate = (updatedRoom: Room) => {
            if (updatedRoom.roomID === roomID) {
                console.log("🔄 Room update received");

                const isHost = user.id === updatedRoom.host.id;

                if (isHost) {
                    // Host端：延迟2秒显示新玩家
                    setDisplayRoom(prevRoom => {
                        if (!prevRoom) return updatedRoom;

                        // 检测新玩家
                        const newPlayers = updatedRoom.playerList.filter(newPlayer =>
                            !prevRoom.playerList.some(oldPlayer => oldPlayer.id === newPlayer.id)
                        );

                        if (newPlayers.length > 0) {
                            console.log("🎉 Host: Delaying display of new players");
                            // 先显示旧玩家，2秒后更新到完整列表
                            setTimeout(() => {
                                setDisplayRoom(updatedRoom);
                            }, 2000);
                            return prevRoom; // 保持旧列表
                        } else {
                            return updatedRoom; // 没有新玩家，立即更新
                        }
                    });
                } else {
                    // 非Host端：立即显示
                    setDisplayRoom(updatedRoom);
                }

                setRoom(updatedRoom);

                // 🔥 新增：检查游戏是否已经开始，如果已经开始则自动跳转
                if ((updatedRoom.currentRound ?? 0) > 0) {
                    console.log("🔄 Game already started, auto-navigating...");
                    handleGameStarted({ roomId: roomID });
                }
            }
        };

        const handleGameStarted = (data: { roomId: string }) => {
            if (data.roomId === roomID) {
                console.log("🚀 Game started, navigating to word selection");
                // 使用 setTimeout 确保在下一个事件循环中执行导航
                setTimeout(() => {
                    navigateWithTransition(`/game/draw-guess/word-selection/${roomID}`);
                }, 500);
            }
        };

        // 监听房间删除事件
        const handleRoomDeleted = () => {
            console.log("Room has been deleted, redirecting to main menu");
            navigateWithTransition("/game/draw-guess");
        };

        drawGuessSocket.on("roomUpdate", handleRoomUpdate);
        drawGuessSocket.on("gameStarted", handleGameStarted);
        drawGuessSocket.on("roomDeleted", handleRoomDeleted);

        // 初始加载
        axios
            .get(`${SERVER_URL}/api/room/${roomID}`)
            .then(res => {
                const roomData: Room = res.data;

                if (!roomData) {
                    alert("Room not found!");
                    navigateWithTransition("/game/draw-guess");
                    return;
                }

                // 检查玩家是否在房间中
                const isGameStarted = (roomData.currentRound ?? 0) > 0;
                const isPlayerInRoom = roomData.playerList.some((p: Player) => p.id === user.id);

                if (!isPlayerInRoom && isGameStarted) {
                    console.log("🔄 Player not in room but game started, attempting to rejoin...");

                    const rejoinSuccess = attemptRejoinRoom(roomID, user, drawGuessSocket);
                    if (!rejoinSuccess) {
                        alert("Game has already started! You cannot join mid-game.");
                        navigateWithTransition("/game/draw-guess");
                        return;
                    }
                }

                setRoom(roomData);
                setDisplayRoom(roomData);

                // 🔥 新增：如果游戏已经开始，自动跳转到正确阶段
                if (isGameStarted && isPlayerInRoom) {
                    console.log("🔄 Game already in progress, auto-navigating...");
                    // 根据当前游戏状态跳转到相应页面
                    determineAndNavigateToCurrentPhase(roomData);
                }
            })
            .catch(err => {
                console.error(err);
                // 🔥 修复：如果房间不存在（404），视为正常情况，跳转到主菜单
                if (err.response?.status === 404) {
                    console.log("Room not found, likely deleted. Redirecting to main menu.");
                    navigateWithTransition("/game/draw-guess");
                } else {
                    alert("Failed to load room!");
                    navigateWithTransition("/game/draw-guess");
                }
            });

        return () => {
            drawGuessSocket.off("roomUpdate", handleRoomUpdate);
            drawGuessSocket.off("gameStarted", handleGameStarted);
            drawGuessSocket.off("roomDeleted", handleRoomDeleted);
        };
    }, [drawGuessSocket, roomID, navigateWithTransition, user]);

    useEffect(() => {
        if (!drawGuessSocket) return;

        // 监听连接事件
        const handleConnect = () => {
            console.log("✅ Socket connected/reconnected");
            // 重新加入房间以确保状态同步
            if (roomID && user) {
                // 🔥 先检查房间是否存在，避免在已删除的房间上操作
                axios.get(`${SERVER_URL}/api/room/${roomID}`)
                    .then(res => {
                        drawGuessSocket.emit("joinRoom", {
                            roomId: roomID,
                            username: user.username,
                            avatar: user.avatar || DEFAULT_AVATAR,
                            userId: user.id
                        });
                    })
                    .catch(err => {
                        if (err.response?.status === 404) {
                            console.log("Room no longer exists, redirecting to main menu");
                            navigateWithTransition("/game/draw-guess");
                        }
                    });
            }
        };

        const handleDisconnect = () => {
            console.log("❌ Socket disconnected");
        };

        drawGuessSocket.on("connect", handleConnect);
        drawGuessSocket.on("disconnect", handleDisconnect);

        return () => {
            drawGuessSocket.off("connect", handleConnect);
            drawGuessSocket.off("disconnect", handleDisconnect);
        };
    }, [drawGuessSocket, roomID, user]);

    // 🔥 新增：根据游戏状态决定跳转到哪个页面的函数
    const determineAndNavigateToCurrentPhase = (roomData: Room) => {
        const currentRound = roomData.currentRound ?? 0;
        const totalRounds = roomData.totalRounds ?? 0;
        const roundState = roomData.roundState;

        if (currentRound > totalRounds) {
            // 游戏结束
            navigateWithTransition(`/game/draw-guess/final-result/${roomID}`);
        } else if (roundState === "wordSelection" || !roomData.currentWord) {
            // 选词阶段
            navigateWithTransition(`/game/draw-guess/word-selection/${roomID}`);
        } else if (roundState === "drawing" || roomData.currentWord) {
            // 绘画阶段
            navigateWithTransition(`/game/draw-guess/draw-guess-main/${roomID}`);
        } else {
            // 默认跳转到选词阶段
            navigateWithTransition(`/game/draw-guess/word-selection/${roomID}`);
        }
    };

    if (!user || !room) return (
        <div className="lobby-page loading">
            <div className="lobby-loading-message">Loading...</div>
        </div>
    );

    const isHost = user.id === room.host.id;
    const canStartGame = room.playerList.length >= 2;

    const handleStartGame = () => {
        if (!canStartGame) return;

        console.log("🎮 Starting game...");
        drawGuessSocket?.emit("startGame", {
            roomId: room.roomID,
            theme: room.theme
        });

        // 🔥 新增：客户端也设置一个超时，如果5秒内没有跳转，尝试重新触发
        setTimeout(() => {
            // 检查是否还在lobby页面
            if (window.location.pathname.includes('/lobby/')) {
                console.log("🔄 Start game timeout, checking room status...");
                axios
                    .get(`${SERVER_URL}/api/room/${roomID}`)
                    .then(res => {
                        const roomData: Room = res.data;
                        if ((roomData.currentRound ?? 0) > 0) {
                            console.log("🔄 Game has started, forcing navigation...");
                            navigateWithTransition(`/game/draw-guess/word-selection/${roomID}`);
                        }
                    })
                    .catch(console.error);
            }
        }, 5000);
    };

    const handleLeaveRoom = async () => {
        if (!room || !user) return;

        console.log(`🚪 Leaving room ${room.roomID} as user ${user.username}`);

        try {
            // 🔥 修复：先发送离开请求，再跳转
            // 1. 发送 socket 离开事件
            drawGuessSocket?.emit("leaveRoom", {
                roomId: room.roomID,
                userId: user.id
            });

            // 2. 发送 API 离开请求
            await axios.post(`${SERVER_URL}/api/room/leave/${room.roomID}`, {
                userId: user.id
            });

            console.log("✅ Successfully left room");

        } catch (err: any) {
            // 🔥 修复：即使请求失败也继续跳转，但记录错误
            console.log("Leave request completed (room may already be deleted)");
        } finally {
            // 3. 最后跳转页面
            navigateWithTransition("/game/draw-guess");
        }
    };

    const copyRoomID = async () => {
        if (!room) return;
        try {
            await navigator.clipboard.writeText(room.roomID);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            const textArea = document.createElement('textarea');
            textArea.value = room.roomID;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 4000);
        }
    };

    // 检测是否有新玩家正在加入（仅对host）
    const hasNewPlayersJoining = isHost && displayRoom && room &&
        displayRoom.playerList.length < room.playerList.length;

    return (
        <div className="lobby-page">
            <ScrollingBackground />

            <div className="lobby-container">
                <div className="lobby-header">
                    <h1 className="lobby-title">等待大厅 · Lobby</h1>
                    <div className="lobby-info">
                        <div className="lobby-info-item">
                            <span>🏠 Room ID: {room.roomID}</span>
                            <button
                                className={`lobby-copy-button ${copySuccess ? 'lobby-copy-success' : ''}`}
                                onClick={copyRoomID}
                            >
                                {copySuccess ? '✅ Copied' : '📋 Copy'}
                            </button>
                        </div>
                        <div className="lobby-info-item">
                            <span>Theme: {room.theme}</span>
                        </div>
                        <div className="lobby-info-item">
                            <span>Player: {room.playerList.length} / {room.maxPlayers}</span>
                        </div>
                    </div>
                </div>

                <div className="lobby-players">
                    <h2 className="lobby-players-title">玩家列表 · Player List</h2>
                    <div className="lobby-player-list">
                        {/* 显示玩家列表 */}
                        {(displayRoom?.playerList || room.playerList).map((p: Player, index: number) => (
                            <div key={`${p.id}-${index}`} className="lobby-player-item">
                                <img src={p.avatar || DEFAULT_AVATAR} alt="avatar" className="lobby-player-avatar" />
                                <span className="lobby-player-name">
                                    {p.username}
                                    {p.id === room.host.id ? " [Host]" : ""}
                                    {p.id === user?.id ? " (You)" : ""}
                                </span>
                            </div>
                        ))}

                        {/* 显示新玩家加入提示（仅host端） */}
                        {hasNewPlayersJoining && (
                            <div className="lobby-player-item lobby-player-joining">
                                <div className="lobby-player-avatar lobby-loading-avatar">
                                    <div className="loading-spinner"></div>
                                </div>
                                <span className="lobby-player-name">
                                    New player joining...
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <p className="lobby-waiting-message">
                    {room.playerList.length < 2
                        ? 'Waiting for more players to join...'
                        : 'Getting ready to start the game...'
                    }
                    {hasNewPlayersJoining && (
                        <span className="lobby-delay-notice">
                            <br />New players are joining, please wait...
                        </span>
                    )}
                </p>

                <div className="lobby-actions">
                    {isHost && (
                        <button
                            className={`lobby-button lobby-start-button ${!canStartGame ? "lobby-button-disabled" : ""}`}
                            disabled={!canStartGame}
                            onClick={handleStartGame}
                        >
                            {!canStartGame
                                ? `Need More Players (${room.playerList.length}/2)`
                                : 'Start Game ▶️'
                            }
                        </button>
                    )}
                    <button
                        className="lobby-button lobby-leave-button"
                        onClick={handleLeaveRoom}
                    >
                        Leave Room 🚪
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Lobby;