import React from "react";
import { EventProvider, useEvent } from "./context/EventContext";
import Navbar from "./components/Navbar";
import Login from "./components/Login";
import OutputSection from "./components/OutputSection";
import Leaderboard from "./components/Leaderboard";
import AdminPanel from "./components/AdminPanel";
import DeviceRestriction from "./components/DeviceRestriction";
import { useDeviceDetector } from "./utils/deviceCheck";
import "./App.css";

function AppContent() {
  const { currentUser, currentTeam, activeTab, setActiveTab } = useEvent();
  const isMobile = useDeviceDetector();

  // If accessed from Android, mobile phone, or tablet:
  if (isMobile) {
    return <DeviceRestriction />;
  }

  // Render appropriate view based on auth
  let content = null;
  if (!currentUser) {
    content = activeTab === "leaderboard" ? <Leaderboard /> : <Login />;
  } else if (currentUser.type === "ADMIN") {
    content = activeTab === "leaderboard" ? <Leaderboard /> : <AdminPanel />;
  } else {
    content = activeTab === "leaderboard" ? (
      <Leaderboard />
    ) : (
      <OutputSection onSwitchToLeaderboard={() => setActiveTab("leaderboard")} />
    );
  }

  return (
    <div className="app-layout">
      {/* 1. Global Website Nebula Logo Watermark in background */}
      <div className="site-watermark-overlay" aria-hidden="true">
        <img src="/nebula-logo.jpg" alt="" className="site-watermark-img" />
      </div>

      {/* 2. Team-Specific Name Watermark in background when team is logged in */}
      {currentUser?.type === "TEAM" && currentTeam && (
        <div className="team-watermark-overlay" aria-hidden="true">
          <div className="team-watermark-track">
            <span className="team-watermark-name">{currentTeam.name}</span>
            <span className="team-watermark-id">{currentTeam.id}</span>
          </div>
        </div>
      )}

      <Navbar />
      <main className="main-content">
        {content}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <EventProvider>
      <AppContent />
    </EventProvider>
  );
}
