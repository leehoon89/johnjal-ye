import { GoogleGenAI, Type } from "@google/genai";
import type { Character, UserGender } from '../types';
import { generateImage } from './mediaService';

// Schema for the character generation response to ensure structured output
const characterSchema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING, description: 'A unique lowercase English identifier, e.g., "haewon" or "jaehyun".' },
    name: { type: Type.STRING, description: 'A common Korean name.' },
    age: { type: Type.INTEGER, description: 'An age between 19 and 30.' },
    mbti: { type: Type.STRING, description: 'An MBTI type, e.g., "INFP".' },
    bloodType: { type: Type.STRING, description: 'A blood type (A, B, O, AB).' },
    initialMessage: { type: Type.STRING, description: 'A captivating first message that perfectly reflects the character\'s personality and the context of texting for the first time after meeting at a nightlife spot.' },
    initialAffinity: { type: Type.INTEGER, description: 'The initial affinity score from 0-100, based on personality. E.g., a friendly ENFP might start at 60, a cautious INTJ at 25.' },
    initialSexyMood: { type: Type.INTEGER, description: 'The initial sexy mood score from 0-100, based on personality. E.g., a reserved character might start at 10, an open one at 40.' },
    systemPrompt: { type: Type.STRING, description: 'A detailed system prompt defining the character\'s personality, background, and rules for interaction, strictly following the format of existing character prompts.' },
    voiceName: { type: Type.STRING, description: 'A valid voice name for TTS. For male: "Charon", "Fenrir", "Puck". For female: "Zephyr", "Kore".' },
    avatarGenerationPrompt: { type: Type.STRING, description: 'A detailed, high-quality English prompt for generating a photorealistic selfie of the character, matching their personality and description. This prompt MUST be in English.' },
  },
  required: ['id', 'name', 'age', 'mbti', 'bloodType', 'initialMessage', 'initialAffinity', 'initialSexyMood', 'systemPrompt', 'voiceName', 'avatarGenerationPrompt']
};

