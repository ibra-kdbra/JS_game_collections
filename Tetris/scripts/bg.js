// // Add a function to ensure the background video resizes
// const bgVideo = document.getElementById('bgVideo');
// const bgVideoContainer = document.getElementById('bgVideoContainer');
// const vidAr = bgVideoContainer.offsetWidth / bgVideoContainer.offsetHeight;

// function bgResize() {
//   const windowAr = window.innerWidth / window.innerHeight;

//   if (windowAr > vidAr) {
//     bgVideoContainer.style.height = 'auto';
//     bgVideoContainer.style.width = `${window.innerWidth}px`;

//     const shift = Math.max((bgVideoContainer.offsetHeight - window.innerHeight) / 2, 0);
//     bgVideoContainer.style.top = `-${shift}px`;
//     bgVideoContainer.style.left = '0';
//   } else {
//     bgVideoContainer.style.width = 'auto';
//     bgVideoContainer.style.height = `${window.innerHeight}px`;

//     const shift = Math.max((bgVideoContainer.offsetWidth - window.innerWidth) / 2, 0);
//     bgVideoContainer.style.left = `-${shift}px`;
//     bgVideoContainer.style.top = '0';
//   }
// }

// window.addEventListener('resize', bgResize);
// bgResize();