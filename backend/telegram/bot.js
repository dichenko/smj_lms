// Telegram Bot - обработка сообщений от учеников

import { jsonResponse, errorResponse } from '../worker.js';

// Главный обработчик Telegram webhook
export async function handleTelegramWebhook(request, env) {
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const update = await request.json();
    
    // Обрабатываем только сообщения (не inline queries и т.д.)
    if (update.message) {
      await handleMessage(update.message, env);
    } else if (update.document || update.photo) {
      await handleFileUpload(update, env);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return errorResponse('Webhook processing failed', 500);
  }
}

// Обработка текстовых сообщений
async function handleMessage(message, env) {
  const chatId = message.chat.id;
  const text = message.text;
  const userId = message.from.id.toString();

  // Проверяем, есть ли ученик в базе
  const student = await getStudentByTgId(env.DB, userId);
  
  if (!student) {
    await sendMessage(env, chatId, 
      '❌ Вы не зарегистрированы в системе. Обратитесь к администратору для добавления.');
    return;
  }

  // Обработка команд
  if (text === '/start') {
    await handleStartCommand(env, chatId, student);
  } else if (text === '📚 Мои задания') {
    await handleMyLessonsCommand(env, chatId, student);
  } else if (text === '📝 Сдать отчет') {
    await handleSubmitReportCommand(env, chatId, student);
  } else if (text === '📋 История') {
    await handleHistoryCommand(env, chatId, student);
  } else {
    await sendMessage(env, chatId, 
      'Пожалуйста, используйте кнопки меню для навигации.');
  }
}

// Обработка загруженных файлов (отчеты)
async function handleFileUpload(update, env) {
  const message = update.message;
  const chatId = message.chat.id;
  const userId = message.from.id.toString();

  const student = await getStudentByTgId(env.DB, userId);
  if (!student) {
    await sendMessage(env, chatId, '❌ Вы не зарегистрированы в системе.');
    return;
  }

  // Получаем текущий урок студента
  const currentLesson = await getCurrentLesson(env.DB, student.id);
  if (!currentLesson) {
    await sendMessage(env, chatId, '❌ У вас нет активных заданий.');
    return;
  }

  // Проверяем, не сдавал ли уже отчет по этому уроку
  const existingReport = await getReport(env.DB, student.id, currentLesson.id);
  if (existingReport && existingReport.status !== 'rejected') {
    await sendMessage(env, chatId, '❌ Вы уже сдали отчет по этому уроку.');
    return;
  }

  // Получаем file_id для пересылки админу
  let fileId;
  if (message.document) {
    fileId = message.document.file_id;
  } else if (message.photo) {
    fileId = message.photo[message.photo.length - 1].file_id; // Берем самое большое фото
  } else {
    await sendMessage(env, chatId, '❌ Поддерживаются только документы и изображения.');
    return;
  }

  // Сохраняем отчет в базу
  await saveReport(env.DB, student.id, currentLesson.id, fileId);

  // Пересылаем файл админу
  await forwardReportToAdmin(env, student, currentLesson, fileId, message);

  await sendMessage(env, chatId, 
    '✅ Отчет успешно отправлен на проверку! Вы получите уведомление о результате.');
}

// Команда /start
async function handleStartCommand(env, chatId, student) {
  const keyboard = {
    keyboard: [
      ['📚 Мои задания', '📝 Сдать отчет'],
      ['📋 История']
    ],
    resize_keyboard: true,
    persistent: true
  };

  const welcomeMessage = `Добро пожаловать, ${student.name}! 👋

Вы зарегистрированы в системе обучения.
Используйте кнопки меню для навигации.`;

  await sendMessage(env, chatId, welcomeMessage, keyboard);
}

// Команда "Мои задания"
async function handleMyLessonsCommand(env, chatId, student) {
  const currentLesson = await getCurrentLesson(env.DB, student.id);
  
  if (!currentLesson) {
    await sendMessage(env, chatId, '🎉 Поздравляем! Вы прошли все уроки курса!');
    return;
  }

  const course = await getCourse(env.DB, student.course_id);
  const totalLessons = await getTotalLessons(env.DB, student.course_id);

  let message = `📚 Текущее задание:\n\n`;
  message += `📖 Курс: ${course.title}\n`;
  message += `📝 Урок ${student.active_lesson} из ${totalLessons}: ${currentLesson.title}\n\n`;
  
  if (currentLesson.description) {
    message += `📋 Описание:\n${currentLesson.description}\n\n`;
  }

  if (currentLesson.links) {
    const links = JSON.parse(currentLesson.links);
    if (links.length > 0) {
      message += `🔗 Полезные ссылки:\n`;
      links.forEach(link => {
        message += `• ${link}\n`;
      });
    }
  }

  await sendMessage(env, chatId, message);
}

