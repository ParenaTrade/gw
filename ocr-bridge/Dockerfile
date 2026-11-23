FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
# Modelleri build sırasında indir (ilk istekte gecikme olmasın).
RUN python -c "from paddleocr import PaddleOCR; PaddleOCR(use_angle_cls=True, lang='latin', show_log=False)"
ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
