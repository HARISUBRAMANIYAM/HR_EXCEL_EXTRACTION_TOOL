import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../services/api";

const monthToNumber: Record<string, number> = {
  January: 1,
  February: 2,
  March: 3,
  April: 4,
  May: 5,
  June: 6,
  July: 7,
  August: 8,
  September: 9,
  October: 10,
  November: 11,
  December: 12,
};
const data = {
  "esi": [
    {"month": "January", "day": "15"},
    {"month": "February", "day": "12"},
    {"month": "March", "day": "10"},
    {"month": "April", "day": "18"},
    {"month": "May", "day": "22"},
    {"month": "June", "day": "14"},
    {"month": "July", "day": "17"},
    {"month": "August", "day": "19"},
    {"month": "September", "day": "13"},
    {"month": "October", "day": "16"},
    {"month": "November", "day": "20"},
    {"month": "December", "day": "15"}
  ],
  "pf": [
    {"month": "January", "day": "20"},
    {"month": "February", "day": "18"},
    {"month": "March", "day": "15"},
    {"month": "April", "day": "22"},
    {"month": "May", "day": "25"},
    {"month": "June", "day": "18"},
    {"month": "July", "day": "20"},
    {"month": "August", "day": "22"},
    {"month": "September", "day": "17"},
    {"month": "October", "day": "19"},
    {"month": "November", "day": "24"},
    {"month": "December", "day": "20"}
  ]
}

const allMonthsList = Object.keys(monthToNumber);

export default function SubmissionTimeline({ year }: any) {
  const [view, setView] = useState("pf");
  const [esiSubmissionData, setEsiSubmissionData] = useState<any[]>([]);
  const [pfSubmissionData, setPfSubmissionData] = useState<any[]>([]);

  useEffect(() => {
    api
      .get("/uploads/by-year-days/", {
        params: {
          year: Number(year),
        },
      })
      .then((res) => {
        //const { esi, pf } = res.data;

        const mapData = (data: any[]) =>
          data.map((item) => ({
            x: monthToNumber[item.month],
            y: parseInt(item.day),
            month: item.month,
            day: item.day,
          }))
          .sort((a, b) => a.x - b.x || a.y - b.y);

        setEsiSubmissionData(mapData(data.esi));
        setPfSubmissionData(mapData(data.pf));
      })
      .catch((err) => console.error("Error fetching submission data:", err));
  }, [year]);

  const renderChart = (data: any[], label: string, color: string) => (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart margin={{ top: 20, right: 30, bottom: 20, left: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          type="number"
          dataKey="x"
          name="Month"
          domain={[1, 12]}
          ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]} // Force all months to be shown
          tickFormatter={(value) =>
            Object.keys(monthToNumber).find(
              (key) => monthToNumber[key] === value
            ) ?? String(value)
          }
          label={{ value: "Month", position: "insideBottom", offset: -5 }}
          tick={{ fontSize: 12 }}
          allowDecimals={false}
        />
        <YAxis
          type="number"
          dataKey="y"
          domain={[1, 31]}
          ticks={Array.from({ length: 31 }, (_, i) => i + 1)} // Show all dates from 1-31
          label={{
            value: "Date",
            angle: -90,
            position: "insideLeft",
          }}
          tick={{ fontSize: 12 }}
          allowDecimals={false}
        />
        <Tooltip
          formatter={(value: any, name: string, props: any) => {
            if (name === "y") {
              const entry = props.payload;
              return [`${entry.day} ${entry.month}`, "Date"];
            }
            return [value, name === "x" ? "Month" : name];
          }}
        />
        <Legend />
        <Line
          name={label}
          data={data}
          type="linear" // Changed from "stepAfter" to "linear" for straight lines
          dataKey="y"
          stroke={color}
          dot={{ fill: color, r: 5 }}
          connectNulls
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );

  return (
    <div className="submission-timeline">
      <h2 className="timeline-title">Submission Timeline - {year}</h2>
      <div className="view-button">
        {["pf", "esi"].map((type) => (
          <button
            key={type}
            onClick={() => setView(type)}
            className={`view-button ${view === type ? "active" : ""}`}
          >
            {type.toUpperCase()}
          </button>
        ))}
      </div>

      {(  view === "pf") && (
        <div>
          <h3 className="section-heading pf">PF Submissions Timeline</h3>
          {pfSubmissionData.length > 0 ? (
            renderChart(pfSubmissionData, "PF Submission", "#8884d8")
          ) : (
            <p>No PF submission data available</p>
          )}
        </div>
      )}

      {(  view === "esi") && (
        <div>
          <h3 className="section-heading esi">ESI Submissions Timeline</h3>
          {esiSubmissionData.length > 0 ? (
            renderChart(esiSubmissionData, "ESI Submission", "#82ca9d")
          ) : (
            <p>No ESI submission data available</p>
          )}
        </div>
      )}
    </div>
  );
}