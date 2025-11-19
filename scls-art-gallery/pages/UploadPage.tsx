// pages/UploadPage.tsx
import React, { useState, useRef, useEffect } from "react";
import { usePageTransition } from "../context/PageTransitionContext";
import { useUser } from "../context/UserContext";
import { SERVER_URL, SUPABASE_URL } from "../src/config";
import AnimatedButton from "../components/AnimatedButton";
import "./UploadPage.css";

// 修复 Timer 类型问题
type Timer = ReturnType<typeof setTimeout>;

interface UploadData {
    image: File | null;
    imagePreview: string;
    category: string;
    title: string;
    description: string;
}

interface DraftData {
    id?: number;
    category: string;
    title: string;
    description: string;
    artist: string;
    image_url: string | null;
    date: string;
}

const UploadPage: React.FC = () => {
    const { navigateWithTransition } = usePageTransition();
    const { user } = useUser();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [uploadData, setUploadData] = useState<UploadData>({
        image: null,
        imagePreview: "",
        category: "",
        title: "",
        description: ""
    });

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    const BUILDING_BG = `${SUPABASE_URL}/storage/v1/object/public/default-imgs/building.jpg`;

    // 分类选项
    const categories = [
        { value: "", label: "Select Category" },
        { value: "photography", label: "Photography" },
        { value: "art-printmaking", label: "Art Printmaking" },
        { value: "tranditional-art", label: "Traditional Art" },
        { value: "digital-art", label: "Digital Art" },
        { value: "birdwatching-club", label: "Birdwatching Club" },
        { value: "mixed-media", label: "Mixed Media" }
    ];

    // 修复：使用正确的 Timer 类型
    const saveTimerRef = useRef<Timer | null>(null);

    // 加载草稿
    useEffect(() => {
        if (user) {
            loadDraft();
        }
    }, [user]);

    // 自动保存草稿
    useEffect(() => {
        if (user && hasUnsavedChanges) {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }

            saveTimerRef.current = setTimeout(() => {
                saveDraft();
            }, 2000);
        }

        return () => {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }
        };
    }, [uploadData, user, hasUnsavedChanges]);

    // 组件卸载时清除定时器
    useEffect(() => {
        return () => {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }
        };
    }, []);

    const showMessage = (text: string, type: 'success' | 'error') => {
        setMessage({ text, type });
        setTimeout(() => setMessage(null), 5000);
    };

    // 🔥 修复：安全的文件输入重置方法
    const resetFileInput = () => {
        if (fileInputRef.current) {
            try {
                fileInputRef.current.value = '';
            } catch (error) {
                console.warn("Error resetting file input:", error);
            }
        }
    };

    const loadDraft = async () => {
        if (!user) return;

        try {
            const response = await fetch(`${SERVER_URL}/api/upload/draft?userId=${user.id}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to load draft");
            }

            if (data.draft) {
                const draft: DraftData = data.draft;
                setUploadData(prev => ({
                    ...prev,
                    category: draft.category || "",
                    title: draft.title || "",
                    description: draft.description || "",
                    imagePreview: draft.image_url || ""
                }));
                setHasUnsavedChanges(false);
                showMessage("Draft loaded successfully", 'success');
            }
        } catch (err: any) {
            console.log("No draft found or error loading draft:", err.message);
        }
    };

    const saveDraft = async () => {
        if (!user || !hasUnsavedChanges) return;

        setIsSaving(true);
        try {
            const formData = new FormData();

            if (uploadData.image) {
                formData.append("image", uploadData.image);
            }

            formData.append("userId", user.id);
            formData.append("category", uploadData.category);
            formData.append("title", uploadData.title);
            formData.append("description", uploadData.description);
            formData.append("artist", user.username);

            const response = await fetch(`${SERVER_URL}/api/upload/draft`, {
                method: "POST",
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to save draft");
            }

            setHasUnsavedChanges(false);
            showMessage("Draft saved successfully", 'success');
        } catch (err: any) {
            console.error("Error saving draft:", err);
            showMessage("Failed to save draft", 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleClearDraft = async () => {
        if (!user) return;

        try {
            const response = await fetch(`${SERVER_URL}/api/upload/draft`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    userId: user.id
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to clear draft");
            }

            // 重置表单状态
            setUploadData({
                image: null,
                imagePreview: "",
                category: "",
                title: "",
                description: ""
            });
            setHasUnsavedChanges(false);
            setShowClearConfirm(false);

            // 🔥 修复：使用安全的方法重置文件输入
            resetFileInput();

            showMessage(`Draft cleared successfully${data.deletedImages ? ` (${data.deletedImages} images deleted)` : ''}`, 'success');
        } catch (err: any) {
            showMessage(err.message, 'error');
        }
    };

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // 检查文件类型
        if (!file.type.startsWith('image/')) {
            showMessage("Please select a valid image file", 'error');
            resetFileInput();
            return;
        }

        // 检查文件大小 (10MB)
        if (file.size > 10 * 1024 * 1024) {
            showMessage("File size must be less than 10MB", 'error');
            resetFileInput();
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            setUploadData(prev => ({
                ...prev,
                image: file,
                imagePreview: e.target?.result as string
            }));
            setHasUnsavedChanges(true);
        };
        reader.onerror = () => {
            showMessage("Failed to read image file", 'error');
            resetFileInput();
        };
        reader.readAsDataURL(file);
    };

    const handleInputChange = (field: keyof UploadData, value: string) => {
        setUploadData(prev => ({
            ...prev,
            [field]: value
        }));
        setHasUnsavedChanges(true);
    };

    const handleCategoryChange = (value: string) => {
        handleInputChange('category', value);
    };

    const handleSubmit = async () => {
        if (!user) {
            showMessage("Please log in to upload artwork", 'error');
            return;
        }

        // 验证表单
        if (!uploadData.imagePreview) {
            showMessage("Please upload an image", 'error');
            return;
        }

        if (!uploadData.category) {
            showMessage("Please select a category", 'error');
            return;
        }

        if (!uploadData.title.trim()) {
            showMessage("Please enter a title", 'error');
            return;
        }

        // 🔥 新增：验证描述字段
        if (!uploadData.description.trim()) {
            showMessage("Please enter a description", 'error');
            return;
        }

        setIsLoading(true);

        try {
            // 首先确保草稿已保存
            await saveDraft();

            // 然后提交审核
            const response = await fetch(`${SERVER_URL}/api/upload/submit`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    userId: user.id
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to submit artwork");
            }

            showMessage("Artwork submitted for review successfully!", 'success');

            // 重置表单
            setUploadData({
                image: null,
                imagePreview: "",
                category: "",
                title: "",
                description: ""
            });
            setHasUnsavedChanges(false);

            // 重置文件输入
            resetFileInput();

            // 3秒后跳转到画廊
            setTimeout(() => {
                navigateWithTransition("/gallery");
            }, 3000);

        } catch (err: any) {
            showMessage(err.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleImageClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    if (!user) {
        return (
            <div className="upload-page">
                <div className="background-container">
                    <img src={BUILDING_BG} alt="School Building" />
                    <div className="gradient-overlay" />
                </div>
                <div className="upload-container">
                    <div className="upload-message upload-error">Please log in to upload artwork</div>
                    <AnimatedButton
                        text="LOG IN"
                        onClick={() => navigateWithTransition("/login")}
                        delay={0.2}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="upload-page">
            {/* 背景建筑 + 蒙版 - 与ProfilePage相同 */}
            <div className="background-container">
                <img src={BUILDING_BG} alt="School Building" />
                <div className="gradient-overlay" />
            </div>

            <div className="upload-scroll-container">
                <div className="upload-container">
                    {/* 自动消失的消息 - 与ProfilePage相同样式 */}
                    {message && (
                        <div className={`upload-message upload-${message.type} ${message.type === 'success' ? 'upload-success' : 'upload-error'}`}>
                            {message.text}
                        </div>
                    )}

                    {/* 确认清除草稿对话框 */}
                    {showClearConfirm && (
                        <div className="upload-confirm-dialog">
                            <div className="upload-confirm-content">
                                <h3>Clear Draft</h3>
                                <p>Are you sure you want to clear your draft? This action cannot be undone and all unsaved changes will be lost.</p>
                                <div className="upload-confirm-actions">
                                    <button
                                        className="upload-confirm-cancel"
                                        onClick={() => setShowClearConfirm(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="upload-confirm-clear"
                                        onClick={handleClearDraft}
                                    >
                                        Clear Draft
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 顶部图片上传区域 - 模仿ProfilePage的头部区域 */}
                    <div className="upload-header">
                        <div className="upload-image-section">
                            <div
                                className={`upload-image-wrapper ${!uploadData.imagePreview ? 'upload-empty' : ''}`}
                                onClick={handleImageClick}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        handleImageClick();
                                    }
                                }}
                                aria-label="Upload artwork image. Click to select an image file"
                                title="Click to upload artwork image"
                            >
                                {uploadData.imagePreview ? (
                                    <img
                                        src={uploadData.imagePreview}
                                        alt="Artwork preview"
                                        className="upload-preview"
                                    />
                                ) : (
                                    <div className="upload-placeholder">
                                        <div className="upload-placeholder-icon">📷</div>
                                        <div className="upload-placeholder-text">
                                            Click to Upload Image
                                        </div>
                                        <div className="upload-placeholder-subtext">
                                            Supported formats: JPG, PNG, GIF (Max 10MB)
                                        </div>
                                    </div>
                                )}
                                <div className="upload-image-overlay">
                                    <span>{uploadData.imagePreview ? "Change Image" : "Upload Image"}</span>
                                </div>
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleImageUpload}
                                accept="image/*"
                                className="upload-file-input"
                                aria-label="Select artwork image file"
                                id="artwork-image-input"
                                title="Select artwork image file"
                            />
                        </div>

                        {/* 状态信息 - 模仿ProfilePage的统计信息 */}
                        <div className="upload-status-info">
                            <div className="upload-status-item">
                                <span className="upload-status-label">Status</span>
                                <span className="upload-status-value">
                                    {hasUnsavedChanges ? "Unsaved Changes" : "All Changes Saved"}
                                </span>
                            </div>
                            <div className="upload-status-item">
                                <span className="upload-status-label">Auto-save</span>
                                <span className="upload-status-value">
                                    {isSaving ? "Saving..." : "Active"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 表单区域 - 模仿ProfilePage的信息部分 */}
                    <div className="upload-form-section">
                        <h2 className="upload-section-title">ARTWORK INFORMATION</h2>

                        {/* 分类选择 */}
                        <div className="upload-form-item">
                            <span className="upload-form-label">Category *</span>
                            <div className="upload-form-value">
                                <div className="upload-form-select-wrapper">
                                    <select
                                        id="category-select"
                                        value={uploadData.category}
                                        onChange={(e) => handleCategoryChange(e.target.value)}
                                        className="upload-form-select"
                                        aria-label="Select artwork category"
                                        aria-required="true"
                                        title="Select artwork category"
                                    >
                                        {categories.map(cat => (
                                            <option key={cat.value} value={cat.value}>
                                                {cat.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* 标题 */}
                        <div className="upload-form-item">
                            <span className="upload-form-label">Title *</span>
                            <div className="upload-form-value">
                                <input
                                    id="title-input"
                                    type="text"
                                    value={uploadData.title}
                                    onChange={(e) => handleInputChange('title', e.target.value)}
                                    className="upload-form-input"
                                    placeholder="Enter artwork title"
                                    aria-label="Enter artwork title"
                                    aria-required="true"
                                    title="Enter artwork title"
                                    maxLength={100}
                                />
                                <div className="upload-form-counter">
                                    {uploadData.title.length}/100
                                </div>
                            </div>
                        </div>

                        {/* 艺术家信息 */}
                        <div className="upload-form-item">
                            <span className="upload-form-label">Artist</span>
                            <div className="upload-form-value">
                                <input
                                    id="artist-input"
                                    type="text"
                                    value={user.username}
                                    className="upload-form-input upload-form-input-readonly"
                                    readOnly
                                    aria-label="Artist name (read-only)"
                                    title="Artist name"
                                    placeholder="Artist name (auto-filled)"
                                />
                            </div>
                        </div>

                        {/* 日期信息 */}
                        <div className="upload-form-item">
                            <span className="upload-form-label">Date</span>
                            <div className="upload-form-value">
                                <input
                                    id="date-input"
                                    type="text"
                                    value={new Date().toLocaleDateString()}
                                    className="upload-form-input upload-form-input-readonly"
                                    readOnly
                                    aria-label="Upload date (read-only)"
                                    title="Upload date"
                                    placeholder="Current date (auto-filled)"
                                />
                            </div>
                        </div>

                        {/* 描述 */}
                        <div className="upload-form-item upload-form-item-description">
                            {/* 🔥 修改：将描述标签改为必填 */}
                            <span className="upload-form-label">Description *</span>
                            <div className="upload-form-value">
                                <textarea
                                    id="description-textarea"
                                    value={uploadData.description}
                                    onChange={(e) => handleInputChange('description', e.target.value)}
                                    className="upload-form-textarea"
                                    placeholder="Describe your artwork (required)"
                                    aria-label="Artwork description"
                                    aria-required="true"
                                    title="Artwork description"
                                    rows={4}
                                    maxLength={500}
                                />
                                <div className="upload-form-counter">
                                    {uploadData.description.length}/500
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 底部按钮区域 */}
                    <div className="upload-actions">
                        <div className="upload-actions-row">
                            <AnimatedButton
                                text="CLEAR DRAFT"
                                onClick={() => setShowClearConfirm(true)}
                                delay={0.1}
                                disabled={isSaving || isLoading}
                            />
                            <AnimatedButton
                                text="SAVE DRAFT"
                                onClick={saveDraft}
                                loading={isSaving}
                                loadingText="Saving..."
                                delay={0.2}
                                disabled={isSaving || isLoading || !hasUnsavedChanges}
                            />
                        </div>
                        {/* 🔥 修改：更新提交按钮的禁用条件，包含描述字段验证 */}
                        <AnimatedButton
                            text="SUBMIT FOR REVIEW"
                            onClick={handleSubmit}
                            loading={isLoading}
                            loadingText="Submitting..."
                            delay={0.3}
                            disabled={!uploadData.imagePreview || !uploadData.category || !uploadData.title.trim() || !uploadData.description.trim() || isLoading}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UploadPage;