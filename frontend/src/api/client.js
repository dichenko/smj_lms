// API клиент для взаимодействия с Cloudflare Worker

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://lms-telegram-bot.workers.dev'

class ApiClient {
  constructor() {
    this.credentials = null
  }

  setCredentials(credentials) {
    this.credentials = credentials
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    }
    
    if (this.credentials) {
      headers['Authorization'] = `Basic ${this.credentials}`
    }
    
    return headers
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`
    
    const config = {
      headers: this.getHeaders(),
      ...options,
    }

    try {
      const response = await fetch(url, config)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('API request failed:', error)
      throw error
    }
  }

  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' })
  }

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async patch(endpoint, data) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' })
  }

  // Студенты
  async getStudents() {
    return this.get('/api/students')
  }

  async createStudent(data) {
    return this.post('/api/students', data)
  }

  async deleteStudent(id) {
    return this.delete(`/api/students/${id}`)
  }

  async assignCourse(studentId, courseId) {
    return this.post(`/api/students/${studentId}/assign-course`, { course_id: courseId })
  }

  // Курсы
  async getCourses() {
    return this.get('/api/courses')
  }

  async createCourse(data) {
    return this.post('/api/courses', data)
  }

  async deleteCourse(id) {
    return this.delete(`/api/courses/${id}`)
  }

  async getCourseLessons(courseId) {
    return this.get(`/api/courses/${courseId}/lessons`)
  }

  async addLesson(courseId, data) {
    return this.post(`/api/courses/${courseId}/lessons`, data)
  }

  // Уроки
  async getLesson(id) {
    return this.get(`/api/lessons/${id}`)
  }

  async updateLesson(id, data) {
    return this.patch(`/api/lessons/${id}`, data)
  }

  async deleteLesson(id) {
    return this.delete(`/api/lessons/${id}`)
  }

  // Отчеты
  async getReports(filters = {}) {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value)
    })
    
    const queryString = params.toString()
    const endpoint = `/api/reports${queryString ? `?${queryString}` : ''}`
    return this.get(endpoint)
  }

  async getReport(id) {
    return this.get(`/api/reports/${id}`)
  }

  async approveReport(id, comment = '') {
    return this.post(`/api/reports/${id}/approve`, { comment })
  }

  async rejectReport(id, comment = '') {
    return this.post(`/api/reports/${id}/reject`, { comment })
  }

  // Статистика
  async getDashboardStats() {
    return this.get('/api/stats/dashboard')
  }

  async getCoursesStats() {
    return this.get('/api/stats/courses')
  }

  async getStudentsStats() {
    return this.get('/api/stats/students')
  }
}

export const apiClient = new ApiClient()

// Утилита для создания basic auth credentials
export function createBasicAuth(username, password) {
  return btoa(`${username}:${password}`)
} 