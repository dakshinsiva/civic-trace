"""The static release must be strict JSON: browsers reject NaN/Infinity and drop the whole bucket file."""

import json

import numpy as np
import pandas as pd

from civictrace.export import _write


def _strict(text: str):
    def reject(const):
        raise ValueError(f"non-standard JSON constant {const}")

    return json.loads(text, parse_constant=reject)


def test_missing_values_are_written_as_null(tmp_path):
    row = pd.Series({"close_at_final": float("nan"), "published_at": "2026-01-01T10:00:00+05:30"}, dtype=object)
    obj = {
        "calls_in_process": [{"close_at_final": row["close_at_final"], "published_at": row["published_at"]}],
        "numpy_nan": np.float64("nan"),
        "inf": float("inf"),
        "ok": 1.5,
        "nested": [(float("-inf"), 2)],
    }
    path = tmp_path / "b000.json"
    _write(path, obj)
    out = _strict(path.read_text())
    assert out["calls_in_process"][0]["close_at_final"] is None
    assert out["numpy_nan"] is None and out["inf"] is None
    assert out["ok"] == 1.5
    assert out["nested"] == [[None, 2]]
