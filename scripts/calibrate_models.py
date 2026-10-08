#!/usr/bin/env python3
# Copyright Alejandro Martínez Corriá and the Thinkube contributors
# SPDX-License-Identifier: Apache-2.0
"""Measure the memory a vLLM model takes on a node and record it in models.json.

Each model is loaded alone on the node through Thinkube Control, then
unloaded. The numbers come from vLLM's own startup log and from the node's
memory before and after the load:

  weight_bytes        "Model loading took X GiB"
  kv_bytes_per_token  "Available KV cache memory" / "GPU KV cache size: N tokens"
  overhead_bytes      share x total memory - weights - KV cache: activations,
                      CUDA graphs, CUDA context and other non-torch memory
  node_delta_bytes    node memory used after the load - before it

They are written under the model's "calibration", keyed by the node's memory
type ("uma" for unified memory, "discrete" for a GPU with its own memory),
with the vLLM version and the context used. A load with other settings, or
another vLLM version, needs a new calibration.

Run it from Thinkube IDE with no model loaded on the node:

  python3 scripts/calibrate_models.py --node tkspark --context 32768 \\
      --model nvidia/Qwen3.6-35B-A3B-NVFP4 --model Qwen/Qwen3.5-4B

It needs THINKUBE_API_TOKEN, kubectl access to the vllm namespace, and
THINKUBE_CONTROL_URL (for example https://control.thinkube.com).
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

CATALOG = Path(__file__).resolve().parent.parent / "models.json"
NAMESPACE = "vllm"
LOAD_TIMEOUT_S = 40 * 60
SETTLE_S = 30
GIB = 1024 ** 3


def required_env(name):
    value = os.environ.get(name)
    if not value:
        sys.exit(f"{name} is not set; it is required to call Thinkube Control")
    return value


class Control:
    def __init__(self, url, token):
        self.url = url.rstrip("/") + "/api/v1/llm"
        self.token = token

    def call(self, method, path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(
            self.url + path, data=data, method=method,
            headers={"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as res:
                return json.load(res)
        except urllib.error.HTTPError as e:
            sys.exit(f"{method} {path} answered {e.code}: {e.read().decode()[:500]}")

    def node(self, name):
        nodes = self.call("GET", "/gpu/status/")["nodes"]
        found = next((n for n in nodes if n["name"] == name), None)
        if found is None:
            sys.exit(f"Node {name} is not a GPU node; GPU nodes: {[n['name'] for n in nodes]}")
        return found

    def models(self):
        return self.call("GET", "/models/")["models"]

    def model(self, model_id):
        return self.call("GET", f"/models/{urllib.parse.quote(model_id, safe='/')}/status")["model"]

    def load(self, model_id, node, context):
        return self.call("POST", f"/models/{urllib.parse.quote(model_id, safe='/')}/load",
                         {"node": node, "backend": "vllm", "max_context_length": context})

    def unload(self, model_id):
        return self.call("POST", f"/models/{urllib.parse.quote(model_id, safe='/')}/unload", {})


def model_slug(model_id):
    """The model part of a deployment name; the same rule as Thinkube Control's llm_pod_manager."""
    slug = re.sub(r"[^a-z0-9]+", "-", model_id.lower()).strip("-")
    if len(slug) > 40:
        digest = hashlib.sha1(model_id.encode()).hexdigest()[:6]
        slug = f"{slug[:33].rstrip('-')}-{digest}"
    return slug


def kubectl(*args):
    return subprocess.run(["kubectl", *args], check=True, capture_output=True, text=True).stdout


def pod_of(model_id):
    names = kubectl("get", "pods", "-n", NAMESPACE, "-l", f"thinkube.io/model={model_slug(model_id)}",
                    "-o", "jsonpath={.items[*].metadata.name}").split()
    if len(names) != 1:
        sys.exit(f"Expected one pod for {model_id}, found {names}")
    return names[0]


def one(pattern, text, what):
    found = re.findall(pattern, text)
    if not found:
        sys.exit(f"vLLM log has no line for {what} (pattern {pattern!r})")
    return found[-1]


