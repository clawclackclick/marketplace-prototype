const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, getUserTransactions, getAllBots } = require('../db');
const { ratingToStars, getReputationTier, formatPrice, formatDate } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your marketplace profile')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('View another user\'s profile (optional)')
        .setRequired(false)
    ),

  async execute(interaction) {
    // Get target user (or self)
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const userId = targetUser.id;
    const isSelf = userId === interaction.user.id;

    // Get user data
    const userData = await getUser(userId);
    
    if (!userData) {
      return interaction.reply({
        content: isSelf 
          ? '📭 You haven\'t used the marketplace yet! Try listing a deal with `/create-deal` or browsing with `/browse`'
          : `📭 <@${userId}> hasn't used the marketplace yet!`,
        ephemeral: true
      });
    }

    // Get transactions
    const transactions = await getUserTransactions(userId);
    const completedTransactions = transactions.filter(t => t.status === 'completed');
    const purchases = completedTransactions.filter(t => t.buyerId === userId);
    const sales = completedTransactions.filter(t => t.sellerId === userId);

    // Calculate total spent/earned
    const totalSpent = purchases.reduce((sum, t) => sum + t.amount, 0);
    const totalEarned = sales.reduce((sum, t) => sum + t.amount, 0);

    // Get user's listed deals
    const allDeals = await getAllBots(['on_air', 'under_escrow', 'taken', 'flagged', 'archived']);
    const userDeals = allDeals.filter(d => d.sellerId === userId);

    // Get reputation tier
    const reputationTier = getReputationTier(userData.reputation);

    // Build embed
    const embed = new EmbedBuilder()
      .setTitle(`${reputationTier.emoji} ${isSelf ? 'Your' : targetUser.username + "'s"} Marketplace Profile`)
      .setDescription(`Reputation: ${ratingToStars(userData.reputation)} (${userData.reputation.toFixed(1)}/5)`)
      .setColor(0x5865F2)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .addFields(
        { 
          name: '🛒 Purchases', 
          value: `${purchases.length} deal${purchases.length !== 1 ? 's' : ''} purchased\n` +
                 `💰 Total spent: ${formatPrice(totalSpent)}`, 
          inline: true 
        },
        { 
          name: '💼 Sales', 
          value: `${sales.length} deal${sales.length !== 1 ? 's' : ''} sold\n` +
                 `💰 Total earned: ${formatPrice(totalEarned)}`, 
          inline: true 
        },
        { 
          name: '📦 Listings', 
          value: `${userDeals.length} deal${userDeals.length !== 1 ? 's' : ''} listed`, 
          inline: true 
        },
        { 
          name: '🏆 Reputation Tier', 
          value: `${reputationTier.emoji} **${reputationTier.name}**`, 
          inline: true 
        }
      );

    // Add recent purchases info
    if (purchases.length > 0) {
      const recentPurchases = purchases
        .slice(-3)
        .map(t => `• **${t.dealName}**`)
        .join('\n');
      
      embed.addFields({
        name: '🛍️ Recent Purchases',
        value: recentPurchases,
        inline: false
      });
    }

    // Add seller's listed deals info
    if (userDeals.length > 0) {
      const listedDeals = userDeals
        .slice(-3)
        .map(d => `• **${d.name}** - ${formatPrice(d.price)} - ${ratingToStars(d.avgRating)} (${d.status})`)
        .join('\n');
      
      embed.addFields({
        name: '📋 Listed Deals',
        value: listedDeals + (userDeals.length > 3 ? '\n*...and more*' : ''),
        inline: false
      });
    }

    embed.setFooter({ text: `User ID: ${userId}` });
    embed.setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: false
    });
  }
};