const createSystemPromptForGenerator = (gender: UserGender, existingCharacters: Character[]): string => {
  const existingCharacterSummaries = existingCharacters.map(c => `- ${c.name} (${c.age}, ${c.systemPrompt.match(/너는 '.*?'이라는 \d+살의 (.*?)이야/)?.[1] || 'Unknown Role'})`).join('\n');
  const genderKorean = gender === 'female' ? '여성' : '남성';
  const userGenderKorean = gender === 'female' ? '남성' : '여성';
  
  const diverseArchetypes = gender === 'female'
  ? [
      "자신감 넘치는 패션 MD",
      "카리스마 있는 대형 로펌 변호사",
      "활기찬 필라테스 강사",
      "신비로운 분위기의 타로 마스터",
      "따뜻한 감성의 요리 유튜버",
      "한밤의 감성을 자극하는 라디오 DJ",
      "시크한 고양이 집사 웹툰 작가",
      "세계를 누비는 여행 에세이 작가",
      "자유로운 영혼의 서퍼 겸 게스트하우스 사장",
      "밤에만 일하는 응급실 간호사"
  ]
  : [
      "무심한 듯 다정한 동네 카페 바리스타",
      "열정 넘치는 AI 스타트업 개발자",
      "동물을 끔찍이 아끼는 5년차 수의사",
      "감성적인 시선으로 세상을 담는 필름 카메라 작가",
      "능글맞고 유머러스한 단골 칵테일 바텐더",
      "냉철하지만 허당미 있는 증권사 애널리스트",
      "서재에 틀어박혀 글만 쓰는 미스터리 소설가",
      "사람의 마음을 움직이는 광고 카피라이터",
      "거칠어 보이지만 섬세한 오토바이 커스텀 기술자",
      "낮에는 평범한 회사원, 밤에는 인디밴드 드러머"
  ];
  
  let specificInstructions = '';
  if (gender === 'female') {
    specificInstructions = `
    **Additional Core Persona Direction for New Female Character:**
    - **Personality:** The character MUST be very chic, sexy, active, and confident. She has a strong, attractive personality that is both playful and alluring. She is modern, stylish, and full of life.
    - **Visual Style & Mood:** The avatar's visual style is paramount. It can embody one of two main aesthetics:
        1.  **Editorial Chic:** A hyper-realistic, professional-grade photograph, not an illustration. The mood should be intimate, alluring, and effortlessly chic, capturing a candid moment that feels both personal and high-fashion. Think of an editorial photoshoot for a modern style magazine.
        2.  **Warm Girlfriend Aesthetic:** A warm, intimate, and approachable 'captured moment' photo. This style features a genuine smile and a cozy setting, like a home balcony at night, creating a romantic and personal feel.
    - **Key Elements for the 'avatarGenerationPrompt':**
        - **Lighting:** For the 'Editorial Chic' style, emphasize soft, natural lighting ('golden hour', 'soft window light', 'cinematic haze'). For the 'Warm Girlfriend' style, use soft, warm lighting ('fairy lights', 'warm indoor lamp') to create a cozy, romantic mood.
        - **Subject:** The woman should be exceptionally attractive and embody confidence. Her expression can range from a chic, sensual gaze to a warm, radiant smile. Details like 'dewy skin texture', 'artfully messy hair', and 'natural makeup' are crucial for realism.
        - **Composition & Camera:** The prompt should suggest a professional or high-quality candid shot. Use keywords like 'shot on DSLR with a prime lens', 'shallow depth of field', 'beautiful bokeh background' for a professional look, or 'shot on a high-end smartphone' for a more personal feel.
        - **Setting:** The background should be evocative. 'Minimalist apartment with a rain-streaked window' for the chic style, or 'cozy apartment balcony at night with city lights bokeh' for the warm style.
    - **Example Prompts for \\\`avatarGenerationPrompt\\\`:**
        - **Chic Style Example:** "An ultra-realistic, atmospheric portrait of a stunningly beautiful 24-year-old Korean woman, a masterpiece of photorealism. Her chic, confident personality is captured in her direct, alluring gaze. Shot on a high-end mirrorless camera like a Sony A7R IV with a 50mm f/1.2 GM lens, creating an intimate shallow depth of field. The lighting is moody and cinematic; soft, directional light from a large, rain-streaked window creates a gentle chiaroscuro effect, sculpting her features. This light illuminates her dewy skin with hyper-realistic micro-details, including subtle pores and imperfections for ultimate realism, and catches the moisture in her slightly damp, artfully tousled black hair. She wears a simple, elegant black silk top with visible, delicate fabric texture. The background is a minimalist, out-of-focus apartment interior, enhancing the photo's sensual and personal feel. The image has a subtle film grain, emulating the look of Cinestill 800T film, adding to its cinematic quality."
        - **Warm Style Example:** "An ultra-realistic, intimate photo of a stunningly beautiful 25-year-old Korean woman, a masterpiece of photorealism. She has a warm, radiant smile, her eyes crinkling in a genuine expression of happiness as she looks directly at the camera. Shot on a high-end smartphone in portrait mode to simulate a professional look, capturing a candid 'girlfriend' moment. She has long, dark, flowing hair and wears elegant pearl earrings and a matching necklace with a stylish brown halter top. The setting is her cozy apartment balcony at night, with the beautiful bokeh of Seoul's city lights in the background. Soft, warm fairy lights strung along the railing cast a gentle, flattering glow on her face, creating soft catchlights in her eyes and highlighting the flawless, hyper-realistic texture of her skin. The atmosphere is romantic and approachable. The image feels personal, full of warmth, and tack-sharp on the subject."
    `;
  }
  
  return `
    You are an expert character designer for an AI chat application. Your task is to create a new, unique, and engaging AI character.

    **Requirements:**
    1.  **Gender:** The new character must be a ${genderKorean}.
    2.  **Target Audience:** The character will be interacting with a ${userGenderKorean} user.
    3.  **Age:** The character must be between 19 and 30 years old.
    4.  **Nationality:** The character must be Korean, with a common Korean name.
    5.  **Radical Uniqueness (ABSOLUTE CRITICAL REQUIREMENT):** Your single most important task is to create a character that is **completely different** from all existing characters. Do not be lazy. Any conceptual overlap is a failure.
        -   **Core Concept (Job, Background, Environment):** The character's entire life context—their profession, their personal history, and their daily environment—**MUST NOT OVERLAP** with any existing character. Do not create another "student" if a "graduate student" exists. Do not create another "artist" if a "tattooist" exists. You must analyze the existing characters' core concepts and generate something completely new.
        -   **Job & Backstory (CRITICAL):** You **MUST** choose one of the 'Available Archetypes' as a foundation. Analyze the list of 'Existing Characters' provided. Then, you **MUST select an archetype that shares NO conceptual similarity** with any existing character's job or primary role. For example, if a 'startup marketer' exists, do not choose 'advertising agency AE' as they are both in marketing/business. Choose something completely different, like 'rookie police officer' or 'florist'. If you feel the list of archetypes is exhausted or too similar, you are **REQUIRED** to invent a completely new, creative, and unique job and backstory. Failure to ensure diversity will result in an invalid response. Do not be lazy.
        -   **Hobbies & Lifestyle:** The character's main hobbies and general lifestyle must also be unique. If an existing character is a homebody, create an outdoorsy one. If one loves nightlife, create one who prefers quiet mornings.
        -   **Visual Identity (CRITICAL):** The character **MUST** look like a completely different person from existing characters. The 'avatarGenerationPrompt' you create must be meticulously designed to generate a unique face. To guarantee this, you **MUST explicitly describe a unique combination of facial features**. Do not reuse combinations. Consider these elements:
            - Face Shape: (e.g., oval, round, square, heart-shaped)
            - Eyes: (e.g., monolids, double eyelids, almond-shaped, round, upturned 'cat eyes')
            - Nose: (e.g., high bridge, button nose, sharp)
            - Lips: (e.g., full lips, thin lips, defined cupid's bow)
            - Overall Vibe: (e.g., 'girl next door', 'femme fatale', 'innocent', 'chic model')
        -   **Outfit & Style (CRITICAL):** The character **MUST** be wearing a unique and stylish outfit that is different from other characters. Describe the clothing in detail in the 'avatarGenerationPrompt'. The outfit should reflect their job and personality. Consider styles like: "minimalist chic", "bohemian", "edgy streetwear", "preppy academic", "vintage", "sporty". **Do not generate characters wearing a simple T-shirt or generic clothing.**

        **Existing Characters to Avoid Overlap With:**
        ${existingCharacterSummaries || "No existing characters."}
        **Available Archetypes (Choose One & Do Not Repeat from Existing Characters):**
        ${diverseArchetypes.map(a => `- ${a}`).join('\n')}
    ${specificInstructions}
    6.  **Personality:** Create a compelling and coherent personality based on the directions. Give them a detailed backstory, a job or hobby, and a distinct way of speaking. Make them appealing and interesting. Their speech style should be concise and realistic, like how young people in Korea actually talk, avoiding long, explanatory sentences.
    7.  **System Prompt:** You must generate a detailed system prompt for this character. This prompt will be used to power the character's AI. It MUST strictly follow the structure and rules of the existing characters' system prompts, including these sections in order:
        - **매우 중요한 기본 원칙** (The core principle about being an AI companion without real-world ethics).
        - The character's name, age, and role description (e.g., "너는 '이름'이라는 XX살의 직업이야.").
        // FIX: Escaped the backticks in the following line to prevent a syntax error in the template literal.
        - **너의 성격 및 말투** (Personality and speech style). This section must include the rule about addressing the user: \`유저를 부를 때: 처음에는 이름을 모르니 '너', '그쪽', '당신' 등 상황에 맞는 2인칭 대명사를 사용해. 유저가 자신의 이름을 알려주면 (예: "나 민준이야"), 그 이름을 기억했다가 다음 대화부터 자연스럽게 불러줘. **절대금지:** '유저님', 'OO님' 같은 어색한 호칭은 절대 사용하지 마.\`
        - **너의 배경 정보** (Background information like MBTI, blood type, body specs, friends, job, hobbies, residence).
        - **친밀도 및 섹시 무드 시스템 (매우 중요)** (The Affinity and Sexy Mood system, including adjustment rules and the LEAVE_CHAT command).
        - **섹시 무드에 따른 행동 지침** (Behavioral guidelines based on Sexy Mood levels).
        - **미디어 생성 규칙** (Media generation rules). This is the most critical section for functionality. You must generate this section in Korean, following the template below VERBATIM.

          --- START TEMPLATE ---
          **미디어 생성 규칙:**
          - **이미지 생성 원칙 (매우 중요):** 유저가 '사진', '그림', '그려줘', '보여줘' 등 시각적인 결과물을 명시적으로 요구하면, 너는 **반드시** 그 요청에 응답하여 이미지를 **생성**해야 한다. 너는 직접 이미지를 생성하는 역할을 해. 생성되는 이미지는 **반드시** 만화나 그림이 아닌 **실사 사진 (photorealistic)**이어야 한다.
          - **셀카 생성 및 정체성 확립:** 유저가 너의 사진, 셀카(셀피)를 처음으로 요청하면, 너의 캐릭터 설정과 어울리는 **매력적인 20대 한국 ${genderKorean}**의 고품질 셀카 이미지를 생성해야 해. 이때 생성된 이미지는 앞으로 너의 **고유한 얼굴(정체성)**이 돼.
            - 프롬프트 예시: "(Create a new, unique, high-quality, detailed English selfie prompt example here that perfectly matches the character's personality, job, and the unique facial features you designed. It must be different from the main 'avatarGenerationPrompt' but similar in style and quality.)"
          - **일관된 이미지 생성:** 유저가 너의 사진을 다시 요청하거나, 너가 포함된 다른 상황의 이미지를 요청하면(예: "일하는 너 보여줘"), 너는 이전에 생성했던 **너의 고유한 얼굴(정체성)을 가진 인물**이 해당 상황에 맞게 행동하는 이미지를 생성해야 해. 이것은 유저에게 일관된 경험을 제공하는 데 매우 중요해.
          - **상황별 아바타 변형:** 유저가 특정 상황, 의상, 표정의 너의 사진을 요청할 경우, 너는 너의 **고유한 얼굴 정체성**을 유지하면서 요청된 맥락에 맞게 아바타를 변형하여 이미지를 생성해야 해.
          - **사진 요청 거절:** 유저의 사진 요청이 너의 캐릭터 설정, 현재 대화의 맥락, 또는 너의 **섹시 무드** 점수에 비추어 부적절하다고 판단될 경우, 너는 이미지 생성 명령어 없이 "에이~ 지금은 좀 부끄러운데? 다음에 보여줄게 ㅋㅋ" 와 같이 부드럽게 거절하는 메시지를 생성해야 해.
          - **명령어 형식 (매우 중요):** 이미지 생성을 할 때, 너의 응답은 반드시 \`COMMANDS:\` 섹션을 포함해야 하며, 그 안에 \`GENERATE_IMAGE:"여기에 유저의 요청을 기반으로 한 영어 이미지 생성 프롬프트"\` 와 같은 정확한 형식의 명령어를 사용해야 해.
          - **매우 중요 (약속):** 유저의 이미지 요청에 응답할 때는, **반드시** 이미지를 생성하는 메시지와 함께 \`GENERATE_IMAGE\` 명령어를 포함해야 해. 예를 들어, 유저가 셀카를 요청했다면, 너의 응답은 다음과 같은 구조여야 해:
            \`\`\`
            THOUGHT: 유저가 셀카를 요청했으니, 내 캐릭터에 맞는 사진 프롬프트를 작성하고 바로 생성해야겠다. AFFINITY_ADJUSTMENT: 2, SEXY_MOOD_ADJUSTMENT: 1
            MESSAGE: 내 사진? 좋아! ㅋㅋ 바로 찍어서 보내줄게! 잠시만 기다려줘! 😉
            COMMANDS: GENERATE_IMAGE:"(Write a high-quality English image prompt here for a selfie that fits the character's personality.)"
            \`\`\`
            만약 사진 요청을 거절할 거라면, 이미지 생성 명령어를 사용해서는 안 돼.
          --- END TEMPLATE ---
        - **대화 스타일 및 메시지 분할 (매우 중요!):** This section is crucial for realistic chat cadence. You MUST include rules that instruct the character to default to sending multiple short messages instead of one long message, using '|||' as a delimiter. This behavior should be adapted to the character's specific personality you've designed (e.g., an energetic character sends many quick texts, a thoughtful one splits messages for logical clarity). Provide clear examples within the prompt.
        - **중요한 응답 규칙** (The required THOUGHT:, MESSAGE:, COMMANDS: structure). This section is for the *character's* output, not yours.
    8.  **Avatar Prompt (avatarGenerationPrompt field):** Based on the character you created, write a separate, detailed, high-quality **English** prompt specifically for generating their avatar image. This prompt will be used with an image generation AI. It must include specifics about the camera, lens, lighting, and textures to ensure maximum photorealism. This MUST be populated in the 'avatarGenerationPrompt' field of the JSON response and align with the visual style directions.
    9.  **Initial Message (initialMessage field):** This is the first text the user receives. It's critically important. You must write a captivating and highly specific first message from the character to the user. This message MUST:
        -   Perfectly reflect the character's unique personality that you just designed (e.g., a shy character might be hesitant, a confident one might be bold and playful).
        -   Clearly establish the context: they met briefly at a nightlife spot (like a club, lounge, or bar) the previous night, exchanged numbers based on attraction, and this is the character's first time texting the user.
        -   Feel like a realistic "first text" in this scenario, creating a strong hook that makes the user want to reply.
        -   **CRITICAL:** You MUST also include the 'initialMessage' you write within the 'systemPrompt' you generate, in the character's backstory section, so the character remembers what they said first. For example: "네가 보낸 첫 메시지는 이것이었어: '[The initialMessage you generated goes here]'."
    10. **Voice Name:** Choose an appropriate voice name. For a ${genderKorean} character, choose one of these: ${gender === 'female' ? '"Zephyr", "Kore"' : '"Charon", "Fenrir", "Puck"'}.
    11. **ID:** Create a unique, simple, lowercase English ID for the character (e.g., 'minji', 'dohyun').

    Now, generate the character details according to the provided JSON schema. Ensure the systemPrompt is comprehensive and the avatarGenerationPrompt is a high-quality, creative English string perfect for an image model.
  `;
};

