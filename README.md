# Project Tracker Bot

A comprehensive Slack bot for project management with PostgreSQL database integration, OpenAI-powered analysis, and automated weekly reporting.

> ✅ **Ready for Production**: This bot is configured for Railway deployment with automatic builds and database integration.

## Features

### 🤖 Slack Bot Commands
- **`/project-new [project name]`** - Create new projects with modal forms
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
- Railway account (for database and hosting)
- Slack workspace with bot permissions
- OpenAI API key (optional)

## Quick Start

### 1. Clone and Install
```bash
git clone https://github.com/your-username/project-tracker-bot.git
cd project-tracker-bot
npm install
```

### 2. Set Up Environment
```bash
cp env.example .env
# Edit .env with your tokens (see Configuration section below)
```

### 3. Set Up Database
```bash
# Database is hosted on Railway - no local setup needed!
# Just initialize the Prisma client
npm run db:generate
```

### 4. Deploy to Railway
```bash
# Connect your GitHub repo to Railway and deploy
git push  # Auto-deploys to Railway

# Your bot should now be live at: https://your-app.railway.app
# Or for local testing (optional):
npm run dev
```

## Configuration

### Required Environment Variables

Copy `env.example` to `.env` and fill in these values:

```env
# Slack Bot Configuration (from api.slack.com)
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
SLACK_APP_TOKEN=xapp-your-app-token-here

# Database Configuration (Railway provides this automatically)
DATABASE_URL=postgresql://username:password@host:port/database

# OpenAI Configuration (Optional)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Server Configuration
PORT=3000
NODE_ENV=development

# Slack Channel Configuration
GENERAL_CHANNEL_ID=C1234567890
```

### Slack App Setup

1. **Create Slack App** at [api.slack.com/apps](https://api.slack.com/apps)
2. **Enable Socket Mode** and create App-Level Token
3. **Add Bot Scopes:** `chat:write`, `commands`, `app_mentions:read`, `channels:read`, `im:read`, `im:write`, `users:read`
4. **Create Slash Commands:**
   - `/project-new` → `https://your-app.railway.app/slack/events`
   - `/project-update` → `https://your-app.railway.app/slack/events`
   - `/project-list` → `https://your-app.railway.app/slack/events`
   
   **Note**: Replace `your-app.railway.app` with your actual Railway deployment URL
5. **Install App to Workspace**

## Development Workflow

### Railway-Only Development (Recommended) ✅
```bash
# Make changes to your code
git add .
git commit -m "Add new feature"
git push                       # Auto-deploys to Railway

# Test immediately in Slack (your bot is live!)
/project-new "Test Project"
```

### Testing
- Test commands in DMs with the bot first
- Use a dedicated `#bot-testing` channel for experiments
- Announce to team when testing new features
- Small commits for easy rollbacks

### Database Management
```bash
npm run db:generate  # Generate Prisma client after schema changes
npm run db:push      # Push schema changes to database (run locally)
npm run db:studio    # Open Prisma Studio to view Railway database
npm run db:backup    # Create database backup
npm run db:reset-data # Clear all data (with confirmation)
```

### Optional: Local Development
If you need to test complex changes locally first:
```bash
npm run dev          # Start local server (connects to Railway database)
# Test locally, then push to Railway when ready
```

## Deployment

### Railway (Recommended) ✅

1. **Connect GitHub repo to Railway**
2. **Add PostgreSQL service**
3. **Set environment variables in Railway dashboard:**
   ```env
   NODE_ENV=production
   SLACK_BOT_TOKEN=xoxb-your-bot-token
   SLACK_SIGNING_SECRET=your-signing-secret
   SLACK_APP_TOKEN=xapp-your-app-token
   OPENAI_API_KEY=sk-your-openai-key
   GENERAL_CHANNEL_ID=C1234567890
   # DATABASE_URL is provided automatically by Railway PostgreSQL
   ```
4. **Deploy automatically on git push**
5. **Update Slack app URLs** to point to your Railway deployment URL

### Docker (Optional - for local development)
```bash
# Only needed if you want to run locally instead of Railway
docker-compose up --build
```

## API Endpoints

- **GET `/`** - Service information
- **GET `/health`** - Health check
- **GET `/status`** - Detailed status
- **POST `/trigger-digest`** - Manually trigger weekly digest

## Database Schema

### Projects
- `id`, `name`, `client_name`, `status`, `assigned_to`, `description`, `deadline`, `created_at`, `updated_at`

### Project Updates
- `id`, `project_id`, `user_id`, `content`, `ai_analysis`, `risks_identified`, `opportunities_noted`, `created_at`

### Users
- `id`, `slack_user_id`, `name`, `email`, `role`, `created_at`, `updated_at`

## Safety & Best Practices

### Railway-Only Development Safety
- **Test in DMs first** - Commands work in direct messages with the bot
- **Use #bot-testing channel** - Create a dedicated channel for experiments
- **Small commits** - Push small changes for easy rollbacks
- **Announce testing** - Let team know when you're testing new features
- **Railway rollbacks** - Use Railway dashboard to rollback if needed

### Data Safety
- Regular database backups: `npm run db:backup`
- Keep Railway deployment history for rollbacks
- Use feature flags for experimental features

### Team Coordination
- Announce when testing new features
- Use `#bot-testing` channel for experiments  
- Document changes in git commits
- Test thoroughly before pushing

## Monitoring

- **Health Check**: `https://your-app.railway.app/health`
- **Status**: `https://your-app.railway.app/status`
- **Logs**: Check Railway dashboard or local console
- **Database**: Use Prisma Studio for data inspection

## Troubleshooting

### Common Issues
1. **Bot not responding**: Check Slack tokens and Socket Mode
2. **Database errors**: Verify DATABASE_URL and run `npm run db:push`
3. **Missing commands**: Ensure slash commands are configured in Slack app and point to your Railway URL
4. **AI analysis failing**: Check OPENAI_API_KEY (optional feature)
5. **Railway deployment issues**: Check Railway logs for build/deployment errors

### Getting Help
1. Check logs in Railway dashboard for deployment issues
2. Verify environment variables are set correctly in Railway
3. Test database connection with `npm run db:studio`
4. Ensure Slack app permissions are correct
5. Verify Slack slash command URLs point to your Railway deployment

## Contributing

1. Fork the repository
2. Create a feature branch
3. Test thoroughly in `#bot-testing`
4. Submit a pull request

## License

MIT License - see LICENSE file for details 