import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client.js';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      setLoading(true);
      const data = await apiClient.getStats('dashboard');
      setStats(data);
    } catch (err) {
      setError('Ошибка загрузки статистики');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Панель управления</h1>
      
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700">Всего студентов</h3>
            <p className="text-3xl font-bold text-blue-600">{stats.totalStudents || 0}</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700">Всего курсов</h3>
            <p className="text-3xl font-bold text-green-600">{stats.totalCourses || 0}</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700">Отчетов на проверке</h3>
            <p className="text-3xl font-bold text-yellow-600">{stats.pendingReports || 0}</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700">Активных студентов</h3>
            <p className="text-3xl font-bold text-purple-600">{stats.activeStudents || 0}</p>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Последняя активность</h2>
        <div className="text-gray-600">
          {stats?.recentActivity ? (
            <ul className="space-y-2">
              {stats.recentActivity.map((activity, index) => (
                <li key={index} className="flex items-center space-x-3">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span>{activity}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>Нет данных о последней активности</p>
          )}
        </div>
      </div>
    </div>
  );
} 