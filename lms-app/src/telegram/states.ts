// Машина состояний для студентов

export enum StudentState {
  // Базовые состояния
  UNREGISTERED = 'unregistered',           // Студент не зарегистрирован
  WELCOME = 'welcome',                     // Первое приветствие после регистрации
  DASHBOARD = 'dashboard',                 // Главная панель с курсами
  
  // Состояния работы с курсом
  COURSE_VIEW = 'course_view',             // Просмотр текущего урока курса
  AWAITING_SUBMISSION = 'awaiting_submission', // Ожидание отправки файла отчета
  
  // Состояния отчета
  REPORT_PENDING = 'report_pending',       // Отчет на проверке у админа
  REPORT_REJECTED = 'report_rejected',     // Отчет отклонен, нужна доработка
  LESSON_COMPLETED = 'lesson_completed',   // Урок завершен успешно
  
  // Специальные состояния
  COURSE_COMPLETED = 'course_completed',   // Весь курс завершен
  IDLE = 'idle'                           // Нет активных задач
}

export interface StudentStateData {
  state: StudentState;
  courseId?: string;          // ID текущего активного курса
  lessonId?: string;          // ID текущего урока
  reportId?: string;          // ID текущего отчета
  lastActivity: string;       // Timestamp последней активности
  context?: {                 // Дополнительный контекст
    previousState?: StudentState;
    messageId?: number;       // ID сообщения для редактирования
    submissionAttempts?: number; // Количество попыток сдачи
  };
}

export class StudentStateMachine {
  
  /**
   * Получить состояние студента из KV
   */
  static async getState(kv: any, studentId: string): Promise<StudentStateData | null> {
    try {
      const stateStr = await kv.get(`student_state_${studentId}`);
      return stateStr ? JSON.parse(stateStr) : null;
    } catch {
      return null;
    }
  }

  /**
   * Сохранить состояние студента в KV
   */
  static async setState(kv: any, studentId: string, stateData: StudentStateData): Promise<void> {
    stateData.lastActivity = new Date().toISOString();
    await kv.put(`student_state_${studentId}`, JSON.stringify(stateData));
  }

  /**
   * Очистить состояние студента
   */
  static async clearState(kv: any, studentId: string): Promise<void> {
    await kv.delete(`student_state_${studentId}`);
  }

  /**
   * Инициализировать состояние для нового студента
   */
  static createInitialState(courseId?: string): StudentStateData {
    return {
      state: StudentState.WELCOME,
      courseId,
      lastActivity: new Date().toISOString(),
      context: {
        submissionAttempts: 0
      }
    };
  }

  /**
   * Определить следующее состояние на основе текущего и действия
   */
  static getNextState(
    currentState: StudentState, 
    action: string, 
    context?: any
  ): StudentState {
    const transitions: Record<StudentState, Record<string, StudentState>> = {
      [StudentState.UNREGISTERED]: {
        'register': StudentState.WELCOME
      },
      
      [StudentState.WELCOME]: {
        'view_courses': StudentState.DASHBOARD,
        'auto': StudentState.DASHBOARD
      },
      
      [StudentState.DASHBOARD]: {
        'select_course': StudentState.COURSE_VIEW,
        'refresh': StudentState.DASHBOARD
      },
      
      [StudentState.COURSE_VIEW]: {
        'submit_report': StudentState.AWAITING_SUBMISSION,
        'back_to_dashboard': StudentState.DASHBOARD,
        'next_lesson': StudentState.COURSE_VIEW,
        'course_completed': StudentState.COURSE_COMPLETED
      },
      
      [StudentState.AWAITING_SUBMISSION]: {
        'file_uploaded': StudentState.REPORT_PENDING,
        'cancel': StudentState.COURSE_VIEW,
        'back_to_dashboard': StudentState.DASHBOARD
      },
      
      [StudentState.REPORT_PENDING]: {
        'report_approved': StudentState.LESSON_COMPLETED,
        'report_rejected': StudentState.REPORT_REJECTED,
        'back_to_dashboard': StudentState.DASHBOARD
      },
      
      [StudentState.REPORT_REJECTED]: {
        'resubmit': StudentState.AWAITING_SUBMISSION,
        'back_to_course': StudentState.COURSE_VIEW,
        'back_to_dashboard': StudentState.DASHBOARD
      },
      
      [StudentState.LESSON_COMPLETED]: {
        'next_lesson': StudentState.COURSE_VIEW,
        'back_to_dashboard': StudentState.DASHBOARD,
        'course_completed': StudentState.COURSE_COMPLETED
      },
      
      [StudentState.COURSE_COMPLETED]: {
        'back_to_dashboard': StudentState.DASHBOARD,
        'start_new_course': StudentState.COURSE_VIEW
      },
      
      [StudentState.IDLE]: {
        'activate': StudentState.DASHBOARD
      }
    };

    return transitions[currentState]?.[action] || currentState;
  }

