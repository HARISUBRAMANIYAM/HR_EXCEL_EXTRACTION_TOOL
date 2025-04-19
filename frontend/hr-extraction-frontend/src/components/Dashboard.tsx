// import React, { useEffect, useState } from "react";
// import { useAuth } from "../context/AuthContext";
// import { DashboardStats } from "../types";

// const Dashboard: React.FC = () => {
//   const { token } = useAuth();
//   const [stats, setStats] = useState<DashboardStats | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");

//   useEffect(() => {
//     const fetchDashboardStats = async () => {
//       try {
//         const response = await fetch("http://localhost:8000/dashboard", {
//           headers: {
//             Authorization: `Bearer ${token}`,
//           },
//         });

//         if (!response.ok) {
//           throw new Error("Failed to fetch dashboard data");
//         }

//         const data = await response.json();
//         setStats(data);
//       } catch (err) {
//         if (err instanceof Error) {
//           setError(err.message);
//         } else {
//           setError("An unexpected error occurred");
//         }
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchDashboardStats();
//   }, [token]);

//   if (loading) {
//     return <div className="loading">Loading dashboard data...</div>;
//   }

//   if (error) {
//     return <div className="error-message">Error: {error}</div>;
//   }

//   if (!stats) {
//     return <div>No data available</div>;
//   }

//   return (
//     <div className="dashboard">
//       <h1>Dashboard</h1>

//       <div className="stats-cards">
//         <div className="stat-card">
//           <h3>Total Files</h3>
//           <p className="stat-number">{stats.total_files}</p>
//         </div>

//         <div className="stat-card success">
//           <h3>Successful Files</h3>
//           <p className="stat-number">{stats.success_files}</p>
//         </div>

//         <div className="stat-card error">
//           <h3>Error Files</h3>
//           <p className="stat-number">{stats.error_files}</p>
//         </div>
//       </div>

//       <div className="recent-files">
//         <h2>Recent Files</h2>
//         {stats.recent_files.length === 0 ? (
//           <p>No recent files found</p>
//         ) : (
//           <table className="files-table">
//             <thead>
//               <tr>
//                 <th>Filename</th>
//                 <th>Status</th>
//                 <th>Date</th>
//               </tr>
//             </thead>
//             <tbody>
//               {stats.recent_files.map((file) => (
//                 <tr
//                   key={`${file.id}-${file.created_at}`}
//                   className={file.status}
//                 >
//                   <td>{file.filename || "N/A"}</td>
//                   <td className={`status ${file.status}`}>
//                     {file.status.charAt(0).toUpperCase() + file.status.slice(1)}
//                   </td>
//                   <td>{new Date(file.created_at).toLocaleString()}</td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         )}
//       </div>

