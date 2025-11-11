
import { GoogleGenAI, Modality } from "@google/genai";
import type { Character, GeminiContent } from '../types';

interface GeminiResponse {
  texts: string[];
  affinityAdjustment: number;
  sexyMoodAdjustment: number;
  hasLeft: boolean;
  imageGenerationPrompt?: string;
  editImage: boolean;
  isError?: boolean;
}

export const generateChatResponse = async (
  character: Character,
  contents: GeminiContent[]
): Promise<GeminiResponse> => {
  try {
    if (contents.length === 0) {
      return { texts: [], affinityAdjustment: 0, sexyMoodAdjustment: 0, hasLeft: false, editImage: false };
    }

    const currentAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await currentAi.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        systemInstruction: character.systemPrompt,
      },
    });
    
    // 1. Check for prompt-level blocks which indicate the entire request was rejected.
    if (response.promptFeedback?.blockReason) {
        const reason = response.promptFeedback.blockReason;
        console.warn(`Prompt was blocked for safety reasons: ${reason}`, { feedback: response.promptFeedback });
        return {
            texts: ["미안, 내 안전 필터가 작동해서 그 메시지를 보낼 수 없어. 다른 주제로 이야기해줄래? 😇"],
            affinityAdjustment: -5,
            sexyMoodAdjustment: 0,
            hasLeft: false,
            editImage: false,
            isError: true,
        };
    }

    const candidate = response.candidates?.[0];

    // 2. Check if a candidate was returned at all.
    if (!candidate) {
        console.error("Error generating chat response: No candidate in response.", { fullResponse: response });
        return {
            texts: ["모델이 응답을 생성하지 않았어. 😥 잠시 후에 다시 시도해 줄래?"],
            affinityAdjustment: -1,
            sexyMoodAdjustment: 0,
            hasLeft: false,
            editImage: false,
            isError: true,
        };
    }
    
    // 3. Check for abnormal finish reasons. 'STOP' and 'SUCCESS' are good.
    const { finishReason } = candidate;
    if (finishReason && finishReason !== 'STOP' && finishReason !== 'SUCCESS') {
         console.warn(`Response finished with non-standard reason: ${finishReason}`);
         let errorMessage = "음... 뭐라고 답해야 할지 모르겠네. 😅 다시 한번 말해줄래?";
         if (finishReason === 'SAFETY') {
            errorMessage = "미안, 내 응답이 안전 필터에 걸렸어. 다른 방식으로 질문해줄래? 🤔";
         } else if (finishReason === 'RECITATION') {
            errorMessage = "소스 자료를 너무 많이 인용한 것 같아. 조금 다르게 질문해줄래?";
         } else if (finishReason === 'MAX_TOKENS') {
            errorMessage = "앗, 너무 길게 이야기했나 봐. 조금 짧게 다시 말해줄래?";
         } else {
             errorMessage = `응답을 생성하다가 문제가 발생했어. (이유: ${finishReason})`;
         }
         return {
            texts: [errorMessage],
            affinityAdjustment: -2,
            sexyMoodAdjustment: 0,
            hasLeft: false,
            editImage: false,
            isError: true,
        };
    }
    
    // 4. Safely extract the raw text content.
    const rawResponse = response.text;
    
    // 5. Check for empty/null text content, which can happen even with a 'STOP' reason.
    if (rawResponse === null || typeof rawResponse === 'undefined' || rawResponse.trim() === '') {
        console.warn("Error generating chat response: Response text is empty.", { candidate });
        return {
            texts: ["모델이 빈 응답을 보냈어. 대화가 막힌 것 같아. 다른 질문을 해볼까? 🧐"],
            affinityAdjustment: -1,
            sexyMoodAdjustment: 0,
            hasLeft: false,
            editImage: false,
            isError: true,
        };
    }
    
    // 6. Parse the validated text response
    let affinityAdjustment = 0;
    let sexyMoodAdjustment = 0;
    let hasLeft = false;
    let editImage = false;
    let imageGenerationPrompt: string | undefined = undefined;
    
    // First, parse the entire raw response for metadata and commands
    const affinityMatch = rawResponse.match(/AFFINITY_ADJUSTMENT:\s*([+-]?\d+)/);
    if (affinityMatch?.[1]) {
        affinityAdjustment = parseInt(affinityMatch[1], 10);
    }

    const sexyMoodMatch = rawResponse.match(/SEXY_MOOD_ADJUSTMENT:\s*([+-]?\d+)/);
    if (sexyMoodMatch?.[1]) {
        sexyMoodAdjustment = parseInt(sexyMoodMatch[1], 10);
    }

    hasLeft = /LEAVE_CHAT/.test(rawResponse);
    editImage = /EDIT_IMAGE/.test(rawResponse);
    
    const imageGenerateRegex = /GENERATE_IMAGE:"([^"]+)"/g;
    const imageGenerateMatch = imageGenerateRegex.exec(rawResponse);
    if (imageGenerateMatch?.[1]) {
        imageGenerationPrompt = imageGenerateMatch[1];
    }
    
    // Next, extract the user-facing message content, which may need cleaning
    let messageContent = '';
    let parsedSuccessfully = false;

    // 1. Attempt to parse as JSON first, as it's a common structured response.
    try {
        const cleanedJsonString = rawResponse.trim().replace(/^```json\s*|```\s*$/g, '');
        const parsedJson = JSON.parse(cleanedJsonString);
        if (parsedJson && typeof parsedJson.MESSAGE === 'string') {
            messageContent = parsedJson.MESSAGE;
            parsedSuccessfully = true;
        }
    } catch (e) {
        // Not valid JSON, will proceed to regex parsing.
    }

    // 2. If JSON parsing failed, use robust regex for plain text format.
    if (!parsedSuccessfully) {
        const messageMatch = rawResponse.match(/(?:MESSAGE|inMESSAGE):([\s\S]*?)(?:COMMANDS:|$)/si);
        if (messageMatch && typeof messageMatch[1] === 'string') {
            messageContent = messageMatch[1];
            parsedSuccessfully = true;
        }
    }
    
    // 3. Fallback if both primary methods fail to extract a clean message.
    if (!parsedSuccessfully) {
        messageContent = rawResponse;
    }
    
    // 4. Aggressively clean the extracted message content to remove any metadata that shouldn't be displayed.
    let finalMessage = messageContent
        .replace(/AFFINITY_ADJUSTMENT:\s*[+-]?\d+,?/g, '')
        .replace(/SEXY_MOOD_ADJUSTMENT:\s*[+-]?\d+,?/g, '')
        .replace(/GENERATE_IMAGE:"([^"]+)"/g, '')
        .replace(/LEAVE_CHAT/g, '')
        .replace(/EDIT_IMAGE/g, '')
        .replace(/COMMANDS:[\s\S]*/, '')
        .replace(/THOUGHT:[\s\S]*?(?:MESSAGE|inMESSAGE):/si, '')
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .trim();

    if (finalMessage.startsWith(`"`) && finalMessage.endsWith(`"`)) {
        finalMessage = finalMessage.substring(1, finalMessage.length - 1).trim();
    }
    
    const texts = finalMessage.split('|||').map(m => m.trim()).filter(m => m.length > 0);

    // Final sanity check
    if (texts.length === 0 && !imageGenerationPrompt && !editImage) {
        console.warn("Parsing resulted in an empty message. Using raw response as fallback.", { rawResponse });
        if (rawResponse.trim()) {
           // If the raw response is a JSON object we failed to parse, don't show it.
           if (rawResponse.trim().startsWith('{') && rawResponse.trim().endsWith('}')) {
             texts.push("캐릭터가 응답하는 데 문제가 발생했어요. 😥");
           } else {
             texts.push(rawResponse);
           }
        }
    }

    return {
      texts,
      affinityAdjustment,
      sexyMoodAdjustment,
      hasLeft,
      imageGenerationPrompt,
      editImage,
    };

  } catch (error) {
    console.error("Error generating chat response:", error);
    let errorMessage = "미안, 지금은 답장을 보낼 수 없어. 😢 나중에 다시 시도해줘.";

    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
        try {
            const errorDetails = JSON.parse(error.message);
            const apiError = errorDetails.error;

            if (apiError && apiError.message) {
                const status = apiError.status || (apiError.code ? `Code ${apiError.code}` : 'Error');
                console.error(`API Error [${status}]: ${apiError.message}`);
                
                switch (apiError.code) {
                    case 400:
                        errorMessage = "요청이 잘못된 것 같아. 대화 내용에 문제가 있을 수 있어. 🧐";
                        break;
                    case 429:
                        errorMessage = "API 사용량이 너무 많아. 잠시 후에 다시 시도해 줄래? 🙏";
                        break;
                    case 500:
                    case 503:
                        errorMessage = "서버에 일시적인 문제가 발생했어. 잠시 후에 다시 시도해 줄래? 😥";
                        break;
                    default:
                        errorMessage = `[${status}] ${apiError.message}`;
                        break;
                }
            } else if (error.message.includes('API key not valid') || error.message.includes('entity was not found')) {
                 errorMessage = "API 키가 유효하지 않습니다. Google AI Studio에서 설정을 확인해주세요.";
            } else {
                errorMessage = `알 수 없는 오류가 발생했습니다: ${error.message}`;
            }
        } catch (parseError) {
            if (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED')) {
                errorMessage = "API 사용량 한도를 초과했습니다. Google AI Studio에서 요금제 및 결제 세부 정보를 확인해주세요.";
            } else if (error.message.includes('API key not valid') || error.message.includes('entity was not found')) {
                errorMessage = "API 키가 유효하지 않습니다. Google AI Studio에서 설정을 확인해주세요.";
            } else if (error.message.includes('SAFETY')) {
                 errorMessage = "미안, 안전상의 이유로 이 요청을 처리할 수 없어. 다른 주제로 이야기해줄래? 😇";
            } else {
                 errorMessage = `오류가 발생했습니다: ${error.message}`;
            }
        }
    }
    
    return {
      texts: [errorMessage],
      affinityAdjustment: 0,
      sexyMoodAdjustment: 0,
      hasLeft: false,
      editImage: false,
      isError: true,
    };
  }
};
