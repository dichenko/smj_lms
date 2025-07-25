// LMS Telegram Bot - Cloudflare Worker
// Обрабатывает API запросы от админки и webhook от Telegram

import { handleTelegramWebhook } from './telegram/bot.js';
import { handleStudentsAPI } from './api/students.js';
import { handleCoursesAPI } from './api/courses.js';
import { handleLessonsAPI } from './api/lessons.js';
import { handleReportsAPI } from './api/reports.js';
import { handleStatsAPI } from './api/stats.js';

// Главный обработчик запросов
export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      
      // CORS headers для админки
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      };

      // Обработка CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      let response;

      // Роутинг
      if (path === '/api/telegram/webhook') {
        response = await handleTelegramWebhook(request, env);
      } else if (path.startsWith('/api/students')) {
        response = await handleStudentsAPI(request, env, path);
      } else if (path.startsWith('/api/courses')) {
        response = await handleCoursesAPI(request, env, path);
      } else if (path.startsWith('/api/lessons')) {
        response = await handleLessonsAPI(request, env, path);
      } else if (path.startsWith('/api/reports')) {
        response = await handleReportsAPI(request, env, path);
      } else if (path.startsWith('/api/stats')) {
        response = await handleStatsAPI(request, env, path);
      } else if (path === '/api/health') {
        response = new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        response = new Response('Not found', { status: 404 });
      }

      // Добавляем CORS headers к ответу
      Object.keys(corsHeaders).forEach(key => {
        response.headers.set(key, corsHeaders[key]);
      });

      return response;

    } catch (error) {
      console.error('Worker error:', error);
      
      // Уведомляем админа об ошибке в Telegram
      try {
        await sendErrorToAdmin(env, error.message, error.stack);
      } catch (e) {
        console.error('Failed to send error to admin:', e);
      }

      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

// Функция для отправки ошибок админу в Telegram
async function sendErrorToAdmin(env, errorMessage, errorStack) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_ADMIN_ID) {
    return;
  }

  const message = `🚨 Ошибка в LMS Bot:\n\n${errorMessage}\n\nStack:\n${errorStack?.slice(0, 500) || 'N/A'}`;
  
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_ADMIN_ID,
      text: message,
      parse_mode: 'HTML'
    })
  });
}

// Простая функция авторизации админа
export function checkAdminAuth(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = atob(base64Credentials);
  const [username, password] = credentials.split(':');

  return username === env.ADMIN_LOGIN && password === env.ADMIN_PASSWORD;
}

// HTTP ответы-хелперы
export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
} 