import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { Quiz, QuizResult, Resource } from '../types';
import { Brain, TrendingUp, AlertTriangle, CheckCircle, BookOpen, User } from 'lucide-react';
import { analyzePerformance } from '../lib/ai';
import ReactMarkdown from 'react-markdown';

export default function AnalysisAI() {
  const { user } = useAuth();
  const [results, setResults] = useState<QuizResult[]>([]);
  const [quizzes, setQuizzes] = useState<Record<string, Quiz>>({});
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredStudents = allStudents.filter(s => 
    s.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (user?.role === 'student') {
      fetchStudentResults(user.uid);
    } else {
      fetchStudents();
    }
  }, [user]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'student'));
      const snapshot = await getDocs(q);
      setAllStudents(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentResults = async (userId: string) => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'quizResults'), 
        where('studentId', '==', userId),
        orderBy('completedAt', 'desc'),
        limit(10)
      );
      const snapshot = await getDocs(q);
      const resultsData = snapshot.docs.map(doc => doc.data() as QuizResult);
      setResults(resultsData);

      // Fetch quiz details
      const quizIds = [...new Set(resultsData.map(r => r.quizId))];
      const quizMap: Record<string, Quiz> = {};
      
      const { getDoc, doc } = await import('firebase/firestore');
      for (const id of quizIds) {
        try {
          const qDoc = await getDoc(doc(db, 'quizzes', id));
          if (qDoc.exists()) {
            quizMap[id] = { id: qDoc.id, ...qDoc.data() } as Quiz;
          }
        } catch (err) {
          console.error(`Error fetching quiz ${id}:`, err);
        }
      }
      setQuizzes(quizMap);
    } catch (error) {
      console.error("Error fetching results:", error);
    } finally {
      setLoading(false);
    }
  };

  const runAIAnalysis = async () => {
    if (results.length === 0) return;
    
    setIsAnalyzing(true);
    try {
      // Fetch AI Resources context
      const resourcesSnapshot = await getDocs(collection(db, 'resources'));
      const resources = resourcesSnapshot.docs.map(doc => doc.data() as Resource);
      const resourceContext = resources.map(r => `Tên: ${r.title}, Nội dung: ${r.description}`).join('\n');

      const performanceData = results.map(r => {
        const quiz = quizzes[r.quizId];
        if (!quiz) return '';
        
        const wrongQuestions = quiz.questions.filter((_, idx) => r.userAnswers && r.userAnswers[idx] !== quiz.questions[idx].correctOptionIndex);
        return `Bài thi: ${quiz.title}, Điểm: ${r.score}/${r.totalQuestions}. Các câu sai: ${wrongQuestions.map(q => q.text).join('; ')}`;
      }).filter(text => text !== '').join('\n');

      // Fetch Chat History & Extra Stats
      const targetStudentId = user?.role === 'student' ? user.uid : selectedStudent;
      let chatHistoryText = "";
      let extraStats = "";

      if (targetStudentId) {
        // Fetch User Stats (Access Count)
        const { getDoc, doc } = await import('firebase/firestore');
        const userDoc = await getDoc(doc(db, 'users', targetStudentId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          extraStats = `Số lần truy cập kho tài liệu học tập: ${userData.resourceAccessCount || 0}`;
        }

        const chatQ = query(
          collection(db, 'chatMessages'),
          where('studentId', '==', targetStudentId)
        );
        const chatSnapshot = await getDocs(chatQ);
        // Order locally and limit
        const chatDocs = chatSnapshot.docs
          .map(doc => doc.data())
          .sort((a, b) => b.timestamp - a.timestamp) // Descending
          .slice(0, 30) // Get the last 30
          .reverse(); // Back to chronological for reading
          
        chatHistoryText = chatDocs.map(c => `${c.role === 'user' ? 'Sinh viên' : 'AI'}: ${c.content}`).join('\n\n');
      }

      const analysisResult = await analyzePerformance(performanceData, resourceContext, chatHistoryText, extraStats);
      setAnalysis(analysisResult || "Không thể tạo phân tích.");
    } catch (error) {
      console.error("AI Analysis Error:", error);
      setAnalysis("Không thể thực hiện phân tích lúc này. Vui lòng thử lại sau.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
            <Brain className="w-8 h-8 text-blue-600" />
            AI Phân tích học tập
          </h1>
          <p className="text-gray-500">Phân tích chuyên sâu kết quả học tập bằng Trí tuệ nhân tạo</p>
        </div>
        
        {user?.role !== 'student' && (
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative group">
              <input
                type="text"
                placeholder="Tìm tên sinh viên..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white rounded-2xl shadow-sm border border-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all w-full md:w-64"
              />
              <User className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-blue-500" />
            </div>

            <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
              <select 
                className="bg-transparent border-none focus:ring-0 font-bold text-gray-700 pr-8 min-w-[200px]"
                onChange={(e) => {
                  setSelectedStudent(e.target.value);
                  fetchStudentResults(e.target.value);
                  setAnalysis('');
                }}
                value={selectedStudent || ''}
              >
                <option value="">Chọn sinh viên ({filteredStudents.length})</option>
                {filteredStudents.map(s => (
                  <option key={s.uid} value={s.uid}>{s.displayName}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </header>

      <div className="space-y-8">
        {/* Statistics Cards - Full Width Top Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
              <TrendingUp className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Điểm số trung bình</p>
              <p className="text-2xl font-black text-gray-900">
                {results.length > 0 ? (results.reduce((acc, r) => acc + (r.score / r.totalQuestions), 0) / results.length * 10).toFixed(1) : 0}
                <span className="text-sm text-gray-400 font-bold ml-1">/ 10</span>
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-600">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Câu hỏi hay sai</p>
              <p className="text-2xl font-black text-gray-900">
                {results.reduce((acc, r) => acc + (r.totalQuestions - r.score), 0)}
                <span className="text-sm text-gray-400 font-bold ml-1">Lỗi sai</span>
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Side: Recent Results List (Narrower) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden h-fit">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Kết quả bài thi gần nhất
                </h3>
              </div>
              <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
                {results.length > 0 ? (
                  results.map(r => (
                    <div key={r.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-gray-900 line-clamp-1">{quizzes[r.quizId]?.title || 'Đang tải...'}</h4>
                        <p className="font-black text-blue-600 shrink-0">{((r.score / r.totalQuestions) * 10).toFixed(1)} <span className="text-[10px] text-gray-400">đ</span></p>
                      </div>
                      <div className="flex items-center justify-between text-xs font-bold text-gray-400">
                        <span>{new Date(r.completedAt).toLocaleDateString()}</span>
                        <span>{r.score}/{r.totalQuestions} câu</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center text-gray-400 italic">Chưa có kết quả nào để hiển thị</div>
                )}
              </div>
            </div>
          </div>

          {/* Right Side: AI Analysis (Wider) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-8 rounded-3xl text-white shadow-xl shadow-blue-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                    <Brain className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black">Chuyên gia AI phân tích</h3>
                    <p className="text-blue-100 text-sm font-medium opacity-80">Phân tích sâu lỗ hổng kiến thức</p>
                  </div>
                </div>
                
                <button
                  onClick={runAIAnalysis}
                  disabled={isAnalyzing || results.length === 0}
                  className={`px-8 py-4 bg-white text-blue-700 rounded-2xl font-black shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 shrink-0 ${isAnalyzing ? 'opacity-50' : ''}`}
                >
                  {isAnalyzing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                      ĐANG PHÂN TÍCH...
                    </>
                  ) : (
                    <>
                      BẮT ĐẦU PHÂN TÍCH
                    </>
                  )}
                </button>
              </div>
              
              {!analysis && !isAnalyzing && (
                <div className="mt-8 pt-6 border-t border-white/10">
                  <p className="text-blue-100 leading-relaxed text-lg">
                    Hệ thống sẽ tổng hợp kết quả của {results.length} bài thi gần nhất để đưa ra lộ trình học tập cá nhân hóa dành riêng cho bạn.
                  </p>
                </div>
              )}
            </div>

            {analysis && (
              <div className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-2 mb-8 pb-4 border-b border-gray-100">
                  <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
                  <h3 className="text-xl font-black text-gray-900">Báo cáo phân tích chi tiết</h3>
                </div>
                <div className="prose prose-blue max-w-none prose-p:leading-relaxed prose-headings:font-black prose-li:marker:text-blue-600">
                  <ReactMarkdown>{analysis}</ReactMarkdown>
                </div>
              </div>
            )}
            
            {isAnalyzing && !analysis && (
              <div className="bg-white p-20 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
                  <Brain className="w-8 h-8 text-blue-600 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900">AI đang xử lý dữ liệu</h4>
                  <p className="text-gray-500 max-w-xs">Chúng tôi đang đối chiếu kết quả của bạn với kho tài liệu để đưa ra lời khuyên...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
