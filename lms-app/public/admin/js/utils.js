// Утилиты и вспомогательные функции

window.Utils = {
    // Показать сообщение пользователю
    showMessage(text, type = 'info') {
        const message = document.createElement('div');
        message.className = type;
        message.textContent = text;
        
        const main = document.querySelector('.main');
        main.insertBefore(message, main.firstChild);
        
        // Автоматически убираем сообщение через 5 секунд
        setTimeout(() => message.remove(), 5000);
    },

    // Получение текста статуса урока
    getLessonStatusText(status) {
        return window.STATUS_TEXT[status] || status;
    },

    // Получение текста статуса отчета
    getReportStatusText(status) {
        return window.REPORT_STATUS_TEXT[status] || status;
    },

    // Расчет процента прохождения курса
    calculateCourseProgress(course) {
        if (!course.lessons || course.lessons.length === 0) return 0;
        
        const approvedLessons = course.lessons.filter(lesson => 
            lesson.status === window.LESSON_STATUS.APPROVED
        ).length;
        return Math.round((approvedLessons / course.lessons.length) * 100);
    },

    // Расчет общего процента прохождения всех курсов студента
    calculateOverallProgress(student) {
        if (!student.courses || student.courses.length === 0) return 0;
        
        let totalLessons = 0;
        let totalApprovedLessons = 0;
        
        student.courses.forEach(course => {
            if (course.lessons) {
                totalLessons += course.lessons.length;
                totalApprovedLessons += course.lessons.filter(lesson => 
                    lesson.status === window.LESSON_STATUS.APPROVED
                ).length;
            }
        });
        
        return totalLessons > 0 ? Math.round((totalApprovedLessons / totalLessons) * 100) : 0;
    },

    // Безопасное получение элемента по ID
    getElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.error(`Element with id "${id}" not found`);
        }
        return element;
    },

    // Безопасное получение значения из элемента
    getElementValue(id, defaultValue = '') {
        const element = this.getElement(id);
        return element ? element.value : defaultValue;
    },

    // Безопасная установка значения в элемент
    setElementValue(id, value) {
        const element = this.getElement(id);
        if (element) {
            element.value = value;
        }
    },

    // Безопасная установка HTML содержимого
    setElementHTML(id, html) {
        const element = this.getElement(id);
        if (element) {
            element.innerHTML = html;
        }
    },

    // Форматирование даты
    formatDate(dateString) {
        if (!dateString) return 'Неизвестно';
        try {
            return new Date(dateString).toLocaleDateString();
        } catch (error) {
            return 'Неизвестно';
        }
    },

    // Форматирование даты и времени
    formatDateTime(dateString) {
        if (!dateString) return 'Неизвестно';
        try {
            return new Date(dateString).toLocaleString();
        } catch (error) {
            return 'Неизвестно';
        }
    },

    // Дебаунс функция для поиска
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Проверка является ли значение массивом
    isArray(value) {
        return Array.isArray(value);
    },

    // Безопасная фильтрация массива
    safeFilter(array, predicate) {
        if (!this.isArray(array)) return [];
        return array.filter(predicate);
    },

    // Безопасная сортировка массива
    safeSort(array, compareFn) {
        if (!this.isArray(array)) return [];
        return [...array].sort(compareFn);
    },

    // Получение уникальных значений из массива
    getUniqueValues(array, keyOrFn) {
        if (!this.isArray(array)) return [];
        
        if (typeof keyOrFn === 'function') {
            return [...new Set(array.map(keyOrFn))];
        }
        
        if (typeof keyOrFn === 'string') {
            return [...new Set(array.map(item => item[keyOrFn]))];
        }
        
        return [...new Set(array)];
    }
};