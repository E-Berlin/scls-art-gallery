// pages/LoginPage.tsx
import React, { useState } from "react";
import { usePageTransition } from "../context/PageTransitionContext";
import { useUser } from "../context/UserContext";
import { SERVER_URL, SUPABASE_URL } from "../src/config";
import AnimatedButton from "../components/AnimatedButton";
import "./LoginPage.css";

const Login: React.FC = () => {
    const { navigateWithTransition } = usePageTransition();
    const { setUser } = useUser();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState("");

    const BUILDING_BG = `${SUPABASE_URL}/storage/v1/object/public/default-imgs/building.jpg`;

    const handleLogin = async () => {
        setError("");
        setSuccess("");

        if (!email || !password) {
            setError("Please enter both email and password");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${SERVER_URL}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Login failed");
            } else {
                setSuccess("Login successful!"); // 不显示 `${user.username}`
                //setEmail("");
                //setPassword("");

                setUser(data.user);
                //localStorage.setItem("user", JSON.stringify(data.user));

                // ✅ 登录成功后，用 transition 跳转到首页
                setTimeout(() => {
                    navigateWithTransition("/"); // indexpage
                }, 600); // 可调整延迟，600ms 左右比较顺眼
            }
        } catch (err) {
            console.error(err);
            setError("Network error, please try again later");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            {/* 背景建筑 + 蒙版 */}
            <div className="background-container">
                <img src={BUILDING_BG} alt="School Building" />
                <div className="gradient-overlay" />
            </div>

            <div className="login-container">
                <h2 className="login-title">Login</h2>
                {error && <p className="login-error">{error}</p>}
                {success && <p className="login-success">{success}</p>}

                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="login-input"
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="login-input"
                />

                <AnimatedButton
                    text="Login"
                    loading={loading}
                    loadingText="Logging in..."
                    onClick={handleLogin}
                    delay={0.4}
                />

                <p className="login-footer">
                    Don't have an account?{" "}
                    <button
                        onClick={() => navigateWithTransition("/signup")}
                        className="login-link"
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                    >
                        Register
                    </button>
                    <br />
                    <button
                        onClick={() => navigateWithTransition("/")}
                        className="home-page-link"
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                    >
                        Home Page
                    </button>
                </p>
            </div>
        </div>
    );
};

export default Login;
