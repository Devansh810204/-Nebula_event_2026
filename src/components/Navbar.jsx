import React from "react";
import { useEvent } from "../context/EventContext";
import { Trophy, Terminal, ShieldAlert, LogOut, ShieldCheck } from "lucide-react";

export default function Navbar() {
  const { currentUser, currentTeam, activeTab, setActiveTab, logout, isBackendConnected } = useEvent();

  return (
    <header className="navbar">
      <div className="nav-container">
        {/* Logo / Title */}
        <div className="brand" onClick={() => setActiveTab(currentUser?.type === "ADMIN" ? "admin" : "output")}>
          <div className="brand-badge">
            <Terminal size={20} className="text-neon-cyan" />
          </div>
          <div>
            <div className="brand-title">NEBULA 2026</div>
            <div className="brand-subtitle">Tech Event • Codebreaker Challenge</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="nav-tabs">
          {currentUser?.type === "TEAM" && (
            <button
              className={`nav-tab-btn ${activeTab === "output" ? "active" : ""}`}
              onClick={() => setActiveTab("output")}
            >
              <Terminal size={18} />
              <span>2. Output</span>
            </button>
          )}

          <button
            className={`nav-tab-btn ${activeTab === "leaderboard" ? "active" : ""}`}
            onClick={() => setActiveTab("leaderboard")}
          >
            <Trophy size={18} />
            <span>1. Leaderboard</span>
          </button>

          {currentUser?.type === "ADMIN" && (
            <button
              className={`nav-tab-btn ${activeTab === "admin" ? "active" : ""}`}
              onClick={() => setActiveTab("admin")}
            >
              <ShieldCheck size={18} />
              <span>Admin Portal</span>
            </button>
          )}
        </div>

        {/* User Info & Logout */}
        <div className="user-section">
          {/* Live Server Sync Status */}
          {isBackendConnected === true && (
            <div className="server-status-pill online" title="Central backend connected: All laptops are synchronized">
              <span className="status-dot green"></span>
              <span>Server Synced</span>
            </div>
          )}
          {isBackendConnected === false && (
            <div
              className="server-status-pill offline"
              title="Backend not detected! Running in local-only mode. To sync across laptops, deploy as a Web Service on Render."
            >
              <span className="status-dot red"></span>
              <span>Local Mode (No Server)</span>
            </div>
          )}

          {currentUser?.type === "TEAM" && currentTeam && (
            <div className="team-pill">
              <span className="team-pill-name">{currentTeam.name}</span>
              <span className={`chances-tag chances-${currentTeam.chancesLeft}`}>
                {currentTeam.chancesLeft}/2 Chances
              </span>
            </div>
          )}

          {currentUser?.type === "ADMIN" && (
            <div className="admin-pill">
              <ShieldCheck size={16} />
              <span>Tech Head (Admin)</span>
            </div>
          )}

          {currentUser ? (
            <button className="logout-btn" onClick={logout} title="Log Out">
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          ) : (
            <div className="guest-badge">
              <ShieldAlert size={14} />
              <span>Login Required</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
