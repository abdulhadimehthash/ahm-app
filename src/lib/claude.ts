const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

export async function callClaude(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.EXPO_PUBLIC_CLAUDE_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userMessage }
        ]
      })
    })
    
    const data = await response.json()
    
    if (data.error) {
      console.error('Claude error:', data.error)
      throw new Error(data.error.message)
    }
    
    return data.content[0].text
    
  } catch (error) {
    console.error('Claude API failed:', error)
    throw error
  }
}

export async function callClaudeWithImage(
  systemPrompt: string,
  userMessage: string,
  base64Image?: string,
  imageType?: string
): Promise<string> {
  try {
    const content: any[] = []
    
    if (base64Image) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: imageType || 'image/jpeg',
          data: base64Image
        }
      })
    }
    
    content.push({
      type: 'text',
      text: userMessage
    })
    
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.EXPO_PUBLIC_CLAUDE_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          { role: 'user', content }
        ]
      })
    })
    
    const data = await response.json()
    
    if (data.error) throw new Error(data.error.message)
    
    return data.content[0].text
    
  } catch (error) {
    console.error('Claude API with image failed:', error)
    throw error
  }
}
