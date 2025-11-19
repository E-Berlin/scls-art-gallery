// components/ArtworkOverlay.tsx
import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useUser } from "../context/UserContext";
import "./ArtworkOverlay.css";

interface Artwork {
    id: number;
    title: string;
    artist: string;
    imageUrl: string;
    description: string;
    date: string;
    likes: number;
    liked: boolean;
    userAvatar?: string; // 新增：作者头像
}

interface ArtworkOverlayProps {
    artwork: Artwork;
    visible: boolean;
    onClose: () => void;
    onToggleLike: () => void;
}

const ArtworkOverlay: React.FC<ArtworkOverlayProps> = ({
    artwork,
    visible,
    onClose,
    onToggleLike,
}) => {
    const { user } = useUser();
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    const [scale, setScale] = useState(1);
    const [minScale, setMinScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const offsetStart = useRef({ x: 0, y: 0 });

    // ✅ 只在切换作品时重置，不影响点赞
    useEffect(() => {
        setOffset({ x: 0, y: 0 });
        setScale(1);
    }, [artwork.id]);

    // 图片加载完成计算最小缩放
    const handleImgLoad = () => {
        if (!imgRef.current || !containerRef.current) return;

        const img = imgRef.current;
        const container = containerRef.current;

        const containerWidth = container.offsetWidth;
        const containerHeight = container.offsetHeight;
        const imgWidth = img.naturalWidth;
        const imgHeight = img.naturalHeight;

        const imgRatio = imgWidth / imgHeight;

        const calculatedMinScale =
            imgRatio < 1
                ? containerHeight / imgHeight // 宽>高 → 高度撑满
                : containerWidth / imgWidth;  // 宽<高 → 宽度撑满

        setMinScale(calculatedMinScale);
        setScale(calculatedMinScale);
        setOffset({ x: 0, y: 0 });
    };

    // 处理点赞点击
    const handleLikeClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // 阻止拖动

        if (!user) {
            alert('Please login to like this artwork');
            return;
        }

        onToggleLike();
    };

    if (!visible) return null;

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY };
        offsetStart.current = { ...offset };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        setOffset({
            x: offsetStart.current.x + dx,
            y: offsetStart.current.y + dy,
        });
    };

    const handleMouseUp = () => setIsDragging(false);
    const handleMouseLeave = () => setIsDragging(false);

    const handleReset = () => {
        setScale(minScale);
        setOffset({ x: 0, y: 0 });
    };

    return (
        <motion.div
            className="overlay-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
        >
            <motion.div
                className="overlay-container"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* 左边图片 */}
                <div
                    className="overlay-left"
                    ref={containerRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                >
                    <img
                        ref={imgRef}
                        src={artwork.imageUrl}
                        alt={artwork.title}
                        style={{
                            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                            cursor: isDragging ? "grabbing" : "grab",
                            transition: isDragging ? "none" : "transform 0.2s ease-out"
                        }}
                        onLoad={handleImgLoad}
                        draggable={false}
                    />

                    {/* 缩放控制 */}
                    <div className="zoom-controls">
                        <button onClick={() => setScale((s) => Math.min(s + 0.2, 3))}>+</button>
                        <button onClick={() => setScale((s) => Math.max(s - 0.2, minScale))}>-</button>
                        <button onClick={handleReset}>Reset</button>
                    </div>
                </div>

                {/* 右边信息 */}
                <div className="overlay-right">
                    <div className="overlay-top">
                        <button className="close-btn" onClick={onClose}>×</button>
                        <h2>{artwork.title}</h2>
                        {/* 显示艺术家头像和名字在同一行 */}
                        <div className="artist-row">
                            {artwork.userAvatar && (
                                <img
                                    src={artwork.userAvatar}
                                    alt={artwork.artist}
                                    className="artist-avatar"
                                />
                            )}
                            <h3>{artwork.artist}</h3>
                        </div>
                        <h4>DESCRIPTION</h4>
                        <p className="description">{artwork.description}</p>
                        <p className="date">{artwork.date}</p>
                    </div>
                    <div className="like-row">
                        <button
                            className={`like-btn ${artwork.liked ? "liked" : ""} ${!user ? "disabled" : ""}`}
                            onClick={handleLikeClick}
                            // 移除了 disabled 属性，因为禁用的按钮不会触发 onClick
                            title={!user ? "Please login to like" : artwork.liked ? "Unlike" : "Like"}
                        >
                            {artwork.liked ? "❤️" : "🤍"}
                        </button>
                        <span>{artwork.likes} {artwork.likes === 1 ? 'Like' : 'Likes'}</span>
                        {!user && (
                            <span className="login-hint">Login to like</span>
                        )}
                        {user && artwork.liked && (
                            <span className="you-liked-hint">You liked this</span>
                        )}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default ArtworkOverlay;