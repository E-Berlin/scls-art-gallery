// pages/GalleryPage.tsx
import BackgroundSlider from "../components/BackgroundSlider";
import ScrollMask from "../components/ScrollMask";
import { FaImages, FaCamera, FaRegImage, FaPalette, FaPenFancy, FaFeatherAlt, FaLayerGroup } from "react-icons/fa";
import { usePageTransition } from "../context/PageTransitionContext";
import { motion, type Variants } from "framer-motion";
import { SUPABASE_URL } from "../src/config"
import "./GalleryPage.css";

const bgImages = [
    `${SUPABASE_URL}/storage/v1/object/public/default-imgs/artWorkImage1.jpg`,
    `${SUPABASE_URL}/storage/v1/object/public/default-imgs/artWorkImage2.jpg`,
    `${SUPABASE_URL}/storage/v1/object/public/default-imgs/artWorkImage3.jpg`,
    `${SUPABASE_URL}/storage/v1/object/public/default-imgs/artWorkImage4.jpg`,
    `${SUPABASE_URL}/storage/v1/object/public/default-imgs/artWorkImage5.jpg`,
    `${SUPABASE_URL}/storage/v1/object/public/default-imgs/artWorkImage6.jpg`
];

const imgs = [
    `${SUPABASE_URL}/storage/v1/object/public/default-imgs/artImage1.jpg`,
    `${SUPABASE_URL}/storage/v1/object/public/default-imgs/artImage2.jpg`,
    `${SUPABASE_URL}/storage/v1/object/public/default-imgs/artImage3.jpg`,
    `${SUPABASE_URL}/storage/v1/object/public/default-imgs/artImage4.jpg`,
    `${SUPABASE_URL}/storage/v1/object/public/default-imgs/artImage5.jpg`,
    `${SUPABASE_URL}/storage/v1/object/public/default-imgs/artImage6.jpg`
];

const titles = [
    "Photography",
    "Art Printmaking",
    "Traditional Art",
    "Digital Art",
    "Birdwatching Club",
    "Mixed Media"
];

const subtitles = [
    "摄影作品",
    "美术课艺术版画",
    "传统艺术",
    "数字艺术",
    "观鸟社",
    "综合媒体"
];

const categories = [
    "photography",
    "art-printmaking",
    "traditional-art",
    "digital-art",
    "birdwatching-club",
    "mixed-media"
];

const icons = [
    <FaCamera />,
    <FaRegImage />,
    <FaPalette />,
    <FaPenFancy />,
    <FaFeatherAlt />,
    <FaLayerGroup />
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

const GalleryPage: React.FC = () => {
    const { navigateWithTransition } = usePageTransition();

    return (
        <div style={{
            position: "relative",
            width: "100vw", height: "100vh",
            overflow: "hidden",
        }}>

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
                title="ARTWORKS COLLECTIONS"
                subTitle="作品精选"
                icon={<FaImages />}
                scrollMaskTitle="EXPLORE COLLECTIONS"
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
                            onClick={() => navigateWithTransition(`/gallery/${categories[i]}`)}
                        >
                            <img src={src} alt={`Image ${i + 1}`} />
                            <div className="image-label">
                                <div className="image-label-icon">{icons[i]}</div>
                                <h4>{titles[i]}</h4>
                                <p>{subtitles[i]}</p>
                            </div>
                            <div className="emerging-text">View Collection →</div>
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

export default GalleryPage;
