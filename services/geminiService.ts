
import { GoogleGenAI, Modality } from "@google/genai";

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const fileToGenerativePart = (base64Data: string, mimeType: string) => {
  return {
    inlineData: {
      data: base64Data.split(",")[1],
      mimeType,
    },
  };
};

export const editImageWithMask = async (
  originalImage: { data: string; mimeType: string },
  maskImage: { data: string; mimeType: string },
  prompt: string
): Promise<string> => {
  const model = "gemini-2.5-flash-image";

  const finalPrompt = `
    You are an expert image editor. Use the provided original image and the mask image to perform an inpainting task.
    The second image provided is a mask. The white area in the mask indicates the region of the first image (the original image) that needs to be edited.
    Do not change any area outside the masked region.
    The user's instruction for the edit is: "${prompt}".
    Generate the edited image with the highest possible quality and realism, ensuring a seamless blend between the edited and unedited parts.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          fileToGenerativePart(originalImage.data, originalImage.mimeType),
          fileToGenerativePart(maskImage.data, maskImage.mimeType),
          { text: finalPrompt },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const base64ImageBytes: string = part.inlineData.data;
        const mimeType = part.inlineData.mimeType;
        return `data:${mimeType};base64,${base64ImageBytes}`;
      }
    }
    throw new Error("No image data found in the AI response.");
  } catch (error) {
    console.error("Error editing image with Gemini:", error);
    if (error instanceof Error) {
      throw new Error(`AI generation failed: ${error.message}`);
    }
    throw new Error("An unknown error occurred during AI image generation.");
  }
};
