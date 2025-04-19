// src/components/Layout.tsx
import React from "react";
import Navbar from "./Navbar";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content">{children}</main>
      <footer className="footer">
        <p>
          © {new Date().getFullYear()} HR Extraction Tool. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default Layout;
