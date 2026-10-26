import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders its children in a node attached straight to <body>, outside the app. On screen that node
 * is hidden; when printing, the print stylesheet hides the whole app and shows only this, so a
 * report prints on clean pages without the sidebar and buttons around it.
 */
const PrintPortal = ({ children }) => {
  const [node] = useState(() => {
    const element = document.createElement("div");
    element.className = "print-root";
    return element;
  });

  useEffect(() => {
    document.body.appendChild(node);
    return () => { node.remove(); };
  }, [node]);

  return createPortal(children, node);
};

export default PrintPortal;
