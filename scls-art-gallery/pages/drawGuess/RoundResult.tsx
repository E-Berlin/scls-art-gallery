// pages/drawGuess/RoundResult.tsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { usePageTransition } from "../../context/PageTransitionContext";
import { useSocket } from "../../context/SocketContext";
import { SERVER_URL, SUPABASE_URL } from "../../config/config";
import { ScrollingBackground } from "../../components/ScrollingBackground";
import { useUser } from "../../context/UserContext";
import axios from "axios";
import "./RoundResult.css";

interface Player {
    id: string;
    username: string;
    avatar: string;
    score: number;
}

interface ResultData {
    correctWord: string;
    correctCount: number;
    artistScore: number;
    scores: Player[];
    currentRound: number;
    totalRounds: number;
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

const RoundResult: React.FC = () => {
    const { roomID } = useParams<{ roomID: string }>();
    const { drawGuessSocket } = useSocket();
    const { navigateWithTransition } = usePageTransition();
    const { user } = useUser();
    const [countdown, setCountdown] = useState(5);
    const [result, setResult] = useState<ResultData | null>(null);

    const DEFAULT_AVATAR = `${SUPABASE_URL}/storage/v1/object/public/default-imgs/default-avatar.jpg`;

    useEffect(() => {
        if (!drawGuessSocket) return;

        // 监听连接事件
        const handleConnect = () => {
            console.log("✅ Socket connected/reconnected in RoundResult");
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
            console.log("❌ Socket disconnected in RoundResult");
        };

        drawGuessSocket.on("connect", handleConnect);
        drawGuessSocket.on("disconnect", handleDisconnect);

        return () => {
            drawGuessSocket.off("connect", handleConnect);
            drawGuessSocket.off("disconnect", handleDisconnect);
        };
    }, [drawGuessSocket, roomID, user]);

    useEffect(() => {
        if (!drawGuessSocket || !roomID || !user) return;

        const fetchCurrentResult = async () => {
            try {
                const res = await fetch(`${SERVER_URL}/api/room/${roomID}`);
                if (res.ok) {
                    const roomData = await res.json();

                    // 🔥 修复：检查玩家是否在房间中，如果不在但游戏已开始，尝试重新加入
                    const isPlayerInRoom = roomData.playerList.some((p: Player) => p.id === user.id);
                    const isGameStarted = (roomData.currentRound ?? 0) > 0;

                    if (!isPlayerInRoom && isGameStarted) {
                        console.log("🔄 Player not in room but game in result phase, attempting to rejoin...");

                        const rejoinSuccess = await attemptRejoinRoom(roomID, user, drawGuessSocket);
                        if (!rejoinSuccess) {
                            alert("Failed to rejoin the game! Redirecting to main menu.");
                            navigateWithTransition("/game/draw-guess");
                            return;
                        }

                        // 重新获取数据
                        const newRes = await fetch(`${SERVER_URL}/api/room/${roomID}`);
                        if (newRes.ok) {
                            const newRoomData = await newRes.json();
                            processRoomData(newRoomData);
                        }
                        return;
                    }

                    processRoomData(roomData);
                }
            } catch (err) {
                console.error("Failed to fetch room data:", err);
            }
        };

        const processRoomData = (roomData: any) => {
            // 原有的处理房间数据的逻辑
            if (roomData.currentWord && roomData.playerList) {
                const correctGuesses = roomData.guesses ? roomData.guesses.filter((g: any) => g.isCorrect) : [];
                const correctCount = correctGuesses.length;

                const artist = roomData.playerList.find((p: Player) => p.id === roomData.currentArtist);
                let artistScore = 0;
                if (artist) {
                    if (correctCount === 0) artistScore = 0;
                    else if (correctCount === 1) artistScore = 8;
                    else if (correctCount === 2) artistScore = 16;
                    else if (correctCount === 3) artistScore = 24;
                    else artistScore = correctCount * 8;
                }

                setResult({
                    correctWord: roomData.currentWord,
                    correctCount,
                    artistScore,
                    scores: roomData.playerList,
                    currentRound: roomData.currentRound,
                    totalRounds: roomData.totalRounds,
                    difficultyMultiplier: roomData.difficultyMultiplier
                });
            }
        };

        fetchCurrentResult();

        const handleRoundEnded = (data: ResultData) => {
            console.log("Received roundEnded event:", data);
            setResult(data);
        };

        const handleNextRound = () => {
            navigateWithTransition(`/game/draw-guess/word-selection/${roomID}`);
        };

        drawGuessSocket.on("roundEnded", handleRoundEnded);
        drawGuessSocket.on("nextRound", handleNextRound);

        return () => {
            drawGuessSocket.off("roundEnded", handleRoundEnded);
            drawGuessSocket.off("nextRound", handleNextRound);
        };
    }, [drawGuessSocket, roomID, navigateWithTransition, user]);

    useEffect(() => {
        if (countdown <= 0 && result) {
            drawGuessSocket?.emit("nextRound", { roomId: roomID });
            return;
        }

        const timer = setInterval(() => {
            setCountdown(prev => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [countdown, result, drawGuessSocket, roomID]);

    if (!result) {
        return (
            <div className="round-result-page loading">
                <div className="round-result-loading-message">Loading results...</div>
            </div>
        );
    }

    const { correctWord, correctCount, scores, currentRound, totalRounds } = result;
    const sortedScores = [...scores].sort((a, b) => b.score - a.score);

    return (
        <div className="round-result-page">
            {/* 背景漂浮图标 */}
            <ScrollingBackground />

            <div className="round-result-container">
                <h1 className="round-result-title">🎉 Round {currentRound} Results</h1>

                <div className="round-result-divider"></div>

                <div className="round-result-correct-answer">
                    🎯 The correct answer is: {correctWord}
                </div>

                <div className="round-result-divider"></div>

                <div className="round-result-scoreboard">
                    <h2 className="round-result-scoreboard-title">🏆 Current Overall Leaderboard:</h2>
                    <div className="round-result-score-list">
                        {sortedScores.map((player, index) => (
                            <div key={player.id} className={`round-result-score-item ${index < 3 ? 'round-result-podium' : ''}`}>
                                <span className="round-result-rank">
                                    {index === 0 ? '🥇' :
                                        index === 1 ? '🥈' :
                                            index === 2 ? '🥉' : `${index + 1}`}
                                </span>
                                <span className="round-result-player-name">{player.username}</span>
                                <span className="round-result-player-score">{player.score} points</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="round-result-stats">
                    <p>✅ Number of correct guesses: {correctCount} people</p>
                    {result.difficultyMultiplier !== undefined && (
                        <p>🚀 Difficulty Bonus: x{result.difficultyMultiplier.toFixed(1)}</p>
                    )}
                </div>

                <div className="round-result-divider"></div>

                <div className="round-result-next-round">
                    <p>Next round starting in <span className="round-result-countdown">{countdown}</span> seconds...</p>
                    <p className="round-result-progress">(Round {currentRound}/{totalRounds})</p>
                </div>
            </div>
        </div>
    );
};

export default RoundResult;