# Project Tracker Bot

A comprehensive Slack bot for project management with PostgreSQL database integration, OpenAI-powered analysis, and automated weekly reporting.

## Features

### 🤖 Slack Bot Commands
- **`/project-new [project name]`** - Create new projects with modal forms (optional project name pre-population)
- **`/project-update`** - Add updates to existing projects with AI analysis
- **`/project-list`** - View all projects with interactive details

### 🧠 AI-Powered Analysis
- Automatic project update analysis using OpenAI
- Risk identification and opportunity detection
- Weekly digest generation with insights

### 📊 Automated Reporting
- Weekly digest posted to #general channel every Monday at 9 AM
- Project statistics and recent activity summaries
- Deadline tracking with urgency indicators

### 💾 Database Features
- PostgreSQL with Prisma ORM
- Complete project lifecycle tracking
- User management and assignment
- Update history with AI analysis storage

## Tech Stack

- **Backend**: Node.js, Express.js
- **Slack Integration**: Slack Bolt SDK
- **Database**: PostgreSQL with Prisma ORM
- **AI**: OpenAI API (GPT-4o-mini)
- **Scheduling**: node-cron
- **Logging**: Winston
- **Security**: Helmet, CORS

## Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Slack workspace with bot permissions
- OpenAI API key

## Quick Start

1. **Clone and install**
   ```bash
   git clone https://github.com/khunjon/project-tracker-bot.git
   cd project-tracker-bot
   npm install
   ```

2. **Set up environment**
   ```bash
   cp env.example .env
   # Edit .env with your tokens (see Configuration section below)
   ```

3. **Initialize database**
   ```bash
   npm run db:generate
   npm run db:push
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

## Features Overview

### **🤖 Slack Commands**
- **`/project-new [project name]`** - Interactive modal for creating projects with:
  - Optional project name pre-population from command argument
  - Client selection from workspace channels (format: `#client-{name}`) or manual entry
  - User assignment from workspace members with default to command user
  - Status, description, and deadline settings
- **`/project-update`** - Add progress updates with database-driven client filtering and AI-powered analysis and risk identification  
- **`/project-list`** - Portfolio overview with project statistics and interactive details

### **🧠 AI Integration**
- Automatic analysis of project updates using OpenAI GPT-4o-mini
- Risk identification and opportunity detection
- Weekly digest generation with actionable insights
- Individual project AI summaries in "View Details" for focused insights

### **📊 Automated Reporting**
- Weekly digest posted to #general every Monday at 9 AM
- Project statistics and recent activity summaries
- Deadline tracking with urgency indicators

## Development & Testing

### **Start Development Server**
```bash
npm run dev
```
The bot will start on `http://localhost:3000` with auto-reload enabled.

### **Test the Bot in Slack**

1. **Create a Project:**
   ```
   /project-new
   ```
   Opens a modal form to create a new project with client details, deadlines, and assignments.

2. **List Projects:**
   ```
   /project-list
   ```
   Shows all projects grouped by status with interactive "View Details" buttons. Each "View Details" includes project-specific AI insights.

3. **Update a Project:**
   ```
   /project-update
   ```
   Add progress updates with client filtering for easier project selection. Features:
   - Client dropdown showing only clients that have existing projects in the database
   - Dynamic project list showing project names with current status
   - Assignee management with workspace user selection
   - Accurate filtering with no empty results for non-existent clients
   - Required status selection and AI analysis generation

4. **Mention the Bot:**
   ```
   @YourBotName help
   ```
   Get help information and available commands.

### **Database Management**
```bash
npm run db:generate  # Generate Prisma client after schema changes
npm run db:push      # Push schema changes to database
npm run db:studio    # Open Prisma Studio at http://localhost:5555
```

### **Health Checks**
- **Bot Status:** `http://localhost:3000/health`
- **API Status:** `http://localhost:3000/status`
- **Manual Digest:** `POST http://localhost:3000/trigger-digest`

## API Endpoints

- **GET `/`** - Service information
- **GET `/health`** - Health check
- **GET `/status`** - Detailed status including Slack bot status
- **POST `/trigger-digest`** - Manually trigger weekly digest

## Database Schema

### Projects
```sql
id, name, client_name, status, assigned_to, description, deadline, created_at, updated_at
```

### Project Updates
```sql
id, project_id, user_id, content, ai_analysis, risks_identified, opportunities_noted, created_at
```

### Users
```sql
id, slack_user_id, name, email, role, created_at, updated_at
```

## Production Deployment

### **Railway (Recommended)**

1. **Connect your GitHub repo to Railway**
   - Go to [railway.app](https://railway.app)
   - Create new project from GitHub repo
   - Add PostgreSQL service

2. **Set environment variables in Railway dashboard:**
   ```
   SLACK_BOT_TOKEN=xoxb-...
   SLACK_SIGNING_SECRET=...
   SLACK_APP_TOKEN=xapp-...
   OPENAI_API_KEY=sk-...
   GENERAL_CHANNEL_ID=C...
   NODE_ENV=production
   ```

3. **Deploy automatically on git push**

### **Docker**
```bash
docker-compose up --build
```

## Configuration

### **Required Environment Variables**

Copy `env.example` to `.env` and fill in these values:

```env
# Slack Bot Configuration (from api.slack.com)
SLACK_BOT_TOKEN=xoxb-your-bot-token-here          # Bot User OAuth Token
SLACK_SIGNING_SECRET=your-signing-secret-here      # App Credentials > Signing Secret  
SLACK_APP_TOKEN=xapp-your-app-token-here          # App-Level Token (Socket Mode)

# Database Configuration (Railway PostgreSQL)
DATABASE_URL=postgresql://user:pass@host:port/db

# OpenAI Configuration (Optional - for AI analysis)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Server Configuration
PORT=3000
NODE_ENV=development

# Slack Channel Configuration (for weekly digest)
GENERAL_CHANNEL_ID=C1234567890                    # Right-click channel > Copy link
```

### **Slack App Setup Checklist**

1. **Enable Socket Mode** - Required for local development
2. **Add Bot Scopes:** `chat:write`, `commands`, `app_mentions:read`, `channels:read`, `im:read`, `im:write`, `users:read`
3. **Create Slash Commands:** `/project-new`, `/project-update`, `/project-list`
4. **Install App to Workspace** - Get your Bot User OAuth Token

## Monitoring

The application includes comprehensive logging with Winston:

- **Console logs** in development
- **File logs** in `logs/` directory
- **Error tracking** for all operations
- **Performance monitoring** for database queries

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
1. Check the logs in `logs/` directory
2. Verify environment variables are set correctly
3. Ensure database connection is working
4. Check Slack app permissions and tokens

## Roadmap

- [ ] Project templates
- [ ] Time tracking integration
- [ ] Advanced reporting dashboard
- [ ] Integration with external tools (Jira, GitHub)
- [ ] Mobile app notifications
- [ ] Custom AI prompts per project type 