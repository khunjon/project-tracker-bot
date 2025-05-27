const { App } = require('@slack/bolt');
const logger = require('../config/logger');

// Import command handlers
const projectNewCommand = require('./commands/projectNew');
const projectUpdateCommand = require('./commands/projectUpdate');
const projectListCommand = require('./commands/projectList');

// Import services
const WeeklyDigestService = require('../services/weeklyDigest');
const SlackService = require('../services/slackService');

class SlackApp {
  constructor() {
    this.app = new App({
      token: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      socketMode: true,
      appToken: process.env.SLACK_APP_TOKEN,
      port: process.env.PORT || 3000
    });

    this.weeklyDigest = new WeeklyDigestService(this.app.client);
    this.slackService = new SlackService(this.app.client);
    this.setupCommands();
    this.setupEventHandlers();
    this.setupInteractions();
  }

  setupCommands() {
    // Register slash commands with slackService context
    this.app.command('/project-new', (args) => projectNewCommand.command({ ...args, slackService: this.slackService }));
    this.app.command('/project-update', projectUpdateCommand.command);
    this.app.command('/project-list', projectListCommand.command);

    logger.info('Slack commands registered');
  }

  setupEventHandlers() {
    // Handle app mentions
    this.app.event('app_mention', async ({ event, client, say }) => {
      try {
        const helpText = `👋 Hi there! I'm your project management assistant. Here's what I can help you with:

*Available Commands:*
• \`/project-new\` - Create a new project
• \`/project-update\` - Add an update to an existing project
• \`/project-list\` - View all projects and their status

*Features:*
• 🤖 AI-powered project analysis
• 📊 Weekly automated digests
• ⏰ Deadline tracking
• 📈 Project statistics

Just use any of the commands above to get started!`;

        await say({
          text: helpText,
          thread_ts: event.ts
        });

        logger.info('App mention handled', { userId: event.user });
      } catch (error) {
        logger.error('Error handling app mention:', error);
      }
    });

    // Handle direct messages
    this.app.message(async ({ message, client, say }) => {
      // Only respond to direct messages (not in channels)
      if (message.channel_type === 'im' && !message.bot_id) {
        try {
          const helpText = `👋 Hello! I'm your project management bot. 

Use these commands to manage your projects:
• \`/project-new\` - Create a new project
• \`/project-update\` - Update a project
• \`/project-list\` - View all projects

You can use these commands in any channel or here in our DM!`;

          await say(helpText);

          logger.info('Direct message handled', { userId: message.user });
        } catch (error) {
          logger.error('Error handling direct message:', error);
        }
      }
    });

    logger.info('Slack event handlers registered');
  }

  setupInteractions() {
    // Handle modal submissions
    this.app.view('project_new_modal', (args) => projectNewCommand.handleSubmission({ ...args, slackService: this.slackService }));
    this.app.view('project_update_modal', projectUpdateCommand.handleSubmission);

    // Handle button interactions
    this.app.action('view_project_details', projectListCommand.handleViewProjectDetails);
    this.app.action('view_project_stats', projectListCommand.handleViewProjectStats);

    // Handle digest-related button interactions
    this.app.action('view_all_projects_digest', async ({ ack, body, client }) => {
      await ack();
      
      // Trigger the project list command programmatically
      await projectListCommand.command({
        command: { channel_id: body.channel.id, user_id: body.user.id },
        ack: async () => {},
        client,
        body: { user_id: body.user.id }
      });
    });

    this.app.action('create_new_project', async ({ ack, body, client }) => {
      await ack();
      
      try {
        await client.chat.postEphemeral({
          channel: body.channel.id,
          user: body.user.id,
          text: "To create a new project, use the `/project-new` command in any channel!"
        });
      } catch (error) {
        logger.error('Error handling create new project button:', error);
      }
    });

    this.app.action('create_new_project_digest', async ({ ack, body, client }) => {
      await ack();
      
      try {
        await client.chat.postEphemeral({
          channel: body.channel.id,
          user: body.user.id,
          text: "To create a new project, use the `/project-new` command!"
        });
      } catch (error) {
        logger.error('Error handling create new project digest button:', error);
      }
    });

    // Handle errors in interactions
    this.app.error(async (error) => {
      logger.error('Slack app error:', error);
    });

    logger.info('Slack interactions registered');
  }

  async start() {
    try {
      await this.app.start();
      
      // Start the weekly digest scheduler
      this.weeklyDigest.scheduleWeeklyDigest();
      
      logger.info(`⚡️ Slack bot is running on port ${process.env.PORT || 3000}`);
      
      return this.app;
    } catch (error) {
      logger.error('Failed to start Slack app:', error);
      throw error;
    }
  }

  async stop() {
    try {
      await this.app.stop();
      this.weeklyDigest.stopScheduledDigest();
      logger.info('Slack app stopped');
    } catch (error) {
      logger.error('Error stopping Slack app:', error);
      throw error;
    }
  }

  // Get app status
  getStatus() {
    return {
      isRunning: true,
      weeklyDigest: this.weeklyDigest.getDigestStatus(),
      port: process.env.PORT || 3000
    };
  }

  // Manual trigger for weekly digest (for testing)
  async triggerWeeklyDigest() {
    return await this.weeklyDigest.generateAndSendDigest();
  }
}

module.exports = SlackApp; 