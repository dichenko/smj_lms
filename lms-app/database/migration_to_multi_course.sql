-- Миграция базы данных для поддержки множественных курсов
-- Выполнять пошагово!

-- Шаг 1: Создаем новую таблицу student_courses
CREATE TABLE IF NOT EXISTS student_courses (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    student_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE(student_id, course_id)
);

-- Шаг 2: Переносим существующие связи студентов с курсами
INSERT INTO student_courses (student_id, course_id, enrolled_at)
SELECT id, course_id, created_at 
FROM students 
WHERE course_id IS NOT NULL;

-- Шаг 3: Создаем временную таблицу для студентов
CREATE TABLE students_temp (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tgid TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Шаг 4: Копируем данные студентов без course_id
INSERT INTO students_temp (id, tgid, name, city, created_at, updated_at)
SELECT id, tgid, name, city, created_at, updated_at
FROM students;

-- Шаг 5: Удаляем старую таблицу students
DROP TABLE students;

-- Шаг 6: Переименовываем временную таблицу
ALTER TABLE students_temp RENAME TO students;

-- Шаг 7: Создаем индексы для новой таблицы student_courses
CREATE INDEX IF NOT EXISTS idx_student_courses_student ON student_courses(student_id);
CREATE INDEX IF NOT EXISTS idx_student_courses_course ON student_courses(course_id);
CREATE INDEX IF NOT EXISTS idx_student_courses_active ON student_courses(is_active);

-- Шаг 8: Удаляем старый индекс (если существует)
DROP INDEX IF EXISTS idx_students_course; 