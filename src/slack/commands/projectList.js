const projectService = require('../../services/projectService');
const openaiService = require('../../services/openai');
const logger = require('../../config/logger');

const projectListCommand = async ({ command, ack, respond, client, body }) => {
  await ack();

  try {
    // Get all projects
    const projects = await projectService.getAllProjects();
    
    if (projects.length === 0) {
      await respond({
        text: "📋 No projects found. Create your first project using `/project-new`.",
        response_type: "ephemeral"
      });
      return;
    }

    // Get project statistics
    const stats = await projectService.getProjectStats();

    // Create the header block
    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `📋 *Project Portfolio Overview*\n\n*Total Projects:* ${stats.total} | *Active:* ${stats.active} | *Completed:* ${stats.byStatus.completed}`
        }
      },
      {
        type: "divider"
      }
    ];

    // Group projects by status
    const projectsByStatus = {
      'PLANNING': [],
      'IN_PROGRESS': [],
      'ON_HOLD': [],
      'COMPLETED': [],
      'CANCELLED': []
    };

    projects.forEach(project => {
      projectsByStatus[project.status].push(project);
    });

    // Add sections for each status with projects
    const statusEmojis = {
      'PLANNING': '📝',
      'IN_PROGRESS': '🚀',
      'ON_HOLD': '⏸️',
      'COMPLETED': '✅',
      'CANCELLED': '❌'
    };

    const statusLabels = {
      'PLANNING': 'Planning',
      'IN_PROGRESS': 'In Progress',
      'ON_HOLD': 'On Hold',
      'COMPLETED': 'Completed',
      'CANCELLED': 'Cancelled'
    };

    Object.entries(projectsByStatus).forEach(([status, statusProjects]) => {
      if (statusProjects.length > 0) {
        // Add status header
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${statusEmojis[status]} *${statusLabels[status]} (${statusProjects.length})*`
          }
        });

        // Add each project in this status
        statusProjects.forEach(project => {
          const assigneeText = project.assignee ? project.assignee.name : 'No Project Lead';
          const deadlineText = project.deadline 
            ? new Date(project.deadline).toLocaleDateString()
            : 'No deadline';
          
          const lastUpdateText = project.updates && project.updates.length > 0
            ? `Last update: ${new Date(project.updates[0].createdAt).toLocaleDateString()}`
            : 'No updates yet';

          const projectText = `*${project.name}* (${project.clientName})\n` +
                             `👤 ${assigneeText} | 📅 ${deadlineText}\n` +
                             `${lastUpdateText}`;

          blocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: projectText
            },
            accessory: {
              type: "button",
              text: {
                type: "plain_text",
                text: "View Details"
              },
              action_id: "view_project_details",
              value: project.id
            }
          });

          // Add description if available
          if (project.description) {
            blocks.push({
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `_${project.description.length > 100 ? project.description.substring(0, 100) + '...' : project.description}_`
                }
              ]
            });
          }
        });

        // Add spacing between status groups
        blocks.push({
          type: "divider"
        });
      }
    });

    // Remove the last divider if it exists
    if (blocks[blocks.length - 1].type === "divider") {
      blocks.pop();
    }

    // Add footer with action buttons
    blocks.push(
      {
        type: "divider"
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "📊 View Statistics"
            },
            action_id: "view_project_stats",
            style: "primary"
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "➕ New Project"
            },
            action_id: "create_new_project"
          }
        ]
      }
    );

    // Send the message
    await respond({
      text: "📋 Project Portfolio Overview",
      blocks: blocks,
      response_type: "ephemeral"
    });

    logger.info('Project list displayed', { 
      userId: command.user_id, 
      projectCount: projects.length 
    });

  } catch (error) {
    logger.error('Error displaying project list:', error);
    
    await respond({
      text: "❌ Sorry, there was an error retrieving the project list. Please try again.",
      response_type: "ephemeral"
    });
  }
};

// Handle button interactions for project details
const handleViewProjectDetails = async ({ ack, body, client }) => {
  await ack();

  try {
    const projectId = body.actions[0].value;
    const project = await projectService.getProject(projectId);

    if (!project) {
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: body.user.id,
        text: "❌ Project not found."
      });
      return;
    }

    // Generate AI summary for this specific project
    const aiSummary = await openaiService.generateProjectDetailSummary(project);

    // Format project details
    const assigneeText = project.assignee ? project.assignee.name : 'No Project Lead';
    const deadlineText = project.deadline 
      ? new Date(project.deadline).toLocaleDateString()
      : 'No deadline set';
    
    const createdDate = new Date(project.createdAt).toLocaleDateString();
    const updatedDate = new Date(project.updatedAt).toLocaleDateString();

    const detailBlocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `📋 *${project.name}*\n*Client:* ${project.clientName}`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🤖 *AI Project Summary:*\n_${aiSummary}_`
        }
      },
      {
        type: "divider"
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Status:*\n${project.status.replace('_', ' ')}`
          },
          {
            type: "mrkdwn",
            text: `*Project Lead:*\n${assigneeText}`
          },
          {
            type: "mrkdwn",
            text: `*Deadline:*\n${deadlineText}`
          },
          {
            type: "mrkdwn",
            text: `*Created:*\n${createdDate}`
          }
        ]
      }
    ];

    // Add description if available
    if (project.description) {
      detailBlocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Description:*\n${project.description}`
        }
      });
    }

    // Add recent updates
    if (project.updates && project.updates.length > 0) {
      detailBlocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Recent Updates (${project.updates.length}):`
        }
      });

      project.updates.slice(0, 3).forEach(update => {
        const updateDate = new Date(update.createdAt).toLocaleDateString();
        detailBlocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${update.user.name}* - ${updateDate}\n${update.content}`
          }
        });

        // Add AI analysis if available
        if (update.aiAnalysis && update.aiAnalysis !== "Unable to generate AI analysis at this time.") {
          detailBlocks.push({
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `🤖 _${update.aiAnalysis}_`
              }
            ]
          });
        }
      });
    } else {
      detailBlocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Recent Updates:*\nNo updates yet"
        }
      });
    }

    await client.chat.postEphemeral({
      channel: body.channel.id,
      user: body.user.id,
      text: `📋 ${project.name} - Project Details`,
      blocks: detailBlocks
    });

    logger.info('Project details viewed', { projectId, userId: body.user.id });

  } catch (error) {
    logger.error('Error showing project details:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel.id,
      user: body.user.id,
      text: "❌ Error loading project details."
    });
  }
};

