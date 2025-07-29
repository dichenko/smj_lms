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
  ASSETS: Fetcher;
  ENVIRONMENT: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_ADMIN_CHAT_ID?: string;
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

api.post('/students', async (c) => {
  try {
    const db = c.get('db');
    const body = await c.req.json();
    
    if (!body.tgid || !body.name || !body.city || !body.course_id) {
      return c.json({ error: 'Missing required fields: tgid, name, city, course_id' }, 400);
    }

    const student = await db.createStudent(body);
    return c.json({ student }, 201);
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

api.post('/courses', async (c) => {
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

api.put('/courses/:id', async (c) => {
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

api.delete('/courses/:id', async (c) => {
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

api.post('/courses/:courseId/lessons', async (c) => {
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

api.put('/lessons/:id', async (c) => {
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
    return c.json({ error: 'Failed to update lesson' }, 500);
  }
});

api.delete('/lessons/:id', async (c) => {
  try {
    const db = c.get('db');
    const id = c.req.param('id');
    
    const deleted = await db.deleteLesson(id);
    if (!deleted) {
      return c.json({ error: 'Lesson not found' }, 404);
    }
    
    return c.json({ success: true });
  } catch (error: any) {
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
      reviewed_by: 'admin' // TODO: получать из сессии
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

// Telegram webhook route
api.post('/telegram/webhook', async (c) => {
  try {
    const db = c.get('db');
    const botToken = c.env.TELEGRAM_BOT_TOKEN;
    const adminChatId = c.env.TELEGRAM_ADMIN_CHAT_ID;
    
    if (!botToken || !adminChatId) {
      return c.json({ error: 'Telegram bot not configured' }, 500);
    }

    const response = await handleTelegramWebhook(c.req.raw, db, botToken, adminChatId);
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
