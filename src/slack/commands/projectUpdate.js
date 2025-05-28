const projectService = require('../../services/projectService');
const userService = require('../../services/userService');
const logger = require('../../config/logger');

const projectUpdateCommand = async ({ command, ack, respond, client, body, slackService }) => {
  await ack();

  try {
    logger.info('Project update command initiated', { 
      userId: command.user_id,
      channelId: command.channel_id,
      timestamp: new Date().toISOString()
    });

    // Open modal immediately with loading state to avoid expired trigger_id
    const loadingModal = {
      type: "modal",
      callback_id: "project_update_loading",
      title: {
        type: "plain_text",
        text: "Update Project"
      },
      close: {
        type: "plain_text",
        text: "Cancel"
      },
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "🔄 Loading projects and clients..."
          }
        }
      ]
    };

    const modalResult = await client.views.open({
      trigger_id: body.trigger_id,
      view: loadingModal
    });

    if (!modalResult.ok) {
      logger.error('Failed to open loading modal', { error: modalResult.error });
      await respond({
        text: "❌ Sorry, there was an error opening the project update form. Please try again.",
        response_type: "ephemeral"
      });
      return;
    }

    const viewId = modalResult.view.id;
    logger.info('Loading modal opened', { viewId, userId: command.user_id });

    // Now load data with retry logic
    let projects, uniqueClients, workspaceUsers;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        // Get all active projects for counting
        projects = await projectService.getAllProjects();
        
        if (projects.length === 0) {
          await client.views.update({
            view_id: viewId,
            view: {
              type: "modal",
              callback_id: "project_update_no_projects",
              title: {
                type: "plain_text",
                text: "Update Project"
              },
              close: {
                type: "plain_text",
                text: "Close"
              },
              blocks: [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: "📝 No projects found. Create a project first using `/project-new`."
                  }
                }
              ]
            }
          });
          return;
        }

        // Get unique clients from database (clients that actually have projects)
        uniqueClients = await projectService.getUniqueClients();
        
        // Get workspace users for project lead dropdown
        workspaceUsers = await slackService.getWorkspaceUsers();
        
        logger.info('Data retrieved successfully for project update', { 
          clientCount: uniqueClients.length, 
          clients: uniqueClients,
          userCount: workspaceUsers.length,
          projectCount: projects.length,
          retryCount
        });
        
        break; // Success, exit retry loop
        
      } catch (error) {
        retryCount++;
        logger.warn(`Retry ${retryCount}/${maxRetries} for project update data retrieval`, { 
          error: error.message,
          userId: command.user_id 
        });
        
        if (retryCount >= maxRetries) {
          // Show error in modal instead of closing it
          await client.views.update({
            view_id: viewId,
            view: {
              type: "modal",
              callback_id: "project_update_error",
              title: {
                type: "plain_text",
                text: "Update Project"
              },
              close: {
                type: "plain_text",
                text: "Close"
              },
              blocks: [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: "❌ Sorry, there was an error loading project data. This might be due to a cold start - please try the command again in a moment."
                  }
                }
              ]
            }
          });
          return;
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }

    // Create client options from database clients
    const clientOptions = uniqueClients.map(clientName => ({
      text: {
        type: "plain_text",
        text: clientName
      },
      value: clientName
    }));

    // Add "All Clients" option to show all projects
    clientOptions.unshift({
      text: {
        type: "plain_text",
        text: "All Clients"
      },
      value: "all_clients"
    });

    // If no clients found, add a message
    if (clientOptions.length === 1) {
      clientOptions.push({
        text: {
          type: "plain_text",
          text: "No clients found"
        },
        value: "no_clients"
      });
    }

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

    // Add "Keep current project lead" option
    userOptions.unshift({
      text: {
        type: "plain_text",
        text: "Keep current project lead"
      },
      value: "no_change"
    });

    // Create initial project options (all projects since "All Clients" is selected by default)
    const projectOptions = projects.map(project => ({
      text: {
        type: "plain_text",
        text: `${project.name} (${project.status.replace('_', ' ')})`
      },
      value: project.id
    }));

    const finalModal = {
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
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Client Filter*\nSelect a client to filter projects:"
          },
          accessory: {
            type: "static_select",
            action_id: "client_filter_dropdown",
            placeholder: {
              type: "plain_text",
              text: "Select a client to filter projects"
            },
            options: clientOptions,
            initial_option: clientOptions[0] // Default to "All Clients"
          }
        },
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
          block_id: "assigned_to",
          element: {
            type: "static_select",
            action_id: "assignee_select",
            placeholder: {
              type: "plain_text",
              text: "Select project lead"
            },
            options: userOptions,
            initial_option: userOptions[0] // Default to "Keep current project lead"
          },
          label: {
            type: "plain_text",
            text: "Project Lead"
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
              text: "Select project status"
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
            text: "Project Status"
          }
        }
      ]
    };

    // Log the modal structure for debugging
    logger.info('Final modal structure', {
      clientFilterActionId: finalModal.blocks[0].accessory.action_id,
      projectDropdownActionId: finalModal.blocks[1].element.action_id,
      clientOptionsCount: clientOptions.length,
      projectOptionsCount: projectOptions.length
    });

    // Update the modal with the final form
    await client.views.update({
      view_id: viewId,
      view: finalModal
    });

    logger.info('Project update modal updated successfully', { 
      userId: body.user_id,
      viewId,
      clientOptionsCount: clientOptions.length,
      projectOptionsCount: projectOptions.length
    });

  } catch (error) {
    logger.error('Error in project update command:', error);
    
    await respond({
      text: "❌ Sorry, there was an error opening the project update form. Please try again.",
      response_type: "ephemeral"
    });
  }
};

