-- Добавление тестового студента для проверки Telegram бота
-- Замените YOUR_CHAT_ID на ваш реальный Chat ID

INSERT OR IGNORE INTO students (id, tgid, name, city, course_id) 
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'YOUR_CHAT_ID',  -- Замените на ваш Chat ID
  'Тестовый Студент',
  'Москва',
  '550e8400-e29b-41d4-a716-446655440001'
);

-- Проверка добавления
SELECT * FROM students WHERE tgid = 'YOUR_CHAT_ID'; 