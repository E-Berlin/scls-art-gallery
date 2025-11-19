// components/OrbitParticles.tsx
import React, { useEffect, useRef } from "react";

interface Shape {
    radius: number;
    orbit: number;
    angle: number;
    speed: number;
    color: string;
    shapeType: "circle" | "triangle" | "square";
}

const OrbitParticles: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current!;

        // 小延迟，确保 CSS transition 被触发
        setTimeout(() => {
            canvas.style.opacity = "1";
        }, 100);

        const ctx = canvas.getContext("2d")!;
        let w = canvas.width = window.innerWidth;
        let h = canvas.height = window.innerHeight;

        const centerX = w / 2;
        const centerY = h / 2 - 150; // 上移旋转中心，可根据校徽位置调整

        // 生成 100 个形状，小圆+三角+方形混合
        const shapes: Shape[] = Array.from({ length: 100 }).map(() => ({
            radius: 2 + Math.random() * 5,
            orbit: 200 + Math.random() * 500,  // 多轨道，轨道半径小一点，密集感
            angle: Math.random() * Math.PI * 2,
            speed: 0.002 + Math.random() * 0.007, // 速度差异
            color: `hsla(${Math.random() * 360}, 80%, 60%, ${0.4 + Math.random() * 0.6})`, // 半透明
            shapeType: Math.random() < 0.33 ? "circle" : Math.random() < 0.5 ? "triangle" : "square"
        }));

        function drawShape(s: Shape, x: number, y: number) {
            ctx.fillStyle = s.color;
            if (s.shapeType === "circle") {
                ctx.beginPath();
                ctx.arc(x, y, s.radius, 0, Math.PI * 2);
                ctx.fill();
            } else if (s.shapeType === "triangle") {
                ctx.beginPath();
                ctx.moveTo(x, y - s.radius);
                ctx.lineTo(x - s.radius, y + s.radius);
                ctx.lineTo(x + s.radius, y + s.radius);
                ctx.closePath();
                ctx.fill();
            } else if (s.shapeType === "square") {
                ctx.fillRect(x - s.radius, y - s.radius, s.radius * 2, s.radius * 2);
            }
        }

        function animate() {
            ctx.clearRect(0, 0, w, h);
            shapes.forEach(s => {
                s.angle += s.speed;
                const x = centerX + s.orbit * Math.cos(s.angle);
                const y = centerY + s.orbit * Math.sin(s.angle);
                drawShape(s, x, y);
            });
            requestAnimationFrame(animate);
        }

        animate();

        const handleResize = () => {
            w = canvas.width = window.innerWidth;
            h = canvas.height = window.innerHeight;
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: "absolute",
                inset: 0,
                zIndex: 0,
                pointerEvents: "none",
                opacity: 0, // 初始透明
                transition: "opacity 1.5s ease-in-out" // 淡入动画
            }}
        />
    );
};

export default OrbitParticles;
