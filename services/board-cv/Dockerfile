FROM python:3.12-slim

# OpenCV runtime bagimliliklari
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
# Egitilmis model buraya konur (models/checkers.pt); yoksa OpenCV fallback calisir.
COPY models ./models

EXPOSE 8091
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8091"]
