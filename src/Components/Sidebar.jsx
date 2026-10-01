import React, { useSyncExternalStore } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  ClipboardCheck,
  ClipboardList,
  Users,
  CreditCard,
  ShieldCheck,
  X
} from "lucide-react";
import { sidebarStore } from "../Services/sidebarStore";
import { useAuth } from "../context/useAuth";

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isOpen = useSyncExternalStore(sidebarStore.subscribe, sidebarStore.getSnapshot);
  const { isAdmin, signOut } = useAuth();

  const handleLogout = async () => {
    sidebarStore.close();
    await signOut();
    navigate("/", { replace: true });
  };

  const menu = [
    { name: "Dashboard", icon: <LayoutDashboard size={18} />, path: "/dashboard" },
    ...(isAdmin ? [{ name: "Admin Dashboard", icon: <ShieldCheck size={18} />, path: "/admin" }] : []),
    { name: "Worksheet Generator", icon: <FileText size={18} />, path: "/worksheet" },
    { name: "Lesson Plan Generator", icon: <BookOpen size={18} />, path: "/lesson" },
    { name: "Quiz Generator", icon: <HelpCircle size={18} />, path: "/quiz" },
    { name: "Activity Generator", icon: <Sparkles size={18} />, path: "/activities" },
    { name: "Exam Paper Generator", icon: <ClipboardCheck size={18} />, path: "/exam" },
    { name: "Skill Assessment", icon: <ClipboardList size={18} />, path: "/assessment" },
    { name: "Student Progress", icon: <Users size={18} />, path: "/students" },
    { name: "Saved Content", icon: <FolderKanban size={18} />, path: "/saved" },
    { name: "History", icon: <History size={18} />, path: "/history" },
    { name: "Subscription", icon: <CreditCard size={18} />, path: "/subscription" },
    { name: "Profile", icon: <UserCircle size={18} />, path: "/profile" },
    { name: "Settings", icon: <Settings size={18} />, path: "/settings" },
    { name: "Logout", icon: <LogOut size={18} />, path: "/" }
  ];

  return (
    <>
      {isOpen ? <div className="sidebar-backdrop" onClick={() => sidebarStore.close()} /> : null}
      <aside className={`sidebar ${isOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-icon">
            <Sparkles size={18} />
          </div>
          <div>
            <h2>Adiuvaret</h2>
            <p>AI Classroom Generator</p>
          </div>
          <button type="button" className="sidebar-close-btn" aria-label="Close menu" onClick={() => sidebarStore.close()}>
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {menu.map((item) => {
            const active = location.pathname === item.path;

            if (item.name === "Logout") {
              return (
                <button key={item.name} type="button" className="nav-item nav-item-btn" onClick={handleLogout}>
                  <span>{item.icon}</span>
                  {item.name}
                </button>
              );
            }

            return (
              <Link key={item.path} to={item.path} className={`nav-item ${active ? "active" : ""}`} onClick={() => sidebarStore.close()}>
                <span>{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;