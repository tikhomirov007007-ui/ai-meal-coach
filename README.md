# AI Meal Coach

Персональный AI-тренер по питанию в Telegram. Загрузи фото блюда → бот распознаёт продукты, считает калории и даёт рекомендации.

## Stack

- **Bot:** grammY (Node.js + TypeScript)
- **Mini App:** Vanilla JS + Telegram WebApp SDK
- **AI:** OpenAI Vision (gpt-4o-mini)
- **Database:** PostgreSQL
- **Payments:** Telegram Stars (XTR)

## Quick Start

### 1. Create bot

1. Open [@BotFather](https://t.me/BotFather)
2. `/newbot` → save `BOT_TOKEN`
3. Set commands: `/setcommands` → paste:
   ```
   photo - Загрузить фото блюда
   history - История за сегодня
   stats - Статистика за неделю
   goal - Установить норму калорий
   premium - Premium подписка
   help - FAQ
   ```
4. Set description: `AI meal advisor. Upload food photo → get calories`
5. Set Mini App URL: `/newapp` or Menu Button → your deployed `/mini-app` URL

### 2. Configure environment

```bash
cp .env.example .env
# Fill in BOT_TOKEN, OPENAI_API_KEY, DATABASE_URL
```

### 3. Install & run

```bash
npm install
npm run db:migrate
npm run dev
```

Dev mode uses **polling** (no webhook needed). Mini App available at `http://localhost:3000/mini-app`.

For local Mini App testing, use [ngrok](https://ngrok.com) to expose port 3000 and set `MINI_APP_URL` + `WEBHOOK_URL` to the ngrok URL.

### 4. Deploy (Render)

1. Create PostgreSQL database on Render
2. Create Web Service from this repo
3. Set environment variables from `.env.example`
4. Build: `npm install && npm run build`
5. Start: `npm start`
6. Set `WEBHOOK_URL=https://your-app.onrender.com`

## Features

| Feature | Free | Premium |
|---------|------|---------|
| Photo recognition | 3/day | Unlimited |
| Today's history | ✅ | ✅ |
| 7-day stats | ✅ | ✅ |
| 90-day history | ❌ | ✅ (V2) |

## Bot Commands

- Send a **photo** → AI analysis with calories & macros
- **Save to history** button → logs the meal
- `/goal 2000` → set daily calorie target
- `/premium` → Telegram Stars subscription

## API Endpoints (Mini App)

All require `X-Telegram-Init-Data` header (validated server-side).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/me` | User profile |
| PATCH | `/api/me` | Update goal/timezone |
| GET | `/api/meals/today` | Today's meals + stats |
| GET | `/api/meals/history?days=7` | Meal history |
| GET | `/api/stats/weekly` | Weekly chart + averages |
| PATCH | `/api/meals/:id/portion` | Recalculate portion size |

## Project Structure

```
ai-meal-coach/
├── src/
│   ├── index.ts          # Entry point
│   ├── bot/              # Telegram bot handlers
│   ├── api/              # Express API + static Mini App
│   ├── db/               # PostgreSQL schema & queries
│   └── services/         # Vision, auth, notifications
├── mini-app/             # Telegram Mini App (HTML/CSS/JS)
└── .env.example
```

## Daily Notifications

Cron job sends reminders at **08:00 UTC** to all registered users.

## License

MIT
