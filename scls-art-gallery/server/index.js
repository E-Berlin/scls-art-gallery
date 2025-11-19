// server/index.js
const { SERVER_URL, FRONTEND_URL, PORT, ADMIN_KEY, SUPABASE_URL, SUPABASE_KEY } = require('../config/env');
const { sendVerificationEmail } = require("./mailer");
const { createClient } = require('@supabase/supabase-js')
const { Server } = require("socket.io");
const express = require("express");
const multer = require('multer');
const cors = require("cors");
const crypto = require("crypto");
const http = require("http");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e6
});

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// ========== 配置和常量 ==========
const CANVAS_BUCKET = 'canvases';
const DRAWGUESS_BUCKET = 'drawguess-canvases';
const userSocketMap = new Map(); // userId -> socketId
const socketUserMap = new Map(); // socketId -> userId
const CATEGORY_BASE_IDS = { // 分类基础 ID 定义（5位）
    'photography': 10000,
    'art-printmaking': 20000,
    'tranditional-art': 30000,
    'digital-art': 40000,
    'birdwatching-club': 50000,
    'mixed-media': 60000
};
const DIFFICULTY_MULTIPLIERS = {
    'random': 1.3,
    'daily-life': 1.0,
    'toefl': 1.9,
    'steam-learn': 1.7,
    'mysterious': 1.3,
    'custom': 1.0
};

let words = {};
let rooms = {};

// ========== 工具函数 ==========
function normalizeThemeKey(theme) {
    const map = {
        "Random 🎲": "random",
        "Daily Life 🏠": "daily-life",
        "TOEFL 📚": "toefl",
        "Steam Learn 🎮": "steam-learn",
        "Mysterious 🔮": "mysterious",
        "Custom ✨": "custom"
    }
    return map[theme] || "random";
}

function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function getWinner(players) {
    if (!players || players.length === 0) return null;
    return players.reduce((prev, current) =>
        (prev.score > current.score) ? prev : current
    );
}

// ========== 核心功能函数 ==========

// 1. 数据加载函数
const loadWordsFromSupabase = async () => {
    try {
        const { data, error } = await supabase
            .from('words')
            .select('category, word')
            .order('category', { ascending: true });

        if (error) {
            console.error('Error loading words from Supabase:', error);
            return {};
        }

        // 转换为原有的数据结构
        const words = {};
        data.forEach(item => {
            if (!words[item.category]) {
                words[item.category] = [];
            }
            words[item.category].push(item.word);
        });

        console.log(`✅ Loaded words from Supabase: ${Object.keys(words).length} categories`);
        return words;
    } catch (error) {
        console.error('Error in loadWordsFromSupabase:', error);
        return {};
    }
};

const loadRoomsFromSupabase = async () => {
    try {
        const { data, error } = await supabase
            .from('draw_guess_rooms')
            .select('*');

        if (error) {
            console.error('Error loading rooms from Supabase:', error);
            return {};
        }

        // 转换为原有的数据结构
        const rooms = {};
        data.forEach(room => {
            rooms[room.room_id] = {
                roomID: room.room_id,
                host: room.host,
                playerList: room.player_list || [],
                maxPlayers: room.max_players,
                theme: room.theme,
                isPublic: room.is_public,
                customWords: room.custom_words || [],

                // 游戏状态
                currentRound: room.current_round || 0,
                totalRounds: room.total_rounds,
                artistOrder: room.artist_order || [],
                currentArtist: room.current_artist,

                // 回合相关
                wordOptions: room.word_options || [],
                currentWord: room.current_word,
                guesses: room.guesses || [],
                roundTime: room.round_time,
                roundStartTime: room.round_start_time,
                roundState: room.round_state || 'waiting',
                difficultyMultiplier: room.difficulty_multiplier || 1.0
            };
        });

        console.log(`✅ Loaded ${Object.keys(rooms).length} rooms from Supabase`);
        return rooms;
    } catch (error) {
        console.error('Error in loadRoomsFromSupabase:', error);
        return {};
    }
};

// 2. 存储桶初始化
const initializeBucket = async (bucketName) => {
    try {
        // 首先检查存储桶是否已经存在
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();

        if (listError) {
            console.error(`Error listing buckets:`, listError);
            return false;
        }

        const bucketExists = buckets.some(bucket => bucket.name === bucketName);

        if (bucketExists) {
            console.log(`Bucket ${bucketName} already exists`);
            return true;
        }

        // 存储桶不存在，创建它
        const { data, error } = await supabase.storage.createBucket(bucketName, {
            public: true,
            fileSizeLimit: 10485760, // 10MB
        });

        if (error) {
            console.error(`Error creating bucket ${bucketName}:`, error);
            return false;
        }

        console.log(`Bucket ${bucketName} created successfully`);
        return true;
    } catch (error) {
        console.error(`Unexpected error initializing bucket ${bucketName}:`, error);
        return false;
    }
};

// 3. 服务器初始化
const initializeServer = async () => {
    try {
        console.log('🔄 Initializing server...');

        // 并行执行所有初始化任务
        const [bucketResult, loadedWords, loadedRooms] = await Promise.all([
            // 存储桶初始化
            Promise.allSettled([
                initializeBucket(CANVAS_BUCKET),
                initializeBucket(DRAWGUESS_BUCKET)
            ]),
            // 数据加载
            loadWordsFromSupabase(),
            loadRoomsFromSupabase()
        ]);

        Object.assign(words, loadedWords);
        Object.assign(rooms, loadedRooms);

        // 检查存储桶初始化结果
        const bucketSuccess = bucketResult.filter(result => result.status === 'fulfilled').length;
        console.log(`✅ ${bucketSuccess}/2 storage buckets initialized`);

        console.log(`✅ Server initialization completed: ${Object.keys(loadedWords).length} word categories, ${Object.keys(loadedRooms).length} rooms loaded`);
    } catch (error) {
        console.error('❌ Server initialization failed:', error);
        throw error; // 抛出错误让上层处理
    }
};

// 4. 画板功能
const saveCanvasToSupabase = async (bucketName, imageData) => {
    try {
        // 将 base64 图像数据转换为 blob
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        const fileName = 'current-canvas.png';

        // 上传到 Supabase Storage
        const { data, error } = await supabase.storage
            .from(bucketName)
            .upload(fileName, buffer, {
                contentType: 'image/png',
                upsert: true
            });

        if (error) {
            console.error(`Error saving canvas to ${bucketName}:`, error);
            return false;
        }

        //console.log(`Canvas saved to ${bucketName}`);
        return true;
    } catch (error) {
        console.error(`Error in saveCanvasToSupabase for ${bucketName}:`, error);
        return false;
    }
};

const loadCanvasFromSupabase = async (bucketName) => {
    try {
        const fileName = 'current-canvas.png';

        // 获取公共 URL
        const { data } = supabase.storage
            .from(bucketName)
            .getPublicUrl(fileName);

        if (data.publicUrl) {
            // 返回图像 URL
            return { image: data.publicUrl + `?t=${Date.now()}` }; // 添加时间戳避免缓存
        }

        return { image: null };
    } catch (error) {
        console.error(`Error loading canvas from ${bucketName}:`, error);
        return { image: null };
    }
};

// ========== Multer配置 ==========
const upload = multer({ // 配置 multer 用于头像文件上传
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    }
});

const artworkUpload = multer({ // 配置 multer 用于artwork文件上传
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    }
});

