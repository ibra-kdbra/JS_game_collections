"use strict";

// Loads every image once and every sound once (Howler fetches only the first
// format in `src` the browser can play) and reports combined progress.
let preloader = (function (){
  const SOUND_TIMEOUT = 8000; // a stuck sound must not block the game

  let _preloader = {
    onupdate: null,

    start: (imageUrls, soundSpecs) => {
      let names = Object.keys(soundSpecs);
      let total = imageUrls.length + names.length;
      let done  = 0;

      let tick = () => {
        done++;
        if (_preloader.onupdate != null){
          _preloader.onupdate(Math.floor(done / total * 100));
        }
      };

      let loadImage = src => new Promise((resolve, reject) => {
        let img = new Image();
        img.onload  = () => { tick(); resolve(img); };
        img.onerror = () => reject(new Error('Could not load ' + src));
        img.src = src;
      });

      let loadSound = name => new Promise(resolve => {
        let howl = new Howl(Object.assign({preload: true}, soundSpecs[name]));
        let settled = false;
        let finish = () => {
          if (settled){ return; }
          settled = true;
          tick();
          resolve(howl);
        };
        howl.once('load', finish);
        howl.once('loaderror', finish);
        setTimeout(finish, SOUND_TIMEOUT);
      });

      return Promise.all([
        Promise.all(imageUrls.map(loadImage)),
        Promise.all(names.map(loadSound)),
      ]).then(([images, howls]) => {
        let sounds = {};
        names.forEach((name, i) => { sounds[name] = howls[i]; });
        return {images: images, sounds: sounds};
      });
    },
  };

  return _preloader;
}());
