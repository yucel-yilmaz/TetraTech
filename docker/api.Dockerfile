FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY api.py .
COPY decision_engine.py .
COPY map_data.py .
COPY notam_service.py .
COPY OpenRocketTespit.py .
COPY space_weather.py .
COPY spaceport_manager.py .
COPY weather.py .
COPY neural_decision_engine.py .
COPY tetra_neural_weights.npz .
COPY ["Uydu Dusus Hesaplayıcı", "./Uydu Dusus Hesaplayıcı"]

RUN mkdir -p /data/user-models

EXPOSE 8010

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8010"]
