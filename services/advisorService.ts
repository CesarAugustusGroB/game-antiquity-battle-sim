import { GoogleGenAI } from "@google/genai";
import { BattleStats } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const getTacticalAdvice = async (stats: BattleStats): Promise<string> => {
  if (!apiKey) return "API Key not configured.";

  const prompt = `
    You are a veteran military strategist analyzing an ancient battle.
    
    Data Feed:
    - Macedonia: ${stats.macedoniaCount} units, ${Math.round(stats.macedoniaMorale)}% Morale.
    - Eastern Empire: ${stats.easternCount} units, ${Math.round(stats.easternMorale)}% Morale.
    - Status: ${stats.status}

    Task:
    Analyze the battle lines. Look for breaking points, flanking opportunities, or morale collapse.
    Use your thinking time to simulate potential outcomes based on these numbers.
    
    Output:
    Provide a concise, gritty, 2-3 sentence tactical command or observation. 
    Style: "Grimdark", serious, cinematic.
    Example: "The Macedonian center buckles! Commit the reserves before the elephants trample our line."
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 32768 }, // Max thinking for deep analysis
      }
    });
    
    return response.text || "The battlefield is chaotic; orders are unclear.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Messengers intercepted. (API Error)";
  }
};