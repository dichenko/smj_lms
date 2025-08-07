import { DatabaseService } from '../utils/database';
import { StudentState, StudentStateData, StudentStateMachine } from './states';

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: TelegramChat;
  text?: string;
  document?: TelegramDocument;
  photo?: TelegramPhoto[];
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message: TelegramMessage;
  data: string;
}

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
}

interface TelegramDocument {
  file_id: string;
  file_name: string;
  mime_type?: string;
  file_size?: number;
}

interface TelegramPhoto {
  file_id: string;
  file_size?: number;
  width: number;
  height: number;
}

interface InlineKeyboard {
  inline_keyboard: InlineKeyboardButton[][];
}

interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

interface AdminState {
  action: string;
  reportId: string;
}

export class TelegramBot {
  private botToken: string;
  private db: DatabaseService;
  private adminChatId: string;
  private kv: KVNamespace;
  private apiBase = 'https://api.telegram.org/bot';

  constructor(token: string, db: DatabaseService, adminChatId: string, kv: KVNamespace) {
    this.botToken = token;
    this.db = db;
    this.adminChatId = adminChatId;
    this.kv = kv;
  }

  // Методы для управления состояниями админа
  private async getAdminState(chatId: string): Promise<AdminState | null> {
    try {
      const stateStr = await this.kv.get(`admin_state_${chatId}`);
      return stateStr ? JSON.parse(stateStr) : null;
    } catch {
      return null;
    }
  }

  private async setAdminState(chatId: string, state: AdminState): Promise<void> {
    await this.kv.put(`admin_state_${chatId}`, JSON.stringify(state));
  }

  private async clearAdminState(chatId: string): Promise<void> {
    await this.kv.delete(`admin_state_${chatId}`);
  }

  // === МЕТОДЫ РАБОТЫ С СОСТОЯНИЯМИ СТУДЕНТОВ ===

  /**
   * Получить текущее состояние студента
   */
  private async getStudentState(studentId: string): Promise<StudentStateData | null> {
    return await StudentStateMachine.getState(this.kv, studentId);
  }

  /**
   * Обновить состояние студента
   */
  private async updateStudentState(studentId: string, stateData: StudentStateData): Promise<void> {
    // Обновляем время последней активности при каждом сохранении состояния.
    // Это время обработки запроса воркером, а не время действия пользователя.
    await StudentStateMachine.setState(this.kv, studentId, stateData);
  }

  /**
   * Инициализировать состояние для нового студента
   */
  private async initializeStudentState(studentId: string, courseId?: string, showWelcome: boolean = true): Promise<StudentStateData> {
    const initialState = StudentStateMachine.createInitialState(courseId, showWelcome);
    await this.updateStudentState(studentId, initialState);
    return initialState;
  }

  /**
   * Инициализировать состояние с Telegram данными
   */
  private async initializeStudentStateWithTelegram(studentId: string, courseId?: string, showWelcome: boolean = true, telegramName?: string): Promise<StudentStateData> {
    const initialState = StudentStateMachine.createInitialState(courseId, showWelcome);
    if (telegramName) {
      initialState.context = {
        ...initialState.context,
        telegramName
      };
    }
    await this.updateStudentState(studentId, initialState);
    return initialState;
  }

