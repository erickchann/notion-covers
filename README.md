# Notion Cover Generator

A lightweight, zero-dependency web tool for creating Notion cover images at the exact recommended resolution (1500×600).

## Overview

I built this to have a quick, local way to generate properly sized Notion covers without needing to open Figma or Photoshop. The app runs entirely in the browser using the HTML5 Canvas API—no backend, no build steps, and no accounts required.

## Features

- **Exact sizing**: Locked to 1500×600px to prevent awkward cropping inside Notion.
- **Custom backgrounds**: Supports solid colors, CSS gradients, and local image uploads with adjustable tint overlays.
- **Rich content**: Add text layers with Google Fonts, or paste raw SVG code directly onto the canvas.
- **Layer controls**: Arrange, align, and adjust the opacity of individual elements.
- **Local export**: Renders and downloads your cover directly to a PNG.

## Tech Stack

- HTML5 Canvas
- JavaScript
- CSS3
