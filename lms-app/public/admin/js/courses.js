// Модуль страницы управления курсами

window.CoursesPage = {
    // Загрузка курсов
    async load() {
        try {
            const data = await window.API.courses.getAll();
            window.App.courses = data.courses || [];
            this.render();
        } catch (error) {
            console.error('Error loading courses:', error);
            window.Utils.setElementHTML('coursesTableBody', 
                '<tr><td colspan="5" class="error">Ошибка загрузки данных</td></tr>');
        }
    },

    // Отображение таблицы курсов
    render() {
        const tbody = document.getElementById('coursesTableBody');
        if (!tbody) return;
        
        if (window.App.courses.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="loading">Курсы не найдены</td></tr>';
            return;
        }
        
        tbody.innerHTML = window.App.courses.map(course => `
            <tr>
                <td>${course.title}</td>
                <td>${course.description || '-'}</td>
                <td>${course.lessons ? course.lessons.length : 0}</td>
                <td>${course.students ? course.students.length : 0}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-icon btn-edit" onclick="window.CoursesPage.edit('${course.id}')" title="Редактировать">✏️</button>
                        <button class="btn btn-icon btn-delete" onclick="window.CoursesPage.delete('${course.id}')" title="Удалить">✕</button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    // Показать модальное окно добавления курса
    async showAddModal() {
        await window.Modals.showAddCourse();
    },

    // Добавление курса
    async add(event) {
        event.preventDefault();
        
        const formData = {
            title: window.Utils.getElementValue('courseTitle'),
            description: window.Utils.getElementValue('courseDescription')
        };
        
        try {
            await window.API.courses.create(formData);
            
            window.Modals.close('addCourseModal');
            document.getElementById('addCourseForm').reset();
            this.load();
            
            // Обновляем страницу прогресса, если она активна
            if (window.App.currentPage === 'progress' && window.ProgressPage) {
                window.ProgressPage.load();
            }
            
            window.Utils.showMessage('Курс успешно добавлен', 'success');
        } catch (error) {
            console.error('Error adding course:', error);
            window.Utils.showMessage('Ошибка при добавлении курса', 'error');
        }
    },

    // Редактирование курса
    async edit(courseId) {
        const course = window.App.courses.find(c => c.id === courseId);
        if (!course) return;
        
        await window.Modals.showEditCourse(course);
    },

    // Обновление курса
    async update(event) {
        event.preventDefault();
        
        const courseId = window.Utils.getElementValue('editCourseId');
        const formData = {
            title: window.Utils.getElementValue('editCourseTitle'),
            description: window.Utils.getElementValue('editCourseDescription')
        };
        
        try {
            await window.API.courses.update(courseId, formData);
            
            window.Modals.close('editCourseModal');
            this.load();
            
            // Обновляем страницу прогресса, если она активна
            if (window.App.currentPage === 'progress' && window.ProgressPage) {
                window.ProgressPage.load();
            }
            
            window.Utils.showMessage('Курс успешно обновлен', 'success');
        } catch (error) {
            console.error('Error updating course:', error);
            window.Utils.showMessage('Ошибка при обновлении курса', 'error');
        }
    },

    // Удаление курса
    async delete(courseId) {
        if (!confirm('Удалить курс? Это действие нельзя отменить.')) return;
        
        try {
            await window.API.courses.delete(courseId);
            
            this.load();
            
            // Обновляем страницу прогресса, если она активна
            if (window.App.currentPage === 'progress' && window.ProgressPage) {
                window.ProgressPage.load();
            }
            
            window.Utils.showMessage('Курс удален', 'success');
        } catch (error) {
            console.error('Error deleting course:', error);
            window.Utils.showMessage('Ошибка при удалении курса', 'error');
        }
    },

    // Инициализация обработчиков событий
    init() {
        // Обработчики форм
        const addForm = document.getElementById('addCourseForm');
        const editForm = document.getElementById('editCourseForm');
        
        if (addForm) {
            addForm.addEventListener('submit', (e) => this.add(e));
        }
        
        if (editForm) {
            editForm.addEventListener('submit', (e) => this.update(e));
        }
    }
};

// Глобальные функции для обратной совместимости
window.loadCourses = () => window.CoursesPage.load();
window.showAddCourseModal = () => window.CoursesPage.showAddModal();
window.addCourse = (e) => window.CoursesPage.add(e);
window.editCourse = (id) => window.CoursesPage.edit(id);
window.updateCourse = (e) => window.CoursesPage.update(e);
window.deleteCourse = (id) => window.CoursesPage.delete(id);