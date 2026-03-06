const { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { getBot, addReview, getUserTransactions, updateUserReputation } = require('../db');
const { isValidRating, ratingToStars, formatDate } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('review')
    .setDescription('Leave a review for a deal you purchased')
    .addStringOption(option =>
      option
        .setName('deal_id')
        .setDescription('The ID of the deal you want to review')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('rating')
        .setDescription('Your rating (1-5 stars)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(5)
    )
    .addStringOption(option =>
      option
        .setName('comment')
        .setDescription('Your review comment')
        .setRequired(false)
        .setMaxLength(1000)
    ),

  async execute(interaction) {
    const botId = interaction.options.getString('deal_id');
    const rating = interaction.options.getInteger('rating');
    const comment = interaction.options.getString('comment') || 'No comment provided';
    const userId = interaction.user.id;

    // Validate rating
    if (!isValidRating(rating)) {
      return interaction.reply({
        content: '❌ Rating must be between 1 and 5 stars!',
        ephemeral: true
      });
    }

    // Find the deal
    const bot = await getBot(botId);
    if (!bot) {
      return interaction.reply({
        content: '❌ Deal not found! Use `/browse` to see available deals.',
        ephemeral: true
      });
    }

    // Check if user has purchased this deal
    const userTransactions = await getUserTransactions(userId);
    const hasPurchased = userTransactions.some(t => 
      t.dealId === botId && t.status === 'completed'
    );

    if (!hasPurchased) {
      return interaction.reply({
        content: '❌ You can only review deals you have purchased! Use `/buy` first.',
        ephemeral: true
      });
    }

    // Add the review
    const review = {
      userId,
      rating,
      comment,
      timestamp: Date.now()
    };

    await addReview(botId, review);

    // Update seller's reputation
    await updateUserReputation(bot.sellerId);

    // Create success embed
    const embed = new EmbedBuilder()
      .setTitle('⭐ Review Submitted!')
      .setDescription(`You have successfully reviewed **${bot.name}**`)
      .setColor(0x5865F2)
      .addFields(
        { name: 'Your Rating', value: ratingToStars(rating), inline: true },
        { name: 'New Average', value: ratingToStars(bot.avgRating), inline: true },
        { name: 'Total Reviews', value: `${bot.reviews.length}`, inline: true },
        { name: 'Your Comment', value: `"${comment}"`, inline: false }
      )
      .setFooter({ text: `Reviewed on ${formatDate(Date.now())}` });

    await interaction.reply({
      embeds: [embed],
      ephemeral: false
    });
  }
};