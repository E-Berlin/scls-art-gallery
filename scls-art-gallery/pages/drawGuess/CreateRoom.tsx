// pages/drawGuess/CreateRoom.tsx
import React, { useState, useEffect } from "react";
import { usePageTransition } from "../../context/PageTransitionContext";
import { useSocket } from "../../context/SocketContext";
import { useUser } from "../../context/UserContext";
import { SERVER_URL, SUPABASE_URL } from "../../src/config";
import { ScrollingBackground } from "../../components/ScrollingBackground";
import axios from "axios";
import "./CreateRoom.css";

const themes = ["Random 🎲", "Daily Life 🏠", "TOEFL 📚", "Steam Learn 🎮", "Mysterious 🔮", "Custom ✨"];

// 🔥 新增：主题难度系数映射
const THEME_DIFFICULTY_MULTIPLIERS = {
    "Random 🎲": 1.3,
    "Daily Life 🏠": 1.0,
    "TOEFL 📚": 1.9,
    "Steam Learn 🎮": 1.7,
    "Mysterious 🔮": 1.3,
    "Custom ✨": 1.0
};

const CreateRoom = () => {
    const { navigateWithTransition } = usePageTransition();
    const { drawGuessSocket } = useSocket();
    const { user } = useUser();
    const [selectedTheme, setSelectedTheme] = useState("Random 🎲");
    const [customWords, setCustomWords] = useState<string[]>(["", "", "", "", "", ""]);
    const [maxPlayers, setMaxPlayers] = useState(4);
    const [isPublic, setIsPublic] = useState(true);
    const [loading, setLoading] = useState(false);
    const [sliderProgress, setSliderProgress] = useState("50%");
    const [validationError, setValidationError] = useState("");
    const MIN_CUSTOM_WORDS = 6;

    const DEFAULT_AVATAR = `${SUPABASE_URL}/storage/v1/object/public/default-imgs/default-avatar.jpg`;

    // 🔥 新增：获取当前主题的难度系数
    const getCurrentDifficultyMultiplier = () => {
        return THEME_DIFFICULTY_MULTIPLIERS[selectedTheme as keyof typeof THEME_DIFFICULTY_MULTIPLIERS] || 1.0;
    };

    // 🔥 新增：获取主题的完整描述，包括难度系数
    const getThemeDescription = (theme: string) => {
        const multiplier = THEME_DIFFICULTY_MULTIPLIERS[theme as keyof typeof THEME_DIFFICULTY_MULTIPLIERS] || 1.0;

        const descriptions: { [key: string]: string } = {
            "Random 🎲": "Random selection from all themes",
            "Daily Life 🏠": "Common everyday words and phrases",
            "TOEFL 📚": "Academic vocabulary from TOEFL test",
            "Steam Learn 🎮": "Educational terms from science and gaming",
            "Mysterious 🔮": "Mysterious and challenging words",
            "Custom ✨": "Create your own word list"
        };

        const baseDescription = descriptions[theme] || "Theme description";

        // 只在难度系数不是1.0时显示难度信息
        if (multiplier !== 1.0) {
            return `${baseDescription} (Difficulty Bonus: x${multiplier})`;
        }

        return baseDescription;
    };

    // 计算滑块进度
    useEffect(() => {
        const min = 4;
        const max = 10;
        const progress = ((maxPlayers - min) / (max - min)) * 100;
        setSliderProgress(`${progress}%`);
    }, [maxPlayers]);

    // 实时验证自定义词条
    useEffect(() => {
        if (selectedTheme === "Custom ✨") {
            const validWords = customWords.filter(w => w.trim() !== "");
            if (validWords.length === 0) {
                setValidationError(`Please enter at least ${MIN_CUSTOM_WORDS} custom entries`);
            } else if (validWords.length < MIN_CUSTOM_WORDS) {
                setValidationError(`Need ${MIN_CUSTOM_WORDS - validWords.length} more entries (minimum ${MIN_CUSTOM_WORDS} required)`);
            } else {
                setValidationError("");
            }
        } else {
            setValidationError("");
        }
    }, [customWords, selectedTheme]);

    const handleWordChange = (index: number, value: string) => {
        const newWords = [...customWords];
        newWords[index] = value;
        setCustomWords(newWords);
    };

    const handleAddWord = () => {
        if (customWords.length < 10) {
            setCustomWords([...customWords, ""]);
        }
    };

    const handleRemoveWord = (index: number) => {
        if (customWords.length > 1) {
            const newWords = [...customWords];
            newWords.splice(index, 1);
            setCustomWords(newWords);
        }
    };

    const handleCreateRoom = async () => {
        setLoading(true);
        try {
            let words = selectedTheme === "Custom ✨" ? customWords.filter(w => w.trim() !== "") : undefined;

            // 🔥 增强验证：自定义主题必须至少6个有效词条
            if (selectedTheme === "Custom ✨") {
                if (!words || words.length === 0) {
                    alert(`Please enter at least ${MIN_CUSTOM_WORDS} custom word!`);
                    setLoading(false);
                    return;
                }

                if (words.length < MIN_CUSTOM_WORDS) {
                    alert(`Custom theme requires at least ${MIN_CUSTOM_WORDS} words! Please add more words.`);
                    setLoading(false);
                    return;
                }

                // 限制词条长度
                const invalidWords = words.filter(word => word.length > 20);
                if (invalidWords.length > 0) {
                    alert("Each word cannot exceed 20 characters!");
                    setLoading(false);
                    return;
                }
            }

            const res = await axios.post(`${SERVER_URL}/api/room/create`, {
                theme: selectedTheme,
                maxPlayers,
                host: {
                    id: user?.id,
                    username: user?.username,
                },
                isPublic,
                customWords: words
            });

            const { roomID } = res.data;

            drawGuessSocket?.emit("joinRoom", {
                roomId: roomID,
                username: user?.username,
                avatar: user?.avatar || DEFAULT_AVATAR,
                userId: user?.id
            });

            navigateWithTransition(`/game/draw-guess/lobby/${roomID}`);
        } catch (err: any) {
            // 🔥 新增：处理用户已在其他房间的错误
            if (err.response?.status === 400 && err.response.data?.error?.includes("already in another room")) {
                alert("You are already in another room. Please leave the current room before creating a new one.");
            } else {
                alert("Failed to create room. Please try again!");
            }
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="create-room-page">
            {/* 背景漂浮图标 */}
            <ScrollingBackground />

            <div className="create-room-container">
                <h1 className="create-room-title">🛠️ Create Room</h1>

                {/* 🔥 新增：当前难度系数显示 */}
                <div className="create-room-difficulty-info">
                    <p className="create-room-difficulty-text">
                        Current Difficulty Bonus: <strong>x{getCurrentDifficultyMultiplier().toFixed(1)}</strong>
                    </p>
                    <p className="create-room-difficulty-note">
                        {getCurrentDifficultyMultiplier() !== 1.0
                            ? "🎯 Higher difficulty = More points for correct guesses!"
                            : "🎯 Standard difficulty with balanced scoring"
                        }
                    </p>
                </div>

                {/* 主题选择 - 3x2 网格布局 */}
                <div className="create-room-themes-grid">
                    {themes.map(theme => {
                        const multiplier = THEME_DIFFICULTY_MULTIPLIERS[theme as keyof typeof THEME_DIFFICULTY_MULTIPLIERS] || 1.0;

                        return (
                            <button
                                key={theme}
                                className={`create-room-theme-button ${selectedTheme === theme ? "create-room-theme-active" : ""}`}
                                onClick={() => setSelectedTheme(theme)}
                                title={getThemeDescription(theme)}
                                aria-label={getThemeDescription(theme)}
                            >
                                <span className="create-room-theme-text">{theme}</span>
                                {/* 🔥 新增：难度系数徽章 */}
                                {multiplier !== 1.0 && (
                                    <span className="create-room-difficulty-badge">
                                        x{multiplier}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* 自定义词条区域 */}
                {selectedTheme === "Custom ✨" && (
                    <div className="create-room-custom-words-section">
                        <h3 className="create-room-custom-words-title">
                            Custom Words ({customWords.filter(w => w.trim() !== "").length}/10)
                            {validationError && (
                                <span className="create-room-validation-error">⚠️ {validationError}</span>
                            )}
                        </h3>
                        <div className="create-room-words-scroll-container">
                            <div className="create-room-words-list">
                                {customWords.map((word, idx) => (
                                    <div key={idx} className="create-room-word-item">
                                        <input
                                            value={word}
                                            onChange={(e) => handleWordChange(idx, e.target.value)}
                                            className="create-room-word-input"
                                            placeholder={`Word ${idx + 1}`}
                                            maxLength={20}
                                            aria-label={`Custom Word ${idx + 1}`}
                                        />
                                        {customWords.length > 1 && (
                                            <button
                                                className="create-room-remove-word-button"
                                                onClick={() => handleRemoveWord(idx)}
                                                type="button"
                                                title={`Delete Word ${idx + 1}`}
                                                aria-label={`Delete Word ${idx + 1}`}
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        {customWords.length < 10 && (
                            <button
                                className="create-room-add-word-button"
                                onClick={handleAddWord}
                                type="button"
                                title="Add New Word"
                                aria-label="Add New Word"
                            >
                                + Add Word
                            </button>
                        )}
                        <p className="create-room-minimum-note">
                            ⚠️ Minimum 6 words required for custom theme
                        </p>
                    </div>
                )}

                <div className="create-room-settings">
                    {/* 最大人数设置 */}
                    <div className="create-room-setting">
                        <label htmlFor="create-room-max-players" className="create-room-setting-label">
                            Maximum number of people: {maxPlayers}
                        </label>
                        <input
                            id="create-room-max-players"
                            type="range"
                            min={4}
                            max={10}
                            value={maxPlayers}
                            onChange={(e) => setMaxPlayers(Number(e.target.value))}
                            className="create-room-slider"
                            style={{ "--slider-progress": sliderProgress } as React.CSSProperties}
                            aria-label="Select the maximum number of players"
                            aria-valuemin={4}
                            aria-valuemax={10}
                            aria-valuenow={maxPlayers}
                        />
                    </div>

                    {/* 房间类型开关 - 使用 role="switch" */}
                    <div className="create-room-setting">
                        <label className="create-room-setting-label">Room Type</label>
                        <div className="create-room-toggle-switch">
                            <span className={`create-room-toggle-option ${isPublic ? "create-room-toggle-active" : ""}`}>
                                Public Room
                            </span>
                            <button
                                className="create-room-toggle-slider"
                                onClick={() => setIsPublic(!isPublic)}
                                type="button"
                                role="switch"
                                aria-checked={isPublic}
                                title={isPublic ? "Switch to Private Room" : "Switch to Public Room"}
                                aria-label={`Room Type: ${isPublic ? "Public Room" : "Private Room"}. Click to switch`}
                            >
                                <div className={`create-room-toggle-knob ${isPublic ? "create-room-toggle-public" : "create-room-toggle-private"}`} />
                            </button>
                            <span className={`create-room-toggle-option ${!isPublic ? "create-room-toggle-active" : ""}`}>
                                Private Room
                            </span>
                        </div>
                    </div>
                </div>

                {/* 操作按钮 */}
                <div className="create-room-actions">
                    <button
                        className="create-room-button create-room-primary-button"
                        onClick={handleCreateRoom}
                        disabled={loading || (selectedTheme === "Custom ✨" && validationError !== "")}
                        title={selectedTheme === "Custom ✨" && validationError ? validationError : "Create New Room"}
                        aria-label={loading ? "Creating room..." :
                            (selectedTheme === "Custom ✨" && validationError ? validationError : "Create New Room")}
                    >
                        {loading ? "Creating..." :
                            (selectedTheme === "Custom ✨" && validationError ? "Fix Words First" : "Create Room ✅")}
                    </button>
                    <button
                        className="create-room-button create-room-secondary-button"
                        onClick={() => navigateWithTransition("/game/draw-guess")}
                        type="button"
                        title="Return to Main Menu"
                        aria-label="Return to Main Menu"
                    >
                        Return 🔙
                    </button>
                </div>

                <p className="create-room-note">
                    The room ID will be automatically generated (six alphanumeric characters). After creation, you will enter the waiting lobby.
                </p>
            </div>
        </div>
    );
};

export default CreateRoom;