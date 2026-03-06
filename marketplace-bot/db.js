/**
 * PostgreSQL storage module
 * Designed for easy migration to cloud PostgreSQL (AWS RDS, Google Cloud SQL, etc.)
 * 
 * Environment variables:
 *   DATABASE_URL - PostgreSQL connection string
 *   Default: postgres://marketplace:marketplace_secret@localhost:5432/marketplace
 */

const { Pool } = require('pg');

// Connection pool - cloud-ready
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://marketplace:marketplace_secret@localhost:5432/marketplace',
  // Cloud-optimized settings
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

// Generate UUID
function generateId() {
  return require('crypto').randomUUID();
}

// ==================== DEAL OPERATIONS ====================

/**
 * Create a new deal
 * @param {Object} dealData - Deal information
 * @returns {Promise<Object>} Created deal
 */
async function createBot(dealData) {
  const client = await pool.connect();
  try {
    // Ensure user exists
    await client.query(
      'INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING',
      [dealData.sellerId]
    );

    const result = await client.query(
      `INSERT INTO deals (name, description, price, seller_id, status)
       VALUES ($1, $2, $3, $4, 'on_air')
       RETURNING *`,
      [dealData.name, dealData.description, dealData.price, dealData.sellerId]
    );

    return formatDeal(result.rows[0]);
  } finally {
    client.release();
  }
}

/**
 * Get a deal by ID
 * @param {string} id - Deal ID
 * @returns {Promise<Object|undefined>}
 */
async function getBot(id) {
  const result = await pool.query('SELECT * FROM deals WHERE id = $1', [id]);
  return result.rows[0] ? formatDeal(result.rows[0]) : undefined;
}

/**
 * Get all deals with optional status filter
 * @param {string[]} statuses - Optional array of statuses to filter
 * @returns {Promise<Array>}
 */
async function getAllBots(statuses = ['on_air']) {
  const result = await pool.query(
    'SELECT * FROM deals WHERE status = ANY($1) ORDER BY created_at DESC',
    [statuses]
  );
  return result.rows.map(formatDeal);
}

/**
 * Update deal status
 * @param {string} dealId - Deal ID
 * @param {string} status - New status
 */
async function updateDealStatus(dealId, status) {
  await pool.query(
    'UPDATE deals SET status = $1, updated_at = NOW() WHERE id = $2',
    [status, dealId]
  );
}

/**
 * Flag a deal (admin function)
 * @param {string} dealId - Deal ID
 * @param {boolean} flagged - True to flag, false to unflag
 */
async function flagDeal(dealId, flagged = true) {
  const status = flagged ? 'flagged' : 'on_air';
  await updateDealStatus(dealId, status);
}

// ==================== REVIEW OPERATIONS ====================

/**
 * Add a review to a deal
 * @param {string} dealId - Deal ID
 * @param {Object} review - Review data
 * @returns {Promise<Object|null>}
 */
async function addReview(dealId, review) {
  try {
    await pool.query(
      `INSERT INTO reviews (deal_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (deal_id, user_id) DO UPDATE
       SET rating = $3, comment = $4, created_at = NOW()`,
      [dealId, review.userId, review.rating, review.comment]
    );
    return getBot(dealId);
  } catch (err) {
    console.error('Error adding review:', err);
    return null;
  }
}

// ==================== USER OPERATIONS ====================

/**
 * Get or create user
 * @param {string} userId - Discord user ID
 * @returns {Promise<Object>}
 */
async function getOrCreateUser(userId) {
  const result = await pool.query(
    `INSERT INTO users (id) VALUES ($1)
     ON CONFLICT (id) DO UPDATE SET id = $1
     RETURNING *`,
    [userId]
  );
  return formatUser(result.rows[0]);
}

/**
 * Get user by ID
 * @param {string} userId - Discord user ID
 * @returns {Promise<Object|undefined>}
 */
async function getUser(userId) {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
  return result.rows[0] ? formatUser(result.rows[0]) : undefined;
}

