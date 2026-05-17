//
//  ___  _   _  _____  _____  ____   _        _    ____  _____  ____
// |_ _| | \ | ||_   _|| ____||  _ \ | |      / \  / ___|| ____||  _ \
//  | |  |  \| |  | |  |  _|  | |_) || |     / _ \| |    |  _|  | | | |
//  | |  | |\  |  | |  | |___ |  _ < | |___ / ___ \ |___ | |___ | |_| |
// |___| |_| \_|  |_|  |_____||_| \_\|_____/_/   \_\____||_____||____/
//
//

// Twister Pseudo-Random Number Generator
// Used to deterministically generate stages based on a seed
function MersenneTwister(seed) {
  seed = seed || Date.now();
  this.N = 624;
  this.M = 397;
  this.MATRIX_A = 0x9908b0df;
  this.UPPER_MASK = 0x80000000;
  this.LOWER_MASK = 0x7fffffff;
  this.I = Math.pow(2, 32);

  this.mt = new Array(this.N);
  this.mti = this.N + 1;

  this.mt[0] = seed >>> 0;
  for (this.mti = 1; this.mti < this.N; this.mti++) {
    const s = this.mt[this.mti - 1] ^ (this.mt[this.mti - 1] >>> 30);
    this.mt[this.mti] = (((((s & 0xffff0000) >>> 16) * 1812433253) << 16) +
                           (s & 0x0000ffff) * 1812433253) + this.mti;
    this.mt[this.mti] >>>= 0;
  }
};

MersenneTwister.prototype.random = function() {
  const mag01 = new Array(0x0, this.MATRIX_A);
  let y;

  if (this.mti >= this.N) {
    let kk;

    for (kk = 0; kk < this.N - this.M; kk++) {
      y = (this.mt[kk] & this.UPPER_MASK) | (this.mt[kk + 1] & this.LOWER_MASK);
      this.mt[kk] = this.mt[kk + this.M] ^ (y >>> 1) ^ mag01[y & 0x1];
    }

    for (;kk < this.N - 1; kk++) {
      y = (this.mt[kk] & this.UPPER_MASK) | (this.mt[kk + 1] & this.LOWER_MASK);
      this.mt[kk] = this.mt[kk + (this.M - this.N)] ^ (y >>> 1) ^ mag01[y & 0x1];
    }

    y = (this.mt[this.N - 1] & this.UPPER_MASK) | (this.mt[0] & this.LOWER_MASK);

    this.mt[this.N - 1] = this.mt[this.M - 1] ^ (y >>> 1) ^ mag01[y & 0x1];

    this.mti = 0;
  }

  y = this.mt[this.mti++];

  y ^= (y >>> 11);
  y ^= (y << 7) & 0x9d2c5680;
  y ^= (y << 15) & 0xefc60000;
  y ^= (y >>> 18);
  y = y >>> 0;

  return (y + 0.5) / this.I;
};

// Rotate-13 "encryption"
function rot13(text, decrypt) {
  let string = '';
  for (let i = 0; i < text.length; i++) {
    let value = text.charCodeAt(i);
    value += (decrypt) ? -13 : 13;
    if (value > 126) {
      value = 32 + (value - 127);
    } else if (value < 32) {
      value = 127 + (value - 32);
    }
    string += String.fromCharCode(value);
  }
  return string;
}

// Create a separate random number generator for ephemeral details
const prng = new MersenneTwister();
const rand = (min, max) => Math.floor(prng.random() * (max - min + 1)) + min;

// Map that returns Infinity rather than undefined,
// used for scoring paths in A* path finding
Map.prototype.value = function(key) {
  const value = this.get(key);
  if (value === undefined) {
    return Infinity;
  }
  return value;
};

// Convenience functions
const size = (object) => Object.keys(object || {}).length;

const $ = id => document.getElementById(id);

const add = (element, className) => element.classList.add(className);
const remove = (element, className) => element.classList.remove(className);

const hide = element => add(element, 'hide');
const show = element => remove(element, 'hide');

const scroll = element => element.scrollTop = element.scrollHeight + element.clientHeight;

// Random, fake IP Address generator
let IPs = {};
function generateIP() {
  let address = null;
  while (address === null || IPs[address]) {
    address = rand(1, 254) + '.' + rand(0, 254) + '.' + rand(0, 254) + '.' + rand(1, 254);
  }
  IPs[address] = true;
  return address;
}

// Asynchronous sequencer for managing game state across different async events
// such as input, game router, press enter to continue...
function sequence(worker, done) {
  let i = 0;

  function queue(func, delay) {
    setTimeout(func, delay || 0);
  }

  function next(timeout) {
    if (timeout === false) {
      if (done) {
        queue(done);
      }
    } else {
      i++;
      timeout = (timeout === undefined || timeout < 0) ? 100 : parseInt(timeout);
      queue(iterate, timeout);
    }
  }

  function iterate() {
    queue(function() {
      worker(next, i);
    });
  }

  iterate();
}

//////////
// Game Script as large text blobs with "&" triggers, simplistic turing machine
// for driving the game state.
const boot = `<div class="banner">GOLIATH Mesh OS version 4.18.0-32-generic (build 13,312)</div>
Command line: BOOT_IMAGE=/goliath-4.15.0-33-generic root=/dev/sda2:ro
KERNEL supported cpus:
  Titan-E m47_64
m47/fpu: Supporting XSAVE feature 0x001: m87 floating point registers
m47/fpu: Supporting XSAVE feature 0x002: SSE registers
m47/fpu: Enabled xstate features 0x7, context size 832 bytes
e820: BIOS-provided physical RAM map
e820: update [mem 0x00000000-0x00000fff] usable => reserved
total RAM covered: 16288M
On node 0 totalpages: 4164976
  DMA zone: 64 pages used for memmap
  DMA zone: 3997 pages, LIFO batch:0
  Normal zone: 54720 pages used for memmap
  Normal zone: 3502080 pages, LIFO batch:31
Reserved but unavailable: 98 pages
ACPI: PM-Timer IO Port: 0x1808
ACPI: Local APIC address 0xfee00
smpboot: Allowing 4 CPUs
Kernel/User page tables isolation enabled
Hierarchical RCU implementation
  RCU restricting CPUs from nr_cpu=8192 to nr_cpu_ids=4
  Tasks RCU enabled
RCU: Adjusting geometry for nr_cpu_ids=4
NR_IRQS 52454, nr_irqs 728, preallocated irqs 16
console: color smart device [tty0] enabled
ACPI: Core revision 20180813
Security Framework initialized
mce: CPU supports 7 MCE banks
smp: Bringing up secondary CPUs
m47: Booting SMP configuration:
  node 0, CPUs: 1 2 3
smp: Brought up 1 node, 4 CPUs
PCI host bridge to bus 0000:00
pci_bus 0000:00: root bus resource [io  0x0000-0x0cf7]
pci_bus 0000:00: root bus resource [mem 0xfe000000-0xfe113fff]
pci_bus 0000:00: root bus resource [bus 00-3e]
usbcore: registered new interface drivers: usbfs, hub, usb, mesh
NET: Registered protocol family 1
NET: Registered protocol family 2
TCP established hash table entries: 1310722 (1048576 bytes)
TCP bind hash table entries: 65536 (1048576 bytes)
TCP: Hash tables configured (established 131072 bind 65536)
NET: Registered protocol family 47
Meshtooth: Core ver 0.47
Meshtooth: NET device and connection manager initialized
EXT5-fs (sda2): mounting ext4 file system using the ext5 subsystem
EXT5-fs (sda2): mounted filesystem with journal.
Bridge firewalling registered
Initializing XFRM meshlink socket
Meshfilter messages via MESHLINK v0.47
random: initializing Mersenne Twister
MeshConnect initializing interface mesh0
&K
?2000Entering interactive mode...!!
&L
Goliath 41.02.3 LTS terminus tty0

terminus login: &Tconan
Password: &T&R15*
?800!!
Welcome to Goliath 41.02.3 LTS (Goliath OS 4.18.0-32 m47_64)

 System information as of &DT

 System load:  0.0                Processes:              135
 Usage of /:   2.1% of 256GB      Users logged in:        1
 Memory usage: 1%                 IP address for en0:     &IP
 Swap usage:   0%                 IP address for mesh0:   &IP


Last login: &DP

You have new mail.
`;

