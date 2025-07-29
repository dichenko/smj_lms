# Настройка Wrangler конфигурации

## Создание локального файла конфигурации

1. Скопируйте пример конфигурации:
   ```bash
   cp wrangler.jsonc.example wrangler.jsonc
   ```

2. Отредактируйте `wrangler.jsonc` и замените:
   - `your_admin_password_here` - на ваш пароль администратора
   - `your_database_id_here` - на ID вашей D1 базы данных

## Получение ID базы данных

Чтобы получить ID базы данных D1:

```bash
npx wrangler d1 list
```

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