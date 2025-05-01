// import { useEffect, useState } from "react";
// import {
//   Bar,
//   BarChart,
//   CartesianGrid,
//   Cell,
//   Legend,
//   ResponsiveContainer,
//   Scatter,
//   ScatterChart,
//   Tooltip,
//   XAxis,
//   YAxis,
// } from "recharts";
// import api from "../services/api";
// import SubmissionTimeline from "./SubmissionTimeline";



// const DUMMY_DATA = {
//   monthly_amounts: {
//     labels: [
//       "January", "February", "March", "April", "May", "June", 
//       "July", "August", "September", "October", "November", "December"
//     ],
//     datasets: {
//       PF: [158000, 165000, 190000, 172000, 180000, 210000, 186000, 195000, 220000, 205000, 215000, 245000],
//       ESI: [78000, 82000, 94000, 85000, 89000, 105000, 92000, 97000, 110000, 102000, 108000, 122000]
//     }
//   },
//   pf_submissions: {
//     labels: [
//       "January", "February", "March", "April", "May", "June", 
//       "July", "August", "September", "October", "November", "December"
//     ],
//     points: [
//       [{ x: 1, y: 12, r: 5 }],
//       [{ x: 2, y: 8, r: 5 }],
//       [{ x: 3, y: 17, r: 5 }],
//       [{ x: 4, y: 10, r: 5 }],
//       [{ x: 5, y: 9, r: 5 }],
//       [{ x: 6, y: 14, r: 5 }],
//       [{ x: 7, y: 12, r: 5 }],
//       [{ x: 8, y: 8, r: 5 }],
//       [{ x: 9, y: 18, r: 5 }],
//       [{ x: 10, y: 11, r: 5 }],
//       [{ x: 11, y: 9, r: 5 }],
//       [{ x: 12, y: 14, r: 5 }]
//     ]
//   },
//   esi_submissions: {
//     labels: [
//       "January", "February", "March", "April", "May", "June", 
//       "July", "August", "September", "October", "November", "December"
//     ],
//     points: [
//       [{ x: 1, y: 10, r: 5 }],
//       [{ x: 2, y: 7, r: 5 }],
//       [{ x: 3, y: 15, r: 5 }],
//       [{ x: 4, y: 8, r: 5 }],
//       [{ x: 5, y: 9, r: 5 }],
//       [{ x: 6, y: 14, r: 5 }],
//       [{ x: 7, y: 11, r: 5 }],
//       [{ x: 8, y: 8, r: 5 }],
//       [{ x: 9, y: 16, r: 5 }],
//       [{ x: 10, y: 12, r: 5 }],
//       [{ x: 11, y: 8, r: 5 }],
//       [{ x: 12, y: 13, r: 5 }]
//     ]
//   },
//   delayed_submissions: {
//     labels: [
//       "January", "February", "March", "April", "May", "June", 
//       "July", "August", "September", "October", "November", "December"
//     ],
//     datasets: {
//       PF: [
//         [],
//         [],
//         [{ delay_days: 2, amount: 190000 }],
//         [],
//         [],
//         [],
//         [],
//         [],
//         [{ delay_days: 3, amount: 220000 }],
//         [],
//         [],
//         []
//       ],
//       ESI: [
//         [],
//         [],
//         [],
//         [],
//         [],
//         [],
//         [],
//         [],
//         [{ delay_days: 1, amount: 110000 }],
//         [],
//         [],
//         []
//       ]
//     }
//   },
//   summary_stats: {
//     total_pf: 2341000,
//     total_esi: 1164000,
//     pf_submissions: 12,
//     esi_submissions: 12,
//     on_time_rate: 0.833,
//     avg_pf: 195083,
//     avg_esi: 97000
//   },
//   year: 2025
// };


// interface SubmissionPoint {
//   x: number;
//   y: number;
//   r?: number;
// }

// interface DelayedSubmission {
//   delay_days: number;
//   amount: number;
// }