// 保存单个房间
const saveRoomToSupabase = async (room) => {
    try {
        const roomData = {
            room_id: room.roomID,
            host: room.host,
            player_list: room.playerList,
            max_players: room.maxPlayers,
            theme: room.theme,
            is_public: room.isPublic,
            custom_words: room.customWords || [],

            current_round: room.currentRound || 0,
            total_rounds: room.totalRounds,
            artist_order: room.artistOrder || [],
            current_artist: room.currentArtist,

            word_options: room.wordOptions || [],
            current_word: room.currentWord,
            guesses: room.guesses || [],
            round_time: room.roundTime,
            round_start_time: room.roundStartTime,
            round_state: room.roundState || 'waiting',
            difficulty_multiplier: room.difficultyMultiplier || 1.0,

            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('draw_guess_rooms')
            .upsert(roomData, {
                onConflict: 'room_id',
                ignoreDuplicates: false
            });

        if (error) {
            console.error('Error saving room to Supabase:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error in saveRoomToSupabase:', error);
        return false;
    }
};

// 删除房间
const deleteRoomFromSupabase = async (roomId) => {
    try {
        const { error } = await supabase
            .from('draw_guess_rooms')
            .delete()
            .eq('room_id', roomId);

        if (error) {
            console.error('Error deleting room from Supabase:', error);
            return false;
        }

        console.log(`✅ Deleted room ${roomId} from Supabase`);
        return true;
    } catch (error) {
        console.error('Error in deleteRoomFromSupabase:', error);
        return false;
    }
};

// 读取所有房间
const loadRooms = async () => {
    return await loadRoomsFromSupabase();
};

// 保存所有房间
const saveRooms = async (rooms) => {
    // 批量保存所有房间
    const savePromises = Object.values(rooms).map(room =>
        saveRoomToSupabase(room)
    );

    const results = await Promise.all(savePromises);
    return results.every(result => result === true);
};

// 保存单个房间的辅助函数
const saveSingleRoom = async (room) => {
    return await saveRoomToSupabase(room);
};

// 🔥 修改：统一的阶段倒计时管理器
const roomTimers = new Map();

async function startWordSelection({ roomId, theme }) {
    const currentRooms = await loadRooms();
    const room = currentRooms[roomId];
    if (!room) return;

    // 清除之前的定时器
    if (roomTimers.has(roomId)) {
        clearTimeout(roomTimers.get(roomId));
        roomTimers.delete(roomId);
    }

    const themeKey = normalizeThemeKey(theme);
    let wordOptions = [];

    // 处理自定义主题
    if (themeKey === "custom" && room.customWords && room.customWords.length > 0) {
        const availableWords = [...room.customWords];
        while (wordOptions.length < 6) {
            const randomWord = availableWords[Math.floor(Math.random() * availableWords.length)];
            if (!wordOptions.includes(randomWord)) {
                wordOptions.push(randomWord);
            }
            if (availableWords.length === 0) break;
        }
    }
    // 处理随机主题：从其他4个词库随机取词
    else if (themeKey === "random") {
        const availableThemes = ["daily-life", "toefl", "steam-learn", "mysterious"];
        const allWords = [];

        // 从每个主题词库中收集单词
        availableThemes.forEach(t => {
            if (words[t] && Array.isArray(words[t])) {
                allWords.push(...words[t]);
            }
        });

        // 随机选择6个不重复的单词
        while (wordOptions.length < 6 && allWords.length > 0) {
            const randomIndex = Math.floor(Math.random() * allWords.length);
            const randomWord = allWords[randomIndex];
            if (!wordOptions.includes(randomWord)) {
                wordOptions.push(randomWord);
            }
            // 避免无限循环
            if (wordOptions.length >= allWords.length) break;
        }
    }
    else {
        // 其他主题正常处理
        const themeWords = words[themeKey] || words["random"];
        while (wordOptions.length < 6) {
            const randomWord = themeWords[Math.floor(Math.random() * themeWords.length)];
            if (!wordOptions.includes(randomWord)) wordOptions.push(randomWord);
        }
    }

    room.wordOptions = wordOptions;
    room.currentWord = null;

    // 🔥 修复：设置房间的难度系数
    const difficultyMultiplier = DIFFICULTY_MULTIPLIERS[themeKey] || 1.0;
    room.difficultyMultiplier = difficultyMultiplier;

    console.log(`🎯 Setting difficulty for room ${roomId}: theme=${theme}, themeKey=${themeKey}, multiplier=${difficultyMultiplier}`);

    // 选词阶段：15秒
    const roundTime = 15;
    const startTime = Date.now();
    const serverNow = Date.now();
    room.roundStartTime = startTime;
    room.roundTime = roundTime;
    room.roundState = "wordSelection";

    await saveSingleRoom(room);

    // 广播阶段开始，包含服务器时间用于同步
    drawGuessNamespace.to(roomId).emit("roundStarted", {
        wordOptions,
        currentRound: room.currentRound,
        totalRounds: room.totalRounds,
        artist: room.currentArtist,
        roundTime,
        startTime,
        serverNow,
        phase: "wordSelection",
        theme: room.theme,
        difficultyMultiplier: difficultyMultiplier
    });

    // 设置选词阶段定时器
    const timer = setTimeout(async () => {
        const currentRooms = await loadRooms();
        const currentRoom = currentRooms[roomId];
        if (!currentRoom) return;

        // 如果阶段仍然没有推进，发送超时事件
        if (currentRoom.roundState === "wordSelection" && !currentRoom.currentWord) {
            console.log(`Word selection timeout in room ${roomId}`);
            drawGuessNamespace.to(roomId).emit("phaseTimeout", { phase: "wordSelection" });

            // 强制选词
            const options = currentRoom.wordOptions;
            const randomWord = options[Math.floor(Math.random() * options.length)];
            currentRoom.currentWord = randomWord;
            await saveSingleRoom(currentRoom);

            drawGuessNamespace.to(roomId).emit("roundWordSelected", { word: randomWord });
            startDrawingPhase(roomId);
        } else if (currentRoom.roundState === "drawing") {
            console.log(`Drawing phase timeout in room ${roomId}`);
            finishRound(roomId);
        }
    }, roundTime * 1000);

    roomTimers.set(roomId, timer);
}

// 🔥 修改：绘画猜词阶段函数
async function startDrawingPhase(roomId) {
    const currentRooms = await loadRooms();
    const room = currentRooms[roomId];
    if (!room) return;

    // 清除之前的定时器
    if (roomTimers.has(roomId)) {
        clearTimeout(roomTimers.get(roomId));
        roomTimers.delete(roomId);
    }

    // 🔥 修复：确保难度系数在绘画阶段也存在
    const difficultyMultiplier = room.difficultyMultiplier || 1.0;

    // 绘画猜词阶段：90秒
    const roundTime = 90;
    const startTime = Date.now();
    const serverNow = Date.now();
    room.roundStartTime = startTime;
    room.roundTime = roundTime;
    room.roundState = "drawing";
    room.guesses = [];

    await saveSingleRoom(room);

    drawGuessNamespace.to(roomId).emit("drawingPhaseStarted", {
        currentRound: room.currentRound,
        totalRounds: room.totalRounds,
        artist: room.currentArtist,
        roundTime,
        startTime,
        serverNow,
        phase: "drawing",
        difficultyMultiplier: difficultyMultiplier
    });

    // 绘画阶段定时器
    const timer = setTimeout(async () => {
        const currentRooms = await loadRooms();
        const currentRoom = currentRooms[roomId];
        if (!currentRoom) return;

        // 如果阶段仍然没有推进，发送超时事件
        if (currentRoom.roundState === "wordSelection" && !currentRoom.currentWord) {
            console.log(`Word selection timeout in room ${roomId}`);
            drawGuessNamespace.to(roomId).emit("phaseTimeout", { phase: "wordSelection" });

            // 强制选词
            const options = currentRoom.wordOptions;
            const randomWord = options[Math.floor(Math.random() * options.length)];
            currentRoom.currentWord = randomWord;
            await saveSingleRoom(currentRoom);

            drawGuessNamespace.to(roomId).emit("roundWordSelected", { word: randomWord });
            startDrawingPhase(roomId);
        } else if (currentRoom.roundState === "drawing") {
            console.log(`Drawing phase timeout in room ${roomId}`);
            finishRound(roomId);
        }
    }, roundTime * 1000);

    roomTimers.set(roomId, timer);
}

// 🔥 修改：添加提前结束回合的函数
async function finishRoundEarly(roomId) {
    const currentRooms = await loadRooms();
    const room = currentRooms[roomId];
    if (!room) return;

    // 清除定时器
    if (roomTimers.has(roomId)) {
        clearTimeout(roomTimers.get(roomId));
        roomTimers.delete(roomId);
    }

    finishRound(roomId);
}

// 🔥 统一计分函数，添加难度系数
function calculateScores(room) {
    const correctGuesses = room.guesses.filter(g => g.isCorrect);
    const correctCount = correctGuesses.length;
    const totalGuessers = room.playerList.length - 1;

    // 🎨 获取当前主题的难度系数
    const difficultyMultiplier = DIFFICULTY_MULTIPLIERS[normalizeThemeKey(room.theme)] || 1.0;

    // 🎨 画家得分公式：基础分 + 表现奖励
    let artistScore = 0;
    if (correctCount > 0) {
        // 基础分：按猜对比例计算
        const baseScore = Math.round(100 * (correctCount / totalGuessers));
        // 表现奖励：全部猜对额外奖励
        const bonus = correctCount === totalGuessers ? 50 : 0;
        artistScore = Math.round((baseScore + bonus) * difficultyMultiplier);
    }

    // 👥 猜词者得分：按猜对顺序奖励
    const guesserScores = {};
    correctGuesses.forEach((guess, index) => {
        let score = 0;
        if (index === 0) score = 80;      // 第一个猜对
        else if (index === 1) score = 70; // 第二个猜对  
        else if (index === 2) score = 60; // 第三个猜对
        else score = 40;                  // 后续猜对

        // 时间奖励：越早猜对奖励越多
        const timeElapsed = guess.timestamp - room.roundStartTime;
        const timeBonus = Math.max(0, Math.round((room.roundTime * 1000 - timeElapsed) / 1000));
        score += timeBonus;

        // 应用难度系数
        score = Math.round(score * difficultyMultiplier);

        guesserScores[guess.playerId] = score;
    });

    return { artistScore, guesserScores };
}

// 🔥 修改 finishRound 函数
async function finishRound(roomId) {
    const currentRooms = await loadRooms();
    const room = currentRooms[roomId];
    if (!room) return;

    // 🎯 使用统一的计分函数
    const { artistScore, guesserScores } = calculateScores(room);

    // 🎨 获取当前主题的难度系数
    const difficultyMultiplier = room.difficultyMultiplier || 1.0;
    console.log(`🏁 Finishing round for room ${roomId}: current multiplier=${difficultyMultiplier}`);

    // 更新画家分数
    const artist = room.playerList.find(p => p.id === room.currentArtist);
    if (artist) {
        artist.score += artistScore;
    }

    // 更新猜词者分数
    Object.entries(guesserScores).forEach(([playerId, score]) => {
        const player = room.playerList.find(p => p.id === playerId);
        if (player) {
            player.score += score;
        }
    });

    await saveSingleRoom(room);

    // 发送回合结束事件
    const correctCount = room.guesses.filter(g => g.isCorrect).length;

    if (room.currentRound >= room.totalRounds) {
        // 游戏结束
        const winner = getWinner(room.playerList);
        console.log(`🎊 Game finished in room ${roomId}, winner: ${winner?.username}`);

        drawGuessNamespace.to(roomId).emit("gameFinished", {
            winner: winner,
            finalScores: room.playerList,
            totalRounds: room.totalRounds,
            difficultyMultiplier: difficultyMultiplier
        });

        // 🔥 修复：正确删除房间数据
        setTimeout(async () => {
            try {
                console.log(`🗑️ Deleting room ${roomId} after game completion`);

                // 1. 从 Supabase 删除房间
                await deleteRoomFromSupabase(roomId);

                // 2. 从内存中删除房间
                const updatedRooms = await loadRooms();
                delete updatedRooms[roomId];

                console.log(`✅ Room ${roomId} successfully deleted`);
            } catch (error) {
                console.error(`❌ Error deleting room ${roomId}:`, error);
            }
        }, 10000);
    } else {
        drawGuessNamespace.to(roomId).emit("roundEnded", {
            correctWord: room.currentWord,
            correctCount,
            artistScore,
            scores: room.playerList,
            currentRound: room.currentRound,
            totalRounds: room.totalRounds,
            difficultyMultiplier: difficultyMultiplier
        });

        setTimeout(() => {
            nextRound(roomId);
        }, 5000);
    }
}

// 🔥 新增：下一轮函数
async function nextRound(roomId) {
    const rooms = await loadRooms();
    const room = rooms[roomId];
    if (!room) return;

    room.currentRound++;

    if (room.currentRound > room.totalRounds) {
        // 游戏结束 - 这里不应该再发送 gameFinished，因为 finishRound 已经处理了
        console.log(`🎯 All rounds completed in room ${roomId}`);
        // 游戏结束逻辑已经在 finishRound 中处理，这里不需要重复处理
        return;
    } else {
        // 下一轮
        room.currentArtist = room.artistOrder[room.currentRound - 1];
        room.currentWord = null;
        room.guesses = [];
        room.roundState = "wordSelection";

        await saveRooms(rooms);

        // 通知客户端进入下一轮
        drawGuessNamespace.to(roomId).emit("nextRound");

        // 开始选词阶段
        startWordSelection({ roomId, theme: room.theme });
    }
}

// ---------- 艺术品API ----------

// 获取某个分类的艺术品（根据当前用户返回是否点赞）
app.get("/api/artworks/:category", async (req, res) => {
    const { category } = req.params;
    const { userId } = req.query;

    try {
        const { data, error } = await supabase
            .from('artworks')
            .select('*')
            .eq('category', category)
            .order('id', { ascending: true });

        if (error) {
            console.error('Error fetching artworks:', error);
            return res.status(500).json({ error: "Database error" });
        }

        const processedArtworks = data.map(artwork => ({
            id: artwork.id,
            title: artwork.title,
            artist: artwork.artist,
            imageUrl: artwork.image_url,
            description: artwork.description,
            date: artwork.date,
            likes: (artwork.liked_by || []).length,
            liked: userId ? (artwork.liked_by || []).includes(userId) : false,
            userId: artwork.user_id, // 返回作者用户ID
            userAvatar: artwork.user_avatar
        }));

        res.json(processedArtworks);
    } catch (error) {
        console.error('Error in /api/artworks/:category:', error);
        res.status(500).json({ error: "Server error" });
    }
});

// 更新点赞状态 - 增强版本（支持用户获赞统计）
app.post("/api/artworks/like", async (req, res) => {
    const { id, category, userId } = req.body;

    if (id === undefined || !category || !userId) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        // 先获取当前的艺术品数据（包括 user_id）
        const { data: artwork, error: fetchError } = await supabase
            .from('artworks')
            .select('liked_by, user_id')
            .eq('id', id)
            .single();

        if (fetchError || !artwork) {
            return res.status(404).json({ error: "Artwork not found" });
        }

        const currentLikedBy = artwork.liked_by || [];
        const artworkOwnerId = artwork.user_id; // 艺术品作者的用户ID

        let newLikedBy;
        let liked;
        let likeChange = 0; // 点赞变化：+1 表示点赞，-1 表示取消点赞

        if (currentLikedBy.includes(userId)) {
            // 取消点赞
            newLikedBy = currentLikedBy.filter(uid => uid !== userId);
            liked = false;
            likeChange = -1;
        } else {
            // 点赞
            newLikedBy = [...currentLikedBy, userId];
            liked = true;
            likeChange = 1;
        }

        // 开始事务：更新艺术品点赞数和用户获赞数
        // 1. 更新艺术品的 liked_by 数组
        const { data: updateData, error: updateError } = await supabase
            .from('artworks')
            .update({
                liked_by: newLikedBy
            })
            .eq('id', id)
            .select();

        if (updateError) {
            return res.status(500).json({ error: "Update failed: " + updateError.message });
        }

        // 2. 更新用户的获赞数（如果艺术品有作者）
        if (artworkOwnerId) {
            // 先获取用户当前的获赞数
            const { data: userData, error: userFetchError } = await supabase
                .from('users')
                .select('likes')
                .eq('id', artworkOwnerId)
                .single();

            if (!userFetchError && userData) {
                const newLikes = Math.max(0, (userData.likes || 0) + likeChange);

                // 更新用户获赞数
                const { error: userUpdateError } = await supabase
                    .from('users')
                    .update({ likes: newLikes })
                    .eq('id', artworkOwnerId);

                if (userUpdateError) {
                    console.error("Error updating user likes:", userUpdateError);
                    // 不返回错误，因为艺术品点赞已经成功，只是用户统计更新失败
                }
            }
        }

        res.json({
            success: true,
            likes: newLikedBy.length,
            liked: liked
        });

    } catch (error) {
        console.error('Error in like endpoint:', error);
        res.status(500).json({ error: "Server error: " + error.message });
    }
});

// 添加新艺术品（更新版本）
app.post("/api/artworks", async (req, res) => {
    const { category, artwork, userId } = req.body; // 添加 userId 参数

    if (!category || !artwork || !userId) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        // 获取该分类下的最大 ID
        const { data: maxIdData, error: maxIdError } = await supabase
            .from('artworks')
            .select('id')
            .eq('category', category)
            .order('id', { ascending: false })
            .limit(1);

        let newId;
        if (maxIdData && maxIdData.length > 0) {
            // 找到该分类的最大 ID，继续递增
            newId = maxIdData[0].id + 1;

            // 检查是否超出该分类的范围
            const baseId = CATEGORY_BASE_IDS[category];
            const nextCategoryBase = Object.values(CATEGORY_BASE_IDS)
                .sort((a, b) => a - b)
                .find(id => id > baseId) || (baseId + 10000);

            if (newId >= nextCategoryBase) {
                return res.status(400).json({
                    error: `Category ${category} has reached maximum capacity`
                });
            }
        } else {
            // 该分类还没有数据，从分类基础 ID 开始
            newId = CATEGORY_BASE_IDS[category] || 10000;
        }

        // 插入新艺术品（包含 user_id）
        const { data, error } = await supabase
            .from('artworks')
            .insert([{
                id: newId,
                category: category,
                title: artwork.title,
                artist: artwork.artist,
                image_url: artwork.imageUrl,
                description: artwork.description,
                date: artwork.date,
                liked_by: [],
                user_id: userId, // 添加用户ID
                user_avatar: userAvatar // 新增：存储用户头像
            }])
            .select();

        if (error) {
            console.error('Error inserting artwork:', error);
            return res.status(500).json({ error: "Insert failed" });
        }

        const newArtwork = data[0];
        res.json({
            success: true,
            artwork: {
                id: newArtwork.id,
                title: newArtwork.title,
                artist: newArtwork.artist,
                imageUrl: newArtwork.image_url,
                description: newArtwork.description,
                date: newArtwork.date,
                likes: 0,
                liked: false,
                userId: newArtwork.user_id,
                userAvatar: newArtwork.user_avatar // 返回用户头像
            }
        });
    } catch (error) {
        console.error('Error in add artwork endpoint:', error);
        res.status(500).json({ error: "Server error" });
    }
});

