// src/types/index.ts

export enum Role {
    USER = "user",
    HR = "hr",
    ADMIN = "admin"
  }
  
  export interface User {
    id: number;
    username: string;
    email: string;
    full_name: string;
    role: Role;
    created_at: string;
    updated_at: string;
  }
  
  export interface Token {
    access_token: string;
    token_type: string;
  }
  
  export interface ProcessedFile {
    id: number;
    user_id: number;
    filename: string;
    filepath: string;
    status: string;
    message: string;
    created_at: string;
    updated_at: string | null;
  }
  
  export interface DashboardStats {
    total_files: number;
    success_files: number;
    error_files: number;
    recent_files: ProcessedFile[];
  }
  
  export interface FileProcessResult {
    file_path: string;
    status: string;
    message: string;
  }