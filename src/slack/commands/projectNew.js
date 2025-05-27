const projectService = require('../../services/projectService');
const userService = require('../../services/userService');
const logger = require('../../config/logger');

const projectNewCommand = async ({ command, ack, respond, client, body, slackService }) => {
  const startTime = Date.now();
  await ack();

  try {
    logger.info('Project new command started', { userId: command.user_id, startTime });
    // Parse optional project name from command text
    const projectNameFromCommand = command.text ? command.text.trim() : '';
    
    // Get workspace users for project lead dropdown
    const workspaceUsers = await slackService.getWorkspaceUsers();
    
    // Get current user info to set as default project lead
    const currentUser = await slackService.getUserInfo(command.user_id);
    
    // Get client channels for client dropdown
    const clientChannels = await slackService.getClientChannels();
    
    logger.info('Client channels retrieved for project creation', { 
      count: clientChannels.length, 
      channels: clientChannels.map(c => c.displayName) 
    });
    
    // Create user options from workspace users
    const userOptions = workspaceUsers.map(user => ({
      text: {
        type: "plain_text",
        text: user.name
      },
      value: user.id
    }));

    // Add "No Project Lead" option
    userOptions.unshift({
      text: {
        type: "plain_text",
        text: "No Project Lead"
      },
      value: "unassigned"
    });

    // Create client options from client channels
    const clientOptions = clientChannels.map(client => ({
      text: {
        type: "plain_text",
        text: client.displayName
      },
      value: client.name
    }));

    // Add "Other" option for clients not in channels
    clientOptions.push({
      text: {
        type: "plain_text",
        text: "Other (enter manually)"
      },
      value: "other"
    });

    // Ensure we have at least one option
    if (clientOptions.length === 1) {
      // Only "Other" option exists, add a default message
      clientOptions.unshift({
        text: {
          type: "plain_text",
          text: "No client channels found - use Other"
        },
        value: "no_clients"
      });
    }

    // Find default project lead (current user)
    const defaultProjectLead = currentUser ? userOptions.find(option => option.value === currentUser.id) : null;

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
            max_length: 100,
            ...(projectNameFromCommand && { initial_value: projectNameFromCommand })
          },
          label: {
            type: "plain_text",
            text: "Project Name"
          }
        },
        {
          type: "input",
          block_id: "client_select",
          element: {
            type: "static_select",
            action_id: "client_dropdown",
            placeholder: {
              type: "plain_text",
              text: "Select a client"
            },
            options: clientOptions
          },
          label: {
            type: "plain_text",
            text: "Client"
          }
        },
        {
          type: "input",
          block_id: "client_name_other",
          element: {
            type: "plain_text_input",
            action_id: "client_other_input",
            placeholder: {
              type: "plain_text",
              text: "Enter client name"
            },
            max_length: 100
          },
          label: {
            type: "plain_text",
            text: "Client Name (if Other selected above)"
          },
          optional: true
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
              text: "Select project lead"
            },
            options: userOptions,
            ...(defaultProjectLead && { initial_option: defaultProjectLead })
          },
          label: {
            type: "plain_text",
            text: "Project Lead"
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

    const responseTime = Date.now() - startTime;
    logger.info('Project creation modal opened', { 
      userId: body.user_id, 
      responseTime: `${responseTime}ms` 
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('Error opening project creation modal:', { 
      error: error.message, 
      responseTime: `${responseTime}ms` 
    });
    
    await respond({
      text: "❌ Sorry, there was an error opening the project creation form. Please try again.",
      response_type: "ephemeral"
    });
  }
};

const handleProjectNewSubmission = async ({ ack, body, view, client, slackService }) => {
  try {
    const values = view.state.values;
    
    // Extract form data
    const selectedClient = values.client_select.client_dropdown.selected_option.value;
    const clientName = (selectedClient === 'other' || selectedClient === 'no_clients')
      ? values.client_name_other?.client_other_input?.value 
      : selectedClient;

    // Validate client name
    if ((selectedClient === 'other' || selectedClient === 'no_clients') && (!clientName || clientName.trim() === '')) {
      // Return validation error
      await ack({
        response_action: 'errors',
        errors: {
          client_name_other: 'Please enter a client name'
        }
      });
      return;
    }

    // Acknowledge the submission after validation
    await ack();

    // Format client name for display
    const displayClientName = (selectedClient === 'other' || selectedClient === 'no_clients')
      ? clientName.trim()
      : clientName.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

    const projectData = {
      name: values.project_name.name_input.value,
      clientName: displayClientName,
      description: values.project_description?.description_input?.value || null,
      status: values.project_status.status_select.selected_option.value,
      assignedTo: values.assigned_to?.assignee_select?.selected_option?.value === 'unassigned' 
        ? null 
        : values.assigned_to?.assignee_select?.selected_option?.value,
      deadline: values.project_deadline?.deadline_picker?.selected_date || null
    };

    // Ensure creator exists in database
    const creator = await userService.findOrCreateUser(body.user.id, {
      name: body.user.name || body.user.username
    });

    // If someone is assigned as project lead, ensure they exist in database too
    let assigneeDbId = null;
    if (projectData.assignedTo && projectData.assignedTo !== 'unassigned') {
      // Get project lead info from Slack
      const assigneeInfo = await slackService.getUserInfo(projectData.assignedTo);
      if (assigneeInfo) {
        const assigneeUser = await userService.findOrCreateUser(projectData.assignedTo, {
          name: assigneeInfo.name,
          email: assigneeInfo.email
        });
        assigneeDbId = assigneeUser.id;
      }
    }

    // Update project data with database user ID
    const finalProjectData = {
      ...projectData,
      assignedTo: assigneeDbId
    };

    // Create the project
    const project = await projectService.createProject(finalProjectData, body.user.id);

    // Format deadline for display
    const deadlineText = project.deadline 
      ? new Date(project.deadline).toLocaleDateString()
      : 'No deadline set';

    // Format project lead for display
    const assigneeText = project.assignee 
      ? project.assignee.name 
      : 'No Project Lead';

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
            text: `*Project Lead:*\n${assigneeText}`
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
      text: `✅ Project "${project.name}" created successfully!`,
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