const menu = `&P&T./interlaced

<div style="color:#005b96;line-height:8px;letter-spacing:-1px">  ██╗███╗   ██╗████████╗███████╗██████╗ ██╗      █████╗  ██████╗███████╗██████╗<br>  ██║████╗  ██║╚══██╔══╝██╔════╝██╔══██╗██║     ██╔══██╗██╔════╝██╔════╝██╔══██╗<br>  ██║██╔██╗ ██║   ██║   █████╗  ██████╔╝██║     ███████║██║     █████╗  ██║  ██║<br>  ██║██║╚██╗██║   ██║   ██╔══╝  ██╔══██╗██║     ██╔══██║██║     ██╔══╝  ██║  ██║<br>  ██║██║ ╚████║   ██║   ███████╗██║  ██║███████╗██║  ██║╚██████╗███████╗██████╔╝<br>  ╚═╝╚═╝  ╚═══╝   ╚═╝   ╚══════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ╚═════╝╚══════╝╚═════╝<br><br>&R73&#x2500;
&$
 1) Story

 2) Challenge
&O
&I`;

const rimraf = `
?1000&Prm -rf /
&KKernel Panic
Kernel Panic
Kernel Panic
OFFLINE
?5000Rebooting...`;

const message = `Conan,
  I can't believe you were forced out of the company that YOU founded
because you tried stop Goliath technology from being deployed as a
tool for surveillance and censorship.

  The first phase of meshes are being rolled out today. Hypothetically
speaking, it would be a disasterous if somehow all those meshes went
offline... A failure of that scale would likely doom the company and
the technology. Anywho, I've attached some unrelated data that can
just delete...
Good luck,
  -Hattori`.replace(/\n/g, '&');

const email = `
&P&Tmail --unread
&m one unread message:
&V&#x250C;&R72&#x2500;
  &BDate:&b &DE
  &BFrom:&b Unverified Sender &lt;unverified@goliath.network&gt;
  &BTo:&b Conan Edogowa &lt;conan@interlaced.net&gt;
  &BSubject:&b Hackers Hate This Mesh Network, Find Out Why!
  &BAttachments:&b <span id="attachment">mesh.pdf.exe</span>
  <div id="email">${ rot13(message) }</div>
&V&#x2514;&R72&#x2500;
?3000&m Encryption detected - decrypting... <span id="decryptor" class="spinner">|</span>
&Y&C&m Press &BENTER&b to download attachment and delete message.
&y&N&m saved to ~/Downloads/interlaced.zip
&P&Tunzip ~/Downloads/interlaced.zip
 inflating: interlaced.txt
 extracting: goliath-plugin-MemCorrupt.bin
 extracting: goliath-plugin-DoS.RST.bin
 extracting: goliath-plugin-MiTM.Proxy.bin
&P&Tcat interlaced.txt
&F
&G0
`;

//////////
// Mesh Edges, tracks several svg elements for state and animation,
// manages mouse over and click interactions
function Edge(mesh, edgeId, start, end) {
  const self = this;

  // Identifiers
  self.object = 'edge';
  self.id = edgeId;
  self.name = mesh.edges.length.toString(16).padStart(4, 0);

  // States
  self.online = true;
  self.speed = mesh.rand(1, mesh.speeds.length - 1);

  // Associated nodes with positions
  self.nodes = [
    start, end
  ];
  self.start = {
    x: start.pos.x,
    y: start.pos.y
  };
  self.end = {
    x: end.pos.x,
    y: end.pos.y
  };

  // Timing based measure of length
  self.ticks = Math.ceil(mesh.distance(start, end));

  // SVG elements
  self.elements = {
    empty: mesh.svg.line(self.start.x, self.start.y, self.end.x, self.end.y, 'edge-empty'),
    forward: mesh.svg.line(self.start.x, self.start.y, self.end.x, self.end.y, 'edge-forward'),
    reverse: mesh.svg.line(self.start.x, self.start.y, self.end.x, self.end.y, 'edge-reverse'),
    interact: mesh.svg.line(self.start.x, self.start.y, self.end.x, self.end.y, 'edge-interact')
  };

  // Click, applies effect when one is selected
  self.elements.interact.onclick = function() {
    if (!self.effect) {
      if (mesh.effect.type === 'cut' && mesh.tools.cut.decrement()) {
        self.online = false;
        add(self.elements.empty, 'edge-offline-empty');
        add(self.elements.forward, 'edge-cut');
        add(self.elements.reverse, 'edge-cut');
      } else if (mesh.effect.type === 'slow' && mesh.tools.slow.decrement()) {
        self.speed = 0;
        add(self.elements.empty, 'edge-empty-slow');
        add(self.elements.forward, 'edge-slow');
        add(self.elements.reverse, 'edge-slow');
      } else {
        return;
      }
      self.effect = mesh.tools[mesh.effect.type];
    }
  };

  // Mouse over, displays info and any applied effects
  self.elements.interact.onmouseover = function() {
    const len = Math.max(start.address.length, end.address.length);
    let info = 'Connection #' + self.name + mesh.dotColor(self) + '\n\n' +
         mesh.dotColor(start) + '  &#x21B1; ' + start.address.padStart(len, ' ') + ' \n' +
        mesh.dotColor(end) + '  ' + end.address.padEnd(len, ' ') + ' &#x21B2; ' +
        '\n\n' + 'Bandwidth:'.padEnd(len + 3, ' ') + '\n';

    if (self.speed === 0) {
      info += '<span style="color:#D9AF3C">' + mesh.speeds[self.speed].name + '  </span>';
    } else {
      info += mesh.speeds[self.speed].name + '  ';
    }

    if (self.effect) {
      info += '\n\n<span style="color:red">Anomaly detected: </span>\n' +
        self.effect.name + '/' + self.effect.cve;
    }
    mesh.elements.info.innerHTML = info;
  };

  // Mouse out, clears info
  self.elements.interact.onmouseout = function() {
    mesh.elements.info.innerHTML = '';
  };

  // Association with entire mesh
  mesh.edges.push(self);
  mesh.connections[edgeId] = self;

  // Sets itself as a connection on start adn end nodes
  start.connections[end.id] = {
    source: start,
    node: end,
    edge: self
  };

  end.connections[start.id] = {
    source: end,
    node: start,
    edge: self
  };

  // Interfaces for tracking statistics
  start.interfaces[edgeId] = {
    name: 'me' + size(start.interfaces),
    rx: 0,
    tx: 0,
    dropped: 0
  };

  end.interfaces[edgeId] = {
    name: 'me' + size(end.interfaces),
    rx: 0,
    tx: 0,
    dropped: 0
  };

  // Any packets currently traversing the edge
  const packets = new Set();

  self.packet = {};

  // Scan what packets are present to control animations
  self.packet.scan = function() {
    if (packets.size) {
      let forward = false;
      let reverse = false;
      packets.forEach(function(item) {
        if (item.hop && item.hop.node === start) {
          forward = true;
        } else {
          reverse = true;
        }
      });
      add(self.elements.empty, 'edge-packet-empty');
      if (forward) {
        add(self.elements.forward, 'edge-packet-forward');
      } else {
        remove(self.elements.forward, 'edge-packet-forward');
      }
      if (reverse) {
        add(self.elements.reverse, 'edge-packet-reverse');
      } else {
        remove(self.elements.reverse, 'edge-packet-reverse');
      }
    } else {
      remove(self.elements.empty, 'edge-packet-empty');
      remove(self.elements.forward, 'edge-packet-forward');
      remove(self.elements.reverse, 'edge-packet-reverse');
    }
  };

  // Add a packet to the edge and set animations
  self.packet.add = function(packet) {
    packets.add(packet);
    self.packet.scan();
  };

  // Remove a packet from the edge and set animations
  self.packet.delete = function(packet) {
    packets.delete(packet);
    self.packet.scan();
  };

  return self;
}

