import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FaHome,
  FaBook,
  FaQuestionCircle,
  FaClipboardList,
  FaLightbulb,
  FaCog,
  FaGraduationCap
} from "react-icons/fa";

const Sidebar = () => {
  const location = useLocation();

  const menu = [
    { name: "Dashboard", icon: <FaHome />, path: "/dashboard" },
    { name: "Worksheet", icon: <FaBook />, path: "/worksheet" },
    { name: "Lesson", icon: <FaClipboardList />, path: "/lesson" },
    { name: "Quiz", icon: <FaQuestionCircle />, path: "/quiz" },
    { name: "Activities", icon: <FaLightbulb />, path: "/activities" },
    { name: "Settings", icon: <FaCog />, path: "/settings" }
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">
          <FaGraduationCap />
        </div>
        <div>
          <h2>AI Classroom</h2>
          <p>Teacher Studio</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menu.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} className={`nav-item ${active ? "active" : ""}`}>
              <span>{item.icon}</span>
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;