import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    raise ValueError("OPENAI_API_KEY environment variable not set")

client = OpenAI(api_key=api_key)

def get_completion(prompt, max_tokens: int = 2000) -> str:
    try:
        # Force prompt to be a string
        if isinstance(prompt, dict):
            prompt = str(prompt)
        
        response = client.chat.completions.create(
            model="gpt-6-luna",
            messages=[{"role": "user", "content": str(prompt)}],
            # reasoning models count hidden reasoning tokens here too
            max_completion_tokens=max_tokens,
            reasoning_effort="low"
        )
        return response.choices[0].message.content
    except Exception as e:
        raise Exception(f"OpenAI API error: {str(e)}")