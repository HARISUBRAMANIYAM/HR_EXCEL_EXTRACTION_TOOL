// components/SchedulerStatusPanel.tsx
import React from "react";
import { SchedulerStatus } from "../../types/index";

interface SchedulerStatusPanelProps {
  status: SchedulerStatus;
}

const SchedulerStatusPanel: React.FC<SchedulerStatusPanelProps> = ({
  status,
}) => {
  return (
    <div className="scheduler-status">
      <h2>Scheduler Status</h2>
      <div className="status-info">
        <div
          className={`status-indicator ${
            status.running ? "running" : "stopped"
          }`}
        >
          {status.running ? "Running" : "Stopped"}
        </div>

        <h3>Active Jobs ({status.jobs.length})</h3>
        {status.jobs.length === 0 ? (
          <p>No active jobs in the scheduler</p>
        ) : (
          <table className="jobs-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Next Run Time</th>
                <th>Trigger</th>
              </tr>
            </thead>
            <tbody>
              {status.jobs.map((job) => (
                <tr key={job.id}>
                  <td>{job.id}</td>
                  <td>{job.name}</td>
                  <td>{job.next_run_time || "Not scheduled"}</td>
                  <td>
                    <code>{job.trigger}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default SchedulerStatusPanel;
