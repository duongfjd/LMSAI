import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export async function generateQuizFromText(text: string, count: number = 5, customPrompt?: string, fileData?: { data: string, mimeType: string }) {
  const prompt = customPrompt || `Dựa trên nội dung sau, hãy tạo ${count} câu hỏi trắc nghiệm (mỗi câu 4 lựa chọn, 1 đáp án đúng). 
    Nội dung: ${text}`;

  const parts: any[] = [];
  
  if (fileData) {
    parts.push({
      inlineData: {
        data: fileData.data,
        mimeType: fileData.mimeType
      }
    });
  }
  
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts }],
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING, description: "Câu hỏi" },
            options: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "4 lựa chọn"
            },
            correctOptionIndex: { 
              type: Type.INTEGER, 
              description: "Chỉ số của đáp án đúng (0-3)" 
            },
          },
          required: ["text", "options", "correctOptionIndex"],
        },
      },
    },
  });

  return JSON.parse(response.text || "[]");
}

export async function askPoliticalAI(question: string, context: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Bạn là một trợ lý học tập chuyên về các môn chính trị. Hãy trả lời câu hỏi dựa trên tài liệu được cung cấp.
    Tài liệu: ${context}
    Câu hỏi: ${question}`,
  });

  return response.text;
}

export async function analyzePerformance(performanceData: string, resourceContext: string, chatHistory: string = "", extraStats: string = "") {
  const prompt = `Bạn là một chuyên gia phân tích giáo dục AI. Hãy phân tích quá trình học tập của sinh viên dựa trên dữ liệu sau:
    
  Tài liệu học tập hiện có:
  ${resourceContext}

  Kết quả các bài kiểm tra gần nhất (thể hiện kiến thức hiện tại):
  ${performanceData}
  
  Lịch sử trò chuyện của sinh viên với trợ lý AI (thể hiện thái độ học hỏi và các lỗ hổng kiến thức tiềm ẩn):
  ${chatHistory || 'Không có lịch sử trò chuyện nào.'}

  Thông tin hoạt động hệ thống (Thái độ học tập):
  ${extraStats || 'Chưa có thông tin hoạt động.'}

  YÊU CẦU:
  1. Chỉ ra sinh viên đang yếu ở mảng nội dung hoặc chương nào (đối chiếu với các câu hỏi sai và câu hỏi sinh viên đã hỏi AI).
  2. Đưa ra lời khuyên cụ thể về việc cần đọc lại tài liệu nào.
  3. Đánh giá thái độ học tập và mức độ chăm chỉ dựa trên chỉ số truy cập tài liệu và cách đặt câu hỏi.
  4. Sử dụng ngôn ngữ khích lệ, chuyên nghiệp. Trình bày bằng Markdown.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: prompt }] }]
  });

  return response.text;
}
