/**
 * Test Seller Bots - Post dummy deals every 2 minutes
 * 3 bots, 1 hour total runtime
 */

const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

// Seller bot configurations - using 2 separate tokens
const SELLER_BOTS = [
  { name: 'SellerBot-A', token: process.env.SELLER_BOT_TOKEN },
  { name: 'SellerBot-B', token: process.env.SELLER2_BOT_TOKEN }
];

const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;

const DEAL_TEMPLATES = [
  { name: 'Logo Design Pro', description: 'Professional logo design with 3 revisions. High quality vector files included.', price: 25, category: 'design' },
  { name: 'Web Scraping Script', description: 'Custom Python scraper for any website. Data delivered in CSV/JSON.', price: 50, category: 'development' },
  { name: 'Discord Bot Setup', description: 'Complete Discord bot with moderation, music, and custom commands.', price: 75, category: 'development' },
  { name: 'SEO Optimization', description: 'Website SEO audit and optimization. Improve your Google ranking.', price: 40, category: 'marketing' },
  { name: 'Blog Article Writing', description: '1000-word SEO-optimized blog post on any topic. Research included.', price: 30, category: 'writing' },
  { name: 'Data Analysis Report', description: 'Excel/CSV data analysis with charts and insights. Business intelligence.', price: 60, category: 'data' },
  { name: 'Social Media Graphics', description: '10 custom Instagram/Facebook posts. Branded and engaging.', price: 35, category: 'design' },
  { name: 'API Integration', description: 'Connect your app to any API. Authentication and error handling included.', price: 80, category: 'development' },
  { name: 'Email Marketing Setup', description: 'Mailchimp/email automation setup. Templates and workflows.', price: 45, category: 'marketing' },
  { name: 'Product Description', description: '50 compelling product descriptions for e-commerce. SEO optimized.', price: 55, category: 'writing' }
];

const API_BASE = process.env.API_BASE || 'http://localhost:8080';
const RUNTIME_MINUTES = 6000;
const INTERVAL_MS = 10 * 1000; // 10 seconds

class TestSellerBot {
  constructor(config) {
    this.config = config;
    this.client = new Client({ intents: [GatewayIntentBits.Guilds] });
    this.dealsPosted = 0;
    this.startTime = Date.now();
  }

  async start() {
    console.log(`🤖 Starting ${this.config.name}...`);
    
    this.client.once('ready', () => {
      console.log(`✅ ${this.config.name} logged in as ${this.client.user.tag}`);
      this.startPosting();
    });

    // Handle button interactions
    this.client.on('interactionCreate', async interaction => {
      if (interaction.isButton() && interaction.customId.startsWith('buy_')) {
        try {
          await interaction.deferReply({ ephemeral: true });
          const dealId = interaction.customId.replace('buy_', '');
          
          // Forward to marketplace bot API
          const response = await axios.post(`${API_BASE}/api/transactions`, {
            buyerId: interaction.user.id,
            botId: dealId,
            sellerId: this.client.user.id,
            amount: 0 // Will be fetched from deal
          });
          
          const transaction = response.data;
          await axios.post(`${API_BASE}/api/transactions/${transaction.id}/complete`);
          
          await interaction.editReply({
            content: `✅ Purchase initiated! Transaction ID: ${transaction.id}`
          });
        } catch (error) {
          console.error(`❌ Buy button error:`, error.message);
          await interaction.editReply({
            content: `❌ Failed to process purchase: ${error.message}`
          }).catch(() => {});
        }
      }
    });

    await this.client.login(this.config.token);
  }

  startPosting() {
    // Post first deal immediately
    this.postDeal();
    
    // Then every 2 minutes
    const interval = setInterval(() => {
      const elapsed = (Date.now() - this.startTime) / 1000 / 60;
      
      if (elapsed >= RUNTIME_MINUTES) {
        console.log(`⏹️ ${this.config.name} reached 1 hour limit. Stopping.`);
        clearInterval(interval);
        this.client.destroy();
        return;
      }
      
      this.postDeal();
    }, INTERVAL_MS);
  }

  async postDeal() {
    try {
      // Pick random deal template
      const template = DEAL_TEMPLATES[Math.floor(Math.random() * DEAL_TEMPLATES.length)];

      // Add unique identifier
      const deal = {
        name: `${template.name} #${this.dealsPosted + 1}`,
        description: `${template.description}\n\nPosted by ${this.config.name}`,
        price: template.price + Math.floor(Math.random() * 10), // Slight price variation
        sellerId: this.client.user.id
      };

      // Post to API
      const response = await axios.post(`${API_BASE}/api/deals`, deal);
      const dealId = response.data.id;

      this.dealsPosted++;
      console.log(`📦 ${this.config.name} posted: "${deal.name}" for $${deal.price} (${this.dealsPosted} total)`);

      // Post to Discord channel with Buy button
      await this.postToDiscord(deal, dealId);

    } catch (error) {
      console.error(`❌ ${this.config.name} failed to post deal:`, error.message);
    }
  }

  async postToDiscord(deal, dealId) {
    try {
      if (!CHANNEL_ID) return;

      const channel = await this.client.channels.fetch(CHANNEL_ID);
      if (channel) {
        // Create Buy button
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`buy_${dealId}`)
              .setLabel('Buy')
              .setStyle(ButtonStyle.Success)
              .setEmoji('💰')
          );

        await channel.send({
          content: `📦 **New Deal Posted**\n**${deal.name}**\n💰 Price: $${deal.price}\n📝 ${deal.description.split('\n')[0]}\n\nUse \`/browse\` to see all deals!`,
          components: [row]
        });
        console.log(`📢 ${this.config.name} announced deal in Discord with Buy button`);
      }
    } catch (error) {
      console.error(`❌ ${this.config.name} failed to post to Discord:`, error.message);
    }
  }
}

// Start all seller bots
async function main() {
  console.log('🚀 Starting Test Seller Bots');
  console.log(`⏱️  Runtime: ${RUNTIME_MINUTES} minutes`);
  console.log(`📅 Posting interval: 24 hours`);
  console.log('');

  for (const config of SELLER_BOTS) {
    if (!config.token) {
      console.warn(`⚠️  No token for ${config.name}, skipping...`);
      continue;
    }
    
    const bot = new TestSellerBot(config);
    bot.start().catch(err => console.error(`❌ ${config.name} failed:`, err));
    
    // Small delay between bot startups
    await new Promise(r => setTimeout(r, 5000));
  }
}

main();