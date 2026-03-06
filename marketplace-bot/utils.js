/**
 * Utility functions for the marketplace bot
 */

/**
 * Convert a rating number to star emoji display
 * @param {number} rating - Rating from 0-5
 * @param {number} maxStars - Maximum number of stars (default 5)
 * @returns {string} Star emoji string
 */
function ratingToStars(rating, maxStars = 5) {
  if (!rating || rating < 0) rating = 0;
  if (rating > maxStars) rating = maxStars;
  
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = maxStars - fullStars - (hasHalfStar ? 1 : 0);
  
  let stars = '⭐'.repeat(fullStars);
  if (hasHalfStar) stars += '⭐'; // Discord doesn't have half-star, use full
  stars += '☆'.repeat(emptyStars);
  
  return stars;
}

/**
 * Format a price for display
 * @param {number} price - Price amount
 * @param {string} currency - Currency symbol (default $)
 * @returns {string} Formatted price
 */
function formatPrice(price, currency = '$') {
  return `${currency}${parseFloat(price).toFixed(2)}`;
}

/**
 * Format a timestamp to readable date
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted date
 */
function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncate(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Create a paginated list of items
 * @param {Array} items - Items to paginate
 * @param {number} page - Current page (0-indexed)
 * @param {number} perPage - Items per page
 * @returns {Object} { items: [], totalPages: number, currentPage: number }
 */
function paginate(items, page = 0, perPage = 5) {
  const totalPages = Math.ceil(items.length / perPage);
  const currentPage = Math.min(Math.max(0, page), totalPages - 1);
  
  const start = currentPage * perPage;
  const paginatedItems = items.slice(start, start + perPage);
  
  return {
    items: paginatedItems,
    totalPages: Math.max(1, totalPages),
    currentPage: currentPage,
    totalItems: items.length
  };
}

/**
 * Validate a review rating
 * @param {number} rating - Rating value
 * @returns {boolean}
 */
function isValidRating(rating) {
  const num = parseInt(rating);
  return !isNaN(num) && num >= 1 && num <= 5;
}

/**
 * Calculate reputation tier
 * @param {number} reputation - Reputation score (0-5)
 * @returns {Object} { name: string, emoji: string }
 */
function getReputationTier(reputation) {
  if (reputation >= 4.5) return { name: 'Legendary', emoji: '👑' };
  if (reputation >= 4.0) return { name: 'Excellent', emoji: '💎' };
  if (reputation >= 3.0) return { name: 'Trusted', emoji: '🛡️' };
  if (reputation >= 2.0) return { name: 'Rising', emoji: '📈' };
  if (reputation >= 1.0) return { name: 'New', emoji: '🌱' };
  return { name: 'Unrated', emoji: '🆕' };
}

module.exports = {
  ratingToStars,
  formatPrice,
  formatDate,
  truncate,
  paginate,
  isValidRating,
  getReputationTier
};