const handleClientFilterSelection = async ({ ack, body, client }) => {
  await ack();

  try {
    const selectedClient = body.actions[0].selected_option.value;
    
    logger.info('Client filter selection triggered', { 
      selectedClient,
      userId: body.user.id,
      viewId: body.view.id,
      actionId: body.actions[0].action_id
    });
    
    // Get projects based on client selection
    let projects;
    if (selectedClient === 'all_clients') {
      projects = await projectService.getAllProjects();
    } else if (selectedClient === 'no_clients') {
      // No clients found, return empty array
      projects = [];
    } else {
      // Filter projects by exact client name from database
      projects = await projectService.getAllProjects({
        clientName: selectedClient
      });
    }

    logger.info('Projects retrieved for client filter', { 
      selectedClient, 
      projectCount: projects.length,
      projectNames: projects.map(p => p.name)
    });

    // Get the current view state to preserve other selections
    const currentView = body.view;
    const currentValues = currentView.state?.values || {};
    
    // Get current client options and user options from the existing view
    const clientOptions = currentView.blocks[0].accessory.options;
    const userOptions = currentView.blocks[3].element.options;
    const statusOptions = currentView.blocks[4].element.options;
    
    // Create new project options
    const projectOptions = projects.map(project => ({
      text: {
        type: "plain_text",
        text: `${project.name} (${project.status.replace('_', ' ')})`
      },
      value: project.id
    }));

    if (projectOptions.length === 0) {
      projectOptions.push({
        text: {
          type: "plain_text",
          text: "No projects found for this client"
        },
        value: "no_projects"
      });
    }

    // Create a completely new modal with updated project options
    const updatedModal = {
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
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Client Filter*\nSelect a client to filter projects:"
          },
          accessory: {
            type: "static_select",
            action_id: "client_filter_dropdown",
            placeholder: {
              type: "plain_text",
              text: "Select a client to filter projects"
            },
            options: clientOptions,
            initial_option: {
              text: {
                type: "plain_text",
                text: body.actions[0].selected_option.text.text
              },
              value: selectedClient
            }
          }
        },
        {
          type: "input",
          block_id: "project_select",
          element: {
            type: "static_select",
            action_id: "project_dropdown",
            placeholder: {
              type: "plain_text",
              text: projectOptions.length > 0 && projectOptions[0].value !== "no_projects" 
                ? "Select a project to update" 
                : "No projects available"
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
            max_length: 1000,
            // Preserve any existing content
            ...(currentValues.update_content?.content_input?.value && {
              initial_value: currentValues.update_content.content_input.value
            })
          },
          label: {
            type: "plain_text",
            text: "Update Details"
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
            // Preserve current selection or default
            initial_option: currentValues.assigned_to?.assignee_select?.selected_option || userOptions[0]
          },
          label: {
            type: "plain_text",
            text: "Project Lead"
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
              text: "Select project status"
            },
            options: statusOptions,
            // Preserve current selection or default
            initial_option: currentValues.status_update?.status_select?.selected_option || statusOptions[0]
          },
          label: {
            type: "plain_text",
            text: "Project Status"
          }
        }
      ]
    };

    logger.info('Updating modal view with new project options', { 
      viewId: body.view.id,
      newProjectOptionsCount: projectOptions.length,
      selectedClient
    });

    const updateResult = await client.views.update({
      view_id: body.view.id,
      view: updatedModal
    });

    if (updateResult.ok) {
      logger.info('Project dropdown updated successfully for client filter', { 
        selectedClient, 
        projectCount: projects.length,
        newViewId: updateResult.view?.id
      });
    } else {
      logger.error('Failed to update modal view', { 
        error: updateResult.error,
        selectedClient,
        response: updateResult
      });
    }

  } catch (error) {
    logger.error('Error updating project dropdown:', {
      error: error.message,
      stack: error.stack,
      selectedClient: body.actions?.[0]?.selected_option?.value
    });
  }
};

