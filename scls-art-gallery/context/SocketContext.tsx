// context/SocketContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { SERVER_URL } from "../config/config";

interface SocketContextType {
    drawGuessSocket: Socket | null;
    canvasSocket: Socket | null;
    drawGuessCanvasSocket: Socket | null;
    isDrawGuessConnected: boolean;
    isCanvasConnected: boolean;
    isDrawGuessCanvasConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
    drawGuessSocket: null,
    canvasSocket: null,
    drawGuessCanvasSocket: null,
    isDrawGuessConnected: false,
    isCanvasConnected: false,
    isDrawGuessCanvasConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [drawGuessSocket, setDrawGuessSocket] = useState<Socket | null>(null);
    const [canvasSocket, setCanvasSocket] = useState<Socket | null>(null);
    const [drawGuessCanvasSocket, setDrawGuessCanvasSocket] = useState<Socket | null>(null);
    const [isDrawGuessConnected, setDrawGuessConnected] = useState(false);
    const [isCanvasConnected, setCanvasConnected] = useState(false);
    const [isDrawGuessCanvasConnected, setDrawGuessCanvasConnected] = useState(false);

    useEffect(() => {
        // ---- drawGuess socket ----
        const dgSocket = io(SERVER_URL + "/drawGuess");
        setDrawGuessSocket(dgSocket);
        dgSocket.on("connect", () => setDrawGuessConnected(true));
        dgSocket.on("disconnect", () => setDrawGuessConnected(false));

        // ---- canvas socket ----
        const cSocket = io(SERVER_URL + "/canvas");
        setCanvasSocket(cSocket);
        cSocket.on("connect", () => setCanvasConnected(true));
        cSocket.on("disconnect", () => setCanvasConnected(false));

        // ---- drawGuess canvas socket ----
        const dgcSocket = io(SERVER_URL + "/drawGuessCanvas");
        setDrawGuessCanvasSocket(dgcSocket);
        dgcSocket.on("connect", () => setDrawGuessCanvasConnected(true));
        dgcSocket.on("disconnect", () => setDrawGuessCanvasConnected(false));

        return () => {
            dgSocket.disconnect();
            cSocket.disconnect();
            dgcSocket.disconnect();
        };
    }, []);

    return (
        <SocketContext.Provider
            value={{
                drawGuessSocket,
                canvasSocket,
                drawGuessCanvasSocket,
                isDrawGuessConnected,
                isCanvasConnected,
                isDrawGuessCanvasConnected
            }}
        >
            {children}
        </SocketContext.Provider>
    );
};