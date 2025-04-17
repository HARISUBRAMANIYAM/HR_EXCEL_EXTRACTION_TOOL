// import React, { useEffect, useState } from "react";
// import { useNavigate, useParams } from "react-router-dom";
// import { useAuth } from "../context/AuthContext";

// interface Schedule {
//   id: number;
//   user_id: number;
//   name: string;
//   process_type: string;
//   frequency: string;
//   run_time: string;
//   days_of_week: number[] | null;
//   day_of_month: number | null;
//   folder_path: string;
//   is_active: boolean;
//   next_run: string;
//   last_run: string | null;
//   created_at: string;
// }

// const ScheduleView: React.FC = () => {
//   const { id } = useParams();
//   const { token } = useAuth();
//   const navigate = useNavigate();
//   const [schedule, setSchedule] = useState<Schedule | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");

//   useEffect(() => {
//     const fetchSchedule = async () => {
//       try {
//         setLoading(true);
//         const response = await fetch(
//           `http://localhost:8000/api/schedules/${id}`,
//           {
//             headers: {
//               Authorization: `Bearer ${token}`,
//             },
//           }
//         );

//         if (!response.ok) {
//           throw new Error("Failed to fetch schedule");
//         }

//         const data = await response.json();
//         setSchedule(data);
//       } catch (err) {
//         setError(
//           err instanceof Error ? err.message : "Error fetching schedule"
//         );
//         console.error(err);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchSchedule();
//   }, [id, token]);

//   const formatDays = (days: number[] | null) => {
//     if (!days || days.length === 0) return "None";
//     return days
//       .map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d])
//       .join(", ");
//   };

//   if (loading) {
//     return <div className="loading">Loading schedule details...</div>;
//   }

//   if (error) {
//     return <div className="error">{error}</div>;
//   }

//   if (!schedule) {
//     return <div>Schedule not found</div>;
//   }

//   return (
//     <div className="schedule-view">
//       <h2>Schedule Details</h2>

//       <div className="schedule-details">
//         <div className="detail-row">
//           <span className="detail-label">Name:</span>
//           <span className="detail-value">{schedule.name}</span>
//         </div>

//         <div className="detail-row">
//           <span className="detail-label">Process Type:</span>
//           <span className="detail-value">
//             {schedule.process_type.toUpperCase()}
//           </span>
//         </div>

//         <div className="detail-row">
//           <span className="detail-label">Frequency:</span>
//           <span className="detail-value">
//             {schedule.frequency.charAt(0).toUpperCase() +
//               schedule.frequency.slice(1)}
//           </span>
//         </div>

//         {schedule.frequency === "weekly" && (
//           <div className="detail-row">
//             <span className="detail-label">Days of Week:</span>
//             <span className="detail-value">
//               {formatDays(schedule.days_of_week)}
//             </span>
//           </div>
//         )}

//         {schedule.frequency === "monthly" && (
//           <div className="detail-row">
//             <span className="detail-label">Day of Month:</span>
//             <span className="detail-value">{schedule.day_of_month}</span>
//           </div>
//         )}

//         <div className="detail-row">
//           <span className="detail-label">Run Time:</span>
//           <span className="detail-value">{schedule.run_time}</span>
//         </div>

//         <div className="detail-row">
//           <span className="detail-label">Folder Path:</span>
//           <span className="detail-value">{schedule.folder_path}</span>
//         </div>

//         <div className="detail-row">
//           <span className="detail-label">Status:</span>
//           <span
//             className={`status ${schedule.is_active ? "active" : "inactive"}`}
//           >
//             {schedule.is_active ? "Active" : "Inactive"}
//           </span>
//         </div>

//         <div className="detail-row">
//           <span className="detail-label">Next Run:</span>
//           <span className="detail-value">
//             {new Date(schedule.next_run).toLocaleString()}
//           </span>
//         </div>

//         <div className="detail-row">
//           <span className="detail-label">Last Run:</span>
//           <span className="detail-value">
//             {schedule.last_run
//               ? new Date(schedule.last_run).toLocaleString()
//               : "Never"}
//           </span>
//         </div>

//         <div className="detail-row">
//           <span className="detail-label">Created At:</span>
//           <span className="detail-value">
//             {new Date(schedule.created_at).toLocaleString()}
//           </span>
//         </div>
//       </div>

//       <div className="action-buttons">
//         <button onClick={() => navigate(`/schedules`)}>Back to List</button>
//       </div>
//     </div>
//   );
// };

// // export default ScheduleView;

// import React, { useEffect, useState } from "react";
// import { Link, useNavigate } from "react-router-dom";
// import { useAuth } from "../../context/AuthContext";

// interface Schedule {
//   id: number;
//   user_id: number;
//   name: string;
//   process_type: string;
//   frequency: string;
//   run_time: string;
//   days_of_week: number[] | null;
//   day_of_month: number | null;
//   folder_path: string;
//   is_active: boolean;
//   next_run: string;
//   last_run: string | null;
//   created_at: string;
// }

// interface ScheduleStatus {
//   running: boolean;
//   jobs: {
//     id: string;
//     name: string;
//     next_run_time: string;
//     trigger: string;
//   }[];
// }