// ---------- 画板逻辑 ----------

// 集体画板 API
app.get("/canvas", async (req, res) => {
    try {
        const canvasData = await loadCanvasFromSupabase(CANVAS_BUCKET);
        res.json(canvasData);
    } catch (error) {
        console.error('Error in /canvas:', error);
        res.status(500).json({ error: "Failed to load canvas" });
    }
});

app.post("/canvas", async (req, res) => {
    const { image } = req.body;

    if (!image) {
        return res.status(400).json({ error: "No image data provided" });
    }

    try {
        const success = await saveCanvasToSupabase(CANVAS_BUCKET, image);

        if (success) {
            res.json({ status: "ok" });
        } else {
            res.status(500).json({ error: "Failed to save canvas" });
        }
    } catch (error) {
        console.error('Error in POST /canvas:', error);
        res.status(500).json({ error: "Server error" });
    }
});

// canvas namespace

// 为不同路由创建独立的在线计数
const routeOnlineCounts = {
    '/game/collective-canvas': 0,
    '/game/draw-guess': 0
};

const canvasNamespace = io.of("/canvas");

canvasNamespace.on("connection", (socket) => {
    console.log("Canvas connected:", socket.id);

    // 默认加入 collective-canvas 路由（兼容旧版本）
    socket.join('collective-canvas');
    routeOnlineCounts['/game/collective-canvas']++;

    // 发送 collective-canvas 路由的在线人数
    canvasNamespace.to('collective-canvas').emit("onlineCount", routeOnlineCounts['/game/collective-canvas']);

    socket.on("joinRoute", (route) => {
        // 离开之前的路由
        socket.rooms.forEach(room => {
            if (room.startsWith('route-')) {
                socket.leave(room);
                const routeKey = room.replace('route-', '');
                if (routeOnlineCounts[routeKey] > 0) {
                    routeOnlineCounts[routeKey]--;
                }
            }
        });

        // 加入新路由
        if (route && routeOnlineCounts.hasOwnProperty(route)) {
            const roomName = `route-${route}`;
            socket.join(roomName);
            routeOnlineCounts[route]++;

            // 广播新路由的在线人数
            canvasNamespace.to(roomName).emit("onlineCount", routeOnlineCounts[route]);
            console.log(`User ${socket.id} joined route: ${route}, count: ${routeOnlineCounts[route]}`);
        }
    });

    socket.on("draw", (data) => {
        socket.broadcast.emit("draw", data);
    });

    socket.on("disconnect", (reason) => {
        console.log("Canvas disconnected:", socket.id, "Reason:", reason);

        // 从所有路由中移除
        socket.rooms.forEach(room => {
            if (room.startsWith('route-')) {
                const routeKey = room.replace('route-', '');
                if (routeOnlineCounts[routeKey] > 0) {
                    routeOnlineCounts[routeKey]--;
                    // 广播更新后的在线人数
                    canvasNamespace.to(room).emit("onlineCount", routeOnlineCounts[routeKey]);
                }
            }
        });

        // 清理默认的 collective-canvas
        if (routeOnlineCounts['/game/collective-canvas'] > 0) {
            routeOnlineCounts['/game/collective-canvas']--;
            canvasNamespace.to('collective-canvas').emit("onlineCount", routeOnlineCounts['/game/collective-canvas']);
        }
    });

    socket.on("error", (error) => {
        console.error("Canvas socket error:", error);
    });
});

