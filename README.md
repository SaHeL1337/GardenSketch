# GardenSketch

## Description
A simple web application to visually plan your garden layout. 

*   Display your garden as a 2D canvas where dimensions (width and height) are input in meters.
*   See a filterable list of available crops loaded from `crops.json`.
*   Each crop has a defined size (width/height in meters) and a visual representation (using embedded SVG).
*   Double-click a crop in the list to add it to the first available spot in the garden.
*   Drag crops around the garden canvas; they will snap to the garden edges and to each other.
*   Use **Shift + Drag** to move connected rows of the same crop type together.
*   Use the `+` and `...` icons on a crop (if space permits) to quickly add a single adjacent crop or fill a row.
*   Your garden layout (dimensions and placed crops) is automatically saved to your browser's local storage and reloaded on your next visit.
*   A "Clear Garden" button lets you start over.

## Demo

You can try GardenSketch live here: **[https://sahel1337.github.io/GardenSketch/](https://sahel1337.github.io/GardenSketch/)**

## Features

*   Input the width and height of your garden in meters.
*   Display a dynamic 2D layout of your garden.
*   Display a filterable list of potential crops for your garden based on `crops.json`.
*   Add crops to the garden by double-clicking the list (places in the first available spot).
*   Drag single crops or connected rows (Shift+Drag) around the garden.
*   Crops snap to garden boundaries and to each other (prevents overlap during drag, though exact overlap *prevention* on drop isn't strictly enforced yet).
*   Quick-add icons on crops (`+` for single, `...` for row).
*   Garden state (dimensions, crops) saved automatically in local storage.
*   "Clear Garden" functionality.
*   Responsive canvas resizing.
*   GitHub link and Favicon.

## Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/SaHeL1337/GardenSketch/issues) (if any exist).

## Setup (for Development)

1.  Clone the repository.
2.  Because the app uses `fetch` to load `crops.json`, you need to run it from a simple local web server to avoid browser CORS security restrictions when loading from `file:///`. 
    *   If you have Python 3: `python -m http.server` in the project directory.
    *   If you have Python 2: `python -m SimpleHTTPServer`.
    *   Alternatively, use VS Code's Live Server extension or similar tools.
3.  Open your browser to `http://localhost:8000` (or the port provided by your server).
