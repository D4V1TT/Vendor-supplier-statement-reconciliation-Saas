FROM python:3.12-slim

# System deps for pdfplumber, pytesseract, pdf2image
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    poppler-utils \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x start.sh

EXPOSE 8000

# Default command = run migrations + start the API server.
# The worker service overrides this with: arq app.workers.tasks.WorkerSettings
CMD ["sh", "start.sh"]
