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
    refresh_token:string;
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
  
  // export interface DashboardStats {
  //   total_files: number;
  //   success_files: number;
  //   error_files: number;
  //   //recent_files: ProcessedFile[];
  //   pf_files?: number;       // Optional breakdown
  //   esi_files?: number;      // Optional breakdown
  //   pf_success?: number;     // Optional breakdown
  //   pf_error?: number;       // Optional breakdown
  //   esi_success?: number;    // Optional breakdown
  //   esi_error?: number;
  //   remittance_stats: {
  //     total_submitted: number; // Total remittance submissions
  //     pending: number; // Pending remittance submissions
  //     timely_submissions?: number;
  //   };
  //   monthly_stats: {
  //     labels: string[]; // Array of month names (e.g., ["January", "February"])
  //     datasets: {
  //       pf_success: number[]; // Monthly PF success counts
  //       pf_error: number[]; // Monthly PF error counts
  //       esi_success: number[]; // Monthly ESI success counts
  //       esi_error: number[]; // Monthly ESI error counts
  //       remittance_submitted: number[]; // Monthly remittance submissions
  //     };
  //   };
  //   recent_files: {
  //     id: number; // File ID
  //     filename: string; // File name
  //     status: string; // File status (e.g., "success", "error")
  //     created_at: string; // File creation date
  //     filepath: string; // File path (used to determine type: PF or ESI)
  //   }[];
  //   user_activity?: {
  //     top_users: {
  //       username: string; // User's name
  //       pf_files: number; // Number of PF files processed by the user
  //       esi_files: number; // Number of ESI files processed by the user
  //     }[];
  //     total_users?: number;
  //   };
  //   remittance_delays:{
  //     days:number;
  //     count:number;
  //     type:'PF' | 'ESI';
  //   }[];

  // }
   export interface ChartData {
    labels: string[];
    data: number[];
  }
  
  export interface DashboardStats {
    challan_amounts: ChartData;
    pf_submissions: ChartData;
    esi_submissions: ChartData;
    delayed_submissions: ChartData;
  }
  export interface FileProcessResult {
    file_path: string;
    status: string;
    message: string;
    upload_date?:string;
    upload_month?:string;
  }
// types.ts
export interface User {
  id: number;
  username: string;
}
export interface SubmissionPoint {
  x: number; // Day of month (1-31)
  y: number; // Amount
  r?: number; // Optional radius for scatter plot
}

export interface DelayedSubmission {
  delay_days: number;
  amount: number;
  id?: number; // For React keys
}

export interface MonthlyAmountData {
  labels: string[]; // Month abbreviations ["Jan", "Feb", ...]
  datasets: {
    PF: number[];
    ESI: number[];
  };
}

export interface SubmissionData {
  labels: string[];
  points: SubmissionPoint[][]; // Array of points for each month
}

export interface DelayedData {
  labels: string[];
  datasets: {
    PF: DelayedSubmission[][]; // Array of delayed submissions for each month (PF)
    ESI: DelayedSubmission[][]; // Array of delayed submissions for each month (ESI)
  };
}

export interface SummaryStats {
  total_pf: number;
  total_esi: number;
  pf_submissions: number;
  esi_submissions: number;
  on_time_rate: number;
  avg_pf: number;
  avg_esi: number;
}

export interface RemittanceDashboardStats {
  monthly_amounts: MonthlyAmountData;
  pf_submissions: SubmissionData;
  esi_submissions: SubmissionData;
  delayed_submissions: DelayedData;
  summary_stats: SummaryStats;
  year: number;
}

// DashboardProps.ts - Props for the dashboard component
export interface DashboardProps {
  data?: RemittanceDashboardStats;
  loading: boolean;
  error: string | null;
  selectedYear: number;
  selectedMonth: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
}