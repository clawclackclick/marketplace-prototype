/**
 * Marketplace Bot - Main Entry Point
 *
 * A Discord bot marketplace with micropayments and reputation
 * Stack: Node.js + Discord.js v14 + PostgreSQL
 * Cloud-ready with health checks, graceful shutdown, and REST API
 */

require('dotenv').config();

// Prevent Node.js from sleeping
process.stdin.resume();

const http = require('http');
const url = require('url');
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { 
  healthCheck, 
  pool, 
  getAllBots, 
  getBot, 
  createBot, 
  createTransaction, 
  completeTransaction,
  getUserTransactions
} = require('./db');

// Bot configuration
const TOKEN = process.env.MARKETPLACE_BOT_TOKEN;
const CLIENT_ID = process.env.MARKETPLACE_CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const HEALTH_PORT = process.env.HEALTH_PORT || 8080;

if (!CLIENT_ID) {
  console.error('❌ MARKETPLACE_CLIENT_ID not found in .env file!');
  console.error('Add: MARKETPLACE_CLIENT_ID=1477937609585197097');
  process.exit(1);
}

if (!TOKEN) {
  console.error('❌ MARKETPLACE_BOT_TOKEN not found in .env file!');
  console.error('Please copy .env.example to .env and fill in your bot token.');
  process.exit(1);
}

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages
  ]
});

// Store commands
client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

const commands = [];

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
    console.log(`✅ Loaded command: ${command.data.name}`);
  } else {
    console.warn(`⚠️ Command at ${filePath} is missing required "data" or "execute" property.`);
  }
}

// Register slash commands
const rest = new REST().setToken(TOKEN);

(async () => {
  try {
    console.log(`🔄 Registering ${commands.length} slash commands...`);
    
    if (GUILD_ID && CLIENT_ID) {
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commands }
      );
      console.log(`✅ Registered commands to guild: ${GUILD_ID}`);
    } else {
      console.log('⚠️ No GUILD_ID set. Commands will be registered globally (may take up to 1 hour).');
    }
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
})();

// Parse JSON body helper
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

