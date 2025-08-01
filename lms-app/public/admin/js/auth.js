// Модуль авторизации

window.Auth = {
    // Проверка авторизации
    async checkAuth() {
        try {
            const response = await fetch(window.Config.ENDPOINTS.AUTH.CHECK, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                window.location.href = '/';
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Auth check failed:', error);
            window.location.href = '/';
            return false;
        }
    },

    // Выход из системы
    async logout() {
        try {
            await fetch(window.Config.ENDPOINTS.AUTH.LOGOUT, {
                method: 'POST',
                credentials: 'include'
            });
            window.location.href = '/';
        } catch (error) {
            console.error('Logout failed:', error);
            // Принудительно перенаправляем даже при ошибке
            window.location.href = '/';
        }
    }
};