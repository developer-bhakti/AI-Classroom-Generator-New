import React, { useState } from "react";

/** A user's ID with a Copy button. */
const UserIdLine = ({ id }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked: the id is still on screen to select
    }
  };

  return (
    <p className="content-row-meta">
      User ID: <code className="user-id">{id}</code>{" "}
      <button type="button" className="text-btn" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
    </p>
  );
};

export default UserIdLine;
