import React from "react";

const Card = ({ title, value }) => {
  return (
    <div
      style={{
        background: "#fff",
        padding: "25px",
        borderRadius: "10px",
        boxShadow: "0 5px 15px rgba(0,0,0,.08)"
      }}
    >
      <h3>{title}</h3>

      <h1
        style={{
          marginTop: "15px",
          color: "#2563eb"
        }}
      >
        {value}
      </h1>
    </div>
  );
};

export default Card;