const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createBot } = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('create-deal')
    .setDescription('List your deal/service on the marketplace')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Name of your deal/service')
        .setRequired(true)
        .setMaxLength(100)
    )
    .addStringOption(option =>
      option
        .setName('description')
        .setDescription('Description of what your deal offers')
        .setRequired(true)
        .setMaxLength(1000)
    )
    .addNumberOption(option =>
      option
        .setName('price')
        .setDescription('Price in USD (e.g., 5.00)')
        .setRequired(true)
        .setMinValue(0.01)
    ),

  async execute(interaction) {
    // Defer reply immediately to prevent timeout
    await interaction.deferReply({ ephemeral: true });
    
    const name = interaction.options.getString('name');
    const description = interaction.options.getString('description');
    const price = interaction.options.getNumber('price');

    // Validate inputs
    if (price <= 0) {
      return interaction.editReply({
        content: '❌ Price must be greater than 0!'
      });
    }

    // Create the deal listing
    const bot = await createBot({
      name,
      description,
      price,
      sellerId: interaction.user.id
    });

    // Create Buy button
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`buy_${bot.id}`)
          .setLabel('Buy')
          .setStyle(ButtonStyle.Success)
          .setEmoji('💰')
      );

    // Reply with success message and Buy button
    await interaction.editReply({
      content: `✅ **${name}** has been listed on the marketplace!\n\n` +
               `📋 **Deal ID:** \`${bot.id}\`\n` +
               `💰 **Price:** $${price.toFixed(2)}\n\n` +
               `Buyers can click the button below or use \`/buy deal_id:${bot.id}\` to purchase your deal.`,
      components: [row]
    });
  }
};