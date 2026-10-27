import React, { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import PrintPortal from "../PrintPortal";
import PrintableResource from "./PrintableResource";
import { printWithTitle } from "../../Services/printing";
import { printTitle } from "../../Services/printLayout";

/**
 * "Download PDF / Print" for one resource. The printable page is only put into the document while it is being
 * printed, so a page with two of these (an exam paper and its answer key) never prints both at once. The
 * browser's print window does the rest: print it, or choose "Save as PDF" as the destination.
 */
const ResourcePrint = ({ kind, resource, meta, image = null, label = "Download PDF / Print", variant = "secondary", hint = false, disabled = false }) => {
  const [job, setJob] = useState(null); // a new value on every click, so a second click prints again

  useEffect(() => {
    const done = () => setJob(null);
    window.addEventListener("afterprint", done);
    return () => window.removeEventListener("afterprint", done);
  }, []);

  useEffect(() => {
    if (job === null) return undefined;
    let cancelled = false;
    (async () => {
      // Let the sheet be laid out, and an image decoded, before the browser takes its picture of the page.
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      await Promise.all([...document.querySelectorAll(".print-root img")].map((img) => (img.decode ? img.decode().catch(() => {}) : null)));
      if (!cancelled) printWithTitle(printTitle(kind, resource?.title));
    })();
    return () => { cancelled = true; };
  }, [job, kind, resource?.title]);

  return (
    <>
      <button type="button" className={`${variant}-btn print-btn`} onClick={() => setJob(Date.now())} disabled={disabled}>
        <Printer size={16} /> {label}
      </button>
      {hint ? <p className="cell-muted print-hint">To keep a PDF file, choose “Save as PDF” as the destination in the print window.</p> : null}
      {job !== null ? (
        <PrintPortal>
          <PrintableResource kind={kind} resource={resource} meta={meta} image={image} />
        </PrintPortal>
      ) : null}
    </>
  );
};

export default ResourcePrint;
