-- SMJ LMS Database Schema
-- Cloudflare D1 (SQLite) compatible

-- 1. Admins table - для аутентификации админов веб-интерфейса
CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Courses table - курсы обучения
CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    title TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Students table - студенты с привязкой к Telegram ID
CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tgid TEXT UNIQUE NOT NULL, -- Telegram User ID
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    course_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- 4. Lessons table - уроки курсов
CREATE TABLE IF NOT EXISTS lessons (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    course_id TEXT NOT NULL,
    title TEXT NOT NULL,
    order_num INTEGER NOT NULL, -- порядковый номер урока
    content TEXT NOT NULL, -- содержание урока
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE(course_id, order_num) -- один урок на позицию в курсе
);

-- 5. Reports table - отчеты студентов по урокам
CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    student_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_comment TEXT NULL, -- комментарий админа при отклонении
    reviewed_at DATETIME NULL, -- дата рецензирования
    reviewed_by TEXT NULL, -- ID админа, который рецензировал
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES admins(id),
    UNIQUE(student_id, lesson_id) -- один отчет на урок от студента
);

-- 6. Error logs table - для логирования ошибок системы
CREATE TABLE IF NOT EXISTS error_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    source TEXT NOT NULL, -- источник: 'telegram_bot', 'api', 'webhook' и т.д.
    message TEXT NOT NULL, -- текст ошибки
    meta TEXT, -- JSON с дополнительными данными
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Sessions table - для сессий веб-админки
CREATE TABLE IF NOT EXISTS admin_sessions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    admin_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_students_tgid ON students(tgid);
CREATE INDEX IF NOT EXISTS idx_students_course ON students(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_order ON lessons(course_id, order_num);
CREATE INDEX IF NOT EXISTS idx_reports_student ON reports(student_id);
CREATE INDEX IF NOT EXISTS idx_reports_lesson ON reports(lesson_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_error_logs_source ON error_logs(source);
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_id ON admin_sessions(id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON admin_sessions(is_active);

-- Начальные данные для тестирования

-- Создаем тестового админа (пароль: admin123)
INSERT OR IGNORE INTO admins (username, password_hash) 
VALUES ('admin', 'admin123');

-- Создаем тестовый курс
INSERT OR IGNORE INTO courses (id, title, description) 
VALUES ('course-test-1', 'Основы программирования', 'Базовый курс по изучению основ программирования');

-- Создаем тестовые уроки
INSERT OR IGNORE INTO lessons (course_id, title, order_num, content) VALUES 
('course-test-1', 'Введение в программирование', 1, 'Изучите основные концепции программирования'),
('course-test-1', 'Переменные и типы данных', 2, 'Узнайте о переменных и различных типах данных'),
('course-test-1', 'Условные операторы', 3, 'Изучите if/else и другие условные конструкции'),
('course-test-1', 'Циклы', 4, 'Освойте for, while и другие виды циклов'),
('course-test-1', 'Функции', 5, 'Научитесь создавать и использовать функции');

-- Создаем тестового студента
INSERT OR IGNORE INTO students (tgid, name, city, course_id) 
VALUES ('123456789', 'Иван Петров', 'Москва', 'course-test-1'); 