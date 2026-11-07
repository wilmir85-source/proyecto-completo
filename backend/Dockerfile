FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema necesarias
RUN apt-get update && apt-get install -y \
    gcc \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar e instalar dependencias de Python (usando la ruta desde la raíz del repo)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el resto del código del backend
COPY backend/ .

# Exponer el puerto
EXPOSE 8000

# Comando de inicio usando la variable PORT de Railway
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"]