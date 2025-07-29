// Database utilities for D1

import type { D1Database } from '@cloudflare/workers-types';
import type {
  Admin, Course, Student, StudentCourse, Lesson, Report, ErrorLog, AdminSession,
  CreateCourse, CreateStudent, CreateStudentCourse, CreateLesson, CreateReport, ReviewReport, CreateErrorLog,
  UpdateCourse, UpdateStudent, UpdateStudentCourse, UpdateLesson,
  StudentWithCourses, StudentCourseWithDetails, LessonWithCourse, ReportWithDetails
} from '../models/database';

export class DatabaseService {
  constructor(private db: D1Database) {}

  // Utility method to generate UUID
  private generateId(): string {
    return crypto.randomUUID();
  }

  // Utility method to get current timestamp
  private now(): string {
    return new Date().toISOString();
  }

  // Admin methods
  async getAdminByUsername(username: string): Promise<Admin | null> {
    const result = await this.db.prepare(
      'SELECT * FROM admins WHERE username = ?'
    ).bind(username).first<Admin>();
    return result || null;
  }

  async getAdminById(id: string): Promise<Admin | null> {
    const result = await this.db.prepare(
      'SELECT * FROM admins WHERE id = ?'
    ).bind(id).first<Admin>();
    return result || null;
  }

  // Course methods
  async getAllCourses(): Promise<Course[]> {
    const result = await this.db.prepare(
      'SELECT * FROM courses ORDER BY created_at DESC'
    ).all<Course>();
    return result.results;
  }

  async getCourseById(id: string): Promise<Course | null> {
    const result = await this.db.prepare(
      'SELECT * FROM courses WHERE id = ?'
    ).bind(id).first<Course>();
    return result || null;
  }

