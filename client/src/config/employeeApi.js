import axios from 'axios';

const API_URL = process.env.NODE_ENV === 'production'
  ? '/api'
  : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');

const employeeApi = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add employee token to requests
employeeApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('employeeToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors
employeeApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('employeeToken');
      localStorage.removeItem('employeeData');
      window.location.href = '/employee/login';
    }
    return Promise.reject(error);
  }
);

export default employeeApi;
