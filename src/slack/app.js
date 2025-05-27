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
    this.app.command('/project-update', (args) => projectUpdateCommand.command({ ...args, slackService: this.slackService }));
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
          const messageText = message.text.toLowerCase().trim();
          
          // Handle different types of messages
          if (messageText.includes('help') || messageText === 'hi' || messageText === 'hello' || messageText === 'hey') {
            const helpBlocks = [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `👋 Hello! I'm your project management assistant. Here's what I can help you with:`
                }
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*Available Commands:*\n• \`/project-new\` - Create a new project\n• \`/project-update\` - Add an update to an existing project\n• \`/project-list\` - View all projects and their status`
                }
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*Quick Actions:*\nYou can also type simple messages like:\n• "show projects" or "list projects"\n• "create project"\n• "project status"\n• "help"`
                }
              },
              {
                type: "actions",
                elements: [
                  {
                    type: "button",
                    text: {
                      type: "plain_text",
                      text: "📋 View Projects"
                    },
                    action_id: "dm_view_projects",
                    style: "primary"
                  },
                  {
                    type: "button",
                    text: {
                      type: "plain_text",
                      text: "➕ Create Project"
                    },
                    action_id: "dm_create_project"
                  }
                ]
              }
            ];

            await say({ blocks: helpBlocks });
          } else if (messageText.includes('project') && (messageText.includes('list') || messageText.includes('show') || messageText.includes('view'))) {
            // Trigger project list
            await projectListCommand.command({
              command: { channel_id: message.channel, user_id: message.user },
              ack: async () => {},
              respond: async (response) => {
                await say(response);
              },
              client,
              body: { user_id: message.user }
            });
          } else if (messageText.includes('create') && messageText.includes('project')) {
            await say({
              text: "To create a new project, use the `/project-new` command, or click the button below:",
              blocks: [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: "To create a new project, use the `/project-new` command, or click the button below:"
                  }
                },
                {
                  type: "actions",
                  elements: [
                    {
                      type: "button",
                      text: {
                        type: "plain_text",
                        text: "➕ Create Project"
                      },
                      action_id: "dm_create_project",
                      style: "primary"
                    }
                  ]
                }
              ]
            });
          } else if (messageText.includes('status') || messageText.includes('update')) {
            await say({
              text: "To update a project or check status, use the `/project-update` or `/project-list` commands:",
              blocks: [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: "To update a project or check status, use these commands:"
                  }
                },
                {
                  type: "actions",
                  elements: [
                    {
                      type: "button",
                      text: {
                        type: "plain_text",
                        text: "📋 View Projects"
                      },
                      action_id: "dm_view_projects"
                    },
                    {
                      type: "button",
                      text: {
                        type: "plain_text",
                        text: "📝 Update Project"
                      },
                      action_id: "dm_update_project"
                    }
                  ]
                }
              ]
            });
          } else {
            // Default response for unrecognized messages
            await say({
              text: `I didn't quite understand that. Type "help" to see what I can do, or use one of these commands:`,
              blocks: [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: `I didn't quite understand that. Type "help" to see what I can do, or use one of these commands:`
                  }
                },
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: `• \`/project-new\` - Create a new project\n• \`/project-update\` - Update a project\n• \`/project-list\` - View all projects`
                  }
                }
              ]
            });
          }

          logger.info('Direct message handled', { userId: message.user, messageText });
        } catch (error) {
          logger.error('Error handling direct message:', error);
          await say("Sorry, I encountered an error. Please try again or use the slash commands.");
        }
      }
    });

    logger.info('Slack event handlers registered');
  }

  setupInteractions() {
    // Handle modal submissions
    this.app.view('project_new_modal', (args) => projectNewCommand.handleSubmission({ ...args, slackService: this.slackService }));
    this.app.view('project_update_modal', (args) => projectUpdateCommand.handleSubmission({ ...args, slackService: this.slackService }));

    // Handle dropdown interactions
    this.app.action('client_filter_dropdown', projectUpdateCommand.handleClientFilterSelection);

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

    // Handle DM button interactions
    this.app.action('dm_view_projects', async ({ ack, body, client, say }) => {
      await ack();
      
      try {
        // Trigger project list command in DM
        await projectListCommand.command({
          command: { channel_id: body.channel.id, user_id: body.user.id },
          ack: async () => {},
          respond: async (response) => {
            await say(response);
          },
          client,
          body: { user_id: body.user.id }
        });
      } catch (error) {
        logger.error('Error handling DM view projects button:', error);
        await say("Sorry, there was an error retrieving the project list. Please try the `/project-list` command.");
      }
    });

    this.app.action('dm_create_project', async ({ ack, body, client, say }) => {
      await ack();
      
      try {
        await say("To create a new project, please use the `/project-new` command. This will open an interactive form where you can enter all the project details.");
      } catch (error) {
        logger.error('Error handling DM create project button:', error);
      }
    });

    this.app.action('dm_update_project', async ({ ack, body, client, say }) => {
      await ack();
      
      try {
        await say("To update a project, please use the `/project-update` command. This will show you a list of projects to choose from and let you add updates.");
      } catch (error) {
        logger.error('Error handling DM update project button:', error);
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