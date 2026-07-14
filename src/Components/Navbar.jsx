import React from "react";
import { FaUserCircle, FaMagic } from "react-icons/fa";

const Navbar = ({ title }) => {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">AI-powered teaching toolkit</p>
        <h2>{title}</h2>
      </div>

      <div className="topbar-right">
        <div className="chip">
          <FaMagic />
          Smart content
        </div>
        <div className="profile-pill">
          <FaUserCircle size={24} />
          <span>Educator</span>
        </div>
      </div>
    </header>
  );
};

export default Navbar;