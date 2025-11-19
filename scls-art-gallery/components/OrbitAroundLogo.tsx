import React, { useEffect, useRef } from "react";

interface Dot {
    angle: number;
    speed: number;
    radius: number;
    orbitX: number;
    orbitY: number;
    orbitAngle: number;
    orbitRotationSpeed: number;
}

const OrbitAroundLogo: React.FC = () => {
    const bgCanvasRef = useRef<HTMLCanvasElement>(null);
    const fgCanvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const bgCanvas = bgCanvasRef.current!;
        const fgCanvas = fgCanvasRef.current!;
        const bgCtx = bgCanvas.getContext("2d")!;
        const fgCtx = fgCanvas.getContext("2d")!;

        let w = bgCanvas.width = fgCanvas.width = window.innerWidth;
        let h = bgCanvas.height = fgCanvas.height = window.innerHeight;

        let centerX = w / 2;
        let centerY = h / 2 - 182;

        const logoEl = document.querySelector<HTMLImageElement>(".school-logo");
        let logoRect: DOMRect | null = null;
        if (logoEl) {
            logoRect = logoEl.getBoundingClientRect();
            centerX = logoRect.left + logoRect.width / 2;
            centerY = logoRect.top + logoRect.height / 2;
        }

        const dots: Dot[] = [
            { angle: 0, speed: -0.02, radius: 12, orbitX: 120, orbitY: 60, orbitAngle: 0, orbitRotationSpeed: -0.01 },
            { angle: Math.PI / 3, speed: -0.02, radius: 12, orbitX: 120, orbitY: 60, orbitAngle: Math.PI / 3, orbitRotationSpeed: -0.01 },
            { angle: (2 * Math.PI) / 3, speed: -0.02, radius: 12, orbitX: 120, orbitY: 60, orbitAngle: (2 * Math.PI) / 3, orbitRotationSpeed: -0.01 },
        ];

        function drawOrbit(ctxFront: CanvasRenderingContext2D, ctxBack: CanvasRenderingContext2D, dot: Dot) {
            const segments = 120; // 椭圆分段数
            let points: { x: number; y: number; isFront: boolean }[] = [];

            for (let i = 0; i <= segments; i++) {
                const t = (i / segments) * 2 * Math.PI;
                const localX = dot.orbitX * Math.cos(t);
                const localY = dot.orbitY * Math.sin(t);
                const cosA = Math.cos(dot.orbitAngle);
                const sinA = Math.sin(dot.orbitAngle);
                const x = centerX + localX * cosA - localY * sinA;
                const y = centerY + localX * sinA + localY * cosA;
                points.push({ x, y, isFront: localY < 0 });
            }

            // 绘制前后轨道
            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                const ctx = p1.isFront ? ctxFront : ctxBack;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.strokeStyle = "rgba(76,175,80,0.2)"; // 统一 alpha
                ctx.lineWidth = 1.5;
                ctx.shadowColor = "#4caf50"; // 均匀发光
                ctx.shadowBlur = 8;
                ctx.stroke();
            }
        }

        function animate() {
            bgCtx.clearRect(0, 0, w, h);
            fgCtx.clearRect(0, 0, w, h);

            dots.forEach(dot => {
                dot.orbitAngle += dot.orbitRotationSpeed;

                // 绘制轨道分前后
                drawOrbit(fgCtx, bgCtx, dot);

                // 计算点在轨道本地坐标系
                const localX = dot.orbitX * Math.cos(dot.angle);
                const localY = dot.orbitY * Math.sin(dot.angle);

                // 将本地坐标旋转回全局
                const cosA = Math.cos(dot.orbitAngle);
                const sinA = Math.sin(dot.orbitAngle);
                const x = centerX + localX * cosA - localY * sinA;
                const y = centerY + localX * sinA + localY * cosA;

                // 前后判断以宽半径 y=0
                const ctxToUse = localY < 0 ? fgCtx : bgCtx;

                ctxToUse.beginPath();
                ctxToUse.arc(x, y, dot.radius, 0, Math.PI * 2);
                ctxToUse.fillStyle = "#4caf50";
                ctxToUse.fill();

                dot.angle += dot.speed;
            });

            requestAnimationFrame(animate);
        }

        animate();

        const handleResize = () => {
            w = bgCanvas.width = fgCanvas.width = window.innerWidth;
            h = bgCanvas.height = fgCanvas.height = window.innerHeight;
            if (logoEl) {
                logoRect = logoEl.getBoundingClientRect();
                centerX = logoRect.left + logoRect.width / 2;
                centerY = logoRect.top + logoRect.height / 2;
            }
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return (
        <>
            <canvas
                ref={bgCanvasRef}
                style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 0,
                    pointerEvents: "none",
                }}
            />
            <canvas
                ref={fgCanvasRef}
                style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 2,
                    pointerEvents: "none",
                }}
            />
        </>
    );
};

export default OrbitAroundLogo;