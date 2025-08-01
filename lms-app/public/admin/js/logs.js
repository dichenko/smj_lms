// Модуль страницы логов

window.LogsPage = {
    // Загрузка логов
    async load() {
        try {
            const data = await window.API.logs.getAll();
            window.App.logs = data.logs || [];
            this.render();
        } catch (error) {
            console.error('Error loading logs:', error);
            window.Utils.setElementHTML('logsTableBody', 
                '<tr><td colspan="3" class="error">Ошибка загрузки данных</td></tr>');
        }
    },

    // Отображение таблицы логов
    render() {
        const tbody = document.getElementById('logsTableBody');
        if (!tbody) return;
        
        if (window.App.logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="loading">Логи не найдены</td></tr>';
            return;
        }
        
        tbody.innerHTML = window.App.logs.map(log => `
            <tr>
                <td>${log.source}</td>
                <td>${log.message}</td>
                <td>${window.Utils.formatDateTime(log.created_at)}</td>
            </tr>
        `).join('');
    },

    // Инициализация обработчиков событий
    init() {
        // Для логов пока нет дополнительных обработчиков
    }
};

// Глобальные функции для обратной совместимости
window.loadLogs = () => window.LogsPage.load();