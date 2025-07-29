import { TelegramBot } from './bot';
import { DatabaseService } from '../utils/database';

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export async function handleTelegramWebhook(
  request: Request,
  db: DatabaseService,
  botToken: string,
  adminChatId: string,
  kv: KVNamespace
): Promise<Response> {
  try {
    const bot = new TelegramBot(botToken, db, adminChatId, kv);
    
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