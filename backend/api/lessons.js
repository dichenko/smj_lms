// API для управления уроками

import { checkAdminAuth, jsonResponse, errorResponse } from '../worker.js';

export async function handleLessonsAPI(request, env, path) {
  // Проверяем авторизацию администратора
  if (!checkAdminAuth(request, env)) {
    return errorResponse('Unauthorized', 401);
  }

  const method = request.method;

  // PATCH /api/lessons/:id - редактировать урок
  if (method === 'PATCH' && path.startsWith('/api/lessons/')) {
    const lessonId = path.split('/')[3];
    const data = await request.json();
    return await updateLesson(env.DB, lessonId, data);
  }

  // DELETE /api/lessons/:id - удалить урок
  if (method === 'DELETE' && path.startsWith('/api/lessons/')) {
    const lessonId = path.split('/')[3];
    return await deleteLesson(env.DB, lessonId);
  }

  // GET /api/lessons/:id - получить урок по ID
  if (method === 'GET' && path.startsWith('/api/lessons/')) {
    const lessonId = path.split('/')[3];
    return await getLesson(env.DB, lessonId);
  }

  return errorResponse('Not found', 404);
}

// Получить урок по ID
async function getLesson(db, lessonId) {
  if (!lessonId) {
    return errorResponse('Lesson ID is required');
  }

  try {
    const stmt = db.prepare(`
      SELECT l.*, c.title as course_title 
      FROM lessons l
      JOIN courses c ON l.course_id = c.id
      WHERE l.id = ?
    `);
    const lesson = await stmt.bind(lessonId).first();

    if (!lesson) {
      return errorResponse('Lesson not found', 404);
    }

    // Парсим JSON ссылки
    lesson.links = lesson.links ? JSON.parse(lesson.links) : [];

    return jsonResponse(lesson);
  } catch (error) {
    console.error('Error getting lesson:', error);
    return errorResponse('Database error', 500);
  }
}

// Редактировать урок
async function updateLesson(db, lessonId, data) {
  const { title, description, links } = data;

  if (!lessonId) {
    return errorResponse('Lesson ID is required');
  }

  if (!title) {
    return errorResponse('Title is required');
  }

  try {
    // Проверяем, существует ли урок
    const existingStmt = db.prepare('SELECT id FROM lessons WHERE id = ?');
    const existing = await existingStmt.bind(lessonId).first();
    
    if (!existing) {
      return errorResponse('Lesson not found', 404);
    }

    // Преобразуем массив ссылок в JSON строку
    const linksJson = links && Array.isArray(links) ? JSON.stringify(links) : null;

    const stmt = db.prepare(`
      UPDATE lessons 
      SET title = ?, description = ?, links = ?
      WHERE id = ?
    `);
    const result = await stmt.bind(title, description || null, linksJson, lessonId).run();

    if (result.changes > 0) {
      return jsonResponse({ 
        id: lessonId,
        title, 
        description,
        links: links || [],
        message: 'Lesson updated successfully' 
      });
    } else {
      return errorResponse('Failed to update lesson', 500);
    }
  } catch (error) {
    console.error('Error updating lesson:', error);
    return errorResponse('Database error', 500);
  }
}

// Удалить урок
async function deleteLesson(db, lessonId) {
  if (!lessonId) {
    return errorResponse('Lesson ID is required');
  }

  try {
    // Проверяем, есть ли отчеты по этому уроку
    const reportsStmt = db.prepare('SELECT COUNT(*) as count FROM reports WHERE lesson_id = ?');
    const reportsResult = await reportsStmt.bind(lessonId).first();
    
    if (reportsResult.count > 0) {
      return errorResponse('Cannot delete lesson with existing reports', 400);
    }

    // Получаем информацию об уроке для перенумерации
    const lessonStmt = db.prepare('SELECT course_id, "order" FROM lessons WHERE id = ?');
    const lesson = await lessonStmt.bind(lessonId).first();
    
    if (!lesson) {
      return errorResponse('Lesson not found', 404);
    }

    // Удаляем урок
    const deleteStmt = db.prepare('DELETE FROM lessons WHERE id = ?');
    const deleteResult = await deleteStmt.bind(lessonId).run();

    if (deleteResult.changes === 0) {
      return errorResponse('Failed to delete lesson', 500);
    }

    // Перенумеровываем оставшиеся уроки в курсе
    const updateOrderStmt = db.prepare(`
      UPDATE lessons 
      SET "order" = "order" - 1 
      WHERE course_id = ? AND "order" > ?
    `);
    await updateOrderStmt.bind(lesson.course_id, lesson.order).run();

    // Обновляем активные уроки студентов, если они были больше удаленного
    const updateStudentsStmt = db.prepare(`
      UPDATE students 
      SET active_lesson = active_lesson - 1 
      WHERE course_id = ? AND active_lesson > ?
    `);
    await updateStudentsStmt.bind(lesson.course_id, lesson.order).run();

    return jsonResponse({ message: 'Lesson deleted successfully' });
  } catch (error) {
    console.error('Error deleting lesson:', error);
    return errorResponse('Database error', 500);
  }
} 