
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { ImageSize } from "../types";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
// In a real app, we check if key exists. For this demo, we assume the environment injects it.
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
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite-preview-02-04',
      contents: `Analyze this player name/UID for appropriateness in a tournament: ${text}. Return JSON with valid: boolean and reason: string.`,
      config: { responseMimeType: 'application/json' }
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
    // Note: In a real browser environment requiring user-selected keys for Veo/Pro Image, 
    // we would handle the key selection flow. Assuming env key is valid for this demo structure.
    
    // The prompt expects the model to generate an image.
    // We use generateContent with tools or direct image generation depending on updated SDK specifics.
    // Based on guidelines, we use generateContent for nano banana series models, checking parts.
    
    // However, guidelines say: "Upgrade to gemini-3-pro-image-preview if the user requests high-quality images".
    // And "Call generateContent to generate images with nano banana series models".
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: `A cool Call of Duty Mobile style avatar: ${prompt}` }]
      },
      config: {
        imageConfig: {
          imageSize: size,
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
    // Remove header if present for raw base64
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

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

        const prompt = `
        Analyze this Call of Duty Mobile match result scoreboard image strictly.
        
        Rules for Extraction:
        1. Identify the match score (e.g., 5-2). The team with 5 rounds won is the WINNER. The other team is the LOSER.
        2. Extract each player row visible.
        3. For "kills", look for the first number in the K/D/A format (Bajas/Muertes/Asistencias).
        4. MVP Rule: The player at the very top of the Winning team list is the Winning MVP. The player at the very top of the Losing team list is the Losing MVP.
        5. Return a JSON array.

        If a value is not clearly visible, use null or "Not detected". Do not invent data.

        Response Schema:
        Array of Objects:
        {
            "extractedName": string,
            "teamResult": "WIN" or "LOSS",
            "kills": number,
            "isMvp": boolean
        }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
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
                            teamResult: { type: Type.STRING, enum: ['WIN', 'LOSS'] },
                            kills: { type: Type.INTEGER },
                            isMvp: { type: Type.BOOLEAN }
                        }
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
