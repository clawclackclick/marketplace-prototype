/**
 * Dummy Seller Bot - Test Bot for the Marketplace
 * 
 * This bot simulates a seller that responds to purchase notifications.
 * It receives DMs and replies with a confirmation message.
 * 
 * In production, this would be replaced by the actual seller's bot
 * webhook or integration.
 */

require('dotenv').config({ path: '../.env' });
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const TOKEN = process.env.SELLER_BOT_TOKEN;

if (!TOKEN) {
  console.error('❌ SELLER_BOT_TOKEN not found in .env file!');
  console.error('Please copy .env.example to .env and fill in your seller bot token.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Ready event
client.once('ready', () => {
  console.log(`🛍️ Seller Bot is online! Logged in as ${client.user.tag}`);
  console.log('This bot simulates a seller that responds to purchase notifications.');
  console.log('It will automatically reply to purchase DMs with a confirmation.');
  
  client.user.setActivity('📦 Fulfilling orders...', { type: 0 });
});

// Handle DMs (purchase notifications)
client.on('messageCreate', async message => {
  // Ignore messages from bots (including itself)
  if (message.author.bot) return;
  
  // Only respond to DMs
  if (message.channel.type !== 1) return; // 1 = DM channel
  
  // Check if this looks like a purchase notification
  if (message.content.includes('New Purchase!') && message.content.includes('Transaction ID')) {
    // Extract transaction ID
    const match = message.content.match(/Transaction ID: `([^`]+)`/);
    const transactionId = match ? match[1] : 'unknown';
    
    // Extract bot name
    const botMatch = message.content.match(/Your bot \*\*([^*]+)\*\* was/);
    const botName = botMatch ? botMatch[1] : 'your bot';
    
    // Send delivery confirmation
    const embed = new EmbedBuilder()
      .setTitle('✅ Service Delivered!')
      .setDescription(`Thank you for purchasing **${botName}**!`)
      .setColor(0x57F287)
      .addFields(
        { 
          name: '📋 Transaction', 
          value: `\`${transactionId}\``, 
          inline: true 
        },
        { 
          name: '⏱️ Status', 
          value: '✅ **Completed**\nYour service has been delivered!', 
          inline: true 
        }
      )
      .setFooter({ text: 'Please leave a review with /review on the marketplace!' })
      .setTimestamp();
    
    await message.reply({
      embeds: [embed]
    });
    
    console.log(`📦 Delivered service for transaction: ${transactionId}`);
  }
  
  // Handle regular DMs with help info
  else {
    await message.reply({
      content: 
        '👋 Hi! I\'m a **Seller Bot** on the Bot Marketplace.\n\n' +
        '🛍️ **How it works:**\n' +
        '• Someone buys my service from the marketplace\n' +
        '• I receive a DM notification\n' +
        '• I automatically confirm service delivery\n\n' +
        '💡 **For buyers:** Use `/browse` on the marketplace to see all bots!'
    });
  }
});

// Handle interactions
client.on('interactionCreate', async interaction => {
  // The seller bot could also receive webhook-style interactions
  // For this demo, we mainly use DMs for simplicity
});

// Error handling
client.on('error', error => {
  console.error('❌ Discord client error:', error);
});

process.on('unhandledRejection', error => {
  console.error('❌ Unhandled promise rejection:', error);
});

// Login
client.login(TOKEN).catch(err => {
  console.error('❌ Failed to login:', err.message);
  process.exit(1);
});

console.log('🛍️ Starting Seller Bot...');