// interface MonthlyAmountData {
//   labels: string[];
//   datasets: {
//     PF: number[];
//     ESI: number[];
//   };
// }

// interface SubmissionData {
//   labels: string[];
//   points: SubmissionPoint[][];
// }

// interface DelayedData {
//   labels: string[];
//   datasets: {
//     PF: DelayedSubmission[][];
//     ESI: DelayedSubmission[][];
//   };
// }

// interface SummaryStats {
//   total_pf: number | null;
//   total_esi: number | string;
//   pf_submissions: number;
//   esi_submissions: number;
//   on_time_rate: number;
//   avg_pf: number | string;
//   avg_esi: number | string;
// }

// interface DashboardData {
//   monthly_amounts: MonthlyAmountData;
//   pf_submissions: SubmissionData;
//   esi_submissions: SubmissionData;
//   delayed_submissions: DelayedData;
//   summary_stats: SummaryStats;
//   year: number;
// }

// const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

// export default function RemittanceDashboard() {
//   const [data, setData] = useState<DashboardData | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
//   const [selectedMonth, setSelectedMonth] = useState<number>(-1);
//   const [activeTab, setActiveTab] = useState<
//     "overview" | "submissions" | "delayed"
//   >("overview");
//   useEffect(() => {
//     const fetchData = async () => {
//       try {
//         setLoading(true);
//         const response = await api.get(
//           `/dashboard/remittance_stats_viz?year=${selectedYear}`
//         );

//         const processedData = {
//           ...response.data,
//           summary_stats: {
//             ...response.data.summary_stats,
//             total_pf:
//               response.data.summary_stats.total_pf === "None"
//                 ? null
//                 : Number(response.data.summary_stats.total_pf),
//             total_esi: Number(response.data.summary_stats.total_esi),
//             avg_pf: Number(response.data.summary_stats.avg_pf),
//             avg_esi: Number(response.data.summary_stats.avg_esi),
//           },
//         };

//         setData(DUMMY_DATA);
//         setError(null);
//       } catch (err: any) {
//         setError(err.message);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchData();
//   }, [selectedYear]);
//   if (loading) {
//     return (
//       <div className="loading-container">
//         <div className="loading-text">Loading dashboard data...</div>
//         <div className="loading-spinner"></div>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div className="error-container">
//         <p className="error-title">Error</p>
//         <p>{error}</p>
//       </div>
//     );
//   }

//   if (!data) {
//     return (
//       <div className="no-data">
//         <p className="no-data-message">No remittance data available.</p>
//       </div>
//     );
//   }

//   // Prepare data for charts (uses all months)
//   const monthlyData = data.monthly_amounts.labels.map((month, i) => ({
//     month,
//     PF: data.monthly_amounts.datasets.PF[i],
//     ESI: data.monthly_amounts.datasets.ESI[i],
//   }));

//   // Combine all submission points across months
//   const allSubmissionData = {
//     pf: data.pf_submissions.points.flat(),
//     esi: data.esi_submissions.points.flat(),
//   };

//   // Combine all delayed submissions across months
//   const allDelayedData = {
//     pf: data.delayed_submissions.datasets.PF.flat(),
//     esi: data.delayed_submissions.datasets.ESI.flat(),
//   };

//   // Get current month data for summary cards only
//   const currentMonthData =
//     selectedMonth !== -1
//       ? {
//           pfAmount: data.monthly_amounts.datasets.PF[selectedMonth],
//           esiAmount: data.monthly_amounts.datasets.ESI[selectedMonth],
//           monthName: data.monthly_amounts.labels[selectedMonth],
//         }
//       : null;

//   const formatCurrency = (value: number | null | string) => {
//     if (value === null || value === undefined) return "₹0";
//     const numValue = typeof value === "string" ? parseFloat(value) : value;
//     return numValue.toLocaleString("en-IN", {
//       style: "currency",
//       currency: "INR",
//       maximumFractionDigits: 0,
//     });
//   };
//   return (
//     <div className="dashboard-container">
//       <div className="dashboard-header">
//         <h1 className="dashboard-title">Remittance Dashboard {data.year}</h1>

