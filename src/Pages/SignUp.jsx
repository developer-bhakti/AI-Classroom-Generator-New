import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaGraduationCap, FaArrowRight, FaBookOpen, FaBrain, FaMagic } from "react-icons/fa";
import { Eye, EyeOff, Moon, Sun } from "lucide-react";

const SignUp = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSignUp = (e) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.email.trim() || !formData.password || !formData.confirmPassword) {
      setMessage("Please fill in all fields to create your account.");
      setShowModal(true);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setMessage("Passwords do not match. Please try again.");
      setShowModal(true);
      return;
    }

    localStorage.setItem("aiClassroomAuth", "true");
    localStorage.setItem("adiuvaret-user", formData.email);
    localStorage.setItem("adiuvaret-name", formData.name);

    setMessage(`Welcome, ${formData.name}! Your account is ready.`);
    setShowModal(true);
    navigate("/dashboard", { replace: true });
  };

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    document.documentElement.style.colorScheme = nextTheme;
    localStorage.setItem("adiuvaret-theme", nextTheme);
    setTheme(nextTheme);
  };

  return (
    <div className="auth-page">
      <button className="theme-toggle-pill" onClick={toggleTheme} type="button">
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        {theme === "dark" ? "Light mode" : "Dark mode"}
      </button>

      <div className="auth-shell">
        <div className="auth-copy">
          <div className="brand-badge">
            <FaGraduationCap />
            <span>Adiuvaret</span>
          </div>
          <div className="eyebrow">Create your account</div>
          <h1>Start building smarter classroom resources.</h1>
          <p>
            Join the Adiuvaret workspace to create worksheets, lesson plans, quizzes, and activities in minutes.
          </p>

          <div className="badge-row">
            <span className="feature-badge"><FaBrain /> AI-powered</span>
            <span className="feature-badge"><FaBookOpen /> Ready to use</span>
            <span className="feature-badge"><FaMagic /> Premium experience</span>
          </div>

          <form onSubmit={handleSignUp} className="auth-form">
            <label>Full Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter Your Name"
            />

            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="teacher@example.com"
            />

            <label>Password</label>
            <div className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Create a password"
              />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((prev) => !prev)}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <label>Confirm Password</label>
            <div className="password-field">
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm password"
              />
              <button type="button" className="password-toggle" onClick={() => setShowConfirmPassword((prev) => !prev)}>
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <button type="submit" className="primary-btn full">
              <FaGraduationCap /> Create Account
              <FaArrowRight />
            </button>

            <p className="form-row">
              Already have an account? <Link to="/" className="link-text">Login</Link>
            </p>

            {showModal && message ? (
              <div className="auth-modal-backdrop" onClick={() => setShowModal(false)}>
                <div className="auth-message" onClick={(e) => e.stopPropagation()}>
                  <div className="auth-modal-header">
                    <strong>Account</strong>
                    <button type="button" className="modal-close-btn" onClick={() => setShowModal(false)}>×</button>
                  </div>
                  <p>{message}</p>
                </div>
              </div>
            ) : null}
          </form>
        </div>

        <div className="auth-side-card">
          <div className="auth-side-top">
            <div className="brand-badge side-badge">
              <FaGraduationCap />
              <span>Why teachers choose it</span>
            </div>
          </div>
          <h3>Everything your classroom needs in one place</h3>
          <ul>
            <li>Instant classroom-ready resources</li>
            <li>Clean, responsive experience</li>
            <li>Built for modern teaching workflows</li>
            <li>Tailored for every class and subject</li>
          </ul>
          <div className="auth-highlight-card">
            <strong>90%</strong>
            <span>faster lesson prep</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