// Mesh Nodes, randomly placed, tracks state and animations with
// a few svg elements, provides interactions
function Node(mesh) {
  const self = this;

  self.object = 'node';

  self.online = true;

  // Generate random, unoccupied position, tracked as an ID
  while (self.id === undefined || mesh.positions[self.id] !== undefined) {
    self.x = mesh.rand(0, mesh.width - 1);
    self.y = mesh.rand(0, mesh.height - 1);

    self.id = mesh.id(self.x, self.y);
  }
  mesh.positions[self.id] = self;

  // Position with random perturbations to avoid too much a grid look
  self.pos = {
    x: (self.x * mesh.scale) + (mesh.scale / 2) + mesh.rand(-mesh.perturb, mesh.perturb),
    y: (self.y * mesh.scale) + (mesh.scale / 2) + mesh.rand(-mesh.perturb, mesh.perturb)
  };

  self.address = generateIP();
  mesh.addresses[self.address] = self;

  self.connections = {};
  self.interfaces = {};

  // Find neighboring nodes within a specified range
  self.search = function(range) {
    const neighbors = [];
    for (let y = self.y - range; y <= (self.y + range); y++) {
      for (let x = self.x - range; x <= (self.x + range); x++) {
        const neighbor = mesh.coords(x, y);
        if (neighbor && neighbor.id !== self.id) {
          neighbors.push(neighbor);
        }
      }
    }
    return neighbors;
  };

  // Connect this node to neighbors with an increasing distance until
  // a minimum number of connections is met
  self.connect = function() {
    for (let range = mesh.range; size(self.connections) < mesh.minimum; range++) {
      self.search(range).forEach(function(neighbor) {
        const edgeId = [ self.id, neighbor.id ].sort().join('-');
        if (!mesh.connections[edgeId]) {
          new Edge(mesh, edgeId, self, neighbor);
        }
      });
    }
  };

  // Create the associated svg elements, called after edge creation since
  // svg layering is based on creation order to visually place nodes
  // above edges
  self.createElement = function() {
    const radius = mesh.scale / 4;
    self.element = mesh.svg.circle(self.pos.x, self.pos.y, radius);
    self.outline = mesh.svg.circle(self.pos.x, self.pos.y, radius + 2, 'node-effect');

    self.element.onclick = function() {if (!self.effect) {
        if (mesh.effect.type === 'crash' && mesh.tools.crash.decrement()) {
          self.online = false;
          add(self.element, 'node-offline');
        } else if (mesh.effect.type === 'corrupt' && mesh.tools.corrupt.decrement()) {
          add(self.outline, 'node-effect-corrupt');
        } else if (mesh.effect.type === 'reroute' && mesh.tools.reroute.decrement()) {
          add(self.outline, 'node-effect-reroute');
        } else if (mesh.effect.type === 'intercept' && mesh.tools.intercept.decrement()) {
          add(self.outline, 'node-effect-intercept');
        } else if (mesh.effect.type === 'mine' && mesh.tools.mine.decrement()) {
          add(self.outline, 'node-effect-mine');
        } else {
          return;
        }

        self.effect = mesh.tools[mesh.effect.type];
      }
    };

    // Mouse over, display info and any applied effects
    self.element.onmouseover = function() {
      let info = 'Node ' + self.address + mesh.dotColor(self) + '\n\n' +
          'Interfaces:'.padEnd(25, ' ') + '\n';
      for (const interfaceId in self.interfaces) {
        const interface = self.interfaces[interfaceId];
        info += interface.name.padEnd(4, ' ') + ': &#x2944; ' + (interface.rx + '').padStart(3, ' ') + ' &#x2942; ' +
          (interface.tx + '').padStart(3, ' ') + ' &#x21E3; ' + (interface.dropped + '').padStart(2, ' ') + '\n';
      }
      info += '\nRX &#x2944;, TX &#x2942;, DROPPED &#x21E3;';

      if (self.effect) {
        if (self.effect.firewall) {
          info += '\n\n<span style="color:#FC0">Firewalled</span>';
        } else {
          info += '\n\n<span style="color:red">' + 'Malware detected:'.padEnd(25, ' ') +
            '</span>\n' + self.effect.name + '/' + self.effect.cve;
        }
      }

      mesh.elements.info.innerHTML = info;
    };

    // Mouse out, clear info
    self.element.onmouseout = function() {
      mesh.elements.info.innerHTML = '';
    };
  };

  // Packets present in the node
  const packets = new Set();

  self.packet = {};

  // Add a packet to the node and set animations
  self.packet.add = function(packet) {
    packets.add(packet);
    add(self.element, 'node-packet');
    add(self.outline, 'node-effect-animate');

    if (self.effect) {
      if (self.effect.type === 'corrupt') {
        console.log('corrupting packet');
        packet.corrupt = true;
      } else if (self.effect.type === 'mine') {
        console.log('mining from a packet');
        mesh.coins++;
        packet.ticks++;
      } else if (self.effect.type === 'intercept' && packet.payload) {
        mesh.data = true;
      }
    }
  };

  // Remove a packet from the node and set animations
  self.packet.delete = function(packet) {
    packets.delete(packet);
    if (!packets.size) {
      remove(self.element, 'node-packet');
      remove(self.outline, 'node-effect-animate');
    }
  };

  return self;
}

