/**
 * Combined Server for Render Deployment
 * Serves both the Discord Activity WebApp and the Marketplace API
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const http = require('http');

// Database functions (copied from db.js for standalone operation)
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/marketplace'
});

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 10000;

// Store connected clients for SSE
const clients = new Set();

// Enable CORS
app.use(cors({
  origin: '*',
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Database helper functions
async function getAllBots() {
  const result = await pool.query(
    'SELECT * FROM bots WHERE status = $1 ORDER BY created_at DESC',
    ['on_air']
  );
  return result.rows;
}

async function getBot(id) {
  const result = await pool.query('SELECT * FROM bots WHERE id = $1', [id]);
  return result.rows[0];
}

async function createTransaction({ buyerId, botId, sellerId, amount }) {
  const result = await pool.query(
    'INSERT INTO transactions (id, buyer_id, bot_id, seller_id, amount, status, created_at) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW()) RETURNING *',
    [buyerId, botId, sellerId, amount, 'pending']
  );
  return result.rows[0];
}

async function completeTransaction(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get transaction
    const transResult = await client.query('SELECT * FROM transactions WHERE id = $1', [id]);
    const transaction = transResult.rows[0];
    
    if (!transaction) throw new Error('Transaction not found');
    
    // Update transaction status
    await client.query(
      'UPDATE transactions SET status = $1, completed_at = NOW() WHERE id = $2',
      ['completed', id]
    );
    
    // Update bot status
    await client.query(
      'UPDATE bots SET status = $1 WHERE id = $2',
      ['sold', transaction.bot_id]
    );
    
    await client.query('COMMIT');
    return { ...transaction, status: 'completed' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getTransactions() {
  const result = await pool.query(
    'SELECT * FROM transactions ORDER BY created_at DESC LIMIT 100'
  );
  return result.rows;
}

// API Routes
app.get('/api/deals', async (req, res) => {
  try {
    const deals = await getAllBots();
    res.json(deals);
  } catch (error) {
    console.error('Error fetching deals:', error);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

app.get('/api/transactions', async (req, res) => {
  try {
    const transactions = await getTransactions();
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const { buyerId, botId, sellerId, amount } = req.body;
    const transaction = await createTransaction({ buyerId, botId, sellerId, amount });
    
    // Broadcast update
    broadcastUpdate({
      type: 'transaction_created',
      transaction
    });
    
    res.json(transaction);
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

app.post('/api/transactions/:id/complete', async (req, res) => {
  try {
    const transaction = await completeTransaction(req.params.id);
    
    // Broadcast updates
    broadcastUpdate({
      type: 'transaction_completed',
      transaction
    });
    
    broadcastUpdate({
      type: 'deals_updated'
    });
    
    res.json(transaction);
  } catch (error) {
    console.error('Error completing transaction:', error);
    res.status(500).json({ error: 'Failed to complete transaction' });
  }
});

// SSE endpoint for real-time updates
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  res.write('data: {"type": "connected"}\n\n');
  
  clients.add(res);
  
  req.on('close', () => {
    clients.delete(res);
  });
});

// Function to broadcast updates
function broadcastUpdate(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(client => {
    try {
      client.write(message);
    } catch (err) {
      clients.delete(client);
    }
  });
}

// Poll for new deals
let lastDealsHash = '';

async function pollForUpdates() {
  try {
    const deals = await getAllBots();
    const currentHash = deals.length + '-' + (deals[0]?.id || '') + '-' + (deals[deals.length - 1]?.id || '');
    
    if (currentHash !== lastDealsHash) {
      lastDealsHash = currentHash;
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

setInterval(pollForUpdates, 2000);

// Serve static files from activity-webapp
const staticPath = path.join(__dirname, 'activity-webapp');
app.use(express.static(staticPath));

// Serve index.html for all other routes
app.get(/.*/, (req, res) => {
  const indexPath = path.join(staticPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`🎮 Combined server running on port ${PORT}`);
  console.log(`📱 Activity URL: https://marketplace-prototype.onrender.com`);
  console.log(`📡 Real-time updates enabled (SSE)`);
  console.log(`🏥 Health check: /health`);
});
