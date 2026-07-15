import { GoogleGenAI } from '@google/genai';
import "dotenv/config";

async function run() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
     const res = await ai.models.generateContent({
       model: 'gemini-3.5-flash',
       contents: 'hello'
     });
     console.log('Success 3.5:', res.text);
  } catch (e: any) {
     console.error('Error 3.5:', e.message);
  }
}
run();