// draw-guess 独立画板
let onlineCountGuessCanvas = 0;

// DrawGuess 画板 API
app.get("/drawGuess/canvas", async (req, res) => {
    try {
        const canvasData = await loadCanvasFromSupabase(DRAWGUESS_BUCKET);
        res.json(canvasData);
    } catch (error) {
        console.error('Error in /drawGuess/canvas:', error);
        res.status(500).json({ error: "Failed to load canvas" });
    }
});

app.post("/drawGuess/canvas", async (req, res) => {
    const { image } = req.body;

    if (!image) {
        return res.status(400).json({ error: "No image data provided" });
    }

    try {
        const success = await saveCanvasToSupabase(DRAWGUESS_BUCKET, image);

        if (success) {
            res.json({ status: "ok" });
        } else {
            res.status(500).json({ error: "Failed to save canvas" });
        }
    } catch (error) {
        console.error('Error in POST /drawGuess/canvas:', error);
        res.status(500).json({ error: "Server error" });
    }
});

// draw-guess canvas namespace

const drawGuessCanvasNamespace = io.of("/drawGuessCanvas");

drawGuessCanvasNamespace.on("connection", (socket) => {
    onlineCountGuessCanvas++;
    drawGuessCanvasNamespace.emit("onlineCount", onlineCountGuessCanvas);
    console.log("DrawGuessCanvas connected:", socket.id);

    socket.on("draw", (data) => {
        socket.broadcast.emit("draw", data);
    });

    socket.on("disconnect", () => {
        onlineCountGuessCanvas--;
        drawGuessCanvasNamespace.emit("onlineCount", onlineCountGuessCanvas);
        console.log("DrawGuessCanvas disconnected:", socket.id);
    });
});

// draw-guess namespace
const drawGuessNamespace = io.of("/drawGuess");

drawGuessNamespace.on("connection", (socket) => {
    console.log("DrawGuess connected:", socket.id);

    // 加入房间
    socket.on("joinRoom", async ({ roomId, username, avatar, userId }) => {
        try {
            // 建立映射
            userSocketMap.set(userId, socket.id);
            socketUserMap.set(socket.id, userId);

            const rooms = await loadRoomsFromSupabase();
            const room = rooms[roomId];

            if (!room) {
                socket.emit("joinRoomError", { error: "The room does not exist." });
                return;
            }

            // 🔥 修复：检查 currentRound 是否为 undefined
            const isGameStarted = (room.currentRound ?? 0) > 0;
            const isExistingPlayer = room.playerList.some(p => p.id === userId);

            // 🔥 修改：允许现有玩家在游戏开始后重新加入
            if (isGameStarted && !isExistingPlayer) {
                socket.emit("joinRoomError", {
                    error: "Game has already started! You cannot join mid-game."
                });
                return;
            }

            // 🔥 修复：更严格的重复加入检查
            const existingPlayerIndex = room.playerList.findIndex(p => p.id === userId);
            if (existingPlayerIndex !== -1) {
                // 玩家已存在，更新socketId（重连情况）
                console.log(`🔄 Player ${username} reconnected, updating socketId`);
                room.playerList[existingPlayerIndex].socketId = socket.id;
                room.playerList[existingPlayerIndex].username = username;
                room.playerList[existingPlayerIndex].avatar = avatar;

                // 🔥 新增：发送当前房间状态给重新连接的玩家
                socket.emit("roomUpdate", room);

                // 如果游戏正在进行中，发送相应的阶段事件
                if (isGameStarted) {
                    if (room.roundState === "wordSelection") {
                        socket.emit("roundStarted", {
                            wordOptions: room.wordOptions,
                            currentRound: room.currentRound,
                            totalRounds: room.totalRounds,
                            artist: room.currentArtist,
                            roundTime: room.roundTime,
                            startTime: room.roundStartTime,
                            serverNow: Date.now(),
                            phase: "wordSelection"
                        });
                    } else if (room.roundState === "drawing") {
                        socket.emit("drawingPhaseStarted", {
                            currentRound: room.currentRound,
                            totalRounds: room.totalRounds,
                            artist: room.currentArtist,
                            roundTime: room.roundTime,
                            startTime: room.roundStartTime,
                            serverNow: Date.now(),
                            phase: "drawing"
                        });
                    }
                }
            } else {
                // 新玩家加入
                if (isGameStarted) {
                    socket.emit("joinRoomError", {
                        error: "Game has already started! You cannot join mid-game."
                    });
                    return;
                }

                room.playerList.push({
                    id: userId,
                    username: username,
                    avatar: avatar,
                    score: 0,
                    socketId: socket.id
                });
            }

            await saveRoomToSupabase(room);
            socket.join(roomId);

            // 只广播给其他玩家
            socket.to(roomId).emit("roomUpdate", room);
        } catch (error) {
            console.error('Error joining room:', error);
            socket.emit("joinRoomError", { error: "Internal server error" });
        }
    });

    // 离开房间（手动点击）
    socket.on("leaveRoom", async ({ roomId, userId }) => {
        try {
            const rooms = await loadRooms();
            const room = rooms[roomId];
            if (!room) return;

            console.log(`Player ${userId} leaving room ${roomId}`);

            // 移除玩家
            const playerIndex = room.playerList.findIndex(p => p.id === userId);
            if (playerIndex !== -1) {
                const player = room.playerList[playerIndex];
                console.log(`Removing player ${player.username} from room ${roomId}`);
                room.playerList.splice(playerIndex, 1);
            }

            // 🔥 修复：确保 host 切换逻辑正确
            if (room.host.id === userId) {
                if (room.playerList.length > 0) {
                    const newHost = room.playerList[0];
                    room.host = {
                        id: newHost.id,
                        username: newHost.username
                    };
                    console.log(`Host transferred from ${userId} to ${newHost.id} (${newHost.username})`);
                } else {
                    console.log(`Room ${roomId} is empty, deleting...`);
                    // 房间为空，删除房间
                    await deleteRoomFromSupabase(roomId);
                    delete rooms[roomId];
                    await saveRooms(rooms);

                    // 广播房间删除事件
                    drawGuessNamespace.to(roomId).emit("roomDeleted");
                    return;
                }
            }

            await saveRooms(rooms);

            // 🔥 修复：立即广播房间更新
            console.log(`Broadcasting room update for ${roomId}, remaining players: ${room.playerList.length}`);
            drawGuessNamespace.to(roomId).emit("roomUpdate", room);

        } catch (error) {
            console.error('Error in leaveRoom:', error);
        }

        socket.leave(roomId);
    });

    // 开始游戏
    socket.on("startGame", async ({ roomId }) => {
        const rooms = await loadRooms();
        const room = rooms[roomId];
        if (!room) return;

        // 初始化轮次系统
        const players = room.playerList.map(p => p.id);
        room.artistOrder = shuffle(players);
        room.currentRound = 1;
        room.totalRounds = players.length;
        room.currentArtist = room.artistOrder[0];
        room.currentWord = null;
        room.guesses = [];
        room.roundState = "wordSelection";

        await saveRooms(rooms);

        // 🔥 修复：确保所有玩家都能收到游戏开始事件
        console.log(`🎮 Starting game in room ${roomId}, notifying ${room.playerList.length} players`);

        // 首先发送 gameStarted 事件
        drawGuessNamespace.to(roomId).emit("gameStarted", {
            roomId,
            totalRounds: room.totalRounds,
            currentRound: room.currentRound,
            artist: room.currentArtist,
        });

        // 🔥 新增：延迟开始选词阶段，确保客户端有足够时间处理 gameStarted 事件
        setTimeout(() => {
            startWordSelection({ roomId, theme: room.theme });
        }, 500);
    });

    socket.on("selectWord", async ({ roomId, word }) => {
        const currentRooms = await loadRooms();
        const room = currentRooms[roomId];
        if (!room) return;

        // 🔥 修复：使用 userId 而不是 socket.id 来验证画家身份
        const userId = socketUserMap.get(socket.id);
        console.log(`🎨 Word selection attempt: userId=${userId}, currentArtist=${room.currentArtist}, roundState=${room.roundState}`);

        if (userId === room.currentArtist && room.roundState === "wordSelection") {
            room.currentWord = word;
            await saveSingleRoom(room);

            console.log(`✅ Word selected: ${word} by artist ${userId}`);

            // 通知全员：词条已选
            drawGuessNamespace.to(roomId).emit("roundWordSelected", { word });

            // 立即进入绘画阶段
            startDrawingPhase(roomId);
        } else {
            console.log(`❌ Word selection permission verification failed: userId=${userId}, currentArtist=${room.currentArtist}, roundState=${room.roundState}`);
            socket.emit("selectWordError", {
                error: "Only the current artist can select words during word selection phase",
                userId,
                currentArtist: room.currentArtist,
                roundState: room.roundState
            });
        }
    });

    // 倒计时到期自动选词
    socket.on("roundTimeout", async ({ roomId }) => {
        const rooms = await loadRooms();
        const room = rooms[roomId];
        if (!room || room.currentWord) return; // 已选过就不再随机

        const options = room.wordOptions;
        const randomWord = options[Math.floor(Math.random() * options.length)];
        room.currentWord = randomWord;
        await saveRooms(rooms);

        drawGuessNamespace.to(roomId).emit("roundWordSelected", { word: randomWord });

        // 🔥 新增：进入绘画阶段
        startDrawingPhase(roomId);
    });

    // 玩家断线（自动离开）
    socket.on("disconnect", async (reason) => {
        const userId = socketUserMap.get(socket.id);
        console.log(`Player disconnected: socket.id=${socket.id}, userId=${userId}, reason=${reason}`);

        if (userId) {
            userSocketMap.delete(userId);
            socketUserMap.delete(socket.id);

            const rooms = await loadRooms();
            for (const roomId in rooms) {
                const room = rooms[roomId];
                const playerIndex = room.playerList.findIndex(p => p.socketId === socket.id);

                if (playerIndex !== -1) {
                    const player = room.playerList[playerIndex];

                    // 🔥 修复：区分刷新和主动离开
                    // 如果是页面刷新，保留玩家在列表中，只清除socketId
                    if (reason === "transport close" || reason === "ping timeout") {
                        console.log(`Player ${player.username} disconnected (likely refresh), keeping in room`);
                        // 只清除socketId，保留玩家在列表中
                        room.playerList[playerIndex].socketId = null;

                        // 设置重连超时（30秒）
                        setTimeout(async () => {
                            const updatedRooms = await loadRooms();
                            const updatedRoom = updatedRooms[roomId];
                            if (updatedRoom) {
                                const stalePlayerIndex = updatedRoom.playerList.findIndex(p =>
                                    p.id === userId && p.socketId === null
                                );
                                if (stalePlayerIndex !== -1) {
                                    console.log(`Removing stale player ${player.username} after timeout`);
                                    updatedRoom.playerList.splice(stalePlayerIndex, 1);

                                    // 如果是host，转移权限
                                    if (updatedRoom.host.id === userId && updatedRoom.playerList.length > 0) {
                                        const newHost = updatedRoom.playerList[0];
                                        updatedRoom.host = { id: newHost.id, username: newHost.username };
                                    }

                                    // 如果房间空了，删除房间
                                    if (updatedRoom.playerList.length === 0) {
                                        delete updatedRooms[roomId];
                                    }

                                    await saveRooms(updatedRooms);
                                    drawGuessNamespace.to(roomId).emit("roomUpdate", updatedRoom);
                                }
                            }
                        }, 30000);

                    } else {
                        // 主动离开：立即移除玩家
                        console.log(`Player ${player.username} actively left room ${roomId}`);
                        room.playerList.splice(playerIndex, 1);

                        // host 离线，转移给剩余玩家
                        if (room.host.id === player.id && room.playerList.length > 0) {
                            const newHost = room.playerList[0];
                            room.host = { id: newHost.id, username: newHost.username };
                            console.log(`Transfer host permissions to: ${newHost.username}`);
                        }

                        // 如果房间没有玩家了，删除房间
                        if (room.playerList.length === 0) {
                            console.log(`Room ${roomId} is empty. Deleting room.`);
                            delete rooms[roomId];
                        } else {
                            drawGuessNamespace.to(roomId).emit("roomUpdate", room);
                        }
                    }

                    await saveRooms(rooms);
                    break;
                }
            }
        }
    });

    // 处理玩家猜测
    socket.on("submitGuess", async ({ roomId, playerId, guess }) => {
        const rooms = await loadRooms();
        const room = rooms[roomId];
        if (!room) return;

        const player = room.playerList.find(p => p.id === playerId);
        if (!player) return;

        // 检查是否已经猜对过
        const hasGuessedCorrectly = room.guesses.some(g =>
            g.playerId === playerId && g.isCorrect
        );
        if (hasGuessedCorrectly) {
            socket.emit("guessRejected", { reason: "already_correct" });
            return;
        }

        const isCorrect = guess.toLowerCase() === room.currentWord?.toLowerCase();

        const guessWord = {
            playerId,
            playerName: player.username,
            guess,
            isCorrect,
            timestamp: Date.now()
        };

        // 🔥 修复：只记录猜测，不立即更新分数
        room.guesses.push(guessWord);
        await saveRooms(rooms);

        drawGuessNamespace.to(roomId).emit("guessSubmitted", guessWord);
        drawGuessNamespace.to(roomId).emit("roomUpdate", room);

        // 🔥 修复：检查是否所有人都猜对了
        const guessers = room.playerList.filter(p => p.id !== room.currentArtist);
        const allGuessedCorrectly = guessers.every(guesser =>
            room.guesses.some(g => g.playerId === guesser.id && g.isCorrect)
        );

        if (allGuessedCorrectly) {
            console.log(`All players guessed correctly in room ${roomId}, finishing round early`);
            finishRoundEarly(roomId);
        }
    });

    // 处理下一轮请求
    socket.on("nextRound", ({ roomId }) => {
        nextRound(roomId);
    });

    // 处理所有玩家猜对的情况
    socket.on("allGuessedCorrectly", ({ roomId }) => {
        // 立即结束当前回合
        drawGuessNamespace.to(roomId).emit("roundFinished");
    });
});

