FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema necesarias
RUN apt-get update && apt-get install -y \
    gcc \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar e instalar dependencias de Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el resto del código
COPY . .

# Exponer el puerto (Railway lo sobrescribe con $PORT)
EXPOSE 8000

# Comando de inicio (usa $PORT que Railway inyecta)
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]