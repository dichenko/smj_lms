// API для статистики и аналитики

import { checkAdminAuth, jsonResponse, errorResponse } from '../worker.js';

export async function handleStatsAPI(request, env, path) {
  // Проверяем авторизацию администратора
  if (!checkAdminAuth(request, env)) {
    return errorResponse('Unauthorized', 401);
  }

  const method = request.method;

  // GET /api/stats/courses - статистика по курсам
  if (method === 'GET' && path === '/api/stats/courses') {
    return await getCoursesStats(env.DB);
  }

  // GET /api/stats/students - статистика по студентам
  if (method === 'GET' && path === '/api/stats/students') {
    return await getStudentsStats(env.DB);
  }

  // GET /api/stats/dashboard - общая статистика для дашборда
  if (method === 'GET' && path === '/api/stats/dashboard') {
    return await getDashboardStats(env.DB);
  }

  return errorResponse('Not found', 404);
}

// Получить статистику по курсам
async function getCoursesStats(db) {
  try {
    const stmt = db.prepare(`
      SELECT 
        c.id,
        c.title,
        COUNT(DISTINCT s.id) as students_count,
        COUNT(DISTINCT l.id) as lessons_count,
        COUNT(DISTINCT r.id) as reports_count
      FROM courses c
      LEFT JOIN students s ON c.id = s.course_id
      LEFT JOIN lessons l ON c.id = l.course_id
      LEFT JOIN reports r ON s.id = r.student_id
      GROUP BY c.id, c.title
      ORDER BY c.title
    `);

    const coursesStats = await stmt.all();
    return jsonResponse(coursesStats.results || []);
  } catch (error) {
    console.error('Error getting courses stats:', error);
    return errorResponse('Database error', 500);
  }
}

// Получить статистику по студентам
async function getStudentsStats(db) {
  try {
    const stmt = db.prepare(`
      SELECT 
        s.id,
        s.name,
        s.tg_id,
        c.title as course_title,
        s.active_lesson,
        COUNT(r.id) as reports_count,
        COUNT(CASE WHEN r.status = 'approved' THEN 1 END) as approved_reports,
        COUNT(CASE WHEN r.status = 'rejected' THEN 1 END) as rejected_reports,
        MAX(r.submitted_at) as last_report_date
      FROM students s
      LEFT JOIN courses c ON s.course_id = c.id
      LEFT JOIN reports r ON s.id = r.student_id
      GROUP BY s.id, s.name, s.tg_id, c.title, s.active_lesson
      ORDER BY s.name
    `);

    const studentsStats = await stmt.all();
    return jsonResponse(studentsStats.results || []);
  } catch (error) {
    console.error('Error getting students stats:', error);
    return errorResponse('Database error', 500);
  }
}

// Получить статистику для дашборда
async function getDashboardStats(db) {
  try {
    // Общая статистика
    const overallStmt = db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM students) as total_students,
        (SELECT COUNT(*) FROM courses) as total_courses,
        (SELECT COUNT(*) FROM lessons) as total_lessons,
        (SELECT COUNT(*) FROM reports) as total_reports,
        (SELECT COUNT(*) FROM reports WHERE status = 'approved') as approved_reports,
        (SELECT COUNT(*) FROM reports WHERE status = 'rejected') as rejected_reports,
        (SELECT COUNT(*) FROM reports WHERE status = 'pending') as pending_reports
    `);
    const overall = await overallStmt.first();

    // Активность за последние 7 дней
    const activityStmt = db.prepare(`
      SELECT 
        DATE(submitted_at) as date,
        COUNT(*) as reports_count
      FROM reports 
      WHERE submitted_at >= datetime('now', '-7 days')
      GROUP BY DATE(submitted_at)
      ORDER BY date DESC
    `);
    const recentActivity = await activityStmt.all();

    // Топ активных студентов
    const topStudentsStmt = db.prepare(`
      SELECT 
        s.name,
        COUNT(r.id) as reports_count,
        COUNT(CASE WHEN r.status = 'approved' THEN 1 END) as approved_count
      FROM students s
      LEFT JOIN reports r ON s.id = r.student_id
      GROUP BY s.id, s.name
      HAVING reports_count > 0
      ORDER BY approved_count DESC, reports_count DESC
      LIMIT 5
    `);
    const topStudents = await topStudentsStmt.all();

    return jsonResponse({
      overall,
      recent_activity: recentActivity.results || [],
      top_students: topStudents.results || []
    });
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    return errorResponse('Database error', 500);
  }
} 