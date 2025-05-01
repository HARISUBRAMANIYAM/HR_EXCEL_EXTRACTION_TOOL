import React, { useEffect, useState } from "react";
import {
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../services/api";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

interface DelayDataPoint {
  delay_days: number;
  amount: number;
}

interface DelayedData {
  labels: string[];
  datasets: {
    PF: DelayDataPoint[][];
    ESI: DelayDataPoint[][];
  };
}

interface DelayedSubmissionsChartProps {
  currentYear: number;
}

const DelayedSubmissionsChart: React.FC<DelayedSubmissionsChartProps> = ({
  currentYear,
}) => {
  const [data, setData] = useState<DelayedData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDelayedData = async () => {
      try {
        setLoading(true);
        // Fetch delayed submission data from the new endpoint
        const response = await api.get(
          `/dashboard/delayed-submissions?year=${currentYear}`
        );
        setData(response.data);
        setError(null);
      } catch (err: any) {
        setError(err.message || "Failed to fetch delayed submissions data");
      } finally {
        setLoading(false);
      }
    };

    fetchDelayedData();
  }, [currentYear]);

  if (loading) {
    return <div className="loading">Loading delayed submission data...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!data) {
    return (
      <div className="no-data">No delayed submissions data available.</div>
    );
  }

  // Flatten the monthly datasets so they can be rendered in one chart per submission type.
  const allDelayedDataPF = data.datasets.PF.flat();
  const allDelayedDataESI = data.datasets.ESI.flat();

  return (
    <div className="delayed-submissions-chart">
      <h2>Delayed PF Submissions</h2>
      {allDelayedDataPF.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
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
                name === "amount"
                  ? Number(value).toLocaleString("en-IN", {
                      style: "currency",
                      currency: "INR",
                      maximumFractionDigits: 0,
                    })
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
            <Scatter name="PF Delayed" data={allDelayedDataPF} fill="#8884d8">
              {allDelayedDataPF.map((entry, index) => (
                <Cell
                  key={`pf-cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      ) : (
        <div className="no-data">
          <p>No delayed PF submissions for {currentYear}</p>
          <p>All PF submissions were on time!</p>
        </div>
      )}

      <h2>Delayed ESI Submissions</h2>
      {allDelayedDataESI.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
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
                name === "amount"
                  ? Number(value).toLocaleString("en-IN", {
                      style: "currency",
                      currency: "INR",
                      maximumFractionDigits: 0,
                    })
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
            <Scatter name="ESI Delayed" data={allDelayedDataESI} fill="#82ca9d">
              {allDelayedDataESI.map((entry, index) => (
                <Cell
                  key={`esi-cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      ) : (
        <div className="no-data">
          <p>No delayed ESI submissions for {currentYear}</p>
          <p>All ESI submissions were on time!</p>
        </div>
      )}
    </div>
  );
};

export default DelayedSubmissionsChart;
