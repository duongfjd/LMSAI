import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { Star, TrendingUp, Award, Zap, Loader2 } from 'lucide-react';

const FEATURE_NAMES: Record<string, string> = {
  'quizzes': 'TEST nhanh Quiz',
  'ai-assistant': 'AI Chính trị',
  'assignments': 'Bài tập & Chấm điểm',
  'resource-hub': 'Kho tài liệu',
  'ai-analysis': 'AI Phân tích học tập'
};

const FEATURE_COLORS: Record<string, string> = {
  'quizzes': '#ef4444',
  'ai-assistant': '#3b82f6',
  'assignments': '#8b5cf6',
  'resource-hub': '#f59e0b',
  'ai-analysis': '#10b981'
};

export default function MainFunctionsStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'usageStats'), orderBy('count', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          name: FEATURE_NAMES[d.name] || d.name,
          count: d.count,
          color: FEATURE_COLORS[d.name] || '#6b7280'
        };
      });
      
      const total = data.reduce((acc, curr) => acc + curr.count, 0);
      const dataWithPercent = data.map(d => ({
        ...d,
        percentage: total > 0 ? Math.round((d.count / total) * 100) : 0
      }));
      
      setStats(dataWithPercent);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-500">
      <Loader2 className="w-10 h-10 animate-spin mb-4" />
      <p className="font-bold">Đang tải dữ liệu thực tế...</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black text-gray-900">Thống kê Chức năng Chính</h1>
        <p className="text-gray-500">Dữ liệu thực tế được ghi nhận từ tương tác của người dùng trên hệ thống</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Tính năng dùng nhiều nhất', value: stats[0]?.name || '...', icon: Zap, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Tổng lượt tương tác', value: stats.reduce((acc, c) => acc + c.count, 0).toLocaleString(), icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Độ đa dạng tính năng', value: stats.length.toString(), icon: Award, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Mức độ hoạt động', value: 'Rất cao', icon: Star, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{stat.label}</p>
              <p className="text-xl font-black text-gray-900 line-clamp-1">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Bar Chart - Feature Approval */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
          <h3 className="text-xl font-bold text-gray-800 mb-6">Tỉ lệ sử dụng theo Chức năng (%)</h3>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats} layout="vertical" margin={{ left: 40, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={150} 
                  tick={{ fontSize: 12, fontWeight: 600, fill: '#4b5563' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  cursor={{ fill: '#f9fafb' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  formatter={(value: any) => [`${value}%`, 'Tỉ lệ']}
                />
                <Bar dataKey="percentage" radius={[0, 10, 10, 0]} barSize={30}>
                  {stats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart - Interaction Distribution */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
          <h3 className="text-xl font-bold text-gray-800 mb-6">Phân bổ lượt tương tác</h3>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="name"
                >
                  {stats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  formatter={(value: any) => [value, 'Lượt truy cập']}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
