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
    token_type?: string;
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