# LMS Telegram Bot на Cloudflare

Минимальная LMS для контроля прохождения курсов учениками через Telegram-бота с админкой на React.

## Архитектура

- **Backend**: Cloudflare Workers (API + Telegram webhook)
- **Database**: Cloudflare D1 
- **Frontend**: React + Cloudflare Pages
- **Bot**: Telegram Bot API

## Структура проекта

```
smj-lms/
├── backend/           # Cloudflare Worker
├── frontend/          # React админка  
├── database/          # D1 миграции
└── docs/             # Документация
```

## Функции

### Для учеников (через Telegram):
- Просмотр текущего активного урока
- Сдача отчетов (загрузка файлов)
- История сданных уроков
- Уведомления о статусе проверки

### Для админа (веб-интерфейс):
- Управление учениками и курсами
- Проверка отчетов (принять/отклонить)
- Просмотр статистики и логов

## Быстрый старт

1. Настройте Cloudflare Workers и D1 (см. `docs/cloudflare-setup.md`)
2. Скопируйте `.env.example` в `.env` и заполните переменные
3. Задеплойте Worker: `npm run deploy`
4. Задеплойте frontend: `npm run deploy-frontend`

## Переменные окружения

Смотрите `.env.example` для полного списка необходимых переменных.

## Безопасность

⚠️ **Важно**: Секретные данные (токены, пароли, ID базы данных) НЕ хранятся в коде репозитория.

- **Секреты Cloudflare**: Устанавливаются через `wrangler secret put`
- **Database ID**: Обновляется в `wrangler.toml` после создания базы
- **Frontend переменные**: Настраиваются в Cloudflare Pages Environment Variables

См. `docs/setup-instructions.md` для подробных инструкций по безопасной настройке. 