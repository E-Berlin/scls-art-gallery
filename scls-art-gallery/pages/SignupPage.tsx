// pages/SignupPage.tsx
import React, { useState } from "react";
import { usePageTransition } from "../context/PageTransitionContext";
import { SERVER_URL, SUPABASE_URL } from "../config/config";
import AnimatedButton from "../components/AnimatedButton";
import "./SignupPage.css";

const Signup: React.FC = () => {
    const { navigateWithTransition } = usePageTransition();

    const [email, setEmail] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);

    const BUILDING_BG = `${SUPABASE_URL}/storage/v1/object/public/default-imgs/building.jpg`;

    const handleSignup = async () => {
        setError("");
        setSuccess("");

        if (!email || !username || !password || !confirmPassword) {
            setError("Please fill in all required information");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${SERVER_URL}/api/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, username, password }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Registration failed");
            } else {
                setSuccess(data.message || "Registration successful, please check your email to verify");
                setEmail("");
                setUsername("");
                setPassword("");
                setConfirmPassword("");
            }
        } catch (err) {
            console.error(err);
            setError("Network error, please try again later");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="signup-page">
            {/* 背景建筑 + 蒙版 */}
            <div className="background-container">
                <img src={BUILDING_BG} alt="School Building" />
                <div className="gradient-overlay" />
            </div>

            <div className="signup-container">
                <h2 className="signup-title">Register Account</h2>
                {error && <p className="signup-error">{error}</p>}
                {success && <p className="signup-success">{success}</p>}

                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="signup-input"
                />
                <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="signup-input"
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="signup-input"
                />
                <input
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="signup-input"
                />

                <AnimatedButton
                    text="Register"
                    loading={loading}
                    loadingText="Registering..."
                    onClick={handleSignup}
                    delay={0.4}
                />

                <p className="signup-footer">
                    Already have an account?{" "}
                    <button
                        onClick={() => navigateWithTransition("/login")}
                        className="signup-link"
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                    >
                        Login
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
        </div >
    );
};

export default Signup;
