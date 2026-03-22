interface JobScoreProps {
  score: number | null;
}

function JobScore({ score }: JobScoreProps) {
  const getScoreColor = (score: number | null) => {
    if (!score) return "text-gray-400";
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    if (score >= 40) return "text-orange-400";
    return "text-red-400";
  };

  const getScoreBgColor = (score: number | null) => {
    if (!score) return "bg-gray-800";
    if (score >= 80) return "bg-green-500/10";
    if (score >= 60) return "bg-yellow-500/10";
    if (score >= 40) return "bg-orange-500/10";
    return "bg-red-500/10";
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-100 mb-4">
        Match Score
      </h3>
      
      <div className={`${getScoreBgColor(score)} rounded-lg p-6 text-center border border-gray-700`}>
        {score !== null ? (
          <>
            <div className={`text-5xl font-bold ${getScoreColor(score)} mb-2`}>
              {score}
            </div>
            <div className="text-sm text-gray-400">out of 100</div>
          </>
        ) : (
          <div className="text-gray-500 text-lg">Not scored yet</div>
        )}
      </div>
    </div>
  );
}

export default JobScore;
