export function buildClassifyPrompt(markdown: string): string {
  // Truncate to ~15K chars to stay within reasonable token limits
  const content = markdown.slice(0, 15000);

  return `You are a business classifier. Given website content from a contractor or service business, determine which of these three categories the business falls into:

- "roofing" — Roofing contractors, roof repair, roof replacement, storm damage repair
- "hvac" — Heating, ventilation, air conditioning, furnace, AC repair, climate control
- "plumbing" — Plumbers, drain cleaning, water heater, pipe repair, sewer services

<website_content>
${content}
</website_content>

Analyze the content and respond with a JSON object:
{
  "type": "roofing" | "hvac" | "plumbing",
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation of why this classification"
}`;
}

export const classifyToolSchema = {
  name: 'classify_business',
  description: 'Classify a business as roofing, hvac, or plumbing based on website content',
  input_schema: {
    type: 'object' as const,
    properties: {
      type: {
        type: 'string' as const,
        enum: ['roofing', 'hvac', 'plumbing'],
        description: 'The business type',
      },
      confidence: {
        type: 'number' as const,
        description: 'Confidence score from 0.0 to 1.0',
      },
      reasoning: {
        type: 'string' as const,
        description: 'Brief explanation for the classification',
      },
    },
    required: ['type', 'confidence', 'reasoning'],
  },
};