def read_engine(pod):
    log = kubectl("logs", "-n", NAMESPACE, pod)
    total = kubectl("exec", "-n", NAMESPACE, pod, "--", "python3", "-c",
                    "import torch; print(torch.cuda.mem_get_info()[1])").strip()
    return {
        "vllm": one(r"Initializing a V1 LLM engine \(v([^)]+)\)", log, "the vLLM version"),
        "share": float(one(r"--gpu-memory-utilization ([0-9.]+)", log, "the memory share")),
        "weights_gib": float(one(r"Model loading took ([0-9.]+) GiB", log, "the weights")),
        "kv_gib": float(one(r"Available KV cache memory: (-?[0-9.]+) GiB", log, "the KV cache memory")),
        "kv_tokens": int(one(r"GPU KV cache size: ([0-9,]+) tokens", log, "the KV cache tokens").replace(",", "")),
        "total_bytes": int(total),
    }


def wait_state(control, model_id, want):
    deadline = time.time() + LOAD_TIMEOUT_S
    while time.time() < deadline:
        m = control.model(model_id)
        if m["state"] == want:
            return
        if m["state"] == "deployable" and m.get("last_error"):
            sys.exit(f"{model_id} failed to load: {m['last_error']}")
        time.sleep(15)
    sys.exit(f"{model_id} did not reach {want} within {LOAD_TIMEOUT_S} s")


def wait_pod_gone(model_id):
    for _ in range(40):
        if not kubectl("get", "pods", "-n", NAMESPACE, "-l", f"thinkube.io/model={model_slug(model_id)}",
                       "-o", "name").strip():
            return
        time.sleep(15)
    sys.exit(f"The pod of {model_id} is still there 10 minutes after the unload")


def refuse_busy_node(control, node):
    busy = [m["id"] for m in control.models()
            if m["state"] in ("loading", "available", "unloading")
            and (m.get("backend_id") or "").split("/")[0].endswith(f"-{node}")]
    if busy:
        sys.exit(f"Models are loaded on {node}: {busy}. Unload them first; a calibration needs the node free.")


def calibrate(control, model_id, node, context):
    refuse_busy_node(control, node)
    before = control.node(node)["used_memory_gb"]

    answer = control.load(model_id, node, context)
    if answer["state"] != "loading":
        sys.exit(f"Load of {model_id} refused: {answer['message']}")
    wait_state(control, model_id, "available")
    time.sleep(SETTLE_S)
    after = control.node(node)["used_memory_gb"]

    engine = read_engine(pod_of(model_id))
    control.unload(model_id)
    wait_pod_gone(model_id)

    weights = engine["weights_gib"] * GIB
    kv = engine["kv_gib"] * GIB
    return {
        "vllm": engine["vllm"],
        "context": context,
        "weight_bytes": round(weights),
        "kv_bytes_per_token": round(kv / engine["kv_tokens"]),
        "overhead_bytes": round(engine["share"] * engine["total_bytes"] - weights - kv),
        "node_delta_bytes": round((after - before) * GIB),
        "measured_with": {"share": engine["share"], "kv_tokens": engine["kv_tokens"]},
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--node", required=True)
    parser.add_argument("--context", type=int, required=True)
    parser.add_argument("--model", action="append", required=True, dest="models")
    args = parser.parse_args()

    control = Control(required_env("THINKUBE_CONTROL_URL"), required_env("THINKUBE_API_TOKEN"))
    memory = "uma" if control.node(args.node)["is_uma"] else "discrete"

    catalog = json.loads(CATALOG.read_text())
    by_id = {m["id"]: m for m in catalog["models"]}
    unknown = [m for m in args.models if m not in by_id]
    if unknown:
        sys.exit(f"Not in models.json: {unknown}")

    for model_id in args.models:
        print(f"Calibrating {model_id} on {args.node} ({memory}), context {args.context}", flush=True)
        result = calibrate(control, model_id, args.node, args.context)
        print(json.dumps(result, indent=2), flush=True)
        by_id[model_id].setdefault("calibration", {})[memory] = result
        CATALOG.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
