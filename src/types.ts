export type UserRole = 'admin' | 'teacher' | 'student';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  createdAt: number;
  isProfileComplete?: boolean;
  resourceAccessCount?: number; // Đếm số lần truy cập kho tài liệu
  
  // Admin fields
  position?: string; // Chức vụ
  department?: string; // Phòng ban

  // Teacher fields
  degree?: 'Thạc sĩ' | 'Tiến sĩ'; // Học vị
  subject?: string; // Bộ môn
  faculty?: string; // Khoa

  // Student fields
  studentId?: string; // MSV
  classId?: string; // Lớp
}

export interface Subject {
  id: string;
  name: string;
  description: string;
  teacherId: string;
}

export interface Class {
  id: string;
  name: string;
  subjectId: string;
  teacherId: string;
}

export interface Resource {
  id: string;
  title: string;
  description: string;
  fileUrl: string;
  fileType: string;
  subjectId: string;
  uploadedBy: string;
  createdAt: number;
  accessCount?: number; // Số lần click xem
  isSample?: boolean; // Đánh dấu là bài tập mẫu tiêu biểu
}

export interface Quiz {
  id: string;
  title: string;
  subjectId: string;
  questions: Question[];
  createdBy: string;
  createdAt: number;
  timeLimit?: number; // in minutes
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctOptionIndex: number;
}

export interface QuizResult {
  id: string;
  quizId: string;
  studentId: string;
  studentName?: string;
  score: number;
  totalQuestions: number;
  completedAt: number;
  timeTaken?: number; // in seconds
  violationCount?: number;
  screenshotViolations?: number;
  userAnswers: number[]; // Lưu lại đáp án sinh viên đã chọn
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  subjectId: string;
  classId?: string;
  dueDate: number;
  createdAt: number;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  files: { name: string; type: string; url: string; submittedAt: number }[]; // Hỗ trợ nhiều file/ảnh
  grade?: number;
  feedback?: string;
  submittedAt: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp?: number;
}
