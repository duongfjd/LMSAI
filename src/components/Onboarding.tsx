import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { UserRole } from '../types';
import { GraduationCap, User as UserIcon, Briefcase, BookOpen } from 'lucide-react';

export default function Onboarding() {
  const { user, updateProfile } = useAuth();
  // Safe cast since we know user structure
  const u = user as any;
  const [role, setRole] = useState<UserRole>(u?.role || 'student');
  const [displayName, setDisplayName] = useState(u?.displayName || '');
  
  // Admin fields
  const [position, setPosition] = useState(u?.position || '');
  const [department, setDepartment] = useState(u?.department || '');

  // Teacher fields
  const [degree, setDegree] = useState<'Thạc sĩ' | 'Tiến sĩ'>(u?.degree || 'Thạc sĩ');
  const [subject, setSubject] = useState(u?.subject || '');
  const [faculty, setFaculty] = useState(u?.faculty || '');

  // Student fields
  const [studentId, setStudentId] = useState(u?.studentId || '');
  const [classId, setClassId] = useState(u?.classId || '');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const profileData: any = {
        role,
        displayName,
      };

      if (role === 'admin') {
        profileData.position = position;
        profileData.department = department;
      } else if (role === 'teacher') {
        profileData.degree = degree;
        profileData.subject = subject;
        profileData.faculty = faculty;
      } else if (role === 'student') {
        profileData.studentId = studentId;
        profileData.classId = classId;
      }

      await updateProfile(profileData);
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Có lỗi xảy ra, vui lòng thử lại.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-blue-600 p-8 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black mb-2">Hoàn thiện hồ sơ</h1>
          <p className="text-blue-100">Vui lòng cung cấp thêm thông tin để bắt đầu sử dụng hệ thống</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Bạn là ai?</label>
            <div className="grid grid-cols-3 gap-4">
              {(['student', 'teacher', 'admin'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                    role === r 
                      ? 'border-blue-600 bg-blue-50 text-blue-700' 
                      : 'border-gray-100 hover:border-blue-200 text-gray-500'
                  }`}
                >
                  {r === 'student' && <UserIcon className="w-6 h-6" />}
                  {r === 'teacher' && <BookOpen className="w-6 h-6" />}
                  {r === 'admin' && <Briefcase className="w-6 h-6" />}
                  <span className="font-bold capitalize">{r === 'student' ? 'Sinh viên' : r === 'teacher' ? 'Giảng viên' : 'Quản trị viên'}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Họ và tên</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Nhập họ và tên của bạn"
            />
          </div>

          {role === 'admin' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Chức vụ</label>
                <input
                  type="text"
                  required
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="VD: Trưởng phòng"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Phòng ban</label>
                <input
                  type="text"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="VD: Phòng Đào tạo"
                />
              </div>
            </div>
          )}

          {role === 'teacher' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Học vị</label>
                  <select
                    value={degree}
                    onChange={(e) => setDegree(e.target.value as 'Thạc sĩ' | 'Tiến sĩ')}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="Thạc sĩ">Thạc sĩ</option>
                    <option value="Tiến sĩ">Tiến sĩ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Bộ môn</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="VD: Công nghệ phần mềm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Khoa</label>
                <input
                  type="text"
                  required
                  value={faculty}
                  onChange={(e) => setFaculty(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="VD: Công nghệ thông tin"
                />
              </div>
            </>
          )}

          {role === 'student' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Mã sinh viên (MSV)</label>
                <input
                  type="text"
                  required
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="VD: 20210001"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Lớp</label>
                <input
                  type="text"
                  required
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="VD: K66-CNTT"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Đang lưu...' : 'Hoàn tất'}
          </button>
        </form>
      </div>
    </div>
  );
}
