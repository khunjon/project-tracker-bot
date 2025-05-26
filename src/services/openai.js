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
        model: "gpt-3.5-turbo",
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
        model: "gpt-3.5-turbo",
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
}

module.exports = new OpenAIService(); 