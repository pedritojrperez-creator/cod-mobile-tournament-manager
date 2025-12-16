import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { ImageSize } from "../types";

/** 
 *  IMPORTANT:
 *  Use Vite environment variables so the key loads correctly in Vercel.
 */
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ ERROR: VITE_GEMINI_API_KEY is missing. Check Vercel → Environment Variables.");
}

const ai = new GoogleGenAI({ apiKey });

/**
 * Chat with the AI Assistant
 */
export const sendMessageToAssistant = async (
  history: { role: 'user' | 'model'; parts: { text: string }[] }[],
  newMessage: string
): Promise<string> => {
  try {
    const chat = ai.chats.create({
      model: 'gemini-3-pro-preview',
      messages: history,
      config: {
        systemInstruction:
          "You are a tactical assistant for a Call of Duty Mobile tournament manager. Be concise, use gamer terminology (OP, buff, nerf, camper, rush), and be helpful with tournament logistics.",
      },
    });

    const response: GenerateContentResponse = await chat.sendMessage({ message: newMessage });
    return response.text || "Comms offline. Try again.";
  } catch (error) {
    console.error("Chat error:", error);
    return "Error communicating with HQ.";
  }
};

/**
 * Quick analysis for player names / UID
 */
export const quickAnalyzeText = async (text: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite-preview-02-04",
      contents: `Analyze this player name/UID for appropriateness in a tournament: ${text}. Return JSON with valid: boolean and reason: string.`,
      config: { responseMimeType: "application/json" },
    });

    return response.text || "{}";
  } catch (error) {
    console.error("Analysis error:", error);
    return "{}";
  }
};

/**
 * Analyze a player image (profile)
 */
export const analyzePlayerImage = async (base64Data: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Data } },
          { text: "Analyze this image. Is it a valid profile picture for a gamer? Describe the style." },
        ],
      },
    });

    return response.text || "Analysis failed.";
  } catch (error) {
    console.error("Image analysis error:", error);
    return "Could not analyze image.";
  }
};

/**
 * Generate avatar with Gemini Image Model
 */
export const generateAvatar = async (prompt: string, size: ImageSize): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: {
        parts: [{ text: `A cool Call of Duty Mobile style avatar: ${prompt}` }],
      },
      config: {
        imageConfig: {
          imageSize: size,
          aspectRatio: "1:1",
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Avatar generation error:", error);
    throw error;
  }
};

/**
 * Edit image using Flash Image Model
 */
export const editPlayerImage = async (
  base64Image: string,
  prompt: string
): Promise<string | null> => {
  try {
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } },
          { text: prompt },
        ],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    return null;
  } catch (error) {
    console.error("Image edit error:", error);
    throw error;
  }
};

/**
 * Analyze Scoreboard Screenshot for Tournament Points
 */
export const analyzeMatchScreenshot = async (base64Image: string): Promise<any[]> => {
  try {
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

    const prompt = `
    Analyze this Call of Duty Mobile match result scoreboard strictly.
    
    Extraction Rules:
    1. Identify the match score (e.g., 5-2). The team with 5 wins is the WINNER.
    2. Extract each player row.
    3. For kills, identify the FIRST number in B/M/A.
    4. MVP: First player of winning team = MVP. First player of losing team = MVP.
    5. Return only JSON. No invented values.

    Response array:
    {
      extractedName: string,
      teamResult: "WIN" | "LOSS",
      kills: number,
      isMvp: boolean
    }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              extractedName: { type: Type.STRING },
              teamResult: { type: Type.STRING, enum: ["WIN", "LOSS"] },
              kills: { type: Type.INTEGER },
              isMvp: { type: Type.BOOLEAN },
            },
          },
        },
      },
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (error) {
    console.error("Scoreboard analysis error:", error);
    return [];
  }
};
