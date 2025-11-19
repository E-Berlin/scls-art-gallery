// pages/drawGuess/Leaderboard.tsx
import React, { useEffect, useState } from "react";
import { usePageTransition } from "../../context/PageTransitionContext";
import { useUser } from "../../context/UserContext";
import { SERVER_URL } from "../../config/config";
import { ScrollingBackground } from "../../components/ScrollingBackground";
import "./Leaderboard.css";

interface LeaderboardUser {
    id: string;
    username: string;
    avatar: string;
    score: number;
    rank: number;
}

const Leaderboard: React.FC = () => {
    const { navigateWithTransition } = usePageTransition();
    const { user } = useUser();
    const [leaderboardData, setLeaderboardData] = useState<LeaderboardUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<'all-time' | 'weekly' | 'monthly'>('all-time');

    useEffect(() => {
        fetchLeaderboard();
    }, [timeRange]);

    const fetchLeaderboard = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${SERVER_URL}/api/leaderboard?range=${timeRange}`);
            const data = await response.json();

            if (response.ok) {
                // 添加排名
                const rankedData = data.leaderboard.map((user: LeaderboardUser, index: number) => ({
                    ...user,
                    rank: index + 1
                }));
                setLeaderboardData(rankedData);
            } else {
                console.error("Failed to fetch leaderboard:", data.error);
            }
        } catch (error) {
            console.error("Error fetching leaderboard:", error);
        } finally {
            setLoading(false);
        }
    };

    const getRankIcon = (rank: number) => {
        switch (rank) {
            case 1: return '🥇';
            case 2: return '🥈';
            case 3: return '🥉';
            default: return `#${rank}`;
        }
    };

    const getTimeRangeText = () => {
        switch (timeRange) {
            case 'all-time': return 'All Time';
            case 'weekly': return 'This Week';
            case 'monthly': return 'This Month';
            default: return 'All Time';
        }
    };

    const handleBackToMenu = () => {
        navigateWithTransition("/game/draw-guess");
    };

    return (
        <div className="leaderboard-page">
            {/* 背景漂浮图标 */}
            <ScrollingBackground />

            <div className="leaderboard-container">
                <h1 className="leaderboard-title">🏆 Leaderboard</h1>
                <p className="leaderboard-subtitle">Top Players - {getTimeRangeText()}</p>

                {/* 时间范围选择器
                <div className="time-range-selector">
                    <button
                        className={`time-range-btn ${timeRange === 'all-time' ? 'active' : ''}`}
                        onClick={() => setTimeRange('all-time')}
                    >
                        All Time
                    </button>
                    <button
                        className={`time-range-btn ${timeRange === 'weekly' ? 'active' : ''}`}
                        onClick={() => setTimeRange('weekly')}
                    >
                        Weekly
                    </button>
                    <button
                        className={`time-range-btn ${timeRange === 'monthly' ? 'active' : ''}`}
                        onClick={() => setTimeRange('monthly')}
                    >
                        Monthly
                    </button>
                </div>
                */}

                <div className="leaderboard-divider"></div>

                {loading ? (
                    <div className="leaderboard-loading">
                        <div className="loading-spinner"></div>
                        <p>Loading leaderboard...</p>
                    </div>
                ) : (
                    <div className="leaderboard-list">
                        {leaderboardData.length === 0 ? (
                            <div className="no-data-message">
                                <p>No data available yet.</p>
                                <p>Play some games to appear on the leaderboard!</p>
                            </div>
                        ) : (
                            leaderboardData.map((player) => (
                                <div
                                    key={player.id}
                                    className={`leaderboard-item ${player.id === user?.id ? 'current-user' : ''} ${player.rank <= 3 ? 'podium' : ''}`}
                                >
                                    <div className="leaderboard-rank">
                                        <span className="rank-icon">{getRankIcon(player.rank)}</span>
                                    </div>

                                    <div className="leaderboard-user-info">
                                        <img
                                            src={player.avatar}
                                            alt={player.username}
                                            className="user-avatar"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.src = `${SERVER_URL}/storage/v1/object/public/default-imgs/default-avatar.jpg`;
                                            }}
                                        />
                                        <span className="username">{player.username}</span>
                                        {player.id === user?.id && <span className="you-badge">YOU</span>}
                                    </div>

                                    <div className="leaderboard-score">
                                        <span className="score-value">{player.score.toLocaleString()}</span>
                                        <span className="score-label">points</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                <div className="leaderboard-divider"></div>

                <div className="leaderboard-actions">
                    <button className="leaderboard-back-button" onClick={handleBackToMenu}>
                        ← Back to Main Menu
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Leaderboard;