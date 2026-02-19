#!/usr/bin/env python3
# test.py

import sys
import time
from tqdm import tqdm

print("Script started", flush=True)
print("Python version:", sys.version, flush=True)

for i in tqdm(range(5), desc="Processing", unit="step"):
    print(f"Count: {i}", flush=True)
    time.sleep(1)

print("Script finished", flush=True)
