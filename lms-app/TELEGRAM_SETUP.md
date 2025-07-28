# 🤖 Настройка Telegram бота для SMJ LMS

## 📋 Что уже сделано

✅ **Telegram бот создан и интегрирован в приложение**
- Бот поддерживает все основные команды
- Интегрирован с базой данных D1
- Webhook endpoint настроен: `/api/telegram/webhook`
- Приложение деплоено в Cloudflare Workers

## 🚀 Следующие шаги для активации бота

### 1. Создание бота в Telegram

1. **Откройте Telegram и найдите @BotFather**
2. **Отправьте команду:** `/newbot`
3. **Введите имя бота:** `SMJ LMS Bot`
4. **Введите username:** `smj_lms_bot` (должен заканчиваться на 'bot')
5. **Сохраните токен бота** (выглядит как `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Получение вашего Chat ID

1. **Найдите бота @userinfobot в Telegram**
2. **Отправьте ему любое сообщение**
3. **Он ответит вашим Chat ID** (например: `123456789`)

### 3. Настройка переменных окружения

```bash
# Установите токен бота
npx wrangler secret put TELEGRAM_BOT_TOKEN
# Введите токен вашего бота

# Установите ваш Chat ID
npx wrangler secret put TELEGRAM_ADMIN_CHAT_ID
# Введите ваш Chat ID
```

### 4. Настройка Webhook

После настройки переменных, установите webhook URL:

```bash
# Замените YOUR_BOT_TOKEN на ваш токен
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://smj-lms.7d0ef237ad682c32dba7f115c743da75.workers.dev/api/telegram/webhook"
  }'
```

### 5. Передеплой приложения

```bash
npm run deploy
```

## 📱 Команды бота

После настройки бот будет поддерживать следующие команды:

- `/start` - Авторизация в системе
- `/lesson` - Показать текущий урок
- `/progress` - Ваш прогресс обучения  
- `/reports` - История ваших отчетов
- `/submit` - Отправить отчет (ответьте на файл)
- `/help` - Справка

## 🧪 Тестирование

### 1. Проверка webhook
```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo"
```

### 2. Тестовая отправка сообщения
```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "YOUR_CHAT_ID",
    "text": "🤖 SMJ LMS Bot готов к работе!"
  }'
```

## 📊 Добавление тестовых данных

Для тестирования бота добавьте студента в базу данных:

```sql
INSERT INTO students (id, tgid, name, city, course_id) 
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'YOUR_CHAT_ID', 
  'Тестовый Студент',
  'Москва',
  '550e8400-e29b-41d4-a716-446655440001'
);
```

## 🔧 Устранение неполадок

### Бот не отвечает
1. Проверьте webhook URL: `https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo`
2. Убедитесь, что переменные окружения установлены
3. Проверьте логи в Cloudflare Dashboard

### Ошибки в логах
1. Откройте Cloudflare Dashboard
2. Перейдите в Workers > smj-lms
3. Проверьте логи в разделе "Logs"

### Студент не авторизуется
1. Убедитесь, что студент добавлен в базу данных
2. Проверьте правильность TGID в таблице `students`

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи в Cloudflare Dashboard
2. Убедитесь, что все переменные окружения настроены
3. Проверьте, что webhook URL корректный

---

**🎉 После выполнения всех шагов ваш Telegram бот будет полностью функционален!** 