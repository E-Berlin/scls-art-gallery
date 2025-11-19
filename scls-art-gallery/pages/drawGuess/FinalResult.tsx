// pages/drawGuess/FinalResult.tsx
import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { usePageTransition } from "../../context/PageTransitionContext";
import { useSocket } from "../../context/SocketContext";
import { SERVER_URL, SUPABASE_URL } from "../../src/config";
import { ScrollingBackground } from "../../components/ScrollingBackground";
import { useUser } from "../../context/UserContext";
import axios from "axios";
import "./FinalResult.css";

interface Player {
    id: string;
    username: string;
    avatar: string;
    score: number;
}

interface FinalResultData {
    scores: Player[];
    totalRounds: number;
    winner: Player;
    difficultyMultiplier?: number;
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

const FinalResult: React.FC = () => {
    const { roomID } = useParams<{ roomID: string }>();
    const { drawGuessSocket } = useSocket();
    const { navigateWithTransition } = usePageTransition();
    const { user } = useUser();
    const [finalResult, setFinalResult] = useState<FinalResultData | null>(null);
    const [hasUpdatedScore, setHasUpdatedScore] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false); // 🔥 新增：处理状态锁

    // 🔥 新增：使用 useRef 来确保最新的状态
    const hasUpdatedScoreRef = useRef(false);
    const processedRoomsRef = useRef<Set<string>>(new Set());

    const DEFAULT_AVATAR = `${SUPABASE_URL}/storage/v1/object/public/default-imgs/default-avatar.jpg`;

    useEffect(() => {
        if (!drawGuessSocket || !roomID || !user) return;

        // 监听连接事件
        const handleConnect = () => {
            console.log("✅ Socket connected/reconnected in FinalResult");
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
            console.log("❌ Socket disconnected in FinalResult");
        };

        const handleGameFinished = (data: any) => {
            console.log("Game finished with data:", data);
            setFinalResult({
                scores: data.finalScores,
                totalRounds: data.totalRounds,
                winner: data.winner,
                difficultyMultiplier: data.difficultyMultiplier
            });
        };

        const fetchFinalResult = async () => {
            try {
                const res = await fetch(`${SERVER_URL}/api/room/${roomID}`);
                if (res.ok) {
                    const roomData = await res.json();

                    // 🔥 修复：检查玩家是否在房间中，如果不在但游戏已结束，尝试重新加入
                    const isPlayerInRoom = roomData.playerList.some((p: Player) => p.id === user.id);
                    const isGameFinished = (roomData.currentRound ?? 0) > (roomData.totalRounds ?? 0);

                    if (!isPlayerInRoom && isGameFinished) {
                        console.log("🔄 Player not in room but game finished, attempting to rejoin...");

                        const rejoinSuccess = await attemptRejoinRoom(roomID, user, drawGuessSocket);
                        if (!rejoinSuccess) {
                            alert("Failed to rejoin the game! Redirecting to main menu.");
                            navigateWithTransition("/game/draw-guess");
                            return;
                        }

                        // 重新获取数据但不处理分数（因为重新加入后房间状态可能已变化）
                        const newRes = await fetch(`${SERVER_URL}/api/room/${roomID}`);

                        if (newRes.ok) {
                            const newRoomData = await newRes.json();
                            // 🔥 修改：只设置结果，不处理分数
                            const winner = newRoomData.playerList.reduce((prev: Player, current: Player) =>
                                (prev.score > current.score) ? prev : current
                            );
                            setFinalResult({
                                scores: newRoomData.playerList,
                                totalRounds: newRoomData.totalRounds,
                                winner: winner,
                                difficultyMultiplier: newRoomData.difficultyMultiplier
                            });
                        }
                        return;
                    }

                    // 🔥 修改：只在初始加载时处理分数
                    if (!hasUpdatedScoreRef.current) {
                        await processRoomData(roomData, 'initial-load');
                    } else {
                        // 如果分数已更新，只设置结果
                        const winner = roomData.playerList.reduce((prev: Player, current: Player) =>
                            (prev.score > current.score) ? prev : current
                        );
                        setFinalResult({
                            scores: roomData.playerList,
                            totalRounds: roomData.totalRounds,
                            winner: winner,
                            difficultyMultiplier: roomData.difficultyMultiplier
                        });
                    }
                }
            } catch (err) {
                console.error("Failed to load final result from server:", err);
                navigateWithTransition("/game/draw-guess");
            }
        };

        const processRoomData = async (roomData: any, source: string) => {
            // 🔥 新增：防止重复处理同一个房间
            const roomKey = `${roomID}-${roomData.currentRound}-${roomData.totalRounds}`;
            if (processedRoomsRef.current.has(roomKey)) {
                console.log(`🔄 Room ${roomKey} already processed, skipping`);
                return;
            }

            processedRoomsRef.current.add(roomKey);

            if (isProcessing) {
                console.log('🔄 Already processing room data, skipping');
                return;
            }

            setIsProcessing(true);

            try {
                if (roomData.playerList && roomData.playerList.length > 0) {
                    const winner = roomData.playerList.reduce((prev: Player, current: Player) =>
                        (prev.score > current.score) ? prev : current
                    );

                    const finalResultData = {
                        scores: roomData.playerList,
                        totalRounds: roomData.totalRounds,
                        winner: winner,
                        difficultyMultiplier: roomData.difficultyMultiplier
                    };

                    setFinalResult(finalResultData);

                    // 🔥 修复：更严格的防重复检查
                    if (!hasUpdatedScoreRef.current && user) {
                        try {
                            const currentPlayer = roomData.playerList.find((p: Player) => p.id === user.id);
                            if (currentPlayer && currentPlayer.score > 0) {
                                console.log(`🎯 Updating score for ${user.username}: ${currentPlayer.score} points (Source: ${source})`);

                                // 🔥 新增：使用游戏会话ID防止重复
                                const response = await axios.post(`${SERVER_URL}/api/user/update-score`, {
                                    userId: user.id,
                                    scoreToAdd: currentPlayer.score,
                                    gameSessionId: roomID // 使用房间ID作为游戏会话ID
                                });

                                if (response.data.success) {
                                    console.log(`✅ Successfully updated total score: +${currentPlayer.score} (Total: ${response.data.newScore})`);
                                    hasUpdatedScoreRef.current = true;
                                    setHasUpdatedScore(true);
                                } else if (response.data.alreadyUpdated) {
                                    console.log('ℹ️ Score already updated for this game session');
                                    hasUpdatedScoreRef.current = true;
                                    setHasUpdatedScore(true);
                                } else {
                                    console.error('❌ Failed to update score:', response.data.error);
                                }
                            } else {
                                console.log('ℹ️ No score to update or player not found');
                            }
                        } catch (error: any) {
                            console.error('❌ Failed to update user score:', error.response?.data || error.message);
                        }
                    } else {
                        console.log('ℹ️ Score already updated or no user');
                    }
                }
            } finally {
                setIsProcessing(false);
            }
        };

        drawGuessSocket.on("connect", handleConnect);
        drawGuessSocket.on("disconnect", handleDisconnect);
        drawGuessSocket.on("gameFinished", handleGameFinished);

        // 🔥 修改：只在组件挂载时获取一次结果
        fetchFinalResult();

        return () => {
            drawGuessSocket.off("connect", handleConnect);
            drawGuessSocket.off("disconnect", handleDisconnect);
            drawGuessSocket.off("gameFinished", handleGameFinished);
        };
    }, [drawGuessSocket, roomID, user, navigateWithTransition]);