//       {/* Only show breakdown if the data exists */}
//       {(stats.pf_files !== undefined || stats.esi_files !== undefined) && (
//         <div className="breakdown">
//           <h3>Breakdown</h3>
//           <div className="breakdown-cards">
//             {stats.pf_files !== undefined && (
//               <div className="breakdown-card">
//                 <h4>PF Files</h4>
//                 <p>Total: {stats.pf_files}</p>
//                 <p>Success: {stats.pf_success}</p>
//                 <p>Errors: {stats.pf_error}</p>
//               </div>
//             )}
//             {stats.esi_files !== undefined && (
//               <div className="breakdown-card">
//                 <h4>ESI Files</h4>
//                 <p>Total: {stats.esi_files}</p>
//                 <p>Success: {stats.esi_success}</p>
//                 <p>Errors: {stats.esi_error}</p>
//               </div>
//             )}
//             {stats.pf_files === 0 && stats.esi_files === 0 && (
//               <div className="empty-state">
//                 No files processed yet. Upload files to see statistics.
//               </div>
//             )}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default Dashboard;
import React, { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../context/AuthContext";
import { DashboardStats } from "../types";

// Color scheme for charts
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

const Dashboard: React.FC = () => {
  const { token } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [yearFilter, setYearFilter] = useState<number>(
    new Date().getFullYear()
  );

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        const response = await fetch(
          `http://localhost:8000/dashboard?year=${yearFilter}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch dashboard data");
        }

        const data = await response.json();
        setStats(data);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("An unexpected error occurred");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardStats();
  }, [token, yearFilter]);

  if (loading) {
    return <div className="loading">Loading dashboard data...</div>;
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  if (!stats) {
    return <div>No data available</div>;
  }

  // Prepare data for monthly charts
  const monthlyChartData = stats.monthly_stats.labels.map((month, index) => ({
    name: month,
    pfSuccess: stats.monthly_stats.datasets.pf_success[index],
    pfError: stats.monthly_stats.datasets.pf_error[index],
    esiSuccess: stats.monthly_stats.datasets.esi_success[index],
    esiError: stats.monthly_stats.datasets.esi_error[index],
    remittanceSubmitted:
      stats.monthly_stats.datasets.remittance_submitted[index],
  }));

  // Data for pie charts
  const pfStatusData = [
    { name: "Success", value: stats.pf_success },
    { name: "Error", value: stats.pf_error },
  ];

  const esiStatusData = [
    { name: "Success", value: stats.esi_success },
    { name: "Error", value: stats.esi_error },
  ];

  const remittanceData = [
    { name: "Submitted", value: stats.remittance_stats.total_submitted },
    { name: "Pending", value: stats.remittance_stats.pending },
  ];

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <div className="year-filter">
          <label htmlFor="year-select">Year: </label>
          <select
            id="year-select"
            value={yearFilter}
            onChange={(e) => setYearFilter(Number(e.target.value))}
          >
            {[2022, 2023, 2024].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <h3>Total Files</h3>
          <p className="stat-number">{stats.total_files}</p>
        </div>

        <div className="stat-card success">
          <h3>Successful Files</h3>
          <p className="stat-number">{stats.success_files}</p>
        </div>

        <div className="stat-card error">
          <h3>Error Files</h3>
          <p className="stat-number">{stats.error_files}</p>
        </div>

        <div className="stat-card remittance">
          <h3>Remittance Submitted</h3>
          <p className="stat-number">
            {stats.remittance_stats.total_submitted} / {stats.pf_success ?? 0}
          </p>
          <p className="stat-subtext">
            {Math.round(
              (stats.remittance_stats.total_submitted / (stats.pf_success ?? 1)) * 100
            ) || 0}
            % completed
          </p>
        </div>
      </div>

      <div className="chart-row">
        <div className="chart-container">
          <h3>Monthly Processing Stats</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="pfSuccess" fill="#4CAF50" name="PF Success" />
              <Bar dataKey="pfError" fill="#F44336" name="PF Error" />
              <Bar dataKey="esiSuccess" fill="#2196F3" name="ESI Success" />
              <Bar dataKey="esiError" fill="#FF9800" name="ESI Error" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <h3>Remittance Submissions</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="remittanceSubmitted"
                stroke="#8884d8"
                name="Remittance Submitted"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-row">
        <div className="chart-container pie-chart">
          <h3>PF Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pfStatusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
              >
                {pfStatusData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container pie-chart">
          <h3>ESI Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={esiStatusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
              >
                {esiStatusData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container pie-chart">
          <h3>Remittance Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={remittanceData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
              >
                {remittanceData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {stats.user_activity && (
        <div className="user-activity">
          <h2>User Activity</h2>
          <div className="user-cards">
            {stats.user_activity.top_users.map((user, index) => (
              <div key={user.username} className="user-card">
                <h3>
                  #{index + 1} {user.username}
                </h3>
                <p>PF Files: {user.pf_files}</p>
                <p>ESI Files: {user.esi_files}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="recent-files">
        <h2>Recent Files</h2>
        {stats.recent_files.length === 0 ? (
          <p>No recent files found</p>
        ) : (
          <table className="files-table">
            <thead>
              <tr>
                <th>Filename</th>
                <th>Status</th>
                <th>Date</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent_files.map((file) => (
                <tr
                  key={`${file.id}-${file.created_at}`}
                  className={file.status}
                >
                  <td>{file.filename || "N/A"}</td>
                  <td className={`status ${file.status}`}>
                    {file.status.charAt(0).toUpperCase() + file.status.slice(1)}
                  </td>
                  <td>{new Date(file.created_at).toLocaleString()}</td>
                  <td>{file.filepath.includes("pf") ? "PF" : "ESI"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
