import { Hono } from "hono";
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { DatabaseService } from './utils/database';
import { AuthService } from './auth/session';
import { D1Database, Fetcher } from '@cloudflare/workers-types';
import { handleTelegramWebhook } from './telegram/webhook';

// Типы для TypeScript
interface Env {
  DB: D1Database;
  BOT_STATE: KVNamespace;
  ASSETS: Fetcher;
  ENVIRONMENT: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_ADMIN_CHAT_ID?: string;
}

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

interface Variables {
  db: DatabaseService;
  auth: AuthService;
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Middleware
app.use('*', logger());
app.use('/api/*', cors({
  origin: ['http://localhost:3000', 'https://*.workers.dev'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Middleware для создания database service и auth service
app.use('/api/*', async (c, next) => {
  const db = new DatabaseService(c.env.DB);
  const auth = new AuthService(db);
  c.set('db', db);
  c.set('auth', auth);
  await next();
});

// API Routes
const api = new Hono<{ Bindings: Env; Variables: Variables }>();

// Health check
api.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT 
  });
});

// Auth routes (для админа)
api.post('/auth/login', async (c) => {
  try {
    const auth = c.get('auth');
    const body = await c.req.json();
    
    if (!body.username || !body.password) {
      return c.json({ error: 'Username and password required' }, 400);
    }

    const result = await auth.authenticateAdmin({
      username: body.username,
      password: body.password
    });

    if (result.success && result.sessionId) {
      // Устанавливаем cookie с session ID
      c.header('Set-Cookie', `session=${result.sessionId}; HttpOnly; Path=/; Max-Age=86400; SameSite=Strict`);
      return c.json({ success: true, message: 'Login successful' });
    } else {
      return c.json({ error: result.error || 'Authentication failed' }, 401);
    }
  } catch (error: any) {
    return c.json({ error: 'Login error' }, 500);
  }
});

api.post('/auth/logout', async (c) => {
  try {
    const auth = c.get('auth');
    const sessionId = c.req.header('Cookie')?.match(/session=([^;]+)/)?.[1];
    
    if (sessionId) {
      await auth.logout(sessionId);
    }
    
    // Удаляем cookie
    c.header('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict');
    return c.json({ success: true, message: 'Logout successful' });
  } catch (error: any) {
    return c.json({ error: 'Logout error' }, 500);
  }
});

// Проверка аутентификации
api.get('/auth/check', async (c) => {
  try {
    const auth = c.get('auth');
    const sessionId = c.req.header('Cookie')?.match(/session=([^;]+)/)?.[1];
    
    if (!sessionId) {
      return c.json({ authenticated: false }, 401);
    }

    const validation = await auth.validateSession(sessionId);
    
    if (validation.valid) {
      return c.json({ authenticated: true, adminId: validation.adminId });
    } else {
      return c.json({ authenticated: false, error: validation.error }, 401);
    }
  } catch (error: any) {
    return c.json({ authenticated: false, error: 'Session check error' }, 500);
  }
});

// Middleware для проверки аутентификации
const requireAuth = async (c: any, next: any) => {
  const sessionId = c.req.header('Cookie')?.match(/session=([^;]+)/)?.[1];
  
  if (!sessionId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const auth = c.get('auth');
  const validation = await auth.validateSession(sessionId);
  
  if (!validation.valid) {
    c.header('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict');
    return c.json({ error: validation.error || 'Invalid session' }, 401);
  }

  c.set('adminId', validation.adminId);
  await next();
};

// Students routes
api.get('/students', requireAuth, async (c) => {
  try {
    const db = c.get('db');
    const students = await db.getAllStudents();
    return c.json({ students });
  } catch (error: any) {
    const db = c.get('db');
    await db.logError({
      source: 'api',
      message: `Failed to get students: ${error.message}`,
      meta: { error: error.toString() }
    });
    return c.json({ error: 'Failed to get students' }, 500);
  }
});

// Детальный прогресс студентов
api.get('/students/progress', requireAuth, async (c) => {
  try {
    const db = c.get('db');
    const progress = await db.getDetailedStudentProgress();
    return c.json({ progress });
  } catch (error: any) {
    const db = c.get('db');
    await db.logError({
      source: 'api',
      message: `Failed to get student progress: ${error.message}`,
      meta: { error: error.toString() }
    });
    return c.json({ error: 'Failed to get student progress' }, 500);
  }
});

api.post('/students', requireAuth, async (c) => {
  try {
    const db = c.get('db');
    const body = await c.req.json();
    
    if (!body.tgid || !body.name || !body.city) {
      return c.json({ error: 'Missing required fields: tgid, name, city' }, 400);
    }

    // Создаем студента
    const student = await db.createStudent({
      tgid: body.tgid,
      name: body.name,
      city: body.city
    });

    // Зачисляем на курсы, если указаны
    if (body.courseIds && Array.isArray(body.courseIds)) {
      for (const courseId of body.courseIds) {
        await db.enrollStudentInCourse({
          student_id: student.id,
          course_id: courseId
        });
      }
    }

    // Получаем студента с курсами для ответа
    const studentsWithCourses = await db.getAllStudents();
    const studentWithCourses = studentsWithCourses.find(s => s.id === student.id);
    
    return c.json({ student: studentWithCourses }, 201);
  } catch (error: any) {
    return c.json({ error: 'Failed to create student' }, 500);
  }
});

api.put('/students/:id', async (c) => {
  try {
    const db = c.get('db');
    const id = c.req.param('id');
    const body = await c.req.json();
    
    const student = await db.updateStudent(id, body);
    if (!student) {
      return c.json({ error: 'Student not found' }, 404);
    }
    
    return c.json({ student });
  } catch (error: any) {
    return c.json({ error: 'Failed to update student' }, 500);
  }
});

api.delete('/students/:id', async (c) => {
  try {
    const db = c.get('db');
    const id = c.req.param('id');
    
    const deleted = await db.deleteStudent(id);
    if (!deleted) {
      return c.json({ error: 'Student not found' }, 404);
    }
    
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to delete student' }, 500);
  }
});

// Courses routes
api.get('/courses', requireAuth, async (c) => {
  try {
    const db = c.get('db');
    const courses = await db.getAllCourses();
    
    // Добавляем уроки к каждому курсу
    const coursesWithLessons = await Promise.all(
      courses.map(async (course) => {
        const lessons = await db.getLessonsByCourse(course.id);
        return {
          ...course,
          lessons: lessons.sort((a, b) => a.order_num - b.order_num)
        };
      })
    );
    
    return c.json({ courses: coursesWithLessons });
  } catch (error: any) {
    const db = c.get('db');
    await db.logError({
      source: 'api',
      message: `Failed to get courses: ${error.message}`,
      meta: { error: error.toString() }
    });
    return c.json({ error: 'Failed to get courses' }, 500);
  }
});

api.post('/courses', requireAuth, async (c) => {
  try {
    const db = c.get('db');
    const body = await c.req.json();
    
    if (!body.title) {
      return c.json({ error: 'Missing required field: title' }, 400);
    }

    const course = await db.createCourse(body);
    return c.json({ course }, 201);
  } catch (error: any) {
    return c.json({ error: 'Failed to create course' }, 500);
  }
});

api.put('/courses/:id', requireAuth, async (c) => {
  try {
    const db = c.get('db');
    const id = c.req.param('id');
    const body = await c.req.json();
    
    const course = await db.updateCourse(id, body);
    if (!course) {
      return c.json({ error: 'Course not found' }, 404);
    }
    
    return c.json({ course });
  } catch (error: any) {
    return c.json({ error: 'Failed to update course' }, 500);
  }
});

api.delete('/courses/:id', requireAuth, async (c) => {
  try {
    const db = c.get('db');
    const id = c.req.param('id');
    
    const deleted = await db.deleteCourse(id);
    if (!deleted) {
      return c.json({ error: 'Course not found' }, 404);
    }
    
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to delete course' }, 500);
  }
});

// Lessons routes
api.get('/lessons', requireAuth, async (c) => {
  try {
    const db = c.get('db');
    
    // Получаем все курсы
    const courses = await db.getAllCourses();
    
    // Получаем уроки для каждого курса
    const allLessons = [];
    for (const course of courses) {
      const lessons = await db.getLessonsByCourse(course.id);
      for (const lesson of lessons) {
        allLessons.push({
          ...lesson,
          course: course
        });
      }
    }
    
    // Сортируем уроки по курсу и порядку
    allLessons.sort((a, b) => {
      if (a.course.title !== b.course.title) {
        return a.course.title.localeCompare(b.course.title);
      }
      return a.order_num - b.order_num;
    });
    
    return c.json({ lessons: allLessons });
  } catch (error: any) {
    const db = c.get('db');
    await db.logError({
      source: 'api',
      message: `Failed to get all lessons: ${error.message}`,
      meta: { error: error.toString() }
    });
    return c.json({ error: 'Failed to get lessons' }, 500);
  }
});

api.get('/courses/:courseId/lessons', async (c) => {
  try {
    const db = c.get('db');
    const courseId = c.req.param('courseId');
    
    const lessons = await db.getLessonsByCourse(courseId);
    return c.json({ lessons });
  } catch (error: any) {
    return c.json({ error: 'Failed to get lessons' }, 500);
  }
});

api.post('/courses/:courseId/lessons', requireAuth, async (c) => {
  try {
    const db = c.get('db');
    const courseId = c.req.param('courseId');
    const body = await c.req.json();
    
    if (!body.title || !body.order_num || !body.content) {
      return c.json({ error: 'Missing required fields: title, order_num, content' }, 400);
    }

    const lesson = await db.createLesson({
      ...body,
      course_id: courseId
    });
    return c.json({ lesson }, 201);
  } catch (error: any) {
    return c.json({ error: 'Failed to create lesson' }, 500);
  }
});

api.put('/lessons/:id', requireAuth, async (c) => {
  try {
    const db = c.get('db');
    const id = c.req.param('id');
    const body = await c.req.json();
    
    const lesson = await db.updateLesson(id, body);
    if (!lesson) {
      return c.json({ error: 'Lesson not found' }, 404);
    }
    
    return c.json({ lesson });
  } catch (error: any) {
    const db = c.get('db');
    await db.logError({
      source: 'api',
      message: `Failed to update lesson: ${error.message}`,
      meta: { error: error.toString() }
    });
    return c.json({ error: 'Failed to update lesson' }, 500);
  }
});

api.delete('/lessons/:id', requireAuth, async (c) => {
  try {
    const db = c.get('db');
    const id = c.req.param('id');
    
    const deleted = await db.deleteLesson(id);
    if (!deleted) {
      return c.json({ error: 'Lesson not found' }, 404);
    }
    
    return c.json({ success: true });
  } catch (error: any) {
    const db = c.get('db');
    await db.logError({
      source: 'api',
      message: `Failed to delete lesson: ${error.message}`,
      meta: { error: error.toString() }
    });
    return c.json({ error: 'Failed to delete lesson' }, 500);
  }
});

// Reports routes
api.get('/reports', requireAuth, async (c) => {
  try {
    const db = c.get('db');
    const reports = await db.getAllReports();
    return c.json({ reports });
  } catch (error: any) {
    const db = c.get('db');
    await db.logError({
      source: 'api',
      message: `Failed to get reports: ${error.message}`,
      meta: { error: error.toString() }
    });
    return c.json({ error: 'Failed to get reports' }, 500);
  }
});

api.get('/reports/:id', async (c) => {
  try {
    const db = c.get('db');
    const id = c.req.param('id');
    
    const report = await db.getReportById(id);
    if (!report) {
      return c.json({ error: 'Report not found' }, 404);
    }
    
    return c.json({ report });
  } catch (error: any) {
    return c.json({ error: 'Failed to get report' }, 500);
  }
});

api.put('/reports/:id/review', async (c) => {
  try {
    const db = c.get('db');
    const id = c.req.param('id');
    const body = await c.req.json();
    
    if (!body.status || !['approved', 'rejected'].includes(body.status)) {
      return c.json({ error: 'Invalid status. Must be "approved" or "rejected"' }, 400);
    }

    const report = await db.reviewReport(id, {
      status: body.status,
      admin_comment: body.admin_comment,
              reviewed_by: null // TODO: получать из сессии
    });
    
    if (!report) {
      return c.json({ error: 'Report not found' }, 404);
    }
    
    return c.json({ report });
  } catch (error: any) {
    return c.json({ error: 'Failed to review report' }, 500);
  }
});

// Error logs routes
api.get('/logs', async (c) => {
  try {
    const db = c.get('db');
    const limit = parseInt(c.req.query('limit') || '100');
    
    const logs = await db.getErrorLogs(limit);
    return c.json({ logs });
  } catch (error: any) {
    return c.json({ error: 'Failed to get error logs' }, 500);
  }
});

// Student Courses management routes
api.get('/students/:studentId/courses', requireAuth, async (c) => {
  try {
    const db = c.get('db');
    const studentId = c.req.param('studentId');
    
    const studentCourses = await db.getStudentCourses(studentId);
    return c.json({ studentCourses });
  } catch (error: any) {
    return c.json({ error: 'Failed to get student courses' }, 500);
  }
});

api.post('/students/:studentId/courses', requireAuth, async (c) => {
  try {
    const db = c.get('db');
    const studentId = c.req.param('studentId');
    const body = await c.req.json();
    
    if (!body.course_id) {
      return c.json({ error: 'Missing required field: course_id' }, 400);
    }

    const studentCourse = await db.enrollStudentInCourse({
      student_id: studentId,
      course_id: body.course_id
    });
    
    return c.json({ studentCourse }, 201);
  } catch (error: any) {
    return c.json({ error: 'Failed to enroll student in course' }, 500);
  }
});

api.delete('/students/:studentId/courses/:courseId', requireAuth, async (c) => {
  try {
    const db = c.get('db');
    const studentId = c.req.param('studentId');
    const courseId = c.req.param('courseId');
    
    const deleted = await db.unenrollStudentFromCourse(studentId, courseId);
    if (!deleted) {
      return c.json({ error: 'Student course not found' }, 404);
    }
    
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to unenroll student from course' }, 500);
  }
});

// Broadcast routes
api.get('/broadcasts/recipients', requireAuth, async (c) => {
  try {
    const db = c.get('db');
    const courseId = c.req.query('courseId');
    const lessonId = c.req.query('lessonId');
    
    if (!courseId || !lessonId) {
      return c.json({ error: 'Missing required parameters: courseId, lessonId' }, 400);
    }

    const recipients = await db.getStudentsNotCompletedLesson(courseId, lessonId);
    return c.json({ recipients });
  } catch (error: any) {
    const db = c.get('db');
    await db.logError({
      source: 'api',
      message: `Failed to get broadcast recipients: ${error.message}`,
      meta: { error: error.toString() }
    });
    return c.json({ error: 'Failed to get recipients' }, 500);
  }
});

api.post('/broadcasts/send', requireAuth, async (c) => {
  try {
    const db = c.get('db');
    const adminId = c.get('adminId');
    const body = await c.req.json();
    
    if (!body.courseId || !body.lessonId || !body.message) {
      return c.json({ error: 'Missing required fields: courseId, lessonId, message' }, 400);
    }

    // Получаем студентов, которые не сдали урок
    const recipients = await db.getStudentsNotCompletedLesson(body.courseId, body.lessonId);
    
    if (recipients.length === 0) {
      return c.json({ error: 'No recipients found for this lesson' }, 400);
    }

    // Создаем запись о рассылке
    const broadcast = await db.createBroadcast({
      course_id: body.courseId,
      lesson_id: body.lessonId,
      message: body.message,
      created_by: adminId
    });

    // Отправляем сообщения через Telegram бот
    const botToken = c.env.TELEGRAM_BOT_TOKEN;
    let sentCount = 0;

    for (const student of recipients) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: student.tgid,
            text: body.message,
            parse_mode: 'HTML'
          })
        });