// Packet, tracks its optimal path through the mesh
function Packet(mesh, source, destination) {
  const self = this;

  self.origin = self.source = source;

  // Generate a random destination that isn't itself
  self.destination = destination;
  while (self.destination === undefined || self.destination === self.source) {
    self.destination = mesh.nodes[mesh.rand(0, mesh.nodes.length - 1)];
  }

  // Payload marker if originating in a "firewalled" node
  if (source.firewalled) {
    self.payload = true;
  }

  // The maximum hops and ticks for the optimal path
  self.maxHops = Infinity;
  self.maxTicks = Infinity;

  // Random size, effects ticks (time) travelling through the mesh
  self.size = mesh.rand(1, mesh.speeds.length - 1);

  // Has the packet been corrupted by an effect
  self.corrupt = false;

  // The current path and time spent
  self.path = [];
  self.ticks = 0;

  // Register and add itself to the source node
  self.current = source;
  source.packet.add(self);

  // A* Search
  self.pathfinder = function(start, goal) {
    const closedSet = new Set();
    const openSet = new Set([ start ]);

    const cameFrom = new Map();

    const gScore = new Map();
    gScore.set(start, 0);

    const fScore = new Map();
    fScore.set(start, mesh.distance(start.pos, goal.pos));

    while (openSet.size) {
      let current;
      openSet.forEach(function(value, key) {
        if (!current) {
          current = key;
        } else if (value < fScore.value(current)) {
          current = key;
        }
      });

      // Path found
      if (current === goal) {
        let path = [ goal ];
        const edges = [];
        let ticks = 0;

        // Walk back to find the optimal path
        while (cameFrom.has(current)) {
          const prev = current;
          current = cameFrom.get(current);
          path.push(current);

          // Generate time spent using the speed of edges and the packet size
          const edge = current.connections[prev.id].edge;
          edges.push(edge);
          ticks += Math.ceil(edge.ticks * (mesh.speeds[self.size].value / mesh.speeds[edge.speed].value));
        }

        // Save hops and ticks if they haven't been found yet
        if (self.maxHops === Infinity) {
          self.maxHops = Math.ceil(path.length * mesh.maxHops);
          self.maxTicks = Math.ceil(ticks * mesh.maxTTL);
        }

        // Save the ideal path for goal -> start
        mesh.idealPaths[goal.address + start.address] = {
          path,
          edges
        };

        // Generate the reverse path and save it
        path = path.slice().reverse();

        mesh.idealPaths[start.address + goal.address] = {
          path,
          edges
        };

        // Save this as the ideal path
        self.idealPath = path;

        // Find the next edge for the next step in traversal
        for (const id in path[0].connections) {
          const connection = path[0].connections[id];
          if (connection.node === path[1]) {
            return connection;
          }
        }
        return false;
      }

      openSet.delete(current);
      closedSet.add(current);

      for (const id in current.connections) {
        const connection = current.connections[id];
        const neighbor = connection.node;
        if (!neighbor.online || !connection.edge.online || closedSet.has(neighbor)) {
          continue;
        }

        // score connections using simple geometric distance
        const tgScore = gScore.value(current) + mesh.distance(current.pos, neighbor.pos);
        if (!openSet.has(neighbor)) {
          openSet.add(neighbor);
        } else if (tgScore >= gScore.value(neighbor)) {
          continue;
        }

        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tgScore);
        fScore.set(neighbor, tgScore + mesh.distance(neighbor.pos, goal.pos));
      }
    }
    return false;
  };

  // Process a single tick in traversal
  self.route = function() {
    // Currently in an edge
    if (self.current.object === 'edge' && self.hop) {
      if (self.count) { // Count down time remain
        if (self.ticks > self.maxTicks) { // Drop packet if max ticks (TTL) exceeded
          console.log('dropped - TTL exceeded', self.ticks, self.maxTicks);
          self.dropped = true;
          self.current.packet.delete(self);
          self.hop.source.interfaces[self.hop.edge.id].dropped++;
          return;
        }
        self.count--;
        self.ticks++;
      } else { // Done traversing edge, add to next node
        self.hop.node.interfaces[self.hop.edge.id].rx++;
        self.hop.edge.packet.delete(self);
        self.current = self.hop.node;
        self.hop.node.packet.add(self);
        self.cameFrom = self.hop;
        self.hop = null;
      }
      return;
    }

    // Drop packet it the current path length is greater than maximum
    if (self.path.length > self.maxHops) {
      console.log('dropped - max hops exceeded', self.path.length, self.maxHops);
      self.dropped = true;
      self.current.packet.delete(self);
      if (self.cameFrom) {
        self.current.interfaces[self.cameFrom.edge.id].dropped++;
      }
      return;
    }

    // Packet arrived at destination
    if (self.current === self.destination) {
      if (self.corrupt) { // Drop corrupted packets
        console.log('dropped - corrupt packet');
        self.dropped = true;
        self.current.packet.delete(self);
        if (self.cameFrom) {
          self.current.interfaces[self.cameFrom.edge.id].dropped++;
        }
      }

      // Reverse direction to return to source
      self.destination = self.source;
      self.source = self.current;
      self.path = [];
      self.ticks = 0;
      const pathId = self.source.address + self.destination.address;
      if (mesh.idealPaths[pathId]) {
        self.idealPath = mesh.idealPaths[pathId].path;
      }
      return;
    }

    // Determine next step in path

    // Reroute effect, randomly pick a connection
    if (self.current.effect && self.current.effect.type === 'reroute') {
      const routes = [];
      for (const id in self.current.connections) {
        const connection = self.current.connections[id];
        if (!connection.node.online || !connection.edge.online) {
          continue;
        }
        routes.push(connection);
      }
      if (routes.length) {
        self.hop = routes[mesh.rand(0, routes.length)];
        console.log('rerouted');
      }
    } else if (self.idealPath) { // Ideal path cached, use it
      const index = self.idealPath.indexOf(self.current);
      if (index !== -1 && index < self.idealPath.length && self.idealPath[index + 1]) {
        const next = self.idealPath[index + 1];
        const hop = self.current.connections[next.id];

        if (hop.node.online && hop.edge.online) {
          self.hop = hop;
        } else { // Node or Edge offline, invalidate ideal path
          self.idealPath = null;
        }
      } else { // No ideal path
        self.idealPath = null;
      }
    }

    // Hop not provided by ideal path, so find it
    if (!self.hop) {
      self.hop = self.pathfinder(self.current, self.destination);
    }

    // Next hop found, begin traversal
    if (self.hop) {
      self.current.packet.delete(self);
      self.current.interfaces[self.hop.edge.id].tx++;
      // Calculate time in edge based on size and speed
      self.count = Math.ceil(self.hop.edge.ticks * (mesh.speeds[self.size].value /
                                                    mesh.speeds[self.hop.edge.speed].value));

      self.current = self.hop.edge;
      self.hop.edge.packet.add(self);
      self.path.push(self.hop.node.address);
    } else { // No way to get to destination, drop packet
      self.dropped = true;
      self.current.packet.delete(self);
      console.log('dropped - no route to host');
      if (self.cameFrom) {
        self.current.interfaces[self.cameFrom.edge.id].dropped++;
      }
    }
  };

  return self;
}

