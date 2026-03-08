#!/usr/bin/env bash
set -e

# Auto-detect GPU backend and install llama-cpp-python with the right flags
detect_backend() {
    if command -v nvidia-smi &>/dev/null && nvidia-smi &>/dev/null; then
        echo "cuda"
    elif [[ "$(uname -s)" == "Darwin" ]] && system_profiler SPDisplaysDataType 2>/dev/null | grep -qi "metal"; then
        echo "metal"
    else
        echo "cpu"
    fi
}

BACKEND="${LLAMA_BACKEND:-$(detect_backend)}"

echo "[setup] Detected backend: $BACKEND"

case "$BACKEND" in
    cuda)
        echo "[setup] Installing llama-cpp-python with CUDA support..."
        CMAKE_ARGS="-DGGML_CUDA=on" pip install llama-cpp-python --no-cache-dir
        ;;
    metal)
        echo "[setup] Installing llama-cpp-python with Metal (Apple GPU) support..."
        CMAKE_ARGS="-DGGML_METAL=on" pip install llama-cpp-python --no-cache-dir
        ;;
    *)
        echo "[setup] Installing llama-cpp-python (CPU only)..."
        pip install llama-cpp-python --no-cache-dir
        ;;
esac

pip install --no-cache-dir -r requirements.txt

echo "[setup] Done."
