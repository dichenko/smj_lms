// API для управления курсами

import { checkAdminAuth, jsonResponse, errorResponse } from '../worker.js';

export async function handleCoursesAPI(request, env, path) {
  // Проверяем авторизацию администратора
  if (!checkAdminAuth(request, env)) {
    return errorResponse('Unauthorized', 401);
  }

  const method = request.method;

  // GET /api/courses - список всех курсов
  if (method === 'GET' && path === '/api/courses') {
    return await getCourses(env.DB);
  }

  // POST /api/courses - создать новый курс
  if (method === 'POST' && path === '/api/courses') {
    const data = await request.json();
    return await createCourse(env.DB, data);
  }

  // POST /api/courses/:id/lessons - добавить урок в курс
  if (method === 'POST' && path.includes('/lessons')) {
    const courseId = path.split('/')[3];
    const data = await request.json();
    return await addLessonToCourse(env.DB, courseId, data);
  }

  // GET /api/courses/:id/lessons - получить уроки курса
  if (method === 'GET' && path.includes('/lessons')) {
    const courseId = path.split('/')[3];
    return await getCourseLessons(env.DB, courseId);
  }

  // DELETE /api/courses/:id - удалить курс
  if (method === 'DELETE' && path.startsWith('/api/courses/')) {
    const courseId = path.split('/')[3];
    return await deleteCourse(env.DB, courseId);
  }

  return errorResponse('Not found', 404);
}

// Получить список всех курсов
async function getCourses(db) {
  try {
    const stmt = db.prepare(`
      SELECT c.*, 
        COUNT(s.id) as students_count,
        COUNT(l.id) as lessons_count
      FROM courses c 
      LEFT JOIN students s ON c.id = s.course_id 
      LEFT JOIN lessons l ON c.id = l.course_id 
      GROUP BY c.id, c.title, c.description, c.created_at 
      ORDER BY c.created_at DESC
    `);
    const courses = await stmt.all();
    return jsonResponse(courses.results || []);
  } catch (error) {
    console.error('Error getting courses:', error);
    return errorResponse('Database error', 500);
  }
}

// Создать новый курс
async function createCourse(db, data) {
  const { title, description } = data;

  if (!title) {
    return errorResponse('Title is required');
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO courses (title, description) 
      VALUES (?, ?)
    `);
    const result = await stmt.bind(title, description || null).run();

    if (result.success) {
      return jsonResponse({ 
        id: result.meta.last_row_id, 
        title, 
        description,
        message: 'Course created successfully' 
      });
    } else {
      return errorResponse('Failed to create course', 500);
    }
  } catch (error) {
    console.error('Error creating course:', error);
    return errorResponse('Database error', 500);
  }
}

// Добавить урок в курс
async function addLessonToCourse(db, courseId, data) {
  const { title, description, links } = data;

  if (!courseId || !title) {
    return errorResponse('Course ID and title are required');
  }

  try {
    // Проверяем, существует ли курс
    const courseStmt = db.prepare('SELECT id FROM courses WHERE id = ?');
    const course = await courseStmt.bind(courseId).first();
    
    if (!course) {
      return errorResponse('Course not found', 404);
    }

    // Получаем следующий порядковый номер урока
    const orderStmt = db.prepare('SELECT COALESCE(MAX("order"), 0) + 1 as next_order FROM lessons WHERE course_id = ?');
    const orderResult = await orderStmt.bind(courseId).first();
    const nextOrder = orderResult.next_order;

    // Преобразуем массив ссылок в JSON строку
    const linksJson = links && Array.isArray(links) ? JSON.stringify(links) : null;

    const stmt = db.prepare(`
      INSERT INTO lessons (course_id, "order", title, description, links) 
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = await stmt.bind(courseId, nextOrder, title, description || null, linksJson).run();

    if (result.success) {
      return jsonResponse({ 
        id: result.meta.last_row_id,
        course_id: courseId,
        order: nextOrder,
        title, 
        description,
        links: links || [],
        message: 'Lesson added successfully' 
      });
    } else {
      return errorResponse('Failed to add lesson', 500);
    }
  } catch (error) {
    console.error('Error adding lesson:', error);
    return errorResponse('Database error', 500);
  }
}

// Получить уроки курса
async function getCourseLessons(db, courseId) {
  if (!courseId) {
    return errorResponse('Course ID is required');
  }

  try {
    const stmt = db.prepare(`
      SELECT * FROM lessons 
      WHERE course_id = ? 
      ORDER BY "order" ASC
    `);
    const lessons = await stmt.bind(courseId).all();

    // Парсим JSON ссылки
    const lessonsWithLinks = lessons.map(lesson => ({
      ...lesson,
      links: lesson.links ? JSON.parse(lesson.links) : []
    }));

    return jsonResponse(lessonsWithLinks);
  } catch (error) {
    console.error('Error getting course lessons:', error);
    return errorResponse('Database error', 500);
  }
}

// Удалить курс
async function deleteCourse(db, courseId) {
  if (!courseId) {
    return errorResponse('Course ID is required');
  }

  try {
    // Проверяем, есть ли студенты на этом курсе
    const studentsStmt = db.prepare('SELECT COUNT(*) as count FROM students WHERE course_id = ?');
    const studentsResult = await studentsStmt.bind(courseId).first();
    
    if (studentsResult.count > 0) {
      return errorResponse('Cannot delete course with enrolled students', 400);
    }

    // Удаляем все уроки курса
    const deleteLessonsStmt = db.prepare('DELETE FROM lessons WHERE course_id = ?');
    await deleteLessonsStmt.bind(courseId).run();

    // Удаляем курс
    const stmt = db.prepare('DELETE FROM courses WHERE id = ?');
    const result = await stmt.bind(courseId).run();

    if (result.changes > 0) {
      return jsonResponse({ message: 'Course deleted successfully' });
    } else {
      return errorResponse('Course not found', 404);
    }
  } catch (error) {
    console.error('Error deleting course:', error);
    return errorResponse('Database error', 500);
  }
} 