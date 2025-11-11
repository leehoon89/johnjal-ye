

import { GoogleGenAI, Modality } from "@google/genai";
import type { ImageStyle } from '../types';

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove "data:mime/type;base64," prefix
      resolve(result.split(',')[1]);
    };
    reader.onerror = error => reject(error);
  });

const processMediaApiResponse = (response: any, action: 'generation' | 'editing'): {imageUrl?: string, error?: string} => {
    const actionText = action === 'generation' ? '생성' : '편집';

    // 1. Check for prompt-level blocks which indicate the entire request was rejected.
    if (response.promptFeedback?.blockReason) {
        const reason = response.promptFeedback.blockReason;
        console.warn(`Image ${action} blocked due to prompt feedback: ${reason}`, { feedback: response.promptFeedback });
        return { error: `이미지 ${actionText} 요청이 거부되었어요. (이유: ${reason})` };
    }

    const candidate = response.candidates?.[0];

    // 2. Check if a candidate was returned at all.
    if (!candidate) {
        console.error(`Image ${action} failed: No candidate in response`, { fullResponse: response });
        return { error: `이미지를 ${actionText}하지 못했어요. 모델이 응답을 생성하지 않았습니다.` };
    }

    // 3. Check for abnormal finish reasons. 'STOP' and 'SUCCESS' are good.
    const { finishReason } = candidate;
    if (finishReason && finishReason !== 'STOP' && finishReason !== 'SUCCESS') {
         console.warn(`Image ${action} finished with non-standard reason: ${finishReason}`);
         if (finishReason === 'SAFETY' || finishReason === 'RECITATION' || finishReason === 'PROHIBITED_CONTENT') {
            return { error: '이미지 생성 요청이 안전상의 이유로 거부되었어요. 다른 내용으로 시도해주세요.' };
         }
         return { error: `이미지 생성이 비정상적으로 종료되었어요. (이유: ${finishReason})` };
    }

    // 4. Try to find the image data in the response parts.
    const imagePart = candidate.content?.parts?.find((part: any) => part.inlineData);
    if (imagePart?.inlineData) {
        const base64ImageBytes: string = imagePart.inlineData.data;
        const imageUrl = `data:${imagePart.inlineData.mimeType};base64,${base64ImageBytes}`;
        return { imageUrl };
    }
    
    // 5. If no image, check for an explanatory text response from the model.
    const textPart = response.text; // .text is a convenient accessor for the first text part.
    if (textPart) {
        console.warn(`Image ${action} returned a text response instead of an image:`, textPart);
        return { error: `이미지 ${actionText}에 실패하고 다음 메시지를 받았어요: "${textPart}"` };
    }
    
    // 6. If we reach here, the response is valid but contains neither image nor text. This is the original error case.
    console.error(`Image ${action} failed: No image data in response`, { fullResponse: response });
    return { error: `이미지를 ${actionText}하지 못했어요. 응답에 이미지 데이터가 포함되지 않았습니다.` };
};

const handleApiError = (e: unknown, action: 'generation' | 'editing'): { error: string } => {
    console.error(`Image ${action} failed with exception:`, e);
    const actionText = action === 'generation' ? '생성' : '편집';
    let errorMessage = `이미지 ${actionText} 중 오류가 발생했어요.`;
    if (e instanceof Error) {
        const msg = e.message.toLowerCase();
        if (msg.includes('429') || msg.includes('resource_exhausted')) {
            errorMessage = "API 사용량 한도를 초과했습니다. Google AI Studio에서 요금제 및 결제 세부 정보를 확인해주세요.";
        } else if (msg.includes('api key not valid')) {
            errorMessage = "API 키가 유효하지 않습니다. Google AI Studio에서 키를 확인해주세요.";
        } else if (msg.includes('safety')) {
            errorMessage = `이미지 ${actionText} 요청이 안전상의 이유로 거부되었어요. 다른 내용으로 시도해주세요.`;
        } else {
            errorMessage = e.message;
        }
    }
    return { error: errorMessage };
};

const styleSuffixes: Record<ImageStyle, string> = {
    'Photorealistic': ' This must be a photorealistic masterpiece, indistinguishable from a real photograph, high detail, sharp focus.',
    'Anime / Webtoon': ' vibrant anime style, webtoon aesthetic, digital art, clean line art, trending on pixiv, detailed background, masterpiece.',
    'Fantasy Art': ' epic fantasy art, highly detailed, intricate, concept art, matte painting, trending on ArtStation, cinematic lighting.',
    'Watercolor': ' beautiful watercolor painting, soft wash, vibrant colors, paper texture, wet-on-wet technique, artistic.',
    'Sketch': ' detailed black and white pencil sketch, artistic shading, cross-hatching, on textured paper, realistic proportions.'
};


export const generateImage = async (prompt: string, style: ImageStyle): Promise<{imageUrl?: string, error?: string}> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const finalPrompt = prompt + (styleSuffixes[style] || '');
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: finalPrompt }] },
            config: { responseModalities: [Modality.IMAGE] },
        });
        return processMediaApiResponse(response, 'generation');
    } catch (e) {
        return handleApiError(e, 'generation');
    }
}


export const editImage = async (file: File, prompt: string): Promise<{imageUrl?: string, error?: string}> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const base64Data = await fileToBase64(file);
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { data: base64Data, mimeType: file.type } },
                    { text: prompt },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        return processMediaApiResponse(response, 'editing');
    } catch (e) {
        return handleApiError(e, 'editing');
    }
};