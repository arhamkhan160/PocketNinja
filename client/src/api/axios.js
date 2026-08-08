import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// Intercept requests and attach the JWT token if it exists
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('pocketninja_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
