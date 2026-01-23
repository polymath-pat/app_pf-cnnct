FROM python:3.11-slim
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy only the backend-related files to keep the image slim
COPY app.py .
# If you have other backend folders, copy them explicitly
# COPY api/ ./api/ 

# Set environment variables for Bandit/Security and Gunicorn
ENV HOST=0.0.0.0
ENV PORT=8080

EXPOSE 8080

# Use the full path to the module to be explicit
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "app:app"]