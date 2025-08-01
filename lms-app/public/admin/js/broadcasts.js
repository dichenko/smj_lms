// Broadcasts.js - Управление рассылками

class BroadcastsPage {
    constructor() {
        this.courses = [];
        this.lessons = [];
        this.recipients = [];
        this.init();
    }

    async init() {
        await this.loadCourses();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Обработчик формы создания рассылки
        const broadcastForm = document.getElementById('broadcastForm');
        if (broadcastForm) {
            broadcastForm.addEventListener('submit', (e) => this.handleBroadcastSubmit(e));
        }
    }

    async loadCourses() {
        try {
            const response = await fetch('/api/courses');
            const data = await response.json();
            
            if (data.courses) {
                this.courses = data.courses;
                this.populateCourseSelect();
            }
        } catch (error) {
            console.error('Ошибка загрузки курсов:', error);
            showNotification('Ошибка загрузки курсов', 'error');
        }
    }

    populateCourseSelect() {
        const courseSelect = document.getElementById('broadcastCourse');
        if (!courseSelect) return;

        // Очищаем существующие опции
        courseSelect.innerHTML = '<option value="">Выберите курс</option>';
        
        // Добавляем курсы
        this.courses.forEach(course => {
            const option = document.createElement('option');
            option.value = course.id;
            option.textContent = course.title;
            courseSelect.appendChild(option);
        });
    }

    async loadBroadcastLessons() {
        const courseSelect = document.getElementById('broadcastCourse');
        const lessonSelect = document.getElementById('broadcastLesson');
        
        if (!courseSelect || !lessonSelect) return;

        const courseId = courseSelect.value;
        if (!courseId) {
            lessonSelect.innerHTML = '<option value="">Сначала выберите курс</option>';
            return;
        }

        try {
            const response = await fetch(`/api/courses/${courseId}/lessons`);
            const data = await response.json();
            
            if (data.lessons) {
                this.lessons = data.lessons.sort((a, b) => a.order_num - b.order_num);
                this.populateLessonSelect();
            }
        } catch (error) {
            console.error('Ошибка загрузки уроков:', error);
            showNotification('Ошибка загрузки уроков', 'error');
        }
    }

    populateLessonSelect() {
        const lessonSelect = document.getElementById('broadcastLesson');
        if (!lessonSelect) return;

        // Очищаем существующие опции
        lessonSelect.innerHTML = '<option value="">Выберите урок</option>';
        
        // Добавляем уроки
        this.lessons.forEach(lesson => {
            const option = document.createElement('option');
            option.value = lesson.id;
            option.textContent = `Урок ${lesson.order_num}: ${lesson.title}`;
            lessonSelect.appendChild(option);
        });
    }

    async updateBroadcastStats() {
        const courseSelect = document.getElementById('broadcastCourse');
        const lessonSelect = document.getElementById('broadcastLesson');
        const recipientsDiv = document.getElementById('broadcastRecipients');
        
        if (!courseSelect || !lessonSelect || !recipientsDiv) return;

        const courseId = courseSelect.value;
        const lessonId = lessonSelect.value;

        if (!courseId || !lessonId) {
            recipientsDiv.innerHTML = '<p>Выберите курс и урок для просмотра списка получателей</p>';
            return;
        }

        try {
            // Получаем студентов, которые не сдали этот урок
            const response = await fetch(`/api/broadcasts/recipients?courseId=${courseId}&lessonId=${lessonId}`);
            const data = await response.json();
            
            if (data.recipients) {
                this.recipients = data.recipients;
                this.displayRecipients();
            }
        } catch (error) {
            console.error('Ошибка загрузки получателей:', error);
            showNotification('Ошибка загрузки получателей', 'error');
        }
    }

    displayRecipients() {
        const recipientsDiv = document.getElementById('broadcastRecipients');
        if (!recipientsDiv) return;

        if (this.recipients.length === 0) {
            recipientsDiv.innerHTML = '<p class="no-recipients">🎉 Все студенты сдали этот урок!</p>';
            return;
        }

        const course = this.courses.find(c => c.id === document.getElementById('broadcastCourse').value);
        const lesson = this.lessons.find(l => l.id === document.getElementById('broadcastLesson').value);

        let html = `
            <div class="recipients-summary">
                <p><strong>📊 Статистика:</strong></p>
                <p>Курс: <strong>${course?.title || 'Неизвестно'}</strong></p>
                <p>Урок: <strong>${lesson ? `Урок ${lesson.order_num}: ${lesson.title}` : 'Неизвестно'}</strong></p>
                <p>Получателей: <strong>${this.recipients.length}</strong></p>
            </div>
            <div class="recipients-list">
                <p><strong>👥 Список получателей:</strong></p>
                <ul>
        `;

        this.recipients.forEach(recipient => {
            html += `<li>${recipient.name} (${recipient.city})</li>`;
        });

        html += '</ul></div>';
        recipientsDiv.innerHTML = html;
    }

