const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getBot, createTransaction, completeTransaction, getOrCreateUser } = require('../db');
const { formatPrice } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Purchase a deal/service from the marketplace')
    .addStringOption(option =>
      option
        .setName('deal_id')
        .setDescription('The ID of the deal you want to buy')
        .setRequired(true)
    ),

  async execute(interaction) {
    const botId = interaction.options.getString('deal_id');
    const buyerId = interaction.user.id;
    
    // Find the deal
    const bot = await getBot(botId);
    
    if (!bot) {
      return interaction.reply({
        content: '❌ Deal not found! Use `/browse` to see available deals.',
        ephemeral: true
      });
    }

    // Prevent buying your own deal
    if (bot.sellerId === buyerId) {
      return interaction.reply({
        content: '❌ You cannot buy your own deal!',
        ephemeral: true
      });
    }

    // Create transaction
    const transaction = await createTransaction({
      buyerId,
      botId: bot.id,
      sellerId: bot.sellerId,
      amount: bot.price
    });

    // Create confirmation embed
    const embed = new EmbedBuilder()
      .setTitle('💳 Purchase Confirmation')
      .setDescription(`You're about to purchase **${bot.name}**`)
      .setColor(0xFEE75C)
      .addFields(
        { name: '💰 Price', value: formatPrice(bot.price), inline: true },
        { name: '🆔 Deal ID', value: `\`${bot.id}\``, inline: true },
        { name: '👤 Seller', value: `<@${bot.sellerId}>`, inline: true },
        { name: '📋 Transaction ID', value: `\`${transaction.id}\``, inline: false }
      )
      .setFooter({ text: 'This is a simulated payment for demo purposes' });

    // Create confirmation buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`confirm_purchase_${transaction.id}`)
          .setLabel('✅ Confirm Purchase')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`cancel_purchase_${transaction.id}`)
          .setLabel('❌ Cancel')
          .setStyle(ButtonStyle.Danger)
      );

    const response = await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });

    // Set up button collector
    const collector = response.createMessageComponentCollector({
      time: 120000 // 2 minutes
    });

    collector.on('collect', async i => {
      // Only allow the original buyer to confirm/cancel
      if (i.user.id !== buyerId) {
        return i.reply({
          content: '❌ This purchase is not yours!',
          ephemeral: true
        });
      }

      if (i.customId === `confirm_purchase_${transaction.id}`) {
        // Complete the transaction
        await completeTransaction(transaction.id);

        // Notify the seller via DM (if possible)
        try {
          const seller = await interaction.client.users.fetch(bot.sellerId);
          await seller.send({
            content: `🎉 **New Purchase!**\n\n` +
                     `Your deal **${bot.name}** was just purchased!\n` +
                     `📋 Transaction ID: \`${transaction.id}\`\n` +
                     `💰 Amount: ${formatPrice(bot.price)}\n` +
                     `👤 Buyer: <@${buyerId}>`,
            allowedMentions: { users: [] }
          });
        } catch (err) {
          // Seller might have DMs disabled - that's okay
          console.log(`Could not DM seller ${bot.sellerId}: ${err.message}`);
        }

        // Update the interaction
        const successEmbed = new EmbedBuilder()
          .setTitle('✅ Purchase Complete!')
          .setDescription(`You have successfully purchased **${bot.name}**`)
          .setColor(0x57F287)
          .addFields(
            { name: '💰 Amount Paid', value: formatPrice(bot.price), inline: true },
            { name: '📋 Transaction ID', value: `\`${transaction.id}\``, inline: true },
            { name: '👤 Seller', value: `<@${bot.sellerId}>`, inline: true }
          )
          .setFooter({ text: 'Leave a review with /review' });

        await i.update({
          embeds: [successEmbed],
          components: []
        });

      } else if (i.customId === `cancel_purchase_${transaction.id}`) {
        const cancelEmbed = new EmbedBuilder()
          .setTitle('❌ Purchase Cancelled')
          .setDescription('Your purchase has been cancelled.')
          .setColor(0xED4245);

        await i.update({
          embeds: [cancelEmbed],
          components: []
        });
      }

      collector.stop();
    });

    collector.on('end', (collected, reason) => {
      if (reason === 'time' && collected.size === 0) {
        const timeoutEmbed = new EmbedBuilder()
          .setTitle('⏰ Purchase Timed Out')
          .setDescription('Your purchase session has expired. Please try again.')
          .setColor(0xED4245);

        interaction.editReply({
          embeds: [timeoutEmbed],
          components: []
        }).catch(() => {});
      }
    });
  }
};