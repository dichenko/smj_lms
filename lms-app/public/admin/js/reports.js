// Модуль страницы отчетов

window.ReportsPage = {
    // Загрузка отчетов
    async load() {
        try {
            const data = await window.API.reports.getAll();
            window.App.reports = data.reports || [];
            this.render();
            this.updateCityFilter();
        } catch (error) {
            console.error('Error loading reports:', error);
            window.Utils.setElementHTML('reportsTableBody', 
                '<tr><td colspan="7" class="error">Ошибка загрузки данных</td></tr>');
        }
    },

    // Отображение таблицы отчетов
    render() {
        const tbody = document.getElementById('reportsTableBody');
        if (!tbody) return;

        const statusFilter = window.Utils.getElementValue('statusFilter');
        const cityFilter = window.Utils.getElementValue('reportCityFilter');
        
        // Фильтрация
        let filteredReports = window.Utils.safeFilter(window.App.reports, report => {
            let matches = true;
            
            if (statusFilter && report.status !== statusFilter) {
                matches = false;
            }
            
            if (cityFilter && report.student.city !== cityFilter) {
                matches = false;
            }
            
            return matches;
        });
        
        if (filteredReports.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="loading">Отчеты не найдены</td></tr>';
            return;
        }
        
        tbody.innerHTML = filteredReports.map(report => `
            <tr>
                <td>${report.student.name}</td>
                <td>${report.student.city}</td>
                <td>${report.course.title}</td>
                <td>${report.lesson.title}</td>
                <td><span class="status ${report.status}">${window.Utils.getReportStatusText(report.status)}</span></td>
                <td>${window.Utils.formatDate(report.submitted_at)}</td>
                <td>
                    <div class="action-buttons">
                        ${report.status === 'pending' ? `
                            <button class="btn btn-sm btn-success" onclick="window.ReportsPage.approve('${report.id}')">Одобрить</button>
                            <button class="btn btn-sm btn-danger" onclick="window.ReportsPage.reject('${report.id}')">Отклонить</button>
                        ` : ''}
                        <button class="btn btn-sm" onclick="window.ReportsPage.view('${report.id}')">Просмотр</button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    // Обновление фильтра городов
    updateCityFilter() {
        const cities = window.Utils.getUniqueValues(window.App.reports, r => r.student.city).sort();
        const select = document.getElementById('reportCityFilter');
        
        if (select) {
            select.innerHTML = '<option value="">Все города</option>' +
                cities.map(city => `<option value="${city}">${city}</option>`).join('');
        }
    },

    // Фильтрация отчетов
    filter() {
        this.render();
    },

    // Одобрение отчета
    async approve(reportId) {
        try {
            await window.API.reports.approve(reportId);
            
            this.load();
            window.Utils.showMessage('Отчет одобрен', 'success');
        } catch (error) {
            console.error('Error approving report:', error);
            window.Utils.showMessage('Ошибка при одобрении отчета', 'error');
        }
    },

    // Отклонение отчета
    async reject(reportId) {
        if (!confirm('Отклонить отчет?')) return;
        
        try {
            await window.API.reports.reject(reportId);
            
            this.load();
            window.Utils.showMessage('Отчет отклонен', 'success');
        } catch (error) {
            console.error('Error rejecting report:', error);
            window.Utils.showMessage('Ошибка при отклонении отчета', 'error');
        }
    },

    // Просмотр отчета
    async view(reportId) {
        try {
            const report = await window.API.reports.view(reportId);
            await window.Modals.showReportDetails(report);
        } catch (error) {
            console.error('Error viewing report:', error);
            window.Utils.showMessage('Ошибка при загрузке отчета', 'error');
        }
    },

    // Инициализация обработчиков событий
    init() {
        // Обработчики фильтров
        const statusFilter = document.getElementById('statusFilter');
        const cityFilter = document.getElementById('reportCityFilter');
        
        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.filter());
        }
        
        if (cityFilter) {
            cityFilter.addEventListener('change', () => this.filter());
        }
    }
};

// Глобальные функции для обратной совместимости
window.loadReports = () => window.ReportsPage.load();
window.filterReports = () => window.ReportsPage.filter();
window.approveReport = (id) => window.ReportsPage.approve(id);
window.rejectReport = (id) => window.ReportsPage.reject(id);
window.viewReport = (id) => window.ReportsPage.view(id);