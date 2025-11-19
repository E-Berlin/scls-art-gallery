// components/RouteGuard.tsx
import { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useUser } from '../context/UserContext';

interface RouteGuardProps {
    children: React.ReactNode;
}

export const RouteGuard: React.FC<RouteGuardProps> = ({ children }) => {
    const location = useLocation();
    const { drawGuessSocket } = useSocket();
    const { user } = useUser();
    const params = useParams();

    useEffect(() => {
        // 检查是否是游戏路由
        const isGameRoute = location.pathname.includes('/game/draw-guess/');
        const roomID = params.roomID;

        if (isGameRoute && roomID) {
            // 设置页面卸载处理
            const handleBeforeUnload = (event: BeforeUnloadEvent) => {
                // 页面刷新，不发送离开房间事件
                console.log('Page refresh/close, retain room status');
            };

            const handleUnload = () => {
                // 页面卸载
                console.log('Page Unload');
            };

            window.addEventListener('beforeunload', handleBeforeUnload);
            window.addEventListener('unload', handleUnload);

            return () => {
                window.removeEventListener('beforeunload', handleBeforeUnload);
                window.removeEventListener('unload', handleUnload);

                // 路由变化时检查是否是离开游戏
                const isLeavingGame = !location.pathname.includes('/game/draw-guess/');
                if (isLeavingGame && drawGuessSocket && user) {
                    console.log('Proactively leave the game route and send a leave room event.');
                    drawGuessSocket.emit('leaveRoom', {
                        roomId: roomID,
                        userId: user.id
                    });
                }
            };
        }
    }, [location, drawGuessSocket, user, params]);

    return <>{children}</>;
};