import React, { useState, useEffect } from 'react';
import { Quiz, QuizResult } from '../types';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { ArrowLeft, Clock, AlertTriangle, CheckCircle2, Users, BarChart3 } from 'lucide-react';

interface QuizManagerProps {
  quiz: Quiz;
  onBack: () => void;
}

export default function QuizManager({ quiz, onBack }: QuizManagerProps) {
  const [results, setResults] = useState<QuizResult[]>([]);
  const [activeTab, setActiveTab] = useState<'structure' | 'results' | 'stats'>('structure');

  const questionStats = React.useMemo(() => {
    if (!results.length) return [];
    
    return (quiz.questions || []).map((q, qIdx) => {
      const wrongResults = results.filter(r => r.userAnswers && r.userAnswers[qIdx] !== q.correctOptionIndex);
      const wrongCount = wrongResults.length;
      const wrongPercentage = results.length > 0 ? (wrongCount / results.length) * 100 : 0;
      
      const optionCounts = (q.options || []).map((_, optIdx) => {
        const count = results.filter(r => r.userAnswers && r.userAnswers[qIdx] === optIdx).length;
        return {
          index: optIdx,
          count,
          percentage: results.length > 0 ? (count / results.length) * 100 : 0
        };
      });

      return {
        text: q.text,
        wrongCount,
        wrongPercentage,
        optionCounts,
        correctIndex: q.correctOptionIndex
      };
    }).sort((a, b) => b.wrongCount - a.wrongCount);
  }, [results, quiz.questions]);

  useEffect(() => {
    const q = query(collection(db, 'quizResults'), where('quizId', '==', quiz.id));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const resultsData = snapshot.docs.map(doc => doc.data() as QuizResult);
      
      // Fetch user details for each student to get MSV and Lớp
      const studentIds = [...new Set(resultsData.map(r => r.studentId))];
      const studentProfiles: Record<string, any> = {};
      
      // We'll fetch them one by one or in chunks if needed, but for now let's assume a reasonable number
      // In a real app we might want to store this info in the result itself or use a more efficient way
      
      setResults(resultsData.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (a.timeTaken || 0) - (b.timeTaken || 0);
      }));
    });
    return () => unsubscribe();
  }, [quiz.id]);

  // To get MSV and Lớp, we should ideally have them in the result or fetch them.
  // Since I can't easily do async fetch inside the render or without a more complex state,
  // I will try to fetch them and store in a state.
  const [studentDetails, setStudentDetails] = useState<Record<string, { studentId?: string, classId?: string }>>({});

  useEffect(() => {
    if (results.length === 0) return;
    
    const fetchDetails = async () => {
      const newDetails = { ...studentDetails };
      const uidsToFetch = results.filter(r => !newDetails[r.studentId]).map(r => r.studentId);
      
      if (uidsToFetch.length === 0) return;

      // Firestore doesn't support 'in' with more than 30 elements easily, but let's assume small class for now
      // Or just fetch them.
      for (const uid of uidsToFetch) {
        try {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            newDetails[uid] = {
              studentId: data.studentId,
              classId: data.classId
            };
          }
        } catch (e) {
          console.error("Error fetching student details:", e);
        }
      }
      setStudentDetails(newDetails);
    };

    fetchDetails();
  }, [results]);

  return (
    <div className="space-y-6">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-gray-500 hover:text-red-600 transition-colors font-bold"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Quay lại danh sách</span>
      </button>

      <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-8 border-b border-gray-100 bg-gradient-to-r from-red-50 to-transparent">
          <h2 className="text-3xl font-black text-gray-900 mb-2">{quiz.title}</h2>
          <p className="text-red-600 font-bold">
            {quiz.questions.length} câu hỏi • {quiz.timeLimit} phút
          </p>
        </div>

        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('structure')}
            className={`flex-1 py-4 font-bold text-sm transition-colors ${
              activeTab === 'structure' 
                ? 'text-red-600 border-b-2 border-red-600 bg-red-50/50' 
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            Bố cục câu hỏi
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={`flex-1 py-4 font-bold text-sm transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'results' 
                ? 'text-red-600 border-b-2 border-red-600 bg-red-50/50' 
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Users className="w-4 h-4" />
            Kết quả sinh viên ({results.length})
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-4 font-bold text-sm transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'stats' 
                ? 'text-red-600 border-b-2 border-red-600 bg-red-50/50' 
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Thống kê câu hỏi
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'structure' && (
            <div className="space-y-6">
              {(quiz.questions || []).map((q, i) => (
                <div key={i} className="p-6 bg-gray-50 rounded-xl border border-gray-100">
                  <h3 className="font-bold text-gray-800 mb-4">Câu {i + 1}: {q?.text}</h3>
                  <div className="grid gap-3">
                    {(q?.options || []).map((opt, j) => (
                      <div 
                        key={j} 
                        className={`p-3 rounded-lg border flex items-center gap-3 ${
                          j === q.correctOptionIndex 
                            ? 'bg-green-50 border-green-200 text-green-800 font-medium' 
                            : 'bg-white border-gray-200 text-gray-600'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          j === q.correctOptionIndex ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {String.fromCharCode(65 + j)}
                        </div>
                        {opt}
                        {j === q.correctOptionIndex && <CheckCircle2 className="w-5 h-5 text-green-500 ml-auto" />}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'results' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="p-4 font-bold text-gray-600">Sinh viên</th>
                    <th className="p-4 font-bold text-gray-600">Điểm số</th>
                    <th className="p-4 font-bold text-gray-600">Thời gian làm</th>
                    <th className="p-4 font-bold text-gray-600">Vi phạm</th>
                    <th className="p-4 font-bold text-gray-600">Ngày nộp</th>
                  </tr>
                </thead>
                <tbody>
                  {results.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-500">
                        Chưa có sinh viên nào làm bài thi này.
                      </td>
                    </tr>
                  ) : (
                    results.map((r, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-800">{r.studentName || 'Ẩn danh'}</span>
                            <span className="text-xs text-gray-400">
                              {studentDetails[r.studentId]?.studentId ? `MSV: ${studentDetails[r.studentId].studentId}` : ''}
                              {studentDetails[r.studentId]?.classId ? ` • Lớp: ${studentDetails[r.studentId].classId}` : ''}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-blue-600">
                              {((r.score / (r.totalQuestions || 1)) * 10).toFixed(1)} điểm
                            </span>
                            <span className="text-xs text-gray-500">
                              ({r.score}/{r.totalQuestions || 0} câu đúng)
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-gray-600 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          {r.timeTaken ? `${Math.floor(r.timeTaken / 60)}p ${r.timeTaken % 60}s` : 'N/A'}
                        </td>
                        <td className="p-4">
                          {((r.violationCount && r.violationCount > 0) || (r.screenshotViolations && r.screenshotViolations > 0)) ? (
                            <div className="flex flex-col gap-1.5">
                              {r.violationCount && r.violationCount > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-xs font-medium w-fit">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  {r.violationCount} lần thoát màn hình
                                </span>
                              ) : null}
                              {r.screenshotViolations && r.screenshotViolations > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 text-xs font-medium w-fit">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  {r.screenshotViolations} lần chụp màn hình
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 text-green-600 text-sm font-medium">
                              <CheckCircle2 className="w-4 h-4" />
                              Không vi phạm
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-gray-500 text-sm">
                          {new Date(r.completedAt).toLocaleString('vi-VN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-blue-900">Phân tích câu hỏi sai</h3>
                  <p className="text-blue-700 text-sm">Các câu hỏi được sắp xếp theo tỷ lệ sai nhiều nhất</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Tổng số bài làm</p>
                  <p className="text-3xl font-black text-blue-600">{results.length}</p>
                </div>
              </div>

              <div className="grid gap-6">
                {questionStats && questionStats.map((stat, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900 text-lg leading-relaxed">{stat.text}</h4>
                      </div>
                      <div className="shrink-0 flex items-center gap-3">
                        <div className="bg-red-50 px-4 py-2 rounded-xl text-center">
                          <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Tỷ lệ sai</p>
                          <p className="text-xl font-black text-red-600">{stat.wrongPercentage.toFixed(0)}%</p>
                        </div>
                        <div className="bg-gray-50 px-4 py-2 rounded-xl text-center">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Số người sai</p>
                          <p className="text-xl font-black text-gray-900">{stat.wrongCount}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Phân bổ đáp án:</p>
                      {stat.optionCounts && stat.optionCounts.map((opt, optIdx) => (
                        <div key={optIdx} className="space-y-1">
                          <div className="flex justify-between text-sm mb-1">
                            <span className={`font-medium ${optIdx === stat.correctIndex ? 'text-green-600' : 'text-gray-600'}`}>
                              {String.fromCharCode(65 + optIdx)}. {quiz?.questions?.find(q => q.text === stat.text)?.options?.[optIdx] || 'Option missing'}
                              {optIdx === stat.correctIndex && <span className="ml-2 text-[10px] font-bold uppercase">(Đáp án đúng)</span>}
                            </span>
                            <span className="font-bold text-gray-400">{opt.percentage.toFixed(0)}% ({opt.count})</span>
                          </div>
                          <div className="h-2 bg-gray-50 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-1000 ${
                                optIdx === stat.correctIndex ? 'bg-green-500' : 'bg-red-200'
                              }`} 
                              style={{ width: `${opt.percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
