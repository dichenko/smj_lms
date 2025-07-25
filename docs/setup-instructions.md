# Инструкции по запуску LMS системы

## Предварительные требования

1. Node.js (версия 18+)
2. Аккаунт Cloudflare с активным планом Workers
3. Токен Telegram бота (получить у @BotFather)
4. Ваш Telegram ID (админа)

## Шаг 1: Настройка Cloudflare Workers и D1

### Установка Wrangler CLI
```bash
npm install -g wrangler
wrangler login
```

### Создание D1 базы данных
```bash
wrangler d1 create lms-database
```
Скопируйте `database_id` из вывода команды.

### Настройка wrangler.toml
Файл `backend/wrangler.toml` уже настроен безопасно. Секретные данные будут добавлены через команды wrangler.

### Выполнение миграций
```bash
wrangler d1 execute lms-database --file=database/schema.sql
```

## Шаг 2: Настройка секретов и деплой Backend

### Установка секретов
```bash
cd backend

# Установка секретов (замените на реальные значения)
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_ADMIN_ID  
wrangler secret put ADMIN_PASSWORD

# Обновление database_id в wrangler.toml
# Замените YOUR_DATABASE_ID на реальный ID из предыдущего шага
wrangler d1 execute lms-database --command="SELECT 1" # Проверка подключения
```

### Деплой
```bash
npm install
wrangler publish
```

Скопируйте URL вашего Worker (например: `https://lms-telegram-bot.your-subdomain.workers.dev`)

## Шаг 3: Настройка Telegram Webhook

Замените `YOUR_BOT_TOKEN` и `YOUR_WORKER_URL`:

```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://YOUR_WORKER_URL/api/telegram/webhook"}'
```

## Шаг 4: Настройка Frontend

### Установка зависимостей
```bash
cd frontend
npm install
```

### Настройка переменных
Создайте файл `frontend/.env`:
```
VITE_API_URL=https://your-worker-url.workers.dev
```

### Локальная разработка
```bash
npm run dev
```

### Деплой на Cloudflare Pages
1. Подключите репозиторий к Cloudflare Pages
2. Настройки сборки:
   - Build command: `cd frontend && npm run build`
   - Build output directory: `frontend/dist`
   - Root directory: `/`

## Шаг 5: Первый запуск

1. Откройте админку в браузере
2. Войдите используя логин/пароль из `wrangler.toml`
3. Добавьте первого студента с его Telegram ID
4. Создайте курс и добавьте уроки
5. Назначьте студенту курс

## Получение Telegram ID

Студент должен написать боту `/start`, затем:
1. Найдите его ID в логах Worker
2. Или используйте бота @userinfobot для получения ID

## Тестирование

1. Студент пишет боту `/start`
2. Использует кнопки "Мои задания", "Сдать отчет"
3. Отправляет файл отчета
4. Админ получает файл в Telegram и может проверить в админке
5. Студент получает уведомление о результате

## Полезные команды

```bash
# Проверка логов Worker
wrangler tail

# Локальная разработка Worker
wrangler dev

# Выполнение SQL команд
wrangler d1 execute lms-database --command="SELECT * FROM students"

# Проверка статуса webhook
curl "https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo"
```

## Решение проблем

- **Бот не отвечает**: Проверьте webhook и логи Worker
- **Ошибки авторизации**: Убедитесь что логин/пароль правильные в `wrangler.toml` 
- **Файлы не пересылаются**: Проверьте `TELEGRAM_ADMIN_ID` в настройках 