/**
 * Activity Server - Serves the Discord Activity WebApp
 * 
 * This server hosts the marketplace Activity that users access
 * through the /see-deals command in Discord.
 */

const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.ACTIVITY_PORT || 3001;

// Enable CORS for Discord iframe
app.use(cors({
  origin: '*',
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Serve static files from activity-webapp directory
app.use(express.static(path.join(__dirname, 'activity-webapp')));

// API proxy to main marketplace API
app.use('/api', (req, res) => {
  const apiPort = process.env.PORT || 10000;
  const apiUrl = `http://localhost:${apiPort}${req.url}`;
  
  // Forward the request to the main API
  const options = {
    method: req.method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  if (req.method !== 'GET' && req.body) {
    options.body = JSON.stringify(req.body);
  }
  
  fetch(apiUrl, options)
    .then(response => response.json())
    .then(data => res.json(data))
    .catch(error => {
      console.error('API proxy error:', error);
      res.status(500).json({ error: 'API request failed' });
    });
});

// Serve the main HTML file for all routes (SPA behavior)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'activity-webapp', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🎮 Activity server running on port ${PORT}`);
  console.log(`📱 Activity URL: http://localhost:${PORT}`);
});
