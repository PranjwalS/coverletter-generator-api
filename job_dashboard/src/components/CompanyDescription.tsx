import { useState } from "react";

interface CompanyDescriptionProps {
  description: string;
}

function CompanyDescription({ description }: CompanyDescriptionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Split description into paragraphs
  const paragraphs = description
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  // Show first 2 paragraphs initially
  const previewParagraphs = paragraphs.slice(0, 2);
  const remainingParagraphs = paragraphs.slice(2);
  const hasMore = remainingParagraphs.length > 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-semibold text-gray-100 mb-4">
        About the Company
      </h2>
      
      <div className="text-gray-300 space-y-4">
        {previewParagraphs.map((paragraph, index) => (
          <p key={index} className="leading-relaxed">
            {paragraph.split('\n').map((line, i) => (
              <span key={i}>
                {line}
                {i < paragraph.split('\n').length - 1 && <br />}
              </span>
            ))}
          </p>
        ))}
        
        {isExpanded && remainingParagraphs.map((paragraph, index) => (
          <p key={`more-${index}`} className="leading-relaxed">
            {paragraph.split('\n').map((line, i) => (
              <span key={i}>
                {line}
                {i < paragraph.split('\n').length - 1 && <br />}
              </span>
            ))}
          </p>
        ))}
      </div>
      
      {hasMore && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-4 text-blue-400 hover:text-blue-300 transition-colors text-sm font-medium"
        >
          {isExpanded ? "Show Less ↑" : "Read More ↓"}
        </button>
      )}
    </div>
  );
}

export default CompanyDescription;
