import { TelegramBot } from './bot';
import { DatabaseService } from '../utils/database';

export async function handleTelegramWebhook(
  request: Request,
  db: DatabaseService,
  botToken: string,
  adminChatId: string
): Promise<Response> {
  try {
    const bot = new TelegramBot(botToken, db, adminChatId);
    
    // Обрабатываем webhook от Telegram
    const update = await request.json();
    
    // Обрабатываем обновление через наш бот
    await bot.handleUpdate(update);

    return new Response('OK', { status: 200 });
  } catch (error: any) {
    console.error('Telegram webhook error:', error);
    
    // Логируем ошибку в базу данных
    await db.logError({
      source: 'telegram_webhook',
      message: `Webhook processing error: ${error.message}`,
      meta: { error: error.toString() }
    });

    return new Response('Error', { status: 500 });
  }
} 