"""
Pluggable file storage backend.
STORAGE_BACKEND=local  → files on local disk (dev/single-server)
STORAGE_BACKEND=s3     → AWS S3 (production)

All stored bytes are already AES-256 encrypted by the caller.
"""

from __future__ import annotations

import os
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


def _s3_client():
    return boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
    )
