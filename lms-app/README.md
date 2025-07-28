# SMJ LMS - Система управления обучением

Cloudflare Workers приложение для управления обучением студентов через Telegram бота и веб-интерфейс администратора.

## 🚀 Быстрый старт

### Предварительные требования
- Node.js 18+
- Cloudflare аккаунт
- Telegram Bot Token

### Установка и настройка

1. **Клонируйте репозиторий:**
```bash
git clone <repository-url>
cd smj-lms/lms-app
```

2. **Установите зависимости:**
```bash
npm install
```

3. **Настройте Telegram бота:**
   - Создайте бота через [@BotFather](https://t.me/botfather)
   - Получите токен бота
   - Получите ваш Telegram Chat ID

4. **Настройте переменные окружения:**
```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
# Введите токен вашего бота

npx wrangler secret put TELEGRAM_ADMIN_CHAT_ID
# Введите ваш Telegram Chat ID
```

5. **Запустите локально:**
```bash
npm run dev
```

6. **Деплой в Cloudflare:**
```bash
npm run deploy
```

## 🤖 Telegram Bot

### Команды бота:
- `/start` - Авторизация в системе
- `/lesson` - Показать текущий урок
- `/progress` - Ваш прогресс обучения
- `/reports` - История ваших отчетов
- `/submit` - Отправить отчет (ответьте на файл)
- `/help` - Справка

### Как отправить отчет:
1. Отправьте файл (PDF, DOC, DOCX, фото)
2. Ответьте на него командой `/submit`

## 📊 API Endpoints

### Основные endpoints:
- `GET /api/health` - Проверка работоспособности
- `GET /api/students` - Список студентов
- `GET /api/courses` - Список курсов
- `GET /api/reports` - Список отчетов
- `POST /api/telegram/webhook` - Webhook для Telegram бота

### Полная документация API:
- Студенты: `/api/students`
- Курсы: `/api/courses`
- Уроки: `/api/courses/:id/lessons`
- Отчеты: `/api/reports`
- Логи: `/api/logs`

## 🗄️ База данных

Система использует Cloudflare D1 (SQLite) со следующими таблицами:
- `admins` - Администраторы системы
- `students` - Студенты с Telegram ID
- `courses` - Курсы обучения
- `lessons` - Уроки курсов
- `reports` - Отчеты студентов
- `error_logs` - Логи ошибок
- `admin_sessions` - Сессии администраторов

## 🔧 Разработка

### Структура проекта:
```
src/
├── index.ts              # Основной файл приложения
├── models/
│   └── database.ts       # Типы базы данных
├── utils/
│   └── database.ts       # Утилиты для работы с БД
└── telegram/
    ├── bot.ts            # Telegram бот
    └── webhook.ts        # Webhook handler
```

### Команды разработки:
```bash
npm run dev          # Локальная разработка
npm run deploy       # Деплой в Cloudflare
npm run cf-typegen   # Генерация типов
```

## 🌐 Деплой

Приложение автоматически деплоится в Cloudflare Workers:
- **URL:** `https://smj-lms.[account-id].workers.dev`
- **База данных:** Cloudflare D1
- **Статические файлы:** Cloudflare Assets

## 📝 Лицензия

MIT License
