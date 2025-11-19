// src/App.tsx
import React from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { PageTransitionProvider } from "../context/PageTransitionContext";
import { UserProvider } from "../context/UserContext";
import { SocketProvider } from "../context/SocketContext";
import { SUPABASE_URL } from "./config"
import Navbar from "../components/Navbar";
import IndexPage from "../pages/IndexPage";
import ArtGalleryPage from "../pages/GalleryPage";
import ArtGamePage from "../pages/GamePage";
import CollectionPage from "../pages/CollectionPage";
import CollectiveCanvasPage from "../pages/CollectiveCanvasPage";
import LoginPage from "../pages/LoginPage";
import SignupPage from "../pages/SignupPage";
import VerifyPage from "../pages/VerifyPage";
import ProfilePage from "../pages/ProfilePage";
import UploadPage from "../pages/UploadPage";
import ReviewPage from "../pages/ReviewPage";
import DrawGuessRoutes from "../pages/drawGuess/DrawGuessRoutes";

const AppRoutes: React.FC = () => {
  const location = useLocation();

  const noNavbarPaths = ["/", "/login", "/signup", "/verify"];
  const showNavbar = !noNavbarPaths.includes(location.pathname);

  const LOGO = `${SUPABASE_URL}/storage/v1/object/public/default-imgs/logo.jpg`;

  return (
    <>
      {showNavbar && <Navbar logo={LOGO} />}
      <Routes>
        <Route path="/" element={<IndexPage />} />
        <Route path="/gallery" element={<ArtGalleryPage />} />
        <Route path="/game" element={<ArtGamePage />} />
        <Route path="/gallery/:category" element={<CollectionPage />} />
        <Route path="/game/collective-canvas" element={<CollectiveCanvasPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/review" element={<ReviewPage />} />
        {/* 🔹 这里套上 SocketProvider，只针对 draw-guess 子路由 */}
        <Route
          path="/game/draw-guess/*"
          element={
            <DrawGuessRoutes />
          }
        />
      </Routes>
    </>
  );
};

const App: React.FC = () => (
  <Router>
    <UserProvider>
      <PageTransitionProvider>
        <SocketProvider>
          <AppRoutes />
        </SocketProvider>
      </PageTransitionProvider>
    </UserProvider>
  </Router>
);

export default App;
