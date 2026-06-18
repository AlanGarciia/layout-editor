"""
Layer Editor + Design Optimizer API
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import psd, layers, optimize

app = FastAPI(title="Layer Editor + Design Optimizer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(psd.router)
app.include_router(layers.router)
app.include_router(optimize.router)