// Create HTTP API server
const apiServer = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check endpoint
  if (path === '/health') {
    const dbHealth = await healthCheck();
    const botHealthy = client.ws.status === 0;
    
    res.writeHead(dbHealth.healthy && botHealthy ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: dbHealth.healthy && botHealthy ? 'healthy' : 'unhealthy', 
      database: dbHealth.healthy ? 'connected' : 'disconnected',
      discord: botHealthy ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Ready check
  if (path === '/ready') {
    const dbHealth = await healthCheck();
    res.writeHead(dbHealth.healthy && client.isReady() ? 200 : 503);
    res.end(dbHealth.healthy && client.isReady() ? 'ready' : 'not ready');
    return;
  }

  // API: List deals
  if (path === '/api/deals' && method === 'GET') {
    try {
      const status = parsedUrl.query.status || 'on_air';
      const statuses = status.split(',');
      const deals = await getAllBots(statuses);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(deals));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // API: Get single deal
  if (path.match(/^\/api\/deals\/[^/]+$/) && method === 'GET') {
    try {
      const dealId = path.split('/')[3];
      const deal = await getBot(dealId);
      
      if (!deal) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Deal not found' }));
        return;
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(deal));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // API: Create deal
  if (path === '/api/deals' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const deal = await createBot(body);
      
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(deal));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // API: Create transaction
  if (path === '/api/transactions' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const transaction = await createTransaction(body);
      
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(transaction));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // API: Complete transaction
  if (path.match(/^\/api\/transactions\/[^/]+\/complete$/) && method === 'POST') {
    try {
      const transactionId = path.split('/')[3];
      const transaction = await completeTransaction(transactionId);
      
      if (!transaction) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Transaction not found' }));
        return;
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(transaction));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // API: Get recent transactions
  if (path === '/api/transactions' && method === 'GET') {
    try {
      const limit = parseInt(parsedUrl.query.limit) || 20;
      const result = await pool.query(
        `SELECT t.*, d.name as deal_name, d.description as deal_description
         FROM transactions t
         JOIN deals d ON t.deal_id = d.id
         ORDER BY t.created_at DESC
         LIMIT $1`,
        [limit]
      );
      
      const transactions = result.rows.map(row => ({
        id: row.id,
        dealId: row.deal_id,
        dealName: row.deal_name,
        dealDescription: row.deal_description,
        buyerId: row.buyer_id,
        sellerId: row.seller_id,
        amount: parseFloat(row.amount),
        status: row.status,
        createdAt: new Date(row.created_at).getTime(),
        completedAt: row.completed_at ? new Date(row.completed_at).getTime() : null
      }));
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(transactions));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Start API server
apiServer.listen(HEALTH_PORT, () => {
  console.log(`🏥 API server running on port ${HEALTH_PORT}`);
  console.log(`   - Health: http://localhost:${HEALTH_PORT}/health`);
  console.log(`   - Deals:  http://localhost:${HEALTH_PORT}/api/deals`);

  // Self-ping every 30 seconds to keep server alive
  setInterval(() => {
    http.get(`http://localhost:${HEALTH_PORT}/health`, (res) => {
      console.log('💓 Self-ping: Server keep-alive');
    }).on('error', (err) => {
      console.error('❌ Self-ping failed:', err.message);
    });
  }, 30 * 1000);
});

// Discord ready event
client.once('ready', async () => {
  console.log(`🚀 Marketplace Bot is online! Logged in as ${client.user.tag}`);
  console.log(`🔗 Connected to Discord API - WebSocket Status: ${client.ws.status}`);
  
  const dbHealth = await healthCheck();
  if (dbHealth.healthy) {
    console.log('✅ Database connected');
  } else {
    console.error('❌ Database connection failed:', dbHealth.error);
  }
  
  if (!GUILD_ID) {
    try {
      console.log('🔄 Registering global commands...');
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands }
      );
      console.log('✅ Global commands registered!');
    } catch (error) {
      console.error('❌ Error registering global commands:', error);
    }
  }
  
  client.user.setActivity('/browse | Bot Marketplace', { type: 0 });

  // Keep-alive: Update activity every 5 minutes to prevent idle
  setInterval(() => {
    client.user.setActivity('/browse | Bot Marketplace', { type: 0 });
    console.log('💓 Keep-alive ping: Activity updated');
  }, 5 * 60 * 1000);

  // Keep-alive: Send periodic heartbeat to Discord
  setInterval(() => {
    if (client.ws.ping > 0) {
      console.log(`💓 Keep-alive: WebSocket ping ${client.ws.ping}ms`);
    }
  }, 60 * 1000);
});

// Prevent sleep on interaction - acknowledge immediately
client.on('interactionCreate', async interaction => {
  // Acknowledge ping interactions to keep connection alive
  if (interaction.type === 1) { // Ping
    console.log('💓 Received Discord ping');
    return;
  }
});

// Handle interactions
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`❌ Command not found: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error('❌ Error executing command:', error);

      const errorMessage = '❌ An error occurred while executing this command. Please try again later.';

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  }

  // Handle button interactions
  if (interaction.isButton()) {
    console.log(`🔘 Button clicked: ${interaction.customId} by user ${interaction.user.id}`);
    try {
      // Handle view deal button clicks
      if (interaction.customId.startsWith('view_')) {
        const dealId = interaction.customId.replace('view_', '');
        console.log(`👁️ Handling view button for deal ${dealId}`);
        await handleViewButton(interaction, dealId);
      }
      // Handle buy button clicks
      else if (interaction.customId.startsWith('buy_')) {
        const dealId = interaction.customId.replace('buy_', '');
        console.log(`🛒 Handling buy button for deal ${dealId}`);
        await handleBuyButton(interaction, dealId, interaction.user.id);
      }
      // Handle Activity launcher button
      else if (interaction.customId === 'launch_marketplace_activity') {
        console.log(`🚀 Launching marketplace activity for user ${interaction.user.id}`);
        await handleActivityLaunch(interaction);
      }
      // Handle back to browse button
      else if (interaction.customId === 'back_to_browse') {
        console.log(`◀ Handling back button`);
        await interaction.reply({
          content: 'Use `/browse` to see all available deals!',
          ephemeral: true
        });
      }
    } catch (error) {
      console.error('❌ Error handling button interaction:', error);
      console.error('Error stack:', error.stack);
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: `❌ An error occurred: ${error.message}` });
        } else {
          await interaction.reply({
            content: `❌ An error occurred: ${error.message}`,
            ephemeral: true
          });
        }
      } catch (e) {
        console.error('❌ Failed to send error response:', e);
      }
    }
  }
});

// Import buy handler function
async function handleBuyButton(interaction, dealId, buyerId) {
  const { getBot, createTransaction, completeTransaction } = require('./db');
  const { EmbedBuilder } = require('discord.js');

  try {
    // Defer reply immediately to prevent timeout
    await interaction.deferReply({ ephemeral: true });

    // Check deal
    const bot = await getBot(dealId);

    if (!bot) {
      return interaction.editReply({ content: '❌ Deal not found!' });
    }

    if (bot.status !== 'on_air') {
      return interaction.editReply({ content: '❌ This deal is no longer available.' });
    }

    if (bot.sellerId === buyerId) {
      return interaction.editReply({ content: '❌ You cannot buy your own deal!' });
    }

    // Create and complete transaction
    console.log(`🛒 Creating transaction for deal ${dealId}, buyer ${buyerId}`);
    const transaction = await createTransaction({
      buyerId,
      botId: bot.id,
      sellerId: bot.sellerId,
      amount: bot.price
    });
    console.log(`✅ Transaction created: ${transaction.id}`);

    await completeTransaction(transaction.id);
    console.log(`✅ Transaction completed: ${transaction.id}`);

    // Notify seller
    try {
      const seller = await interaction.client.users.fetch(bot.sellerId);
      await seller.send({
        content: `🎉 **Sold!** Your deal "${bot.name}" was purchased for $${bot.price}`
      });
    } catch (e) {}

    // Success message
    const successEmbed = new EmbedBuilder()
      .setTitle('✅ Purchase Complete!')
      .setDescription(`You bought **${bot.name}** for $${bot.price}`)
      .setColor(0x57F287);

    await interaction.editReply({ embeds: [successEmbed] });

  } catch (error) {
    console.error('❌ Error in handleBuyButton:', error);
    console.error('Error stack:', error.stack);
    // Try to respond if not already responded
    try {
      if (interaction.deferred) {
        await interaction.editReply({ content: `❌ An error occurred during purchase: ${error.message}` });
      } else if (!interaction.replied) {
        await interaction.reply({ content: `❌ An error occurred during purchase: ${error.message}`, ephemeral: true });
      }
    } catch (e) {
      console.error('❌ Failed to send error response:', e);
    }
  }
}

// Handle view deal button
async function handleViewButton(interaction, dealId) {
  const { getBot } = require('./db');
  const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

  try {
    const bot = await getBot(dealId);

    if (!bot) {
      return interaction.reply({
        content: '❌ Deal not found! It may have been sold or removed.',
        ephemeral: true
      });
    }

  // Format rating stars
  const stars = '⭐'.repeat(Math.floor(bot.avgRating || 0)) + '☆'.repeat(5 - Math.floor(bot.avgRating || 0));
  const reviewCount = bot.reviewCount || 0;

  // Clean description
  const cleanDescription = bot.description
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith('Posted by'))
    .join('\n')
    .trim();

  const embed = new EmbedBuilder()
    .setTitle(bot.name)
    .setDescription(cleanDescription)
    .setColor(0x5865F2)
    .addFields(
      { name: '💰 Price', value: `$${bot.price}`, inline: true },
      { name: '⭐ Rating', value: `${stars} (${reviewCount} reviews)`, inline: true },
      { name: '👤 Seller', value: `<@${bot.sellerId}>`, inline: true },
      { name: '🆔 Deal ID', value: `\`${bot.id}\``, inline: false }
    )
    .setFooter({ text: `Listed ${new Date(bot.createdAt).toLocaleDateString()}` });

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`buy_${bot.id}`)
        .setLabel('💰 Buy Now')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('back_to_browse')
        .setLabel('◀ Back to Browse')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  } catch (error) {
    console.error('❌ Error in handleViewButton:', error);
    try {
      await interaction.reply({
        content: '❌ An error occurred while viewing the deal. Please try again.',
        ephemeral: true
      });
    } catch (e) {
      console.error('❌ Failed to send error response:', e);
    }
  }
}

