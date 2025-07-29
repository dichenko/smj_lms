# 🚀 Быстрая настройка Telegram бота

## Шаг 1: Настройка webhook

1. **Получите токен бота** (если еще не получили):
   - Напишите @BotFather в Telegram
   - Команда: `/newbot`
   - Имя: `SMJ LMS Bot`
   - Username: `smj_lms_bot`

2. **Настройте webhook:**
   ```bash
   node setup-webhook.js YOUR_BOT_TOKEN
   ```

## Шаг 2: Добавьте себя как студента

1. **Получите ваш Chat ID:**
   - Напишите @userinfobot в Telegram
   - Он ответит вашим Chat ID

2. **Добавьте студента в базу:**
   ```bash
   # Отредактируйте add-test-student.sql, заменив YOUR_CHAT_ID
   # Затем выполните:
   npx wrangler d1 execute DB --file=add-test-student.sql --remote
   ```

## Шаг 3: Тестирование

1. **Найдите вашего бота в Telegram**
2. **Отправьте команду:** `/start`
3. **Должен ответить приветствием!**

## 🔧 Если бот не отвечает:

1. **Проверьте webhook:**
   ```bash
   curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo"
   ```

2. **Проверьте логи в Cloudflare Dashboard:**
   - Workers > smj-lms > Logs

3. **Проверьте переменные окружения:**
   ```bash
   npx wrangler secret list
   ```

## 📞 Поддержка

Если что-то не работает:
1. Убедитесь, что webhook URL правильный
2. Проверьте, что токен бота корректный
3. Убедитесь, что Chat ID добавлен в базу данных 