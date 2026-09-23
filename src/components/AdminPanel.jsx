import React, { useState } from "react";
import { useEvent } from "../context/EventContext";
import {
  ShieldCheck,
  PlusCircle,
  Edit3,
  Trash2,
  RotateCcw,
  Sparkles,
  Download,
  Search,
  CheckCircle2,
  ShieldAlert,
  Clock,
  KeyRound,
  FileText
} from "lucide-react";

export default function AdminPanel() {
  const {
    teams,
    updateTeamQuestion,
    deleteTeam,
    addNewTeam,
    resetTeamStatus,
    resetAllTeams,
    eventDuration,
    updateEventDuration,
    simulateTeamActivity,
  } = useEvent();

  const [activeAdminTab, setActiveAdminTab] = useState("questions"); // 'questions' | 'monitor' | 'settings'
  const [searchTerm, setSearchTerm] = useState("");
  const [editingTeam, setEditingTeam] = useState(null);

  // New Team Form State
  const [newTeamId, setNewTeamId] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [newLetters, setNewLetters] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newHint, setNewHint] = useState("");
  const [formMsg, setFormMsg] = useState("");

  // Edit Team Form State
  const [editName, setEditName] = useState("");
  const [editPasscode, setEditPasscode] = useState("");
  const [editLetters, setEditLetters] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editHint, setEditHint] = useState("");

  // Open Edit Modal
  const startEditing = (team) => {
    setEditingTeam(team);
    setEditName(team.name);
    setEditPasscode(team.passcode);
    setEditLetters(team.letters ? team.letters.join("") : "");
    setEditPassword(team.password);
    setEditHint(team.hint);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingTeam) return;

    if (editPassword.trim().length < 3) {
      alert("Password must be at least 3 characters!");
      return;
    }

    await updateTeamQuestion(editingTeam.id, {
      name: editName,
      passcode: editPasscode,
      hint: editHint,
      password: editPassword,
      letters: editLetters,
    });

    setEditingTeam(null);
  };

  // Delete Team Handler
  const handleDeleteTeam = async (teamId, teamName) => {
    if (window.confirm(`Are you sure you want to permanently delete ${teamName} (${teamId})?\n\nThis will remove them from the leaderboard, live monitor, and competition database.`)) {
      await deleteTeam(teamId);
    }
  };

  // Add New Team Handler
  const handleAddNewTeam = async (e) => {
    e.preventDefault();
    setFormMsg("");

    if (!newTeamId.trim() || !newPassword.trim() || !newHint.trim()) {
      setFormMsg("Please fill in Team ID, Password, and Hint.");
      return;
    }

    if (newPassword.trim().length < 3) {
      setFormMsg("Password must be at least 3 characters.");
      return;
    }

    const res = await addNewTeam({
      id: newTeamId,
      name: newTeamName || `Team ${newTeamId}`,
      passcode: newPasscode || "pass123",
      letters: newLetters || newPassword,
      password: newPassword,
      hint: newHint,
    });

    if (res && res.success) {
      setFormMsg("Team and Question added successfully!");
      setNewTeamId("");
      setNewTeamName("");
      setNewPasscode("");
      setNewLetters("");
      setNewPassword("");
      setNewHint("");
      setTimeout(() => setFormMsg(""), 3500);
    } else {
      setFormMsg(res?.message || "Failed to add team.");
    }
  };

  // Export Leaderboard to CSV
  const exportToCSV = () => {
    const headers = ["Rank,Team ID,Team Name,Status,Accuracy,Chances Used,Time Taken (s),Password,Hint"];
    const rows = teams.map((t, idx) => {
      const accuracy = t.solved ? (t.chancesUsed === 1 ? "100%" : "50%") : "0%";
      const escapedHint = `"${t.hint.replace(/"/g, '""')}"`;
      return `${idx + 1},${t.id},"${t.name}",${t.disqualifiedReason ? "Disabled for changing tab" : t.status},${accuracy},${t.chancesUsed},${t.timeTaken || "--"},${t.password},${escapedHint}`;
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `nebula_event_results_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredTeams = teams.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.password.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="admin-container">
      {/* Admin Header */}
      <div className="admin-header">
        <div className="admin-title-group">
          <div className="admin-badge-icon">
            <ShieldCheck size={28} className="text-neon-cyan" />
          </div>
          <div>
            <h2>Technical Head Control Panel</h2>
            <p>Manage Event Questions, Passwords, Anti-Cheat Lockouts & Live Monitor</p>
          </div>
        </div>

        <div className="admin-top-actions">
          <button className="sim-btn" onClick={simulateTeamActivity} title="Simulate a team solving for live demo">
            <Sparkles size={16} />
            <span>Simulate 1 Submission</span>
          </button>
          <button className="export-btn" onClick={exportToCSV}>
            <Download size={16} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="admin-nav-tabs">
        <button
          className={`admin-tab-btn ${activeAdminTab === "questions" ? "active" : ""}`}
          onClick={() => setActiveAdminTab("questions")}
        >
          <KeyRound size={18} />
          <span>Questions & Passwords Manager</span>
        </button>

        <button
          className={`admin-tab-btn ${activeAdminTab === "monitor" ? "active" : ""}`}
          onClick={() => setActiveAdminTab("monitor")}
        >
          <ShieldAlert size={18} />
          <span>Live Team Monitor & Security Unlocks ({teams.length})</span>
        </button>

        <button
          className={`admin-tab-btn ${activeAdminTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveAdminTab("settings")}
        >
          <Clock size={18} />
          <span>Event Duration & System Settings</span>
        </button>
      </div>

      {/* TAB 1: Questions & Passwords Manager */}
      {activeAdminTab === "questions" && (
        <div className="admin-tab-content">
          <div className="add-team-card">
            <h3>
              <PlusCircle size={20} className="text-neon-cyan" />
              <span>Add New Team Question & Password</span>
            </h3>
            <p className="card-subtext">
              Configure the 8 alphabet letters, the hint, and the target secret password for a team.
            </p>

            {formMsg && <div className="form-alert">{formMsg}</div>}

            <form onSubmit={handleAddNewTeam} className="add-team-grid">
              <div className="admin-form-group">
                <label>Team ID</label>
                <input
                  type="text"
                  placeholder="e.g. TEAM41"
                  value={newTeamId}
                  onChange={(e) => setNewTeamId(e.target.value.toUpperCase())}
                  required
                />
              </div>

              <div className="admin-form-group">
                <label>Team Name</label>
                <input
                  type="text"
                  placeholder="e.g. Team 41 - Quantum Coders"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                />
              </div>

              <div className="admin-form-group">
                <label>Login Passcode</label>
                <input
                  type="text"
                  placeholder="e.g. team41pass"
                  value={newPasscode}
                  onChange={(e) => setNewPasscode(e.target.value)}
                />
              </div>

              <div className="admin-form-group">
                <label>Letters (Scrambled)</label>
                <input
                  type="text"
                  placeholder="e.g. W O R D P A S S (or leave empty to auto-scramble)"
                  value={newLetters}
                  onChange={(e) => setNewLetters(e.target.value.toUpperCase())}
                />
              </div>

              <div className="admin-form-group">
                <label>Correct Password (Any Length)</label>
                <input
                  type="text"
                  placeholder="e.g. PASSWORD (or any custom length)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value.toUpperCase())}
                  required
                />
              </div>

              <div className="admin-form-group full-width">
                <label>Question Hint for this Team</label>
                <input
                  type="text"
                  placeholder="e.g. A secret authentication string used to access systems"
                  value={newHint}
                  onChange={(e) => setNewHint(e.target.value)}
                  required
                />
              </div>

              <div className="form-btn-row full-width">
                <button type="submit" className="primary-admin-btn">
                  <PlusCircle size={18} />
                  <span>Save Team & Password</span>
                </button>
              </div>
            </form>
          </div>

          {/* List & Edit Existing Questions */}
          <div className="existing-questions-card">
            <div className="card-top-bar">
              <div>
                <h3>All Team Questions & Passwords ({teams.length} Teams)</h3>
                <p>Edit Team Name, Passcode, Custom Password Length, or Delete Teams.</p>
              </div>

              <div className="admin-search-box">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search team, password, hint..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Team ID</th>
                    <th>Team Name</th>
                    <th>Passcode</th>
                    <th>Assigned Letters</th>
                    <th>Target Password</th>
                    <th>Assigned Hint</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeams.map((team) => (
                    <tr key={team.id}>
                      <td>
                        <span className="admin-id-tag">{team.id}</span>
                      </td>
                      <td className="font-semibold">{team.name}</td>
                      <td>
                        <code className="passcode-code">{team.passcode}</code>
                      </td>
                      <td>
                        <div className="letters-chip-row">
                          {team.letters.map((l, i) => (
                            <span key={i} className="letter-mini-chip">
                              {l}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className="pass-wrap">
                          <span className="password-tag">{team.password}</span>
                          <span className="len-pill">{team.password?.length || team.letters?.length}L</span>
                        </div>
                      </td>
                      <td className="hint-cell" title={team.hint}>
                        "{team.hint}"
                      </td>
                      <td>
                        <div className="table-actions-row">
                          <button
                            className="edit-btn"
                            onClick={() => startEditing(team)}
                            title="Edit Name, Passcode, and Password"
                          >
                            <Edit3 size={14} />
                            <span>Edit</span>
                          </button>
                          <button
                            className="delete-team-btn"
                            onClick={() => handleDeleteTeam(team.id, team.name)}
                            title={`Delete ${team.name}`}
                          >
                            <Trash2 size={14} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Live Team Monitor & Security Unlocks */}
      {activeAdminTab === "monitor" && (
        <div className="admin-tab-content">
          <div className="monitor-overview-grid">
            <div className="stat-card">
              <div className="stat-label">Total Teams</div>
              <div className="stat-number">{teams.length}</div>
            </div>
            <div className="stat-card green">
              <div className="stat-label">Solved</div>
              <div className="stat-number">
                {teams.filter((t) => t.solved).length}
              </div>
            </div>
            <div className="stat-card yellow">
              <div className="stat-label">In Progress</div>
              <div className="stat-number">
                {teams.filter((t) => !t.solved && t.status !== "DISQUALIFIED").length}
              </div>
            </div>
            <div className="stat-card red">
              <div className="stat-label">Disabled for changing tab</div>
              <div className="stat-number">
                {teams.filter((t) => t.status === "DISQUALIFIED" || t.disqualifiedReason).length}
              </div>
            </div>
          </div>

          <div className="monitor-table-card">
            <div className="card-top-bar">
              <div>
                <h3>Real-Time Security & Attempt Monitoring</h3>
                <p>If a team is locked out for switching tabs, click "Unlock Team" to permit them back.</p>
              </div>

              <div className="admin-search-box">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Filter teams..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Current Status</th>
                    <th>Chances</th>
                    <th>Time Taken</th>
                    <th>Security Action / Override</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeams.map((team) => {
                    const isDisqualified =
                      team.status === "DISQUALIFIED" || Boolean(team.disqualifiedReason);

                    return (
                      <tr
                        key={team.id}
                        className={isDisqualified ? "disqualified-row" : ""}
                      >
                        <td>
                          <div>
                            <strong>{team.name}</strong>
                            <div className="text-muted text-xs">ID: {team.id}</div>
                          </div>
                        </td>

                        <td>
                          {team.solved ? (
                            <span className="status-pill status-solved">
                              <CheckCircle2 size={13} /> Solved ({team.timeTaken}s)
                            </span>
                          ) : isDisqualified ? (
                            <span className="status-pill status-disqualified">
                              <ShieldAlert size={13} /> Disabled for changing tab
                            </span>
                          ) : (
                            <span className="status-pill status-progress">
                              Active / Ready
                            </span>
                          )}
                        </td>

                        <td>
                          <span className="font-mono">
                            {team.chancesLeft} of 2 left ({team.chancesUsed} used)
                          </span>
                        </td>

                        <td>
                          <span className="font-mono">
                            {team.timeTaken ? `${team.timeTaken}s` : "--"}
                          </span>
                        </td>

                        <td>
                          <div className="action-button-group">
                            {isDisqualified && (
                              <button
                                className="unlock-btn"
                                onClick={() => resetTeamStatus(team.id)}
                                title="Clear 'Disabled for changing tab' lockout"
                              >
                                <ShieldCheck size={14} />
                                <span>Unlock Team</span>
                              </button>
                            )}

                            <button
                              className="reset-btn"
                              onClick={() => {
                                if (confirm(`Reset all attempts and timer for ${team.name}?`)) {
                                  resetTeamStatus(team.id);
                                }
                              }}
                              title="Reset attempts and timer"
                            >
                              <RotateCcw size={14} />
                              <span>Reset</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Event Duration & System Settings */}
      {activeAdminTab === "settings" && (
        <div className="admin-tab-content">
          <div className="settings-card">
            <h3>
              <Clock size={20} className="text-neon-cyan" />
              <span>Event Timer Duration</span>
            </h3>
            <p className="card-subtext">
              Set the maximum allowed time for participants in the Output section. Typing is strictly disabled when this timer finishes.
            </p>

            <div className="duration-buttons-row">
              {[180, 300, 600, 900].map((secs) => (
                <button
                  key={secs}
                  className={`duration-choice-btn ${eventDuration === secs ? "active" : ""}`}
                  onClick={() => updateEventDuration(secs)}
                >
                  <Clock size={16} />
                  <span>{secs / 60} Minutes ({secs}s)</span>
                </button>
              ))}
            </div>

            <div className="custom-duration-input">
              <label>Custom Duration in Seconds:</label>
              <input
                type="number"
                min={30}
                max={3600}
                value={eventDuration}
                onChange={(e) => updateEventDuration(parseInt(e.target.value) || 300)}
              />
            </div>
          </div>

          <div className="settings-card danger-zone">
            <h3>
              <RotateCcw size={20} className="text-neon-red" />
              <span>Reset Entire Event</span>
            </h3>
            <p className="card-subtext">
              Restores all 40 teams to their initial clean state, clears all lockouts, and resets the leaderboard.
            </p>
            <button
              className="danger-reset-btn"
              onClick={() => {
                if (confirm("WARNING: Are you sure you want to reset all 40 teams to their initial state? This cannot be undone.")) {
                  resetAllTeams();
                  alert("All teams have been reset!");
                }
              }}
            >
              <RotateCcw size={16} />
              <span>Reset All 40 Teams & Leaderboard</span>
            </button>
          </div>
        </div>
      )}

      {/* Edit Team Modal */}
      {editingTeam && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h3>Edit Team & Challenge</h3>
                <span className="modal-team-id-badge">{editingTeam.id}</span>
              </div>
              <button className="close-btn" onClick={() => setEditingTeam(null)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="modal-form">
              <div className="modal-two-col">
                <div className="admin-form-group">
                  <label>Team Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="e.g. Team 01 - Alpha Bytes"
                    required
                  />
                </div>

                <div className="admin-form-group">
                  <label>Login Passcode</label>
                  <input
                    type="text"
                    value={editPasscode}
                    onChange={(e) => setEditPasscode(e.target.value)}
                    placeholder="e.g. team01"
                    required
                  />
                </div>
              </div>

              <div className="admin-form-group">
                <div className="label-with-pill">
                  <label>Correct Password (Target)</label>
                  <span className="length-indicator-pill">{editPassword.trim().length} Letters</span>
                </div>
                <input
                  type="text"
                  value={editPassword}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setEditPassword(val);
                    // Automatically update scrambled tiles if they were mirroring or empty
                    if (!editLetters || editLetters.length === editPassword.length) {
                      setEditLetters(val.split("").reverse().join(""));
                    }
                  }}
                  placeholder="Enter target word (any size e.g. 4 to 12 letters)"
                  required
                />
              </div>

              <div className="admin-form-group">
                <div className="label-with-pill">
                  <label>Letters Shown to Team (Scrambled)</label>
                  <span className="length-indicator-pill">{editLetters.trim().length} Tiles</span>
                </div>
                <input
                  type="text"
                  value={editLetters}
                  onChange={(e) => setEditLetters(e.target.value.toUpperCase())}
                  placeholder="Enter scrambled letters for team to arrange"
                  required
                />
                <span className="field-hint-sub">These letters appear as interactive click-to-add tiles in the team's arena.</span>
              </div>

              <div className="admin-form-group">
                <label>Team Password Hint</label>
                <textarea
                  rows={3}
                  value={editHint}
                  onChange={(e) => setEditHint(e.target.value)}
                  placeholder="Technical definition or clue..."
                  required
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setEditingTeam(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-admin-btn">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
