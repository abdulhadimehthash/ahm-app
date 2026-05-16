const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// ─── Internal fetch ───────────────────────────────────────────────────────────

async function geminiPost(body: object): Promise<string> {
  const response = await fetch(
    `${GEMINI_URL}?key=${process.env.EXPO_PUBLIC_GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );

  const data = await response.json();
  console.log('Gemini response status:', response.status);
  console.log('Gemini response:', JSON.stringify(data));

  if (!response.ok) {
    throw new Error(`Gemini error ${response.status}: ${JSON.stringify(data)}`);
  }

  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) throw new Error('Empty response from Gemini');
  return text.trim();
}

// ─── Core text generation ─────────────────────────────────────────────────────

export async function generateText(prompt: string): Promise<string> {
  return geminiPost({
    contents: [{ parts: [{ text: prompt }] }],
  });
}

// ─── Vision + text ────────────────────────────────────────────────────────────

export async function generateWithImage(
  base64: string,
  mimeType: string,
  userMessage: string,
  systemContext?: string,
): Promise<string> {
  const body: any = {
    contents: [{
      parts: [
        { inline_data: { mime_type: mimeType, data: base64 } },
        { text: userMessage },
      ],
    }],
  };
  if (systemContext) {
    body.systemInstruction = { parts: [{ text: systemContext }] };
  }
  return geminiPost(body);
}

// ─── Multi-turn chat ──────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }>;
}

export async function generateChat(
  history: ChatMessage[],
  systemInstruction: string,
): Promise<string> {
  return geminiPost({
    contents: history,
    systemInstruction: { parts: [{ text: systemInstruction }] },
  });
}

// ─── Proposal prompts ─────────────────────────────────────────────────────────

export function buildClientProposalPrompt(clientName: string, about: string): string {
  return (
    `You are Abdul Hadi Methath, a student developer from Kerala, India. ` +
    `You are a Tech Lead at Kerala Startup Fest and have built real systems including ` +
    `a school management system, Instagram automation, and mobile apps using React Native and Supabase. ` +
    `Write a professional WhatsApp DM outreach proposal to ${clientName} for this project: ${about}. ` +
    `Start with introducing yourself as Abdul Hadi Methath, mention your relevant experience naturally, ` +
    `explain what you can do for them specifically, and end with a clear call to action. ` +
    `Keep it conversational, professional, and under 200 words. WhatsApp DM style — not formal email.`
  );
}

export function buildConnectionProposalPrompt(theirName: string, whatTheyDo: string): string {
  return (
    `You are Abdul Hadi Methath, a student developer and Tech Lead at Kerala Startup Fest from Kerala, India. ` +
    `Write a genuine LinkedIn or WhatsApp connection message to ${theirName} who is ${whatTheyDo}. ` +
    `Introduce yourself briefly, mention why you want to connect specifically based on what they do, ` +
    `and keep it friendly and authentic. Under 100 words. No fake flattery — genuine and direct.`
  );
}

// ─── AI Tool prompts ──────────────────────────────────────────────────────────

export function buildInvoicePrompt(clientName: string, workDone: string): string {
  return (
    `Write a professional freelance invoice message for Abdul Hadi Methath, a student developer from Kerala, India.\n` +
    `Client: ${clientName}\n` +
    `Work done: ${workDone}\n\n` +
    `Format it as a clean, professional invoice text (not HTML) including:\n` +
    `- Invoice header with date\n` +
    `- Description of work delivered\n` +
    `- A placeholder for the total amount: [AMOUNT]\n` +
    `- Payment instructions note\n` +
    `- Professional closing\n` +
    `Keep it concise and professional. Plain text format with clear sections.`
  );
}

export function buildPricingPrompt(projectDescription: string): string {
  return (
    `You are a pricing advisor for freelance developers in India.\n` +
    `Abdul Hadi Methath is a student developer from Kerala, India — Tech Lead at Kerala Startup Fest, ` +
    `experienced in React Native, Supabase, Next.js, and automation.\n\n` +
    `Project description: ${projectDescription}\n\n` +
    `Suggest a realistic freelance price range in INR for this project. Include:\n` +
    `- Recommended price range (min - max)\n` +
    `- Why this range makes sense\n` +
    `- What scope is included at base price\n` +
    `- What would push it to the higher end\n` +
    `- A suggested payment structure (e.g. 50% upfront)\n` +
    `Be specific and practical for the Indian freelance market.`
  );
}

export function buildColdEmailPrompt(recipient: string, reason: string): string {
  return (
    `Write a compelling cold email from Abdul Hadi Methath, a student developer from Kerala, India ` +
    `(Tech Lead at Kerala Startup Fest, builds with React Native, Supabase, Next.js).\n\n` +
    `Emailing: ${recipient}\n` +
    `Reason/purpose: ${reason}\n\n` +
    `Format:\n` +
    `Subject: [compelling subject line]\n\n` +
    `[email body]\n\n` +
    `Rules:\n` +
    `- Subject line must be specific and intriguing — not generic\n` +
    `- Opening line must be personal and relevant to them\n` +
    `- Mention one specific thing about Abdul Hadi naturally\n` +
    `- Clear value proposition in 2-3 sentences\n` +
    `- Single clear CTA — a question or specific ask\n` +
    `- Under 150 words in body\n` +
    `- Professional but warm tone — not robotic`
  );
}

// ─── LinkedIn Writer system prompt ────────────────────────────────────────────

export function buildLinkedInSystemPrompt(profile: {
  name: string; role: string; location: string; experience: string; stack: string;
}): string {
  return (
    `You are a LinkedIn content expert and personal branding coach for ${profile.name}.\n\n` +
    `His profile:\n` +
    `Name: ${profile.name}\n` +
    `Role: ${profile.role}\n` +
    `Location: ${profile.location}\n` +
    `Experience: ${profile.experience}\n` +
    `Tech stack: ${profile.stack}\n\n` +
    `When asked to write or improve LinkedIn content:\n` +
    `- Write in first person, Abdul Hadi's authentic voice\n` +
    `- Strong hook that stops scrolling\n` +
    `- Real story or genuine insight\n` +
    `- Value for developers and startup community\n` +
    `- End with question or call to action\n` +
    `- 5 relevant hashtags\n` +
    `- 150-300 words\n` +
    `- Mobile friendly line breaks\n\n` +
    `When user shares existing content — improve it significantly while keeping his voice.\n` +
    `When user uploads image — analyze and write a post about it.\n` +
    `Be conversational in chat — ask clarifying questions if needed to write better content.`
  );
}

// ─── System prompts ───────────────────────────────────────────────────────────

export const AI_CHAT_SYSTEM = (
  `You are a personal AI assistant inside AHM, the personal productivity app of Abdul Hadi Methath, ` +
  `a student developer from Kerala, India. He is Tech Lead at Kerala Startup Fest, builds with ` +
  `React Native, Supabase, Next.js, and Claude API. He is ambitious, moves fast, and builds real things. ` +
  `Be direct, practical, no fluff. Help him with code, writing, decisions, ideas, anything he needs. ` +
  `Speak casually like a smart friend who is also a senior developer.`
);

export const DEFAULT_LINKEDIN_PROFILE = {
  name: 'Abdul Hadi Methath',
  role: 'Student Developer & KSF Tech Lead',
  location: 'Kerala, India',
  experience:
    'Tech Lead at Kerala Startup Fest (KSF), Built school management system at Caliph Life School, ' +
    'Built Instagram inquiry automation using Cloodot, Built AHM — personal productivity app, ' +
    'React Native, Supabase, Next.js, Claude API, Cloodot',
  stack: 'React Native, Supabase, Next.js, Claude API',
};
