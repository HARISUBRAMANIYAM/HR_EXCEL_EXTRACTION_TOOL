// components/ScheduleCard.tsx
import React from "react";
import { Schedule, weekdays } from "../../types/index";
import { formatDate, formatTime } from "../../types/utils";

interface ScheduleCardProps {
  schedule: Schedule;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}

const ScheduleCard: React.FC<ScheduleCardProps> = ({
  schedule,
  onToggle,
  onDelete,
}) => {
  return (
    <div
      className={`schedule-card ${schedule.is_active ? "active" : "inactive"}`}
    >
      <div className="schedule-header">
        <h3>{schedule.name}</h3>
        <div className="status-badge">
          {schedule.is_active ? "Active" : "Inactive"}
        </div>
      </div>

      {schedule.description && (
        <p className="schedule-description">{schedule.description}</p>
      )}

      <div className="schedule-details">
        <div className="detail-item">
          <span className="detail-label">Process Type:</span>
          <span>{schedule.process_type.toUpperCase()}</span>
        </div>

        <div className="detail-item">
          <span className="detail-label">Frequency:</span>
          <span>
            {schedule.frequency.charAt(0).toUpperCase() +
              schedule.frequency.slice(1)}
          </span>
        </div>

        <div className="detail-item">
          <span className="detail-label">Run Time (UTC):</span>
          <span>{formatTime(schedule.run_time)}</span>
        </div>

        {schedule.frequency === "weekly" &&
          schedule.days_of_week.length > 0 && (
            <div className="detail-item">
              <span className="detail-label">Days:</span>
              <span>
                {schedule.days_of_week
                  .map((d) => weekdays.find((day) => day.id === d)?.name)
                  .join(", ")}
              </span>
            </div>
          )}

        {schedule.frequency === "monthly" && (
          <div className="detail-item">
            <span className="detail-label">Day of Month:</span>
            <span>{schedule.day_of_month}</span>
          </div>
        )}

        <div className="detail-item">
          <span className="detail-label">Next Run:</span>
          <span>{formatDate(schedule.next_run)}</span>
        </div>

        <div className="detail-item">
          <span className="detail-label">Created:</span>
          <span>{formatDate(schedule.created_at)}</span>
        </div>
      </div>

      <div className="folder-details">
        <div className="detail-item">
          <span className="detail-label">Input Folder:</span>
          <code>{schedule.input_folder}</code>
        </div>

        <div className="detail-item">
          <span className="detail-label">Output Folder:</span>
          <code>{schedule.output_folder}</code>
        </div>

        <div className="detail-item">
          <span className="detail-label">Archive Folder:</span>
          <code>{schedule.archive_folder}</code>
        </div>
      </div>

      <div className="schedule-actions">
        <button
          onClick={() => onToggle(schedule.id)}
          className={`toggle-button ${
            schedule.is_active ? "deactivate" : "activate"
          }`}
        >
          {schedule.is_active ? "Deactivate" : "Activate"}
        </button>
        <button onClick={() => onDelete(schedule.id)} className="delete-button">
          Delete
        </button>
      </div>
    </div>
  );
};

export default ScheduleCard;
