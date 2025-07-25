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

// Статистика по курсам
async function getCoursesStats(db) {
  try {
    const stmt = db.prepare(`
      SELECT 
        c.id,
        c.title,
        COUNT(DISTINCT s.id) as total_students,
        COUNT(DISTINCT l.id) as total_lessons,
        COUNT(DISTINCT CASE WHEN r.status = 'approved' THEN r.id END) as approved_reports,
        COUNT(DISTINCT CASE WHEN r.status = 'pending' THEN r.id END) as pending_reports,
        COUNT(DISTINCT CASE WHEN r.status = 'rejected' THEN r.id END) as rejected_reports,
        ROUND(
          CASE 
            WHEN COUNT(DISTINCT l.id) * COUNT(DISTINCT s.id) > 0 
            THEN (COUNT(DISTINCT CASE WHEN r.status = 'approved' THEN r.id END) * 100.0) / 
                 (COUNT(DISTINCT l.id) * COUNT(DISTINCT s.id))
            ELSE 0 
          END, 2
        ) as completion_percentage
      FROM courses c
      LEFT JOIN students s ON c.id = s.course_id
      LEFT JOIN lessons l ON c.id = l.course_id
      LEFT JOIN reports r ON l.id = r.lesson_id AND s.id = r.student_id
      GROUP BY c.id, c.title
      ORDER BY c.title
    `);

    const coursesStats = await stmt.all();
    return jsonResponse(coursesStats);
  } catch (error) {
    console.error('Error getting courses stats:', error);
    return errorResponse('Database error', 500);
  }
}

// Статистика по студентам
async function getStudentsStats(db) {
  try {
    const stmt = db.prepare(`
      SELECT 
        s.id,
        s.name,
        s.tg_id,
        c.title as course_title,
        s.active_lesson,
        COUNT(DISTINCT l.id) as total_lessons,
        COUNT(DISTINCT CASE WHEN r.status = 'approved' THEN r.id END) as completed_lessons,
        COUNT(DISTINCT CASE WHEN r.status = 'pending' THEN r.id END) as pending_reports,
        COUNT(DISTINCT CASE WHEN r.status = 'rejected' THEN r.id END) as rejected_reports,
        ROUND(
          CASE 
            WHEN COUNT(DISTINCT l.id) > 0 
            THEN (COUNT(DISTINCT CASE WHEN r.status = 'approved' THEN r.id END) * 100.0) / COUNT(DISTINCT l.id)
            ELSE 0 
          END, 2
        ) as progress_percentage,
        MAX(r.submitted_at) as last_activity
      FROM students s
      LEFT JOIN courses c ON s.course_id = c.id
      LEFT JOIN lessons l ON c.id = l.course_id
      LEFT JOIN reports r ON s.id = r.student_id
      GROUP BY s.id, s.name, s.tg_id, c.title, s.active_lesson
      ORDER BY s.name
    `);

    const studentsStats = await stmt.all();
    return jsonResponse(studentsStats);
  } catch (error) {
    console.error('Error getting students stats:', error);
    return errorResponse('Database error', 500);
  }
}

// Общая статистика для дашборда
async function getDashboardStats(db) {
  try {
    // Общие цифры
    const overallStmt = db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM students) as total_students,
        (SELECT COUNT(*) FROM courses) as total_courses,
        (SELECT COUNT(*) FROM lessons) as total_lessons,
        (SELECT COUNT(*) FROM reports WHERE status = 'pending') as pending_reports,
        (SELECT COUNT(*) FROM reports WHERE status = 'approved') as approved_reports,
        (SELECT COUNT(*) FROM reports WHERE status = 'rejected') as rejected_reports
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
      recent_activity: recentActivity,
      top_students: topStudents
    });
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    return errorResponse('Database error', 500);
  }
} 