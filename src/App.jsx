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
  const { currentUser, activeTab, setActiveTab } = useEvent();
  const isMobile = useDeviceDetector();

  // If accessed from Android, mobile phone, or tablet:
  if (isMobile) {
    return <DeviceRestriction />;
  }

  // If user is not logged in:
  if (!currentUser) {
    return (
      <div className="app-layout">
        <Navbar />
        <main className="main-content">
          {activeTab === "leaderboard" ? (
            <Leaderboard />
          ) : (
            <Login />
          )}
        </main>
      </div>
    );
  }

  // If user is Admin:
  if (currentUser.type === "ADMIN") {
    return (
      <div className="app-layout">
        <Navbar />
        <main className="main-content">
          {activeTab === "leaderboard" ? (
            <Leaderboard />
          ) : (
            <AdminPanel />
          )}
        </main>
      </div>
    );
  }

  // If user is a Team:
  return (
    <div className="app-layout">
      <Navbar />
      <main className="main-content">
        {activeTab === "leaderboard" ? (
          <Leaderboard />
        ) : (
          <OutputSection onSwitchToLeaderboard={() => setActiveTab("leaderboard")} />
        )}
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