//         <div className="filters-container">
//           <div className="filter-group">
//             <label className="filter-label">Year:</label>
//             <select
//               value={selectedYear}
//               onChange={(e) => setSelectedYear(parseInt(e.target.value))}
//               className="filter-select"
//               aria-label="year"
//             >
//               {[2015,2020,2024,2026,2025].map((year) => (                 //data.year - 1, data.year, data.year + 2
//                 <option key={year} value={year}>
//                   {year}
//                 </option>
//               ))}
//             </select>
//           </div>
//           <div className="filter-group">
//             <label className="filter-label"> Month:</label>
//             <select
//               value={selectedMonth}
//               onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
//               className="filter-select"
//               aria-label="month"
//             >
//               <option value={-1}>All Months</option>
//               {data.monthly_amounts.labels.map((month, index) => (
//                 <option key={index} value={index}>
//                   {month}
//                 </option>
//               ))}
//             </select>
//           </div>
//         </div>

//         <div className="summary-cards">
//           {/* PF Summary Card - affected by month filter */}
//           <div className="summary-card pf">
//             <h3 className="summary-title pf">
//               {selectedMonth === -1
//                 ? "PF Remittance (Year)"
//                 : `PF Remittance (${currentMonthData?.monthName})`}
//             </h3>
//             <div className="summary-item">
//               <span className="summary-label">Total:</span>
//               <span className="summary-value pf">
//                 {selectedMonth === -1
//                   ? formatCurrency(data.summary_stats.total_pf)
//                   : formatCurrency(currentMonthData?.pfAmount ?? 0)}
//               </span>
//             </div>
//             <div className="summary-item">
//               <span className="summary-label">Avg:</span>
//               <span className="summary-value pf">
//                 {formatCurrency(data.summary_stats.avg_pf)}
//               </span>
//             </div>
//             <div className="summary-item">
//               <span className="summary-label">Submissions:</span>
//               <span className="summary-value pf">
//                 {data.summary_stats.pf_submissions}
//               </span>
//             </div>
//           </div>

//           {/* ESI Summary Card - affected by month filter */}
//           <div className="summary-card esi">
//             <h3 className="summary-title esi">
//               {selectedMonth === -1
//                 ? "ESI Remittance (Year)"
//                 : `ESI Remittance (${currentMonthData?.monthName})`}
//             </h3>
//             <div className="summary-item">
//               <span className="summary-label">Total:</span>
//               <span className="summary-value esi">
//                 {selectedMonth === -1
//                   ? formatCurrency(data.summary_stats.total_esi)
//                   : formatCurrency(currentMonthData?.esiAmount ?? 0)}
//               </span>
//             </div>
//             <div className="summary-item">
//               <span className="summary-label">Avg:</span>
//               <span className="summary-value esi">
//                 {formatCurrency(data.summary_stats.avg_esi)}
//               </span>
//             </div>
//             <div className="summary-item">
//               <span className="summary-label">Submissions:</span>
//               <span className="summary-value esi">
//                 {data.summary_stats.esi_submissions}
//               </span>
//             </div>
//           </div>

//           {/* Performance Card */}
//           <div className="summary-card performance">
//             <h3 className="summary-title performance">Performance</h3>
//             <div className="summary-item">
//               <span className="summary-label">On-Time Rate:</span>
//               <div>
//                 <div className="summary-value performance">
//                   {(data.summary_stats.on_time_rate * 100).toFixed(1)}%
//                 </div>
//                 <div className="progress-container">
//                   <div
//                     className="progress-bar"
//                     style={{
//                       width: `${data.summary_stats.on_time_rate * 100}%`,
//                     }}
//                   ></div>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Year Summary Card - always shows yearly data */}
//           <div className="summary-card year">
//             <h3 className="summary-title year">Year Summary</h3>
//             <div className="summary-item">
//               <span className="summary-label">Total:</span>
//               <span className="summary-value year">
//                 {formatCurrency(
//                   (data.summary_stats.total_pf || 0) +
//                     Number(data.summary_stats.total_esi)
//                 )}
//               </span>
//             </div>
//             <div className="summary-item">
//               <span className="summary-label">Total Submissions:</span>
//               <span className="summary-value year">
//                 {data.summary_stats.pf_submissions +
//                   data.summary_stats.esi_submissions}
//               </span>
//             </div>
//           </div>
//         </div>
//       </div>