        if (response.ok) {
          sentCount++;
        }
      } catch (error) {
        console.error(`Failed to send message to student ${student.id}:`, error);
      }
    }

    // Обновляем статистику рассылки
    await db.updateBroadcastStats(broadcast.id, recipients.length, sentCount);

    return c.json({ 
      success: true, 
      sentCount, 
      totalRecipients: recipients.length,
      broadcastId: broadcast.id
    });
  } catch (error: any) {
    const db = c.get('db');
    await db.logError({
      source: 'api',
      message: `Failed to send broadcast: ${error.message}`,
      meta: { error: error.toString() }
    });
    return c.json({ error: 'Failed to send broadcast' }, 500);
  }
});

api.get('/broadcasts/history', requireAuth, async (c) => {
  try {
    const db = c.get('db');
    const broadcasts = await db.getAllBroadcasts();
    return c.json({ broadcasts });
  } catch (error: any) {
    const db = c.get('db');
    await db.logError({
      source: 'api',
      message: `Failed to get broadcast history: ${error.message}`,
      meta: { error: error.toString() }
    });
    return c.json({ error: 'Failed to get broadcast history' }, 500);
  }
});

// Telegram webhook route
api.post('/telegram/webhook', async (c) => {
  try {
    const db = c.get('db');
    const botToken = c.env.TELEGRAM_BOT_TOKEN;
    const adminChatId = c.env.TELEGRAM_ADMIN_CHAT_ID;
    
    if (!botToken || !adminChatId) {
      return c.json({ error: 'Telegram bot not configured' }, 500);
    }

    const kv = c.env.BOT_STATE;
    if (!kv) {
      return c.json({ error: 'KV storage not configured' }, 500);
    }

    const response = await handleTelegramWebhook(c.req.raw, db, botToken, adminChatId, kv);
    return response;
  } catch (error: any) {
    return c.json({ error: 'Telegram webhook error' }, 500);
  }
});

// Mount API routes
app.route('/api', api);

// Serve static files for admin interface
app.get('*', async (c) => {
  // Сначала попробуем получить статический файл
  const assetResponse = await c.env.ASSETS.fetch(c.req.url);
  
  if (assetResponse.status === 404) {
    // Для SPA - возвращаем index.html для всех неизвестных маршрутов
    const indexResponse = await c.env.ASSETS.fetch(c.req.url.replace(/\/[^\/]*$/, '/index.html'));
    if (indexResponse.ok) {
      return indexResponse;
    }
    
    // Если index.html тоже не найден, возвращаем простую заглушку
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>SMJ LMS Admin</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body>
          <h1>SMJ LMS Admin Interface</h1>
          <p>Админ-интерфейс находится в разработке</p>
          <p>API доступно по адресу: <a href="/api/health">/api/health</a></p>
        </body>
      </html>
    `);
  }
  
  return assetResponse;
});

export default app;
