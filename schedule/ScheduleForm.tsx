// components/ScheduleForm.tsx
import React, { useState } from "react";
import { ScheduleFormData, weekdays } from "../../types/index";

interface ScheduleFormProps {
  onSubmit: (formData: ScheduleFormData) => Promise<boolean>;
  onCancel: () => void;
}

const ScheduleForm: React.FC<ScheduleFormProps> = ({ onSubmit, onCancel }) => {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formData, setFormData] = useState<ScheduleFormData>({
    name: "",
    description: "",
    frequency: "daily",
    run_time: "09:00:00",
    days_of_week: [],
    day_of_month: 1,
    process_type: "pf",
    input_folder: "",
    output_folder: "",
    archive_folder: "",
  });

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDayToggle = (dayId: number) => {
    setFormData((prev) => {
      const newDays = prev.days_of_week.includes(dayId)
        ? prev.days_of_week.filter((d) => d !== dayId)
        : [...prev.days_of_week, dayId];
      return { ...prev, days_of_week: newDays };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const success = await onSubmit(formData);
      if (!success) {
        setIsSubmitting(false);
      }
    } catch (error) {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="schedule-form-container">
      <form onSubmit={handleSubmit} className="schedule-form">
        <h2>New Schedule</h2>

        <div className="form-group">
          <label htmlFor="name">Schedule Name</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            placeholder="Daily Processing"
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Describe the purpose of this schedule"
            rows={3}
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="process_type">Process Type</label>
          <select
            id="process_type"
            name="process_type"
            value={formData.process_type}
            onChange={handleInputChange}
            disabled={isSubmitting}
          >
            <option value="pf">PF Reports</option>
            <option value="esi">ESI Reports</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="frequency">Frequency</label>
          <select
            id="frequency"
            name="frequency"
            value={formData.frequency}
            onChange={handleInputChange}
            disabled={isSubmitting}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="run_time">Run Time (UTC)</label>
          <input
            type="time"
            id="run_time"
            name="run_time"
            value={formData.run_time}
            onChange={handleInputChange}
            required
            step="1"
            disabled={isSubmitting}
          />
        </div>

        {formData.frequency === "weekly" && (
          <div className="form-group">
            <label>Days of Week</label>
            <div className="days-selector">
              {weekdays.map((day) => (
                <div key={day.id} className="day-checkbox">
                  <input
                    type="checkbox"
                    id={`day-${day.id}`}
                    checked={formData.days_of_week.includes(day.id)}
                    onChange={() => handleDayToggle(day.id)}
                    disabled={isSubmitting}
                  />
                  <label htmlFor={`day-${day.id}`}>{day.name}</label>
                </div>
              ))}
            </div>
          </div>
        )}

        {formData.frequency === "monthly" && (
          <div className="form-group">
            <label htmlFor="day_of_month">Day of Month</label>
            <input
              type="number"
              id="day_of_month"
              name="day_of_month"
              value={formData.day_of_month}
              onChange={handleInputChange}
              min="1"
              max="31"
              required
              disabled={isSubmitting}
            />
          </div>
        )}

        <div className="form-group">
          <label htmlFor="input_folder">Input Folder Path</label>
          <input
            type="text"
            id="input_folder"
            name="input_folder"
            value={formData.input_folder}
            onChange={handleInputChange}
            required
            placeholder="D:/MyProject/backend/pf_input"
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="output_folder">Output Folder Path</label>
          <input
            type="text"
            id="output_folder"
            name="output_folder"
            value={formData.output_folder}
            onChange={handleInputChange}
            required
            placeholder="D:/MyProject/backend/processed_excels_pf"
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="archive_folder">Archive Folder Path</label>
          <input
            type="text"
            id="archive_folder"
            name="archive_folder"
            value={formData.archive_folder}
            onChange={handleInputChange}
            required
            placeholder="D:/MyProject/backend/pf_processed_archive"
            disabled={isSubmitting}
          />
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="submit-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating..." : "Create Schedule"}
          </button>
          <button
            type="button"
            className="cancel-button"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default ScheduleForm;

// // export default ScheduleForm;
// import React, { useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { useAuth } from "../../context/AuthContext";

// const ScheduleForm: React.FC = () => {
//   const navigate = useNavigate();
//   const { token } = useAuth();
//   const [formData, setFormData] = useState({
//     name: "",
//     process_type: "pf",
//     frequency: "daily",
//     run_time: "09:00", // Changed to HH:mm format
//     days_of_week: [] as number[],
//     day_of_month: undefined as number | undefined,
//     is_active: true,
//     folder_path: "",
//   });
//   const [loading, setLoading] = useState(false);
//   const [errors, setErrors] = useState<Record<string, string>>({});

//   const handleInputChange = (
//     e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
//   ) => {
//     const { name, value, type } = e.target;

//     if (type === "checkbox") {
//       const checkbox = e.target as HTMLInputElement;
//       setFormData({
//         ...formData,
//         [name]: checkbox.checked,
//       });
//     } else {
//       setFormData({
//         ...formData,
//         [name]: value,
//       });
//     }

//     if (errors[name]) {
//       setErrors((prev) => ({ ...prev, [name]: "" }));
//     }
//   };

//   const handleDayToggle = (day: number) => {
//     const newDays = formData.days_of_week.includes(day)
//       ? formData.days_of_week.filter((d) => d !== day)
//       : [...formData.days_of_week, day];

//     setFormData({
//       ...formData,
//       days_of_week: newDays,
//     });
//   };

//   const validateForm = () => {
//     const newErrors: Record<string, string> = {};

//     if (!formData.name.trim()) {
//       newErrors.name = "Name is required";
//     }

//     if (!formData.folder_path.trim()) {
//       newErrors.folder_path = "Folder path is required";
//     }

//     if (formData.frequency === "weekly" && formData.days_of_week.length === 0) {
//       newErrors.days_of_week = "Select at least one day";
//     }

//     if (formData.frequency === "monthly" && !formData.day_of_month) {
//       newErrors.day_of_month = "Day of month is required";
//     }

//     setErrors(newErrors);
//     return Object.keys(newErrors).length === 0;
//   };

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();

//     if (!validateForm()) {
//       return;
//     }

//     setLoading(true);
//     setErrors({});

//     try {
//       // Format the time properly for backend
//       const formattedTime = formData.run_time.includes(":")
//         ? formData.run_time + ":00" // Add seconds if not present
//         : formData.run_time;

//       const requestData = {
//         ...formData,
//         run_time: formattedTime,
//         days_of_week:
//           formData.frequency === "weekly" ? formData.days_of_week : undefined,
//         day_of_month:
//           formData.frequency === "monthly" ? formData.day_of_month : undefined,
//       };

//       const response = await fetch("http://localhost:8000/api/schedules", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${token}`,
//         },
//         body: JSON.stringify(requestData),
//       });

//       if (!response.ok) {
//         const errorData = await response.json();
//         if (response.status === 422) {
//           const validationErrors: Record<string, string> = {};
//           if (Array.isArray(errorData.detail)) {
//             errorData.detail.forEach((error: any) => {
//               const field = error.loc[error.loc.length - 1];
//               validationErrors[field] = error.msg;
//             });
//           }
//           setErrors(validationErrors);
//           return;
//         }
//         throw new Error(errorData.detail || "Failed to create schedule");
//       }

//       navigate("/schedules");
//     } catch (err) {
//       setErrors({
//         form:
//           err instanceof Error ? err.message : "An unexpected error occurred",
//       });
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="schedule-form">
//       <h2>Create New Schedule</h2>
//       {errors.form && <div className="error-message">{errors.form}</div>}

//       <form onSubmit={handleSubmit}>
//         {/* Name Field */}
//         <div className="form-group">
//           <label htmlFor="name">Schedule Name *</label>
//           <input
//             type="text"
//             id="name"
//             name="name"
//             value={formData.name}
//             onChange={handleInputChange}
//             required
//             className={errors.name ? "error" : ""}
//           />
//           {errors.name && <span className="field-error">{errors.name}</span>}
//         </div>

//         {/* Process Type */}
//         <div className="form-group">
//           <label htmlFor="process_type">Process Type *</label>
//           <select
//             id="process_type"
//             name="process_type"
//             value={formData.process_type}
//             onChange={handleInputChange}
//             required
//           >
//             <option value="pf">PF Processing</option>
//             <option value="esi">ESI Processing</option>
//           </select>
//         </div>

//         {/* Folder Path */}
//         <div className="form-group">
//           <label htmlFor="folder_path">Folder Path *</label>
//           <input
//             type="text"
//             id="folder_path"
//             name="folder_path"
//             value={formData.folder_path}
//             onChange={handleInputChange}
//             required
//             className={errors.folder_path ? "error" : ""}
//           />
//           {errors.folder_path && (
//             <span className="field-error">{errors.folder_path}</span>
//           )}
//         </div>

//         {/* Frequency */}
//         <div className="form-group">
//           <label htmlFor="frequency">Frequency *</label>
//           <select
//             id="frequency"
//             name="frequency"
//             value={formData.frequency}
//             onChange={(e) => {
//               setFormData({
//                 ...formData,
//                 frequency: e.target.value,
//                 days_of_week: e.target.value === "weekly" ? [1] : [],
//                 day_of_month: e.target.value === "monthly" ? 1 : undefined,
//               });
//             }}
//             required
//           >
//             <option value="daily">Daily</option>
//             <option value="weekly">Weekly</option>
//             <option value="monthly">Monthly</option>
//           </select>
//         </div>

//         {/* Weekly Options */}
//         {formData.frequency === "weekly" && (
//           <div className="form-group">
//             <label>Days of Week *</label>
//             <div className="days-container">
//               {[0, 1, 2, 3, 4, 5, 6].map((day) => (
//                 <div key={day} className="day-checkbox">
//                   <input
//                     type="checkbox"
//                     id={`day-${day}`}
//                     checked={formData.days_of_week.includes(day)}
//                     onChange={() => handleDayToggle(day)}
//                   />
//                   <label htmlFor={`day-${day}`}>
//                     {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]}
//                   </label>
//                 </div>
//               ))}
//             </div>
//             {errors.days_of_week && (
//               <span className="field-error">{errors.days_of_week}</span>
//             )}
//           </div>
//         )}

//         {/* Monthly Options */}
//         {formData.frequency === "monthly" && (
//           <div className="form-group">
//             <label htmlFor="day_of_month">Day of Month *</label>
//             <input
//               type="number"
//               id="day_of_month"
//               name="day_of_month"
//               min="1"
//               max="31"
//               value={formData.day_of_month || ""}
//               onChange={(e) =>
//                 setFormData({
//                   ...formData,
//                   day_of_month: parseInt(e.target.value) || undefined,
//                 })
//               }
//               required
//             />
//             {errors.day_of_month && (
//               <span className="field-error">{errors.day_of_month}</span>
//             )}
//           </div>
//         )}

//         {/* Run Time */}
//         <div className="form-group">
//           <label htmlFor="run_time">Run Time *</label>
//           <input
//             type="time"
//             id="run_time"
//             name="run_time"
//             step="3600" // Allow only whole hours
//             value={formData.run_time}
//             onChange={(e) =>
//               setFormData({
//                 ...formData,
//                 run_time: e.target.value,
//               })
//             }
//             required
//           />
//           {errors.run_time && (
//             <span className="field-error">{errors.run_time}</span>
//           )}
//         </div>

//         {/* Active Checkbox */}
//         <div className="form-group checkbox-group">
//           <label>
//             <input
//               type="checkbox"
//               checked={formData.is_active}
//               onChange={(e) =>
//                 setFormData({
//                   ...formData,
//                   is_active: e.target.checked,
//                 })
//               }
//             />
//             Activate schedule immediately
//           </label>
//         </div>

//         {/* Form Actions */}
//         <div className="form-actions">
//           <button type="submit" disabled={loading}>
//             {loading ? "Creating..." : "Create Schedule"}
//           </button>
//           <button type="button" onClick={() => navigate("/schedules")}>
//             Cancel
//           </button>
//         </div>
//       </form>
//     </div>
//   );
// };

// export default ScheduleForm;