// Error handling
// Handle Activity launch
async function handleActivityLaunch(interaction) {
  const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  
  try {
    // For now, show a message explaining the Activity feature
    // In production, this would launch the actual Discord Activity
    
    const embed = new EmbedBuilder()
      .setTitle('🚀 Bot Marketplace Activity')
      .setDescription('Browse all deals by category in our interactive WebApp!')
      .setColor(0x00d4ff)
      .addFields(
        { name: '🎨 Image Generation', value: 'AI bots for creating images and art', inline: true },
        { name: '💻 Code Assistant', value: 'Programming and development helpers', inline: true },
        { name: '💬 Chat Companion', value: 'Conversational AI companions', inline: true },
        { name: '📊 Data Analysis', value: 'Data processing and analytics bots', inline: true },
        { name: '✍️ Content Creation', value: 'Writing and content generation', inline: true },
        { name: '🎮 Gaming', value: 'Game-related bots and assistants', inline: true },
        { name: '🎵 Music & Audio', value: 'Audio processing and music bots', inline: true },
        { name: '💼 Business', value: 'Productivity and business tools', inline: true },
        { name: '🤖 Other', value: 'Miscellaneous AI bots', inline: true }
      )
      .setFooter({ text: 'Use /browse for the classic text-based browsing experience' });

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('🌐 Open Web Marketplace')
          .setStyle(ButtonStyle.Link)
          .setURL('http://localhost:3000'), // This will be the Activity URL in production
        new ButtonBuilder()
          .setCustomId('back_to_browse')
          .setLabel('◀ Back to Browse')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.update({
      content: null,
      embeds: [embed],
      components: [row]
    });

    console.log(`✅ Activity launch info shown to user ${interaction.user.id}`);

  } catch (error) {
    console.error('❌ Error in handleActivityLaunch:', error);
    await interaction.update({
      content: '❌ Failed to launch marketplace activity. Please try /browse instead.',
      embeds: [],
      components: []
    });
  }
}

client.on('error', error => {
  console.error('❌ Discord client error:', error);
});

client.on('disconnect', () => {
  console.error('❌ Bot disconnected from Discord!');
});

client.on('shardDisconnect', (event, id) => {
  console.error(`❌ Shard ${id} disconnected:`, event);
});

client.on('shardReconnecting', (id) => {
  console.log(`🔄 Shard ${id} reconnecting...`);
});

process.on('unhandledRejection', error => {
  console.error('❌ Unhandled promise rejection:', error);
});

// Graceful shutdown handling
async function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  // Close API server
  apiServer.close(() => {
    console.log('🏥 API server closed');
  });
  
  // Destroy Discord client
  if (client) {
    client.destroy();
    console.log('🤖 Discord client destroyed');
  }
  
  // Close database pool
  if (pool) {
    await pool.end();
    console.log('🗄️  Database pool closed');
  }
  
  console.log('✅ Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Login
console.log('🤖 Starting Marketplace Bot...');

client.login(TOKEN)
  .then(() => {
    console.log('✅ Login successful, token accepted');
  })
  .catch(err => {
    console.error('❌ Login failed:', err.message);
    process.exit(1);
  });