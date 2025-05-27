const { prisma } = require('../config/database');
const logger = require('../config/logger');
const openaiService = require('./openai');

class ProjectService {
  async createProject(projectData, creatorSlackId) {
    try {
      const project = await prisma.project.create({
        data: {
          name: projectData.name,
          clientName: projectData.clientName,
          status: projectData.status || 'PLANNING',
          assignedTo: projectData.assignedTo || null,
          description: projectData.description || null,
          deadline: projectData.deadline ? new Date(projectData.deadline) : null
        },
        include: {
          assignee: true
        }
      });

      logger.info('Project created', { 
        projectId: project.id, 
        name: project.name,
        createdBy: creatorSlackId 
      });

      return project;
    } catch (error) {
      logger.error('Error creating project:', error);
      throw error;
    }
  }

  async updateProject(projectId, updateData) {
    try {
      const project = await prisma.project.update({
        where: { id: projectId },
        data: {
          ...updateData,
          deadline: updateData.deadline ? new Date(updateData.deadline) : undefined,
          updatedAt: new Date()
        },
        include: {
          assignee: true,
          updates: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
              user: true
            }
          }
        }
      });

      logger.info('Project updated', { projectId, updatedFields: Object.keys(updateData) });
      return project;
    } catch (error) {
      logger.error('Error updating project:', error);
      throw error;
    }
  }

  async getProject(projectId) {
    try {
      return await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          assignee: true,
          updates: {
            orderBy: { createdAt: 'desc' },
            include: {
              user: true
            }
          }
        }
      });
    } catch (error) {
      logger.error('Error getting project:', error);
      throw error;
    }
  }

  async getAllProjects(filters = {}) {
    try {
      const where = {};
      
      if (filters.status) {
        where.status = filters.status;
      }
      
      if (filters.assignedTo) {
        where.assignedTo = filters.assignedTo;
      }

      if (filters.clientName) {
        where.clientName = {
          contains: filters.clientName,
          mode: 'insensitive'
        };
      }

      return await prisma.project.findMany({
        where,
        include: {
          assignee: true,
          updates: {
            orderBy: { createdAt: 'desc' },
            take: 3,
            include: {
              user: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });
    } catch (error) {
      logger.error('Error getting all projects:', error);
      throw error;
    }
  }

  async getActiveProjects() {
    try {
      return await prisma.project.findMany({
        where: {
          status: {
            in: ['PLANNING', 'IN_PROGRESS']
          }
        },
        include: {
          assignee: true,
          updates: {
            orderBy: { createdAt: 'desc' },
            take: 3,
            include: {
              user: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });
    } catch (error) {
      logger.error('Error getting active projects:', error);
      throw error;
    }
  }

  async addProjectUpdate(projectId, userId, content) {
    try {
      // Get project context for AI analysis
      const project = await this.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Generate AI analysis
      const aiAnalysis = await openaiService.analyzeProjectUpdate(content, project);

      // Create the update
      const update = await prisma.projectUpdate.create({
        data: {
          projectId,
          userId,
          content,
          aiAnalysis: aiAnalysis.analysis,
          risksIdentified: aiAnalysis.risks,
          opportunitiesNoted: aiAnalysis.opportunities
        },
        include: {
          user: true,
          project: true
        }
      });

      // Update project's updatedAt timestamp
      await prisma.project.update({
        where: { id: projectId },
        data: { updatedAt: new Date() }
      });

      logger.info('Project update added', { 
        updateId: update.id, 
        projectId, 
        userId,
        hasAiAnalysis: !!aiAnalysis.analysis 
      });

      return update;
    } catch (error) {
      logger.error('Error adding project update:', error);
      throw error;
    }
  }

  async getProjectUpdates(projectId, limit = 10) {
    try {
      return await prisma.projectUpdate.findMany({
        where: { projectId },
        include: {
          user: true
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      });
    } catch (error) {
      logger.error('Error getting project updates:', error);
      throw error;
    }
  }

  async getRecentUpdates(days = 7, limit = 20) {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      return await prisma.projectUpdate.findMany({
        where: {
          createdAt: {
            gte: since
          }
        },
        include: {
          user: true,
          project: true
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      });
    } catch (error) {
      logger.error('Error getting recent updates:', error);
      throw error;
    }
  }

  async deleteProject(projectId) {
    try {
      await prisma.project.delete({
        where: { id: projectId }
      });

      logger.info('Project deleted', { projectId });
    } catch (error) {
      logger.error('Error deleting project:', error);
      throw error;
    }
  }

  async getProjectStats() {
    try {
      const [total, planning, inProgress, onHold, completed, cancelled] = await Promise.all([
        prisma.project.count(),
        prisma.project.count({ where: { status: 'PLANNING' } }),
        prisma.project.count({ where: { status: 'IN_PROGRESS' } }),
        prisma.project.count({ where: { status: 'ON_HOLD' } }),
        prisma.project.count({ where: { status: 'COMPLETED' } }),
        prisma.project.count({ where: { status: 'CANCELLED' } })
      ]);

      return {
        total,
        byStatus: {
          planning,
          inProgress,
          onHold,
          completed,
          cancelled
        },
        active: planning + inProgress
      };
    } catch (error) {
      logger.error('Error getting project stats:', error);
      throw error;
    }
  }

  async getUniqueClients() {
    try {
      const result = await prisma.project.findMany({
        select: {
          clientName: true
        },
        distinct: ['clientName'],
        orderBy: {
          clientName: 'asc'
        }
      });

      const clients = result.map(project => project.clientName);
      
      logger.info('Unique clients fetched from database', { 
        count: clients.length,
        clients: clients
      });
      
      return clients;
    } catch (error) {
      logger.error('Error getting unique clients:', error);
      throw error;
    }
  }
}

module.exports = new ProjectService(); 