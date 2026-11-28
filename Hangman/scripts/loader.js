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

// Sound effects are synthesised in scripts/sounds.js; there are no audio files to load.
const playSound = (name, volume = 1) => {
	if (allowAudio) HangmanSounds.play(name, volume);
};
const stopSound = (name) => HangmanSounds.stop(name);

const ASSET_TIMEOUT_MS = 8000;
const LAYER_IMAGES = {
	mountains: "./images/mountains.png",
	city: "./images/city.png",
	"hill-middle": "./images/middle.png",
	"hill-left": "./images/left.png",
	"hill-right": "./images/right.png",
};

// Resolves either way: a missing image degrades the scene, it never blocks the game.
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
	Promise.all(images).then(() => {
		loaded = true;
	});
};
loadData();
