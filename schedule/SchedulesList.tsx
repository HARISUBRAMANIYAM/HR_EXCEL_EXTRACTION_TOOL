import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

interface ScheduleStatus {
  running: boolean;
  jobs: {
    id: string;
    name: string;
    next_run_time: string;
    trigger: string;
  }[];
}

const SchedulesList: React.FC = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<number | null>(null);
  const [schedulerStatus, setSchedulerStatus] = useState<ScheduleStatus | null>(
    null
  );
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const confirmDelete = (id: number) => {
    setScheduleToDelete(id);
    setShowDeleteModal(true);
  };
  const fetchSchedules = async () => {
    try {
      if (!token) {
        console.error("o auth token availble");
        navigate("/login");
        return;
      }
      setLoading(true);
      const response = await fetch("http://localhost:8000/api/schedules", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 401) {
        navigate("/login");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch schedules");
      }

      const data = await response.json();
      setSchedules(
        data.filter((schedule: Schedule) => schedule.user_id === user?.id)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching schedules");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedulerStatus = async () => {
    try {
      const response = await fetch(
        "http://localhost:8000/api/schedules/status",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch scheduler status");
      }

      const data = await response.json();
      setSchedulerStatus(data);
    } catch (err) {
      console.error("Error fetching scheduler status:", err);
    }
  };

  const handleToggleSchedule = async (id: number) => {
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

      fetchSchedules();
      fetchSchedulerStatus();
    } catch (err) {
      setError("Error toggling schedule status");
      console.error(err);
    }
  };

  const handleDeleteSchedule = async () => {
    if (!window.confirm("Are you sure you want to delete this schedule?")) {
      return;
    }
    if (!scheduleToDelete) return;

    try {
      const response = await fetch(
        `http://localhost:8000/api/schedules/${scheduleToDelete}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete schedule");
      }

      fetchSchedules();
      fetchSchedulerStatus();
    } catch (err) {
      setError("Error deleting schedule");
      console.error(err);
    } finally {
      setShowDeleteModal(false);
      setScheduleToDelete(null);
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

  useEffect(() => {
    fetchSchedules();
    fetchSchedulerStatus();
  }, []);

  if (loading) {
    return <div className="loading">Loading schedules...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="schedules-list">
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Confirm Deletion</h3>
            <p>Are you sure you want to delete this schedule?</p>
            <div className="modal-actions">
              <button className="danger" onClick={handleDeleteSchedule}>
                Delete
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setScheduleToDelete(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <h2>Scheduled Tasks</h2>

      {schedulerStatus && (
        <div className="scheduler-status">
          <p>
            Scheduler Status:{" "}
            <strong>{schedulerStatus.running ? "Running" : "Stopped"}</strong>
          </p>
          <p>
            Active Jobs: <strong>{schedulerStatus.jobs.length}</strong>
          </p>
        </div>
      )}

      {schedules.length === 0 ? (
        <p>No schedules found. Create a new schedule to get started.</p>
      ) : (
        <div className="schedules-table-container">
          <table className="schedules-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Schedule</th>
                <th>Folder</th>
                <th>Next Run</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((schedule) => (
                <tr key={schedule.id}>
                  <td>{schedule.name}</td>
                  <td>{schedule.process_type.toUpperCase()}</td>
                  <td>{formatSchedule(schedule)}</td>
                  <td>{schedule.folder_path}</td>
                  <td>{new Date(schedule.next_run).toLocaleString()}</td>
                  <td>
                    <span
                      className={`status ${
                        schedule.is_active ? "active" : "inactive"
                      }`}
                    >
                      {schedule.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="actions">
                    <Link
                      to={`/schedules/${schedule.id}`}
                      className="view-button"
                    >
                      view
                    </Link>
                    <button
                      onClick={() => handleToggleSchedule(schedule.id)}
                      className={schedule.is_active ? "warning" : "success"}
                    >
                      {schedule.is_active ? "Disable" : "Enable"}
                    </button>
                    <button
                      onClick={() => confirmDelete(schedule.id)}
                      className="danger"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SchedulesList;
