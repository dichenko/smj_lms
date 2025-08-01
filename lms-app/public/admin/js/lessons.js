// Модуль страницы управления уроками

window.LessonsPage = {
    // Загрузка уроков
    async load() {
        try {
            window.Utils.setElementHTML('lessonsTableBody', 
                '<tr><td colspan="6" class="loading">Загрузка данных...</td></tr>');
            
            const data = await window.API.lessons.getAll();
            window.App.lessons = data.lessons || [];
            
            console.log('Loaded lessons:', window.App.lessons.length);
            
            this.render();
            this.updateCourseFilter();
            
        } catch (error) {
            console.error('Error loading lessons:', error);
            window.App.lessons = [];
            window.Utils.setElementHTML('lessonsTableBody', 
                `<tr><td colspan="6" class="error">Ошибка загрузки данных: ${error.message}</td></tr>`);
            this.updateCourseFilter();
        }
    },

    // Отображение таблицы уроков
    render() {
        const tbody = document.getElementById('lessonsTableBody');
        if (!tbody) return;

        const courseFilter = window.Utils.getElementValue('lessonCourseFilter');
        const searchFilter = window.Utils.getElementValue('lessonSearchFilter').toLowerCase();
        
        if (!window.Utils.isArray(window.App.lessons)) {
            tbody.innerHTML = '<tr><td colspan="6" class="error">Ошибка: данные уроков некорректны</td></tr>';
            return;
        }
        
        // Фильтрация
        let filteredLessons = window.App.lessons;
        
        if (courseFilter) {
            filteredLessons = window.Utils.safeFilter(filteredLessons, 
                l => l && l.course && l.course.id === courseFilter);
        }
        
        if (searchFilter) {
            filteredLessons = window.Utils.safeFilter(filteredLessons,
                l => l && l.title && l.title.toLowerCase().includes(searchFilter));
        }
        
        if (filteredLessons.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="loading">Уроки не найдены</td></tr>';
            return;
        }
        
        // Генерация HTML
        try {
            tbody.innerHTML = filteredLessons.map(lesson => {
                if (!lesson || !lesson.course) return '';
                
                return `
                    <tr>
                        <td>
                            <span class="course-badge">${lesson.course.title || 'Без названия'}</span>
                        </td>
                        <td>
                            <strong style="font-size: 1.1em; color: #667eea;">${lesson.order_num || '?'}</strong>
                        </td>
                        <td>
                            <strong>${lesson.title || 'Без названия'}</strong>
                        </td>
                        <td>
                            <div style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${lesson.content || ''}">
                                ${lesson.content || 'Нет описания'}
                            </div>
                        </td>
                        <td>${window.Utils.formatDate(lesson.created_at)}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn btn-icon btn-edit" onclick="window.LessonsPage.edit('${lesson.id}')" title="Редактировать">✏️</button>
                                <button class="btn btn-icon btn-delete" onclick="window.LessonsPage.delete('${lesson.id}')" title="Удалить">✕</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).filter(html => html.trim() !== '').join('');
            
        } catch (error) {
            console.error('Error rendering lessons table:', error);
            tbody.innerHTML = '<tr><td colspan="6" class="error">Ошибка отображения данных</td></tr>';
        }
    },

    // Обновление фильтра курсов
    updateCourseFilter() {
        // Создаем Map для уникальных курсов по ID
        const uniqueCourses = new Map();
        window.App.lessons.forEach(lesson => {
            if (lesson.course && lesson.course.id) {
                uniqueCourses.set(lesson.course.id, lesson.course);
            }
        });
        
        // Преобразуем в массив и сортируем по названию
        const courses = Array.from(uniqueCourses.values()).sort((a, b) => a.title.localeCompare(b.title));
        const select = document.getElementById('lessonCourseFilter');
        
        if (select) {
            select.innerHTML = '<option value="">Все курсы</option>' +
                courses.map(course => `<option value="${course.id}">${course.title}</option>`).join('');
        }
    },

    // Фильтрация уроков
    filter() {
        this.render();
    },

    // Показать модальное окно добавления урока
    async showAddModal() {
        await window.Modals.showAddLesson();
    },

    // Добавление урока
    async add(event) {
        event.preventDefault();
        
        const formData = {
            course_id: window.Utils.getElementValue('lessonCourse'),
            title: window.Utils.getElementValue('lessonTitle'),
            order_num: parseInt(window.Utils.getElementValue('lessonOrder')),
            content: window.Utils.getElementValue('lessonContent')
        };
        
        try {
            await window.API.lessons.create(formData.course_id, formData);
            
            window.Modals.close('addLessonModal');
            document.getElementById('addLessonForm').reset();
            
            await this.load();
            
            window.Utils.showMessage('Урок успешно добавлен', 'success');
        } catch (error) {
            console.error('Error adding lesson:', error);
            window.Utils.showMessage(`Ошибка при добавлении урока: ${error.message}`, 'error');
        }
    },

    // Редактирование урока
    async edit(lessonId) {
        const lesson = window.App.lessons.find(l => l.id === lessonId);
        if (!lesson) return;
        
        await window.Modals.showEditLesson(lesson);
    },

    // Обновление урока
    async update(event) {
        event.preventDefault();
        
        const lessonId = window.Utils.getElementValue('editLessonId');
        const formData = {
            course_id: window.Utils.getElementValue('editLessonCourse'),
            title: window.Utils.getElementValue('editLessonTitle'),
            order_num: parseInt(window.Utils.getElementValue('editLessonOrder')),
            content: window.Utils.getElementValue('editLessonContent')
        };
        
        try {
            await window.API.lessons.update(lessonId, formData);
            
            window.Modals.close('editLessonModal');
            
            await this.load();
            
            window.Utils.showMessage('Урок успешно обновлен', 'success');
        } catch (error) {
            console.error('Error updating lesson:', error);
            window.Utils.showMessage(`Ошибка при обновлении урока: ${error.message}`, 'error');
        }
    },

    // Удаление урока
    async delete(lessonId) {
        if (!confirm('Удалить урок? Это действие нельзя отменить.')) return;
        
        try {
            await window.API.lessons.delete(lessonId);
            
            await this.load();
            
            window.Utils.showMessage('Урок удален', 'success');
        } catch (error) {
            console.error('Error deleting lesson:', error);
            window.Utils.showMessage(`Ошибка при удалении урока: ${error.message}`, 'error');
        }
    },

    // Инициализация обработчиков событий
    init() {
        // Обработчики фильтров
        const courseFilter = document.getElementById('lessonCourseFilter');
        const searchFilter = document.getElementById('lessonSearchFilter');
        
        if (courseFilter) {
            courseFilter.addEventListener('change', () => this.filter());
        }
        
        if (searchFilter) {
            searchFilter.addEventListener('keyup', () => this.filter());
        }

        // Обработчики форм
        const addForm = document.getElementById('addLessonForm');
        const editForm = document.getElementById('editLessonForm');
        
        if (addForm) {
            addForm.addEventListener('submit', (e) => this.add(e));
        }
        
        if (editForm) {
            editForm.addEventListener('submit', (e) => this.update(e));
        }
    }
};

// Глобальные функции для обратной совместимости
window.loadLessons = () => window.LessonsPage.load();
window.filterLessons = () => window.LessonsPage.filter();
window.showAddLessonModal = () => window.LessonsPage.showAddModal();
window.addLesson = (e) => window.LessonsPage.add(e);
window.editLesson = (id) => window.LessonsPage.edit(id);
window.updateLesson = (e) => window.LessonsPage.update(e);
window.deleteLesson = (id) => window.LessonsPage.delete(id);