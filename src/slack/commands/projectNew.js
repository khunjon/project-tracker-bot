const projectService = require('../../services/projectService');
const userService = require('../../services/userService');
const logger = require('../../config/logger');

const projectNewCommand = async ({ command, ack, client, body }) => {
  await ack();

  try {
    // Get all users for assignee dropdown
    const users = await userService.getAllUsers();
    
    const userOptions = users.map(user => ({
      text: {
        type: "plain_text",
        text: user.name
      },
      value: user.id
    }));

    // Add "Unassigned" option
    userOptions.unshift({
      text: {
        type: "plain_text",
        text: "Unassigned"
      },
      value: "unassigned"
    });

    const modal = {
      type: "modal",
      callback_id: "project_new_modal",
      title: {
        type: "plain_text",
        text: "Create New Project"
      },
      submit: {
        type: "plain_text",
        text: "Create Project"
      },
      close: {
        type: "plain_text",
        text: "Cancel"
      },
      blocks: [
        {
          type: "input",
          block_id: "project_name",
          element: {
            type: "plain_text_input",
            action_id: "name_input",
            placeholder: {
              type: "plain_text",
              text: "Enter project name"
            },
            max_length: 100
          },
          label: {
            type: "plain_text",
            text: "Project Name"
          }
        },
        {
          type: "input",
          block_id: "client_name",
          element: {
            type: "plain_text_input",
            action_id: "client_input",
            placeholder: {
              type: "plain_text",
              text: "Enter client name"
            },
            max_length: 100
          },
          label: {
            type: "plain_text",
            text: "Client Name"
          }
        },
        {
          type: "input",
          block_id: "project_description",
          element: {
            type: "plain_text_input",
            action_id: "description_input",
            multiline: true,
            placeholder: {
              type: "plain_text",
              text: "Enter project description (optional)"
            },
            max_length: 500
          },
          label: {
            type: "plain_text",
            text: "Description"
          },
          optional: true
        },
        {
          type: "input",
          block_id: "project_status",
          element: {
            type: "static_select",
            action_id: "status_select",
            placeholder: {
              type: "plain_text",
              text: "Select project status"
            },
            options: [
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
              }
            ],
            initial_option: {
              text: {
                type: "plain_text",
                text: "Planning"
              },
              value: "PLANNING"
            }
          },
          label: {
            type: "plain_text",
            text: "Status"
          }
        },
        {
          type: "input",
          block_id: "assigned_to",
          element: {
            type: "static_select",
            action_id: "assignee_select",
            placeholder: {
              type: "plain_text",
              text: "Select assignee"
            },
            options: userOptions
          },
          label: {
            type: "plain_text",
            text: "Assigned To"
          },
          optional: true
        },
        {
          type: "input",
          block_id: "project_deadline",
          element: {
            type: "datepicker",
            action_id: "deadline_picker",
            placeholder: {
              type: "plain_text",
              text: "Select deadline"
            }
          },
          label: {
            type: "plain_text",
            text: "Deadline"
          },
          optional: true
        }
      ]
    };

    await client.views.open({
      trigger_id: body.trigger_id,
      view: modal
    });

    logger.info('Project creation modal opened', { userId: body.user_id });

  } catch (error) {
    logger.error('Error opening project creation modal:', error);
    
    await client.chat.postEphemeral({
      channel: command.channel_id,
      user: command.user_id,
      text: "❌ Sorry, there was an error opening the project creation form. Please try again."
    });
  }
};

const handleProjectNewSubmission = async ({ ack, body, view, client }) => {
  await ack();

  try {
    const values = view.state.values;
    
    // Extract form data
    const projectData = {
      name: values.project_name.name_input.value,
      clientName: values.client_name.client_input.value,
      description: values.project_description?.description_input?.value || null,
      status: values.project_status.status_select.selected_option.value,
      assignedTo: values.assigned_to?.assignee_select?.selected_option?.value === 'unassigned' 
        ? null 
        : values.assigned_to?.assignee_select?.selected_option?.value,
      deadline: values.project_deadline?.deadline_picker?.selected_date || null
    };

    // Ensure user exists in database
    const user = await userService.findOrCreateUser(body.user.id, {
      name: body.user.name || body.user.username
    });

    // Create the project
    const project = await projectService.createProject(projectData, body.user.id);

    // Format deadline for display
    const deadlineText = project.deadline 
      ? new Date(project.deadline).toLocaleDateString()
      : 'No deadline set';

    // Format assignee for display
    const assigneeText = project.assignee 
      ? project.assignee.name 
      : 'Unassigned';

    // Send confirmation message
    const confirmationBlocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `✅ *Project "${project.name}" created successfully!*`
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Client:*\n${project.clientName}`
          },
          {
            type: "mrkdwn",
            text: `*Status:*\n${project.status.replace('_', ' ')}`
          },
          {
            type: "mrkdwn",
            text: `*Assigned To:*\n${assigneeText}`
          },
          {
            type: "mrkdwn",
            text: `*Deadline:*\n${deadlineText}`
          }
        ]
      }
    ];

    if (project.description) {
      confirmationBlocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Description:*\n${project.description}`
        }
      });
    }

    await client.chat.postMessage({
      channel: body.user.id, // Send as DM
      blocks: confirmationBlocks
    });

    logger.info('Project created successfully', { 
      projectId: project.id, 
      createdBy: body.user.id 
    });

  } catch (error) {
    logger.error('Error creating project:', error);
    
    // Send error message to user
    await client.chat.postMessage({
      channel: body.user.id,
      text: `❌ Error creating project: ${error.message}`
    });
  }
};

module.exports = {
  command: projectNewCommand,
  handleSubmission: handleProjectNewSubmission
}; 