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
    //recent_files: ProcessedFile[];
    pf_files?: number;       // Optional breakdown
    esi_files?: number;      // Optional breakdown
    pf_success?: number;     // Optional breakdown
    pf_error?: number;       // Optional breakdown
    esi_success?: number;    // Optional breakdown
    esi_error?: number;
    remittance_stats: {
      total_submitted: number; // Total remittance submissions
      pending: number; // Pending remittance submissions
    };
    monthly_stats: {
      labels: string[]; // Array of month names (e.g., ["January", "February"])
      datasets: {
        pf_success: number[]; // Monthly PF success counts
        pf_error: number[]; // Monthly PF error counts
        esi_success: number[]; // Monthly ESI success counts
        esi_error: number[]; // Monthly ESI error counts
        remittance_submitted: number[]; // Monthly remittance submissions
      };
    };
    recent_files: {
      id: number; // File ID
      filename: string; // File name
      status: string; // File status (e.g., "success", "error")
      created_at: string; // File creation date
      filepath: string; // File path (used to determine type: PF or ESI)
    }[];
    user_activity?: {
      top_users: {
        username: string; // User's name
        pf_files: number; // Number of PF files processed by the user
        esi_files: number; // Number of ESI files processed by the user
      }[];
    };
  

  }
  
  export interface FileProcessResult {
    file_path: string;
    status: string;
    message: string;
    upload_date?:string;
  }
// types.ts
export interface User {
  id: number;
  username: string;
}
