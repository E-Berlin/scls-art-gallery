// pages/drawGuess/DrawGuessRoutes.tsx
import React from "react";
import { Routes, Route } from "react-router-dom";
import MainMenu from "./MainMenu";
import Leaderboard from "./Leaderboard";
import CreateRoom from "./CreateRoom";
import Lobby from "./Lobby";
import WordSelection from "./WordSelection";
import DrawGuessMain from "./DrawGuessMain";
import RoundResult from "./RoundResult";
import FinalResult from "./FinalResult";

const DrawGuessRoutes: React.FC = () => (
    <Routes>
        <Route path="" element={<MainMenu />} />
        <Route path="leader-board" element={<Leaderboard />} />
        <Route path="create-room" element={<CreateRoom />} />
        <Route path="lobby/:roomID" element={<Lobby />} />
        <Route path="word-selection/:roomID" element={<WordSelection />} />
        <Route path="draw-guess-main/:roomID" element={<DrawGuessMain />} />
        <Route path="round-result/:roomID" element={<RoundResult />} />
        <Route path="final-result/:roomID" element={<FinalResult />} />
    </Routes>
);

export default DrawGuessRoutes;