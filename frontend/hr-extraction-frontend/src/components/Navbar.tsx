// src/components/Navbar.tsx

import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">HR Extraction Tool</Link>
      </div>

      {user && (
        <div className="navbar-menu">
          <Link to="/dashboard" className="navbar-item">
            Dashboard
          </Link>
          <Link to="/pf-files" className="navbar-item">
            PF Files
          </Link>
          <Link to="/pf-upload" className="navbar-item">
            PF Upload
          </Link>
          <Link to="/esi-upload" className="navbar-item">
            ESI Upload
          </Link>
          <Link to="/esi-files" className="navbar-item">
            ESI FILES
          </Link>
        </div>
      )}

      <div className="navbar-end">
        {user ? (
          <div className="user-info">
            <span className="username">
              {user.full_name} ({user.role})
            </span>
            <button onClick={handleLogout} className="logout-button">
              Logout
            </button>
          </div>
        ) : (
          <Link to="/login" className="login-button">
            Login
          </Link>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
