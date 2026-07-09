#!/usr/bin/env python3
"""
Full-Stack E2E Orchestration Harness (run_e2e_suite.py)
Orchestrates backend pipeline execution, API Gateway startup, Vite frontend startup, and Playwright verification.
Strictly conforms to AGENTS.md requirements: single API Gateway binding (`0.0.0.0:8765`), WAL concurrency, and clean teardown.
"""

import os
import sys
import time
import signal
import atexit
import socket
import urllib.request
import urllib.error
import subprocess
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
WEB_DIR = PROJECT_ROOT / "web"
BUN_BIN = "/home/ubuntu/.bun/bin/bun"
if not os.path.exists(BUN_BIN):
    BUN_BIN = "bun"

# Track running child processes for clean teardown
child_processes = []
is_cleaning_up = False

def cleanup_processes(signum=None, frame=None):
    global is_cleaning_up
    if is_cleaning_up:
        return
    is_cleaning_up = True
    if signum is not None:
        print(f"\n[run_e2e_suite] Received signal {signum}, initiating clean teardown...")
    else:
        print("\n[run_e2e_suite] Initiating clean teardown of background child processes...")

    for name, proc in reversed(child_processes):
        if proc and proc.poll() is None:
            print(f"[run_e2e_suite] Terminating {name} (PID: {proc.pid})...")
            try:
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    print(f"[run_e2e_suite] Force killing {name} (PID: {proc.pid})...")
                    proc.kill()
            except Exception as e:
                print(f"[run_e2e_suite] Error terminating {name}: {e}")

    # Ensure WAL checkpoint and socket cleanup
    try:
        from db_connector import get_wal_connection
        conn = get_wal_connection("maftia_quant.db")
        conn.execute("PRAGMA wal_checkpoint(TRUNCATE);")
        conn.close()
    except Exception:
        pass

    print("[run_e2e_suite] Teardown complete.")
    if signum is not None:
        sys.exit(0)

atexit.register(cleanup_processes)
signal.signal(signal.SIGINT, cleanup_processes)
signal.signal(signal.SIGTERM, cleanup_processes)

def is_port_open(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(1.0)
        return sock.connect_ex((host, port)) == 0

def kill_orphans_on_port(port: int):
    """Ensure port is free before binding new servers."""
    try:
        out = subprocess.check_output(["lsof", "-t", f"-i:{port}"], stderr=subprocess.STDOUT, text=True)
        for pid_str in out.strip().split("\n"):
            if pid_str.strip():
                pid = int(pid_str.strip())
                if pid != os.getpid():
                    print(f"[run_e2e_suite] Killing orphan process on port {port} (PID: {pid})...")
                    try:
                        os.kill(pid, signal.SIGTERM)
                    except ProcessLookupError:
                        pass
        time.sleep(1)
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass

def wait_for_http_health(url: str, name: str, timeout: int = 20) -> bool:
    print(f"[run_e2e_suite] Waiting for {name} to become healthy at {url}...")
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with urllib.request.urlopen(url, timeout=2) as resp:
                if resp.status == 200:
                    print(f"[run_e2e_suite] {name} is healthy (200 OK) after {time.time() - start_time:.2f}s.")
                    return True
        except (urllib.error.URLError, ConnectionResetError, socket.timeout):
            pass
        time.sleep(0.5)
    print(f"[run_e2e_suite] ERROR: {name} failed to become healthy at {url} within {timeout}s.")
    return False

def run_pipeline():
    print("[run_e2e_suite] Step 1: Executing data synchronization pipeline (run_report_pipeline.py)...")
    res = subprocess.run([sys.executable, "run_report_pipeline.py"], cwd=str(PROJECT_ROOT))
    if res.returncode != 0:
        print(f"[run_e2e_suite] ERROR: run_report_pipeline.py failed with exit code {res.returncode}")
        sys.exit(res.returncode)
    print("[run_e2e_suite] Step 1 Complete: Pipeline executed and SQLite WAL databases verified.")

def start_api_gateway() -> subprocess.Popen:
    print("[run_e2e_suite] Step 2: Launching Hono API Gateway on 0.0.0.0:8765...")
    kill_orphans_on_port(8765)
    env = os.environ.copy()
    proc = subprocess.Popen(
        [BUN_BIN, "run", "src/api/index.ts"],
        cwd=str(PROJECT_ROOT),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    child_processes.append(("API Gateway (:8765)", proc))
    if not wait_for_http_health("http://127.0.0.1:8765/api/v1/health", "API Gateway (:8765)", timeout=20):
        # Dump logs if startup failed
        if proc.poll() is not None:
            out, err = proc.communicate()
            print(f"[run_e2e_suite] API Gateway stdout:\n{out}")
            print(f"[run_e2e_suite] API Gateway stderr:\n{err}")
        sys.exit(1)
    return proc

def start_vite_frontend() -> subprocess.Popen:
    print("[run_e2e_suite] Step 3: Launching Vite Frontend dev server on port 5173...")
    kill_orphans_on_port(5173)
    env = os.environ.copy()
    proc = subprocess.Popen(
        ["npm", "run", "dev", "--", "--port", "5173", "--host", "0.0.0.0"],
        cwd=str(WEB_DIR),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    child_processes.append(("Vite Dev Server (:5173)", proc))
    if not wait_for_http_health("http://127.0.0.1:5173/", "Vite Dev Server (:5173)", timeout=20):
        if proc.poll() is not None:
            out, err = proc.communicate()
            print(f"[run_e2e_suite] Vite Dev Server stdout:\n{out}")
            print(f"[run_e2e_suite] Vite Dev Server stderr:\n{err}")
        sys.exit(1)
    return proc

def run_playwright_tests(extra_args: list) -> int:
    print(f"[run_e2e_suite] Step 4: Running Playwright verification suite inside web/ with args {extra_args}...")
    cmd = ["npx", "playwright", "test"] + extra_args
    res = subprocess.run(cmd, cwd=str(WEB_DIR))
    return res.returncode

def main():
    args = sys.argv[1:]
    skip_pipeline = "--skip-pipeline" in args
    playwright_args = [arg for arg in args if arg != "--skip-pipeline"]

    try:
        if not skip_pipeline:
            run_pipeline()
        else:
            print("[run_e2e_suite] Skipping Step 1 (--skip-pipeline specified).")

        start_api_gateway()
        start_vite_frontend()
        exit_code = run_playwright_tests(playwright_args)
        if exit_code == 0:
            print("\n[run_e2e_suite] SUCCESS: All FE/BE Playwright tests passed with 100% verification!")
        else:
            print(f"\n[run_e2e_suite] FAILURE: Playwright test runner exited with code {exit_code}")
        sys.exit(exit_code)
    finally:
        cleanup_processes()

if __name__ == "__main__":
    main()
