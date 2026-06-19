# ⚠️ Under Development - Not Ready for Use

## Claude Code marketplace

This repo also hosts the **official Thinkube Claude Code marketplace**
(`.claude-plugin/marketplace.json`). Its first plugin, **`tandem-methodology`**,
ships the Tandem pair-programming methodology — the TEP→Spec→Slice skills, the
explorer/reviewer/verifier subagents, and the ownership-guard hook.

Add the marketplace and enable the plugin:

```bash
claude plugin marketplace add thinkube/thinkube-metadata
claude plugin install tandem-methodology@thinkube
```

Or declare it in a repo's committed `.claude/settings.json` so a trusted clone
gets it automatically (note: `enabledPlugins` is a **map**, not an array):

```json
{
  "extraKnownMarketplaces": {
    "thinkube": { "source": { "source": "github", "repo": "thinkube/thinkube-metadata" } }
  },
  "enabledPlugins": { "tandem-methodology@thinkube": true }
}
```

## License

Apache License 2.0 - See [LICENSE](LICENSE)

## Copyright

Copyright 2025 Alejandro Martínez Corriá
