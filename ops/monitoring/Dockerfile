FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN useradd --uid 10001 --create-home monitor && mkdir /data && chown monitor:monitor /data
COPY monitor.py sites.json ./
USER 10001:10001
CMD ["python", "monitor.py", "watch", "--data", "/data"]
