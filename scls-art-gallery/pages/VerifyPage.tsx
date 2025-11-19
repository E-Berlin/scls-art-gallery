// pages/VerifyPage.tsx
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePageTransition } from "../context/PageTransitionContext";
import { SUPABASE_URL } from "../config/config";
import AnimatedButton from "../components/AnimatedButton";
import "./VerifyPage.css";

const VerifyPage: React.FC = () => {
    const { navigateWithTransition } = usePageTransition();

    const [searchParams] = useSearchParams();
    const successParam = searchParams.get("success");

    const [status, setStatus] = useState("Verifying...");
    const [success, setSuccess] = useState(false);

    const BUILDING_BG = `${SUPABASE_URL}/storage/v1/object/public/default-imgs/building.jpg`;

    useEffect(() => {
        if (successParam === "true") {
            setStatus("Email verification successful 🎉");
            setSuccess(true);
        } else if (successParam === "false") {
            setStatus("Email verification failed or link expired ❌");
            setSuccess(false);
        } else {
            setStatus("Invalid verification link ❌");
            setSuccess(false);
        }
    }, [successParam]);

    return (
        <div className="verify-page">
            {/* 背景建筑 + 蒙版 */}
            <div className="background-container">
                <img src={BUILDING_BG} alt="School Building" />
                <div className="gradient-overlay" />
            </div>

            <div className="verify-container">
                <h2 className="verify-title">{status}</h2>
                {success && (
                    <AnimatedButton
                        text="Go to Login Page"
                        onClick={() => navigateWithTransition("/login")}
                        delay={0.4}
                    />
                )}
                {!success && (
                    <AnimatedButton
                        text="Back to Home Page"
                        onClick={() => navigateWithTransition("/")}
                    />
                )}
            </div>
        </div>
    );
};

export default VerifyPage;
