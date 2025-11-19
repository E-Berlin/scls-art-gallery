// components/Navbar.tsx
import React, { useState, useRef, useEffect } from "react";
import { FaHome, FaPalette, FaGamepad, FaUser, FaUpload, FaSignOutAlt, FaEye, FaChevronDown } from "react-icons/fa";
import { usePageTransition } from "../context/PageTransitionContext";
import { useUser } from "../context/UserContext";
import "./Navbar.css";

interface NavItem {
    icon: React.ReactNode;
    label: string;
    path: string;
}

interface NavbarProps {
    logo: string;
    navItems?: NavItem[];
}

const Navbar: React.FC<NavbarProps> = ({ logo, navItems }) => {
    const { navigateWithTransition } = usePageTransition();
    const { user, logout } = useUser();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const defaultNavItems: NavItem[] = [
        { icon: <FaHome />, label: "SCLS Art", path: "/" },
        { icon: <FaPalette />, label: "Art Gallery", path: "/gallery" },
        { icon: <FaGamepad />, label: "Art Game", path: "/game" },
        { icon: <FaUser />, label: "Log In", path: "/login" },
    ];
    const items = navItems || defaultNavItems;
    const currentPath = window.location.pathname;

    // 点击外部关闭下拉菜单
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleUserButtonClick = () => {
        if (user) {
            setIsDropdownOpen(!isDropdownOpen);
        } else {
            navigateWithTransition("/login");
        }
    };

    const handleMenuItemClick = (path: string) => {
        setIsDropdownOpen(false);
        navigateWithTransition(path);
    };

    const handleLogout = () => {
        setIsDropdownOpen(false);
        logout();
        navigateWithTransition("/login");
    };

    // 获取按钮尺寸用于精确定位
    const getButtonDimensions = () => {
        if (!buttonRef.current) return { width: 'auto', top: 0, height: 0 };

        const rect = buttonRef.current.getBoundingClientRect();
        return {
            width: `${rect.width}px`,
            top: `${rect.top + rect.height / 2}px`, // 按钮横向中线
            height: `${rect.height}px`
        };
    };

    const buttonDims = getButtonDimensions();

    return (
        <nav className="navbar">
            <div className="nav-left">
                <img src={logo} alt="Logo" className="nav-logo" />
                <div className="nav-items">
                    {items.slice(0, 3).map((it, i) => {
                        let isActive = false;
                        if (it.path === "/gallery") {
                            isActive = currentPath.startsWith("/gallery");
                        } else if (it.path === "/game") {
                            isActive = currentPath.startsWith("/game");
                        } else {
                            isActive = currentPath === it.path;
                        }
                        return (
                            <button
                                key={i}
                                onClick={() => navigateWithTransition(it.path)}
                                className={isActive ? "nav-button active" : "nav-button"}
                            >
                                {it.icon}
                                <span>{it.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="nav-right" ref={dropdownRef}>
                {user ? (
                    <div className="user-menu-container">
                        <button
                            ref={buttonRef}
                            onClick={handleUserButtonClick}
                            className={`nav-button user-toggle ${isDropdownOpen ? "active" : ""}`}
                        >
                            <img src={user.avatar} alt={user.username} className="user-avatar" />
                            <span>{user.username}</span>
                            <FaChevronDown className={`chevron ${isDropdownOpen ? "rotate" : ""}`} />
                        </button>
                        <div
                            className={`dropdown-menu ${isDropdownOpen ? "open" : "close"}`}
                            style={{
                                width: buttonDims.width,
                                top: buttonDims.top
                            }}
                        >
                            <div className="dropdown-content">
                                <button
                                    onClick={() => handleMenuItemClick("/upload")}
                                    className="dropdown-item"
                                    style={{ animationDelay: "0.05s" }}
                                >
                                    <FaUpload className="item-icon" />
                                    <span>Upload</span>
                                </button>
                                <button
                                    onClick={() => handleMenuItemClick("/profile")}
                                    className="dropdown-item"
                                    style={{ animationDelay: "0.1s" }}
                                >
                                    <FaUser className="item-icon" />
                                    <span>Profile</span>
                                </button>
                                {user.role === "admin" && (
                                    <button
                                        onClick={() => handleMenuItemClick("/review")}
                                        className="dropdown-item"
                                        style={{ animationDelay: "0.15s" }}
                                    >
                                        <FaEye className="item-icon" />
                                        <span>Review</span>
                                    </button>
                                )}
                                <div className="dropdown-divider"></div>
                                <button
                                    onClick={handleLogout}
                                    className="dropdown-item logout"
                                    style={{ animationDelay: "0.2s" }}
                                >
                                    <FaSignOutAlt className="item-icon" />
                                    <span>Log Out</span>
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => navigateWithTransition("/login")}
                        className="nav-button"
                    >
                        <FaUser />
                        <span>Log In</span>
                    </button>
                )}
            </div>
        </nav>
    );
};

export default Navbar;