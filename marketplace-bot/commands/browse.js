const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getAllBots } = require('../db');
const { ratingToStars, formatPrice, truncate, paginate } = require('../utils');

const ITEMS_PER_PAGE = 5;
const MAX_SELECT_MENU_OPTIONS = 25;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('browse')
    .setDescription('Browse all deals/services on the marketplace')
    .addStringOption(option =>
      option
        .setName('search')
        .setDescription('Search by keyword in deal name or description')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option
        .setName('category')
        .setDescription('Filter by category')
        .setRequired(false)
        .addChoices(
          { name: 'Development', value: 'development' },
          { name: 'Design', value: 'design' },
          { name: 'Marketing', value: 'marketing' },
          { name: 'Writing', value: 'writing' },
          { name: 'Data', value: 'data' },
          { name: 'Other', value: 'other' }
        )
    )
    .addNumberOption(option =>
      option
        .setName('price_max')
        .setDescription('Maximum price filter')
        .setRequired(false)
        .setMinValue(0)
    )
    .addNumberOption(option =>
      option
        .setName('rating_min')
        .setDescription('Minimum rating filter (1-5)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(5)
    )
    .addStringOption(option =>
      option
        .setName('sort')
        .setDescription('Sort order')
        .setRequired(false)
        .addChoices(
          { name: 'Newest First', value: 'newest' },
          { name: 'Price: Low to High', value: 'price_asc' },
          { name: 'Price: High to Low', value: 'price_desc' },
          { name: 'Best Rated', value: 'rating' },
          { name: 'Most Popular', value: 'popular' }
        )
    ),

  async execute(interaction) {
    const searchQuery = interaction.options.getString('search');
    const category = interaction.options.getString('category');
    const priceMax = interaction.options.getNumber('price_max');
    const ratingMin = interaction.options.getNumber('rating_min');
    const sortBy = interaction.options.getString('sort') || 'newest';

    // Get all active deals
    let allDeals = await getAllBots(['on_air']);
    
    // Apply filters
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      allDeals = allDeals.filter(d => 
        d.name.toLowerCase().includes(query) ||
        d.description.toLowerCase().includes(query)
      );
    }
    
    if (category) {
      // For now, category is inferred from name/description
      // In production, you'd have a category column
      const categoryKeywords = {
        development: ['code', 'bot', 'script', 'api', 'programming', 'dev', 'software', 'app'],
        design: ['logo', 'design', 'graphic', 'ui', 'ux', 'branding', 'art'],
        marketing: ['marketing', 'seo', 'social', 'ads', 'promotion', 'growth'],
        writing: ['write', 'content', 'blog', 'article', 'copy', 'text', 'essay'],
        data: ['data', 'scraping', 'analysis', 'excel', 'csv', 'database', 'research']
      };
      const keywords = categoryKeywords[category] || [];
      allDeals = allDeals.filter(d => 
        keywords.some(k => 
          d.name.toLowerCase().includes(k) || 
          d.description.toLowerCase().includes(k)
        )
      );
    }
    
    if (priceMax !== null) {
      allDeals = allDeals.filter(d => d.price <= priceMax);
    }
    
    if (ratingMin !== null) {
      allDeals = allDeals.filter(d => d.avgRating >= ratingMin);
    }
    
    if (allDeals.length === 0) {
      return interaction.reply({
        content: '📭 No deals match your criteria. Try adjusting your filters or `/create-deal` to list your own!',
        ephemeral: true
      });
    }

    // Sort deals
    switch (sortBy) {
      case 'price_asc':
        allDeals.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        allDeals.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        allDeals.sort((a, b) => b.avgRating - a.avgRating);
        break;
      case 'popular':
        allDeals.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
        break;
      case 'newest':
      default:
        allDeals.sort((a, b) => b.createdAt - a.createdAt);
    }
    
    // Create pagination
    const pagination = paginate(allDeals, 0, ITEMS_PER_PAGE);
    
    // Generate embed
    const embed = createBrowseEmbed(pagination, allDeals.length, { searchQuery, category, priceMax, ratingMin, sortBy });
    
    // Create button rows (buy buttons + navigation)
    const rows = createButtonRows(pagination, allDeals);
    
    const response = await interaction.reply({
      embeds: [embed],
      components: rows,
      ephemeral: false
    });

    // Set up button collector
    setupButtonCollector(response, interaction, allDeals, { searchQuery, category, priceMax, ratingMin, sortBy });
  }
};

