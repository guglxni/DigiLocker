import React, { useEffect, useRef } from 'react';
import hljs from 'highlight.js/lib/core';
import xml from 'highlight.js/lib/languages/xml';
import 'highlight.js/styles/github.css';

// Register XML language
hljs.registerLanguage('xml', xml);

interface XmlViewerProps {
  xmlContent: string;
  requestId: string;
}

const XmlViewer: React.FC<XmlViewerProps> = ({ xmlContent, requestId }) => {
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (codeRef.current && xmlContent) {
      // Apply syntax highlighting
      hljs.highlightElement(codeRef.current);
    }
  }, [xmlContent]);

  const handleDownload = () => {
    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aadhaar-${requestId}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Aadhaar XML Data</h3>
        <button
          onClick={handleDownload}
          className="btn-primary text-sm"
        >
          Download XML
        </button>
      </div>
      
      <div className="border rounded-md overflow-hidden">
        <pre className="prose max-w-full whitespace-pre-wrap p-4 bg-gray-50 overflow-x-auto">
          <code 
            ref={codeRef} 
            className="language-xml text-sm"
          >
            {xmlContent}
          </code>
        </pre>
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        <p>✅ Successfully retrieved Aadhaar data from DigiLocker</p>
        <p>Request ID: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{requestId}</span></p>
      </div>
    </div>
  );
};

export default XmlViewer; 