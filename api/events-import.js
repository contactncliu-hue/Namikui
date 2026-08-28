import { GoogleGenAI, Type } from '@google/genai';

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Parses War Event screenshots (Outpost / Fortress Merit Rankings)
 * @param {string} imageBase64 - The screenshot encoded in base64
 */
export async function parseWarEventScreenshot(imageBase64) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: 'image/png',
            data: imageBase64
          }
        },
        // Direct prompt telling Gemini exactly what to grab
        "Perform OCR on this war event screenshot. Extract the Declaration Time, the War Event target name (e.g., 'Lv.2 Outpost' or 'Lv.5 Fortress'), and the list of member names shown. Do NOT include merits, ranking numbers, or points."
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            declaration_time: { 
              type: Type.STRING, 
              description: "The full timestamp after 'Declaration Time:'" 
            },
            war_event: { 
              type: Type.STRING, 
              description: "The event target, e.g., 'Lv.2 Outpost (776,626)'" 
            },
            member_names: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of player names found in the ranking table"
            }
          },
          required: ['declaration_time', 'war_event', 'member_names']
        }
      }
    });

    // Parse and return the JSON object directly
    const resultData = JSON.parse(response.text);
    return resultData;

  } catch (error) {
    console.error("Error reading war event screenshot:", error);
    throw error;
  }
}
