# Telegram → Attio CRM Bot

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black.svg)](https://vercel.com)

> Forward messages from Telegram and automatically add them to your Attio CRM with just a few taps.

![Telegram Bot Interface](tg-attio-1.png)
![Attio CRM Integration](tg-attio-2.png)

## What It Does

This bot allows you to forward messages from Telegram and use **natural language instructions** to create any record in your Attio CRM. Powered by AI intent analysis, it understands what you want to do and extracts the relevant data automatically.

### AI-Powered Capabilities

- **AI Intent Analysis** - Natural language instructions processed by Claude
- **Supported Actions**: `create_person`, `create_company`, `create_deal`, `add_to_list`, `create_task`, `add_note`, `update_record`, `search_record`
- **Smart Extraction** - Names, emails, phones, company info, deal values from messages
- **Prerequisite Chaining** - Auto-creates companies before linking people/deals
- **Clarification Flow** - Interactive prompts for missing/ambiguous data

### Use Case

Many teams use Telegram extensively to communicate with customers. Important conversations happen in group chats, and there's often a need for a fast way to capture these interactions in a CRM without manual copy-pasting. This bot makes it instant.

## How It Works

**AI-Powered Flow:**
```
1. Forward messages → Bot queues them
   ↓
2. /done <instruction> → AI analyzes intent with your Attio schema
   Example: /done create a person and add to sales pipeline
   ↓
3. Review suggestion → Confirm, edit fields, or provide clarifications
   ↓
4. Execute → Record created in Attio with note attached
```

**Examples:**
- `/done add this person to the leads list` - Creates person, adds to list
- `/done create a deal for $50k` - Creates deal with value
- `/done just save as a note for Acme Corp` - Adds note to company

The bot captures all important context:
- Original sender username
- Chat name where message came from
- Timestamp
- Full message content
- Links back to Attio record

## Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| **Language** | TypeScript | Type safety and better developer experience |
| **Bot Framework** | [grammY](https://grammy.dev) | Modern, TypeScript-first, serverless-optimized |
| **Hosting** | [Vercel Serverless](https://vercel.com) | Zero config, free tier, instant deploys |
| **Session Storage** | [Upstash Redis](https://upstash.com) | Serverless-native, generous free tier |
| **CRM** | [Attio API](https://attio.com) | Powerful API for company records and notes |
| **AI SDK** | [Vercel AI SDK](https://sdk.vercel.ai) with Gateway | Claude 3.5 Sonnet for intent analysis |
| **Durable Execution** | [Vercel Workflows](https://vercel.com/docs/workflow-sdk) | State management across async operations |

### Why This Stack?

- **Serverless Architecture:** No servers to manage, scales automatically, pay only for usage
- **TypeScript:** Catch bugs at compile time, better IDE support
- **grammY:** Purpose-built for serverless, excellent conversation management
- **Upstash Redis:** Perfect for ephemeral session state, no connection pooling issues
- **Vercel:** Best-in-class serverless platform with instant deployments

## Project Status

✅ **Production Ready** - Fully functional and tested

### Completed Features

- [x] Research and architecture design
- [x] Tech stack selection
- [x] Project setup and configuration
- [x] Attio API client implementation
- [x] Webhook-based bot with state machine
- [x] Multi-step conversation flow
- [x] Session management with Redis
- [x] Company search and selection
- [x] Message queueing and batch processing
- [x] Clean note formatting (conversation-style)

## Getting Started

### Prerequisites

Before you start, you'll need:

1. **Telegram Bot Token**
   - Message [@BotFather](https://t.me/botfather)
   - Create a new bot and save the token

2. **Attio API Key**
   - Log into [Attio](https://app.attio.com)
   - Go to Settings → Developers → API Keys
   - Create key with permissions:
     - **Object Configuration** (Read) - Required for company search
     - **Record data access** (Read/Write) - Required for reading companies and writing notes

3. **Upstash Redis Database**
   - Sign up at [Upstash](https://upstash.com)
   - Create a Redis database (Global recommended)
   - Copy REST URL and Token

4. **Vercel Account** (for deployment)
   - Sign up at [Vercel](https://vercel.com)
   - Connect your GitHub account

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/attio-tg.git
cd attio-tg

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local with your credentials
# BOT_TOKEN, ATTIO_API_KEY, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
```

### Local Development

```bash
# Type check
npm run type-check

# For local testing, use Vercel CLI
npx vercel dev

# For webhook testing, use ngrok in another terminal
ngrok http 3000

# Set webhook to ngrok URL
curl -X POST "https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-ngrok-url.ngrok.io/api/webhook"}'
```

### Deployment

```bash
# Deploy to Vercel
vercel --prod

# Set environment variables in Vercel dashboard

# Set webhook URL
curl -X POST https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-app.vercel.app/api/webhook"}'
```

## Project Structure

```
attio-tg/
├── api/                      # Vercel serverless functions
│   └── webhook.ts           # Main webhook handler
├── src/
│   ├── bot/                 # Bot logic and handlers
│   ├── conversations/       # Multi-step conversation flows
│   ├── services/            # External services (Attio, Redis)
│   ├── types/               # TypeScript type definitions
│   └── lib/                 # Utilities and config
└── tests/                   # Test files
```

## Usage

Once deployed:

1. **Start a conversation with your bot**
   ```
   /start
   ```

2. **Forward messages to the bot**
   - Forward one or multiple messages
   - From group chats or direct messages
   - Bot queues each: "📥 Message queued (N)"

3. **Process the queue**
   ```
   /done
   ```
   Bot will ask which company these messages are for

4. **Select the company**
   - Search by name
   - Or pick from recently used

5. **Confirm and done!**
   - All messages combined into a single, clean note
   - Note formatted like a natural conversation
   - Link provided to view in Attio

### Available Commands

- `/start` - Get started and see instructions
- `/done` - Process queued messages (starts company selection)
- `/clear` - Clear message queue without processing
- `/cancel` - Cancel current operation
- `/help` - Show help message

## Testing Without Telegram

Run tests locally without needing a Telegram bot or live connections.

### Unit Tests (No External Dependencies)
```bash
npm run test:attio        # Deadline parsing, company input parsing
npm run test:run          # All unit tests
```

### AI Intent Tests (Requires AI_GATEWAY_API_KEY)
```bash
npm run test:ai           # Full AI intent classification suite
npm run test:ai:smoke     # Quick 4-scenario smoke test
```

### End-to-End Attio Tests (Requires ATTIO_API_KEY)
**Planned** - Test complete record lifecycle:
```bash
npm run test:e2e          # Full integration tests
```

Test flow:
1. Create test company via API → Verify with GET
2. Create person linked to company → Verify relationship
3. Create deal for company → Verify values
4. Create task → Verify deadline and assignee
5. Add note to record → Verify content
6. Cleanup: Delete test records

**Current test files:**
- `tests/attio-actions/deadline.test.ts` - Deadline parsing, company input parsing
- `tests/ai/intent.test.ts` - AI intent classification (12+ scenarios)
- `tests/ai/fixtures/` - Mock schema and test cases

## Features

### Current
- ✅ AI-powered intent classification
- ✅ Natural language instructions
- ✅ Multi-entity extraction from conversations
- ✅ Interactive clarification handling
- ✅ Prerequisite action chaining
- ✅ Durable workflows (Vercel Workflows)
- ✅ Unit tests for core functions (no Telegram needed)
- ✅ AI intent tests (no Telegram needed)
- ✅ Forward single or multiple text messages
- ✅ Queue-based batch processing with `/done` command
- ✅ Interactive company search with fuzzy matching
- ✅ Recent company suggestions
- ✅ Automatic metadata capture (sender, time, chat)
- ✅ Direct links to Attio records
- ✅ Webhook-based architecture (serverless-ready)

### Future Enhancements
- [ ] E2E Attio API tests (create → verify → cleanup)
- [ ] Webhook simulation tests
- [ ] Support forwarded media (images, files, videos)
- [ ] Auto-suggest companies based on chat name
- [ ] Add custom tags to notes
- [ ] Multi-language support

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Ways to Contribute

- 🐛 Report bugs
- 💡 Suggest new features
- 📝 Improve documentation
- 🔧 Submit pull requests
- ⭐ Star the project if you find it useful!

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Support

For issues or questions:
- Open an [issue on GitHub](https://github.com/yourusername/attio-tg/issues)
- Check existing issues for solutions
- Read the documentation carefully

## Roadmap

See the [Issues](https://github.com/yourusername/attio-tg/issues) page for planned features and known issues.

---

**Built with ❤️ for better CRM workflows**
