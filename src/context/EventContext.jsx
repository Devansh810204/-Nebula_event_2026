import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { INITIAL_TEAMS } from "../data/defaultTeams";

const STORAGE_KEY = "nebula_2026_event_teams";
const CURRENT_USER_KEY = "nebula_2026_current_user";
const CLOUD_SYNC_URL = "https://kvdb.io/FMATtTgS58UHyrfr2r84pR/nebula_2026_state";

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
  const [isBackendConnected, setIsBackendConnected] = useState(true);

  const teamsRef = useRef(teams);
  useEffect(() => {
    teamsRef.current = teams;
  }, [teams]);

  // Save current user to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  }, [currentUser]);

  // Publish updated state to cloud store & server
  const pushStateToCloud = async (updatedTeams, duration = eventDuration) => {
    try {
      await fetch(CLOUD_SYNC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teams: updatedTeams,
          eventDuration: duration,
          updatedAt: Date.now(),
        }),
      });
    } catch (err) {
      console.warn("Cloud sync push error:", err);
    }
  };

  // Sync teams across all laptops: Checks Express server first, then Cloud Store
  const fetchLatestTeamsFromServer = useCallback(async () => {
    // 1. Try local Express backend
    try {
      const headers = { Accept: "application/json", "Cache-Control": "no-cache" };
      if (currentUser?.type === "ADMIN") {
        headers["x-admin-key"] = "Admin_Nebula_2026";
      }

      const res = await fetch(`/api/teams?_t=${Date.now()}`, {
        cache: "no-store",
        headers,
      });
      const contentType = res.headers.get("content-type") || "";

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
    } catch (e) {
      // Express not available (e.g. running on Render Static Site)
    }

    // 2. Dual-Sync Fallback: Global Cloud Realtime KV Store
    try {
      const cloudRes = await fetch(`${CLOUD_SYNC_URL}?_t=${Date.now()}`, {
        cache: "no-store",
        headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      });
      if (cloudRes.ok) {
        const cloudData = await cloudRes.json();
        if (cloudData.teams && Array.isArray(cloudData.teams)) {
          setTeams(cloudData.teams);
          setIsBackendConnected(true);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudData.teams));
          if (cloudData.eventDuration) {
            setEventDuration(cloudData.eventDuration);
          }
          return;
        }
      }
    } catch (err) {
      console.warn("Cloud sync read error:", err);
    }
  }, []);

  // Continuous auto-sync every 3.5 seconds across all machines
  useEffect(() => {
    fetchLatestTeamsFromServer();
    const interval = setInterval(fetchLatestTeamsFromServer, 3500);
    return () => clearInterval(interval);
  }, [fetchLatestTeamsFromServer]);

  // Current logged in team
  const currentTeam = currentUser?.type === "TEAM"
    ? teams.find((t) => t.id === currentUser.teamId)
    : null;

  // 1. Login
  const login = async (teamId, passcode) => {
    const cleanId = teamId.trim().toUpperCase();
    const cleanPass = passcode.trim();

    // Try server login
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, passcode }),
      });
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        const data = await res.json();
        if (data.success) {
          setCurrentUser(data.user);
          setActiveTab(data.role === "ADMIN" ? "admin" : "output");
          fetchLatestTeamsFromServer();
          return { success: true, role: data.role };
        } else {
          return {
            success: false,
            isDisqualified: data.isDisqualified || false,
            error: data.error || "Login failed.",
          };
        }
      }
    } catch (e) {}

    // Cloud / Local Login
    if (cleanId === "ADMIN" && cleanPass === "Admin_Nebula_2026") {
      const user = { type: "ADMIN", name: "Technical Head (Admin)" };
      setCurrentUser(user);
      setActiveTab("admin");
      return { success: true, role: "ADMIN" };
    }

    const team = teamsRef.current.find((t) => t.id.toUpperCase() === cleanId);
    if (!team) {
      return { success: false, error: "Team ID not found. Please check credentials." };
    }

    if (team.status === "DISQUALIFIED" || team.disqualifiedReason) {
      return {
        success: false,
        isDisqualified: true,
        error: `Access Denied: Account marked as "${team.disqualifiedReason || "Disabled for changing tab"}". You cannot login again.`,
      };
    }

    if (team.passcode !== cleanPass) {
      return { success: false, error: "Incorrect passcode for this team." };
    }

    const user = { type: "TEAM", teamId: team.id, name: team.name };
    setCurrentUser(user);
    setActiveTab("output");
    return { success: true, role: "TEAM" };
  };

  // 2. Logout
  const logout = () => {
    setCurrentUser(null);
    setActiveTab("output");
  };

  // 3. Disqualify
  const disqualifyTeam = async (teamId, reason = "Disabled for changing tab") => {
    const updated = teamsRef.current.map((t) => {
      if (t.id === teamId) {
        return { ...t, status: "DISQUALIFIED", disqualifiedReason: reason };
      }
      return t;
    });

    setTeams(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    pushStateToCloud(updated);

    try {
      fetch("/api/disqualify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, reason }),
      });
    } catch (e) {}

    if (currentUser?.type === "TEAM" && currentUser.teamId === teamId) {
      setCurrentUser(null);
    }
  };

  // 4. Start Timer
  const startTeamTimer = async (teamId) => {
    const team = teamsRef.current.find((t) => t.id === teamId);
    if (team && !team.startTime && !team.solved && team.status !== "DISQUALIFIED") {
      const now = Date.now();
      const updated = teamsRef.current.map((t) => {
        if (t.id === teamId) {
          return { ...t, startTime: now, status: "IN_PROGRESS" };
        }
        return t;
      });
      setTeams(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      pushStateToCloud(updated);

      try {
        fetch("/api/start-timer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId }),
        });
      } catch (e) {}
    }
  };

  // 5. Submit Guess
  const submitGuess = async (teamId, rawGuess) => {
    const currentTeams = teamsRef.current;
    const team = currentTeams.find((t) => t.id === teamId);
    if (!team) return { success: false, correct: false, chancesLeft: 0 };

    if (team.status === "DISQUALIFIED") {
      return { success: false, correct: false, chancesLeft: team.chancesLeft };
    }
    if (team.chancesLeft <= 0 || team.solved) {
      return { success: false, correct: false, chancesLeft: team.chancesLeft };
    }

    const cleanGuess = rawGuess.trim().toUpperCase();
    const correctPassword = team.password.trim().toUpperCase();

    if (cleanGuess === correctPassword) {
      // SOLVED!
      const now = Date.now();
      const elapsedSeconds = team.startTime
        ? Math.max(1, Math.round((now - team.startTime) / 1000))
        : 1;

      const updated = currentTeams.map((t) => {
        if (t.id === teamId) {
          return {
            ...t,
            solved: true,
            status: "SOLVED",
            timeTaken: elapsedSeconds,
            chancesUsed: t.chancesUsed + 1,
          };
        }
        return t;
      });

      // Update state immediately so UI changes instantly
      setTeams(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      // Broadcast to all other laptops via cloud sync
      pushStateToCloud(updated);

      // Also notify local Express server if running
      try {
        fetch("/api/submit-guess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId, guess: rawGuess }),
        });
      } catch (e) {}

      return {
        success: true,
        correct: true,
        timeTaken: elapsedSeconds,
        chancesLeft: team.chancesLeft,
      };
    } else {
      // INCORRECT
      const newChances = Math.max(0, team.chancesLeft - 1);
      const updated = currentTeams.map((t) => {
        if (t.id === teamId) {
          return {
            ...t,
            chancesLeft: newChances,
            chancesUsed: t.chancesUsed + 1,
          };
        }
        return t;
      });

      setTeams(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      pushStateToCloud(updated);

      try {
        fetch("/api/submit-guess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId, guess: rawGuess }),
        });
      } catch (e) {}

      return {
        success: true,
        correct: false,
        chancesLeft: newChances,
      };
    }
  };

  // ADMIN ACTIONS
  const updateTeamQuestion = async (teamId, { hint, password, letters }) => {
    const upperPassword = password.trim().toUpperCase();
    const lettersArr = Array.isArray(letters)
      ? letters
      : (letters || upperPassword).replace(/[^A-Za-z]/g, "").toUpperCase().split("");

    const updated = teamsRef.current.map((t) => {
      if (t.id === teamId) {
        return {
          ...t,
          hint: hint.trim(),
          password: upperPassword,
          letters: lettersArr.length === 4 ? lettersArr : upperPassword.split(""),
        };
      }
      return t;
    });

    setTeams(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    pushStateToCloud(updated);

    try {
      fetch("/api/admin/update-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, hint, password, letters }),
      });
    } catch (e) {}
  };

  const addNewTeam = async ({ id, name, passcode, letters, password, hint }) => {
    const cleanId = id.trim().toUpperCase();
    if (teamsRef.current.some((t) => t.id.toUpperCase() === cleanId)) {
      return { success: false, message: "Team ID already exists!" };
    }

    const cleanPass = password.trim().toUpperCase();
    const lettersArr = Array.isArray(letters)
      ? letters
      : (letters || cleanPass).replace(/[^A-Za-z]/g, "").toUpperCase().split("");

    const newTeamObj = {
      id: cleanId,
      name: name?.trim() || `Team ${cleanId}`,
      passcode: passcode?.trim() || "pass123",
      letters: lettersArr.length === 4 ? lettersArr : cleanPass.split(""),
      password: cleanPass,
      hint: hint.trim(),
      chancesLeft: 2,
      chancesUsed: 0,
      solved: false,
      timeTaken: null,
      startTime: null,
      status: "PENDING",
      disqualifiedReason: null,
    };

    const updated = [...teamsRef.current, newTeamObj];
    setTeams(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    pushStateToCloud(updated);

    try {
      fetch("/api/admin/add-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name, passcode, letters, password, hint }),
      });
    } catch (e) {}

    return { success: true };
  };

  const resetTeamStatus = async (teamId) => {
    const updated = teamsRef.current.map((t) => {
      if (t.id === teamId) {
        return {
          ...t,
          status: "PENDING",
          disqualifiedReason: null,
          chancesLeft: 2,
          chancesUsed: 0,
          solved: false,
          timeTaken: null,
          startTime: null,
        };
      }
      return t;
    });

    setTeams(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    pushStateToCloud(updated);

    try {
      fetch("/api/admin/reset-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
    } catch (e) {}
  };

  const resetAllTeams = async () => {
    const clean = JSON.parse(JSON.stringify(INITIAL_TEAMS));
    setTeams(clean);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    pushStateToCloud(clean);

    try {
      fetch("/api/admin/reset-all", { method: "POST" });
    } catch (e) {}
  };

  const updateEventDuration = async (seconds) => {
    setEventDuration(seconds);
    pushStateToCloud(teamsRef.current, seconds);

    try {
      fetch("/api/admin/duration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration: seconds }),
      });
    } catch (e) {}
  };

  const simulateTeamActivity = async () => {
    const eligible = teamsRef.current.filter((t) => !t.solved && t.status !== "DISQUALIFIED");
    if (eligible.length === 0) return;

    const randomTeam = eligible[Math.floor(Math.random() * eligible.length)];
    const randomChancesUsed = Math.random() > 0.35 ? 1 : 2;
    const randomTime = Math.floor(Math.random() * (eventDuration - 40)) + 35;

    const updated = teamsRef.current.map((t) => {
      if (t.id === randomTeam.id) {
        return {
          ...t,
          solved: true,
          status: "SOLVED",
          timeTaken: randomTime,
          chancesUsed: randomChancesUsed,
          chancesLeft: 2 - randomChancesUsed,
        };
      }
      return t;
    });

    setTeams(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    pushStateToCloud(updated);

    try {
      fetch("/api/admin/simulate", { method: "POST" });
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
