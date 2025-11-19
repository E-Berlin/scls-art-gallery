// pages/ReviewPage.tsx
import React, { useState, useEffect } from "react";
import { usePageTransition } from "../context/PageTransitionContext";
import { useUser } from "../context/UserContext";
import { SERVER_URL, SUPABASE_URL } from "../config/config";
import AnimatedButton from "../components/AnimatedButton";
import "./ReviewPage.css";

interface ReviewItem {
    id: number;
    user_id: string;
    category: string;
    title: string;
    description: string;
    artist: string;
    image_url: string;
    date: string;
    submitted_at: string;
    users: {
        username: string;
        avatar_url: string;
    };
}

interface ReviewStats {
    totalPending: number;
}

const ReviewPage: React.FC = () => {
    const { navigateWithTransition } = usePageTransition();
    const { user } = useUser();

    const [currentItem, setCurrentItem] = useState<ReviewItem | null>(null);
    const [stats, setStats] = useState<ReviewStats>({ totalPending: 0 });
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const BUILDING_BG = `${SUPABASE_URL}/storage/v1/object/public/default-imgs/building.jpg`;

    // 分类显示名称映射
    const categoryNames: { [key: string]: string } = {
        "photography": "Photography",
        "art-printmaking": "Art Printmaking",
        "tranditional-art": "Traditional Art",
        "digital-art": "Digital Art",
        "birdwatching-club": "Birdwatching Club",
        "mixed-media": "Mixed Media"
    };

    const showMessage = (text: string, type: 'success' | 'error') => {
        setMessage({ text, type });
        setTimeout(() => setMessage(null), 5000);
    };

    // 检查用户权限
    useEffect(() => {
        if (user && user.role !== 'admin') {
            showMessage("Access denied. Admin privileges required.", 'error');
            setTimeout(() => {
                navigateWithTransition("/gallery");
            }, 2000);
        }
    }, [user, navigateWithTransition]);

    // 加载审核统计和第一个项目
    useEffect(() => {
        if (user && user.role === 'admin') {
            loadReviewData();
        }
    }, [user]);

    const loadReviewData = async () => {
        setIsLoading(true);
        try {
            // 加载统计信息
            const statsResponse = await fetch(`${SERVER_URL}/api/review/stats`);
            const statsData = await statsResponse.json();

            if (!statsResponse.ok) {
                throw new Error(statsData.error || "Failed to load review stats");
            }

            setStats(statsData);

            // 加载待审核列表并获取第一个项目
            const pendingResponse = await fetch(`${SERVER_URL}/api/review/pending`);
            const pendingData = await pendingResponse.json();

            if (!pendingResponse.ok) {
                throw new Error(pendingData.error || "Failed to load pending reviews");
            }

            if (pendingData.items && pendingData.items.length > 0) {
                setCurrentItem(pendingData.items[0]);
                setCurrentIndex(0);
            } else {
                setCurrentItem(null);
            }
        } catch (err: any) {
            showMessage(err.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const loadNextItem = async () => {
        if (!currentItem) return;

        try {
            const response = await fetch(`${SERVER_URL}/api/review/next/${currentItem.id}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to load next item");
            }

            if (data.nextItem) {
                setCurrentItem(data.nextItem);
                setCurrentIndex(data.currentIndex);
            }
        } catch (err: any) {
            showMessage(err.message, 'error');
        }
    };

    const loadPreviousItem = async () => {
        if (!currentItem) return;

        try {
            const response = await fetch(`${SERVER_URL}/api/review/previous/${currentItem.id}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to load previous item");
            }

            if (data.previousItem) {
                setCurrentItem(data.previousItem);
                setCurrentIndex(data.currentIndex);
            }
        } catch (err: any) {
            showMessage(err.message, 'error');
        }
    };

    const handleApprove = async () => {
        if (!currentItem) return;

        setIsProcessing(true);
        try {
            const response = await fetch(`${SERVER_URL}/api/review/approve`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    reviewId: currentItem.id
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to approve artwork");
            }

            showMessage("Artwork approved and published successfully!", 'success');

            // 重新加载数据
            setTimeout(() => {
                loadReviewData();
            }, 1500);

        } catch (err: any) {
            showMessage(err.message, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!currentItem) return;

        setIsProcessing(true);
        try {
            const response = await fetch(`${SERVER_URL}/api/review/reject`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    reviewId: currentItem.id,
                    reason: "Not meeting quality standards" // 可以添加拒绝原因输入框
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to reject artwork");
            }

            showMessage("Artwork rejected successfully", 'success');

            // 重新加载数据
            setTimeout(() => {
                loadReviewData();
            }, 1500);

        } catch (err: any) {
            showMessage(err.message, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    if (!user || user.role !== 'admin') {
        return (
            <div className="review-page">
                <div className="background-container">
                    <img src={BUILDING_BG} alt="School Building" />
                    <div className="gradient-overlay" />
                </div>
                <div className="review-container">
                    <div className="review-message review-error">
                        Admin privileges required to access this page
                    </div>
                    <AnimatedButton
                        text="BACK TO GALLERY"
                        onClick={() => navigateWithTransition("/gallery")}
                        delay={0.2}
                    />
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="review-page">
                <div className="background-container">
                    <img src={BUILDING_BG} alt="School Building" />
                    <div className="gradient-overlay" />
                </div>
                <div className="review-container">
                    <div className="review-loading">Loading review items...</div>
                </div>
            </div>
        );
    }

    if (!currentItem) {
        return (
            <div className="review-page">
                <div className="background-container">
                    <img src={BUILDING_BG} alt="School Building" />
                    <div className="gradient-overlay" />
                </div>
                <div className="review-container">
                    <div className="review-empty">
                        <div className="review-empty-icon">🎨</div>
                        <div className="review-empty-title">No Pending Reviews</div>
                        <div className="review-empty-subtitle">
                            There are no artworks waiting for review at the moment.
                        </div>
                        <AnimatedButton
                            text="BACK TO GALLERY"
                            onClick={() => navigateWithTransition("/gallery")}
                            delay={0.2}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="review-page">
            <div className="background-container">
                <img src={BUILDING_BG} alt="School Building" />
                <div className="gradient-overlay" />
            </div>

            <div className="review-scroll-container">
                <div className="review-container">
                    {/* 自动消失的消息 */}
                    {message && (
                        <div className={`review-message review-${message.type} ${message.type === 'success' ? 'review-success' : 'review-error'}`}>
                            {message.text}
                        </div>
                    )}

                    {/* 顶部导航和统计信息 */}
                    <div className="review-header">
                        <div className="review-nav-section">
                            <button
                                className="review-nav-button review-prev-button"
                                onClick={loadPreviousItem}
                                disabled={isProcessing}
                                aria-label="Previous artwork"
                                title="Previous artwork"
                            >
                                <span className="review-nav-arrow">←</span>
                                <span className="review-nav-text">Previous</span>
                            </button>

                            <div className="review-stats">
                                <div className="review-stat-item">
                                    <span className="review-stat-label">Current</span>
                                    <span className="review-stat-value">{currentIndex + 1}</span>
                                </div>
                                <div className="review-stat-divider">/</div>
                                <div className="review-stat-item">
                                    <span className="review-stat-label">Total</span>
                                    <span className="review-stat-value">{stats.totalPending}</span>
                                </div>
                            </div>

                            <button
                                className="review-nav-button review-next-button"
                                onClick={loadNextItem}
                                disabled={isProcessing}
                                aria-label="Next artwork"
                                title="Next artwork"
                            >
                                <span className="review-nav-text">Next</span>
                                <span className="review-nav-arrow">→</span>
                            </button>
                        </div>
                    </div>

                    {/* 艺术品图片区域 */}
                    <div className="review-image-section">
                        <div className="review-image-wrapper">
                            <img
                                src={currentItem.image_url}
                                alt={currentItem.title}
                                className="review-image"
                                onError={(e) => {
                                    // 图片加载失败时显示占位符
                                    e.currentTarget.src = `${SUPABASE_URL}/storage/v1/object/public/default-imgs/default-artwork.jpg`;
                                }}
                            />
                        </div>
                    </div>

                    {/* 艺术品信息区域 */}
                    <div className="review-info-section">
                        <h2 className="review-section-title">ARTWORK DETAILS</h2>

                        <div className="review-info-grid">
                            {/* 分类 */}
                            <div className="review-info-item">
                                <span className="review-info-label">Category</span>
                                <span className="review-info-value">
                                    {categoryNames[currentItem.category] || currentItem.category}
                                </span>
                            </div>

                            {/* 标题 */}
                            <div className="review-info-item">
                                <span className="review-info-label">Title</span>
                                <span className="review-info-value review-info-title">
                                    {currentItem.title}
                                </span>
                            </div>

                            {/* 艺术家 */}
                            <div className="review-info-item">
                                <span className="review-info-label">Artist</span>
                                <span className="review-info-value">
                                    {currentItem.artist || currentItem.users?.username}
                                </span>
                            </div>

                            {/* 提交日期 */}
                            <div className="review-info-item">
                                <span className="review-info-label">Submitted Date</span>
                                <span className="review-info-value">
                                    {formatDate(currentItem.submitted_at)}
                                </span>
                            </div>

                            {/* 描述 */}
                            {currentItem.description && (
                                <div className="review-info-item review-info-item-full">
                                    <span className="review-info-label">Description</span>
                                    <div className="review-info-value review-info-description">
                                        {currentItem.description}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 审核操作区域 */}
                    <div className="review-actions">
                        <div className="review-actions-row">
                            <AnimatedButton
                                text="REJECT"
                                onClick={handleReject}
                                loading={isProcessing}
                                loadingText="Rejecting..."
                                delay={0.1}
                                disabled={isProcessing}
                            />
                            <AnimatedButton
                                text="APPROVE"
                                onClick={handleApprove}
                                loading={isProcessing}
                                loadingText="Approving..."
                                delay={0.2}
                                disabled={isProcessing}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReviewPage;