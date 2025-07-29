import { DatabaseService } from '../utils/database';

export interface AdminSession {
  id: string;
  admin_id: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export class AuthService {
  private db: DatabaseService;
  private sessionDuration = 24 * 60 * 60 * 1000; // 24 часа в миллисекундах

  constructor(db: DatabaseService) {
    this.db = db;
  }

  // Аутентификация администратора
  async authenticateAdmin(credentials: LoginCredentials): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    try {
      // Получаем админа по username
      const admin = await this.db.getAdminByUsername(credentials.username);
      
      if (!admin) {
        return { success: false, error: 'Неверное имя пользователя или пароль' };
      }

      // Проверяем пароль (в реальном приложении используйте bcrypt)
      if (admin.password_hash !== credentials.password) {
        return { success: false, error: 'Неверное имя пользователя или пароль' };
      }

      // Создаем сессию
      const sessionId = await this.createSession(admin.id);
      
      return { success: true, sessionId };
    } catch (error: any) {
      console.error('Authentication error:', error);
      return { success: false, error: 'Ошибка аутентификации' };
    }
  }

  // Создание новой сессии
  private async createSession(adminId: string): Promise<string> {
    const sessionId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionDuration);

    await this.db.createAdminSession({
      id: sessionId,
      admin_id: adminId,
      expires_at: expiresAt.toISOString()
    });

    return sessionId;
  }

  // Проверка валидности сессии
  async validateSession(sessionId: string): Promise<{ valid: boolean; adminId?: string; error?: string }> {
    try {
      const session = await this.db.getAdminSessionById(sessionId);
      
      if (!session) {
        return { valid: false, error: 'Сессия не найдена' };
      }

      if (!session.is_active) {
        return { valid: false, error: 'Сессия неактивна' };
      }

      const now = new Date();
      const expiresAt = new Date(session.expires_at);
      
      if (now > expiresAt) {
        // Деактивируем просроченную сессию
        await this.db.deactivateAdminSession(sessionId);
        return { valid: false, error: 'Сессия истекла' };
      }

      return { valid: true, adminId: session.admin_id };
    } catch (error: any) {
      console.error('Session validation error:', error);
      return { valid: false, error: 'Ошибка проверки сессии' };
    }
  }

  // Выход из системы
  async logout(sessionId: string): Promise<boolean> {
    try {
      await this.db.deactivateAdminSession(sessionId);
      return true;
    } catch (error: any) {
      console.error('Logout error:', error);
      return false;
    }
  }

  // Очистка просроченных сессий
  async cleanupExpiredSessions(): Promise<void> {
    try {
      await this.db.cleanupExpiredSessions();
    } catch (error: any) {
      console.error('Session cleanup error:', error);
    }
  }
} 