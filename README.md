# Script Manager

A desktop application for running and managing Python scripts — with a clean GUI, live output logs, interactive input support, and dark/light themes.

---

## What It Does

- Browse all your Python scripts from a sidebar
- Run any script with one click and see live output in real time
- Respond to `input()` prompts directly inside the app (no terminal needed)
- Read each script's README documentation inside the app
- Stop a running script at any time
- Switch between dark and light themes
- Save logs to a file

---

## Requirements

Before you start, make sure you have:

| Tool | Version | Download |
|------|---------|----------|
| Node.js | v16 or higher | https://nodejs.org |
| Python | v3.6 or higher | https://python.org |

> **Linux users:** Make sure `python3` is in your PATH.  
> **Windows users:** Make sure `python` is in your PATH.

---

## Installation

**Step 1 — Open a terminal in this folder**

```bash
cd /path/to/script-manager
```

**Step 2 — Install dependencies**

```bash
npm install
```

**Step 3 — Start the app**

```bash
npm start
```

That's it! The app will open as a desktop window.

---

## How to Add Your Scripts

The app automatically scans the `scripts/` folder on startup.

### Folder Structure

Each script must live inside its own subfolder:

```
scripts/
├── My Script/
│   ├── myscript.py        ← required
│   └── README.md          ← optional (shown in README tab)
│
├── Data Processor/
│   ├── process.py         ← required
│   └── README.md          ← optional
│
└── PDF Extractor/
    ├── sdg_final_vishal.py   ← required
    ├── README.md             ← optional
    └── inputs.json           ← optional (for input fields sidebar)
```

### Rules

- The subfolder name becomes the script's display name in the sidebar
- The `.py` file can have **any name** — the app finds it automatically
- `README.md` is optional but recommended
- `inputs.json` is only needed if you want a pre-filled input form (see below)

---

## Running a Script

1. Click a script name in the left sidebar to select it
2. Click the **Run** button (top right) or the ▶ play icon next to the script name
3. Watch the live output appear in the **Logs** panel

### If the script asks for input (`input()`)

When your Python script calls `input("Enter something: ")`, a yellow input bar will automatically appear at the bottom of the logs panel.

- Type your answer
- Press **Enter** or click **Send ↵**
- The script continues — and will show the bar again for each `input()` call

### Stopping a script

Click the **Stop** button (appears while a script is running) to force-stop it immediately.

---

## Optional: Pre-fill Inputs with inputs.json

If your script always asks the same questions, you can define them as form fields using an `inputs.json` file inside the script folder. A right-hand sidebar will appear automatically when you select that script.

### Example `inputs.json`

```json
[
  {
    "name": "folder",
    "label": "Folder Path",
    "type": "text",
    "placeholder": "/home/user/pdfs",
    "required": true,
    "passAs": "stdin"
  },
  {
    "name": "mode",
    "label": "Output Mode",
    "type": "select",
    "options": ["summary", "full", "csv"],
    "default": "summary",
    "passAs": "stdin"
  }
]
```

### Field Options

| Field | What it does |
|-------|-------------|
| `name` | Internal identifier |
| `label` | Text shown above the field |
| `type` | `text`, `number`, `password`, `textarea`, `select`, `checkbox` |
| `placeholder` | Hint text shown inside the field |
| `default` | Pre-filled value |
| `required` | Shows a red `*` next to the label |
| `description` | Small help text shown below the label |
| `passAs` | `"stdin"` — sent to `input()` calls in order. `"arg"` — passed as a command-line argument |
| `flag` | CLI flag name when using `passAs: "arg"` (e.g. `"--mode"`) |

Once inputs are filled in, click **Run with Inputs** to start the script with all values pre-loaded.

---

## Buttons & Controls

| Button | What it does |
|--------|-------------|
| **Run** | Starts the selected script |
| **Stop** | Force-stops the running script |
| **Save** | Saves the current log output to a `.txt` file |
| **Clear** | Clears the log output |
| **Reload Scripts** | Re-scans the `scripts/` folder (use after adding/removing scripts) |
| **Logs / README** (tabs) | Switch between live output and the script's documentation |
| 🌙 / ☀️ toggle | Switch between dark and light theme |

---

## Project Files

```
script-manager/
├── main.js          ← Electron backend: runs scripts, reads files, handles IPC
├── preload.js       ← Connects the UI to the backend safely
├── index.html       ← The entire UI (HTML + CSS + JavaScript)
├── package.json     ← App config and build settings
├── scripts/         ← Put all your script folders here
│   └── My Script/
│       ├── myscript.py
│       └── README.md
└── README.md        ← This file
```

---

# Screen Shot
<img width="1600" height="871" alt="image" src="https://github.com/user-attachments/assets/ebfc06e1-a864-4255-bb2c-51b26eaa9bc9" />


## Building a Standalone Executable

You can package the app into a single installer that doesn't need Node.js installed.

**Windows (.exe installer)**
```bash
npm run build:win
```

**macOS (.dmg)**
```bash
npm run build:mac
```

**Linux (.AppImage)**
```bash
npm run build:linux
```

The output file will appear in the `dist/` folder.

---

## Troubleshooting

**Scripts folder is empty / script not showing**
- Make sure each script is inside its **own subfolder** inside `scripts/`
- The subfolder must contain at least one `.py` file
- Click **Reload Scripts** after adding new folders

**No output in Logs panel**
- The app uses `python3` on Linux/Mac and `python` on Windows — make sure it's installed and in your PATH
- Try running the script manually in a terminal first to check for errors

**Script hangs after starting**
- Your script is probably waiting for `input()` — look for the yellow input bar at the bottom of the logs panel and type your answer

**Stop button doesn't work**
- Click it once — the app sends SIGTERM first then SIGKILL after 0.6 seconds
- The script will be force-killed within 1 second

**App won't start**
- Make sure you ran `npm install` first
- Make sure Node.js v16+ is installed: `node --version`

---

## Tips

- You can have **as many scripts as you want** — just add more subfolders to `scripts/`
- Script folder names support spaces (e.g. `My PDF Tool`)
- The app remembers your dark/light theme preference between sessions
- README files support **Markdown** formatting (headings, bold, code blocks, lists)

---

## License

MIT — free to use, modify, and distribute.
