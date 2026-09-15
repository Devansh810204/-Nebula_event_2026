import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { INITIAL_TEAMS } from "../data/defaultTeams";

const STORAGE_KEY = "nebula_2026_event_teams";
const DURATION_KEY = "nebula_2026_event_duration";
const CURRENT_USER_KEY = "nebula_2026_current_user";
const BROADCAST_CHANNEL_NAME = "nebula_event_channel";

const EventContext = createContext();

export function EventProvider({ children }) {
  // Load saved teams or initialize with 40 default teams
  const [teams, setTeams] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load teams from localStorage", e);
    }
    return INITIAL_TEAMS;
  });

  // Event timer duration (default 5 minutes = 300 seconds)
  const [eventDuration, setEventDuration] = useState(() => {
    try {
      const saved = localStorage.getItem(DURATION_KEY);
      return saved ? parseInt(saved, 10) : 300;
    } catch (e) {
      return 300;
    }
  });

  // Logged in user: null, or { type: 'TEAM', teamId: 'TEAM01' }, or { type: 'ADMIN' }
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem(CURRENT_USER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  // Current view/tab: 'output' | 'leaderboard' | 'admin'
  const [activeTab, setActiveTab] = useState("output");

  // Save teams to localStorage and broadcast change
  const saveTeams = useCallback((updatedTeams) => {
    setTeams(updatedTeams);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTeams));
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        bc.postMessage({ type: "TEAMS_UPDATED", teams: updatedTeams });
        bc.close();
      }
    } catch (e) {
      console.error("Error saving teams:", e);
    }
  }, []);

  // Sync across browser tabs
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    bc.onmessage = (event) => {
      if (event.data?.type === "TEAMS_UPDATED") {
        setTeams(event.data.teams);
      }
    };
    return () => bc.close();
  }, []);

  // Save current user to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  }, [currentUser]);

  // Save duration
  const updateEventDuration = (seconds) => {
    setEventDuration(seconds);
    localStorage.setItem(DURATION_KEY, seconds.toString());
  };

  // Get live team object for the currently logged in team
  const currentTeam = currentUser?.type === "TEAM" 
    ? teams.find((t) => t.id === currentUser.teamId) 
    : null;

  // Login handler
  const login = (teamIdOrUsername, passcode) => {
    const cleanId = teamIdOrUsername.trim().toUpperCase();
    const cleanPass = passcode.trim();

    // Check Admin Login
    if (cleanId === "ADMIN" && (cleanPass === "admin2026" || cleanPass === "admin123" || cleanPass === "admin")) {
      const user = { type: "ADMIN", name: "Technical Head (Admin)" };
      setCurrentUser(user);
      setActiveTab("admin");
      return { success: true, role: "ADMIN" };
    }

    // Check Team Login
    const team = teams.find(
      (t) => t.id.toUpperCase() === cleanId || t.name.toUpperCase().includes(cleanId)
    );

    if (!team) {
      return { success: false, error: "Team ID not found. Please check credentials." };
    }

    // Check if team is disqualified
    if (team.status === "DISQUALIFIED" || team.disqualifiedReason) {
      return {
        success: false,
        isDisqualified: true,
        error: `Access Denied: Account marked as "${team.disqualifiedReason || 'Disabled for changing tab'}". You cannot login again.`,
      };
    }

    // Verify passcode
    if (team.passcode !== cleanPass) {
      return { success: false, error: "Incorrect passcode for this team." };
    }

    const user = { type: "TEAM", teamId: team.id, name: team.name };
    setCurrentUser(user);
    setActiveTab("output");
    return { success: true, role: "TEAM" };
  };

  // Logout handler
  const logout = () => {
    setCurrentUser(null);
    setActiveTab("output");
  };

  // Disqualify team (Security Violation: tab change, exit fullscreen, etc.)
  const disqualifyTeam = (teamId, reason = "Disabled for changing tab") => {
    const updated = teams.map((t) => {
      if (t.id === teamId) {
        return {
          ...t,
          status: "DISQUALIFIED",
          disqualifiedReason: reason,
        };
      }
      return t;
    });
    saveTeams(updated);

    // If current logged-in user is this team, immediately log them out
    if (currentUser?.type === "TEAM" && currentUser.teamId === teamId) {
      setCurrentUser(null);
    }
  };

  // Start the timer for a team when they enter Output section
  const startTeamTimer = (teamId) => {
    const team = teams.find((t) => t.id === teamId);
    if (team && !team.startTime && !team.solved && team.status !== "DISQUALIFIED") {
      const updated = teams.map((t) => {
        if (t.id === teamId) {
          return {
            ...t,
            startTime: Date.now(),
            status: "IN_PROGRESS",
          };
        }
        return t;
      });
      saveTeams(updated);
    }
  };

  // Submit guess
  const submitGuess = (teamId, rawGuess) => {
    const team = teams.find((t) => t.id === teamId);
    if (!team) return { success: false, message: "Team not found." };

    if (team.status === "DISQUALIFIED") {
      return { success: false, message: "Team is disqualified." };
    }

    if (team.chancesLeft <= 0) {
      return { success: false, message: "No chances remaining." };
    }

    if (team.solved) {
      return { success: false, message: "Already solved!" };
    }

    const guess = rawGuess.trim().toUpperCase();
    const correctPassword = team.password.trim().toUpperCase();

    // Check guess
    if (guess === correctPassword) {
      const now = Date.now();
      const elapsedSeconds = team.startTime 
        ? Math.max(1, Math.round((now - team.startTime) / 1000))
        : 1;

      const updated = teams.map((t) => {
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

      saveTeams(updated);
      return { correct: true, timeTaken: elapsedSeconds };
    } else {
      // Incorrect guess: reduce chance
      const newChancesLeft = team.chancesLeft - 1;
      const updated = teams.map((t) => {
        if (t.id === teamId) {
          return {
            ...t,
            chancesLeft: newChancesLeft,
            chancesUsed: t.chancesUsed + 1,
            // Note: Per user instruction: No status (like FAILED) is shown. Only chances left is updated.
          };
        }
        return t;
      });

      saveTeams(updated);
      return { correct: false, chancesLeft: newChancesLeft };
    }
  };

  // ADMIN ACTIONS
  // 1. Update/Add Team Question & Password
  const updateTeamQuestion = (teamId, { hint, password, letters }) => {
    const upperPassword = password.trim().toUpperCase();
    const lettersArr = Array.isArray(letters) 
      ? letters 
      : letters.replace(/[^A-Za-z]/g, "").toUpperCase().split("");

    const updated = teams.map((t) => {
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
    saveTeams(updated);
  };

  // 2. Add New Team
  const addNewTeam = ({ id, name, passcode, letters, password, hint }) => {
    const cleanId = id.trim().toUpperCase();
    if (teams.some((t) => t.id.toUpperCase() === cleanId)) {
      return { success: false, message: "Team ID already exists!" };
    }

    const cleanPass = password.trim().toUpperCase();
    const lettersArr = Array.isArray(letters)
      ? letters
      : letters.replace(/[^A-Za-z]/g, "").toUpperCase().split("");

    const newTeamObj = {
      id: cleanId,
      name: name.trim() || `Team ${cleanId}`,
      passcode: passcode.trim() || "pass123",
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

    const updated = [...teams, newTeamObj];
    saveTeams(updated);
    return { success: true };
  };

  // 3. Reset a team's disqualification or entire state
  const resetTeamStatus = (teamId) => {
    const updated = teams.map((t) => {
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
    saveTeams(updated);
  };

  // 4. Reset All Teams to Default
  const resetAllTeams = () => {
    saveTeams(INITIAL_TEAMS);
  };

  // 5. Simulate activity for demonstration
  const simulateTeamActivity = () => {
    // Pick an unsolved non-disqualified team and mark them as solved with realistic random time
    const eligible = teams.filter((t) => !t.solved && t.status !== "DISQUALIFIED");
    if (eligible.length === 0) return;

    const randomTeam = eligible[Math.floor(Math.random() * eligible.length)];
    const randomChancesUsed = Math.random() > 0.35 ? 1 : 2;
    const randomTime = Math.floor(Math.random() * (eventDuration - 40)) + 35;

    const updated = teams.map((t) => {
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
    saveTeams(updated);
  };

  return (
    <EventContext.Provider
      value={{
        teams,
        currentUser,
        currentTeam,
        activeTab,
        eventDuration,
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
