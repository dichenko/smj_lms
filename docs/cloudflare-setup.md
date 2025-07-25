# Настройка Cloudflare Workers и D1

## Шаг 1: Установка Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

## Шаг 2: Создание D1 базы данных

```bash
# Создать базу данных
wrangler d1 create lms-database

# Сохраните database_id из вывода команды!
```

## Шаг 3: Настройка wrangler.toml

Создайте файл `backend/wrangler.toml`:

```toml
name = "lms-telegram-bot"
main = "worker.js"
compatibility_date = "2024-01-01"

# Замените YOUR_DATABASE_ID на ID из предыдущего шага
[[d1_databases]]
binding = "DB"
database_name = "lms-database"  
database_id = "YOUR_DATABASE_ID"

[vars]
TELEGRAM_BOT_TOKEN = "your_bot_token"
TELEGRAM_ADMIN_ID = "your_telegram_id"
ADMIN_LOGIN = "admin"
ADMIN_PASSWORD = "your_password"
```

## Шаг 4: Выполнение миграций

```bash
# Находясь в корне проекта
wrangler d1 execute lms-database --file=database/schema.sql
```

## Шаг 5: Деплой Worker

```bash
cd backend
wrangler publish
```

## Шаг 6: Настройка Telegram Webhook

После деплоя получите URL вашего Worker и установите webhook:

```bash
# Замените YOUR_BOT_TOKEN и YOUR_WORKER_URL
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://YOUR_WORKER_URL.workers.dev/api/telegram/webhook"}'
```

## Шаг 7: Настройка Frontend (Cloudflare Pages)

1. Подключите репозиторий к Cloudflare Pages
2. Настройте build settings:
   - Build command: `cd frontend && npm run build`
   - Build output directory: `frontend/dist`
   - Root directory: `/`

## Полезные команды

```bash
# Локальная разработка Worker
wrangler dev

# Проверка статуса базы данных
wrangler d1 info lms-database

# Выполнение SQL команд
wrangler d1 execute lms-database --command="SELECT * FROM students"
``` 