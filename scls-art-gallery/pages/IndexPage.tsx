// pages/IndexPage.tsx
import React, { useRef, useEffect, useState } from "react";
import { usePageTransition } from "../context/PageTransitionContext";
import { SUPABASE_URL } from "../src/config"
import FadeInImage from "../components/FadeInImage";
import AnimatedButtonIndex from "../components/AnimatedButtonIndex";
import OrbitAroundLogo from "../components/OrbitAroundLogo";
import OrbitParticles from "../components/OrbitParticles";
import "./IndexPage.css";

const IndexPage: React.FC = () => {
    const { navigateWithTransition } = usePageTransition();
    const logoRef = useRef<HTMLImageElement>(null);
    const [logoPosition, setLogoPosition] = useState({ x: 0, y: 0 });

    const BUILDING_BG = `${SUPABASE_URL}/storage/v1/object/public/default-imgs/building.jpg`;
    const LOGO = `${SUPABASE_URL}/storage/v1/object/public/default-imgs/logo.jpg`;

    console.log(BUILDING_BG);

    // 获取校徽的位置
    useEffect(() => {
        if (logoRef.current) {
            const rect = logoRef.current.getBoundingClientRect();
            setLogoPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        }
    }, []);


    return (
        <div className="index-page">
            {/* 背景建筑 + 蒙版 */}
            <div className="background-container">
                <img src={BUILDING_BG} alt="School Building" />
                <div className="gradient-overlay" />
            </div>

            {/* 动态艺术特效 */}
            <OrbitParticles />

            {/* 粒子/光斑特效 */}
            <OrbitAroundLogo />

            {/* 校徽 */}
            <FadeInImage
                src={LOGO}
                alt="School Logo"
                className="school-logo"
                ref={logoRef}
            />

            {/* 校名文字 */}
            <div className="school-name">
                <h2>SOONG CHING LING SCHOOL</h2>
                <h3>宋庆龄学校国内部高中</h3>
            </div>

            {/* 中间介绍文字 */}
            <div className="gallery-info">
                <h1>ART GALLERY</h1>
                <p>探索艺术的无限可能 · 感受创意的独特魅力</p>
            </div>

            <div className="button-group">
                <AnimatedButtonIndex
                    text="进入画廊 ENTER GALLERY"
                    onClick={() => navigateWithTransition("/gallery")}
                    delay={1.8} // 保留动画延迟
                />
                <AnimatedButtonIndex
                    text="艺术游戏 ART GAME"
                    onClick={() => navigateWithTransition("/game")}
                    delay={1.9} // 保留动画延迟
                />
            </div>
        </div>
    );
};

export default IndexPage;
