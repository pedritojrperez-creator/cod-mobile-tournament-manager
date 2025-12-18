
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { ImageSize } from "../types";

/**
 * Chat with the AI Assistant
 */
export const sendMessageToAssistant = async (
  history: { role: 'user' | 'model'; parts: { text: string }[] }[],
  newMessage: string
): Promise<string> => {
  try {
    // Initializing inside the function to ensure the latest API key is used as per guidelines.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const chat = ai.chats.create({
      model: 'gemini-3-pro-preview',
      config: {
        systemInstruction: "You are a tactical assistant for a Call of Duty Mobile tournament manager. Be concise, use gamer terminology (OP, buff, nerf, camper, rush), and be helpful with tournament logistics.",
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
 * Fast Analysis of content (e.g., verifying a UID format or name appropriateness)
 */
export const quickAnalyzeText = async (text: string): Promise<string> => {
  try {
    // Initializing inside the function to ensure the latest API key is used.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: `Analyze this player name/UID for appropriateness in a tournament: ${text}. Return JSON with valid: boolean and reason: string.`,
      config: { 
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            valid: { type: Type.BOOLEAN },
            reason: { type: Type.STRING }
          },
          required: ['valid', 'reason']
        }
      }
    });
    return response.text || "{}";
  } catch (error) {
    console.error("Analysis error:", error);
    return "{}";
  }
};

/**
 * Analyze an uploaded player image (e.g. to extract info or check quality)
 */
export const analyzePlayerImage = async (base64Data: string): Promise<string> => {
  try {
    // Initializing inside the function to ensure the latest API key is used.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
          { text: "Analyze this image. Is it a valid profile picture for a gamer? Describe the style." }
        ]
      }
    });
    return response.text || "Analysis failed.";
  } catch (error) {
    console.error("Image analysis error:", error);
    return "Could not analyze image.";
  }
};

/**
 * Generate a new avatar for a player using Nano Banana Pro (Gemini 3 Pro Image)
 */
export const generateAvatar = async (prompt: string, size: ImageSize): Promise<string | null> => {
  try {
    // Initializing inside the function to ensure the latest API key is used.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: `A cool Call of Duty Mobile style avatar: ${prompt}` }]
      },
      config: {
        imageConfig: {
          imageSize: size as any,
          aspectRatio: "1:1"
        }
      }
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
 * Edit an existing image using Gemini 2.5 Flash Image (Nano Banana)
 */
export const editPlayerImage = async (base64Image: string, prompt: string): Promise<string | null> => {
  try {
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
    // Initializing inside the function to ensure the latest API key is used.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: 'image/jpeg',
            },
          },
          {
            text: prompt,
          },
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
 * Analyze Match Scoreboard Screenshot
 */
export const analyzeMatchScreenshot = async (base64Image: string): Promise<any[]> => {
    try {
        const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
        // Initializing inside the function to ensure the latest API key is used.
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `
        Analyze this Call of Duty Mobile match result scoreboard image strictly.
        
        Rules for Extraction:
        1. Identify the match score. The team with more rounds won is the WINNER.
        2. Extract each player row visible.
        3. For "kills", look for the first number in the K/D/A format.
        4. MVP Rule: The player at the top of their team's list.
        5. Return a JSON array.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-flash-latest',
            contents: {
                parts: [
                    { inlineData: { data: cleanBase64, mimeType: 'image/jpeg' } },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            extractedName: { type: Type.STRING },
                            teamResult: { type: Type.STRING },
                            kills: { type: Type.INTEGER },
                            isMvp: { type: Type.BOOLEAN }
                        },
                        required: ['extractedName', 'teamResult', 'kills', 'isMvp']
                    }
                }
            }
        });

        const text = response.text;
        if (!text) return [];
        return JSON.parse(text);

    } catch (error) {
        console.error("Scoreboard analysis error:", error);
        return [];
    }
};
