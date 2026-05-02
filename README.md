# Project Gallery

`Project Gallery` is a self-built technical portfolio designed to present larger computing projects in a clearer and more detailed way. It acts as the deeper technical companion to the main DSA portfolio website, with a stronger focus on system design, implementation choices, and project architecture.

## Overview

The gallery is structured as an interactive experience rather than a static list of projects. It introduces the progression from earlier experiments into more technically demanding work, then links that progression to a larger vehicle systems project.

The purpose of the project is not only to display finished visuals, but to show how increasingly complex software systems were designed, organized, and refined over time.

## Main Highlights

- Built independently as part of a self-taught computing journey.
- Uses `Three.js`, `GSAP`, `Rapier`, `Vite`, and modular JavaScript architecture.
- Presents projects through an interactive, animated interface instead of a conventional grid or gallery layout.
- Includes a deeper case-study view of a larger vehicle systems project.
- Emphasizes architecture, interaction, and technical explanation rather than appearance alone.

## Featured Project

The main highlighted work in this gallery is the vehicle systems project found in [`car-project`](./car-project).

That project brings together:

- rendering
- vehicle physics
- input handling
- camera logic
- resource loading
- world construction
- timing and update flow

The work was structured into separate systems so that complexity could be managed more clearly as the project expanded. Instead of treating each feature independently, the project was built around coordination between modules such as `Game.js`, `Vehicle.js`, `Physics.js`, `Rendering.js`, `World.js`, and `View.js`.

## Why This Project Matters

This gallery reflects a shift from simple experiments into more serious technical work. It shows:

- independent learning
- willingness to work through technical complexity
- ability to organize larger projects into modular systems
- interest in combining mathematical structure with software design

For the DSA portfolio, this project serves as direct evidence of self-taught technical depth and project ownership.

## Running Locally

```bash
npm install
npm run dev
```

To create a production build:

```bash
npm run build
```
