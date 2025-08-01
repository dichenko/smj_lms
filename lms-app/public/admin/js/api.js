// API модуль для работы с сервером

window.API = {
    // Базовая функция для выполнения запросов
    async request(url, options = {}) {
        const config = {
            ...window.Config.FETCH_CONFIG,
            ...options
        };
        
        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP Error: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    },

    // Студенты
    students: {
        async getAll() {
            return await window.API.request(window.Config.ENDPOINTS.STUDENTS.LIST);
        },

        async getProgress() {
            return await window.API.request(window.Config.ENDPOINTS.STUDENTS.PROGRESS);
        },

        async create(studentData) {
            return await window.API.request(window.Config.ENDPOINTS.STUDENTS.CREATE, {
                method: 'POST',
                body: JSON.stringify(studentData)
            });
        },

        async update(id, studentData) {
            return await window.API.request(window.Config.ENDPOINTS.STUDENTS.UPDATE(id), {
                method: 'PUT',
                body: JSON.stringify(studentData)
            });
        },

        async delete(id) {
            return await window.API.request(window.Config.ENDPOINTS.STUDENTS.DELETE(id), {
                method: 'DELETE'
            });
        },

        async enrollCourse(studentId, courseId) {
            return await window.API.request(window.Config.ENDPOINTS.STUDENTS.COURSES(studentId), {
                method: 'POST',
                body: JSON.stringify({ course_id: courseId })
            });
        },

        async unenrollCourse(studentId, courseId) {
            return await window.API.request(window.Config.ENDPOINTS.STUDENTS.UNENROLL(studentId, courseId), {
                method: 'DELETE'
            });
        }
    },

    // Курсы
    courses: {
        async getAll() {
            return await window.API.request(window.Config.ENDPOINTS.COURSES.LIST);
        },

        async create(courseData) {
            return await window.API.request(window.Config.ENDPOINTS.COURSES.CREATE, {
                method: 'POST',
                body: JSON.stringify(courseData)
            });
        },

        async update(id, courseData) {
            return await window.API.request(window.Config.ENDPOINTS.COURSES.UPDATE(id), {
                method: 'PUT',
                body: JSON.stringify(courseData)
            });
        },

        async delete(id) {
            return await window.API.request(window.Config.ENDPOINTS.COURSES.DELETE(id), {
                method: 'DELETE'
            });
        }
    },

    // Уроки
    lessons: {
        async getAll() {
            return await window.API.request(window.Config.ENDPOINTS.LESSONS.LIST);
        },

        async create(courseId, lessonData) {
            return await window.API.request(window.Config.ENDPOINTS.LESSONS.CREATE(courseId), {
                method: 'POST',
                body: JSON.stringify(lessonData)
            });
        },

        async update(id, lessonData) {
            return await window.API.request(window.Config.ENDPOINTS.LESSONS.UPDATE(id), {
                method: 'PUT',
                body: JSON.stringify(lessonData)
            });
        },

        async delete(id) {
            return await window.API.request(window.Config.ENDPOINTS.LESSONS.DELETE(id), {
                method: 'DELETE'
            });
        }
    },

    // Отчеты
    reports: {
        async getAll() {
            return await window.API.request(window.Config.ENDPOINTS.REPORTS.LIST);
        },

        async approve(id) {
            return await window.API.request(window.Config.ENDPOINTS.REPORTS.APPROVE(id), {
                method: 'POST'
            });
        },

        async reject(id) {
            return await window.API.request(window.Config.ENDPOINTS.REPORTS.REJECT(id), {
                method: 'POST'
            });
        },

        async view(id) {
            return await window.API.request(window.Config.ENDPOINTS.REPORTS.VIEW(id));
        }
    },

    // Логи
    logs: {
        async getAll() {
            return await window.API.request(window.Config.ENDPOINTS.LOGS.LIST);
        }
    }
};