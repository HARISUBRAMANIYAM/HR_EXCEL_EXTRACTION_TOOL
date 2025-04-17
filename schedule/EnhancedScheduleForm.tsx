import dayjs from "dayjs";
import React, { useEffect, useState } from "react";
import { useAuth } from "../frontend/hr-extraction-frontend/src/context/AuthContext";

interface Schedule {
  id: number;
  process_type: "pf" | "esi";
  frequency: "daily" | "weekly" | "monthly";
  run_time: string;
  days_of_week: number[];
  day_of_month: number;
  is_active: boolean;
  input_folder: string;
  output_folder: string;
  archive_folder: string;
  next_run: string;
  last_run: string | null;
}

interface SchedulerStatus {
  running: boolean;
  jobs: {
    id: string;
    name: string;
    next_run_time: string;
    trigger: string;
  }[];
}

const API_BASE_URL = "http://localhost:8000/api/schedules";

const ProcessingScheduleManager: React.FC = () => {
  const { token } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [schedulerStatus, setSchedulerStatus] =
    useState<SchedulerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [formData, setFormData] = useState({
    process_type: "pf" as "pf" | "esi",
    frequency: "daily" as "daily" | "weekly" | "monthly",
    run_time: "",
    days_of_week: [] as number[],
    day_of_month: 1,
    is_active: true,
    input_folder: "",
    output_folder: "",
    archive_folder: "",
  });
  const [error, setError] = useState<string | null>(null);

  const weekdays = [
    { id: 0, name: "Sun" },
    { id: 1, name: "Mon" },
    { id: 2, name: "Tue" },
    { id: 3, name: "Wed" },
    { id: 4, name: "Thu" },
    { id: 5, name: "Fri" },
    { id: 6, name: "Sat" },
  ];

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const response = await fetch(API_BASE_URL, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to load schedules");
      const data = await response.json();
      setSchedules(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedulerStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/status`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to get scheduler status");
      const data = await response.json();
      setSchedulerStatus(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    if (name === "frequency") {
      setFormData((prev) => ({
        ...prev,
        days_of_week: [],
        day_of_month: 1,
      }));
    }
  };

  const toggleDaySelection = (day: number) => {
    setFormData((prev) => {
      const newDays = prev.days_of_week.includes(day)
        ? prev.days_of_week.filter((d) => d !== day)
        : [...prev.days_of_week, day];
      return { ...prev, days_of_week: newDays.sort() };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.run_time) {
      setError("Please select a run time");
      return;
    }

    if (formData.frequency === "weekly" && formData.days_of_week.length === 0) {
      setError("Please select at least one day of the week");
      return;
    }

    if (
      formData.frequency === "monthly" &&
      (formData.day_of_month < 1 || formData.day_of_month > 28)
    ) {
      setError("Please enter a valid day of month (1-28)");
      return;
    }

    if (
      !formData.input_folder ||
      !formData.output_folder ||
      !formData.archive_folder
    ) {
      setError("All folder paths are required");
      return;
    }

    try {
      const formattedTime = formData.run_time.includes("T")
        ? formData.run_time.split("T")[1].substring(0, 8)
        : formData.run_time.length > 8
        ? formData.run_time.substring(0, 8)
        : formData.run_time;
      const scheduleData = {
        ...formData,
        run_time: formattedTime, // Add seconds
      };

      const response = await fetch(API_BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(scheduleData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to create schedule");
      }

      // Reset form
      setFormData({
        process_type: "pf",
        frequency: "daily",
        run_time: "",
        days_of_week: [],
        day_of_month: 1,
        is_active: true,
        input_folder: "",
        output_folder: "",
        archive_folder: "",
      });

      // Reload schedules
      await fetchSchedules();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    }
  };

  const toggleSchedule = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/${id}/toggle`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        method: "PATCH",
      });
      if (!response.ok) throw new Error("Failed to toggle schedule");
      await fetchSchedules();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    }
  };

  const deleteSchedule = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this schedule?"))
      return;

    try {
      const response = await fetch(`${API_BASE_URL}/${id}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete schedule");
      await fetchSchedules();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    }
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return "";
    return timeStr.includes("T")
      ? timeStr.split("T")[1].substring(0, 5)
      : timeStr.substring(0, 5);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return dayjs(dateStr).format("MMM D, YYYY HH:mm");
  };

  const formatFrequency = (schedule: Schedule) => {
    switch (schedule.frequency) {
      case "daily":
        return `Daily at ${formatTime(schedule.run_time)}`;
      case "weekly":
        const days = schedule.days_of_week
          .map((d) => weekdays.find((w) => w.id === d)?.name)
          .join(", ");
        return `Weekly on ${days} at ${formatTime(schedule.run_time)}`;
      case "monthly":
        return `Monthly on day ${schedule.day_of_month} at ${formatTime(
          schedule.run_time
        )}`;
      default:
        return schedule.frequency;
    }
  };

  const openStatusModal = async () => {
    setShowStatusModal(true);
    await fetchSchedulerStatus();
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">
            Processing Schedule Manager
          </h1>
          <p className="text-gray-600">
            Manage your PF and ESI processing schedules
          </p>
        </header>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p>{error}</p>
            <button
              className="absolute top-0 bottom-0 right-0 px-4 py-3"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
            >
              <svg
                className="h-6 w-6 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Create New Schedule</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Process Type
                </label>
                <select
                  name="process_type"
                  value={formData.process_type}
                  onChange={handleInputChange}
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                  aria-label="processtype"
                >
                  <option value="pf">PF Processing</option>
                  <option value="esi">ESI Processing</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Frequency
                </label>
                <select
                  name="frequency"
                  value={formData.frequency}
                  onChange={handleInputChange}
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                  aria-label="frequency"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Run Time
                </label>
                <input
                  type="time"
                  name="run_time"
                  value={formData.run_time}
                  onChange={handleInputChange}
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                  aria-label="runtime"
                  required
                />
              </div>
              {formData.frequency === "weekly" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Days of Week
                  </label>
                  <div className="mt-1 grid grid-cols-7 gap-1">
                    {weekdays.map((day) => (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => toggleDaySelection(day.id)}
                        className={`p-2 border border-gray-300 rounded-md hover:bg-gray-100 ${
                          formData.days_of_week.includes(day.id)
                            ? "bg-blue-500 text-white"
                            : ""
                        }`}
                      >
                        {day.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {formData.frequency === "monthly" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Day of Month
                  </label>
                  <input
                    type="number"
                    name="day_of_month"
                    min="1"
                    max="28"
                    value={formData.day_of_month}
                    onChange={handleInputChange}
                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                    aria-label="dayofmonth"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Active
                </label>
                <div className="mt-1">
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleInputChange}
                      className="rounded text-blue-600"
                    />
                    <span className="ml-2">Enable this schedule</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                Folder Paths
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Input Folder
                  </label>
                  <input
                    type="text"
                    name="input_folder"
                    value={formData.input_folder}
                    onChange={handleInputChange}
                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                    required
                    placeholder="D:/MyProject/backend/pf_input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Output Folder
                  </label>
                  <input
                    type="text"
                    name="output_folder"
                    value={formData.output_folder}
                    onChange={handleInputChange}
                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                    required
                    placeholder="D:/MyProject/backend/processed_excels_pf"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Archive Folder
                  </label>
                  <input
                    type="text"
                    name="archive_folder"
                    value={formData.archive_folder}
                    onChange={handleInputChange}
                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                    required
                    placeholder="D:/MyProject/backend/pf_processed_archive"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
              >
                Create Schedule
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Your Schedules</h2>
            <div className="flex space-x-2">
              <button
                onClick={fetchSchedules}
                className="bg-gray-200 text-gray-700 py-1 px-3 rounded-md hover:bg-gray-300"
              >
                Refresh
              </button>
              <button
                onClick={openStatusModal}
                className="bg-gray-200 text-gray-700 py-1 px-3 rounded-md hover:bg-gray-300"
              >
                View Status
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500"></div>
            </div>
          ) : schedules.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              No schedules found. Create one above!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Frequency
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Next Run
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Run
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {schedules.map((schedule) => (
                    <tr key={schedule.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {schedule.process_type.toUpperCase()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatFrequency(schedule)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(schedule.next_run)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(schedule.last_run)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            schedule.is_active
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {schedule.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => toggleSchedule(schedule.id)}
                          className="text-blue-600 hover:text-blue-900 mr-2"
                        >
                          {schedule.is_active ? "Disable" : "Enable"}
                        </button>
                        <button
                          onClick={() => deleteSchedule(schedule.id)}
                          className="text-red-600 hover:text-red-900"
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
      </div>

      {/* Status Modal */}
      {showStatusModal && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{
            backgroundColor: "black",
            opacity: 0.5,
            color: "white", // Optional: text color for visibility
            padding: "20px", // Optional: spacing
          }}
        >
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Scheduler Status</h3>
              <button
                onClick={() => setShowStatusModal(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="status"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            {schedulerStatus ? (
              <div className="mb-4">
                <p className="mb-2">
                  <span className="font-medium">Scheduler Status:</span>{" "}
                  <span
                    className={
                      schedulerStatus.running
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  >
                    {schedulerStatus.running ? "Running" : "Stopped"}
                  </span>
                </p>
                {schedulerStatus.jobs.length > 0 ? (
                  <>
                    <h4 className="font-medium mt-4 mb-2">Scheduled Jobs:</h4>
                    <ul className="pl-5 list-disc">
                      {schedulerStatus.jobs.map((job) => (
                        <li key={job.id} className="mb-1">
                          {job.id} - Next run: {formatDate(job.next_run_time)}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="mt-4">No active scheduled jobs.</p>
                )}
              </div>
            ) : (
              <div className="animate-pulse mb-4">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={() => setShowStatusModal(false)}
                className="bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessingScheduleManager;
