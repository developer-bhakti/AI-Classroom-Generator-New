import React, { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Printer, Save } from "lucide-react";
import PrintPortal from "../PrintPortal";
import ProgressReport from "./ProgressReport";
import { buildProgressReport } from "../../Services/assessmentReport";
import { updateAssessmentRemarks } from "../../Services/studentService";
import { printWithTitle } from "../../Services/printing";

/**
 * The progress report with its toolbar: edit and save the teacher's remarks, then print it or save
 * it as a PDF from the browser's print window. A second, non-editable copy lives in a print-only
 * portal, so the printout is the report alone.
 */
const ReportView = ({ assessment, student, onBack, onRemarksSaved }) => {
  const savedRemarks = assessment.teacherRemarks || "";
  const [remarks, setRemarks] = useState(savedRemarks);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const report = useMemo(() => buildProgressReport({ assessment, student }), [assessment, student]);
  // A result that never reached the database has nothing to attach remarks to; they still print.
  const canSave = assessment.persisted !== false;
  const unsaved = canSave && remarks.trim() !== savedRemarks.trim();

  const saveRemarks = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await updateAssessmentRemarks(assessment.id, remarks);
      onRemarksSaved?.(remarks.trim());
      setMessage({ type: "success", text: "Remarks saved." });
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const print = () => printWithTitle(`${student.name} - Progress Report${assessment.month ? ` - ${assessment.month}` : ""}`);

  return (
    <div className="report-view">
      <div className="report-toolbar">
        {onBack ? <button type="button" className="secondary-btn" onClick={onBack}><ArrowLeft size={16} /> Back</button> : <span />}
        <div className="report-toolbar-actions">
          {canSave ? (
            <button type="button" className="secondary-btn" onClick={saveRemarks} disabled={saving || !unsaved}>
              <Save size={16} /> {saving ? "Saving…" : "Save remarks"}
            </button>
          ) : null}
          <button type="button" className="primary-btn" onClick={print}>
            <Printer size={16} /> Download / Print report
          </button>
        </div>
      </div>

      {message ? (
        <p className={message.type === "error" ? "inline-error" : "inline-success"}>
          {message.type === "error" ? <AlertTriangle size={14} /> : <Check size={14} />} {message.text}
        </p>
      ) : null}
      <p className="cell-muted report-hint">To keep a copy, choose “Save as PDF” as the destination in the print window.</p>

      <div className="report-sheet">
        <ProgressReport report={report} remarks={remarks} onRemarksChange={setRemarks} editable />
      </div>

      <PrintPortal>
        <ProgressReport report={report} remarks={remarks.trim()} />
      </PrintPortal>
    </div>
  );
};

export default ReportView;
