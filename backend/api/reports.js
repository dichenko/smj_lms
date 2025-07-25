// API для управления отчетами

import { checkAdminAuth, jsonResponse, errorResponse } from '../worker.js';
import { notifyStudent } from '../telegram/bot.js';

export async function handleReportsAPI(request, env, path) {
  // Проверяем авторизацию администратора
  if (!checkAdminAuth(request, env)) {
    return errorResponse('Unauthorized', 401);
  }

  const url = new URL(request.url);
  const method = request.method;

  // GET /api/reports - список всех отчетов с фильтрацией
  if (method === 'GET' && path === '/api/reports') {
    const courseId = url.searchParams.get('course_id');
    const studentId = url.searchParams.get('student_id');
    const lessonId = url.searchParams.get('lesson_id');
    const status = url.searchParams.get('status');
    
    return await getReports(env.DB, { courseId, studentId, lessonId, status });
  }

  // GET /api/reports/:id - детали отчета
  if (method === 'GET' && path.startsWith('/api/reports/')) {
    const reportId = path.split('/')[3];
    return await getReport(env.DB, reportId);
  }

  // POST /api/reports/:id/approve - принять отчет
  if (method === 'POST' && path.includes('/approve')) {
    const reportId = path.split('/')[3];
    const data = await request.json();
    return await approveReport(env, reportId, data.comment);
  }

  // POST /api/reports/:id/reject - отклонить отчет
  if (method === 'POST' && path.includes('/reject')) {
    const reportId = path.split('/')[3];
    const data = await request.json();
    return await rejectReport(env, reportId, data.comment);
  }

  return errorResponse('Not found', 404);
}

// Получить список отчетов с фильтрацией
async function getReports(db, filters) {
  try {
    let query = `
      SELECT r.*, 
             s.name as student_name, s.tg_id as student_tg_id,
             l.title as lesson_title, l."order" as lesson_order,
             c.title as course_title
      FROM reports r
      JOIN students s ON r.student_id = s.id
      JOIN lessons l ON r.lesson_id = l.id
      JOIN courses c ON l.course_id = c.id
      WHERE 1=1
    `;

    const params = [];

    if (filters.courseId) {
      query += ' AND c.id = ?';
      params.push(filters.courseId);
    }

    if (filters.studentId) {
      query += ' AND s.id = ?';
      params.push(filters.studentId);
    }

    if (filters.lessonId) {
      query += ' AND l.id = ?';
      params.push(filters.lessonId);
    }

    if (filters.status) {
      query += ' AND r.status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY r.submitted_at DESC';

    const stmt = db.prepare(query);
    const reports = await stmt.bind(...params).all();

    return jsonResponse(reports);
  } catch (error) {
    console.error('Error getting reports:', error);
    return errorResponse('Database error', 500);
  }
}

// Получить детали отчета
async function getReport(db, reportId) {
  if (!reportId) {
    return errorResponse('Report ID is required');
  }

  try {
    const stmt = db.prepare(`
      SELECT r.*, 
             s.name as student_name, s.tg_id as student_tg_id,
             l.title as lesson_title, l.description as lesson_description, l."order" as lesson_order,
             c.title as course_title
      FROM reports r
      JOIN students s ON r.student_id = s.id
      JOIN lessons l ON r.lesson_id = l.id
      JOIN courses c ON l.course_id = c.id
      WHERE r.id = ?
    `);
    const report = await stmt.bind(reportId).first();

    if (!report) {
      return errorResponse('Report not found', 404);
    }

    return jsonResponse(report);
  } catch (error) {
    console.error('Error getting report:', error);
    return errorResponse('Database error', 500);
  }
}

// Принять отчет
async function approveReport(env, reportId, comment = null) {
  if (!reportId) {
    return errorResponse('Report ID is required');
  }

  try {
    // Получаем детали отчета
    const reportStmt = env.DB.prepare(`
      SELECT r.*, s.tg_id, s.active_lesson, s.course_id, l.title as lesson_title, l."order" as lesson_order
      FROM reports r
      JOIN students s ON r.student_id = s.id
      JOIN lessons l ON r.lesson_id = l.id
      WHERE r.id = ?
    `);
    const report = await reportStmt.bind(reportId).first();

    if (!report) {
      return errorResponse('Report not found', 404);
    }

    if (report.status === 'approved') {
      return errorResponse('Report already approved', 400);
    }

    // Обновляем статус отчета
    const updateReportStmt = env.DB.prepare(`
      UPDATE reports 
      SET status = 'approved', admin_comment = ?, checked_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    await updateReportStmt.bind(comment, reportId).run();

    // Если это текущий активный урок студента, переводим на следующий
    if (report.lesson_order === report.active_lesson) {
      const updateStudentStmt = env.DB.prepare(`
        UPDATE students 
        SET active_lesson = active_lesson + 1 
        WHERE id = ?
      `);
      await updateStudentStmt.bind(report.student_id).run();
    }

    // Уведомляем студента
    await notifyStudent(env, report.tg_id, report.lesson_title, 'approved', comment);

    return jsonResponse({ 
      message: 'Report approved successfully',
      report_id: reportId 
    });
  } catch (error) {
    console.error('Error approving report:', error);
    return errorResponse('Database error', 500);
  }
}

// Отклонить отчет
async function rejectReport(env, reportId, comment = null) {
  if (!reportId) {
    return errorResponse('Report ID is required');
  }

  try {
    // Получаем детали отчета
    const reportStmt = env.DB.prepare(`
      SELECT r.*, s.tg_id, l.title as lesson_title
      FROM reports r
      JOIN students s ON r.student_id = s.id
      JOIN lessons l ON r.lesson_id = l.id
      WHERE r.id = ?
    `);
    const report = await reportStmt.bind(reportId).first();

    if (!report) {
      return errorResponse('Report not found', 404);
    }

    if (report.status === 'approved') {
      return errorResponse('Cannot reject approved report', 400);
    }

    // Обновляем статус отчета
    const updateReportStmt = env.DB.prepare(`
      UPDATE reports 
      SET status = 'rejected', admin_comment = ?, checked_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    await updateReportStmt.bind(comment, reportId).run();

    // Уведомляем студента
    await notifyStudent(env, report.tg_id, report.lesson_title, 'rejected', comment);

    return jsonResponse({ 
      message: 'Report rejected successfully',
      report_id: reportId 
    });
  } catch (error) {
    console.error('Error rejecting report:', error);
    return errorResponse('Database error', 500);
  }
} 