interface JobMetadataProps {
  scrapedAt: string;
  scoredAt: string | null;
  scoreBreakdown: Record<string, any> | null;
}

function JobMetadata({ scrapedAt, scoredAt, scoreBreakdown }: JobMetadataProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-100 mb-4">
        Job Metadata
      </h3>
      
      <div className="space-y-3 text-sm">
        {/* Scraped At */}
        <div className="flex justify-between items-start">
          <span className="text-gray-400">Scraped:</span>
          <span className="text-gray-300 text-right">{formatDate(scrapedAt)}</span>
        </div>
        
        {/* Scored At */}
        <div className="flex justify-between items-start">
          <span className="text-gray-400">Scored:</span>
          <span className="text-gray-300 text-right">
            {scoredAt ? formatDate(scoredAt) : "Not scored yet"}
          </span>
        </div>

        {/* Score Breakdown Details */}
        {scoreBreakdown && Object.keys(scoreBreakdown).length > 0 && (
          <div className="pt-3 border-t border-gray-800">
            <div className="text-gray-400 mb-2">Score Details:</div>
            <div className="bg-gray-800/50 rounded p-3 space-y-2">
              {Object.entries(scoreBreakdown).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 capitalize">
                    {key.replace(/_/g, ' ')}:
                  </span>
                  <span className="text-gray-400 font-mono">
                    {typeof value === 'object' 
                      ? JSON.stringify(value) 
                      : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default JobMetadata;
