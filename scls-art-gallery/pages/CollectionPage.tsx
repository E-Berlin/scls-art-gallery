// pages/CollectionPage.tsx
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import { SERVER_URL } from "../config/config";
import { useUser } from "../context/UserContext";
import ArtworkOverlay from "../components/ArtworkOverlay";
import "./CollectionPage.css";

interface Artwork {
    id: number;
    title: string;
    artist: string;
    imageUrl: string;
    liked: boolean;
    description: string;
    date: string;
    likes: number;
    userAvatar?: string; // 新增：作者头像
}

const containerVariants: Variants = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: 0.2,
        },
    },
};

const cardVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.7,
            ease: [0.25, 0.1, 0.25, 1]
        }
    },
};

const CollectionPage: React.FC = () => {
    const { category } = useParams<{ category: string }>();
    const { user } = useUser();
    const [artworks, setArtworks] = useState<Artwork[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null);
    const [overlayVisible, setOverlayVisible] = useState(false);

    // 从后端获取艺术品数据
    useEffect(() => {
        const fetchArtworks = async () => {
            if (!category) return;

            try {
                setLoading(true);
                console.log('Fetching artworks with user:', user);

                // 如果用户已登录，传递用户ID
                const url = user
                    ? `${SERVER_URL}/api/artworks/${category}?userId=${user.id}`
                    : `${SERVER_URL}/api/artworks/${category}`;

                console.log('Fetching from URL:', url);

                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    setArtworks(data);
                } else {
                    console.error('Failed to fetch artworks');
                    setArtworks([]);
                }
            } catch (error) {
                console.error('Error fetching artworks:', error);
                setArtworks([]);
            } finally {
                setLoading(false);
            }
        };

        fetchArtworks();
    }, [category, user]); // 添加user作为依赖

    // 打开 Overlay
    const openOverlay = (artwork: Artwork) => {
        setSelectedArtwork(artwork);
        setOverlayVisible(true);
    };

    // 关闭 Overlay
    const closeOverlay = () => {
        setOverlayVisible(false);
    };

    // 切换点赞状态
    const toggleLike = async (artwork: Artwork) => {
        if (!user) {
            alert('Please login to like artworks');
            return;
        }

        console.log('Toggling like for artwork:', artwork.id, 'user:', user.id);

        try {
            const response = await fetch(`${SERVER_URL}/api/artworks/like`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: artwork.id,
                    category: category,
                    userId: user.id
                }),
            });

            console.log('Response status:', response.status);

            if (response.ok) {
                const result = await response.json();
                console.log('Like result:', result);

                // 立即更新 UI
                const updated = artworks.map(a =>
                    a.id === artwork.id
                        ? {
                            ...a,
                            liked: result.liked,
                            likes: result.likes,
                        }
                        : a
                );

                setArtworks(updated);

                // 如果当前选中的艺术品是同一个，也更新它
                if (selectedArtwork && selectedArtwork.id === artwork.id) {
                    setSelectedArtwork(prev =>
                        prev ? { ...prev, liked: result.liked, likes: result.likes } : null
                    );
                }
            } else {
                const error = await response.json();
                console.error('Failed to update like:', error);
                alert('Failed to update like: ' + error.error);
            }
        } catch (error) {
            console.error('Error updating like:', error);
            alert('Network error when updating like');
        }
    };

    if (loading) {
        return (
            <div className="collection-page">
                <div className="loading">Loading artworks...</div>
            </div>
        );
    }

    return (
        <div className="collection-page">
            <motion.h1
                className="collection-title"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
            >
                {category?.replace(/-/g, " ").toUpperCase()} COLLECTION
            </motion.h1>

            <motion.div
                className="collection-grid"
                initial="hidden"
                animate="visible"
                variants={containerVariants}
            >
                {artworks.length > 0 ? (
                    artworks.map(a => (
                        <motion.div
                            key={a.id}
                            className="artwork-card"
                            variants={cardVariants}
                            onClick={() => openOverlay(a)}
                        >
                            <div className="image-wrapper">
                                <img src={a.imageUrl} alt={a.title} />
                                <div className="hover-overlay">
                                    <span className="hover-overlay-text">View Details</span>
                                </div>
                            </div>
                            <div className="card-footer">
                                <div className="title">{a.title}</div>
                                <div className="artist">{a.artist}</div>
                                <div className="likes-count">{a.likes} {a.likes === 1 ? 'Like' : 'Likes'}</div>
                            </div>
                        </motion.div>
                    ))
                ) : (
                    <div className="no-artworks">
                        No artworks found in this collection.
                    </div>
                )}
            </motion.div>

            {selectedArtwork && (
                <ArtworkOverlay
                    artwork={selectedArtwork}
                    visible={overlayVisible}
                    onClose={closeOverlay}
                    onToggleLike={() => toggleLike(selectedArtwork)}
                />
            )}
        </div>
    );
};

export default CollectionPage;