function createBrowseEmbed(pagination, totalCount, filters) {
  // Build filter description
  const filterParts = [];
  if (filters.searchQuery) filterParts.push(`🔍 "${filters.searchQuery}"`);
  if (filters.category) filterParts.push(`📁 ${filters.category.charAt(0).toUpperCase() + filters.category.slice(1)}`);
  if (filters.priceMax) filterParts.push(`💰 Max $${filters.priceMax}`);
  if (filters.ratingMin) filterParts.push(`⭐ ${filters.ratingMin}+ stars`);
  
  const filterText = filterParts.length > 0 
    ? `\n**Filters:** ${filterParts.join(' • ')}`
    : '';

  const embed = new EmbedBuilder()
    .setTitle('🤖 Deal Marketplace')
    .setDescription(`Found ${totalCount} deal${totalCount !== 1 ? 's' : ''}${filterText}\n\nUse the buttons below to view and purchase deals.`)
    .setColor(0x5865F2)
    .setFooter({ text: `Page ${pagination.currentPage + 1} of ${pagination.totalPages} • Sorted by: ${filters.sortBy}` });

  for (const bot of pagination.items) {
    const stars = ratingToStars(bot.avgRating);
    const reviewCount = bot.reviewCount || 0;
    
    // Remove "Posted by" line from description if present (test data artifact)
    // Split by newlines and filter out any line starting with "Posted by"
    const cleanDescription = bot.description
      .split(/\r?\n/)
      .filter(line => !line.trim().startsWith('Posted by'))
      .join('\n')
      .trim();
    
    embed.addFields({
      name: `${bot.name} — ${formatPrice(bot.price)}`,
      value: 
        `${truncate(cleanDescription, 80)}\n` +
        `⭐ ${stars} (${reviewCount} reviews) • 👤 <@${bot.sellerId}>`,
      inline: false
    });
  }

  return embed;
}

