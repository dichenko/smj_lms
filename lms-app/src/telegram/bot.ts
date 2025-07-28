import { DatabaseService } from '../utils/database';

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: any;
}

interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: TelegramChat;
  text?: string;
  document?: TelegramDocument;
  photo?: TelegramPhoto[];
  reply_to_message?: TelegramMessage;
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

export class TelegramBot {
  private botToken: string;
  private db: DatabaseService;
  private adminChatId: string;
  private apiBase = 'https://api.telegram.org/bot';

  constructor(token: string, db: DatabaseService, adminChatId: string) {
    this.botToken = token;
    this.db = db;
    this.adminChatId = adminChatId;
  }

  // Обработка webhook обновлений
  async handleUpdate(update: TelegramUpdate): Promise<void> {
    try {
      if (update.message) {
        await this.handleMessage(update.message);
      } else if (update.callback_query) {
        await this.handleCallbackQuery(update.callback_query);
      }
    } catch (error) {
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

    // Обработка документов
    if (message.document) {
      await this.handleDocument(message);
      return;
    }

    // Обработка фото
    if (message.photo && message.photo.length > 0) {
      await this.handlePhoto(message);
      return;
    }

    // Обработка обычных текстовых сообщений
    if (text && !text.startsWith('/')) {
      await this.sendMessage(chatId, 
        '💡 Используйте команды для взаимодействия с ботом:\n\n' +
        '/start - Авторизация\n' +
        '/lesson - Текущий урок\n' +
        '/progress - Прогресс\n' +
        '/reports - История отчетов\n' +
        '/help - Справка'
      );
    }
  }

  // Обработка команд
  private async handleCommand(message: TelegramMessage): Promise<void> {
    const chatId = message.chat.id;
    const text = message.text || '';
    const tgid = message.from.id.toString();

    switch (text.split(' ')[0]) {
      case '/start':
        await this.handleStartCommand(message);
        break;
      case '/help':
        await this.handleHelpCommand(message);
        break;
      case '/lesson':
        await this.handleLessonCommand(message);
        break;
      case '/progress':
        await this.handleProgressCommand(message);
        break;
      case '/reports':
        await this.handleReportsCommand(message);
        break;
      case '/submit':
        await this.handleSubmitCommand(message);
        break;
      default:
        await this.sendMessage(chatId, '❌ Неизвестная команда. Используйте /help для справки.');
    }
  }

  // Команда /start
  private async handleStartCommand(message: TelegramMessage): Promise<void> {
    const chatId = message.chat.id;
    const tgid = message.from.id.toString();

    try {
      const student = await this.db.getStudentByTgid(tgid);
      
      if (!student) {
        await this.sendMessage(chatId,
          '👋 Добро пожаловать в SMJ LMS!\n\n' +
          '❌ Вы не зарегистрированы в системе.\n' +
          'Обратитесь к администратору для регистрации.\n\n' +
          '📧 Контакт: admin@smj-lms.com'
        );
        return;
      }

      await this.sendMessage(chatId,
        `👋 Добро пожаловать, ${student.name}!\n\n` +
        '🎓 Вы успешно авторизованы в системе SMJ LMS.\n\n' +
        'Доступные команды:\n' +
        '/lesson - Текущий урок\n' +
        '/progress - Ваш прогресс\n' +
        '/reports - История отчетов\n' +
        '/help - Справка'
      );
    } catch (error) {
      console.error('Error in /start command:', error);
      await this.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
    }
  }

  // Команда /help
  private async handleHelpCommand(message: TelegramMessage): Promise<void> {
    const chatId = message.chat.id;

    await this.sendMessage(chatId,
      '📚 **SMJ LMS - Справка**\n\n' +
      '**Основные команды:**\n' +
      '/start - Авторизация в системе\n' +
      '/lesson - Показать текущий урок\n' +
      '/progress - Ваш прогресс обучения\n' +
      '/reports - История ваших отчетов\n' +
      '/submit - Отправить отчет (ответьте на сообщение с файлом)\n\n' +
      '**Как отправить отчет:**\n' +
      '1. Отправьте файл (PDF, DOC, DOCX)\n' +
      '2. Ответьте на него командой /submit\n\n' +
      '❓ По всем вопросам обращайтесь к администратору'
    );
  }

  // Команда /lesson
  private async handleLessonCommand(message: TelegramMessage): Promise<void> {
    const chatId = message.chat.id;
    const tgid = message.from.id.toString();

    try {
      const student = await this.db.getStudentByTgid(tgid);
      if (!student) {
        await this.sendMessage(chatId, '❌ Вы не зарегистрированы в системе');
        return;
      }

      const course = await this.db.getCourseById(student.course_id);
      if (!course) {
        await this.sendMessage(chatId, '❌ Курс не найден');
        return;
      }

      const lessons = await this.db.getLessonsByCourse(student.course_id);
      if (lessons.length === 0) {
        await this.sendMessage(chatId, '📚 В вашем курсе пока нет уроков');
        return;
      }

      const reports = await this.db.getAllReports();
      const studentReports = reports.filter(r => r.student_id === student.id);
      
      let currentLessonIndex = 0;
      for (let i = 0; i < lessons.length; i++) {
        const lessonReport = studentReports.find(r => r.lesson_id === lessons[i].id);
        if (!lessonReport || lessonReport.status === 'rejected') {
          currentLessonIndex = i;
          break;
        }
        if (i === lessons.length - 1) {
          currentLessonIndex = i;
        }
      }

      const currentLesson = lessons[currentLessonIndex];
      const progress = `${currentLessonIndex + 1} из ${lessons.length}`;

      await this.sendMessage(chatId,
        `📚 **Текущий урок**\n\n` +
        `**Курс:** ${course.title}\n` +
        `**Урок:** ${currentLesson.title}\n` +
        `**Прогресс:** ${progress}\n\n` +
        `**Содержание урока:**\n${currentLesson.content}\n\n` +
        `📝 Отправьте файл с отчетом и ответьте на него командой /submit`
      );
    } catch (error) {
      console.error('Error in /lesson command:', error);
      await this.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
    }
  }

  // Команда /progress
  private async handleProgressCommand(message: TelegramMessage): Promise<void> {
    const chatId = message.chat.id;
    const tgid = message.from.id.toString();

    try {
      const student = await this.db.getStudentByTgid(tgid);
      if (!student) {
        await this.sendMessage(chatId, '❌ Вы не зарегистрированы в системе');
        return;
      }

      const course = await this.db.getCourseById(student.course_id);
      const lessons = await this.db.getLessonsByCourse(student.course_id);
      const reports = await this.db.getAllReports();
      const studentReports = reports.filter(r => r.student_id === student.id);

      let completed = 0;
      let pending = 0;
      let rejected = 0;

      for (const lesson of lessons) {
        const report = studentReports.find(r => r.lesson_id === lesson.id);
        if (report) {
          if (report.status === 'approved') completed++;
          else if (report.status === 'pending') pending++;
          else if (report.status === 'rejected') rejected++;
        }
      }

      const total = lessons.length;
      const progressPercent = Math.round((completed / total) * 100);

      await this.sendMessage(chatId,
        `📊 **Ваш прогресс**\n\n` +
        `**Курс:** ${course?.title || 'Неизвестно'}\n` +
        `**Всего уроков:** ${total}\n` +
        `**Завершено:** ${completed} ✅\n` +
        `**На проверке:** ${pending} ⏳\n` +
        `**Отклонено:** ${rejected} ❌\n\n` +
        `**Общий прогресс:** ${progressPercent}%\n\n` +
        `${'█'.repeat(Math.floor(progressPercent / 10))}${'░'.repeat(10 - Math.floor(progressPercent / 10))}`
      );
    } catch (error) {
      console.error('Error in /progress command:', error);
      await this.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
    }
  }

  // Команда /reports
  private async handleReportsCommand(message: TelegramMessage): Promise<void> {
    const chatId = message.chat.id;
    const tgid = message.from.id.toString();

    try {
      const student = await this.db.getStudentByTgid(tgid);
      if (!student) {
        await this.sendMessage(chatId, '❌ Вы не зарегистрированы в системе');
        return;
      }

      const reports = await this.db.getAllReports();
      const studentReports = reports.filter(r => r.student_id === student.id);

      if (studentReports.length === 0) {
        await this.sendMessage(chatId, '📝 У вас пока нет отправленных отчетов');
        return;
      }

      let message = '📝 **История ваших отчетов:**\n\n';
      
      for (const report of studentReports.slice(-5)) {
        const lesson = await this.db.getLessonById(report.lesson_id);
        const status = report.status === 'approved' ? '✅' : 
                      report.status === 'pending' ? '⏳' : '❌';
        
        message += `${status} **${lesson?.title || 'Неизвестный урок'}**\n`;
        message += `📅 ${new Date(report.submitted_at).toLocaleDateString('ru-RU')}\n`;
        message += `Статус: ${this.getStatusText(report.status)}\n`;
        
        if (report.admin_comment) {
          message += `💬 Комментарий: ${report.admin_comment}\n`;
        }
        message += '\n';
      }

      await this.sendMessage(chatId, message);
    } catch (error) {
      console.error('Error in /reports command:', error);
      await this.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
    }
  }

  // Команда /submit
  private async handleSubmitCommand(message: TelegramMessage): Promise<void> {
    const chatId = message.chat.id;
    const tgid = message.from.id.toString();

    if (!message.reply_to_message) {
      await this.sendMessage(chatId, '❌ Ответьте на сообщение с файлом командой /submit');
      return;
    }

    try {
      const student = await this.db.getStudentByTgid(tgid);
      if (!student) {
        await this.sendMessage(chatId, '❌ Вы не зарегистрированы в системе');
        return;
      }

      const replyMessage = message.reply_to_message;
      const file = replyMessage.document || replyMessage.photo?.[0];

      if (!file) {
        await this.sendMessage(chatId, '❌ Файл не найден. Отправьте документ или фото');
        return;
      }

      const lessons = await this.db.getLessonsByCourse(student.course_id);
      const reports = await this.db.getAllReports();
      const studentReports = reports.filter(r => r.student_id === student.id);
      
      let currentLessonIndex = 0;
      for (let i = 0; i < lessons.length; i++) {
        const lessonReport = studentReports.find(r => r.lesson_id === lessons[i].id);
        if (!lessonReport || lessonReport.status === 'rejected') {
          currentLessonIndex = i;
          break;
        }
      }

      const currentLesson = lessons[currentLessonIndex];
      if (!currentLesson) {
        await this.sendMessage(chatId, '❌ Не удалось определить текущий урок');
        return;
      }

      const existingReport = studentReports.find(r => r.lesson_id === currentLesson.id);
      if (existingReport && existingReport.status !== 'rejected') {
        await this.sendMessage(chatId, '❌ Отчет для этого урока уже отправлен');
        return;
      }

      const report = await this.db.createReport({
        student_id: student.id,
        lesson_id: currentLesson.id
      });

      const adminMessage = 
        `📝 **Новый отчет**\n\n` +
        `**Студент:** ${student.name}\n` +
        `**Город:** ${student.city}\n` +
        `**Урок:** ${currentLesson.title}\n` +
        `**ID отчета:** ${report.id}\n\n` +
        `Для рецензирования используйте веб-интерфейс`;

      await this.sendMessage(this.adminChatId, adminMessage);
      
      await this.sendMessage(chatId,
        `✅ **Отчет отправлен!**\n\n` +
        `**Урок:** ${currentLesson.title}\n` +
        `**Статус:** На проверке ⏳\n\n` +
        `Вы получите уведомление, когда отчет будет проверен.`
      );

    } catch (error) {
      console.error('Error in /submit command:', error);
      await this.sendMessage(chatId, '❌ Произошла ошибка при отправке отчета. Попробуйте позже.');
    }
  }

  // Обработка документов
  private async handleDocument(message: TelegramMessage): Promise<void> {
    const chatId = message.chat.id;

    await this.sendMessage(chatId,
      '📎 Файл получен!\n\n' +
      'Чтобы отправить его как отчет, ответьте на это сообщение командой /submit'
    );
  }

  // Обработка фото
  private async handlePhoto(message: TelegramMessage): Promise<void> {
    const chatId = message.chat.id;

    await this.sendMessage(chatId,
      '📸 Фото получено!\n\n' +
      'Чтобы отправить его как отчет, ответьте на это сообщение командой /submit'
    );
  }

  // Обработка callback query
  private async handleCallbackQuery(callbackQuery: any): Promise<void> {
    // TODO: Реализовать обработку inline кнопок
    console.log('Callback query received:', callbackQuery);
  }

  // Отправка сообщения
  async sendMessage(chatId: number | string, text: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBase}${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'Markdown'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Telegram API error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error sending message:', error);
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

  private getStatusText(status: string): string {
    switch (status) {
      case 'pending': return 'На проверке ⏳';
      case 'approved': return 'Одобрен ✅';
      case 'rejected': return 'Отклонен ❌';
      default: return 'Неизвестно';
    }
  }
} 