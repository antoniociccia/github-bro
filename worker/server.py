import os
import time
import uuid
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

import jwt
from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from llama_cpp import Llama
from huggingface_hub import hf_hub_download

app = FastAPI(title="github-bro LLM Worker")

MODEL_REPO = os.environ.get("MODEL_REPO", "Qwen/Qwen2.5-Coder-7B-Instruct-GGUF")
MODEL_FILE = os.environ.get("MODEL_FILE", "qwen2.5-coder-7b-instruct-q4_k_m.gguf")
MODEL_DIR = os.environ.get("MODEL_DIR", "/models")
CONTEXT_SIZE = int(os.environ.get("CONTEXT_SIZE", "8192"))
GPU_LAYERS = int(os.environ.get("GPU_LAYERS", "-1"))
APP_SECRET = os.environ.get("APP_SECRET")

security = HTTPBearer(auto_error=False)

llm: Llama | None = None


def verify_token(credentials: HTTPAuthorizationCredentials | None = Depends(security)):
    if not APP_SECRET:
        return
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing token")
    try:
        jwt.decode(credentials.credentials, APP_SECRET, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def get_model_path() -> str:
    local_path = Path(MODEL_DIR) / MODEL_FILE
    if local_path.exists():
        print(f"Using cached model: {local_path}")
        return str(local_path)

    print(f"Downloading {MODEL_REPO}/{MODEL_FILE}...")
    
    # Download with progress tracking
    try:
        path = hf_hub_download(
            repo_id=MODEL_REPO,
            filename=MODEL_FILE,
            local_dir=MODEL_DIR,
            resume_download=True,
        )
        print(f"Model downloaded successfully: {path}")
    except Exception as e:
        print(f"Download failed: {e}")
        raise
    
    return str(path)


@app.on_event("startup")
def load_model():
    global llm
    model_path = get_model_path()
    llm = Llama(
        model_path=model_path,
        n_ctx=CONTEXT_SIZE,
        n_gpu_layers=GPU_LAYERS,
        verbose=False,
    )
    print(f"Model loaded: {MODEL_FILE} (ctx={CONTEXT_SIZE}, gpu_layers={GPU_LAYERS})")


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    model: str = "local"
    messages: list[Message]
    max_tokens: int = 4096
    temperature: float = 0.3
    stream: bool = False


class Choice(BaseModel):
    index: int = 0
    message: Message
    finish_reason: str = "stop"


class Usage(BaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class ChatResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: list[Choice]
    usage: Usage


@app.post("/v1/chat/completions", dependencies=[Depends(verify_token)])
def chat_completions(req: ChatRequest) -> ChatResponse:
    if llm is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    result = llm.create_chat_completion(
        messages=messages,
        max_tokens=req.max_tokens,
        temperature=req.temperature,
    )

    content = result["choices"][0]["message"]["content"] or ""

    return ChatResponse(
        id=f"chatcmpl-{uuid.uuid4().hex[:8]}",
        created=int(time.time()),
        model=req.model,
        choices=[
            Choice(
                message=Message(role="assistant", content=content),
            )
        ],
        usage=Usage(
            prompt_tokens=result["usage"]["prompt_tokens"],
            completion_tokens=result["usage"]["completion_tokens"],
            total_tokens=result["usage"]["total_tokens"],
        ),
    )


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_FILE, "loaded": llm is not None}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("WORKER_PORT", "8000")))
