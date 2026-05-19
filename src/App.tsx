import React, { useState, useEffect } from 'react';
import { useAuth } from './lib/AuthContext';
import { db } from './lib/firebase';
import { collection, onSnapshot, query, where, deleteDoc, doc, addDoc, setDoc, increment } from 'firebase/firestore';
import { Quiz, Subject, QuizResult } from './types';
import PoliticalAI from './components/PoliticalAI';
import QuizPlayer from './components/QuizPlayer';
import QuizCreator from './components/QuizCreator';
import QuizManager from './components/QuizManager';
import AssignmentManager from './components/AssignmentManager';
import ResourceManager from './components/ResourceManager';
import AnalysisAI from './components/AnalysisAI';
import KnowledgeBase from './components/KnowledgeBase';
import MainFunctionsStats from './components/MainFunctionsStats';
import Onboarding from './components/Onboarding';
import { 
  LayoutDashboard, 
  BookOpen, 
  GraduationCap, 
  FileQuestion, 
  Settings, 
  LogOut, 
  Users, 
  BarChart3, 
  MessageSquareQuote,
  Plus,
  Search,
  Bell,
  User as UserIcon,
  CheckCircle2,
  Database,
  Trash2,
  Scale,
  Lightbulb,
  Briefcase,
  Brain,
  Library,
  Sparkles,
  Zap,
  Frown,
  PartyPopper,
  X,
  Edit2,
  Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const { user, loading, authError, login, signOut, clearError, updateRole, resetProfileSetup } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [userResults, setUserResults] = useState<QuizResult[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [activeManageQuiz, setActiveManageQuiz] = useState<Quiz | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [confirmDeleteQuizId, setConfirmDeleteQuizId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'praise' | 'warning', message: string } | null>(null);

  const isAdmin = user?.email === 'huyabcd2004@gmail.com';

  useEffect(() => {
    if (!user) return;
    
    // Track feature usage
    const trackUsage = async (tab: string) => {
      const featureMap: Record<string, string> = {
        'quizzes': 'quiz_ai',
        'ai-assistant': 'ai_politics',
        'assignments': 'assignment_management',
        'resource-hub': 'resource_library',
        'ai-analysis': 'ai_learning_analysis'
      };
      
      const featureId = featureMap[tab];
      if (featureId) {
        const docRef = doc(db, 'usageStats', featureId);
        await setDoc(docRef, { 
          name: tab, 
          count: increment(1),
          lastAccessed: Date.now()
        }, { merge: true });
      }
    };
    
    trackUsage(activeTab);
    
    // Interval for 30s notifications on quizzes tab
    let intervalId: NodeJS.Timeout;
    if (activeTab === 'quizzes' && user.role === 'student' && userResults.length > 0) {
      intervalId = setInterval(() => {
        const lastResult = userResults[0]; // Already sorted desc inside the snapshot listener
        const score10 = (lastResult.score / lastResult.totalQuestions) * 10;
        if (score10 >= 8) {
          setNotification({ type: 'praise', message: `Tuyệt vời! Ở bài kiểm tra gần nhất bạn đạt ${score10.toFixed(1)} điểm. Hãy giữ vững phong độ nhé! 🎉` });
        } else if (score10 <= 5) {
          setNotification({ type: 'warning', message: `Chú ý! Bài kiểm tra gần nhất bạn chỉ đạt ${score10.toFixed(1)} điểm. Hãy ôn tập lại kỹ hơn hoặc nhờ AI tư vấn nhé! 💪` });
        } else {
          setNotification({ type: 'praise', message: `Bài kiểm tra gần nhất bạn đạt ${score10.toFixed(1)} điểm. Bạn có thể làm tốt hơn nữa! 🚀` });
        }
        
        setTimeout(() => setNotification(null), 6000);
      }, 30000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user, activeTab, userResults]);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'quizzes'));
    const unsubscribeQuizzes = onSnapshot(q, (snapshot) => {
      setQuizzes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz)));
    });

    // Fetch user's quiz results
    const resultsQuery = query(collection(db, 'quizResults'), where('studentId', '==', user.uid));
    const unsubscribeResults = onSnapshot(resultsQuery, (snapshot) => {
      const resultsData = snapshot.docs.map(doc => doc.data() as QuizResult);
      setUserResults(resultsData.sort((a,b) => b.completedAt - a.completedAt));
    });

    return () => {
      unsubscribeQuizzes();
      unsubscribeResults();
    };
  }, [user]);

  const handleDeleteQuiz = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'quizzes', id));
      setConfirmDeleteQuizId(null);
    } catch (error) {
      console.error("Delete Quiz Error:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div 
        className="min-h-screen bg-[#f8fbff] flex flex-col items-center justify-end pb-12 md:pb-20 p-4"
        style={{ 
          backgroundImage: "url('/image_background_login.png')",
          backgroundSize: 'contain',
          backgroundPosition: 'top center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="w-full max-w-[320px] bg-blue-900/10 backdrop-blur-xl rounded-[2rem] shadow-2xl p-6 text-center border-2 border-white/40 transform transition-transform hover:scale-[1.02]">
          <div className="w-14 h-14 bg-white/50 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-white/60">
            <GraduationCap className="w-7 h-7 text-indigo-900" />
          </div>
          <h1 className="text-xl font-black text-indigo-950 mb-1 tracking-tight">Tlu Smart Learning</h1>
          <p className="text-xs text-indigo-900/80 mb-6 font-semibold uppercase tracking-wider">Cổng Học Tập Trực Tuyến</p>
          
          {authError && (
            <div className="mb-4 p-3 bg-red-50/90 border border-red-200 rounded-xl text-red-600 text-xs flex items-center gap-2 text-left shadow-sm">
              <div className="shrink-0 w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                <Settings className="w-3 h-3" />
              </div>
              <p className="font-medium">{authError}</p>
            </div>
          )}

          <button
            onClick={login}
            className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-3 text-sm"
          >
            <UserIcon className="w-4 h-4" /> Đăng nhập bằng Google
          </button>
          <p className="mt-5 text-[9px] text-indigo-900/60 font-medium">Bằng việc đăng nhập, bạn đồng ý với các quy định đào tạo. © Đại học Thủy Lợi</p>
        </div>
      </div>
    );
  }

  if (!user.isProfileComplete) {
    return <Onboarding />;
  }

  if (activeQuiz) {
    return <QuizPlayer quiz={activeQuiz} onComplete={() => setActiveQuiz(null)} />;
  }

  const SidebarItem = ({ id, icon: Icon, label }: { id: string, icon: any, label: string }) => (
    <button
      onClick={() => {
        setActiveTab(id);
        setIsSidebarOpen(false);
      }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        activeTab === id 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
          : 'text-gray-500 hover:bg-gray-100'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-semibold">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar Backdrop Overlay on Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:relative inset-y-0 left-0 w-72 bg-white border-r border-gray-100 p-6 flex flex-col gap-8 shrink-0 z-50 transform md:transform-none transition-transform duration-300 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-black text-gray-900 leading-none">Tlu Smart Learning</span>
          </div>
          {/* Close button on mobile */}
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="p-1 text-gray-400 hover:text-gray-600 md:hidden"
            title="Đóng menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <SidebarItem id="resource-hub" icon={Library} label="Kho tài liệu" />
          <SidebarItem id="ai-analysis" icon={Brain} label="AI Phân tích học tập" />
          <SidebarItem id="quizzes" icon={FileQuestion} label="TEST nhanh Quiz" />
          <SidebarItem id="assignments" icon={Plus} label="Bài tập" />
          <SidebarItem id="ai-assistant" icon={MessageSquareQuote} label="AI Chính trị" />
          {(user.role === 'admin' || user.role === 'teacher') && (
            <SidebarItem id="resources" icon={Database} label="Tài liệu AI" />
          )}
          {user.role === 'admin' && (
            <>
              <div className="pt-4 pb-2 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Quản trị</div>
              <SidebarItem id="users" icon={BarChart3} label="Chức năng chính" />
              <SidebarItem id="reports" icon={Settings} label="Cài đặt hệ thống" />
            </>
          )}
        </nav>

        <div className="pt-6 border-t border-gray-100">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-all font-semibold"
          >
            <LogOut className="w-5 h-5" /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white border-b border-gray-100 px-4 md:px-8 flex items-center justify-between shrink-0 gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-xl md:hidden shrink-0"
              title="Mở menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="relative w-40 sm:w-64 md:w-96 hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm kiếm lớp học, tài liệu..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-6 ml-auto shrink-0">
            {isAdmin && (
              <div className="hidden lg:flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-100 shrink-0">
                <span className="text-[10px] font-bold text-gray-400 px-2 uppercase">Test Role:</span>
                {(['admin', 'teacher', 'student'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => updateRole(r)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      user.role === r ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
            <button className="relative p-2 text-gray-400 hover:text-gray-600">
              <Bell className="w-5 h-5 md:w-6 h-6" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            
            <div className="flex items-center gap-2 md:gap-3 pl-3 md:pl-6 border-l border-gray-100 relative group">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-900 line-clamp-1">{user.displayName}</p>
                <p className="text-xs text-gray-400 capitalize">{user.role === 'student' ? 'Sinh viên' : user.role === 'teacher' ? 'Giảng viên' : 'Admin'}</p>
              </div>
              <button 
                onClick={() => setActiveTab('profile')}
                className="w-8 h-8 md:w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold hover:ring-2 hover:ring-blue-500 transition-all overflow-hidden shrink-0"
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  user.displayName.charAt(0)
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          {/* Decorative background elements for content area */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
            <div className="absolute top-20 right-10 w-64 h-64 bg-red-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
            <div className="absolute bottom-20 left-10 w-72 h-72 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
          </div>

          <div className="relative z-10">
            {activeTab === 'dashboard' && (
              <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 md:p-10 rounded-2xl md:rounded-3xl text-white shadow-xl relative overflow-hidden">
                  <div className="relative z-10">
                    <h1 className="text-2xl md:text-4xl font-black mb-3 md:mb-4 flex flex-wrap items-center gap-2">
                      Chào mừng trở lại, {user.displayName}!
                    </h1>
                    <p className="text-base md:text-xl text-blue-100 font-medium opacity-90 italic">
                      "Học tập, học tập nữa, học tập mãi"
                    </p>
                    <div className="mt-6 md:mt-8 flex flex-wrap gap-3 md:gap-4">
                      <button 
                        onClick={() => setActiveTab('quizzes')}
                        className="px-4 md:px-6 py-2.5 md:py-3 bg-white text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition-all shadow-lg text-sm md:text-base"
                      >
                        Vào làm Quiz ngay
                      </button>
                      <button 
                        onClick={() => setActiveTab('resource-hub')}
                        className="px-4 md:px-6 py-2.5 md:py-3 bg-blue-500/30 text-white border border-white/20 rounded-xl font-bold hover:bg-blue-500/40 transition-all backdrop-blur-sm text-sm md:text-base"
                      >
                        Xem tài liệu
                      </button>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                  <div className="absolute bottom-0 left-1/2 w-48 h-48 bg-blue-400/20 rounded-full blur-2xl"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
                    <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mb-4 group-hover:scale-110 transition-transform">
                      <FileQuestion className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-gray-800 text-lg mb-2">Bài TEST nhanh</h3>
                    <p className="text-gray-500 text-sm mb-4">Luyện tập kiến thức qua các bài Quiz được cập nhật liên tục.</p>
                    <button onClick={() => setActiveTab('quizzes')} className="text-red-600 font-bold text-sm hover:underline">Khám phá ngay →</button>
                  </div>
                  
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform">
                      <Library className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-gray-800 text-lg mb-2">Kho tài liệu</h3>
                    <p className="text-gray-500 text-sm mb-4">Hệ thống giáo trình, tài liệu tham khảo chuẩn của nhà trường.</p>
                    <button onClick={() => setActiveTab('resource-hub')} className="text-blue-600 font-bold text-sm hover:underline">Mở thư mục →</button>
                  </div>

                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-4 group-hover:scale-110 transition-transform">
                      <Brain className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-gray-800 text-lg mb-2">Phân tích AI</h3>
                    <p className="text-gray-500 text-sm mb-4">Phân tích kết quả học tập và đưa ra lộ trình phù hợp cho bạn.</p>
                    <button onClick={() => setActiveTab('ai-analysis')} className="text-indigo-600 font-bold text-sm hover:underline">Xem phân tích →</button>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'quizzes' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                {activeManageQuiz ? (
                  <QuizManager quiz={activeManageQuiz} onBack={() => setActiveManageQuiz(null)} />
                ) : (
                  <>
                    {(user.role === 'teacher' || user.role === 'admin') && <QuizCreator />}
                    <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-sm border border-gray-100">
                      <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <FileQuestion className="w-6 h-6 text-red-600" />
                        Tất cả bài TEST nhanh Quiz
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {quizzes.map(q => (
                          <div key={q.id} className="p-6 bg-white border border-gray-100 rounded-2xl hover:shadow-lg hover:border-red-100 transition-all relative group">
                            {(user.role === 'teacher' || user.role === 'admin') && (
                              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                {confirmDeleteQuizId === q.id ? (
                                  <div className="flex items-center gap-2 bg-white shadow-lg rounded-lg p-1 border border-gray-100">
                                    <button
                                      onClick={() => handleDeleteQuiz(q.id)}
                                      className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded hover:bg-red-600"
                                    >
                                      Xóa
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteQuizId(null)}
                                      className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded hover:bg-gray-200"
                                    >
                                      Hủy
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmDeleteQuizId(q.id)}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Xóa bài kiểm tra"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                )}
                              </div>
                            )}
                            <div className="w-12 h-12 bg-gradient-to-br from-red-50 to-red-100 rounded-xl flex items-center justify-center text-red-600 mb-4 shadow-sm">
                              <FileQuestion className="w-6 h-6" />
                            </div>
                            <h3 className="font-bold text-gray-800 mb-2 line-clamp-2">{q.title}</h3>
                            <p className="text-sm text-gray-500 mb-6 flex items-center gap-2">
                              <span className="bg-gray-100 px-2 py-1 rounded-md">{q.subjectId === 'politics' ? 'Chính trị' : q.subjectId}</span>
                              <span>• {q.questions.length} câu</span>
                              <span>• {q.timeLimit}p</span>
                            </p>
                            
                            {user.role === 'student' && userResults.find(r => r.quizId === q.id) && (
                              <div className="mb-6 p-3 bg-green-50 border border-green-100 rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-2 text-green-700">
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span className="text-xs font-bold">Đã hoàn thành</span>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-bold text-green-800">
                                    {userResults.find(r => r.quizId === q.id)?.score}/{q.questions.length} câu
                                  </p>
                                  <p className="text-[10px] text-green-600 font-medium">
                                    ({((userResults.find(r => r.quizId === q.id)!.score / q.questions.length) * 10).toFixed(1)} điểm)
                                  </p>
                                </div>
                              </div>
                            )}

                            <div className="flex gap-2">
                              <button 
                                onClick={() => setActiveQuiz(q)}
                                className="flex-1 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-bold hover:from-red-700 hover:to-red-800 transition-all shadow-md shadow-red-200"
                              >
                                Bắt đầu thi
                              </button>
                              {(user.role === 'teacher' || user.role === 'admin') && (
                                <button 
                                  onClick={() => setActiveManageQuiz(q)}
                                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                                >
                                  Quản lý
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'assignments' && <AssignmentManager />}
            {activeTab === 'ai-assistant' && <PoliticalAI />}
            {activeTab === 'resources' && (user.role === 'admin' || user.role === 'teacher') && <ResourceManager />}
            {activeTab === 'ai-analysis' && <AnalysisAI />}
            {activeTab === 'resource-hub' && <KnowledgeBase />}
            {activeTab === 'users' && user.role === 'admin' && <MainFunctionsStats />}
          
          {activeTab === 'profile' && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
                <div className="bg-blue-600 h-32 relative">
                  <div className="absolute -bottom-12 left-8">
                    <div className="w-24 h-24 bg-white rounded-2xl p-1 shadow-lg">
                      <div className="w-full h-full bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 text-3xl font-black overflow-hidden relative group">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          user.displayName.charAt(0)
                        )}
                        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                           <Edit2 className="w-6 h-6 text-white mb-1" />
                           <span className="text-[10px] text-white font-bold leading-none">Chỉnh sửa</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pt-16 pb-8 px-8">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h2 className="text-2xl font-black text-gray-900">{user.displayName}</h2>
                      <p className="text-gray-500 flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs font-bold uppercase tracking-wider">
                          {user.role === 'student' ? 'Sinh viên' : user.role === 'teacher' ? 'Giảng viên' : 'Quản trị viên'}
                        </span>
                        <span>•</span>
                        <span>{user.email}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={resetProfileSetup}
                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold hover:bg-blue-100 transition-colors flex items-center gap-2"
                      >
                        <Edit2 className="w-4 h-4" /> Cập nhật thông tin
                      </button>
                      <button 
                        onClick={signOut}
                        className="px-4 py-2 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4" /> Đăng xuất
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-6">
                      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Thông tin chi tiết</h3>
                      <div className="space-y-4">
                        {user.role === 'student' && (
                          <>
                            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                                <GraduationCap className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 font-bold">Mã sinh viên (MSV)</p>
                                <p className="font-bold text-gray-900">{user.studentId || 'Chưa cập nhật'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                                <Users className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 font-bold">Lớp</p>
                                <p className="font-bold text-gray-900">{user.classId || 'Chưa cập nhật'}</p>
                              </div>
                            </div>
                          </>
                        )}
                        {user.role === 'teacher' && (
                          <>
                            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                                <GraduationCap className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 font-bold">Học vị</p>
                                <p className="font-bold text-gray-900">{user.degree || 'Chưa cập nhật'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                                <BookOpen className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 font-bold">Bộ môn / Khoa</p>
                                <p className="font-bold text-gray-900">{user.subject} - {user.faculty}</p>
                              </div>
                            </div>
                          </>
                        )}
                        {user.role === 'admin' && (
                          <>
                            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                                <Briefcase className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 font-bold">Chức vụ</p>
                                <p className="font-bold text-gray-900">{user.position || 'Chưa cập nhật'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                                <Users className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 font-bold">Phòng ban</p>
                                <p className="font-bold text-gray-900">{user.department || 'Chưa cập nhật'}</p>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="space-y-6">
                      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Hoạt động gần đây</h3>
                      <div className="p-8 border-2 border-dashed border-gray-100 rounded-3xl flex flex-col items-center justify-center text-center">
                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-4">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <p className="text-sm text-gray-400 font-medium">Chưa có hoạt động nào được ghi lại</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'reports' && user.role === 'admin' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
               <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                  <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
                    <Settings className="w-6 h-6 text-red-600" />
                    Quản trị hệ thống
                  </h2>
                  <div className="p-6 bg-red-50 border border-red-100 rounded-2xl">
                    <h3 className="font-bold text-red-800 mb-2">Khu vực nguy hiểm</h3>
                    <p className="text-sm text-red-600 mb-4">Hành động này sẽ xóa vĩnh viễn toàn bộ dữ liệu người dùng khỏi hệ thống.</p>
                    <button 
                      onClick={async () => {
                        if (window.confirm("BẠN CÓ CHẮC CHẮN MUỐN XÓA TẤT CẢ NGƯỜI DÙNG? Hành động này không thể hoàn tác!")) {
                          try {
                            const { collection, getDocs, deleteDoc, doc } = await import('firebase/firestore');
                            const q = await getDocs(collection(db, 'users'));
                            const promises = q.docs.map(d => deleteDoc(doc(db, 'users', d.id)));
                            await Promise.all(promises);
                            alert("Đã xóa toàn bộ người dùng thành công!");
                            window.location.reload();
                          } catch (err) {
                            console.error(err);
                            alert("Lỗi khi xóa người dùng.");
                          }
                        }
                      }}
                      className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg"
                    >
                      XÓA TOÀN BỘ NGƯỜI DÙNG
                    </button>
                  </div>
               </div>
            </div>
          )}
          
          {activeTab === 'courses' && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Settings className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">Tính năng đang được phát triển...</p>
            </div>
          )}
          </div>
        </div>
      </main>

      {/* Mobile-like Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[300] w-[90vw] max-w-md"
          >
            <div className={`p-4 rounded-2xl shadow-2xl border flex items-center gap-4 ${
              notification.type === 'praise' 
                ? 'bg-green-600 border-green-500 text-white' 
                : 'bg-red-600 border-red-500 text-white'
            }`}>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                {notification.type === 'praise' ? <PartyPopper className="w-6 h-6" /> : <Frown className="w-6 h-6" />}
              </div>
              <p className="font-bold leading-tight">{notification.message}</p>
              <button onClick={() => setNotification(null)} className="ml-auto text-white/60 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}




