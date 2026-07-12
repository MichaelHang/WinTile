const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'dist')));

// Data file
const DATA_FILE = path.join(__dirname, '..', 'data', 'users.json');

function loadUsers() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { players: [], profiles: {} };
  }
}

function saveUsers(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// --- User Management ---

// Create or get a player profile
app.post('/api/profile', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '昵称不能为空' });
  }
  const data = loadUsers();
  const profileId = 'p_' + Date.now();
  data.profiles[profileId] = {
    id: profileId,
    name: name.trim(),
    avatar: name.trim().charAt(0).toUpperCase(),
    createdAt: new Date().toISOString(),
    totalGames: 0,
    totalWins: 0,
    totalScore: 0,
    lastPlayed: null,
    settings: {
      aiDifficulty: 'medium',
      soundEnabled: false,
      animationSpeed: 'normal',
      baseScore: 1,
    },
  };
  saveUsers(data);
  res.json(data.profiles[profileId]);
});

// List all profiles
app.get('/api/profiles', (req, res) => {
  const data = loadUsers();
  res.json(Object.values(data.profiles).sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  ));
});

// Get a single profile
app.get('/api/profile/:id', (req, res) => {
  const data = loadUsers();
  const profile = data.profiles[req.params.id];
  if (!profile) return res.status(404).json({ error: '用户不存在' });
  res.json(profile);
});

// Update profile settings
app.put('/api/profile/:id', (req, res) => {
  const data = loadUsers();
  const profile = data.profiles[req.params.id];
  if (!profile) return res.status(404).json({ error: '用户不存在' });
  Object.assign(profile.settings, req.body);
  saveUsers(data);
  res.json(profile);
});

// Delete profile
app.delete('/api/profile/:id', (req, res) => {
  const data = loadUsers();
  delete data.profiles[req.params.id];
  saveUsers(data);
  res.json({ success: true });
});

// --- Game History ---

// Save game result for a profile
app.post('/api/profile/:id/game', (req, res) => {
  const data = loadUsers();
  const profile = data.profiles[req.params.id];
  if (!profile) return res.status(404).json({ error: '用户不存在' });

  const { isWinner, score, difficulty, eventLogLength } = req.body;
  profile.totalGames += 1;
  if (isWinner) profile.totalWins += 1;
  profile.totalScore += score;
  profile.lastPlayed = new Date().toISOString();

  // Keep last 50 games
  if (!profile.gameHistory) profile.gameHistory = [];
  profile.gameHistory.push({
    date: new Date().toISOString(),
    isWinner,
    score,
    difficulty,
    turns: eventLogLength || 0,
  });
  if (profile.gameHistory.length > 50) {
    profile.gameHistory = profile.gameHistory.slice(-50);
  }

  saveUsers(data);
  res.json(profile);
});

// --- SPA Fallback ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Hangzhou Mahjong API running on port ${PORT}`);
});