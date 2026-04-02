import axios from 'axios';

const http = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const api = {
  // Auth
  login: (data) => http.post('/auth/login', data).then(r => r.data),
  register: (data) => http.post('/auth/register', data).then(r => r.data),
  changePassword: (data) => http.post('/auth/change-password', data).then(r => r.data),

  // Providers
  getProviders: () => http.get('/providers').then(r => r.data),
  getProvider: (id) => http.get(`/providers/${id}`).then(r => r.data),
  createProvider: (data) => http.post('/providers', data).then(r => r.data),
  updateProvider: (id, data) => http.put(`/providers/${id}`, data).then(r => r.data),
  deleteProvider: (id) => http.delete(`/providers/${id}`),

  // Servers
  getServers: () => http.get('/servers').then(r => r.data),
  getServer: (id) => http.get(`/servers/${id}`).then(r => r.data),
  getServerPassword: (id) => http.get(`/servers/${id}/password`).then(r => r.data),
  getServerServices: (id) => http.get(`/servers/${id}/services`).then(r => r.data),
  getServerIps: (id) => http.get(`/servers/${id}/ips`).then(r => r.data),
  createServer: (data) => http.post('/servers', data).then(r => r.data),
  updateServer: (id, data) => http.put(`/servers/${id}`, data).then(r => r.data),
  deleteServer: (id) => http.delete(`/servers/${id}`),

  // Contracts
  getContracts: () => http.get('/contracts').then(r => r.data),
  getContract: (id) => http.get(`/contracts/${id}`).then(r => r.data),
  getExpiringContracts: (days = 30) => http.get(`/contracts/expiring?days=${days}`).then(r => r.data),
  createContract: (data) => http.post('/contracts', data).then(r => r.data),
  updateContract: (id, data) => http.put(`/contracts/${id}`, data).then(r => r.data),
  deleteContract: (id) => http.delete(`/contracts/${id}`),

  // IPs
  getIps: () => http.get('/ips').then(r => r.data),
  createIp: (data) => http.post('/ips', data).then(r => r.data),
  updateIp: (id, data) => http.put(`/ips/${id}`, data).then(r => r.data),
  deleteIp: (id) => http.delete(`/ips/${id}`),

  // Services
  getServices: () => http.get('/services').then(r => r.data),
  createService: (data) => http.post('/services', data).then(r => r.data),
  updateService: (id, data) => http.put(`/services/${id}`, data).then(r => r.data),
  deleteService: (id) => http.delete(`/services/${id}`),

  // Dashboard
  getSummary: () => http.get('/dashboard/summary').then(r => r.data),
  getCosts: () => http.get('/dashboard/costs').then(r => r.data),
  getAlerts: () => http.get('/dashboard/alerts').then(r => r.data),
  markAlertRead: (id) => http.put(`/dashboard/alerts/${id}/read`).then(r => r.data),
  markAllAlertsRead: () => http.put('/dashboard/alerts/read-all').then(r => r.data),
  getResources: () => http.get('/dashboard/resources').then(r => r.data),

  // Export/Import
  exportData: () => http.get('/export').then(r => r.data),
  importData: (data) => http.post('/import', data).then(r => r.data),
};
