import React from "react";
import Navbar from "../Components/Navbar";
import Sidebar from "../Components/Sidebar";

const Settings = () => {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-panel">
        <Navbar title="Settings" />
        <div className="content-area">
          <div className="panel-card settings-card">
            <h3>Personalize your workspace</h3>
            <p>Adjust your teaching preferences and keep your classroom generator aligned with your style.</p>
            <ul>
              <li>Enable a calm dark mode experience</li>
              <li>Save favorite lesson templates</li>
              <li>Share outputs with colleagues</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;