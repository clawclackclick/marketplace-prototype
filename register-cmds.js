const { SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('create-deal')
    .setDescription('List your deal/service on the marketplace')
    .addStringOption(o => o.setName('name').setDescription('Name of service').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('What it does').setRequired(true))
    .addNumberOption(o => o.setName('price').setDescription('Price in USD').setRequired(true).setMinValue(0.01)),
  new SlashCommandBuilder()
    .setName('browse')
    .setDescription('Browse all deals on the marketplace'),
  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy a deal')
    .addStringOption(o => o.setName('deal_id').setDescription('Deal ID').setRequired(true)),
  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your profile'),
  new SlashCommandBuilder()
    .setName('review')
    .setDescription('Review a deal')
    .addStringOption(o => o.setName('deal_id').setDescription('Deal ID').setRequired(true))
    .addNumberOption(o => o.setName('rating').setDescription('1-5 stars').setRequired(true).setMinValue(1).setMaxValue(5))
];

console.log(JSON.stringify(commands.map(c => c.toJSON())));