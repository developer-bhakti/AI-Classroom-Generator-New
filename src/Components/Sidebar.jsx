import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  BookOpen,
  HelpCircle,
  Sparkles,
  FolderKanban,
  History,
  UserCircle,
  Settings,
  LogOut,
  ClipboardCheck
} from "lucide-react";

const Sidebar = () => {
  const location = useLocation();

  const menu = [
    { name: "Dashboard", icon: <LayoutDashboard size={18} />, path: "/dashboard" },
    { name: "Worksheet Generator", icon: <FileText size={18} />, path: "/worksheet" },
    { name: "Lesson Plan Generator", icon: <BookOpen size={18} />, path: "/lesson" },
    { name: "Quiz Generator", icon: <HelpCircle size={18} />, path: "/quiz" },
    { name: "Activity Generator", icon: <Sparkles size={18} />, path: "/activities" },
    { name: "Exam Paper Generator", icon: <ClipboardCheck size={18} />, path: "/exam" },
    { name: "Saved Content", icon: <FolderKanban size={18} />, path: "/settings" },
    { name: "History", icon: <History size={18} />, path: "/settings" },
    { name: "Profile", icon: <UserCircle size={18} />, path: "/settings" },
    { name: "Settings", icon: <Settings size={18} />, path: "/settings" },
    { name: "Logout", icon: <LogOut size={18} />, path: "/" }
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">
          <Sparkles size={18} />
        </div>
        <div>
          <h2>Adiuvaret</h2>
          <p>AI Classroom Generator</p>
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