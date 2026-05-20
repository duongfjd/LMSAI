import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db, storage } from '../lib/firebase';
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, getBytes } from 'firebase/storage';
import { Assignment, Submission } from '../types';
import type { User } from '../types';
import { Upload, FileText, CheckCircle2, Clock, User as UserIcon, Download, ExternalLink, Image as ImageIcon, MessageSquare, PlusCircle, X, Maximize2 } from 'lucide-react';
import { formatDate } from '../lib/utils';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import DocumentViewer from './DocumentViewer';
import ExcelJS from 'exceljs';

export default function AssignmentManager() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [allUsers, setAllUsers] = useState<Record<string, User>>({});
  const [uploading, setUploading] = useState(false);
  const [gradingState, setGradingState] = useState<Record<string, { grade: string, feedback: string }>>({});

  // Create Assignment State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDate, setNewDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [fullScreenFile, setFullScreenFile] = useState<{ file: { url?: string; name: string; type: string; chunkCount?: number }, submissionId?: string, fileIndex?: number, studentId?: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'assignments'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAssignments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Assignment)));
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (user?.role === 'teacher' || user?.role === 'admin') {
      const q = query(collection(db, 'submissions'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission)));
      });
      
      const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        const usersObj: Record<string, User> = {};
        snapshot.docs.forEach(doc => {
          usersObj[doc.id] = doc.data() as User;
        });
        setAllUsers(usersObj);
      });
      
      return () => {
        unsubscribe();
        unsubscribeUsers();
      };
    } else if (user?.role === 'student') {
      const q = query(collection(db, 'submissions'), where('studentId', '==', user.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission)));
      });
      return () => unsubscribe();
    }
  }, [user]);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newDate) return;
    
    setCreating(true);
    try {
      const assignment: Omit<Assignment, 'id'> = {
        title: newTitle,
        description: newDesc,
        subjectId: 'politics', // Defaulting to politics for this app
        dueDate: new Date(newDate).getTime(),
        createdAt: Date.now()
      };
      await addDoc(collection(db, 'assignments'), assignment);
      setShowCreateForm(false);
      setNewTitle('');
      setNewDesc('');
      setNewDate('');
      alert("Đã tạo bài tập mới!");
    } catch (error) {
      console.error("Create Assignment Error:", error);
      alert("Lỗi khi tạo bài tập.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'assignments', id));
      setDeleteConfirmId(null);
    } catch (error) {
      console.error("Delete Assignment Error:", error);
      alert("Lỗi khi xóa bài tập.");
    }
  };

  const handleDeleteAllSubmissions = async (assignmentId?: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa TẤT CẢ bài nộp của sinh viên không? Hành động này không thể hoàn tác.")) {
      try {
        const toDelete = assignmentId 
          ? submissions.filter(s => s.assignmentId === assignmentId)
          : submissions;
        const promises = toDelete.map(s => deleteDoc(doc(db, 'submissions', s.id)));
        await Promise.all(promises);
        alert("Đã xóa tất cả bài nộp!");
      } catch (error) {
        console.error("Delete All Submissions Error:", error);
        alert("Lỗi khi xóa bài nộp.");
      }
    }
  };

  const handleSubmission = async (assignmentId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    setUploading(true);
    try {
      const fileMetadataList = [];
      const timestamp = Date.now();

      for (let i = 0; i < files.length; i++) {
        let file = files[i];
        
        // Compress images to ensure they bypass size limits and upload fast
        if (file.type.startsWith('image/')) {
          try {
            const { compressImage } = await import('../lib/utils');
            file = await compressImage(file, 1600, 0.7) as File;
          } catch (compressError) {
            console.warn("Could not compress image:", compressError);
          }
        }

        const numbering = String(i + 1).padStart(2, '0');
        const storagePath = `submissions/${user.uid}/${assignmentId}/${timestamp}_${numbering}_${file.name}`;
        const fileRef = ref(storage, storagePath);
        
        let fileUrl = "";
        
        try {
          const uploadPromise = uploadBytes(fileRef, file).then(async () => {
            return await getDownloadURL(fileRef);
          });
          
          // 8 second timeout
          const timeoutPromise = new Promise<string>((_, reject) => {
            setTimeout(() => reject(new Error("STORAGE_TIMEOUT")), 8000);
          });
          
          fileUrl = await Promise.race([uploadPromise, timeoutPromise]);
        } catch (storageError) {
          console.warn("Storage upload timed out/failed, falling back to base64...", storageError);
          
          const base64Url = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          // Guard against > 1MB limits in Firestore
          if (base64Url.length > 950 * 1024) {
             throw new Error(`File "${file.name}" quá lớn (>1MB) sau khi nén. Máy chủ tạm thời chưa hỗ trợ file khổng lồ.`);
          }
          fileUrl = base64Url;
        }

        fileMetadataList.push({
          name: file.name,
          type: file.type,
          url: fileUrl,
          submittedAt: timestamp
        });
      }

      const submission: Omit<Submission, 'id'> = {
        assignmentId,
        studentId: user.uid,
        studentName: user.displayName || 'Unknown Student',
        files: fileMetadataList,
        submittedAt: timestamp,
      };

      const existingSub = submissions.find(s => s.assignmentId === assignmentId && s.studentId === user.uid);

      if (existingSub) {
        await updateDoc(doc(db, 'submissions', existingSub.id), {
          files: fileMetadataList,
          submittedAt: timestamp
        });
      } else {
        await addDoc(collection(db, 'submissions'), submission);
      }
      
      alert("Đã nộp bài thành công!");
    } catch (error: any) {
      console.error("Submission Error:", error);
      alert(error.message || "Lỗi khi nộp bài. Vui lòng thử lại.");
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleGradeSubmit = async (submissionId: string) => {
    const state = gradingState[submissionId];
    if (!state || (!state.grade && !state.feedback)) return;

    try {
      await updateDoc(doc(db, 'submissions', submissionId), {
        grade: state.grade ? Number(state.grade) : null,
        feedback: state.feedback || ''
      });
      alert("Đã lưu điểm và nhận xét!");
    } catch (error) {
      console.error("Grade Error:", error);
      alert("Lỗi khi lưu điểm.");
    }
  };

  const downloadStudentSubmission = async (submission: Submission) => {
    try {
      const zip = new JSZip();
      const folderName = submission.studentName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const folder = zip.folder(folderName);
      
      if (!folder) return;

      for (let i = 0; i < submission.files.length; i++) {
        const file = submission.files[i];
        const numbering = String(i + 1).padStart(2, '0');
        const fileName = `${numbering}_${file.name}`;
        
        try {
          const response = await fetch(file.url);
          const blob = await response.blob();
          folder.file(fileName, blob);
        } catch (err) {
          console.error(`Failed to fetch file: ${file.name}`, err);
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `${folderName}_submission.zip`);
    } catch (error) {
      console.error("Download Error:", error);
      alert("Lỗi khi tạo file nén.");
    }
  };

  const downloadAllSubmissions = async (assignment: Assignment) => {
    try {
      const zip = new JSZip();
      const assignmentSubmissions = submissions.filter(s => s.assignmentId === assignment.id);
      
      if (assignmentSubmissions.length === 0) {
        alert("Chưa có bài nộp nào.");
        return;
      }

      const mainFolder = zip.folder(assignment.title.replace(/[^a-z0-9]/gi, '_').toLowerCase());
      if (!mainFolder) return;

      for (const s of assignmentSubmissions) {
        const studentFolder = mainFolder.folder(s.studentName.replace(/[^a-z0-9]/gi, '_').toLowerCase());
        if (!studentFolder) continue;

        for (let i = 0; i < s.files.length; i++) {
          const file = s.files[i];
          const numbering = String(i + 1).padStart(2, '0');
          const fileName = `${numbering}_${file.name}`;
          
          try {
            const response = await fetch(file.url);
            const blob = await response.blob();
            studentFolder.file(fileName, blob);
          } catch (err) {
            console.error(`Failed to fetch file for ${s.studentName}: ${file.name}`, err);
          }
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `Tap_hop_bai_nop_${assignment.title}.zip`);
    } catch (error) {
      console.error("Download All Error:", error);
      alert("Lỗi khi tạo file nén tổng hợp.");
    }
  };

  const handleExcelUpload = async (assignment: Assignment, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(data);
      const worksheet = workbook.worksheets[0];
      
      if (!worksheet) {
        alert("File Excel không có sheet nào!");
        return;
      }

      const getCellText = (cell: ExcelJS.Cell) => {
        if (!cell || cell.value === null || cell.value === undefined) return '';
        if (typeof cell.value === 'object') {
          if ('richText' in cell.value && Array.isArray(cell.value.richText)) {
            return cell.value.richText.map((rt: any) => rt.text).join('');
          }
          if ('result' in cell.value) {
             return cell.value.result !== null && cell.value.result !== undefined ? String(cell.value.result) : '';
          }
          if (cell.value instanceof Date) {
            return cell.value.toISOString();
          }
        }
        return String(cell.value);
      };

      let headerRowIndex = -1;
      let nameColIndex = -1;
      let msvColIndex = -1;
      
      worksheet.eachRow((row, rowNumber) => {
        if (headerRowIndex !== -1) return;
        
        row.eachCell((cell, colNumber) => {
          const rawText = getCellText(cell);
          const val = rawText ? rawText.toLowerCase().trim() : '';
          if (val.includes('họ tên') || val.includes('họ và tên') || val === 'tên') {
            nameColIndex = colNumber;
          }
          if (val.includes('msv') || val.includes('mã sinh viên') || val === 'mã sv' || val.includes('mã sv')) {
            msvColIndex = colNumber;
          }
        });

        if (nameColIndex !== -1 || msvColIndex !== -1) {
          headerRowIndex = rowNumber;
        }
      });

      if (headerRowIndex === -1) {
        alert("Không tìm thấy hàng tiêu đề chứa cột 'Họ tên' hoặc 'MSV' trong file Excel.");
        return;
      }

      const headerRow = worksheet.getRow(headerRowIndex);
      let assignmentColIndex = -1;
      
      headerRow.eachCell((cell, colNumber) => {
        const rawText = getCellText(cell);
        const val = rawText ? rawText.toLowerCase().trim() : '';
        if (val.includes(assignment.title.toLowerCase().trim())) {
          assignmentColIndex = colNumber;
        }
      });

      if (assignmentColIndex === -1) {
        // If column doesn't exist, add it to the end (next empty column)
        assignmentColIndex = headerRow.actualCellCount ? headerRow.actualCellCount + 1 : 1;
        // Make sure it's after the max cell count to not overwrite
        const lastCol = worksheet.actualColumnCount;
        if (assignmentColIndex <= lastCol) {
           assignmentColIndex = lastCol + 1;
        }

        const newCell = headerRow.getCell(assignmentColIndex);
        newCell.value = assignment.title;
        // Copy style from name column if possible
        if (nameColIndex !== -1) {
           newCell.style = headerRow.getCell(nameColIndex).style;
        }
        headerRow.commit();
      }

      const assignmentSubmissions = submissions.filter(s => s.assignmentId === assignment.id);

      // Iterate from the next row up to maximum row count to ensure grid styles are extended
      const maxRows = worksheet.rowCount;
      for (let rowNumber = headerRowIndex + 1; rowNumber <= maxRows; rowNumber++) {
        const row = worksheet.getRow(rowNumber);

        const nameCell = nameColIndex !== -1 ? row.getCell(nameColIndex) : null;
        const msvCell = msvColIndex !== -1 ? row.getCell(msvColIndex) : null;

        const rawNameText = nameCell ? getCellText(nameCell) : '';
        const rawMsvText = msvCell ? getCellText(msvCell) : '';

        const studentName = rawNameText ? rawNameText.toLowerCase().trim() : '';
        const msv = rawMsvText ? rawMsvText.toLowerCase().trim() : '';

        const targetCell = row.getCell(assignmentColIndex);
        
        // Always copy style (borders, alignments, etc.) for body cells regardless of content
        const sourceStyleCell = nameCell || msvCell;
        if (sourceStyleCell && sourceStyleCell.style) {
           targetCell.style = JSON.parse(JSON.stringify(sourceStyleCell.style));
        }

        const hasContent = studentName || msv;
        if (hasContent) {
          const submission = assignmentSubmissions.find(s => {
            const u = allUsers[s.studentId];
            if (!u) return false;
            
            const uMsv = u.studentId?.trim().toLowerCase();
            const matchMSV = msv && uMsv === msv;
            
            const uName = u.displayName?.trim().toLowerCase();
            const matchName = studentName && uName === studentName;
            
            return matchMSV || matchName;
          });

          if (submission && submission.grade !== undefined && submission.grade !== null) {
            targetCell.value = Number(submission.grade) || submission.grade;
          }
        }
        
        row.commit();
      }

      const excelBuffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `Diem_${assignment.title}.xlsx`);
      
      alert("Đã điền điểm thành công và tải xuống file!");
    } catch (error) {
      console.error("Excel processing error:", error);
      alert("Lỗi khi xử lý file Excel.");
    }
    
    // Reset input
    e.target.value = '';
  };

  return (
    <div className="space-y-8">
      {(user?.role === 'teacher' || user?.role === 'admin') && (
        <div className="bg-white/90 backdrop-blur-sm p-8 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-gray-800 flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-red-50 to-red-100 rounded-xl flex items-center justify-center shadow-sm">
                <PlusCircle className="w-6 h-6 text-red-600" />
              </div>
              Thêm mới bài tập
            </h2>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-6 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors shadow-sm"
            >
              {showCreateForm ? 'Hủy' : 'Tạo bài tập'}
            </button>
          </div>

          {showCreateForm && (
            <form onSubmit={handleCreateAssignment} className="space-y-6 border-t border-gray-100 pt-8 mt-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Tiêu đề bài tập</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50 focus:bg-white transition-all"
                  placeholder="VD: Tiểu luận Triết học Mác-Lênin"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Mô tả / Yêu cầu</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50 focus:bg-white transition-all min-h-[120px]"
                  placeholder="Nhập yêu cầu chi tiết cho sinh viên..."
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Hạn nộp</label>
                <input
                  type="datetime-local"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50 focus:bg-white transition-all"
                />
              </div>
              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={creating}
                  className="px-8 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-bold hover:from-red-700 hover:to-red-800 disabled:opacity-50 transition-all shadow-md shadow-red-200"
                >
                  {creating ? 'Đang tạo...' : 'Xác nhận tạo'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {fullScreenFile && (
        <div className="fixed inset-0 z-[200] bg-gray-900/95 backdrop-blur-sm flex flex-col">
          <div className="flex justify-between items-center p-4 bg-gray-900 text-white">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-blue-400" />
              <span className="font-bold">{fullScreenFile.file.name}</span>
            </div>
            <div className="flex items-center gap-4">
              {fullScreenFile.file.url && (
                <a
                  href={fullScreenFile.file.url}
                  download={fullScreenFile.file.name}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                  title="Tải xuống"
                >
                  <Download className="w-4 h-4" /> Tải xuống
                </a>
              )}
              <button
                onClick={() => setFullScreenFile(null)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
                title="Đóng"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 md:p-8 flex justify-center bg-gray-100">
            <div className="w-full max-w-5xl bg-white shadow-2xl rounded-xl overflow-hidden">
              <DocumentViewer 
                file={fullScreenFile.file} 
                submissionId={fullScreenFile.submissionId} 
                fileIndex={fullScreenFile.fileIndex} 
                studentId={fullScreenFile.studentId}
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Assignment List */}
        <div className="bg-white/90 backdrop-blur-sm p-8 rounded-3xl shadow-sm border border-gray-100">
          <h2 className="text-2xl font-black text-gray-800 mb-8 flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl flex items-center justify-center shadow-sm">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            Danh sách bài tập
          </h2>
          <div className="space-y-6">
            {assignments.map(a => (
              <div key={a.id} className="p-6 border border-gray-100 rounded-2xl hover:shadow-md transition-all bg-white group">
                <div className="flex flex-wrap justify-between items-start gap-4 mb-3">
                  <h3 className="font-bold text-gray-800 text-lg group-hover:text-blue-600 transition-colors break-all flex-1 min-w-[200px]">{a.title}</h3>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg">{a.subjectId === 'politics' ? 'Chính trị' : a.subjectId}</span>
                    {(user?.role === 'teacher' || user?.role === 'admin') && (
                      deleteConfirmId === a.id ? (
                        <div className="flex items-center gap-2 bg-red-50 p-1 rounded-lg border border-red-100">
                          <span className="text-[10px] font-bold text-red-600 px-1">Xóa?</span>
                          <button
                            onClick={() => handleDeleteAssignment(a.id)}
                            className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700"
                          >
                            Có
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-1 bg-white text-gray-600 text-xs font-bold rounded border border-gray-200 hover:bg-gray-50"
                          >
                            Không
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(a.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors text-xs font-bold"
                          title="Xóa bài tập"
                        >
                          <X className="w-3.5 h-3.5" /> Xóa
                        </button>
                      )
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-500 mb-6 line-clamp-2">{a.description}</p>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                    <Clock className="w-4 h-4 text-amber-500" /> Hạn nộp: {formatDate(a.dueDate)}
                  </div>
                  {user?.role === 'student' ? (
                    <div className="relative">
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                        onChange={(e) => handleSubmission(a.id, e)}
                        className="hidden"
                        id={`submit-${a.id}`}
                      />
                      <label
                        htmlFor={`submit-${a.id}`}
                        className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl text-sm font-bold hover:from-red-700 hover:to-red-800 cursor-pointer shadow-md shadow-red-200 transition-all"
                      >
                        <Upload className="w-4 h-4" /> Nộp bài
                      </label>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={(e) => handleExcelUpload(a, e)}
                        className="hidden"
                        id={`excel-${a.id}`}
                      />
                      <label
                        htmlFor={`excel-${a.id}`}
                        className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-xl text-sm font-bold hover:bg-green-100 cursor-pointer transition-colors shadow-sm"
                        title="Tải lên file Excel để điền điểm tự động"
                      >
                        <Upload className="w-4 h-4" /> Điền điểm Excel
                      </label>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submissions View (Teacher) or My Submissions (Student) */}
        <div className="bg-white/90 backdrop-blur-sm p-8 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-black text-gray-800 flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-green-50 to-green-100 rounded-xl flex items-center justify-center shadow-sm">
                <CheckCircle2 className="w-6 h-6 text-green-600" /> 
              </div>
              {user?.role === 'student' ? 'Bài đã nộp' : 'Bài nộp của sinh viên'}
            </h2>
          </div>
          <div className="space-y-12">
            {assignments.map(a => {
              const assignmentSubmissions = submissions.filter(s => s.assignmentId === a.id);
              if (assignmentSubmissions.length === 0) return null;

              return (
                <div key={a.id} className="space-y-6">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                    <h3 className="text-xl font-bold text-gray-800">{a.title}</h3>
                    {(user?.role === 'teacher' || user?.role === 'admin') && (
                      <button
                        onClick={() => downloadAllSubmissions(a)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-sm font-bold hover:bg-blue-100 transition-colors shadow-sm"
                      >
                        <Download className="w-4 h-4" /> Tải tất cả ZIP
                      </button>
                    )}
                  </div>
                  {assignmentSubmissions.map(s => (
                    <div key={s.id} className="p-6 border border-gray-100 rounded-2xl bg-white shadow-sm hover:shadow-md transition-all">
                      <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                            <UserIcon className="w-5 h-5 text-gray-500" />
                          </div>
                          <span className="font-bold text-gray-800 text-lg">{s.studentName}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-medium text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg">{formatDate(s.submittedAt)}</span>
                          {(user?.role === 'teacher' || user?.role === 'admin') && (
                            <button
                              onClick={() => downloadStudentSubmission(s)}
                              className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-xl text-sm font-bold hover:bg-green-100 transition-colors shadow-sm"
                            >
                              <Download className="w-4 h-4" /> Tải bài nộp
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-4 mb-6">
                        {s.files.map((f, i) => (
                          <div key={i} className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden group">
                            <div className="flex items-center justify-between p-4 bg-white border-b border-gray-100">
                              <div className="flex items-center gap-4 overflow-hidden">
                                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                                  <FileText className="w-5 h-5 text-blue-600" />
                                </div>
                                <span className="text-sm font-bold text-gray-700 truncate">{f.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setFullScreenFile({ file: f, submissionId: s.id, fileIndex: i, studentId: s.studentId })}
                                  className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                                  title="Phóng to"
                                >
                                  <Maximize2 className="w-5 h-5" />
                                </button>
                                <a
                                  href={f.url}
                                  download={f.name}
                                  className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                                  title="Tải xuống"
                                >
                                  <Download className="w-5 h-5" />
                                </a>
                              </div>
                            </div>
                            <div className="p-4">
                              <DocumentViewer file={f} submissionId={s.id} fileIndex={i} studentId={s.studentId} />
                            </div>
                          </div>
                        ))}
                      </div>

                      {(user?.role === 'teacher' || user?.role === 'admin') ? (
                        <div className="mt-6 pt-6 border-t border-gray-100 space-y-4">
                          <div className="flex gap-4">
                            <input
                              type="number"
                              placeholder="Điểm (0-10)"
                              value={gradingState[s.id]?.grade || s.grade || ''}
                              onChange={(e) => setGradingState(prev => ({ ...prev, [s.id]: { ...prev[s.id], grade: e.target.value } }))}
                              className="w-28 px-4 py-3 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50 focus:bg-white transition-all"
                              min="0"
                              max="10"
                              step="0.1"
                            />
                            <input
                              type="text"
                              placeholder="Nhận xét bài làm..."
                              value={gradingState[s.id]?.feedback || s.feedback || ''}
                              onChange={(e) => setGradingState(prev => ({ ...prev, [s.id]: { ...prev[s.id], feedback: e.target.value } }))}
                              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50 focus:bg-white transition-all"
                            />
                            <button 
                              onClick={() => handleGradeSubmit(s.id)}
                              className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl text-sm font-bold hover:from-red-700 hover:to-red-800 transition-all shadow-md shadow-red-200 whitespace-nowrap"
                            >
                              Lưu điểm
                            </button>
                          </div>
                        </div>
                      ) : (
                        (s.grade !== undefined || s.feedback) && (
                          <div className="mt-6 pt-6 border-t border-gray-100 bg-gradient-to-br from-red-50 to-transparent p-6 rounded-2xl">
                            <h4 className="font-black text-gray-800 mb-4 flex items-center gap-2">
                              <MessageSquare className="w-5 h-5 text-red-600" />
                              Kết quả chấm điểm
                            </h4>
                            {s.grade !== undefined && (
                              <div className="flex items-center gap-3 mb-2">
                                <span className="font-bold text-gray-600">Điểm số:</span> 
                                <span className="font-black text-red-600 text-2xl bg-white px-3 py-1 rounded-lg shadow-sm">{s.grade}/10</span>
                              </div>
                            )}
                            {s.feedback && (
                              <p className="text-gray-700 bg-white p-4 rounded-xl shadow-sm border border-red-100 mt-3"><span className="font-bold text-gray-800 block mb-1">Nhận xét:</span> {s.feedback}</p>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
            {submissions.length === 0 && (
              <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                Chưa có bài nộp nào.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