// const SchedulesList: React.FC = () => {
//   const [schedules, setSchedules] = useState<Schedule[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");
//   const [showDeleteModal, setShowDeleteModal] = useState(false);
//   const [scheduleToDelete, setScheduleToDelete] = useState<number | null>(null);
//   const [schedulerStatus, setSchedulerStatus] = useState<ScheduleStatus | null>(
//     null
//   );
//   const { user, token } = useAuth();
//   const navigate = useNavigate();

//   const confirmDelete = (id: number) => {
//     setScheduleToDelete(id);
//     setShowDeleteModal(true);
//   };

//   const fetchSchedules = async () => {
//     try {
//       setError(""); // Clear previous errors
//       setLoading(true);
//       const response = await fetch("http://localhost:8000/api/schedules", {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json",
//         },
//       });

//       if (response.status === 401) {
//         navigate("/login");
//         return;
//       }

//       if (!response.ok) {
//         throw new Error("Failed to fetch schedules");
//       }

//       const data = await response.json();
//       setSchedules(
//         data.filter((schedule: Schedule) => schedule.user_id === user?.id)
//       );
//     } catch (err) {
//       setError(err instanceof Error ? err.message : "Error fetching schedules");
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const fetchSchedulerStatus = async () => {
//     try {
//       const response = await fetch(
//         "http://localhost:8000/api/schedules/status",
//         {
//           headers: {
//             Authorization: `Bearer ${token}`,
//           },
//         }
//       );

//       if (!response.ok) {
//         throw new Error("Failed to fetch scheduler status");
//       }

//       const data = await response.json();
//       setSchedulerStatus(data);
//     } catch (err) {
//       console.error("Error fetching scheduler status:", err);
//     }
//   };

//   const handleToggleSchedule = async (id: number) => {
//     try {
//       const response = await fetch(
//         `http://localhost:8000/api/schedules/${id}/toggle`,
//         {
//           method: "PATCH",
//           headers: {
//             Authorization: `Bearer ${token}`,
//           },
//         }
//       );

//       if (!response.ok) {
//         throw new Error("Failed to toggle schedule");
//       }

//       fetchSchedules();
//       fetchSchedulerStatus();
//     } catch (err) {
//       setError("Error toggling schedule status");
//       console.error(err);
//     }
//   };

//   const handleDeleteSchedule = async () => {
//     if (!scheduleToDelete) return;

//     try {
//       setError(""); // Clear previous errors
//       const response = await fetch(
//         `http://localhost:8000/api/schedules/${scheduleToDelete}`,
//         {
//           method: "DELETE",
//           headers: {
//             Authorization: `Bearer ${token}`,
//           },
//         }
//       );

//       if (!response.ok) {
//         throw new Error("Failed to delete schedule");
//       }

//       fetchSchedules();
//       fetchSchedulerStatus();
//     } catch (err) {
//       setError("Error deleting schedule");
//       console.error(err);
//     } finally {
//       setShowDeleteModal(false);
//       setScheduleToDelete(null);
//     }
//   };

//   const formatSchedule = (schedule: Schedule) => {
//     switch (schedule.frequency) {
//       case "daily":
//         return `Daily at ${schedule.run_time}`;
//       case "weekly":
//         return `Weekly on ${schedule.days_of_week
//           ?.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d])
//           .join(", ")} at ${schedule.run_time}`;
//       case "monthly":
//         return `Monthly on day ${schedule.day_of_month} at ${schedule.run_time}`;
//       default:
//         return schedule.frequency;
//     }
//   };

//   const formatDate = (dateString: string | null) => {
//     if (!dateString) return "Never";
//     try {
//       return new Date(dateString).toLocaleString();
//     } catch {
//       return "Invalid date";
//     }
//   };

//   useEffect(() => {
//     fetchSchedules();
//     fetchSchedulerStatus();
//   }, []);

//   if (loading) {
//     return (
//       <div className="loading">
//         <div className="spinner"></div>
//         Loading schedules...
//       </div>
//     );
//   }

//   if (error) {
//     return <div className="error">{error}</div>;
//   }

//   return (
//     <div className="schedules-list">
//       {showDeleteModal && (
//         <div className="modal-overlay">
//           <div className="modal">
//             <h3>Confirm Deletion</h3>
//             <p>Are you sure you want to delete this schedule?</p>
//             <div className="modal-actions">
//               <button className="danger" onClick={handleDeleteSchedule}>
//                 Delete
//               </button>
//               <button
//                 onClick={() => {
//                   setShowDeleteModal(false);
//                   setScheduleToDelete(null);
//                 }}
//               >
//                 Cancel
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       <h2>Scheduled Tasks</h2>

//       {schedulerStatus && (
//         <div className="scheduler-status">
//           <p>
//             Scheduler Status:{" "}
//             <strong>{schedulerStatus.running ? "Running" : "Stopped"}</strong>
//           </p>
//           <p>
//             Active Jobs: <strong>{schedulerStatus.jobs.length}</strong>
//           </p>
//         </div>
//       )}

//       {schedules.length === 0 ? (
//         <p>No schedules found. Create a new schedule to get started.</p>
//       ) : (
//         <div className="schedules-table-container">
//           <table className="schedules-table">
//             <thead>
//               <tr>
//                 <th>Name</th>
//                 <th>Type</th>
//                 <th>Schedule</th>
//                 <th>Folder</th>
//                 <th>Next Run</th>
//                 <th>Status</th>
//                 <th>Actions</th>
//               </tr>
//             </thead>
//             <tbody>
//               {schedules.map((schedule) => (
//                 <tr key={schedule.id}>
//                   <td>{schedule.name}</td>
//                   <td>{schedule.process_type.toUpperCase()}</td>
//                   <td>{formatSchedule(schedule)}</td>
//                   <td>{schedule.folder_path}</td>
//                   <td>{formatDate(schedule.next_run)}</td>
//                   <td>
//                     <span
//                       className={`status ${
//                         schedule.is_active ? "active" : "inactive"
//                       }`}
//                     >
//                       {schedule.is_active ? "Active" : "Inactive"}
//                     </span>
//                   </td>
//                   <td className="actions">
//                     <Link
//                       to={`/schedules/${schedule.id}`}
//                       className="view-button"
//                     >
//                       view
//                     </Link>
//                     <button
//                       onClick={() => handleToggleSchedule(schedule.id)}
//                       className={schedule.is_active ? "warning" : "success"}
//                     >
//                       {schedule.is_active ? "Disable" : "Enable"}
//                     </button>
//                     <button
//                       onClick={() => confirmDelete(schedule.id)}
//                       className="danger"
//                     >
//                       Delete
//                     </button>
//                   </td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//       )}
//     </div>
//   );
// };

// export default SchedulesList;
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

interface Schedule {
  id: number;
  user_id: number;
  name: string;
  process_type: string;
  frequency: string;
  run_time: string;
  days_of_week: number[] | null;
  day_of_month: number | null;
  folder_path: string;
  is_active: boolean;
  next_run: string;
  last_run: string | null;
  created_at: string;
}

const ScheduleView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { token } = useAuth();
  const navigate = useNavigate();

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `http://localhost:8000/api/schedules/${id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status === 401) {
        navigate("/login");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch schedule details");
      }

      const data = await response.json();
      setSchedule(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error fetching schedule details"
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSchedule = async () => {
    if (!schedule) return;

    try {
      const response = await fetch(
        `http://localhost:8000/api/schedules/${id}/toggle`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to toggle schedule");
      }

      fetchSchedule();
    } catch (err) {
      setError("Error toggling schedule status");
      console.error(err);
    }
  };

  const formatSchedule = (schedule: Schedule) => {
    switch (schedule.frequency) {
      case "daily":
        return `Daily at ${schedule.run_time}`;
      case "weekly":
        return `Weekly on ${schedule.days_of_week
          ?.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d])
          .join(", ")} at ${schedule.run_time}`;
      case "monthly":
        return `Monthly on day ${schedule.day_of_month} at ${schedule.run_time}`;
      default:
        return schedule.frequency;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return "Invalid date";
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, [id]);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading schedule details...
      </div>
    );
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (!schedule) {
    return <div className="not-found">Schedule not found</div>;
  }

  return (
    <div className="schedule-view">
      <h2>Schedule Details: {schedule.name}</h2>

      <div className="schedule-details">
        <div className="detail-item">
          <span className="label">ID:</span>
          <span className="value">{schedule.id}</span>
        </div>

        <div className="detail-item">
          <span className="label">Name:</span>
          <span className="value">{schedule.name}</span>
        </div>

        <div className="detail-item">
          <span className="label">Process Type:</span>
          <span className="value">{schedule.process_type.toUpperCase()}</span>
        </div>

        <div className="detail-item">
          <span className="label">Schedule:</span>
          <span className="value">{formatSchedule(schedule)}</span>
        </div>

        <div className="detail-item">
          <span className="label">Folder Path:</span>
          <span className="value">{schedule.folder_path}</span>
        </div>

        <div className="detail-item">
          <span className="label">Status:</span>
          <span
            className={`status ${schedule.is_active ? "active" : "inactive"}`}
          >
            {schedule.is_active ? "Active" : "Inactive"}
          </span>
        </div>

        <div className="detail-item">
          <span className="label">Next Run:</span>
          <span className="value">{formatDate(schedule.next_run)}</span>
        </div>

        <div className="detail-item">
          <span className="label">Last Run:</span>
          <span className="value">{formatDate(schedule.last_run)}</span>
        </div>

        <div className="detail-item">
          <span className="label">Created:</span>
          <span className="value">{formatDate(schedule.created_at)}</span>
        </div>
      </div>

      <div className="schedule-actions">
        <Link to={`/schedules/${schedule.id}/edit`} className="edit-button">
          Edit Schedule
        </Link>
        <button
          onClick={handleToggleSchedule}
          className={schedule.is_active ? "warning" : "success"}
        >
          {schedule.is_active ? "Disable" : "Enable"}
        </button>
        <Link to="/schedules" className="back-button">
          Back to List
        </Link>
      </div>
    </div>
  );
};

export default ScheduleView;
