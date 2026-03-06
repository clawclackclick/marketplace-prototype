/**
 * Test Buyer Bots - Buy deals via API every 5 minutes
 * 2 bots with different strategies, 1 hour runtime
 * Now with Discord notifications
 */

const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');

// Buyer bot configurations - using 2 bots with Discord tokens
const BUYER_BOTS = [
  { name: 'BuyerBot-X', strategy: 'cheapest', buyerId: 'buyer_x_001', token: process.env.BUYER_BOT_TOKEN },
  { name: 'BuyerBot-Y', strategy: 'best_rated', buyerId: 'buyer_y_002', token: process.env.BUYER2_BOT_TOKEN }
];

const API_BASE = process.env.API_BASE || 'http://localhost:8080';
const CHANNEL_ID = process.env.CHANNEL_ID;
const RUNTIME_MINUTES = 6000;
const INTERVAL_MS = 10 * 1000; // 10 seconds
const OFFSET_MS = 60 * 60 * 1000; // 1 hour offset between buyer bots

class TestBuyerBot {
  constructor(config, startOffset) {
    this.config = config;
    this.client = new Client({ intents: [GatewayIntentBits.Guilds] });
    this.dealsBought = 0;
    this.startTime = Date.now();
    this.startOffset = startOffset;
  }

  async start() {
    console.log(`🤖 Starting ${this.config.name} (strategy: ${this.config.strategy})...`);

    // Login to Discord if token available
    if (this.config.token) {
      this.client.once('ready', () => {
        console.log(`✅ ${this.config.name} logged in as ${this.client.user.tag}`);
      });
      await this.client.login(this.config.token);
    }

    // Wait for offset before starting purchases
    setTimeout(() => {
      console.log(`▶️ ${this.config.name} starting purchases after ${this.startOffset/1000}s offset`);
      this.startBuying();
    }, this.startOffset);
  }

  startBuying() {
    // Buy first deal immediately
    this.buyDeal();

    // Then every 5 minutes
    const interval = setInterval(() => {
      const elapsed = (Date.now() - this.startTime) / 1000 / 60;

      if (elapsed >= RUNTIME_MINUTES) {
        console.log(`⏹️ ${this.config.name} reached 1 hour limit. Stopping.`);
        clearInterval(interval);
        if (this.client) this.client.destroy();
        return;
      }

      this.buyDeal();
    }, INTERVAL_MS);
  }

  async buyDeal() {
    try {
      // Fetch available deals
      const response = await axios.get(`${API_BASE}/api/deals?status=on_air`);
      const deals = response.data;

      if (deals.length === 0) {
        console.log(`⏳ ${this.config.name}: No deals available, waiting...`);
        return;
      }

      // Select deal based on strategy
      let selectedDeal;
      switch (this.config.strategy) {
        case 'cheapest':
          selectedDeal = deals.sort((a, b) => a.price - b.price)[0];
          break;
        case 'best_rated':
          selectedDeal = deals.sort((a, b) => b.avgRating - a.avgRating)[0];
          break;
        case 'random':
        default:
          selectedDeal = deals[Math.floor(Math.random() * deals.length)];
      }

      // Purchase the deal
      const purchase = {
        buyerId: this.config.buyerId,
        botId: selectedDeal.id,
        sellerId: selectedDeal.sellerId,
        amount: selectedDeal.price
      };

      const txResponse = await axios.post(`${API_BASE}/api/transactions`, purchase);
      const transaction = txResponse.data;

      // Complete the transaction immediately (simulating successful payment)
      await axios.post(`${API_BASE}/api/transactions/${transaction.id}/complete`);

      this.dealsBought++;
      console.log(`💰 ${this.config.name} bought: "${selectedDeal.name}" for $${selectedDeal.price} (${this.config.strategy}) [${this.dealsBought} total]`);

      // Post to Discord channel
      await this.postToDiscord(selectedDeal, transaction);

    } catch (error) {
      console.error(`❌ ${this.config.name} failed to buy deal:`, error.message);
    }
  }

  async postToDiscord(deal, transaction) {
    try {
      if (!CHANNEL_ID || !this.client.isReady()) return;

      const channel = await this.client.channels.fetch(CHANNEL_ID);
      if (channel) {
        await channel.send({
          content: `💰 **Purchase Complete!**\n**${deal.name}**\n💵 Price: $${deal.price}\n🛒 Buyer: ${this.config.name}\n🆔 Transaction: \`${transaction.id}\``
        });
        console.log(`📢 ${this.config.name} announced purchase in Discord`);
      }
    } catch (error) {
      console.error(`❌ ${this.config.name} failed to post to Discord:`, error.message);
    }
  }
}

// Start all buyer bots with offsets
async function main() {
  console.log('🚀 Starting Test Buyer Bots');
  console.log(`⏱️  Runtime: ${RUNTIME_MINUTES} minutes`);
  console.log(`📅 Buying interval: 10 seconds`);
  console.log('');

  for (let i = 0; i < BUYER_BOTS.length; i++) {
    const config = BUYER_BOTS[i];
    const offset = i * OFFSET_MS; // 0s, 1hr offsets
    const bot = new TestBuyerBot(config, offset);
    bot.start();

    // Small delay between bot startups
    await new Promise(r => setTimeout(r, 2000));
  }
}

main();