  /**
   * Проверить, валиден ли переход между состояниями
   */
  static isValidTransition(from: StudentState, to: StudentState): boolean {
    const validTransitions: Record<StudentState, StudentState[]> = {
      [StudentState.UNREGISTERED]: [StudentState.WELCOME],
      [StudentState.WELCOME]: [StudentState.DASHBOARD],
      [StudentState.DASHBOARD]: [StudentState.COURSE_VIEW, StudentState.IDLE],
      [StudentState.COURSE_VIEW]: [
        StudentState.AWAITING_SUBMISSION, 
        StudentState.DASHBOARD, 
        StudentState.COURSE_COMPLETED
      ],
      [StudentState.AWAITING_SUBMISSION]: [
        StudentState.REPORT_PENDING, 
        StudentState.COURSE_VIEW, 
        StudentState.DASHBOARD
      ],
      [StudentState.REPORT_PENDING]: [
        StudentState.LESSON_COMPLETED, 
        StudentState.REPORT_REJECTED,
        StudentState.DASHBOARD
      ],
      [StudentState.REPORT_REJECTED]: [
        StudentState.AWAITING_SUBMISSION, 
        StudentState.COURSE_VIEW, 
        StudentState.DASHBOARD
      ],
      [StudentState.LESSON_COMPLETED]: [
        StudentState.COURSE_VIEW, 
        StudentState.COURSE_COMPLETED, 
        StudentState.DASHBOARD
      ],
      [StudentState.COURSE_COMPLETED]: [StudentState.DASHBOARD, StudentState.COURSE_VIEW],
      [StudentState.IDLE]: [StudentState.DASHBOARD]
    };

    return validTransitions[from]?.includes(to) || false;
  }

  /**
   * Получить контекстные действия для состояния
   */
  static getContextualActions(state: StudentState): string[] {
    const actions: Record<StudentState, string[]> = {
      [StudentState.UNREGISTERED]: [],
      [StudentState.WELCOME]: ['📚 Перейти к курсам'],
      [StudentState.DASHBOARD]: ['🔄 Обновить', '📊 Мой прогресс'],
      [StudentState.COURSE_VIEW]: ['📝 Сдать отчет', '🔙 К курсам', '📋 Показать задание'],
      [StudentState.AWAITING_SUBMISSION]: ['❌ Отменить', '🔙 К уроку'],
      [StudentState.REPORT_PENDING]: ['⏳ Статус проверки', '🔙 К курсам'],
      [StudentState.REPORT_REJECTED]: ['🔄 Переделать', '💬 Комментарий', '🔙 К уроку'],
      [StudentState.LESSON_COMPLETED]: ['➡️ Следующий урок', '🔙 К курсам', '🎉 Прогресс'],
      [StudentState.COURSE_COMPLETED]: ['🏆 Мои достижения', '📚 Новый курс', '🔙 К курсам'],
      [StudentState.IDLE]: ['🚀 Активировать']
    };

    return actions[state] || [];
  }
} 