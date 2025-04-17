// src/App.tsx

import React from "react";
import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
} from "react-router-dom";
import AuthForm from "./components/AuthForm";
import Dashboard from "./components/Dashboard";
import ErrorBoundary from "./components/Error/ErrorBoundary";
import ProtectedRoute from "./components/Error/ProtectedRoute";
import EsiFilesList from "./components/ESI/EsiFilesList";
import EsiUpload from "./components/ESI/EsiUpload";
import Layout from "./components/Layout";
import FilesList from "./components/PF/PFFilesList";
import FolderUpload from "./components/PF/PFFolderUpload";
import { AuthProvider, useAuth } from "./context/AuthContext";

const AppRoutes = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/dashboard" /> : <AuthForm />}
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pf-files"
          element={
            <ProtectedRoute>
              <FilesList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pf-upload"
          element={
            <ProtectedRoute>
              <FolderUpload />
            </ProtectedRoute>
          }
        />
        <Route
          path="/esi-upload"
          element={
            <ProtectedRoute>
              <EsiUpload />
            </ProtectedRoute>
          }
        />
        <Route
          path="/esi-files"
          element={
            <ProtectedRoute>
              <EsiFilesList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={<Navigate to={user ? "/dashboard" : "/login"} />}
        />
      </Routes>
    </ErrorBoundary>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <AppRoutes />
        </Layout>
      </Router>
    </AuthProvider>
  );
};

export default App;
