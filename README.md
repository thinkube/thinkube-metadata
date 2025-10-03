# Thinkube Metadata

This repository contains metadata about the Thinkube ecosystem repositories.

## Purpose

Provides a centralized, machine-readable list of all Thinkube repositories for automated tooling, deployment scripts, and development environment setup.

## Files

### `repositories.json`

Contains metadata for all Thinkube ecosystem repositories:

- **Infrastructure**: Core platform repositories
- **Application Templates**: Deployable application templates
- **MCP Servers**: Model Context Protocol servers for LLM integration
- **VS Code Extensions**: IDE extensions for development

## Schema

Each repository entry includes:

```json
{
  "name": "repository-name",
  "org": "thinkube",
  "full_name": "thinkube/repository-name",
  "description": "Repository description",
  "type": "infrastructure|application_template|mcp_server|vscode_extension",
  "clone_for_development": true,
  "github_url": "https://github.com/thinkube/repository-name",
  "ssh_url": "git@github.com:thinkube/repository-name.git"
}
```

## Usage

### Fetch Repository List

```bash
curl -sSL https://raw.githubusercontent.com/thinkube/thinkube-metadata/main/repositories.json
```

### Filter by Type

```bash
# Get only application templates
curl -sSL https://raw.githubusercontent.com/thinkube/thinkube-metadata/main/repositories.json | \
  jq '.repositories[] | select(.type == "application_template")'

# Get repositories to clone for development
curl -sSL https://raw.githubusercontent.com/thinkube/thinkube-metadata/main/repositories.json | \
  jq '.repositories[] | select(.clone_for_development == true) | .ssh_url'
```

### In Ansible Playbooks

```yaml
- name: Fetch repository metadata
  ansible.builtin.uri:
    url: "https://raw.githubusercontent.com/thinkube/thinkube-metadata/main/repositories.json"
    return_content: yes
  register: repo_metadata

- name: Parse repository list
  ansible.builtin.set_fact:
    repos_to_clone: "{{ (repo_metadata.content | from_json).repositories | selectattr('clone_for_development', 'equalto', true) | map(attribute='full_name') | list }}"

- name: Clone repositories
  ansible.builtin.git:
    repo: "git@github.com:{{ item }}.git"
    dest: "/path/to/{{ item | basename }}"
  loop: "{{ repos_to_clone }}"
```

## Maintenance

When adding new repositories to the Thinkube ecosystem:

1. Add entry to `repositories.json` with complete metadata
2. Commit and push to main branch
3. Automated systems will pick up the changes immediately

## License

Apache-2.0 - See LICENSE file in main repository
