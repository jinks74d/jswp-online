// components/dashboard/assignments/PrintableAssignment.tsx
import React from "react";

interface PrintableAssignmentProps {
  studentName: string;
  teacherName: string;
  courseName: string;
  assignment: {
    title: string;
    prompt?: string;
  };
  studentWork?: string;
}

const PrintableAssignment = React.forwardRef<HTMLDivElement, PrintableAssignmentProps>(
  ({ studentName, teacherName, courseName, assignment, studentWork }, ref) => {
    const today = new Date().toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    return (
      <div ref={ref} className="printable-assignment">
        <style jsx global>{`
          @media print {
            @page {
              size: 8.5in 11in;
              margin: 1in;
              /* Remove browser headers and footers */
              margin-top: 1in;
              margin-bottom: 1in;
              /* Hide browser default headers/footers */
              @top-left { content: ""; }
              @top-center { content: ""; }
              @top-right { content: ""; }
              @bottom-left { content: ""; }
              @bottom-center { content: ""; }
              @bottom-right { content: ""; }
            }
            
            /* Hide all browser UI elements */
            html, body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              margin: 0 !important;
              padding: 0 !important;
            }
            
            /* Hide everything except our printable content */
            body * {
              visibility: hidden;
            }
            
            .printable-assignment, .printable-assignment * {
              visibility: visible;
            }
            
            .printable-assignment {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              font-family: "Times New Roman", Times, serif;
              font-size: 12pt;
              line-height: 2;
              color: black;
              background: white;
              /* Ensure no browser chrome appears */
              -webkit-appearance: none;
              appearance: none;
            }
            
            .mla-header {
              margin-bottom: 1rem;
              line-height: 2;
            }
            
            .mla-header p {
              margin: 0;
              padding: 0;
            }
            
            .mla-title {
              text-align: center;
              margin: 1rem 0;
              font-weight: normal;
              font-size: 12pt;
            }
            
            .mla-body {
              text-indent: 0.5in;
              white-space: pre-wrap;
              line-height: 2;
            }
            
            .mla-body p {
              margin: 0;
              text-indent: 0.5in;
            }
            
            .mla-body h2 {
              font-size: 12pt;
              font-weight: bold;
              text-align: left;
              margin: 1rem 0 0.5rem 0;
              text-indent: 0;
            }
            
            .no-indent {
              text-indent: 0 !important;
            }
            
            /* Additional rules to ensure clean printing */
            * {
              box-shadow: none !important;
              text-shadow: none !important;
            }
          }
        `}</style>
        
        {/* MLA Header - Top left corner */}
        <div className="mla-header">
          <p>{studentName}</p>
          <p>{teacherName}</p>
          <p>{courseName}</p>
          <p>{today}</p>
        </div>
        
        {/* MLA Title - Centered */}
        <h1 className="mla-title">{assignment.title}</h1>
        
        {/* MLA Body - Double-spaced with first line indent */}
        <div className="mla-body">
          <h2 className="no-indent">Assignment Prompt:</h2>
          <p>{assignment.prompt || "No prompt provided."}</p>
          
          {studentWork && studentWork.trim() !== "No final draft submitted." && (
            <>
              <h2 className="no-indent">Student Response:</h2>
              <p>{studentWork}</p>
            </>
          )}
          
          {(!studentWork || studentWork.trim() === "No final draft submitted.") && (
            <p>Student work will appear here when submitted.</p>
          )}
        </div>
      </div>
    );
  }
);

PrintableAssignment.displayName = "PrintableAssignment";
export default PrintableAssignment;
