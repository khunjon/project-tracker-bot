# Project Tracker Bot

A comprehensive Slack bot for project management with PostgreSQL database integration, OpenAI-powered analysis, and automated weekly reporting.

## Features

### 🤖 Slack Bot Commands
- **`/project-new`** - Create new projects with modal forms
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
- **AI**: OpenAI API (GPT-3.5-turbo)
- **Scheduling**: node-cron
- **Logging**: Winston
- **Security**: Helmet, CORS

## Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Slack workspace with bot permissions
- OpenAI API key

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd project-tracker-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Fill in your environment variables:
   ```env
   # Slack Bot Configuration
   SLACK_BOT_TOKEN=xoxb-your-bot-token-here
   SLACK_SIGNING_SECRET=your-signing-secret-here
   SLACK_APP_TOKEN=xapp-your-app-token-here

   # Database Configuration
   DATABASE_URL=postgresql://username:password@localhost:5432/project_tracker

   # OpenAI Configuration
   OPENAI_API_KEY=your-openai-api-key-here

   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # Slack Channel Configuration
   GENERAL_CHANNEL_ID=C1234567890
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Push schema to database
   npm run db:push
   ```

5. **Create logs directory**
   ```bash
   mkdir logs
   ```

## Slack App Setup

1. **Create a Slack App**
   - Go to [api.slack.com/apps](https://api.slack.com/apps)
   - Click "Create New App" → "From scratch"
   - Name your app and select your workspace

2. **Configure Bot Token Scopes**
   Go to "OAuth & Permissions" and add these scopes:
   ```
   app_mentions:read
   channels:read
   chat:write
   commands
   im:history
   im:read
   im:write
   users:read
   ```

3. **Enable Socket Mode**
   - Go to "Socket Mode" and enable it
   - Generate an App-Level Token with `connections:write` scope

4. **Create Slash Commands**
   Go to "Slash Commands" and create:
   - `/project-new` - Create a new project
   - `/project-update` - Update an existing project  
   - `/project-list` - List all projects

5. **Enable Events**
   Go to "Event Subscriptions" and subscribe to:
   - `app_mention`
   - `message.im`

6. **Install App to Workspace**
   - Go to "Install App" and install to your workspace
   - Copy the Bot User OAuth Token

## Development

```bash
# Start in development mode with auto-reload
npm run dev

# Start in production mode
npm start

# Database operations
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema changes
npm run db:migrate   # Run migrations
npm run db:studio    # Open Prisma Studio
```

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

## Deployment

### Railway Deployment

1. **Connect to Railway**
   ```bash
   npm install -g @railway/cli
   railway login
   railway init
   ```

2. **Add PostgreSQL**
   ```bash
   railway add postgresql
   ```

3. **Set Environment Variables**
   ```bash
   railway variables set SLACK_BOT_TOKEN=xoxb-...
   railway variables set SLACK_SIGNING_SECRET=...
   railway variables set SLACK_APP_TOKEN=xapp-...
   railway variables set OPENAI_API_KEY=...
   railway variables set GENERAL_CHANNEL_ID=...
   ```

4. **Deploy**
   ```bash
   railway up
   ```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "start"]
```

## Usage

### Creating a Project
1. Use `/project-new` in any Slack channel
2. Fill out the modal form with project details
3. Assign team members and set deadlines
4. Submit to create the project

### Adding Updates
1. Use `/project-update` in any channel
2. Select the project from the dropdown
3. Add your update content
4. Optionally change project status
5. Submit to add update with AI analysis

### Viewing Projects
1. Use `/project-list` to see all projects
2. Click "View Details" for specific project information
3. Use "View Statistics" for portfolio overview

### Weekly Digest
- Automatically posted every Monday at 9 AM
- Includes AI-generated summary
- Shows active projects and recent updates
- Highlights upcoming deadlines

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