// ---------- 注册登录逻辑 ----------
app.post("/api/auth/signup", async (req, res) => {
    const { email, username, password } = req.body;
    if (!email || !username || !password) return res.status(400).json({ error: "Please fill in all required information." });

    // 检查用户是否已存在
    const { data: existingUser, error: userError } = await supabase
        .from('users')
        .select('email')
        .eq('email', email)
        .single();

    if (existingUser) return res.status(400).json({ error: "User already exists" });

    const token = crypto.randomBytes(16).toString("hex");
    const userId = crypto.randomBytes(8).toString("hex"); // 生成与之前格式相同的ID

    // 默认头像 URL
    const defaultAvatarUrl = `${SUPABASE_URL}/storage/v1/object/public/default-imgs/default-avatar.jpg`;

    try {
        // 插入新用户
        const { data, error } = await supabase
            .from('users')
            .insert([{
                id: userId,
                email,
                username,
                password,
                avatar_url: defaultAvatarUrl,
                verified: false,
                token,
                role: "user",
                likes: 0,
                score: 0
            }])
            .select();

        if (error) {
            console.error("Error creating user:", error);
            return res.status(500).json({ error: "Database error" });
        }

        const verifyLink = `${SERVER_URL}/api/auth/verify/${token}`;

        try {
            await sendVerificationEmail(email, verifyLink);
        } catch (e) {
            console.error("Email sending failed:", e);
            // 删除已创建的用户
            await supabase.from('users').delete().eq('email', email);
            return res.status(500).json({ error: "Email sending failed, please contact the administrator" });
        }

        res.json({ message: "Registration successful, please check your email to complete verification" });
    } catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({ error: "Server error" });
    }
});

app.get("/api/auth/verify/:token", async (req, res) => {
    const token = req.params.token;

    try {
        // 查找用户
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('token', token)
            .single();

        if (!user) {
            return res.redirect(`${FRONTEND_URL}/verify?success=false`);
        }

        // 更新用户验证状态
        const { error: updateError } = await supabase
            .from('users')
            .update({
                verified: true,
                token: null
            })
            .eq('id', user.id);

        if (updateError) {
            console.error("Error updating user verification:", updateError);
            return res.redirect(`${FRONTEND_URL}/verify?success=false`);
        }

        res.redirect(`${FRONTEND_URL}/verify?success=true`);
    } catch (error) {
        console.error("Verification error:", error);
        res.redirect(`${FRONTEND_URL}/verify?success=false`);
    }
});

