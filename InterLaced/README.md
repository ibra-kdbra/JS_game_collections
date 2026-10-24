# Interlaced

Interlaced is a tactical network intrusion and sabotage simulator built with vanilla JavaScript, HTML5, and CSS3. The game combines a narrative-driven terminal interface with a dynamic SVG-based network visualization system.

## Narrative Background

>You play as Conan Edogowa, the founder of a technology giant who was ousted after opposing the deployment of the Goliath network, a pervasive mesh technology designed for state-level surveillance and censorship.

>With the help of an internal whistleblower, Hattori, you must utilize specialized exploits to take the Goliath infrastructure offline. Each stage represents a different segment of the network, requiring strategic use of diverse network-layer attacks to degrade the health of the mesh until it collapses.

## Gameplay Mechanics

The game is divided into two primary interfaces:

### 1. Terminal Interface
A realistic terminal emulator used for narrative progression, receiving mission objectives via encrypted emails, and launching network visualizers. It supports interactive command input and mimics a legacy OS environment.

Menu commands:

1. **Story**: the 16 story meshes, from practice runs to the final Goliath mesh.
2. **Challenge**: a random mesh with random tools.
3. **Continue**: the next story mesh you have not cleared.
4. **Stages**: every story mesh you have reached, with the ones you took offline ticked.
5. **Daily challenge**: one seeded mesh per day, the same for everyone; your fastest takedown is saved.
6. **Shop**: spend MeshCoins on extra tool uses. They load into the next mesh that offers the tool.

MeshCoins come from mining nodes, the first clear of each story mesh and the first daily win of the day.

On a phone or tablet, tap the answer buttons under the terminal (or type in the command field) and tap **Continue** where the terminal says "press ENTER". In the visualizer, drag to pan and pinch to zoom; with the phone upright the visualizer turns sideways. On phones the visualizer is laid out at the screen's real size, with the tools in a grid on the left and Restart / Quit (tap twice) at the bottom. The speaker button mutes the sound effects.

### 2. Network Visualizer
Once connected to a mesh, you are presented with a live visualization of nodes and connections. Your objective is to reduce the "Network Health" below a critical threshold (usually 50%) to force a total system failure.

#### Available Tools and Exploits

- **Information**: Inspect nodes and connections to view bandwidth, packet flow, and applied effects.
- **Crash**: Exploit memory corruption (MemCorrupt) to permanently disable a network node.
- **Cut**: Flood a connection with spoofed reset packets (DoS.RST) to bring it offline.
- **Slow**: Trigger rate limiting to significantly reduce the bandwidth of a connection.
- **Corrupt**: Execute a buffer overflow to corrupt all packets passing through a specific node.
- **Reroute**: Rewrite node routing tables to cause packets to be sent to random, non-optimal destinations.
- **Intercept**: Deploy a man-in-the-middle proxy to capture sensitive data passing through a node.
- **Mine**: Inject code into a node to secretly mine MeshCoins, which are used to fund further operations.

## Technical Features

- **Procedural Generation**: Each network is deterministically generated using a Mersenne Twister pseudo-random number generator, ensuring a consistent experience for specific seeds while allowing for infinite variety in challenges.
- **A* Pathfinding**: Packets traverse the network using real-time A* pathfinding, recalculating routes dynamically as nodes and edges are sabotaged.
- **SVG Visualization**: High-performance SVG-based rendering for complex network topologies with zoom and pan capabilities.
- **Zero Dependencies**: Built entirely with pure vanilla JavaScript, requiring no external libraries or frameworks for the core game logic.

## Installation and Setup

The project is designed to run in any modern web browser.

### Local Development

1. Clone the repository.
2. Open `index.html` directly in your browser, or use a local development server.

```bash
# Example using a simple python server
python3 -m http.server 8000
```
