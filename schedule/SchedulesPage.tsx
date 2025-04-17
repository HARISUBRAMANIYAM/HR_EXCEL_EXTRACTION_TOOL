import React from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import ScheduleForm from "./ScheduleForm";
import SchedulesList from "./SchedulesList";
import ScheduleView from "./ScheduleView";
const SchedulesPage: React.FC = () => {
  const location = useLocation();

  return (
    <div className="schedules-page">
      <div className="page-header">
        <h1>Scheduled Processing</h1>
        <nav className="schedules-nav">
          <ul>
            <li className={location.pathname === "/schedules" ? "active" : ""}>
              <Link to="/schedules">All Schedules</Link>
            </li>
            <li
              className={location.pathname === "/schedules/new" ? "active" : ""}
            >
              <Link to="/schedules/new">Create New Schedule</Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="schedules-content">
        <Routes>
          <Route path="/" element={<SchedulesList />} />
          <Route path="/new" element={<ScheduleForm />} />
          <Route path="/:id" element={<ScheduleView />} />
        </Routes>
      </div>
    </div>
  );
};

export default SchedulesPage;
