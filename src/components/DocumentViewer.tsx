import React, { useState, useEffect } from 'react';
import mammoth from 'mammoth';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface DocumentViewerProps {
  file: { url?: string; name: string; type: string; chunkCount?: number };
  submissionId?: string;
  fileIndex?: number;
  studentId?: string;
}

export default function DocumentViewer({ file, submissionId, fileIndex, studentId }: DocumentViewerProps) {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullUrl, setFullUrl] = useState<string | undefined>(file.url);

  useEffect(() => {
    const loadDocument = async () => {
      setLoading(true);
      setError(null);
      try {
        let base64Data = '';
        let currentFullUrl = file.url;

        if (file.chunkCount && file.chunkCount > 0 && submissionId && fileIndex !== undefined) {
          const chunksQuery = query(
            collection(db, `submissions/${submissionId}/chunks`),
            where('fileIndex', '==', fileIndex),
            where('studentId', '==', studentId)
          );
          const chunksSnapshot = await getDocs(chunksQuery);
          const chunks = chunksSnapshot.docs
            .map(d => d.data() as { chunkIndex: number; data: string })
            .sort((a, b) => a.chunkIndex - b.chunkIndex);
          
          currentFullUrl = chunks.map(c => c.data).join('');
          setFullUrl(currentFullUrl);
          base64Data = currentFullUrl.split(',')[1] || '';
        } else if (file.url && file.url.startsWith('data:')) {
          base64Data = file.url.split(',')[1];
        }

        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          setLoading(false);
          return;
        }

        if (file.name.endsWith('.docx')) {
          if (base64Data) {
            const binaryString = window.atob(base64Data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            
            const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer });
            setHtmlContent(result.value);
          } else {
            setError('Không thể đọc dữ liệu file.');
          }
        } else {
          setError('Định dạng file không được hỗ trợ xem trực tiếp. Vui lòng tải xuống.');
        }
      } catch (err) {
        console.error("Error loading document:", err);
        setError('Không thể tải nội dung file.');
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [file, submissionId, fileIndex, studentId]);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Đang tải tài liệu...</div>;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 mb-4">{error}</p>
        {fullUrl && (
          <a href={fullUrl} download={file.name} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
            Tải xuống file
          </a>
        )}
      </div>
    );
  }

  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    return (
      <iframe 
        src={fullUrl} 
        className="w-full h-[600px] border-0 rounded-lg"
        title={file.name}
      />
    );
  }

  return (
    <div 
      className="prose max-w-none p-8 bg-white border border-gray-200 rounded-lg shadow-inner overflow-y-auto max-h-[600px]"
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}
