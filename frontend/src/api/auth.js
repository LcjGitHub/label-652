import api from './products.js';

export const register = (data) => {
  return api.post('/auth/register', data);
};

export const login = (data) => {
  return api.post('/auth/login', data);
};

export const getProfile = () => {
  return api.get('/auth/profile');
};

export const updateProfile = (data) => {
  return api.put('/auth/profile', data);
};

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('token', token);
  } else {
    delete api.defaults.headers.common['Authorization'];
    localStorage.removeItem('token');
  }
};

export const getStoredToken = () => {
  return localStorage.getItem('token');
};

export const initAuth = () => {
  const token = getStoredToken();
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
};
