import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, where, updateDoc, doc, increment } from 'firebase/firestore';
import { Resource, User } from '../types';
import { BookOpen, Star, Eye, Calendar, User as UserIcon, Medal, Frown, TrendingUp } from 'lucide-react';

export default function KnowledgeBase() {
  const { user } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [viewingResource, setViewingResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'resources'), where('isSample', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setResources(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Resource)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const handleAccess = async (resource: Resource) => {
    setViewingResource(resource);
    
    // Increment access count for the resource
    try {
      await updateDoc(doc(db, 'resources', resource.id), {
        accessCount: increment(1)
      });

      // Increment total access count for the user
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), {
          resourceAccessCount: increment(1)
        });
      }
    } catch (error) {
      console.error("Error updating access count:", error);
    }
  };

  const getStatus = (count: number = 0) => {
    if (count >= 13) return { label: 'Tốt', color: 'text-green-500', icon: TrendingUp, bg: 'bg-green-50' };
    if (count >= 5) return { label: 'Không truy cập thường xuyên', color: 'text-orange-500', icon: Medal, bg: 'bg-orange-50' };
    return { label: 'Kém', color: 'text-red-500', icon: Frown, bg: 'bg-red-50' };
  };

  const status = getStatus(user?.resourceAccessCount);

  if (loading) return null;

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-blue-600" />
            Kho bài tập mẫu
          </h1>
          <p className="text-gray-500">Tổng hợp các bài tập tiêu biểu và tài liệu mẫu nâng cao</p>
        </div>

        <div className={`flex items-center gap-4 px-6 py-4 rounded-3xl border shadow-sm transition-all ${status.bg} ${status.color.replace('text', 'border')}`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${status.color.replace('text', 'bg')} text-white shadow-md`}>
            <status.icon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-60">Thái độ học tập</p>
            <p className="text-xl font-black">{status.label}</p>
          </div>
          <div className="ml-4 pl-4 border-l border-current/20">
            <p className="text-xs font-bold opacity-60">Lượt học</p>
            <p className="text-xl font-black">{user?.resourceAccessCount || 0}</p>
          </div>
        </div>
      </header>

      {viewingResource ? (
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-300">
          <div className="bg-blue-600 p-8 text-white flex justify-between items-start">
            <div>
              <button 
                onClick={() => setViewingResource(null)}
                className="text-blue-200 hover:text-white mb-4 text-sm font-bold flex items-center gap-1"
              >
                ← Quay lại danh sách
              </button>
              <h2 className="text-3xl font-black mb-2">{viewingResource.title}</h2>
              <p className="text-blue-100 max-w-2xl">{viewingResource.description}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 text-center">
              <Eye className="w-6 h-6 mb-1 mx-auto" />
              <p className="text-2xl font-black">{viewingResource.accessCount || 0}</p>
              <p className="text-[10px] uppercase font-bold opacity-60">Lượt xem</p>
            </div>
          </div>
          <div className="p-8">
            {viewingResource.fileType === 'image' ? (
              <div className="flex flex-col items-center gap-6">
                <img 
                  src={viewingResource.fileUrl} 
                  alt={viewingResource.title} 
                  className="max-w-full max-h-[70vh] object-contain rounded-2xl shadow-md border border-gray-100"
                  referrerPolicy="no-referrer"
                />
                <a 
                  href={viewingResource.fileUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-8 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
                >
                  MỞ ẢNH GỐC
                </a>
              </div>
            ) : (
              <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
                <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-bold mb-6">File đang được mở ở một tab khác để bảo mật</p>
                <a 
                  href={viewingResource.fileUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  MỞ TÀI LIỆU CHI TIẾT
                </a>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {resources.map((resource) => (
            <div 
              key={resource.id}
              onClick={() => handleAccess(resource)}
              className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-xl hover:border-blue-200 hover:-translate-y-1 transition-all cursor-pointer group flex flex-col"
            >
              {resource.fileType === 'image' && (
                <div className="w-full h-48 bg-gray-100 relative overflow-hidden border-b border-gray-50 shrink-0">
                  <img 
                    src={resource.fileUrl} 
                    alt={resource.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-[10px] font-bold text-gray-600 px-3 py-1 rounded-full shadow-sm uppercase tracking-wider">
                    Hình ảnh
                  </div>
                </div>
              )}

              <div className="p-6 flex-1 flex flex-col items-start w-full">
                {resource.fileType !== 'image' && (
                  <div className="flex justify-between items-start w-full mb-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Star className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-1 text-gray-400 text-[10px] font-bold bg-gray-50 px-3 py-1.5 rounded-full uppercase tracking-wider">
                      {resource.fileType}
                    </div>
                  </div>
                )}
                
                {resource.fileType === 'image' && (
                  <div className="flex justify-start w-full mb-3">
                    <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Star className="w-4 h-4" />
                    </div>
                  </div>
                )}

                <h3 className="text-xl font-black text-gray-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2 w-full text-left">
                  {resource.title}
                </h3>
                <p className="text-sm text-gray-500 mb-6 line-clamp-2 leading-relaxed">
                  {resource.description}
                </p>
                <div className="flex items-center justify-between pt-5 border-t border-gray-50 mt-auto w-full">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Eye className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold text-gray-600">{resource.accessCount || 0}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs font-bold">{new Date(resource.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {resources.length === 0 && (
            <div className="col-span-full py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100 flex flex-col items-center justify-center text-center">
              <BookOpen className="w-16 h-16 text-gray-200 mb-4" />
              <p className="text-gray-400 font-bold">Chưa có bài tập mẫu nào được tải lên</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
