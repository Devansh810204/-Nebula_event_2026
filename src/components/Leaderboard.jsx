import React, { useState, useEffect } from "react";
import { useEvent } from "../context/EventContext";
import { Trophy, RefreshCw, Search, ShieldAlert, CheckCircle2, Clock, Zap } from "lucide-react";

export default function Leaderboard() {
  const { teams, currentUser } = useEvent();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // 'all' | 'solved' | 'pending' | 'disqualified'
  const [countdown, setCountdown] = useState(10);
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());

  // 10-Second Auto-Refresh Tracker
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setLastUpdated(new Date().toLocaleTimeString());
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Sorting Algorithm
  // 1. Solved teams on top
  // 2. Accuracy: chances used (1 attempt > 2 attempts)
  // 3. Timing: smallest timeTaken on top
  // 4. In progress / Pending teams
  // 5. Disqualified teams at the bottom with "Disabled for changing tab"
  const sortedTeams = [...teams].sort((a, b) => {
    // Both solved: rank by accuracy then timing
    if (a.solved && b.solved) {
      if (a.chancesUsed !== b.chancesUsed) {
        return a.chancesUsed - b.chancesUsed; // 1 attempt (100% accuracy) is better than 2 (50%)
      }
      return (a.timeTaken || 9999) - (b.timeTaken || 9999);
    }

    // Solved comes before unsolved
    if (a.solved && !b.solved) return -1;
    if (!a.solved && b.solved) return 1;

    // Disqualified comes last
    const aDisq = a.status === "DISQUALIFIED" || Boolean(a.disqualifiedReason);
    const bDisq = b.status === "DISQUALIFIED" || Boolean(b.disqualifiedReason);
    if (!aDisq && bDisq) return -1;
    if (aDisq && !bDisq) return 1;

    // Remaining: sort by chancesLeft descending (2 chances left > 1 chance left)
    if (a.chancesLeft !== b.chancesLeft) {
      return b.chancesLeft - a.chancesLeft;
    }

    return a.id.localeCompare(b.id);
  });

  // Filter & Search
  const filteredTeams = sortedTeams.filter((team) => {
    const matchesSearch =
      team.name.toLowerCase().includes(search.toLowerCase()) ||
      team.id.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === "solved") return team.solved;
    if (filter === "disqualified") return team.status === "DISQUALIFIED" || Boolean(team.disqualifiedReason);
    if (filter === "pending") return !team.solved && team.status !== "DISQUALIFIED" && !team.disqualifiedReason;

    return true;
  });

  const top3 = sortedTeams.filter((t) => t.solved).slice(0, 3);

  return (
    <div className="leaderboard-container">
      {/* Header with 10s auto-refresh badge */}
      <div className="leaderboard-header">
        <div className="leaderboard-title-group">
          <div className="trophy-badge">
            <Trophy size={28} className="text-gold" />
          </div>
          <div>
            <h1>Official Event Leaderboard</h1>
            <p>Live rankings sorted strictly by Accuracy and Shortest Completion Time</p>
          </div>
        </div>

        <div className="sync-status-card">
          <div className="sync-pulse-indicator">
            <span className="live-dot"></span>
            <span className="live-text">LIVE SYNC</span>
          </div>
          <div className="sync-timer">
            <RefreshCw size={14} className="spin-slow" />
            <span>Updates in {countdown}s</span>
          </div>
          <div className="sync-time-sub">Last updated: {lastUpdated}</div>
        </div>
      </div>

      {/* Podium for Top 3 Teams */}
      {top3.length > 0 && (
        <div className="podium-grid">
          {top3[0] && (
            <div className="podium-card gold">
              <div className="podium-medal">🥇 1st Place</div>
              <div className="podium-team-id">{top3[0].id}</div>
              <div className="podium-name">{top3[0].name}</div>
              <div className="podium-metrics">
                <span>⚡ {top3[0].timeTaken}s</span>
                <span>🎯 {top3[0].chancesUsed === 1 ? "100% (1st Try)" : "50% (2nd Try)"}</span>
              </div>
            </div>
          )}

          {top3[1] && (
            <div className="podium-card silver">
              <div className="podium-medal">🥈 2nd Place</div>
              <div className="podium-team-id">{top3[1].id}</div>
              <div className="podium-name">{top3[1].name}</div>
              <div className="podium-metrics">
                <span>⚡ {top3[1].timeTaken}s</span>
                <span>🎯 {top3[1].chancesUsed === 1 ? "100% (1st Try)" : "50% (2nd Try)"}</span>
              </div>
            </div>
          )}

          {top3[2] && (
            <div className="podium-card bronze">
              <div className="podium-medal">🥉 3rd Place</div>
              <div className="podium-team-id">{top3[2].id}</div>
              <div className="podium-name">{top3[2].name}</div>
              <div className="podium-metrics">
                <span>⚡ {top3[2].timeTaken}s</span>
                <span>🎯 {top3[2].chancesUsed === 1 ? "100% (1st Try)" : "50% (2nd Try)"}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="filter-bar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search team name or ID (e.g. TEAM01)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-tabs">
          <button
            className={`filter-btn ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All Teams ({teams.length})
          </button>
          <button
            className={`filter-btn ${filter === "solved" ? "active" : ""}`}
            onClick={() => setFilter("solved")}
          >
            Solved ({teams.filter((t) => t.solved).length})
          </button>
          <button
            className={`filter-btn ${filter === "pending" ? "active" : ""}`}
            onClick={() => setFilter("pending")}
          >
            In Progress / Pending ({teams.filter((t) => !t.solved && t.status !== "DISQUALIFIED").length})
          </button>
          <button
            className={`filter-btn ${filter === "disqualified" ? "active" : ""}`}
            onClick={() => setFilter("disqualified")}
          >
            Disqualified ({teams.filter((t) => t.status === "DISQUALIFIED" || t.disqualifiedReason).length})
          </button>
        </div>
      </div>

      {/* Main Leaderboard Table */}
      <div className="table-responsive">
        <table className="main-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Team Identification</th>
              <th>Status</th>
              <th>Accuracy / Chances</th>
              <th>Time Taken</th>
              <th>Score Ranking</th>
            </tr>
          </thead>
          <tbody>
            {filteredTeams.map((team, idx) => {
              const isDisqualified = team.status === "DISQUALIFIED" || Boolean(team.disqualifiedReason);
              const isCurrent = currentUser?.type === "TEAM" && currentUser.teamId === team.id;

              return (
                <tr
                  key={team.id}
                  className={`${isCurrent ? "current-team-row" : ""} ${
                    isDisqualified ? "disqualified-row" : ""
                  }`}
                >
                  <td className="rank-cell">
                    {team.solved ? (
                      <span className={`rank-badge ${idx === 0 ? "rank-gold" : idx === 1 ? "rank-silver" : idx === 2 ? "rank-bronze" : ""}`}>
                        #{idx + 1}
                      </span>
                    ) : (
                      <span className="rank-badge-gray">#{idx + 1}</span>
                    )}
                  </td>

                  <td>
                    <div className="team-meta">
                      <span className="team-meta-id">{team.id}</span>
                      <span className="team-meta-name">{team.name}</span>
                      {isCurrent && <span className="you-pill">YOU</span>}
                    </div>
                  </td>

                  <td>
                    {team.solved ? (
                      <span className="status-pill status-solved">
                        <CheckCircle2 size={14} /> Solved
                      </span>
                    ) : isDisqualified ? (
                      <span className="status-pill status-disqualified" title={team.disqualifiedReason}>
                        <ShieldAlert size={14} /> Disabled for changing tab
                      </span>
                    ) : team.startTime ? (
                      <span className="status-pill status-progress">
                        <Clock size={14} /> In Progress
                      </span>
                    ) : (
                      <span className="status-pill status-pending">
                        Pending Login
                      </span>
                    )}
                  </td>

                  <td>
                    {team.solved ? (
                      <div className="accuracy-box">
                        <span className="accuracy-val">
                          {team.chancesUsed === 1 ? "100% Accuracy" : "50% Accuracy"}
                        </span>
                        <span className="attempts-detail">
                          Solved in {team.chancesUsed} / 2 chances
                        </span>
                      </div>
                    ) : isDisqualified ? (
                      <span className="text-muted">Disqualified</span>
                    ) : (
                      <span className="chances-rem-text">
                        {team.chancesLeft} of 2 chances left
                      </span>
                    )}
                  </td>

                  <td>
                    {team.solved ? (
                      <div className="time-val-box">
                        <Zap size={14} className="text-neon-cyan" />
                        <span className="time-val">{team.timeTaken}s</span>
                      </div>
                    ) : (
                      <span className="text-muted">--</span>
                    )}
                  </td>

                  <td>
                    {team.solved ? (
                      <span className="score-badge">
                        {team.chancesUsed === 1
                          ? Math.max(10, 1000 - (team.timeTaken || 0) * 2)
                          : Math.max(5, 500 - (team.timeTaken || 0))} pts
                      </span>
                    ) : (
                      <span className="text-muted">0 pts</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
