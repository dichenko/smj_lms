// Database models and types for SMJ LMS

export interface Admin {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  title: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  tgid: string; // Telegram User ID
  name: string;
  city: string;
  created_at: string;
  updated_at: string;
}

export interface StudentCourse {
  id: string;
  student_id: string;
  course_id: string;
  enrolled_at: string;
  is_active: boolean;
}

export interface Lesson {
  id: string;
  course_id: string;
  title: string;
  order_num: number;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  student_id: string;
  lesson_id: string;
  submitted_at: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_comment?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ErrorLog {
  id: string;
  source: string;
  message: string;
  meta?: string; // JSON string
  created_at: string;
}

export interface AdminSession {
  id: string;
  admin_id: string;
  session_token: string;
  expires_at: string;
  created_at: string;
}

// Input types for creating new records
export interface CreateCourse {
  title: string;
  description?: string;
}

export interface CreateStudent {
  tgid: string;
  name: string;
  city: string;
}

export interface CreateStudentCourse {
  student_id: string;
  course_id: string;
}

export interface CreateLesson {
  course_id: string;
  title: string;
  order_num: number;
  content: string;
}

export interface CreateReport {
  student_id: string;
  lesson_id: string;
}

export interface ReviewReport {
  status: 'approved' | 'rejected';
  admin_comment?: string;
  reviewed_by: string | null;
}

export interface CreateErrorLog {
  source: string;
  message: string;
  meta?: object;
}

// Update types
export interface UpdateCourse {
  title?: string;
  description?: string;
}

export interface UpdateStudent {
  tgid?: string;
  name?: string;
  city?: string;
  course_ids?: string[];
}

export interface UpdateStudentCourse {
  is_active?: boolean;
}

export interface UpdateLesson {
  title?: string;
  order_num?: number;
  content?: string;
}

// Response types with relationships
export interface StudentWithCourses extends Student {
  courses: Course[];
}

export interface StudentCourseWithDetails extends StudentCourse {
  student: Student;
  course: Course;
}

export interface LessonWithCourse extends Lesson {
  course: Course;
}

export interface ReportWithDetails extends Report {
  student: Student;
  lesson: Lesson;
  course: Course;
} 