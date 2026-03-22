interface JobHeaderProps {
  title: string;
  company: string;
  location: string;
  tags: string[];
}

function JobHeader({ title, company, location, tags }: JobHeaderProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
      <h1 className="text-3xl sm:text-4xl font-bold text-gray-100 mb-3">
        {title}
      </h1>
      
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-4 text-gray-300">
        <span className="text-lg font-medium">{company}</span>
        <span className="hidden sm:inline text-gray-600">•</span>
        <span className="text-gray-400">{location}</span>
      </div>
      
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, index) => (
            <span
              key={index}
              className="px-3 py-1 bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-300"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default JobHeader;
