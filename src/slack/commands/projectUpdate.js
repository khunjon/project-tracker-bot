const projectService = require('../../services/projectService');
const userService = require('../../services/userService');
const logger = require('../../config/logger');

const projectUpdateCommand = async ({ command, ack, client, body }) => {
  await ack();

  try {
    // Get all active projects for the dropdown
    const projects = await projectService.getAllProjects();
    
    if (projects.length === 0) {
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: "📝 No projects found. Create a project first using `/project-new`."
      });
      return;
    }

    const projectOptions = projects.map(project => ({
      text: {
        type: "plain_text",
        text: `${project.name} (${project.clientName})`
      },
      value: project.id
    }));

    const modal = {
      type: "modal",
      callback_id: "project_update_modal",
      title: {
        type: "plain_text",
        text: "Update Project"
      },
      submit: {
        type: "plain_text",
        text: "Add Update"
      },
      close: {
        type: "plain_text",
        text: "Cancel"
      },
      blocks: [
        {
          type: "input",
          block_id: "project_select",
          element: {
            type: "static_select",
            action_id: "project_dropdown",
            placeholder: {
              type: "plain_text",
              text: "Select a project to update"
            },
            options: projectOptions
          },
          label: {
            type: "plain_text",
            text: "Project"
          }
        },
        {
          type: "input",
          block_id: "update_content",
          element: {
            type: "plain_text_input",
            action_id: "content_input",
            multiline: true,
            placeholder: {
              type: "plain_text",
              text: "Describe the progress, challenges, or any updates for this project..."
            },
            max_length: 1000
          },
          label: {
            type: "plain_text",
            text: "Update Details"
          }
        },
        {
          type: "input",
          block_id: "status_update",
          element: {
            type: "static_select",
            action_id: "status_select",
            placeholder: {
              type: "plain_text",
              text: "Update project status (optional)"
            },
            options: [
              {
                text: {
                  type: "plain_text",
                  text: "Keep current status"
                },
                value: "no_change"
              },
              {
                text: {
                  type: "plain_text",
                  text: "Planning"
                },
                value: "PLANNING"
              },
              {
                text: {
                  type: "plain_text",
                  text: "In Progress"
                },
                value: "IN_PROGRESS"
              },
              {
                text: {
                  type: "plain_text",
                  text: "On Hold"
                },
                value: "ON_HOLD"
              },
              {
                text: {
                  type: "plain_text",
                  text: "Completed"
                },
                value: "COMPLETED"
              },
              {
                text: {
                  type: "plain_text",
                  text: "Cancelled"
                },
                value: "CANCELLED"
              }
            ],
            initial_option: {
              text: {
                type: "plain_text",
                text: "Keep current status"
              },
              value: "no_change"
            }
          },
          label: {
            type: "plain_text",
            text: "Status Change"
          },
          optional: true
        }
      ]
    };

    await client.views.open({
      trigger_id: body.trigger_id,
      view: modal
    });

    logger.info('Project update modal opened', { userId: body.user_id });

  } catch (error) {
    logger.error('Error opening project update modal:', error);
    
    await client.chat.postEphemeral({
      channel: command.channel_id,
      user: command.user_id,
      text: "❌ Sorry, there was an error opening the project update form. Please try again."
    });
  }
};

const handleProjectUpdateSubmission = async ({ ack, body, view, client }) => {
  await ack();

  try {
    const values = view.state.values;
    
    // Extract form data
    const projectId = values.project_select.project_dropdown.selected_option.value;
    const updateContent = values.update_content.content_input.value;
    const newStatus = values.status_update?.status_select?.selected_option?.value;

    // Ensure user exists in database
    const user = await userService.findOrCreateUser(body.user.id, {
      name: body.user.name || body.user.username
    });

    // Get the project to check current status
    const project = await projectService.getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Add the project update with AI analysis
    const update = await projectService.addProjectUpdate(
      projectId, 
      user.id, 
      updateContent
    );

    // Update project status if changed
    let updatedProject = project;
    if (newStatus && newStatus !== 'no_change' && newStatus !== project.status) {
      updatedProject = await projectService.updateProject(projectId, {
        status: newStatus
      });
    }

    // Format the response message
    const responseBlocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `✅ *Update added to "${project.name}"*`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Your Update:*\n${updateContent}`
        }
      }
    ];

    // Add status change notification if applicable
    if (newStatus && newStatus !== 'no_change' && newStatus !== project.status) {
      responseBlocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Status Updated:* ${project.status.replace('_', ' ')} → ${newStatus.replace('_', ' ')}`
        }
      });
    }

    // Add AI analysis if available
    if (update.aiAnalysis && update.aiAnalysis !== "Unable to generate AI analysis at this time.") {
      responseBlocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🤖 AI Analysis:*\n${update.aiAnalysis}`
        }
      });

      // Add risks if identified
      if (update.risksIdentified && update.risksIdentified.length > 0) {
        responseBlocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*⚠️ Risks Identified:*\n${update.risksIdentified.map(risk => `• ${risk}`).join('\n')}`
          }
        });
      }

      // Add opportunities if noted
      if (update.opportunitiesNoted && update.opportunitiesNoted.length > 0) {
        responseBlocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*💡 Opportunities:*\n${update.opportunitiesNoted.map(opp => `• ${opp}`).join('\n')}`
          }
        });
      }
    }

    // Send confirmation message as DM
    await client.chat.postMessage({
      channel: body.user.id,
      blocks: responseBlocks
    });

    // Also post a summary to the channel where the command was used (if not a DM)
    if (body.view.root_view_id) {
      const channelId = body.view.private_metadata || command.channel_id;
      
      if (channelId && channelId !== body.user.id) {
        await client.chat.postMessage({
          channel: channelId,
          text: `📝 ${body.user.name || 'Someone'} added an update to *${project.name}*`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `📝 *${body.user.name || 'Someone'}* added an update to *${project.name}* (${project.clientName})`
              }
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Update:* ${updateContent.length > 150 ? updateContent.substring(0, 150) + '...' : updateContent}`
              }
            }
          ]
        });
      }
    }

    logger.info('Project update added successfully', { 
      projectId, 
      updateId: update.id,
      userId: user.id,
      statusChanged: newStatus && newStatus !== 'no_change' && newStatus !== project.status
    });

  } catch (error) {
    logger.error('Error adding project update:', error);
    
    // Send error message to user
    await client.chat.postMessage({
      channel: body.user.id,
      text: `❌ Error adding project update: ${error.message}`
    });
  }
};

module.exports = {
  command: projectUpdateCommand,
  handleSubmission: handleProjectUpdateSubmission
}; 