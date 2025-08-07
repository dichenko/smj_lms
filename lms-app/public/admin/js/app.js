// Основное приложение - инициализация и координация модулей

window.App = window.App || {
    currentPage: 'progress',
    students: [],
    courses: [],
    lessons: [],
    reports: [],
    logs: [],
    progressData: []
};

// Главный объект приложения
window.DashboardApp = {
    // Инициализация приложения
    async init() {
        console.log('Initializing Dashboard App...');
        
        try {
            // Проверяем авторизацию
            const isAuthorized = await window.Auth.checkAuth();
            if (!isAuthorized) {
                return; // Auth.js перенаправит пользователя
            }

            // Инициализируем модули
            this.initModules();
            
            // Инициализируем навигацию
            window.Navigation.init();
            
            // Добавляем обработчик для кнопки выхода
            this.initLogoutButton();
            
            console.log('Dashboard App initialized successfully');
            
        } catch (error) {
            console.error('Error initializing app:', error);
            window.Utils.showMessage('Ошибка инициализации приложения', 'error');
        }
    },

    // Инициализация модулей
    initModules() {
        // Инициализируем модальные окна
        if (window.Modals) {
            window.Modals.init();
        }

        // Инициализируем страницы
        if (window.ProgressPage) {
            window.ProgressPage.init();
        }
        
        if (window.StudentsPage) {
            window.StudentsPage.init();
        }
        
        if (window.CoursesPage) {
            window.CoursesPage.init();
        }
        
        if (window.LessonsPage) {
            window.LessonsPage.init();
        }
        
        if (window.ReportsPage) {
            window.ReportsPage.init();
        }
        
        if (window.BroadcastsPage) {
            window.BroadcastsPage.init();
        }
        
        if (window.LogsPage) {
            window.LogsPage.init();
        }
    },

    // Инициализация кнопки выхода
    initLogoutButton() {
        const logoutBtn = document.querySelector('.logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.Auth.logout();
            });
        }
    }
};

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing app...');
    window.DashboardApp.init();
});

// Глобальные функции для обратной совместимости
window.checkAuth = () => window.Auth.checkAuth();
window.logout = () => window.Auth.logout();
window.showPage = (page) => window.Navigation.showPage(page);
window.showMessage = (text, type) => window.Utils.showMessage(text, type);