// Handle statistics view
const handleViewProjectStats = async ({ ack, body, client }) => {
  await ack();

  try {
    const stats = await projectService.getProjectStats();
    const recentUpdates = await projectService.getRecentUpdates(7, 5);

    const statsBlocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "📊 *Project Portfolio Statistics*"
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Total Projects:*\n${stats.total}`
          },
          {
            type: "mrkdwn",
            text: `*Active Projects:*\n${stats.active}`
          },
          {
            type: "mrkdwn",
            text: `*Planning:*\n${stats.byStatus.planning}`
          },
          {
            type: "mrkdwn",
            text: `*In Progress:*\n${stats.byStatus.inProgress}`
          },
          {
            type: "mrkdwn",
            text: `*On Hold:*\n${stats.byStatus.onHold}`
          },
          {
            type: "mrkdwn",
            text: `*Completed:*\n${stats.byStatus.completed}`
          }
        ]
      }
    ];

    if (recentUpdates.length > 0) {
      statsBlocks.push(
        {
          type: "divider"
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Recent Activity (Last 7 days):*`
          }
        }
      );

      recentUpdates.forEach(update => {
        const updateDate = new Date(update.createdAt).toLocaleDateString();
        statsBlocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${update.project.name}* - ${updateDate}\n${update.user.name}: ${update.content.substring(0, 100)}${update.content.length > 100 ? '...' : ''}`
          }
        });
      });
    }

    await client.chat.postEphemeral({
      channel: body.channel.id,
      user: body.user.id,
      text: "📊 Project Portfolio Statistics",
      blocks: statsBlocks
    });

    logger.info('Project statistics viewed', { userId: body.user.id });

  } catch (error) {
    logger.error('Error showing project statistics:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel.id,
      user: body.user.id,
      text: "❌ Error loading project statistics."
    });
  }
};

module.exports = {
  command: projectListCommand,
  handleViewProjectDetails,
  handleViewProjectStats
}; 