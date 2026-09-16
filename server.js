import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { INITIAL_TEAMS } from "./src/data/defaultTeams.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const DATA_FILE = path.join(__dirname, "teams_store.json");

app.use(cors());
app.use(express.json());

// In-Memory state with File Persistence
let teams = [];
let eventDuration = 300; // 5 minutes default

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      teams = parsed.teams || INITIAL_TEAMS;
      eventDuration = parsed.eventDuration || 300;
      console.log(`Loaded ${teams.length} teams from persistent storage.`);
      return;
    }
  } catch (err) {
    console.error("Error loading data from file, falling back to defaults:", err);
  }
  teams = JSON.parse(JSON.stringify(INITIAL_TEAMS));
  saveData();
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ teams, eventDuration }, null, 2));
  } catch (err) {
    console.error("Error saving data to file:", err);
  }
}

// Initialize data
loadData();

// API ROUTES

const ADMIN_SECRET_KEY = "Admin_Nebula_2026";

// 1. Get Live Teams & Leaderboard State (Sanitized for public/participants)
app.get("/api/teams", (req, res) => {
  const isAdmin = req.headers["x-admin-key"] === ADMIN_SECRET_KEY;
  
  if (isAdmin) {
    // Admin gets full data with passwords
    return res.json({
      success: true,
      teams,
      eventDuration,
      serverTime: Date.now(),
    });
  }

  // Participants & Public Leaderboard: STRIP password and passcode!
  // No one can see the answers in F12 / Network tab!
  const publicTeams = teams.map((t) => ({
    id: t.id,
    name: t.name,
    letters: t.letters,
    hint: t.hint,
    chancesLeft: t.chancesLeft,
    chancesUsed: t.chancesUsed,
    solved: t.solved,
    timeTaken: t.timeTaken,
    startTime: t.startTime,
    status: t.status,
    disqualifiedReason: t.disqualifiedReason,
  }));

  res.json({
    success: true,
    teams: publicTeams,
    eventDuration,
    serverTime: Date.now(),
  });
});

// Admin-only teams endpoint with passwords
app.get("/api/admin/teams", (req, res) => {
  if (req.headers["x-admin-key"] !== ADMIN_SECRET_KEY) {
    return res.status(403).json({ success: false, error: "Unauthorized" });
  }
  res.json({
    success: true,
    teams,
    eventDuration,
    serverTime: Date.now(),
  });
});

// 2. Login
app.post("/api/login", (req, res) => {
  const { teamId, passcode } = req.body;
  if (!teamId || !passcode) {
    return res.status(400).json({ success: false, error: "Missing credentials" });
  }

  const cleanId = teamId.trim().toUpperCase();
  const cleanPass = passcode.trim();

  // Admin Login Check
  if (cleanId === "ADMIN" && cleanPass === ADMIN_SECRET_KEY) {
    return res.json({
      success: true,
      role: "ADMIN",
      user: { type: "ADMIN", name: "Technical Head (Admin)" },
      adminKey: ADMIN_SECRET_KEY,
    });
  }

  // Find Team
  const team = teams.find(
    (t) => t.id.toUpperCase() === cleanId || t.name.toUpperCase().includes(cleanId)
  );

  if (!team) {
    return res.status(404).json({ success: false, error: "Team ID not found. Please check credentials." });
  }

  // Check if team was disqualified for changing tabs
  if (team.status === "DISQUALIFIED" || team.disqualifiedReason) {
    return res.status(403).json({
      success: false,
      isDisqualified: true,
      error: `Access Denied: Account marked as "${team.disqualifiedReason || "Disabled for changing tab"}". You cannot login again.`,
    });
  }

  if (team.passcode !== cleanPass) {
    return res.status(401).json({ success: false, error: "Incorrect passcode for this team." });
  }

  const safeTeam = { ...team };
  delete safeTeam.password; // Do not send target password to participant browser
  delete safeTeam.passcode;

  return res.json({
    success: true,
    role: "TEAM",
    user: { type: "TEAM", teamId: team.id, name: team.name },
    team: safeTeam,
  });
});

// 3. Start Timer when team enters Output section
app.post("/api/start-timer", (req, res) => {
  const { teamId } = req.body;
  const team = teams.find((t) => t.id === teamId);

  if (!team) {
    return res.status(404).json({ success: false, message: "Team not found" });
  }

  if (!team.startTime && !team.solved && team.status !== "DISQUALIFIED") {
    team.startTime = Date.now();
    team.status = "IN_PROGRESS";
    saveData();
  }

  res.json({ success: true, startTime: team.startTime, team });
});

