// Модуль страницы управления студентами

window.StudentsPage = {
    // Загрузка студентов
    async load() {
        try {
            const data = await window.API.students.getAll();
            window.App.students = data.students || [];
            this.render();
            this.updateCityFilter();
        } catch (error) {
            console.error('Error loading students:', error);
            window.Utils.setElementHTML('studentsTableBody', 
                '<tr><td colspan="5" class="error">Ошибка загрузки данных</td></tr>');
        }
    },

    // Отображение таблицы студентов
    render() {
        const tbody = document.getElementById('studentsTableBody');
        if (!tbody) return;

        const cityFilter = window.Utils.getElementValue('cityFilter');
        const searchFilter = window.Utils.getElementValue('searchFilter').toLowerCase();
        
        // Фильтрация
        let filteredStudents = window.Utils.safeFilter(window.App.students, student => {
            let matches = true;
            
            if (cityFilter && student.city !== cityFilter) {
                matches = false;
            }
            
            if (searchFilter && !student.name.toLowerCase().includes(searchFilter)) {
                matches = false;
            }
            
            return matches;
        });
        
        if (filteredStudents.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="loading">Студенты не найдены</td></tr>';
            return;
        }
        
        tbody.innerHTML = filteredStudents.map(student => `
            <tr>
                <td>${student.name}</td>
                <td>${student.city}</td>
                <td>${student.tgid}</td>
                <td>
                    <div class="courses-list">
                        ${(student.courses || []).map(course => 
                            `<span class="course-badge">${course.title}</span>`
                        ).join('')}
                    </div>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-icon btn-edit" onclick="window.StudentsPage.edit('${student.id}')" title="Редактировать">✏️</button>
                        <button class="btn btn-icon btn-delete" onclick="window.StudentsPage.delete('${student.id}')" title="Удалить">✕</button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    // Обновление фильтра городов
    updateCityFilter() {
        const cities = window.Utils.getUniqueValues(window.App.students, 'city').sort();
        const select = document.getElementById('cityFilter');
        
        if (select) {
            select.innerHTML = '<option value="">Все города</option>' +
                cities.map(city => `<option value="${city}">${city}</option>`).join('');
        }
    },

    // Фильтрация студентов
    filter() {
        this.render();
    },

    // Показать модальное окно добавления студента
    async showAddModal() {
        await window.Modals.showAddStudent();
    },

    // Добавление студента
    async add(event) {
        event.preventDefault();
        
        const formData = {
            tgid: window.Utils.getElementValue('studentTgid'),
            name: window.Utils.getElementValue('studentName'),
            city: window.Utils.getElementValue('studentCity'),
            courseIds: Array.from(document.querySelectorAll('#courseCheckboxes input:checked'))
                .map(cb => cb.value)
        };
        
        try {
            await window.API.students.create(formData);
            
            window.Modals.close('addStudentModal');
            document.getElementById('addStudentForm').reset();
            this.load();
            
            // Обновляем страницу прогресса, если она активна
            if (window.App.currentPage === 'progress' && window.ProgressPage) {
                window.ProgressPage.load();
            }
            
            window.Utils.showMessage('Студент успешно добавлен', 'success');
        } catch (error) {
            console.error('Error adding student:', error);
            window.Utils.showMessage('Ошибка при добавлении студента', 'error');
        }
    },

    // Редактирование студента
    async edit(studentId) {
        const student = window.App.students.find(s => s.id === studentId);
        if (!student) return;
        
        await window.Modals.showEditStudent(student);
    },

    // Обновление студента
    async update(event) {
        event.preventDefault();
        
        const studentId = window.Utils.getElementValue('editStudentId');
        const tgid = window.Utils.getElementValue('editStudentTgid');
        const name = window.Utils.getElementValue('editStudentName');
        const city = window.Utils.getElementValue('editStudentCity');
        
        // Получаем выбранные курсы из кнопок
        const selectedCourses = Array.from(document.querySelectorAll('#editCourseCheckboxes .course-toggle-btn.enrolled'))
            .map(btn => btn.dataset.courseId);
        
        try {
            await window.API.students.update(studentId, {
                tgid,
                name,
                city,
                course_ids: selectedCourses
            });
            
            window.Modals.close('editStudentModal');
            this.load();
            
            // Обновляем страницу прогресса, если она активна
            if (window.App.currentPage === 'progress' && window.ProgressPage) {
                window.ProgressPage.load();
            }
            
            window.Utils.showMessage('Студент успешно обновлен', 'success');
        } catch (error) {
            console.error('Error updating student:', error);
            window.Utils.showMessage('Ошибка при обновлении студента', 'error');
        }
    },

    // Управление курсами студента
    async manageCourses(studentId) {
        const student = window.App.students.find(s => s.id === studentId);
        if (!student) return;
        
        await window.Modals.showManageCourses(student);
    },

    // Зачисление студента на курс
    async enrollCourse(studentId) {
        const courseId = window.Utils.getElementValue('enrollCourseSelect');
        if (!courseId) return;
        
        try {
            await window.API.students.enrollCourse(studentId, courseId);
            
            this.load();
            this.manageCourses(studentId); // Обновляем модальное окно
            
            // Обновляем страницу прогресса, если она активна
            if (window.App.currentPage === 'progress' && window.ProgressPage) {
                window.ProgressPage.load();
            }
            
            window.Utils.showMessage('Студент зачислен на курс', 'success');
        } catch (error) {
            console.error('Error enrolling student:', error);
            window.Utils.showMessage('Ошибка при зачислении студента', 'error');
        }
    },

    // Отчисление студента с курса
    async unenrollCourse(studentId, courseId) {
        if (!confirm('Отчислить студента с курса?')) return;
        
        try {
            await window.API.students.unenrollCourse(studentId, courseId);
            
            this.load();
            this.manageCourses(studentId); // Обновляем модальное окно
            
            // Обновляем страницу прогресса, если она активна
            if (window.App.currentPage === 'progress' && window.ProgressPage) {
                window.ProgressPage.load();
            }
            
            window.Utils.showMessage('Студент отчислен с курса', 'success');
        } catch (error) {
            console.error('Error unenrolling student:', error);
            window.Utils.showMessage('Ошибка при отчислении студента', 'error');
        }
    },

    // Удаление студента
    async delete(studentId) {
        if (!confirm('Удалить студента?')) return;
        
        try {
            await window.API.students.delete(studentId);
            
            this.load();
            
            // Обновляем страницу прогресса, если она активна
            if (window.App.currentPage === 'progress' && window.ProgressPage) {
                window.ProgressPage.load();
            }
            
            window.Utils.showMessage('Студент удален', 'success');
        } catch (error) {
            console.error('Error deleting student:', error);
            window.Utils.showMessage('Ошибка при удалении студента', 'error');
        }
    },

    // Переключение курса студента (для модального окна редактирования)
    toggleCourse(button, courseId) {
        const isEnrolled = button.classList.contains('enrolled');
        
        if (isEnrolled) {
            // Отчисляем из курса
            button.classList.remove('enrolled');
            button.classList.add('not-enrolled');
        } else {
            // Зачисляем в курс
            button.classList.remove('not-enrolled');
            button.classList.add('enrolled');
        }
    },

    // Инициализация обработчиков событий
    init() {
        // Обработчики фильтров
        const cityFilter = document.getElementById('cityFilter');
        const searchFilter = document.getElementById('searchFilter');
        
        if (cityFilter) {
            cityFilter.addEventListener('change', () => this.filter());
        }
        
        if (searchFilter) {
            searchFilter.addEventListener('keyup', () => this.filter());
        }

        // Обработчики форм
        const addForm = document.getElementById('addStudentForm');
        const editForm = document.getElementById('editStudentForm');
        
        if (addForm) {
            addForm.addEventListener('submit', (e) => this.add(e));
        }
        
        if (editForm) {
            editForm.addEventListener('submit', (e) => this.update(e));
        }
    }
};

// Глобальные функции для обратной совместимости
window.loadStudents = () => window.StudentsPage.load();
window.filterStudents = () => window.StudentsPage.filter();
window.showAddStudentModal = () => window.StudentsPage.showAddModal();
window.addStudent = (e) => window.StudentsPage.add(e);
window.editStudent = (id) => window.StudentsPage.edit(id);
window.updateStudent = (e) => window.StudentsPage.update(e);
window.deleteStudent = (id) => window.StudentsPage.delete(id);
window.manageStudentCourses = (id) => window.StudentsPage.manageCourses(id);
window.enrollStudent = (id) => window.StudentsPage.enrollCourse(id);
window.unenrollStudent = (studentId, courseId) => window.StudentsPage.unenrollCourse(studentId, courseId);
window.toggleStudentCourse = (button, courseId) => window.StudentsPage.toggleCourse(button, courseId);