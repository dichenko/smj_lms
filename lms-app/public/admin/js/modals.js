// Модуль управления модальными окнами

window.Modals = {
    // Закрыть модальное окно
    close(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    },

    // Показать модальное окно добавления студента
    async showAddStudent() {
        // Загружаем курсы для чекбоксов
        if (!window.Utils.isArray(window.App.courses) || window.App.courses.length === 0) {
            try {
                const data = await window.API.courses.getAll();
                window.App.courses = data.courses || [];
            } catch (error) {
                console.error('Error loading courses for modal:', error);
                window.App.courses = [];
            }
        }
        
        const checkboxesContainer = document.getElementById('courseCheckboxes');
        if (checkboxesContainer) {
            checkboxesContainer.innerHTML = window.App.courses.map(course => `
                <div class="course-checkbox-item">
                    <label class="course-checkbox-label">
                        <input type="checkbox" value="${course.id}" class="course-checkbox">
                        <span class="course-checkbox-text">${course.title}</span>
                    </label>
                </div>
            `).join('');
        }
        
        const modal = document.getElementById('addStudentModal');
        if (modal) {
            modal.style.display = 'block';
        }
    },

    // Показать модальное окно редактирования студента
    async showEditStudent(student) {
        // Заполняем форму данными студента
        window.Utils.setElementValue('editStudentId', student.id);
        window.Utils.setElementValue('editStudentTgid', student.tgid);
        window.Utils.setElementValue('editStudentName', student.name);
        window.Utils.setElementValue('editStudentCity', student.city);
        
        // Убеждаемся, что курсы загружены
        if (!window.Utils.isArray(window.App.courses) || window.App.courses.length === 0) {
            try {
                const data = await window.API.courses.getAll();
                window.App.courses = data.courses || [];
            } catch (error) {
                console.error('Error loading courses for edit modal:', error);
                window.App.courses = [];
            }
        }
        
        // Загружаем курсы как минималистичные кнопки
        const coursesContainer = document.getElementById('editCourseCheckboxes');
        
        if (coursesContainer) {
            if (window.App.courses.length === 0) {
                coursesContainer.innerHTML = '<p class="no-courses">Курсы не найдены</p>';
            } else {
                coursesContainer.innerHTML = window.App.courses.map(course => {
                    const isEnrolled = (student.courses || []).some(sc => sc.id === course.id);
                    return `
                        <button type="button" 
                                class="course-toggle-btn ${isEnrolled ? 'enrolled' : 'not-enrolled'}" 
                                data-course-id="${course.id}"
                                onclick="window.StudentsPage.toggleCourse(this, '${course.id}')">
                            ${course.title}
                        </button>
                    `;
                }).join('');
            }
        }
        
        const modal = document.getElementById('editStudentModal');
        if (modal) {
            modal.style.display = 'block';
        }
    },

    // Показать модальное окно управления курсами студента
    async showManageCourses(student) {
        if (!window.Utils.isArray(window.App.courses) || window.App.courses.length === 0) {
            try {
                const data = await window.API.courses.getAll();
                window.App.courses = data.courses || [];
            } catch (error) {
                console.error('Error loading courses for manage modal:', error);
                window.App.courses = [];
            }
        }
        
        const content = document.getElementById('manageCoursesContent');
        if (content) {
            content.innerHTML = `
                <h4>${student.name} - Управление курсами</h4>
                <div class="form-group">
                    <label>Текущие курсы:</label>
                    <div id="currentCourses" class="current-courses-list">
                        ${(student.courses || []).map(course => `
                            <div class="current-course-item">
                                <span class="course-name">${course.title}</span>
                                <button class="btn btn-sm btn-danger" onclick="window.StudentsPage.unenrollCourse('${student.id}', '${course.id}')">
                                    <span class="btn-icon">✕</span> Отчислить
                                </button>
                            </div>
                        `).join('')}
                        ${(student.courses || []).length === 0 ? '<p class="no-courses">Студент не зачислен ни на один курс</p>' : ''}
                    </div>
                </div>
                <div class="form-group">
                    <label>Добавить на курс:</label>
                    <select id="enrollCourseSelect" class="course-select">
                        <option value="">Выберите курс для зачисления</option>
                        ${window.App.courses.filter(course => !(student.courses || []).some(sc => sc.id === course.id))
                            .map(course => `<option value="${course.id}">${course.title}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <button class="btn" onclick="window.StudentsPage.enrollCourse('${student.id}')">
                        <span class="btn-icon">+</span> Зачислить
                    </button>
                    <button class="btn btn-secondary" onclick="window.Modals.close('manageCoursesModal')">Закрыть</button>
                </div>
            `;
        }
        
        const modal = document.getElementById('manageCoursesModal');
        if (modal) {
            modal.style.display = 'block';
        }
    },

    // Показать модальное окно добавления курса
    async showAddCourse() {
        // Очищаем форму
        const form = document.getElementById('addCourseForm');
        if (form) {
            form.reset();
        }
        
        const modal = document.getElementById('addCourseModal');
        if (modal) {
            modal.style.display = 'block';
        }
    },

    // Показать модальное окно редактирования курса
    async showEditCourse(course) {
        // Заполняем форму данными курса
        window.Utils.setElementValue('editCourseId', course.id);
        window.Utils.setElementValue('editCourseTitle', course.title);
        window.Utils.setElementValue('editCourseDescription', course.description || '');
        
        const modal = document.getElementById('editCourseModal');
        if (modal) {
            modal.style.display = 'block';
        }
    },

    // Показать модальное окно добавления урока
    async showAddLesson() {
        // Убеждаемся, что курсы загружены
        if (!window.Utils.isArray(window.App.courses) || window.App.courses.length === 0) {
            try {
                const data = await window.API.courses.getAll();
                window.App.courses = data.courses || [];
            } catch (error) {
                console.error('Error loading courses for lesson modal:', error);
                window.App.courses = [];
            }
        }
        
        const courseSelect = document.getElementById('lessonCourse');
        if (courseSelect) {
            courseSelect.innerHTML = '<option value="">Выберите курс</option>' +
                window.App.courses.map(course => `<option value="${course.id}">${course.title}</option>`).join('');
        }
        
        // Очищаем форму
        const form = document.getElementById('addLessonForm');
        if (form) {
            form.reset();
        }
        
        const modal = document.getElementById('addLessonModal');
        if (modal) {
            modal.style.display = 'block';
        }
    },

    // Показать модальное окно редактирования урока
    async showEditLesson(lesson) {
        // Убеждаемся, что курсы загружены
        if (!window.Utils.isArray(window.App.courses) || window.App.courses.length === 0) {
            try {
                const data = await window.API.courses.getAll();
                window.App.courses = data.courses || [];
            } catch (error) {
                console.error('Error loading courses for edit lesson modal:', error);
                window.App.courses = [];
            }
        }
        
        // Заполняем форму данными урока
        window.Utils.setElementValue('editLessonId', lesson.id);
        window.Utils.setElementValue('editLessonTitle', lesson.title);
        window.Utils.setElementValue('editLessonOrder', lesson.order_num);
        window.Utils.setElementValue('editLessonContent', lesson.content);
        
        // Заполняем список курсов
        const courseSelect = document.getElementById('editLessonCourse');
        if (courseSelect) {
            courseSelect.innerHTML = '<option value="">Выберите курс</option>' +
                window.App.courses.map(course => 
                    `<option value="${course.id}" ${course.id === lesson.course.id ? 'selected' : ''}>${course.title}</option>`
                ).join('');
        }
        
        const modal = document.getElementById('editLessonModal');
        if (modal) {
            modal.style.display = 'block';
        }
    },

    // Показать модальное окно с информацией об уроке
    showLessonInfo(lessonId, lessonTitle, courseTitle, lessonOrder, lessonStatus, lessonDescription) {
        const modal = document.getElementById('lessonModal');
        if (!modal) return;
        
        const content = modal.querySelector('.modal-content');
        if (!content) return;
        
        const statusText = window.Utils.getLessonStatusText(lessonStatus);
        const statusClass = lessonStatus;
        const description = lessonDescription || 'Описание не указано';
        
        content.innerHTML = `
            <span class="close" onclick="window.Modals.close('lessonModal')">&times;</span>
            <h3>📚 Информация об уроке</h3>
            <div class="lesson-info">
                <div class="info-row">
                    <label>Номер урока:</label>
                    <span class="lesson-number-display">${lessonOrder}</span>
                </div>
                <div class="info-row">
                    <label>Название:</label>
                    <span class="lesson-title-display">${lessonTitle}</span>
                </div>
                <div class="info-row">
                    <label>Курс:</label>
                    <span class="course-title-display">${courseTitle}</span>
                </div>
                <div class="info-row">
                    <label>Описание:</label>
                    <span class="lesson-description-display">${description}</span>
                </div>
                <div class="info-row">
                    <label>Статус:</label>
                    <span class="lesson-status-display ${statusClass}">${statusText}</span>
                </div>
            </div>
            <div class="form-group">
                <button class="btn btn-secondary" onclick="window.Modals.close('lessonModal')">Закрыть</button>
            </div>
        `;
        
        modal.style.display = 'block';
    },

    // Показать детали отчета
    async showReportDetails(report) {
        // Простая реализация - можно расширить
        alert(`Отчет от ${report.student.name}\nКурс: ${report.course.title}\nУрок: ${report.lesson.title}\nСтатус: ${window.Utils.getReportStatusText(report.status)}`);
    },

    // Инициализация модальных окон
    init() {
        // Закрытие модальных окон при клике вне их
        window.addEventListener('click', (event) => {
            if (event.target.classList.contains('modal')) {
                event.target.style.display = 'none';
            }
        });

        // Закрытие модальных окон по ESC
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                const openModals = document.querySelectorAll('.modal[style*="block"]');
                openModals.forEach(modal => {
                    modal.style.display = 'none';
                });
            }
        });
    }
};

// Глобальные функции для обратной совместимости
window.closeModal = (modalId) => window.Modals.close(modalId);
window.showLessonModal = (lessonId, lessonTitle, courseTitle, lessonOrder, lessonStatus, lessonDescription) => 
    window.Modals.showLessonInfo(lessonId, lessonTitle, courseTitle, lessonOrder, lessonStatus, lessonDescription);