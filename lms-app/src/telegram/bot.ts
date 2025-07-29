import { DatabaseService } from '../utils/database';

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

    // Обработка файлов для отчетов
    if (message.document || message.photo) {
      await this.handleFileUpload(message);
      return;
    }

    // Обычные сообщения
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
      await this.sendMessage(chatId, '❌ Неизвестная команда. Используйте /start');
    }
  }

  // Команда /start - главная логика
  private async handleStartCommand(message: TelegramMessage): Promise<void> {
    const chatId = message.chat.id;
    const tgid = message.from.id.toString();

    try {
      // Проверяем, есть ли студент в базе
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

      await this.showStudentDashboard(chatId, student.id);

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

      // Получаем все курсы студента через новую таблицу student_courses
      const studentCourses = await this.db.getStudentCourses(studentId);

      if (studentCourses.length === 0) {
        await this.sendMessage(chatId, '❌ У вас нет назначенных курсов');
        return;
      }

      // Сортируем курсы по ID
      studentCourses.sort((a, b) => parseInt(a.course.id) - parseInt(b.course.id));

      let message = `👋 Добро пожаловать, ${student.name}!\n\n`;
      message += '📚 **Ваши курсы:**\n\n';

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

        message += `• **${course.title}**\n`;
        message += `  Прогресс: ${completedLessons}/${totalLessons} (${progress}%)\n\n`;

        // Каждая кнопка в отдельной строке
        buttons.push([{
          text: `📖 ${course.title} (${progress}%)`,
          callback_data: `course_${course.id}`
        }]);
      }

      const keyboard: InlineKeyboard = {
        inline_keyboard: buttons
      };

      await this.sendMessageWithKeyboard(chatId, message, keyboard);

    } catch (error: any) {
      console.error('Error showing dashboard:', error);
      await this.sendMessage(chatId, '❌ Произошла ошибка при загрузке данных');
    }
  }

  // Показать текущий урок курса
  private async showCurrentLesson(chatId: number, studentId: string, courseId: string): Promise<void> {
    try {
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

      // Находим первый незавершенный урок
      const reports = await this.db.getAllReports();
      const studentReports = reports.filter(r => r.student_id === student.id);
      
      let currentLesson = lessons[0];
      
      for (const lesson of lessons) {
        const report = studentReports.find(r => r.lesson_id === lesson.id);
        if (!report || report.status !== 'approved') {
          currentLesson = lesson;
          break;
        }
      }

      // Проверяем статус текущего урока
      const currentReport = studentReports.find(r => r.lesson_id === currentLesson.id);
      
      let message = `📖 **${course.title}**\n\n`;
      message += `**Урок ${currentLesson.order_num}: ${currentLesson.title}**\n\n`;
      message += `${currentLesson.content}\n\n`;

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

      await this.sendMessageWithKeyboard(chatId, message, keyboard);

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
      const student = await this.db.getStudentByTgid(tgid);
      if (!student) {
        await this.answerCallbackQuery(callbackQuery.id, 'Вы не зарегистрированы в системе');
        return;
      }

      if (data.startsWith('course_')) {
        const courseId = data.replace('course_', '');
        await this.showCurrentLesson(chatId, student.id, courseId);
      } else if (data === 'back_to_courses') {
        await this.showStudentDashboard(chatId, student.id);
      } else if (data.startsWith('submit_')) {
        const lessonId = data.replace('submit_', '');
        await this.handleSubmitRequest(chatId, student.id, lessonId);
      } else if (data.startsWith('admin_approve_')) {
        await this.handleAdminApprove(callbackQuery);
      } else if (data.startsWith('admin_reject_')) {
        await this.handleAdminReject(callbackQuery);
      }

      await this.answerCallbackQuery(callbackQuery.id);

    } catch (error: any) {
      console.error('Error handling callback:', error);
      await this.answerCallbackQuery(callbackQuery.id, 'Произошла ошибка');
    }
  }

  // Запрос на отправку отчета
  private async handleSubmitRequest(chatId: number, studentId: string, lessonId: string): Promise<void> {
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

  // Обработка загруженных файлов
  private async handleFileUpload(message: TelegramMessage): Promise<void> {
    const chatId = message.chat.id;
    const tgid = message.from.id.toString();

    try {
      const student = await this.db.getStudentByTgid(tgid);
      if (!student) {
        await this.sendMessage(chatId, '❌ Вы не зарегистрированы в системе');
        return;
      }

      // Получаем все курсы студента
      const studentCourses = await this.db.getStudentCourses(student.id);
      
      if (studentCourses.length === 0) {
        await this.sendMessage(chatId, '❌ У вас нет назначенных курсов');
        return;
      }

      // Находим первый курс с незавершенными уроками
      let currentLesson = null;
      let currentCourse = null;
      const reports = await this.db.getAllReports();
      const studentReports = reports.filter(r => r.student_id === student.id);

      // Проходим по всем курсам студента и ищем первый незавершенный урок
      for (const studentCourse of studentCourses) {
        if (!studentCourse.is_active) continue;

        const lessons = await this.db.getLessonsByCourse(studentCourse.course_id);
        lessons.sort((a, b) => a.order_num - b.order_num);

        for (const lesson of lessons) {
          const report = studentReports.find(r => r.lesson_id === lesson.id);
          if (!report || report.status !== 'approved') {
            currentLesson = lesson;
            currentCourse = studentCourse.course;
            break;
          }
        }

        if (currentLesson) break;
      }

      if (!currentLesson || !currentCourse) {
        await this.sendMessage(chatId, '❌ Нет доступных уроков для сдачи отчета');
        return;
      }

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
        await this.sendMessage(chatId, '❌ Отчет для этого урока уже отправлен');
        return;
      }

      if (!report) {
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

      // Уведомляем студента
      await this.sendMessage(chatId,
        `✅ **Отчет принят на проверку!**\n\n` +
        `**Урок:** ${currentLesson.title}\n` +
        `**Статус:** На проверке ⏳\n\n` +
        `Вы получите уведомление, когда отчет будет проверен.`
      );

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
        reviewed_by: 'admin'
      });

      // Получаем данные для уведомления студента
      const student = await this.db.getStudentById(report.student_id);
      const lesson = await this.db.getLessonById(report.lesson_id);
      
      if (student && lesson) {
        // Уведомляем студента
        await this.sendMessage(student.tgid,
          `🎉 **Отчет одобрен!**\n\n` +
          `**Урок:** ${lesson.title}\n` +
          `**Статус:** Принят ✅\n\n` +
          `Поздравляем! Вы можете перейти к следующему уроку.\n\n` +
          `Используйте /start для продолжения обучения.`
        );
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

  async sendMessageWithKeyboard(chatId: number | string, text: string, keyboard: InlineKeyboard): Promise<boolean> {
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
} 