app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (!user) return res.status(400).json({ error: "User does not exist" });
        if (user.password !== password) return res.status(400).json({ error: "Incorrect password" });
        if (!user.verified) return res.status(400).json({ error: "Please verify your email first" });

        // 返回用户信息给前端
        res.json({
            message: "Login successful!",
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                avatar: user.avatar_url,
                role: user.role,
                likes: user.likes || 0,
                score: user.score || 0
            }
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// 更新用户资料
app.post("/api/auth/update-profile", async (req, res) => {
    const { userId, username, oldPassword, newPassword } = req.body;

    try {
        // 获取当前用户
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // 验证旧密码（如果要更改密码）
        if (newPassword) {
            if (!oldPassword || user.password !== oldPassword) {
                return res.status(400).json({ error: "Current password is incorrect" });
            }
        }

        // 构建更新数据
        const updateData = {
            username: username || user.username
        };
        if (newPassword) updateData.password = newPassword;

        // 更新用户
        const { data, error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', userId)
            .select();

        if (error) {
            console.error("Error updating profile:", error);
            return res.status(500).json({ error: "Database error" });
        }

        const updatedUser = data[0];

        res.json({
            success: true,
            user: {
                id: updatedUser.id,
                username: updatedUser.username,
                email: updatedUser.email,
                avatar: updatedUser.avatar_url,
                role: updatedUser.role,
                likes: updatedUser.likes || 0,
                score: updatedUser.score || 0
            }
        });
    } catch (error) {
        console.error("Update profile error:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// 添加获取用户信息端点
app.get("/api/auth/user/:userId", async (req, res) => {
    const { userId } = req.params;

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return res.status(404).json({ error: "User not found" });
        }

        // 返回用户信息（不包含密码）
        res.json({
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                avatar: user.avatar_url,
                role: user.role,
                likes: user.likes || 0,
                score: user.score || 0,
                isVerified: user.verified
            }
        });
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// 升级为管理员
app.post("/api/auth/upgrade-to-admin", async (req, res) => {
    const { userId, adminKey } = req.body;

    // 验证管理员密钥
    if (adminKey !== ADMIN_KEY) {
        return res.status(400).json({ error: "Invalid admin key" });
    }

    try {
        const { data, error } = await supabase
            .from('users')
            .update({ role: "admin" })
            .eq('id', userId)
            .select();

        if (error) {
            console.error("Error upgrading to admin:", error);
            return res.status(500).json({ error: "Database error" });
        }

        const updatedUser = data[0];

        res.json({
            success: true,
            user: {
                id: updatedUser.id,
                username: updatedUser.username,
                email: updatedUser.email,
                avatar: updatedUser.avatar_url,
                role: updatedUser.role,
                likes: updatedUser.likes || 0,
                score: updatedUser.score || 0
            }
        });
    } catch (error) {
        console.error("Upgrade to admin error:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// 更新头像
app.post("/api/auth/update-avatar", upload.single('avatar'), async (req, res) => {
    const { userId } = req.body;
    const file = req.file;

    if (!file || !userId) {
        return res.status(400).json({ error: "Missing file or user ID" });
    }

    // 检查文件类型
    if (!file.mimetype.startsWith('image/')) {
        return res.status(400).json({ error: "Please upload a valid image file" });
    }

    try {
        // 1. 首先获取用户当前的头像信息
        const { data: currentUser, error: userError } = await supabase
            .from('users')
            .select('avatar_url')
            .eq('id', userId)
            .single();

        if (userError) {
            console.error("Error fetching user:", userError);
            return res.status(500).json({ error: "Failed to fetch user data" });
        }

        // 2. 如果用户已有自定义头像（不是默认头像），删除旧文件
        if (currentUser.avatar_url &&
            currentUser.avatar_url.includes('user-avatars') &&
            !currentUser.avatar_url.includes('default-avatar')) {

            // 从URL中提取文件路径
            const oldFilePath = currentUser.avatar_url.split('/user-avatars/')[1];
            if (oldFilePath) {
                // 删除旧头像文件
                const { error: deleteError } = await supabase
                    .storage
                    .from('user-avatars')
                    .remove([oldFilePath]);

                if (deleteError) {
                    console.warn("Failed to delete old avatar (non-critical):", deleteError);
                    // 不阻止上传新头像，只是记录警告
                } else {
                    console.log(`Deleted old avatar for user ${userId}: ${oldFilePath}`);
                }
            }
        }

        // 3. 生成新文件名并上传（直接放在 user-avatar/ 根目录）
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${userId}-${Date.now()}.${fileExt}`;
        // 直接放在 user-avatar/ 根目录，不再使用 avatars/ 子文件夹
        const filePath = fileName;

        // 上传到 Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('user-avatars')
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: true
            });

        if (uploadError) {
            console.error("Error uploading avatar:", uploadError);
            return res.status(500).json({ error: "Failed to upload avatar" });
        }

        // 4. 获取公共 URL
        const { data: publicUrlData } = supabase
            .storage
            .from('user-avatars')
            .getPublicUrl(filePath);

        const avatarUrl = publicUrlData.publicUrl;

        // 5. 更新用户头像 URL
        const { data: userData, error: updateError } = await supabase
            .from('users')
            .update({ avatar_url: avatarUrl })
            .eq('id', userId)
            .select();

        if (updateError) {
            console.error("Error updating user avatar:", updateError);
            return res.status(500).json({ error: "Failed to update user profile" });
        }

        res.json({
            success: true,
            avatar: avatarUrl
        });
    } catch (error) {
        console.error("Avatar update error:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// 🔹 创建房间
app.post("/api/room/create", async (req, res) => {
    const { theme, maxPlayers, host, isPublic, customWords } = req.body;

    try {
        // 使用 getAllRooms 来检查现有房间
        const rooms = await loadRoomsFromSupabase();

        // 检查 host 是否已经在其他房间中
        for (const roomId in rooms) {
            const existingRoom = rooms[roomId];
            const isHostInRoom = existingRoom.playerList.some(p => p.id === host.id);
            if (isHostInRoom) {
                return res.status(400).json({
                    error: "You are already in another room. Please leave the current room before creating a new one."
                });
            }
        }

        // 生成房间ID
        let roomID = Math.random().toString(36).substring(2, 8).toUpperCase();
        while (rooms[roomID]) {
            roomID = Math.random().toString(36).substring(2, 8).toUpperCase();
        }

        const themeKey = normalizeThemeKey(theme);
        const defaultDifficultyMultiplier = DIFFICULTY_MULTIPLIERS[themeKey] || 1.0;

        const newRoom = {
            roomID,
            host: host,
            playerList: [],
            maxPlayers,
            theme,
            isPublic: !!isPublic,
            customWords: customWords ? customWords.filter(word => word && word.trim() !== "").map(word => word.trim()) : [],
            currentRound: 0,
            totalRounds: null,
            artistOrder: [],
            currentArtist: null,
            wordOptions: [],
            currentWord: null,
            guesses: [],
            roundTime: null,
            roundStartTime: null,
            roundState: "waiting",
            difficultyMultiplier: defaultDifficultyMultiplier
        };

        // 保存到 Supabase
        const success = await saveRoomToSupabase(newRoom);
        if (!success) {
            return res.status(500).json({ error: "Failed to create room" });
        }

        res.json(newRoom);
    } catch (error) {
        console.error('Error creating room:', error);
        res.status(500).json({ error: "Server error" });
    }
});

// 🔹 通过 ID 加入房间
app.post("/api/room/join/:roomID", async (req, res) => {
    try {
        const { id, username, avatar } = req.body;
        const currentRooms = await loadRooms();
        const room = currentRooms[req.params.roomID];

        if (!room) {
            return res.status(400).json({ error: "The room does not exist." });
        }

        // 🔥 修复：检查 currentRound 是否为 undefined
        const isGameStarted = (room.currentRound ?? 0) > 0;
        const isExistingPlayer = room.playerList.some(p => p.id === id);

        // 游戏开始后不允许新玩家加入
        if (isGameStarted && !isExistingPlayer) {
            return res.status(400).json({
                error: "Game has already started! You cannot join mid-game."
            });
        }

        if (room.playerList.length >= room.maxPlayers && !isExistingPlayer) {
            return res.status(400).json({ error: "The room is full." });
        }

        // 🔥 新增：检查用户是否已经在其他房间中
        for (const roomId in currentRooms) {
            if (roomId !== req.params.roomID) {
                const existingRoom = currentRooms[roomId];
                const isUserInRoom = existingRoom.playerList.some(p => p.id === id);
                if (isUserInRoom) {
                    return res.status(400).json({
                        error: "You are already in another room. Please leave the current room first."
                    });
                }
            }
        }

        // 🔥 修复：检查是否已经在这个房间中
        const existingPlayerIndex = room.playerList.findIndex(p => p.id === id);
        if (existingPlayerIndex === -1) {
            // 新玩家加入
            if (isGameStarted) {
                return res.status(400).json({
                    error: "Game has already started! You cannot join mid-game."
                });
            }
            room.playerList.push({ id, username, avatar, score: 0 });
        } else {
            // 如果已经存在，更新信息（重连情况）
            room.playerList[existingPlayerIndex] = {
                ...room.playerList[existingPlayerIndex],
                username,
                avatar
            };
        }

        await saveSingleRoom(room);

        // 广播房间更新到所有连接的客户端
        drawGuessNamespace.to(room.roomID).emit("roomUpdate", room);
        res.json(room);
    } catch (error) {
        console.error('Error joining room:', error);
        res.status(500).json({ error: "Server error" });
    }
});

// 🔹 离开房间
app.post("/api/room/leave/:roomID", async (req, res) => {
    try {
        const { userId } = req.body;
        const rooms = await loadRoomsFromSupabase();
        const room = rooms[req.params.roomID];

        if (!room) return res.json({ message: "The room does not exist." });

        // 移除玩家
        room.playerList = room.playerList.filter(p => p.id !== userId);

        // 如果离开的是 host，要转移
        if (room.host.id === userId) {
            if (room.playerList.length > 0) {
                const newHost = room.playerList[0];
                room.host = { id: newHost.id, username: newHost.username };
            } else {
                // 如果剩下的玩家为空，则删除房间
                await deleteRoomFromSupabase(req.params.roomID);
                return res.json({ message: "The room has been deleted." });
            }
        }

        // 如果房间没有玩家了，删除房间
        if (room.playerList.length === 0) {
            await deleteRoomFromSupabase(req.params.roomID);
        } else {
            await saveRoomToSupabase(room);
        }

        res.json(room);
    } catch (error) {
        console.error('Error leaving room:', error);
        res.status(500).json({ error: "Server error" });
    }
});

// 🔹 快速匹配
app.get("/api/room/quick-match", async (req, res) => {
    try {
        const rooms = await loadRoomsFromSupabase();
        const room = Object.values(rooms).find(r => r.isPublic && r.playerList.length < r.maxPlayers);
        if (!room) return res.status(404).json({ error: "No random match rooms available." });
        res.json(room);
    } catch (error) {
        console.error('Error in quick match:', error);
        res.status(500).json({ error: "Server error" });
    }
});

app.post("/api/room/startRound", async (req, res) => {
    const { roomId, theme } = req.body;
    if (!roomId) return res.status(400).json({ error: "Missing roomId" });

    startWordSelection({ roomId, theme });
    res.json({ message: "round started" });
});

// 处理玩家选择的词条
app.post("/api/room/selectWord", async (req, res) => {
    const { roomId, playerId, word } = req.body;
    if (!roomId || !playerId || !word)
        return res.status(400).json({ error: "Invalid request parameters" });

    const currentRooms = await loadRooms();
    const room = currentRooms[roomId];
    if (!room) return res.status(404).json({ error: "The room does not exist." });

    // 只允许画家设置当前词
    if (room.host.id === playerId) {
        room.currentWord = word;
        await saveSingleRoom(room);

        // 通知所有人：画家选好了词
        drawGuessNamespace.to(roomId).emit("wordSelected", { word });
        return res.json({ message: "The painter has selected the entry.", word });
    }

    res.status(403).json({ error: "Only painters can choose words." });
});

// 🔹 获取房间
app.get("/api/room/:roomID", async (req, res) => {
    try {
        const rooms = await loadRoomsFromSupabase();
        const room = rooms[req.params.roomID];
        if (!room) return res.status(404).json({ error: "The room does not exist." });
        res.json(room);
    } catch (error) {
        console.error('Error fetching room:', error);
        res.status(500).json({ error: "Server error" });
    }
});

// 🔹 删除房间
app.delete("/api/room/:roomID", async (req, res) => {
    try {
        const currentRooms = await loadRooms();
        delete currentRooms[req.params.roomID];
        await saveRooms(currentRooms);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting room:', error);
        res.status(500).json({ error: "Server error" });
    }
});

// 获取排行榜
app.get("/api/leaderboard", async (req, res) => {
    try {
        const { range = 'all-time' } = req.query;

        let query = supabase
            .from('users')
            .select('id, username, avatar_url, score')
            .order('score', { ascending: false })
            .limit(100);

        // 根据时间范围过滤（这里需要扩展用户表来支持时间范围统计）
        // 目前先实现全部时间的排行榜
        const { data: users, error } = await query;

        if (error) {
            console.error('Error fetching leaderboard:', error);
            return res.status(500).json({ error: "Database error" });
        }

        // 转换数据格式
        const leaderboard = users.map(user => ({
            id: user.id,
            username: user.username,
            avatar: user.avatar_url,
            score: user.score || 0
        }));

        res.json({ leaderboard });
    } catch (error) {
        console.error('Error in /api/leaderboard:', error);
        res.status(500).json({ error: "Server error" });
    }
});

// 更新用户得分（在游戏结束时调用）
app.post("/api/user/update-score", async (req, res) => {
    const { userId, scoreToAdd, gameSessionId } = req.body;

    if (!userId || scoreToAdd === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        // 🔥 新增：检查是否已经为这个游戏会话更新过分数
        // 你可以使用 roomID 作为 gameSessionId
        if (gameSessionId) {
            const { data: existingUpdate, error: checkError } = await supabase
                .from('score_updates')
                .select('id')
                .eq('user_id', userId)
                .eq('game_session_id', gameSessionId)
                .single();

            if (existingUpdate) {
                console.log(`⚠️ Score already updated for user ${userId} in session ${gameSessionId}`);
                return res.json({
                    success: false,
                    message: "Score already updated for this game session",
                    alreadyUpdated: true
                });
            }
        }

        // 先获取用户当前得分
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('score')
            .eq('id', userId)
            .single();

        if (userError) {
            console.error('Error fetching user score:', userError);
            return res.status(500).json({ error: "Database error" });
        }

        const currentScore = user?.score || 0;
        const newScore = currentScore + scoreToAdd;

        // 更新用户得分
        const { data, error } = await supabase
            .from('users')
            .update({ score: newScore })
            .eq('id', userId)
            .select();

        if (error) {
            console.error('Error updating user score:', error);
            return res.status(500).json({ error: "Database error" });
        }

        // 🔥 新增：记录这次分数更新
        if (gameSessionId) {
            await supabase
                .from('score_updates')
                .insert([{
                    user_id: userId,
                    game_session_id: gameSessionId,
                    score_added: scoreToAdd,
                    updated_at: new Date().toISOString()
                }]);
        }

        console.log(`✅ Updated score for user ${userId}: ${currentScore} -> ${newScore} (+${scoreToAdd})`);

        res.json({
            success: true,
            oldScore: currentScore,
            newScore: newScore,
            addedScore: scoreToAdd
        });
    } catch (error) {
        console.error('Error in /api/user/update-score:', error);
        res.status(500).json({ error: "Server error" });
    }
});

// ---------- 上传和审核相关API (Supabase版本) ----------

// 获取用户草稿
app.get("/api/upload/draft", async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
    }

    try {
        const { data, error } = await supabase
            .from('uploads')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'draft')
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) {
            console.error('Error fetching draft:', error);
            return res.status(500).json({ error: "Database error" });
        }

        res.json({ draft: data[0] || null });
    } catch (error) {
        console.error('Error in /api/upload/draft:', error);
        res.status(500).json({ error: "Server error" });
    }
});

// 保存草稿
app.post("/api/upload/draft", artworkUpload.single('image'), async (req, res) => {
    const { userId, category, title, description, artist } = req.body;
    const file = req.file;

    if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
    }

    try {
        let imageUrl = null;
        let oldImagePathToDelete = null;

        // 如果有上传图片，保存到 Supabase Storage
        if (file) {
            // 检查文件类型
            if (!file.mimetype.startsWith('image/')) {
                return res.status(400).json({ error: "Please upload a valid image file" });
            }

            // 生成文件名并上传
            const fileExt = file.originalname.split('.').pop();
            const fileName = `draft-${userId}-${Date.now()}.${fileExt}`;
            const filePath = `upload-drafts/${fileName}`;

            // 上传到 Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase
                .storage
                .from('artworks')
                .upload(filePath, file.buffer, {
                    contentType: file.mimetype,
                    upsert: false
                });

            if (uploadError) {
                console.error("Error uploading draft image:", uploadError);
                return res.status(500).json({ error: "Failed to upload image: " + uploadError.message });
            }

            // 获取公共 URL
            const { data: publicUrlData } = supabase
                .storage
                .from('artworks')
                .getPublicUrl(filePath);

            imageUrl = publicUrlData.publicUrl;
        }

        // 检查是否已有草稿
        const { data: existingDraft, error: fetchError } = await supabase
            .from('uploads')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'draft')
            .single();

        let result;
        if (existingDraft) {
            // 🔥 优化：记录要删除的旧图片路径（如果有新图片上传）
            if (imageUrl && existingDraft.image_url && existingDraft.image_url !== imageUrl) {
                const oldFilePath = existingDraft.image_url.split('/artworks/')[1];
                if (oldFilePath && !oldFilePath.includes('default-')) { // 不删除默认图片
                    oldImagePathToDelete = oldFilePath;
                }
            }

            // 更新现有草稿
            const updateData = {
                category: category || existingDraft.category,
                title: title || existingDraft.title,
                description: description || existingDraft.description,
                artist: artist || existingDraft.artist,
                updated_at: new Date().toISOString()
            };

            if (imageUrl) {
                updateData.image_url = imageUrl;
            }

            const { data, error } = await supabase
                .from('uploads')
                .update(updateData)
                .eq('id', existingDraft.id)
                .select();

            if (error) {
                console.error("Error updating draft:", error);
                throw error;
            }
            result = data[0];
        } else {
            // 创建新草稿
            const { data, error } = await supabase
                .from('uploads')
                .insert([{
                    user_id: userId,
                    category: category || '',
                    title: title || '',
                    description: description || '',
                    artist: artist || '',
                    image_url: imageUrl,
                    status: 'draft',
                    date: new Date().toISOString().split('T')[0]
                }])
                .select();

            if (error) {
                console.error("Error creating draft:", error);
                throw error;
            }
            result = data[0];
        }

        // 🔥 优化：在成功保存后删除旧图片
        if (oldImagePathToDelete) {
            try {
                const { error: deleteError } = await supabase
                    .storage
                    .from('artworks')
                    .remove([oldImagePathToDelete]);

                if (deleteError) {
                    console.warn("Failed to delete old draft image (non-critical):", deleteError);
                } else {
                    // console.log(`Deleted old draft image: ${oldImagePathToDelete}`);
                }
            } catch (deleteError) {
                console.warn("Error deleting old image (non-critical):", deleteError);
            }
        }

        res.json({
            success: true,
            draft: result
        });
    } catch (error) {
        console.error('Error saving draft:', error);
        res.status(500).json({ error: "Failed to save draft: " + error.message });
    }
});

// 提交审核
app.post("/api/upload/submit", async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
    }

    try {
        // 获取用户的草稿
        const { data: draft, error: draftError } = await supabase
            .from('uploads')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'draft')
            .single();

        if (draftError || !draft) {
            return res.status(404).json({ error: "No draft found to submit" });
        }

        // 验证必要字段
        if (!draft.image_url || !draft.category || !draft.title || !draft.description) {
            return res.status(400).json({
                error: "Please complete all required fields: image, category, and title"
            });
        }

        // 开始事务：移动草稿到审核表并删除原草稿
        const { data: reviewItem, error: reviewError } = await supabase
            .from('review')
            .insert([{
                user_id: draft.user_id,
                category: draft.category,
                title: draft.title,
                description: draft.description,
                artist: draft.artist,
                image_url: draft.image_url,
                date: draft.date,
                status: 'pending',
                submitted_at: new Date().toISOString()
            }])
            .select();

        if (reviewError) {
            console.error("Error creating review item:", reviewError);
            return res.status(500).json({ error: "Failed to submit for review" });
        }

        // 删除草稿
        const { error: deleteError } = await supabase
            .from('uploads')
            .delete()
            .eq('id', draft.id);

        if (deleteError) {
            console.error("Error deleting draft:", deleteError);
            // 不返回错误，因为审核项目已经创建成功
        }

        res.json({
            success: true,
            message: "Artwork submitted for review successfully",
            reviewItem: reviewItem[0]
        });
    } catch (error) {
        console.error('Error submitting for review:', error);
        res.status(500).json({ error: "Server error" });
    }
});

// 删除草稿
app.delete("/api/upload/draft", async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
    }

    try {
        // 获取草稿以删除图片
        const { data: draft, error: fetchError } = await supabase
            .from('uploads')
            .select('image_url')
            .eq('user_id', userId)
            .eq('status', 'draft')
            .single();

        // 🔥 优化：无论是否找到草稿记录，都尝试清理相关的图片文件
        let imagesToDelete = [];

        if (!fetchError && draft && draft.image_url) {
            // 删除当前草稿的图片
            const filePath = draft.image_url.split('/artworks/')[1];
            if (filePath && !filePath.includes('default-')) {
                imagesToDelete.push(filePath);
            }
        }

        // 🔥 新增：清理该用户所有旧的草稿图片（防止有孤立的图片文件）
        try {
            const { data: oldImages, error: listError } = await supabase
                .storage
                .from('artworks')
                .list('upload-drafts', {
                    search: `draft-${userId}-`
                });

            if (!listError && oldImages) {
                // 添加所有找到的旧图片到删除列表
                oldImages.forEach(img => {
                    imagesToDelete.push(`upload-drafts/${img.name}`);
                });
            }
        } catch (listError) {
            console.warn("Error listing old draft images:", listError);
        }

        // 删除所有找到的图片
        if (imagesToDelete.length > 0) {
            const { error: deleteError } = await supabase
                .storage
                .from('artworks')
                .remove(imagesToDelete);

            if (deleteError) {
                console.warn("Failed to delete some draft images:", deleteError);
            } else {
                console.log(`Deleted ${imagesToDelete.length} draft images for user ${userId}`);
            }
        }

        // 删除草稿记录
        const { error: deleteError } = await supabase
            .from('uploads')
            .delete()
            .eq('user_id', userId)
            .eq('status', 'draft');

        if (deleteError) {
            console.error("Error deleting draft record:", deleteError);
            return res.status(500).json({ error: "Failed to delete draft: " + deleteError.message });
        }

        res.json({
            success: true,
            message: "Draft and associated images deleted successfully",
            deletedImages: imagesToDelete.length
        });
    } catch (error) {
        console.error('Error deleting draft:', error);
        res.status(500).json({ error: "Server error: " + error.message });
    }
});

// 管理员获取待审核列表
app.get("/api/review/pending", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('review')
            .select(`
        *,
        users:user_id (
          username,
          avatar_url
        )
      `)
            .eq('status', 'pending')
            .order('submitted_at', { ascending: true });

        if (error) {
            console.error('Error fetching pending reviews:', error);
            return res.status(500).json({ error: "Database error" });
        }

        res.json({ items: data || [] });
    } catch (error) {
        console.error('Error in /api/review/pending:', error);
        res.status(500).json({ error: "Server error" });
    }
});

// 审核通过
app.post("/api/review/approve", async (req, res) => {
    const { reviewId } = req.body;

    if (!reviewId) {
        return res.status(400).json({ error: "Review ID is required" });
    }

    try {
        // 获取审核项目
        const { data: reviewItem, error: fetchError } = await supabase
            .from('review')
            .select('*')
            .eq('id', reviewId)
            .single();

        if (fetchError || !reviewItem) {
            return res.status(404).json({ error: "Review item not found" });
        }

        // 获取用户信息以获取头像
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('avatar_url')
            .eq('id', reviewItem.user_id)
            .single();

        const userAvatar = userData?.avatar_url || null;

        // 获取该分类下的最大 ID
        const { data: maxIdData, error: maxIdError } = await supabase
            .from('artworks')
            .select('id')
            .eq('category', reviewItem.category)
            .order('id', { ascending: false })
            .limit(1);

        let newId;
        if (maxIdData && maxIdData.length > 0) {
            newId = maxIdData[0].id + 1;

            // 检查是否超出分类范围
            const baseId = CATEGORY_BASE_IDS[reviewItem.category];
            const nextCategoryBase = Object.values(CATEGORY_BASE_IDS)
                .sort((a, b) => a - b)
                .find(id => id > baseId) || (baseId + 10000);

            if (newId >= nextCategoryBase) {
                return res.status(400).json({
                    error: `Category ${reviewItem.category} has reached maximum capacity`
                });
            }
        } else {
            newId = CATEGORY_BASE_IDS[reviewItem.category] || 10000;
        }

        // 插入到艺术品表
        const { data: artwork, error: insertError } = await supabase
            .from('artworks')
            .insert([{
                id: newId,
                category: reviewItem.category,
                title: reviewItem.title,
                artist: reviewItem.artist,
                image_url: reviewItem.image_url,
                description: reviewItem.description,
                date: reviewItem.date,
                user_id: reviewItem.user_id,
                user_avatar: userAvatar, // 新增：存储用户头像
                liked_by: []
            }])
            .select();

        if (insertError) {
            console.error("Error inserting artwork:", insertError);
            return res.status(500).json({ error: "Failed to create artwork" });
        }

        // 删除审核项目
        const { error: deleteError } = await supabase
            .from('review')
            .delete()
            .eq('id', reviewId);

        if (deleteError) {
            console.error("Error deleting review item:", deleteError);
            // 不返回错误，因为艺术品已经创建成功
        }

        res.json({
            success: true,
            message: "Artwork approved and published successfully",
            artwork: artwork[0]
        });
    } catch (error) {
        console.error('Error approving review:', error);
        res.status(500).json({ error: "Server error" });
    }
});

// 审核拒绝
app.post("/api/review/reject", async (req, res) => {
    const { reviewId, reason } = req.body;

    if (!reviewId) {
        return res.status(400).json({ error: "Review ID is required" });
    }

    try {
        // 获取审核项目以获取图片URL
        const { data: reviewItem, error: fetchError } = await supabase
            .from('review')
            .select('image_url')
            .eq('id', reviewId)
            .single();

        if (!fetchError && reviewItem && reviewItem.image_url) {
            // 从URL中提取文件路径并删除图片
            const filePath = reviewItem.image_url.split('/artworks/')[1];
            if (filePath) {
                await supabase.storage.from('artworks').remove([filePath]);
            }
        }

        // 删除审核项目
        const { error: deleteError } = await supabase
            .from('review')
            .delete()
            .eq('id', reviewId);

        if (deleteError) {
            console.error("Error rejecting review item:", deleteError);
            return res.status(500).json({ error: "Failed to reject artwork" });
        }

        res.json({
            success: true,
            message: "Artwork rejected successfully"
        });
    } catch (error) {
        console.error('Error rejecting review:', error);
        res.status(500).json({ error: "Server error" });
    }
});

// 获取审核统计信息
app.get("/api/review/stats", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('review')
            .select('*', { count: 'exact' })
            .eq('status', 'pending');

        if (error) {
            console.error('Error fetching review stats:', error);
            return res.status(500).json({ error: "Database error" });
        }

        res.json({
            totalPending: data.length
        });
    } catch (error) {
        console.error('Error in /api/review/stats:', error);
        res.status(500).json({ error: "Server error" });
    }
});

// 获取特定审核项目
app.get("/api/review/item/:reviewId", async (req, res) => {
    const { reviewId } = req.params;

    try {
        const { data, error } = await supabase
            .from('review')
            .select(`
        *,
        users:user_id (
          username,
          avatar_url
        )
      `)
            .eq('id', reviewId)
            .single();

        if (error) {
            console.error('Error fetching review item:', error);
            return res.status(404).json({ error: "Review item not found" });
        }

        res.json({ item: data });
    } catch (error) {
        console.error('Error in /api/review/item/:reviewId:', error);
        res.status(500).json({ error: "Server error" });
    }
});

// 获取下一个审核项目
app.get("/api/review/next/:currentId", async (req, res) => {
    const { currentId } = req.params;

    try {
        // 获取所有待审核项目的ID
        const { data: allPending, error } = await supabase
            .from('review')
            .select('id')
            .eq('status', 'pending')
            .order('submitted_at', { ascending: true });

        if (error) {
            console.error('Error fetching pending reviews:', error);
            return res.status(500).json({ error: "Database error" });
        }

        if (!allPending || allPending.length === 0) {
            return res.json({ nextItem: null });
        }

        const currentIndex = allPending.findIndex(item => item.id == currentId);
        let nextIndex = currentIndex + 1;

        // 循环到第一个
        if (nextIndex >= allPending.length) {
            nextIndex = 0;
        }

        const nextId = allPending[nextIndex].id;

        // 获取下一个项目的完整信息
        const { data: nextItem, error: itemError } = await supabase
            .from('review')
            .select(`
        *,
        users:user_id (
          username,
          avatar_url
        )
      `)
            .eq('id', nextId)
            .single();

        if (itemError) {
            console.error('Error fetching next review item:', itemError);
            return res.status(500).json({ error: "Failed to fetch next item" });
        }

        res.json({
            nextItem,
            currentIndex: nextIndex,
            totalCount: allPending.length
        });
    } catch (error) {
        console.error('Error in /api/review/next/:currentId:', error);
        res.status(500).json({ error: "Server error" });
    }
});

// 获取上一个审核项目
app.get("/api/review/previous/:currentId", async (req, res) => {
    const { currentId } = req.params;

    try {
        // 获取所有待审核项目的ID
        const { data: allPending, error } = await supabase
            .from('review')
            .select('id')
            .eq('status', 'pending')
            .order('submitted_at', { ascending: true });

        if (error) {
            console.error('Error fetching pending reviews:', error);
            return res.status(500).json({ error: "Database error" });
        }

        if (!allPending || allPending.length === 0) {
            return res.json({ previousItem: null });
        }

        const currentIndex = allPending.findIndex(item => item.id == currentId);
        let previousIndex = currentIndex - 1;

        // 循环到最后一个
        if (previousIndex < 0) {
            previousIndex = allPending.length - 1;
        }

        const previousId = allPending[previousIndex].id;

        // 获取上一个项目的完整信息
        const { data: previousItem, error: itemError } = await supabase
            .from('review')
            .select(`
        *,
        users:user_id (
          username,
          avatar_url
        )
      `)
            .eq('id', previousId)
            .single();

        if (itemError) {
            console.error('Error fetching previous review item:', itemError);
            return res.status(500).json({ error: "Failed to fetch previous item" });
        }

        res.json({
            previousItem,
            currentIndex: previousIndex,
            totalCount: allPending.length
        });
    } catch (error) {
        console.error('Error in /api/review/previous/:currentId:', error);
        res.status(500).json({ error: "Server error" });
    }
});

// ========== 启动服务器 ==========
server.listen(PORT, async () => {
    try {
        console.log(`🚀 Server starting on ${SERVER_URL}...`);
        await initializeServer();
        console.log(`🎯 Server ready on ${SERVER_URL}`);
    } catch (error) {
        console.error('💥 Failed to start server:', error);
        process.exit(1);
    }
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('🛑 Server shutting down gracefully...');
    cache.clear();
    server.close(() => {
        console.log('✅ Server shut down');
        process.exit(0);
    });
});

// ========== 导出模块 ==========
module.exports = {
    app,
    server,
    io,
    supabase
};
