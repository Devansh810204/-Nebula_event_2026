import React, { useState } from "react";
import { useEvent } from "../context/EventContext";
import { Lock, Users, AlertTriangle, ShieldAlert, KeyRound, Sparkles } from "lucide-react";

export default function Login() {
  const { login, teams } = useEvent();
  const [teamId, setTeamId] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [isDisqualifiedError, setIsDisqualifiedError] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsDisqualifiedError(false);

    if (!teamId.trim()) {
      setError("Please enter your Team ID or Username.");
      return;
    }
    if (!passcode.trim()) {
      setError("Please enter your Passcode.");
      return;
    }

    const res = await login(teamId, passcode);
    if (!res.success) {
      setError(res.error);
      if (res.isDisqualified) {
        setIsDisqualifiedError(true);
      }
    }
  };

  const handleQuickFill = (id, pass) => {
    setTeamId(id);
    setPasscode(pass);
    setError("");
    setIsDisqualifiedError(false);
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <div className="cyber-icon-ring">
            <Lock size={32} className="text-neon-cyan" />
          </div>
          <h2>Participant Access Portal</h2>
          <p>College Technical Event • Password Decryption Challenge</p>
        </div>

        {error && (
          <div className={`login-error-box ${isDisqualifiedError ? "disqualified-alert" : ""}`}>
            {isDisqualifiedError ? <ShieldAlert size={22} /> : <AlertTriangle size={20} />}
            <div>
              <strong>{isDisqualifiedError ? "SECURITY VIOLATION DETECTED" : "Login Failed"}</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>
              <Users size={16} /> Team ID / Access Key
            </label>
            <input
              type="text"
              placeholder="e.g. TEAM01 or ADMIN"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              autoFocus
              className="cyber-input"
            />
          </div>

          <div className="form-group">
            <label>
              <KeyRound size={16} /> Team Passcode
            </label>
            <input
              type="password"
              placeholder="Enter passcode"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="cyber-input"
            />
          </div>

          <button type="submit" className="login-submit-btn">
            <span>Enter Competition</span>
            <Sparkles size={18} />
          </button>
        </form>

        {/* Quick Demo Credentials for Organizer/Testing */}
        <div className="quick-fill-section">
          <div className="quick-fill-label">Demo & Testing Shortcuts:</div>
          <div className="quick-fill-chips">
            <button
              type="button"
              className="chip-btn"
              onClick={() => handleQuickFill("TEAM01", "team01")}
            >
              Team 01
            </button>
            <button
              type="button"
              className="chip-btn"
              onClick={() => handleQuickFill("TEAM02", "team02")}
            >
              Team 02
            </button>
            <button
              type="button"
              className="chip-btn"
              onClick={() => handleQuickFill("TEAM03", "team03")}
            >
              Team 03
            </button>
            <button
              type="button"
              className="chip-btn admin-chip"
              onClick={() => handleQuickFill("ADMIN", "admin2026")}
            >
              Tech Head (Admin)
            </button>
          </div>
        </div>

        <div className="security-notice-footer">
          <ShieldAlert size={14} />
          <span>
            Security Warning: Tab switching or exiting full-screen during the challenge will permanently disqualify your team as "Disabled for changing tab".
          </span>
        </div>
      </div>
    </div>
  );
}
