# Деплой AI Meal Coach на Vercel — пошаговая инструкция

Эта инструкция для новичков. Выполняй шаги по порядку.

---

## Что ты получишь в итоге

После деплоя у тебя будут публичные ссылки:

| Что | Пример URL |
|-----|------------|
| Mini App | `https://ai-meal-coach.vercel.app/mini-app` |
| API | `https://ai-meal-coach.vercel.app/api/health` |
| Telegram webhook | `https://ai-meal-coach.vercel.app/api/webhook?secret=...` |

---

## Что понадобится (все бесплатно для старта)

1. **Аккаунт GitHub** — [github.com](https://github.com)
2. **Аккаунт Vercel** — [vercel.com](https://vercel.com) (можно войти через GitHub)
3. **База PostgreSQL** — [neon.tech](https://neon.tech) (бесплатный тариф)
4. **Telegram-бот** — создаётся через [@BotFather](https://t.me/BotFather)
5. **OpenAI API ключ** — [platform.openai.com](https://platform.openai.com)

---

## Шаг 1. Создай Telegram-бота

1. Открой Telegram → найди **@BotFather**
2. Отправь `/newbot`
3. Придумай имя и username (например `My Meal Coach` / `my_meal_coach_bot`)
4. **Сохрани токен** — строка вида `7123456789:AAH...`. Это `BOT_TOKEN`

Дополнительно в BotFather:
- `/setdescription` → `AI meal advisor. Upload food photo → get calories`
- `/setcommands` → вставь:
  ```
  photo - Загрузить фото блюда
  history - История за сегодня
  stats - Статистика за неделю
  goal - Установить норму калорий
  premium - Premium подписка
  help - FAQ
  ```

---

## Шаг 2. Создай базу данных (Neon)

1. Зайди на [neon.tech](https://neon.tech) → **Sign up**
2. **New Project** → выбери регион ближе к тебе
3. На главной странице проекта найди **Connection string**
4. Скопируй строку вида:
   ```
   postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
   Это твой `DATABASE_URL`

---

## Шаг 3. Получи OpenAI API ключ

1. [platform.openai.com](https://platform.openai.com) → API keys
2. **Create new secret key**
3. Сохрани ключ (`sk-...`) — это `OPENAI_API_KEY`

---

## Шаг 4. Загрузи код на GitHub

### 4.1 Установи Git (если ещё нет)

Скачай с [git-scm.com](https://git-scm.com/download/win) и установи.

### 4.2 Создай репозиторий на GitHub

1. GitHub → **New repository**
2. Имя: `ai-meal-coach`
3. **Create repository** (без README)

### 4.3 Загрузи код

Открой PowerShell в папке проекта `ai-meal-coach`:

```powershell
cd C:\Users\79159\ai-meal-coach
git init
git add .
git commit -m "Initial commit: AI Meal Coach MVP"
git branch -M main
git remote add origin https://github.com/ТВОЙ_ЮЗЕРНЕЙМ/ai-meal-coach.git
git push -u origin main
```

Замени `ТВОЙ_ЮЗЕРНЕЙМ` на свой логин GitHub.

---

## Шаг 5. Задеплой на Vercel

1. Зайди на [vercel.com](https://vercel.com) → **Add New → Project**
2. **Import** репозиторий `ai-meal-coach` с GitHub
3. Vercel сам определит настройки — **не меняй** Root Directory
4. Разверни блок **Environment Variables** и добавь переменные:

| Имя | Значение | Примечание |
|-----|----------|------------|
| `BOT_TOKEN` | токен от BotFather | обязательно |
| `OPENAI_API_KEY` | `sk-...` | обязательно |
| `DATABASE_URL` | строка от Neon | обязательно |
| `WEBHOOK_SECRET` | любая случайная строка 16+ символов | например `mySecretWebhook2026` |
| `SETUP_SECRET` | другая случайная строка | для первоначальной настройки |
| `CRON_SECRET` | третья случайная строка | для утренних уведомлений |
| `NODE_ENV` | `production` | |

5. Нажми **Deploy**
6. Подожди 1–2 минуты — появится ссылка вида `https://ai-meal-coach-xxx.vercel.app`

---

## Шаг 6. Первоначальная настройка (один раз)

После успешного деплоя открой в браузере:

```
https://ТВОЙ-ДОМЕН.vercel.app/api/setup?key=ТВОЙ_SETUP_SECRET
```

Замени:
- `ТВОЙ-ДОМЕН` — URL из Vercel
- `ТВОЙ_SETUP_SECRET` — значение переменной `SETUP_SECRET`

Должен появиться JSON:
```json
{
  "ok": true,
  "message": "Database migrated and Telegram webhook configured",
  "mini_app": "https://...",
  "webhook": "https://..."
}
```

Это создаёт таблицы в базе и подключает бота к Vercel.

---

## Шаг 7. Настрой Mini App в BotFather

1. Открой @BotFather → `/mybots` → выбери своего бота
2. **Bot Settings → Menu Button → Configure**
3. URL Mini App:
   ```
   https://ТВОЙ-ДОМЕН.vercel.app/mini-app
   ```
4. Текст кнопки: `Open App`

Также можно: **Bot Settings → Web App → Edit Web App URL** — тот же URL.

---

## Шаг 8. Проверь, что всё работает

1. **API:** открой `https://ТВОЙ-ДОМЕН.vercel.app/api/health` → должно быть `{"status":"ok"}`
2. **Mini App:** открой `https://ТВОЙ-ДОМЕН.vercel.app/mini-app` → видишь интерфейс (в браузере API не авторизован — это нормально)
3. **Бот:** открой бота в Telegram → `/start` → отправь фото еды → получи калории

---

## Как это устроено (простыми словами)

```
Пользователь (Telegram)
        │
        ▼
   Telegram Bot  ──webhook──►  Vercel /api/webhook
        │                              │
        │                              ▼
        │                        OpenAI Vision
        │                              │
        ▼                              ▼
   Mini App  ◄──API──►  Vercel /api/*  ◄──►  Neon PostgreSQL
   (статика)
```

- **Vercel** хостит сайт и API (serverless — сервер включается по запросу)
- **Neon** хранит пользователей и историю еды
- **Webhook** — Telegram сам шлёт сообщения на твой URL (polling на Vercel не работает)
- **Cron** — Vercel каждый день в 08:00 UTC вызывает `/api/cron/daily` для утренних напоминаний

---

## Частые проблемы

### Бот не отвечает
- Проверь, что вызвал `/api/setup?key=...` после деплоя
- Проверь `BOT_TOKEN` в Vercel → Settings → Environment Variables
- Передеплой: Deployments → ... → Redeploy

### Ошибка базы данных
- `DATABASE_URL` должен содержать `?sslmode=require` (Neon)
- Проверь, что Neon проект не «заснул» (бесплатный тариф) — зайди в консоль Neon

### Mini App не открывается в Telegram
- URL в BotFather должен быть **HTTPS** и точно совпадать с Vercel-доменом
- URL должен заканчиваться на `/mini-app`

### Cron (утренние уведомления) не работает
- На бесплатном тарифе Vercel cron может быть ограничен — проверь план
- `CRON_SECRET` должен быть задан в переменных окружения

---

## Обновление приложения

После изменений в коде:

```powershell
git add .
git commit -m "Описание изменений"
git push
```

Vercel автоматически задеплоит новую версию за 1–2 минуты.

---

## Полезные ссылки

- [Vercel Dashboard](https://vercel.com/dashboard)
- [Neon Console](https://console.neon.tech)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [BotFather](https://t.me/BotFather)
