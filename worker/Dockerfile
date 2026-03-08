FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt setup.sh ./

# Install deps + llama-cpp-python with auto-detected backend
# Override with: docker build --build-arg LLAMA_BACKEND=cuda
ARG LLAMA_BACKEND=cpu
ENV LLAMA_BACKEND=${LLAMA_BACKEND}
RUN bash setup.sh

COPY server.py .

EXPOSE 8000
CMD ["python", "server.py"]
