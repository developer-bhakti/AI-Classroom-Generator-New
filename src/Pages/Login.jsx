import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaGraduationCap, FaArrowRight, FaBookOpen, FaBrain, FaMagic } from "react-icons/fa";
import { Eye, EyeOff, ScanLine, Moon, Sun } from "lucide-react";
import { supabase, isSupabaseConfigured, SUPABASE_SETUP_MESSAGE } from "../Services/supabaseClient";
import { describeAuthError } from "../Services/authErrors";
import { logActivity } from "../Services/activityLog";
import { useAuth } from "../context/useAuth";

const landingPathFor = (role) => (role === "admin" ? "/admin" : "/dashboard");

const Login = () => {
  const navigate = useNavigate();
  const { session, profile, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session && profile) {
      navigate(landingPathFor(profile.role), { replace: true });
    }
  }, [loading, session, profile, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!isSupabaseConfigured) {
      setMessage(SUPABASE_SETUP_MESSAGE);
      setShowModal(true);
      return;
    }

    if (!email.trim() || !password) {
      setMessage("Please enter both your email and password.");
      setShowModal(true);
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });
    setSubmitting(false);

    if (error) {
      setMessage(describeAuthError(error));
      setShowModal(true);
      return;
    }

    logActivity(data.user.id, "login");

    // Read the role directly rather than waiting on the auth context, so an admin
    // lands on the admin panel instead of flashing the teacher dashboard first.
    const { data: signedInProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    navigate(landingPathFor(signedInProfile?.role), { replace: true });
  };

  const handleSignUp = () => {
    navigate("/signup");
  };

  const handleGoogleSignIn = () => {
    setMessage("Google sign-in is ready for integration. Please use the Login button to continue.");
    setShowModal(true);
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
          <div className="eyebrow">AI Classroom Generator</div>
          <h1>Design smarter lessons with AI.</h1>
          <p>
            Create worksheets, lesson plans, quizzes, and classroom activities in minutes with a calm, modern teaching workspace.
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
            <div className="password-field">
              <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((prev) => !prev)}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="form-row">
              <label className="checkbox-row">
                <input type="checkbox" checked={rememberMe} onChange={() => setRememberMe((prev) => !prev)} />
                <span>Remember Me</span>
              </label>
              <a href="#" className="link-text">Forgot Password?</a>
            </div>

            <button type="submit" className="primary-btn full" disabled={submitting}>
              <FaGraduationCap /> {submitting ? "Signing in..." : "Login"}
              <FaArrowRight />
            </button>

            <button type="button" className="secondary-btn full auth-secondary-btn" onClick={handleSignUp}>
              Sign Up
            </button>

            <button type="button" className="google-btn full" onClick={handleGoogleSignIn}>
              <ScanLine size={16} /> Continue with Google
            </button>

            {showModal && message ? (
              <div className="auth-modal-backdrop" onClick={() => setShowModal(false)}>
                <div className={`auth-message ${message.toLowerCase().includes("incorrect") ? "auth-message-error" : ""}`} onClick={(e) => e.stopPropagation()}>
                  <div className="auth-modal-header">
                    <strong>{message.toLowerCase().includes("incorrect") ? "Login Error" : "Notice"}</strong>
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

export default Login;
