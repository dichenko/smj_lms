# Простая инструкция по деплою на Cloudflare

## Шаг 1: Подготовка токенов

### Создайте Telegram бота:
1. Напишите @BotFather в Telegram
2. Отправьте `/newbot`
3. Придумайте название и username
4. Скопируйте токен (например: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

### Узнайте ваш Telegram ID:
1. Напишите @userinfobot в Telegram
2. Отправьте любое сообщение
3. Скопируйте ваш ID (например: `123456789`)

## Шаг 2: Установка Wrangler

```bash
npm install -g wrangler
wrangler login
```

## Шаг 3: Создание базы данных

```bash
wrangler d1 create lms-database
```
**Скопируйте database_id из вывода!**

## Шаг 4: Настройте wrangler.toml

Откройте файл `backend/wrangler.toml` и замените `"placeholder"` на ваш database_id:

```toml
[[d1_databases]]
binding = "DB"
database_name = "lms-database"
database_id = "ваш_database_id_сюда"
```

## Шаг 5: Создайте таблицы в базе

```bash
wrangler d1 execute lms-database --file=database/schema.sql
```

## Шаг 6: Установите переменные

```bash
cd backend

wrangler secret put TELEGRAM_BOT_TOKEN
# Вставьте токен бота

wrangler secret put TELEGRAM_ADMIN_ID
# Вставьте ваш Telegram ID

wrangler secret put ADMIN_PASSWORD
# Придумайте пароль для админки
```

## Шаг 7: Деплой Worker

```bash
wrangler publish
```

**Скопируйте URL воркера из вывода!**

## Шаг 8: Подключите бота

Замените `YOUR_BOT_TOKEN` и `YOUR_WORKER_URL`:

```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://YOUR_WORKER_URL.workers.dev/api/telegram/webhook"}'
```

## Шаг 9: Деплой админки

1. Зайдите в Cloudflare Pages
2. Подключите ваш GitHub репозиторий
3. Настройки сборки:
   - Build command: `cd frontend && npm run build`
   - Build output directory: `frontend/dist`
4. Деплой

## Готово!

- Бот: работает в Telegram
- Админка: доступна по URL от Cloudflare Pages
- Логин для админки: `admin` + ваш пароль 