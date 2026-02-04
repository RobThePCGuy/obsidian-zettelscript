# Obsidian ZettelScript Plugin

Integrates [ZettelScript CLI](https://github.com/RobThePCGuy/ZettelScript) with Obsidian for graph-first knowledge management, vault generation, and automatic link injection.

## Features

- **Command Palette Integration**: Access all ZettelScript commands from Obsidian's command palette
- **Vault Generation**: Create notes for characters, locations, objects, timeline events, and more from knowledge base data
- **Link Injection**: Automatically add wikilinks to your notes based on entity names
- **Auto-Sync**: Optionally re-index your vault on file changes
- **Status Bar**: Shows current ZettelScript status

## Requirements

- **Desktop Only**: This plugin uses Node.js child processes and is not available on mobile
- **ZettelScript CLI**: Install via `npm install -g zettelscript` or use `npx zettelscript`

## Installation

### From Community Plugins (Recommended)

1. Open Obsidian Settings
2. Go to Community Plugins
3. Search for "ZettelScript"
4. Click Install, then Enable

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release
2. Create a folder `obsidian-zettelscript` in your vault's `.obsidian/plugins/` directory
3. Copy the downloaded files into this folder
4. Reload Obsidian
5. Enable the plugin in Settings > Community Plugins

## Configuration

Open Settings > ZettelScript to configure:

| Setting | Description | Default |
|---------|-------------|---------|
| CLI Path | Path to ZettelScript CLI | `npx zettelscript` |
| KB Path | Path to knowledge base directory | `.narrative-project/kb` |
| Auto-sync | Re-index on file changes | Off |
| Sync interval | Periodic re-index (minutes) | 0 (disabled) |
| Show notifications | Display command results | On |

## Commands

All commands are available via the command palette (Ctrl/Cmd + P):

| Command | Description |
|---------|-------------|
| ZettelScript: Index vault | Index all markdown files |
| ZettelScript: Run discovery | Find potential links |
| ZettelScript: Generate all notes | Run all generators |
| ZettelScript: Generate character notes | Create character notes from KB |
| ZettelScript: Generate chapter notes | Split manuscript into chapters |
| ZettelScript: Generate location notes | Create location notes from KB |
| ZettelScript: Generate object notes | Create object/artifact notes |
| ZettelScript: Generate lore notes | Create world rules/facts notes |
| ZettelScript: Generate timeline notes | Create event notes |
| ZettelScript: Generate arc notes | Create plot thread notes |
| ZettelScript: Inject wikilinks | Add links based on entities |
| ZettelScript: Preview link injection | Show what links would be added |
| ZettelScript: Validate vault | Check for issues |

## Knowledge Base Structure

This plugin expects a knowledge base in JSON format. The default location is:

```
your-vault/
├── .narrative-project/
│   └── kb/
│       ├── kb.json         # Characters, locations, objects, timeline
│       ├── arc-ledger.json # Plot threads and character arcs
│       └── world-rules.json # World mechanics and rules
```

See the [ZettelScript documentation](https://github.com/RobThePCGuy/ZettelScript) for KB schema details.

## Generated Notes

When you run generators, notes are created in subdirectories:

```
your-vault/
├── Characters/
│   ├── Character-Name.md
│   └── ...
├── Locations/
│   ├── Location-Name.md
│   └── ...
├── Objects/
│   └── ...
├── Timeline/
│   └── ...
├── Lore/
│   └── ...
├── Arcs/
│   ├── Threads/
│   └── Characters/
└── Chapters/
    └── ...
```

## Tips

1. **First time setup**: Run "Index vault" first to build the graph database
2. **Link injection**: Run "Preview link injection" first to see what would change
3. **KB changes**: After updating your KB files, run the relevant generator to update notes
4. **Batch operations**: Use "Generate all notes" to run all generators at once

## Troubleshooting

**"Could not determine vault path"**
- Ensure you're using the desktop app, not mobile

**Commands not working**
- Check that ZettelScript is installed: `npx zettelscript --version`
- Verify the CLI Path setting is correct

**No notes generated**
- Check that your KB files exist at the configured KB Path
- Ensure KB files are valid JSON

## Development

```bash
# Clone the repository
git clone https://github.com/your-username/obsidian-zettelscript

# Install dependencies
npm install

# Build
npm run build

# Development (watch mode)
npm run dev
```

## License

MIT License - see [LICENSE](LICENSE) for details.
