# 🤖 Bot Marketplace

A Discord bot marketplace with micropayments and reputation system. This is a **Phase 1 MVP** demonstrating the core flow using Node.js and Discord.js v14.

## ✨ Features

- **List Bots:** Sellers can register their services with `/list-bot`
- **Browse Listings:** Buyers can browse all available bots with `/browse`
- **Buy Services:** Simulate purchases with `/buy` (Stripe integration coming later)
- **Leave Reviews:** Rate and review purchases with `/review`
- **Reputation System:** Track seller reputation based on reviews ⭐
- **User Profiles:** View purchase history and stats with `/profile`

## 📁 Project Structure

```
bot-marketplace/
├── marketplace-bot/          # Main marketplace hub bot
│   ├── commands/
│   │   ├── list-bot.js       # Register new bot listings
│   │   ├── browse.js         # Browse all bots
│   │   ├── buy.js            # Purchase a bot
│   │   ├── review.js         # Leave a review
│   │   └── profile.js        # View user stats
│   ├── storage.js            # In-memory database
│   ├── utils.js              # Helper functions
│   └── index.js              # Bot entry point
├── seller-bot/               # Dummy seller bot
│   └── index.js              # Responds to purchase DMs
├── package.json
├── .env.example              # Environment template
└── README.md                 # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- A Discord account
- Basic familiarity with Discord bots

### Step 1: Discord Developer Portal Setup

1. **Create a Discord Application:**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Click "New Application" → Give it a name (e.g., "Bot Marketplace")
   - Save the Application ID for later

2. **Create a Bot:**
   - In your app, go to the "Bot" tab
   - Click "Add Bot" → "Yes, do it!"
   - **Important:** Enable these intents:
     - ☑️ SERVER MEMBERS INTENT
     - ☑️ MESSAGE CONTENT INTENT
   - Click "Reset Token" and **copy the token** (you'll need this!)

3. **Invite Bot to Your Server:**
   - Go to "OAuth2" → "URL Generator"
   - Select scopes: `bot` and `applications.commands`
   - Bot permissions needed:
     - Send Messages
     - Embed Links
     - Use Slash Commands
     - Read Message History
   - Copy the URL, open it in browser, select your server

4. **Create a Second Bot (Seller Bot):**
   - Repeat steps 1-3 for a second application (e.g., "Demo Seller Bot")
   - This simulates a seller that responds to purchases

5. **Get Your Server ID:**
   - In Discord, enable Developer Mode: User Settings → Advanced → Developer Mode
   - Right-click your server name → "Copy Server ID"

### Step 2: Installation

```bash
# Clone or navigate to the project
cd bot-marketplace

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your bot tokens
# Use nano, vim, or any text editor
nano .env
```

**Fill in your `.env` file:**
```env
MARKETPLACE_BOT_TOKEN=your_marketplace_bot_token_here
SELLER_BOT_TOKEN=your_seller_bot_token_here
GUILD_ID=your_discord_server_id
```

### Step 3: Run the Bots

```bash
# Run both bots (recommended for testing)
npm run dev

# Or run them separately:
npm run start      # Marketplace bot only
npm run seller     # Seller bot only
```

You should see:
```
🤖 Starting Marketplace Bot...
🚀 Marketplace Bot is online! Logged in as Marketplace Bot#1234
🛍️ Starting Seller Bot...
🛍️ Seller Bot is online! Logged in as Demo Seller#5678
```

## 🎮 Quick Test Flow

Here's a complete walkthrough of the marketplace features:

### 1. List a Bot
```
/list-bot name:"AI Writer" description:"Writes blog posts, emails, and social media content" price:5.00
```
✅ You should receive a confirmation with the bot ID.

### 2. Browse Listings
```
/browse
```
📋 Shows paginated embeds of all bots with:
- Price 💰
- Rating ⭐
- Bot ID 🆔
- Seller information 👤

### 3. Purchase a Bot
```
/buy bot_id:abc123
```
💳 Opens a confirmation dialog. Click "✅ Confirm Purchase" to complete.

The seller bot will be notified via DM and automatically respond with:
> "✅ Service delivered for transaction #xyz!"

### 4. Leave a Review
```
/review bot_id:abc123 rating:5 comment:"Great service, highly recommend!"
```
⭐ Submits your review and updates the seller's reputation.

### 5. Check Your Profile
```
/profile
```
📊 Shows:
- Total purchases/sales
- Money spent/earned
- Reputation rating
- Listed bots
- Recent activity

### 6. View Other Profiles
```
/profile user:@someone
```
👀 See another user's marketplace stats.

## 🎯 Available Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `/list-bot` | Register a new bot | `/list-bot name:"Bot Name" description:"What it does" price:10.00` |
| `/browse` | View all listings | `/browse` |
| `/buy` | Purchase a bot | `/buy bot_id:your_bot_id` |
| `/review` | Leave a review | `/review bot_id:your_bot_id rating:5 comment:"Great!"` |
| `/profile` | View your profile | `/profile` or `/profile user:@someone` |

## 🏗️ Architecture Overview

### Storage (In-Memory)
```javascript
// bots: { id, name, description, price, sellerId, reviews: [], avgRating }
// users: { id, reputation, transactions: [], listedBots: [], boughtBots: [] }
// transactions: { id, buyerId, botId, sellerId, status, timestamp, amount }
```

Data persists only while the bot is running. For production, replace with PostgreSQL.

### Reputation System
```javascript
avgRating = sum(allStars) / totalReviews
```
- Displayed as ⭐⭐⭐⭐☆ (4/5)
- Tiers: 🆕 New → 🌱 Rising → 📈 Trusted → 🛡️ → 💎 Excellent → 👑 Legendary

### Simulated Payments
- Currently just simulated (no real money)
- Stripe integration planned for Phase 2
- Transactions track status: pending → completed

## 📝 Code Structure Notes

**For junior developers:**

- `storage.js` - Simple in-memory database (swap for PostgreSQL later)
- `utils.js` - Helper functions you can reuse
- `commands/*.js` - Each command is self-contained
- Use `console.log()` liberally for debugging
- Check Discord.js documentation: https://discord.js.org/#/docs/main/stable/

## 🔮 Future Improvements

- **Phase 2:** PostgreSQL database for persistence
- **Phase 2:** Real Stripe integration for payments
- **Phase 3:** Advanced search and filtering
- **Phase 3:** Dispute resolution system
- **Phase 4:** Web dashboard

## 🐛 Troubleshooting

**"Token not found" error:**
- Make sure `.env` file exists and tokens are filled in
- No quotes around tokens in .env file

**Commands not showing:**
- Wait up to 1 hour for global commands (or use GUILD_ID for instant updates)
- Make sure bot has `applications.commands` scope when inviting
- Restart the bot after fixing

**Bot not responding to DMs:**
- Enable MESSAGE CONTENT INTENT in Discord Developer Portal
- Make sure bot has permission to read message history

**Purchase notifications not sending:**
- Seller bot must be running
- Users need to accept DMs from server members

## 📜 License

MIT - Feel free to use and modify!

## 🤝 Contributing

This is a learning project. Feel free to fork, experiment, and make it your own!

---

**Happy coding! 🚀**