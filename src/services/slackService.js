const logger = require('../config/logger');

class SlackService {
  constructor(client) {
    this.client = client;
  }

  /**
   * Get all channels in the workspace that match the client pattern
   * @returns {Array} Array of client names extracted from channel names
   */
  async getClientChannels() {
    try {
      const result = await this.client.conversations.list({
        types: 'public_channel,private_channel',
        exclude_archived: true,
        limit: 1000
      });

      if (!result.ok) {
        logger.error('Slack API error fetching channels:', result.error);
        return [];
      }

      const clientChannels = (result.channels || [])
        .filter(channel => channel && channel.name && channel.name.startsWith('client-'))
        .map(channel => {
          // Extract client name from channel name (remove 'client-' prefix)
          const clientName = channel.name.replace('client-', '');
          return {
            name: clientName,
            displayName: this.formatClientName(clientName),
            channelId: channel.id,
            channelName: channel.name
          };
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName));

      logger.info('Client channels fetched', { 
        count: clientChannels.length,
        channels: clientChannels.map(c => c.channelName)
      });
      return clientChannels;
    } catch (error) {
      logger.error('Error fetching client channels:', error);
      return [];
    }
  }

  /**
   * Get all users in the workspace
   * @returns {Array} Array of workspace users
   */
  async getWorkspaceUsers() {
    try {
      const result = await this.client.users.list({
        limit: 1000
      });

      if (!result.ok) {
        logger.error('Slack API error fetching users:', result.error);
        return [];
      }

      const users = (result.members || [])
        .filter(user => user && !user.deleted && !user.is_bot && user.id !== 'USLACKBOT')
        .map(user => ({
          id: user.id,
          name: user.real_name || user.name,
          username: user.name,
          email: user.profile?.email,
          isActive: !user.is_restricted && !user.is_ultra_restricted
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      logger.info('Workspace users fetched', { 
        count: users.length,
        usernames: users.slice(0, 5).map(u => u.username) // Log first 5 usernames for debugging
      });
      return users;
    } catch (error) {
      logger.error('Error fetching workspace users:', error);
      return [];
    }
  }

  /**
   * Get user info by Slack user ID
   * @param {string} userId - Slack user ID
   * @returns {Object} User information
   */
  async getUserInfo(userId) {
    try {
      const result = await this.client.users.info({
        user: userId
      });

      if (result.ok && result.user) {
        return {
          id: result.user.id,
          name: result.user.real_name || result.user.name,
          username: result.user.name,
          email: result.user.profile?.email,
          isActive: !result.user.deleted && !result.user.is_bot
        };
      }

      return null;
    } catch (error) {
      logger.error('Error fetching user info:', error);
      return null;
    }
  }

  /**
   * Format client name for display (capitalize words, replace hyphens with spaces)
   * @param {string} clientName - Raw client name from channel
   * @returns {string} Formatted client name
   */
  formatClientName(clientName) {
    return clientName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Search for channels by name pattern
   * @param {string} pattern - Search pattern
   * @returns {Array} Matching channels
   */
  async searchChannels(pattern) {
    try {
      const result = await this.client.conversations.list({
        types: 'public_channel,private_channel',
        exclude_archived: true,
        limit: 1000
      });

      const matchingChannels = result.channels
        .filter(channel => 
          channel.name.toLowerCase().includes(pattern.toLowerCase())
        )
        .map(channel => ({
          id: channel.id,
          name: channel.name,
          purpose: channel.purpose?.value || '',
          memberCount: channel.num_members || 0
        }));

      return matchingChannels;
    } catch (error) {
      logger.error('Error searching channels:', error);
      return [];
    }
  }
}

module.exports = SlackService; 