//       <div className="tabs-container">
//         <nav className="tabs-nav">
//           <button
//             onClick={() => setActiveTab("overview")}
//             className={`tab-button ${activeTab === "overview" ? "active" : ""}`}
//           >
//             Monthly Overview
//           </button>
//           <button
//             onClick={() => setActiveTab("submissions")}
//             className={`tab-button ${
//               activeTab === "submissions" ? "active" : ""
//             }`}
//           >
//             Submissions Timeline
//           </button>
//           <button
//             onClick={() => setActiveTab("delayed")}
//             className={`tab-button ${activeTab === "delayed" ? "active" : ""}`}
//           >
//             Delayed Submissions
//           </button>
//         </nav>
//       </div>

//       <div className="dashboard-content">
//         {activeTab === "overview" && (
//           <div className="panel">
//             <h2 className="panel-title">Monthly Remittance Amounts</h2>
//             <div className="chart-container">
//               <ResponsiveContainer width="100%" height="100%">
//                 <BarChart data={monthlyData}>
//                   <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
//                   <XAxis dataKey="month" tick={{ fill: "#6b7280" }} />
//                   <YAxis tick={{ fill: "#6b7280" }} />
//                   <Tooltip
//                     formatter={(value) => [
//                       formatCurrency(Number(value)),
//                       "Amount",
//                     ]}
//                     labelFormatter={(month) => `${month} ${data.year}`}
//                     contentStyle={{
//                       backgroundColor: "rgba(255, 255, 255, 0.9)",
//                       border: "1px solid #e5e7eb",
//                       borderRadius: "0.375rem",
//                       boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
//                     }}
//                   />
//                   <Legend wrapperStyle={{ paddingTop: "10px" }} />
//                   <Bar
//                     dataKey="PF"
//                     name="PF"
//                     fill="#8884d8"
//                     radius={[4, 4, 0, 0]}
//                     isAnimationActive={true}
//                   />
//                   <Bar
//                     dataKey="ESI"
//                     name="ESI"
//                     fill="#82ca9d"
//                     radius={[4, 4, 0, 0]}
//                     isAnimationActive={true}
//                   />
//                 </BarChart>
//               </ResponsiveContainer>
//             </div>
//           </div>
//         )}

//         {activeTab === "submissions" && (
//           <div className="panel">
//             <SubmissionTimeline year={data.year}/>
//           </div>
//         )}

