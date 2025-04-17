// // src/components/Dashboard.tsx

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
//                 <tr key={file.id} className={file.status}>
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
//       <div className="breakdown">
//         <h3>Breakdown</h3>
//         <div className="breakdown-cards">
//           <div className="breakdown-card">
//             <h4>PF Files</h4>
//             <p>Total: {stats.pf_files}</p>
//             <p>Success: {stats.pf_success}</p>
//             <p>Errors: {stats.pf_error}</p>
//           </div>
//           <div className="breakdown-card">
//             <h4>ESI Files</h4>
//             <p>Total: {stats.esi_files}</p>
//             <p>Success: {stats.esi_success}</p>
//             <p>Errors: {stats.esi_error}</p>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default Dashboard;
// src/components/Dashboard.tsx

import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { DashboardStats } from "../types";

const Dashboard: React.FC = () => {
  const { token } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        const response = await fetch("http://localhost:8000/dashboard", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

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
  }, [token]);

  if (loading) {
    return <div className="loading">Loading dashboard data...</div>;
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  if (!stats) {
    return <div>No data available</div>;
  }

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>

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
      </div>

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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Only show breakdown if the data exists */}
      {(stats.pf_files !== undefined || stats.esi_files !== undefined) && (
        <div className="breakdown">
          <h3>Breakdown</h3>
          <div className="breakdown-cards">
            {stats.pf_files !== undefined && (
              <div className="breakdown-card">
                <h4>PF Files</h4>
                <p>Total: {stats.pf_files}</p>
                <p>Success: {stats.pf_success}</p>
                <p>Errors: {stats.pf_error}</p>
              </div>
            )}
            {stats.esi_files !== undefined && (
              <div className="breakdown-card">
                <h4>ESI Files</h4>
                <p>Total: {stats.esi_files}</p>
                <p>Success: {stats.esi_success}</p>
                <p>Errors: {stats.esi_error}</p>
              </div>
            )}
            {stats.pf_files === 0 && stats.esi_files === 0 && (
              <div className="empty-state">
                No files processed yet. Upload files to see statistics.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
