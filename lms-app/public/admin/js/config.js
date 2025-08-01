// Конфигурация и константы приложения

// Глобальные переменные состояния
window.App = {
    currentPage: 'progress',
    students: [],
    courses: [],
    lessons: [],
    reports: [],
    logs: [],
    progressData: []
};

// Конфигурация API endpoints
window.Config = {
    API_BASE: '/api',
    ENDPOINTS: {
        AUTH: {
            CHECK: '/api/auth/check',
            LOGOUT: '/api/auth/logout'
        },
        STUDENTS: {
            LIST: '/api/students',
            PROGRESS: '/api/students/progress',
            CREATE: '/api/students',
            UPDATE: (id) => `/api/students/${id}`,
            DELETE: (id) => `/api/students/${id}`,
            COURSES: (id) => `/api/students/${id}/courses`,
            UNENROLL: (studentId, courseId) => `/api/students/${studentId}/courses/${courseId}`
        },
        COURSES: {
            LIST: '/api/courses',
            CREATE: '/api/courses',
            UPDATE: (id) => `/api/courses/${id}`,
            DELETE: (id) => `/api/courses/${id}`,
            LESSONS: (id) => `/api/courses/${id}/lessons`
        },
        LESSONS: {
            LIST: '/api/lessons',
            CREATE: (courseId) => `/api/courses/${courseId}/lessons`,
            UPDATE: (id) => `/api/lessons/${id}`,
            DELETE: (id) => `/api/lessons/${id}`
        },
        REPORTS: {
            LIST: '/api/reports',
            APPROVE: (id) => `/api/reports/${id}/approve`,
            REJECT: (id) => `/api/reports/${id}/reject`,
            VIEW: (id) => `/api/reports/${id}`
        },
        LOGS: {
            LIST: '/api/logs'
        }
    },
    
    // Настройки fetch
    FETCH_CONFIG: {
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    }
};

// Константы для статусов уроков
window.LESSON_STATUS = {
    APPROVED: 'approved',
    PENDING: 'pending',
    REJECTED: 'rejected',
    NOT_STARTED: 'not_started'
};

// Текстовые константы для статусов
window.STATUS_TEXT = {
    [window.LESSON_STATUS.APPROVED]: 'Пройден',
    [window.LESSON_STATUS.PENDING]: 'На проверке',
    [window.LESSON_STATUS.REJECTED]: 'Отклонен',
    [window.LESSON_STATUS.NOT_STARTED]: 'Не начат'
};

// Текстовые константы для отчетов
window.REPORT_STATUS_TEXT = {
    'pending': 'На проверке',
    'approved': 'Одобрено',
    'rejected': 'Отклонено'
};