// Команда "Сдать отчет"
async function handleSubmitReportCommand(env, chatId, student) {
  const currentLesson = await getCurrentLesson(env.DB, student.id);
  
  if (!currentLesson) {
    await sendMessage(env, chatId, '🎉 У вас нет активных заданий!');
    return;
  }

  const existingReport = await getReport(env.DB, student.id, currentLesson.id);
  if (existingReport && existingReport.status === 'pending') {
    await sendMessage(env, chatId, '⏳ Ваш отчет находится на проверке. Ожидайте результат.');
    return;
  }

  if (existingReport && existingReport.status === 'approved') {
    await sendMessage(env, chatId, '✅ Вы уже успешно сдали этот урок!');
    return;
  }

  await sendMessage(env, chatId, 
    `📝 Отправьте файл отчета по уроку "${currentLesson.title}".\n\nПоддерживаются документы и изображения.`);
}

// Команда "История"
async function handleHistoryCommand(env, chatId, student) {
  const reports = await getStudentReports(env.DB, student.id);
  
  if (reports.length === 0) {
    await sendMessage(env, chatId, '📋 У вас пока нет сданных отчетов.');
    return;
  }

  let message = '📋 История ваших отчетов:\n\n';
  
  for (const report of reports) {
    const lesson = await getLesson(env.DB, report.lesson_id);
    const statusEmoji = report.status === 'approved' ? '✅' : 
                       report.status === 'rejected' ? '❌' : '⏳';
    
    message += `${statusEmoji} ${lesson.title}\n`;
    message += `   Сдано: ${new Date(report.submitted_at).toLocaleDateString('ru-RU')}\n`;
    
    if (report.admin_comment) {
      message += `   💬 Комментарий: ${report.admin_comment}\n`;
    }
    message += '\n';
  }

  await sendMessage(env, chatId, message);
}

// Пересылка отчета админу
async function forwardReportToAdmin(env, student, lesson, fileId, originalMessage) {
  const course = await getCourse(env.DB, student.course_id);
  
  const caption = `📝 Новый отчет от студента\n\n` +
    `👤 Студент: ${student.name}\n` +
    `📖 Курс: ${course.title}\n` +
    `📝 Урок: ${lesson.title}\n` +
    `📅 Дата: ${new Date().toLocaleDateString('ru-RU')}`;

  // Пересылаем файл
  if (originalMessage.document) {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendDocument`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_ADMIN_ID,
        document: fileId,
        caption: caption
      })
    });
  } else if (originalMessage.photo) {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_ADMIN_ID,
        photo: fileId,
        caption: caption
      })
    });
  }
}

// Уведомление студента о результате проверки
export async function notifyStudent(env, studentTgId, lessonTitle, status, comment = null) {
  let message;
  
  if (status === 'approved') {
    message = `✅ Ваш отчет по уроку "${lessonTitle}" принят!\n\nМожете переходить к следующему заданию.`;
  } else {
    message = `❌ Ваш отчет по уроку "${lessonTitle}" отправлен на доработку.`;
    if (comment) {
      message += `\n\n💬 Комментарий преподавателя:\n${comment}`;
    }
    message += '\n\nПожалуйста, исправьте замечания и отправьте отчет заново.';
  }

  await sendMessage(env, studentTgId, message);
}

// Вспомогательные функции для работы с базой данных
async function getStudentByTgId(db, tgId) {
  const stmt = db.prepare('SELECT * FROM students WHERE tg_id = ?');
  const result = await stmt.bind(tgId).first();
  return result;
}

async function getCurrentLesson(db, studentId) {
  const stmt = db.prepare(`
    SELECT l.* FROM lessons l 
    JOIN students s ON s.course_id = l.course_id 
    WHERE s.id = ? AND l."order" = s.active_lesson
  `);
  return await stmt.bind(studentId).first();
}

async function getCourse(db, courseId) {
  const stmt = db.prepare('SELECT * FROM courses WHERE id = ?');
  return await stmt.bind(courseId).first();
}

async function getTotalLessons(db, courseId) {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM lessons WHERE course_id = ?');
  const result = await stmt.bind(courseId).first();
  return result.count;
}

async function getReport(db, studentId, lessonId) {
  const stmt = db.prepare('SELECT * FROM reports WHERE student_id = ? AND lesson_id = ?');
  return await stmt.bind(studentId, lessonId).first();
}

async function getLesson(db, lessonId) {
  const stmt = db.prepare('SELECT * FROM lessons WHERE id = ?');
  return await stmt.bind(lessonId).first();
}

async function saveReport(db, studentId, lessonId, fileId) {
  const stmt = db.prepare(`
    INSERT INTO reports (student_id, lesson_id, telegram_file_id, status) 
    VALUES (?, ?, ?, 'pending')
  `);
  return await stmt.bind(studentId, lessonId, fileId).run();
}

async function getStudentReports(db, studentId) {
  const stmt = db.prepare(`
    SELECT * FROM reports 
    WHERE student_id = ? 
    ORDER BY submitted_at DESC
  `);
  return await stmt.bind(studentId).all();
}

// Отправка сообщения в Telegram
async function sendMessage(env, chatId, text, keyboard = null) {
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML'
  };

  if (keyboard) {
    payload.reply_markup = keyboard;
  }

  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
} 