    const handleBackToMenu = () => {
        navigateWithTransition("/game/draw-guess");
    };

    if (!finalResult) {
        return (
            <div className="final-result-page loading">
                <div className="final-result-loading-message">Loading final results...</div>
            </div>
        );
    }

    const { scores, totalRounds, winner } = finalResult;
    const sortedScores = [...scores].sort((a, b) => b.score - a.score);

    return (
        <div className="final-result-page">
            {/* 背景漂浮图标 */}
            <ScrollingBackground />

            <div className="final-result-container">
                <h1 className="final-result-title">🏆 Game Over · Final Scoreboard</h1>

                <div className="final-result-divider"></div>

                <div className="final-result-scoreboard">
                    <div className="final-result-score-list">
                        {sortedScores.map((player, index) => (
                            <div key={player.id} className={`final-result-score-item ${index < 3 ? 'final-result-podium' : ''}`}>
                                <span className="final-result-rank">
                                    {index === 0 ? '🥇' :
                                        index === 1 ? '🥈' :
                                            index === 2 ? '🥉' : `${index + 1}`}
                                </span>
                                <span className="final-result-player-name">{player.username}</span>
                                <span className="final-result-player-score">{player.score} points</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="final-result-divider"></div>

                <div className="final-result-mvp">
                    <p>🎉 Congratulations! {winner.username} has won the MVP!</p>
                    <p className="final-result-total-rounds">A total of {totalRounds} rounds were played.</p>
                    {finalResult.difficultyMultiplier !== undefined && (
                        <p className="final-result-difficulty">
                            🚀 Average Difficulty Bonus: x{finalResult.difficultyMultiplier.toFixed(1)}
                        </p>
                    )}
                </div>

                <div className="final-result-divider"></div>

                <div className="final-result-actions">
                    <button className="final-result-back-button" onClick={handleBackToMenu}>
                        Return to Main Menu 🏠
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FinalResult;