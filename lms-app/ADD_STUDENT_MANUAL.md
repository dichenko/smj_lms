# Инструкция по добавлению студентов через интерфейс Cloudflare

## Важно!
При добавлении нового студента **НЕ УКАЗЫВАЙТЕ** поле `id` - оно генерируется автоматически как UUID.

## Шаги добавления студента:

### 1. Откройте таблицу `students`
- Перейдите в Cloudflare Dashboard
- Выберите ваш Worker
- Перейдите в раздел D1 Database
- Откройте таблицу `students`

### 2. Добавьте новую запись
Заполните только следующие поля:
- `tgid` - Telegram ID студента (обязательно)
- `name` - Имя студента (обязательно)  
- `city` - Город студента (обязательно)

**НЕ ЗАПОЛНЯЙТЕ:**
- `id` - оставьте пустым (генерируется автоматически)
- `created_at` - оставьте пустым (устанавливается автоматически)
- `updated_at` - оставьте пустым (устанавливается автоматически)

### 3. Зачислите студента на курс
После создания студента нужно зачислить его на курс:

#### Через интерфейс Cloudflare:
1. Откройте таблицу `student_courses`
2. Добавьте новую запись:
   - `student_id` - ID созданного студента
   - `course_id` - ID курса (например, '01-minecraft')
   - `is_active` - установите `1` (true)

#### Через API (рекомендуется):
```bash
# Получить ID студента
npx wrangler d1 execute DB --command="SELECT id FROM students WHERE tgid = 'TELEGRAM_ID';" --remote

# Зачислить на курс
npx wrangler d1 execute DB --command="INSERT INTO student_courses (student_id, course_id, is_active) VALUES ('STUDENT_ID', '01-minecraft', 1);" --remote
```

## Примеры:

### Добавление студента через SQL:
```sql
-- Создать студента
INSERT INTO students (tgid, name, city) 
VALUES ('123456789', 'Иван Петров', 'Москва');

-- Зачислить на курс
INSERT INTO student_courses (student_id, course_id, is_active) 
VALUES (
  (SELECT id FROM students WHERE tgid = '123456789'), 
  '01-minecraft', 
  1
);
```

### Добавление студента на несколько курсов:
```sql
-- Создать студента
INSERT INTO students (tgid, name, city) 
VALUES ('987654321', 'Мария Сидорова', 'Санкт-Петербург');

-- Зачислить на несколько курсов
INSERT INTO student_courses (student_id, course_id, is_active) VALUES 
((SELECT id FROM students WHERE tgid = '987654321'), '01-minecraft', 1),
((SELECT id FROM students WHERE tgid = '987654321'), '02-python', 1);
```

## Доступные курсы:
- `01-minecraft` - Minecraft
- `02-python` - Python для начинающих  
- `03-web` - Веб-разработка

## Проверка:
После добавления проверьте:
```sql
-- Проверить студента
SELECT * FROM students WHERE tgid = 'TELEGRAM_ID';

-- Проверить курсы студента
SELECT 
  s.name,
  c.title as course_title
FROM students s
JOIN student_courses sc ON s.id = sc.student_id
JOIN courses c ON sc.course_id = c.id
WHERE s.tgid = 'TELEGRAM_ID' AND sc.is_active = 1;
``` 