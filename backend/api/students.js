// API для управления студентами

import { checkAdminAuth, jsonResponse, errorResponse } from '../worker.js';

export async function handleStudentsAPI(request, env, path) {
  // Проверяем авторизацию администратора
  if (!checkAdminAuth(request, env)) {
    return errorResponse('Unauthorized', 401);
  }

  const url = new URL(request.url);
  const method = request.method;

  // GET /api/students - список всех студентов
  if (method === 'GET' && path === '/api/students') {
    return await getStudents(env.DB);
  }

  // POST /api/students - добавить нового студента
  if (method === 'POST' && path === '/api/students') {
    const data = await request.json();
    return await createStudent(env.DB, data);
  }

  // DELETE /api/students/:id - удалить студента
  if (method === 'DELETE' && path.startsWith('/api/students/')) {
    const studentId = path.split('/')[3];
    return await deleteStudent(env.DB, studentId);
  }

  // POST /api/students/:id/assign-course - назначить курс студенту
  if (method === 'POST' && path.includes('/assign-course')) {
    const studentId = path.split('/')[3];
    const data = await request.json();
    return await assignCourse(env.DB, studentId, data.course_id);
  }

  return errorResponse('Not found', 404);
}

// Получить список всех студентов
async function getStudents(db) {
  try {
    const stmt = db.prepare(`
      SELECT s.*, c.title as course_title 
      FROM students s 
      LEFT JOIN courses c ON s.course_id = c.id 
      ORDER BY s.created_at DESC
    `);
    const students = await stmt.all();
    return jsonResponse(students);
  } catch (error) {
    console.error('Error getting students:', error);
    return errorResponse('Database error', 500);
  }
}

// Создать нового студента
async function createStudent(db, data) {
  const { tg_id, name } = data;

  if (!tg_id || !name) {
    return errorResponse('tg_id and name are required');
  }

  try {
    // Проверяем, не существует ли уже студент с таким tg_id
    const existingStmt = db.prepare('SELECT id FROM students WHERE tg_id = ?');
    const existing = await existingStmt.bind(tg_id).first();
    
    if (existing) {
      return errorResponse('Student with this Telegram ID already exists');
    }

    const stmt = db.prepare(`
      INSERT INTO students (tg_id, name) 
      VALUES (?, ?)
    `);
    const result = await stmt.bind(tg_id, name).run();

    if (result.success) {
      return jsonResponse({ 
        id: result.meta.last_row_id, 
        tg_id, 
        name,
        message: 'Student created successfully' 
      });
    } else {
      return errorResponse('Failed to create student', 500);
    }
  } catch (error) {
    console.error('Error creating student:', error);
    return errorResponse('Database error', 500);
  }
}

// Удалить студента
async function deleteStudent(db, studentId) {
  if (!studentId) {
    return errorResponse('Student ID is required');
  }

  try {
    // Сначала удаляем все отчеты студента
    const deleteReportsStmt = db.prepare('DELETE FROM reports WHERE student_id = ?');
    await deleteReportsStmt.bind(studentId).run();

    // Затем удаляем самого студента
    const stmt = db.prepare('DELETE FROM students WHERE id = ?');
    const result = await stmt.bind(studentId).run();

    if (result.changes > 0) {
      return jsonResponse({ message: 'Student deleted successfully' });
    } else {
      return errorResponse('Student not found', 404);
    }
  } catch (error) {
    console.error('Error deleting student:', error);
    return errorResponse('Database error', 500);
  }
}

// Назначить курс студенту
async function assignCourse(db, studentId, courseId) {
  if (!studentId || !courseId) {
    return errorResponse('Student ID and Course ID are required');
  }

  try {
    // Проверяем, существуют ли студент и курс
    const studentStmt = db.prepare('SELECT id FROM students WHERE id = ?');
    const student = await studentStmt.bind(studentId).first();
    
    if (!student) {
      return errorResponse('Student not found', 404);
    }

    const courseStmt = db.prepare('SELECT id FROM courses WHERE id = ?');
    const course = await courseStmt.bind(courseId).first();
    
    if (!course) {
      return errorResponse('Course not found', 404);
    }

    // Назначаем курс и сбрасываем активный урок на 1
    const stmt = db.prepare(`
      UPDATE students 
      SET course_id = ?, active_lesson = 1 
      WHERE id = ?
    `);
    const result = await stmt.bind(courseId, studentId).run();

    if (result.changes > 0) {
      return jsonResponse({ message: 'Course assigned successfully' });
    } else {
      return errorResponse('Failed to assign course', 500);
    }
  } catch (error) {
    console.error('Error assigning course:', error);
    return errorResponse('Database error', 500);
  }
} 