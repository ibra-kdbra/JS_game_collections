const API_KEY = 'AIzaSyDko3TK7EORgKRHUPXOyJYHn4qpzyOh2EI';

async function fetchPlaylistItems(playlistId) {
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&key=${API_KEY}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (!data.items) {
      console.error('No items found in playlist response:', data);
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
    console.error('Error fetching playlist items:', error);
    return [];
  }
}

async function fetchVideoDetails(videoId) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=status&id=${videoId}&key=${API_KEY}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.items.length > 0) {
      return data.items[0].status;
    }
    return null;
  } catch (error) {
    console.error('Error fetching video details:', error);
    return null;
  }
}

export { fetchPlaylistItems, fetchVideoDetails };