    async handleBroadcastSubmit(e) {
        e.preventDefault();

        const courseId = document.getElementById('broadcastCourse').value;
        const lessonId = document.getElementById('broadcastLesson').value;
        const message = document.getElementById('broadcastMessage').value;

        if (!courseId || !lessonId || !message.trim()) {
            showNotification('Пожалуйста, заполните все поля', 'error');
            return;
        }

        if (this.recipients.length === 0) {
            showNotification('Нет получателей для рассылки', 'warning');
            return;
        }

        // Показываем подтверждение
        const confirmed = confirm(`Отправить рассылку ${this.recipients.length} студентам?\n\nКурс: ${this.courses.find(c => c.id === courseId)?.title}\nУрок: ${this.lessons.find(l => l.id === lessonId)?.title}\n\nТекст: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
        
        if (!confirmed) return;

        try {
            const response = await fetch('/api/broadcasts/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    courseId,
                    lessonId,
                    message: message.trim()
                })
            });

            const data = await response.json();

            if (data.success) {
                showNotification(`Рассылка успешно отправлена ${data.sentCount} студентам!`, 'success');
                closeModal('broadcastModal');
                this.resetForm();
                // Обновляем историю рассылок
                this.loadBroadcastHistory();
            } else {
                showNotification(data.error || 'Ошибка отправки рассылки', 'error');
            }
        } catch (error) {
            console.error('Ошибка отправки рассылки:', error);
            showNotification('Ошибка отправки рассылки', 'error');
        }
    }

    resetForm() {
        const form = document.getElementById('broadcastForm');
        if (form) {
            form.reset();
        }
        
        const recipientsDiv = document.getElementById('broadcastRecipients');
        if (recipientsDiv) {
            recipientsDiv.innerHTML = '<p>Выберите курс и урок для просмотра списка получателей</p>';
        }
        
        this.recipients = [];
    }

    async loadBroadcastHistory() {
        try {
            const response = await fetch('/api/broadcasts/history');
            const data = await response.json();
            
            if (data.broadcasts) {
                this.displayBroadcastHistory(data.broadcasts);
            }
        } catch (error) {
            console.error('Ошибка загрузки истории рассылок:', error);
        }
    }

    displayBroadcastHistory(broadcasts) {
        const tbody = document.getElementById('broadcastHistoryTableBody');
        if (!tbody) return;

        if (broadcasts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="no-data">История рассылок пуста</td></tr>';
            return;
        }

        tbody.innerHTML = broadcasts.map(broadcast => `
            <tr>
                <td>${new Date(broadcast.created_at).toLocaleString('ru-RU')}</td>
                <td>${broadcast.course_title}</td>
                <td>Урок ${broadcast.lesson_order}: ${broadcast.lesson_title}</td>
                <td>${broadcast.recipient_count}</td>
                <td>${broadcast.message.length > 50 ? broadcast.message.substring(0, 50) + '...' : broadcast.message}</td>
            </tr>
        `).join('');
    }
}

// Глобальные функции для вызова из HTML
function showBroadcastModal() {
    const modal = document.getElementById('broadcastModal');
    if (modal) {
        modal.style.display = 'block';
        // Загружаем курсы при открытии модального окна
        if (window.BroadcastsPage) {
            window.BroadcastsPage.loadCourses();
        }
    }
}

function loadBroadcastLessons() {
    if (window.BroadcastsPage) {
        window.BroadcastsPage.loadBroadcastLessons();
    }
}

function updateBroadcastStats() {
    if (window.BroadcastsPage) {
        window.BroadcastsPage.updateBroadcastStats();
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.BroadcastsPage = new BroadcastsPage();
});

// Экспорт для использования в других модулях
window.BroadcastsPage = window.BroadcastsPage || null; 