const cron = require('node-cron');
const projectService = require('./projectService');
const openaiService = require('./openai');
const logger = require('../config/logger');

class WeeklyDigestService {
  constructor(slackClient) {
    this.client = slackClient;
    this.isScheduled = false;
    this.cronTask = null;
  }

  // Schedule weekly digest to run every Monday at 9 AM
  scheduleWeeklyDigest() {
    if (this.isScheduled) {
      logger.warn('Weekly digest already scheduled');
      return;
    }

    // Run every Monday at 9:00 AM (0 9 * * 1)
    this.cronTask = cron.schedule('0 9 * * 1', async () => {
      await this.generateAndSendDigest();
    }, {
      scheduled: true,
      timezone: "America/New_York" // Adjust timezone as needed
    });

    this.isScheduled = true;
    logger.info('Weekly digest scheduled for Mondays at 9:00 AM');
  }

  // Manual trigger for testing
  async generateAndSendDigest() {
    try {
      logger.info('Starting weekly digest generation');

      // Get all active projects
      const activeProjects = await projectService.getActiveProjects();
      
      // Get recent updates from the last 7 days
      const recentUpdates = await projectService.getRecentUpdates(7, 20);
      
      // Get project statistics
      const stats = await projectService.getProjectStats();

      // Generate AI-powered digest
      const aiDigest = await openaiService.generateWeeklyDigest(activeProjects, recentUpdates);

      // Create the digest message blocks
      const digestBlocks = await this.createDigestBlocks(stats, activeProjects, recentUpdates, aiDigest);

      // Send to general channel
      const generalChannelId = process.env.GENERAL_CHANNEL_ID;
      
      if (!generalChannelId) {
        logger.error('GENERAL_CHANNEL_ID not configured');
        return;
      }

      await this.client.chat.postMessage({
        channel: generalChannelId,
        text: "📊 Weekly Project Digest",
        blocks: digestBlocks
      });

      logger.info('Weekly digest sent successfully', {
        activeProjects: activeProjects.length,
        recentUpdates: recentUpdates.length,
        channelId: generalChannelId
      });

    } catch (error) {
      logger.error('Error generating weekly digest:', error);
      
      // Send a fallback message if the digest fails
      try {
        const fallbackMessage = "📊 **Weekly Project Digest**\n\n" +
                               "Sorry, there was an issue generating the automated digest. " +
                               "Please use `/project-list` to view current project status.";

        await this.client.chat.postMessage({
          channel: process.env.GENERAL_CHANNEL_ID,
          text: fallbackMessage
        });
      } catch (fallbackError) {
        logger.error('Error sending fallback digest message:', fallbackError);
      }
    }
  }

  async createDigestBlocks(stats, activeProjects, recentUpdates, aiDigest) {
    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "📊 *Weekly Project Digest*"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Portfolio Overview:* ${stats.total} total projects | ${stats.active} active | ${stats.byStatus.completed} completed`
        }
      },
      {
        type: "divider"
      }
    ];

    // Add AI-generated digest
    if (aiDigest) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🤖 AI Summary:*\n${aiDigest}`
        }
      });
      
      blocks.push({
        type: "divider"
      });
    }

    // Add active projects summary
    if (activeProjects.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🚀 Active Projects (${activeProjects.length}):*`
        }
      });

      // Group by status
      const planning = activeProjects.filter(p => p.status === 'PLANNING');
      const inProgress = activeProjects.filter(p => p.status === 'IN_PROGRESS');

      if (planning.length > 0) {
        const planningText = planning.map(p => 
          `• ${p.name} (${p.clientName})${p.assignee ? ` - ${p.assignee.name}` : ''}`
        ).join('\n');
        
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*📝 Planning (${planning.length}):*\n${planningText}`
          }
        });
      }

      if (inProgress.length > 0) {
        const inProgressText = inProgress.map(p => 
          `• ${p.name} (${p.clientName})${p.assignee ? ` - ${p.assignee.name}` : ''}`
        ).join('\n');
        
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*🚀 In Progress (${inProgress.length}):*\n${inProgressText}`
          }
        });
      }

      blocks.push({
        type: "divider"
      });
    }

    // Add recent activity
    if (recentUpdates.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*📝 Recent Activity (Last 7 days):*`
        }
      });

      // Show top 5 most recent updates
      const topUpdates = recentUpdates.slice(0, 5);
      
      topUpdates.forEach(update => {
        const updateDate = new Date(update.createdAt).toLocaleDateString();
        const shortContent = update.content.length > 100 
          ? update.content.substring(0, 100) + '...' 
          : update.content;

        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${update.project.name}* - ${updateDate}\n${update.user.name}: ${shortContent}`
          }
        });
      });

      if (recentUpdates.length > 5) {
        blocks.push({
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `_... and ${recentUpdates.length - 5} more updates_`
            }
          ]
        });
      }

      blocks.push({
        type: "divider"
      });
    }

    // Add upcoming deadlines
    const upcomingDeadlines = await this.getUpcomingDeadlines(activeProjects);
    
    if (upcomingDeadlines.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*⏰ Upcoming Deadlines:*"
        }
      });

      upcomingDeadlines.forEach(project => {
        const deadlineDate = new Date(project.deadline).toLocaleDateString();
        const daysUntil = Math.ceil((new Date(project.deadline) - new Date()) / (1000 * 60 * 60 * 24));
        
        let urgencyEmoji = "📅";
        if (daysUntil <= 3) urgencyEmoji = "🚨";
        else if (daysUntil <= 7) urgencyEmoji = "⚠️";

        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${urgencyEmoji} *${project.name}* (${project.clientName}) - ${deadlineDate} (${daysUntil} days)`
          }
        });
      });

      blocks.push({
        type: "divider"
      });
    }

    // Add action buttons
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "📋 View All Projects"
          },
          action_id: "view_all_projects_digest"
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "➕ New Project"
          },
          action_id: "create_new_project_digest"
        }
      ]
    });

    return blocks;
  }

  async getUpcomingDeadlines(projects, days = 14) {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + days);

    return projects
      .filter(project => 
        project.deadline && 
        new Date(project.deadline) >= now && 
        new Date(project.deadline) <= futureDate
      )
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  }

  // Stop the scheduled digest
  stopScheduledDigest() {
    try {
      if (this.cronTask) {
        // Only call stop if it exists
        if (typeof this.cronTask.stop === 'function') {
          this.cronTask.stop();
        }
        this.cronTask = null;
        logger.info('✅ Weekly digest cron task stopped');
      }
      this.isScheduled = false;
      logger.info('✅ Weekly digest scheduling stopped');
    } catch (error) {
      logger.error('Error stopping cron task:', error);
      // Force cleanup even if there's an error
      this.cronTask = null;
      this.isScheduled = false;
    }
  }

  // Get digest status
  getDigestStatus() {
    return {
      isScheduled: this.isScheduled,
      nextRun: this.isScheduled ? 'Next Monday at 9:00 AM' : 'Not scheduled'
    };
  }
}

module.exports = WeeklyDigestService; 