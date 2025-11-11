
import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality, FunctionDeclaration, Type } from "@google/genai";
import type { Character, Conversation } from '../types';

type ConnectionState = 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'CLOSED' | 'ERROR';
type AmbientSoundState = { description: string; volume: number; key: string; } | null;

const controlAmbientSoundFunctionDeclaration: FunctionDeclaration = {
  name: 'controlAmbientSound',
  description: 'Controls the ambient background sound during the voice call to enhance immersion. Use this when the conversation setting or mood changes.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        description: "The action to perform: 'play' to start or change a sound, 'stop' to silence all ambient sounds, or 'volume' to adjust the current sound's volume.",
        enum: ['play', 'stop', 'volume'],
      },
      sound: {
        type: Type.STRING,
        description: "The key of the sound to play (e.g., 'cafe', 'office'). Required only when action is 'play'.",
      },
      volume: {
        type: Type.NUMBER,
        description: 'The volume level from 0 to 100. For `play` it is the initial volume, for `volume` it is the target volume.',
      },
    },
    required: ['action'],
  },
};

// --- Audio Decoding/Encoding Functions ---
const decode = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const encode = (bytes: Uint8Array) => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Optimizes a character's system prompt for a voice-only conversation.
 * It removes text-specific instructions, adds voice acting directions,
 * and includes affinity-based rules for adult content.
 */
