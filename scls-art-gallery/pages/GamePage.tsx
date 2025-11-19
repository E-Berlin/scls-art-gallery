// pages/GamePage.tsx
import React from "react";
import { FaGamepad, FaRegLightbulb } from "react-icons/fa";
import { LuGamepad2 } from "react-icons/lu";
import { MdGroups } from "react-icons/md";
import { motion, type Variants } from "framer-motion";
import { usePageTransition } from "../context/PageTransitionContext";
import { useUser } from "../context/UserContext";
import { SUPABASE_URL } from "../config/config"
import BackgroundSlider from "../components/BackgroundSlider";
import ScrollMask from "../components/ScrollMask";
import "./GamePage.css";

const bgImages = [
    `${SUPABASE_URL}/storage/v1/object/public/default-imgs/artWorkImage1.jpg`,
    `${SUPABASE_URL}/storage/v1/object/public/default-imgs/artWorkImage2.jpg`,
    `${SUPABASE_URL}/storage/v1/object/public/default-imgs/artWorkImage3.jpg`,
    `${SUPABASE_URL}/storage/v1/object/public/default-imgs/artWorkImage4.jpg`,
    `${SUPABASE_URL}/storage/v1/object/public/default-imgs/artWorkImage5.jpg`,
    `${SUPABASE_URL}/storage/v1/object/public/default-imgs/artWorkImage6.jpg`
];

const imgs = [
    `${SUPABASE_URL}/storage/v1/object/public/default-imgs/gameImage1.jpg`,
    `${SUPABASE_URL}/storage/v1/object/public/default-imgs/gameImage2.jpg`,
    `${SUPABASE_URL}/storage/v1/object/public/default-imgs/gameImage0.jpg`,
    `${SUPABASE_URL}/storage/v1/object/public/default-imgs/gameImage0.jpg`,
];

const titles = [
    "Collective Canvas",
    "Draw & Guess",
    "Game3",
    "Game4",
];

const subtitles = [
    "集体巨画",
    "你画我猜",
    "敬请期待",
    "敬请期待",
];


const icons = [
    <MdGroups />,
    <FaRegLightbulb />,
    <FaGamepad />,
    <FaGamepad />,
];

// 在文件顶部定义动画 variants
// 父容器
const containerVariants: Variants = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: 0.2, // 每个 section block 浮现间隔
        },
    },
};

// 每个卡片
const blockVariants: Variants = {
    hidden: { opacity: 0, y: 30 }, // y 控制浮现距离
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.7,
            ease: [0.25, 0.1, 0.25, 1] // ✅ TS 认可的 cubic-bezier 数组
        }
    },
};

const GamePage: React.FC = () => {
    const { navigateWithTransition } = usePageTransition();
    const { user } = useUser(); // ✅ 获取当前登录状态

    return (
        <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>

            <div className="background-container">
                {/* 背景放在最先渲染且 z 低的位置 */}
                <BackgroundSlider images={bgImages} interval={3000} />
                <div className="gradient-overlay" />
            </div>

            {/* ScrollMask 蒙版 */}
            <ScrollMask
                initialHeight={0}
                offsetTop={0}
                overlayOffsetY={50}
                title="ART GAMES"
                subTitle="艺术游戏精选"
                icon={<LuGamepad2 />}
                scrollMaskTitle="EXPLORE GAMES"
            >
                <motion.div
                    className="image-grid"
                    initial="hidden"
                    whileInView="visible"   // 元素进入视口时触发
                    viewport={{ once: false, amount: 0.2 }} // once: false → 每次进入都会触发
                    variants={containerVariants}
                >
                    {imgs.map((src, i) => (
                        <motion.div
                            key={i}
                            className="image-block cursor-pointer"
                            variants={blockVariants}
                            onClick={() => {
                                if (!user) {
                                    alert("Please log in first!");
                                    return;
                                }

                                if (i === 0) { // Collective Canvas
                                    navigateWithTransition("/game/collective-canvas");
                                } else if (i === 1) { // Draw & Guess
                                    navigateWithTransition("/game/draw-guess");
                                } else {
                                    alert("More games coming soon.");
                                }
                            }}
                        >
                            <img src={src} alt={`Image ${i + 1}`} />
                            <div className="image-label">
                                <div className="image-label-icon">{icons[i]}</div> {/* 对应每张图片的 icon */}
                                <h4>{titles[i]}</h4>
                                <p>{subtitles[i]}</p>
                            </div>
                            <div className="emerging-text">Play Game →</div>
                        </motion.div>
                    ))}
                </motion.div>
            </ScrollMask >

            {/* 页面主内容（示例）：放在一个有 z-index 的容器上 */}
            < div
                style={{
                    position: "relative",
                    zIndex: 10, /* 确保内容在 navbar 之下或之上，按需调整 */
                    paddingTop: 80, /* 避免被 navbar 遮挡（navbar 高度约 64px） */
                }}
            >
                {/* 暂时不显示画廊图片，仅测试 navbar + 背景 */}
            </div >
        </div >
    );
};

export default GamePage;