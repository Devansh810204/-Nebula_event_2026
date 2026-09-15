import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { INITIAL_TEAMS } from "../data/defaultTeams";

const STORAGE_KEY = "nebula_2026_event_teams";
const CURRENT_USER_KEY = "nebula_2026_current_user";

const EventContext = createContext();

export function EventProvider({ children }) {
  // Load initial teams from localStorage or default
  const [teams, setTeams] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_TEAMS;
  });

  const [eventDuration, setEventDuration] = useState(300);

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem(CURRENT_USER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState("output");

  // Save current user to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  }, [currentUser]);

  const [isBackendConnected, setIsBackendConnected] = useState(null); // null = checking, true = connected, false = disconnected

  // Central Server Synchronization: Poll /api/teams every 4 seconds
  const fetchLatestTeamsFromServer = useCallback(async () => {
    try {
      const res = await fetch("/api/teams", {
        headers: { Accept: "application/json" },
      });
      const contentType = res.headers.get("content-type") || "";

      // Ensure response is actually JSON and not an HTML fallback page from a Static Site
      if (res.ok && contentType.includes("application/json")) {
        const data = await res.json();
        if (data.success && Array.isArray(data.teams)) {
          setTeams(data.teams);
          setIsBackendConnected(true);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.teams));
          if (data.eventDuration) {
            setEventDuration(data.eventDuration);
          }
          return;
        }
      }
      setIsBackendConnected(false);
    } catch (err) {
      setIsBackendConnected(false);
    }
  }, []);

  // Poll on mount and every 4 seconds
  useEffect(() => {
    fetchLatestTeamsFromServer();
    const interval = setInterval(fetchLatestTeamsFromServer, 4000);
    return () => clearInterval(interval);
  }, [fetchLatestTeamsFromServer]);

  // Get current logged-in team details
  const currentTeam = currentUser?.type === "TEAM"
    ? teams.find((t) => t.id === currentUser.teamId)
    : null;

  // 1. Login
  const login = async (teamId, passcode) => {
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, passcode }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          isDisqualified: data.isDisqualified || false,
          error: data.error || "Login failed.",
        };
      }

      setCurrentUser(data.user);
      setActiveTab(data.role === "ADMIN" ? "admin" : "output");
      fetchLatestTeamsFromServer();
      return { success: true, role: data.role };
    } catch (err) {
      // Fallback local check
      const cleanId = teamId.trim().toUpperCase();
      const cleanPass = passcode.trim();

      if (cleanId === "ADMIN" && (cleanPass === "admin2026" || cleanPass === "admin123" || cleanPass === "admin")) {
        const user = { type: "ADMIN", name: "Technical Head (Admin)" };
        setCurrentUser(user);
        setActiveTab("admin");
        return { success: true, role: "ADMIN" };
      }

      const team = teams.find((t) => t.id.toUpperCase() === cleanId);
      if (!team) return { success: false, error: "Team ID not found." };
      if (team.status === "DISQUALIFIED" || team.disqualifiedReason) {
        return {
          success: false,
          isDisqualified: true,
          error: `Access Denied: Account marked as "${team.disqualifiedReason || "Disabled for changing tab"}"`,
        };
      }
      if (team.passcode !== cleanPass) {
        return { success: false, error: "Incorrect passcode." };
      }

      const user = { type: "TEAM", teamId: team.id, name: team.name };
      setCurrentUser(user);
      setActiveTab("output");
      return { success: true, role: "TEAM" };
    }
  };

  // 2. Logout
  const logout = () => {
    setCurrentUser(null);
    setActiveTab("output");
  };

  // 3. Disqualify (Tab Switch, Fullscreen Exit)
  const disqualifyTeam = async (teamId, reason = "Disabled for changing tab") => {
    try {
      await fetch("/api/disqualify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, reason }),
      });
    } catch (e) {}

    // Update local state immediately
    const updated = teams.map((t) => {
      if (t.id === teamId) {
        return { ...t, status: "DISQUALIFIED", disqualifiedReason: reason };
      }
      return t;
    });
    setTeams(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    if (currentUser?.type === "TEAM" && currentUser.teamId === teamId) {
      setCurrentUser(null);
    }
  };

  // 4. Start Timer
  const startTeamTimer = async (teamId) => {
    try {
      const res = await fetch("/api/start-timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
      if (res.ok) {
        fetchLatestTeamsFromServer();
      }
    } catch (e) {
      const updated = teams.map((t) => {
        if (t.id === teamId && !t.startTime) {
          return { ...t, startTime: Date.now(), status: "IN_PROGRESS" };
        }
        return t;
      });
      setTeams(updated);
    }
  };

  // 5. Submit Guess
  const submitGuess = async (teamId, rawGuess) => {
    try {
      const res = await fetch("/api/submit-guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, guess: rawGuess }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        fetchLatestTeamsFromServer();
        return {
          correct: data.correct,
          timeTaken: data.timeTaken,
          chancesLeft: data.chancesLeft,
        };
      }
    } catch (e) {}

    // Fallback local evaluation if backend temporarily unreachable
    const team = teams.find((t) => t.id === teamId);
    if (!team) return { success: false };

    const guess = rawGuess.trim().toUpperCase();
    const correctPassword = team.password.trim().toUpperCase();

    if (guess === correctPassword) {
      const now = Date.now();
      const elapsedSeconds = team.startTime ? Math.max(1, Math.round((now - team.startTime) / 1000)) : 1;
      const updated = teams.map((t) => {
        if (t.id === teamId) {
          return { ...t, solved: true, status: "SOLVED", timeTaken: elapsedSeconds, chancesUsed: t.chancesUsed + 1 };
        }
        return t;
      });
      setTeams(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return { correct: true, timeTaken: elapsedSeconds };
    } else {
      const newChances = Math.max(0, team.chancesLeft - 1);
      const updated = teams.map((t) => {
        if (t.id === teamId) {
          return { ...t, chancesLeft: newChances, chancesUsed: t.chancesUsed + 1 };
        }
        return t;
      });
      setTeams(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return { correct: false, chancesLeft: newChances };
    }
  };

  // ADMIN ACTIONS (Central Server Backed)
  const updateTeamQuestion = async (teamId, { hint, password, letters }) => {
    try {
      await fetch("/api/admin/update-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, hint, password, letters }),
      });
      fetchLatestTeamsFromServer();
    } catch (e) {}
  };

  const addNewTeam = async ({ id, name, passcode, letters, password, hint }) => {
    try {
      const res = await fetch("/api/admin/add-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name, passcode, letters, password, hint }),
      });
      const data = await res.json();
      if (data.success) {
        fetchLatestTeamsFromServer();
        return { success: true };
      }
      return { success: false, message: data.message };
    } catch (e) {
      return { success: false, message: "Server error" };
    }
  };

  const resetTeamStatus = async (teamId) => {
    try {
      await fetch("/api/admin/reset-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
      fetchLatestTeamsFromServer();
    } catch (e) {}
  };

  const resetAllTeams = async () => {
    try {
      await fetch("/api/admin/reset-all", { method: "POST" });
      fetchLatestTeamsFromServer();
    } catch (e) {}
  };

  const updateEventDuration = async (seconds) => {
    setEventDuration(seconds);
    try {
      await fetch("/api/admin/duration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration: seconds }),
      });
    } catch (e) {}
  };

  const simulateTeamActivity = async () => {
    try {
      await fetch("/api/admin/simulate", { method: "POST" });
      fetchLatestTeamsFromServer();
    } catch (e) {}
  };

  return (
    <EventContext.Provider
      value={{
        teams,
        currentUser,
        currentTeam,
        activeTab,
        eventDuration,
        isBackendConnected,
        setActiveTab,
        login,
        logout,
        disqualifyTeam,
        startTeamTimer,
        submitGuess,
        updateTeamQuestion,
        addNewTeam,
        resetTeamStatus,
        resetAllTeams,
        updateEventDuration,
        simulateTeamActivity,
      }}
    >
      {children}
    </EventContext.Provider>
  );
}

export function useEvent() {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error("useEvent must be used within an EventProvider");
  }
  return context;
}
