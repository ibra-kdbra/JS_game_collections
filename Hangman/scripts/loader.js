const animScreen = document.querySelector(".loading-screen");
let loaded = false;
let mainTimeLine = gsap.timeline();
let allowAudio = true;
const initLoading = () => {
	let tl = gsap.timeline({ defaults: { duration: 0.4, delay: 0.4 } });
	tl.to(".loading-cover", { scaleY: 1 }).to(".loading-seg", {
		duration: 0,
		opacity: 1,
	});
	return tl;
};
const loading = () => {
	let tl = gsap.timeline({
		defaults: { duration: 0.4 },
		repeat: -1,
		onRepeat: () => {
			if (loaded) {
				tl.pause().kill();
				gsap
					.timeline({ defaults: { duration: 0.4 } })
					.to(".loading-seg", { duration: 0, opacity: 0 })
					.to(".loading-cover", { scaleY: 0 })
					.to(".loading-screen", { opacity: 0 })
					.to(".loading-screen", { duration: 0, visibility: "collapse" });
			}
		},
	});
	tl.to(".loading-cover", { scaleY: 0, y: -12, stagger: 0.1 })
		.to(
			".loading-cover",
			{
				scaleY: 1,
				stagger: 0.1,
				y: 0,
			},
			0.7
		)
		.to(".loading-seg", { y: -12, stagger: 0.1 }, 0)
		.to(".loading-seg", { y: 0, stagger: 0.1 }, "-=1.3");
	return tl;
};
const animateLoading = () => {
	mainTimeLine.add(initLoading()).add(loading());
};
animateLoading();

// Sounds start as silent placeholders so gameplay never waits on (or crashes over) audio.
const sounds = {
	correct: new Audio(),
	wrong: new Audio(),
	win: new Audio(),
	lose: new Audio(),
	rotate: new Audio(),
	pullup: new Audio(),
	hang: new Audio(),
};
const playSound = (name, volume = 1) => {
	const audio = sounds[name];
	if (!allowAudio || !audio.src) return;
	audio.volume = volume;
	audio.currentTime = 0;
	audio.play().catch(() => {});
};
const stopSound = (name) => {
	sounds[name].pause();
};

const ASSET_TIMEOUT_MS = 8000;
const LAYER_IMAGES = {
	mountains: "./images/mountains.png",
	city: "./images/city.png",
	"hill-middle": "./images/middle.png",
	"hill-left": "./images/left.png",
	"hill-right": "./images/right.png",
};

// Resolves either way: a missing image or sound degrades the scene, it never blocks the game.
const withTimeout = (promise) =>
	Promise.race([
		promise,
		new Promise((resolve) => setTimeout(() => resolve(null), ASSET_TIMEOUT_MS)),
	]);
const loadImage = (src) =>
	withTimeout(
		new Promise((resolve) => {
			const img = new Image();
			img.alt = "";
			img.onload = () => resolve(img);
			img.onerror = () => resolve(null);
			img.src = src;
		})
	);
const loadSound = (name) =>
	withTimeout(
		new Promise((resolve) => {
			const audio = sounds[name];
			const done = () => resolve(audio);
			audio.preload = "auto";
			audio.addEventListener("canplaythrough", done, { once: true });
			audio.addEventListener("error", () => resolve(null), { once: true });
			audio.src = `./audio/${name}.mp3`;
			// Mobile browsers often refuse to buffer audio before a tap; don't wait for them.
			setTimeout(done, 1500);
		})
	);

const loadData = () => {
	const bgContainer = document.querySelector(".bg-container");
	const images = [
		loadImage("./images/sky.png").then((img) => {
			if (img) bgContainer.style.backgroundImage = `url(${img.src})`;
		}),
		...Object.entries(LAYER_IMAGES).map(([layer, src]) =>
			loadImage(src).then((img) => {
				if (img) document.querySelector(`.${layer}`).append(img);
			})
		),
	];
	const audio = Object.keys(sounds).map(loadSound);
	Promise.all([...images, ...audio]).then(() => {
		loaded = true;
	});
};
loadData();
