"""
Pluggable file storage backend.
STORAGE_BACKEND=local  → files on local disk (dev/single-server)
STORAGE_BACKEND=s3     → any S3-compatible object store (AWS S3, Cloudflare R2)

For Cloudflare R2, set S3_ENDPOINT_URL to your R2 endpoint and AWS_REGION=auto.
All stored bytes are already AES-256 encrypted by the caller.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import boto3

from app.core.config import get_settings

settings = get_settings()


async def write_file(key: str, data: bytes) -> None:
    if settings.STORAGE_BACKEND == "s3":
        _s3_client().put_object(Bucket=settings.S3_BUCKET, Key=key, Body=data)
    else:
        path = Path(settings.LOCAL_UPLOAD_DIR) / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)


async def read_file(key: str) -> bytes:
    if settings.STORAGE_BACKEND == "s3":
        response = _s3_client().get_object(Bucket=settings.S3_BUCKET, Key=key)
        return response["Body"].read()
    else:
        path = Path(settings.LOCAL_UPLOAD_DIR) / key
        return path.read_bytes()


async def delete_file(key: str) -> None:
    if settings.STORAGE_BACKEND == "s3":
        _s3_client().delete_object(Bucket=settings.S3_BUCKET, Key=key)
    else:
        path = Path(settings.LOCAL_UPLOAD_DIR) / key
        if path.exists():
            path.unlink()


@lru_cache(maxsize=1)
def _s3_client():
    """
    Cached S3-compatible client. Works with AWS S3 and Cloudflare R2.
    R2: set S3_ENDPOINT_URL=https://<accountid>.r2.cloudflarestorage.com
    """
    kwargs = dict(
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION or "auto",
    )
    if settings.S3_ENDPOINT_URL:
        kwargs["endpoint_url"] = settings.S3_ENDPOINT_URL
    return boto3.client("s3", **kwargs)
