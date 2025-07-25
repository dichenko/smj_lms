# Настройка Cloudflare Workers и D1

⚠️ **Важно**: Секретные данные (токены, пароли, ID базы) НЕ хранятся в коде репозитория и устанавливаются безопасно через команды `wrangler secret put`.

## Шаг 1: Подготовка токенов

### Получение токена Telegram бота:
1. Напишите @BotFather в Telegram
2. Отправьте команду `/newbot`
3. Следуйте инструкциям (название бота, username)
4. Сохраните полученный токен (выглядит как `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

### Получение вашего Telegram ID:
1. Напишите @userinfobot в Telegram
2. Отправьте любое сообщение
3. Бот ответит вашим ID (число, например: `123456789`)

## Шаг 2: Установка Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

## Шаг 3: Создание D1 базы данных

```bash
# Создать базу данных
wrangler d1 create lms-database

# Сохраните database_id из вывода команды!
```

## Шаг 4: Настройка wrangler.toml

Файл `backend/wrangler.toml` уже создан с безопасной конфигурацией. Секретные данные будут добавлены через команды wrangler.

## Шаг 5: Обновление database_id

```bash
# Откройте файл backend/wrangler.toml и замените "placeholder" на реальный ID
# Например: database_id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

# Пример того, как должен выглядеть wrangler.toml после настройки:
# name = "lms-telegram-bot"
# main = "worker.js"
# compatibility_date = "2024-01-01"
# 
# [[d1_databases]]
# binding = "DB"
# database_name = "lms-database"
# database_id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"  # Ваш реальный ID
# 
# [vars]
# ADMIN_LOGIN = "admin"
# # Секреты установлены через wrangler secret put
```

## Шаг 6: Выполнение миграций

```bash
# Находясь в корне проекта
wrangler d1 execute lms-database --file=database/schema.sql
```

## Шаг 7: Деплой Worker

```bash
cd backend
wrangler publish
```

## Шаг 8: Установка секретов

```bash
# Теперь когда Worker создан, можно устанавливать секреты

# 1. Установка токена Telegram бота
# Получите токен у @BotFather в Telegram
wrangler secret put TELEGRAM_BOT_TOKEN
# Введите токен когда попросит (например: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz)

# 2. Установка Telegram ID админа  
# Получите ваш ID через @userinfobot в Telegram
wrangler secret put TELEGRAM_ADMIN_ID
# Введите ваш ID когда попросит (например: 123456789)

# 3. Установка пароля админа
wrangler secret put ADMIN_PASSWORD
# Введите надежный пароль когда попросит (например: MySecurePassword123!)
```

## Шаг 9: Настройка Telegram Webhook

После деплоя получите URL вашего Worker и установите webhook:

```bash
# Замените YOUR_BOT_TOKEN и YOUR_WORKER_URL
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://YOUR_WORKER_URL.workers.dev/api/telegram/webhook"}'
```

## Шаг 10: Настройка Frontend (Cloudflare Pages)

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