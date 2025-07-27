import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client.js';

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    course: '',
    student: '',
    lesson: '',
    status: ''
  });

  useEffect(() => {
    loadReports();
  }, [filters]);

  async function loadReports() {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });
      
      const data = await apiClient.getReports(queryParams.toString());
      setReports(data);
    } catch (err) {
      setError('Ошибка загрузки отчетов');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveReport(id) {
    try {
      await apiClient.approveReport(id);
      loadReports();
    } catch (err) {
      setError('Ошибка одобрения отчета');
      console.error(err);
    }
  }

  async function handleRejectReport(id) {
    try {
      await apiClient.rejectReport(id);
      loadReports();
    } catch (err) {
      setError('Ошибка отклонения отчета');
      console.error(err);
    }
  }

  function getStatusBadge(status) {
    const statusConfig = {
      'pending': { text: 'На проверке', class: 'bg-yellow-100 text-yellow-800' },
      'approved': { text: 'Одобрен', class: 'bg-green-100 text-green-800' },
      'rejected': { text: 'Отклонен', class: 'bg-red-100 text-red-800' }
    };
    
    const config = statusConfig[status] || { text: status, class: 'bg-gray-100 text-gray-800' };
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.class}`}>
        {config.text}
      </span>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Отчеты</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Фильтры */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-3">Фильтры</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Курс</label>
            <input
              type="text"
              value={filters.course}
              onChange={(e) => setFilters({...filters, course: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Название курса"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Студент</label>
            <input
              type="text"
              value={filters.student}
              onChange={(e) => setFilters({...filters, student: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Имя студента"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Урок</label>
            <input
              type="text"
              value={filters.lesson}
              onChange={(e) => setFilters({...filters, lesson: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Название урока"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Все статусы</option>
              <option value="pending">На проверке</option>
              <option value="approved">Одобрен</option>
              <option value="rejected">Отклонен</option>
            </select>
          </div>
        </div>
      </div>

      {/* Таблица отчетов */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Студент
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Курс
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Урок
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Статус
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Дата
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Действия
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {reports.map(report => (
              <tr key={report.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {report.student_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {report.course_title}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {report.lesson_title}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(report.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(report.created_at).toLocaleDateString('ru-RU')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  {report.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleApproveReport(report.id)}
                        className="text-green-600 hover:text-green-900 text-xs"
                      >
                        Одобрить
                      </button>
                      <button
                        onClick={() => handleRejectReport(report.id)}
                        className="text-red-600 hover:text-red-900 text-xs"
                      >
                        Отклонить
                      </button>
                    </>
                  )}
                  {report.file_url && (
                    <a
                      href={report.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-900 text-xs"
                    >
                      Скачать
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {reports.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Отчеты не найдены
          </div>
        )}
      </div>
    </div>
  );
} 