# Настройка Wrangler конфигурации

## Создание локального файла конфигурации

1. Скопируйте пример конфигурации:
   ```bash
   cp wrangler.jsonc.example wrangler.jsonc
   ```

2. Отредактируйте `wrangler.jsonc` и замените:
   - `your_admin_password_here` - на ваш пароль администратора
   - `your_database_id_here` - на ID вашей D1 базы данных
   - `your_kv_namespace_id_here` - на ID вашего KV namespace

## Создание ресурсов

### D1 База данных

Чтобы получить ID базы данных D1:

```bash
npx wrangler d1 list
```

### KV Namespace

Создайте KV namespace для хранения состояний бота:

```bash
npx wrangler kv:namespace create "BOT_STATE"
```

Эта команда выведет ID namespace'а, который нужно добавить в `wrangler.jsonc`.

## Важно

- ❌ **НЕ** добавляйте `wrangler.jsonc` в git
- ✅ Файл уже добавлен в `.gitignore`
- ✅ В репозитории храним только `wrangler.jsonc.example`

## Переменные среды

Для продакшена используйте переменные среды вместо локальных файлов:

```bash
# Установить переменные через wrangler
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put DATABASE_ID
``` 