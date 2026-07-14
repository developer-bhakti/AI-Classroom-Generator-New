import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaGraduationCap, FaArrowRight, FaBookOpen, FaBrain, FaMagic } from "react-icons/fa";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();
    if (email && password) {
      localStorage.setItem("aiClassroomAuth", "true");
      navigate("/dashboard", { replace: true });
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-copy">
          <div className="eyebrow">AI Classroom Generator</div>
          <h1>Create smarter lessons, faster.</h1>
          <p>
            A beautifully designed teaching workspace that helps educators generate worksheets, lesson plans, quizzes, and activities in minutes.
          </p>

          <div className="badge-row">
            <span className="feature-badge"><FaBrain /> AI-powered</span>
            <span className="feature-badge"><FaBookOpen /> Ready to use</span>
            <span className="feature-badge"><FaMagic /> Premium experience</span>
          </div>

          <form onSubmit={handleLogin} className="auth-form">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teacher@example.com" />
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" />
            <button type="submit" className="primary-btn full">
              <FaGraduationCap /> Open studio
              <FaArrowRight />
            </button>
          </form>
        </div>

        <div className="auth-side-card">
          <h3>Why educators love it</h3>
          <ul>
            <li>Instant classroom-ready resources</li>
            <li>Clean, responsive experience</li>
            <li>Built for modern teaching workflows</li>
            <li>Tailored for every class and subject</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Login;
