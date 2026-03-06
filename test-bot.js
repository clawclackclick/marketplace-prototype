// Minimal Discord Bot Test - Just connection, no commands
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN = process.env.MARKETPLACE_BOT_TOKEN;

console.log('Testing with token:', TOKEN ? TOKEN.substring(0, 20) + '...' : 'NOT FOUND');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages
  ]
});

client.on('ready', () => {
  console.log('✅ READY EVENT FIRED!');
  console.log(`Bot: ${client.user.tag}`);
  console.log(`Guilds: ${client.guilds.cache.size}`);
  console.log(`WebSocket: ${client.ws.status} (0=READY, 1=CONNECTING, 2=RECONNECTING, etc)`);
});

client.on('shardReady', (id) => {
  console.log(`✅ Shard ${id} ready`);
});

client.on('disconnect', () => {
  console.log('❌ DISCONNECTED');
});

client.on('debug', (msg) => {
  console.log(`[DEBUG] ${msg.substring(0, 100)}...`);
});

client.on('error', (err) => {
  console.log('❌ ERROR:', err.message);
});

console.log('Logging in...');
client.login(TOKEN)
  .then(() => console.log('Login promise resolved'))
  .catch(err => console.log('Login failed:', err.message));

// Keep alive for 30 seconds
setTimeout(() => {
  console.log('❌ Timeout reached, shutting down...');
  process.exit(0);
}, 30000);
