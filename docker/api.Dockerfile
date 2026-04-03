FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY *.py ./
COPY tetra_neural_weights.npz .
COPY ["Uydu Dusus Hesaplayıcı", "./Uydu Dusus Hesaplayıcı"]

RUN mkdir -p /data/user-models

EXPOSE 8010

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8010"]
