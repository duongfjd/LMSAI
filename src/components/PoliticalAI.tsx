import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { askPoliticalAI } from '../lib/ai';
import { ChatMessage } from '../types';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { collection, query, getDocs, addDoc, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function PoliticalAI() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState('');

  useEffect(() => {
    // Load political resources as context
    const loadContext = async () => {
      const q = query(collection(db, 'resources'));
      const snapshot = await getDocs(q);
      const politicalDocs = snapshot.docs
        .map(doc => doc.data())
        .filter(doc => doc.subjectId === 'politics' || doc.title.toLowerCase().includes('chính trị'))
        .map(doc => `${doc.title}: ${doc.description}`)
        .join('\n');
      setContext(politicalDocs || "Tài liệu chuẩn về các môn chính trị.");
    };
    loadContext();
  }, []);

  useEffect(() => {
    // Load chat history
    const loadChatHistory = async () => {
      if (!user) return;
      const q = query(
        collection(db, 'chatMessages'),
        where('studentId', '==', user.uid)
      );
      try {
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const loadedMessages = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              role: data.role,
              content: data.content,
              timestamp: data.timestamp || 0
            };
          }).sort((a, b) => a.timestamp - b.timestamp); // Sort locally
          
          setMessages(loadedMessages as ChatMessage[]);
        }
      } catch (err) {
        console.error("Failed to load chat history", err);
      }
    };
    loadChatHistory();
  }, [user]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || !user) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    const userInput = input;
    setInput('');
    setLoading(true);

    // Save user message to firestore
    try {
      await addDoc(collection(db, 'chatMessages'), {
        studentId: user.uid,
        role: 'user',
        content: userInput,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error("Failed to save user message", err);
    }

    try {
      const response = await askPoliticalAI(userInput, context);
      const aiMessage: ChatMessage = { role: 'model', content: response || 'Xin lỗi, tôi không thể trả lời câu hỏi này.' };
      setMessages(prev => [...prev, aiMessage]);
      
      // Save returning AI message
      await addDoc(collection(db, 'chatMessages'), {
        studentId: user.uid,
        role: 'model',
        content: aiMessage.content,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error("AI Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl shadow-lg border border-indigo-100 overflow-hidden relative">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute top-40 -left-20 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="p-4 bg-white/80 backdrop-blur-md border-b border-indigo-100 flex items-center gap-3 z-10">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
          <Bot className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-gray-800">Trợ lý AI Chính trị</h2>
          <p className="text-xs text-indigo-600 font-medium">Sẵn sàng giải đáp mọi thắc mắc</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 z-10">
        {messages.length === 0 && (
          <div className="text-center mt-10">
            <div className="w-24 h-24 bg-white rounded-full shadow-xl flex items-center justify-center mx-auto mb-6 border-4 border-indigo-50">
              <Bot className="w-12 h-12 text-indigo-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Xin chào, {user?.displayName}!</h3>
            <p className="text-gray-500 max-w-sm mx-auto">
              Tôi là trợ lý ảo chuyên môn về các môn Chính trị. Hãy đặt câu hỏi, tôi sẽ trả lời dựa trên tài liệu chuẩn của trường.
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-2xl flex gap-4 shadow-sm ${
              msg.role === 'user' 
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-sm' 
                : 'bg-white border border-indigo-50 text-gray-800 rounded-tl-sm'
            }`}>
              {msg.role === 'model' && (
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-5 h-5 text-indigo-600" />
                </div>
              )}
              <div className="prose prose-sm max-w-none prose-inherit leading-relaxed">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-1">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-indigo-50 p-4 rounded-2xl rounded-tl-sm flex items-center gap-3 shadow-sm">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              </div>
              <span className="text-sm font-medium text-indigo-600">AI đang suy nghĩ và tra cứu tài liệu...</span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="p-4 bg-white/80 backdrop-blur-md border-t border-indigo-100 flex gap-3 z-10">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Hỏi về Triết học, Kinh tế chính trị..."
          className="flex-1 px-6 py-3 bg-white rounded-full border border-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full font-bold hover:shadow-lg hover:shadow-indigo-200 disabled:opacity-50 transition-all flex items-center gap-2"
        >
          <Send className="w-5 h-5" />
          <span className="hidden sm:inline">Gửi</span>
        </button>
      </form>
    </div>
  );
}