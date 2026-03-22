interface QuickActionsProps {
  jobUrl: string;
  applyType: string;
  coverLetterText: string | null;
  title: string;
}

function QuickActions({ 
  jobUrl, 
  applyType, 
  coverLetterText, 
  title
}: QuickActionsProps) {
  
const handleCoverLetterDownload = async () => {
  if (!coverLetterText) return;

  try {
    const res = await fetch("http://localhost:8001/coverletter-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: coverLetterText }),
    });

    if (!res.ok) throw new Error("Failed to download PDF");

    const blob = await res.blob(); // MUST be blob for PDF
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.pdf`; 
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
  }
};

  const handleCVDownload = () => {
    const url = "http://localhost:8001/download-cv";
    const a = document.createElement("a");
    a.href = url;
    a.download = "CV_Pranjwal_Singh.pdf"; // filename for download
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-100 mb-4">
        Quick Actions
      </h3>
      
      {/* Job Posting Link */}
      <a
        href={jobUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
      >
        <svg
          className="w-5 h-5 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
        View Job Posting
      </a>
      
      <div className="text-xs text-gray-500 text-center -mt-2">
        Apply Type: {applyType}
      </div>

      {/* Cover Letter */}
{/* Cover Letter */}
<div className="border-t border-gray-800 pt-4">
  {coverLetterText ? (
    <button
      onClick={handleCoverLetterDownload}
      className="flex items-center justify-center w-full px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors"
    >
      <svg
        className="w-5 h-5 mr-2"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      Download Cover Letter
    </button>
  ) : (
    <button
      disabled
      className="flex items-center justify-center w-full px-4 py-3 bg-gray-800 text-gray-400 rounded-lg transition-colors border border-gray-700 border-dashed cursor-not-allowed"
    >
      <svg
        className="w-5 h-5 mr-2"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      Cover Letter Not Ready
    </button>
  )}
</div>



      {/* CV Download */}
      <button
        onClick={handleCVDownload}
        className="flex items-center justify-center w-full px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors"
      >
        <svg
          className="w-5 h-5 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        Download CV
      </button>
    </div>
  );
}

export default QuickActions;
