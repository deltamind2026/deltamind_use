import json
import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    raise ValueError("OPENAI_API_KEY environment variable not set")

client = OpenAI(api_key=api_key)

def get_json(system: str, user: str, schema: dict, name: str, max_tokens: int = 1500) -> dict:
    """Ask for a reply that must match `schema` (OpenAI structured outputs),
    so callers get a dict back instead of free text to regex apart."""
    try:
        response = client.chat.completions.create(
            model="gpt-6-luna",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {"name": name, "strict": True, "schema": schema},
            },
            max_completion_tokens=max_tokens,
            reasoning_effort="low"
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        raise Exception(f"OpenAI API error: {str(e)}")
