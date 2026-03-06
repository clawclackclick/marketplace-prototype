const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('see-deals')
    .setDescription('Browse all deals by category in the Activity WebApp'),

  async execute(interaction) {
    try {
      // Launch the Activity
      await interaction.reply({
        content: '🛒 **Opening Bot Marketplace...**\n\nClick the button below to browse all deals by category in the Activity WebApp!',
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 1, // Primary button
                label: '🚀 Launch Marketplace',
                custom_id: 'launch_marketplace_activity'
              }
            ]
          }
        ]
      });

      // Also provide a direct Activity link if configured
      // In production, this would use Discord's Activity Launcher
      
    } catch (error) {
      console.error('Error in see-deals command:', error);
      await interaction.reply({
        content: '❌ Failed to open marketplace. Please try again.',
        ephemeral: true
      });
    }
  }
};
