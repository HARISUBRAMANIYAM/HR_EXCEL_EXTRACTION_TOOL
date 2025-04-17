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
    pf_files?: number;       // Optional breakdown
    esi_files?: number;      // Optional breakdown
    pf_success?: number;     // Optional breakdown
    pf_error?: number;       // Optional breakdown
    esi_success?: number;    // Optional breakdown
    esi_error?: number; 
  }
  
  export interface FileProcessResult {
    file_path: string;
    status: string;
    message: string;
  }
// types.ts
export interface User {
  id: number;
  username: string;
}

export interface Schedule {
  id: number;
  user_id: number;
  name: string;
  description: string;
  frequency: "daily" | "weekly" | "monthly";
  run_time: string; // Time in "HH:MM:SS" format
  days_of_week: number[]; // 0-6 (Monday-Sunday)
  day_of_month: number; // 1-31
  process_type: "pf" | "esi";
  input_folder: string;
  output_folder: string;
  archive_folder: string;
  is_active: boolean;
  created_at: string;
  next_run: string;
  last_run: string | null;
}

export interface SchedulerJob {
  id: string;
  name: string;
  next_run_time: string;
  trigger: string;
}

export interface SchedulerStatus {
  running: boolean;
  jobs: SchedulerJob[];
}

export interface ScheduleFormData {
  name: string;
  description: string;
  frequency: "daily" | "weekly" | "monthly";
  run_time: string;
  days_of_week: number[];
  day_of_month: number;
  process_type: "pf" | "esi";
  input_folder: string;
  output_folder: string;
  archive_folder: string;
}

export const weekdays = [
  { id: 0, name: "Monday" },
  { id: 1, name: "Tuesday" },
  { id: 2, name: "Wednesday" },
  { id: 3, name: "Thursday" },
  { id: 4, name: "Friday" },
  { id: 5, name: "Saturday" },
  { id: 6, name: "Sunday" },
];