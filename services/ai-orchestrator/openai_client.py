import os
from openai import OpenAI

api_key = "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"

if not api_key:
    raise ValueError("OPENAI_API_KEY environment variable not set")

client = OpenAI(api_key=api_key)

def get_completion(prompt: str, max_tokens: int = 500) -> str:
    """Get completion from OpenAI API"""
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            temperature=0.7
        )
        return response.choices[0].message.content
    except Exception as e:
        raise Exception(f"OpenAI API error: {str(e)}")