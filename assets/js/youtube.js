const API_KEY = 'AIzaSyDko3TK7EORgKRHUPXOyJYHn4qpzyOh2EI';

async function fetchPlaylistItems(playlistId) {
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&key=${API_KEY}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (!data.items) {
      // Silent fail
      return [];
    }
    return data.items
      .map(item => ({
        videoId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.high.url,
      }))
      .filter(item => item.title !== 'Deleted video' && item.title !== 'Private video');
  } catch (error) {
    // Silent fail
    return [];
  }
}

async function fetchVideoDetails(videoId) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=status&id=${videoId}&key=${API_KEY}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.items && data.items.length > 0) {
      return data.items[0].status;
    }
    return null;
  } catch (error) {
    return null;
  }
}

export { fetchPlaylistItems, fetchVideoDetails };