/**
 * Update user reputation
 * @param {string} userId - Discord user ID
 * @returns {Promise<number>}
 */
async function updateUserReputation(userId) {
  const result = await pool.query(
    `UPDATE users 
     SET reputation = (
       SELECT COALESCE(AVG(d.avg_rating), 0)
       FROM deals d
       WHERE d.seller_id = $1 AND d.review_count > 0
     ),
     updated_at = NOW()
     WHERE id = $1
     RETURNING reputation`,
    [userId]
  );
  return result.rows[0]?.reputation || 0;
}

// ==================== TRANSACTION OPERATIONS ====================

/**
 * Create a new transaction
 * @param {Object} transactionData - Transaction info
 * @returns {Promise<Object>} Created transaction
 */
async function createTransaction(transactionData) {
  const client = await pool.connect();
  try {
    // Ensure users exist
    await client.query(
      'INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING',
      [transactionData.buyerId]
    );
    await client.query(
      'INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING',
      [transactionData.sellerId]
    );

    const result = await client.query(
      `INSERT INTO transactions (deal_id, buyer_id, seller_id, amount, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [transactionData.botId, transactionData.buyerId, transactionData.sellerId, transactionData.amount]
    );

    return formatTransaction(result.rows[0]);
  } finally {
    client.release();
  }
}

/**
 * Complete a transaction
 * @param {string} transactionId - Transaction ID
 * @returns {Promise<Object|undefined>}
 */
async function completeTransaction(transactionId) {
  const result = await pool.query(
    `UPDATE transactions 
     SET status = 'completed', completed_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [transactionId]
  );
  return result.rows[0] ? formatTransaction(result.rows[0]) : null;
}

/**
 * Get transaction by ID
 * @param {string} id - Transaction ID
 * @returns {Promise<Object|undefined>}
 */
async function getTransaction(id) {
  const result = await pool.query('SELECT * FROM transactions WHERE id = $1', [id]);
  return result.rows[0] ? formatTransaction(result.rows[0]) : undefined;
}

/**
 * Get all transactions for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>}
 */
async function getUserTransactions(userId) {
  const result = await pool.query(
    `SELECT t.*, d.name as deal_name
     FROM transactions t
     JOIN deals d ON t.deal_id = d.id
     WHERE t.buyer_id = $1 OR t.seller_id = $1
     ORDER BY t.created_at DESC`,
    [userId]
  );
  return result.rows.map(formatTransaction);
}

// ==================== FORMATTERS ====================

function formatDeal(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: parseFloat(row.price),
    sellerId: row.seller_id,
    status: row.status,
    avgRating: parseFloat(row.avg_rating),
    reviewCount: parseInt(row.review_count),
    createdAt: new Date(row.created_at).getTime(),
    reviews: [] // Loaded separately if needed
  };
}

function formatUser(row) {
  return {
    id: row.id,
    reputation: parseFloat(row.reputation),
    totalSales: parseInt(row.total_sales),
    totalPurchases: parseInt(row.total_purchases),
    createdAt: new Date(row.created_at).getTime()
  };
}

function formatTransaction(row) {
  return {
    id: row.id,
    dealId: row.deal_id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    amount: parseFloat(row.amount),
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
    completedAt: row.completed_at ? new Date(row.completed_at).getTime() : null,
    dealName: row.deal_name
  };
}

// ==================== HEALTH CHECK ====================

async function healthCheck() {
  try {
    await pool.query('SELECT 1');
    return { healthy: true };
  } catch (err) {
    return { healthy: false, error: err.message };
  }
}

module.exports = {
  pool,
  generateId,
  createBot,
  getBot,
  getAllBots,
  updateDealStatus,
  flagDeal,
  addReview,
  getOrCreateUser,
  getUser,
  updateUserReputation,
  createTransaction,
  completeTransaction,
  getTransaction,
  getUserTransactions,
  healthCheck
};