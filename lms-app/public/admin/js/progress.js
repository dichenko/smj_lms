// Модуль страницы прогресса студентов

window.ProgressPage = {
    // Загрузка данных прогресса
    async load() {
        try {
            const data = await window.API.students.getProgress();
            window.App.progressData = data.progress || [];
            this.render();
            this.updateCityFilter();
        } catch (error) {
            console.error('Error loading progress:', error);
            window.Utils.setElementHTML('progressTableBody', 
                '<tr><td colspan="3" class="error">Ошибка загрузки данных</td></tr>');
        }
    },

    // Отображение прогресса студентов в минималистичной таблице
    render() {
        const tbody = document.getElementById('progressTableBody');
        
        if (!tbody) {
            console.error('Progress table body not found');
            return;
        }

        if (!window.Utils.isArray(window.App.progressData)) {
            console.error('Progress data is not an array');
            tbody.innerHTML = '<tr><td colspan="3" class="error">Ошибка загрузки данных</td></tr>';
            return;
        }
        
        // Получение фильтров
        const cityFilter = window.Utils.getElementValue('progressCityFilter');
        const searchFilter = window.Utils.getElementValue('progressSearchFilter').toLowerCase();
        
        // Фильтрация данных
        let filteredData = window.App.progressData;
        
        if (cityFilter) {
            filteredData = window.Utils.safeFilter(filteredData, 
                student => student && student.city === cityFilter);
        }
        
        if (searchFilter) {
            filteredData = window.Utils.safeFilter(filteredData,
                student => student && student.name && 
                student.name.toLowerCase().includes(searchFilter));
        }
        
        // Сортировка по городу и имени
        filteredData = window.Utils.safeSort(filteredData, (a, b) => {
            const cityA = (a.city || '').toLowerCase();
            const cityB = (b.city || '').toLowerCase();
            
            if (cityA < cityB) return -1;
            if (cityA > cityB) return 1;
            
            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
        
        if (filteredData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="loading">Студенты не найдены</td></tr>';
            return;
        }
        
        // Генерация HTML
        try {
            const rows = filteredData.map(student => {
                if (!student || !student.name) {
                    return '';
                }

                const overallProgress = window.Utils.calculateOverallProgress(student);
                const overallProgressClass = overallProgress === 0 ? 'zero' : '';
                
                const coursesHtml = this.renderCourses(student.courses);
                
                return `
                    <tr>
                        <td class="student-col">
                            <div class="student-info-compact">
                                <div class="student-name-compact">${student.name}</div>
                                <div class="student-city-compact">${student.city || 'Не указан'}</div>
                            </div>
                        </td>
                        <td class="progress-col">
                            <div class="overall-progress-compact ${overallProgressClass}">${overallProgress}%</div>
                        </td>
                        <td class="courses-col">
                            <div class="courses-compact">
                                ${coursesHtml}
                            </div>
                        </td>
                    </tr>
                `;
            }).filter(html => html.trim() !== '').join('');
            
            tbody.innerHTML = rows || '<tr><td colspan="3" class="loading">Нет данных для отображения</td></tr>';
            
        } catch (error) {
            console.error('Error rendering progress table:', error);
            tbody.innerHTML = '<tr><td colspan="3" class="error">Ошибка отображения данных</td></tr>';
        }
    },

    // Отображение курсов студента
    renderCourses(courses) {
        if (!window.Utils.isArray(courses) || courses.length === 0) {
            return '<div class="no-courses">Нет курсов</div>';
        }

        return courses.map(course => {
            if (!course || !course.title) {
                return '';
            }

            const courseProgress = window.Utils.calculateCourseProgress(course);
            const courseProgressClass = courseProgress === 0 ? 'zero' : '';
            
            const lessonsHtml = this.renderLessons(course.lessons, course.title);
            
            return `
                <div class="course-row-compact">
                    <div class="course-title-compact">${course.title}</div>
                    <div class="course-progress-compact ${courseProgressClass}">${courseProgress}%</div>
                    <div class="lessons-compact">
                        ${lessonsHtml}
                    </div>
                </div>
            `;
        }).join('');
    },

    // Отображение уроков курса
    renderLessons(lessons, courseTitle) {
        if (!window.Utils.isArray(lessons) || lessons.length === 0) {
            return '<span class="no-lessons">Нет уроков</span>';
        }

        return lessons.map(lesson => {
            if (!lesson) {
                return '';
            }
            
            const lessonTitle = lesson.title || 'Урок';
            const lessonStatus = lesson.status || 'not_started';
            const lessonOrder = lesson.order || '?';
            const lessonId = lesson.id || '';
            const lessonDescription = lesson.description || '';
            
            return `
                <div class="lesson-compact ${lessonStatus}" 
                     title="${lessonTitle} - ${window.Utils.getLessonStatusText(lessonStatus)}"
                     onclick="window.Modals.showLessonInfo('${lessonId}', '${lessonTitle}', '${courseTitle}', '${lessonOrder}', '${lessonStatus}', '${lessonDescription}')">
                    ${lessonOrder}
                </div>
            `;
        }).join('');
    },

    // Обновление фильтра городов
    updateCityFilter() {
        const cities = window.Utils.getUniqueValues(window.App.progressData, 'city').sort();
        const select = document.getElementById('progressCityFilter');
        
        if (select) {
            select.innerHTML = '<option value="">Все города</option>' +
                cities.map(city => `<option value="${city}">${city}</option>`).join('');
        }
    },

    // Фильтрация прогресса
    filter() {
        this.render();
        this.updateClearButton();
    },

    // Обновление видимости кнопки очистки поиска
    updateClearButton() {
        const searchInput = document.getElementById('progressSearchFilter');
        const clearBtn = document.querySelector('.clear-search-btn');
        
        if (searchInput && clearBtn) {
            if (searchInput.value.trim() !== '') {
                clearBtn.style.display = 'flex';
            } else {
                clearBtn.style.display = 'none';
            }
        }
    },

    // Очистка поиска
    clearSearch() {
        window.Utils.setElementValue('progressSearchFilter', '');
        this.filter();
    },

    // Инициализация обработчиков событий
    init() {
        // Обработчики фильтров
        const cityFilter = document.getElementById('progressCityFilter');
        const searchFilter = document.getElementById('progressSearchFilter');
        
        if (cityFilter) {
            cityFilter.addEventListener('change', () => this.filter());
        }
        
        if (searchFilter) {
            searchFilter.addEventListener('keyup', () => this.filter());
        }

        // Инициализируем кнопку очистки
        this.updateClearButton();
    }
};

// Глобальные функции для обратной совместимости
window.loadProgress = () => window.ProgressPage.load();
window.filterProgress = () => window.ProgressPage.filter();
window.clearProgressSearch = () => window.ProgressPage.clearSearch();