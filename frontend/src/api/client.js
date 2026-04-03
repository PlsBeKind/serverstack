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
  getAuthStatus: () => http.get('/auth/status').then(r => r.data),
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
  getServerServices: (id) => http.get(`/servers/${id}/services`).then(r => r.data),
  getServerIps: (id) => http.get(`/servers/${id}/ips`).then(r => r.data),
  getServerCredentials: (id) => http.get(`/servers/${id}/credentials`).then(r => r.data),
  getCredentialPassword: (serverId, credId) => http.get(`/servers/${serverId}/credentials/${credId}/password`).then(r => r.data),
  createCredential: (serverId, data) => http.post(`/servers/${serverId}/credentials`, data).then(r => r.data),
  updateCredential: (serverId, credId, data) => http.put(`/servers/${serverId}/credentials/${credId}`, data).then(r => r.data),
  deleteCredential: (serverId, credId) => http.delete(`/servers/${serverId}/credentials/${credId}`),
  getServerDisks: (id) => http.get(`/servers/${id}/disks`).then(r => r.data),
  createDisk: (serverId, data) => http.post(`/servers/${serverId}/disks`, data).then(r => r.data),
  updateDisk: (serverId, diskId, data) => http.put(`/servers/${serverId}/disks/${diskId}`, data).then(r => r.data),
  deleteDisk: (serverId, diskId) => http.delete(`/servers/${serverId}/disks/${diskId}`),
  getCostHistory: (serverId) => http.get(`/servers/${serverId}/cost-history`).then(r => r.data),
  priceChange: (serverId, data) => http.post(`/servers/${serverId}/price-change`, data).then(r => r.data),
  schedulePriceChange: (serverId, data) => http.post(`/servers/${serverId}/schedule-price-change`, data).then(r => r.data),
  cancelScheduledPrice: (serverId) => http.delete(`/servers/${serverId}/schedule-price-change`),
  createServer: (data) => http.post('/servers', data).then(r => r.data),
  updateServer: (id, data) => http.put(`/servers/${id}`, data).then(r => r.data),
  deleteServer: (id) => http.delete(`/servers/${id}`),

  getExpiringServers: (days = 30) => http.get(`/servers/expiring?days=${days}`).then(r => r.data),

  // IPs
  getIps: () => http.get('/ips').then(r => r.data),
  createIp: (data) => http.post('/ips', data).then(r => r.data),
  updateIp: (id, data) => http.put(`/ips/${id}`, data).then(r => r.data),
  deleteIp: (id) => http.delete(`/ips/${id}`),

  // Services
  getServices: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return http.get(`/services${query ? '?' + query : ''}`).then(r => r.data);
  },
  createService: (data) => http.post('/services', data).then(r => r.data),
  updateService: (id, data) => http.put(`/services/${id}`, data).then(r => r.data),
  deleteService: (id) => http.delete(`/services/${id}`),

  // Tags
  getTags: () => http.get('/tags').then(r => r.data),
  createTag: (data) => http.post('/tags', data).then(r => r.data),
  deleteTag: (id) => http.delete(`/tags/${id}`),
  assignTag: (serverId, tagId) => http.post(`/servers/${serverId}/tags`, { tag_id: tagId }).then(r => r.data),
  removeTag: (serverId, tagId) => http.delete(`/servers/${serverId}/tags/${tagId}`),

  // Dashboard
  getSummary: () => http.get('/dashboard/summary').then(r => r.data),
  getCostTrend: () => http.get('/dashboard/cost-trend').then(r => r.data),
  getUpcomingBilling: (days = 30) => http.get(`/dashboard/upcoming-billing?days=${days}`).then(r => r.data),
  getCosts: () => http.get('/dashboard/costs').then(r => r.data),
  getAlerts: () => http.get('/dashboard/alerts').then(r => r.data),
  markAlertRead: (id) => http.put(`/dashboard/alerts/${id}/read`).then(r => r.data),
  markAllAlertsRead: () => http.put('/dashboard/alerts/read-all').then(r => r.data),
  getResources: () => http.get('/dashboard/resources').then(r => r.data),

  // Export/Import
  exportData: () => http.get('/export').then(r => r.data),
  importData: (data) => http.post('/import', data).then(r => r.data),
};
