// Модуль навигации и переключения страниц

window.Navigation = {
    // Переключение страниц
    showPage(page) {
        // Скрываем все страницы
        document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        
        // Показываем выбранную страницу
        const pageElement = document.getElementById(page + '-page');
        if (pageElement) {
            pageElement.style.display = 'block';
        }
        
        // Находим и активируем соответствующий элемент навигации
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            if (item.textContent.includes(this.getPageTitle(page))) {
                item.classList.add('active');
            }
        });
        
        window.App.currentPage = page;
        
        // Загружаем данные для страницы
        this.loadPageData(page);
    },

    // Получение заголовка страницы
    getPageTitle(page) {
        const titles = {
            'progress': 'Прогресс студентов',
            'students': 'Управление студентами', 
            'courses': 'Курсы',
            'lessons': 'Управление уроками',
            'reports': 'Отчеты',
            'logs': 'Логи'
        };
        
        return titles[page] || page;
    },

    // Загрузка данных для страницы
    async loadPageData(page) {
        try {
            switch(page) {
                case 'progress':
                    if (window.ProgressPage) {
                        await window.ProgressPage.load();
                    }
                    break;
                case 'students':
                    if (window.StudentsPage) {
                        await window.StudentsPage.load();
                    }
                    break;
                case 'courses':
                    if (window.CoursesPage) {
                        await window.CoursesPage.load();
                    }
                    break;
                case 'lessons':
                    if (window.LessonsPage) {
                        await window.LessonsPage.load();
                    }
                    break;
                case 'reports':
                    if (window.ReportsPage) {
                        await window.ReportsPage.load();
                    }
                    break;
                case 'logs':
                    if (window.LogsPage) {
                        await window.LogsPage.load();
                    }
                    break;
                default:
                    console.warn(`Unknown page: ${page}`);
            }
        } catch (error) {
            console.error(`Error loading page ${page}:`, error);
            window.Utils.showMessage(`Ошибка загрузки страницы: ${error.message}`, 'error');
        }
    },

    // Инициализация навигации
    init() {
        // Добавляем обработчики событий для элементов навигации
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const pageMap = {
                    'Прогресс студентов': 'progress',
                    'Управление студентами': 'students',
                    'Курсы': 'courses',
                    'Управление уроками': 'lessons',
                    'Отчеты': 'reports',
                    'Логи': 'logs'
                };
                
                const pageKey = Object.keys(pageMap).find(key => 
                    item.textContent.includes(key)
                );
                
                if (pageKey) {
                    this.showPage(pageMap[pageKey]);
                }
            });
        });

        // Загружаем страницу по умолчанию
        this.showPage('progress');
    }
};