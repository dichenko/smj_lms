import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  FileText, 
  LogOut,
  Menu
} from 'lucide-react'

function Layout({ children, onLogout }) {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)

  const navigation = [
    {
      name: 'Дашборд',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      name: 'Студенты',
      href: '/students',
      icon: Users,
    },
    {
      name: 'Курсы',
      href: '/courses',
      icon: BookOpen,
    },
    {
      name: 'Отчеты',
      href: '/reports',
      icon: FileText,
    },
  ]

  const isActive = (href) => location.pathname === href

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Боковая панель */}
      <div style={{
        width: sidebarOpen ? '256px' : '64px',
        backgroundColor: '#1f2937',
        transition: 'width 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Заголовок */}
        <div style={{
          padding: '1rem',
          borderBottom: '1px solid #374151',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: 'none',
              border: 'none',
              color: '#9ca3af',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <Menu size={20} />
          </button>
          {sidebarOpen && (
            <h1 style={{ color: 'white', fontSize: '18px', fontWeight: 'bold' }}>
              LMS Admin
            </h1>
          )}
        </div>

        {/* Навигация */}
        <nav style={{ flex: 1, padding: '1rem 0' }}>
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                to={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  color: isActive(item.href) ? '#3b82f6' : '#9ca3af',
                  backgroundColor: isActive(item.href) ? '#1e40af20' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!isActive(item.href)) {
                    e.target.style.backgroundColor = '#374151'
                    e.target.style.color = 'white'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive(item.href)) {
                    e.target.style.backgroundColor = 'transparent'
                    e.target.style.color = '#9ca3af'
                  }
                }}
              >
                <Icon size={20} />
                {sidebarOpen && <span>{item.name}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Кнопка выхода */}
        <div style={{ padding: '1rem', borderTop: '1px solid #374151' }}>
          <button
            onClick={onLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              color: '#ef4444',
              cursor: 'pointer',
              borderRadius: '6px',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#dc262620'
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent'
            }}
          >
            <LogOut size={20} />
            {sidebarOpen && <span>Выйти</span>}
          </button>
        </div>
      </div>

      {/* Основной контент */}
      <div style={{ 
        flex: 1, 
        overflow: 'auto',
        backgroundColor: '#f8fafc'
      }}>
        <main style={{ padding: '2rem' }}>
          {children}
        </main>
      </div>
    </div>
  )
}

export default Layout 