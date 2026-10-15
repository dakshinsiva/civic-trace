"""CivicTrace: transparent procurement risk indicators for Bengaluru."""

import os
from pathlib import Path

__version__ = "0.1.0"

PIPELINE_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = PIPELINE_DIR.parent
CONFIG_DIR = PIPELINE_DIR / "config"
# CIVICTRACE_DATA_DIR lets a clean checkout (e.g. a deploy worktree) use the main data folder.
DATA_DIR = Path(os.environ.get("CIVICTRACE_DATA_DIR", REPO_DIR / "data"))
RAW_DIR = DATA_DIR / "raw"
DB_PATH = DATA_DIR / "civictrace.sqlite"
