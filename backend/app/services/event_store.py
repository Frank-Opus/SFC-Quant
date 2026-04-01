import json
from collections import deque
from pathlib import Path
from threading import Lock

from app.models.events import EventEnvelope


class JsonlEventStore:
    def __init__(self, directory: str, filename: str = "market-events.jsonl") -> None:
        self._directory = Path(directory)
        self._path = self._directory / filename
        self._lock = Lock()

    @property
    def path(self) -> Path:
        return self._path

    def append(self, event: EventEnvelope) -> None:
        self._directory.mkdir(parents=True, exist_ok=True)
        payload = json.dumps(event.model_dump(mode="json"), ensure_ascii=True)
        with self._lock, self._path.open("a", encoding="utf-8") as handle:
            handle.write(f"{payload}\n")

    def read_recent(self, limit: int = 50) -> list[EventEnvelope]:
        if not self._path.exists():
            return []

        with self._lock, self._path.open("r", encoding="utf-8") as handle:
            lines = deque(handle, maxlen=max(limit, 1))

        events: list[EventEnvelope] = []
        for line in lines:
            line = line.strip()
            if not line:
                continue
            events.append(EventEnvelope.model_validate_json(line))
        return events