// 4. Submit Guess
app.post("/api/submit-guess", (req, res) => {
  const { teamId, guess } = req.body;
  const team = teams.find((t) => t.id === teamId);

  if (!team) {
    return res.status(404).json({ success: false, message: "Team not found" });
  }

  if (team.status === "DISQUALIFIED") {
    return res.status(403).json({ success: false, message: "Team is disqualified." });
  }

  if (team.chancesLeft <= 0) {
    return res.status(400).json({ success: false, message: "No chances remaining." });
  }

  if (team.solved) {
    return res.json({ success: true, correct: true, timeTaken: team.timeTaken, message: "Already solved!" });
  }

  const cleanGuess = (guess || "").trim().toUpperCase();
  const correctPassword = team.password.trim().toUpperCase();

  if (cleanGuess === correctPassword) {
    // Solved!
    const now = Date.now();
    const elapsedSeconds = team.startTime
      ? Math.max(1, Math.round((now - team.startTime) / 1000))
      : 1;

    team.solved = true;
    team.status = "SOLVED";
    team.timeTaken = elapsedSeconds;
    team.chancesUsed += 1;
    saveData();

    return res.json({
      success: true,
      correct: true,
      timeTaken: elapsedSeconds,
      chancesLeft: team.chancesLeft,
      team,
    });
  } else {
    // Incorrect guess
    team.chancesLeft = Math.max(0, team.chancesLeft - 1);
    team.chancesUsed += 1;
    // Note: No FAILED status shown to user, only chancesLeft is tracked!
    saveData();

    return res.json({
      success: true,
      correct: false,
      chancesLeft: team.chancesLeft,
      team,
    });
  }
});

// 5. Disqualify (Security Breach: Tab Switch / Exit Fullscreen)
app.post("/api/disqualify", (req, res) => {
  const { teamId, reason } = req.body;
  const team = teams.find((t) => t.id === teamId);

  if (!team) {
    return res.status(404).json({ success: false, message: "Team not found" });
  }

  team.status = "DISQUALIFIED";
  team.disqualifiedReason = reason || "Disabled for changing tab";
  saveData();

  console.log(`[SECURITY BREACH] Team ${team.id} (${team.name}) disqualified: ${team.disqualifiedReason}`);
  res.json({ success: true, team });
});

// ADMIN ROUTES

// 6. Update Team Question & Password
app.post("/api/admin/update-question", (req, res) => {
  const { teamId, hint, password, letters } = req.body;
  const team = teams.find((t) => t.id === teamId);

  if (!team) {
    return res.status(404).json({ success: false, message: "Team not found" });
  }

  const upperPassword = password.trim().toUpperCase();
  const lettersArr = Array.isArray(letters)
    ? letters
    : (letters || upperPassword).replace(/[^A-Za-z]/g, "").toUpperCase().split("");

  team.hint = hint.trim();
  team.password = upperPassword;
  team.letters = lettersArr.length === 4 ? lettersArr : upperPassword.split("");
  saveData();

  res.json({ success: true, team });
});

// 7. Add New Team
app.post("/api/admin/add-team", (req, res) => {
  const { id, name, passcode, letters, password, hint } = req.body;
  const cleanId = id.trim().toUpperCase();

  if (teams.some((t) => t.id.toUpperCase() === cleanId)) {
    return res.status(400).json({ success: false, message: "Team ID already exists!" });
  }

  const cleanPass = password.trim().toUpperCase();
  const lettersArr = Array.isArray(letters)
    ? letters
    : (letters || cleanPass).replace(/[^A-Za-z]/g, "").toUpperCase().split("");

  const newTeam = {
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

  teams.push(newTeam);
  saveData();
  res.json({ success: true, team: newTeam });
});

// 8. Reset Team (Clear tab lockout or reset attempts)
app.post("/api/admin/reset-team", (req, res) => {
  const { teamId } = req.body;
  const team = teams.find((t) => t.id === teamId);

  if (!team) {
    return res.status(404).json({ success: false, message: "Team not found" });
  }

  team.status = "PENDING";
  team.disqualifiedReason = null;
  team.chancesLeft = 2;
  team.chancesUsed = 0;
  team.solved = false;
  team.timeTaken = null;
  team.startTime = null;
  saveData();

  res.json({ success: true, team });
});

// 9. Reset All Teams to Defaults
app.post("/api/admin/reset-all", (req, res) => {
  teams = JSON.parse(JSON.stringify(INITIAL_TEAMS));
  saveData();
  res.json({ success: true, teams });
});

// 10. Update Event Duration
app.post("/api/admin/duration", (req, res) => {
  const { duration } = req.body;
  eventDuration = parseInt(duration, 10) || 300;
  saveData();
  res.json({ success: true, eventDuration });
});

// 11. Simulate Team Submission
app.post("/api/admin/simulate", (req, res) => {
  const eligible = teams.filter((t) => !t.solved && t.status !== "DISQUALIFIED");
  if (eligible.length === 0) {
    return res.json({ success: false, message: "No eligible teams left to simulate." });
  }

  const randomTeam = eligible[Math.floor(Math.random() * eligible.length)];
  const randomChancesUsed = Math.random() > 0.35 ? 1 : 2;
  const randomTime = Math.floor(Math.random() * (eventDuration - 40)) + 35;

  randomTeam.solved = true;
  randomTeam.status = "SOLVED";
  randomTeam.timeTaken = randomTime;
  randomTeam.chancesUsed = randomChancesUsed;
  randomTeam.chancesLeft = 2 - randomChancesUsed;
  saveData();

  res.json({ success: true, simulatedTeam: randomTeam });
});

// SERVE FRONTEND BUILD (Single Page App)
const distPath = path.join(__dirname, "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT} (0.0.0.0)`);
});