//         {activeTab === "delayed" && (
//           <div className="panel">
//             <h2 className="panel-title">
//               Delayed Submissions - All Months {data.year}
//             </h2>
//             <div className="delayed-grid">
//               <div className="delayed-card">
//                 <h3 className="delayed-title pf">Delayed PF Submissions</h3>
//                 {allDelayedData.pf.length > 0 ? (
//                   <div className="delayed-chart">
//                     <ResponsiveContainer width="100%" height="100%">
//                       <ScatterChart
//                         margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
//                       >
//                         <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
//                         <XAxis
//                           type="number"
//                           dataKey="delay_days"
//                           name="Delay (days)"
//                           label={{
//                             value: "Days Delayed",
//                             position: "insideBottom",
//                             offset: -5,
//                             fill: "#6b7280",
//                           }}
//                           tick={{ fill: "#6b7280" }}
//                         />
//                         <YAxis
//                           type="number"
//                           dataKey="amount"
//                           name="Amount"
//                           tick={{ fill: "#6b7280" }}
//                         />
//                         <Tooltip
//                           formatter={(value, name) => [
//                             name === "Amount"
//                               ? formatCurrency(Number(value))
//                               : value,
//                             name,
//                           ]}
//                           contentStyle={{
//                             backgroundColor: "rgba(255, 255, 255, 0.9)",
//                             border: "1px solid #e5e7eb",
//                             borderRadius: "0.375rem",
//                             boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
//                           }}
//                         />
//                         <Scatter
//                           name="PF Delayed"
//                           data={allDelayedData.pf}
//                           fill="#8884d8"
//                           shape="circle"
//                         >
//                           {allDelayedData.pf.map((entry, index) => (
//                             <Cell
//                               key={`cell-${index}`}
//                               fill={COLORS[index % COLORS.length]}
//                             />
//                           ))}
//                         </Scatter>
//                       </ScatterChart>
//                     </ResponsiveContainer>
//                   </div>
//                 ) : (
//                   <div className="no-data">
//                     <p className="no-data-message">
//                       No delayed PF submissions for {data.year}
//                     </p>
//                     <p className="no-data-success">
//                       All PF submissions were on time!
//                     </p>
//                   </div>
//                 )}
//               </div>

//               <div className="delayed-card">
//                 <h3 className="delayed-title esi">Delayed ESI Submissions</h3>
//                 {allDelayedData.esi.length > 0 ? (
//                   <div className="delayed-chart">
//                     <ResponsiveContainer width="100%" height="100%">
//                       <ScatterChart
//                         margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
//                       >
//                         <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
//                         <XAxis
//                           type="number"
//                           dataKey="delay_days"
//                           name="Delay (days)"
//                           label={{
//                             value: "Days Delayed",
//                             position: "insideBottom",
//                             offset: -5,
//                             fill: "#6b7280",
//                           }}
//                           tick={{ fill: "#6b7280" }}
//                         />
//                         <YAxis
//                           type="number"
//                           dataKey="amount"
//                           name="Amount"
//                           tick={{ fill: "#6b7280" }}
//                         />
//                         <Tooltip
//                           formatter={(value, name) => [
//                             name === "Amount"
//                               ? formatCurrency(Number(value))
//                               : value,
//                             name,
//                           ]}
//                           contentStyle={{
//                             backgroundColor: "rgba(255, 255, 255, 0.9)",
//                             border: "1px solid #e5e7eb",
//                             borderRadius: "0.375rem",
//                             boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
//                           }}
//                         />
//                         <Scatter
//                           name="ESI Delayed"
//                           data={allDelayedData.esi}
//                           fill="#82ca9d"
//                           shape="circle"
//                         >
//                           {allDelayedData.esi.map((entry, index) => (
//                             <Cell
//                               key={`cell-${index}`}
//                               fill={COLORS[index % COLORS.length]}
//                             />
//                           ))}
//                         </Scatter>
//                       </ScatterChart>
//                     </ResponsiveContainer>
//                   </div>
//                 ) : (
//                   <div className="no-data">
//                     <p className="no-data-message">
//                       No delayed ESI submissions for {data.year}
//                     </p>
//                     <p className="no-data-success">
//                       All ESI submissions were on time!
//                     </p>
//                   </div>
//                 )}
//               </div>
//             </div>
//           </div>
//         )}
//       </div>

//       <div className="dashboard-footer">
//         <p className="footer-text">
//           Data last updated: {new Date().toLocaleDateString()}
//         </p>
//       </div>
//     </div>
//   );
// }
import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell
} from 'recharts';
import api from '../services/api'; // Assuming this is your API client
import SubmissionTimeline from './SubmissionTimeline';
// Interfaces
interface SubmissionPoint {
  x: number;
  y: number;
  r?: number;
}

interface DelayedSubmission {
  delay_days: number;
  amount: number;
}

interface MonthlyAmountData {
  labels: string[];
  datasets: {
    PF: number[];
    ESI: number[];
  };
}

