const { prisma } = require('../config/database');
const logger = require('../config/logger');

class UserService {
  async findOrCreateUser(slackUserId, userData = {}) {
    try {
      let user = await prisma.user.findUnique({
        where: { slackUserId }
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            slackUserId,
            name: userData.name || 'Unknown User',
            email: userData.email || null,
            role: userData.role || 'member'
          }
        });
        
        logger.info('New user created', { userId: user.id, slackUserId });
      }

      return user;
    } catch (error) {
      logger.error('Error finding or creating user:', error);
      throw error;
    }
  }

  async getUserBySlackId(slackUserId) {
    try {
      return await prisma.user.findUnique({
        where: { slackUserId },
        include: {
          assignedProjects: {
            include: {
              updates: {
                orderBy: { createdAt: 'desc' },
                take: 5
              }
            }
          }
        }
      });
    } catch (error) {
      logger.error('Error getting user by Slack ID:', error);
      throw error;
    }
  }

  async getAllUsers() {
    try {
      return await prisma.user.findMany({
        orderBy: { name: 'asc' }
      });
    } catch (error) {
      logger.error('Error getting all users:', error);
      throw error;
    }
  }

  async updateUser(userId, updateData) {
    try {
      return await prisma.user.update({
        where: { id: userId },
        data: updateData
      });
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  async getUserStats(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          assignedProjects: true,
          projectUpdates: true
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      const stats = {
        totalProjects: user.assignedProjects.length,
        activeProjects: user.assignedProjects.filter(p => 
          ['PLANNING', 'IN_PROGRESS'].includes(p.status)
        ).length,
        completedProjects: user.assignedProjects.filter(p => 
          p.status === 'COMPLETED'
        ).length,
        totalUpdates: user.projectUpdates.length
      };

      return { user, stats };
    } catch (error) {
      logger.error('Error getting user stats:', error);
      throw error;
    }
  }
}

module.exports = new UserService(); 