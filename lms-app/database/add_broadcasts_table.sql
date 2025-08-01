-- Миграция для добавления таблицы broadcasts
-- Выполните этот SQL в вашей базе данных D1

-- Создание таблицы broadcasts
CREATE TABLE IF NOT EXISTS broadcasts (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    course_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    message TEXT NOT NULL,
    recipient_count INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE CASCADE
);

-- Создание индексов для оптимизации
CREATE INDEX IF NOT EXISTS idx_broadcasts_course ON broadcasts(course_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_lesson ON broadcasts(lesson_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created ON broadcasts(created_at);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created_by ON broadcasts(created_by);

-- Проверка создания таблицы
SELECT name FROM sqlite_master WHERE type='table' AND name='broadcasts'; 