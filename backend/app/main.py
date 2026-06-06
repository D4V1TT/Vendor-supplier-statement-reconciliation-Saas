"""
FastAPI application entrypoint.
Run with:  uvicorn app.main:app --reload
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, reconcile, sandbox
from app.core.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: nothing needed — SQLAlchemy creates connections on demand
    yield
    # Shutdown: dispose connection pool
    from app.api.deps import _engine  # noqa: PLC0415
    await _engine.dispose()


app = FastAPI(
    title="VendorRecon API",
    description="Vendor/Supplier Statement Reconciliation SaaS",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,       prefix=settings.API_PREFIX)
app.include_router(reconcile.router,  prefix=settings.API_PREFIX)
app.include_router(sandbox.router,    prefix=settings.API_PREFIX)


@app.get("/health")
async def health():
    return {"status": "ok"}
