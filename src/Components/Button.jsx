import React from "react";

const Button = ({ title, onClick }) => {
  return (
    <button
      onClick={onClick}
      style={{
        background: "#2563eb",
        color: "#fff",
        border: "none",
        padding: "12px 25px",
        borderRadius: "8px",
        cursor: "pointer",
        fontSize: "16px"
      }}
    >
      {title}
    </button>
  );
};

export default Button;