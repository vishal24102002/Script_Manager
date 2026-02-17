#!/usr/bin/env python3
# test.py
import sys
import time

print("Script started", flush=True)
print("Python version:", sys.version, flush=True)

for i in range(5):
    print(f"Count: {i}", flush=True)
    time.sleep(1)

print("Script finished", flush=True)