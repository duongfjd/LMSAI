import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { generateQuizFromText } from '../lib/ai';
import { compressImage } from '../lib/utils';
import { FileText, Loader2, PlusCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import ExcelJS from 'exceljs';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function QuizCreator() {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('politics');
  const [timeLimit, setTimeLimit] = useState(15);
  const [questionCount, setQuestionCount] = useState(15);
  const [customPrompt, setCustomPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setErrorMsg('');
    if (!file || !title) {
      setErrorMsg("Vui lòng nhập tiêu đề trước khi tải file!");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setErrorMsg("File quá lớn (tối đa 20MB). Vui lòng nén hoặc chia nhỏ file.");
      return;
    }

    setLoading(true);
    setStatus('processing');
    setUploadProgress(0);

    try {
      console.log("File uploaded:", file.name, file.type, file.size);
      let text = "";
      let fileBase64 = "";
      const fileName = file.name.toLowerCase();
      const mimeType = file.type;
      
      if (fileName.endsWith('.docx')) {
        console.log("Processing DOCX file...");
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else if (fileName.endsWith('.txt')) {
        console.log("Processing TXT file...");
        text = await file.text();
      } else if (fileName.endsWith('.pdf')) {
        console.log("Processing PDF file...");
        const arrayBuffer = await file.arrayBuffer();
        
        // Try to extract text first
        try {
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          let fullText = "";
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(" ");
            fullText += pageText + "\n";
            
            // Limit text extraction for very long PDFs to avoid browser hang
            if (fullText.length > 50000) break;
          }
          text = fullText;
          console.log("Extracted PDF text length:", text.length);
        } catch (pdfError) {
          console.warn("PDF text extraction failed, will fallback to AI OCR:", pdfError);
        }

        // If text extraction is poor or it's an image PDF, we need the base64
        if (text.length < 100) {
          console.log("PDF seems to be image-based, preparing for AI OCR...");
          let finalPdf: File | Blob = file;
          try {
            finalPdf = await compressImage(file);
          } catch (compressError) {
            console.warn("PDF compression failed, using original:", compressError);
          }
          
          const reader = new FileReader();
          fileBase64 = await new Promise((resolve) => {
            reader.onload = () => {
              const base64 = (reader.result as string).split(',')[1];
              resolve(base64);
            };
            reader.readAsDataURL(finalPdf);
          });
        }
      } else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.png')) {
        console.log("Processing Image file...");
        let finalImage: File | Blob = file;
        try {
          finalImage = await compressImage(file);
        } catch (compressError) {
          console.warn("Image compression failed, using original:", compressError);
        }
        
        const reader = new FileReader();
        fileBase64 = await new Promise((resolve) => {
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          };
          reader.readAsDataURL(finalImage);
        });
      } else if (fileName.endsWith('.xlsx')) {
        console.log("Processing Excel file...");
        const arrayBuffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        const worksheet = workbook.worksheets[0];
        let excelText = "";
        worksheet.eachRow((row, rowNumber) => {
          const rowValues = row.values;
          if (Array.isArray(rowValues)) {
            // ExcelJS row.values is 1-indexed, filter out empty/null values
            const cleanValues = rowValues.filter(v => v !== null && v !== undefined && v !== "");
            if (cleanValues.length > 0) {
              excelText += `Dòng ${rowNumber}: ${cleanValues.join(" | ")}\n`;
            }
          }
        });
        text = excelText;
        console.log("Extracted Excel text length:", text.length);
      } else {
        throw new Error("Định dạng file không được hỗ trợ. Vui lòng dùng .docx, .pdf, .xlsx, .jpg, .png hoặc .txt");
      }

      // AI generates quiz from text or file
      const scopeInstruction = customPrompt 
        ? `\nYÊU CẦU ĐẶC BIỆT TỪ NGƯỜI DÙNG: ${customPrompt}` 
        : ``;

      const prompt = `Bạn là một chuyên gia khảo thí với độ chính xác tuyệt đối. 
NHIỆM VỤ: Trích xuất hoặc tạo câu hỏi trắc nghiệm CHỈ DỰA TRÊN TÀI LIỆU CUNG CẤP.

QUY TẮC BẮT BUỘC (CẤM VI PHẠM):
1. KHÔNG ĐƯỢC BỊA ĐẶT: Mọi kiến thức, số liệu, tên gọi phải lấy 100% từ tài liệu. Nếu tài liệu nói "A là B", không được viết "A là C" dù thực tế bên ngoài có thể khác.
2. TRÍCH XUẤT NGUYÊN VĂN: Nếu tài liệu là danh sách câu hỏi (như trong file Excel), hãy giữ nguyên văn nội dung câu hỏi và các lựa chọn.
3. KHÔNG TỰ Ý THÊM KIẾN THỨC NGOÀI: Tuyệt đối không sử dụng kiến thức từ Internet hay từ cơ sở dữ liệu huấn luyện của bạn. 
4. PHẢN ÁNH ĐÚNG CẤU TRÚC: Nếu file có các hàng/cột rõ ràng, hãy đọc theo đúng thứ tự đó.
5. SỐ LƯỢNG: Tạo ra tối đa ${questionCount} câu hỏi. Ưu tiên chất lượng và độ chính xác hơn số lượng. Nếu tài liệu quá ngắn, hãy tạo ít câu hỏi hơn nhưng phải đúng dữ liệu.
6. ĐỊNH DẠNG: Mỗi câu hỏi phải có chính xác 4 lựa chọn (A, B, C, D). Nếu tài liệu gốc thiếu lựa chọn, hãy tự tạo thêm 2-3 lựa chọn "gây nhiễu" hợp lý dựa trên các từ ngữ khác trong tài liệu (nhưng đáp án đúng vẫn phải bám sát tài liệu).

DỮ LIỆU TÀI LIỆU:
${text}

${scopeInstruction}`;

      const fileData = fileBase64 ? { data: fileBase64, mimeType } : undefined;
      
      setUploadProgress(40); // Base64 encoding complete

      // If we have text, we prioritize it. If we have both, Flash can handle it.
      const questions = await generateQuizFromText(text || "Tài liệu đính kèm", questionCount, prompt, fileData);
      
      setUploadProgress(90); // AI generation complete

      if (!questions || !Array.isArray(questions) || questions.length === 0) {
        throw new Error("AI không trích xuất được câu hỏi phù hợp từ nội dung này. Vui lòng kiểm tra lại định dạng file hoặc bổ sung thêm thông tin.");
      }

      const newQuiz = {
        title,
        subjectId,
        questions,
        timeLimit,
        createdBy: user?.uid,
        createdAt: Date.now(),
      };

      await addDoc(collection(db, 'quizzes'), newQuiz);
      setUploadProgress(100); // Database save complete
      
      setStatus('success');
      setTitle('');
    } catch (error: any) {
      console.error("Quiz Creation Error:", error);
      setErrorMsg(`Lỗi: ${error.message || "Không thể xử lý file này"}`);
      setStatus('error');
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8 bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="flex items-center gap-3 mb-8">
        <PlusCircle className="w-8 h-8 text-blue-600" />
        <h2 className="text-2xl font-bold text-gray-800">Tạo bài thi nhanh</h2>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{errorMsg}</p>
        </div>
      )}

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tiêu đề bài thi</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: Kiểm tra Triết học Mác-Lênin"
            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Môn học</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="politics">Chính trị</option>
              <option value="math">Toán học</option>
              <option value="it">Công nghệ thông tin</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Thời gian (phút)</label>
            <input
              type="number"
              value={timeLimit}
              onChange={(e) => setTimeLimit(Number(e.target.value))}
              className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Số lượng câu hỏi</label>
            <input
              type="number"
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              min={1}
              max={50}
              className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Yêu cầu đặc biệt cho AI (Tùy chọn)</label>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Ví dụ: Chỉ tập trung vào chương 1 và chương 2, độ khó cao..."
            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
          />
        </div>

        <div className="relative">
          <input
            type="file"
            accept=".docx,.txt,.pdf,.jpg,.jpeg,.png,.xlsx"
            onChange={handleFileUpload}
            disabled={loading}
            className="hidden"
            id="quiz-file-upload"
          />
          <label
            htmlFor="quiz-file-upload"
            className={`flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
              loading ? 'bg-gray-50 border-gray-200 cursor-not-allowed' : 'border-blue-200 hover:border-blue-400 hover:bg-blue-50'
            }`}
          >
            {loading ? (
              <div className="w-full space-y-4">
                <div className="flex flex-col items-center">
                  <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                  <p className="text-blue-600 font-bold tracking-wide">
                    {uploadProgress > 0 ? `ĐANG TẢI LÊN: ${Math.round(uploadProgress)}%` : 'ĐANG XỬ LÝ...'}
                  </p>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 transition-all duration-300" 
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : status === 'success' ? (
              <>
                <CheckCircle2 className="w-12 h-12 text-green-500 mb-4" />
                <p className="text-green-600 font-medium">Tạo bài thi thành công!</p>
                <p className="text-sm text-gray-400 mt-2">Nhấn để tạo bài thi khác</p>
              </>
            ) : status === 'error' ? (
              <>
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <p className="text-red-600 font-medium">Có lỗi xảy ra, vui lòng thử lại!</p>
              </>
            ) : (
              <>
                <FileText className="w-12 h-12 text-blue-400 mb-4" />
                <p className="text-gray-600 font-medium text-center">
                  Tải lên tài liệu (.docx, .pdf, .txt, .jpg, .png) để AI tự động tạo câu hỏi
                </p>
                <p className="text-sm text-gray-400 mt-2">Hỗ trợ quét OCR từ ảnh và file PDF</p>
              </>
            )}
          </label>
        </div>
      </div>
    </div>
  );
}



