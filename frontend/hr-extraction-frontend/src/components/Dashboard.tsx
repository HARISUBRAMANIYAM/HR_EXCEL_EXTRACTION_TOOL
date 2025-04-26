import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../services/api";
import SubmissionTimeline from "./SubmissionTimeline";

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
  total_pf: number | null;
  total_esi: number | string;
  pf_submissions: number;
  esi_submissions: number;
  on_time_rate: number;
  avg_pf: number | string;
  avg_esi: number | string;
}

interface DashboardData {
  monthly_amounts: MonthlyAmountData;
  pf_submissions: SubmissionData;
  esi_submissions: SubmissionData;
  delayed_submissions: DelayedData;
  summary_stats: SummaryStats;
  year: number;
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

export default function RemittanceDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(-1);
  const [activeTab, setActiveTab] = useState<
    "overview" | "submissions" | "delayed"
  >("overview");

  const dummyData: DashboardData = {
    year: 2023,
    monthly_amounts: {
      labels: [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ],
      datasets: {
        PF: [
          25000, 28000, 32000, 30000, 35000, 38000, 40000, 42000, 45000, 48000,
          50000, 52000,
        ],
        ESI: [
          18000, 20000, 22000, 21000, 23000, 25000, 27000, 29000, 31000, 33000,
          35000, 37000,
        ],
      },
    },
    pf_submissions: {
      labels: [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ],
      points: [
        [
          { x: 5, y: 25000, r: 5 },
          { x: 10, y: 28000, r: 5 },
        ], // Jan
        [{ x: 7, y: 28000, r: 5 }], // Feb
        [
          { x: 3, y: 32000, r: 5 },
          { x: 12, y: 30000, r: 5 },
        ], // Mar
        [
          { x: 8, y: 30000, r: 5 },
          { x: 15, y: 35000, r: 5 },
        ], // Apr
        [{ x: 5, y: 35000, r: 5 }], // May
        [
          { x: 10, y: 38000, r: 5 },
          { x: 20, y: 40000, r: 5 },
        ], // Jun
        [{ x: 7, y: 40000, r: 5 }], // Jul
        [{ x: 12, y: 42000, r: 5 }], // Aug
        [
          { x: 5, y: 45000, r: 5 },
          { x: 18, y: 48000, r: 5 },
        ], // Sep
        [{ x: 10, y: 48000, r: 5 }], // Oct
        [{ x: 8, y: 50000, r: 5 }], // Nov
        [{ x: 15, y: 52000, r: 5 }], // Dec
      ],
    },
    esi_submissions: {
      labels: [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ],
      points: [
        [{ x: 5, y: 18000, r: 5 }], // Jan
        [{ x: 10, y: 20000, r: 5 }], // Feb
        [{ x: 7, y: 22000, r: 5 }], // Mar
        [{ x: 12, y: 21000, r: 5 }], // Apr
        [{ x: 5, y: 23000, r: 5 }], // May
        [{ x: 10, y: 25000, r: 5 }], // Jun
        [{ x: 8, y: 27000, r: 5 }], // Jul
        [{ x: 15, y: 29000, r: 5 }], // Aug
        [{ x: 5, y: 31000, r: 5 }], // Sep
        [{ x: 10, y: 33000, r: 5 }], // Oct
        [{ x: 7, y: 35000, r: 5 }], // Nov
        [{ x: 12, y: 37000, r: 5 }], // Dec
      ],
    },
    delayed_submissions: {
      labels: [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ],
      datasets: {
        PF: [
          [{ delay_days: 5, amount: 25000 }], // Jan
          [], // Feb
          [
            { delay_days: 3, amount: 32000 },
            { delay_days: 10, amount: 30000 },
          ], // Mar
          [], // Apr
          [{ delay_days: 7, amount: 35000 }], // May
          [], // Jun
          [{ delay_days: 5, amount: 40000 }], // Jul
          [], // Aug
          [{ delay_days: 8, amount: 45000 }], // Sep
          [], // Oct
          [{ delay_days: 10, amount: 50000 }], // Nov
          [], // Dec
        ],
        ESI: [
          [], // Jan
          [{ delay_days: 5, amount: 20000 }], // Feb
          [], // Mar
          [{ delay_days: 7, amount: 21000 }], // Apr
          [], // May
          [{ delay_days: 8, amount: 25000 }], // Jun
          [], // Jul
          [{ delay_days: 10, amount: 29000 }], // Aug
          [], // Sep
          [{ delay_days: 5, amount: 33000 }], // Oct
          [], // Nov
          [{ delay_days: 7, amount: 37000 }], // Dec
        ],
      },
    },
    summary_stats: {
      total_pf: 450000,
      total_esi: 300000,
      pf_submissions: 15,
      esi_submissions: 12,
      on_time_rate: 0.85,
      avg_pf: 37500,
      avg_esi: 25000,
    },
  };
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await api.get(
          `/dashboard/remittance_stats_viz?year=${selectedYear}`
        );

