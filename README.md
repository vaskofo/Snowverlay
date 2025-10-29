# Snowverlay

**Forked from:** https://github.com/Chase-Simmons/BPSR-PSO

Snowverlay - DPS Meter/Parser for Blue Protocol Star Resonance
Provides a useful GUI to track DPS / HPS for nearby players with a simple skill breakdown per player

Wanna chat? Add me in game: Snow#18647214

## Virus Disclaimer

Windows defender or even the browser might consider the release binary a virus likely due to the fact that the app captures network packets.
This is a false positive which can be verified by checking the source code, or building it yourself with the instructions below.

## About the Project

This is a standalone application and does not interface with BPSR or modify any of its files. It analyzes packet while in transit.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

You'll need to have the following software installed:

- **Node.js**: <https://nodejs.org/>
- **npm**: Comes bundled with Node.js.
- **Npcap**: The installer is located in the `/resources` folder of this repository.

### To-do

- ~~Loading screen sometimes takes a while to go away~~
- ~~Fix x number of players in window instead of static height~~
- ~~Fix "finding server" message only disappearing after finding someone and not server~~
- Add grace period before resetting after server change
- Customizable hotkeys
- Remake skill breakdown with: Skill icons, more info (crit rate, luck rate), individual window
- Change starting overlay to a footer message
- ~~Class name on skill breakdown~~
- Self updater
- Export to excel/CSV, on 1m 3m and total
- Players in AOI bubble
- ~~Change buttons from labels to icons~~
- ~~Delay clear to next DPS update instead of immediate and improve timeout detection (Full and single reset are desynced causing dps on user to be lower?), fix pause detection (on tina end specifically, void guy?)~~
- Capture packets related to party, dungeon and current boss fight
- Smaller window that would sit on top of party with simple dps/hps numbers
- Translate mob names
- Play a sound when queue pops for dungeon/raid
- Store sessions by boss/world boss

### Installation/Build Instructions

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/vaskofo/Snowverlay.git
    ```

2.  **Navigate into the project directory:**

    ```bash
    cd Snowverlay
    ```

3.  **Install Npcap:**

    - Navigate to the `resources` folder: `cd resources`
    - Run the Npcap installer. Be sure to select the option to **"Install Npcap in WinPcap API-compatible Mode"** during installation.
    - After installation, return to the project root: `cd ..`

4.  **Install Node.js dependencies:**

    ```bash
    npm install
    ```

5.  **Run the application in development mode:**

    ```bash
    npm start
    ```

6.  **Optionally, build the application:**

    ```bash
    npm run make
    ```

    The built application can be found in the `out/make/Snowverlay-win32-x64` folder and the setup in the `out/make/squirrel.windows` folder.

## Running the Application

To start the application, run the following command from the project root:

```bash
npm start
```
