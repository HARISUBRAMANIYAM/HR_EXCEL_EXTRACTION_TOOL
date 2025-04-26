// // src/services/api.ts
// import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// interface RefreshTokenResponse {
//   access_token: string;
//   refresh_token: string;
//   token_type: string;
// }

// interface QueuedRequest {
//   resolve: (token: string) => void;
//   reject: (error: AxiosError) => void;
// }

// interface ExtendedAxiosRequestConfig extends AxiosRequestConfig {
//   _retry?: boolean;
// }

// const API_BASE_URL = 'http://localhost:8000';

// let isRefreshing = false;
// let failedRequestsQueue: QueuedRequest[] = [];

// const api: AxiosInstance = axios.create({
//   baseURL: API_BASE_URL,
//   headers: {
//     'Content-Type': 'application/json',
//   },
//   withCredentials: true,
// });

// // Request interceptor
// api.interceptors.request.use(
//   (config) => {
//     const extendedConfig = config as ExtendedAxiosRequestConfig;
//     extendedConfig.headers= extendedConfig.headers || {};
//     const token = localStorage.getItem('token');
//     if (token) {
//       config.headers = config.headers || {};
//       config.headers.Authorization = `Bearer ${token}`;
//     }
//     return config;
//   },
//   (error) => {
//     return Promise.reject(error);
//   }
// );

// // Response interceptor
// api.interceptors.response.use(
//   (response: AxiosResponse) => response,
//   async (error: AxiosError) => {
//     const originalRequest = error.config as ExtendedAxiosRequestConfig;

//     // Handle 401 Unauthorized responses
//     if (error.response?.status === 401 && !originalRequest._retry) {
//       originalRequest._retry = true;

//       if (!isRefreshing) {
//         isRefreshing = true;

//         try {
//           const refreshToken = localStorage.getItem('refreshToken');
//           if (!refreshToken) {
//             throw new Error('No refresh token available');
//           }

//           // Attempt to refresh tokens
//           const response = await axios.post<RefreshTokenResponse>(
//             `${API_BASE_URL}/refresh_token`,
//             { refresh_token: refreshToken }
//           );

//           const { access_token, refresh_token } = response.data;

//           // Store new tokens
//           localStorage.setItem('token', access_token);
//           localStorage.setItem('refreshToken', refresh_token);

//           // Update axios instance with new token
//           api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
//           originalRequest.headers = originalRequest.headers || {};
//           originalRequest.headers['Authorization'] = `Bearer ${access_token}`;

//           // Retry all queued requests
//           failedRequestsQueue.forEach(request => request.resolve(access_token));
//           failedRequestsQueue = [];

//           // Retry the original request
//           return api(originalRequest);
//         } catch (refreshError) {
//           // Clear tokens and redirect to login on refresh failure
//           localStorage.removeItem('token');
//           localStorage.removeItem('refreshToken');
//           window.location.href = '/login';

//           // Reject all queued requests
//           failedRequestsQueue.forEach(request => request.reject(refreshError as AxiosError));
//           failedRequestsQueue = [];

//           return Promise.reject(refreshError);
//         } finally {
//           isRefreshing = false;
//         }
//       }

//       // If refresh is already in progress, queue the request
//       return new Promise((resolve, reject) => {
//         failedRequestsQueue.push({
//           resolve: (newToken: string) => {
//             originalRequest.headers = originalRequest.headers || {};
//             originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
//             resolve(api(originalRequest));
//           },
//           reject: (err: AxiosError) => {
//             reject(err);
//           }
//         });
//       });
//     }

//     return Promise.reject(error);
//   }
// );

// export default api;
// src/services/api.ts
import axios, { AxiosError, AxiosHeaders, AxiosInstance } from 'axios';

const API_BASE_URL = 'http://localhost:8000';

let isRefreshing = false;
let failedRequestsQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: AxiosError) => void;
}> = [];

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    (config.headers as AxiosHeaders).set('Authorization', `Bearer ${token}`)
  }return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      if (!isRefreshing) {
        isRefreshing = true;
        
        try {
          const refreshToken = localStorage.getItem('refreshToken');
          if (!refreshToken) throw new Error('No refresh token');
          
          const response = await axios.post(`${API_BASE_URL}/refresh_token`, {
            refresh_token: refreshToken
          });
          
          const { access_token, refresh_token } = response.data;
          localStorage.setItem('token', access_token);
          localStorage.setItem('refreshToken', refresh_token);
          
          api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
          failedRequestsQueue.forEach(request => request.resolve(access_token));
          
          return api(originalRequest);
        } catch (refreshError) {
          const axiosError = refreshError as AxiosError;
          failedRequestsQueue.forEach(request => request.reject(axiosError));
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
          failedRequestsQueue = [];
        }
      }
      
      return new Promise((resolve, reject) => {
        failedRequestsQueue.push({
          resolve: (token: string) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            resolve(api(originalRequest));
          },
          reject: (err: AxiosError) => {
            reject(err);
          },
        });
      });
    }
    
    return Promise.reject(error);
  }
);

export default api;