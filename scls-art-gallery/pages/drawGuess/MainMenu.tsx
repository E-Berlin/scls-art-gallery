// pages/drawGuess/MainMenu.tsx
import React, { useState } from "react";
import { usePageTransition } from "../../context/PageTransitionContext";
import { useSocket } from "../../context/SocketContext";
import { useUser } from "../../context/UserContext";
import { SERVER_URL, SUPABASE_URL } from "../../src/config";
import { ScrollingBackground } from "../../components/ScrollingBackground";
import axios from "axios";
import "./MainMenu.css";

// 🔥 新增：定义 Player 接口
interface Player {
    id: string;
    username: string;
    avatar: string;
    score: number;
}

const MainMenu = () => {
    const { navigateWithTransition } = usePageTransition();
    const { drawGuessSocket } = useSocket();
    const { user } = useUser();
    const [roomID, setRoomID] = useState("");
    const [loading, setLoading] = useState(false);

    const DEFAULT_AVATAR = `${SUPABASE_URL}/storage/v1/object/public/default-imgs/default-avatar.jpg`;

    const handleQuickMatch = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${SERVER_URL}/api/room/quick-match`);
            const room = res.data;

            if (!room || !room.roomID) {
                alert("No random match rooms available. Please try again later!");
                return;
            }

            await axios.post(`${SERVER_URL}/api/room/join/${room.roomID}`, {
                id: user?.id,
                username: user?.username,
                avatar: user?.avatar || DEFAULT_AVATAR
            });

            drawGuessSocket?.emit("joinRoom", {
                roomId: room.roomID,
                username: user?.username,
                avatar: user?.avatar,
                userId: user?.id
            });
            navigateWithTransition(`/game/draw-guess/lobby/${room.roomID}`);
        } catch (err: any) {
            // 🔥 修复：快速匹配时统一显示没有可用房间的提示
            alert("No random match rooms available. Please try again later!");
        } finally {
            setLoading(false);
        }
    };

    const handleJoinRoom = async () => {
        if (!roomID.trim()) return alert("Please enter the room ID!");
        setLoading(true);
        try {
            // 先检查房间状态
            const roomRes = await axios.get(`${SERVER_URL}/api/room/${roomID}`);
            const roomData = roomRes.data;

            // 如果游戏已经开始，不允许加入
            if (roomData.currentRound && roomData.currentRound > 0) {
                alert("Game has already started! You cannot join mid-game.");
                setLoading(false);
                return;
            }

            // 🔥 修复：添加类型注解
            const isPlayerInRoom = roomData.playerList.some((player: Player) => player.id === user?.id);
            if (!isPlayerInRoom && roomData.playerList.length >= roomData.maxPlayers) {
                alert("Room is full!");
                setLoading(false);
                return;
            }

            await axios.post(`${SERVER_URL}/api/room/join/${roomID}`, {
                id: user?.id,
                username: user?.username,
                avatar: user?.avatar || DEFAULT_AVATAR
            });

            drawGuessSocket?.emit("joinRoom", {
                roomId: roomID,
                username: user?.username,
                avatar: user?.avatar,
                userId: user?.id
            });
            navigateWithTransition(`/game/draw-guess/lobby/${roomID}`);
        } catch (err: any) {
            // 🔥 优化错误处理：根据不同的错误类型显示不同的提示
            if (err.response?.status === 404) {
                alert("Room not found! Please check the room ID.");
            } else if (err.response?.status === 400) {
                const errorMsg = err.response?.data?.error;
                if (errorMsg?.includes("already started")) {
                    alert("Game has already started! You cannot join mid-game.");
                } else if (errorMsg?.includes("full")) {
                    alert("Room is full!");
                } else {
                    alert(errorMsg || "Failed to join the room!");
                }
            } else {
                alert("Failed to join the room! Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="main-menu-page">
            {/* 背景漂浮图标 */}
            <ScrollingBackground />

            <div className="main-menu-container">
                <h1 className="main-menu-title">🎨 你画我猜 · Draw & Guess</h1>

                <div className="main-menu-buttons">
                    {/* 快速匹配和创建房间按钮左右排放 */}
                    <div className="main-menu-top-buttons">
                        <button
                            className="main-menu-button main-menu-primary-button"
                            onClick={handleQuickMatch}
                            disabled={loading}
                            title="Quick Match Game"
                            aria-label={loading ? "Searching for available rooms..." : "Quick Match Game"}
                        >
                            ⚡ Quick Match
                        </button>

                        <button
                            className="main-menu-button main-menu-primary-button"
                            onClick={() => navigateWithTransition("/game/draw-guess/create-room")}
                            title="Create New Room"
                            aria-label="Create New Room"
                        >
                            ⚙️ Create Room
                        </button>
                    </div>

                    {/* 加入房间部分 */}
                    <div className="main-menu-join-section">
                        <input
                            type="text"
                            placeholder="Enter Room ID"
                            value={roomID}
                            onChange={(e) => setRoomID(e.target.value)}
                            className="main-menu-room-input"
                            aria-label="Enter Room ID"
                        />
                        <button
                            className="main-menu-button main-menu-primary-button"
                            onClick={handleJoinRoom}
                            disabled={loading}
                            title="Join the game using the room ID."
                            aria-label={loading ? "Joining the room..." : "Join the game using the room ID."}
                        >
                            🔑 Join Room
                        </button>
                    </div>

                    {/* 排行榜按钮 */}
                    <div className="main-menu-leaderboard-section">
                        <button
                            className="main-menu-button main-menu-secondary-button"
                            onClick={() => navigateWithTransition("/game/draw-guess/leader-board")}
                            title="View Leaderboard"
                            aria-label="View Leaderboard"
                        >
                            📊 View Leaderboard
                        </button>
                    </div>
                </div>

                <div className="main-menu-rules">
                    <p>📜 游戏玩法 · Gameplay:</p>
                    <ol className="main-menu-rules-list">
                        <li>One player becomes the artist while others try to guess the word.</li>
                        <li>Each round lasts 60 seconds, including 10 seconds for refinement and final guessing.</li>
                        <li>Faster guesses earn higher points.</li>
                        <li>The artist's score is based on how many players guess correctly and the word's difficulty multiplier.</li>
                        <li>Word categories such as Daily Life, TOEFL, STEAM, Custom, and Mysterious have different difficulty multipliers that affect scoring.</li>
                        <li>The number of rounds equals the number of participating players.</li>
                    </ol>
                </div>
            </div>
        </div>
    );
};

export default MainMenu;