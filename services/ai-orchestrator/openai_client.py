import os
from openai import OpenAI

api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    raise ValueError("OPENAI_API_KEY environment variable not set")

client = OpenAI(api_key=api_key)

def get_completion(prompt, max_tokens: int = 500) -> str:
    try:
        # Force prompt to be a string
        if isinstance(prompt, dict):
            prompt = str(prompt)
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": str(prompt)}],
            max_tokens=max_tokens,
            temperature=0.7
        )
        return response.choices[0].message.content
    except Exception as e:
        raise Exception(f"OpenAI API error: {str(e)}")