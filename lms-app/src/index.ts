import { Hono } from "hono";
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { DatabaseService } from './utils/database';
import { D1Database, Fetcher } from '@cloudflare/workers-types';

// Типы для TypeScript
interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ENVIRONMENT: string;
}

interface Variables {
  db: DatabaseService;
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Middleware
app.use('*', logger());
app.use('/api/*', cors({
  origin: ['http://localhost:3000', 'https://*.workers.dev'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Middleware для создания database service
app.use('/api/*', async (c, next) => {
  const db = new DatabaseService(c.env.DB);
  c.set('db', db);
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
  // TODO: Реализовать аутентификацию админа
  return c.json({ message: 'Login endpoint - TODO' });
});

api.post('/auth/logout', async (c) => {
  // TODO: Реализовать выход админа
  return c.json({ message: 'Logout endpoint - TODO' });
});

// Students routes
api.get('/students', async (c) => {
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
api.get('/courses', async (c) => {
  try {
    const db = c.get('db');
    const courses = await db.getAllCourses();
    return c.json({ courses });
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
api.get('/reports', async (c) => {
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
  // TODO: Обработка webhook от Telegram бота
  return c.json({ message: 'Telegram webhook - TODO' });
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