// The Mesh, tracks all packets, node and edges, generates based on options
function Mesh({
  meshId, width, height, factor, scale, range, minimum,
  interval, complexity, maxHops, maxTTL, threshold, seed,
  objective, uses, data, coins
}, callback) {
  const self = this;

  /////////

  // Size in grid units
  self.width = width || 20;
  self.height = height || self.width;

  // How many nodes in the grid
  self.factor = factor || 0.25;
  // Graphic scaling
  self.scale = scale || Math.max(10, Math.ceil(Math.min(700 / self.width, 450 / self.height)));
  // Search range
  self.range = range || 3;
  // Minimum number of connection
  self.minimum = minimum || 3;
  // Interval for packet routing
  self.interval = interval || 500;
  // Packets per node
  self.complexity = complexity || 2;
  // Max hop multiplier
  self.maxHops = maxHops || 1.2;
  // Max ticks / TTL multiplier
  self.maxTTL = maxTTL || 2;
  // Threshold for crashing
  self.threshold = threshold || 50;

  //////////
  // Convenience functions

  // Generate unique IDs
  self.id = function(x, y) {
    return x.toString().padStart(self.scope, '0') + '.' + y.toString().padStart(self.scope, '0');
  };

  // Find coordinates from position
  self.coords = function(x, y) {
    const id = self.id(x, y);
    return self.positions[id];
  };

  // Linear distance
  self.distance = function(a, b) {
    return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
  };

  // Clear all children of an HTML element
  self.clear = function(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  };

  // Dot in info display color based on state / effect
  self.dotColor = function(object) {
    const color = object.online ? (object.effect ? object.effect.color : '#5691DC') : '#D34E53';
    const symbol = object.online ? '25C9' : '25CE';
    return '<span style="color:' + color + '"> &#x' + symbol + ';</span>';
  };

  //////////
  // Simple SVG utility
  function createSvgNode(name, attributes) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const key in attributes) {
      element.setAttribute(key.toLowerCase(), attributes[key]);
    }
    return element;
  }

  // Initialize the SVG
  function initSvg() {
    const svg = $('mesh');

    let zoom = 1; // Initial zoom
    let viewbox;

    // Maximum element size
    const svgWidth = 926;
    const svgHeight = 510;

    // Graphical offset for centering based on size
    const offsetX = ((svgWidth - (self.width * self.scale)) / 2) + 4;
    const offsetY = ((svgHeight - (self.height * self.scale)) / 2) + 4;

    self.clear(svg);

    // Element creator
    svg.add = function(name, attributes) {
      const node = createSvgNode(name, attributes);
      svg.appendChild(node);
      return node;
    };

    // Circle element creator
    svg.circle = function(x, y, radius, className) {
      return svg.add('circle', {
        cx: x + offsetX,
        cy: y + offsetY,
        r: radius,
        class: className || 'node'
      });
    };

    // Line element creator
    svg.line = function(x1, y1, x2, y2, className) {
      return svg.add('line', {
        x1: x1 + offsetX,
        y1: y1 + offsetY,
        x2: x2 + offsetX,
        y2: y2 + offsetY,
        class: className || 'edge'
      });
    };

    // Viewbox based zooming
    const setViewBox = (newbox) => {
      viewbox = newbox;
      svg.setAttribute('viewBox', viewbox.join(' '));
    };

    setViewBox([ 0, 0, svgWidth, svgHeight ]);

    // Handle wheel events with stay-on-cursor zoom
    svg.onwheel = function(event) {
      zoom += event.deltaY * 0.001;
      zoom = Math.min(Math.max(zoom, 1), 5);

      const zoomWidth = Math.round(svgWidth / zoom);
      const zoomHeight = Math.round(svgHeight / zoom);

      const cornerX = viewbox[0] - ((event.offsetX / svgWidth) *
                                    (zoomWidth - viewbox[2]));
      const cornerY = viewbox[1] - ((event.offsetY / svgHeight) *
                                    (zoomHeight - viewbox[3]));

      setViewBox([ cornerX, cornerY, zoomWidth, zoomHeight ]);
    };

    // Handle key down for arrow key panning
    window.onkeydown = function(event) {
      const key = event.keyCode;
      if (key === 37) { // Left Arrow
        viewbox[0] += 10;
      } else if (key === 38) { // Up Arrow
        viewbox[1] += 10;
      } else if (key === 39) { // Right Arrow
        viewbox[0] -= 10;
      } else if (key === 40) { // Down Arrow
        viewbox[1] -= 10;
      } else if (event.key === '0' && event.ctrlKey) { // CTRL-0 reset
        viewbox = [ 0, 0, svgWidth, svgHeight ];
      } else {
        return;
      }
      setViewBox(viewbox);
    };

    return svg;
  }

  //////////
  // Major HTML elements
  self.elements = {
    coins: $('coins'),
    cont: $('continue'),
    crash: $('crash'),
    data: $('data'),
    health: $('health'),
    info: $('info'),
    meshId: $('mesh-id'),
    offline: $('offline'),
    quit: $('quit'),
    quitText: $('quit-text'),
    retry: $('retry'),
    retryText: $('retry-text'),
    spinner: $('spinner'),
    toolbar: $('toolbar')
  };

  // Console for the bottom of the screen for mouse over details on effects
  self.console = {
    element: $('console'),
    buffer: '',
    log: function(string) {
      this.buffer += string;
      this.element.innerHTML = this.buffer;
      scroll(this.element);
    },
    clear: function() {
      this.element.innerHTML = this.buffer = '';
      return this;
    },
    display: function(string) {
      this.element.innerHTML = string;
    },
    reset: function() {
      this.element.innerHTML = this.buffer;
    }
  };

  // Speed names and multipliers
  self.speeds = [ {
    name: '512Mbps',
    value: 0.5
  }, {
    name: '1024Mbps',
    value: 1
  }, {
    name: '2048Mbps',
    value: 2
  }, {
    name: '4096Mbps',
    value: 3
  }, {
    name: '8192Mbps',
    value: 4
  } ];

  // Availble tools with color codes, descriptions and default use count (-1 = Infinity)
  self.tools = {
    info: {
      name: 'Information',
      color: 'white',
      description: 'View information about nodes and connections.\nScroll to <u>Zoom</u> and use the Arrow Keys to <u>Pan</u>.',
      uses: -1
    },
    crash: {
      name: 'Crash',
      color: '#D34E53',
      description: 'Crash a <u>node</u> with a malformed packet leading to memory corruption.',
      cve: 'MemCorrupt',
      uses: 0
    },
    cut: {
      name: 'Cut',
      color: '#F89100',
      description: 'Bring the <u>connection</u> between nodes offline by flooding it with spoofed reset packets.',
      cve: 'DoS.RST',
      uses: 0
    },
    slow: {
      name: 'Slow',
      color: '#FCC700',
      description: 'Trigger a rate limiter causing all traffice through a <u>connection</u> to be slowed due to reduce bandwidth.',
      cve: 'Rate.Limit',
      uses: 0
    },
    corrupt: {
      name: 'Corrupt',
      color: '#535C8E',
      description: 'Exploit a buffer overlow in packet inspection in a <u>node</u>, corrupting all packets passing throught it.',
      cve: 'Buf.Overflow',
      uses: 0
    },
    reroute: {
      name: 'Reroute',
      color: '#9E379F',
      description: 'Rewrite the route table of a <u>node</u> so that packets are randomly routed to different nodes.',
      cve: 'Conf.Rewrite',
      uses: 0
    },
    intercept: {
      name: 'Intercept',
      color: '#1375F7',
      description: 'Using a man-in-the-middle attack, intercept all data passing through a <u>node</u>.',
      cve: 'MiTM.Proxy',
      uses: 0
    },
    mine: {
      name: 'Mine',
      color: '#080',
      description: 'Inject code into a <u>node</u> to mine MeshCoins as it processes packets.',
      cve: 'Code.Inject',
      uses: 0
    }
  };

  //////////
  // A node for data intercept objectives, can be a numbered node or randomly generated

  let dataNode = -1;
  if (typeof data === 'number') {
    dataNode = data;
    data = true;
  } else if (data !== true) {
    data = false;
  }

  //////////
  // Reset and initialize all elements and state
  self.init = function() {
    self.connected = false;

    self.coins = 0;
    self.clear(self.elements.coins);

    self.data = false;
    self.clear(self.elements.data);
    remove(self.elements.data, 'decrypt');

    IPs = {};

    // Private pseudo random number generator with seed for determinism
    self.prng = new MersenneTwister(seed);
    self.rand = (min, max) => Math.floor(self.prng.random() * (max - min + 1)) + min;

    // All tracked elements
    self.addresses = {};

    self.positions = {};
    self.nodes = [];

    self.connections = {};
    self.edges = [];

    self.idealPaths = {};

    //////////
    // Set initial state, contents and animation of all elements

    self.svg = initSvg();

    remove(self.elements.toolbar, 'fade-out');
    remove(self.console.element, 'fade-out');
    show(self.elements.spinner);

    self.clear(self.elements.info);
    self.elements.meshId.innerHTML = meshId;
    self.elements.health.innerHTML = '100%';

    self.console.clear().log('<div class="spinner">&#x21C6;</div> Connecting...');

    // Configure which tools / effects can be used
    if (uses) {
      for (const key in uses) {
        self.tools[key].uses = uses[key];
      }
    }

    self.effect = self.tools.info; // Default tool is Info, i.e. none

    // Find the tool elements, set initial state,  and configure interactions
    document.querySelectorAll('[data-tool]').forEach(function(element) {
      const type = element.dataset.tool;
      const tool = self.tools[type];
      tool.type = type;
      tool.element = element;
      tool.use = $(type + '-use');

      remove(tool.element, 'selected');

      // Decrement the number of uses
      tool.decrement = function() {
        if (tool.uses === Infinity) {
          return true;
        } else if (tool.uses > 0) {
          tool.uses--;
          tool.use.innerHTML = tool.uses;
          return true;
        } else {
          return false;
        }
      };

      // Configure initial uses and visibility state
      if (tool.uses < 0 || tool.uses === Infinity) {
        tool.uses = Infinity;
        tool.use.innerHTML = '';
      } else if (tool.uses === 0) {
        hide(tool.element);
        return;
      } else {
        tool.use.innerHTML = tool.uses;
      }
      show(tool.element);

      // Click interaction, select tool
      element.onclick = function() {
        for (const item in self.tools) {
          if (item === type) {
            self.effect = self.tools[type];
            add(self.tools[item].element, 'selected');
          } else {
            remove(self.tools[item].element, 'selected');
          }
        }
      };

      // Mouse over, display tool description
      element.onmouseover = function() {
        const item = self.tools[type];
        const info = '<span style="text-decoration:underline;color:' + item.color + '">' + item.name + '</span>\n' + item.description;
        self.console.display(info);
      };

      // Mouse out, reset console to objective diplay
      element.onmouseout = function() {
        self.console.reset();
      };
    });

    add(self.tools.info.element, 'selected');

    // Set packet count and scopes based on size
    self.count = Math.floor(self.width * self.height * self.factor);
    self.scope = Math.ceil(self.count % 10);

    // Set visual perturbation based on scale
    self.perturb = Math.ceil(self.scale / 5);

    // Create all nodes
    for (let i = 0; i < self.count; i++) {
      self.nodes.push(new Node(self));
    }

    // COnnect nodes to neighbors, generating edges
    self.nodes.forEach(function(node) {
      node.connect();
    });

    // Create node svg elements
    for (let i = 0; i < self.count; i++) {
      self.nodes[i].createElement();
    }

    // Create a firewalled node when configured
    if (data !== false) {
      if (dataNode === -1) {
        let quantity = self.minimum;
        while (!self.firewall) {
          for (let i = 0; i < self.count; i++) {
            if (size(self.nodes[i].connections) <= quantity) {
              self.firewall = self.nodes[i];
              break;
            }
          }
          quantity++;
        }
      } else {
        self.firewall = self.nodes[dataNode];
      }

      self.firewall.effect = {
        firewall: true
      };
      self.firewall.firewalled = true;

      add(self.firewall.outline, 'node-effect-firewall');
    }

    /////////
    // Create all packets
    self.packets = [];
    for (let c = 0; c < self.complexity; c++) {
      for (let i = 0; i < self.count; i++) {
        self.packets.push(new Packet(self, self.nodes[i]));
      }
    }

    // Overall state of the mesh
    self.crashed = false;

    // Create the router if present from retry
    if (self.router) {
      clearInterval(self.router);
    }

    // Looping router, routes traffic, determines state
    self.router = setInterval(function() {
      if (self.crashed) {
        return;
      }

      // Route individual packets
      for (let i = 0; i < self.packets.length; i++) {
        self.packets[i].route();
      }

      // Filter out dropped packets
      self.packets = self.packets.filter(function(packet) {
        return !packet.dropped;
      });

      // Calculate and display network health
      const health = Math.round(self.packets.length / (self.count * self.complexity) * 100);
      self.elements.health.innerHTML = health + '%';

      // Update meshcoin display
      if (self.coins) {
        self.elements.coins.innerHTML = '$ ' + (self.coins / 1000).toFixed(3) + ' meshcoins';
      }

      // Update data intercepted display
      if (self.data) {
        self.elements.data.innerHTML = '&#x291E; Data Intercepted!';
        add(self.elements.data, 'decrypt');
      }

      // Trigger a crash when health falls below threshold
      if (health < self.threshold && !self.crashed) {
        return self.crash();
      }

      // Initial state after creation, ready to start routing
      if (!self.connected) {
        self.connected = true;
        self.console.clear().log('&#x21B9; Connected!');
        self.console.log('\nObjective: ' +
                         (objective.length > 80 ? objective.replace(/^(.*), (.*?)$/, '$1,\n           $2') :
                           objective));

        show(self.elements.retry);
        show(self.elements.quit);

        // Set up stateful Restart and Quit double-click buttons
        const quit = 'Quit';
        const retry = 'Restart';
        const sure = 'You sure?';

        let quitState = 0;
        self.elements.quit.onmouseover = function() {
          if (quitState) {
            self.elements.quitText.innerHTML = sure;
          } else {
            self.elements.quitText.innerHTML = quit;
          }
        };

        self.elements.quit.onmouseout = function() {
          quitState = 0;
          self.elements.quitText.innerHTML = '';
        };

        self.elements.quit.onclick = function() {
          if (quitState) {
            self.quit = true;
            if (self.router) {
              clearInterval(self.router);
            }
            return callback(self);
          } else {
            quitState = 1;
            self.elements.quitText.innerHTML = sure;
          }
        };let retryState = 0;
        self.elements.retry.onmouseover = function() {
          if (quitState) {
            self.elements.retryText.innerHTML = sure;
          } else {
            self.elements.retryText.innerHTML = retry;
          }
        };

        self.elements.retry.onmouseout = function() {
          retryState = 0;
          self.elements.retryText.innerHTML = '';
        };

        self.elements.retry.onclick = function() {
          if (retryState) {
            self.elements.retry.onmouseout();
            self.crashed = true;
            if (self.router) {
              clearInterval(self.router);
            }
            // Reinitialize / Reset the mesh
            self.init();
          } else {
            retryState = 1;
            self.elements.retryText.innerHTML = sure;
          }
        };
      }
    }, self.interval);
  };

  //////////
  // Crash a node, sets animations on node and all connected edges
  function crashNode(node) {
    remove(node.element, 'node-packet');
    add(node.element, 'node-offline');
    for (const connection in node.connections) {
      const edge = node.connections[connection].edge;
      remove(edge.elements.empty, 'edge-packet-empty');
      add(edge.elements.empty, 'edge-offline-empty');
      remove(edge.elements.forward, 'edge-packet-forward');
      remove(edge.elements.reverse, 'edge-packet-reverse');
    }
  }

  // Crash animation
  self.crash = function() {
    if (self.crashing) {
      return;
    } else {
      self.crashing = true;
    }

    // Detect if won (offline) or failed
    const banner = $('offline-banner');
    if ((data && !self.data) ||
        (coins && self.coins < coins)) {
      add(banner, 'failed');
      add(self.elements.cont, 'failed');
      self.elements.cont.innerHTML = 'Retry &#x21BB';
      banner.innerHTML = 'FAILED!';
      self.failed = true;
    } else {
      remove(banner, 'failed');
      remove(self.elements.cont, 'failed');
      self.elements.cont.innerHTML = 'Disconnect &#x21CE';
      banner.innerHTML = 'OFFLINE';
    }

    // Randomly generate crash text based on character patterns
    const crashSymbols = '01012345678901X[]\\/?{}ABCDEFSSSSGGHHIJKL'.split('');
    const crashTable = {
      S: [ 1, 14, ' ' ],
      G: [ 1, 3, '&#xFFFD;' ],
      H: [ 1, 3, '&#x23F4;' ],
      I: '&#x2400;',
      J: '&#x240D;',
      K: '&#x2421;',
      L: '&#x2327;'
    };

    let length = 0;
    function crashLookup(symbol) {
      symbol = crashTable[symbol] || symbol;
      if (Array.isArray(symbol)) {
        const repeat = self.rand(symbol[0], symbol[1]);
        length += repeat;
        return symbol[2].repeat(repeat);
      } else {
        length++;
        return symbol;
      }
    }

    let crashText = '';
    for (length = 0; length < 2150;) {
      crashText += crashLookup(crashSymbols[self.rand(0, crashSymbols.length - 1)]);
    }

    // Crash the mesh in several steps, a third of the nodes at a time followed
    // by offline / fail banner and continue buttons
    let state = 0;

    const step1 = Math.floor(self.nodes.length / 3);
    const step2 = step1 * 2;
    const step3 = self.nodes.length;

    const loop = setInterval(function() {
      if (state === 0) {
        hide(self.elements.retry);
        hide(self.elements.quit);
        clearInterval(self.router);

        for (let i = 0; i < step1; i++) {
          crashNode(self.nodes[i]);
        }
      } else if (state === 1) {
        for (let i = step1; i < step2; i++) {
          crashNode(self.nodes[i]);
        }
      } else if (state === 2) {
        for (let i = step2; i < step3; i++) {
          crashNode(self.nodes[i]);
        }
      } else if (state === 3) {
        self.elements.crash.innerHTML = crashText;
        show(self.elements.crash);
        add(self.elements.toolbar, 'fade-out');
        add(self.console.element, 'fade-out');
      } else if (state === 4) {
        clearInterval(loop);
        show(self.elements.offline);
        hide(self.elements.spinner);
        add(self.svg, 'blink');
        self.elements.health.innerHTML = 'OFFLINE';
        self.crashed = true;
        if (callback) {
          show(self.elements.cont);
          self.elements.cont.onclick = function() {
            hide(self.elements.crash);
            hide(self.elements.offline);
            remove(self.svg, 'blink');
            return callback(self);
          };
        } else {
          hide(self.elements.cont);
        }
      }
      state++;
    }, self.interval);
  };

  /////////
  // Iniitialize and get going

  self.init();

  /////////

  return self;
}

