-- LMS Database Schema for Cloudflare D1

-- Студенты
CREATE TABLE students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tg_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    course_id INTEGER,
    active_lesson INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- Курсы
CREATE TABLE courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Уроки
CREATE TABLE lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    links TEXT, -- JSON array со ссылками
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- Отчеты
CREATE TABLE reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    lesson_id INTEGER NOT NULL,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    admin_comment TEXT,
    telegram_file_id TEXT,
    checked_at DATETIME,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (lesson_id) REFERENCES lessons(id)
);

-- Создаем индексы для оптимизации запросов
CREATE INDEX idx_students_tg_id ON students(tg_id);
CREATE INDEX idx_reports_student_lesson ON reports(student_id, lesson_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_lessons_course_order ON lessons(course_id, "order"); 