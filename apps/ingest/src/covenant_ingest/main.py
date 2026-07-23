from fastapi import FastAPI

app = FastAPI(title="Covenant Ingestion", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