function createButtonRows(pagination, allDeals) {
  const rows = [];
  
  // Add Buy buttons row (up to 5 buttons)
  const buyRow = new ActionRowBuilder();
  for (const bot of pagination.items.slice(0, 5)) {
    buyRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`view_${bot.id}`)
        .setLabel(`View: ${truncate(bot.name, 18)}`)
        .setStyle(ButtonStyle.Primary)
        .setEmoji('👁️')
    );
  }
  rows.push(buyRow);
  
  // Add navigation buttons if multiple pages
  if (pagination.totalPages > 1) {
    const navRow = new ActionRowBuilder();
    navRow.addComponents(
      new ButtonBuilder()
        .setCustomId('prev_page')
        .setLabel('◀ Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pagination.currentPage === 0),
      new ButtonBuilder()
        .setCustomId('page_info')
        .setLabel(`Page ${pagination.currentPage + 1}/${pagination.totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('next_page')
        .setLabel('Next ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pagination.currentPage >= pagination.totalPages - 1)
    );
    rows.push(navRow);
  }
  
  return rows;
}

function setupButtonCollector(response, interaction, allDeals, filters) {
  const collector = response.createMessageComponentCollector({
    time: 300000 // 5 minutes
  });

  let currentPage = 0;

  collector.on('collect', async i => {
    const userId = i.user.id;
    
    // Handle view deal button
    if (i.customId.startsWith('view_')) {
      const dealId = i.customId.replace('view_', '');
      return handleViewDeal(i, dealId, userId);
    }
    
    // Handle buy button from deal view
    if (i.customId.startsWith('buy_')) {
      const dealId = i.customId.replace('buy_', '');
      return handleBuyButton(i, dealId, userId);
    }
    
    // Only allow original user to navigate pages
    if (userId !== interaction.user.id) {
      return i.reply({
        content: '❌ Only the person who ran this command can navigate pages!',
        ephemeral: true
      });
    }

    // Handle pagination
    if (i.customId === 'prev_page') {
      currentPage = Math.max(0, currentPage - 1);
    } else if (i.customId === 'next_page') {
      const maxPage = Math.ceil(allDeals.length / ITEMS_PER_PAGE) - 1;
      currentPage = Math.min(maxPage, currentPage + 1);
    } else {
      return;
    }

    const pagination = paginate(allDeals, currentPage, ITEMS_PER_PAGE);
    const embed = createBrowseEmbed(pagination, allDeals.length, filters);
    const rows = createButtonRows(pagination, allDeals);

    await i.update({
      embeds: [embed],
      components: rows
    });
  });

  collector.on('end', () => {
    response.edit({ components: [] }).catch(() => {});
  });
}

async function handleViewDeal(interaction, dealId, userId) {
  const { getBot } = require('../db');
  const bot = await getBot(dealId);
  
  if (!bot) {
    return interaction.reply({
      content: '❌ Deal not found! It may have been sold or removed.',
      ephemeral: true
    });
  }
  
  const stars = ratingToStars(bot.avgRating);
  const reviewCount = bot.reviewCount || 0;
  
  // Remove "Posted by" line from description if present (test data artifact)
  // Split by newlines and filter out any line starting with "Posted by"
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
      { name: '💰 Price', value: formatPrice(bot.price), inline: true },
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
}

async function handleBuyButton(interaction, dealId, buyerId) {
  const { getBot, createTransaction, completeTransaction } = require('../db');
  
  // Check deal first before deferring
  const bot = await getBot(dealId);
  
  if (!bot) {
    return interaction.reply({ content: '❌ Deal not found!', ephemeral: true });
  }
  
  if (bot.status !== 'on_air') {
    return interaction.reply({ content: '❌ This deal is no longer available.', ephemeral: true });
  }
  
  if (bot.sellerId === buyerId) {
    return interaction.reply({ content: '❌ You cannot buy your own deal!', ephemeral: true });
  }
  
  // Now defer and create transaction
  await interaction.deferReply({ ephemeral: true });
  
  const transaction = await createTransaction({
    buyerId,
    botId: bot.id,
    sellerId: bot.sellerId,
    amount: bot.price
  });
  
  const embed = new EmbedBuilder()
    .setTitle('💳 Purchase Confirmation')
    .setDescription(`Buy **${bot.name}** for ${formatPrice(bot.price)}?`)
    .setColor(0xFEE75C);
  
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`confirm_${transaction.id}_${bot.id}`)
        .setLabel('✅ Confirm')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`cancel_${transaction.id}`)
        .setLabel('❌ Cancel')
        .setStyle(ButtonStyle.Danger)
    );
  
  await interaction.editReply({ embeds: [embed], components: [row] });
  
  // Create collector on the channel instead of the ephemeral message
  const filter = btn => btn.user.id === buyerId && 
    (btn.customId === `confirm_${transaction.id}_${bot.id}` || btn.customId === `cancel_${transaction.id}`);
  
  const collector = interaction.channel.createMessageComponentCollector({ 
    filter, 
    time: 120000,
    max: 1
  });
  
  collector.on('collect', async btn => {
    // Defer the button click
    await btn.deferUpdate().catch(() => {});
    
    if (btn.customId.startsWith(`confirm_${transaction.id}`)) {
      await completeTransaction(transaction.id);
      
      try {
        const seller = await interaction.client.users.fetch(bot.sellerId);
        await seller.send({
          content: `🎉 **Sold!** Your deal "${bot.name}" was purchased for ${formatPrice(bot.price)}`
        });
      } catch (e) {}
      
      const successEmbed = new EmbedBuilder()
        .setTitle('✅ Purchase Complete!')
        .setDescription(`You bought **${bot.name}**`)
        .setColor(0x57F287);
      
      await interaction.editReply({ embeds: [successEmbed], components: [] }).catch(() => {});
      await btn.followUp({ content: `✅ Purchase complete! You bought **${bot.name}**.`, ephemeral: true }).catch(() => {});
    } else if (btn.customId === `cancel_${transaction.id}`) {
      const cancelEmbed = new EmbedBuilder()
        .setTitle('❌ Cancelled')
        .setDescription('Purchase cancelled.')
        .setColor(0xED4245);
      
      await interaction.editReply({ embeds: [cancelEmbed], components: [] }).catch(() => {});
    }
  });
  
  collector.on('end', (collected, reason) => {
    if (reason === 'time' && collected.size === 0) {
      const timeoutEmbed = new EmbedBuilder()
        .setTitle('⏰ Timed Out')
        .setDescription('Purchase confirmation timed out. Please try again.')
        .setColor(0xED4245);
      
      interaction.editReply({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
    }
  });
}