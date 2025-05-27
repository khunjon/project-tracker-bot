const OpenAI = require('openai');
const logger = require('../config/logger');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class OpenAIService {
  async analyzeProjectUpdate(updateContent, projectContext) {
    try {
      const prompt = `
Analyze the following project update and provide insights:

Project Context:
- Name: ${projectContext.name}
- Client: ${projectContext.clientName}
- Status: ${projectContext.status}
- Description: ${projectContext.description || 'No description provided'}

Update Content:
${updateContent}

Please provide:
1. A brief analysis of the update (2-3 sentences)
2. Potential risks identified (if any)
3. Opportunities noted (if any)

Format your response as JSON with the following structure:
{
  "analysis": "Brief analysis here",
  "risks": ["risk1", "risk2"],
  "opportunities": ["opportunity1", "opportunity2"]
}
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a project management assistant. Analyze project updates and provide insights about risks and opportunities. Always respond with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      logger.info('OpenAI analysis completed', {
        projectId: projectContext.id,
        analysisLength: result.analysis.length,
        risksCount: result.risks.length,
        opportunitiesCount: result.opportunities.length
      });

      return result;
    } catch (error) {
      logger.error('OpenAI analysis failed:', error);
      
      // Return a fallback response if OpenAI fails
      return {
        analysis: "Unable to generate AI analysis at this time.",
        risks: [],
        opportunities: []
      };
    }
  }

  async generateWeeklyDigest(projects, updates) {
    try {
      const prompt = `
Generate a weekly project digest based on the following data:

Active Projects (${projects.length}):
${projects.map(p => `- ${p.name} (${p.clientName}) - Status: ${p.status}`).join('\n')}

Recent Updates (${updates.length}):
${updates.map(u => `- ${u.project.name}: ${u.content.substring(0, 100)}...`).join('\n')}

Create a concise weekly digest that includes:
1. Overall project portfolio status
2. Key highlights and achievements
3. Areas requiring attention
4. Upcoming deadlines (if any)

Keep it professional and actionable, suitable for a team channel.
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a project management assistant creating weekly digests for a team. Be concise, professional, and focus on actionable insights."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.4,
      });

      const digest = response.choices[0].message.content;
      
      logger.info('Weekly digest generated', {
        projectsCount: projects.length,
        updatesCount: updates.length,
        digestLength: digest.length
      });

      return digest;
    } catch (error) {
      logger.error('Weekly digest generation failed:', error);
      
      // Return a fallback digest
      return `📊 **Weekly Project Digest**\n\n` +
             `Active Projects: ${projects.length}\n` +
             `Recent Updates: ${updates.length}\n\n` +
             `*AI analysis temporarily unavailable. Please check individual projects for detailed status.*`;
    }
  }

  async generateProjectListSummary(projects, recentUpdates) {
    try {
      const prompt = `
Analyze the current project portfolio and provide a concise summary in 3-4 sentences:

Active Projects (${projects.length}):
${projects.map(p => `- ${p.name} (${p.clientName}) - Status: ${p.status}${p.assignee ? ` - Assigned to: ${p.assignee.name}` : ' - Unassigned'}${p.deadline ? ` - Deadline: ${new Date(p.deadline).toLocaleDateString()}` : ''}`).join('\n')}

Recent Updates (${recentUpdates.length}):
${recentUpdates.map(u => `- ${u.project.name}: ${u.content.substring(0, 150)}...`).join('\n')}

Provide a brief summary that includes:
1. Overall portfolio health and status
2. Key progress highlights
3. Any areas that need attention
4. Overall momentum/trajectory

Keep it to 3-4 sentences maximum. Be professional and actionable.
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a project management assistant. Provide concise, professional summaries of project portfolios in 3-4 sentences. Focus on status, progress, and actionable insights."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.3,
      });

      const summary = response.choices[0].message.content;
      
      logger.info('Project list summary generated', {
        projectsCount: projects.length,
        updatesCount: recentUpdates.length,
        summaryLength: summary.length
      });

      return summary;
    } catch (error) {
      logger.error('Project list summary generation failed:', error);
      
      // Return a fallback summary
      return `Portfolio overview: ${projects.length} active projects across various clients. Recent activity shows ongoing progress with ${recentUpdates.length} updates. Review individual projects for detailed status and next steps.`;
    }
  }

  async generateProjectDetailSummary(project) {
    try {
      const assigneeText = project.assignee ? project.assignee.name : 'Unassigned';
      const deadlineText = project.deadline 
        ? new Date(project.deadline).toLocaleDateString()
        : 'No deadline set';
      
      // Get more detailed updates for better context
      const updatesText = project.updates && project.updates.length > 0
        ? project.updates.slice(0, 5).map(u => {
            const date = new Date(u.createdAt).toLocaleDateString();
            return `- ${date} by ${u.user.name}: ${u.content}`;
          }).join('\n')
        : 'No updates available';

      const prompt = `
You are analyzing a project to provide actionable insights. Focus on the CONTENT of the updates to understand what's actually happening.

PROJECT: ${project.name} for ${project.clientName}
STATUS: ${project.status}
ASSIGNED TO: ${assigneeText}
DEADLINE: ${deadlineText}
DESCRIPTION: ${project.description || 'No description provided'}

RECENT ACTIVITY:
${updatesText}

Based on the actual content of these updates, provide a 2-3 sentence summary that:
1. Describes what work has been completed recently
2. Identifies current momentum/progress trends
3. Highlights any blockers, achievements, or next steps mentioned

Focus on the SUBSTANCE of what's happening, not just metadata. Be specific about the actual work being done.
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a project management assistant. Analyze the actual content of project updates to provide meaningful insights about progress, achievements, and next steps. Be specific about the work being done, not just project metadata."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 250,
        temperature: 0.2,
      });

      const summary = response.choices[0].message.content;
      
      logger.info('Project detail summary generated', {
        projectId: project.id,
        projectName: project.name,
        summaryLength: summary.length,
        updatesCount: project.updates ? project.updates.length : 0
      });

      return summary;
    } catch (error) {
      logger.error('Project detail summary generation failed:', error);
      
      // Create a more intelligent fallback using actual update content
      if (project.updates && project.updates.length > 0) {
        const latestUpdate = project.updates[0];
        const updateDate = new Date(latestUpdate.createdAt).toLocaleDateString();
        const updatePreview = latestUpdate.content.length > 100 
          ? latestUpdate.content.substring(0, 100) + '...' 
          : latestUpdate.content;
        
        return `Latest update from ${latestUpdate.user.name} on ${updateDate}: "${updatePreview}" This ${project.status.replace('_', ' ').toLowerCase()} project has ${project.updates.length} recorded updates. ${project.assignee ? `Currently assigned to ${project.assignee.name}.` : 'Currently unassigned.'}`;
      } else {
        const statusText = project.status.replace('_', ' ').toLowerCase();
        return `This ${statusText} project for ${project.clientName} has no updates yet. ${project.assignee ? `Assigned to ${project.assignee.name}.` : 'Currently unassigned.'} ${project.description ? `Project focus: ${project.description.substring(0, 100)}${project.description.length > 100 ? '...' : ''}` : ''}`;
      }
    }
  }
}

module.exports = new OpenAIService(); 