interface SubmissionData {
  labels: string[];
  points: SubmissionPoint[][];
}

interface DelayedData {
  labels: string[];
  datasets: {
    PF: DelayedSubmission[][];
    ESI: DelayedSubmission[][];
  };
}

interface SummaryStats {
  total_pf: number | string;
  total_esi: number | string;
  pf_submissions: number;
  esi_submissions: number;
  on_time_rate: number;
  avg_pf: number | string;
  avg_esi: number | string;
}

// Response interfaces for each endpoint
interface MonthlyAmountResponse {
  labels: string[];
  datasets: {
    PF: number[];
    ESI: number[];
  };
}

interface SummaryStatsResponse {
  summary_stats: SummaryStats;
  monthly_amounts: MonthlyAmountData;
  year: number;
}

interface SubmissionsDataResponse {
  pf_submissions: SubmissionData;
  esi_submissions: SubmissionData;
  delayed_submissions: DelayedData;
  year: number;
}

// Main component props
interface SubmissionTimelineProps {
  year: number;
}



const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

export default function RemittanceDashboard() {
  // State management
  const [monthlyAmountData, setMonthlyAmountData] = useState<MonthlyAmountData | null>(null);
  const [submissionsData, setSubmissionsData] = useState<SubmissionsDataResponse | null>(null);
  const [summaryStats, setSummaryStats] = useState<SummaryStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(-1);
  const [activeTab, setActiveTab] = useState<"overview" | "submissions" | "delayed">("overview");

  // Fetch data from separate endpoints
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch data from all three endpoints in parallel
        const [yearlySummaryResponse,monthlyAmountsResponse,  submissionsDataResponse] = await Promise.all([
          api.get(`/dashboard/yearly_summary?year=${selectedYear}`),
          api.get(`/dashboard/monthly_amounts?year=${selectedYear}`),
          api.get(`/dashboard/submissions_data?year=${selectedYear}`)
        ]);

        // Process and set the data
        setSummaryStats(yearlySummaryResponse.data);
        setMonthlyAmountData(monthlyAmountsResponse.data);
        
        setSubmissionsData(submissionsDataResponse.data);
        
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedYear, selectedMonth]);

  // Loading state
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-text">Loading dashboard data...</div>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="error-container">
        <p className="error-title">Error</p>
        <p>{error}</p>
      </div>
    );
  }

  // No data state
  if (!monthlyAmountData || !summaryStats || !submissionsData) {
    return (
      <div className="no-data">
        <p className="no-data-message">No remittance data available.</p>
      </div>
    );
  }

  // Prepare data for charts (uses all months)
  const monthlyData = monthlyAmountData.labels.map((month, i) => ({
    month,
    PF: monthlyAmountData.datasets.PF[i],
    ESI: monthlyAmountData.datasets.ESI[i],
  }));

  // Combine all submission points across months
  const allSubmissionData = {
    pf: submissionsData.pf_submissions.points.flat(),
    esi: submissionsData.esi_submissions.points.flat(),
  };

  // Combine all delayed submissions across months
  const allDelayedData = {
    pf: submissionsData.delayed_submissions.datasets.PF.flat(),
    esi: submissionsData.delayed_submissions.datasets.ESI.flat(),
  };

  // Get current month data for summary cards only
  const currentMonthData =
    selectedMonth !== -1
      ? {
          pfAmount: summaryStats.monthly_amounts.datasets.PF[selectedMonth],
          esiAmount: summaryStats.monthly_amounts.datasets.ESI[selectedMonth],
          monthName: summaryStats.monthly_amounts.labels[selectedMonth],
        }
      : null;

  // Helper function for currency formatting
  const formatCurrency = (value: number | null | string) => {
    if (value === null || value === undefined) return "₹0";
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    return numValue.toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    });
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Remittance Dashboard {summaryStats.year}</h1>

        <div className="filters-container">
          <div className="filter-group">
            <label className="filter-label">Year:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="filter-select"
              aria-label="year"
            >
              {[selectedYear - 1, selectedYear, selectedYear + 1, selectedYear + 2].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label"> Month:</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="filter-select"
              aria-label="month"
            >
              <option value={-1}>All Months</option>
              {monthlyAmountData.labels.map((month, index) => (
                <option key={index} value={index}>
                  {month}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="summary-cards">
          {/* PF Summary Card - affected by month filter */}
          <div className="summary-card pf">
            <h3 className="summary-title pf">
              {selectedMonth === -1
                ? "PF Remittance (Year)"
                : `PF Remittance (${currentMonthData?.monthName})`}
            </h3>
            <div className="summary-item">
              <span className="summary-label">Total:</span>
              <span className="summary-value pf">
                {selectedMonth === -1
                  ? formatCurrency(summaryStats.summary_stats.total_pf)
                  : formatCurrency(currentMonthData?.pfAmount ?? 0)}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Avg:</span>
              <span className="summary-value pf">
                {formatCurrency(summaryStats.summary_stats.avg_pf)}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Submissions:</span>
              <span className="summary-value pf">
                {summaryStats.summary_stats.pf_submissions}
              </span>
            </div>
          </div>

          {/* ESI Summary Card - affected by month filter */}
          <div className="summary-card esi">
            <h3 className="summary-title esi">
              {selectedMonth === -1
                ? "ESI Remittance (Year)"
                : `ESI Remittance (${currentMonthData?.monthName})`}
            </h3>
            <div className="summary-item">
              <span className="summary-label">Total:</span>
              <span className="summary-value esi">
                {selectedMonth === -1
                  ? formatCurrency(summaryStats.summary_stats.total_esi)
                  : formatCurrency(currentMonthData?.esiAmount ?? 0)}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Avg:</span>
              <span className="summary-value esi">
                {formatCurrency(summaryStats.summary_stats.avg_esi)}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Submissions:</span>
              <span className="summary-value esi">
                {summaryStats.summary_stats.esi_submissions}
              </span>
            </div>
          </div>

          {/* Performance Card */}
          <div className="summary-card performance">
            <h3 className="summary-title performance">Performance</h3>
            <div className="summary-item">
              <span className="summary-label">On-Time Rate:</span>
              <div>
                <div className="summary-value performance">
                  {(summaryStats.summary_stats.on_time_rate * 100).toFixed(1)}%
                </div>
                <div className="progress-container">
                  <div
                    className="progress-bar"
                    style={{
                      width: `${summaryStats.summary_stats.on_time_rate * 100}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Year Summary Card - always shows yearly data */}
          <div className="summary-card year">
            <h3 className="summary-title year">Year Summary</h3>
            <div className="summary-item">
              <span className="summary-label">Total:</span>
              <span className="summary-value year">
                {formatCurrency(
                  parseFloat(String(summaryStats?.summary_stats.total_pf || 0)) +
                    parseFloat(String(summaryStats?.summary_stats.total_esi || 0))
                )}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Submissions:</span>
              <span className="summary-value year">
                {(summaryStats?.summary_stats.pf_submissions  || 0)+
                  (summaryStats?.summary_stats.esi_submissions || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="tabs-container">
        <nav className="tabs-nav">
          <button
            onClick={() => setActiveTab("overview")}
            className={`tab-button ${activeTab === "overview" ? "active" : ""}`}
          >
            Monthly Overview
          </button>
          <button
            onClick={() => setActiveTab("submissions")}
            className={`tab-button ${
              activeTab === "submissions" ? "active" : ""
            }`}
          >
            Submissions Timeline
          </button>
          <button
            onClick={() => setActiveTab("delayed")}
            className={`tab-button ${activeTab === "delayed" ? "active" : ""}`}
          >
            Delayed Submissions
          </button>
        </nav>
      </div>

      <div className="dashboard-content">
        {activeTab === "overview" && (
          <div className="panel">
            <h2 className="panel-title">Monthly Remittance Amounts</h2>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fill: "#6b7280" }} />
                  <YAxis tick={{ fill: "#6b7280" }} />
                  <Tooltip
                    formatter={(value) => [
                      formatCurrency(Number(value)),
                      "Amount",
                    ]}
                    labelFormatter={(month) => `${month} ${summaryStats.year}`}
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.9)",
                      border: "1px solid #e5e7eb",
                      borderRadius: "0.375rem",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: "10px" }} />
                  <Bar
                    dataKey="PF"
                    name="PF"
                    fill="#8884d8"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={true}
                  />
                  <Bar
                    dataKey="ESI"
                    name="ESI"
                    fill="#82ca9d"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={true}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === "submissions" && (
          <div className="panel">
            <SubmissionTimeline year={selectedYear} />
          </div>
        )}

        {activeTab === "delayed" && (
          <div className="panel">
            <h2 className="panel-title">
              Delayed Submissions - All Months {submissionsData.year}
            </h2>
            <div className="delayed-grid">
              <div className="delayed-card">
                <h3 className="delayed-title pf">Delayed PF Submissions</h3>
                {allDelayedData.pf.length > 0 ? (
                  <div className="delayed-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart
                        margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          type="number"
                          dataKey="delay_days"
                          name="Delay (days)"
                          label={{
                            value: "Days Delayed",
                            position: "insideBottom",
                            offset: -5,
                            fill: "#6b7280",
                          }}
                          tick={{ fill: "#6b7280" }}
                        />
                        <YAxis
                          type="number"
                          dataKey="amount"
                          name="Amount"
                          tick={{ fill: "#6b7280" }}
                        />
                        <Tooltip
                          formatter={(value, name) => [
                            name === "Amount"
                              ? formatCurrency(Number(value))
                              : value,
                            name,
                          ]}
                          contentStyle={{
                            backgroundColor: "rgba(255, 255, 255, 0.9)",
                            border: "1px solid #e5e7eb",
                            borderRadius: "0.375rem",
                            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                          }}
                        />
                        <Scatter
                          name="PF Delayed"
                          data={allDelayedData.pf}
                          fill="#8884d8"
                          shape="circle"
                        >
                          {allDelayedData.pf.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="no-data">
                    <p className="no-data-message">
                      No delayed PF submissions for {submissionsData.year}
                    </p>
                    <p className="no-data-success">
                      All PF submissions were on time!
                    </p>
                  </div>
                )}
              </div>

              <div className="delayed-card">
                <h3 className="delayed-title esi">Delayed ESI Submissions</h3>
                {allDelayedData.esi.length > 0 ? (
                  <div className="delayed-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart
                        margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          type="number"
                          dataKey="delay_days"
                          name="Delay (days)"
                          label={{
                            value: "Days Delayed",
                            position: "insideBottom",
                            offset: -5,
                            fill: "#6b7280",
                          }}
                          tick={{ fill: "#6b7280" }}
                        />
                        <YAxis
                          type="number"
                          dataKey="amount"
                          name="Amount"
                          tick={{ fill: "#6b7280" }}
                        />
                        <Tooltip
                          formatter={(value, name) => [
                            name === "Amount"
                              ? formatCurrency(Number(value))
                              : value,
                            name,
                          ]}
                          contentStyle={{
                            backgroundColor: "rgba(255, 255, 255, 0.9)",
                            border: "1px solid #e5e7eb",
                            borderRadius: "0.375rem",
                            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                          }}
                        />
                        <Scatter
                          name="ESI Delayed"
                          data={allDelayedData.esi}
                          fill="#82ca9d"
                          shape="circle"
                        >
                          {allDelayedData.esi.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="no-data">
                    <p className="no-data-message">
                      No delayed ESI submissions for {submissionsData.year}
                    </p>
                    <p className="no-data-success">
                      All ESI submissions were on time!
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="dashboard-footer">
        <p className="footer-text">
          Data last updated: {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}