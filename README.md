## Description
A simple webapp that displays your garden as a 2D canvas. Within that canvas you have rectangles of different sizes, representing the crops you
want to plant in your garden.
Each crop has a specific size, based on the required distance and row width for that particular crop. So everything can grow to its full potential.
Next to the 2D garden canvas, you have a list of crops with a filter input at the top, you can filter all existing crops. The crops are part 
of the crops.json file. Each crop has a name, a width, a height and an image/svg/background color. If you double click on a crop in the list,
it shows up in your garden.
All crops in your garden can be moved by left click and dragging them around, they snap to each others side and can not overlap.
The size of the garden can be changed by simple width and height input below the 2d Canvas, you give it a width and height in meters, representing your real garden, and the size is then calculated in pixel, but still fits on one screen.



## Features
* Input the width and height of your garden in meters
* Display a 2d layout of your garden 
* Display a list of potential crops for your garden based on crops.json file
* Double click on a crop in the list to add it to the garden
* Drag crops around in your garden, snapping to each other, not overlapping, no out of bounds for the garden, snapping to the sides of the garden as well
