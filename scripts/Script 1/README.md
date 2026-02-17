# Script Manager - Desktop Application

A desktop application for managing and running scripts with a beautiful GUI.

## Features

- ✨ Modern, clean interface
- 📝 Script management with metadata
- 🎯 Real-time log viewing
- ▶️ One-click script execution
- 🖥️ Cross-platform (Windows, Mac, Linux)

## Setup Instructions

### Prerequisites

1. Install Node.js (v16 or higher) from https://nodejs.org/

### Installation

1. Open a terminal/command prompt in this folder
2. Run the following commands:

```bash
npm install
```

### Running the Application

To run the app in development mode:

```bash
npm start
```

### Building Executable

To create a Windows .exe file:

```bash
npm run build:win
```

To create a Mac .dmg file:

```bash
npm run build:mac
```

To create a Linux AppImage:

```bash
npm run build:linux
```

The executable will be created in the `dist` folder.

## Project Structure

```
script-manager/
├── package.json       # Project dependencies and build config
├── main.js           # Electron main process
├── index.html        # Application UI
├── icon.png          # Application icon (optional)
└── README.md         # This file
```

## Customization

### Adding Your Own Scripts

Edit the `scripts` array in `index.html` (around line 81) to add your scripts:

```javascript
const [scripts, setScripts] = useState([
    {
        id: 1,
        name: 'My Script',
        location: '/path/to/your/script.sh',
        createdOn: '2024-01-15',
        logs: []
    },
    // Add more scripts here
]);
```

### Connecting Real Script Execution

The app includes IPC handlers in `main.js` that can execute real scripts. The `handlePlayScript` function in `index.html` already sends IPC messages to run scripts.

## Troubleshooting

**Issue: npm install fails**
- Make sure Node.js is installed correctly
- Try deleting `node_modules` folder and running `npm install` again

**Issue: Build fails**
- Make sure you have all dependencies installed
- Check that you have write permissions in the folder

**Issue: App won't start**
- Check the console for error messages
- Make sure all files are in the same directory

## License

MIT
