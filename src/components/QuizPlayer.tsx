import React, { useState, useEffect, useCallback } from 'react';
import { Quiz, Question, QuizResult } from '../types';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { CheckCircle2, AlertCircle, Clock, Maximize2, Minimize2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface QuizPlayerProps {
  quiz: Quiz;
  onComplete: (result: QuizResult) => void;
}

export default function QuizPlayer({ quiz, onComplete }: QuizPlayerProps) {
  const { user } = useAuth();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>(new Array(quiz.questions.length).fill(-1));
  const [timeLeft, setTimeLeft] = useState(quiz.timeLimit ? quiz.timeLimit * 60 : 0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [violationCount, setViolationCount] = useState(0);
  const [screenshotViolations, setScreenshotViolations] = useState(0);
  const [showScreenshotWarning, setShowScreenshotWarning] = useState(false);
  
  // Use a ref to track if a screenshot shortcut was recently pressed
  // to avoid counting it as a blur/visibility violation
  const isTakingScreenshotRef = React.useRef(false);
  const keysRef = React.useRef({ meta: false, shift: false });

  const toggleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsFullScreen(true);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.key === 'Meta' || e.key === 'OS' || e.key === 'Win' || e.code?.startsWith('Meta') || e.code?.startsWith('OS');
      const isShift = e.shiftKey || e.key === 'Shift' || e.code?.startsWith('Shift');
      
      if (isMeta) keysRef.current.meta = true;
      if (isShift) keysRef.current.shift = true;

      if (isFinished) return;
      
      let isScreenshot = false;
      
      // PrintScreen key
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        isScreenshot = true;
      }
      
      // Windows: Win + Shift + S
      if ((isMeta || keysRef.current.meta) && (isShift || keysRef.current.shift) && e.key.toLowerCase() === 's') {
        isScreenshot = true;
      }
      
      // Mac: Cmd + Shift + 3/4/5
      if ((isMeta || keysRef.current.meta) && (isShift || keysRef.current.shift) && ['3', '4', '5'].includes(e.key)) {
        isScreenshot = true;
      }
      
      if (isScreenshot) {
        isTakingScreenshotRef.current = true;
        setScreenshotViolations(prev => prev + 1);
        setShowScreenshotWarning(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const isMeta = e.key === 'Meta' || e.key === 'OS' || e.key === 'Win' || e.code?.startsWith('Meta') || e.code?.startsWith('OS');
      const isShift = e.key === 'Shift' || e.code?.startsWith('Shift');
      
      if (isMeta) keysRef.current.meta = false;
      if (isShift) keysRef.current.shift = false;

      if (isFinished) return;

      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        if (!isTakingScreenshotRef.current) {
          isTakingScreenshotRef.current = true;
          setScreenshotViolations(prev => prev + 1);
          setShowScreenshotWarning(true);
        }
      }
    };

    const handleFullScreenChange = () => {
      if (!document.fullscreenElement && !isFinished) {
        setIsFullScreen(false);
        setTimeout(() => {
          if (!isTakingScreenshotRef.current) {
            setViolationCount(prev => prev + 1);
          }
        }, 200);
      } else if (document.fullscreenElement) {
        setIsFullScreen(true);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && !isFinished && isFullScreen) {
        setTimeout(() => {
          if (!isTakingScreenshotRef.current) {
            setViolationCount(prev => prev + 1);
          }
        }, 200);
      }
    };

    const handleBlur = () => {
      if (!isFinished && isFullScreen) {
        // If Meta and Shift are held during blur, OS likely intercepted a screenshot shortcut (e.g., Win+Shift+S)
        if (keysRef.current.meta && keysRef.current.shift) {
          isTakingScreenshotRef.current = true;
          setScreenshotViolations(prev => prev + 1);
          setShowScreenshotWarning(true);
          // Reset keys to prevent continuous triggering
          keysRef.current.meta = false;
          keysRef.current.shift = false;
        } else {
          setTimeout(() => {
            if (!isTakingScreenshotRef.current) {
              setViolationCount(prev => prev + 1);
            }
          }, 200);
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isFinished, isFullScreen]);

  // Auto-submit if violations are too high (optional, but let's just warn for now)
  useEffect(() => {
    if (violationCount > 0 && !isFinished && !isFullScreen) {
      // If they exited full screen, we show the overlay again
    }
  }, [violationCount, isFinished, isFullScreen]);

  useEffect(() => {
    if (timeLeft > 0 && !isFinished) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && quiz.timeLimit && !isFinished) {
      handleSubmit();
    }
  }, [timeLeft, isFinished]);

  const handleAnswer = (optionIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = optionIndex;
    setAnswers(newAnswers);
  };

  const handleSubmit = async () => {
    if (isFinished) return;
    
    // Check if all questions are answered
    const unansweredIndex = answers.findIndex(a => a === -1);
    if (unansweredIndex !== -1) {
      alert(`Vui lòng trả lời câu hỏi số ${unansweredIndex + 1} trước khi nộp bài!`);
      setCurrentQuestionIndex(unansweredIndex);
      return;
    }
    
    let correctCount = 0;
    quiz.questions.forEach((q, i) => {
      if (answers[i] === q.correctOptionIndex) correctCount++;
    });

    const timeTaken = quiz.timeLimit ? (quiz.timeLimit * 60) - timeLeft : 0;

    const result: QuizResult = {
      id: `${quiz.id}_${user?.uid}_${Date.now()}`,
      quizId: quiz.id,
      studentId: user?.uid || '',
      studentName: user?.displayName || 'Unknown Student',
      score: correctCount,
      totalQuestions: quiz.questions.length,
      completedAt: Date.now(),
      timeTaken,
      violationCount,
      screenshotViolations,
      userAnswers: answers
    };

    try {
      await setDoc(doc(db, 'quizResults', result.id), result);
      setScore(correctCount);
      setIsFinished(true);
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      onComplete(result);
      if (document.fullscreenElement) document.exitFullscreen();
    } catch (error) {
      console.error("Submit Error:", error);
    }
  };

  if (isFinished) {
    const score10 = ((score / quiz.questions.length) * 10).toFixed(1);
    return (
      <div className="max-w-2xl mx-auto p-8 bg-white rounded-2xl shadow-xl text-center">
        <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Hoàn thành bài thi!</h2>
        <p className="text-gray-600 mb-6">Bạn đã trả lời đúng {score}/{quiz.questions.length} câu hỏi.</p>
        <div className="text-5xl font-black text-blue-600 mb-2">
          {score10} <span className="text-2xl text-gray-400">/ 10 điểm</span>
        </div>
        <div className="text-lg font-bold text-gray-500 mb-8">
          {Math.round((score / quiz.questions.length) * 100)}%
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="px-8 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
        >
          Quay lại trang chủ
        </button>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      {showScreenshotWarning && (
        <div className="fixed inset-0 z-[200] bg-orange-900/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-white rounded-3xl shadow-2xl p-10 text-center border-4 border-orange-500 transform transition-all scale-100">
            <AlertCircle className="w-24 h-24 text-orange-500 mx-auto mb-6 animate-pulse" />
            <h2 className="text-4xl font-black text-orange-600 mb-4 uppercase tracking-wider">
              PHÁT HIỆN CHỤP MÀN HÌNH
            </h2>
            <p className="text-xl text-gray-800 mb-6 font-bold">
              Hệ thống ghi nhận bạn vừa cố tình chụp ảnh màn hình bài thi!
            </p>
            <div className="bg-orange-50 p-4 rounded-xl mb-8 border border-orange-100">
              <p className="text-orange-800 leading-relaxed font-medium">
                Hành vi sao chép đề thi dưới mọi hình thức đều bị nghiêm cấm. Lần vi phạm này đã được lưu lại và gửi cho giảng viên.
              </p>
            </div>
            <button 
              onClick={() => {
                setShowScreenshotWarning(false);
                setTimeout(() => {
                  isTakingScreenshotRef.current = false;
                }, 1000);
              }}
              className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold text-lg hover:bg-orange-600 transition-all shadow-lg shadow-orange-200 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-6 h-6" />
              TÔI ĐÃ HIỂU VÀ SẼ KHÔNG TÁI PHẠM
            </button>
          </div>
        </div>
      )}

      {violationCount > 0 && !isFinished && (
        <div className="fixed top-4 right-4 z-50 bg-red-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
          <AlertCircle className="w-5 h-5" />
          <span className="font-bold">Cảnh báo vi phạm: {violationCount}</span>
        </div>
      )}

      {!isFullScreen && (
        <div className="fixed inset-0 z-[100] bg-gray-900/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-white rounded-3xl shadow-2xl p-10 text-center">
            <Maximize2 className="w-20 h-20 text-blue-600 mx-auto mb-6" />
            <h2 className="text-3xl font-black text-gray-900 mb-4">
              {violationCount > 0 ? "BẠN ĐÃ THOÁT CHẾ ĐỘ THI!" : "BẮT ĐẦU BÀI THI"}
            </h2>
            <p className="text-gray-500 mb-8 leading-relaxed">
              {violationCount > 0 
                ? "Hệ thống đã ghi nhận hành vi thoát chế độ thi. Vui lòng quay lại toàn màn hình ngay lập tức để tiếp tục bài làm." 
                : "Để đảm bảo tính công bằng, bài thi yêu cầu chế độ toàn màn hình. Bạn không được thoát tab hoặc chuyển cửa sổ trong quá trình làm bài."}
            </p>
            <button 
              onClick={toggleFullScreen}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-3"
            >
              <Maximize2 className="w-6 h-6" /> 
              {violationCount > 0 ? "QUAY LẠI BÀI THI" : "BẬT TOÀN MÀN HÌNH & BẮT ĐẦU"}
            </button>
            {violationCount > 3 && (
              <p className="mt-6 text-red-500 font-bold animate-pulse">
                CẢNH BÁO: Quá nhiều lần vi phạm có thể dẫn đến việc tự động nộp bài!
              </p>
            )}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
        {/* Main Quiz Area */}
        <div className="flex-1 bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold">{quiz.title}</h1>
              <p className="text-blue-100 text-sm">Câu hỏi {currentQuestionIndex + 1}/{quiz.questions.length}</p>
            </div>
            {quiz.timeLimit && (
              <div className="flex items-center gap-2 bg-blue-700 px-4 py-2 rounded-lg font-mono text-lg">
                <Clock className="w-5 h-5" />
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </div>
            )}
          </div>

          <div className="p-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-8">{currentQuestion.text}</h2>
            <div className="grid gap-4">
              {currentQuestion.options.map((option, i) => {
                const isSelected = answers[currentQuestionIndex] === i;

                return (
                  <button
                    key={i}
                    onClick={() => handleAnswer(i)}
                    className={`p-4 text-left rounded-xl border-2 transition-all flex items-center gap-4 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-100 hover:border-blue-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0 ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-400'
                    }`}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="flex-1">{option}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-between">
            <button
              disabled={currentQuestionIndex === 0}
              onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
              className="px-6 py-2 rounded-lg font-semibold text-gray-600 hover:bg-gray-200 disabled:opacity-30"
            >
              Câu trước
            </button>
            {currentQuestionIndex === quiz.questions.length - 1 ? (
              <button
                onClick={handleSubmit}
                className="px-8 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-lg shadow-green-200"
              >
                Nộp bài
              </button>
            ) : (
              <button
                onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                className="px-8 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-200"
              >
                Câu tiếp theo
              </button>
            )}
          </div>
        </div>

        {/* Question List Sidebar */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="bg-white rounded-2xl shadow-xl p-6 sticky top-4">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Danh sách câu hỏi</h3>
            <div className="grid grid-cols-5 gap-2">
              {quiz.questions.map((_, index) => {
                const isAnswered = answers[index] !== -1;
                const isCurrent = currentQuestionIndex === index;
                return (
                  <button
                    key={index}
                    onClick={() => setCurrentQuestionIndex(index)}
                    className={`
                      w-full aspect-square rounded-lg font-bold text-sm flex items-center justify-center transition-all
                      ${isCurrent ? 'ring-2 ring-blue-600 ring-offset-2' : ''}
                      ${isAnswered 
                        ? 'bg-blue-600 text-white border border-blue-600' 
                        : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-400'
                      }
                    `}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
