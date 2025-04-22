import React, { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Label,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
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
  const monthlyChartData =
    stats.monthly_stats?.labels?.map((month, index) => ({
      name: month,
      pfSuccess: stats.monthly_stats.datasets.pf_success[index] || 0,
      pfError: stats.monthly_stats.datasets.pf_error[index] || 0,
      esiSuccess: stats.monthly_stats.datasets.esi_success[index] || 0,
      esiError: stats.monthly_stats.datasets.esi_error[index] || 0,
      remittanceSubmitted:
        stats.monthly_stats.datasets.remittance_submitted[index] || 0,
    })) || [];

  const processRemittanceData = () => {
    if (!stats.remittance_delays || stats.remittance_delays.length === 0) {
      return [];
    }

    return stats.remittance_delays
      .sort((a, b) => a.days - b.days)
      .reduce((acc: any[], item) => {
        const existing = acc.find((x) => x.days === item.days);
        if (existing) {
          existing[item.type] = (existing[item.type] || 0) + item.count;
        } else {
          const newItem = {
            days: item.days,
            label: `${item.days} days`,
            PF: item.type === "PF" ? item.count : 0,
            ESI: item.type === "ESI" ? item.count : 0,
          };
          acc.push(newItem);
        }
        return acc;
      }, []);
  };

  const remittanceTimelineData = processRemittanceData();
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
            {[2022, 2023, 2024, 2025].map((year) => (
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
              (stats.remittance_stats.total_submitted /
                (stats.pf_success ?? 1)) *
                100
            ) || 0}
            % completed
          </p>
        </div>
      </div>

      {/* Charts in a 3x2 grid layout (3 rows, 2 columns) */}
      <div className="charts-grid">
        {/* First row */}
        <div className="chart-row">
          {/* Monthly Processing Stats */}
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

          {/* Remittance Submissions */}
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

        {/* Second row */}
        <div className="chart-row">
          {/* PF Status Pie Chart */}
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

          {/* ESI Status Pie Chart */}
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
        </div>

        {/* Third row */}
        <div className="chart-row">
          {/* Remittance Status Pie Chart */}
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

          {/* Remittance Submission Timeline */}
          <div className="chart-container">
            <h3>Remittance Submission Timeline</h3>
            {stats.remittance_delays && stats.remittance_delays.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={remittanceTimelineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="days">
                    <Label
                      value="Days After Upload"
                      offset={-5}
                      position="insideBottomRight"
                    />
                  </XAxis>
                  <YAxis>
                    <Label
                      value="Number of Submissions"
                      angle={-90}
                      position="insideLeft"
                    />
                  </YAxis>
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      `${value} submissions`,
                      name === "PF" ? "PF Delays" : "ESI Delays",
                    ]}
                    labelFormatter={(label) => `${label} days after upload`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="PF"
                    stroke="#4CAF50"
                    name="PF Delays"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ESI"
                    stroke="#2196F3"
                    name="ESI Delays"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                  <ReferenceLine x={7} stroke="red" label="1 Week" />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="no-data-message">
                <p>No remittance submissions yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {stats.user_activity && (
        <div className="user-activity">
          <h2>User Activity</h2>
          <div className="user-cards">
            {stats?.user_activity?.top_users?.map((user, index) => (
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
