/**
 * Activity Server - Serves the Discord Activity WebApp with real-time updates
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const http = require('http');

const app = express();
const server = http.createServer(app);
const PORT = process.env.ACTIVITY_PORT || 3003;

// Store connected clients for SSE
const clients = new Set();

// Enable CORS
app.use(cors({
  origin: '*',
  credentials: true
}));

app.use(express.json());

// SSE endpoint for real-time updates
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Send initial connection message
  res.write('data: {"type": "connected"}\n\n');
  
  // Add client to set
  clients.add(res);
  
  // Remove client on disconnect
  req.on('close', () => {
    clients.delete(res);
  });
});

// Function to broadcast updates to all clients
function broadcastUpdate(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(client => {
    try {
      client.write(message);
    } catch (err) {
      // Client disconnected
      clients.delete(client);
    }
  });
}

// API proxy to main marketplace API
app.get('/api/deals', async (req, res) => {
  const apiPort = process.env.PORT || 3001;
  const apiUrl = `http://localhost:${apiPort}/api/deals`;
  
  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('API proxy error:', error);
    res.status(500).json({ error: 'API request failed', details: error.message });
  }
});

app.get('/api/transactions', async (req, res) => {
  const apiPort = process.env.PORT || 3001;
  const apiUrl = `http://localhost:${apiPort}/api/transactions`;
  
  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('API proxy error:', error);
    res.status(500).json({ error: 'API request failed', details: error.message });
  }
});

app.post('/api/transactions', async (req, res) => {
  const apiPort = process.env.PORT || 3001;
  const apiUrl = `http://localhost:${apiPort}/api/transactions`;
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });
    
    const data = await response.json();
    
    // Broadcast update to all clients
    broadcastUpdate({
      type: 'transaction_created',
      transaction: data
    });
    
    res.json(data);
  } catch (error) {
    console.error('API proxy error:', error);
    res.status(500).json({ error: 'API request failed', details: error.message });
  }
});

app.post('/api/transactions/:id/complete', async (req, res) => {
  const apiPort = process.env.PORT || 3001;
  const apiUrl = `http://localhost:${apiPort}/api/transactions/${req.params.id}/complete`;
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    // Broadcast update to all clients
    broadcastUpdate({
      type: 'transaction_completed',
      transaction: data
    });
    
    // Also refresh deals since one was sold
    broadcastUpdate({
      type: 'deals_updated'
    });
    
    res.json(data);
  } catch (error) {
    console.error('API proxy error:', error);
    res.status(500).json({ error: 'API request failed', details: error.message });
  }
});

// Poll for new deals and broadcast updates
let lastDealsHash = '';

async function pollForUpdates() {
  try {
    const apiPort = process.env.PORT || 3001;
    const response = await fetch(`http://localhost:${apiPort}/api/deals`);
    const deals = await response.json();
    
    // Create a simple hash of deals to detect changes
    const currentHash = deals.length + '-' + (deals[0]?.id || '') + '-' + (deals[deals.length - 1]?.id || '');
    
    if (currentHash !== lastDealsHash) {
      lastDealsHash = currentHash;
      
      // Broadcast update to all clients
      broadcastUpdate({
        type: 'deals_updated',
        count: deals.length
      });
      
      console.log(`📢 Broadcasted deals update: ${deals.length} deals`);
    }
  } catch (error) {
    console.error('Poll error:', error);
  }
}

// Poll every 2 seconds
setInterval(pollForUpdates, 2000);

// Serve static files
const staticPath = path.join(__dirname, 'activity-webapp');
app.use(express.static(staticPath));

// Serve the main HTML file
app.get('/', (req, res) => {
  const indexPath = path.join(staticPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.get(/.*/, (req, res) => {
  const indexPath = path.join(staticPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

server.listen(PORT, () => {
  console.log(`🎮 Activity server running on port ${PORT}`);
  console.log(`📱 Activity URL: http://localhost:${PORT}`);
  console.log(`📡 Real-time updates enabled (SSE)`);
});