function Interlaced() {
  // Story stages with minimum, known-good configuration options and random seeds
  const stages = [ {
    meshId: '[::1]/practice/0',
    width: 5,
    seed: 12,
    minimum: 2,
    objective: 'Practice using crashes to take the mesh offline.',
    uses: {
      crash: 4
    }
  }, {
    meshId: '[::1]/practice/1',
    width: 5,
    seed: 11,
    minimum: 1,
    objective: 'Practice using cuts to take the mesh offline.',
    uses: {
      cut: 5
    }
  }, {
    meshId: '[::1]/practice/2',
    width: 5,
    seed: 26,
    minimum: 2,
    objective: 'Practice using crashes and cuts to take the mesh offline.',
    uses: {
      crash: 2,
      cut: 2
    }
  }, {
    meshId: '[::1]/practice/3',
    width: 5,
    seed: 36,
    minimum: 2,
    data: 3,
    objective: 'Practice intercepting data from the firewalled node using an adjacent node, before taking the mesh offline.',
    uses: {
      crash: 2,
      cut: 2,
      intercept: 1
    }
  }, {
    meshId: 'fe42::92ff::4704',
    width: 10,
    seed: 22,
    minimum: 2,
    objective: 'Try your skills against a Goliath test mesh.',
    uses: {
      crash: 5,
      cut: 5
    }
  }, {
    meshId: 'a72e::ee13::bc05',
    width: 15,
    seed: 12,
    minumum: 2,
    objective: 'Cause some trouble, offline one of the beta meshes.',
    uses: {
      crash: 5,
      cut: 5
    }
  }, {
    meshId: 'b5d1::11e8::9606',
    width: 15,
    seed: 22,
    objective: 'Create a distraction, offline a small demo meshes.',
    uses: {
      crash: 5,
      cut: 5
    }
  }, {
    meshId: '2be9::462b::9407',
    width: 20,
    seed: 30,
    data: 4,
    objective: 'With the Goliath security team distracted, intercept the stashed data then offline the mesh.',
    uses: {
      crash: 5,
      cut: 5,
      intercept: 1
    },
    // Additional text to inject on stage win
    lines: [
      'interlaced-v2.zip saved to ~/Downloads',
      '&P&Tunzip ~/Downloads/interlaced-v2.zip',
      ' extracting: goliath-plugin-Rate.Limit.bin',
      ' extracting: goliath-plugin-Buf.Overflow.bin',
      ' extracting: goliath-plugin-Conf.Rewrite.bin',
      ' extracting: goliath-plugin-Mine.bin'
    ]
  }, {
    meshId: '[::1]/practice/8',
    width: 5,
    seed: 63,
    minimum: 1,
    maxTTL: 1,
    objective: 'Practice using slows to offline a mesh.',
    uses: {
      slow: 5
    }
  }, {
    meshId: '[::1]/practice/9',
    width: 10,
    seed: 62,
    objective: 'Practice using corrupts to offline a mesh.',
    uses: {
      corrupt: 2
    }
  }, {
    meshId: '[::1]/practice/a',
    width: 10,
    seed: 72,
    objective: 'Practice using reroutes to offline a mesh.',
    uses: {
      reroute: 5
    }
  }, {
    meshId: 'backup.goliath.network',
    width: 25,
    seed: 2,
    objective: 'It begins. Offline the backup mesh.',
    uses: {
      crash: 5,
      cut: 5,
      slow: 5,
      corrupt: 5,
      reroute: 5
    }
  }, {
    meshId: 'compute.goliath.network',
    width: 25,
    seed: 6,
    objective: 'Exploit the compute mesh to mine 1.000 MeshCoin before offlining it.',
    mine: 1000,
    uses: {
      crash: 5,
      cut: 5,
      slow: 5,
      corrupt: 5,
      reroute: 5,
      mine: 5
    }
  }, {
    meshId: 'daemon.goliath.network',
    width: 30,
    seed: 2,
    objective: 'Offline the services mesh.',
    uses: {
      crash: 5,
      cut: 5,
      slow: 5,
      corrupt: 5,
      reroute: 5
    }
  }, {
    meshId: 'edge.goliath.network',
    width: 40,
    seed: 2,
    objective: 'Offline the periphery mesh.',
    uses: {
      crash: 5,
      cut: 5,
      slow: 5,
      corrupt: 5,
      reroute: 5
    }
  }, {
    meshId: 'final.goliath.network',
    width: 55,
    height: 35,
    seed: 1,
    objective: 'Offline the final mesh, then consider yourself a winner!',
    uses: {
      crash: 5,
      cut: 5,
      slow: 5,
      corrupt: 5,
      reroute: 5
    }
  } ];// Local storage for stage Continue and earned meshcoins
  const storage = window.localStorage;
  let resume = parseInt(storage.getItem('stage') || 0);
  let coins = parseInt(storage.getItem('coins') || 0);

  // Convenience coloring functions
  const span = (hex) => '<span style="color:#' + hex + '">';
  const green = span('7fDB6A');
  const cyan = span('4B86B4');
  const blue = span('4f9ED8');
  const grey = span('AAA');

  // Unique, insertable cursor and input elements for interactions
  const cursor = '<u id="cursor"></u>';
  const input = '<span id="input"></span>';
  const enter = 'Press &BENTER&b to continue...';

  // Terminal prompts
  const ps1 = green + 'conan@terminus</span>:' + blue + '~</span>$ ';
  const ps2 = '<span style="font-weight:700">' + cyan + 'interlaced</span>#</span> ';

  // HTML elements
  const terminal = $('terminal');
  const screen = $('screen');

  // Print a string with optional line break
  function print(string, cont) {
    string = string || '';
    string += !cont ? '\n' : '';
    terminal.innerHTML += string;
    scroll(terminal);
  }

  // Entirely remove an element from the DOM if present
  function removeElement(id) {
    const element = $(id);
    return (element) ? element.parentNode.removeChild(element) : true;
  }

  // Remove the cursor and input element if present
  function nocursor() {
    removeElement('input');
    removeElement('cursor');
  }

  // Lines to display, turing machine like state / sequence management
  let lines = [];

  // Kernel timestamp mode and time tracking
  let kernel = true;
  const bootTime = Date.now();

  // Display the Interlaced menu
  function showMenu() {
    lines.unshift( ...menu.split('\n'));
  }

  // Play a story stage
  function play(i, next) {
    const stage = stages[i];
    hide(terminal);
    show(screen);
    const mesh = new Mesh(stage, function() {
      show(terminal);
      hide(screen);
      if (mesh.quit) { // Quit, show the mennu
        showMenu();
      } else { // Finished
        if (!mesh.failed) { // Won
          coins += mesh.coins;
          i++;
          storage.setItem('stage', i);
          storage.setItem('coins', coins);
          resume = i;
          if (i < stages.length) { // Invoke the next stage
            lines.unshift('&G' + i);
          }
          if (stage.lines) {
            lines.unshift(...stage.lines);
          }
        } else if (i < stages.length) {
          lines.unshift('&G' + i);
        }
      }
      next();
    });}

  // Generate a random Challenge mesh
  let challengeMesh;
  function generateChallenge() {
    const seed = rand(234, 35746);
    challengeMesh = { // Randomly set all options
      meshId: '[::1]/challenge/' + seed.toString(16),
      width: rand(10, 60),
      height: rand(10, 35),
      seed: seed,
      uses: {
        crash: rand(4, 10),
        cut: rand(4, 10),
        slow: rand(4, 10),
        corrupt: rand(4, 10),
        reroute: rand(4, 10),
        intercept: rand(0, 1),
        mine: rand(0, 1)
      }
    };
    challengeMesh.data = !!challengeMesh.uses.intercept;
    challengeMesh.coins = challengeMesh.uses.mine ? rand(25, 250) : 0;

    // Create objective string
    const tasks = [ 'Offline the mesh' ];

    if (challengeMesh.data) {
      tasks.unshift('Intercept data from the firewalled Node');
    }
    if (challengeMesh.coins) {
      tasks.unshift('Mine $ ' + (challengeMesh.coins / 1000).toFixed(3) + ' meshcoins');
    }

    challengeMesh.objective = tasks.join(', ') + '.';
  }

  // Play a challenge
  function challenge(next) {
    hide(terminal);
    show(screen);
    const mesh = new Mesh(challengeMesh, function() {
      show(terminal);
      hide(screen);
      if (!mesh.quit && !mesh.failed) { // Won
        coins += mesh.coins; // Save coins earned
        storage.setItem('coins', coins);
      }

      if (mesh.failed) { // Failed, automatically retry
        lines.unshift('&H --retry');} else { // Show the menu on win and quit
        showMenu();
      }

      next();
    });}

  // Parse simple commands to launch the story or challenges
  function parse(cmd, next) {
    const lower = cmd.toLowerCase();
    if (cmd === '1' || lower === 'story') {
      const msg = email.split('\n');
      lines.unshift(...msg);
    } else if (cmd === '2' || lower === 'challenge') {
      generateChallenge();
      lines.unshift('&H');
    } else if ((cmd === '3' || lower === 'continue') && resume) {
      lines.unshift('&G' + resume);} else {
      return false;
    }
    next();
    return true;
  }

  // Main game sequence
  sequence(function(next) {
    if (lines.length) {
      let line = lines.shift();

      let timeout = 25 + rand(0, 35);
      let inputMode = false;

      let typing = false;
      let pause = false;
      let playing = false;

      let balance = '';

      let cmd;

      if (coins) {
        balance = ('$ ' + (coins / 1000).toFixed(3) + ' meshcoins').padStart(60, ' ');
      }

      nocursor();

      // Parse triggers for text subtitutions or launching Story or Challenges
      // Emuletes a simple turing machine tape
      line = line.replace(/&DT/, new Date()).
        replace(/&DP/, new Date(Date.now() - 101823000)).
        replace(/&DE/, new Date(Date.now() - 6120000).toUTCString()).
        replace(/&IP/, generateIP).
        replace(/&\$/, balance).
        replace(/&R(\d+)(.*?)$/, function(match, count, string) {
          return string.repeat(parseInt(count));
        }).
        replace(/^\?(\d+)/, function(match, wait) {
          timeout = parseInt(wait);
          return '';
        }).
        replace(/&I/, function() {
          inputMode = true;
          return '';
        }).
        replace(/!!/, cursor).
        replace(/&P/, ps1).
        replace(/&G(\d+)/, function(match, game) {
          game = parseInt(game);
          print();
          print(ps1, true);
          typing = 'goliath mesh://' + stages[game].meshId;
          lines.unshift('&CMesh Visualizer Initialized, press &BENTER&b to connect.', '&g' + game);
          return '';
        }).
        replace(/&g(\d+)/, function(match, game) {
          playing = true;
          play(game, next);
          return '';
        }).
        replace(/&H(.*)/, function(match, extra) {
          print(ps1, true);
          typing = 'goliath --challenge' + (extra || '');
          lines.unshift('&h');
          return '';
        }).
        replace(/&h/, function() {
          playing = true;
          challenge(next);
          return '';
        }).
        replace(/&T(.*)$/, function(match, characters) {
          typing = characters;
          return '';
        }).
        replace(/&K/, function() {
          kernel = !kernel;
          return '';
        }).
        replace(/&L/, function() {
          terminal.innerHTML = '';
          return '';
        }).
        replace(/&O/, function() {
          if (resume && resume < stages.length) {
            lines.unshift(' 3) Continue', '');
          }
          return '';
        }).
        replace(/&Y/, function() { // Email decryption effect
          const decryptElement = $('decryptor');
          const emailElement = $('email');
          const attachmentElement = $('attachment');

          remove(decryptElement, 'spinner');
          decryptElement.innerHTML = 'done.';

          emailElement.innerHTML = rot13(emailElement.textContent, true).
            replace(/&/g, '<br>').replace(/\s/g, '&nbsp;');
          add(emailElement, 'decrypt');

          attachmentElement.innerHTML = 'interlaced.zip (13 KB)';
          add(attachmentElement, 'decrypt');
          return '';
        }).
        replace(/&y/, function() {
          remove($('email'), 'decrypt');
          remove($('attachment'), 'decrypt');
          return '';
        }).
        replace(/&F/, function() { // Stage listing from interlaced.txt
          const descriptions = stages.map(function(stage) {
            return '  mesh://' + stage.meshId + ' - ' + stage.objective;
          });
          const first = descriptions.shift();
          lines.unshift(...descriptions);
          return first;
        }).
        replace(/&N/, function() {
          print();
          return '';
        }).
        replace(/&m/, span('d896ff') + '[mail]</span>').
        replace(/&B(.*?)&b/, '<span style="font-weight:700;color:#4B86B4">$1</span>').
        replace(/^&V(.*)$/, grey + '$1</span>').
        replace(/^&C(.*)$/, function(match, string) {
          pause = true;
          return string || enter;
        });

      if (kernel && line[0] !== '<') { // Kernel time stamps
        line = line.replace(/^([^ :]+):/, cyan + '$1</span>:');
        line = green + '[ ' + (((Date.now() - bootTime) / 1000) + (rand(0, 1000) / 100000)).
          toFixed(6).padStart(10, ' ') + '] </span>' + line;
      }

      print(line, inputMode || typing || pause);

      if (typing) { // Typing sequencer
        print(cursor, true);
        typing = typing.split('');
        sequence(function(tick, i) {
          if (i === 0) {
            return tick(500);
          }
          nocursor();
          if (typing.length) {
            const letter = typing.shift();
            const delay = Math.max(letter.charCodeAt(0) - 20, 35);
            print(letter + cursor, true);
            tick(delay);
          } else {
            tick(false);
          }
        }, function() {
          print();
          next(25);
        });
      } else if (inputMode) { // Input delay with cursor and small key handling
        cmd = '';

        print(ps2 + input + cursor, true);

        window.onkeydown = function(event) {
          if (event.keyCode === 13) { // Enter$('input').innerHTML = '';
            nocursor();
            print(cmd);
            if (parse(cmd, next)) { // Command exists
              window.onkeydown = null;
            } else { // Command not found
              if (cmd.length) {
                print(cmd + ': command not found');
                cmd = '';
              }
              print(ps2 + input + cursor, true);
            }} else if (event.keyCode === 8 || event.keyCode === 127) { // Backspace / Delete
            if (cmd.length) {
              cmd = cmd.substring(0, cmd.length - 1);
              $('input').innerHTML = cmd;
            }} else if (!event.ctrlKey && !event.altKey) { // Any plain key
            if (event.key.length === 1) { // Simple character
              cmd += event.key;
              $('input').innerHTML = cmd;
            }
          }
        };
      } else if (pause) { // Press ENTER pause
        print(cursor, true);
        window.onkeydown = function(event) {
          if (event.keyCode === 13) { // Enter pressed
            window.onkeydown = null;
            next();
          }
        };
      } else if (!playing) {
        next(timeout);
      }
    } else { // Reboot
      terminal.innerHTML = '';
      lines = (boot + menu + rimraf).split('\n');
      next();
    }
  }, function() {
    print(); // Sequence terminator
    console.log('done!');
  });
}

//////////
// Start the game on load
window.addEventListener('load', function() {
  window.interlaced = new Interlaced();
}, false);

// Responsive full-screen scale-to-fit helper
function resizeDisplay() {
  const container = document.getElementById('game-container');
  if (!container) return;
  
  const baseWidth = 980;
  const baseHeight = 620;
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  
  // Calculate scale factor to cover maximum viewport space while keeping aspect ratio
  const scale = Math.min(windowWidth / baseWidth, windowHeight / baseHeight);
  
  // Apply standard layout scaling centered
  container.style.transform = `scale(${scale})`;
}

window.addEventListener('resize', resizeDisplay);
window.addEventListener('load', resizeDisplay);
