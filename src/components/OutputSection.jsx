import React, { useState, useEffect, useRef } from "react";
import { useEvent } from "../context/EventContext";
import confetti from "canvas-confetti";
import {
  Clock,
  KeyRound,
  Send,
  Maximize,
  ShieldAlert,
  HelpCircle,
  Trophy,
  CheckCircle2,
  RefreshCw,
  Info
} from "lucide-react";

export default function OutputSection({ onSwitchToLeaderboard }) {
  const {
    currentTeam,
    disqualifyTeam,
    startTeamTimer,
    submitGuess,
    eventDuration,
    teams
  } = useEvent();

  const [inputVal, setInputVal] = useState("");
  const [inFullScreen, setInFullScreen] = useState(false);
  const [hasEnteredArena, setHasEnteredArena] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [securityViolation, setSecurityViolation] = useState(null);
  const [timeLeft, setTimeLeft] = useState(eventDuration);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [lastRefreshCountdown, setLastRefreshCountdown] = useState(10);

  const arenaRef = useRef(null);
  const violationHandledRef = useRef(false);

  // Trigger disqualification & logout
  const handleSecurityBreach = (reason = "Disabled for changing tab") => {
    if (violationHandledRef.current) return;
    violationHandledRef.current = true;

    setSecurityViolation(reason);
    if (currentTeam) {
      disqualifyTeam(currentTeam.id, reason);
    }
  };

  // Full Screen Request
  const enterFullScreenArena = async () => {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      } else if (el.msRequestFullscreen) {
        await el.msRequestFullscreen();
      }
      setInFullScreen(true);
      setHasEnteredArena(true);

      // Start timing immediately as user enters Output section
      if (currentTeam) {
        startTeamTimer(currentTeam.id);
      }
    } catch (err) {
      console.warn("Fullscreen request error or fallback:", err);
      // Fallback: continue into arena
      setInFullScreen(true);
      setHasEnteredArena(true);
      if (currentTeam) {
        startTeamTimer(currentTeam.id);
      }
    }
  };

  // Security Event Listeners (Tab change, window blur, fullscreen exit)
  useEffect(() => {
    if (!hasEnteredArena || !currentTeam || currentTeam.status === "DISQUALIFIED" || currentTeam.solved) {
      return;
    }

    // 1. Detect Fullscreen Exit
    const handleFullscreenChange = () => {
      const isStillFullscreen = Boolean(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );

      if (!isStillFullscreen) {
        handleSecurityBreach("Disabled for changing tab");
      }
    };

    // 2. Detect Tab Switch / Window Minimize
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleSecurityBreach("Disabled for changing tab");
      }
    };

    // 3. Detect Window Blur (clicking outside, alt-tab, switching windows)
    const handleWindowBlur = () => {
      // Small timeout to ignore natural system focus flutters
      setTimeout(() => {
        if (!document.hasFocus() || document.hidden) {
          handleSecurityBreach("Disabled for changing tab");
        }
      }, 150);
    };

    // 4. Block Keyboard shortcuts like F12, Ctrl+C, Ctrl+V, Alt+Tab prevention
    const handleKeyDown = (e) => {
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) ||
        (e.ctrlKey && (e.key === "u" || e.key === "U"))
      ) {
        e.preventDefault();
        return false;
      }
    };

    // 5. Block Context Menu (right click)
    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [hasEnteredArena, currentTeam]);

  // Timer logic: starts as soon as user enters Output section
  useEffect(() => {
    if (!currentTeam || currentTeam.solved || currentTeam.status === "DISQUALIFIED") {
      return;
    }

    if (!currentTeam.startTime) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - currentTeam.startTime) / 1000);
      const remaining = Math.max(0, eventDuration - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        setIsTimeUp(true);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentTeam, eventDuration]);

  // Leaderboard 10-second pulse timer
  useEffect(() => {
    const pulse = setInterval(() => {
      setLastRefreshCountdown((prev) => (prev <= 1 ? 10 : prev - 1));
    }, 1000);
    return () => clearInterval(pulse);
  }, []);

  // Handle Guess Submission
  const handleGuessSubmit = (e) => {
    e.preventDefault();
    if (!inputVal.trim() || !currentTeam) return;

    if (currentTeam.chancesLeft <= 0 || isTimeUp || currentTeam.solved) {
      return;
    }

    const res = submitGuess(currentTeam.id, inputVal);
    if (res.correct) {
      setFeedbackMessage("🎉 Password Matched! Congratulations!");
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
    } else {
      setInputVal("");
      // Per user instruction: No status (like failed) is shown, only chances left is shown!
      setFeedbackMessage(`Incorrect guess! Chances Left: ${res.chancesLeft}`);
    }
  };

  // Format seconds to mm:ss
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // 1. If Disqualified: The ONLY status explicitly shown to the team
  if (currentTeam?.status === "DISQUALIFIED" || securityViolation) {
    return (
      <div className="security-lockout-screen">
        <div className="security-lockout-box">
          <div className="security-icon-pulsing">
            <ShieldAlert size={64} className="text-neon-red" />
          </div>
          <h1 className="lockout-title">SECURITY VIOLATION</h1>
          <div className="status-banner-disabled">
            STATUS: <span>Disabled for changing tab</span>
          </div>
          <p className="lockout-desc">
            You exited full screen, changed browser tabs, or lost window focus.
            Per competition regulations, typing has been disabled and your team has been permanently locked out.
          </p>
          <div className="lockout-team-badge">
            Team: {currentTeam?.name || "Current Team"}
          </div>
          <div className="lockout-note">
            Organizers & Tech Heads can review access logs in the Admin panel.
          </div>
        </div>
      </div>
    );
  }

  // 2. Gatekeeper: Must enter Full Screen to access Output Section
  if (!hasEnteredArena) {
    return (
      <div className="gatekeeper-container">
        <div className="gatekeeper-card">
          <div className="gatekeeper-badge">
            <ShieldAlert size={36} className="text-neon-cyan" />
          </div>
          <h2>Mandatory Full Screen Security Arena</h2>
          <p className="gatekeeper-intro">
            Welcome, <strong>{currentTeam?.name}</strong>! To ensure strict competitive fairness, the Output submission section runs in a secure monitored environment.
          </p>

          <div className="security-rules-box">
            <h4>Active Anti-Cheat Rules:</h4>
            <ul>
              <li>
                <strong>Mandatory Full Screen:</strong> The challenge will open in full-screen mode. Exiting full screen at any moment disqualifies your team.
              </li>
              <li>
                <strong>Tab Change Detection:</strong> Switching tabs or opening applications will immediately mark your team as <em>"Disabled for changing tab"</em>.
              </li>
              <li>
                <strong>2 Chances Limit:</strong> You have only 2 attempts to arrange and enter the correct 4-letter password.
              </li>
              <li>
                <strong>Live Timer:</strong> Your timer starts the second you enter below.
              </li>
            </ul>
          </div>

          <button className="enter-arena-btn" onClick={enterFullScreenArena}>
            <Maximize size={20} />
            <span>Enter Full Screen Arena & Start Timer</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Main Arena View
  const isTypingDisabled =
    currentTeam?.chancesLeft <= 0 ||
    isTimeUp ||
    currentTeam?.solved ||
    currentTeam?.status === "DISQUALIFIED";

  // Sorted leaderboard for quick docked view in Output section
  const sortedTeams = [...teams].sort((a, b) => {
    // 1. Solved teams first
    if (a.solved && !b.solved) return -1;
    if (!a.solved && b.solved) return 1;

    // 2. If both solved, compare accuracy (chances used: 1 is better than 2)
    if (a.solved && b.solved) {
      if (a.chancesUsed !== b.chancesUsed) {
        return a.chancesUsed - b.chancesUsed;
      }
      // 3. Compare timing (smallest timeTaken on top)
      return (a.timeTaken || 9999) - (b.timeTaken || 9999);
    }

    // 4. Non-disqualified over disqualified
    if (a.status !== "DISQUALIFIED" && b.status === "DISQUALIFIED") return -1;
    if (a.status === "DISQUALIFIED" && b.status !== "DISQUALIFIED") return 1;

    return 0;
  });

  const myRank = sortedTeams.findIndex((t) => t.id === currentTeam?.id) + 1;

  return (
    <div className="arena-layout" ref={arenaRef}>
      {/* Left / Main: Challenge Section */}
      <div className="challenge-column">
        {/* Top Status Bar: Timer & Chances */}
        <div className="arena-top-bar">
          <div className="timer-badge">
            <Clock size={20} className={timeLeft < 60 ? "text-neon-red pulse" : "text-neon-cyan"} />
            <div>
              <span className="bar-label">TIME REMAINING</span>
              <span className={`time-digits ${timeLeft < 60 ? "urgent" : ""}`}>
                {formatTime(timeLeft)}
              </span>
            </div>
          </div>

          <div className="chances-badge-box">
            <span className="bar-label">ATTEMPTS</span>
            <div className="chances-display">
              <span className="chances-count-text">
                Chances Left: <strong>{currentTeam?.chancesLeft}</strong> / 2
              </span>
              <div className="chance-dots">
                <span className={`dot ${currentTeam?.chancesLeft >= 1 ? "filled" : "empty"}`}></span>
                <span className={`dot ${currentTeam?.chancesLeft >= 2 ? "filled" : "empty"}`}></span>
              </div>
            </div>
          </div>

          <div className="security-shield-pill">
            <ShieldAlert size={16} className="text-neon-green" />
            <span>Anti-Cheat Guard Active</span>
          </div>
        </div>

        {/* Challenge Box */}
        <div className="challenge-card">
          <div className="team-intro">
            <h3>{currentTeam?.name}</h3>
            <span className="team-code-tag">ID: {currentTeam?.id}</span>
          </div>

          {/* 4 Alphabet Letters Display */}
          <div className="letters-container">
            <div className="letters-title">YOUR 4 ASSIGNED LETTERS:</div>
            <div className="letter-tiles">
              {currentTeam?.letters?.map((letter, idx) => (
                <div key={idx} className="letter-tile">
                  {letter}
                </div>
              ))}
            </div>
            <div className="letters-subtext">
              Arrange these 4 letters to form the correct secret password.
            </div>
          </div>

          {/* Team Hint */}
          <div className="hint-container">
            <div className="hint-header">
              <HelpCircle size={18} className="text-neon-cyan" />
              <span>Password Hint for Your Team</span>
            </div>
            <p className="hint-content">"{currentTeam?.hint}"</p>
          </div>

          {/* Success / Solved Banner */}
          {currentTeam?.solved && (
            <div className="solved-success-banner">
              <CheckCircle2 size={32} />
              <div>
                <h4>CHALLENGE SOLVED!</h4>
                <p>
                  You matched the correct password in <strong>{currentTeam.timeTaken}s</strong> with{" "}
                  <strong>{currentTeam.chancesUsed}</strong> attempt(s)!
                </p>
                <div className="solved-rank-text">Current Rank: #{myRank} on Leaderboard</div>
              </div>
            </div>
          )}

          {/* Feedback message (Chances Left notification) */}
          {feedbackMessage && !currentTeam?.solved && (
            <div className="feedback-banner">
              <Info size={18} />
              <span>{feedbackMessage}</span>
            </div>
          )}

          {/* Time Up Alert */}
          {isTimeUp && !currentTeam?.solved && (
            <div className="time-up-banner">
              <Clock size={20} />
              <span>Time Over! Submission window has closed for this event.</span>
            </div>
          )}

          {/* Input Submission Form */}
          {!currentTeam?.solved && (
            <form onSubmit={handleGuessSubmit} className="guess-form">
              <div className="input-group-styled">
                <div className="input-prefix">
                  <KeyRound size={20} />
                </div>
                <input
                  type="text"
                  maxLength={4}
                  placeholder={
                    isTypingDisabled
                      ? currentTeam?.chancesLeft === 0
                        ? "0 Chances remaining"
                        : isTimeUp
                        ? "Time Expired"
                        : "Input disabled"
                      : "Type 4-letter password"
                  }
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value.toUpperCase())}
                  disabled={isTypingDisabled}
                  autoFocus
                  className="password-input"
                />
                <button
                  type="submit"
                  disabled={isTypingDisabled || inputVal.trim().length !== 4}
                  className="submit-guess-btn"
                >
                  <span>Submit</span>
                  <Send size={18} />
                </button>
              </div>

              {/* Note: In accordance with user feedback: No status like FAILED is displayed when chances = 0. Only chances left is shown */}
              {currentTeam?.chancesLeft === 0 && (
                <div className="chances-exhausted-note">
                  Chances Left: 0. Typing is now disabled.
                </div>
              )}
            </form>
          )}
        </div>
      </div>

      {/* Right Column: Live Leaderboard Preview Docked in Output Section */}
      <div className="docked-leaderboard-column">
        <div className="docked-header">
          <div className="docked-title">
            <Trophy size={18} className="text-gold" />
            <span>Live Event Leaderboard</span>
          </div>
          <div className="sync-pill" title="Auto updates every 10 seconds">
            <RefreshCw size={12} className="spin-slow" />
            <span>Sync: {lastRefreshCountdown}s</span>
          </div>
        </div>

        <div className="docked-table-wrap">
          <table className="docked-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                <th>Accuracy</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {sortedTeams.slice(0, 15).map((team, index) => {
                const isMe = team.id === currentTeam?.id;
                return (
                  <tr key={team.id} className={`${isMe ? "me-row" : ""} ${team.status === "DISQUALIFIED" ? "disqualified-row" : ""}`}>
                    <td>
                      <span className={`rank-tag rank-${index + 1}`}>
                        {index === 0 ? "🥇 1" : index === 1 ? "🥈 2" : index === 2 ? "🥉 3" : `#${index + 1}`}
                      </span>
                    </td>
                    <td>
                      <div className="team-col">
                        <span className="team-id-badge">{team.id}</span>
                        <span className="team-col-name">{team.name}</span>
                      </div>
                    </td>
                    <td>
                      {team.solved ? (
                        <span className="acc-tag solved">
                          {team.chancesUsed === 1 ? "100% (1/2)" : "50% (2/2)"}
                        </span>
                      ) : team.status === "DISQUALIFIED" ? (
                        <span className="acc-tag disqualified">Disabled</span>
                      ) : (
                        <span className="acc-tag pending">{team.chancesLeft}/2 left</span>
                      )}
                    </td>
                    <td>
                      <span className="time-tag">
                        {team.timeTaken ? `${team.timeTaken}s` : "--"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button
          className="full-leaderboard-btn"
          onClick={onSwitchToLeaderboard}
        >
          <Trophy size={16} />
          <span>View Complete 40-Team Leaderboard</span>
        </button>
      </div>
    </div>
  );
}
