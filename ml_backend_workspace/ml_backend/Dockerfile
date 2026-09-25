# Use the official lightweight Python image.
# https://hub.docker.com/_/python
FROM python:3.10-slim

# Allow statements and log messages to immediately appear in the Knative logs
ENV PYTHONUNBUFFERED True

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file to the container
COPY requirements.txt .

# Install dependencies. We use --no-cache-dir to keep the image small.
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the sentence-transformers model so it's baked into the image and avoids Hugging Face 429 rate limits on startup
RUN python -c "from langchain_community.embeddings import HuggingFaceEmbeddings; HuggingFaceEmbeddings(model_name='all-MiniLM-L6-v2')"


# Copy the rest of the application code to the container
COPY . .

# Run the web service on container startup using Uvicorn.
# Cloud Run injects the PORT environment variable. We default to 8080 if not set.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
