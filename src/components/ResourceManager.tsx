import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db, storage } from '../lib/firebase';
import { collection, addDoc, query, onSnapshot, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FileText, PlusCircle, Trash2, Loader2, CheckCircle2, AlertCircle, Star, Info } from 'lucide-react';
import { compressImage } from '../lib/utils';
import * as mammoth from 'mammoth';

interface Resource {
  id: string;
  title: string;
  description: string;
  subjectId: string;
  createdBy: string;
  createdAt: number;
}

export default function ResourceManager() {
  const { user } = useAuth();
  const [resources, setResources] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState('politics');
  const [isSample, setIsSample] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'resources'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setResources(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setErrorMsg('');
    if (!file || !title) {
      setErrorMsg("Vui lòng nhập tiêu đề trước khi tải file!");
      return;
    }

    setLoading(true);
    setStatus('processing');
    setUploadProgress(0);

    try {
      const fileName = file.name.toLowerCase();
      let fileType = 'other';
      if (fileName.endsWith('.docx')) fileType = 'docx';
      else if (fileName.endsWith('.pdf')) fileType = 'pdf';
      else if (fileName.endsWith('.txt')) fileType = 'txt';
      else if (fileName.match(/\.(jpg|jpeg|png|gif)$/)) fileType = 'image';

      // Upload to Storage
      let finalFile: File | Blob = file;
      if (fileType === 'image') {
        try {
          finalFile = await compressImage(file);
        } catch (compressError) {
          console.warn("Image compression failed, uploading original:", compressError);
          // Fallback to original file
          finalFile = file;
        }
      }
      
      // Sanitized file name
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `resources/${Date.now()}_${sanitizedName}`;
      const fileRef = ref(storage, storagePath);
      
      console.log("Starting simple upload to:", storagePath);
      setUploadProgress(30); // Provide some visual feedback
      
      let fileUrl = "";

      try {
        const uploadPromise = uploadBytes(fileRef, finalFile).then(async () => {
          return await getDownloadURL(fileRef);
        });

        // 6 second timeout to force fallback if Firebase Storage is unavailable/hanging
        const timeoutPromise = new Promise<string>((_, reject) => {
          setTimeout(() => reject(new Error("STORAGE_TIMEOUT")), 6000);
        });

        fileUrl = await Promise.race([uploadPromise, timeoutPromise]);
      } catch (storageError) {
        console.warn("Storage upload failed or timed out, falling back to Firestore...", storageError);
        setUploadProgress(60);
        
        const base64Url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(finalFile);
        });

        // 1MB is the strict limit for Firestore. 900KB is safe.
        if (base64Url.length > 950 * 1024) {
          throw new Error("Lỗi Upload: Không thể kết nối Storage và File quá lớn (>1MB) để lưu dự phòng.");
        }
        
        fileUrl = base64Url;
      }
      
      setUploadProgress(90);
      console.log("File prepared successfully");

      const newResource = {
        title,
        description: description || 'Tài liệu học tập bổ trợ.',
        subjectId,
        fileUrl,
        fileType,
        isSample,
        uploadedBy: user?.uid,
        createdAt: Date.now(),
        accessCount: 0
      };

      await addDoc(collection(db, 'resources'), newResource);
      setStatus('success');
      setTitle('');
      setDescription('');
      setIsSample(false);
    } catch (error: any) {
      console.error("Upload Error:", error);
      setErrorMsg(`Lỗi: ${error.message || "Không thể tải lên file này"}`);
      setStatus('error');
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'resources', id));
      setConfirmDeleteId(null);
    } catch (error) {
      console.error("Delete Error:", error);
    }
  };

  return (
    <div className="space-y-8">
      <div className="max-w-3xl mx-auto p-8 bg-white/90 backdrop-blur-sm rounded-3xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl flex items-center justify-center shadow-sm">
            <PlusCircle className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-2xl font-black text-gray-800">Tải lên tài liệu mới</h2>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{errorMsg}</p>
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Tiêu đề tài liệu</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Đề cương Triết học Mác-Lênin"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Mô tả tóm tắt</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Nhập mô tả ngắn về nội dung tài liệu..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-all min-h-[80px]"
            />
          </div>

          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-2">Môn học</label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-all"
              >
                <option value="politics">Chính trị</option>
                <option value="math">Toán học</option>
                <option value="it">Công nghệ thông tin</option>
              </select>
            </div>
            <div className="flex items-center gap-3 pt-6 md:pt-8">
              <input
                type="checkbox"
                id="isSample"
                checked={isSample}
                onChange={(e) => setIsSample(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="isSample" className="text-sm font-bold text-gray-700">Đánh dấu là Bài tập mẫu tiêu biểu</label>
            </div>
          </div>

          <div className="relative mt-4">
            <input
              type="file"
              accept=".docx,.txt,.pdf,.jpg,.jpeg,.png"
              onChange={handleFileUpload}
              disabled={loading}
              className="hidden"
              id="resource-file-upload"
            />
            <label
              htmlFor="resource-file-upload"
              className={`flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-3xl cursor-pointer transition-all ${
                loading ? 'bg-gray-50 border-gray-200 cursor-not-allowed' : 'border-blue-200 hover:border-blue-400 hover:bg-blue-50 bg-white'
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
                  <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                  </div>
                  <p className="text-green-600 font-black text-lg">TẢI LÊN THÀNH CÔNG!</p>
                  <p className="text-sm text-gray-400 mt-2 font-bold uppercase tracking-widest">Nhấn để tải thêm tài liệu khác</p>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
                    <PlusCircle className="w-10 h-10 text-blue-500" />
                  </div>
                  <p className="text-gray-800 font-black text-xl mb-1">
                    CHỌN FILE ĐỂ TẢI LÊN
                  </p>
                  <p className="text-sm text-gray-400 font-bold">Hỗ trợ .docx, .pdf, .txt, .jpg, .png</p>
                </>
              )}
            </label>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto bg-white/90 backdrop-blur-sm p-8 rounded-3xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-black text-gray-800 mb-6 flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-600" /> Danh sách tài liệu
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {resources.map(r => (
            <div key={r.id} className="p-5 border border-gray-100 rounded-2xl hover:shadow-md transition-all bg-white relative group">
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                {confirmDeleteId === r.id ? (
                  <div className="flex items-center gap-2 bg-white shadow-lg rounded-lg p-1 border border-gray-100">
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-md hover:bg-red-600"
                    >
                      Xóa
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-md hover:bg-gray-200"
                    >
                      Hủy
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(r.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Xóa tài liệu"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl flex items-center justify-center text-blue-600 shrink-0 shadow-sm overflow-hidden">
                  {r.fileType === 'image' ? (
                    <img src={r.fileUrl} alt={r.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <FileText className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 mb-1 pr-8">{r.title}</h3>
                  <div className="flex gap-2 mb-2">
                    <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded uppercase">
                      Môn: {r.subjectId === 'politics' ? 'Chính trị' : r.subjectId}
                    </span>
                    {r.isSample && (
                      <span className="text-[10px] font-bold bg-orange-50 text-orange-600 px-2 py-0.5 rounded uppercase flex items-center gap-1">
                        <Star className="w-3 h-3" /> Bài tập mẫu
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">Tải lên: {new Date(r.createdAt).toLocaleDateString('vi-VN')}</p>
                </div>
              </div>
            </div>
          ))}
          {resources.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              Chưa có tài liệu nào được tải lên.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
