# Настройка Cloudflare Workers и D1

⚠️ **Важно**: Секретные данные (токены, пароли, ID базы) НЕ хранятся в коде репозитория и устанавливаются безопасно через команды `wrangler secret put`.

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

Файл `backend/wrangler.toml` уже создан с безопасной конфигурацией. Секретные данные будут добавлены через команды wrangler.

## Шаг 4: Установка секретов

```bash
cd backend

# Установка секретов (замените на реальные значения)
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_ADMIN_ID  
wrangler secret put ADMIN_PASSWORD

# Обновление database_id в wrangler.toml
# Замените YOUR_DATABASE_ID на реальный ID из шага 2
```

## Шаг 5: Выполнение миграций

```bash
# Находясь в корне проекта
wrangler d1 execute lms-database --file=database/schema.sql
```

## Шаг 6: Деплой Worker

```bash
cd backend
wrangler publish
```

## Шаг 7: Настройка Telegram Webhook

После деплоя получите URL вашего Worker и установите webhook:

```bash
# Замените YOUR_BOT_TOKEN и YOUR_WORKER_URL
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://YOUR_WORKER_URL.workers.dev/api/telegram/webhook"}'
```

## Шаг 8: Настройка Frontend (Cloudflare Pages)

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