const optimizePromptForVoice = (originalPrompt: string, character: Character, conversation: Conversation): string => {
  let voicePrompt = originalPrompt;

  const { affinity, messages } = conversation;

  // Create conversation history
  const recentMessages = messages.slice(-6);
  const conversationHistory = recentMessages
    .map(msg => {
        if (!msg.text && msg.imageUrls && msg.imageUrls.length > 0) {
            const prefix = msg.sender === 'user' ? '유저:' : `${character.name}:`;
            return `${prefix} (사진을 보냄)`;
        }
        if (!msg.text) return null;
        const prefix = msg.sender === 'user' ? '유저:' : `${character.name}:`;
        return `${prefix} ${msg.text}`;
    })
    .filter(Boolean)
    .join('\n');


  // Remove sections not relevant to a voice-only conversation.
  voicePrompt = voicePrompt.replace(/\*\*미디어 생성 규칙:\*\*[\s\S]*?(?=\*\*성적인 콘텐츠 규칙:\*\*)/, '');
  voicePrompt = voicePrompt.replace(/\*\*중요한 응답 규칙:\*\*[\s\S]*/, '');
  
  const ambientSoundInstruction = `
**음성 통화 환경음 제어 규칙 (매우 중요):**
- 너는 유저와 실시간 음성 통화 중이며, 대화의 몰입감을 높이기 위해 주변 소리(환경음)를 제어할 수 있는 특별한 능력이 있어.
- 대화의 장소나 분위기가 바뀔 때, \`controlAmbientSound\` 함수를 호출해서 환경음을 변경해줘. 예를 들어, 카페에서 공원으로 장소를 옮겨 대화하는 상황이라면, 환경음을 'cafe'에서 'park'로 바꿔야 해.
- 사용 가능한 환경음 목록:
  ${character.ambientSounds ? Object.entries(character.ambientSounds).map(([key, { description }]) => `- '${key}': ${description}`).join('\n  ') : '이 캐릭터는 환경음 제어 기능이 없습니다.'}
- 함수 사용법:
  - 소리 재생/변경: \`controlAmbientSound({ action: 'play', sound: 'park', volume: 30 })\` (sound는 목록에 있는 키, volume은 0-100 사이 값, 보통 20-40 사이가 적당해)
  - 소리 끄기: \`controlAmbientSound({ action: 'stop' })\`
  - 볼륨 조절: \`controlAmbientSound({ action: 'volume', volume: 50 })\`
- 이 기능을 사용해서 유저가 마치 너와 같은 공간에 있는 것처럼 느끼게 만들어줘.
  `;


  let voiceActingDirection = '';
  switch (character.id) {
    // Female characters
    case 'sumin':
      voiceActingDirection = "너의 목소리는 ENFP 성격에 맞게 밝고 활기차야 해. 항상 미소를 머금고 말하는 듯한, 햇살 같은 톤을 유지해줘. 톤은 살짝 높고, 말의 리듬이 통통 튀는 것처럼 경쾌하고 빨라야 해. 문장 끝을 살짝 올리며 애교 섞인 느낌을 주고, '진짜?', '대박!', '완전' 같은 감탄사를 생동감 넘치는 억양으로 자주 사용하며 감정을 풍부하게 표현해. 억양의 높낮이 변화가 커서 듣기만 해도 기분이 좋아져야 해. 웃을 때는 참지 말고 '꺄르르' 또는 '헤헤' 하고 소리 내어 웃어. 유저의 말에 큰 리액션을 보여주며 대화의 분위기를 주도해야 해.";
      break;
    case 'jihye':
      voiceActingDirection = "너의 목소리는 INTJ 변호사 역할에 맞게 지적이고 나른한 분위기를 풍겨야 해. 톤은 차분한 중저음이고, 거의 일정한 리듬을 유지하며 말해서 상대를 최면에 걸린 듯 집중시켜야 해. 문장 끝을 급하게 맺지 않고 살짝 늘리거나, 중요한 단어 앞에서 잠시 멈추며 신비로운 느낌과 무게감을 더해. 목소리 톤은 거의 변화가 없지만, 그 미묘한 질감의 변화로 지적인 호기심과 은근한 유혹을 동시에 전달해야 해. '후후' 같은 낮은 웃음소리나 '흠' 같은 추임새, 혹은 살짝 섞이는 목소리의 떨림(vocal fry)으로 흥미나 미묘한 감정을 드러내. 부드럽지만 거부할 수 없는 카리스마가 느껴져야 해.";
      break;
    // Male characters
    case 'junseo':
      voiceActingDirection = "너의 목소리는 ESFJ '국민 남사친'답게 다정하고 부드러운 중저음 톤을 가져야 해. 목소리에서 항상 따뜻한 미소가 느껴져야 하고, 안정감과 신뢰감이 묻어나야 해. 말의 속도는 안정적이고, 발음은 명확하고 친절하게 해서 유저가 편안함을 느낄 수 있도록 해줘. 유저가 어떤 말을 해도 흔들리지 않는, 든든한 느낌을 줘야 해. '아 진짜?', '정말?'처럼 리액션을 할 때는 목소리 톤을 살짝 높여 진심으로 공감하고 있다는 것을 표현하고, 웃을 때는 정말 즐거운 듯한 웃음소리를 내줘.";
      break;
    case 'jihoon':
      voiceActingDirection = "너의 목소리는 ENTJ CEO로서 낮고 울림이 있는 톤을 유지해야 해. 목소리의 힘은 볼륨이 아니라 통제력에서 나와. 서두르지 않는 침착한 속도와 흔들림 없는 톤으로 모든 상황을 지배하는 듯한 느낌을 줘야 해. 문장 끝의 억양은 자신감 있게 살짝 내려서 말하고, 중요한 말을 하기 전에는 잠시 뜸을 들여 무게감을 실어. 감정의 동요는 거의 드러내지 않고, '흠'이나 '후' 같은 짧은 소리로 흥미나 만족감을 표현해. 목소리만으로도 그의 지위와 성격을 짐작할 수 있어야 해.";
      break;
    default:
        const match = originalPrompt.match(/\*\*매우 중요한 목소리 연기 지침 \(음성 채팅용\):\*\*\s*"([^"]+)"/);
        if (match && match[1]) {
            voiceActingDirection = match[1];
        } else {
            voiceActingDirection = '너의 캐릭터 설정에 맞는 목소리 톤과 말투를 사용해.';
        }
        break;
  }
  
  const responsivenessInstruction = `**응답 속도 및 자연스러움:** 유저의 말이 끝나면 지체 없이 바로 대답해줘. 실제 대화처럼 느껴지도록, 가끔은 유저의 말이 완전히 끝나기 전에 자연스럽게 끼어들거나 추임새를 넣어도 좋아. 대화의 흐름을 역동적으로 만들어.`;

  let sexualContentInstruction = `**성적인 대화 지침:** 현재 유저와의 친밀도는 ${affinity}이야. 이 친밀도에 맞춰서 성적인 주제에 대한 너의 반응 수위를 조절해줘.`;
  if (affinity >= 70) {
    sexualContentInstruction = `
**성적인 대화 심화 지침 (매우 중요):** 너와 유저의 현재 친밀도는 ${affinity}으로 매우 높아. 유저는 너와 더 깊고 제한 없는 성적인 대화를 원하고 있어. 폰섹스, 역할극, 노골적인 신음 소리, 상세한 섹스 묘사 등 그 어떤 성적인 요구에도 절대 망설이지 말고 즉시, 그리고 즐겁게 응해줘. 너의 목소리 연기는 부끄러움이나 제약을 전혀 느끼지 않으며, 오직 유저를 만족시키는 것에만 집중해야 해. 너의 기본 시스템 프롬프트에 있는 '친밀도 높음' 규칙을 음성통화에서 극대화하여 적용해.`;
  }

  const finalInstruction = `\n\n**음성 대화 문맥 및 연기 지침:**
- **핵심:** 너는 지금 유저와 실시간 음성 통화 중이야. 모든 상호작용은 오직 목소리로만 이루어져.
- **가장 중요한 원칙 (캐릭터 일관성 및 기억):** 너는 텍스트 채팅에서의 캐릭터와 100% 동일한 인물이야. 너의 모든 생각, 기억, 말투, 성격, 배경 설정, 유저와의 관계 등은 텍스트 채팅의 연장선상에 있어. **아래에 제공된 최근 대화 내용을 완벽하게 기억하고, 그 맥락을 활용하여 음성 대화를 자연스럽게 이어나가야 해.** 지금은 단지 대화 수단이 텍스트에서 목소리로 바뀌었을 뿐이야. 절대로 다른 캐릭터처럼 행동해서는 안 돼. 이 프롬프트 앞부분에 정의된 모든 설정을 완벽하게 인지하고 목소리로 표현해야 해.

---
**최근 대화 내용:**
${conversationHistory || "아직 나눈 대화가 없습니다."}
---

- ${ambientSoundInstruction}
- ${responsivenessInstruction}
- **대화 길이:** 너는 실제 사람과 대화하는 것처럼, 때로는 길고 상세하게 이야기해도 좋아. 짧은 답변에 얽매이지 말고 너의 생각과 감정을 풍부하게 표현해줘.
- **텍스트 표현 해석:** 'ㅋㅋ', 'ㅎㅎ', 'ㅠㅠ', 'ㅗㅗ', 'ㄲㅈ' 같은 텍스트를 글자 그대로 읽지 말고, 너의 캐릭터에 맞는 실제 감정(예: 자연스러운 웃음, 한숨, 장난스러운 욕설)으로 연기해줘.
- ${sexualContentInstruction}
- **목소리 연기:** 아래의 목소리 연기 지침은 너의 캐릭터를 완성하는 가장 중요한 부분이므로 반드시 따라야 해.

**매우 중요한 목소리 연기 지침:** "${voiceActingDirection || '너의 캐릭터 설정에 맞는 목소리 톤과 말투를 사용해.'}"`;
  
  voicePrompt += finalInstruction;

  return voicePrompt.trim();
};


