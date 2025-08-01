-- SMJ LMS Database Schema (Multi-Course Support)
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

-- 3. Students table - студенты с привязкой к Telegram ID (без привязки к курсу)
CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tgid TEXT UNIQUE NOT NULL, -- Telegram User ID
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Student Courses table - связующая таблица для связи "многие ко многим"
CREATE TABLE IF NOT EXISTS student_courses (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    student_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE, -- для возможности отчисления с курса
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE(student_id, course_id) -- предотвращает дублирование записей
);

-- 5. Lessons table - уроки курсов
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

-- 6. Reports table - отчеты студентов по урокам
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

-- 7. Error logs table - для логирования ошибок системы
CREATE TABLE IF NOT EXISTS error_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    source TEXT NOT NULL, -- источник: 'telegram_bot', 'api', 'webhook' и т.д.
    message TEXT NOT NULL, -- текст ошибки
    meta TEXT, -- JSON с дополнительными данными
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Sessions table - для сессий веб-админки
CREATE TABLE IF NOT EXISTS admin_sessions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    admin_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

-- 9. Broadcasts table - для истории рассылок
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

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_students_tgid ON students(tgid);
CREATE INDEX IF NOT EXISTS idx_student_courses_student ON student_courses(student_id);
CREATE INDEX IF NOT EXISTS idx_student_courses_course ON student_courses(course_id);
CREATE INDEX IF NOT EXISTS idx_student_courses_active ON student_courses(is_active);
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
CREATE INDEX IF NOT EXISTS idx_broadcasts_course ON broadcasts(course_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_lesson ON broadcasts(lesson_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created ON broadcasts(created_at);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created_by ON broadcasts(created_by);

-- Начальные данные для тестирования

-- Создаем тестового админа (пароль: admin123)
INSERT OR IGNORE INTO admins (username, password_hash) 
VALUES ('admin', 'admin123');

-- Создаем тестовые курсы
INSERT OR IGNORE INTO courses (id, title, description) VALUES 
('01-minecraft', 'Minecraft', 'Курс по изучению Minecraft'),
('02-python', 'Python для начинающих', 'Базовый курс по Python'),
('03-web', 'Веб-разработка', 'Курс по созданию веб-сайтов');

-- Создаем тестовые уроки для курса Minecraft
INSERT OR IGNORE INTO lessons (course_id, title, order_num, content) VALUES 
('01-minecraft', 'Введение в Minecraft', 1, 'Изучите основы игры Minecraft'),
('01-minecraft', 'Добыча ресурсов', 2, 'Научитесь добывать различные ресурсы'),
('01-minecraft', 'Строительство', 3, 'Освойте основы строительства'),
('01-minecraft', 'Крафтинг', 4, 'Изучите систему крафтинга'),
('01-minecraft', 'Выживание', 5, 'Научитесь выживать в мире Minecraft');

-- Создаем тестовые уроки для курса Python
INSERT OR IGNORE INTO lessons (course_id, title, order_num, content) VALUES 
('02-python', 'Введение в Python', 1, 'Изучите основы языка Python'),
('02-python', 'Переменные и типы данных', 2, 'Узнайте о переменных и типах данных'),
('02-python', 'Условные операторы', 3, 'Изучите if/else конструкции'),
('02-python', 'Циклы', 4, 'Освойте for и while циклы'),
('02-python', 'Функции', 5, 'Научитесь создавать функции');

-- Создаем тестовые уроки для курса Веб-разработка
INSERT OR IGNORE INTO lessons (course_id, title, order_num, content) VALUES 
('03-web', 'HTML основы', 1, 'Изучите основы HTML'),
('03-web', 'CSS стили', 2, 'Научитесь стилизовать веб-страницы'),
('03-web', 'JavaScript', 3, 'Изучите основы JavaScript'),
('03-web', 'Создание сайта', 4, 'Создайте свой первый сайт'),
('03-web', 'Размещение в интернете', 5, 'Научитесь размещать сайты в интернете');

-- Создаем тестового студента
INSERT OR IGNORE INTO students (tgid, name, city) 
VALUES ('123456789', 'Иван Петров', 'Москва');

-- Зачисляем студента на несколько курсов
INSERT OR IGNORE INTO student_courses (student_id, course_id) VALUES 
((SELECT id FROM students WHERE tgid = '123456789'), '01-minecraft'),
((SELECT id FROM students WHERE tgid = '123456789'), '02-python'); 