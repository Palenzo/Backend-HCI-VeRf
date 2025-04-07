const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the 'videos' directory
app.use('/videos', express.static(path.join(__dirname, 'videos')));

// Hardcoded users for authentication
const users = [
  { id: 1, username: 'user1', password: 'password1', name: 'User One' },
  { id: 2, username: 'user2', password: 'password2', name: 'User Two' },
  { id: 3, username: 'user3', password: 'password3', name: 'User Three' },
  { id: 4, username: 'user4', password: 'password4', name: 'User Four' }
];

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  const user = users.find(u => u.username === username && u.password === password);
  
  if (user) {
    // Don't send the password back to the client
    const { password, ...userWithoutPassword } = user;
    res.json({ success: true, user: userWithoutPassword });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// Get list of hand signs
app.get('/api/handsigns', (req, res) => {
  try {
    const handSignsPath = path.join(__dirname, 'data', 'handsigns.json');
    const handSigns = JSON.parse(fs.readFileSync(handSignsPath, 'utf8'));
    res.json(handSigns);
  } catch (error) {
    console.error('Error reading hand signs:', error);
    res.status(500).json({ success: false, message: 'Failed to load hand signs' });
  }
});

// Get videos for validation
app.get('/api/videos', (req, res) => {
  try {
    const videosPath = path.join(__dirname, 'data', 'videos.json');
    const videos = JSON.parse(fs.readFileSync(videosPath, 'utf8'));
    res.json(videos);
  } catch (error) {
    console.error('Error reading videos:', error);
    res.status(500).json({ success: false, message: 'Failed to load videos' });
  }
});

// Save validation results
app.post('/api/submit', (req, res) => {
  try {
    const { userId, videoId, selectedSign } = req.body;
    
    if (!userId || !videoId || !selectedSign) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    // Create results directory if it doesn't exist
    const resultsDir = path.join(__dirname, 'data', 'results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    // Create or update user's results file
    const userResultsPath = path.join(resultsDir, `user_${userId}_results.json`);
    let userResults = [];
    
    if (fs.existsSync(userResultsPath)) {
      userResults = JSON.parse(fs.readFileSync(userResultsPath, 'utf8'));
    }
    
    // Check if this video was already validated
    const existingIndex = userResults.findIndex(result => result.videoId === videoId);
    
    if (existingIndex !== -1) {
      // Update existing validation
      userResults[existingIndex] = {
        ...userResults[existingIndex],
        selectedSign,
        timestamp: new Date().toISOString()
      };
    } else {
      // Add new validation
      userResults.push({
        videoId,
        selectedSign,
        timestamp: new Date().toISOString()
      });
    }
    
    // Save updated results
    fs.writeFileSync(userResultsPath, JSON.stringify(userResults, null, 2));
    
    res.json({ success: true, message: 'Validation saved successfully' });
  } catch (error) {
    console.error('Error saving validation:', error);
    res.status(500).json({ success: false, message: 'Failed to save validation' });
  }
});

// Get user's progress
app.get('/api/progress/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const userResultsPath = path.join(__dirname, 'data', 'results', `user_${userId}_results.json`);
    
    if (!fs.existsSync(userResultsPath)) {
      return res.json({ completed: 0, total: 0, percentage: 0 });
    }
    
    const userResults = JSON.parse(fs.readFileSync(userResultsPath, 'utf8'));
    const videosPath = path.join(__dirname, 'data', 'videos.json');
    const videos = JSON.parse(fs.readFileSync(videosPath, 'utf8'));
    
    const completed = userResults.length;
    const total = videos.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    res.json({ completed, total, percentage });
  } catch (error) {
    console.error('Error getting progress:', error);
    res.status(500).json({ success: false, message: 'Failed to get progress' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 