  async createCourse(data: CreateCourse): Promise<Course> {
    const id = this.generateId();
    const now = this.now();
    
    await this.db.prepare(
      'INSERT INTO courses (id, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, data.title, data.description || null, now, now).run();

    const course = await this.getCourseById(id);
    if (!course) throw new Error('Failed to create course');
    return course;
  }

  async updateCourse(id: string, data: UpdateCourse): Promise<Course | null> {
    const now = this.now();
    const updates: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      values.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }

    if (updates.length === 0) {
      return this.getCourseById(id);
    }

    updates.push('updated_at = ?');
    values.push(now, id);

    await this.db.prepare(
      `UPDATE courses SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    return this.getCourseById(id);
  }

  async deleteCourse(id: string): Promise<boolean> {
    const result = await this.db.prepare(
      'DELETE FROM courses WHERE id = ?'
    ).bind(id).run();
    return result.changes > 0;
  }

  // Student methods
  async getAllStudents(): Promise<StudentWithCourses[]> {
    const result = await this.db.prepare(`
      SELECT 
        s.*,
        c.id as course_id,
        c.title as course_title,
        c.description as course_description,
        c.created_at as course_created_at,
        c.updated_at as course_updated_at
      FROM students s
      LEFT JOIN student_courses sc ON s.id = sc.student_id AND sc.is_active = 1
      LEFT JOIN courses c ON sc.course_id = c.id
      ORDER BY s.created_at DESC
    `).all();

    // Группируем студентов с их курсами
    const studentsMap = new Map<string, StudentWithCourses>();
    
    for (const row of result.results as any[]) {
      const studentId = row.id;
      
      if (!studentsMap.has(studentId)) {
        studentsMap.set(studentId, {
          id: row.id,
          tgid: row.tgid,
          name: row.name,
          city: row.city,
          created_at: row.created_at,
          updated_at: row.updated_at,
          courses: []
        });
      }
      
      const student = studentsMap.get(studentId)!;
      
      if (row.course_id) {
        student.courses.push({
          id: row.course_id,
          title: row.course_title,
          description: row.course_description,
          created_at: row.course_created_at,
          updated_at: row.course_updated_at
        });
      }
    }
    
    return Array.from(studentsMap.values());
  }

  async getStudentById(id: string): Promise<Student | null> {
    const result = await this.db.prepare(
      'SELECT * FROM students WHERE id = ?'
    ).bind(id).first<Student>();
    return result || null;
  }

  async getStudentByTgid(tgid: string): Promise<Student | null> {
    const result = await this.db.prepare(
      'SELECT * FROM students WHERE tgid = ?'
    ).bind(tgid).first<Student>();
    return result || null;
  }

  async createStudent(data: CreateStudent): Promise<Student> {
    const id = this.generateId();
    const now = this.now();
    
    await this.db.prepare(
      'INSERT INTO students (id, tgid, name, city, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, data.tgid, data.name, data.city, now, now).run();

    const student = await this.getStudentById(id);
    if (!student) throw new Error('Failed to create student');
    return student;
  }

  async updateStudent(id: string, data: UpdateStudent): Promise<Student | null> {
    const now = this.now();
    const updates: string[] = [];
    const values: any[] = [];

    if (data.tgid !== undefined) {
      updates.push('tgid = ?');
      values.push(data.tgid);
    }
    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.city !== undefined) {
      updates.push('city = ?');
      values.push(data.city);
    }

    // Обновляем основные данные студента если есть изменения
    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(now, id);

      await this.db.prepare(
        `UPDATE students SET ${updates.join(', ')} WHERE id = ?`
      ).bind(...values).run();
    }

    // Обновляем курсы студента если переданы course_ids
    if (data.course_ids !== undefined) {
      // Сначала удаляем все текущие связи студента с курсами
      await this.db.prepare(
        'DELETE FROM student_courses WHERE student_id = ?'
      ).bind(id).run();

      // Затем добавляем новые связи
      if (data.course_ids.length > 0) {
        const insertPromises = data.course_ids.map(courseId =>
          this.db.prepare(
            'INSERT INTO student_courses (id, student_id, course_id, enrolled_at, is_active) VALUES (?, ?, ?, ?, ?)'
          ).bind(this.generateId(), id, courseId, now, true).run()
        );
        
        await Promise.all(insertPromises);
      }
    }

    return this.getStudentById(id);
  }

  async deleteStudent(id: string): Promise<boolean> {
    const result = await this.db.prepare(
      'DELETE FROM students WHERE id = ?'
    ).bind(id).run();
    return result.changes > 0;
  }

  // Lesson methods
  async getLessonsByCourse(courseId: string): Promise<Lesson[]> {
    const result = await this.db.prepare(
      'SELECT * FROM lessons WHERE course_id = ? ORDER BY order_num ASC'
    ).bind(courseId).all<Lesson>();
    return result.results;
  }

  async getLessonById(id: string): Promise<Lesson | null> {
    const result = await this.db.prepare(
      'SELECT * FROM lessons WHERE id = ?'
    ).bind(id).first<Lesson>();
    return result || null;
  }

  async createLesson(data: CreateLesson): Promise<Lesson> {
    const id = this.generateId();
    const now = this.now();
    
    await this.db.prepare(
      'INSERT INTO lessons (id, course_id, title, order_num, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, data.course_id, data.title, data.order_num, data.content, now, now).run();

    const lesson = await this.getLessonById(id);
    if (!lesson) throw new Error('Failed to create lesson');
    return lesson;
  }

  async updateLesson(id: string, data: UpdateLesson): Promise<Lesson | null> {
    const now = this.now();
    const updates: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      values.push(data.title);
    }
    if (data.order_num !== undefined) {
      updates.push('order_num = ?');
      values.push(data.order_num);
    }
    if (data.content !== undefined) {
      updates.push('content = ?');
      values.push(data.content);
    }

    if (updates.length === 0) {
      return this.getLessonById(id);
    }

    updates.push('updated_at = ?');
    values.push(now, id);

    await this.db.prepare(
      `UPDATE lessons SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    return this.getLessonById(id);
  }

  async deleteLesson(id: string): Promise<boolean> {
    const result = await this.db.prepare(
      'DELETE FROM lessons WHERE id = ?'
    ).bind(id).run();
    return result.changes > 0;
  }

  // Report methods
  async getAllReports(): Promise<ReportWithDetails[]> {
    const result = await this.db.prepare(`
      SELECT 
        r.*,
        s.tgid as student_tgid, s.name as student_name, s.city as student_city,
        l.title as lesson_title, l.order_num as lesson_order,
        c.title as course_title
      FROM reports r
      LEFT JOIN students s ON r.student_id = s.id
      LEFT JOIN lessons l ON r.lesson_id = l.id
      LEFT JOIN courses c ON l.course_id = c.id
      ORDER BY r.submitted_at DESC
    `).all();

    return result.results.map((row: any) => ({
      id: row.id,
      student_id: row.student_id,
      lesson_id: row.lesson_id,
      submitted_at: row.submitted_at,
      status: row.status,
      admin_comment: row.admin_comment,
      reviewed_at: row.reviewed_at,
      reviewed_by: row.reviewed_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      student: {
        id: row.student_id,
        tgid: row.student_tgid,
        name: row.student_name,
        city: row.student_city,
        course_id: '', // We don't need this for the report view
        created_at: '',
        updated_at: ''
      },
      lesson: {
        id: row.lesson_id,
        title: row.lesson_title,
        order_num: row.lesson_order,
        course_id: '',
        content: '',
        created_at: '',
        updated_at: ''
      },
      course: {
        id: '',
        title: row.course_title,
        created_at: '',
        updated_at: ''
      }
    }));
  }

  async getReportById(id: string): Promise<Report | null> {
    const result = await this.db.prepare(
      'SELECT * FROM reports WHERE id = ?'
    ).bind(id).first<Report>();
    return result || null;
  }

  async createReport(data: CreateReport): Promise<Report> {
    const id = this.generateId();
    const now = this.now();
    
    await this.db.prepare(
      'INSERT INTO reports (id, student_id, lesson_id, submitted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, data.student_id, data.lesson_id, now, now, now).run();

    const report = await this.getReportById(id);
    if (!report) throw new Error('Failed to create report');
    return report;
  }

  async reviewReport(id: string, data: ReviewReport): Promise<Report | null> {
    const now = this.now();
    
    await this.db.prepare(
      'UPDATE reports SET status = ?, admin_comment = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?'
    ).bind(data.status, data.admin_comment || null, data.reviewed_by, now, now, id).run();

    return this.getReportById(id);
  }

  // Error logging
  async logError(data: CreateErrorLog): Promise<void> {
    const id = this.generateId();
    const now = this.now();
    const meta = data.meta ? JSON.stringify(data.meta) : null;
    
    await this.db.prepare(
      'INSERT INTO error_logs (id, source, message, meta, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, data.source, data.message, meta, now).run();
  }

  async getErrorLogs(limit: number = 100): Promise<ErrorLog[]> {
    const result = await this.db.prepare(
      'SELECT * FROM error_logs ORDER BY created_at DESC LIMIT ?'
    ).bind(limit).all<ErrorLog>();
    return result.results;
  }

  // Session management
  async createSession(adminId: string): Promise<AdminSession> {
    const id = this.generateId();
    const sessionToken = crypto.randomUUID();
    const now = this.now();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
    
    await this.db.prepare(
      'INSERT INTO admin_sessions (id, admin_id, session_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, adminId, sessionToken, expiresAt, now).run();

    const session = await this.db.prepare(
      'SELECT * FROM admin_sessions WHERE id = ?'
    ).bind(id).first<AdminSession>();
    
    if (!session) throw new Error('Failed to create session');
    return session;
  }

  async getSessionByToken(token: string): Promise<AdminSession | null> {
    const result = await this.db.prepare(
      'SELECT * FROM admin_sessions WHERE session_token = ? AND expires_at > ?'
    ).bind(token, this.now()).first<AdminSession>();
    return result || null;
  }

  async deleteSession(token: string): Promise<boolean> {
    const result = await this.db.prepare(
      'DELETE FROM admin_sessions WHERE session_token = ?'
    ).bind(token).run();
    return result.changes > 0;
  }

  async cleanExpiredSessions(): Promise<void> {
    await this.db.prepare(
      'DELETE FROM admin_sessions WHERE expires_at <= ?'
    ).bind(this.now()).run();
  }

  // Additional session methods for AuthService
  async createAdminSession(data: { id: string; admin_id: string; expires_at: string }): Promise<AdminSession> {
    const now = this.now();
    
    await this.db.prepare(
      'INSERT INTO admin_sessions (id, admin_id, created_at, expires_at, is_active) VALUES (?, ?, ?, ?, ?)'
    ).bind(data.id, data.admin_id, now, data.expires_at, true).run();

    const session = await this.getAdminSessionById(data.id);
    if (!session) throw new Error('Failed to create admin session');
    return session;
  }

  async getAdminSessionById(id: string): Promise<AdminSession | null> {
    const result = await this.db.prepare(
      'SELECT * FROM admin_sessions WHERE id = ?'
    ).bind(id).first<AdminSession>();
    return result || null;
  }

  async deactivateAdminSession(sessionId: string): Promise<boolean> {
    const result = await this.db.prepare(
      'UPDATE admin_sessions SET is_active = ? WHERE id = ?'
    ).bind(false, sessionId).run();
    return result.changes > 0;
  }

  async cleanupExpiredSessions(): Promise<void> {
    const now = this.now();
    await this.db.prepare(
      'DELETE FROM admin_sessions WHERE expires_at < ?'
    ).bind(now).run();
  }

  // Дополнительные методы для бота (методы getStudentById и getLessonById уже существуют выше)

  async updateReport(id: string, data: { status?: string; admin_comment?: string }): Promise<Report | null> {
    const now = this.now();
    const updates: string[] = [];
    const values: any[] = [];

    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }
    if (data.admin_comment !== undefined) {
      updates.push('admin_comment = ?');
      values.push(data.admin_comment);
    }

    if (updates.length === 0) {
      return this.getReportById(id);
    }

    updates.push('updated_at = ?');
    values.push(now, id);

    await this.db.prepare(
      `UPDATE reports SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    return this.getReportById(id);
  }

  // Student Courses methods
  async getStudentCourses(studentId: string): Promise<StudentCourseWithDetails[]> {
    const result = await this.db.prepare(`
      SELECT 
        sc.*,
        s.id as student_id_full,
        s.tgid as student_tgid,
        s.name as student_name,
        s.city as student_city,
        s.created_at as student_created_at,
        s.updated_at as student_updated_at,
        c.id as course_id_full,
        c.title as course_title,
        c.description as course_description,
        c.created_at as course_created_at,
        c.updated_at as course_updated_at
      FROM student_courses sc
      JOIN students s ON sc.student_id = s.id
      JOIN courses c ON sc.course_id = c.id
      WHERE sc.student_id = ? AND sc.is_active = 1
      ORDER BY sc.enrolled_at DESC
    `).bind(studentId).all();
    
    // Преобразуем плоский результат в структурированный объект
    return result.results.map((row: any) => ({
      id: row.id,
      student_id: row.student_id,
      course_id: row.course_id,
      enrolled_at: row.enrolled_at,
      is_active: row.is_active,
      student: {
        id: row.student_id_full,
        tgid: row.student_tgid,
        name: row.student_name,
        city: row.student_city,
        created_at: row.student_created_at,
        updated_at: row.student_updated_at
      },
      course: {
        id: row.course_id_full,
        title: row.course_title,
        description: row.course_description,
        created_at: row.course_created_at,
        updated_at: row.course_updated_at
      }
    }));
  }

  async enrollStudentInCourse(data: CreateStudentCourse): Promise<StudentCourse> {
    const id = this.generateId();
    const now = this.now();
    
    await this.db.prepare(
      'INSERT INTO student_courses (id, student_id, course_id, enrolled_at, is_active) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, data.student_id, data.course_id, now, true).run();

    const result = await this.db.prepare(
      'SELECT * FROM student_courses WHERE id = ?'
    ).bind(id).first<StudentCourse>();
    
    if (!result) throw new Error('Failed to enroll student in course');
    return result;
  }

  async unenrollStudentFromCourse(studentId: string, courseId: string): Promise<boolean> {
    const result = await this.db.prepare(
      'UPDATE student_courses SET is_active = ? WHERE student_id = ? AND course_id = ?'
    ).bind(false, studentId, courseId).run();
    return result.changes > 0;
  }

  async getStudentsByCourse(courseId: string): Promise<Student[]> {
    const result = await this.db.prepare(`
      SELECT s.*
      FROM students s
      JOIN student_courses sc ON s.id = sc.student_id
      WHERE sc.course_id = ? AND sc.is_active = 1
      ORDER BY s.name
    `).bind(courseId).all<Student>();
    
    return result.results;
  }

  async getStudentProgress(studentId: string, courseId: string): Promise<{ completed: number; total: number; percentage: number }> {
    // Получаем общее количество уроков в курсе
    const totalLessons = await this.db.prepare(
      'SELECT COUNT(*) as count FROM lessons WHERE course_id = ?'
    ).bind(courseId).first<{ count: number }>();
    
    // Получаем количество одобренных отчетов студента по этому курсу
    const completedLessons = await this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM reports r
      JOIN lessons l ON r.lesson_id = l.id
      WHERE r.student_id = ? AND l.course_id = ? AND r.status = 'approved'
    `).bind(studentId, courseId).first<{ count: number }>();
    
    const total = totalLessons?.count || 0;
    const completed = completedLessons?.count || 0;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { completed, total, percentage };
  }

  // Получить детальный прогресс всех студентов по всем курсам и урокам
  async getDetailedStudentProgress(): Promise<any[]> {
    const result = await this.db.prepare(`
      SELECT 
        s.id as student_id,
        s.name as student_name,
        s.city as student_city,
        c.id as course_id,
        c.title as course_title,
        l.id as lesson_id,
        l.title as lesson_title,
        l.order_num as lesson_order,
        r.status as lesson_status,
        r.submitted_at as lesson_submitted_at
      FROM students s
      JOIN student_courses sc ON s.id = sc.student_id AND sc.is_active = 1
      JOIN courses c ON sc.course_id = c.id
      JOIN lessons l ON c.id = l.course_id
      LEFT JOIN reports r ON s.id = r.student_id AND l.id = r.lesson_id
      ORDER BY s.name, c.title, l.order_num
    `).all();

    // Группируем данные по студентам
    const studentsMap = new Map<string, any>();
    
    for (const row of result.results as any[]) {
      const studentId = row.student_id;
      
      if (!studentsMap.has(studentId)) {
        studentsMap.set(studentId, {
          id: studentId,
          name: row.student_name,
          city: row.student_city,
          courses: new Map()
        });
      }
      
      const student = studentsMap.get(studentId)!;
      const courseId = row.course_id;
      
      if (!student.courses.has(courseId)) {
        student.courses.set(courseId, {
          id: courseId,
          title: row.course_title,
          lessons: []
        });
      }
      
      const course = student.courses.get(courseId)!;
      course.lessons.push({
        id: row.lesson_id,
        title: row.lesson_title,
        order: row.lesson_order,
        status: row.lesson_status || 'not_started',
        submitted_at: row.lesson_submitted_at
      });
    }
    
    // Преобразуем Maps в обычные объекты
    const students = Array.from(studentsMap.values()).map(student => ({
      ...student,
      courses: Array.from(student.courses.values())
    }));
    
    return students;
  }
} 