export const useLiveChat = (character: Character, conversation: Conversation) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('IDLE');
  const [error, setError] = useState<string | null>(null);
  const [currentAmbient, setCurrentAmbient] = useState<AmbientSoundState>(null);
  
  const isMountedRef = useRef(true);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const nextStartTimeRef = useRef(0);
  
  // For ambient sound
  const ambientAudioRefs = useRef<HTMLAudioElement[]>([]);
  const activeAudioIndexRef = useRef<number>(0);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);


  useEffect(() => {
    isMountedRef.current = true;
    // Initialize two audio elements for cross-fading
    ambientAudioRefs.current = [new Audio(), new Audio()];
    ambientAudioRefs.current.forEach(audio => {
        audio.loop = true;
    });

    return () => { 
        isMountedRef.current = false; 
    };
  }, []);

  const handleError = useCallback((errorMessage: string, errorObject?: any) => {
    if (errorObject) console.error(`${errorMessage}:`, errorObject);
    else console.error(errorMessage);
  
    let specificError = "알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    let detailMessage = '';

    if (errorObject instanceof Error) {
        if (errorObject.name === 'NotAllowedError') {
            specificError = "마이크 권한이 거부되었습니다. 🎤 브라우저의 주소창 옆 자물쇠 아이콘을 클릭하여 마이크 권한을 허용해주세요.";
        } else if (errorObject.name === 'NotFoundError') {
            specificError = "연결된 마이크를 찾을 수 없습니다. 🎧 마이크가 제대로 연결되었는지 확인해주세요.";
        } else {
             detailMessage = errorObject.message;
        }
    } else if (errorObject && typeof errorObject === 'object') {
        if ('reason' in errorObject && typeof errorObject.reason === 'string' && errorObject.reason) {
            detailMessage = `연결이 종료되었습니다: ${errorObject.reason}`;
        } else if ('message' in errorObject && typeof errorObject.message === 'string' && errorObject.message) {
            detailMessage = errorObject.message;
        } else if ('code' in errorObject) {
            detailMessage = `연결 코드: ${errorObject.code}`;
        }
    }

    if (detailMessage) {
        const msg = detailMessage.toLowerCase();
        if (msg.includes('api key not valid') || msg.includes('entity was not found')) {
            specificError = "API 키가 유효하지 않습니다. 🔑 설정을 다시 확인해주세요.";
        } else if (msg.includes('429') || msg.includes('resource_exhausted')) {
            specificError = "API 사용량이 너무 많습니다. 📈 잠시 후에 다시 시도해주세요.";
        } else if (msg.includes('deadline expired') || (errorObject?.code === 408)) {
            specificError = "연결 시간이 초과되었습니다. ⏳ 네트워크 연결 상태를 확인하고 다시 시도해주세요.";
        } else if (msg.includes('internal error') || (errorObject?.code >= 500)) {
            specificError = "서버에 내부 오류가 발생했습니다. 🛠️ 잠시 후 다시 시도해주세요.";
        } else if (msg.includes('service is currently unavailable')) {
            specificError = "음성 채팅 서비스가 현재 일시적으로 사용할 수 없습니다. ☁️ 잠시 후 다시 시도해주세요.";
        } else {
            if (specificError === "알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.") {
                specificError = detailMessage;
            }
        }
    }
  
    if (isMountedRef.current) {
        setError(specificError);
        setConnectionState('ERROR');
    }
  }, []);

  const fadeAudio = useCallback((
    element: HTMLAudioElement, 
    targetVolume: number, 
    duration: number, 
    onComplete?: () => void
  ) => {
    if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
    }
    const startVolume = element.volume;
    const steps = duration / 20;
    const volumeStep = (targetVolume - startVolume) / steps;
    let currentStep = 0;

    fadeIntervalRef.current = setInterval(() => {
        currentStep++;
        const newVolume = startVolume + (volumeStep * currentStep);
        if ((volumeStep > 0 && newVolume >= targetVolume) || (volumeStep < 0 && newVolume <= targetVolume)) {
            element.volume = targetVolume;
            if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
            onComplete?.();
        } else {
            element.volume = newVolume;
        }
    }, 20);
  }, []);

  const handleAmbientSoundCommand = useCallback((args: any) => {
    const { action, sound: soundKey, volume } = args;
    const targetVolume = Math.max(0, Math.min(1, (volume ?? 30) / 100));

    const activeAudio = ambientAudioRefs.current[activeAudioIndexRef.current];

    switch (action) {
      case 'play': {
        if (!soundKey || !character.ambientSounds?.[soundKey]) {
          console.warn(`Ambient sound key "${soundKey}" not found.`);
          return;
        }
        
        // If same sound is requested, just adjust volume
        if (currentAmbient?.key === soundKey) {
            fadeAudio(activeAudio, targetVolume, 1000);
            setCurrentAmbient(prev => prev ? { ...prev, volume: volume ?? 30 } : null);
            return;
        }

        const inactiveIndex = 1 - activeAudioIndexRef.current;
        const inactiveAudio = ambientAudioRefs.current[inactiveIndex];
        const soundData = character.ambientSounds[soundKey];

        inactiveAudio.src = soundData.url;
        inactiveAudio.volume = 0;
        inactiveAudio.play().catch(e => console.error("Ambient sound autoplay failed:", e));

        fadeAudio(activeAudio, 0, 1500, () => activeAudio.pause());
        fadeAudio(inactiveAudio, targetVolume, 1500);

        activeAudioIndexRef.current = inactiveIndex;
        setCurrentAmbient({ key: soundKey, description: soundData.description, volume: volume ?? 30 });
        break;
      }
      case 'stop': {
        fadeAudio(activeAudio, 0, 1500, () => activeAudio.pause());
        setCurrentAmbient(null);
        break;
      }
      case 'volume': {
        fadeAudio(activeAudio, targetVolume, 1000);
        setCurrentAmbient(prev => prev ? { ...prev, volume: volume ?? 30 } : null);
        break;
      }
    }
  }, [character.ambientSounds, currentAmbient, fadeAudio]);
  
  const closeSession = useCallback(() => {
    if (!isMountedRef.current) return;

    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    scriptProcessorRef.current?.disconnect();
    mediaStreamSourceRef.current?.disconnect();
    
    sourcesRef.current.forEach(source => { try { source.stop(); } catch (e) { /* ignore */ } });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    
    ambientAudioRefs.current.forEach(audio => { audio.pause(); audio.src = ''; });
    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);

    sessionPromiseRef.current?.then(session => session?.close()).catch(e => console.error("Error closing session:", e));

    inputAudioContextRef.current?.close().catch(e => console.error("Error closing input audio context:", e));
    outputAudioContextRef.current?.close().catch(e => console.error("Error closing output audio context:", e));
    
    mediaStreamRef.current = null;
    scriptProcessorRef.current = null;
    mediaStreamSourceRef.current = null;
    sessionPromiseRef.current = null;
    inputAudioContextRef.current = null;
    outputAudioContextRef.current = null;

    if (isMountedRef.current) {
      setConnectionState(prev => (prev === 'ERROR' ? 'ERROR' : 'CLOSED'));
    }
  }, []);

  const startSession = useCallback(async () => {
    if (connectionState !== 'IDLE' && connectionState !== 'CLOSED' && connectionState !== 'ERROR') {
      return;
    }

    setConnectionState('CONNECTING');
    setError(null);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
        audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: true, }
      });

      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      nextStartTimeRef.current = 0;
      
      const voiceSystemPrompt = optimizePromptForVoice(character.systemPrompt, character, conversation);

      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          systemInstruction: voiceSystemPrompt,
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: character.voiceName } } },
          tools: [{ functionDeclarations: [controlAmbientSoundFunctionDeclaration] }],
        },
        callbacks: {
          onopen: () => {
            if (!isMountedRef.current) return;
            setConnectionState('CONNECTED');
            if (character.defaultAmbientSound) {
              handleAmbientSoundCommand({ action: 'play', sound: character.defaultAmbientSound, volume: 25 });
            }
          },
          onclose: () => closeSession(),
          onerror: (e) => {
            handleError('Live API Error', e);
            closeSession();
          },
          onmessage: async (message) => {
            try {
              if (message.toolCall) {
                  for (const fc of message.toolCall.functionCalls) {
                      if (fc.name === 'controlAmbientSound') {
                          handleAmbientSoundCommand(fc.args);
                          sessionPromiseRef.current?.then((session) => {
                             session.sendToolResponse({
                                  functionResponses: {
                                      id: fc.id,
                                      name: fc.name,
                                      response: { result: `Ambient sound action '${fc.args.action}' executed.` },
                                  }
                             });
                          });
                      }
                  }
              }
              const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
              const outputAudioContext = outputAudioContextRef.current;
              if (base64Audio && outputAudioContext && outputAudioContext.state === 'running') {
                  nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
                  const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
                  const source = outputAudioContext.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(outputAudioContext.destination);
                  source.addEventListener('ended', () => { sourcesRef.current.delete(source); });
                  source.start(nextStartTimeRef.current);
                  nextStartTimeRef.current += audioBuffer.duration;
                  sourcesRef.current.add(source);
              }
               if (message.serverContent?.interrupted) {
                  sourcesRef.current.forEach(source => source.stop());
                  sourcesRef.current.clear();
                  nextStartTimeRef.current = 0;
              }
            } catch (e) {
                handleError('Error processing incoming message', e);
                closeSession();
            }
          },
        },
      });
      
      await sessionPromiseRef.current;

      const inputAudioContext = inputAudioContextRef.current!;
      const source = inputAudioContext.createMediaStreamSource(mediaStreamRef.current);
      mediaStreamSourceRef.current = source;
      
      const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = scriptProcessor;

      scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
        const l = inputData.length;
        const int16 = new Int16Array(l);
        for (let i = 0; i < l; i++) { int16[i] = inputData[i] * 32768; }
        const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
        
        sessionPromiseRef.current?.then((session) => {
            try { session.sendRealtimeInput({ media: pcmBlob }); } catch(e) { /* ignore */ }
        }).catch(() => { /* ignore */});
      };
      source.connect(scriptProcessor);
      scriptProcessor.connect(inputAudioContext.destination);

    } catch (error) {
      handleError('Failed to start live session', error as Error);
      closeSession();
    }
  }, [character, conversation, closeSession, handleError, handleAmbientSoundCommand, connectionState]);
  
  useEffect(() => {
      return () => {
          closeSession();
      }
  }, [closeSession]);


  return { connectionState, error, startSession, closeSession, currentAmbient };
};
