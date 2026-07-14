import React, { useEffect, useState } from "react";
import { Search, Bell, Sun, Moon, Sparkles, UserCircle2 } from "lucide-react";

const Navbar = ({ title }) => {
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  const [showProfile, setShowProfile] = useState(false);
  const userEmail = localStorage.getItem("adiuvaret-user") || "adiuvaret@gmail.com";

  useEffect(() => {
    const currentTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    setTheme(currentTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    document.documentElement.style.colorScheme = nextTheme;
    localStorage.setItem("adiuvaret-theme", nextTheme);
    setTheme(nextTheme);
  };

  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Adiuvaret AI Classroom Generator</p>
        <h2>{title}</h2>
      </div>

      <div className="topbar-right">
        <div className="search-pill">
          <Search size={16} />
          <input placeholder="Search resources" />
        </div>
        <div className="chip">
          <Sparkles size={16} />
          AI ready
        </div>
        <button className="icon-btn" aria-label="Notifications">
          <Bell size={16} />
        </button>
        <button className="icon-btn" aria-label="Theme toggle" onClick={toggleTheme}>
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button type="button" className="profile-pill" onClick={() => setShowProfile((prev) => !prev)}>
          <UserCircle2 size={22} />
          <span>Teacher</span>
        </button>
      </div>

      {showProfile ? (
        <div className="profile-modal-backdrop" onClick={() => setShowProfile(false)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>Profile Details</h3>
              <button type="button" className="modal-close-btn" onClick={() => setShowProfile(false)}>×</button>
            </div>
            <div className="profile-modal-body">
              <p><strong>Name:</strong> Teacher</p>
              <p><strong>Email:</strong> {userEmail}</p>
              <p><strong>Role:</strong> Educator</p>
              <p><strong>Plan:</strong> Premium</p>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
};

export default Navbar;