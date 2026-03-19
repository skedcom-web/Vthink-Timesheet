import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLoginEndpoint = err.config?.url?.includes('/auth/login');
    if (err.response?.status === 401 && !isLoginEndpoint) {
      // Clear token and let Zustand/React handle re-render — NO window.location reload
      localStorage.removeItem('access_token');
      // Import store dynamically to avoid circular deps — triggers re-render cleanly
      import('../store/authStore').then(({ useAuthStore }) => {
        useAuthStore.getState().logout();
      });
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/api/v1/auth/login', { email, password }).then(r => r.data),
  me: () => api.get('/api/v1/auth/me').then(r => r.data),
};

export const projectsApi = {
  getAll: () => api.get('/api/v1/projects').then(r => r.data),
  getTasks: (projectId: string) => api.get(`/api/v1/tasks?projectId=${projectId}`).then(r => r.data),
};

export const tasksApi = {
  create:        (data: any)              => api.post('/api/v1/tasks', data).then(r => r.data),
  update:        (id: string, data: any)  => api.put(`/api/v1/tasks/${id}`, data).then(r => r.data),
  getAll:        (projectId?: string)     => api.get('/api/v1/tasks', { params: projectId ? { projectId } : {} }).then(r => r.data),
  getActive:     (projectId?: string)     => api.get('/api/v1/tasks', { params: { ...(projectId ? { projectId } : {}), activeOnly: 'true' } }).then(r => r.data),
  getOne:        (id: string)             => api.get(`/api/v1/tasks/${id}`).then(r => r.data),
  getMyAssigned: ()                       => api.get('/api/v1/tasks/my-assigned').then(r => r.data),
};

export const assignmentsApi = {
  create: (data: any)             => api.post('/api/v1/assignments', data).then(r => r.data),
  getAll: ()                      => api.get('/api/v1/assignments').then(r => r.data),
  update: (id: string, data: any) => api.put(`/api/v1/assignments/${id}`, data).then(r => r.data),
};

export const timesheetsApi = {
  save:        (data: any)                   => api.post('/api/v1/timesheets', data).then(r => r.data),
  submit:      (id: string)                  => api.put(`/api/v1/timesheets/${id}/submit`).then(r => r.data),
  getMine:     ()                             => api.get('/api/v1/timesheets/mine').then(r => r.data),
  recall:      (id: string)                  => api.put(`/api/v1/timesheets/${id}/recall`).then(r => r.data),
  deleteDraft: (id: string)                  => api.delete(`/api/v1/timesheets/${id}`).then(r => r.data),
  approve:     (id: string)                  => api.put(`/api/v1/timesheets/${id}/approve`).then(r => r.data),
  reject:      (id: string, reason?: string) => api.put(`/api/v1/timesheets/${id}/reject`, { reason }).then(r => r.data),
  getAll:      ()                            => api.get('/api/v1/timesheets').then(r => r.data),
  getPending:  ()                            => api.get('/api/v1/timesheets/pending').then(r => r.data),
  getMyWeek:   (weekStartDate: string)       => api.get('/api/v1/timesheets/week', { params: { weekStartDate } }).then(r => r.data),
};

export const usersApi = {
  getAll:            ()                    => api.get('/api/v1/users').then(r => r.data),
  getEmployeeOptions:()                    => api.get('/api/v1/users/employee-options').then(r => r.data),
  create:            (data: any)           => api.post('/api/v1/users', data).then(r => r.data),
  revoke:            (id: string)          => api.patch(`/api/v1/users/${id}/revoke`).then(r => r.data),
  restore:           (id: string)          => api.patch(`/api/v1/users/${id}/restore`).then(r => r.data),
  resetPassword:     (data: any)           => api.post('/api/v1/users/reset-password', data).then(r => r.data),
  changePassword:       (data: { currentPassword: string; newPassword: string }) =>
    api.post('/api/v1/users/change-password', data).then(r => r.data),
  getMyManager:         ()                                                    => api.get('/api/v1/users/my-manager').then(r => r.data),
  forgotPassword:       (identifier: string)                                  => api.post('/api/v1/users/forgot-password', { identifier }).then(r => r.data),
  setPasswordViaToken:  (userId: string, token: string, newPassword: string)  => api.post('/api/v1/users/set-password-via-token', { userId, token, newPassword }).then(r => r.data),
};

export const dashboardApi = {
  getStats: () => api.get('/api/v1/dashboard/stats').then(r => r.data),
};

export const projectConfigApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/api/v1/project-config/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
  getAll:         () => api.get('/api/v1/project-config').then(r => r.data),
  getFull:        () => api.get('/api/v1/project-config/full').then(r => r.data),
  getTaskNames:   (projectConfigId: string) =>
    api.get(`/api/v1/project-config/${projectConfigId}/task-names`).then(r => r.data),
  getAllTaskNames: () => api.get('/api/v1/project-config/task-names/all').then(r => r.data),
};

export const employeeConfigApi = {
  upload:      (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/api/v1/employee-config/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
  getAll:      ()                              => api.get('/api/v1/employee-config').then(r => r.data),
  lookupByName:(name: string)                  => api.post('/api/v1/employee-config/lookup', { name }).then(r => r.data),
  addOne:      (data: { employeeNo: string; name: string; designation: string; email: string }) =>
    api.post('/api/v1/employee-config/add-one', data).then(r => r.data),
  getSummary:  ()                              => api.get('/api/v1/employee-config/summary').then(r => r.data),
};

export const projectConfigSummaryApi = {
  getSummary: () => api.get('/api/v1/project-config/summary').then(r => r.data),
};