        const processedData = {
          ...response.data,
          summary_stats: {
            ...response.data.summary_stats,
            total_pf:
              response.data.summary_stats.total_pf === "None"
                ? null
                : Number(response.data.summary_stats.total_pf),
            total_esi: Number(response.data.summary_stats.total_esi),
            avg_pf: Number(response.data.summary_stats.avg_pf),
            avg_esi: Number(response.data.summary_stats.avg_esi),
          },
        };

        setData(processedData);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedYear]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-text">Loading dashboard data...</div>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p className="error-title">Error</p>
        <p>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="no-data">
        <p className="no-data-message">No remittance data available.</p>
      </div>
    );
  }

  // Prepare data for charts (uses all months)
  const monthlyData = data.monthly_amounts.labels.map((month, i) => ({
    month,
    PF: data.monthly_amounts.datasets.PF[i],
    ESI: data.monthly_amounts.datasets.ESI[i],
  }));

  // Combine all submission points across months
  const allSubmissionData = {
    pf: data.pf_submissions.points.flat(),
    esi: data.esi_submissions.points.flat(),
  };

  // Combine all delayed submissions across months
  const allDelayedData = {
    pf: data.delayed_submissions.datasets.PF.flat(),
    esi: data.delayed_submissions.datasets.ESI.flat(),
  };

  // Get current month data for summary cards only
  const currentMonthData =
    selectedMonth !== -1
      ? {
          pfAmount: data.monthly_amounts.datasets.PF[selectedMonth],
          esiAmount: data.monthly_amounts.datasets.ESI[selectedMonth],
          monthName: data.monthly_amounts.labels[selectedMonth],
        }
      : null;

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
        <h1 className="dashboard-title">Remittance Dashboard {data.year}</h1>

        <div className="filters-container">
          <div className="filter-group">
            <label className="filter-label">Year:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="filter-select"
              aria-label="year"
            >
              {[data.year - 1, data.year, data.year + 2].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Month (for cards):</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="filter-select"
              aria-label="month"
            >
              <option value={-1}>All Months</option>
              {data.monthly_amounts.labels.map((month, index) => (
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
                  ? formatCurrency(data.summary_stats.total_pf)
                  : formatCurrency(currentMonthData?.pfAmount ?? 0)}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Avg:</span>
              <span className="summary-value pf">
                {formatCurrency(data.summary_stats.avg_pf)}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Submissions:</span>
              <span className="summary-value pf">
                {data.summary_stats.pf_submissions}
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
                  ? formatCurrency(data.summary_stats.total_esi)
                  : formatCurrency(currentMonthData?.esiAmount ?? 0)}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Avg:</span>
              <span className="summary-value esi">
                {formatCurrency(data.summary_stats.avg_esi)}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Submissions:</span>
              <span className="summary-value esi">
                {data.summary_stats.esi_submissions}
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
                  {(data.summary_stats.on_time_rate * 100).toFixed(1)}%
                </div>
                <div className="progress-container">
                  <div
                    className="progress-bar"
                    style={{
                      width: `${data.summary_stats.on_time_rate * 100}%`,
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
                  (data.summary_stats.total_pf || 0) +
                    Number(data.summary_stats.total_esi)
                )}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Submissions:</span>
              <span className="summary-value year">
                {data.summary_stats.pf_submissions +
                  data.summary_stats.esi_submissions}
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
                    labelFormatter={(month) => `${month} ${data.year}`}
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
                  />
                  <Bar
                    dataKey="ESI"
                    name="ESI"
                    fill="#82ca9d"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === "submissions" && (
          <div className="panel">
            <SubmissionTimeline year={data.year} />
          </div>
        )}

        {activeTab === "delayed" && (
          <div className="panel">
            <h2 className="panel-title">
              Delayed Submissions - All Months {data.year}
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
                      No delayed PF submissions for {data.year}
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
                      No delayed ESI submissions for {data.year}
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
