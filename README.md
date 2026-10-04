# thinkube-metadata

Four JSON catalogues that Thinkube reads at runtime: repositories, optional components, models and container images to mirror.

## What it does

Each file is fetched from the `main` branch through `raw.githubusercontent.com` by the part of Thinkube that needs it. A change pushed to `main` is what the platform reads next.

| File | What it holds | Who reads it |
|---|---|---|
| `repositories.json` | The Thinkube repositories, grouped in categories (`core`, `docs`, `templates`, `extensions`, `jupyter-extensions`, `mcp`, `misc`, `packages`). Each entry has `name`, `org`, `full_name`, `description`, `type`, `category`, `clone_for_development`, `github_url` and `ssh_url`; templates also have `deployment_type` and some a `fixed_name`. | thinkube-control's Templates page lists the entries of `type` `application_template` and leaves out those with `deployment_type` `component` (`backend/app/api/templates.py`). The code-server playbook clones every entry with `clone_for_development: true` (`ansible/40_thinkube/core/code-server/13_clone_repositories.yaml:89` in thinkube). |
| `optional_components.json` | The components offered on the Optional Components page, keyed by name. Each has `display_name`, `description`, `category`, `icon`, `requirements` (the components it needs first) and `namespace`. Most name their `install`, `test` and `uninstall` playbooks; `vllm`, `tensorrt` and `text-embeddings` name a `template` repository instead. An `architectures` list limits a component to those CPU architectures. | thinkube-control's Optional Components page (`backend/app/services/optional_components.py:31`). |
| `models.json` | The model catalogue. Each entry has the Hugging Face `id`, `name`, size (`params_b`, `active_params_b`), `quantization`, `context_length`, `server_type` (which serving backends can run it), `task`, `reasoning_format`, `tool_use`, `stop_tokens`, `license`, `gated` and `serving_name`. Some add serving settings such as `allow_patterns` or `tool_call_parser`. | thinkube-control's model catalogue, used for mirroring and serving models (`backend/app/services/model_downloader.py:36`). |
| `mirror_images.json` | Public container images to copy into Harbor. Each entry has a pinned `source`, a `destination_name` under the Harbor `library` project, and a `description`. An optional `architectures` list sets which platforms to copy; without it, the cluster's build architectures are used. | The Harbor image mirror playbook (`ansible/40_thinkube/core/harbor-images/13_mirror_public_images.yaml:39` in thinkube). |

thinkube-control merges `repositories.json` and `models.json` with the same files in the user's own `<github user>/<github user>-metadata` repository, if there is one (`backend/app/services/metadata_fetcher.py`). `optional_components.json` is read from this repository only.

## How it reaches a user

This repository is data read at runtime. It is not installed. thinkube-control and the playbooks of [thinkube](https://github.com/thinkube/thinkube) fetch the files when they need them.

## Working on it

Edit a JSON file, check that it still parses, and push to `main`:

```bash
python3 -m json.tool repositories.json > /dev/null
```

thinkube-control keeps a fetched catalogue in memory for 5 minutes, so a change shows there within that time.

## License

Apache License 2.0 - See [LICENSE](LICENSE)

## Copyright

Copyright Alejandro Martínez Corriá and the Thinkube contributors
