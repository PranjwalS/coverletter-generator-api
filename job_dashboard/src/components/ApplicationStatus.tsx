import { useState } from "react";

interface ApplicationStatusProps {
  status: string;
  onStatusChange: (newStatus: string) => void;
}

function ApplicationStatus({ status, onStatusChange }: ApplicationStatusProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const isApplied = status === "Applied";

  const handleToggle = () => {
    if (isApplied) {
      // If already applied, allow unmarking without confirmation
      onStatusChange("Not Applied");
      setShowConfirm(false);
    } else {
      // Show confirmation before marking as applied
      setShowConfirm(true);
    }
  };

  const handleConfirm = () => {
    onStatusChange("Applied");
    setShowConfirm(false);
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-100 mb-4">
        Application Status
      </h3>
      
      <div className="space-y-4">
        {/* Status Display */}
        <div className={`flex items-center justify-between p-4 rounded-lg border-2 ${
          isApplied 
            ? 'bg-green-500/10 border-green-500/50' 
            : 'bg-gray-800 border-gray-700'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              isApplied ? 'bg-green-500' : 'bg-gray-500'
            }`} />
            <span className={`font-medium ${
              isApplied ? 'text-green-400' : 'text-gray-400'
            }`}>
              {status}
            </span>
          </div>
          
          <button
            onClick={handleToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isApplied ? 'bg-green-600' : 'bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isApplied ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Confirmation Dialog */}
        {showConfirm && (
          <div className="bg-gray-800/50 border border-yellow-500/50 rounded-lg p-4">
            <p className="text-yellow-400 text-sm mb-3">
              Mark this job as applied?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleConfirm}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ApplicationStatus;
