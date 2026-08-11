"""
Auto-Sleep Service
==================
Tracks the last API activity timestamp and terminates the server
(and therefore all its threads) after a configurable idle period.

This gives a "sleep mode" so the backend consumes NO resources when
nobody is using the software. The first request after sleep wakes the
server via the systemd auto-restart (see deploy/install.sh).
"""
import os
import sys
import time
import signal
import logging
import threading

from app.config import Config

logger = logging.getLogger(__name__)

# Global last-activity timestamp (UTC epoch seconds)
_last_activity = time.time()
_activity_lock = threading.Lock()


def touch_activity():
    """Called on every API request to record recent activity."""
    global _last_activity
    with _activity_lock:
        _last_activity = time.time()


def get_idle_seconds() -> float:
    """Return how many seconds have passed since the last API request."""
    with _activity_lock:
        return time.time() - _last_activity


def _shutdown_server():
    """Kill the current process, terminating ALL threads."""
    logger.warning(
        "AUTO-SLEEP: No activity for %d minute(s). "
        "Terminating server to save resources. "
        "It will wake automatically on the next request.",
        Config.AUTO_SLEEP_MINUTES,
    )
    print("\n[AUTO-SLEEP] Idle timeout reached. Server going to sleep...", flush=True)
    print("[AUTO-SLEEP] Next request will automatically restart it.", flush=True)
    sys.stdout.flush()
    # Small delay so the log lines flush before dying
    time.sleep(1)
    os.kill(os.getpid(), signal.SIGTERM)


def _sleep_monitor():
    """Background daemon thread that watches for idle time."""
    threshold_seconds = max(Config.AUTO_SLEEP_MINUTES * 60, 60)
    check_interval = max(Config.AUTO_SLEEP_CHECK_INTERVAL, 5)

    while True:
        time.sleep(check_interval)
        try:
            if get_idle_seconds() >= threshold_seconds:
                _shutdown_server()
        except Exception as e:  # pragma: no cover - guard against monitor crashes
            logger.error(f"AUTO-SLEEP monitor error: {e}")


def start_sleep_monitor(app):
    """
    Start the idle monitor thread.

    - Only starts if AUTO_SLEEP_ENABLED=true (default).
    - Runs as a daemon thread, so it dies with the process.
    - App hooks are installed so `touch_activity()` fires BEFORE
      every request, keeping the server awake during active use.
    """
    if not Config.AUTO_SLEEP_ENABLED:
        logger.info("AUTO-SLEEP disabled via AUTO_SLEEP_ENABLED=false")
        return

    # Mark activity on every incoming request
    @app.before_request
    def _mark_activity():
        touch_activity()

    monitor = threading.Thread(
        target=_sleep_monitor,
        name="auto-sleep-monitor",
        daemon=True,
    )
    monitor.start()

    logger.info(
        "AUTO-SLEEP enabled: server will terminate after %d minute(s) of inactivity.",
        Config.AUTO_SLEEP_MINUTES,
    )