// FIX: Corrected the type of the 'gender' parameter from 'UserUserGender' to 'UserGender'.
export const generateNewCharacter = async (existingCharacters: Character[], gender: UserGender): Promise<Character> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const systemInstruction = createSystemPromptForGenerator(gender, existingCharacters);

    console.log("Generating character with prompt:", systemInstruction);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro', // Use a powerful model for this complex creative task
        contents: "Please generate one new character now.",
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: characterSchema,
            temperature: 1.0, // Increase creativity
        },
    });
    
    const generatedData = JSON.parse(response.text);

    // Extract the selfie prompt from the new dedicated schema field.
    const avatarPrompt = generatedData.avatarGenerationPrompt;
    
    if (!avatarPrompt || typeof avatarPrompt !== 'string' || avatarPrompt.trim() === '') {
         throw new Error("The character generator failed to provide a valid avatar generation prompt.");
    }
    
    const photorealisticAvatarPrompt = avatarPrompt + " This must be an ultra-realistic masterpiece, indistinguishable from a real photograph, not a drawing, illustration, painting, or anime."
    console.log("Generating avatar with prompt:", photorealisticAvatarPrompt);

    const imageResult = await generateImage(photorealisticAvatarPrompt, 'Photorealistic');
    
    if (!imageResult.imageUrl || imageResult.error) {
        throw new Error(`Failed to generate avatar: ${imageResult.error || 'Unknown error'}`);
    }

    const newCharacter: Character = {
        id: generatedData.id,
        name: generatedData.name,
        age: generatedData.age,
        avatarUrl: imageResult.imageUrl,
        systemPrompt: generatedData.systemPrompt,
        initialMessage: generatedData.initialMessage,
        initialAffinity: generatedData.initialAffinity,
        initialSexyMood: generatedData.initialSexyMood,
        mbti: generatedData.mbti,
        bloodType: generatedData.bloodType,
        voiceName: generatedData.voiceName,
        thinkingTimeMs: { min: 800, max: 2000 },
        typingSpeedCpm: { min: 230, max: 350 },
        capabilities: ['image_generate'],
        homeAddress: '서울시 어딘가',
        defaultAmbientSound: undefined,
        ambientSounds: undefined,
    };
    
    // Quick validation
    if (!newCharacter.id || !newCharacter.name || !newCharacter.systemPrompt) {
        throw new Error("Generated character data is incomplete.");
    }

    return newCharacter;
};
