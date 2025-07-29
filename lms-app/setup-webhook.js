// Скрипт для настройки webhook Telegram бота
// Запустите: node setup-webhook.js YOUR_BOT_TOKEN

const BOT_TOKEN = process.argv[2];
const WEBHOOK_URL = 'https://smj-lms.3451881.workers.dev/api/telegram/webhook';

if (!BOT_TOKEN) {
  console.error('❌ Ошибка: Укажите токен бота');
  console.log('Использование: node setup-webhook.js YOUR_BOT_TOKEN');
  process.exit(1);
}

async function setupWebhook() {
  try {
    console.log('🔧 Настройка webhook для Telegram бота...');
    console.log(`📡 Webhook URL: ${WEBHOOK_URL}`);
    
    // Устанавливаем webhook
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: WEBHOOK_URL,
        allowed_updates: ['message', 'callback_query']
      })
    });

    const result = await response.json();
    
    if (result.ok) {
      console.log('✅ Webhook успешно настроен!');
      console.log(`📊 Статус: ${result.description}`);
    } else {
      console.error('❌ Ошибка настройки webhook:', result.description);
    }

    // Проверяем информацию о webhook
    console.log('\n🔍 Проверка webhook...');
    const infoResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const info = await infoResponse.json();
    
    if (info.ok) {
      console.log('📋 Информация о webhook:');
      console.log(`   URL: ${info.result.url || 'не установлен'}`);
      console.log(`   Ошибки: ${info.result.last_error_message || 'нет'}`);
      console.log(`   Обновления: ${info.result.pending_update_count || 0}`);
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

setupWebhook(); 