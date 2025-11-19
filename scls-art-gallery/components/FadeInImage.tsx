// components/FadeInImage.tsx
import React, { useEffect, useState, forwardRef, useImperativeHandle } from "react";

interface FadeInImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    duration?: number;
}

const FadeInImage = forwardRef<HTMLImageElement, FadeInImageProps>(
    ({ duration = 1000, ...props }, ref) => {
        const [visible, setVisible] = useState(false);

        useEffect(() => {
            const timer = setTimeout(() => setVisible(true), 100);
            return () => clearTimeout(timer);
        }, []);

        // 使用类型断言确保 ref 不为 null
        useImperativeHandle(ref, () => (ref as React.RefObject<HTMLImageElement>).current!);

        return (
            <img
                {...props}
                ref={ref} // 传递 ref 给 img
                style={{
                    opacity: visible ? 1 : 0,
                    transition: `opacity ${duration}ms ease-in-out`,
                    ...props.style,
                }}
            />
        );
    }
);

export default FadeInImage;


