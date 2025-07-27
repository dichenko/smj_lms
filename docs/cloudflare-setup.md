# Инструкция по деплою на Cloudflare

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

Откройте файл `backend/wrangler.toml` и замените `${DATABASE_ID}` на ваш реальный database_id:

```toml
database_id = "ваш-реальный-database-id-здесь"
```

## Шаг 5: Создайте таблицы в базе

```bash
wrangler d1 execute lms-database --file=../database/schema.sql --remote
```

## Шаг 6: Деплой Worker

```bash
cd backend
wrangler deploy
```

## Шаг 7: Установите секреты

```bash
cd backend

wrangler secret put TELEGRAM_BOT_TOKEN
# Вставьте токен бота

wrangler secret put TELEGRAM_ADMIN_ID
# Вставьте ваш Telegram ID

wrangler secret put ADMIN_PASSWORD
# Придумайте пароль для админки
```

## Шаг 8: Подключите бота

Откройте в браузере эту ссылку, заменив `YOUR_BOT_TOKEN` и `YOUR_WORKER_URL`:

```
https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook?url=https://YOUR_WORKER_URL.workers.dev/api/telegram/webhook
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