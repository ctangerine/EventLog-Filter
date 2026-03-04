FROM python:3.10-slim

WORKDIR /app

# Install deps first (cache layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create temp directories
RUN mkdir -p be/temp/uploads

# Non-root user for security
RUN adduser --disabled-password --no-create-home appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 5000

ENV FLASK_DEBUG=0
ENV FLASK_PORT=5000

CMD ["python", "app.py"]