import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client.js';

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [newCourse, setNewCourse] = useState({ title: '', description: '' });
  const [newLesson, setNewLesson] = useState({ title: '', content: '', links: '' });

  useEffect(() => {
    loadCourses();
  }, []);

  async function loadCourses() {
    try {
      setLoading(true);
      const data = await apiClient.getCourses();
      setCourses(data);
    } catch (err) {
      setError('Ошибка загрузки курсов');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddCourse(e) {
    e.preventDefault();
    try {
      await apiClient.createCourse(newCourse);
      setNewCourse({ title: '', description: '' });
      setShowAddForm(false);
      loadCourses();
    } catch (err) {
      setError('Ошибка создания курса');
      console.error(err);
    }
  }

  async function handleAddLesson(e) {
    e.preventDefault();
    try {
      const lessonData = {
        ...newLesson,
        links: newLesson.links ? JSON.parse(newLesson.links) : []
      };
      await apiClient.addLesson(selectedCourse.id, lessonData);
      setNewLesson({ title: '', content: '', links: '' });
      setShowLessonForm(false);
      setSelectedCourse(null);
      loadCourses();
    } catch (err) {
      setError('Ошибка добавления урока');
      console.error(err);
    }
  }

  async function handleDeleteCourse(id) {
    if (!confirm('Удалить курс?')) return;
    
    try {
      await apiClient.deleteCourse(id);
      loadCourses();
    } catch (err) {
      setError('Ошибка удаления курса');
      console.error(err);
    }
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Курсы</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Добавить курс
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {showAddForm && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Добавить курс</h2>
          <form onSubmit={handleAddCourse} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Название</label>
              <input
                type="text"
                value={newCourse.title}
                onChange={(e) => setNewCourse({...newCourse, title: e.target.value})}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Описание</label>
              <textarea
                value={newCourse.description}
                onChange={(e) => setNewCourse({...newCourse, description: e.target.value})}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                rows="3"
                required
              />
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Добавить
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      {showLessonForm && selectedCourse && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Добавить урок в "{selectedCourse.title}"</h2>
          <form onSubmit={handleAddLesson} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Название урока</label>
              <input
                type="text"
                value={newLesson.title}
                onChange={(e) => setNewLesson({...newLesson, title: e.target.value})}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Содержание</label>
              <textarea
                value={newLesson.content}
                onChange={(e) => setNewLesson({...newLesson, content: e.target.value})}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                rows="4"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Ссылки (JSON массив)</label>
              <input
                type="text"
                value={newLesson.links}
                onChange={(e) => setNewLesson({...newLesson, links: e.target.value})}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder='["https://example.com", "https://example2.com"]'
              />
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Добавить
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLessonForm(false);
                  setSelectedCourse(null);
                }}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-6">
        {courses.map(course => (
          <div key={course.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-semibold">{course.title}</h3>
                <p className="text-gray-600 mt-1">{course.description}</p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setSelectedCourse(course);
                    setShowLessonForm(true);
                  }}
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                >
                  Добавить урок
                </button>
                <button
                  onClick={() => handleDeleteCourse(course.id)}
                  className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                >
                  Удалить
                </button>
              </div>
            </div>
            
            <div className="text-sm text-gray-500 mb-3">
              Студентов: {course.student_count || 0} | Уроков: {course.lesson_count || 0}
            </div>

            {course.lessons && course.lessons.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Уроки:</h4>
                <div className="space-y-2">
                  {course.lessons.map(lesson => (
                    <div key={lesson.id} className="bg-gray-50 p-3 rounded">
                      <div className="font-medium">{lesson.title}</div>
                      <div className="text-sm text-gray-600">{lesson.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 