const handleProjectUpdateSubmission = async ({ ack, body, view, client, slackService }) => {
  try {
    const values = view.state.values;
    
    // Extract form data
    const projectId = values.project_select.project_dropdown.selected_option?.value;
    const updateContent = values.update_content.content_input.value;
    const newStatus = values.status_update.status_select.selected_option.value;
    const newAssignee = values.assigned_to.assignee_select.selected_option.value;

    // Validate project selection
    if (!projectId || projectId === 'no_projects') {
      await ack({
        response_action: 'errors',
        errors: {
          project_select: 'Please select a valid project'
        }
      });
      return;
    }

    // Acknowledge the submission after validation
    await ack();

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

    // Handle project lead change
          let assigneeDbId = project.assignedTo; // Keep current project lead by default
    let assigneeChanged = false;
    
    if (newAssignee && newAssignee !== 'no_change') {
      if (newAssignee === 'unassigned') {
        assigneeDbId = null;
        assigneeChanged = project.assignedTo !== null;
      } else {
        // Get project lead info from Slack and ensure they exist in database
        const assigneeInfo = await slackService.getUserInfo(newAssignee);
        if (assigneeInfo) {
          const assigneeUser = await userService.findOrCreateUser(newAssignee, {
            name: assigneeInfo.name,
            email: assigneeInfo.email
          });
          assigneeDbId = assigneeUser.id;
          assigneeChanged = project.assignedTo !== assigneeUser.id;
        }
      }
    }

    // Prepare update data
    const updateData = {};
    if (newStatus && newStatus !== 'no_change' && newStatus !== project.status) {
      updateData.status = newStatus;
    }
    if (assigneeChanged) {
      updateData.assignedTo = assigneeDbId;
    }

    // Update project if there are changes
    let updatedProject = project;
    if (Object.keys(updateData).length > 0) {
      updatedProject = await projectService.updateProject(projectId, updateData);
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

    // Add project lead change notification if applicable
    if (assigneeChanged) {
      const oldAssignee = project.assignee ? project.assignee.name : 'No Project Lead';
      let newAssigneeName = 'No Project Lead';
      
      if (assigneeDbId && newAssignee !== 'unassigned') {
        // Get the project lead name from the updated project or from Slack
        if (updatedProject.assignee) {
          newAssigneeName = updatedProject.assignee.name;
        } else {
          const assigneeInfo = await slackService.getUserInfo(newAssignee);
          newAssigneeName = assigneeInfo ? assigneeInfo.name : 'Unknown User';
        }
      }
      
      responseBlocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Project Lead Updated:* ${oldAssignee} → ${newAssigneeName}`
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
      text: `✅ Update added to "${project.name}"`,
      blocks: responseBlocks
    });

    logger.info('Project update added successfully', { 
      projectId, 
      updateId: update.id,
      userId: user.id,
      statusChanged: newStatus && newStatus !== 'no_change' && newStatus !== project.status,
      assigneeChanged: assigneeChanged
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
  handleSubmission: handleProjectUpdateSubmission,
  handleClientFilterSelection: handleClientFilterSelection
}; 