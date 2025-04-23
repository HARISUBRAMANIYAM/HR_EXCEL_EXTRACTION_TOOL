// src/services/api.ts
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// Interface for the refresh token request
interface RefreshTokenRequest {
  refresh_token: string;
}

// Interface for the refresh token response
interface RefreshTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
}

// Interface for queued requests during token refresh
interface QueuedRequest {
  resolve: (token: string) => void;
  reject: (err: AxiosError) => void;
}

// Interface for our custom Axios instance with enhanced config
interface CustomAxiosInstance extends AxiosInstance {
  (config: AxiosRequestConfig): Promise<AxiosResponse>;
  (url: string, config?: AxiosRequestConfig): Promise<AxiosResponse>;
}

// Interface for extended request config
interface ExtendedAxiosRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

const API_BASE_URL = 'http://localhost:8000';

let isRefreshing = false;
let failedRequestsQueue: QueuedRequest[] = [];

// Create Axios instance with custom type
const api: CustomAxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for http-only cookies if using them
}) as CustomAxiosInstance;

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log("Request:",config.url);
    console.log('Refresh token flow triggered');

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as ExtendedAxiosRequestConfig;
    
    // If error is 401 and we haven't already tried to refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        
        try {
          const refreshToken = localStorage.getItem('refreshToken');
          if (!refreshToken) {
            throw new Error('No refresh token available');
          }

          const response = await axios.post<RefreshTokenResponse>(
            `${API_BASE_URL}/refresh_token`,
            { refresh_token: refreshToken } as RefreshTokenRequest
          );

          const { access_token, refresh_token } = response.data;
          
          localStorage.setItem('token', access_token);
          if (refresh_token) {
            localStorage.setItem('refreshToken', refresh_token);
          }

          api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
          
          // Retry all queued requests with new token
          failedRequestsQueue.forEach((request) => request.resolve(access_token));
          failedRequestsQueue = [];

          return api(originalRequest);
        } catch (refreshError:any) {
          failedRequestsQueue.forEach((request) => request.reject(refreshError));
          failedRequestsQueue = [];
          
          // Logout user if refresh fails
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
          }
          
          window.location.href = '/login'; // Redirect to login
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      // If refresh is already in progress, add to queue
      return new Promise((resolve, reject) => {
        failedRequestsQueue.push({
          resolve: (token: string) => {
            originalRequest.headers = originalRequest.headers || {};
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