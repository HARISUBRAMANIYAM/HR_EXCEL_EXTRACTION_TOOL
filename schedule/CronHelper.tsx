import React, { useState } from "react";

interface CronHelperProps {
  onSelect: (cronExpression: string) => void;
}

const CronHelper: React.FC<CronHelperProps> = ({ onSelect }) => {
  const [showHelper, setShowHelper] = useState(false);

  const commonSchedules = [
    { label: "Every minute", cron: "* * * * *" },
    { label: "Every hour", cron: "0 * * * *" },
    { label: "Every day at midnight", cron: "0 0 * * *" },
    { label: "Every day at 8am", cron: "0 8 * * *" },
    { label: "Every Monday at 9am", cron: "0 9 * * 1" },
    { label: "Every weekday at 10am", cron: "0 10 * * 1-5" },
    { label: "First day of month at midnight", cron: "0 0 1 * *" },
    { label: "Every Sunday at 11pm", cron: "0 23 * * 0" },
  ];

  const handleSelect = (cron: string) => {
    onSelect(cron);
    setShowHelper(false);
  };

  return (
    <div className="cron-helper">
      <button type="button" onClick={() => setShowHelper(!showHelper)}>
        {showHelper ? "Hide Schedule Help" : "Show Schedule Help"}
      </button>

      {showHelper && (
        <div className="cron-helper-content">
          <h4>Common Schedule Patterns</h4>
          <div className="cron-options">
            {commonSchedules.map((schedule, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSelect(schedule.cron)}
              >
                {schedule.label} ({schedule.cron})
              </button>
            ))}
          </div>
          <div className="cron-format-help">
            <h4>Cron Format:</h4>
            <table>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Allowed Values</th>
                  <th>Special Characters</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Minute</td>
                  <td>0-59</td>
                  <td rowSpan={5}>
                    * (any value)
                    <br />
                    , (value list separator)
                    <br />
                    - (range of values)
                    <br />/ (step values)
                  </td>
                </tr>
                <tr>
                  <td>Hour</td>
                  <td>0-23</td>
                </tr>
                <tr>
                  <td>Day of Month</td>
                  <td>1-31</td>
                </tr>
                <tr>
                  <td>Month</td>
                  <td>1-12</td>
                </tr>
                <tr>
                  <td>Day of Week</td>
                  <td>0-6 (0 is Sunday)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CronHelper;