  /**
   * Выполнить переход состояния
   */
  private async transitionStudentState(
    studentId: string, 
    action: string, 
    newData?: Partial<StudentStateData>
  ): Promise<StudentStateData | null> {
    const currentState = await this.getStudentState(studentId);
    if (!currentState) return null;

    const nextState = StudentStateMachine.getNextState(currentState.state, action, newData?.context);
    
    if (nextState !== currentState.state) { // Переход считается валидным, если состояние изменилось
      const updatedState: StudentStateData = {
        ...currentState,
        ...newData,
        state: nextState,
        context: {
          ...currentState.context,
          ...newData?.context,
          previousState: currentState.state
        }
      };
      
      await this.updateStudentState(studentId, updatedState);
      return updatedState;
    } else if (newData) { // Если состояние не изменилось, но есть новые данные, просто обновим контекст

    return currentState;
  }

  /**
   * Центральный обработчик ответов на основе состояния студента
   */
  private async handleStudentStateBasedResponse(
    chatId: number, 
    studentId: string, 
    studentState: StudentStateData
  ): Promise<void> {
    switch (studentState.state) {
      case StudentState.WELCOME:
        await this.showWelcomeScreen(chatId, studentId);
        break;
        
      case StudentState.DASHBOARD:
        await this.showStatefulDashboard(chatId, studentId);
        break;
        
      case StudentState.COURSE_VIEW:
        if (studentState.courseId) {
          await this.showStatefulCourseView(chatId, studentId, studentState.courseId);
        } else {
          // Fallback to dashboard if no course selected
          await this.transitionStudentState(studentId, 'back_to_dashboard');
          await this.showStatefulDashboard(chatId, studentId);
        }
        break;
        
      case StudentState.AWAITING_SUBMISSION:
        await this.showSubmissionPrompt(chatId, studentId, studentState);
        break;
        
      case StudentState.REPORT_PENDING:
        await this.showReportPendingStatus(chatId, studentId, studentState);
        break;
        
      case StudentState.REPORT_REJECTED:
        await this.showReportRejectedStatus(chatId, studentId, studentState);
        break;
        
      case StudentState.LESSON_COMPLETED:
        await this.showLessonCompletedStatus(chatId, studentId, studentState);
        break;
        
      case StudentState.COURSE_COMPLETED:
        await this.showCourseCompletedStatus(chatId, studentId);
        break;
        
      default:
        // Fallback to dashboard for unknown states
        await this.transitionStudentState(studentId, 'activate');
        await this.showStatefulDashboard(chatId, studentId);
        break;
    }
  }

  // === МЕТОДЫ ОТОБРАЖЕНИЯ ДЛЯ КАЖДОГО СОСТОЯНИЯ ===

  /**
   * Показать экран приветствия (только один раз)
   */
  private async showWelcomeScreen(chatId: number, studentId: string): Promise<void> {
    // Очищаем историю чата для чистого отображения приветствия
    await this.clearChatHistory(chatId);
    
    // Получаем текущее состояние для доступа к Telegram имени
    const currentState = await this.getStudentState(studentId);
    const telegramName = currentState?.context?.telegramName || 'Пользователь';
    
    // Отмечаем, что приветствие показано
    await this.transitionStudentState(studentId, 'show_welcome', {
      context: { hasSeenWelcome: true }
    });

    const message = `👋 **Привет, ${telegramName}!**\n\n` +
                   `🎓 Добро пожаловать в SMJ LMS!\n` +
                   `📚 Готовы начать обучение?`;

    const keyboard: InlineKeyboard = {
      inline_keyboard: [[
        { text: '📚 Перейти к курсам', callback_data: 'welcome_to_dashboard' }
      ]]
    };

    await this.sendMessageWithKeyboard(chatId, message, keyboard, studentId);
  }

  /**
   * Показать дашборд с состояниями (с очисткой истории)
   */
  private async showStatefulDashboard(chatId: number, studentId: string): Promise<void> {
    // Очищаем историю чата для красивого отображения
    await this.clearChatHistory(chatId);
    
    // Обновляем состояние и показываем дашборд
    await this.transitionStudentState(studentId, 'refresh');
    await this.showStudentDashboard(chatId, studentId);
  }

  /**
   * Показать курс с состояниями
   */
  private async showStatefulCourseView(chatId: number, studentId: string, courseId: string): Promise<void> {
    // Обновляем состояние с текущим курсом
    await this.transitionStudentState(studentId, 'select_course', { courseId });
    await this.showCurrentLesson(chatId, studentId, courseId);
  }

  /**
   * Показать промпт для отправки отчета
   */
  private async showSubmissionPrompt(chatId: number, studentId: string, state: StudentStateData): Promise<void> {
    // Очищаем историю для аккуратного отображения
    await this.clearChatHistory(chatId);
    
    const message = '📝 **Отправка отчета**\n\n' +
      'Отправьте файл (документ, изображение) с вашим отчетом.\n\n' +
      'Поддерживаемые форматы:\n' +
      '• Документы (PDF, DOC, DOCX)\n• Изображения (JPG, PNG)\n\n' +
      '❗ После отправки файл автоматически будет передан на проверку';

    const keyboard: InlineKeyboard = {
      inline_keyboard: [[
        { text: '❌ Отменить', callback_data: 'cancel_submission' },
        { text: '🔙 К уроку', callback_data: `course_${state.courseId}` }
      ]]
    };

    await this.sendMessageWithKeyboard(chatId, message, keyboard, studentId);
  }

  /**
   * Показать статус ожидания проверки
   */
  private async showReportPendingStatus(chatId: number, studentId: string, state: StudentStateData): Promise<void> {
    // Очищаем историю для аккуратного отображения
    await this.clearChatHistory(chatId);
    
    // Получаем информацию о текущем уроке для полного сообщения
    let lessonTitle = 'урок';
    if (state.lessonId) {
      const lesson = await this.db.getLessonById(state.lessonId);
      if (lesson) {
        lessonTitle = lesson.title;
      }
    }

    const message = `✅ **Отчет принят на проверку!**\n\n` +
                   `**Урок:** ${lessonTitle}\n` +
                   `**Статус:** На проверке ⏳\n\n` +
                   `Вы получите уведомление, когда отчет будет проверен.`;

    const keyboard: InlineKeyboard = {
      inline_keyboard: [[
        { text: '🔙 К курсам', callback_data: 'to_dashboard' }
      ]]
    };

    await this.sendMessageWithKeyboard(chatId, message, keyboard, studentId);
  }

  /**
   * Показать статус отклоненного отчета
   */
  private async showReportRejectedStatus(chatId: number, studentId: string, state: StudentStateData): Promise<void> {
    // Очищаем историю для аккуратного отображения
    await this.clearChatHistory(chatId);
    
    let message = '❌ **Отчет отклонен**\n\n';
    
    if (state.reportId) {
      const report = await this.db.getReportById(state.reportId);
      if (report?.admin_comment) {
        message += `💬 **Комментарий:** ${report.admin_comment}\n\n`;
      }
    }
    
    message += 'Пожалуйста, доработайте отчет и отправьте заново.';

    const keyboard: InlineKeyboard = {
      inline_keyboard: [[
        { text: '🔄 Переделать', callback_data: 'resubmit_report' },
        { text: '🔙 К уроку', callback_data: `course_${state.courseId}` }
      ]]
    };

    await this.sendMessageWithKeyboard(chatId, message, keyboard, studentId);
  }

  /**
   * Показать статус завершенного урока
   */
  private async showLessonCompletedStatus(chatId: number, studentId: string, state: StudentStateData): Promise<void> {
    // Очищаем историю для аккуратного отображения
    await this.clearChatHistory(chatId);
    
    let message = '🎉 **Урок завершен!**\n\n';
    message += 'Поздравляем! Ваш отчет принят.\n\n';
    
    // Проверяем, есть ли еще уроки в курсе  
    if (state.courseId) {
      const lessons = await this.db.getLessonsByCourse(state.courseId);
      const reports = await this.db.getAllReports();
      const studentReports = reports.filter(r => r.student_id === studentId);
      
      let completedCount = 0;
      for (const lesson of lessons) {
        const report = studentReports.find(r => r.lesson_id === lesson.id);
        if (report && report.status === 'approved') {
          completedCount++;
        }
      }
      
      if (completedCount >= lessons.length) {
        // Курс завершен - автоматически переходим к статусу завершения
        await this.transitionStudentState(studentId, 'course_completed', { courseId: state.courseId });
        await this.showCourseCompletedStatus(chatId, studentId);
        return;
      } else {
        message += `📊 **Прогресс курса:** ${completedCount}/${lessons.length} уроков завершено\n\n`;
        message += 'Вы можете перейти к следующему уроку.';
      }
    }

    const keyboard: InlineKeyboard = {
      inline_keyboard: [[
        { text: '➡️ Следующий урок', callback_data: `course_${state.courseId}` },
        { text: '🔙 К курсам', callback_data: 'to_dashboard' }
      ]]
    };

    await this.sendMessageWithKeyboard(chatId, message, keyboard, studentId);
  }

  /**
   * Показать статус завершенного курса
   */
  private async showCourseCompletedStatus(chatId: number, studentId: string): Promise<void> {
    // Очищаем историю чата для чистого отображения статуса завершения
    await this.clearChatHistory(chatId);
    
    const currentState = await this.getStudentState(studentId);
    const courseId = currentState?.courseId;
    
    let message = '🏆 **Курс завершен!**\n\n';
    
    if (courseId) {
      const course = await this.db.getCourseById(courseId);
      const lessons = await this.db.getLessonsByCourse(courseId);
      
      if (course) {
        message += `**📖 Курс:** ${course.title}\n`;
        message += `**📊 Пройдено уроков:** ${lessons.length}/${lessons.length}\n\n`;
      }
    }
    
    message += '🎉 Поздравляем! Вы успешно прошли весь курс.\n\n';
    message += '✅ Все задания выполнены и проверены\n';
    message += '📚 Можете приступать к изучению других курсов\n\n';
    message += '💡 **Примечание:** Если в курс будут добавлены новые уроки, вы получите к ним автоматический доступ.';

    const keyboard: InlineKeyboard = {
      inline_keyboard: [[
        { text: '📚 Все курсы', callback_data: 'to_dashboard' }
      ]]
    };

    await this.sendMessageWithKeyboard(chatId, message, keyboard, studentId);
  }

  /**
   * Обработчик callback'ов студентов с учетом состояний
   */
  private async handleStudentCallback(
    callbackQuery: TelegramCallbackQuery, 
    studentId: string, 
    data: string
  ): Promise<void> {
    const chatId = callbackQuery.message.chat.id;
    let studentState = await this.getStudentState(studentId);

    // Если состояние не найдено, инициализируем
    if (!studentState) {
      studentState = await this.initializeStudentState(studentId);
    }

    // Обрабатываем различные callback'и
    if (data === 'welcome_to_dashboard') {
      await this.transitionStudentState(studentId, 'view_courses');
      await this.showStatefulDashboard(chatId, studentId);
      
    } else if (data === 'to_dashboard' || data === 'back_to_courses') {
      await this.transitionStudentState(studentId, 'back_to_dashboard');
      await this.showStatefulDashboard(chatId, studentId);
      
    } else if (data.startsWith('course_completed_')) {
      // Пользователь нажал на завершенный курс
      const courseId = data.replace('course_completed_', '');
      await this.transitionStudentState(studentId, 'course_completed', { courseId });
      await this.showCourseCompletedStatus(chatId, studentId);
      
    } else if (data.startsWith('course_')) {
      const courseId = data.replace('course_', '');
      
      // Проверяем, не завершен ли уже курс (дополнительная защита)
      const student = await this.db.getStudentById(studentId);
      if (!student) {
        await this.answerCallbackQuery(callbackQuery.id, 'Студент не найден');
        return;
      }
      
      const lessons = await this.db.getLessonsByCourse(courseId);
      const reports = await this.db.getAllReports();
      const studentReports = reports.filter(r => r.student_id === student.id);
      
      // Подсчитываем завершенные уроки
      let completedCount = 0;
      for (const lesson of lessons) {
        const report = studentReports.find(r => r.lesson_id === lesson.id);
        if (report && report.status === 'approved') {
          completedCount++;
        }
      }
      
      // Если курс завершен, показываем статус завершения
      if (completedCount === lessons.length && lessons.length > 0) {
        await this.transitionStudentState(studentId, 'course_completed', { courseId });
        await this.showCourseCompletedStatus(chatId, studentId);
      } else {
        // Иначе показываем текущий урок
        await this.transitionStudentState(studentId, 'select_course', { courseId });
        await this.showStatefulCourseView(chatId, studentId, courseId);
      }
      
    } else if (data.startsWith('submit_')) {
      const lessonId = data.replace('submit_', '');
      
      // ОТЛАДКА: Логируем переход состояния для тестового студента
      const currentState = await this.getStudentState(studentId);
      const student = await this.db.getStudentById(studentId);
      if (student && student.name.includes('Тестовый')) {
        console.log(`🔍 DEBUG: Студент "${student.name}" нажал "Сдать отчет"`);
        console.log(`📊 Состояние ДО перехода:`, currentState);
        await this.db.logError({
          source: 'debug_submit_button',
          message: `Студент ${student.name} нажал кнопку "Сдать отчет". Переход: ${currentState?.state} -> AWAITING_SUBMISSION`,
          meta: { studentId, lessonId, currentState }
        });
      }

      await this.transitionStudentState(studentId, 'submit_report', { lessonId });
      const newState = await this.getStudentState(studentId);
      
      // ОТЛАДКА: Логируем состояние ПОСЛЕ перехода
      if (student && student.name.includes('Тестовый')) {
        console.log(`📊 Состояние ПОСЛЕ перехода:`, newState);
        await this.db.logError({
          source: 'debug_after_transition',
          message: `Состояние после перехода: ${newState?.state}`,
          meta: { studentId, newState }
        });
      }
      
      if (newState) {
        await this.showSubmissionPrompt(chatId, studentId, newState);
      }
      
    } else if (data === 'resubmit_report') {
      await this.transitionStudentState(studentId, 'resubmit');
      const newState = await this.getStudentState(studentId);
      if (newState) {
        await this.showSubmissionPrompt(chatId, studentId, newState);
      }
      
    } else if (data === 'cancel_submission') {
      await this.transitionStudentState(studentId, 'cancel');
      const newState = await this.getStudentState(studentId);
      if (newState && newState.courseId) {
        await this.showStatefulCourseView(chatId, studentId, newState.courseId);
      } else {
        await this.showStatefulDashboard(chatId, studentId);
      }
      
    } else {
      // Fallback: если callback не распознан, показываем текущее состояние
      await this.handleStudentStateBasedResponse(chatId, studentId, studentState);
    }
  }

  // Обработка webhook обновлений
  async handleUpdate(update: TelegramUpdate): Promise<void> {
    try {
      if (update.callback_query) {
        await this.handleCallbackQuery(update.callback_query);
      } else if (update.message) {
        await this.handleMessage(update.message);
      }
    } catch (error: any) {
      console.error('Error handling update:', error);
      await this.db.logError({
        source: 'telegram_bot',
        message: `Update handling error: ${error.message}`,
        meta: { update_id: update.update_id, error: error.toString() }
      });
    }
  }

  // Обработка сообщений
  private async handleMessage(message: TelegramMessage): Promise<void> {
    const chatId = message.chat.id;
    const text = message.text || '';
    const tgid = message.from.id.toString();

    // Обработка команд
    if (text.startsWith('/')) {
      await this.handleCommand(message);
      return;
    }

    // Проверяем, является ли отправитель администратором и есть ли состояние
    if (chatId.toString() === this.adminChatId) {
      const adminState = await this.getAdminState(chatId.toString());
      if (adminState && adminState.action === 'rejecting_report') {
        await this.handleReportRejectionComment(adminState.reportId, text, chatId);
        return;
      }
    }

    // Обработка файлов для отчетов
    if (message.document || message.photo) {
      await this.handleFileUpload(message);
      return;
    }

    // Обычные текстовые сообщения - проверяем состояние студента
    const student = await this.db.getStudentByTgid(tgid);
    if (student) {
      const studentState = await this.getStudentState(student.id);
      if (studentState) {
        // Показываем текущее состояние вместо стандартного сообщения
        await this.handleStudentStateBasedResponse(chatId, student.id, studentState);
        return;
      }
    }

    // Fallback для незарегистрированных пользователей
    // Очищаем историю чата для чистого отображения сообщения
    await this.clearChatHistory(chatId);
    
    await this.sendMessage(chatId, 
      '💡 Используйте команду /start для начала работы с ботом'
    );
  }

  // Обработка команд
  private async handleCommand(message: TelegramMessage): Promise<void> {
    const chatId = message.chat.id;
    const text = message.text || '';
    const tgid = message.from.id.toString();

    if (text === '/start') {
      await this.handleStartCommand(message);
    } else {
      // Очищаем историю чата для чистого отображения ошибки
      await this.clearChatHistory(chatId);
      
      await this.sendMessage(chatId, '❌ Неизвестная команда. Используйте /start');
    }
  }

  // Команда /start - главная логика с поддержкой состояний
  private async handleStartCommand(message: TelegramMessage): Promise<void> {
    const chatId = message.chat.id;
    const tgid = message.from.id.toString();

    try {
      // Проверяем, есть ли студент в базе
      const student = await this.db.getStudentByTgid(tgid);
      
      if (!student) {
        // Очищаем историю для незарегистрированных пользователей
        await this.clearChatHistory(chatId);
        
        await this.sendMessage(chatId,
          '👋 Добро пожаловать в SMJ LMS!\n\n' +
          '❌ Вы не зарегистрированы в системе.\n' +
          'Обратитесь к администратору для регистрации.\n\n' +
          '📧 Контакт: @dichenko'
        );
        return;
      }

      // Очищаем историю чата при команде /start для зарегистрированных пользователей
      await this.clearChatHistory(chatId);

      // Получаем или инициализируем состояние студента
      let studentState = await this.getStudentState(student.id);
      
      if (!studentState) {
        // Инициализируем состояние для нового студента (показываем приветствие только первый раз)
        const telegramName = message.from.first_name || message.from.username || 'Пользователь';
        studentState = await this.initializeStudentStateWithTelegram(student.id, undefined, true, telegramName);
      } else if (studentState.context?.hasSeenWelcome && studentState.state === StudentState.WELCOME) {
        // Если приветствие уже показывалось, переходим сразу к дашборду
        const newState = await this.transitionStudentState(student.id, 'auto');
        if (newState) studentState = newState;
      }

      // Обрабатываем в зависимости от текущего состояния
      await this.handleStudentStateBasedResponse(chatId, student.id, studentState);

    } catch (error: any) {
      console.error('Error in /start command:', error);
      await this.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
    }
  }

  // Показать главную панель студента
  private async showStudentDashboard(chatId: number, studentId: string): Promise<void> {
    try {
      const student = await this.db.getStudentById(studentId);
      if (!student) return;

      // Очищаем историю чата для чистого отображения главного меню
      await this.clearChatHistory(chatId);

      // Получаем все курсы студента через новую таблицу student_courses
      const studentCourses = await this.db.getStudentCourses(studentId);

      if (studentCourses.length === 0) {
        await this.sendMessage(chatId, '❌ У вас нет назначенных курсов');
        return;
      }

      // Сортируем курсы по ID
      studentCourses.sort((a, b) => parseInt(a.course.id) - parseInt(b.course.id));

      let message = '📚 **Ваши курсы:**\n\n';

      const buttons: InlineKeyboardButton[][] = [];

      for (const studentCourse of studentCourses) {
        const course = studentCourse.course;
        const lessons = await this.db.getLessonsByCourse(course.id);
        const reports = await this.db.getAllReports();
        const studentReports = reports.filter(r => r.student_id === student.id);
        
        // Подсчитываем прогресс только для уроков этого курса
        const courseReports = studentReports.filter(r => {
          const lesson = lessons.find(l => l.id === r.lesson_id);
          return lesson && lesson.course_id === course.id;
        });
        
        const completedLessons = courseReports.filter(r => r.status === 'approved').length;
        const totalLessons = lessons.length;
        const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
        const isCompleted = completedLessons === totalLessons && totalLessons > 0;

        message += `• **${course.title}**\n`;
        if (isCompleted) {
          message += `  ✅ **Завершен:** ${completedLessons}/${totalLessons} (100%)\n\n`;
        } else {
          message += `  Прогресс: ${completedLessons}/${totalLessons} (${progress}%)\n\n`;
        }

        // Разные кнопки для завершенных и незавершенных курсов
        if (isCompleted) {
          buttons.push([{
            text: `🏆 ${course.title} (Завершен)`,
            callback_data: `course_completed_${course.id}`
          }]);
        } else {
          buttons.push([{
            text: `📖 ${course.title} (${progress}%)`,
            callback_data: `course_${course.id}`
          }]);
        }
      }

      const keyboard: InlineKeyboard = {
        inline_keyboard: buttons
      };

      await this.sendMessageWithKeyboard(chatId, message, keyboard, studentId);

    } catch (error: any) {
      console.error('Error showing dashboard:', error);
      await this.sendMessage(chatId, '❌ Произошла ошибка при загрузке данных');
    }
  }

  // Показать текущий урок курса или статус завершения
  private async showCurrentLesson(chatId: number, studentId: string, courseId: string): Promise<void> {
    try {
      // Очищаем историю чата для чистого отображения урока
      await this.clearChatHistory(chatId);
      
      const student = await this.db.getStudentById(studentId);
      const course = await this.db.getCourseById(courseId);
      const lessons = await this.db.getLessonsByCourse(courseId);
      
      if (!student || !course || lessons.length === 0) {
        await this.sendMessage(chatId, '❌ Данные не найдены');
        return;
      }

      // Проверяем, что студент зачислен на этот курс
      const studentCourses = await this.db.getStudentCourses(studentId);
      const isEnrolled = studentCourses.some(sc => sc.course_id === courseId && sc.is_active);
      
      if (!isEnrolled) {
        await this.sendMessage(chatId, '❌ Вы не зачислены на этот курс');
        return;
      }

      // Сортируем уроки по порядку
      lessons.sort((a, b) => a.order_num - b.order_num);

      // Получаем отчеты студента
      const reports = await this.db.getAllReports();
      const studentReports = reports.filter(r => r.student_id === student.id);
      
      // Ищем первый незавершенный урок
      let currentLesson = null;
      let completedCount = 0;
      
      for (const lesson of lessons) {
        const report = studentReports.find(r => r.lesson_id === lesson.id);
        if (report && report.status === 'approved') {
          completedCount++;
        } else if (!currentLesson) {
          // Первый незавершенный урок
          currentLesson = lesson;
        }
      }

      // Если все уроки завершены - показываем статус завершения курса
      if (completedCount === lessons.length) {
        await this.transitionStudentState(studentId, 'course_completed', { courseId });
        await this.showCourseCompletedStatus(chatId, studentId);
        return;
      }

      // Если нет незавершенных уроков (не должно случиться, но для безопасности)
      if (!currentLesson) {
        await this.sendMessage(chatId, '❌ Ошибка определения текущего урока');
        return;
      }

      // Проверяем статус текущего урока
      const currentReport = studentReports.find(r => r.lesson_id === currentLesson.id);
      
      let message = `📖 **${course.title}**\n\n`;
      message += `**Урок ${currentLesson.order_num}: ${currentLesson.title}**\n\n`;
      message += `${currentLesson.content}\n\n`;
      
      // Показываем прогресс
      message += `📊 **Прогресс:** ${completedCount}/${lessons.length} уроков завершено\n\n`;

      if (currentReport) {
        if (currentReport.status === 'pending') {
          message += '⏳ **Статус:** Ваш отчет на проверке\n\n';
        } else if (currentReport.status === 'rejected') {
          message += '❌ **Статус:** Отчет отклонен\n';
          if (currentReport.admin_comment) {
            message += `💬 **Комментарий:** ${currentReport.admin_comment}\n\n`;
          }
        }
      }

      const keyboard: InlineKeyboard = {
        inline_keyboard: [
          [
            { text: '🔙 Назад к курсам', callback_data: 'back_to_courses' },
            { text: '📝 Сдать отчет', callback_data: `submit_${currentLesson.id}` }
          ]
        ]
      };

      await this.sendMessageWithKeyboard(chatId, message, keyboard, studentId);

    } catch (error: any) {
      console.error('Error showing lesson:', error);
      await this.sendMessage(chatId, '❌ Произошла ошибка при загрузке урока');
    }
  }

  // Обработка callback запросов (кнопок)
  private async handleCallbackQuery(callbackQuery: TelegramCallbackQuery): Promise<void> {
    const chatId = callbackQuery.message.chat.id;
    const tgid = callbackQuery.from.id.toString();
    const data = callbackQuery.data;

    try {
      // Сначала проверяем admin действия
      if (data.startsWith('admin_approve_')) {
        await this.handleAdminApprove(callbackQuery);
        return;
      } else if (data.startsWith('admin_reject_')) {
        await this.handleAdminReject(callbackQuery);
        return;
      }

      // Затем проверяем студентов для остальных действий
      const student = await this.db.getStudentByTgid(tgid);
      if (!student) {
        await this.answerCallbackQuery(callbackQuery.id, 'Вы не зарегистрированы в системе');
        return;
      }

      // Обрабатываем callback'и с учетом состояний
      await this.handleStudentCallback(callbackQuery, student.id, data);

      await this.answerCallbackQuery(callbackQuery.id);

    } catch (error: any) {
      console.error('Error handling callback:', error);
      await this.answerCallbackQuery(callbackQuery.id, 'Произошла ошибка');
    }
  }

  // Запрос на отправку отчета
  private async handleSubmitRequest(chatId: number, studentId: string, lessonId: string): Promise<void> {
    // Очищаем историю чата для чистого отображения формы отправки
    await this.clearChatHistory(chatId);
    
    await this.sendMessage(chatId,
      '📝 **Отправка отчета**\n\n' +
      'Отправьте файл (документ, изображение) с вашим отчетом.\n\n' +
      'Поддерживаемые форматы:\n' +
      '• Документы (PDF, DOC, DOCX)\n' +
      '• Изображения (JPG, PNG)\n\n' +
      '❗ После отправки файла он автоматически будет передан на проверку'
    );

    // Сохраняем состояние ожидания файла (можно использовать временное хранилище)
    // Пока используем простой подход - следующий файл от этого пользователя будет отчетом
  }

  // Обработка загруженных файлов с поддержкой состояний
  private async handleFileUpload(message: TelegramMessage): Promise<void> {
    const chatId = message.chat.id;
    const tgid = message.from.id.toString();

    try {
      const student = await this.db.getStudentByTgid(tgid);
      if (!student) {
        // Очищаем историю чата для чистого отображения ошибки
        await this.clearChatHistory(chatId);
        
        await this.sendMessage(chatId, '❌ Вы не зарегистрированы в системе');
        return;
      }

      // Проверяем состояние студента
      const studentState = await this.getStudentState(student.id);
      
      // ОТЛАДКА: Для тестового студента - сбрасываем состояние при проблемах
      if (student.name.includes('Тестовый')) {
        console.log(`🔍 DEBUG: Студент "${student.name}" (ID: ${student.id}) отправил файл`);
        console.log(`📊 Текущее состояние:`, studentState);
        
        // Если состояние не найдено или неправильное - сбрасываем
        if (!studentState || studentState.state !== StudentState.AWAITING_SUBMISSION) {
          console.log(`🔧 RESET: Сбрасываем состояние для тестового студента`);
          await this.kv.delete(`student_state_${student.id}`);
          
          await this.sendMessage(chatId, 
            `🔧 **Отладка - состояние сброшено**\n\n` +
            `Ваше состояние было: ${studentState ? studentState.state : 'не найдено'}\n\n` +
            `Попробуйте заново:\n` +
            `1. Выберите курс\n` +
            `2. Нажмите "📝 Сдать отчет"\n` +
            `3. Отправьте файл`
          );
          
          // Показываем главное меню
          await this.showStatefulDashboard(chatId, student.id);
          return;
        }
      }

      // Принимаем файлы только в состоянии ожидания отправки
      if (!studentState || studentState.state !== StudentState.AWAITING_SUBMISSION) {
        // Очищаем историю чата для чистого отображения ошибки
        await this.clearChatHistory(chatId);
        
        await this.sendMessage(chatId, 
          `❌ Сначала выберите урок и нажмите "📝 Сдать отчет"\n\n` +
          `🔍 Отладка: Ваше состояние - ${studentState ? studentState.state : 'не найдено'}`
        );
        
        // Возвращаем в главное меню
        await this.transitionStudentState(student.id, 'back_to_dashboard');
        await this.showStatefulDashboard(chatId, student.id);
        return;
      }

      // Используем курс из состояния студента, а не ищем среди всех курсов
      const targetCourseId = studentState.courseId;
      if (!targetCourseId) {
        // Очищаем историю чата для чистого отображения ошибки
        await this.clearChatHistory(chatId);
        
        await this.sendMessage(chatId, '❌ Не найден текущий курс. Попробуйте выбрать курс заново.');
        return;
      }

      // Получаем конкретный курс из состояния
      const course = await this.db.getCourseById(targetCourseId);
      const studentCourses = await this.db.getStudentCourses(student.id);
      const studentCourse = studentCourses.find(sc => sc.course_id === targetCourseId && sc.is_active);

      if (!course || !studentCourse) {
        // Очищаем историю чата для чистого отображения ошибки
        await this.clearChatHistory(chatId);
        
        await this.sendMessage(chatId, '❌ Курс не найден или недоступен');
        return;
      }

      // Находим текущий незавершенный урок в ЭТОМ конкретном курсе
      const lessons = await this.db.getLessonsByCourse(targetCourseId);
      lessons.sort((a, b) => a.order_num - b.order_num);

      const reports = await this.db.getAllReports();
      const studentReports = reports.filter(r => r.student_id === student.id);

      let currentLesson = null;
      for (const lesson of lessons) {
        const report = studentReports.find(r => r.lesson_id === lesson.id);
        if (!report || report.status !== 'approved') {
          currentLesson = lesson;
          break;
        }
      }

      if (!currentLesson) {
        // Очищаем историю чата для чистого отображения ошибки
        await this.clearChatHistory(chatId);
        
        await this.sendMessage(chatId, '❌ Все уроки в этом курсе уже завершены');
        return;
      }

      const currentCourse = course;

      // Создаем или обновляем отчет
      const existingReport = studentReports.find(r => r.lesson_id === currentLesson.id);
      
      let report;
      if (existingReport && existingReport.status === 'rejected') {
        // Обновляем отклоненный отчет
        report = await this.db.updateReport(existingReport.id, { status: 'pending' });
      } else if (!existingReport) {
        // Создаем новый отчет
        report = await this.db.createReport({
          student_id: student.id,
          lesson_id: currentLesson.id
        });
      } else {
        // Очищаем историю чата для чистого отображения ошибки
        await this.clearChatHistory(chatId);
        
        await this.sendMessage(chatId, '❌ Отчет для этого урока уже отправлен');
        
        // Возвращаем в главное меню
        await this.transitionStudentState(student.id, 'back_to_dashboard');
        await this.showStatefulDashboard(chatId, student.id);
        return;
      }

      if (!report) {
        // Очищаем историю чата для чистого отображения ошибки
        await this.clearChatHistory(chatId);
        
        await this.sendMessage(chatId, '❌ Ошибка при создании отчета');
        return;
      }

      // Отправляем файл и информацию админу
      const adminMessage = 
        `📝 **Новый отчет**\n\n` +
        `**Студент:** ${student.name}\n` +
        `**Город:** ${student.city}\n` +
        `**Курс:** ${currentCourse.title}\n` +
        `**Урок ${currentLesson.order_num}:** ${currentLesson.title}\n\n` +
        `**Задание:**\n${currentLesson.content}\n\n` +
        `**ID отчета:** ${report.id}`;

      const adminKeyboard: InlineKeyboard = {
        inline_keyboard: [
          [
            { text: '✅ Принять', callback_data: `admin_approve_${report.id}` },
            { text: '❌ На доработку', callback_data: `admin_reject_${report.id}` }
          ]
        ]
      };

      await this.sendMessageWithKeyboard(this.adminChatId, adminMessage, adminKeyboard);
      
      // Пересылаем файл администратору
      await this.forwardMessage(this.adminChatId, chatId, message.message_id);

      // Обновляем состояние студента - переходим к ожиданию проверки
      await this.transitionStudentState(student.id, 'file_uploaded', {
        reportId: report.id,
        lessonId: currentLesson.id,
        courseId: currentCourse.id
      });

      // Показываем только состояние ожидания проверки (убираем дублирование)
      const newState = await this.getStudentState(student.id);
      if (newState) {
        await this.showReportPendingStatus(chatId, student.id, newState);
      }

    } catch (error: any) {
      console.error('Error handling file upload:', error);
      await this.sendMessage(chatId, '❌ Произошла ошибка при отправке отчета');
    }
  }

  // Админ одобряет отчет
  private async handleAdminApprove(callbackQuery: TelegramCallbackQuery): Promise<void> {
    const reportId = callbackQuery.data.replace('admin_approve_', '');
    
    try {
      const report = await this.db.getReportById(reportId);
      if (!report) {
        await this.answerCallbackQuery(callbackQuery.id, 'Отчет не найден');
        return;
      }

      // Обновляем статус отчета
      await this.db.reviewReport(reportId, {
        status: 'approved',
        admin_comment: undefined,
        reviewed_by: null
      });

      // Получаем данные для уведомления студента
      const student = await this.db.getStudentById(report.student_id);
      const lesson = await this.db.getLessonById(report.lesson_id);
      
      if (student && lesson) {
        // Получаем курс урока
        const course = await this.db.getCourseById(lesson.course_id);
        if (!course) {
          await this.answerCallbackQuery(callbackQuery.id, 'Курс не найден');
          return;
        }

        // Проверяем, не завершился ли курс после одобрения этого урока
        const allLessons = await this.db.getLessonsByCourse(lesson.course_id);
        const allReports = await this.db.getAllReports();
        const studentReports = allReports.filter(r => r.student_id === student.id);
        
        // Подсчитываем завершенные уроки (включая только что одобренный)
        let completedCount = 0;
        for (const courseLesson of allLessons) {
          const studentReport = studentReports.find(r => r.lesson_id === courseLesson.id);
          if (studentReport && (studentReport.status === 'approved' || studentReport.id === reportId)) {
            completedCount++;
          }
        }
        
        // Если это был последний урок - курс завершен
        if (completedCount === allLessons.length) {
          // Обновляем состояние студента - курс завершен
          await this.transitionStudentState(student.id, 'course_completed', {
            courseId: lesson.course_id
          });
          
          // Показываем статус завершения курса
          await this.showCourseCompletedStatus(parseInt(student.tgid), student.id);
        } else {
          // Обычное завершение урока
          await this.transitionStudentState(student.id, 'report_approved', {
            lessonId: lesson.id,
            courseId: lesson.course_id
          });

          // Показываем состояние завершенного урока
          const studentState = await this.getStudentState(student.id);
          if (studentState) {
            await this.showLessonCompletedStatus(parseInt(student.tgid), student.id, studentState);
          }
        }
      }

      // Обновляем сообщение админа
      await this.editMessageText(
        callbackQuery.message.chat.id,
        callbackQuery.message.message_id,
        callbackQuery.message.text + '\n\n✅ **ОДОБРЕНО**'
      );

      await this.answerCallbackQuery(callbackQuery.id, 'Отчет одобрен!');

    } catch (error: any) {
      console.error('Error approving report:', error);
      await this.answerCallbackQuery(callbackQuery.id, 'Ошибка при одобрении');
    }
  }

  // Админ отклоняет отчет
  private async handleAdminReject(callbackQuery: TelegramCallbackQuery): Promise<void> {
    const reportId = callbackQuery.data.replace('admin_reject_', '');
    
    try {
      const report = await this.db.getReportById(reportId);
      if (!report) {
        await this.answerCallbackQuery(callbackQuery.id, 'Отчет не найден');
        return;
      }

      // Сохраняем состояние админа
      await this.setAdminState(callbackQuery.message.chat.id.toString(), {
        action: 'rejecting_report',
        reportId: reportId
      });

      // Просим админа написать комментарий
      await this.sendMessage(callbackQuery.message.chat.id,
        `📝 **Отклонение отчета**\n\n` +
        `Напишите комментарий для студента (или отправьте пустое сообщение):\n\n` +
        `ID отчета: ${reportId}`
      );

      await this.answerCallbackQuery(callbackQuery.id, 'Напишите комментарий для студента');

    } catch (error: any) {
      console.error('Error rejecting report:', error);
      await this.answerCallbackQuery(callbackQuery.id, 'Ошибка при отклонении');
    }
  }

  // Обработка комментария к отклонению отчета
  private async handleReportRejectionComment(reportId: string, comment: string, adminChatId: number): Promise<void> {
    try {
      // Получаем отчет
      const report = await this.db.getReportById(reportId);
      if (!report) {
        await this.sendMessage(adminChatId, '❌ Отчет не найден');
        return;
      }

      // Отклоняем отчет с комментарием
      await this.db.reviewReport(reportId, {
        status: 'rejected',
        admin_comment: comment.trim() || 'Требуется доработка',
        reviewed_by: null
      });

      // Получаем данные для уведомления студента
      const student = await this.db.getStudentById(report.student_id);
      const lesson = await this.db.getLessonById(report.lesson_id);
      
      if (student && lesson) {
        // Обновляем состояние студента - отчет отклонен
        await this.transitionStudentState(student.id, 'report_rejected', {
          reportId: reportId,
          lessonId: lesson.id
        });

        // Показываем только состояние отклоненного отчета (без дублирования)
        const studentState = await this.getStudentState(student.id);
        if (studentState) {
          await this.showReportRejectedStatus(parseInt(student.tgid), student.id, studentState);
        }
      }

      // Уведомляем админа об успешном отклонении
      await this.sendMessage(adminChatId,
        `✅ **Отчет отклонен**\n\n` +
        `Студент получил уведомление с вашим комментарием.`
      );

      // Очищаем состояние админа
      await this.clearAdminState(adminChatId.toString());

    } catch (error: any) {
      console.error('Error processing report rejection:', error);
      await this.sendMessage(adminChatId, '❌ Произошла ошибка при отклонении отчета');
      await this.clearAdminState(adminChatId.toString());
    }
  }

  // Вспомогательные методы для работы с Telegram API

  async sendMessage(chatId: number | string, text: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBase}${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'Markdown'
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

  /**
   * Отправить сообщение и сохранить ID для последующего удаления
   */
  async sendMessageWithTracking(chatId: number | string, text: string, studentId?: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBase}${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'Markdown'
        })
      });

      if (response.ok && studentId) {
        const result = await response.json();
        if (result.result?.message_id) {
          // Добавляем ID сообщения к списку для удаления
          const currentState = await this.getStudentState(studentId);
          const currentMessageIds = currentState?.context?.messageIds || [];
          const newMessageIds = [...currentMessageIds, result.result.message_id];
          
          await this.transitionStudentState(studentId, 'track_message', {
            context: { messageIds: newMessageIds }
          });
        }
      }

      return response.ok;
    } catch (error) {
      console.error('Error sending tracked message:', error);
      return false;
    }
  }

  async sendMessageWithKeyboard(chatId: number | string, text: string, keyboard: InlineKeyboard, studentId?: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBase}${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'Markdown',
          reply_markup: keyboard
        })
      });

      if (response.ok && studentId) {
        const result = await response.json();
        if (result.result?.message_id) {
          // Добавляем ID сообщения к списку для удаления
          const currentState = await this.getStudentState(studentId);
          const currentMessageIds = currentState?.context?.messageIds || [];
          const newMessageIds = [...currentMessageIds, result.result.message_id];
          
          await this.transitionStudentState(studentId, 'track_message', {
            context: { messageIds: newMessageIds }
          });
        }
      }

      return response.ok;
    } catch (error) {
      console.error('Error sending message with keyboard:', error);
      return false;
    }
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBase}${this.botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: text || ''
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Error answering callback query:', error);
      return false;
    }
  }

  async forwardMessage(chatId: number | string, fromChatId: number | string, messageId: number): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBase}${this.botToken}/forwardMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          from_chat_id: fromChatId,
          message_id: messageId
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Error forwarding message:', error);
      return false;
    }
  }

  async editMessageText(chatId: number | string, messageId: number, text: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBase}${this.botToken}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: text,
          parse_mode: 'Markdown'
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Error editing message:', error);
      return false;
    }
  }

  // Отправка уведомления студенту
  async sendNotificationToStudent(tgid: string, message: string): Promise<boolean> {
    return this.sendMessage(tgid, message);
  }

  // Отправка уведомления администратору
  async sendNotificationToAdmin(message: string): Promise<boolean> {
    return this.sendMessage(this.adminChatId, message);
  }

  /**
   * Очистить историю чата (удалить предыдущие сообщения бота)
   */
  private async clearChatHistory(chatId: number): Promise<void> {
    try {
      // Получаем студента по chatId (нужно найти по tgid)
      const student = await this.db.getStudentByTgid(chatId.toString());
      if (!student) return;

      const studentState = await this.getStudentState(student.id);
      const messageIds = studentState?.context?.messageIds || [];
      
      // Пытаемся удалить сохраненные сообщения бота
      for (const messageId of messageIds) {
        try {
          await this.deleteMessage(chatId, messageId);
          // Небольшая задержка между удалениями
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch {
          // Игнорируем ошибки удаления отдельных сообщений
        }
      }
      
      // Очищаем список сохраненных сообщений
      if (messageIds.length > 0) {
        await this.transitionStudentState(student.id, 'clear_messages', {
          context: { messageIds: [] }
        });
      }
      
    } catch (error) {
      // Игнорируем ошибки очистки - не критично
      console.log('Chat clear failed (non-critical):', error);
    }
  }

  /**
   * Удалить сообщение
   */
  private async deleteMessage(chatId: number, messageId: number): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBase}${this.botToken}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId
        })
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Отправить сообщение с предварительной очисткой истории
   */
  private async sendMessageWithClearHistory(chatId: number, text: string, keyboard?: InlineKeyboard): Promise<boolean> {
    await this.clearChatHistory(chatId);
    if (keyboard) {
      return this.sendMessageWithKeyboard(chatId, text, keyboard);
    } else {
      return this.sendMessage(chatId, text);
    }
  }
} 