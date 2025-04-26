// src/services/apiService.ts
import { DashboardStats, FileProcessResult, Token } from '../types';
import api from './api';

// Authentication services
export const authService = {
  login: async (username: string, password: string): Promise<Token> => {
    const response = await api.post<Token>('/login', { username, password });
    return response.data;
  },
  
  refreshToken: async (refreshToken: string): Promise<Token> => {
    const response = await api.post<Token>('/refresh-token', { refresh_token: refreshToken });
    return response.data;
  },
  
  logout: async (): Promise<void> => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try {
        await api.post('/logout', { refresh_token: refreshToken });
      } catch (error) {
        console.error('Error during logout:', error);
      }
    }
    
    // Clear local storage regardless of API call success
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
  }
};

// Dashboard services
export const dashboardService = {
  getStats: async (year: number): Promise<DashboardStats> => {
    const response = await api.get<DashboardStats>(`/dashboard/remittance_stats_viz?year=${year}`);
    return response.data;
  }
};

// File processing services
export const fileService = {
  processPFFolder: async (folderPath: string, uploadDate: string): Promise<FileProcessResult> => {
    const formData = new FormData();
    formData.append('folder_path', folderPath);
    formData.append('upload_date', uploadDate);
    
    const response = await api.post<FileProcessResult>('/process_folder_pf', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  },
  
  processESIFolder: async (folderPath: string, uploadDate: string): Promise<FileProcessResult> => {
    const formData = new FormData();
    formData.append('folder_path', folderPath);
    formData.append('upload_date', uploadDate);
    
    const response = await api.post<FileProcessResult>('/process_folder_esi', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  },
  
  getRecentFiles: async (limit: number = 10): Promise<any[]> => {
    const response = await api.get(`/files/recent?limit=${limit}`);
    return response.data;
  },
  
  getFileById: async (fileId: string): Promise<any> => {
    const response = await api.get(`/files/${fileId}`);
    return response.data;
  }
};

// User services
export const userService = {
  getCurrentUser: async (): Promise<any> => {
    const response = await api.get('/users/me');
    return response.data;
  },
  
  getUserActivity: async (): Promise<any> => {
    const response = await api.get('/users/activity');
    return response.data;
  },
  
  updateUserProfile: async (userData: any): Promise<any> => {
    const response = await api.put('/users/profile', userData);
    return response.data;
  }
};

// Remittance services
export const remittanceService = {
  submitRemittance: async (fileId: string, remittanceData: any): Promise<any> => {
    const response = await api.post(`/remittance/submit/${fileId}`, remittanceData);
    return response.data;
  },
  
  getRemittanceStatus: async (fileId: string): Promise<any> => {
    const response = await api.get(`/remittance/status/${fileId}`);
    return response.data;
  },
  
  getRemittanceDelays: async (year: number): Promise<any> => {
    const response = await api.get(`/remittance/delays?year=${year}`);
    return response.data;
  }
};