// pages/ProfilePage.tsx (更新版本)
import React, { useState, useRef, useEffect } from "react";
import { usePageTransition } from "../context/PageTransitionContext";
import { useUser } from "../context/UserContext";
import { SERVER_URL, SUPABASE_URL } from "../config/config";
import AnimatedButton from "../components/AnimatedButton";
import "./ProfilePage.css";

interface EditData {
    username: string;
    oldPassword: string;
    newPassword: string;
    confirmPassword: string;
    adminKey: string;
}

const ProfilePage: React.FC = () => {
    const { navigateWithTransition } = usePageTransition();
    const { user, updateUser, logout, refreshUser } = useUser(); // 添加 refreshUser
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [messageTimer, setMessageTimer] = useState<number | null>(null);

    const BUILDING_BG = `${SUPABASE_URL}/storage/v1/object/public/default-imgs/building.jpg`;

    const [editData, setEditData] = useState<EditData>({
        username: user?.username || "",
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
        adminKey: ""
    });

    // 添加：在组件加载时刷新用户数据
    useEffect(() => {
        if (user) {
            refreshUser();
        }
    }, [user, refreshUser]);

    // 自动清除消息
    useEffect(() => {
        if (message && messageTimer) {
            clearTimeout(messageTimer);
        }

        if (message) {
            const timer = setTimeout(() => {
                setMessage(null);
            }, 3000) as unknown as number; // 在浏览器中，setTimeout 返回数字，但 TypeScript 可能认为它是 NodeJS.Timeout，所以需要类型断言

            setMessageTimer(timer);

            return () => {
                if (timer) clearTimeout(timer);
            };
        }
    }, [message]);

    // 组件卸载时清除定时器
    useEffect(() => {
        return () => {
            if (messageTimer) {
                clearTimeout(messageTimer);
            }
        };
    }, []);

    const showMessage = (text: string, type: 'success' | 'error') => {
        setMessage({ text, type });
    };

    const handleAvatarClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user) return;

        // 检查文件类型
        if (!file.type.startsWith('image/')) {
            showMessage("Please select a valid image file", 'error');
            return;
        }

        // 检查文件大小 (5MB)
        if (file.size > 5 * 1024 * 1024) {
            showMessage("File size must be less than 5MB", 'error');
            return;
        }

        try {
            setIsLoading(true);

            const formData = new FormData();
            formData.append("avatar", file);
            formData.append("userId", user.id);

            const response = await fetch(`${SERVER_URL}/api/auth/update-avatar`, {
                method: "POST",
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to update avatar");
            }

            updateUser({ avatar: data.avatar });
            showMessage("Avatar updated successfully!", 'success');

            // 清除文件输入，允许再次选择相同文件
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (err: any) {
            showMessage(err.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditToggle = () => {
        if (isEditing) {
            handleSaveChanges();
        } else {
            setEditData({
                username: user?.username || "",
                oldPassword: "",
                newPassword: "",
                confirmPassword: "",
                adminKey: ""
            });
            setIsEditing(true);
            setMessage(null);
        }
    };

    const handleSaveChanges = async () => {
        if (!user) return;

        // Validation
        if (editData.newPassword) {
            if (!editData.oldPassword) {
                showMessage("Please enter your current password to change password", 'error');
                return;
            }
            if (editData.newPassword.length < 6) {
                showMessage("New password must be at least 6 characters long", 'error');
                return;
            }
            if (editData.newPassword !== editData.confirmPassword) {
                showMessage("New passwords do not match", 'error');
                return;
            }
        }

        setIsLoading(true);

        try {
            // Update profile
            const updatePayload: any = {
                userId: user.id,
                username: editData.username
            };

            if (editData.newPassword) {
                updatePayload.oldPassword = editData.oldPassword;
                updatePayload.newPassword = editData.newPassword;
            }

            const updateResponse = await fetch(`${SERVER_URL}/api/auth/update-profile`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatePayload),
            });

            const updateData = await updateResponse.json();

            if (!updateResponse.ok) {
                throw new Error(updateData.error || "Failed to update profile");
            }

            // Handle admin key if provided
            if (editData.adminKey) {
                const adminResponse = await fetch(`${SERVER_URL}/api/auth/upgrade-to-admin`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userId: user.id,
                        adminKey: editData.adminKey
                    }),
                });

                const adminData = await adminResponse.json();

                if (!adminResponse.ok) {
                    throw new Error(adminData.error || "Failed to upgrade to admin");
                }

                updateUser({ role: "admin" });
            }

            // Update user context with new data
            updateUser({
                username: editData.username,
                ...(updateData.avatar && { avatar: updateData.avatar })
            });

            showMessage("Profile updated successfully!", 'success');
            setIsEditing(false);
        } catch (err: any) {
            showMessage(err.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    /*
    const handleLogout = () => {
        logout();
        navigateWithTransition("/login");
    };
    */

    const handleInputChange = (field: keyof EditData, value: string) => {
        setEditData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // 检查新密码是否符合条件（至少6个字符）
    const isNewPasswordValid = editData.newPassword.length >= 6;

    if (!user) {
        return (
            <div className="profile-page">
                <div className="background-container">
                    <img src={BUILDING_BG} alt="School Building" />
                    <div className="gradient-overlay" />
                </div>
                <div className="profile-container">
                    <div className="profile-message profile-error">Please log in to view your profile</div>
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
        <div className="profile-page">
            {/* 背景建筑 + 蒙版 */}
            <div className="background-container">
                <img src={BUILDING_BG} alt="School Building" />
                <div className="gradient-overlay" />
            </div>

            <div className="profile-scroll-container">
                <div className="profile-container">
                    {/* 自动消失的消息 */}
                    {message && (
                        <div className={`profile-message profile-${message.type} ${message.type === 'success' ? 'profile-success' : 'profile-error'}`}>
                            {message.text}
                        </div>
                    )}

                    {/* 顶部用户信息 */}
                    <div className="profile-header">
                        <div className="profile-avatar-section">
                            <div
                                className="profile-avatar-wrapper"
                                onClick={handleAvatarClick}
                            >
                                <img
                                    src={user.avatar || "/assets/default-avatar.png"}
                                    alt="Profile Avatar"
                                    className="profile-avatar"
                                />
                                <div className="profile-avatar-overlay">
                                    <span>{isLoading ? "Uploading..." : "Change Photo"}</span>
                                </div>
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleAvatarChange}
                                accept="image/*"
                                className="profile-file-input"
                                aria-label="Upload profile picture"
                                disabled={isLoading}
                            />
                        </div>

                        <div className="profile-stats">
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={editData.username}
                                    onChange={(e) => handleInputChange('username', e.target.value)}
                                    className="profile-edit-input profile-username-input"
                                    placeholder="Username"
                                />
                            ) : (
                                <h1 className="profile-username">{user.username}</h1>
                            )}

                            <div className="profile-stat-item">
                                <span className="profile-stat-label">Likes</span>
                                <span className="profile-stat-value">{user.likes}</span>
                            </div>
                            <div className="profile-stat-item">
                                <span className="profile-stat-label">Score</span>
                                <span className="profile-stat-value">{user.score}</span>
                            </div>
                        </div>
                    </div>

                    {/* 中部用户信息 */}
                    <div className="profile-info-section">
                        <h2 className="profile-section-title">USER INFORMATION</h2>

                        <div className="profile-info-item">
                            <span className="profile-info-label">Email</span>
                            <span className="profile-info-value">{user.email}</span>
                        </div>

                        <div className="profile-info-item">
                            <span className="profile-info-label">Password</span>
                            <div className="profile-info-value">
                                {isEditing ? (
                                    <div className="profile-password-fields">
                                        <input
                                            type="password"
                                            value={editData.oldPassword}
                                            onChange={(e) => handleInputChange('oldPassword', e.target.value)}
                                            className="profile-edit-input"
                                            placeholder="Current Password"
                                        />
                                        <input
                                            type="password"
                                            value={editData.newPassword}
                                            onChange={(e) => handleInputChange('newPassword', e.target.value)}
                                            className="profile-edit-input"
                                            placeholder="New Password (min. 6 characters)"
                                        />
                                        {/* 只有当新密码符合条件时才显示确认密码输入框 */}
                                        {isNewPasswordValid && (
                                            <input
                                                type="password"
                                                value={editData.confirmPassword}
                                                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                                                className="profile-edit-input"
                                                placeholder="Confirm New Password"
                                            />
                                        )}
                                    </div>
                                ) : (
                                    <span>••••••••</span>
                                )}
                            </div>
                        </div>

                        <div className="profile-info-item">
                            <span className="profile-info-label">Administrator</span>
                            <div className="profile-info-value">
                                <span>{user.role === "admin" ? "Yes" : "No"}</span>
                                {user.role !== "admin" && isEditing && (
                                    <input
                                        type="password"
                                        value={editData.adminKey}
                                        onChange={(e) => handleInputChange('adminKey', e.target.value)}
                                        className="profile-edit-input profile-admin-key"
                                        placeholder="Enter Admin Key to Activate"
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 底部按钮 */}
                    <div className="profile-actions">
                        <AnimatedButton
                            text={isEditing ? "SAVE CHANGES" : "EDIT INFORMATION"}
                            onClick={handleEditToggle}
                            loading={isLoading}
                            loadingText={isEditing ? "Saving..." : "Loading..."}
                            delay={0.2}
                        />
                        {/*
                        <AnimatedButton
                            text="LOG OUT"
                            onClick={handleLogout}
                            delay={0.3}
                        />
                        */}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;