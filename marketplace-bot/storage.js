/**
 * Simple in-memory storage module
 * In production, replace this with PostgreSQL or another database
 */

// In-memory data stores
const storage = {
  // Bots listed on the marketplace
  // Structure: { id, name, description, price, sellerId, reviews: [], avgRating, createdAt }
  bots: new Map(),
  
  // User data
  // Structure: { id, reputation, transactions: [], listedBots: [], boughtBots: [] }
  users: new Map(),
  
  // Transactions
  // Structure: { id, buyerId, botId, sellerId, status, timestamp, amount }
  transactions: new Map()
};

// Generate unique IDs
function generateId() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// ==================== BOT OPERATIONS ====================

/**
 * Create a new bot listing
 * @param {Object} botData - Bot information
 * @returns {Object} Created bot
 */
function createBot(botData) {
  const id = generateId();
  const bot = {
    id,
    name: botData.name,
    description: botData.description,
    price: parseFloat(botData.price),
    sellerId: botData.sellerId,
    reviews: [],
    avgRating: 0,
    createdAt: Date.now()
  };
  
  storage.bots.set(id, bot);
  
  // Add to seller's listed bots
  const user = getOrCreateUser(botData.sellerId);
  user.listedBots.push(id);
  
  return bot;
}

/**
 * Get a bot by ID
 * @param {string} id - Bot ID
 * @returns {Object|undefined}
 */
function getBot(id) {
  return storage.bots.get(id);
}

/**
 * Get all bots
 * @returns {Array}
 */
function getAllBots() {
  return Array.from(storage.bots.values());
}

/**
 * Add a review to a bot
 * @param {string} botId - Bot ID
 * @param {Object} review - Review data { userId, rating, comment, timestamp }
 */
function addReview(botId, review) {
  const bot = storage.bots.get(botId);
  if (!bot) return null;
  
  bot.reviews.push(review);
  
  // Recalculate average rating
  const total = bot.reviews.reduce((sum, r) => sum + r.rating, 0);
  bot.avgRating = total / bot.reviews.length;
  
  return bot;
}

// ==================== USER OPERATIONS ====================

/**
 * Get existing user or create new one
 * @param {string} userId - Discord user ID
 * @returns {Object} User object
 */
function getOrCreateUser(userId) {
  if (!storage.users.has(userId)) {
    storage.users.set(userId, {
      id: userId,
      reputation: 0,
      transactions: [],
      listedBots: [],
      boughtBots: []
    });
  }
  return storage.users.get(userId);
}

/**
 * Get user by ID
 * @param {string} userId - Discord user ID
 * @returns {Object|undefined}
 */
function getUser(userId) {
  return storage.users.get(userId);
}

/**
 * Update user reputation based on their bot reviews
 * @param {string} userId - Discord user ID
 */
function updateUserReputation(userId) {
  const user = storage.users.get(userId);
  if (!user) return 0;
  
  // Calculate average rating across all user's bots
  let totalRating = 0;
  let reviewCount = 0;
  
  for (const botId of user.listedBots) {
    const bot = storage.bots.get(botId);
    if (bot && bot.reviews.length > 0) {
      totalRating += bot.avgRating;
      reviewCount++;
    }
  }
  
  user.reputation = reviewCount > 0 ? totalRating / reviewCount : 0;
  return user.reputation;
}

// ==================== TRANSACTION OPERATIONS ====================

/**
 * Create a new transaction
 * @param {Object} transactionData - Transaction info
 * @returns {Object} Created transaction
 */
function createTransaction(transactionData) {
  const id = generateId();
  const transaction = {
    id,
    buyerId: transactionData.buyerId,
    botId: transactionData.botId,
    sellerId: transactionData.sellerId,
    amount: transactionData.amount,
    status: 'pending',
    timestamp: Date.now()
  };
  
  storage.transactions.set(id, transaction);
  
  // Add to buyer's transactions
  const buyer = getOrCreateUser(transactionData.buyerId);
  buyer.transactions.push(id);
  buyer.boughtBots.push(transactionData.botId);
  
  // Add to seller's transactions
  const seller = getOrCreateUser(transactionData.sellerId);
  seller.transactions.push(id);
  
  return transaction;
}

/**
 * Complete a transaction
 * @param {string} transactionId - Transaction ID
 * @returns {Object|undefined}
 */
function completeTransaction(transactionId) {
  const transaction = storage.transactions.get(transactionId);
  if (!transaction) return null;
  
  transaction.status = 'completed';
  transaction.completedAt = Date.now();
  
  return transaction;
}

/**
 * Get transaction by ID
 * @param {string} id - Transaction ID
 * @returns {Object|undefined}
 */
function getTransaction(id) {
  return storage.transactions.get(id);
}

/**
 * Get all transactions for a user
 * @param {string} userId - User ID
 * @returns {Array}
 */
function getUserTransactions(userId) {
  const user = storage.users.get(userId);
  if (!user) return [];
  
  return user.transactions.map(id => storage.transactions.get(id)).filter(Boolean);
}

module.exports = {
  storage,
  createBot,
  getBot,
  getAllBots,
  addReview,
  getOrCreateUser,
  getUser,
  updateUserReputation,
  createTransaction,
  completeTransaction,
  getTransaction,
  getUserTransactions,
  generateId
};